// ─────────────────────────────────────────────────────────────────────────────
// SITE FACTS & COPY — edit here, it updates every page.
// Rule: only real, checkable facts. If something isn't known yet, leave the
// placeholder (marked TODO) — the site hides placeholders instead of inventing.
// ─────────────────────────────────────────────────────────────────────────────

export const SITE = {
  name: 'StainBoost',
  url: 'https://www.stainboost.com',
  gaId: 'G-818RX6BRWB',
  themeColor: '#060411',
};

export const DISCORD = {
  handle: 'stain.hs',
  invite: 'https://discord.gg/hyhhtbWx',
};

/** Numbers shown across the site. Keep them true. */
export const STATS = {
  ordersCompleted: 120,          // "120+"
  bans: 0,
  rank: 'Challenger',            // Stain's rank (owner-confirmed; shown as just 'Challenger', no LP)
  masteryPoints: '5M+',          // Master Yi mastery, added up across all his accounts over the years (owner-confirmed)
  playingSince: 2015,            // plays League since 2015 (owner-confirmed 1 Oct 2026)
  meServerSince: 2024,           // on the ME server since it opened
};

/** Stain's public accounts — linked as proof. */
export const ACCOUNTS = [
  { riotId: 'Stain#001', server: 'ME', label: 'Middle East', opgg: 'https://op.gg/lol/summoners/me/Stain-001' },
  { riotId: 'Stainboost com#Rank1', server: 'EUNE', label: 'EU Nordic & East', opgg: 'https://op.gg/lol/summoners/eune/Stainboost%20com-Rank1' },
];

/**
 * Verified public proof (read from OP.GG on 30 Sep 2026). Update when it changes.
 * "Top tier" on OP.GG = highest rank reached this season.
 */
export const PROOF = {
  checkedOn: 'Sep 2026',
  peak: { tier: 'Challenger', server: 'ME', source: 'https://op.gg/lol/summoners/me/Stain-001' },
};

/** Servers. Only ME is live; the others collect "notify me" sign-ups. */
export const REGIONS = [
  { code: 'me', name: 'Middle East', live: true },
  { code: 'euw', name: 'EU West', live: false },
  { code: 'eune', name: 'EU Nordic & East', live: false },
];

/**
 * Payment methods for the "Pay now" panel after an order.
 * `link` may contain {amount}, replaced with the order total (e.g. 15.00).
 * Anyone who can't use these is told to message Stain on Discord.
 */
export const PAYMENT_METHODS = [
  { key: 'paypal', name: 'PayPal', idLabel: 'PayPal', id: 'paypal.me/Stainboost', link: 'https://www.paypal.me/Stainboost/{amount}USD', note: 'The amount is filled in for you. Add your order token in the note.' },
  { key: 'binance', name: 'Binance Pay', idLabel: 'Binance Pay ID', id: '987280057', note: 'Send the amount in USDT to this Binance Pay ID and put your order token in the note.' },
];
export const PAYMENT_NAMES = PAYMENT_METHODS.map((m) => m.name).join(' or ');

/** The promises shown next to every buy button. All are existing business rules. */
export const GUARANTEES = [
  { title: 'Full refund if not started', text: 'Changed your mind before the boost begins? You get everything back.' },
  { title: '0 bans in 120+ orders', text: 'Offline mode, a VPN matched to your country and 100% hand-played games on every order.' },
  { title: 'One booster, no outsourcing', text: 'Every game is played by Stain himself — a Challenger Master Yi. Never a random booster from a pool.' },
];

export const NAV = [
  { href: '/pricing', label: 'Pricing' },
  { href: '/reviews', label: 'Reviews' },
  { href: '/faq', label: 'FAQ' },
  { href: '/blog', label: 'Blog' },
];
