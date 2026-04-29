import { getKv, getUser, rateLimit, getIp } from '../lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (rateLimit('myorders:' + getIp(req), 60, 60_000)) return res.status(429).json({ error: 'Too many requests.' });

  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Not signed in.' });

  const kv = getKv();
  if (!kv) return res.status(500).json({ error: 'Storage not configured.' });

  try {
    const raw = await kv.get(`user:${user.id}`);
    if (!raw) return res.status(200).json({ orders: [] });
    const u = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const tokens = Array.isArray(u.orderTokens) ? u.orderTokens : [];
    if (!tokens.length) return res.status(200).json({ orders: [] });

    const results = await Promise.all(tokens.map(async (t) => {
      try {
        const r = await kv.get(`order:${t}`);
        if (!r) return null;
        const o = typeof r === 'string' ? JSON.parse(r) : r;
        return {
          token: o.token,
          status: o.status,
          summary: o.summary,
          total: o.total,
          meta: o.meta,
          currentRank: o.currentRank || '',
          eta: o.eta || '',
          createdAt: o.createdAt,
          updatedAt: o.updatedAt,
        };
      } catch { return null; }
    }));

    return res.status(200).json({ orders: results.filter(Boolean) });
  } catch (err) {
    console.error('my-orders error', err);
    return res.status(500).json({ error: 'Server error.' });
  }
}
