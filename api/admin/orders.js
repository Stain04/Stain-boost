// GET /api/admin/orders
// returns the recent order feed - only admins can access this
// if a customer tries to access it they get a 403 error

import { getKV, verifyToken } from '../_lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const kv = getKV();
  if (!kv) return res.status(500).json({ error: 'Database not configured.' });

  // check that the user is logged in
  const decoded = await verifyToken(req, kv);
  if (!decoded) return res.status(401).json({ error: 'Unauthorized. Please log in.' });

  // check that the user is an admin, not a customer
  if (decoded.role !== 'admin') return res.status(403).json({ error: 'Forbidden. Admin access required.' });

  // only admins reach this point
  const feed = await kv.lrange('order_feed', 0, -1) || [];
  const orders = feed.map(item => typeof item === 'string' ? JSON.parse(item) : item);

  return res.status(200).json({ ok: true, admin: decoded.username, count: orders.length, orders });
}
