// FAQ — used by /faq, the pricing page, the home page and the FAQPage schema.
// `top: true` = shown next to the buy button (the biggest fears).
// Answers may contain simple HTML (links, <strong>).
export const FAQ = [
  {
    group: 'Safety & bans',
    items: [
      {
        q: 'Will my account get banned?', top: true,
        a: "Boosting is against Riot's Terms of Service, so no honest service can promise zero risk. What Stain does keeps it as low as possible: <strong>offline mode</strong> before every login, a <strong>VPN matched to your country</strong>, and <strong>100% hand-played games</strong> — no bots, no scripts. The record so far: <strong>0 bans in 120+ orders</strong>.",
      },
      {
        q: 'Will my friends see that someone else is playing?',
        a: 'No. Stain enables <strong>offline mode</strong> before logging in to your account. Your friend list shows you as offline the entire time.',
      },
      {
        q: 'Does Riot detect boosting services?',
        a: "Riot's systems flag unusual activity such as sudden location changes and bot-like behaviour. Stain avoids these: the VPN matches your country, every game is played by hand, and he plays normally on his main champion. This approach has been used for 120+ orders with <strong>zero bans</strong>.",
      },
      {
        q: 'Do I need to share my login?', top: true,
        a: 'Only for <strong>Solo boost</strong>. Your login is used only to sign in and play — it is never stored or shared, and you can change your password after the boost. Prefer to keep your account to yourself? Choose <strong>Duo boost</strong>: you play on your own account together with Stain.',
      },
    ],
  },
  {
    group: 'Price, payment & refunds',
    items: [
      {
        q: 'How do I pay?', top: true,
        a: 'Place your order on the <a href="/pricing">Pricing</a> page, then pay with <strong>PayPal or Binance Pay</strong>. Prefer another method? Message <strong>stain.hs</strong> on Discord and Stain will sort it out. The boost starts as soon as the payment is confirmed.',
      },
      {
        q: 'Do you offer refunds?', top: true,
        a: "Yes. If the boost hasn't started yet, you get a <strong>full refund</strong> — just message Stain on Discord. Once boosting has begun, a fair partial refund based on progress is arranged case by case.",
      },
      {
        q: 'What is the free win bonus?',
        a: 'For every <strong>5 wins</strong> you pay for, you get <strong>1 extra win completely free</strong>. Pay for 5 wins, get 6. Pay for 10, get 12. The free wins are added automatically and shown on the Pricing page before you pay.',
      },
    ],
  },
  {
    group: 'How it works',
    items: [
      {
        q: 'How do I place an order?',
        a: 'Go to <a href="/pricing">Pricing</a>, choose Rank Boost or Net Wins, pick Solo or Duo, and add your Discord name and in-game name. Sign in with Discord (one click) and place the order. You then see how to pay, and your order appears in your dashboard.',
      },
      {
        q: 'How fast does the boost start?', top: true,
        a: 'Most orders begin <strong>within a few hours</strong> of payment being confirmed. Stain usually replies on Discord within minutes and gives you an exact start time.',
      },
      {
        q: 'What is the difference between Solo and Duo?',
        a: "<strong>Solo boost</strong>: Stain logs in to your account and plays for you — you don't need to be online. <strong>Duo boost</strong>: you queue together with Stain; you play your own account while he carries from the same game. Duo costs a bit more, but your account is never handed over.",
      },
      {
        q: 'Can I follow the progress?',
        a: 'Yes. Every order has a <strong>live tracker</strong> in your <a href="/dashboard">dashboard</a>: status, current rank and LP, every game played, notes from Stain, and a direct chat with him. He also updates you on Discord.',
      },
    ],
  },
  {
    group: 'Results & gameplay',
    items: [
      {
        q: 'What champion does Stain play?',
        a: 'Stain specialises in <strong>Master Yi jungle</strong> — a Challenger player and the #1 Master Yi on the Middle East server. He may flex onto other picks depending on the matchup, but Yi is his main.',
      },
      {
        q: 'What if Stain loses some games?',
        a: "You pay for <strong>net wins</strong>: only wins minus losses count. For example, you order 3 net wins; Stain wins 2 and loses 1 — that's 1 net win, so 2 more to go. He keeps playing until every net win is delivered, however many games it takes.",
      },
    ],
  },
];

export const TOP_FAQ = FAQ.flatMap((g) => g.items).filter((i) => i.top);

/** FAQPage JSON-LD (answers as plain text). */
export function faqSchema(items = FAQ.flatMap((g) => g.items)) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((i) => ({
      '@type': 'Question',
      name: i.q,
      acceptedAnswer: { '@type': 'Answer', text: i.a.replace(/<[^>]+>/g, '') },
    })),
  };
}
