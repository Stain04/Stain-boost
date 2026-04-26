// shared helper functions for JWT and Redis
// these are used by all the route files

import { SignJWT, jwtVerify } from 'jose';
import { createClient } from '@vercel/kv';

// jose needs the secret as bytes, not a plain string
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'fallback-secret-change-in-production'
);

// connect to the redis database using env variables
export function getKV() {
  const url   = process.env.UPSTASH_REDIS_REST_URL   || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return createClient({ url, token });
}

// create a JWT token signed with HS256, expires in 2 hours
export async function signToken(payload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('2h')
    .sign(JWT_SECRET);
}

// verify the JWT from the Authorization header
// returns the token payload if valid, null if not
export async function verifyToken(req, kv) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7);

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);

    // also check if the token was blacklisted when the user logged out
    if (kv) {
      const blacklisted = await kv.sismember('auth_blacklisted_tokens', token);
      if (blacklisted) return null;
    }

    return payload;
  } catch {
    return null;
  }
}
