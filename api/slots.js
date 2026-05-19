import { createClient } from '@vercel/kv';

const DEFAULT_SLOTS = 5;

// Week key: increments every 7 days from Unix epoch (resets Monday-ish)
function weekKey() {
  return Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000));
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=10, stale-while-revalidate=30');

  const dbUrl   = process.env.UPSTASH_REDIS_REST_URL   || process.env.KV_REST_API_URL   || process.env.STORAGE_REST_API_URL;
  const dbToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || process.env.STORAGE_REST_API_TOKEN;

  if (!dbUrl || !dbToken) return res.status(200).json({ slots: DEFAULT_SLOTS });

  try {
    const kv = createClient({ url: dbUrl, token: dbToken });
    const currentWeek = weekKey();
    const storedWeek  = await kv.get('slots_week');

    if (storedWeek !== currentWeek) {
      await kv.set('slots_week',  currentWeek);
      await kv.set('slots_count', DEFAULT_SLOTS);
      return res.status(200).json({ slots: DEFAULT_SLOTS });
    }

    const count = await kv.get('slots_count');
    return res.status(200).json({ slots: count ?? DEFAULT_SLOTS });
  } catch (e) {
    console.error('Slots fetch error:', e);
    return res.status(200).json({ slots: DEFAULT_SLOTS });
  }
}
