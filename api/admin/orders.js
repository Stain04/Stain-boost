import { getKV, verifyToken } from '../_lib/authfun.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const kv = getKV();
  if (!kv) return res.status(500).json({ error: 'Database not configured.' });

  // byshof lw el user 3aml login mn awl 
  const decoded = await verifyToken(req, kv);
  if (!decoded) return res.status(401).json({ error: 'Unauthorized. Please log in.' });

  // byshof lw el user admin msh customer 
  if (decoded.role !== 'admin') return res.status(403).json({ error: 'Forbidden. Admin access required.' });

  // lw wslt lhna yb2a enta admin congrats :) 
  const feed = await kv.lrange('order_feed', 0, -1) || [];
  const orders = feed.map(item => typeof item === 'string' ? JSON.parse(item) : item);

  return res.status(200).json({ ok: true, admin: decoded.username, count: orders.length, orders });
}
