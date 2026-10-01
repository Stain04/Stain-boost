// The home scene: drifting spirit lights + Spirit Blossom petals on a canvas, and a little
// depth on desktop (the scene follows the pointer). Starts after the page has loaded so it
// never competes with the first paint, pauses off-screen and in background tabs, and stays
// still for people who prefer reduced motion.
const scene = document.querySelector('[data-scene]');
const canvas = scene?.querySelector('[data-fx]');
const photo = scene?.querySelector('[data-photo]');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

// while the scene is on screen the page stays clean (the chat button waits, see ChatLauncher)
if (scene && 'IntersectionObserver' in window) {
  new IntersectionObserver(([e]) => document.documentElement.classList.toggle('scene-in-view', e.intersectionRatio > 0.35), { threshold: [0, 0.35, 1] }).observe(scene);
}

if (scene && canvas && !reduce) {
  const start = () => ('requestIdleCallback' in window ? requestIdleCallback(run, { timeout: 1500 }) : setTimeout(run, 600));
  document.readyState === 'complete' ? start() : addEventListener('load', start, { once: true });
}

function run() {
  const ctx = canvas.getContext('2d');
  const small = matchMedia('(max-width: 760px)').matches;
  let W = 0, H = 0, lights = [], petals = [], raf = 0, onScreen = true;

  const sprite = (rgb) => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, `rgba(${rgb},1)`);
    gr.addColorStop(0.22, `rgba(${rgb},.55)`);
    gr.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 64);
    return c;
  };
  const SPR = [sprite('214,204,255'), sprite('255,184,226'), sprite('170,230,255')];

  function resize() {
    const dpr = Math.min(small ? 1.25 : 1.5, devicePixelRatio || 1);
    W = canvas.clientWidth;
    H = canvas.clientHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = Math.round(Math.min(small ? 38 : 90, (W * H) / 15000));
    lights = Array.from({ length: n }, () => ({
      x: Math.random() * W, y: Math.random() * H, r: 0.7 + Math.random() * 1.9, vy: -(0.06 + Math.random() * 0.26),
      ph: Math.random() * 6.3, sp: 0.5 + Math.random() * 1.3, s: Math.random() < 0.62 ? 0 : Math.random() < 0.6 ? 1 : 2,
    }));
    petals = Array.from({ length: Math.round(n / 6) }, () => ({
      x: Math.random() * W, y: Math.random() * H, rot: Math.random() * 6.3, vr: (Math.random() - 0.5) * 0.02,
      vx: 0.25 + Math.random() * 0.45, vy: 0.2 + Math.random() * 0.4, size: 4 + Math.random() * 5, ph: Math.random() * 6.3,
    }));
  }

  function frame(t) {
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    for (const p of lights) {
      p.y += p.vy;
      p.x += Math.sin(t * 0.0005 + p.ph) * 0.18;
      if (p.y < -10) { p.y = H + 10; p.x = Math.random() * W; }
      const s = p.r * 10;
      ctx.globalAlpha = 0.25 + 0.75 * Math.abs(Math.sin(t * 0.0009 * p.sp + p.ph));
      ctx.drawImage(SPR[p.s], p.x - s / 2, p.y - s / 2, s, s);
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 0.75;
    for (const q of petals) {
      q.x += q.vx + Math.sin(t * 0.0007 + q.ph) * 0.3;
      q.y += q.vy;
      q.rot += q.vr;
      if (q.y > H + 20 || q.x > W + 20) { q.x = Math.random() * W * 0.7 - 40; q.y = -20; }
      ctx.save();
      ctx.translate(q.x, q.y);
      ctx.rotate(q.rot);
      const gr = ctx.createLinearGradient(-q.size, 0, q.size, 0);
      gr.addColorStop(0, 'rgba(255,170,215,.95)');
      gr.addColorStop(1, 'rgba(196,140,255,.7)');
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.ellipse(0, 0, q.size, q.size * 0.48, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    raf = requestAnimationFrame(frame);
  }

  const play = () => { cancelAnimationFrame(raf); if (onScreen && !document.hidden) raf = requestAnimationFrame(frame); };
  resize();
  play();
  canvas.classList.add('on');
  let rt = 0;
  addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(resize, 150); });
  document.addEventListener('visibilitychange', play);
  new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; play(); }).observe(scene);

  // depth on desktop: the scene drifts a few pixels against the pointer
  if (photo && matchMedia('(hover: hover) and (min-width: 900px)').matches) {
    let px = 0, py = 0, tx = 0, ty = 0, moving = 0;
    const ease = () => {
      px += (tx - px) * 0.06; py += (ty - py) * 0.06;
      photo.style.translate = `${px.toFixed(2)}px ${py.toFixed(2)}px`;
      moving = Math.abs(tx - px) + Math.abs(ty - py) > 0.05 ? requestAnimationFrame(ease) : 0;
    };
    scene.addEventListener('pointermove', (e) => {
      tx = (e.clientX / innerWidth - 0.5) * -16;
      ty = (e.clientY / innerHeight - 0.5) * -10;
      if (!moving) moving = requestAnimationFrame(ease);
    });
  }
}
