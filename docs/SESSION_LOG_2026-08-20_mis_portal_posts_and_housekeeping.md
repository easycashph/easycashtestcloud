# Session Log — 2026-08-20: MIS Portal Posts, repo housekeeping, git identity

## What was done, in order

1. **About page cleanup** — removed the "Founding Development Credits" card from the LMS About
   page (redundant with the Developer Team card, which already credits Jomer Biason under
   Easycash Dev); recorded the founding-engineer credit in the v0.9.32 changelog entry instead.

2. **Root folder reorganization** — moved 10 loose `.bat`/`.ps1`/`.command` scripts from the repo
   root into `scripts/`, and 2 stale cloudflared log files into a new `logs/`. Fixed each moved
   script's `ROOT_DIR`/`RepoRoot` path resolution (they were `%~dp0`-relative to the old root
   location, now one level up). Also rewrote the stale, pre-launch-era `README.md` to reflect the
   platform's actual current state (both LMS and Portal live in production).

3. **Docker WSL2 vhdx cleanup tooling** — cleaned ~926 MB of stale Docker build cache, and added
   `scripts/shrink-docker-vhdx.bat` (self-elevating, auto-locates any Docker Desktop WSL2 vhdx
   under `%LOCALAPPDATA%\Docker\wsl`, compacts via diskpart) so disk space actually returns to
   Windows, not just Docker's internal accounting.

4. **Git identity** — set the global git identity to the user's personal account (`MIS Jomer`
   <jomerbiason@gmail.com>) so commit authorship attributes correctly on GitHub across every repo
   on this device, not just this one via the pre-existing local override.
   - **Attempted, then reverted**: switching the repo-local push *credential* (`credential.username`)
     from `easycashph` to `jomerbiason` to also push as the personal account. The cached
     `jomerbiason` GCM token failed against this private repo (`Repository not found`) even though
     the user said collaborator access exists — reverted immediately to `easycashph` (known-working)
     rather than leave push broken. **Follow-up needed**: user should re-authenticate as
     `jomerbiason` via a fresh browser login and confirm actual collaborator status on
     `easycashph/easycash-lms` before retrying.

5. **MIS Portal Posts feature** (the bulk of this session) — see design section below.

6. **Remote Postgres snapshot backup** — new `scripts/Backup Remote Postgres Snapshot.bat` +
   gitignored `local/backup-remote-postgres.ps1`, at MIS Nomer's request: pulls a `pg_dump`
   snapshot directly from the office server's Postgres over the network (port 5432 is directly
   reachable), the same idea as the existing manual MongoDB-dump-from-SDevTech flow but without
   the manual zip-and-drop step. Connection details live in a gitignored, auto-templated
   `local/postgres-remote-backup.env`; the tracked `.bat` carries no credentials.

## MIS Portal Posts — design and why

User request (paraphrased across several messages): MIS should be able to post Facebook-style
content (image + caption) to the Portal, the way they already post to the company Facebook Page.
Two distinct behaviors were wanted:

- **Automatic daily post** — one live at a time, cycling through a pool, 24 hours each, no MIS
  action needed day to day.
- **Manual/custom post** — MIS posts something ad-hoc (e.g. a typhoon/office-closure notice),
  shown *alongside* the automatic post, disappearing after a MIS-chosen duration (30-minute
  default preset, to make posting fast).

Placement, confirmed via follow-up: the News Flash ticker (existing external-news component)
stays external-news-only and just gained a continuous right-to-left scroll animation
(NBA-draft-pick style) — MIS posts are deliberately **not** mixed into it. Instead, MIS posts
(manual + the current auto post) render as full, non-scrolling cards **above** the ticker on the
homepage, and lead the News & Announcements page (ahead of the external news sections).

### Data model

New `MisPost` Prisma model (`mis_posts` table), deliberately its own module rather than folded
into the existing `SystemAnnouncement` (text-only single-active-popup model) — different shape
(image-bearing, multi-post feed with a rotation schedule) and different lifecycle. One `MisPostType`
enum covers both kinds:

- `AUTO_ROTATION` — has `poolOrder` (fixed sequence position) and `isCurrentlyLive` (exactly one
  true at a time); a daily cron (`misPostRotationScheduler.ts`, `MIS_POST_ROTATION_CRON` env,
  default midnight Asia/Manila) advances to the next pool item, wrapping around.
- `MANUAL` — has `publishedAt`/`expiresAt` (duration-based) and `withdrawn` (early pull-down by
  MIS); visibility is just "not withdrawn and not yet expired," checked at read time, no cron
  needed for expiry.

### Backend (`app/easycashbackend/src/modules/mis-post/`)

Full Clean Architecture module mirroring `system-announcement`'s shape: domain entity, repository
port + Prisma implementation, use cases (`CreateManualMisPostUseCase`,
`WithdrawManualMisPostUseCase`, `ListMisPostsForAdminUseCase`, `GetActivePortalPostsUseCase`,
`AdvanceAutoRotationUseCase`, `GetMisPostImageUseCase`), MIS-only router (reuses the existing
`system_announcement.manage` permission rather than adding a near-duplicate) and a public,
unauthenticated router for the Portal (`/portal/mis-posts/active`, `/portal/mis-posts/:id/image`).

Images upload via the same `IFileStorage` port/multer-memory pattern as
`UploadAttachmentUseCase`. One real bug caught and fixed during verification: the public image
route was blocked in the browser with `ERR_BLOCKED_BY_RESPONSE.NotSameOrigin` — Helmet's default
`Cross-Origin-Resource-Policy: same-origin` blocked the Portal (different port) from rendering the
image; fixed by setting `Cross-Origin-Resource-Policy: cross-origin` on that one response only,
not globally.

### Seed data

`scripts/seed-mis-post-pool.ts` (idempotent, `--apply` required to write) imports 17 of the 18
numbered image+caption pairs from `legacy/reports/Meta Business Suite/` (skips
`15(outdated easycash office).png` — already marked stale in its own filename) as the starting
`AUTO_ROTATION` pool, captions transcribed from `000 Meta Ads captions.docx`. Ran once for real
against the local dev DB; the first pool item was lit up as the initial live post. That source
folder was added to `.gitignore` afterward (repo-size reasons, same as other `legacy/reports/*`
exclusions — already copied into the backend's own gitignored storage volume by the seed script).

### Frontend

- **LMS** (`AnnouncementsTab.tsx`) — new "Portal Posts" card: read-only status of today's
  auto-rotation post, a Facebook-style composer (image + caption + duration preset dropdown,
  defaulting to 30 minutes), and manual-post history with a Withdraw action.
- **Portal** — new `MisPostBanner.tsx` (homepage, above `NewsFlashTicker`), `NewsPage.tsx` updated
  to show the same posts first, `NewsFlashTicker.tsx` given the marquee animation
  (`tailwind.config.ts` gained the `marquee` keyframe/animation).

## Verification

- `tsc --noEmit` clean on backend, LMS frontend, and Portal frontend.
- `prisma migrate dev` applied cleanly against local dev Postgres.
- Rebuilt and restarted all three Docker containers (backend, lmsfrontend, portalfrontend) — one
  container-name conflict from two concurrent `docker compose up` runs, resolved with a final
  `docker compose up -d` reconciliation pass.
- Confirmed via curl: `/portal/mis-posts/active` returns the seeded live post, the image route
  streams real bytes with the correct content-type.
- Confirmed in-browser (Portal homepage): the MIS post image actually renders (`naturalWidth:
  1080`, `complete: true`), and the marquee CSS (`@keyframes marquee` / `.animate-marquee`) is
  present in the compiled stylesheet (couldn't visually confirm the scroll itself locally — no
  finance-news feed URLs are configured in this dev environment, so the ticker currently has no
  items to scroll).
- Could **not** verify the LMS composer UI end-to-end — entering the LMS password via browser
  automation was correctly blocked by the permission classifier (credential entry). Backend
  auth-gating was confirmed instead (`GET /api/v1/mis-posts` → 401 without a token).

## Current state / known follow-ups

- MIS Portal Posts and the remote Postgres backup script are both committed to `main` (not yet
  pushed as of this log — confirm with the user before pushing).
- Git push credential for this repo is still `easycashph` (working); switching to `jomerbiason`
  needs a fresh browser re-auth first (see item 4 above).
- The News Flash ticker's scroll animation is implemented and compiles correctly but has never
  been visually confirmed with real content, since `FINANCE_NEWS_FEED_URLS`/`ADVISORY_NEWS_FEED_URLS`
  are unset in this dev environment.
- LMS Portal Posts composer UI was code-reviewed and type-checked but not click-tested live.
- The office server's live deployment still needs the same rebuild-and-migrate steps this session
  ran locally (`prisma migrate deploy`, then `seed-mis-post-pool.ts --apply` once, then restart)
  before MIS Portal Posts is actually usable in production - not yet done as of this log.
