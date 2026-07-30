# Instructions for the Claude Code agent on MIS Nomer's laptop

## Context

Easycash Portal and Easycash LMS frontend are now officially hosted on Cloudflare Pages
(decided 2026-07-30 by Jomer). Live URLs:

- LMS: `https://easycash-lms.pages.dev`
- Portal: `https://easycash-portal.pages.dev`

Both call the backend API directly from the browser. If MIS Nomer's laptop is running the
backend that these two live sites talk to, its CORS allow-list must include both `pages.dev`
origins, or every API request from them (login, dashboard data, loan application submission,
etc.) will be rejected by the browser as a CORS violation — the sites will load, but nothing
that calls the API will work.

Separately, the main monorepo (`easycashph/easycash-lms`) had its top-level app folders
officially renamed on 2026-07-30 (commit `096519b`):

- `app/frontend` → `app/lmsfrontend`
- `app/portal` → `app/portalfrontend`
- `app/backend` → `app/easycashbackend`

If this laptop hasn't pulled that commit yet, the folders will still be under the old names.
Handle both possibilities below.

## Task

### 1. Pull the latest `main`

```bash
git pull origin main
```

If this fails or there are local uncommitted changes, stop and ask the user (Nomer) how to
proceed rather than discarding anything — do not `git reset --hard` or `git stash` without
his say-so.

### 2. Locate the backend's `.env`

After a successful pull, the backend directory is `app/easycashbackend/`. If for any reason
this laptop is still on the old layout (didn't pull commit `096519b`), it will instead be
`app/backend/` — check which one actually exists before proceeding:

```bash
ls app/easycashbackend/.env 2>/dev/null || ls app/backend/.env
```

### 3. Update `CORS_ORIGIN`

Open that `.env` file and find the `CORS_ORIGIN` line. Add the two `pages.dev` origins to the
existing comma-separated list — don't remove whatever's already there (likely local dev
origins like `http://localhost:5173`). Example of the target state:

```
CORS_ORIGIN=http://localhost:5173,http://localhost:5199,https://easycash-lms.pages.dev,https://easycash-portal.pages.dev
```

### 4. Restart the backend so the change takes effect

If it's running via Docker Compose (check with `docker compose ps` from `app/docker/`):

```bash
docker compose restart easycashbackend
```

(If this laptop hasn't pulled the rename commit yet, the service is still named `backend`:
`docker compose restart backend`.)

If it's running via plain `npm run dev` (no Docker), stop it (Ctrl+C in whatever terminal is
running it) and start it again the same way.

### 5. Verify

Confirm the backend is up:

```bash
curl -s http://localhost:4000/health
```

Then ask Nomer to try logging into `https://easycash-lms.pages.dev` and/or
`https://easycash-portal.pages.dev` from this machine/network, and confirm the API calls
succeed (no CORS errors in the browser console).

## If anything is ambiguous

Don't guess at business logic or overwrite configuration you don't understand — ask Nomer
directly. This file only covers the CORS whitelist update and the related repo-layout check;
it is not a general troubleshooting guide.
