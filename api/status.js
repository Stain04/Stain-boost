// ── /api/status — is Stain online right now? ──
// GET: public. POST: admin only (session admin or x-admin-key). Set from /admin.
// "Online" switches itself off after `hours` (default 4) so the site never shows a stale claim.
import { getKv, getUser, isAdmin, rateLimit, getIp } from './_lib/auth.js';

const KEY = 'stain_status';
const MAX_HOURS = 12;

export default async function handler(req, res) {
  const kv = getKv();

  if (req.method === 'GET') {
    res.setHeader('Cache-Control', 'public, s-maxage=20, stale-while-revalidate=40');
    // `known: false` until Stain has used the switch once — the site then shows no status at all.
    if (!kv) return res.status(200).json({ online: false, known: false });
    try {
      const raw = await kv.get(KEY);
      const s = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : null;
      const online = !!(s && s.online && s.until > Date.now());
      return res.status(200).json({ online, known: !!s, until: online ? s.until : null });
    } catch (e) {
      console.error('status get error', e);
      return res.status(200).json({ online: false, known: false });
    }
  }

  if (req.method === 'POST') {
    if (rateLimit('statusP:' + getIp(req), 20, 60_000)) return res.status(429).json({ error: 'Too many requests.' });
    const user = await getUser(req);
    const keyOk = process.env.ADMIN_KEY && (req.headers['x-admin-key'] === process.env.ADMIN_KEY);
    if (!isAdmin(user) && !keyOk) return res.status(401).json({ error: 'Unauthorized.' });
    if (!kv) return res.status(500).json({ error: 'Storage not configured.' });

    const online = req.body?.online === true;
    const hours = Math.max(1, Math.min(MAX_HOURS, parseInt(req.body?.hours, 10) || 4));
    const until = online ? Date.now() + hours * 3600_000 : 0;
    await kv.set(KEY, JSON.stringify({ online, until, updatedAt: Date.now() }));
    return res.status(200).json({ ok: true, online, until: online ? until : null });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
