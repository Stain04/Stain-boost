// "The Climb" hero quote: live price + animated climb along the visitor's own route.
// Server HTML holds the final state (no-JS). With JS, CSS shows the start of the climb
// until `.played` is added, so there is no flash before the animation.
import { MASTERS, LP_OPTIONS, rankName, rankPosition, rankBoostTotal, formatUSD } from '../data/pricing.js';
import { track } from './analytics.js';

const root = document.querySelector('[data-climb]');
if (root) init(root);

function init(root) {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const q = (s) => root.querySelector(s);
  const fromSel = q('[data-from]');
  const toSel = q('[data-to]');
  const priceEl = q('[data-price]');
  const nodes = [...root.querySelectorAll('.node')];
  let shown = parseFloat(priceEl.textContent.replace(/[^0-9.]/g, '')) || 0;
  let raf = 0, popTimer = 0;

  const parse = (v) => v.split('-').map(Number);
  const pct = (pos) => (pos / 28) * 100;
  const nodePct = (i) => (i === MASTERS ? 100 : pct(i * 4));
  const read = () => {
    const [fromTier, fromDiv] = parse(fromSel.value);
    const [toTier, toDiv] = parse(toSel.value);
    const type = root.querySelector('input[name="q-queue"]:checked').value;
    return { fromTier, fromDiv, toTier, toDiv, type };
  };

  // Targets at or below the current rank are disabled; keep the target valid.
  function syncTargets() {
    const fromPos = rankPosition(...parse(fromSel.value));
    [...toSel.options].forEach((o) => { o.disabled = rankPosition(...parse(o.value)) <= fromPos; });
    if (toSel.selectedOptions[0]?.disabled) toSel.value = [...toSel.options].find((o) => !o.disabled).value;
  }

  function tickPrice(to) {
    cancelAnimationFrame(raf);
    const from = shown;
    if (reduce || document.hidden || Math.abs(from - to) < 0.005) { shown = to; priceEl.textContent = formatUSD(to); return; }
    const t0 = performance.now(), dur = 800;
    clearTimeout(tickPrice.safety); // frames pause in background tabs — always land on the real price
    tickPrice.safety = setTimeout(() => { cancelAnimationFrame(raf); shown = to; priceEl.textContent = formatUSD(to); }, dur + 120);
    const step = (now) => {
      const k = Math.min(1, (now - t0) / dur);
      shown = from + (to - from) * (1 - Math.pow(1 - k, 3));
      priceEl.textContent = formatUSD(k < 1 ? shown : to);
      if (k < 1) raf = requestAnimationFrame(step); else shown = to;
    };
    raf = requestAnimationFrame(step);
  }

  function setNodes(s, a, b, stagger) {
    nodes.forEach((n, i) => {
      const p = nodePct(i);
      n.style.setProperty('--delay', stagger ? `${(Math.max(0, p - a) / Math.max(1, b - a)) * 0.95}s` : '0s');
      n.classList.toggle('on', i >= s.fromTier && i <= s.toTier);
      n.classList.toggle('dest', i === s.toTier);
      n.classList.toggle('is-from', i === s.fromTier);
    });
  }

  function climb(s, a, b, animate) {
    clearTimeout(popTimer);
    if (!animate || reduce) {
      root.classList.remove('animating');
      root.style.setProperty('--a', a);
      root.style.setProperty('--b', b);
      root.classList.add('played', 'pop');
      setNodes(s, a, b, false);
      return;
    }
    root.classList.remove('animating', 'pop');
    root.style.setProperty('--a', a);
    root.style.setProperty('--b', a);          // start at the current rank
    nodes.forEach((n, i) => { n.style.setProperty('--delay', '0s'); n.classList.toggle('on', i === s.fromTier); n.classList.remove('dest'); });
    root.classList.add('played');
    void root.offsetWidth;                     // commit the start frame
    root.classList.add('animating');
    requestAnimationFrame(() => {
      root.style.setProperty('--b', b);
      setNodes(s, a, b, true);
      popTimer = setTimeout(() => root.classList.add('pop'), 1000);
    });
  }

  function update({ animate }) {
    const s = read();
    const fromPos = rankPosition(s.fromTier, s.fromDiv);
    const toPos = rankPosition(s.toTier, s.toDiv);
    const total = rankBoostTotal({ ...s, lp: LP_OPTIONS[0].value, lpGain: 1 }); // quote assumes 0–20 LP, normal gains
    const divs = toPos - fromPos;
    const fromName = rankName(s.fromTier, s.fromDiv);
    const toName = rankName(s.toTier, s.toDiv);

    q('[data-route]').textContent = `${fromName} → ${toName}`;
    q('[data-meta]').textContent = `${divs} division${divs !== 1 ? 's' : ''} · ${s.type}`;
    q('[data-cta-to]').textContent = toName;
    q('[data-dest-tag]').textContent = toName;
    const cta = q('[data-cta]');
    cta.href = `/pricing?mode=rank&from=${s.fromTier}-${s.fromDiv}&to=${s.toTier}-${s.toDiv}&queue=${s.type}`;
    cta.dataset.value = total.toFixed(2);
    q('[data-announce]').textContent = `${fromName} to ${toName}, ${s.type}: ${formatUSD(total)}`;

    climb(s, pct(fromPos), pct(toPos), animate);
    tickPrice(total);
    document.dispatchEvent(new CustomEvent('sb:quote', { detail: { total, label: `${fromName} → ${toName}`, href: cta.href } }));
    return { s, total, fromName, toName };
  }

  let trackTimer = 0;
  const onChange = (e) => {
    if (e.target === fromSel) syncTargets();
    const r = update({ animate: true });
    clearTimeout(trackTimer);
    trackTimer = setTimeout(() => track('quote_change', { from: r.fromName, to: r.toName, queue: r.s.type, value: +r.total.toFixed(2), currency: 'USD' }), 600);
  };
  fromSel.addEventListener('change', onChange);
  toSel.addEventListener('change', onChange);
  root.querySelectorAll('input[name="q-queue"]').forEach((r) => r.addEventListener('change', onChange));
  q('[data-cta]').addEventListener('click', (e) => {
    track('cta_click', { location: 'hero_quote', value: +e.currentTarget.dataset.value || 0, currency: 'USD' });
  });

  // The browser may restore old <select> values on back/forward — read the DOM, not defaults.
  syncTargets();
  update({ animate: false });
  if (reduce || !('IntersectionObserver' in window)) return; // final state, no motion
  root.classList.remove('played', 'pop'); // keep the start frame until the card is seen

  const play = () => { update({ animate: true }); };
  const io = new IntersectionObserver((es) => {
    if (es.some((x) => x.isIntersecting)) { io.disconnect(); setTimeout(play, 200); }
  }, { threshold: 0.4 });
  io.observe(root);
}
