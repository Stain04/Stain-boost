// ─────────────────────────────────────────────────────────────
//  auth.js  —  Shared JWT + Redis helpers used by all auth routes
//
//  CONCEPT (Section 1 & 2 from NS labs):
//    - JWT (JSON Web Token): a signed string the server gives the
//      client after login. The client sends it back on every request
//      inside the "Authorization: Bearer <token>" header.
//    - The server verifies the signature to trust the token WITHOUT
//      needing to look it up in a database every time (stateless).
//    - On logout we BLACKLIST the token in Redis so it can't be reused.
//
//  NOTE: We use 'jose' instead of 'jsonwebtoken' because jose is a
//  modern ESM-native library — fully compatible with Vercel's bundler.
// ─────────────────────────────────────────────────────────────

import { SignJWT, jwtVerify } from 'jose';
import { createClient } from '@vercel/kv';

// JWT secret converted to bytes — jose requires a Uint8Array key
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'fallback-secret-change-in-production'
);

// ── Build and return a Vercel KV (Redis) client ──
export function getKV() {
  const url   = process.env.UPSTASH_REDIS_REST_URL   || process.env.KV_REST_API_URL   || process.env.STORAGE_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || process.env.STORAGE_REST_API_TOKEN;
  if (!url || !token) return null;
  return createClient({ url, token });
}

// ── Create a signed JWT containing the user's username and role ──
// The token expires in 2 hours — after that the user must log in again.
export async function signToken(payload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('2h')
    .sign(JWT_SECRET);
}

// ── Verify the JWT sent by the client and return its decoded payload ──
// Returns null if the token is missing, expired, tampered with, or blacklisted.
export async function verifyToken(req, kv) {
  const authHeader = req.headers['authorization'];

  // Token must be sent as:  Authorization: Bearer <token>
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7); // strip "Bearer " prefix

  try {
    // jwtVerify() checks the signature AND the expiry time
    const { payload } = await jwtVerify(token, JWT_SECRET);

    // Check our logout blacklist stored in Redis
    if (kv) {
      const blacklisted = await kv.sismember('auth_blacklisted_tokens', token);
      if (blacklisted) return null; // user already logged out
    }

    return payload; // { username, role, iat, exp }
  } catch {
    return null; // expired or tampered token
  }
}
