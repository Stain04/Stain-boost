import { getKv, setSessionCookie, newUserId, normUsername, rateLimit, getIp } from '../../lib/auth.js';

export default async function handler(req, res) {
  if (rateLimit('disco:' + getIp(req), 10, 60_000)) return res.status(429).send('Too many requests.');

  const { code, state } = req.query;
  if (!code || !state) return res.status(400).send('Missing code or state.');

  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  const redirectUri = process.env.DISCORD_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) return res.status(500).send('Discord OAuth not configured.');

  const kv = getKv();
  if (!kv) return res.status(500).send('Storage not configured.');

  // Verify state
  const stateOk = await kv.get(`oauth_state:${state}`);
  if (!stateOk) return res.status(400).send('Invalid or expired state.');
  await kv.del(`oauth_state:${state}`);

  try {
    // Exchange code for token
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

    // Fetch user
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
      // Create a new account.
      // Try to claim the discord username as a site username; fall back to a suffix on collision.
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
