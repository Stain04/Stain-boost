import { SignJWT, jwtVerify } from 'jose';
import { createClient } from '@vercel/kv';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'fallback-secret-change-in-production'
);

//hn3ml connect le el redis database b env variables 
export function getKV() {
  const url   = process.env.UPSTASH_REDIS_REST_URL   || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return createClient({ url, token });
}

// hn3ml JWT token signed b HS256 wbt5ls fe 2 hours 
export async function signToken(payload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('2h')
    .sign(JWT_SECRET);
}

// hn3ml verify le JWT mn el Authorization header 
// return el token lw mzbota (null lw l2) 
export async function verifyToken(req, kv) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7);

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);

    // hnshof lw el token blacklisted lma el user 3ml logout
    if (kv) {
      const blacklisted = await kv.sismember('auth_blacklisted_tokens', token);
      if (blacklisted) return null;
    }

    return payload;
  } catch {
    return null;
  }
}
