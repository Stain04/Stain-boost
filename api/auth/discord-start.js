import { randomBytes } from 'crypto';
import { getKv } from '../../lib/auth.js';

export default async function handler(req, res) {
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
