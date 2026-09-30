// ── /api/prices — server-side price tables ──
// Prices are defined in src/data/pricing.js only (shared with the site and /api/order).
import { WIN_PRICES, RB_DIV_PRICE } from '../src/data/pricing.js';

export default function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
  return res.status(200).json({ winPrices: WIN_PRICES, rbDivPrice: RB_DIV_PRICE });
}
