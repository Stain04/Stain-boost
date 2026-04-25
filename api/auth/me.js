// ─────────────────────────────────────────────────────────────
//  me.js  —  GET /api/auth/me
//
//  CONCEPTS USED (Section 1 — Protected Route):
//
//  This is a "protected route" — it can only be accessed by a
//  logged-in user who sends a valid JWT.
//
//  HOW IT WORKS:
//    1. Client sends:  GET /api/auth/me
//                      Authorization: Bearer <jwt_token>
//    2. verifyToken() checks the token signature and blacklist.
//    3. If valid, we return the user's profile (without the password hash).
//    4. If invalid/missing, we return 401 Unauthorized.
//
//  This demonstrates the "token_required" decorator concept from lab1.py
//  but implemented as a shared helper function instead.
// ─────────────────────────────────────────────────────────────

import { getKV, verifyToken } from '../_lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const kv = getKV();
  if (!kv) return res.status(500).json({ error: 'Database not configured.' });

  // ── SECTION 1: Verify the JWT ──────────────────────────────
  const decoded = await verifyToken(req, kv);
  if (!decoded) return res.status(401).json({ error: 'Unauthorized. Please log in.' });
  // ───────────────────────────────────────────────────────────

  // Fetch fresh user data from Redis (decoded.username comes from the JWT payload)
  const raw = await kv.get(`user:${decoded.username}`);
  if (!raw) return res.status(404).json({ error: 'User not found.' });

  const user = typeof raw === 'string' ? JSON.parse(raw) : raw;

  // Return safe user info — NEVER return the passwordHash
  return res.status(200).json({
    username:  user.username,
    email:     user.email,
    role:      user.role,
    createdAt: user.createdAt,
  });
}
