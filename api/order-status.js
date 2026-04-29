import { createClient } from '@vercel/kv';

const TOKEN_RE = /^SB-[A-Z0-9]{4}-[A-Z0-9]{4}$/;

const rateLimitMap = new Map();
function isRateLimited(ip) {
  const now = Date.now();
  const WINDOW = 60_000;
  const MAX = 60;
  const entry = rateLimitMap.get(ip) || { count: 0, reset: now + WINDOW };
  if (now > entry.reset) {
    rateLimitMap.set(ip, { count: 1, reset: now + WINDOW });
    return false;
  }
  if (entry.count >= MAX) return true;
  entry.count++;
  rateLimitMap.set(ip, entry);
  return false;
}

function publicShape(o) {
  if (!o) return null;
  return {
    token: o.token,
    status: o.status,
    meta: o.meta,
    summary: o.summary,
    type: o.type,
    flash: o.flash,
    ign: o.ign,
    currentRank: o.currentRank || '',
    currentLp: o.currentLp || 0,
    eta: o.eta || '',
    games: Array.isArray(o.games) ? o.games.slice(-10) : [],
    notes: Array.isArray(o.notes) ? o.notes.slice(-30) : [],
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
  if (isRateLimited(ip)) return res.status(429).json({ error: 'Too many requests.' });

  const token = String(req.query.token || '').toUpperCase().trim();
  if (!TOKEN_RE.test(token)) return res.status(400).json({ error: 'Invalid token format.' });

  const dbUrl   = process.env.UPSTASH_REDIS_REST_URL   || process.env.KV_REST_API_URL   || process.env.STORAGE_REST_API_URL;
  const dbToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || process.env.STORAGE_REST_API_TOKEN;
  if (!dbUrl || !dbToken) return res.status(500).json({ error: 'Storage not configured.' });

  try {
    const kv = createClient({ url: dbUrl, token: dbToken });
    const raw = await kv.get(`order:${token}`);
    if (!raw) return res.status(404).json({ error: 'Order not found. Check your token.' });
    const order = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return res.status(200).json(publicShape(order));
  } catch (e) {
    console.error('order-status error:', e);
    return res.status(500).json({ error: 'Server error.' });
  }
}
