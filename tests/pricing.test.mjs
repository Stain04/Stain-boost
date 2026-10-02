// Price parity tests. Run: npm test
// 1) The v2 price module gives exactly the totals the live pricing page (legacy/pricing.html,
//    with the approved Sep 2026 hotfix) shows, for every input combination.
// 2) The order API charges exactly what the v2 page shows.
import '../scripts/local/hooks.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as P from '../src/data/pricing.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const legacy = fs.readFileSync(path.join(ROOT, 'legacy/pricing.html'), 'utf8');

function extractFn(src, name) {
  const start = src.indexOf(`function ${name}(`);
  let i = src.indexOf('{', start), depth = 0;
  for (; i < src.length; i++) { if (src[i] === '{') depth++; else if (src[i] === '}' && --depth === 0) break; }
  return src.slice(start, i + 1);
}
const oldRank = new Function('RB_TIERS', 'RB_DIV_PRICE',
  ['rbDivIdx', 'rbDivPrice', 'calcRankBoostTotal'].map((n) => extractFn(legacy, n)).join('\n') + '\nreturn calcRankBoostTotal;',
)(P.RB_TIERS, P.RB_DIV_PRICE);
const oldWins = (ranks, selIdx, selType, selWins) => new Function('ranks', 'selIdx', 'selType', 'selWins', extractFn(legacy, 'getTotal') + '\nreturn getTotal();')(ranks, selIdx, selType, selWins);

const TYPES = ['solo', 'duo'];
function* rankCombos() {
  for (let ft = 0; ft < 8; ft++) for (let fd = 0; fd < 4; fd++) for (let tt = 0; tt < 8; tt++) for (let td = 0; td < 4; td++) {
    if (P.rankPosition(tt, td) <= P.rankPosition(ft, fd)) continue;
    for (const type of TYPES) for (const lp of P.VALID_CURRENT_LP) yield { fromTier: ft, fromDiv: fd, toTier: tt, toDiv: td, type, lp };
  }
}

test('rank boost: v2 totals equal the live page for every combination', () => {
  let n = 0;
  for (const c of rankCombos()) {
    const old = oldRank(c.fromTier, c.fromDiv, c.toTier, c.toDiv, c.type, c.lp).toFixed(2);
    assert.equal(P.rankBoostTotal(c).toFixed(2), old, JSON.stringify(c));
    n++;
  }
  assert.ok(n > 5000);
});

test('win boost: v2 totals equal the live page (pay for 5, get 6) for every rank, queue and 1–30 wins', () => {
  const ranks = Object.entries(P.WIN_PRICES).map(([name, p]) => ({ name, ...p }));
  ranks.forEach((r, i) => TYPES.forEach((type) => {
    for (let w = 1; w <= P.MAX_WINS; w++) {
      assert.equal(P.winBoostTotal({ rank: r.name, wins: w, type }).toFixed(2), oldWins(ranks, i, type, w).toFixed(2));
      assert.equal(P.freeWins(w), Math.floor(w / 5));
    }
  }));
});

test('order API charges exactly the page total', async () => {
  const { default: auth } = await import('../api/auth/[action].js');
  const { default: order } = await import('../api/order.js');
  let ip = 0;
  const call = async (handler, body, query = {}, cookie = '') => {
    const out = { status: 200, headers: {}, body: null };
    const res = { setHeader(k, v) { out.headers[k.toLowerCase()] = v; }, getHeader() {}, writeHead(c) { out.status = c; return res; }, status(c) { out.status = c; return res; }, json(o) { out.body = o; return res; }, send(o) { out.body = o; return res; }, end() { return res; } };
    await handler({ method: 'POST', query, body, headers: { cookie, 'x-forwarded-for': `10.9.${(ip >> 8) & 255}.${ip++ & 255}` } }, res);
    return out;
  };
  const su = await call(auth, { email: 'test@local.test', username: 'price_tester', password: 'password123' }, { action: 'signup' });
  const cookie = String(su.headers['set-cookie']).split(';')[0];
  let n = 0;
  for (const c of rankCombos()) {
    if (n++ % 7) continue; // a large, even sample keeps the test fast
    const r = await call(order, { discord: 'd', ign: 'x#1', orderType: 'rank_boost', fromTier: c.fromTier, fromDiv: c.fromDiv, toTier: c.toTier, toDiv: c.toDiv, type: c.type, currentLP: c.lp }, {}, cookie);
    assert.equal(r.body.total, P.rankBoostTotal(c).toFixed(2), JSON.stringify(c));
  }
  // One price for everyone: an old page that still sends an LP-gain multiplier is charged the normal price.
  for (const lpGainMultiplier of [1.4, 2]) {
    const r = await call(order, { discord: 'd', ign: 'x#1', orderType: 'rank_boost', fromTier: 2, fromDiv: 2, toTier: 3, toDiv: 0, type: 'solo', currentLP: 10, lpGainMultiplier }, {}, cookie);
    assert.equal(r.body.total, P.rankBoostTotal({ fromTier: 2, fromDiv: 2, toTier: 3, toDiv: 0, type: 'solo', lp: 10 }).toFixed(2));
  }
  for (const rank of Object.keys(P.WIN_PRICES)) for (const type of TYPES) for (const wins of [1, 4, 5, 9, 10, 30]) {
    const r = await call(order, { discord: 'd', ign: 'x#1', orderType: 'win_boost', rank, type, wins }, {}, cookie);
    assert.equal(r.body.total, P.winBoostTotal({ rank, wins, type }).toFixed(2));
  }
});
