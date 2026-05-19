import { createClient } from '@vercel/kv';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');

  const dbUrl   = process.env.UPSTASH_REDIS_REST_URL   || process.env.KV_REST_API_URL   || process.env.STORAGE_REST_API_URL;
  const dbToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || process.env.STORAGE_REST_API_TOKEN;

  if (!dbUrl || !dbToken) return res.status(200).json([]);

  try {
    const kv  = createClient({ url: dbUrl, token: dbToken });
    const raw = await kv.lrange('order_feed', 0, 9);
    const entries = raw.map(r => (typeof r === 'string' ? JSON.parse(r) : r));
    return res.status(200).json(entries);
  } catch (e) {
    console.error('Feed fetch error:', e);
    return res.status(200).json([]);
  }
}
