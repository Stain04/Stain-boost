import { randomBytes } from 'crypto';
import {
  getKv, setSessionCookie, clearSessionCookie, hashPassword, comparePassword,
  newUserId, normEmail, normUsername, validateEmail, validateUsername, validatePassword,
  rateLimit, getIp, publicUser, getUser,
} from '../../lib/auth.js';

export default async function handler(req, res) {
  const action = req.query.action;
  switch (action) {
    case 'signup':           return signup(req, res);
    case 'login':            return login(req, res);
    case 'logout':           return logout(req, res);
    case 'me':               return me(req, res);
    case 'discord-start':    return discordStart(req, res);
    case 'discord-callback': return discordCallback(req, res);
    default:                 return res.status(404).json({ error: 'Not found' });
  }
}

async function signup(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (rateLimit('signup:' + getIp(req), 8, 60_000)) return res.status(429).json({ error: 'Too many attempts. Wait a minute.' });

  const { email, username, password } = req.body || {};
  const e = normEmail(email);
  const u = normUsername(username);

  if (!validateEmail(e)) return res.status(400).json({ error: 'Invalid email.' });
  if (!validateUsername(u)) return res.status(400).json({ error: 'Username must be 3–24 chars, letters/numbers/._- only.' });
  if (!validatePassword(password)) return res.status(400).json({ error: 'Password must be at least 8 characters.' });

  const kv = getKv();
  if (!kv) return res.status(500).json({ error: 'Storage not configured.' });

  try {
    const [emailTaken, usernameTaken] = await Promise.all([
      kv.get(`email:${e}`),
      kv.get(`username:${u}`),
    ]);
    if (emailTaken) return res.status(409).json({ error: 'Email already registered.' });
    if (usernameTaken) return res.status(409).json({ error: 'Username already taken.' });

    const id = newUserId();
    const passwordHash = await hashPassword(password);
    const user = {
      id, type: 'email',
      email: e,
      username: u,
      displayUsername: String(username).trim(),
      passwordHash,
      orderTokens: [],
      createdAt: Date.now(),
    };

    await kv.set(`user:${id}`, JSON.stringify(user));
    await kv.set(`email:${e}`, id);
    await kv.set(`username:${u}`, id);

    setSessionCookie(res, { uid: id });
    return res.status(200).json({ ok: true, user: publicUser(user) });
  } catch (err) {
    console.error('signup error', err);
    return res.status(500).json({ error: 'Server error.' });
  }
}

async function login(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (rateLimit('login:' + getIp(req), 10, 60_000)) return res.status(429).json({ error: 'Too many attempts. Wait a minute.' });

  const { identifier, password } = req.body || {};
  if (!identifier || !password) return res.status(400).json({ error: 'Missing credentials.' });

  const kv = getKv();
  if (!kv) return res.status(500).json({ error: 'Storage not configured.' });

  try {
    const idRaw = String(identifier).trim();
    let userId = null;
    if (idRaw.includes('@')) {
      userId = await kv.get(`email:${normEmail(idRaw)}`);
    } else {
      userId = await kv.get(`username:${normUsername(idRaw)}`);
    }
    if (!userId) return res.status(401).json({ error: 'Invalid credentials.' });

    const raw = await kv.get(`user:${userId}`);
    if (!raw) return res.status(401).json({ error: 'Invalid credentials.' });
    const user = typeof raw === 'string' ? JSON.parse(raw) : raw;

    const ok = await comparePassword(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials.' });

    setSessionCookie(res, { uid: user.id });
    return res.status(200).json({ ok: true, user: publicUser(user) });
  } catch (err) {
    console.error('login error', err);
    return res.status(500).json({ error: 'Server error.' });
  }
}

async function logout(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  clearSessionCookie(res);
  if (req.method === 'GET') {
    res.writeHead(302, { Location: '/' });
    return res.end();
  }
  return res.status(200).json({ ok: true });
}

async function me(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const user = await getUser(req);
  if (!user) return res.status(200).json({ user: null });
  return res.status(200).json({ user });
}

async function discordStart(req, res) {
  const clientId = process.env.DISCORD_CLIENT_ID;
  const redirectUri = process.env.DISCORD_REDIRECT_URI;
  if (!clientId || !redirectUri) return res.status(500).send('Discord OAuth not configured.');

  const state = randomBytes(16).toString('base64url');
  const kv = getKv();
  if (kv) await kv.set(`oauth_state:${state}`, '1', { ex: 600 });

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'identify',
    state,
    prompt: 'consent',
  });

  res.writeHead(302, { Location: `https://discord.com/api/oauth2/authorize?${params}` });
  return res.end();
}

async function discordCallback(req, res) {
  if (rateLimit('disco:' + getIp(req), 10, 60_000)) return res.status(429).send('Too many requests.');

  const { code, state } = req.query;
  if (!code || !state) return res.status(400).send('Missing code or state.');

  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  const redirectUri = process.env.DISCORD_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) return res.status(500).send('Discord OAuth not configured.');

  const kv = getKv();
  if (!kv) return res.status(500).send('Storage not configured.');

  const stateOk = await kv.get(`oauth_state:${state}`);
  if (!stateOk) return res.status(400).send('Invalid or expired state.');
  await kv.del(`oauth_state:${state}`);

  try {
    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    });
    if (!tokenRes.ok) return res.status(400).send('Discord token exchange failed.');
    const tokenJson = await tokenRes.json();

    const userRes = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${tokenJson.access_token}` },
    });
    if (!userRes.ok) return res.status(400).send('Failed to fetch Discord user.');
    const dUser = await userRes.json();

    const discordId = dUser.id;
    const discordUsername = dUser.username;

    let userId = await kv.get(`discord:${discordId}`);
    let user;

    if (userId) {
      const raw = await kv.get(`user:${userId}`);
      user = typeof raw === 'string' ? JSON.parse(raw) : raw;
    } else {
      let baseUsername = normUsername(discordUsername);
      if (!/^[a-z0-9_.-]{3,24}$/i.test(baseUsername)) baseUsername = 'user' + discordId.slice(-6);
      let candidate = baseUsername;
      let n = 0;
      while (await kv.get(`username:${candidate}`)) {
        n++;
        candidate = (baseUsername + n).slice(0, 24);
        if (n > 50) { candidate = baseUsername + '_' + discordId.slice(-4); break; }
      }

      userId = newUserId();
      user = {
        id: userId,
        type: 'discord',
        username: candidate,
        displayUsername: discordUsername,
        discordId,
        discordUsername,
        avatar: dUser.avatar || null,
        orderTokens: [],
        createdAt: Date.now(),
      };

      await kv.set(`user:${userId}`, JSON.stringify(user));
      await kv.set(`username:${candidate}`, userId);
      await kv.set(`discord:${discordId}`, userId);
    }

    setSessionCookie(res, { uid: userId });
    res.writeHead(302, { Location: '/dashboard' });
    return res.end();
  } catch (err) {
    console.error('discord-callback error', err);
    return res.status(500).send('Discord login failed.');
  }
}
