// ─────────────────────────────────────────────────────────────
//  admin/orders.js  —  GET /api/admin/orders
//
//  CONCEPTS USED (Section 4 — RBAC: Role-Based Access Control):
//
//  RBAC means users get DIFFERENT permissions based on their role.
//  This route demonstrates TWO levels of checking:
//
//    1. AUTHENTICATION  → "Are you logged in?" (valid JWT required)
//    2. AUTHORIZATION   → "Do you have PERMISSION?" (role must be "admin")
//
//  A logged-in "customer" will be REJECTED with 403 Forbidden.
//  Only "admin" users can see this data.
//
//  This matches lab4.py which had:
//    @app.route('/admin')
//    def admin():
//        if session.get('role') != 'admin':
//            return 'Access denied', 403
// ─────────────────────────────────────────────────────────────

import { getKV, verifyToken } from '../_lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const kv = getKV();
  if (!kv) return res.status(500).json({ error: 'Database not configured.' });

  // ── STEP 1: AUTHENTICATION — verify the JWT ──────────────────
  const decoded = await verifyToken(req, kv);
  if (!decoded) {
    return res.status(401).json({ error: 'Unauthorized. Please log in.' });
  }
  // ────────────────────────────────────────────────────────────

  // ── STEP 2: AUTHORIZATION — check the role (RBAC) ───────────
  if (decoded.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden. Admin access required.' });
  }
  // ────────────────────────────────────────────────────────────

  // Only admins reach this point — fetch the order activity feed from Redis
  const feed = await kv.lrange('order_feed', 0, -1) || [];
  const orders = feed.map(item => typeof item === 'string' ? JSON.parse(item) : item);

  return res.status(200).json({
    ok:     true,
    admin:  decoded.username,
    count:  orders.length,
    orders,
  });
}
