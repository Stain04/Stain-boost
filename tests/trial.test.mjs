// Free trial (src/data/promo.js): who can claim it, when, and that it never breaks money rules. Run: npm test
import '../scripts/local/hooks.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { FREE_TRIAL, TRIAL_ENDS_MS, trialActive } from '../src/data/promo.js';
import { quoteOrder } from '../src/data/pricing.js';

const { default: auth } = await import('../api/auth/[action].js');
const { default: order } = await import('../api/order.js');
const { default: referral } = await import('../api/referral.js');
const { default: tracking } = await import('../api/order-tracking/[action].js');
const { default: reviews } = await import('../api/reviews.js');
const { default: status } = await import('../api/status.js');

// Pin the clock inside the promo window so these tests also pass after it has ended.
const realNow = Date.now;
const DURING = Date.parse(FREE_TRIAL.startsAt) + 3600e3;
Date.now = () => DURING;

let ip = 0;
async function call(handler, { method = 'POST', body = {}, query = {}, cookie = '', headers = {} } = {}) {
  const out = { status: 200, headers: {}, body: null };
  const res = { setHeader(k, v) { out.headers[k.toLowerCase()] = v; }, getHeader() {}, writeHead(c) { out.status = c; return res; }, status(c) { out.status = c; return res; }, json(o) { out.body = o; return res; }, send(o) { out.body = o; return res; }, end() { return res; } };
  await handler({ method, query, body, headers: { cookie, 'x-forwarded-for': `10.8.${(ip >> 8) & 255}.${ip++ & 255}`, ...headers } }, res);
  return out;
}
async function signup(name) {
  const r = await call(auth, { body: { email: `${name}@trial.test`, username: name, password: 'password123' }, query: { action: 'signup' } });
  return String(r.headers['set-cookie']).split(';')[0];
}
const claim = (cookie, extra = {}) => call(order, { cookie, body: { orderType: 'free_trial', discord: 'd_' + cookie.slice(-6), ign: 'Trial#' + cookie.slice(-6), type: 'solo', flash: 'D', ...extra } });
const admin = { 'x-admin-key': process.env.ADMIN_KEY };

test('trialActive: on between start and end, off before and after', () => {
  assert.equal(trialActive(Date.parse(FREE_TRIAL.startsAt) - 1), false);
  assert.equal(trialActive(Date.parse(FREE_TRIAL.startsAt)), true);
  assert.equal(trialActive(TRIAL_ENDS_MS - 1), true);
  assert.equal(trialActive(TRIAL_ENDS_MS), false);
});

test('a new customer claims the free games: $0, queued, on their dashboard, no payment step', async () => {
  const c = await signup('newbie1');
  const r = await claim(c);
  assert.equal(r.status, 200);
  assert.equal(r.body.total, '0.00');
  const s = await call(tracking, { method: 'GET', query: { action: 'status', token: r.body.token }, cookie: c });
  assert.equal(s.body.status, 'queued');
  assert.equal(s.body.meta.kind, 'free_trial');
  assert.equal(s.body.meta.games, FREE_TRIAL.games);
  const mine = await call(tracking, { method: 'GET', query: { action: 'mine' }, cookie: c });
  assert.equal(mine.body.orders.length, 1);
});

test('one trial per account, per Riot ID and per Discord name', async () => {
  const a = await signup('newbie2');
  assert.equal((await claim(a, { ign: 'Same#ME1', discord: 'samediscord' })).status, 200);
  const again = await claim(a, { ign: 'Other#ME1', discord: 'otherdiscord' });
  assert.equal(again.status, 403);
  assert.ok(again.body.trialUsed);
  const b = await signup('newbie3');
  assert.equal((await claim(b, { ign: 'same#me1', discord: 'fresh1' })).status, 403, 'same Riot ID (any case) on a 2nd account');
  assert.equal((await claim(b, { ign: 'Fresh#ME1', discord: 'SameDiscord' })).status, 403, 'same Discord on a 2nd account');
});

test('existing customers are not eligible; signed-out visitors must sign in', async () => {
  const c = await signup('payer1');
  const q = quoteOrder({ mode: 'rank', type: 'solo', fromTier: 2, fromDiv: 2, toTier: 3, toDiv: 0, lp: 10, lpGain: 1 });
  const paid = await call(order, { cookie: c, body: { discord: 'p', ign: 'P#1', orderType: 'rank_boost', fromTier: 2, fromDiv: 2, toTier: 3, toDiv: 0, type: 'solo', currentLP: 10, lpGainMultiplier: 1, expectedTotal: q.total.toFixed(2) } });
  assert.equal(paid.status, 200);
  const r = await claim(c);
  assert.equal(r.status, 403);
  assert.ok(r.body.notNew);
  const anon = await call(order, { body: { orderType: 'free_trial', discord: 'x', ign: 'X#1' } });
  assert.equal(anon.status, 401);
});

test('claims are refused once the promo has ended', async () => {
  const c = await signup('late1');
  Date.now = () => TRIAL_ENDS_MS + 1000;
  try {
    const r = await claim(c);
    assert.equal(r.status, 410);
    assert.ok(r.body.trialOver);
  } finally {
    Date.now = () => DURING;
  }
});

test('a trial does not use up the referral first-order discount', async () => {
  const referrer = await signup('refowner1');
  const code = (await call(referral, { method: 'GET', cookie: referrer })).body.code;
  const c = await signup('trialfriend1');
  assert.equal((await claim(c)).status, 200);
  assert.equal((await call(referral, { method: 'GET', cookie: c })).body.firstOrder, true);
  const q = quoteOrder({ mode: 'rank', type: 'solo', fromTier: 2, fromDiv: 2, toTier: 3, toDiv: 0, lp: 10, lpGain: 1, referral: true });
  const r = await call(order, { cookie: c, body: { discord: 'f', ign: 'F#1', orderType: 'rank_boost', fromTier: 2, fromDiv: 2, toTier: 3, toDiv: 0, type: 'solo', currentLP: 10, lpGainMultiplier: 1, referralCode: code, expectedTotal: q.total.toFixed(2) } });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.total, q.total.toFixed(2));
});

test('a completed trial gets no review link and cannot be reviewed', async () => {
  const c = await signup('trialreview1');
  const t = (await claim(c)).body.token;
  assert.equal((await call(tracking, { query: { action: 'update' }, headers: admin, body: { token: t, status: 'completed' } })).status, 200);
  const s = await call(tracking, { method: 'GET', query: { action: 'status', token: t }, cookie: c });
  assert.equal(s.body.reviewable, false);
  const rv = await call(reviews, { cookie: c, body: { token: t, name: 'N', stars: 5, text: 'great' } });
  assert.equal(rv.status, 400);
});

test('the admin runs the trial past its default date, the site sees it, then ends it', async () => {
  const later = TRIAL_ENDS_MS + 864e5; // a day after the default end
  Date.now = () => later;
  try {
    const c = await signup('admintimer1');
    const first = await claim(c);
    assert.equal(first.status, 410, 'over by default: ' + JSON.stringify(first));
    assert.equal((await call(status, { body: { trial: { endsAt: later + 2 * 864e5 } } })).status, 401, 'admin only');
    const set = await call(status, { headers: admin, body: { trial: { endsAt: later + 2 * 864e5 } } });
    assert.equal(set.status, 200);
    const pub = (await call(status, { method: 'GET' })).body.trial;
    assert.deepEqual([pub.active, pub.endsAt, pub.games], [true, later + 2 * 864e5, FREE_TRIAL.games]);
    assert.equal((await claim(c)).status, 200, 'claims work while the admin timer runs');
    assert.equal((await call(status, { headers: admin, body: { trial: { endsAt: 0 } } })).status, 200);
    assert.equal((await call(status, { method: 'GET' })).body.trial.active, false);
    assert.equal((await claim(await signup('admintimer2'))).status, 410, 'ended from admin');
    assert.equal((await call(status, { headers: admin, body: { trial: { endsAt: later - 1000 } } })).status, 400, 'no end times in the past');
  } finally {
    Date.now = () => DURING;
  }
});

test('Stain can be online with no timer', async () => {
  assert.equal((await call(status, { headers: admin, body: { online: true, forever: true } })).status, 200);
  const far = Date.now; Date.now = () => DURING + 365 * 864e5;
  try {
    const s = (await call(status, { method: 'GET' })).body;
    assert.deepEqual([s.online, s.forever, s.until], [true, true, null]);
  } finally { Date.now = far; }
  assert.equal((await call(status, { headers: admin, body: { online: false } })).status, 200);
  assert.equal((await call(status, { method: 'GET' })).body.online, false);
});

test.after(() => { Date.now = realNow; });
