// GA4 event helper. Events queue in dataLayer until gtag.js loads (see Base.astro),
// so nothing is lost when an event fires before GA is ready.
// Funnel: quote_change → configurator_start → begin_checkout → order_submitted → discord_click / payment_claimed
export function track(event, params = {}) {
  try {
    if (typeof window.gtag === 'function') window.gtag('event', event, params);
    if (window.localStorage && localStorage.getItem('sb_debug_analytics')) console.info('[track]', event, params);
  } catch { /* never break the page for analytics */ }
}

/** Page section a click came from — nearest [data-loc], else the path. */
export function locationOf(node) {
  const host = node && node.closest ? node.closest('[data-loc]') : null;
  return host ? host.getAttribute('data-loc') : location.pathname;
}
