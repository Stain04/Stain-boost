// JSON-LD builders. Numbers come from the same data the page shows.
import { SITE, DISCORD, STATS } from './site.js';
import { WIN_PRICES, RB_DIV_PRICE } from './pricing.js';
import { ratingSummary } from './reviews.js';

export function organization() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': SITE.url + '/#org',
    name: SITE.name,
    url: SITE.url + '/',
    logo: SITE.url + '/icon-512.png',
    description: `League of Legends ELO boosting on the Middle East server, played personally by Stain — #1 Master Yi on ME. ${STATS.ordersCompleted}+ completed orders.`,
    sameAs: [DISCORD.invite],
  };
}

export function website() {
  return { '@context': 'https://schema.org', '@type': 'WebSite', '@id': SITE.url + '/#site', name: SITE.name, url: SITE.url + '/', publisher: { '@id': SITE.url + '/#org' } };
}

/** The boosting service as a Product with real offers and real (verified) reviews. */
export function boostProduct(reviews) {
  const winLow = Math.min(...Object.values(WIN_PRICES).map((p) => p.solo));
  const winHigh = Math.max(...Object.values(WIN_PRICES).map((p) => p.duo));
  const divLow = Math.min(...Object.values(RB_DIV_PRICE).map((p) => p.solo));
  const divHigh = Math.max(...Object.values(RB_DIV_PRICE).map((p) => p.duo));
  const r = ratingSummary(reviews);
  const out = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: 'StainBoost ELO Boosting — Middle East server',
    description: `League of Legends rank boost and net-win boost on the Middle East server, played by Stain (#1 Master Yi on ME). ${STATS.ordersCompleted}+ completed orders, ${STATS.bans} bans.`,
    brand: { '@type': 'Brand', name: SITE.name },
    image: SITE.url + '/og-image.jpg',
    url: SITE.url + '/pricing',
    offers: [
      { '@type': 'AggregateOffer', name: 'Net win boost (price per win)', priceCurrency: 'USD', lowPrice: winLow.toFixed(2), highPrice: winHigh.toFixed(2), availability: 'https://schema.org/InStock', url: SITE.url + '/pricing?mode=wins' },
      { '@type': 'AggregateOffer', name: 'Rank boost (price per division)', priceCurrency: 'USD', lowPrice: divLow.toFixed(2), highPrice: divHigh.toFixed(2), availability: 'https://schema.org/InStock', url: SITE.url + '/pricing' },
    ],
  };
  if (r.count) {
    out.aggregateRating = { '@type': 'AggregateRating', ratingValue: r.avg.toFixed(1), reviewCount: String(r.count), bestRating: '5', worstRating: '1' };
    out.review = reviews.map((x) => ({
      '@type': 'Review',
      author: { '@type': 'Person', name: x.name },
      reviewRating: { '@type': 'Rating', ratingValue: String(x.stars), bestRating: '5' },
      reviewBody: x.text,
    }));
  }
  return out;
}

export function breadcrumbs(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: SITE.url + it.path })),
  };
}
