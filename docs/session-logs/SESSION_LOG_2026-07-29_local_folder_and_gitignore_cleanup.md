# Session Log — 2026-07-29 — Project Folder Organization: `local/` for Gitignored Files

**Goal (user, in Filipino):** organize the project folder; create a proper folder for gitignored
files.

---

## 1. Survey

Re-checked the repo root and `.gitignore` before moving anything. Root-level clutter had already
been mostly addressed in earlier sessions (docs reorganized into `docs/session-logs/` and
`docs/guides/`, build artifacts fixed at the source). What remained:

- `MIS Jomer Login.md` — a personal, plaintext credential file sitting loose at the repo root,
  gitignored via its own one-off `.gitignore` rule.
- `backups/` — a gitignore rule for a folder that doesn't currently exist and nothing currently
  writes to (`restore-easycash-backup.command` reads from `legacy/db-exports/`, not root-level
  `backups/`).
- `backup-mongodb.bat` / `.command` — gitignored, referenced by `legacy/Run Full Legacy
  Migration.command` and `docs/guides/MACOS_SETUP_GUIDE.md`, but confirmed **not present** on this
  machine (`Glob` found nothing) — nothing to move.

## 2. What was deliberately NOT touched, and why

The bulk of this repo's gitignore rules cover `legacy/*` subfolders (`legacy/mongodb/`,
`legacy/sdevtech/`, `legacy/Excel LMS Files/`, `legacy/db-exports/`, `legacy/MongoDB dump/`, etc.)
plus `app/backend/storage/` and `app/docker/tailscale-certs/`. These were considered and rejected
as candidates for consolidation into a new folder:

- They're read by **fixed relative paths** from live scripts and configs —
  `restore-easycash-backup.command` reads `legacy/db-exports/easycash-backup.dump`,
  `docker-compose.yml` bind-mounts `app/backend/storage`, the nginx container reads
  `app/docker/tailscale-certs/`, and multiple docs (`MACOS_SETUP_GUIDE.md`, migration ADRs) cite
  exact paths like `legacy/mongodb/07012026_103239/db-easycash`. Moving any of these would require
  updating every script and doc reference, for no real benefit — they're already invisible to git,
  so from git's perspective there was nothing cluttered to begin with.
- They're conceptually different from what this session's request was actually about: `legacy/`
  holds **migration source material** with its own well-established, individually-commented
  gitignore rules explaining *why* each piece is excluded (mostly real client PII). `local/` (see
  below) is for **personal/scratch files that happen to live in this repo**, a different category
  entirely.

`.env` files were also left in place next to their respective apps (`app/backend/.env`,
`app/portal/.env`, etc.) - moving them would break Vite/dotenv's automatic discovery, which expects
them adjacent to the app.

## 3. `local/` folder created

- `local/` — new root-level folder, gitignored via `local/*` with a `!local/README.md` negation so
  the folder's purpose survives a fresh clone instead of the directory just silently not existing.
- `local/README.md` (new, tracked) — explains what belongs here (personal credential notes, ad-hoc
  local DB backups, scratch files) and what does *not* (anything read by a fixed path from a
  script/config — see §2 above for the reasoning, cross-referenced from the README).
- `MIS Jomer Login.md` moved from the repo root to `local/MIS Jomer Login.md`.

`.gitignore` changes:
- Removed the two one-off rules (`backups/` and `MIS Jomer Login.md`) now superseded by the
  blanket `local/` rule.
- Added the new `local/*` / `!local/README.md` block at the top of the file, since it's now the
  general-purpose answer to "where does this local-only file go."

Verified the ignore rules behave as intended:
```
git check-ignore -v "local/MIS Jomer Login.md"   -> matched by local/*  (correctly ignored)
git check-ignore -v "local/README.md"            -> matched by !local/README.md  (correctly NOT ignored)
git add -n local/                                -> "add 'local/README.md'"  (only the README would be staged)
```

## 4. Noted but not fixed

`Run LMS  Preview.md` at the repo root has a double space in its filename (a pre-existing typo).
Left as-is: it's referenced by exact name in `docs/PROJECT_HANDOFF.md` (a historical "what this
commit added" note), and renaming it for a minor cosmetic fix wasn't worth the doc churn or the
risk of a stale reference. Out of scope for this session's actual request.

## 5. Current state

Repo root now contains only: tracked launcher scripts (`Run LMS Preview.*`, `Update LAN IP.*`,
`Sync Database From Export.bat`, `restore-easycash-backup.command`, `setup-macos.sh`), project-level
docs (`README.md`, `CLAUDE.md`, `PROJECT_RULES.md`), and four folders (`app/`, `docs/`, `legacy/`,
`local/`). Every remaining root-level item is either meant to be double-clicked from there, is a
top-level project doc, or is a folder with an established, documented reason for its location.

No follow-up required. Future personal/scratch files should go in `local/` per its README instead
of loose at the repo root.
