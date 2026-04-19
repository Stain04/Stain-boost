import { createClient } from '@vercel/kv';
import { randomBytes } from 'crypto';

// ── Feed helpers ──
const FEED_BG = [
  'linear-gradient(135deg,#7c3aed,#06d6f2)',
  'linear-gradient(135deg,#34d399,#06d6f2)',
  'linear-gradient(135deg,#f97316,#f5a623)',
  'linear-gradient(135deg,#ec4899,#8b5cf6)',
  'linear-gradient(135deg,#0ea5e9,#22d3ee)',
  'linear-gradient(135deg,#a3e635,#22d3ee)',
];
function strHash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = Math.imul(31, h) + s.charCodeAt(i) | 0;
  return Math.abs(h);
}

// ── WIN BOOST — server-side price table (client-submitted `total` is ignored) ──
const WIN_PRICES = {
  'Iron':          { solo: 1.50, duo: 2.50  },
  'Bronze':        { solo: 2.00, duo: 3.00  },
  'Silver':        { solo: 2.50, duo: 3.50  },
  'Gold':          { solo: 3.50, duo: 5.00  },
  'Platinum':      { solo: 5.00, duo: 6.50  },
  'Emerald':       { solo: 5.50, duo: 8.00  },
  'Diamond IV-III':{ solo: 8.00, duo: 12.00 },
  'Diamond II-I':  { solo:10.00, duo: 16.00 },
  'Masters':       { solo:15.00, duo: 20.00 },
};

// ── VALID LP GAIN MULTIPLIERS (must match frontend options) ──
const VALID_LP_MULTIPLIERS = [1.0, 1.4, 2.0];

// ── COUPON CODES (single source of truth — also in validate-coupon.js) ──
const COUPONS = {
  // 'STAIN50': 0.50,  // disabled
};

// ── RANK BOOST — per-division price table ──
const RB_TIERS = ['Iron','Bronze','Silver','Gold','Platinum','Emerald','Diamond','Masters'];
const RB_DIV_PRICE = {
  Iron:     { solo: 7.00,  duo: 11.50 },
  Bronze:   { solo: 9.00,  duo: 14.00 },
  Silver:   { solo: 12.00, duo: 17.00 },
  Gold:     { solo: 16.50, duo: 23.50 },
  Platinum: { solo: 23.50, duo: 31.00 },
  Emerald:  { solo: 26.50, duo: 38.00 },
  DiamondL: { solo: 37.00, duo: 57.00 }, // Diamond IV-III
  DiamondH: { solo: 47.00, duo: 72.00 }, // Diamond II-I
};

function rbDivPrice(tierIdx, divIdx, type) {
  const name = RB_TIERS[tierIdx];
  if (name === 'Masters') return 0;
  let key = name;
  if (name === 'Diamond') key = divIdx <= 1 ? 'DiamondL' : 'DiamondH';
  const p = RB_DIV_PRICE[key];
  return type === 'solo' ? p.solo : p.duo;
}

function calcRankBoostTotal(fromTier, fromDiv, toTier, toDiv, type) {
  const from = fromTier === 7 ? 28 : fromTier * 4 + fromDiv;
  const to   = toTier   === 7 ? 28 : toTier   * 4 + toDiv;
  if (to <= from) return 0;
  let total = 0;
  for (let d = from; d < to; d++) {
    const t  = Math.min(Math.floor(d / 4), 7);
    const dv = d % 4;
    total += rbDivPrice(t, dv, type);
  }
  return total;
}

// ── SANITIZER ──
function sanitize(str, maxLen = 100) {
  if (typeof str !== 'string') return '';
  return str.replace(/[<>"'&]/g, '').trim().slice(0, maxLen);
}

// ── IN-MEMORY RATE LIMITING — max 5 requests per IP per 60s ──
const rateLimitMap = new Map();
function isRateLimited(ip) {
  const now = Date.now();
  const WINDOW = 60_000;
  const MAX = 5;
  const entry = rateLimitMap.get(ip) || { count: 0, reset: now + WINDOW };
  if (now > entry.reset) {
    rateLimitMap.set(ip, { count: 1, reset: now + WINDOW });
    return false;
  }
  if (entry.count >= MAX) return true;
  entry.count++;
  rateLimitMap.set(ip, entry);
  return false;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
  if (isRateLimited(ip)) {
    return res.status(429).json({ error: 'Too many requests. Please wait a minute and try again.' });
  }

  const { discord, ign, type, flash, orderType } = req.body;

  const cleanDiscord = sanitize(discord, 80);
  const cleanIgn     = sanitize(ign, 60);
  const cleanType    = type === 'duo' ? 'duo' : 'solo';
  const cleanFlash   = flash === 'F' ? 'F' : 'D';

  if (!cleanDiscord || !cleanIgn) {
    return res.status(400).json({ error: 'Missing Discord tag or IGN.' });
  }

  // ── LP GAIN MULTIPLIER — validate against whitelist ──
  const rawMultiplier = parseFloat(req.body.lpGainMultiplier);
  const cleanLPGain = VALID_LP_MULTIPLIERS.includes(rawMultiplier) ? rawMultiplier : 1.0;

  // ── COUPON CODE — validate server-side ──
  const rawCoupon = sanitize(req.body.couponCode || '', 30).toUpperCase();
  const couponDiscount = COUPONS[rawCoupon] || 0;

  let computedTotal, orderSummary, toastAction;
  const RB_DIVS = ['IV', 'III', 'II', 'I'];

  if (orderType === 'rank_boost') {
    const ft = parseInt(req.body.fromTier, 10);
    const fd = parseInt(req.body.fromDiv,  10);
    const tt = parseInt(req.body.toTier,   10);
    const td = parseInt(req.body.toDiv,    10);

    if ([ft, fd, tt, td].some(isNaN) ||
        ft < 0 || ft > 7 || fd < 0 || fd > 3 ||
        tt < 0 || tt > 7 || td < 0 || td > 3) {
      return res.status(400).json({ error: 'Invalid rank range.' });
    }

    const baseTotal = calcRankBoostTotal(ft, fd, tt, td, cleanType);
    if (baseTotal <= 0) {
      return res.status(400).json({ error: 'Destination rank must be higher than current rank.' });
    }

    // Apply LP gain multiplier then coupon discount
    const total = baseTotal * cleanLPGain * (1 - couponDiscount);
    computedTotal = total.toFixed(2);
    const fromName = RB_TIERS[ft] + (ft < 7 ? ' ' + RB_DIVS[fd] : '');
    const toName   = RB_TIERS[tt] + (tt < 7 ? ' ' + RB_DIVS[td] : '');
    const lpGainLabel = cleanLPGain === 2.0 ? ' · Very Low LP gain' : cleanLPGain === 1.4 ? ' · Low LP gain' : '';
    const couponLabel = couponDiscount > 0 ? ` · ${Math.round(couponDiscount*100)}% coupon` : '';
    orderSummary = `Rank Boost: ${fromName} → ${toName} · ${cleanType}${lpGainLabel}${couponLabel}`;
    toastAction  = `just went from <strong>${fromName} → ${toName}</strong>`;

  } else {
    // win_boost (default)
    const cleanRank = sanitize(req.body.rank, 40);
    const cleanWins = Math.max(1, Math.min(30, parseInt(req.body.wins, 10) || 0));

    if (!cleanRank || !cleanWins) {
      return res.status(400).json({ error: 'Missing rank or wins.' });
    }
    if (!WIN_PRICES[cleanRank]) {
      return res.status(400).json({ error: 'Invalid rank selected.' });
    }

    const pricePerWin  = WIN_PRICES[cleanRank][cleanType];
    const freeWins     = Math.floor(cleanWins / 5);
    const chargedWins  = cleanWins - freeWins;
    const baseWinTotal = chargedWins * pricePerWin;
    // Apply coupon discount (LP gain multiplier doesn't apply to win boost)
    computedTotal = (baseWinTotal * (1 - couponDiscount)).toFixed(2);
    const couponLabel = couponDiscount > 0 ? ` · ${Math.round(couponDiscount*100)}% coupon` : '';
    orderSummary = `Win Boost: ${cleanRank} · ${cleanWins} wins (+${freeWins} free) · ${cleanType}${couponLabel}`;
    toastAction  = `just ordered <strong>${cleanWins} win boost</strong>`;
  }

  // ── GENERATE SECURE REVIEW TOKEN ──
  const buf = randomBytes(6);
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

      // ── Push anonymised entry to activity feed ──
      const maskedName = cleanIgn.slice(0, 2) + '***' + cleanIgn.slice(-1);
      const feedEntry = JSON.stringify({
        initials: cleanIgn.slice(0, 2).toUpperCase(),
        bg:       FEED_BG[strHash(cleanIgn) % FEED_BG.length],
        name:     maskedName,
        action:   toastAction,
        ts:       Date.now(),
      });
      await kv.lpush('order_feed', feedEntry);
      await kv.ltrim('order_feed', 0, 19); // keep last 20

      // ── Decrement weekly slots counter ──
      const currentWeek = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000));
      const storedWeek  = await kv.get('slots_week');
      if (storedWeek !== currentWeek) {
        await kv.set('slots_week',  currentWeek);
        await kv.set('slots_count', Math.max(0, 5 - 1));
      } else {
        const current = await kv.get('slots_count') ?? 5;
        await kv.set('slots_count', Math.max(0, current - 1));
      }
    } catch (e) {
      console.error('KV Database error:', e);
    }
  }

  // ── DISCORD NOTIFICATION ──
  const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK_URL;
  if (DISCORD_WEBHOOK) {
    const fields = [
      { name: '👤 Discord',      value: cleanDiscord,                                           inline: true  },
      { name: '🎮 LoL IGN',      value: cleanIgn,                                               inline: true  },
      { name: '⚔️ Type',         value: cleanType.charAt(0).toUpperCase() + cleanType.slice(1), inline: true  },
      { name: '💰 Total',        value: `$${computedTotal}`,                                    inline: true  },
      { name: '⚡ Flash Key',    value: cleanFlash,                                             inline: true  },
      { name: '📋 Order',        value: orderSummary,                                           inline: false },
      { name: '🔑 Review Token', value: `\`${reviewToken}\``,                                   inline: false },
    ];
    try {
      await fetch(DISCORD_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          embeds: [{ title: '⚡ New Boost Order', color: 0x8b5cf6, fields, footer: { text: `Submitted at ${timestamp}` } }]
        })
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
        subject: `⚡ New Order — ${orderSummary} ($${computedTotal})`,
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
                <tr><td style="padding:8px 0;color:rgba(255,255,255,0.45);font-size:13px;">Type</td><td style="padding:8px 0;font-weight:600;">${cleanType}</td></tr>
                <tr><td style="padding:8px 0;color:rgba(255,255,255,0.45);font-size:13px;">Order</td><td style="padding:8px 0;font-weight:600;">${orderSummary}</td></tr>
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
