import { createClient } from '@vercel/kv';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import bcrypt from 'bcryptjs';

const SESSION_DAYS = 30;
const SESSION_COOKIE = 'sb_session';

export function getKv() {
  const dbUrl   = process.env.UPSTASH_REDIS_REST_URL   || process.env.KV_REST_API_URL   || process.env.STORAGE_REST_API_URL;
  const dbToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || process.env.STORAGE_REST_API_TOKEN;
  if (!dbUrl || !dbToken) return null;
  return createClient({ url: dbUrl, token: dbToken });
}

function b64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function b64urlDecode(str) {
  str = str.replace(/-/g,'+').replace(/_/g,'/');
  while (str.length % 4) str += '=';
  return Buffer.from(str, 'base64');
}

export function signSession(payload) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not configured');
  const body = b64url(JSON.stringify(payload));
  const sig = b64url(createHmac('sha256', secret).update(body).digest());
  return body + '.' + sig;
}

export function verifySession(token) {
  const secret = process.env.JWT_SECRET;
  if (!secret || !token) return null;
  const parts = String(token).split('.');
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  const expected = createHmac('sha256', secret).update(body).digest();
  let provided;
  try { provided = b64urlDecode(sig); } catch { return null; }
  if (provided.length !== expected.length) return null;
  if (!timingSafeEqual(provided, expected)) return null;
  let payload;
  try { payload = JSON.parse(b64urlDecode(body).toString('utf8')); } catch { return null; }
  if (!payload.exp || payload.exp < Date.now()) return null;
  return payload;
}

export function setSessionCookie(res, payload) {
  const exp = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  const token = signSession({ ...payload, exp });
  const maxAge = SESSION_DAYS * 24 * 60 * 60;
  const cookie = `${SESSION_COOKIE}=${token}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax; Secure`;
  res.setHeader('Set-Cookie', cookie);
}

export function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax; Secure`);
}

function parseCookies(req) {
  const out = {};
  const raw = req.headers.cookie || '';
  raw.split(';').forEach(p => {
    const [k, ...rest] = p.trim().split('=');
    if (!k) return;
    out[k] = decodeURIComponent(rest.join('='));
  });
  return out;
}

export function getSession(req) {
  const cookies = parseCookies(req);
  return verifySession(cookies[SESSION_COOKIE]);
}

export async function getUser(req) {
  const session = getSession(req);
  if (!session?.uid) return null;
  const kv = getKv();
  if (!kv) return null;
  const raw = await kv.get(`user:${session.uid}`);
  if (!raw) return null;
  const u = typeof raw === 'string' ? JSON.parse(raw) : raw;
  return publicUser(u);
}

export function publicUser(u) {
  if (!u) return null;
  return {
    id: u.id,
    type: u.type,
    username: u.username,
    email: u.email || null,
    discordId: u.discordId || null,
    discordUsername: u.discordUsername || null,
    createdAt: u.createdAt,
  };
}

export async function hashPassword(plain) {
  return bcrypt.hash(plain, 10);
}
export async function comparePassword(plain, hash) {
  if (!hash) return false;
  return bcrypt.compare(plain, hash);
}

export function newUserId() {
  return 'u_' + randomBytes(9).toString('base64').replace(/[+/=]/g,'').slice(0, 12);
}

export function normEmail(s) {
  return String(s || '').toLowerCase().trim();
}
export function normUsername(s) {
  return String(s || '').toLowerCase().trim();
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_RE = /^[a-z0-9_.-]{3,24}$/i;

export function validateEmail(s) { return EMAIL_RE.test(String(s || '')); }
export function validateUsername(s) { return USERNAME_RE.test(String(s || '')); }
export function validatePassword(s) { return typeof s === 'string' && s.length >= 8 && s.length <= 200; }

const ipBuckets = new Map();
export function rateLimit(key, max = 20, windowMs = 60_000) {
  const now = Date.now();
  const b = ipBuckets.get(key) || { count: 0, reset: now + windowMs };
  if (now > b.reset) { ipBuckets.set(key, { count: 1, reset: now + windowMs }); return false; }
  if (b.count >= max) return true;
  b.count++; ipBuckets.set(key, b); return false;
}

export function getIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
}
