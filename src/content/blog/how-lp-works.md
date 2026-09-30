---
title: "How LP Works in League of Legends (Promotions, Demotions & Decay) [2026]"
h1: "How LP Works in League of Legends (Full Breakdown)"
description: "LP explained — how it's calculated, promotion series, demotion shields, decay rules, and exactly what controls how much LP you gain or lose per game."
category: "ELO Boosting Explained"
excerpt: "LP explained — how it's calculated, promotion series, demotion shields, decay rules, and exactly what controls your LP gains."
emoji: "📊"
readTime: "7 min read"
published: 2026-04-30
updated: 2026-04-30
order: 1
---
<p>LP — League Points — is the visible currency of ranked progress. It's the number that goes up after wins and down after losses, the bar you watch fill toward 100 to promote, the score you check after every game. Despite being the most-watched number in League, almost nothing about how it actually works is explained in-game. This guide is the complete breakdown.</p>
<h2 id="what-is-lp">What LP Actually Is</h2>
<p>LP is a 0–100 progress meter within each division. Every ranked tier (Iron, Bronze, Silver, Gold, Platinum, Emerald, Diamond) has four divisions (IV, III, II, I), and each division has 100 LP. When you reach 100 LP in your current division, you promote — usually directly into the next division, sometimes through a promotion series.</p>
<p>LP is <em>not</em> your skill rating. The skill rating is MMR, which is hidden. LP is what's <em>visible</em>. The relationship matters: LP is the result of MMR, not the cause. If you don't have a clear sense of how MMR drives LP, our <a href="/blog/what-is-mmr-league-of-legends">MMR explained guide</a> covers it in detail.</p>
<h2 id="how-calculated">How LP Per Game is Calculated</h2>
<p>The amount of LP you gain or lose per game is determined by one factor above all others: <strong>the gap between your current rank and your hidden MMR</strong>. The system is constantly trying to push your visible rank toward your MMR, and it does that through asymmetric LP rewards.</p>
<h3>Healthy MMR (rank matches MMR)</h3>
<p>Roughly +20 to +24 LP per win and −16 to −19 per loss. This is the baseline most players experience when their account isn't damaged.</p>
<h3>MMR above rank (underranked)</h3>
<p>+25 to +30+ LP per win, −10 to −15 per loss. The system thinks you belong higher and is rushing you up.</p>
<h3>MMR below rank (overranked)</h3>
<p>+10 to +15 LP per win, −22 to −28 per loss. The system thinks you belong lower and is dragging you down.</p>
<p>Performance — KDA, damage, vision score — has historically had little to no impact on LP gains in solo queue. Riot has experimented with performance-based LP at various points but the dominant input has always been MMR. Win or lose is what counts.</p>
<div class="callout">
<p><strong>Note for ME server:</strong> The exact LP numbers vary by region and time of season. Middle East server tends to give slightly more aggressive LP gains during fresh seasons because the player base is smaller and matchmaking sorts faster.</p>
</div>
<h2 id="promotion">Promotion Series &amp; Tier Promotions</h2>
<p>Reaching 100 LP doesn't always promote you immediately. The current rules:</p>
<ul>
<li><strong>Division promotions (e.g. Gold IV → Gold III):</strong> No promotion series. You promote automatically when you cross 100 LP, with overflow LP carrying into the new division.</li>
<li><strong>Tier promotions (e.g. Gold I → Platinum IV):</strong> Promotion series. Best of 5 games, win 3 to promote. If you fail the series, you stay at 75 LP in your previous division and must re-attempt.</li>
</ul>
<p>Tier promotion series are higher-stakes than they look. Failing a Gold I → Platinum IV series doesn't just delay you — it often resets MMR adjustment slightly because you've now logged additional games at "above your tier" matchmaking. Failed series can compound into broken MMR over time.</p>
<h2 id="demotion">Demotion Rules &amp; Demotion Shields</h2>
<p>Demotion is asymmetric with promotion — and that's intentional protection.</p>
<h3>Division demotion</h3>
<p>You can't be demoted from a division until your LP hits 0 AND you lose another game (the "demotion shield"). When you've just promoted into a new division, you have an additional ~3-game shield where losses don't drop you below 0.</p>
<h3>Tier demotion</h3>
<p>Tier demotions (e.g. Platinum IV back to Gold I) are even harder. You need 0 LP, multiple consecutive losses, and an MMR low enough that the system actively pushes you down. Many players sit at 0 LP in a tier-base division for weeks losing without dropping back to the previous tier.</p>
<div class="callout-green">
<p><strong>💡 Why this matters:</strong> If you barely scrape into a new tier with broken MMR, the demotion shield holds you in place while MMR repair happens (slowly) through the games you continue to play. The wider the gap between your rank and MMR, the more painful those early games at 0 LP feel.</p>
</div>
<h2 id="decay">LP Decay (Diamond+ Only)</h2>
<p>Decay is automatic LP loss for inactivity. It only affects Diamond and above:</p>
<ul>
<li><strong>Diamond:</strong> Decay starts after 28 days of inactivity. After that, you lose 75 LP per 7 days of further inactivity.</li>
<li><strong>Master / GM / Challenger:</strong> Decay starts after 10 days. You bank "decay protection" by playing ranked games (1 day of protection per game played, capped).</li>
</ul>
<p>Lower tiers (Emerald and below) don't decay LP, though they decay your visible position to a degree across long inactivity. For most ME server players who play multiple games per week, decay isn't a concern.</p>
<h2 id="apex-lp">Master/GM/Challenger LP</h2>
<p>The apex tiers — Master, Grandmaster, Challenger — don't have divisions. They use a flat LP system where your number simply keeps growing. The cutoffs between Master, Grandmaster, and Challenger are dynamic — based on the LP rankings of all apex players on your server, not fixed thresholds. So Challenger on ME is whoever has the top ~50 LP totals, GM is the next ~200, and Master is everyone above the apex baseline.</p>
<p>This is why reaching Master is meaningfully different from reaching Diamond — there's no ceiling, no badge progression beyond the tier name, just LP. Our <a href="/blog/how-to-reach-master">how to reach Master guide</a> walks through what this looks like in practice.</p>
<h2 id="max-lp">How to Maximize LP Gains</h2>
<p>The straightforward levers, in order of impact:</p>
<ol>
<li><strong>Healthy MMR.</strong> The single biggest factor. If you're gaining 13 LP per win, fix that before anything else — full diagnostic in our <a href="/blog/why-lp-gains-are-low">low LP gains guide</a>.</li>
<li><strong>Avoid concentrated losses.</strong> Two losses in a row → stop playing for the day. Three or more concentrated losses damage MMR disproportionately.</li>
<li><strong>Don't dodge queue.</strong> Each dodge costs LP directly (3 or 6 depending on count) and contributes to MMR instability over time.</li>
<li><strong>Stick to a tight champion pool.</strong> Two champions per role, ~20+ games each. Switching kills consistency.</li>
<li><strong>Play your peak hours.</strong> Better matchmaking quality during peak server hours — see our <a href="/blog/best-times-to-play-ranked">best times to play ranked guide</a> for ME-specific timing.</li>
</ol>
<p>If your LP is currently broken and self-grinding the repair feels impossible, a targeted win boost is the most direct fix. Pricing on our <a href="/pricing">Pricing page</a>.</p>
<div class="cta-box">
<h3>Repair LP Gains Fast</h3>
<p>5–10 win boost from the #1 Master Yi on Middle East server. Restores normal LP gains in days.</p>
<a href="/pricing" class="btn-primary">
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
See Pricing
</a>
</div>
