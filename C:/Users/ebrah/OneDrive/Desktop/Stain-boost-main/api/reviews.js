import { createClient } from '@vercel/kv';
import { getUser, isAdmin } from '../lib/auth.js';

// Simple sanitizer — strip HTML tags, limit length
function sanitize(str, maxLen = 200) {
  if (typeof str !== 'string') return '';
  return str.replace(/[<>"'&]/g, '').trim().slice(0, maxLen);
}

const VALID_RANKS = [
  'Iron', 'Bronze', 'Silver', 'Gold', 'Platinum',
  'Emerald', 'Diamond IV-III', 'Diamond II-I', 'Masters'
];

export default async function handler(req, res) {
  const url   = process.env.UPSTASH_REDIS_REST_URL   || process.env.KV_REST_API_URL   || process.env.STORAGE_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || process.env.STORAGE_REST_API_TOKEN;

  if (!url || !token) {
    return res.status(500).json({
      error: `Missing Vercel Env Variables! URL exists: ${!!url}, Token exists: ${!!token}. You must REDEPLOY in Vercel.`
    });
  }

  const kv = createClient({ url, token });

  // ── GET ──
  if (req.method === 'GET') {
    // Token verification
    if (req.query.token) {
      const qToken = req.query.token.trim().toUpperCase().slice(0, 20);
      // Basic token format check
      if (!/^SB-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(qToken)) {
        return res.status(400).json({ error: 'Invalid token format.' });
      }
      try {
        const isValid = await kv.sismember('valid_tokens', qToken);
        if (!isValid) return res.status(400).json({ error: 'Invalid token. Check the code Stain sent you.' });

        const isUsed = await kv.sismember('used_tokens', qToken);
        if (isUsed) return res.status(400).json({ error: 'This token has already been used to post a review.' });

        return res.status(200).json({ ok: true });
      } catch (error) {
        return res.status(500).json({ error: 'DB Read Error: ' + error.message });
      }
    }

    // Fetch all reviews
    try {
      const reviews = await kv.lrange('stain_reviews', 0, -1) || [];
      return res.status(200).json(reviews);
    } catch (error) {
      return res.status(500).json({ error: 'Failed to fetch reviews: ' + error.message });
    }
  }

  // ── POST ──
  if (req.method === 'POST') {
    const { token: pToken, name, rank, stars, text, date } = req.body;

    if (!pToken || typeof pToken !== 'string') {
      return res.status(400).json({ error: 'Missing token.' });
    }

    const formattedToken = pToken.trim().toUpperCase().slice(0, 20);

    // Validate token format before hitting DB
    if (!/^SB-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(formattedToken)) {
      return res.status(400).json({ error: 'Invalid token format.' });
    }

    // Sanitize & validate all fields
    const cleanName  = sanitize(name, 60);
    const cleanRank  = sanitize(rank, 40);
    const cleanText  = sanitize(text, 500);
    const cleanStars = Math.max(1, Math.min(5, parseInt(stars, 10) || 5));
    const cleanDate  = sanitize(date, 30);

    if (!cleanName || !cleanText) {
      return res.status(400).json({ error: 'Name and review text are required.' });
    }

    if (cleanRank && !VALID_RANKS.some(r => cleanRank.includes(r.split(' ')[0]))) {
      return res.status(400).json({ error: 'Invalid rank value.' });
    }

    try {
      const isValid = await kv.sismember('valid_tokens', formattedToken);
      if (!isValid) return res.status(400).json({ error: 'Invalid token.' });

      const isUsed = await kv.sismember('used_tokens', formattedToken);
      if (isUsed) return res.status(400).json({ error: 'This order has already been reviewed.' });

      // Ownership: require a signed-in user who owns this order, or admin.
      const orderRaw = await kv.get(`order:${formattedToken}`);
      const order = orderRaw ? (typeof orderRaw === 'string' ? JSON.parse(orderRaw) : orderRaw) : null;
      const user = await getUser(req);
      if (!isAdmin(user)) {
        if (!user) return res.status(401).json({ error: 'Sign in to leave a review.' });
        if (!order || !order.userId || order.userId !== user.id) {
          return res.status(403).json({ error: 'This order is not on your account.' });
        }
        if (order.status !== 'completed') {
          return res.status(400).json({ error: 'You can only review a completed order.' });
        }
      }

      const newReview = {
        name:  cleanName,
        rank:  cleanRank,
        stars: cleanStars,
        text:  cleanText,
        date:  cleanDate || new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
      };

      await kv.lpush('stain_reviews', newReview);
      await kv.sadd('used_tokens', formattedToken);

      // Stamp the order so the track page knows the review link is consumed.
      if (order) {
        order.reviewedAt = Date.now();
        await kv.set(`order:${formattedToken}`, JSON.stringify(order));
      }

      return res.status(200).json({ ok: true });
    } catch (error) {
      return res.status(500).json({ error: 'DB Write Error: ' + error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
