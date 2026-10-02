// The free trial's live settings. Stain sets the end time from /admin (stored in KV); until he
// has, the dates in src/data/promo.js apply. Every server check and the public status use this.
import { FREE_TRIAL } from '../../src/data/promo.js';

export const TRIAL_KEY = 'promo_trial';
export const MAX_TRIAL_DAYS = 60; // the admin can't set an end further away than this

/** { active, startsAt, endsAt, games } — times in ms. */
export async function getTrial(kv, now = Date.now()) {
  let saved = null;
  if (kv) {
    try {
      const raw = await kv.get(TRIAL_KEY);
      saved = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : null;
    } catch (e) {
      console.error('trial config read error', e);
    }
  }
  const startsAt = saved ? Number(saved.startsAt) || 0 : Date.parse(FREE_TRIAL.startsAt);
  const endsAt = saved ? Number(saved.endsAt) || 0 : Date.parse(FREE_TRIAL.endsAt);
  return { active: endsAt > 0 && now >= startsAt && now < endsAt, startsAt, endsAt, games: FREE_TRIAL.games };
}

/** "Fri 9 Oct, 23:59 (UTC+3)" — how the deadline is written for customers and the chat assistant. */
export function trialEndLabel(endsAt) {
  const f = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Riyadh', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
  return `${f.format(endsAt)} (UTC+3)`;
}
