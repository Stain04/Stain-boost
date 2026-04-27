import bcrypt from 'bcryptjs';
import { getKV, signToken, verifyToken } from './_lib/auth.js';

const PEPPER = process.env.PASSWORD_PEPPER || 'sb-default-pepper-change-me';

export default async function handler(req, res) {
  const kv = getKV();
  if (!kv) return res.status(500).json({ error: 'Database not configured.' });

  // bt3ml 'GET' LL info bta3t el current user 
  if (req.method === 'GET') {
    const decoded = await verifyToken(req, kv);
    if (!decoded) return res.status(401).json({ error: 'Unauthorized. Please log in.' });

    const raw = await kv.get(`user:${decoded.username}`);
    if (!raw) return res.status(404).json({ error: 'User not found.' });
    const user = typeof raw === 'string' ? JSON.parse(raw) : raw;

    return res.status(200).json({
      username: user.username,
      email:    user.email,
      role:     user.role,
    });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const action = req.query.action;

  // hna bt3ml register (wbt3ml save LL user m3 el hashed password bta3t'h)
  if (action === 'register') {
    const { username, email, password, role } = req.body;

    const cleanUsername = username.toLowerCase().trim();
    const cleanEmail    = email.toLowerCase().trim();
    const cleanRole     = role === 'admin' ? 'admin' : 'customer';

    if (!cleanUsername || !cleanEmail || !password)
      return res.status(400).json({ error: 'Username, email, and password are required.' });
    if (password.length < 8)
      return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    if (await kv.get(`user:${cleanUsername}`))
      return res.status(409).json({ error: 'Username already taken.' });

    // bcrypt bt3ml salt lw7dha (built in) wbt3ml hash LL password
    // bndef hna el pepper LL password abl ma n3ml hash (layer security zeyada bs)
    const passwordHash = await bcrypt.hash(password + PEPPER, 12);

    const user = {
      username: cleanUsername,
      email:    cleanEmail,
      passwordHash,
      role:     cleanRole,
    };

    await kv.set(`user:${cleanUsername}`, JSON.stringify(user));
    await kv.sadd('registered_users', cleanUsername);

    const token = await signToken({ username: cleanUsername, role: cleanRole });
    return res.status(201).json({ ok: true, token, role: cleanRole });
  }

  // by3ml check LL password b3den byrg3 JWT 
  if (action === 'login') {
    const { username, password } = req.body;
    if (!username || !password)
      return res.status(400).json({ error: 'Username and password are required.' });

    const raw = await kv.get(`user:${username.toLowerCase().trim()}`);
    if (!raw) return res.status(401).json({ error: 'Invalid username or password.' });

    const user = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const match = await bcrypt.compare(password + PEPPER, user.passwordHash);
    if (!match) return res.status(401).json({ error: 'Invalid username or password.' });

    const token = await signToken({ username: user.username, role: user.role });
    return res.status(200).json({ ok: true, token, role: user.role });
  }

  // logout (bydef el token LL blacklist 3shan mnst3mlah tane)
  if (action === 'logout') {
    const decoded = await verifyToken(req, kv);
    if (!decoded) return res.status(401).json({ error: 'Invalid or expired token.' });

    const token = req.headers['authorization'].slice(7);
    await kv.sadd('auth_blacklisted_tokens', token);
    return res.status(200).json({ ok: true, message: 'Logged out successfully.' });
  }

  return res.status(400).json({ error: 'Unknown action.' });
}
