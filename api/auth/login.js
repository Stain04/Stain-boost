import { getKv, setSessionCookie, comparePassword, normEmail, normUsername, rateLimit, getIp, publicUser } from '../../lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (rateLimit('login:' + getIp(req), 10, 60_000)) return res.status(429).json({ error: 'Too many attempts. Wait a minute.' });

  const { identifier, password } = req.body || {};
  if (!identifier || !password) return res.status(400).json({ error: 'Missing credentials.' });

  const kv = getKv();
  if (!kv) return res.status(500).json({ error: 'Storage not configured.' });

  try {
    const idRaw = String(identifier).trim();
    let userId = null;
    if (idRaw.includes('@')) {
      userId = await kv.get(`email:${normEmail(idRaw)}`);
    } else {
      userId = await kv.get(`username:${normUsername(idRaw)}`);
    }
    if (!userId) return res.status(401).json({ error: 'Invalid credentials.' });

    const raw = await kv.get(`user:${userId}`);
    if (!raw) return res.status(401).json({ error: 'Invalid credentials.' });
    const user = typeof raw === 'string' ? JSON.parse(raw) : raw;

    const ok = await comparePassword(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials.' });

    setSessionCookie(res, { uid: user.id });
    return res.status(200).json({ ok: true, user: publicUser(user) });
  } catch (err) {
    console.error('login error', err);
    return res.status(500).json({ error: 'Server error.' });
  }
}
