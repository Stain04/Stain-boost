import { createClient } from '@vercel/kv';

const TOKEN_RE = /^SB-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
const VALID_STATUSES = ['queued', 'in_progress', 'paused', 'completed', 'cancelled'];

function sanitize(str, maxLen = 200) {
  if (typeof str !== 'string') return '';
  return str.replace(/[<>]/g, '').trim().slice(0, maxLen);
}

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

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
  if (isRateLimited(ip)) return res.status(429).json({ error: 'Too many requests.' });

  const ADMIN_KEY = process.env.ADMIN_KEY;
  if (!ADMIN_KEY) return res.status(500).json({ error: 'Admin key not configured.' });

  const provided = req.headers['x-admin-key'] || req.body?.adminKey;
  if (provided !== ADMIN_KEY) return res.status(401).json({ error: 'Unauthorized.' });

  const token = String(req.body?.token || '').toUpperCase().trim();
  if (!TOKEN_RE.test(token)) return res.status(400).json({ error: 'Invalid token format.' });

  const dbUrl   = process.env.UPSTASH_REDIS_REST_URL   || process.env.KV_REST_API_URL   || process.env.STORAGE_REST_API_URL;
  const dbToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || process.env.STORAGE_REST_API_TOKEN;
  if (!dbUrl || !dbToken) return res.status(500).json({ error: 'Storage not configured.' });

  try {
    const kv = createClient({ url: dbUrl, token: dbToken });
    const raw = await kv.get(`order:${token}`);
    if (!raw) return res.status(404).json({ error: 'Order not found.' });
    const order = typeof raw === 'string' ? JSON.parse(raw) : raw;

    const body = req.body || {};

    if (typeof body.status === 'string' && VALID_STATUSES.includes(body.status)) {
      order.status = body.status;
    }
    if (typeof body.currentRank === 'string') order.currentRank = sanitize(body.currentRank, 40);
    if (typeof body.currentLp === 'number') order.currentLp = Math.max(0, Math.min(9999, body.currentLp | 0));
    if (typeof body.eta === 'string') order.eta = sanitize(body.eta, 80);

    if (order.meta?.kind === 'win_boost' && typeof body.winsDone === 'number') {
      order.meta.winsDone = Math.max(0, Math.min(order.meta.wins || 0, body.winsDone | 0));
    }

    if (body.addGame && typeof body.addGame === 'object') {
      const g = {
        result: body.addGame.result === 'W' ? 'W' : 'L',
        champion: sanitize(body.addGame.champion || '', 30),
        kda: sanitize(body.addGame.kda || '', 20),
        lp: typeof body.addGame.lp === 'number' ? Math.max(-99, Math.min(99, body.addGame.lp | 0)) : null,
        ts: Date.now(),
      };
      order.games = Array.isArray(order.games) ? order.games : [];
      order.games.push(g);
      if (order.games.length > 50) order.games = order.games.slice(-50);
    }

    if (typeof body.addNote === 'string' && body.addNote.trim()) {
      order.notes = Array.isArray(order.notes) ? order.notes : [];
      order.notes.push({ from: 'stain', text: sanitize(body.addNote, 500), ts: Date.now() });
      if (order.notes.length > 100) order.notes = order.notes.slice(-100);
    }

    order.updatedAt = Date.now();
    await kv.set(`order:${token}`, JSON.stringify(order));

    return res.status(200).json({ ok: true, order });
  } catch (e) {
    console.error('order-update error:', e);
    return res.status(500).json({ error: 'Server error.' });
  }
}
