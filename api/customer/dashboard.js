// ─────────────────────────────────────────────────────────────
//  customer/dashboard.js  —  GET /api/customer/dashboard
//
//  CONCEPT: User Permissions Management (Coversheet criteria #4)
//
//  This is the CUSTOMER-only route.
//  It mirrors lab4.py's /student route:
//
//    @app.route("/student")
//    def student():
//        if session["role"] != "student":
//            return "Students only", 403
//
//  Together with /api/admin/orders, this proves the permission
//  system works in BOTH directions:
//    - Admin  → can access /api/admin/orders,  blocked from here
//    - Customer → can access /api/customer/dashboard, blocked from admin
//
//  This is what "User Permissions Management" means:
//  different users have different permissions based on their role.
// ─────────────────────────────────────────────────────────────

import { getKV, verifyToken } from '../_lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const kv = getKV();
  if (!kv) return res.status(500).json({ error: 'Database not configured.' });

  // STEP 1: Authentication — must be logged in
  const decoded = await verifyToken(req, kv);
  if (!decoded) {
    return res.status(401).json({ error: 'Unauthorized. Please log in.' });
  }

  // STEP 2: Authorization — must be a customer (RBAC)
  if (decoded.role !== 'customer') {
    return res.status(403).json({ error: 'Customers only. Admins cannot access this route.' });
  }

  // Fetch the user's data from Redis
  const raw = await kv.get(`user:${decoded.username}`);
  const user = typeof raw === 'string' ? JSON.parse(raw) : raw;

  return res.status(200).json({
    message:  'Welcome to your customer dashboard',
    username: user.username,
    email:    user.email,
    role:     user.role,
  });
}
