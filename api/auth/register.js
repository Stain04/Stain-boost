// ─────────────────────────────────────────────────────────────
//  register.js  —  POST /api/auth/register
//
//  CONCEPTS USED (Section 3 & 4 from NS labs):
//
//  1. PASSWORD HASHING with bcrypt:
//     - We NEVER store the plain-text password.
//     - bcrypt hashes the password using a random "salt" internally.
//     - saltRounds = 12 means bcrypt runs 2^12 = 4096 iterations,
//       making brute-force attacks very slow.
//
//  2. PEPPER (Section 4):
//     - A "pepper" is a secret string stored ONLY on the server
//       (as an environment variable), never in the database.
//     - We append it to the password before hashing:
//         hash(password + pepper)
//     - Even if the database is stolen, the attacker can't crack
//       the passwords without the pepper.
//
//  3. ROLE-BASED ACCESS CONTROL (RBAC) setup:
//     - Every user gets a role: "customer" or "admin".
//     - Roles are stored in the database and embedded in the JWT.
// ─────────────────────────────────────────────────────────────

import bcrypt from 'bcryptjs';
import { getKV, signToken } from '../_lib/auth.js';

// Pepper = server-side secret. Set PASSWORD_PEPPER in Vercel env vars.
const PEPPER = process.env.PASSWORD_PEPPER || 'sb-default-pepper-change-me';

function sanitize(str, maxLen = 100) {
  if (typeof str !== 'string') return '';
  return str.replace(/[<>"'&]/g, '').trim().slice(0, maxLen);
}

// Rate limiting — max 10 register attempts per IP per minute
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
  if (isRateLimited(ip)) return res.status(429).json({ error: 'Too many requests. Please wait.' });

  const { username, email, password, role } = req.body;

  // Sanitize inputs
  const cleanUsername = sanitize(username, 50).toLowerCase();
  const cleanEmail    = sanitize(email, 100).toLowerCase();

  // Role comes from the request — "admin" or "customer" (default: "customer")
  // This matches lab4.py: role = request.json.get("role", "student")
  const cleanRole = role === 'admin' ? 'admin' : 'customer';

  // Validate required fields
  if (!cleanUsername || !cleanEmail || !password) {
    return res.status(400).json({ error: 'Username, email, and password are required.' });
  }
  if (cleanUsername.length < 3) {
    return res.status(400).json({ error: 'Username must be at least 3 characters.' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return res.status(400).json({ error: 'Invalid email address.' });
  }

  const kv = getKV();
  if (!kv) return res.status(500).json({ error: 'Database not configured.' });

  // Check if username is already taken
  const existing = await kv.get(`user:${cleanUsername}`);
  if (existing) return res.status(409).json({ error: 'Username already taken.' });

  // ── SECTION 3 & 4: Hash the password ──────────────────────────
  // Step 1: Append the pepper  →  "mypassword" + "sb-secret" = "mypasswordsb-secret"
  // Step 2: bcrypt hashes it with a random salt and 12 rounds
  // Result: a long string like "$2a$12$..." — safe to store in DB
  const pepperedPassword = password + PEPPER;
  const passwordHash = await bcrypt.hash(pepperedPassword, 12);
  // ──────────────────────────────────────────────────────────────

  const user = {
    username:     cleanUsername,
    email:        cleanEmail,
    passwordHash,            // NEVER store plain-text password
    role:         cleanRole, // "customer" or "admin"
    createdAt:    new Date().toISOString(),
  };

  // Store user in Redis as:  user:john → { ...user object }
  await kv.set(`user:${cleanUsername}`, JSON.stringify(user));

  // ── SECTION 1: Issue a JWT immediately after registration ──
  const token = signToken({ username: cleanUsername, role: cleanRole });

  return res.status(201).json({ ok: true, token, role: cleanRole });
}
