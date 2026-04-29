/* StainBoost Companion — pushes League client data to the order tracker.
 *
 * What it does:
 *   1. Detects the running LeagueClientUx.exe on this PC.
 *   2. Connects to the local League client API (LCU) via WebSocket.
 *   3. Pushes the current ranked tier/LP whenever it changes.
 *   4. Detects ranked solo/duo games ending and posts result + KDA + LP delta.
 *
 * It picks which order to attach to by listing active orders from the backend
 * and prompting once at startup. State (last match ID, last seen LP) is stored
 * in companion-state.json next to this script.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');
const { exec } = require('child_process');
const readline = require('readline');
const WebSocket = require('ws');

// ── CONFIG ─────────────────────────────────────────────────────────────────
const CONFIG_PATH = path.join(__dirname, 'config.json');
const STATE_PATH  = path.join(__dirname, 'companion-state.json');

if (!fs.existsSync(CONFIG_PATH)) {
  console.error('[fatal] config.json missing. Copy config.example.json → config.json and fill it in.');
  process.exit(1);
}
const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
if (!config.apiBase || !config.adminKey || config.adminKey.startsWith('PASTE_')) {
  console.error('[fatal] config.json is missing apiBase or adminKey.');
  process.exit(1);
}

let state = {};
try { state = JSON.parse(fs.readFileSync(STATE_PATH, 'utf8')); } catch (_) { state = {}; }
function saveState() {
  try { fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2)); } catch (e) { console.warn('[warn] could not save state:', e.message); }
}

// HTTPS agent that ignores the LCU's self-signed certificate.
const lcuAgent = new https.Agent({ rejectUnauthorized: false });

// ── HELPERS ────────────────────────────────────────────────────────────────
function log(...args) {
  const ts = new Date().toLocaleTimeString();
  console.log(`[${ts}]`, ...args);
}

function rlPrompt(question) {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, ans => { rl.close(); resolve(ans.trim()); });
  });
}

// ── LCU DISCOVERY ──────────────────────────────────────────────────────────
// Find the running League client and grab its port + auth token from the process command line.
function findLcu() {
  return new Promise(resolve => {
    // wmic is deprecated on Win11 but still works; PowerShell fallback if not.
    const ps = `powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \\"name='LeagueClientUx.exe'\\" | Select-Object -ExpandProperty CommandLine"`;
    exec(ps, { windowsHide: true, timeout: 8000 }, (err, stdout) => {
      if (err || !stdout || !stdout.trim()) return resolve(null);
      const cmd = stdout.toString();
      const port  = (cmd.match(/--app-port=(\d+)/) || [])[1];
      const token = (cmd.match(/--remoting-auth-token=([^"\s]+)/) || [])[1];
      if (!port || !token) return resolve(null);
      resolve({ port: Number(port), token });
    });
  });
}

async function waitForLcu() {
  log('Waiting for League client…');
  while (true) {
    const lcu = await findLcu();
    if (lcu) { log(`Connected to League client on port ${lcu.port}.`); return lcu; }
    await new Promise(r => setTimeout(r, 3000));
  }
}

// ── LCU REST ───────────────────────────────────────────────────────────────
async function lcuFetch(lcu, pathName) {
  const url = `https://127.0.0.1:${lcu.port}${pathName}`;
  const auth = 'Basic ' + Buffer.from(`riot:${lcu.token}`).toString('base64');
  const res = await fetch(url, { headers: { Authorization: auth }, dispatcher: undefined, agent: lcuAgent });
  if (!res.ok) throw new Error(`LCU ${pathName} → ${res.status}`);
  return res.json();
}

// Node 18 fetch ignores `agent`. Use https module directly for self-signed cert support.
function lcuRequest(lcu, pathName) {
  return new Promise((resolve, reject) => {
    const auth = 'Basic ' + Buffer.from(`riot:${lcu.token}`).toString('base64');
    const req = https.request({
      hostname: '127.0.0.1', port: lcu.port, path: pathName, method: 'GET',
      headers: { Authorization: auth, Accept: 'application/json' },
      agent: lcuAgent, rejectUnauthorized: false,
    }, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try { resolve(JSON.parse(body)); } catch { resolve(body); }
        } else {
          reject(new Error(`LCU ${pathName} → ${res.statusCode}`));
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

// ── BACKEND ────────────────────────────────────────────────────────────────
async function api(endpoint, method = 'GET', body = null) {
  const url = config.apiBase.replace(/\/+$/, '') + endpoint;
  const opts = { method, headers: { 'x-admin-key': config.adminKey } };
  if (body) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(url, opts);
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (!res.ok) throw new Error(`${endpoint} → ${res.status} ${json.error || text}`);
  return json;
}

// ── PICK ORDER ─────────────────────────────────────────────────────────────
function ignVariants(s) {
  const v = String(s || '').toLowerCase().trim();
  // Drop tag (#EUW etc.) and surrounding whitespace so 'Stain#EUW' matches 'stain'.
  const noTag = v.split('#')[0].trim();
  return [v, noTag].filter(Boolean);
}

async function getCurrentSummonerIgn(lcu) {
  try {
    const me = await lcuRequest(lcu, '/lol-summoner/v1/current-summoner');
    if (!me) return null;
    // Newer clients: gameName + tagLine. Older: displayName / internalName.
    const gameName = me.gameName || me.displayName || me.internalName || '';
    const tag = me.tagLine || '';
    return { gameName, tag, full: tag ? `${gameName}#${tag}` : gameName };
  } catch (e) {
    log('[warn] Could not read current summoner:', e.message);
    return null;
  }
}

function findOrderByIgn(orders, summoner) {
  if (!summoner || !summoner.gameName) return null;
  const candidates = [
    summoner.full && summoner.full.toLowerCase(),
    summoner.gameName && summoner.gameName.toLowerCase(),
  ].filter(Boolean);
  const matches = orders.filter(o => {
    const variants = ignVariants(o.ign);
    return variants.some(v => candidates.includes(v));
  });
  return matches.length === 1 ? matches[0] : null;
}

async function pickOrder(lcu) {
  log('Loading active orders from StainBoost…');
  const { orders } = await api('/api/order-tracking/list');
  const active = (orders || []).filter(o => o.status !== 'completed' && o.status !== 'cancelled');
  if (!active.length) {
    console.error('[fatal] No active orders found.');
    process.exit(1);
  }

  // Try to match by current League account IGN.
  if (lcu) {
    const me = await getCurrentSummonerIgn(lcu);
    if (me && me.gameName) {
      const match = findOrderByIgn(active, me);
      if (match) {
        log(`Matched current account "${me.full}" → order ${match.token} (${match.summary}).`);
        return match.token;
      }
      log(`Logged in as "${me.full}" but no active order matches that IGN. Falling back to manual pick.`);
    }
  }

  if (active.length === 1) {
    log(`Auto-selected the only active order: ${active[0].token} (${active[0].summary})`);
    return active[0].token;
  }
  console.log('\nActive orders:');
  active.forEach((o, i) => {
    console.log(`  ${i + 1}) ${o.token}  —  ${o.ign}  —  ${o.summary}`);
  });
  while (true) {
    const ans = await rlPrompt('\nPick an order by number (or paste a token): ');
    if (/^SB-[A-Z0-9]{4}-[A-Z0-9]{4}$/i.test(ans)) return ans.toUpperCase();
    const idx = parseInt(ans, 10);
    if (idx >= 1 && idx <= active.length) return active[idx - 1].token;
    console.log('Invalid choice.');
  }
}

// ── DATA DRAGON (champion ID → name) ───────────────────────────────────────
let CHAMPS = {};
async function loadChampions() {
  try {
    const versions = await fetch('https://ddragon.leagueoflegends.com/api/versions.json').then(r => r.json());
    const v = versions[0];
    const data = await fetch(`https://ddragon.leagueoflegends.com/cdn/${v}/data/en_US/champion.json`).then(r => r.json());
    CHAMPS = {};
    Object.values(data.data).forEach(c => { CHAMPS[Number(c.key)] = c.name; });
    log(`Loaded ${Object.keys(CHAMPS).length} champions from Data Dragon (patch ${v}).`);
  } catch (e) {
    log('[warn] Failed to load champion names:', e.message);
  }
}

// ── RANK / GAME PUSHERS ────────────────────────────────────────────────────
const TIER_NAMES = {
  IRON: 'Iron', BRONZE: 'Bronze', SILVER: 'Silver', GOLD: 'Gold',
  PLATINUM: 'Platinum', EMERALD: 'Emerald', DIAMOND: 'Diamond',
  MASTER: 'Master', GRANDMASTER: 'Grandmaster', CHALLENGER: 'Challenger',
  UNRANKED: 'Unranked',
};
const DIVS = { I: 'I', II: 'II', III: 'III', IV: 'IV', NA: '' };

function formatRank(tier, division) {
  const t = TIER_NAMES[String(tier || '').toUpperCase()] || 'Unranked';
  if (t === 'Unranked' || t === 'Master' || t === 'Grandmaster' || t === 'Challenger') return t;
  const d = DIVS[String(division || '').toUpperCase()] || '';
  return d ? `${t} ${d}` : t;
}

async function pushRank(orderToken, lcu) {
  try {
    const data = await lcuRequest(lcu, '/lol-ranked/v1/current-ranked-stats');
    const queues = data.queues || [];
    const solo = queues.find(q => q.queueType === 'RANKED_SOLO_5x5');
    if (!solo) return null;
    const rank = formatRank(solo.tier, solo.division);
    const lp = solo.leaguePoints | 0;

    if (state.lastRank === rank && state.lastLp === lp) return { rank, lp, changed: false };

    await api('/api/order-tracking/update', 'POST', {
      token: orderToken, currentRank: rank, currentLp: lp,
    });
    log(`Rank pushed: ${rank} ${lp} LP`);
    state.lastRank = rank;
    state.lastLp = lp;
    saveState();
    return { rank, lp, changed: true };
  } catch (e) {
    log('[warn] pushRank failed:', e.message);
    return null;
  }
}

async function pushLastRankedGame(orderToken, lcu) {
  try {
    const hist = await lcuRequest(lcu, '/lol-match-history/v1/products/lol/current-summoner/matches?begIndex=0&endIndex=5');
    const games = hist?.games?.games || [];
    if (!games.length) return;

    // Pick most recent ranked solo/duo (queueId 420). Fall back to flex (440) if none.
    const game = games.find(g => g.queueId === 420) || games.find(g => g.queueId === 440);
    if (!game) return;

    const gameId = String(game.gameId || '');
    if (!gameId || gameId === state.lastGameId) return;

    const me = (game.participants || [])[0];
    if (!me || !me.stats) return;

    const champion = CHAMPS[me.championId] || `Champ #${me.championId}`;
    const k = me.stats.kills | 0, d = me.stats.deaths | 0, a = me.stats.assists | 0;

    // Remake detection: client flags `gameEndedInEarlySurrender`, and
    // remakes always end before ~4 minutes (240s). Either condition is a remake.
    const isRemake = !!me.stats.gameEndedInEarlySurrender
                  || (typeof game.gameDuration === 'number' && game.gameDuration > 0 && game.gameDuration < 240);
    const result = isRemake ? 'R' : (me.stats.win ? 'W' : 'L');

    // LP delta: derive from before/after snapshot if we have one. Remakes
    // never change LP, so skip the delta entirely in that case.
    const before = state.lpBeforeGame;
    const after  = await lcuRequest(lcu, '/lol-ranked/v1/current-ranked-stats').catch(() => null);
    const soloAfter = after?.queues?.find(q => q.queueType === 'RANKED_SOLO_5x5');
    let lpChange = null;
    if (!isRemake && soloAfter && typeof before === 'number') {
      lpChange = (soloAfter.leaguePoints | 0) - before;
      if (lpChange < -99 || lpChange > 99) lpChange = null; // promo / demo skews this; skip rather than mislead
    }

    const payload = {
      token: orderToken,
      addGame: { result, champion, kda: `${k}/${d}/${a}` },
    };
    if (lpChange !== null) payload.addGame.lp = lpChange;

    await api('/api/order-tracking/update', 'POST', payload);
    const lpStr = lpChange !== null ? ` · ${lpChange >= 0 ? '+' : ''}${lpChange} LP` : '';
    const tag = isRemake ? 'REMAKE' : result;
    log(`Game pushed: ${tag} · ${champion} · ${k}/${d}/${a}${lpStr}`);

    state.lastGameId = gameId;
    if (soloAfter) {
      state.lpBeforeGame = soloAfter.leaguePoints | 0;
      state.lastRank = formatRank(soloAfter.tier, soloAfter.division);
      state.lastLp = soloAfter.leaguePoints | 0;
    }
    saveState();
  } catch (e) {
    log('[warn] pushLastRankedGame failed:', e.message);
  }
}

// ── WEBSOCKET LOOP ─────────────────────────────────────────────────────────
function connectWs(lcu, orderToken) {
  const url = `wss://127.0.0.1:${lcu.port}`;
  const auth = 'Basic ' + Buffer.from(`riot:${lcu.token}`).toString('base64');
  const ws = new WebSocket(url, 'wamp', {
    headers: { Authorization: auth },
    rejectUnauthorized: false,
  });

  ws.on('open', async () => {
    log('Connected to League client WebSocket.');
    ws.send(JSON.stringify([5, 'OnJsonApiEvent']));

    // Initial push: rank + try to capture the recent game we may have missed.
    const r = await pushRank(orderToken, lcu);
    if (r) state.lpBeforeGame = r.lp;
    saveState();
  });

  ws.on('message', async (raw) => {
    let msg; try { msg = JSON.parse(raw); } catch { return; }
    if (!Array.isArray(msg) || msg.length < 3) return;
    const event = msg[2];
    if (!event || !event.uri) return;

    // Capture LP just before a game starts so we can compute delta after.
    if (event.uri === '/lol-gameflow/v1/gameflow-phase') {
      const phase = event.data;
      if (phase === 'InProgress' || phase === 'GameStart') {
        const stats = await lcuRequest(lcu, '/lol-ranked/v1/current-ranked-stats').catch(() => null);
        const solo = stats?.queues?.find(q => q.queueType === 'RANKED_SOLO_5x5');
        if (solo) { state.lpBeforeGame = solo.leaguePoints | 0; saveState(); }
      }
      if (phase === 'EndOfGame' || phase === 'PreEndOfGame' || phase === 'WaitingForStats') {
        // Wait a moment for match history + ranked stats to refresh, then push.
        setTimeout(() => pushLastRankedGame(orderToken, lcu), 12000);
      }
    }

    // Rank stats updated.
    if (event.uri === '/lol-ranked/v1/current-ranked-stats') {
      pushRank(orderToken, lcu);
    }
  });

  ws.on('close', () => {
    log('WebSocket closed. Re-checking client in 5s…');
    setTimeout(main, 5000);
  });
  ws.on('error', (e) => { log('[warn] ws error:', e.message); });
}

// ── MAIN ───────────────────────────────────────────────────────────────────
async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(' StainBoost Companion');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  log('API base:', config.apiBase);

  await loadChampions();
  const lcu = await waitForLcu();

  // Always re-pick on each launch — your active League account decides which
  // order to attach to, so we should match it fresh. Pass --keep to reuse the
  // last saved order regardless of who's logged in.
  if (process.argv.includes('--keep') && state.orderToken) {
    log(`Reusing saved order ${state.orderToken}. (--keep specified.)`);
  } else {
    state.orderToken = await pickOrder(lcu);
    saveState();
  }

  connectWs(lcu, state.orderToken);
}

main().catch(e => {
  console.error('[fatal]', e.message);
  process.exit(1);
});
