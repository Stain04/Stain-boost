// ── /api/referral — "give 20%, get 20%" ──
// GET               (signed in)  → your code, share link, credit balance and earnings
// GET ?check=CODE   (anyone)     → is this code usable for the current visitor's order?
// The friend gets REFERRAL_RATE off their first order; the referrer earns REFERRAL_RATE of
// what the friend paid as credit, added when Stain verifies the friend's payment
// (see api/order-tracking — update). Credit is applied automatically at checkout.
import { randomBytes } from 'crypto';
import { getKv, getUser, rateLimit, getIp } from './_lib/auth.js';
import { REFERRAL_RATE } from '../src/data/pricing.js';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I
const parse = (raw) => (raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : null);

async function ensureCode(kv, user) {
  if (user.refCode) return user.refCode;
  for (let i = 0; i < 10; i++) {
    const b = randomBytes(6);
    const code = 'SB' + [...b].map((x) => ALPHABET[x % ALPHABET.length]).join('');
    if (!(await kv.get(`refcode:${code}`))) {
      await kv.set(`refcode:${code}`, user.id);
      user.refCode = code;
      await kv.set(`user:${user.id}`, JSON.stringify(user));
      return code;
    }
  }
  throw new Error('could not allocate referral code');
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (rateLimit('ref:' + getIp(req), 40, 60_000)) return res.status(429).json({ error: 'Too many requests.' });
  const kv = getKv();
  if (!kv) return res.status(500).json({ error: 'Storage not configured.' });
  const session = await getUser(req);
  const user = session ? parse(await kv.get(`user:${session.id}`)) : null;

  const check = String(req.query.check || '').trim().toUpperCase().slice(0, 20);
  if (check) {
    const owner = await kv.get(`refcode:${check}`);
    if (!owner) return res.status(200).json({ valid: false, reason: "That code doesn't exist." });
    if (user) {
      if (String(owner) === user.id) return res.status(200).json({ valid: false, reason: "You can't use your own code." });
      if ((user.orderTokens || []).length || user.referredBy) return res.status(200).json({ valid: false, reason: 'Referral codes are for a first order only.' });
    }
    return res.status(200).json({ valid: true, rate: REFERRAL_RATE });
  }

  if (!user) return res.status(401).json({ error: 'Sign in to see your referral code.' });
  try {
    const code = await ensureCode(kv, user);
    return res.status(200).json({
      code,
      link: `https://www.stainboost.com/?ref=${code}`,
      rate: REFERRAL_RATE,
      credit: Math.max(0, Number(user.credit) || 0),
      referrals: (user.referralEarnings || []).length,
      earned: (user.referralEarnings || []).reduce((a, r) => a + (Number(r.amount) || 0), 0),
      firstOrder: !(user.orderTokens || []).length && !user.referredBy,
    });
  } catch (e) {
    console.error('referral error', e);
    return res.status(500).json({ error: 'Server error.' });
  }
}
