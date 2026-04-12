// Fetches live USD→EGP rate and caches it in KV for 1 hour.
// API key stays server-side — never exposed to the client.

import { createClient } from '@vercel/kv';

const CACHE_KEY = 'egp_rate';
const CACHE_TTL = 3600; // seconds (1 hour)
const FALLBACK_RATE = 54.6;

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ── Try KV cache first ──
  const dbUrl   = process.env.UPSTASH_REDIS_REST_URL   || process.env.KV_REST_API_URL;
  const dbToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

  if (dbUrl && dbToken) {
    try {
      const kv = createClient({ url: dbUrl, token: dbToken });
      const cached = await kv.get(CACHE_KEY);
      if (cached) {
        return res.status(200).json({ rate: parseFloat(cached), cached: true });
      }
    } catch (e) {
      console.error('KV cache read failed:', e);
    }
  }

  // ── Fetch live rate ──
  const API_KEY = process.env.EXCHANGE_RATE_API_KEY;

  if (!API_KEY) {
    console.warn('EXCHANGE_RATE_API_KEY not set — using fallback rate');
    return res.status(200).json({ rate: FALLBACK_RATE, cached: false, fallback: true });
  }

  try {
    const response = await fetch(
      `https://v6.exchangerate-api.com/v6/${API_KEY}/pair/USD/EGP`
    );

    if (!response.ok) throw new Error(`Exchange API error: ${response.status}`);

    const data = await response.json();
    const rate = parseFloat(data.conversion_rate);

    if (!rate || isNaN(rate)) throw new Error('Invalid rate in response');

    // ── Cache in KV for 1 hour ──
    if (dbUrl && dbToken) {
      try {
        const kv = createClient({ url: dbUrl, token: dbToken });
        await kv.set(CACHE_KEY, rate.toString(), { ex: CACHE_TTL });
      } catch (e) {
        console.error('KV cache write failed:', e);
      }
    }

    return res.status(200).json({ rate, cached: false });

  } catch (e) {
    console.error('Exchange rate fetch failed:', e);
    return res.status(200).json({ rate: FALLBACK_RATE, cached: false, fallback: true });
  }
}
