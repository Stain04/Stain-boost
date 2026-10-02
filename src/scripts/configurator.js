// /pricing — live price calculator, checkout box and post-order panel.
// Every price comes from quoteOrder() in src/data/pricing.js — the same function the
// order API uses — and the page sends the total it showed, which the API must match.
import {
  WIN_PRICES, MASTERS, LP_OPTIONS, MAX_WINS, PRIORITY_RATE, REFERRAL_RATE,
  rankPosition, rankName, rankBoostBase, freeWins, formatUSD, quoteOrder, bonusWinPrice,
} from '../data/pricing.js';
import { track } from './analytics.js';

const form = document.querySelector('[data-cfg]');
// the calculator (form) and the checkout box (summary) together: every input lives in here
const root = document.querySelector('[data-layout]');
if (form && root) init();

function init() {
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const WIN_RANKS = Object.keys(WIN_PRICES);
  const SERVERS = ['me', 'euw', 'eune'];
  const PENDING = 'sb_pending_order_v2';
  const QUEUE_HINT = {
    solo: 'Stain plays on your account, in offline mode with a VPN matched to your country.',
    duo: 'You play your own account together with Stain. No password shared.',
  };
  const summary = $('[data-summary]');
  const totalEl = $('[data-total]', summary);
  const submitBtn = $('[data-submit]', summary);
  const errEl = $('[data-error]', summary);
  let shown = parseFloat(totalEl.textContent.replace(/[^0-9.]/g, '')) || 0;
  let raf = 0, started = false;
  let user = window.__sbUser;
  // money state that isn't part of the form
  const acct = { referral: '', credit: 0, firstOrder: true };

  const val = (name) => root.querySelector(`input[name="${name}"]:checked`)?.value;
  const on = (name) => !!root.querySelector(`input[name="${name}"]`)?.checked;
  const setRadio = (name, v) => { const el = root.querySelector(`input[name="${name}"][value="${v}"]`); if (el && !el.disabled) el.checked = true; };
  // Discord sign-ins already have a Discord name (the order API uses it); only email accounts type one.
  const needsDiscord = () => !!user && !user.discordUsername;
  const clampWins = (n) => Math.max(1, Math.min(MAX_WINS, Math.round(n) || 1));

  function read() {
    return {
      mode: val('mode'),
      fromTier: +val('fromTier'), fromDiv: +val('fromDiv'), toTier: +val('toTier'), toDiv: +(val('toDiv') ?? 0),
      lp: +val('lp'),
      winRank: +val('winRank'), wins: clampWins(+$('#wins').value),
      type: val('type'), region: val('region'),
      priority: on('priority'), bonusWin: on('bonusWin'),
      discord: $('#discord').value.trim(), ign: $('#ign').value.trim(),
    };
  }
  const toQuote = (s, extra = {}) => ({
    mode: s.mode, type: s.type,
    fromTier: s.fromTier, fromDiv: s.fromDiv, toTier: s.toTier, toDiv: s.toDiv, lp: s.lp,
    rank: WIN_RANKS[s.winRank], wins: s.wins,
    priority: s.priority, bonusWin: s.mode === 'rank' && s.bonusWin && bonusWinPrice(s.toTier) !== null,
    referral: !!acct.referral, credit: acct.credit,
    ...extra,
  });

  // ── Rank rules: the target must be above the current rank ────────────────
  function constrain() {
    const fromTier = +val('fromTier'), fromDiv = +val('fromDiv');
    const fromPos = rankPosition(fromTier, fromDiv);
    $$('input[name="toTier"]', form).forEach((i) => {
      const t = +i.value;
      i.disabled = (t === MASTERS ? 28 : t * 4 + 3) <= fromPos;
    });
    if (form.querySelector('input[name="toTier"]:checked')?.disabled) {
      const next = fromPos + 1;
      setRadio('toTier', next >= 28 ? MASTERS : Math.floor(next / 4));
      if (next < 28) setRadio('toDiv', next % 4);
    }
    const toTier = +val('toTier');
    $$('input[name="toDiv"]', form).forEach((i) => { i.disabled = toTier === fromTier && +i.value <= fromDiv; });
    if (toTier !== MASTERS && form.querySelector('input[name="toDiv"]:checked')?.disabled) {
      const first = $$('input[name="toDiv"]', form).find((i) => !i.disabled);
      if (first) first.checked = true;
    }
    $('[data-to-div]', form).hidden = toTier === MASTERS;
  }

  // ── Price + summary ───────────────────────────────────────────────────────
  function quote(s) {
    const q = quoteOrder(toQuote(s));
    const queue = s.type === 'duo' ? 'Duo' : 'Solo', server = (s.region || 'me').toUpperCase();
    const lines = [];
    let route, meta, base, free = 0, divs = 0;
    if (s.mode === 'wins') {
      const rank = WIN_RANKS[s.winRank];
      free = freeWins(s.wins);
      route = `${rank.replace('-', '–')} · ${s.wins + free} net win${s.wins + free !== 1 ? 's' : ''}`;
      meta = `${s.wins} paid${free ? ` + ${free} free` : ''} · ${queue} · ${server}`;
      base = `${s.wins} win${s.wins !== 1 ? 's' : ''} × ${formatUSD(WIN_PRICES[rank][s.type])}`;
    } else {
      divs = rankPosition(s.toTier, s.toDiv) - rankPosition(s.fromTier, s.fromDiv);
      route = `${rankName(s.fromTier, s.fromDiv)} → ${rankName(s.toTier, s.toDiv)}`;
      meta = `${divs} division${divs !== 1 ? 's' : ''} · ${queue} · ${server}`;
      base = `${divs} division${divs !== 1 ? 's' : ''}`;
      if (q.bonus) lines.push({ k: 'Bonus win', v: '+' + formatUSD(q.bonus), cls: 'extra' });
    }
    if (q.priority) lines.push({ k: `Priority start (+${Math.round(PRIORITY_RATE * 100)}%)`, v: '+' + formatUSD(q.priority), cls: 'extra' });
    if (q.referral) lines.push({ k: `Referral ${acct.referral} (−${Math.round(REFERRAL_RATE * 100)}%)`, v: '−' + formatUSD(q.referral), cls: 'credit' });
    if (q.credit) lines.push({ k: 'Your referral credit', v: '−' + formatUSD(q.credit), cls: 'credit' });
    if (lines.length) lines.unshift({ k: base, v: formatUSD(q.base) });
    return { ...q, lines, route, meta, free, divs };
  }

  function tick(to) {
    cancelAnimationFrame(raf);
    const from = shown;
    if (reduce || document.hidden || Math.abs(from - to) < 0.005) { shown = to; totalEl.textContent = formatUSD(to); return; }
    const t0 = performance.now(), dur = 550;
    clearTimeout(tick.safety); // frames pause in background tabs — the final price always lands
    tick.safety = setTimeout(() => { cancelAnimationFrame(raf); shown = to; totalEl.textContent = formatUSD(to); }, dur + 120);
    const step = (now) => {
      const k = Math.min(1, (now - t0) / dur);
      shown = from + (to - from) * (1 - Math.pow(1 - k, 3));
      totalEl.textContent = formatUSD(k < 1 ? shown : to);
      if (k < 1) raf = requestAnimationFrame(step); else shown = to;
    };
    raf = requestAnimationFrame(step);
    totalEl.animate?.([{ transform: 'scale(1.06)' }, { transform: 'scale(1)' }], { duration: 400, easing: 'cubic-bezier(.16,1,.3,1)' });
  }

  // ── Render ────────────────────────────────────────────────────────────────
  function render() {
    const s = read();
    $$('[data-show]', form).forEach((el) => { el.hidden = el.dataset.show !== s.mode; });
    $('[data-queue-hint]', form).textContent = QUEUE_HINT[s.type] || QUEUE_HINT.solo;
    // add-ons (checkout box)
    const bonusPrice = s.mode === 'rank' ? bonusWinPrice(s.toTier) : null;
    $('[data-bonus-extra]', summary).hidden = bonusPrice === null;
    if (bonusPrice !== null) $('[data-extra-price="bonus"]', summary).textContent = '+' + formatUSD(bonusPrice);
    const withPriority = quoteOrder(toQuote(s, { priority: true, referral: false, credit: 0 }));
    $('[data-extra-price="priority"]', summary).textContent = '+' + formatUSD(withPriority.priority);

    const q = quote(s);
    $('[data-sum-route]', summary).textContent = q.route + (q.bonus ? ' + 1 win' : '');
    $('[data-sum-meta]', summary).textContent = q.meta + (s.priority ? ' · Priority' : '');
    const linesEl = $('[data-lines]', summary);
    linesEl.hidden = !q.lines.length;
    linesEl.innerHTML = q.lines.map((l) => `<div class="${l.cls || ''}"><dt>${l.k}</dt><dd>${l.v}</dd></div>`).join('');
    tick(q.total);
    if (s.mode === 'rank') {
      const raw = rankBoostBase(s.fromTier, s.fromDiv, s.toTier, s.toDiv, s.type, 0);
      $$('[data-lp-save]', form).forEach((el) => {
        const v = +el.dataset.lpSave;
        el.textContent = v > 0 ? '−' + formatUSD(raw - rankBoostBase(s.fromTier, s.fromDiv, s.toTier, s.toDiv, s.type, v)) : '';
      });
    } else {
      const free = freeWins(s.wins);
      $('[data-wins-get]', form).innerHTML = `You get <b>${s.wins + free} win${s.wins + free !== 1 ? 's' : ''}</b>${free ? ` <span class="gold">(${free} free)</span>` : ''}`;
      $$('[data-wins]', form).forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.wins === s.wins)));
    }
    $$('[data-win-price]', form).forEach((el) => { el.textContent = formatUSD(WIN_PRICES[el.dataset.winPrice][s.type]) + '/win'; });
    $('[data-discord-field]', summary).hidden = !needsDiscord();
    const price = formatUSD(q.total);
    $('[data-submit-label]', summary).textContent = user ? `Place order · ${price}` : `Order with Discord · ${price}`;
    $('[data-submit-icon]', summary).style.display = user ? 'none' : '';
    $('[data-submit-note]', summary).hidden = !!user;
    document.dispatchEvent(new CustomEvent('sb:quote', { detail: { total: q.total, label: q.route, href: '#sum-route' } }));
    return { s, q };
  }

  let evTimer = 0;
  function update(name) {
    if (['fromTier', 'fromDiv', 'toTier', 'toDiv'].includes(name)) constrain();
    const { s, q } = render();
    errEl.hidden = true;
    if (!started) { started = true; track('configurator_start', { mode: s.mode }); }
    if (name === 'priority' || name === 'bonusWin') track(on(name) ? 'addon_add' : 'addon_remove', { addon: name, value: +q.total.toFixed(2), currency: 'USD' });
    clearTimeout(evTimer);
    evTimer = setTimeout(() => {
      const map = { mode: 'select_mode', type: 'select_queue', region: 'select_server', lp: 'select_lp', wins: 'set_wins', winRank: 'select_rank' };
      const ev = map[name] || (['fromTier', 'fromDiv', 'toTier', 'toDiv'].includes(name) ? 'select_rank' : null);
      if (ev) track(ev, { mode: s.mode, route: q.route, queue: s.type, value: +q.total.toFixed(2), currency: 'USD' });
    }, 500);
  }

  function setWins(n) { $('#wins').value = clampWins(n); update('wins'); }

  root.addEventListener('change', (e) => { if (e.target.name) update(e.target.name); });
  $('#wins').addEventListener('input', () => { if ($('#wins').value !== '') update('wins'); });
  $('#wins').addEventListener('blur', () => setWins(+$('#wins').value));
  $$('[data-wins-step]', form).forEach((b) => b.addEventListener('click', () => setWins(+$('#wins').value + +b.dataset.winsStep)));
  $$('[data-wins]', form).forEach((b) => b.addEventListener('click', () => setWins(+b.dataset.wins)));
  form.addEventListener('submit', (e) => e.preventDefault());

  // ── Account money: referral code + credit ────────────────────────────────
  const refInput = $('#refCode', summary), refMsg = $('[data-ref-msg]', summary);
  function setRefMsg(text, ok) { refMsg.textContent = text; refMsg.className = 'ref-msg ' + (ok ? 'ok' : 'bad'); }
  async function applyReferral(code, silent) {
    code = String(code || '').trim().toUpperCase();
    if (!code) return;
    try {
      const d = await fetch('/api/referral?check=' + encodeURIComponent(code)).then((r) => r.json());
      if (d.valid) {
        acct.referral = code;
        refInput.value = code;
        $('[data-refbox]', summary).open = true;
        setRefMsg(`✓ ${Math.round(REFERRAL_RATE * 100)}% off applied.`, true);
        track('referral_applied', { code });
      } else {
        acct.referral = '';
        if (!silent) setRefMsg(d.reason || "That code can't be used.", false);
      }
    } catch { if (!silent) setRefMsg('Could not check the code. Try again.', false); }
    render();
  }
  $('[data-ref-apply]', summary).addEventListener('click', () => applyReferral(refInput.value));
  refInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); applyReferral(refInput.value); } });

  async function loadAccount() {
    if (!user) { acct.credit = 0; return; }
    try {
      const d = await fetch('/api/referral').then((r) => (r.ok ? r.json() : null));
      if (d) {
        acct.credit = d.credit || 0;
        acct.firstOrder = !!d.firstOrder;
        if (!acct.firstOrder && acct.referral) { acct.referral = ''; setRefMsg('Referral codes are for a first order only.', false); }
      }
    } catch {}
    render();
  }
  document.addEventListener('sb:user', (e) => { user = e.detail; loadAccount(); });

  // ── Pending order (kept through sign-in) ──────────────────────────────────
  function savePending(s) {
    try { localStorage.setItem(PENDING, JSON.stringify({ ...s, referral: acct.referral, ts: Date.now() })); } catch {}
  }
  function restore(o) {
    setRadio('mode', o.mode === 'wins' ? 'wins' : 'rank');
    setRadio('type', o.type === 'duo' ? 'duo' : 'solo');
    if (SERVERS.includes(o.region)) setRadio('region', o.region);
    if (Number.isInteger(o.fromTier)) setRadio('fromTier', o.fromTier);
    if (Number.isInteger(o.fromDiv)) setRadio('fromDiv', o.fromDiv);
    constrain();
    if (Number.isInteger(o.toTier)) setRadio('toTier', o.toTier);
    constrain();
    if (Number.isInteger(o.toDiv)) setRadio('toDiv', o.toDiv);
    constrain();
    if (LP_OPTIONS.some((x) => x.value === o.lp)) setRadio('lp', o.lp);
    if (Number.isInteger(o.winRank)) setRadio('winRank', o.winRank);
    if (o.wins) $('#wins').value = clampWins(o.wins);
    const pr = root.querySelector('input[name="priority"]'); if (pr) pr.checked = !!o.priority;
    const bw = root.querySelector('input[name="bonusWin"]'); if (bw) bw.checked = !!o.bonusWin;
    if (typeof o.discord === 'string') $('#discord').value = o.discord.slice(0, 80);
    if (typeof o.ign === 'string') $('#ign').value = o.ign.slice(0, 60);
  }
  function fromUrl() {
    const p = new URLSearchParams(location.search);
    const o = {};
    if (p.get('mode') === 'wins') o.mode = 'wins';
    const ft = (p.get('from') || '').split('-').map(Number), tt = (p.get('to') || '').split('-').map(Number);
    if (ft.length === 2 && ft.every(Number.isInteger)) { o.fromTier = ft[0]; o.fromDiv = ft[1]; }
    if (tt.length === 2 && tt.every(Number.isInteger)) { o.toTier = tt[0]; o.toDiv = tt[1]; }
    if (p.get('queue')) o.type = p.get('queue');
    const wr = WIN_RANKS.indexOf(p.get('rank') || '');
    if (wr >= 0) o.winRank = wr;
    if (+p.get('wins') > 0) o.wins = +p.get('wins');
    const server = (p.get('server') || '').toLowerCase();
    if (SERVERS.includes(server)) o.region = server;
    return o;
  }

  let pending = null;
  try { pending = JSON.parse(localStorage.getItem(PENDING) || 'null'); } catch {}
  const resumed = !!(pending && Date.now() - pending.ts < 2 * 3600_000);
  if (resumed) {
    restore(pending);
    try { localStorage.removeItem(PENDING); } catch {}
  } else {
    const o = fromUrl();
    if (Object.keys(o).length) restore({ mode: o.mode || 'rank', type: o.type, fromTier: o.fromTier, fromDiv: o.fromDiv, toTier: o.toTier, toDiv: o.toDiv, winRank: o.winRank, wins: o.wins, region: o.region, lp: LP_OPTIONS[0].value });
  }
  constrain();
  render();
  // referral code: from a pending order, or from a ?ref= link (saved by common.js)
  let storedRef = '';
  try { storedRef = (JSON.parse(localStorage.getItem('sb_ref') || 'null') || {}).code || ''; } catch {}
  const startRef = (resumed && pending.referral) || storedRef;
  if (startRef) applyReferral(startRef, true);
  if (user) loadAccount();
  if (resumed) {
    showError('✅ Welcome back — your order is ready. Check it and press the button to place it.', true);
    summary.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  }

  // ── Checkout ──────────────────────────────────────────────────────────────
  function showError(text, ok = false) {
    errEl.textContent = text;
    errEl.hidden = false;
    errEl.style.cssText = ok ? 'color:#d1fae5;background:rgba(52,211,153,.1);border-color:rgba(52,211,153,.4)' : '';
  }

  function validate(s) {
    const checks = [['ign', s.ign.length >= 3]];
    if (needsDiscord()) checks.unshift(['discord', s.discord.length >= 2]);
    const bad = [];
    checks.forEach(([id, ok]) => {
      $('#' + id).setAttribute('aria-invalid', String(!ok));
      if (!ok) bad.push(id);
    });
    if (bad.length) {
      showError(needsDiscord() ? 'Add your Discord username and your League Riot ID so Stain can reach you.' : 'Add your League Riot ID — the account Stain will boost.');
      $('#' + bad[0]).focus();
      return false;
    }
    return true;
  }

  async function currentUser() {
    try { const r = await fetch('/api/auth/me', { credentials: 'same-origin' }); const d = await r.json(); return d.user || null; } catch { return null; }
  }

  function goSignIn(s) {
    savePending(s);
    track('login_required', { method: 'discord' });
    location.href = '/api/auth/discord-start?return=' + encodeURIComponent('/pricing?resume=1');
  }
  $('[data-email-link]', summary).addEventListener('click', () => { savePending(read()); track('login_required', { method: 'email' }); });

  let busy = false;
  submitBtn.addEventListener('click', async () => {
    if (busy) return;
    let s = read();
    let q = quote(s);
    track('begin_checkout', { currency: 'USD', value: +q.total.toFixed(2), items: [{ item_name: s.mode === 'wins' ? 'Net wins' : 'Rank boost', item_variant: q.route, price: +q.total.toFixed(2), quantity: 1 }] });
    if (!validate(s)) return;
    busy = true;
    submitBtn.setAttribute('aria-disabled', 'true');
    try {
      const wasSignedIn = !!user;
      user = await currentUser();
      if (!user) return goSignIn(s);
      if (!wasSignedIn) { await loadAccount(); s = read(); q = quote(s); if (!validate(s)) return; }
      const common = { type: s.type, discord: needsDiscord() ? s.discord : '', ign: s.ign, region: s.region, priority: s.priority, referralCode: acct.referral || '', expectedTotal: q.total.toFixed(2) };
      const body = s.mode === 'wins'
        ? { ...common, orderType: 'win_boost', rank: WIN_RANKS[s.winRank], wins: s.wins }
        : { ...common, orderType: 'rank_boost', fromTier: s.fromTier, fromDiv: s.fromDiv, toTier: s.toTier, toDiv: s.toDiv, currentLP: s.lp, bonusWin: !!q.bonus };
      const res = await fetch('/api/order', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401 && data.requireLogin) return goSignIn(s);
      if (res.status === 409 || data.referralInvalid) {
        if (data.referralInvalid) { acct.referral = ''; setRefMsg(data.error, false); }
        await loadAccount();
        showError((data.error || 'The price changed.') + ' The total above is up to date.');
        return;
      }
      if (!res.ok || !data.ok) { showError((data.error || 'Could not place the order.') + ' You can also message stain.hs on Discord.'); return; }
      const value = +data.total;
      track('order_submitted', { mode: s.mode, value, currency: 'USD', transaction_id: data.token, priority: s.priority, bonus_win: !!q.bonus, referral: !!acct.referral });
      track('generate_lead', { value, currency: 'USD' });
      try { localStorage.removeItem('sb_ref'); } catch {}
      showSuccess(data, s, q);
    } catch {
      showError('Network error — please try again, or message stain.hs on Discord.');
    } finally {
      busy = false;
      submitBtn.removeAttribute('aria-disabled');
    }
  });

  // ── After ordering ────────────────────────────────────────────────────────
  function showSuccess(data, s, q) {
    const box = document.querySelector('[data-success]');
    const total = '$' + data.total;
    box.querySelector('[data-succ-route]').textContent = q.route + (q.bonus ? ' + 1 win' : '');
    box.querySelector('[data-succ-total]').textContent = total;
    box.querySelector('[data-succ-token]').textContent = data.token;
    box.querySelector('[data-succ-track]').href = '/track/' + encodeURIComponent(data.token);
    box.querySelectorAll('[data-pay-amount]').forEach((el) => { el.textContent = total; });
    box.querySelectorAll('[data-pay-link]').forEach((a) => { a.href = a.dataset.payLink.replace('{amount}', data.total); });
    const message = `Hi Stain! I just placed order ${data.token}: ${q.route}${q.bonus ? ' + 1 win' : ''} (${s.type}${s.priority ? ', priority' : ''}), ${total}.`;
    box.querySelector('[data-copy-msg]')?.setAttribute('data-copy', message);
    document.querySelector('[data-layout]').hidden = true;
    document.querySelector('[data-sticky]')?.remove(); // nothing left to "review"
    box.hidden = false;
    box.focus({ preventScroll: true });
    box.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    wireSuccess(box, data.token);
  }

  function wireSuccess(box, token) {
    box.querySelectorAll('input[name="payMethod"]').forEach((r) => r.addEventListener('change', () => {
      box.querySelectorAll('[data-pay-panel]').forEach((p) => { p.hidden = p.dataset.payPanel !== r.value; });
      track('payment_method_view', { method: r.value });
    }));
    box.querySelectorAll('[data-copy], [data-copy-msg]').forEach((b) => b.addEventListener('click', async () => {
      const text = b.getAttribute('data-copy') || '';
      try { await navigator.clipboard.writeText(text); } catch {
        const t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove();
      }
      const old = b.textContent; b.textContent = 'Copied ✓'; setTimeout(() => { b.textContent = old; }, 1600);
      track(b.hasAttribute('data-copy-msg') ? 'copy_order_message' : (b.dataset.copyWhat === 'discord_handle' ? 'copy_discord_handle' : 'copy_payment_id'), { what: b.dataset.copyWhat || 'message' });
    }));
    box.querySelectorAll('[data-paid]').forEach((b) => b.addEventListener('click', async () => {
      const method = b.dataset.paid, msg = box.querySelector('[data-paid-msg]');
      b.setAttribute('aria-disabled', 'true');
      try {
        const r = await fetch('/api/order-tracking/paid', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, method }) });
        const d = await r.json().catch(() => ({}));
        msg.textContent = r.ok ? '✅ Thanks! Stain will confirm your payment and start your boost. You can follow it in your tracker.' : (d.error || 'Could not send that. Message stain.hs on Discord.');
        if (r.ok) track('payment_claimed', { method });
      } catch { msg.textContent = 'Network error. Message stain.hs on Discord.'; }
      finally { b.removeAttribute('aria-disabled'); }
    }));
  }
}
