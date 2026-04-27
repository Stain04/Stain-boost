import { getKV, verifyToken } from '../_lib/auth.js';

function parseUser(raw) {
  return typeof raw === 'string' ? JSON.parse(raw) : raw;
}

export default async function handler(req, res) {
  const kv = getKV();
  if (!kv) return res.status(500).json({ error: 'Database not configured.' });

  // by3ml check LL login
  const decoded = await verifyToken(req, kv);
  if (!decoded) return res.status(401).json({ error: 'Unauthorized. Please log in.' });

  // bs el admin b3mlo manage LL users
  if (decoded.role !== 'admin') return res.status(403).json({ error: 'Forbidden. Admin access required.' });

  // b return list lkl el users
  if (req.method === 'GET') {
    const usernames = await kv.smembers('registered_users') || [];
    const users = (await Promise.all(
      usernames.map(async (u) => {
        const raw = await kv.get(`user:${u}`);
        if (!raw) return null;
        const { username, email, role } = parseUser(raw);
        return { username, email, role }; // don't return the password hash
      })
    )).filter(Boolean);

    return res.status(200).json({ ok: true, count: users.length, users });
  }

  const targetUsername = (req.query.user || '').toLowerCase().trim();

  // hna bt3ml change LL user role
  if (req.method === 'PATCH') {
    const newRole = req.body.role;
    if (!targetUsername) return res.status(400).json({ error: 'Missing ?user= query parameter.' });
    if (targetUsername === decoded.username) return res.status(400).json({ error: 'You cannot change your own role.' });
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

  // btshel user ( delete)
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
