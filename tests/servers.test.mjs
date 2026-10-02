// Servers (ME, EUW, EUNE): every order records which one it is for, so Stain knows where to play. Run: npm test
import '../scripts/local/hooks.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { FREE_TRIAL } from '../src/data/promo.js';
import { REGIONS } from '../src/data/site.js';

const { default: auth } = await import('../api/auth/[action].js');
const { default: order } = await import('../api/order.js');
const { default: tracking } = await import('../api/order-tracking/[action].js');

// Pin the clock inside the promo window so the trial cases also pass after it has ended.
Date.now = () => Date.parse(FREE_TRIAL.startsAt) + 3600e3;

let ip = 0;
async function call(handler, { method = 'POST', body = {}, query = {}, cookie = '' } = {}) {
  const out = { status: 200, headers: {}, body: null };
  const res = { setHeader(k, v) { out.headers[k.toLowerCase()] = v; }, getHeader() {}, writeHead(c) { out.status = c; return res; }, status(c) { out.status = c; return res; }, json(o) { out.body = o; return res; }, send(o) { out.body = o; return res; }, end() { return res; } };
  await handler({ method, query, body, headers: { cookie, 'x-forwarded-for': `10.9.${(ip >> 8) & 255}.${ip++ & 255}` } }, res);
  return out;
}
async function signup(name) {
  const r = await call(auth, { body: { email: `${name}@servers.test`, username: name, password: 'password123' }, query: { action: 'signup' } });
  return String(r.headers['set-cookie']).split(';')[0];
}
const rankOrder = (cookie, region) => call(order, { cookie, body: { orderType: 'rank_boost', fromTier: 1, fromDiv: 0, toTier: 1, toDiv: 1, type: 'solo', flash: 'D', discord: 'srv_' + cookie.slice(-5), ign: 'Srv#' + cookie.slice(-5), region } });
const summaryOf = async (cookie, token) => (await call(tracking, { method: 'GET', query: { action: 'status', token }, cookie })).body.summary;

test('all three servers are open for orders', () => {
  assert.deepEqual(REGIONS.map((r) => [r.code, r.live]), [['me', true], ['euw', true], ['eune', true]]);
});

test('a paid order records its server', async () => {
  for (const region of ['me', 'euw', 'eune']) {
    const c = await signup('paid_' + region);
    const r = await rankOrder(c, region);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.match(await summaryOf(c, r.body.token), new RegExp(`· ${region.toUpperCase()} server`));
  }
});

test('an unknown or missing server falls back to ME', async () => {
  for (const region of ['xx', undefined]) {
    const c = await signup('fallback_' + String(region));
    const r = await rankOrder(c, region);
    assert.equal(r.status, 200);
    assert.match(await summaryOf(c, r.body.token), /· ME server/);
  }
});

test('a free trial records its server', async () => {
  const c = await signup('trial_euw');
  const r = await call(order, { cookie: c, body: { orderType: 'free_trial', discord: 'trialeuw', ign: 'Trial#EUW', type: 'duo', flash: 'F', region: 'euw' } });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.match(await summaryOf(c, r.body.token), /Free trial: .* · duo · EUW server/);
});
