// Every URL the old site had must still work: 200, or a permanent redirect to a 200.
// Usage: node scripts/check-urls.mjs [baseUrl]   (default http://localhost:4321 — run `npm run preview` first)
import fs from 'node:fs';

const BASE = process.argv[2] || 'http://localhost:4321';
const legacySitemap = fs.readFileSync(new URL('../legacy/sitemap.xml', import.meta.url), 'utf8');
const paths = new Set([...legacySitemap.matchAll(/<loc>https:\/\/stainboost\.com([^<]*)<\/loc>/g)].map((m) => m[1] || '/'));
const vercel = JSON.parse(fs.readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
// old root-level article URLs, and the old *.html addresses
for (const r of vercel.redirects) if (!r.source.includes(':')) paths.add(r.source);
for (const p of ['/index.html', '/pricing.html', '/reviews.html', '/faq.html', '/privacy.html', '/terms.html', '/blog/', '/blog/index.html', '/blog/elo-boosting-safe.html',
  '/login', '/dashboard', '/admin', '/track', '/track/SB-ABCD-1234', '/review/SB-ABCD-1234',
  '/robots.txt', '/sitemap.xml', '/site.webmanifest', '/favicon.ico', '/favicon-48.png', '/apple-touch-icon.png', '/icon-192.png', '/icon-512.png', '/og-image.png', '/avatar.jpeg', '/BingSiteAuth.xml', '/sw.js']) paths.add(p);

let bad = 0;
for (const p of [...paths].sort()) {
  let url = BASE + p, hops = [], status;
  for (let i = 0; i < 5; i++) {
    const r = await fetch(url, { redirect: 'manual' });
    status = r.status;
    if ([301, 308].includes(status)) { hops.push(status); url = new URL(r.headers.get('location'), url).href; continue; }
    if ([302, 307].includes(status)) { hops.push(status + '(temporary!)'); url = new URL(r.headers.get('location'), url).href; continue; }
    break;
  }
  const ok = status === 200 && !hops.some((h) => String(h).includes('temporary'));
  if (!ok) bad++;
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${p}${hops.length ? ` → ${hops.join('→')} → ${url.replace(BASE, '')}` : ''} [${status}]`);
}
// URLs that must NOT be downloadable any more
for (const p of ['/lib/auth.js', '/api/_lib/auth.js', '/dev-server.js', '/order.js', '/remaining_tasks.txt', '/legacy/index.html', '/src/data/pricing.js', '/package.json']) {
  const r = await fetch(BASE + p); // follows the .html → clean-URL redirect
  const blocked = r.status === 404;
  if (!blocked) bad++;
  console.log(`${blocked ? 'OK  ' : 'FAIL'} not served: ${p} [${r.status}]`);
}
console.log(bad ? `\n${bad} problem(s)` : '\nAll old URLs work and private files are not served.');
process.exit(bad ? 1 : 0);
