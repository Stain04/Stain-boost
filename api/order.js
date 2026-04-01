import { createClient } from '@vercel/kv';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { discord, ign, rank, type, wins, flash, total } = req.body;

  if (!discord || !ign || !rank || !type || !wins) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK_URL;
  const EMAIL_TO        = process.env.EMAIL_TO;       
  const EMAIL_FROM      = process.env.EMAIL_FROM;     
  const EMAIL_PASS      = process.env.EMAIL_PASS;     

  const timestamp = new Date().toLocaleString('en-US', { timeZone: 'Africa/Cairo' });

  // ── 1. GENERATE SECURE TOKEN ──
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let t1 = '', t2 = '';
  for(let i=0; i<4; i++) t1 += chars.charAt(Math.floor(Math.random() * chars.length));
  for(let i=0; i<4; i++) t2 += chars.charAt(Math.floor(Math.random() * chars.length));
  const reviewToken = `SB-${t1}-${t2}`;

  // ── 2. SAVE TOKEN TO DATABASE ──
  const dbUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || process.env.STORAGE_REST_API_URL;
  const dbToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || process.env.STORAGE_REST_API_TOKEN;
  
  if (dbUrl && dbToken) {
    try {
      const kv = createClient({ url: dbUrl, token: dbToken });
      await kv.sadd('valid_tokens', reviewToken);
    } catch(e) {
      console.error('KV Database error:', e);
    }
  }

  // ── 3. DISCORD NOTIFICATION ──
  const discordPayload = {
    embeds: [{
      title: '⚡ New Boost Order',
      color: 0x8b5cf6,
      fields: [
        { name: '👤 Discord',    value: discord,                         inline: true  },
        { name: '🎮 LoL IGN',    value: ign,                             inline: true  },
        { name: '🏆 Rank',       value: rank,                            inline: true  },
        { name: '⚔️ Type',       value: type.charAt(0).toUpperCase() + type.slice(1), inline: true  },
        { name: '🎯 Wins',       value: String(wins),                    inline: true  },
        { name: '💰 Total',      value: `$${total}`,                     inline: true  },
        { name: '⚡ Flash Key',  value: flash || 'D',                    inline: true  },
        { name: '🔑 Review Token', value: `\`${reviewToken}\``,          inline: false }
      ],
      footer: { text: `Submitted at ${timestamp}` }
    }]
  };

  try {
    await fetch(DISCORD_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(discordPayload)
    });
  } catch (e) {
    console.error('Discord webhook failed:', e);
  }

  // ── 4. EMAIL NOTIFICATION ──
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
        subject: `⚡ New Order — ${rank} ${type} x${wins} wins ($${total})`,
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#0e0b1a;color:#e2e8f0;border-radius:16px;overflow:hidden;">
            <div style="background:linear-gradient(135deg,#7c3aed,#6d28d9);padding:20px 24px;">
              <h2 style="margin:0;color:#fff;font-size:20px;">⚡ New Boost Order</h2>
              <p style="margin:4px 0 0;color:rgba(255,255,255,0.7);font-size:13px;">${timestamp}</p>
            </div>
            <div style="padding:24px;">
              <table style="width:100%;border-collapse:collapse;">
                <tr><td style="padding:8px 0;color:rgba(255,255,255,0.45);font-size:13px;">Discord</td><td style="padding:8px 0;font-weight:600;">${discord}</td></tr>
                <tr><td style="padding:8px 0;color:rgba(255,255,255,0.45);font-size:13px;">LoL IGN</td><td style="padding:8px 0;font-weight:600;">${ign}</td></tr>
                <tr><td style="padding:8px 0;color:rgba(255,255,255,0.45);font-size:13px;">Rank</td><td style="padding:8px 0;font-weight:600;">${rank}</td></tr>
                <tr><td style="padding:8px 0;color:rgba(255,255,255,0.45);font-size:13px;">Type</td><td style="padding:8px 0;font-weight:600;">${type}</td></tr>
                <tr><td style="padding:8px 0;color:rgba(255,255,255,0.45);font-size:13px;">Wins</td><td style="padding:8px 0;font-weight:600;">${wins}</td></tr>
                <tr><td style="padding:8px 0;color:rgba(255,255,255,0.45);font-size:13px;">Review Token</td><td style="padding:8px 0;font-weight:600;color:#fbbf24;">${reviewToken}</td></tr>
                <tr style="border-top:1px solid rgba(255,255,255,0.1);">
                  <td style="padding:12px 0 0;color:rgba(255,255,255,0.45);font-size:13px;">Total</td>
                  <td style="padding:12px 0 0;font-weight:700;font-size:20px;color:#fbbf24;">$${total}</td>
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

  return res.status(200).json({ ok: true });
}
