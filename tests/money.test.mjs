// Extras, the price-match guard, and the referral lifecycle. Run: npm test
import '../scripts/local/hooks.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import * as P from '../src/data/pricing.js';

const { default: auth } = await import('../api/auth/[action].js');
const { default: order } = await import('../api/order.js');
const { default: referral } = await import('../api/referral.js');
const { default: tracking } = await import('../api/order-tracking/[action].js');

let ip = 0;
async function call(handler, { method = 'POST', body = {}, query = {}, cookie = '', headers = {} } = {}) {
  const out = { status: 200, headers: {}, body: null };
  const res = { setHeader(k, v) { out.headers[k.toLowerCase()] = v; }, getHeader() {}, writeHead(c) { out.status = c; return res; }, status(c) { out.status = c; return res; }, json(o) { out.body = o; return res; }, send(o) { out.body = o; return res; }, end() { return res; } };
  await handler({ method, query, body, headers: { cookie, 'x-forwarded-for': `10.7.${(ip >> 8) & 255}.${ip++ & 255}`, ...headers } }, res);
  return out;
}
async function signup(name) {
  const r = await call(auth, { body: { email: `${name}@local.test`, username: name, password: 'password123' }, query: { action: 'signup' } });
  return String(r.headers['set-cookie']).split(';')[0];
}
const rankOrder = (extra = {}) => ({ discord: 'd', ign: 'x#1', orderType: 'rank_boost', fromTier: 2, fromDiv: 2, toTier: 3, toDiv: 0, type: 'solo', currentLP: 10, lpGainMultiplier: 1, ...extra });

test('quoteOrder: no extras = the base price; extras add up in exact cents', () => {
  const base = { mode: 'rank', type: 'solo', fromTier: 2, fromDiv: 2, toTier: 3, toDiv: 0, lp: 10, lpGain: 1 };
  assert.equal(P.quoteOrder(base).total, 19); // 2 Silver divisions, 10% off the first
  const q = P.quoteOrder({ ...base, priority: true, bonusWin: true });
  assert.equal(q.bonus, 3.10);    // bonus win at Gold
  assert.equal(q.priority, 3.98); // 18% of $22.10 = $3.978 → $3.98
  assert.equal(q.total, 26.08);
});

test('quoteOrder: priority is 18% of the order incl. bonus win, rounded to the cent', () => {
  const q = P.quoteOrder({ mode: 'rank', type: 'solo', fromTier: 2, fromDiv: 2, toTier: 3, toDiv: 0, lp: 10, lpGain: 1, priority: true, bonusWin: true });
  assert.equal(q.priority, Math.round(2210 * 0.18) / 100);
  assert.equal(Math.round(q.total * 100), 1900 + 310 + Math.round(2210 * 0.18)); // exact cents
});

test('quoteOrder: referral takes 20% off everything, credit is capped at the remaining total', () => {
  const q = P.quoteOrder({ mode: 'wins', type: 'solo', rank: 'Gold', wins: 10, referral: true, credit: 100 });
  assert.equal(q.base, 35);
  assert.equal(q.referral, 7);
  assert.equal(q.credit, 28);
  assert.equal(q.total, 0);
});

test('bonus win is not offered when the target is Masters', () => {
  assert.equal(P.bonusWinPrice(P.MASTERS), null);
  const q = P.quoteOrder({ mode: 'rank', type: 'solo', fromTier: 6, fromDiv: 3, toTier: 7, toDiv: 0, lp: 10, lpGain: 1, bonusWin: true });
  assert.equal(q.bonus, 0);
});

test('order API: extras priced exactly like the page; wrong expectedTotal is refused', async () => {
  const cookie = await signup('extras_tester');
  const page = P.quoteOrder({ mode: 'rank', type: 'solo', fromTier: 2, fromDiv: 2, toTier: 3, toDiv: 0, lp: 10, lpGain: 1, priority: true, bonusWin: true });
  const ok = await call(order, { cookie, body: rankOrder({ priority: true, bonusWin: true, expectedTotal: page.total.toFixed(2) }) });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.total, page.total.toFixed(2));
  const bad = await call(order, { cookie, body: rankOrder({ priority: true, expectedTotal: '1.00' }) });
  assert.equal(bad.status, 409);
  assert.equal(bad.body.priceChanged, true);
});

test('referral lifecycle: 20% off the friend\'s first order, 20% credit to the referrer once paid, credit spent and refunded', async () => {
  const alice = await signup('alice_ref');
  const bob = await signup('bob_friend');
  const code = (await call(referral, { method: 'GET', cookie: alice })).body.code;
  assert.match(code, /^SB[A-Z2-9]{6}$/);

  // own code is refused
  const own = await call(order, { cookie: alice, body: rankOrder({ referralCode: code }) });
  assert.equal(own.status, 400);

  // Bob's first order: 20% off
  const expected = P.quoteOrder({ mode: 'rank', type: 'solo', fromTier: 2, fromDiv: 2, toTier: 3, toDiv: 0, lp: 10, lpGain: 1, referral: true });
  const first = await call(order, { cookie: bob, body: rankOrder({ referralCode: code, expectedTotal: expected.total.toFixed(2) }) });
  assert.equal(first.status, 200);
  assert.equal(first.body.total, '15.20'); // $19 − 20%

  // a second referral use by Bob is refused
  const again = await call(order, { cookie: bob, body: rankOrder({ referralCode: code }) });
  assert.equal(again.status, 400);

  // Stain verifies Bob's payment → Alice earns 20% of $15.20 = $3.04 (once)
  process.env.ADMIN_KEY = 'local-admin-key';
  const upd = { token: first.body.token, status: 'payment_verified', adminKey: 'local-admin-key' };
  assert.equal((await call(tracking, { query: { action: 'update' }, body: upd })).status, 200);
  await call(tracking, { query: { action: 'update' }, body: { ...upd, status: 'in_progress' } });
  let me = (await call(referral, { method: 'GET', cookie: alice })).body;
  assert.equal(me.credit, 3.04);
  assert.equal(me.referrals, 1);

  // Alice's next order uses the credit automatically
  const aliceOrder = await call(order, { cookie: alice, body: rankOrder() });
  assert.equal(aliceOrder.body.total, '15.96'); // $19 − $3.04
  me = (await call(referral, { method: 'GET', cookie: alice })).body;
  assert.equal(me.credit, 0);

  // cancelling that order gives the credit back
  await call(tracking, { query: { action: 'update' }, body: { token: aliceOrder.body.token, status: 'cancelled', adminKey: 'local-admin-key' } });
  me = (await call(referral, { method: 'GET', cookie: alice })).body;
  assert.equal(me.credit, 3.04);
});
