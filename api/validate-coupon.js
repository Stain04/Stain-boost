// ── /api/validate-coupon — coupon codes live here only, never in the browser ──
// Add or remove codes here. The frontend never sees the discount values.

const COUPONS = {
  'STAIN50': 0.50,  // 50% off
};

// Basic rate limiting (max 10 attempts per IP per minute)
const attemptMap = new Map();
function isCouponRateLimited(ip) {
  const now = Date.now();
  const WINDOW = 60_000;
  const MAX = 10;
  const entry = attemptMap.get(ip) || { count: 0, reset: now + WINDOW };
  if (now > entry.reset) {
    attemptMap.set(ip, { count: 1, reset: now + WINDOW });
    return false;
  }
  if (entry.count >= MAX) return true;
  entry.count++;
  attemptMap.set(ip, entry);
  return false;
}

export default function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
  if (isCouponRateLimited(ip)) {
    return res.status(429).json({ valid: false, error: 'Too many attempts.' });
  }

  const raw = req.body?.code;
  if (typeof raw !== 'string' || !raw.trim()) {
    return res.status(200).json({ valid: false });
  }

  const code = raw.trim().toUpperCase().slice(0, 30);
  const discount = COUPONS[code];

  if (discount === undefined) {
    return res.status(200).json({ valid: false });
  }

  // Return the discount percentage — NOT the code value in a way that exposes all codes
  return res.status(200).json({ valid: true, discount, label: `${Math.round(discount * 100)}% Off` });
}
