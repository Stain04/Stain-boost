// ─────────────────────────────────────────────────────────────────────────────
// PRICES — the single source of truth.
// Used by the pricing page, the home page quote, the price tables and the order API
// (api/order.js). Edit prices here and nowhere else.
// ─────────────────────────────────────────────────────────────────────────────

/** Win boost: price per net win, by the rank the account is in. */
export const WIN_PRICES = {
  'Iron':           { solo: 1.50,  duo: 2.50  },
  'Bronze':         { solo: 2.00,  duo: 3.00  },
  'Silver':         { solo: 2.50,  duo: 3.50  },
  'Gold':           { solo: 3.50,  duo: 5.00  },
  'Platinum':       { solo: 5.00,  duo: 6.50  },
  'Emerald':        { solo: 5.50,  duo: 8.00  },
  'Diamond IV-III': { solo: 8.00,  duo: 12.00 },
  'Diamond II-I':   { solo: 10.00, duo: 16.00 },
  'Masters':        { solo: 15.00, duo: 20.00 },
};

/** Rank boost: price per division climbed, by the tier the division is in. */
export const RB_DIV_PRICE = {
  Iron:     { solo: 6.00,  duo: 10.00 },
  Bronze:   { solo: 8.00,  duo: 12.00 },
  Silver:   { solo: 10.00, duo: 14.00 },
  Gold:     { solo: 14.00, duo: 20.00 },
  Platinum: { solo: 20.00, duo: 26.00 },
  Emerald:  { solo: 22.00, duo: 32.00 },
  DiamondL: { solo: 32.00, duo: 48.00 }, // Diamond IV and III
  DiamondH: { solo: 40.00, duo: 64.00 }, // Diamond II and I
};

/** Pay for 5, get 6: one free win for every FREE_WIN_EVERY wins paid for. */
export const FREE_WIN_EVERY = 5;
export const MAX_WINS = 30;

/** Tiers used by rank boost. Masters has no divisions. */
export const RB_TIERS = ['Iron', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Emerald', 'Diamond', 'Masters'];
export const RB_DIVS = ['IV', 'III', 'II', 'I'];
export const MASTERS = 7;

/**
 * Current LP in the starting division. The first division is discounted by the
 * LP already earned in it; every bracket uses its midpoint (0–20 LP → 10%).
 */
export const LP_OPTIONS = [
  { value: 10, label: '0–20 LP' },
  { value: 30, label: '21–40 LP' },
  { value: 50, label: '41–60 LP' },
  { value: 70, label: '61–80 LP' },
  { value: 90, label: '81–100 LP' },
];
/** Every LP value the order API accepts (10 = "0-20 LP" as sent by the old pricing page). */
export const VALID_CURRENT_LP = [0, 10, 30, 50, 70, 90];

/** Average LP gained per win. Fewer LP per win means more games, so a higher price. */
export const LP_GAIN_OPTIONS = [
  { value: 1.0, label: 'Normal', detail: '23+ LP per win' },
  { value: 1.4, label: 'Low', detail: '16–22 LP per win' },
  { value: 2.0, label: 'Very low', detail: '8–15 LP per win' },
];
export const VALID_LP_GAIN = LP_GAIN_OPTIONS.map(o => o.value);

// ── Extras & discounts ───────────────────────────────────────────────────────
// Priced just under the cheapest competitor found (Sep 2026):
// priority +20% at BoostRoyal/Eloking; bonus win from Eloking/BoostRoyal per tier.

/** Priority start: your order goes to the front of Stain's queue. Share of the order price. */
export const PRIORITY_RATE = 0.18;

/** Bonus win (rank boost only): one extra net win after reaching the target, by target tier. */
export const BONUS_WIN_PRICE = {
  Iron: 1.45, Bronze: 1.45, Silver: 1.85, Gold: 3.10, Platinum: 6.20, Emerald: 6.65, Diamond: 6.65,
};

/** Referral: the friend gets this off their first order; the referrer earns the same share as credit. */
export const REFERRAL_RATE = 0.20;

// ── Math (identical on the page and on the server) ──────────────────────────

/** 0..28 position of a rank on the ladder (Iron IV = 0, Masters = 28). */
export function rankPosition(tier, div) {
  return tier === MASTERS ? 28 : tier * 4 + div;
}

export function rankName(tier, div) {
  return RB_TIERS[tier] + (tier < MASTERS ? ' ' + RB_DIVS[div] : '');
}

/** Price to climb one division that starts at (tier, div). */
export function divisionPrice(tier, div, type) {
  const name = RB_TIERS[tier];
  if (name === 'Masters') return 0;
  const key = name === 'Diamond' ? (div <= 1 ? 'DiamondL' : 'DiamondH') : name;
  const p = RB_DIV_PRICE[key];
  return type === 'duo' ? p.duo : p.solo;
}

/**
 * Rank boost total (unrounded) — before LP-gain multiplier.
 * The first division is discounted by the LP already earned in it.
 */
export function rankBoostBase(fromTier, fromDiv, toTier, toDiv, type, lp) {
  const from = rankPosition(fromTier, fromDiv);
  const to = rankPosition(toTier, toDiv);
  if (to <= from) return 0;
  let total = 0;
  for (let d = from; d < to; d++) {
    const t = Math.min(Math.floor(d / 4), MASTERS);
    let divCost = divisionPrice(t, d % 4, type);
    if (d === from) divCost = divCost * ((100 - lp) / 100);
    total += divCost;
  }
  return total;
}

/** Full rank boost price (unrounded). */
export function rankBoostTotal({ fromTier, fromDiv, toTier, toDiv, type, lp = 0, lpGain = 1.0 }) {
  return rankBoostBase(fromTier, fromDiv, toTier, toDiv, type, lp) * lpGain;
}

/** Number of free wins for a number of paid wins (pay for 5, get 6). */
export function freeWins(paidWins) {
  return Math.floor(paidWins / FREE_WIN_EVERY);
}

/** Win boost price (unrounded): every selected win is paid; free wins come on top. */
export function winBoostTotal({ rank, wins, type }) {
  const p = WIN_PRICES[rank];
  if (!p) return 0;
  return (type === 'duo' ? p.duo : p.solo) * wins;
}

/** Cheapest per-win price, for "from $X" copy. */
export function lowestWinPrice() {
  return Math.min(...Object.values(WIN_PRICES).map(p => p.solo));
}

export function formatUSD(n) {
  return '$' + n.toFixed(2);
}

/** Bonus win is offered for rank boosts that don't end in Masters. */
export function bonusWinPrice(toTier) {
  return toTier < MASTERS ? BONUS_WIN_PRICE[RB_TIERS[toTier]] : null;
}

const cents = (usd) => Math.round(Number(usd.toFixed(2)) * 100);

/**
 * The full price of an order, in the order it's applied:
 *   base (rank or wins) → + bonus win → + priority % → − referral % → − credit.
 * Everything is computed in whole cents so the page, the summary lines and the
 * server always agree to the cent. With no extras, total === the base price.
 *
 * o = { mode: 'rank'|'wins', type, fromTier, fromDiv, toTier, toDiv, lp, lpGain,
 *       rank, wins, priority, bonusWin, referral, credit }
 */
export function quoteOrder(o) {
  const base = o.mode === 'wins'
    ? cents(winBoostTotal({ rank: o.rank, wins: o.wins, type: o.type }))
    : cents(rankBoostTotal(o));
  const bonusPrice = o.mode === 'rank' && o.bonusWin ? bonusWinPrice(o.toTier) : null;
  const bonus = bonusPrice ? Math.round(bonusPrice * 100) : 0;
  const sub = base + bonus;
  const priority = o.priority ? Math.round(sub * PRIORITY_RATE) : 0;
  const gross = sub + priority;
  const referral = o.referral ? Math.round(gross * REFERRAL_RATE) : 0;
  const credit = Math.max(0, Math.min(Math.round((o.credit || 0) * 100), gross - referral));
  const total = gross - referral - credit;
  const usd = (c) => c / 100;
  return { base: usd(base), bonus: usd(bonus), priority: usd(priority), referral: usd(referral), credit: usd(credit), total: usd(total) };
}
