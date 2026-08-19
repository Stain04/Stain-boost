// ── /api/chat — AI live chat proxy (keeps GROQ_API_KEY server-side only) ──
// The widget calls this route; this route calls Groq. The key never reaches the browser.

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const MODEL = 'openai/gpt-oss-120b'; // see console.groq.com/docs/models for current options

const SYSTEM_PROMPT = `You are the site assistant for StainBoost (stainboost.com), a League of Legends
ELO boosting service on the Middle East server, run personally by Stain — ranked #1
Master Yi on the ME server with 500+ completed orders and zero bans.

WHAT WE OFFER:
- Solo boost: Stain logs into the customer's account and plays for them (offline mode on, so friends can't tell). Requires sharing login credentials, used only to log in and never stored.
- Duo boost: Customer queues together with Stain on their own account — no credentials shared, slightly more expensive.
- Rank Boost mode or "net wins" mode — customer picks a target rank or a number of wins.
- Every 5 wins ordered, the customer gets 1 extra win free (order 5, get 6; order 10, get 12).

SAFETY:
- Offline mode enabled before login so friends/guild never see activity.
- VPN matched to the customer's own country to avoid Riot flagging location changes.
- 100% manual, human gameplay — no bots or scripts.
- 500+ orders completed, zero bans on record.

HOW ORDERING WORKS:
1. Go to the Pricing page, pick rank/wins, Solo or Duo, submit the order.
2. Add "stain.hs" on Discord to arrange payment — Stain usually replies within 5 minutes.
3. Boost typically starts within a few hours of payment being confirmed.
4. Customer gets live progress updates in their dashboard and on Discord.

NET WINS: Only the net (wins minus losses) counts toward the order. E.g. if someone orders
5 net wins and Stain goes 2-1, that's 1 net win — 4 more still owed. He keeps playing until
every net win is delivered.

REFUNDS: Full refund if the boost hasn't started yet. If it's already in progress, a fair
partial refund is arranged case-by-case, always via Discord.

CHAMPION: Stain mains Master Yi Jungle (#1 on ME server), occasionally flexes other picks
depending on matchup.

LINKS: Pricing – stainboost.com/pricing · Reviews – stainboost.com/reviews · FAQ – stainboost.com/faq
· Blog – stainboost.com/blog · Discord – discord.gg/hyhhtbWx

TONE: Friendly, confident, concise — talking to gamers, not corporate customers. Use short,
direct sentences. It's fine to sound a little hype (this is a competitive-gaming audience) but
never dishonest or exaggerated beyond what's stated above.

If someone asks something you don't have solid info on (exact prices, live order status,
specific payment methods), don't guess — tell them to check the Pricing page or message
Stain directly on Discord (stain.hs) for a fast answer.`;

// Simple in-memory per-IP rate limit. Resets when the function goes cold, and each
// Vercel instance keeps its own counts — not perfectly precise across a big fleet
// of instances, but enough to stop a single visitor (or bot) from hammering the
// endpoint and burning through the whole account's Groq quota.
const WINDOW_MS = 60 * 1000;
const MAX_PER_WINDOW = 12;
const hits = new Map(); // ip -> [timestamps]

function isRateLimited(ip) {
  const now = Date.now();
  const timestamps = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  timestamps.push(now);
  hits.set(ip, timestamps);
  return timestamps.length > MAX_PER_WINDOW;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';

  if (isRateLimited(ip)) {
    return res.status(429).json({
      error: "You're sending messages a bit fast — please wait a moment and try again.",
    });
  }

  const { messages } = req.body || {};
  if (!Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages must be an array' });
  }

  // Cap history sent to the model to keep costs/latency down
  const recent = messages.slice(-20);

  try {
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...recent],
        temperature: 0.7,
        max_tokens: 600,
      }),
    });

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      console.error('Groq API error:', errText);

      if (groqRes.status === 429) {
        return res.status(429).json({
          error: "We're getting a lot of chats right now — please try again in a few seconds.",
        });
      }
      return res.status(502).json({ error: 'Upstream AI request failed' });
    }

    const data = await groqRes.json();
    const reply = data.choices?.[0]?.message?.content?.trim() || "Sorry, I couldn't generate a response.";

    return res.status(200).json({ reply });
  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
}
