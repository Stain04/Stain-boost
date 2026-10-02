// /sitemap.xml — generated at build time: public pages + every blog post.
import { getCollection } from 'astro:content';
import { SITE } from '../data/site.js';
import { CLIMBS } from '../data/climbs.js';

const PAGES = [
  { path: '/', priority: '1.0', changefreq: 'weekly' },
  { path: '/pricing', priority: '0.9', changefreq: 'weekly' },
  { path: '/reviews', priority: '0.8', changefreq: 'weekly' },
  { path: '/faq', priority: '0.7', changefreq: 'monthly' },
  { path: '/blog', priority: '0.8', changefreq: 'weekly' },
  { path: '/boost', priority: '0.8', changefreq: 'weekly' },
  { path: '/ar', priority: '0.9', changefreq: 'weekly' },
  // one page per popular climb, in English and Arabic
  ...CLIMBS.flatMap((c) => [{ path: `/boost/${c.slug}`, priority: '0.8', changefreq: 'weekly' }, { path: `/ar/boost/${c.slug}`, priority: '0.7', changefreq: 'weekly' }]),
  { path: '/privacy', priority: '0.3', changefreq: 'yearly' },
  { path: '/terms', priority: '0.3', changefreq: 'yearly' },
];

export async function GET() {
  const today = new Date().toISOString().slice(0, 10);
  const posts = await getCollection('blog', (p) => !p.data.draft);
  const urls = [
    ...PAGES.map((p) => ({ loc: SITE.url + (p.path === '/' ? '/' : p.path), lastmod: today, ...p })),
    ...posts.map((p) => ({ loc: `${SITE.url}/blog/${p.id}`, lastmod: (p.data.updated ?? p.data.published).toISOString().slice(0, 10), changefreq: 'monthly', priority: '0.7' })),
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${u.loc}</loc><lastmod>${u.lastmod}</lastmod><changefreq>${u.changefreq}</changefreq><priority>${u.priority}</priority></url>`).join('\n')}
</urlset>
`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
}
