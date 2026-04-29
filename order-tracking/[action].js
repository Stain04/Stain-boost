import { getKv, getUser, rateLimit, getIp, isAdmin } from '../../lib/auth.js';

const TOKEN_RE = /^SB-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
const VALID_STATUSES = ['queued', 'in_progress', 'paused', 'completed', 'cancelled'];

function sanitize(str, maxLen = 200) {
  if (typeof str !== 'string') return '';
  return str.replace(/[<>]/g, '').trim().slice(0, maxLen);
}

function publicShape(o) {
  if (!o) return null;
  return {
    token: o.token,
    status: o.status,
    meta: o.meta,
    summary: o.summary,
    type: o.type,
    flash: o.flash,
    ign: o.ign,
    currentRank: o.currentRank || '',
    currentLp: o.currentLp || 0,
    eta: o.eta || '',
    games: Array.isArray(o.games) ? o.games.slice(-10) : [],
    notes: Array.isArray(o.notes) ? o.notes.slice(-30) : [],
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
}

export default async function handler(req, res) {
  const action = req.query.action;
  switch (action) {
    case 'status': return status(req, res);
    case 'update': return update(req, res);
    case 'chat':   return chat(req, res);
    case 'mine':   return mine(req, res);
    default:       return res.status(404).json({ error: 'Not found' });
  }
}

async function status(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (rateLimit('status:' + getIp(req), 60, 60_000)) return res.status(429).json({ error: 'Too many requests.' });

  const token = String(req.query.token || '').toUpperCase().trim();
  if (!TOKEN_RE.test(token)) return res.status(400).json({ error: 'Invalid token format.' });

  const kv = getKv();
  if (!kv) return res.status(500).json({ error: 'Storage not configured.' });

  try {
    const raw = await kv.get(`order:${token}`);
    if (!raw) return res.status(404).json({ error: 'Order not found. Check your token.' });
    const order = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return res.status(200).json(publicShape(order));
  } catch (e) {
    console.error('status error:', e);
    return res.status(500).json({ error: 'Server error.' });
  }
}

async function update(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (rateLimit('update:' + getIp(req), 60, 60_000)) return res.status(429).json({ error: 'Too many requests.' });

  // Auth: admin session OR admin key fallback
  const sessionUser = await getUser(req);
  const sessionOk = isAdmin(sessionUser);
  const ADMIN_KEY = process.env.ADMIN_KEY;
  const provided = req.headers['x-admin-key'] || req.body?.adminKey;
  const keyOk = ADMIN_KEY && provided === ADMIN_KEY;
  if (!sessionOk && !keyOk) return res.status(401).json({ error: 'Unauthorized.' });

  const token = String(req.body?.token || '').toUpperCase().trim();
  if (!TOKEN_RE.test(token)) return res.status(400).json({ error: 'Invalid token format.' });

  const kv = getKv();
  if (!kv) return res.status(500).json({ error: 'Storage not configured.' });

  try {
    const raw = await kv.get(`order:${token}`);
    if (!raw) return res.status(404).json({ error: 'Order not found.' });
    const order = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const body = req.body || {};

    if (typeof body.status === 'string' && VALID_STATUSES.includes(body.status)) order.status = body.status;
    if (typeof body.currentRank === 'string') order.currentRank = sanitize(body.currentRank, 40);
    if (typeof body.currentLp === 'number') order.currentLp = Math.max(0, Math.min(9999, body.currentLp | 0));
    if (typeof body.eta === 'string') order.eta = sanitize(body.eta, 80);

    if (order.meta?.kind === 'win_boost' && typeof body.winsDone === 'number') {
      order.meta.winsDone = Math.max(0, Math.min(order.meta.wins || 0, body.winsDone | 0));
    }

    if (body.addGame && typeof body.addGame === 'object') {
      const g = {
        result: body.addGame.result === 'W' ? 'W' : 'L',
        champion: sanitize(body.addGame.champion || '', 30),
        kda: sanitize(body.addGame.kda || '', 20),
        lp: typeof body.addGame.lp === 'number' ? Math.max(-99, Math.min(99, body.addGame.lp | 0)) : null,
        ts: Date.now(),
      };
      order.games = Array.isArray(order.games) ? order.games : [];
      order.games.push(g);
      if (order.games.length > 50) order.games = order.games.slice(-50);
    }

    if (typeof body.addNote === 'string' && body.addNote.trim()) {
      order.notes = Array.isArray(order.notes) ? order.notes : [];
      order.notes.push({ from: 'stain', text: sanitize(body.addNote, 500), ts: Date.now() });
      if (order.notes.length > 100) order.notes = order.notes.slice(-100);
    }

    order.updatedAt = Date.now();
    await kv.set(`order:${token}`, JSON.stringify(order));

    return res.status(200).json({ ok: true, order });
  } catch (e) {
    console.error('update error:', e);
    return res.status(500).json({ error: 'Server error.' });
  }
}

async function chat(req, res) {
  const kv = getKv();
  if (!kv) return res.status(500).json({ error: 'Storage not configured.' });

  if (req.method === 'GET') {
    if (rateLimit('chatG:' + getIp(req), 120, 60_000)) return res.status(429).json({ error: 'Too many requests.' });
    const token = String(req.query.token || '').toUpperCase().trim();
    if (!TOKEN_RE.test(token)) return res.status(400).json({ error: 'Invalid token.' });

    try {
      const exists = await kv.get(`order:${token}`);
      if (!exists) return res.status(404).json({ error: 'Order not found.' });
      const raw = await kv.lrange(`chat:${token}`, 0, -1);
      const messages = (raw || []).map(m => {
        try { return typeof m === 'string' ? JSON.parse(m) : m; } catch { return null; }
      }).filter(Boolean);
      return res.status(200).json({ messages });
    } catch (e) {
      console.error('chat GET error:', e);
      return res.status(500).json({ error: 'Server error.' });
    }
  }

  if (req.method === 'POST') {
    if (rateLimit('chatP:' + getIp(req), 30, 60_000)) return res.status(429).json({ error: 'Too many messages. Slow down.' });

    const body = req.body || {};
    const token = String(body.token || '').toUpperCase().trim();
    if (!TOKEN_RE.test(token)) return res.status(400).json({ error: 'Invalid token.' });

    const text = sanitize(body.text || '', 1000);
    if (!text) return res.status(400).json({ error: 'Message cannot be empty.' });

    const ADMIN_KEY = process.env.ADMIN_KEY;
    const keyOk = ADMIN_KEY && (req.headers['x-admin-key'] === ADMIN_KEY || body.adminKey === ADMIN_KEY);
    const sessionUser = await getUser(req);
    const sessionOk = isAdmin(sessionUser);
    const from = (keyOk || sessionOk) ? 'stain' : 'client';

    try {
      const exists = await kv.get(`order:${token}`);
      if (!exists) return res.status(404).json({ error: 'Order not found.' });

      const msg = { from, text, ts: Date.now() };
      await kv.rpush(`chat:${token}`, JSON.stringify(msg));
      await kv.ltrim(`chat:${token}`, -200, -1);
      await kv.expire(`chat:${token}`, 60 * 60 * 24 * 90);
      return res.status(200).json({ ok: true, message: msg });
    } catch (e) {
      console.error('chat POST error:', e);
      return res.status(500).json({ error: 'Server error.' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

async function mine(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (rateLimit('mine:' + getIp(req), 60, 60_000)) return res.status(429).json({ error: 'Too many requests.' });

  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Not signed in.' });

  const kv = getKv();
  if (!kv) return res.status(500).json({ error: 'Storage not configured.' });

  try {
    const raw = await kv.get(`user:${user.id}`);
    if (!raw) return res.status(200).json({ orders: [] });
    const u = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const tokens = Array.isArray(u.orderTokens) ? u.orderTokens : [];
    if (!tokens.length) return res.status(200).json({ orders: [] });

    const results = await Promise.all(tokens.map(async (t) => {
      try {
        const r = await kv.get(`order:${t}`);
        if (!r) return null;
        const o = typeof r === 'string' ? JSON.parse(r) : r;
        return {
          token: o.token, status: o.status, summary: o.summary,
          total: o.total, meta: o.meta,
          currentRank: o.currentRank || '', eta: o.eta || '',
          createdAt: o.createdAt, updatedAt: o.updatedAt,
        };
      } catch { return null; }
    }));

    return res.status(200).json({ orders: results.filter(Boolean) });
  } catch (err) {
    console.error('mine error', err);
    return res.status(500).json({ error: 'Server error.' });
  }
}
