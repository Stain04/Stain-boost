import { createClient } from '@vercel/kv';

// Manually connect using the "STORAGE" prefix you created
const kv = createClient({
  url: process.env.STORAGE_REST_API_URL,
  token: process.env.STORAGE_REST_API_TOKEN,
});

export default async function handler(req, res) {
  // GET requests
  if (req.method === 'GET') {
    // 1. Verify a token
    if (req.query.token) {
      const token = req.query.token.trim().toUpperCase();
      
      try {
        const isValid = await kv.sismember('valid_tokens', token);
        if (!isValid) {
          return res.status(400).json({ error: 'Invalid token. Check the code Stain sent you.' });
        }

        const isUsed = await kv.sismember('used_tokens', token);
        if (isUsed) {
          return res.status(400).json({ error: 'This token has already been used to post a review.' });
        }

        return res.status(200).json({ ok: true });
      } catch (error) {
        console.error("DB Error:", error);
        return res.status(500).json({ error: 'Database connection error' });
      }
    }

    // 2. Fetch all reviews
    try {
      const reviews = await kv.lrange('stain_reviews', 0, -1) || [];
      return res.status(200).json(reviews);
    } catch (error) {
      console.error("DB Error:", error);
      return res.status(500).json({ error: 'Failed to fetch reviews' });
    }
  }

  // POST: Submit a new review
  if (req.method === 'POST') {
    const { token, name, rank, stars, text, date } = req.body;
    const formattedToken = token.trim().toUpperCase();

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
      return res.status(500).json({ error: 'Database error while saving review' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
