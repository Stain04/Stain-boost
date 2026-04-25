// ─────────────────────────────────────────────────────────────
//  logout.js  —  POST /api/auth/logout
//
//  CONCEPTS USED (Section 1 & 2 from NS labs):
//
//  THE PROBLEM WITH JWT LOGOUT:
//    JWTs are stateless — the server doesn't store them.
//    So how do we "invalidate" a token before it expires?
//
//  SOLUTION — TOKEN BLACKLIST (Session concept from Section 2):
//    - When the user logs out, we save their token in a Redis "blacklist".
//    - On every protected request, we check if the token is blacklisted.
//    - If it is, we reject it — even if it hasn't expired yet.
//    - This combines the stateless benefit of JWT with the revocation
//      ability of session-based auth (the best of both worlds).
// ─────────────────────────────────────────────────────────────

import { getKV, verifyToken } from '../_lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided.' });
  }

  const token = authHeader.slice(7);

  const kv = getKV();
  if (!kv) return res.status(500).json({ error: 'Database not configured.' });

  // Make sure the token is actually valid before blacklisting
  const decoded = await verifyToken(req, kv);
  if (!decoded) return res.status(401).json({ error: 'Invalid or already expired token.' });

  // ── Add token to the Redis blacklist ──────────────────────────
  // Redis SET: auth_blacklisted_tokens  →  { token1, token2, ... }
  // verifyToken() checks this set on every protected request
  await kv.sadd('auth_blacklisted_tokens', token);
  // ──────────────────────────────────────────────────────────────

  return res.status(200).json({ ok: true, message: 'Logged out successfully.' });
}
