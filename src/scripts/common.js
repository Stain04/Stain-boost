// Loaded on every page (deferred module).
import { track, locationOf } from './analytics.js';

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ── Referral links (?ref=CODE): remembered for 30 days, applied at checkout ──
try {
  const ref = new URLSearchParams(location.search).get('ref');
  if (ref && /^[A-Za-z0-9]{4,20}$/.test(ref)) {
    localStorage.setItem('sb_ref', JSON.stringify({ code: ref.toUpperCase(), ts: Date.now() }));
    track('referral_visit', { code: ref.toUpperCase() });
  } else {
    const r = JSON.parse(localStorage.getItem('sb_ref') || 'null');
    if (r && Date.now() - r.ts > 30 * 864e5) localStorage.removeItem('sb_ref');
  }
} catch {}

// ── Floating nav turns to glass once the page scrolls ─────────────────────
if (document.querySelector('.nav.overlay')) {
  const onScroll = () => document.documentElement.classList.toggle('nav-scrolled', scrollY > 24);
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

// ── Mobile menu ──────────────────────────────────────────────────────────────
const burger = document.querySelector('[data-burger]');
const menu = document.querySelector('[data-menu]');
if (burger && menu) {
  const setOpen = (open) => {
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    // the menu opens right under the header (whose height depends on the promo bar)
    if (open) menu.style.top = Math.round(document.querySelector('[data-nav]').getBoundingClientRect().bottom) + 'px';
    menu.hidden = !open;
    document.documentElement.classList.toggle('menu-open', open);
  };
  burger.addEventListener('click', () => setOpen(menu.hidden));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !menu.hidden) { setOpen(false); burger.focus(); } });
  menu.addEventListener('click', (e) => { if (e.target.closest('a')) setOpen(false); });
}

// ── Signed-in state in the nav (cached to avoid flicker between pages) ───────
const AUTH_KEY = 'sb_auth_cache_v1';
function applyAuth(user) {
  document.querySelectorAll('[data-auth-link]').forEach((a) => {
    a.href = user ? '/dashboard' : '/login';
    a.textContent = user ? (a.dataset.dash || 'Dashboard') : (a.dataset.signin || 'Sign in');
  });
  document.documentElement.classList.toggle('signed-in', !!user);
  window.__sbUser = user || null;
  document.dispatchEvent(new CustomEvent('sb:user', { detail: user || null }));
}
try {
  const c = JSON.parse(localStorage.getItem(AUTH_KEY) || 'null');
  if (c && Date.now() - c.ts < 10 * 60 * 1000) applyAuth(c.user || null);
} catch {}
fetch('/api/auth/me', { credentials: 'same-origin' })
  .then((r) => (r.ok ? r.json() : { user: null }))
  .then((d) => {
    const user = d && d.user ? d.user : null;
    try { localStorage.setItem(AUTH_KEY, JSON.stringify({ user, ts: Date.now() })); } catch {}
    applyAuth(user);
  })
  .catch(() => {});

// ── Reveal on scroll ─────────────────────────────────────────────────────────
const reveals = document.querySelectorAll('.reveal');
if (reveals.length) {
  if (reduceMotion || !('IntersectionObserver' in window)) reveals.forEach((n) => n.classList.add('in'));
  else {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    reveals.forEach((n) => io.observe(n));
  }
}

// ── Cursor glow on cards (mouse only) ────────────────────────────────────────
if (matchMedia('(hover: hover) and (pointer: fine)').matches && !reduceMotion) {
  document.addEventListener('pointermove', (e) => {
    const card = e.target.closest && e.target.closest('.card-glow');
    if (!card) return;
    const r = card.getBoundingClientRect();
    card.style.setProperty('--mx', `${e.clientX - r.left}px`);
    card.style.setProperty('--my', `${e.clientY - r.top}px`);
  }, { passive: true });
}

// ── Click tracking ───────────────────────────────────────────────────────────
document.addEventListener('click', (e) => {
  const t = e.target.closest && e.target.closest('[data-track], a[href*="discord.gg"], a[href*="discord.com"]');
  if (!t) return;
  if (t.hasAttribute('data-track')) {
    track(t.getAttribute('data-track'), { location: t.getAttribute('data-track-location') || locationOf(t) });
  } else {
    track('discord_click', { location: locationOf(t) });
  }
});

// ── "Stain is online" — real status set by Stain in /admin ──────────────────
const statusEls = document.querySelectorAll('[data-status]');
if (statusEls.length) {
  fetch('/api/status').then((r) => (r.ok ? r.json() : null)).then((s) => {
    if (!s || !s.known) return; // switch never used: claim nothing
    window.__sbOnline = !!s.online;
    statusEls.forEach((n) => {
      if (!s.online && n.hasAttribute('data-online-only')) return;
      n.classList.toggle('chip-green', !!s.online);
      n.querySelector('[data-status-text]').textContent = s.online ? 'Stain is online now' : "Stain is offline · he'll reply when back";
      n.hidden = false;
    });
  }).catch(() => {});
}

// ── Chat (loaded on first open) ──────────────────────────────────────────────
const chatBtn = document.querySelector('[data-chat-launch]');
if (chatBtn) {
  chatBtn.addEventListener('click', async () => {
    chatBtn.disabled = true;
    try { (await import('./chat.js')).openChat(); } finally { chatBtn.disabled = false; }
  });
}

// ── Free-trial countdown (src/data/promo.js) ────────────────────────────────
// Every [data-trial-countdown] shows the real time left; at zero the promo hides itself.
const trialCounters = document.querySelectorAll('[data-trial-countdown]');
if (trialCounters.length) {
  const end = Number(trialCounters[0].dataset.end);
  const pad = (n) => String(n).padStart(2, '0');
  let timer = 0;
  const tick = () => {
    const ms = end - Date.now();
    if (!(ms > 0)) { document.documentElement.classList.add('trial-over'); clearInterval(timer); return; }
    const d = Math.floor(ms / 864e5), h = Math.floor(ms / 36e5) % 24, m = Math.floor(ms / 6e4) % 60, s = Math.floor(ms / 1e3) % 60;
    const left = d > 0 ? `${d}d ${pad(h)}h ${pad(m)}m` : `${pad(h)}h ${pad(m)}m ${pad(s)}s`;
    trialCounters.forEach((c) => { c.textContent = (c.dataset.prefix ?? 'Ends in ') + left; });
  };
  tick();
  timer = setInterval(tick, 1000);
}
