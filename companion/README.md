# StainBoost Companion

A small Node.js app that runs on the booster's PC and automatically pushes
ranked tier, LP, and game results from the live League client to the
StainBoost order tracker. No Riot API key needed — it talks to the local
League client directly (the same way Blitz / Mobalytics / Porofessor do).

## What it does

- Detects the running League of Legends client.
- Reads the current ranked solo/duo tier and LP, pushes it to the order.
- When a ranked game ends, posts the result, champion, KDA, and LP delta
  as a logged game.
- Picks the order to attach to by **matching the League account you're
  signed into** against the IGN on each active order. If exactly one
  active order has that IGN, it auto-selects. Otherwise it falls back
  to a numbered list.
- Detects **remakes** (early surrender / sub-4-minute games) and logs
  them with their own marker — no false win or loss counted.

## One-time setup

1. **Install Node.js 18 or newer** — https://nodejs.org (LTS installer).
2. Copy `config.example.json` to `config.json` in this folder.
3. Open `config.json` and fill it in:
   - `apiBase` — leave as `https://stainboost.com`.
   - `adminKey` — paste the value of the `ADMIN_KEY` env var from Vercel.
4. Done.

## Running it

Double-click `start.bat`. First run installs the `ws` dependency, then
the script starts.

- It reads the League account you're signed into and matches its IGN
  against your active orders. If exactly one matches, it attaches
  automatically.
- If no IGN match (or multiple match), it falls back to a numbered
  list — pick one.
- The order resolves fresh on every launch, so just sign into the right
  League account and run the script. To force the previously-used order
  instead (e.g. you're on a smurf), run `node companion.js --keep`.

Leave the window open while you're boosting. Each ranked solo/duo game
that finishes will appear as a logged game on `/track/<token>` within
~15 seconds of the end-of-game screen.

## What gets pushed

| Event in League client | What's sent to StainBoost |
| --- | --- |
| Ranked stats change | `currentRank`, `currentLp` |
| Game ends (queue 420 / 440) | `addGame` with result (W / L / R for remake), champion, KDA, and LP delta (skipped on remakes) |

The companion only watches **ranked solo/duo** (queue 420) and falls back
to **flex** (440) if no solo games are recent. Normal / ARAM / TFT games
are ignored.

## Troubleshooting

- **"Waiting for League client…" forever** — make sure the client is
  actually running (not just the game). On Windows, the process is
  `LeagueClientUx.exe`. The app polls every 3 seconds.
- **"LCU /…  → 404"** — the client is up but the summoner isn't logged
  in yet. Just sign in.
- **"401" calling stainboost.com** — your `adminKey` in `config.json`
  doesn't match the Vercel `ADMIN_KEY` env var.
- **LP delta missing on a logged game** — the script didn't see the
  pre-game LP (e.g. you started the companion mid-game, or the game was
  a promotion/demotion match). Result and KDA still log correctly.

## Security note

`config.json` contains your admin key. Do **not** commit it. The
included `.gitignore` blocks it, but check before pushing if you're
working from a clone.
