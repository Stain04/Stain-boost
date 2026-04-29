import { clearSessionCookie } from '../../lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  clearSessionCookie(res);
  if (req.method === 'GET') {
    res.writeHead(302, { Location: '/' });
    return res.end();
  }
  return res.status(200).json({ ok: true });
}
