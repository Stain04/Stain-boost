// ─────────────────────────────────────────────────────────────────────────────
// PROMOS — time-limited offers. The free trial's timer is set by Stain in /admin (stored in KV,
// read through api/_lib/promo.js); the dates below only apply until he has set it once.
// The server enforces the window, so a promo really ends when the site says it does.
// ─────────────────────────────────────────────────────────────────────────────

/** Free trial: a new customer's first 2 games are free — no payment, no order. */
export const FREE_TRIAL = {
  games: 2,
  startsAt: '2026-10-01T00:00:00+03:00',
  endsAt: '2026-10-03T00:00:00+03:00',        // end of Friday 2 October, Arabia/Cairo time (UTC+3)
  endsLabel: 'Friday 2 Oct at midnight (UTC+3)',
};

export const TRIAL_ENDS_MS = Date.parse(FREE_TRIAL.endsAt);

export function trialActive(now = Date.now()) {
  return now >= Date.parse(FREE_TRIAL.startsAt) && now < TRIAL_ENDS_MS;
}
