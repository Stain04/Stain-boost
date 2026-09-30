# StainBoost v2 — launch checklist

Everything here is on the `v2` branch. Nothing has been deployed.

## 1. Before v2: the hotfix
If you haven't yet, deploy the hotfix for the live site first. The steps are in `../hotfix-2026-09-30/HOW-TO-DEPLOY.md`.
Then send the review links from `../hotfix-2026-09-30/review-links.js` to past customers. Every verified review they post shows up on v2 automatically.

## 2. Look at v2 on your own computer
You need Node.js 24.

```
npm install
npm run preview
```

Then open http://localhost:4321. Locally the site uses a throwaway in-memory database, so you can place test orders. The local admin key is `local-admin-key`.
`npm test` checks every price against the old pricing page. `node scripts/check-urls.mjs` checks that every old URL still works.

## 3. Vercel settings
- **Framework:** Astro. `vercel.json` sets this, along with build `astro build` and output `dist`.
- **Node.js:** 24.x. `package.json` sets this, and Astro 7 needs 22.12 or newer.
- **Domains:** make `www.stainboost.com` the primary domain, and have `stainboost.com` redirect (308) to www. The canonical tags, sitemap and schema all use www.
- **Environment variables:** keep the existing ones, unchanged: `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` (or the `KV_REST_API_*` pair), `JWT_SECRET`, `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_REDIRECT_URI`, `ADMIN_USER_IDS`, `ADMIN_KEY`, `DISCORD_WEBHOOK_URL`, `GROQ_API_KEY`, `EXCHANGE_RATE_API_KEY`. If you test on a Vercel preview URL, add them to the Preview environment too.
- **Deploying:** put this branch in the GitHub repo Vercel deploys from, check the Preview deployment, then merge to production.

## 4. Discord sign-in
In the Discord Developer Portal, go to your app → OAuth2 → Redirects and add:
`https://www.stainboost.com/api/auth/discord-callback`
Then set `DISCORD_REDIRECT_URI` in Vercel to exactly that URL. Keep the old non-www redirect until v2 is live, then you can remove it.

## 5. Right after launch
- Open `/admin` and press **I'm online** once. The "Stain is online" chip stays hidden until you use the switch for the first time, so it never shows a false status.
- In Google Search Console, submit `https://www.stainboost.com/sitemap.xml`. Add the www property if it's missing.
- In GA4, go to Admin → Events and mark these as key events: `order_submitted` (the main conversion, carrying value and order token), `payment_claimed` and `begin_checkout`.
- Read `/privacy` and `/terms`. They now describe the referral credit, PayPal/Binance Pay and the refund rule, and they are your legal text.

## 6. Analytics (GA4, already wired)
The funnel runs `quote_change` → `configurator_start` → `begin_checkout` → `order_submitted` → `payment_claimed` / `discord_click`.

Other events:
- `cta_click` (with a `location`)
- `upsell_view` / `upsell_accept`
- `referral_visit` / `referral_applied` / `referral_copy`
- `pay_link_click`, `payment_method_view`
- `login_required`, `login`
- `reorder_click`, `review_submit`, `notify_signup`
- `faq_open`, `proof_click`, `chat_open`, `order_chat_send`

To see events in the browser console, run `localStorage.sb_debug_analytics = 1`.

## 7. First A/B test
**Hero live quote vs. a plain "Get my price" button.** Judge it on the configurator start rate (`configurator_start` ÷ sessions), then confirm with `order_submitted`. Run it until each version has about 300 sessions. Don't stop early on a good day.

Next tests:
- Sticky-bar wording
- Priority start pre-selected vs. not, judged on revenue per order rather than order count

## 8. Decisions still open
- **Master Yi guide speed.** It scores 82–91 on mobile. The swing comes from its 191 KB hero image, which loads from Riot's servers. Hosting a compressed ~30 KB copy on stainboost.com would make it a steady 90+, but that means downloading Riot's splash art, so it needs your OK.
- **Share images.** Every page shares the same `og-image.png`. Per-post images, with each post's title, would make links posted in Discord stand out more. This is optional.
- **Coupons.** The coupon box was replaced by the referral field. The coupon endpoint still exists, with no active codes.
- **`legacy/`.** This folder holds the old pages. The price tests compare against them, and the folder is never deployed. It can go once you're happy with the prices.

## Scores (Lighthouse mobile, local build, 2026-09-30)

| Page | Performance | Accessibility | Best practices | SEO |
|---|---|---|---|---|
| Home | 95–98 | 100 | 100 | 100 |
| Pricing | 95–98 | 100 | 100 | 100 |
| Reviews | 96–97 | 100 | 100 | 100 |
| FAQ | 99 | 100 | 100 | 100 |
| Blog index | 98–99 | 100 | 100 | 100 |
| Blog posts (sampled) | 98–99 | 100 | 100 | 100 |
| Master Yi guide | 82–91 | 100 | 100 | 100 |
| Privacy / Terms | 99 | 100 | 100 | 100 |
| Sign-in / Tracker | 99 | 100 | 100 | 66 |

The 66 SEO score on sign-in and the tracker is expected: those pages are deliberately kept out of Google (`noindex`).
