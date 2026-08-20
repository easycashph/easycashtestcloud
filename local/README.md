# `local/`

This folder is where **personal, machine-specific, or otherwise never-committed** files belong.
Everything inside it is gitignored by default (see the `.gitignore` rule for `local/`) — this file
is the one deliberate exception, whitelisted so the folder's purpose is documented for anyone who
clones the repo and finds an empty `local/` directory.

## What belongs here

- Personal credential notes (e.g. `MIS Jomer Login.md`) — plaintext credentials should live in a
  password manager, not a file at all, but until that's done, keep them here rather than at the
  repo root.
- Local-only database backups, ad-hoc exports, or scratch files you generate while working that
  have no reason to be shared or committed.
- `postgres-remote-backup.env` (2026-08-20) - connection details (host/port/db/user/password) for
  pulling a remote Postgres snapshot from the office server. The actual script logic
  (`scripts/backup-remote-postgres.ps1`) is tracked and travels with the repo to any machine that
  clones it, since it holds no secrets itself - only this `.env` file, generated fresh (blank) the
  first time the script runs on a new machine, ever holds the real values. Run via
  `scripts/Backup Remote Postgres Snapshot.bat`.
- Anything you'd previously have dropped loose at the repo root "just for now."

## What does NOT belong here

- Anything referenced by a fixed path from a script, `docker-compose.yml`, or app config (e.g.
  `.env` files stay next to the app that reads them; `legacy/` source material stays where the
  migration docs and scripts expect it; `app/easycashbackend/storage/` stays where the backend's bind mount
  expects it). Moving those breaks things — see `docs/guides/DOCKER_CLEANUP_GUIDE.md` and the
  `Architecture/` ADRs before relocating anything with an existing reference.
- Anything that should actually be committed. If in doubt, ask before adding a new blanket
  `.gitignore` rule for something under here.

## Why this folder exists

Before 2026-07-29, personal/local-only files (e.g. `MIS Jomer Login.md`) sat loose at the repo
root alongside the tracked launcher scripts and docs, making it hard to tell at a glance what was
part of the project versus what was one person's local scratch file. This folder gives that kind of
file one obvious home instead. See `docs/session-logs/SESSION_LOG_2026-07-29_local_folder_and_gitignore_cleanup.md`
for the full reasoning, including *why* the `legacy/` PII folders were deliberately left where they
are rather than also moved here.
