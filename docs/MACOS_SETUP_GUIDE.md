# macOS Setup Guide — Running Easycash LMS on a Mac

For setting up this project on a MacBook (or any new machine) for the first time. Once set up,
day-to-day syncing with the rest of the team follows `docs/DEVICE_SYNC_GUIDE.md` — this guide only
covers the one-time setup that guide assumes you've already done.

Each device (Windows machine, MacBook, etc.) has its **own local PostgreSQL database**, migrated
from the same SDevTech MongoDB export — the code is shared via GitHub, but the database is not.

**Shortcut:** after cloning the repo (§2 below), `./setup-macos.sh` (at the repo root) automates
§1 (prerequisite checks) through §4 (Postgres, npm install, Prisma generate/migrate/seed) in one
run. It deliberately stops before §5 — populating real legacy data and creating your login user
need a real dump file and a human decision at each step, not something a script should do
unattended. The sections below explain what that script does and cover everything after it.

---

## 1. Install prerequisites

- **Git** — usually preinstalled on macOS; if not, `xcode-select --install` or via
  [git-scm.com](https://git-scm.com).
- **Node.js 20+** (matches `app/package.json`'s `engines.node` requirement) — via
  [nodejs.org](https://nodejs.org) or `brew install node@20`.
- **Docker Desktop for Mac** — for the local PostgreSQL container.
  [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop).
- **GitHub CLI** — `brew install gh`, then `gh auth login`.
- **Claude Code CLI** — `npm install -g @anthropic-ai/claude-code` (or however it's currently
  distributed — check with the team if this has changed).

Verify:
```bash
node --version   # should be v20 or higher
docker --version
gh --version
```

---

## 2. Clone the repo

```bash
gh repo clone easycashph/easycash-lms
cd easycash-lms
```

---

## 3. Set up environment files

`.env` files are gitignored (they can hold secrets) — copy the templates and fill them in:

```bash
cp app/backend/.env.example app/backend/.env
cp app/frontend/.env.example app/frontend/.env
```

For **local dev**, the example values mostly work as-is (dev-only placeholders, e.g.
`JWT_ACCESS_SECRET=change-me-in-production-min-32-chars`) — no real secrets are needed to run
the app locally. `app/backend/.env`'s `DATABASE_URL` should point at the Postgres container you'll
start in the next step:

```
DATABASE_URL=postgresql://easycash:easycash@localhost:5432/easycash?schema=public
```

If a teammate later gives you *real* values to use (e.g. a shared JWT secret so tokens work across
devices, which isn't required for solo local dev) — transfer those via a secure channel (password
manager, encrypted USB, AirDrop between your own devices), never through email or chat in plain text.

---

## 4. Start PostgreSQL and set up the database schema

```bash
cd app/docker
docker compose up -d postgres
cd ../..

cd app
npm install          # installs both backend and frontend workspaces
cd backend
npx prisma generate
npx prisma migrate deploy
npx prisma db seed   # seeds the "HQ" Branch and role records — required before bootstrap-admin.ts
```

---

## 5. Populate your local database with real (migrated) data

Your local Postgres starts **empty**. You need the same legacy MongoDB export the rest of the team
used, then run the CP12 migration scripts against it, in the exact order documented in
`docs/Architecture/MIGRATION_LEDGER.md`.

### 5a. Get the legacy MongoDB dump onto your Mac

The dump is real client PII — never in git (`legacy/mongodb/` is gitignored). Get it onto your Mac
via a secure, non-cloud-shared channel (encrypted USB, AirDrop between your own devices) from
whoever has the current export, or pull a fresh one yourself:

- `migrate-legacy-data.ts` expects the dump at exactly:
  `legacy/mongodb/07012026_103239/db-easycash` (relative to the repo root) — if you're given the
  *same* dump the rest of the team used, keep that exact folder name.
- If you instead pull a **fresh** dump yourself (see `backup-mongodb.bat` for the Windows
  reference — you'd need a macOS `mongodump` binary and an equivalent `.sh` script; ask before
  connecting to the real remote SDevTech server), the output folder will have a different
  timestamp. In that case, update `DUMP_DIR` in `app/backend/scripts/migrate-legacy-data.ts` to
  match, or rename the folder to match the hardcoded path — don't silently assume it's optional.

### 5b. Run the migration scripts, in order

**Important — these scripts do NOT all share the same default.** Some default to a safe dry-run
and require `--apply` to actually write; others default to writing for real and require
`--dry-run` to preview first. Mixing these up means accidentally applying a script you meant to
only preview. Confirmed from each script's own file (2026-07-11):

| Script | Default (no flag) | Preview flag | Write flag |
|---|---|---|---|
| `migrate-legacy-data.ts` | dry run | *(default)* | `--apply` |
| `import-psgc-reference-data.ts` | dry run | *(default)* | `--apply` |
| `fix-coded-addresses.ts` | dry run | *(default)* | `--apply` |
| `resolve-address-codes.ts` | **writes for real** | `--dry-run` | *(default)* |
| `migrate-repayment-schedules.ts` | **writes for real** | `--dry-run` | *(default)* |
| `flag-missing-balance-loans.ts` | **writes for real** | `--dry-run` | *(default)* |
| `recompute-active-loan-balances-from-schedule.ts` | **writes for real** | `--dry-run` | *(default)* |

Preview every script first, in order, before applying any of them:

```bash
cd app/backend

npx tsx scripts/migrate-legacy-data.ts                                    # preview (default)
npx tsx scripts/import-psgc-reference-data.ts                             # preview (default)
npx tsx scripts/fix-coded-addresses.ts                                    # preview (default)
npx tsx scripts/resolve-address-codes.ts --dry-run                        # preview
npx tsx scripts/migrate-repayment-schedules.ts --dry-run                  # preview
npx tsx scripts/flag-missing-balance-loans.ts --dry-run                   # preview
npx tsx scripts/recompute-active-loan-balances-from-schedule.ts --dry-run # preview
```

Once each preview's output looks right, run the real (writing) version of each, **in this exact
order** (later scripts depend on earlier ones — see `MIGRATION_LEDGER.md`):

```bash
npx tsx scripts/migrate-legacy-data.ts --apply
npx tsx scripts/import-psgc-reference-data.ts --apply
npx tsx scripts/fix-coded-addresses.ts --apply
npx tsx scripts/resolve-address-codes.ts
npx tsx scripts/migrate-repayment-schedules.ts
npx tsx scripts/flag-missing-balance-loans.ts
npx tsx scripts/recompute-active-loan-balances-from-schedule.ts
```

After running them all, verify:

```bash
npx tsx scripts/check-migration-status.ts
```

This should report PASS for every step. If anything says ACTION NEEDED, re-check that script's
comment rather than guessing.

**Update `docs/Architecture/MIGRATION_LEDGER.md`'s per-device table** with your Mac's results —
add a new column for it, same as the existing "Jomer's device" / "Nomer's device" columns.

### 5c. Create your login user(s)

```bash
BOOTSTRAP_ADMIN_EMAIL=admin@easycash.ph BOOTSTRAP_ADMIN_PASSWORD='<choose-a-real-password>' \
  npx tsx scripts/bootstrap-admin.ts
```

This refuses to run if a user already holds the MIS role — it's meant to run exactly once per
fresh database. For any additional non-admin MIS user:

```bash
MIS_EMAIL=... MIS_PASSWORD=... MIS_FIRST_NAME=... MIS_LAST_NAME=... \
  npx tsx scripts/create-additional-mis-user.ts
```

---

## 6. Run the app locally

Two ways, same as on Windows:

**Option A — plain `npm run dev` (recommended for day-to-day dev):**
```bash
# terminal 1
cd app/backend && npm run dev

# terminal 2
cd app/frontend && npm run dev
```

**Option B — full Docker Compose (backend + frontend + Postgres, closer to production):**
```bash
cd app/docker
docker compose up -d --build
```

Frontend: http://localhost:5173 · Backend: http://localhost:4000

### Note on `.claude/launch.json` (Claude Code's browser-preview tool)

`.claude/launch.json`'s `frontend-preview` config currently points at a Windows batch file
(`.claude/run-frontend.bat`), which won't run on macOS. If you want Claude Code's preview tool to
work on your Mac, add a `.sh` equivalent and point a second config entry (or a per-OS override) at
it — e.g.:

```bash
#!/bin/bash
cd "$(dirname "$0")/../app/frontend"
PORT="${PORT:-5173}"
npm run dev -- --port "$PORT" --strictPort
```

Make it executable: `chmod +x .claude/run-frontend.sh`. This is local machine config, not something
that needs to go into `launch.json` in a way that breaks the Windows setup — ask before changing
the shared `launch.json` if you're unsure how to keep both working.

---

## 7. SSH commit signing (recommended, matches the Windows setup)

Generate a **separate** signing key for this Mac — don't copy the Windows private key over:

```bash
ssh-keygen -t ed25519 -C "nomer-macbook-signing" -f ~/.ssh/id_ed25519_signing
git config --global gpg.format ssh
git config --global user.signingkey ~/.ssh/id_ed25519_signing.pub
git config --global commit.gpgsign true
gh ssh-key add ~/.ssh/id_ed25519_signing.pub --type signing
```

Verify with a test commit (`git commit --allow-empty -m "test signing"`) then check GitHub shows
it as "Verified".

---

## 8. Ongoing sync

Once set up, follow `docs/DEVICE_SYNC_GUIDE.md` for every future pull/push — it covers checking for
remote updates before pushing, re-running `npm install`/`prisma migrate deploy` after pulling, and
the one-off migration-script checklist (`check-migration-status.ts`) for anything new that lands.

---

## Known gaps / things to double check once set up

- `backup-mongodb.bat` and `backup-database.bat` are both Windows `.bat` scripts — they will not
  run on macOS. If you need local backups on the Mac, these need `.sh` equivalents (ask before
  writing one, since the MongoDB one embeds real remote credentials).
- The exact legacy dump timestamp folder (`07012026_103239`) is hardcoded in
  `migrate-legacy-data.ts` — see §5a above.
