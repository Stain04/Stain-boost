// Helpers shared by the dashboard, the tracker and admin.
import { RB_TIERS, RB_DIVS, MASTERS, WIN_PRICES, rankPosition } from '../data/pricing.js';

export const STATUS = {
  awaiting_payment: 'Awaiting payment', payment_verified: 'Payment verified', queued: 'Queued',
  in_progress: 'In progress', paused: 'Paused', completed: 'Completed', cancelled: 'Cancelled',
};

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function ago(ts) {
  if (!ts) return '';
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s / 60) + 'm ago';
  if (s < 86400) return Math.floor(s / 3600) + 'h ago';
  return new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}
export const date = (ts) => (ts ? new Date(ts).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—');

/** "Gold II" / "Masters" → { tier, div } (null if unknown). */
export function parseRank(name) {
  const m = String(name || '').trim().match(/^([A-Za-z]+)\s*(IV|III|II|I|4|3|2|1)?/i);
  if (!m) return null;
  const tier = RB_TIERS.findIndex((t) => t.toLowerCase() === m[1].toLowerCase() || (t === 'Masters' && /^master$/i.test(m[1])));
  if (tier < 0) return null;
  if (tier === MASTERS) return { tier, div: 0 };
  const d = m[2] ? (/\d/.test(m[2]) ? 4 - +m[2] : RB_DIVS.indexOf(m[2].toUpperCase())) : 0;
  return { tier, div: Math.max(0, Math.min(3, d)) };
}

/** Real progress for a rank boost: where the current rank + LP sits between start and target. */
export function rankProgress(order) {
  const from = parseRank(order.meta?.from), to = parseRank(order.meta?.to);
  if (order.status === 'completed') return 1;
  if (!from || !to) return 0;
  const a = rankPosition(from.tier, from.div), b = rankPosition(to.tier, to.div);
  const cur = parseRank(order.currentRank);
  if (!cur || b <= a) return 0;
  const pos = rankPosition(cur.tier, cur.div) + Math.min(99, order.currentLp || 0) / 100;
  return Math.max(0, Math.min(1, (pos - a) / (b - a)));
}

/** Links for repeat business. */
export function reorderLinks(o) {
  const q = o.type === 'duo' ? 'duo' : 'solo';
  const links = [];
  if (o.meta?.kind === 'win_boost' && WIN_PRICES[o.meta.rank]) {
    links.push({ label: 'Order again', href: `/pricing?mode=wins&rank=${encodeURIComponent(o.meta.rank)}&wins=${o.meta.paidWins || o.meta.wins || 5}&queue=${q}`, kind: 'reorder' });
  }
  if (o.meta?.kind === 'free_trial') {
    links.push({ label: 'Get my full price', href: '/pricing', kind: 'after_trial' });
  }
  if (o.meta?.kind === 'rank_boost') {
    const to = parseRank(o.meta.to);
    if (to && to.tier < MASTERS) {
      // continue from the reached rank to the next tier's IV (or Masters from Diamond)
      const next = to.tier + 1;
      const target = next >= MASTERS ? '7-0' : `${next}-0`;
      links.push({ label: o.status === 'completed' ? 'Continue the climb' : 'Plan the next climb', href: `/pricing?mode=rank&from=${to.tier}-${to.div}&to=${target}&queue=${q}`, kind: 'continue' });
    }
  }
  return links;
}
