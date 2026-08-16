import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 3000);

const winPrices = {
  Iron: { solo: 1.5, duo: 2.5 },
  Bronze: { solo: 2, duo: 3 },
  Silver: { solo: 2.5, duo: 3.5 },
  Gold: { solo: 3.5, duo: 5 },
  Platinum: { solo: 5, duo: 6.5 },
  Emerald: { solo: 5.5, duo: 8 },
  'Diamond IV-III': { solo: 8, duo: 12 },
  'Diamond II-I': { solo: 10, duo: 16 },
  Masters: { solo: 15, duo: 20 },
};

const rbDivPrice = {
  Iron: { solo: 7, duo: 11.5 },
  Bronze: { solo: 9, duo: 14 },
  Silver: { solo: 12, duo: 17 },
  Gold: { solo: 16.5, duo: 23.5 },
  Platinum: { solo: 23.5, duo: 31 },
  Emerald: { solo: 26.5, duo: 38 },
  DiamondL: { solo: 37, duo: 57 },
  DiamondH: { solo: 47, duo: 72 },
};

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
};

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function cleanUrlToFile(pathname) {
  const clean = pathname.replace(/\/+$/, '') || '/';
  if (clean === '/') return 'index.html';
  if (clean === '/pricing') return 'pricing.html';
  if (clean === '/reviews') return 'reviews.html';
  if (clean === '/faq') return 'faq.html';
  if (clean === '/dashboard') return 'dashboard.html';
  if (clean === '/login') return 'login.html';
  if (clean === '/admin') return 'admin.html';
  if (clean === '/track' || /^\/track\/[^/]+$/i.test(clean)) return 'track.html';
  if (clean === '/review' || /^\/review\/[^/]+$/i.test(clean)) return 'review.html';
  if (clean === '/blog') return 'blog/index.html';
  if (/^\/blog\/[a-z0-9-]+$/i.test(clean)) return clean.slice(1) + '.html';
  return decodeURIComponent(pathname).replace(/^\/+/, '');
}

async function handleApi(req, res, url) {
  if (url.pathname === '/api/prices') return sendJson(res, 200, { winPrices, rbDivPrice });
  if (url.pathname === '/api/exchange-rate') return sendJson(res, 200, { rate: 54.6, fallback: true, local: true });
  if (url.pathname === '/api/auth/me') return sendJson(res, 200, { user: null });
  if (url.pathname === '/api/reviews' && req.method === 'GET') return sendJson(res, 200, []);
  if (url.pathname === '/api/validate-coupon') return sendJson(res, 200, { valid: false, local: true });
  if (url.pathname === '/api/order') {
    return sendJson(res, 401, {
      error: 'Local preview server does not create real orders. Deploy on Vercel or use Vercel dev for full API behavior.',
      requireLogin: true,
    });
  }
  return sendJson(res, 404, { error: 'Local API fallback not implemented.' });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || `localhost:${port}`}`);

  if (url.pathname.startsWith('/api/')) {
    await handleApi(req, res, url);
    return;
  }

  const rel = cleanUrlToFile(url.pathname);
  const target = path.resolve(root, rel);
  if (!target.startsWith(root)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  try {
    const data = await readFile(target);
    res.writeHead(200, { 'Content-Type': mime[path.extname(target)] || 'application/octet-stream' });
    res.end(data);
  } catch {
    // mirror Vercel: serve the branded 404 page with a 404 status
    try {
      const nf = await readFile(path.resolve(root, '404.html'));
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(nf);
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
    }
  }
});

server.listen(port, () => {
  console.log(`StainBoost local preview: http://localhost:${port}`);
});
