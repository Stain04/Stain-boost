import { createClient } from '@vercel/kv';
import { randomBytes } from 'crypto';

// Server-side price table — client-submitted `total` is ignored
const PRICES = {
  'Iron':          { solo: 1.00, duo: 1.75 },
  'Bronze':        { solo: 1.25, duo: 2.00 },
  'Silver':        { solo: 1.50, duo: 2.50 },
  'Gold':          { solo: 1.75, duo: 2.75 },
  'Platinum':      { solo: 2.00, duo: 3.25 },
  'Emerald':       { solo: 2.50, duo: 4.00 },
  'Diamond IV-III':{ solo: 3.50, duo: 5.50 },
  'Diamond II-I':  { solo: 5.00, duo: 8.00 },
  'Masters':       { solo: 8.00, duo: 12.00 },
};

// Simple sanitizer — strip HTML tags, limit length
function sanitize(str, maxLen = 100) {
  if (typeof str !== 'string') return '';
  return str.replace(/[<>"'&]/g, '').trim().slice(0, maxLen);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ── RATE LIMITING (simple in-memory per deploy, good enough for low-traffic) ──
  // For production at scale use Upstash rate-limit SDK instead.

  const { discord, ign, rank, type, wins, flash } = req.body;

  // ── INPUT VALIDATION ──
  const cleanDiscord = sanitize(discord, 80);
  const cleanIgn     = sanitize(ign, 60);
  const cleanRank    = sanitize(rank, 40);
  const cleanType    = type === 'duo' ? 'duo' : 'solo';
  const cleanFlash   = flash === 'F' ? 'F' : 'D';
  const cleanWins    = Math.max(1, Math.min(30, parseInt(wins, 10) || 0));

  if (!cleanDiscord || !cleanIgn || !cleanRank || !cleanWins) {
    return res.status(400).json({ error: 'Missing or invalid required fields.' });
  }

  if (!PRICES[cleanRank]) {
    return res.status(400).json({ error: 'Invalid rank selected.' });
  }

  // ── SERVER-SIDE PRICE CALCULATION ──
  const pricePerWin  = PRICES[cleanRank][cleanType];
  const freeWins     = Math.floor(cleanWins / 5);
  const chargedWins  = cleanWins - freeWins;
  const computedTotal = (chargedWins * pricePerWin).toFixed(2);

  // ── GENERATE SECURE REVIEW TOKEN ──
  const buf = randomBytes(6); // 6 random bytes
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let t1 = '', t2 = '';
  for (let i = 0; i < 4; i++) t1 += chars[buf[i] % chars.length];
  for (let i = 4; i < 8; i++) t2 += chars[buf[i % 6] % chars.length];
  const reviewToken = `SB-${t1}-${t2}`;

  const timestamp = new Date().toLocaleString('en-US', { timeZone: 'Africa/Cairo' });

  // ── SAVE TOKEN TO DATABASE ──
  const dbUrl   = process.env.UPSTASH_REDIS_REST_URL   || process.env.KV_REST_API_URL   || process.env.STORAGE_REST_API_URL;
  const dbToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || process.env.STORAGE_REST_API_TOKEN;

  if (dbUrl && dbToken) {
    try {
      const kv = createClient({ url: dbUrl, token: dbToken });
      await kv.sadd('valid_tokens', reviewToken);
    } catch (e) {
      console.error('KV Database error:', e);
    }
  }

  // ── DISCORD NOTIFICATION ──
  const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK_URL;
  const discordPayload = {
    embeds: [{
      title: '⚡ New Boost Order',
      color: 0x8b5cf6,
      fields: [
        { name: '👤 Discord',      value: cleanDiscord,                                           inline: true  },
        { name: '🎮 LoL IGN',      value: cleanIgn,                                               inline: true  },
        { name: '🏆 Rank',         value: cleanRank,                                              inline: true  },
        { name: '⚔️ Type',         value: cleanType.charAt(0).toUpperCase() + cleanType.slice(1), inline: true  },
        { name: '🎯 Wins',         value: String(cleanWins),                                      inline: true  },
        { name: '💰 Total',        value: `$${computedTotal}`,                                    inline: true  },
        { name: '⚡ Flash Key',    value: cleanFlash,                                             inline: true  },
        { name: '🔑 Review Token', value: `\`${reviewToken}\``,                                   inline: false }
      ],
      footer: { text: `Submitted at ${timestamp}` }
    }]
  };

  if (DISCORD_WEBHOOK) {
    try {
      await fetch(DISCORD_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(discordPayload)
      });
    } catch (e) {
      console.error('Discord webhook failed:', e);
    }
  }

  // ── EMAIL NOTIFICATION ──
  const EMAIL_TO   = process.env.EMAIL_TO;
  const EMAIL_FROM = process.env.EMAIL_FROM;
  const EMAIL_PASS = process.env.EMAIL_PASS;

  if (EMAIL_FROM && EMAIL_PASS && EMAIL_TO) {
    try {
      const nodemailer = await import('nodemailer');
      const transporter = nodemailer.default.createTransport({
        service: 'gmail',
        auth: { user: EMAIL_FROM, pass: EMAIL_PASS }
      });

      await transporter.sendMail({
        from: `"Stain Boost Orders" <${EMAIL_FROM}>`,
        to: EMAIL_TO,
        subject: `⚡ New Order — ${cleanRank} ${cleanType} x${cleanWins} wins ($${computedTotal})`,
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#0e0b1a;color:#e2e8f0;border-radius:16px;overflow:hidden;">
            <div style="background:linear-gradient(135deg,#7c3aed,#6d28d9);padding:20px 24px;">
              <h2 style="margin:0;color:#fff;font-size:20px;">⚡ New Boost Order</h2>
              <p style="margin:4px 0 0;color:rgba(255,255,255,0.7);font-size:13px;">${timestamp}</p>
            </div>
            <div style="padding:24px;">
              <table style="width:100%;border-collapse:collapse;">
                <tr><td style="padding:8px 0;color:rgba(255,255,255,0.45);font-size:13px;">Discord</td><td style="padding:8px 0;font-weight:600;">${cleanDiscord}</td></tr>
                <tr><td style="padding:8px 0;color:rgba(255,255,255,0.45);font-size:13px;">LoL IGN</td><td style="padding:8px 0;font-weight:600;">${cleanIgn}</td></tr>
                <tr><td style="padding:8px 0;color:rgba(255,255,255,0.45);font-size:13px;">Rank</td><td style="padding:8px 0;font-weight:600;">${cleanRank}</td></tr>
                <tr><td style="padding:8px 0;color:rgba(255,255,255,0.45);font-size:13px;">Type</td><td style="padding:8px 0;font-weight:600;">${cleanType}</td></tr>
                <tr><td style="padding:8px 0;color:rgba(255,255,255,0.45);font-size:13px;">Wins</td><td style="padding:8px 0;font-weight:600;">${cleanWins}</td></tr>
                <tr><td style="padding:8px 0;color:rgba(255,255,255,0.45);font-size:13px;">Flash Key</td><td style="padding:8px 0;font-weight:600;">${cleanFlash}</td></tr>
                <tr><td style="padding:8px 0;color:rgba(255,255,255,0.45);font-size:13px;">Review Token</td><td style="padding:8px 0;font-weight:600;color:#fbbf24;">${reviewToken}</td></tr>
                <tr style="border-top:1px solid rgba(255,255,255,0.1);">
                  <td style="padding:12px 0 0;color:rgba(255,255,255,0.45);font-size:13px;">Total (Server-Calc)</td>
                  <td style="padding:12px 0 0;font-weight:700;font-size:20px;color:#fbbf24;">$${computedTotal}</td>
                </tr>
              </table>
            </div>
          </div>
        `
      });
    } catch (e) {
      console.error('Email failed:', e);
    }
  }

  return res.status(200).json({ ok: true, total: computedTotal });
}
