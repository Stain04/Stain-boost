// ─────────────────────────────────────────────────────────────
//  login.js  —  POST /api/auth/login
//
//  CONCEPTS USED (Section 1, 3 & 4 from NS labs):
//
//  1. PASSWORD VERIFICATION (Section 3 & 4):
//     - The user sends their plain-text password.
//     - We add the pepper, then use bcrypt.compare() to check it
//       against the stored hash — WITHOUT ever decrypting the hash.
//     - This works because bcrypt is a one-way function.
//
//  2. JWT ISSUANCE (Section 1):
//     - If the password matches, we sign a JWT containing the
//       user's username and role.
//     - The client stores this token and sends it with future requests.
//
//  3. GENERIC ERROR MESSAGES:
//     - We return "Invalid username or password" for BOTH wrong username
//       and wrong password. This prevents attackers from knowing which
//       one is wrong (username enumeration attack prevention).
// ─────────────────────────────────────────────────────────────

import bcrypt from 'bcryptjs';
import { getKV, signToken } from '../_lib/auth.js';

const PEPPER = process.env.PASSWORD_PEPPER || 'sb-default-pepper-change-me';

// Rate limiting — max 10 login attempts per IP per minute
const rateLimitMap = new Map();
function isRateLimited(ip) {
  const now = Date.now();
  const WINDOW = 60_000;
  const MAX = 10;
  const entry = rateLimitMap.get(ip) || { count: 0, reset: now + WINDOW };
  if (now > entry.reset) { rateLimitMap.set(ip, { count: 1, reset: now + WINDOW }); return false; }
  if (entry.count >= MAX) return true;
  entry.count++;
  rateLimitMap.set(ip, entry);
  return false;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
  if (isRateLimited(ip)) return res.status(429).json({ error: 'Too many login attempts. Wait a minute.' });

  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  const kv = getKV();
  if (!kv) return res.status(500).json({ error: 'Database not configured.' });

  // Look up user in Redis
  const raw = await kv.get(`user:${username.toLowerCase().trim()}`);

  // Use the same generic error whether user doesn't exist OR password is wrong
  // This prevents "username enumeration" attacks
  if (!raw) return res.status(401).json({ error: 'Invalid username or password.' });

  const user = typeof raw === 'string' ? JSON.parse(raw) : raw;

  // ── SECTION 3 & 4: Verify the password ────────────────────────
  // bcrypt.compare(plain + pepper, storedHash) returns true/false
  // It automatically extracts the salt from the stored hash
  const match = await bcrypt.compare(password + PEPPER, user.passwordHash);
  // ──────────────────────────────────────────────────────────────

  if (!match) return res.status(401).json({ error: 'Invalid username or password.' });

  // ── SECTION 1: Sign and return a JWT ──────────────────────────
  // Token payload contains username and role (used for RBAC later)
  const token = signToken({ username: user.username, role: user.role });
  // ──────────────────────────────────────────────────────────────

  return res.status(200).json({ ok: true, token, role: user.role });
}
