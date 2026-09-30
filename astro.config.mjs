import { defineConfig } from 'astro/config';

// Static site. /api/* are Vercel Functions (see /api) — in local dev they are
// served by scripts/dev.mjs and proxied here.
export default defineConfig({
  site: 'https://www.stainboost.com',
  output: 'static',
  trailingSlash: 'never',
  build: {
    format: 'file',            // /pricing -> pricing.html (Vercel cleanUrls serves it at /pricing)
    inlineStylesheets: 'always', // no render-blocking CSS request
  },
  compressHTML: true,
  prefetch: { prefetchAll: false, defaultStrategy: 'hover' },
  vite: {
    server: { proxy: { '/api': 'http://localhost:4011' } },
  },
});
