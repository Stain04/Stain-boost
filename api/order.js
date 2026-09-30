import { randomBytes } from 'crypto';
import { getUser, getKv } from './_lib/auth.js';
import {
  WIN_PRICES, VALID_LP_GAIN, VALID_CURRENT_LP, LP_OPTIONS, MAX_WINS, REFERRAL_RATE,
  rankPosition, rankName, freeWins as freeWinsFor, quoteOrder, bonusWinPrice,
} from '../src/data/pricing.js';

// Prices and price math live in src/data/pricing.js (shared with the pricing page).
// The client-submitted total is never trusted: the total is computed here. If the page
// sends `expectedTotal` and it doesn't match, the order is refused (409) so a customer
// can never be charged a different price from the one they saw.

// LP bracket shown to Stain in the order summary
function lpLabel(lp) {
  if (lp === 10) return '0-20 LP';
  const o = LP_OPTIONS.find(x => x.value === lp);
  return o ? o.label.replace('–', '-') : '';
}

function sanitize(str, maxLen = 100) {
  if (typeof str !== 'string') return '';
  return str.replace(/[<>"'&]/g, '').trim().slice(0, maxLen);
}
const parseRecord = (raw) => (raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : null);

// ── IN-MEMORY RATE LIMITING — max 5 requests per IP per 60s ──
const rateLimitMap = new Map();
function isRateLimited(ip) {
  const now = Date.now();
  const entry = rateLimitMap.get(ip) || { count: 0, reset: now + 60_000 };
  if (now > entry.reset) { rateLimitMap.set(ip, { count: 1, reset: now + 60_000 }); return false; }
  if (entry.count >= 5) return true;
  entry.count++;
  rateLimitMap.set(ip, entry);
  return false;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
  if (isRateLimited(ip)) return res.status(429).json({ error: 'Too many requests. Please wait a minute and try again.' });

  const authUser = await getUser(req);
  if (!authUser) return res.status(401).json({ error: 'You must be signed in to place an order.', requireLogin: true });

  const body = req.body || {};
  const cleanDiscord = sanitize(body.discord, 80);
  const cleanIgn     = sanitize(body.ign, 60);
  const cleanType    = body.type === 'duo' ? 'duo' : 'solo';
  const cleanFlash   = body.flash === 'F' ? 'F' : 'D';
  if (!cleanDiscord || !cleanIgn) return res.status(400).json({ error: 'Missing Discord tag or IGN.' });

  const kv = getKv();
  const userRecord = kv ? parseRecord(await kv.get(`user:${authUser.id}`)) : null;

  // ── What is being ordered ──
  let q, orderSummary, orderMeta;
  const extras = { priority: body.priority === true, bonusWin: body.bonusWin === true };

  // ── Referral code: 20% off the friend's first order ──
  let referral = null;
  const code = sanitize(body.referralCode || '', 20).toUpperCase();
  if (code && kv) {
    const referrerId = await kv.get(`refcode:${code}`);
    const firstOrder = !(userRecord?.orderTokens || []).length && !userRecord?.referredBy;
    if (!referrerId) return res.status(400).json({ error: 'That referral code doesn\'t exist.', referralInvalid: true });
    if (String(referrerId) === authUser.id) return res.status(400).json({ error: 'You can\'t use your own referral code.', referralInvalid: true });
    if (!firstOrder) return res.status(400).json({ error: 'Referral codes are for a first order only.', referralInvalid: true });
    referral = { code, referrerId: String(referrerId) };
  }
  const availableCredit = Math.max(0, Number(userRecord?.credit) || 0);

  if (body.orderType === 'rank_boost') {
    const ft = parseInt(body.fromTier, 10), fd = parseInt(body.fromDiv, 10);
    const tt = parseInt(body.toTier, 10), td = parseInt(body.toDiv, 10);
    if ([ft, fd, tt, td].some(isNaN) || ft < 0 || ft > 7 || fd < 0 || fd > 3 || tt < 0 || tt > 7 || td < 0 || td > 3) {
      return res.status(400).json({ error: 'Invalid rank range.' });
    }
    if (rankPosition(tt, td) <= rankPosition(ft, fd)) return res.status(400).json({ error: 'Destination rank must be higher than current rank.' });
    const rawLP = parseInt(body.currentLP, 10);
    const cleanLP = VALID_CURRENT_LP.includes(rawLP) ? rawLP : 0;
    const rawGain = parseFloat(body.lpGainMultiplier);
    const cleanLPGain = VALID_LP_GAIN.includes(rawGain) ? rawGain : 1.0;
    if (extras.bonusWin && bonusWinPrice(tt) === null) extras.bonusWin = false; // not offered for Masters

    q = quoteOrder({ mode: 'rank', type: cleanType, fromTier: ft, fromDiv: fd, toTier: tt, toDiv: td, lp: cleanLP, lpGain: cleanLPGain, ...extras, referral: !!referral, credit: availableCredit });
    const fromName = rankName(ft, fd), toName = rankName(tt, td);
    const lpGainLabel = cleanLPGain === 2.0 ? ' · Very Low LP gain' : cleanLPGain === 1.4 ? ' · Low LP gain' : '';
    const lpText = cleanLP > 0 ? ` (${lpLabel(cleanLP)})` : '';
    orderSummary = `Rank Boost: ${fromName}${lpText} → ${toName}${extras.bonusWin ? ' + 1 bonus win' : ''} · ${cleanType}${lpGainLabel}`;
    orderMeta = { kind: 'rank_boost', from: fromName, to: toName, lpGain: cleanLPGain, currentLP: cleanLP };
  } else {
    const cleanRank = sanitize(body.rank, 40);
    const cleanWins = Math.max(1, Math.min(MAX_WINS, parseInt(body.wins, 10) || 0));
    if (!WIN_PRICES[cleanRank]) return res.status(400).json({ error: 'Invalid rank selected.' });
    extras.bonusWin = false; // bonus win is a rank boost extra
    // Pay for 5, get 6: `wins` = wins paid for; every 5 paid earn 1 free; Stain plays paid + free.
    const freeWins = freeWinsFor(cleanWins);
    const totalWins = cleanWins + freeWins;
    q = quoteOrder({ mode: 'wins', type: cleanType, rank: cleanRank, wins: cleanWins, ...extras, referral: !!referral, credit: availableCredit });
    const winsLabel = freeWins > 0 ? `${totalWins} net wins (${cleanWins} paid + ${freeWins} free)` : `${cleanWins} net win${cleanWins !== 1 ? 's' : ''}`;
    orderSummary = `Win Boost: ${cleanRank} · ${winsLabel} · ${cleanType}`;
    // `wins` = total wins Stain plays (drives the tracker progress bar and the admin cap)
    orderMeta = { kind: 'win_boost', rank: cleanRank, wins: totalWins, paidWins: cleanWins, freeWins, winsDone: 0 };
  }

  if (extras.priority) orderSummary += ' · ⚡ PRIORITY';
  if (referral) orderSummary += ` · ${Math.round(REFERRAL_RATE * 100)}% referral (${referral.code})`;
  if (q.credit > 0) orderSummary += ` · $${q.credit.toFixed(2)} credit used`;
  const computedTotal = q.total.toFixed(2);
  orderMeta.extras = extras;
  orderMeta.price = q;

  // Charged must equal shown: refuse if the page showed something else (compared in cents, so "25", 25 and "25.00" all match).
  const expectedCents = Math.round(Number(body.expectedTotal) * 100);
  if (body.expectedTotal != null && !(expectedCents === Math.round(Number(computedTotal) * 100))) {
    return res.status(409).json({ error: `The price changed to $${computedTotal}. Check the new total and place the order again.`, total: computedTotal, priceChanged: true });
  }

  // ── Order token (also used for the review link) ──
  const buf = randomBytes(8);
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let t1 = '', t2 = '';
  for (let i = 0; i < 4; i++) t1 += chars[buf[i] % chars.length];
  for (let i = 4; i < 8; i++) t2 += chars[buf[i] % chars.length];
  const reviewToken = `SB-${t1}-${t2}`;
  const timestamp = new Date().toLocaleString('en-US', { timeZone: 'Africa/Cairo' });

  if (kv) {
    try {
      await kv.sadd('valid_tokens', reviewToken);
      const orderRecord = {
        token: reviewToken,
        status: 'awaiting_payment',
        meta: orderMeta,
        summary: orderSummary,
        total: computedTotal,
        type: cleanType,
        flash: cleanFlash,
        ign: cleanIgn,
        discord: cleanDiscord,
        userId: authUser.id,
        referral: referral ? { ...referral, credited: 0 } : null,
        creditUsed: q.credit,
        currentRank: '',
        currentLp: 0,
        eta: '',
        games: [],
        notes: [{ from: 'system', text: 'Order received. Payment is awaiting verification before the boost is queued.', ts: Date.now() }],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await kv.set(`order:${reviewToken}`, JSON.stringify(orderRecord));
      await kv.expire(`order:${reviewToken}`, 60 * 60 * 24 * 90); // 90 days

      if (userRecord) {
        userRecord.orderTokens = Array.isArray(userRecord.orderTokens) ? userRecord.orderTokens : [];
        userRecord.orderTokens.unshift(reviewToken);
        if (userRecord.orderTokens.length > 200) userRecord.orderTokens = userRecord.orderTokens.slice(0, 200);
        if (referral) userRecord.referredBy = referral.referrerId;
        if (q.credit > 0) userRecord.credit = Math.round((availableCredit - q.credit) * 100) / 100;
        await kv.set(`user:${authUser.id}`, JSON.stringify(userRecord));
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
        body: JSON.stringify({ embeds: [{ title: extras.priority ? '⚡ New PRIORITY Boost Order' : '⚡ New Boost Order', color: extras.priority ? 0xf5a623 : 0x8b5cf6, fields, footer: { text: `Submitted at ${timestamp}` } }] }),
      });
    } catch (e) {
      console.error('Discord webhook failed:', e);
    }
  }

  // ── EMAIL NOTIFICATION ──
  const { EMAIL_TO, EMAIL_FROM, EMAIL_PASS } = process.env;
  if (EMAIL_FROM && EMAIL_PASS && EMAIL_TO) {
    try {
      const nodemailer = await import('nodemailer');
      const transporter = nodemailer.default.createTransport({ service: 'gmail', auth: { user: EMAIL_FROM, pass: EMAIL_PASS } });
      const row = (k, v, extra = '') => `<tr><td style="padding:8px 0;color:rgba(255,255,255,0.45);font-size:13px;">${k}</td><td style="padding:8px 0;font-weight:600;${extra}">${v}</td></tr>`;
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
                ${row('Discord', cleanDiscord)}${row('LoL IGN', cleanIgn)}${row('Type', cleanType)}${row('Order', orderSummary)}${row('Flash Key', cleanFlash)}${row('Review Token', reviewToken, 'color:#fbbf24;')}
                <tr style="border-top:1px solid rgba(255,255,255,0.1);">
                  <td style="padding:12px 0 0;color:rgba(255,255,255,0.45);font-size:13px;">Total (Server-Calc)</td>
                  <td style="padding:12px 0 0;font-weight:700;font-size:20px;color:#fbbf24;">$${computedTotal}</td>
                </tr>
              </table>
            </div>
          </div>`,
      });
    } catch (e) {
      console.error('Email failed:', e);
    }
  }

  return res.status(200).json({ ok: true, total: computedTotal, token: reviewToken, price: q });
}
