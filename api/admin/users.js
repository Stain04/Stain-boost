// ─────────────────────────────────────────────────────────────
//  admin/users.js  —  GET and PATCH /api/admin/users
//
//  CONCEPT: User Permissions Management (Coversheet criteria #4)
//
//  This file is the MANAGEMENT layer — it lets an admin:
//    GET   → see every user's username, email, and role
//    PATCH → change a user's role (promote or demote)
//
//  Why is this DIFFERENT from RBAC (criteria #3)?
//
//    RBAC (criteria 3) = CHECKING roles to allow/deny access
//      "Are you admin? No? Then 403."
//
//    Permissions Management (criteria 4) = CHANGING roles
//      "User X is a customer. Promote them to admin."
//
//  Think of it like a university system:
//    - RBAC        → the door that only lets professors in
//    - Management  → the office that decides who IS a professor
//
//  Both routes below are admin-only (customers get 403).
// ─────────────────────────────────────────────────────────────

import { getKV, verifyToken } from '../_lib/auth.js';

export default async function handler(req, res) {

  // ── Connect to database ──────────────────────────────────────
  const kv = getKV();
  if (!kv) return res.status(500).json({ error: 'Database not configured.' });

  // ── AUTHENTICATION: must be logged in ───────────────────────
  // verifyToken() checks the JWT in the Authorization header.
  // If the token is missing, expired, or blacklisted → null → 401.
  const decoded = await verifyToken(req, kv);
  if (!decoded) {
    return res.status(401).json({ error: 'Unauthorized. Please log in.' });
  }

  // ── AUTHORIZATION: must be an admin ─────────────────────────
  // Customers cannot manage other users' permissions.
  // This is the same RBAC check used in admin/orders.js.
  if (decoded.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden. Admin access required.' });
  }

  // ────────────────────────────────────────────────────────────
  //  GET /api/admin/users
  //  Returns a list of every registered user with their role.
  // ────────────────────────────────────────────────────────────
  if (req.method === 'GET') {

    // 'registered_users' is a Redis Set we keep updated on registration.
    // It holds every username string, e.g. { "ahmed", "stain", "omar" }
    const usernames = await kv.smembers('registered_users') || [];

    // For each username, fetch the full user object from Redis.
    // kv.get('user:ahmed') returns the object we stored during registration.
    const users = await Promise.all(
      usernames.map(async (username) => {
        const raw  = await kv.get(`user:${username}`);
        const user = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (!user) return null;

        // Only return safe fields — never return passwordHash!
        return {
          username:  user.username,
          email:     user.email,
          role:      user.role,       // 'admin' or 'customer'
          createdAt: user.createdAt,
        };
      })
    );

    // Filter out any nulls (in case a username existed but its data was deleted)
    const cleanList = users.filter(Boolean);

    return res.status(200).json({
      ok:    true,
      count: cleanList.length,
      users: cleanList,
    });
  }

  // ────────────────────────────────────────────────────────────
  //  PATCH /api/admin/users?user=<username>
  //  Changes a user's role to 'admin' or 'customer'.
  //  This is the core of "User Permissions Management".
  // ────────────────────────────────────────────────────────────
  if (req.method === 'PATCH') {

    const targetUsername = (req.query.user || '').toLowerCase().trim();
    const newRole        = req.body.role;

    // Validate inputs
    if (!targetUsername) {
      return res.status(400).json({ error: 'Missing ?user= query parameter.' });
    }
    if (newRole !== 'admin' && newRole !== 'customer') {
      return res.status(400).json({ error: 'Role must be "admin" or "customer".' });
    }

    // Load the target user from Redis
    const raw = await kv.get(`user:${targetUsername}`);
    if (!raw) {
      return res.status(404).json({ error: `User "${targetUsername}" not found.` });
    }

    const user = typeof raw === 'string' ? JSON.parse(raw) : raw;

    const oldRole = user.role;

    // Update the role and save back to Redis
    user.role = newRole;
    await kv.set(`user:${targetUsername}`, JSON.stringify(user));

    // Return what changed so the caller can confirm
    return res.status(200).json({
      ok:       true,
      username: user.username,
      oldRole,          // what the role was before
      newRole,          // what the role is now
      message:  `User "${user.username}" role changed from "${oldRole}" to "${newRole}".`,
    });
  }

  // Any other HTTP method (PUT, DELETE, etc.) is not allowed
  return res.status(405).json({ error: 'Method not allowed.' });
}
