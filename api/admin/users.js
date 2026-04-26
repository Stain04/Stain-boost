// GET, PATCH, DELETE /api/admin/users
// lets the admin manage user accounts and their roles
// customers cannot access any of these

import { getKV, verifyToken } from '../_lib/auth.js';

function parseUser(raw) {
  return typeof raw === 'string' ? JSON.parse(raw) : raw;
}

export default async function handler(req, res) {
  const kv = getKV();
  if (!kv) return res.status(500).json({ error: 'Database not configured.' });

  // check login
  const decoded = await verifyToken(req, kv);
  if (!decoded) return res.status(401).json({ error: 'Unauthorized. Please log in.' });

  // only admins can manage users
  if (decoded.role !== 'admin') return res.status(403).json({ error: 'Forbidden. Admin access required.' });

  // GET - return a list of all users
  if (req.method === 'GET') {
    const usernames = await kv.smembers('registered_users') || [];
    const users = (await Promise.all(
      usernames.map(async (u) => {
        const raw = await kv.get(`user:${u}`);
        if (!raw) return null;
        const { username, email, role, createdAt } = parseUser(raw);
        return { username, email, role, createdAt }; // don't return the password hash
      })
    )).filter(Boolean);

    return res.status(200).json({ ok: true, count: users.length, users });
  }

  const targetUsername = (req.query.user || '').toLowerCase().trim();

  // PATCH - change a user's role
  if (req.method === 'PATCH') {
    const newRole = req.body.role;
    if (!targetUsername) return res.status(400).json({ error: 'Missing ?user= query parameter.' });
    if (newRole !== 'admin' && newRole !== 'customer') return res.status(400).json({ error: 'Role must be "admin" or "customer".' });

    const raw = await kv.get(`user:${targetUsername}`);
    if (!raw) return res.status(404).json({ error: `User "${targetUsername}" not found.` });
    const user = parseUser(raw);

    const oldRole = user.role;
    user.role = newRole;
    await kv.set(`user:${targetUsername}`, JSON.stringify(user));

    return res.status(200).json({ ok: true, username: user.username, oldRole, newRole,
      message: `User "${user.username}" role changed from "${oldRole}" to "${newRole}".` });
  }

  // DELETE - remove a user account
  if (req.method === 'DELETE') {
    if (!targetUsername) return res.status(400).json({ error: 'Missing ?user= query parameter.' });
    if (targetUsername === decoded.username) return res.status(400).json({ error: 'You cannot delete your own account.' });

    const raw = await kv.get(`user:${targetUsername}`);
    if (!raw) return res.status(404).json({ error: `User "${targetUsername}" not found.` });

    await kv.del(`user:${targetUsername}`);
    await kv.srem('registered_users', targetUsername);

    return res.status(200).json({ ok: true, deleted: targetUsername,
      message: `User "${targetUsername}" has been permanently deleted.` });
  }

  return res.status(405).json({ error: 'Method not allowed.' });
}
