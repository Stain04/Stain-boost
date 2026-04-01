import { createClient } from '@vercel/kv';

export default async function handler(req, res) {
  // Automatically grab whichever name Vercel decided to use
  const url = process.env.KV_REST_API_URL || process.env.STORAGE_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.STORAGE_REST_API_TOKEN;

  // Diagnostic Check
  if (!url || !token) {
    return res.status(500).json({ 
      error: `Missing Vercel Env Variables! URL exists: ${!!url}, Token exists: ${!!token}. You must REDEPLOY in Vercel.` 
    });
  }

  // Connect to the DB
  const kv = createClient({ url, token });

  // GET requests (Verify tokens or fetch reviews)
  if (req.method === 'GET') {
    if (req.query.token) {
      const qToken = req.query.token.trim().toUpperCase();
      try {
        const isValid = await kv.sismember('valid_tokens', qToken);
        if (!isValid) {
          return res.status(400).json({ error: 'Invalid token. Check the code Stain sent you.' });
        }

        const isUsed = await kv.sismember('used_tokens', qToken);
        if (isUsed) {
          return res.status(400).json({ error: 'This token has already been used to post a review.' });
        }

        return res.status(200).json({ ok: true });
      } catch (error) {
        return res.status(500).json({ error: 'DB Read Error: ' + error.message });
      }
    }

    try {
      const reviews = await kv.lrange('stain_reviews', 0, -1) || [];
      return res.status(200).json(reviews);
    } catch (error) {
      return res.status(500).json({ error: 'Failed to fetch reviews: ' + error.message });
    }
  }

  // POST: Submit a new review
  if (req.method === 'POST') {
    const { token: pToken, name, rank, stars, text, date } = req.body;
    const formattedToken = pToken.trim().toUpperCase();

    try {
      const isValid = await kv.sismember('valid_tokens', formattedToken);
      if (!isValid) return res.status(400).json({ error: 'Invalid token.' });

      const isUsed = await kv.sismember('used_tokens', formattedToken);
      if (isUsed) return res.status(400).json({ error: 'Token already used.' });

      const newReview = { name, rank, stars, text, date };
      await kv.lpush('stain_reviews', newReview);
      await kv.sadd('used_tokens', formattedToken);

      return res.status(200).json({ ok: true });
    } catch (error) {
      return res.status(500).json({ error: 'DB Write Error: ' + error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
