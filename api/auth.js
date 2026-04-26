// ─────────────────────────────────────────────────────────────
//  auth.js  —  Single file handling all auth actions
//
//  Routes (via ?action= query param):
//    POST /api/auth?action=register  →  create account (bcrypt + pepper)
//    POST /api/auth?action=login     →  verify password, return JWT
//    POST /api/auth?action=logout    →  blacklist JWT in Redis
//    GET  /api/auth                  →  return logged-in user profile
//
//  Merged into one file to stay within Vercel Hobby plan (12 functions max).
// ─────────────────────────────────────────────────────────────

import bcrypt from 'bcryptjs';
import { getKV, signToken, verifyToken } from './_lib/auth.js';

const PEPPER = process.env.PASSWORD_PEPPER || 'sb-default-pepper-change-me';

function sanitize(str, maxLen = 100) {
  if (typeof str !== 'string') return '';
  return str.replace(/[<>"'&]/g, '').trim().slice(0, maxLen);
}

export default async function handler(req, res) {
  const kv = getKV();
  if (!kv) return res.status(500).json({ error: 'Database not configured.' });

  // ── GET /api/auth  →  return logged-in user profile (me) ────
  if (req.method === 'GET') {
    const decoded = await verifyToken(req, kv);
    if (!decoded) return res.status(401).json({ error: 'Unauthorized. Please log in.' });

    const raw  = await kv.get(`user:${decoded.username}`);
    if (!raw)  return res.status(404).json({ error: 'User not found.' });
    const user = typeof raw === 'string' ? JSON.parse(raw) : raw;

    return res.status(200).json({
      username:  user.username,
      email:     user.email,
      role:      user.role,
      createdAt: user.createdAt,
    });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const action = req.query.action;

  // ── POST /api/auth?action=register ───────────────────────────
  if (action === 'register') {
    const { username, email, password, role } = req.body;

    const cleanUsername = sanitize(username, 50).toLowerCase();
    const cleanEmail    = sanitize(email, 100).toLowerCase();
    const cleanRole     = role === 'admin' ? 'admin' : 'customer';

    if (!cleanUsername || !cleanEmail || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required.' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    }

    const existing = await kv.get(`user:${cleanUsername}`);
    if (existing) return res.status(409).json({ error: 'Username already taken.' });

    // Hash password: pepper + bcrypt (Section 3 & 4)
    const passwordHash = await bcrypt.hash(password + PEPPER, 12);

    const user = {
      username:     cleanUsername,
      email:        cleanEmail,
      passwordHash,
      role:         cleanRole,
      createdAt:    new Date().toISOString(),
    };

    await kv.set(`user:${cleanUsername}`, JSON.stringify(user));

    // Track every username in a Redis Set so admin/users.js can list all users
    await kv.sadd('registered_users', cleanUsername);

    const token = await signToken({ username: cleanUsername, role: cleanRole });
    return res.status(201).json({ ok: true, token, role: cleanRole });
  }

  // ── POST /api/auth?action=login ──────────────────────────────
  if (action === 'login') {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    const raw = await kv.get(`user:${username.toLowerCase().trim()}`);
    if (!raw) return res.status(401).json({ error: 'Invalid username or password.' });

    const user  = typeof raw === 'string' ? JSON.parse(raw) : raw;

    // Verify password: bcrypt.compare(input + pepper, storedHash) (Section 3 & 4)
    const match = await bcrypt.compare(password + PEPPER, user.passwordHash);
    if (!match) return res.status(401).json({ error: 'Invalid username or password.' });

    // Issue JWT (Section 1)
    const token = await signToken({ username: user.username, role: user.role });
    return res.status(200).json({ ok: true, token, role: user.role });
  }

  // ── POST /api/auth?action=logout ─────────────────────────────
  if (action === 'logout') {
    const decoded = await verifyToken(req, kv);
    if (!decoded) return res.status(401).json({ error: 'Invalid or expired token.' });

    // Blacklist the token in Redis (Section 2)
    const token = req.headers['authorization'].slice(7);
    await kv.sadd('auth_blacklisted_tokens', token);

    return res.status(200).json({ ok: true, message: 'Logged out successfully.' });
  }

  return res.status(400).json({ error: 'Unknown action.' });
}
