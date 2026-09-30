// ── /api/notify — "tell me when EUW / EUNE opens" waitlist ──
// POST { region: 'euw'|'eune', contact: discord username or email } — public, rate limited.
// GET ?region=euw — admin only (session admin or x-admin-key): the list, for launch day.
import { getKv, getUser, isAdmin, rateLimit, getIp } from './_lib/auth.js';

const REGIONS = ['euw', 'eune'];
const clean = (s) => String(s || '').replace(/[<>"'`]/g, '').trim().slice(0, 120);

export default async function handler(req, res) {
  const kv = getKv();
  if (!kv) return res.status(500).json({ error: 'Storage not configured.' });

  if (req.method === 'POST') {
    if (rateLimit('notify:' + getIp(req), 5, 60_000)) return res.status(429).json({ error: 'Too many requests. Try again in a minute.' });
    const region = String(req.body?.region || '').toLowerCase();
    const contact = clean(req.body?.contact);
    if (!REGIONS.includes(region)) return res.status(400).json({ error: 'Unknown server.' });
    if (contact.length < 3) return res.status(400).json({ error: 'Add your Discord username or email.' });
    try {
      const added = await kv.sadd(`notify:${region}`, contact.toLowerCase());
      if (added) await kv.rpush(`notify_log:${region}`, JSON.stringify({ contact, ts: Date.now() }));
      return res.status(200).json({ ok: true });
    } catch (e) {
      console.error('notify error', e);
      return res.status(500).json({ error: 'Server error.' });
    }
  }

  if (req.method === 'GET') {
    const user = await getUser(req);
    const keyOk = process.env.ADMIN_KEY && req.headers['x-admin-key'] === process.env.ADMIN_KEY;
    if (!isAdmin(user) && !keyOk) return res.status(401).json({ error: 'Unauthorized.' });
    const out = {};
    for (const r of REGIONS) {
      const raw = await kv.lrange(`notify_log:${r}`, 0, -1);
      out[r] = (raw || []).map((x) => (typeof x === 'string' ? JSON.parse(x) : x));
    }
    return res.status(200).json(out);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
