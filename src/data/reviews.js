// Verified reviews only: posted by buyers from a completed order (/review/<token>).
// At build time the live list is fetched from the production API so new reviews
// appear on every deploy; this file is the fallback if that request fails.
export const VERIFIED_REVIEWS = [
  { name: 'Dave', rank: 'Gold', stars: 5, date: 'Apr 2026', text: 'This is by far the best boost experience Ive got, thanks stain :)' },
  { name: 'Tom', rank: 'Bronze I → Platinum IV', stars: 5, date: 'Apr 2026', text: 'Stain, is a good yi player, i enjoin those duo games with him was fun, and we had some werid matchups but we manage to win all 🙂 Zepon' },
  { name: 'rapidis soulis', rank: 'Gold IV → Platinum IV', stars: 5, date: 'May 2026', text: 'stain was very friendly booster helped a lot. Also the site is easy and fast too use' },
  { name: 'Kitan', rank: 'Silver IV → Emerald II', stars: 5, date: 'May 2026', text: 'This is by far the best Yi player Ive ever seen, wp my g' },
];

const LIVE_URL = 'https://www.stainboost.com/api/reviews';
let cache;

/** Verified reviews, newest list from production when reachable. */
export async function getVerifiedReviews() {
  if (cache) return cache;
  try {
    const res = await fetch(LIVE_URL, { signal: AbortSignal.timeout(4000) });
    if (res.ok) {
      const list = (await res.json()).filter((r) => r && r.name && r.text)
        .map((r) => ({ name: String(r.name), rank: String(r.rank || ''), stars: Math.max(1, Math.min(5, parseInt(r.stars, 10) || 5)), date: String(r.date || ''), text: String(r.text) }));
      if (list.length) return (cache = list);
    }
  } catch { /* offline build: use the fallback */ }
  return (cache = VERIFIED_REVIEWS);
}

export function ratingSummary(reviews) {
  const counts = [0, 0, 0, 0, 0, 0];
  reviews.forEach((r) => counts[r.stars]++);
  const avg = reviews.reduce((a, r) => a + r.stars, 0) / (reviews.length || 1);
  return { count: reviews.length, avg: Math.round(avg * 10) / 10, counts };
}
