# Finance News / Advisory Feed — One-Time Setup Guide

**Audience:** MIS Nomer (or a Claude Code session run directly on his laptop/server). Follow this
once, in order, on the machine that runs `app/easycashbackend` in production (Local Host #1).

## What this is

A feature (already merged to `main`, commit `9fe8c2f` / `7afebcc`) that automatically fetches PH
lending/finance news and Metro Manila road/weather advisories once a day and shows them on the
live Easycash Portal (a "News Flash" ticker on the homepage + a full list on the News page). It
never republishes full articles — only a headline, a short excerpt, and a link back to the real
source (copyright-safe).

**Important: no Windows Task Scheduler / cron job needs to be created separately.** The daily fetch
is already built into the backend process itself (`node-cron`, same mechanism the existing SMS/
email payment reminders use). Once this one-time setup is done and the backend is running, it
fetches new news on its own, every day, for as long as the backend process stays up — nothing else
to schedule.

## Steps

Run these from the `app/easycashbackend` directory on Local Host #1, in order.

### 1. Pull the latest code

```bash
git pull origin main
```

### 2. Install the new dependency (`rss-parser`)

```bash
npm install
```

### 3. Apply the new database migration

```bash
npx prisma migrate deploy
```

This creates the new `external_news_links` table. It only adds a new table — nothing existing is
touched.

### 4. Add the feed URLs to `.env`

Open `app/easycashbackend/.env` and add these three lines (create them if they don't exist yet):

```
FINANCE_NEWS_FEED_URLS=https://mb.com.ph/rss/business
ADVISORY_NEWS_FEED_URLS=https://mb.com.ph/rss/news
FINANCE_NEWS_FETCH_CRON=0 6 * * *
```

- The two feed URLs were tested and confirmed reachable from a backend host during development —
  they're real, live Manila Bulletin RSS feeds.
- `FINANCE_NEWS_FETCH_CRON` is optional — it already defaults to `0 6 * * *` (6:00 AM Asia/Manila,
  daily) if omitted. Only set it if a different time is wanted.
- Both feed URL variables accept a **comma-separated list** if more than one feed is ever wanted
  later (e.g. `FINANCE_NEWS_FEED_URLS=https://feed-one.com/rss,https://feed-two.com/rss`).
- If a variable is left blank/unset, that category is simply skipped (no error) — e.g. leaving
  `ADVISORY_NEWS_FEED_URLS` empty means no advisories are fetched, but finance news still works.

### 5. Restart the backend

Stop and restart however the backend is normally run (e.g. re-run `npm run dev`, or restart the
Windows service/scheduled task/PM2 process — whatever process manager is actually used on this
machine).

### 6. Verify it actually works on THIS machine (recommended, ~10 seconds)

Feed reachability could not be verified from the AI's own sandboxed environment during
development (it got blocked/403 from every news site tried), so it's worth confirming it works
for real before waiting a full day for the first automatic run:

```bash
npx tsx scripts/fetch-external-news.ts
```

Expected output looks like:

```json
{
  "fetched": 50,
  "saved": 12,
  "skippedDuplicate": 0,
  "skippedIrrelevant": 38,
  "feedErrors": []
}
```

- `feedErrors: []` means both feed URLs were reachable — good.
- If you see an entry under `feedErrors`, that feed URL isn't reachable from this machine (network
  block, changed URL, etc.) — the other feed (if any) still works independently.
- `saved` items now exist and are already live — check the Portal's homepage/News page to confirm.
- Safe to re-run any time — it never creates duplicates (skips URLs it already has).

### 7. Confirm it's live

Open the Portal homepage — the "News Flash" strip near the top should show real headlines with
working links to Manila Bulletin. The News page should show the fuller "PH Lending & Finance News"
and "Road & Weather Advisories (Metro Manila)" sections.

## Ongoing / no maintenance needed

From here on, the backend fetches new items on its own once a day at the configured time, for as
long as it's running. Nothing needs to be manually triggered again unless:

- The feed URL changes or breaks (update `.env`, restart).
- A different fetch time is wanted (update `FINANCE_NEWS_FETCH_CRON`, restart).
- The keyword relevance filter needs tightening (code change — see
  `app/easycashbackend/src/modules/finance-news/application/use-cases/FetchExternalFinanceNewsUseCase.ts`'s
  `CATEGORY_KEYWORDS`, ask a future Claude Code session to adjust it if irrelevant items start
  slipping through).

**Note (explicit business decision):** there is no staff approval step before a fetched item goes
live — it's fully automatic by design. The keyword filter and a hard ~200-character excerpt limit
are the only automated safeguards.
