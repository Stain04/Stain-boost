/* ── SHARED JS — loaded by all pages ── */

// Mobile menu toggle
function toggleMenu() {
  document.getElementById('mobileMenu').classList.toggle('open');
}

// ── AUTH-AWARE NAV (injects login state into all navs) ──
(function () {
  function escapeHtml(s) { return String(s || '').replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  function hasLink(container, href) {
    return Array.from(container.querySelectorAll('a')).some(function (a) {
      return a.getAttribute('href') === href && !a.classList.contains('nav-auth-link');
    });
  }

  function injectAuthNav(user) {
    var desktop = document.querySelector('.nav-links');
    if (desktop) {
      desktop.querySelectorAll('.nav-auth-link').forEach(function (n) { n.remove(); });
      var anchor = desktop.querySelector('.nav-discord') || null;
      var nodes = buildDesktop(user, desktop);
      nodes.forEach(function (n) { desktop.insertBefore(n, anchor); });
    }
    var mobile = document.querySelector('.mobile-menu');
    if (mobile) {
      mobile.querySelectorAll('.nav-auth-link').forEach(function (n) { n.remove(); });
      var manchor = mobile.querySelector('a[target="_blank"]') || null;
      var mnodes = buildMobile(user, mobile);
      mnodes.forEach(function (n) { mobile.insertBefore(n, manchor); });
    }
  }

  function buildDesktop(user, container) {
    var out = [];
    if (user) {
      if (!hasLink(container, '/dashboard')) {
        var dash = document.createElement('a');
        dash.href = '/dashboard'; dash.className = 'nav-auth-link';
        dash.textContent = 'Dashboard';
        out.push(dash);
      }

      var pill = document.createElement('span');
      pill.className = 'nav-auth-link';
      pill.style.cssText = 'font-family:Rajdhani,sans-serif;font-size:.78rem;font-weight:700;letter-spacing:.08em;color:#c4b5fd;background:rgba(124,58,237,.12);border:1px solid rgba(124,58,237,.3);padding:.32rem .8rem;border-radius:8px;margin-left:.4rem;';
      pill.textContent = '@' + (user.username || 'user');
      out.push(pill);

      var logout = document.createElement('a');
      logout.href = '#'; logout.className = 'nav-auth-link';
      logout.textContent = 'Sign Out';
      logout.addEventListener('click', function (e) {
        e.preventDefault();
        clearCache();
        fetch('/api/auth/logout', { method: 'POST' }).then(function () { window.location.href = '/'; });
      });
      out.push(logout);
    } else if (!hasLink(container, '/login')) {
      var login = document.createElement('a');
      login.href = '/login'; login.className = 'nav-auth-link';
      login.textContent = 'Sign In';
      out.push(login);
    }
    return out;
  }

  function buildMobile(user, container) {
    var out = [];
    if (user) {
      if (!hasLink(container, '/dashboard')) {
        var dash = document.createElement('a');
        dash.href = '/dashboard'; dash.className = 'nav-auth-link';
        dash.textContent = 'Dashboard (@' + escapeHtml(user.username || 'user') + ')';
        out.push(dash);
      }

      var logout = document.createElement('a');
      logout.href = '#'; logout.className = 'nav-auth-link';
      logout.textContent = 'Sign Out';
      logout.addEventListener('click', function (e) {
        e.preventDefault();
        clearCache();
        fetch('/api/auth/logout', { method: 'POST' }).then(function () { window.location.href = '/'; });
      });
      out.push(logout);
    } else if (!hasLink(container, '/login')) {
      var login = document.createElement('a');
      login.href = '/login'; login.className = 'nav-auth-link';
      login.textContent = 'Sign In';
      out.push(login);
    }
    return out;
  }

  // ── Auth cache: avoids nav flicker on page navigation ──
  var CACHE_KEY = 'sb_auth_cache_v1';
  var CACHE_TTL = 10 * 60 * 1000; // 10 minutes
  function readCache() {
    try {
      var raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return undefined;
      var obj = JSON.parse(raw);
      if (!obj || typeof obj.ts !== 'number') return undefined;
      if (Date.now() - obj.ts > CACHE_TTL) return undefined;
      return obj.user || null;
    } catch (e) { return undefined; }
  }
  function writeCache(user) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ user: user || null, ts: Date.now() })); } catch (e) {}
  }
  function clearCache() {
    try { localStorage.removeItem(CACHE_KEY); } catch (e) {}
  }
  function sameUser(a, b) {
    if (!a && !b) return true;
    if (!a || !b) return false;
    return a.id === b.id && a.username === b.username && a.isAdmin === b.isAdmin;
  }

  function init() {
    var cached = readCache();
    if (cached !== undefined) injectAuthNav(cached);

    fetch('/api/auth/me', { credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.json() : { user: null }; })
      .then(function (d) {
        var fresh = d && d.user ? d.user : null;
        writeCache(fresh);
        if (cached === undefined || !sameUser(cached, fresh)) injectAuthNav(fresh);
      })
      .catch(function () {
        if (cached === undefined) injectAuthNav(null);
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

// Close mobile menu when a link is clicked
document.addEventListener('DOMContentLoaded', function () {
  const menu = document.getElementById('mobileMenu');
  if (menu) {
    menu.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () {
        menu.classList.remove('open');
      });
    });
  }
});

// Floating particle canvas engine
(function () {
  const canvas = document.getElementById('particles-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let W, H, particles = [];

  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  const COLORS = [
    'rgba(139,92,246,',
    'rgba(34,211,238,',
    'rgba(196,181,253,',
    'rgba(251,191,36,'
  ];

  for (let i = 0; i < 20; i++) {
    particles.push({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      r: Math.random() * 1.6 + 0.3,
      dx: (Math.random() - 0.5) * 0.28,
      dy: (Math.random() - 0.5) * 0.28,
      o: Math.random() * 0.2 + 0.04,
      c: COLORS[Math.floor(Math.random() * COLORS.length)],
      pulse: Math.random() * Math.PI * 2,
      pulseSpeed: Math.random() * 0.018 + 0.005
    });
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    particles.forEach(function (p) {
      p.pulse += p.pulseSpeed;
      const alpha = p.o * (0.7 + 0.3 * Math.sin(p.pulse));
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.c + alpha + ')';
      ctx.fill();
      p.x += p.dx;
      p.y += p.dy;
      if (p.x < -5) p.x = W + 5;
      if (p.x > W + 5) p.x = -5;
      if (p.y < -5) p.y = H + 5;
      if (p.y > H + 5) p.y = -5;
    });
    requestAnimationFrame(draw);
  }
  draw();
})();
