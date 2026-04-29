import { getKv, setSessionCookie, hashPassword, newUserId, normEmail, normUsername, validateEmail, validateUsername, validatePassword, rateLimit, getIp, publicUser } from '../../lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (rateLimit('signup:' + getIp(req), 8, 60_000)) return res.status(429).json({ error: 'Too many attempts. Wait a minute.' });

  const { email, username, password } = req.body || {};
  const e = normEmail(email);
  const u = normUsername(username);

  if (!validateEmail(e)) return res.status(400).json({ error: 'Invalid email.' });
  if (!validateUsername(u)) return res.status(400).json({ error: 'Username must be 3–24 chars, letters/numbers/._- only.' });
  if (!validatePassword(password)) return res.status(400).json({ error: 'Password must be at least 8 characters.' });

  const kv = getKv();
  if (!kv) return res.status(500).json({ error: 'Storage not configured.' });

  try {
    const [emailTaken, usernameTaken] = await Promise.all([
      kv.get(`email:${e}`),
      kv.get(`username:${u}`),
    ]);
    if (emailTaken) return res.status(409).json({ error: 'Email already registered.' });
    if (usernameTaken) return res.status(409).json({ error: 'Username already taken.' });

    const id = newUserId();
    const passwordHash = await hashPassword(password);
    const user = {
      id, type: 'email',
      email: e,
      username: u,
      displayUsername: String(username).trim(),
      passwordHash,
      orderTokens: [],
      createdAt: Date.now(),
    };

    await kv.set(`user:${id}`, JSON.stringify(user));
    await kv.set(`email:${e}`, id);
    await kv.set(`username:${u}`, id);

    setSessionCookie(res, { uid: id });
    return res.status(200).json({ ok: true, user: publicUser(user) });
  } catch (err) {
    console.error('signup error', err);
    return res.status(500).json({ error: 'Server error.' });
  }
}
