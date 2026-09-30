// `npm run preview`: serves the built site (dist/) the way vercel.json does, plus /api.
import './local/hooks.mjs';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { handleApi } from './local/api.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const PORT = Number(process.env.PORT || 4321);
const vercel = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.xml': 'application/xml', '.txt': 'text/plain', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };
const pattern = (src) => new RegExp('^' + src.replace(/:[a-z]+/gi, '[^/]+') + '$');

function fileFor(p) {
  const clean = p.replace(/\/+$/, '') || '/';
  const tries = clean === '/' ? ['index.html'] : [clean.slice(1), clean.slice(1) + '.html', clean.slice(1) + '/index.html'];
  for (const t of tries) { const f = path.join(DIST, t); if (f.startsWith(DIST) && fs.existsSync(f) && fs.statSync(f).isFile()) return f; }
  return null;
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  let p = decodeURIComponent(url.pathname);
  // Same response headers as vercel.json (incl. the Content-Security-Policy), so CSP issues show up locally.
  for (const h of vercel.headers || []) {
    if (new RegExp('^' + h.source + '$').test(p)) for (const { key, value } of h.headers) if (key !== 'Strict-Transport-Security') res.setHeader(key, value);
  }
  try {
    if (p.startsWith('/_vercel/')) { res.setHeader('Content-Type', 'text/javascript'); return res.end(''); }
    if (p.startsWith('/api/')) return await handleApi(ROOT, req, res, url);
    if (vercel.trailingSlash === false && p.length > 1 && p.endsWith('/')) { res.writeHead(308, { Location: p.replace(/\/+$/, '') + url.search }); return res.end(); }
    for (const r of vercel.redirects || []) if (pattern(r.source).test(p)) { res.writeHead(r.permanent ? 308 : 307, { Location: r.destination }); return res.end(); }
    if (vercel.cleanUrls && p.endsWith('.html')) { res.writeHead(308, { Location: p.replace(/(index)?\.html$/, '') || '/' }); return res.end(); }
    for (const r of vercel.rewrites || []) if (pattern(r.source).test(p)) { p = r.destination; break; }
    const f = fileFor(p);
    if (!f) { res.writeHead(404, { 'Content-Type': MIME['.html'] }); return res.end(fs.readFileSync(path.join(DIST, '404.html'))); }
    const type = MIME[path.extname(f)] || 'application/octet-stream';
    // Compress text like Vercel does, so local Lighthouse runs are realistic.
    if (/text|javascript|json|xml|svg|manifest/.test(type) && /\bgzip\b/.test(req.headers['accept-encoding'] || '')) {
      res.writeHead(200, { 'Content-Type': type, 'Content-Encoding': 'gzip', Vary: 'Accept-Encoding' });
      return fs.createReadStream(f).pipe(zlib.createGzip()).pipe(res);
    }
    res.writeHead(200, { 'Content-Type': type });
    fs.createReadStream(f).pipe(res);
  } catch (e) { console.error(e); if (!res.headersSent) { res.writeHead(500); res.end('Server error'); } }
}).listen(PORT, () => console.log(`StainBoost preview: http://localhost:${PORT}`));
