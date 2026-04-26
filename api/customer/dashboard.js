// GET /api/customer/dashboard
// returns dashboard info for the logged in customer
// admins are blocked from this route (403)

import { getKV, verifyToken } from '../_lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const kv = getKV();
  if (!kv) return res.status(500).json({ error: 'Database not configured.' });

  // check that the user is logged in
  const decoded = await verifyToken(req, kv);
  if (!decoded) return res.status(401).json({ error: 'Unauthorized. Please log in.' });

  // this route is for customers only, admins cannot access it
  if (decoded.role !== 'customer') return res.status(403).json({ error: 'Customers only. Admins cannot access this route.' });

  const raw = await kv.get(`user:${decoded.username}`);
  const user = typeof raw === 'string' ? JSON.parse(raw) : raw;

  return res.status(200).json({
    message:  'Welcome to your customer dashboard',
    username: user.username,
    email:    user.email,
    role:     user.role,
  });
}
