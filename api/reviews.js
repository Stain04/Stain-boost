import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  // GET: Fetch all reviews to display on the page
  if (req.method === 'GET') {
    try {
      const reviews = await kv.lrange('stain_reviews', 0, -1) || [];
      return res.status(200).json(reviews);
    } catch (error) {
      return res.status(500).json({ error: 'Failed to fetch reviews' });
    }
  }

  // POST: Submit a new review
  if (req.method === 'POST') {
    const { token, name, rank, stars, text, date } = req.body;
    const formattedToken = token.trim().toUpperCase();

    try {
      // 1. Check if token exists in the database
      const isValid = await kv.sismember('valid_tokens', formattedToken);
      if (!isValid) {
        return res.status(400).json({ error: 'Invalid token. This token does not exist.' });
      }

      // 2. Check if token was already used
      const isUsed = await kv.sismember('used_tokens', formattedToken);
      if (isUsed) {
        return res.status(400).json({ error: 'Token has already been used to post a review.' });
      }

      // 3. Save the review to the list
      const newReview = { name, rank, stars, text, date };
      await kv.lpush('stain_reviews', newReview);

      // 4. Mark the token as used
      await kv.sadd('used_tokens', formattedToken);

      return res.status(200).json({ ok: true });
    } catch (error) {
      return res.status(500).json({ error: 'Database error while saving review' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}