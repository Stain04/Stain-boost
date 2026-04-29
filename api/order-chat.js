import { createClient } from '@vercel/kv';

const TOKEN_RE = /^SB-[A-Z0-9]{4}-[A-Z0-9]{4}$/;

function sanitize(str, maxLen = 1000) {
  if (typeof str !== 'string') return '';
  return str.replace(/[<>]/g, '').trim().slice(0, maxLen);
}

const rateLimitMap = new Map();
function isRateLimited(ip, max) {
  const now = Date.now();
  const WINDOW = 60_000;
  const entry = rateLimitMap.get(ip) || { count: 0, reset: now + WINDOW };
  if (now > entry.reset) {
    rateLimitMap.set(ip, { count: 1, reset: now + WINDOW });
    return false;
  }
  if (entry.count >= max) return true;
  entry.count++;
  rateLimitMap.set(ip, entry);
  return false;
}

export default async function handler(req, res) {
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';

  const dbUrl   = process.env.UPSTASH_REDIS_REST_URL   || process.env.KV_REST_API_URL   || process.env.STORAGE_REST_API_URL;
  const dbToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || process.env.STORAGE_REST_API_TOKEN;
  if (!dbUrl || !dbToken) return res.status(500).json({ error: 'Storage not configured.' });
  const kv = createClient({ url: dbUrl, token: dbToken });

  if (req.method === 'GET') {
    if (isRateLimited(ip, 120)) return res.status(429).json({ error: 'Too many requests.' });
    const token = String(req.query.token || '').toUpperCase().trim();
    if (!TOKEN_RE.test(token)) return res.status(400).json({ error: 'Invalid token.' });

    try {
      const exists = await kv.get(`order:${token}`);
      if (!exists) return res.status(404).json({ error: 'Order not found.' });
      const raw = await kv.lrange(`chat:${token}`, 0, -1);
      const messages = (raw || []).map(m => {
        try { return typeof m === 'string' ? JSON.parse(m) : m; } catch { return null; }
      }).filter(Boolean);
      return res.status(200).json({ messages });
    } catch (e) {
      console.error('chat GET error:', e);
      return res.status(500).json({ error: 'Server error.' });
    }
  }

  if (req.method === 'POST') {
    if (isRateLimited(ip, 30)) return res.status(429).json({ error: 'Too many messages. Slow down.' });

    const body = req.body || {};
    const token = String(body.token || '').toUpperCase().trim();
    if (!TOKEN_RE.test(token)) return res.status(400).json({ error: 'Invalid token.' });

    const text = sanitize(body.text || '', 1000);
    if (!text) return res.status(400).json({ error: 'Message cannot be empty.' });

    const ADMIN_KEY = process.env.ADMIN_KEY;
    const isAdmin = ADMIN_KEY && (req.headers['x-admin-key'] === ADMIN_KEY || body.adminKey === ADMIN_KEY);
    const from = isAdmin ? 'stain' : 'client';

    try {
      const exists = await kv.get(`order:${token}`);
      if (!exists) return res.status(404).json({ error: 'Order not found.' });

      const msg = { from, text, ts: Date.now() };
      await kv.rpush(`chat:${token}`, JSON.stringify(msg));
      await kv.ltrim(`chat:${token}`, -200, -1);
      await kv.expire(`chat:${token}`, 60 * 60 * 24 * 90);
      return res.status(200).json({ ok: true, message: msg });
    } catch (e) {
      console.error('chat POST error:', e);
      return res.status(500).json({ error: 'Server error.' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
