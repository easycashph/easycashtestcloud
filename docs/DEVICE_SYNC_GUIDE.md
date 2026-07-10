# Device Sync Guide — Keeping Local Machines in Sync with GitHub

Applies to everyone working on this repo from their own machine (currently: Jomer Biason,
Nomer Perez) — each person has their own Docker setup and their own local database (migrated
from the same SDevTech MongoDB dump), but the **code** must always match GitHub.

---

## 1. Before you push — always check GitHub first

**Never push local commits blindly.** Someone else may have pushed changes since you last
pulled. Pushing without checking first risks a rejected push, or worse, a messy merge.

Every time you're about to push, follow this order:

### Step 1 — Check if GitHub has anything you don't have locally

```bash
git fetch origin
git status
```

Look at the output of `git status` — it will say one of:

- **"Your branch is up to date with 'origin/main'"** → nothing new on GitHub. Safe to skip to
  Step 3 below (commit and push).
- **"Your branch is behind 'origin/main' by N commit(s)"** → someone pushed updates you don't
  have yet. **Pull first**, before doing anything else:

  ```bash
  git pull origin main
  ```

  If you have local changes not yet committed, `git status` will list them as modified files —
  commit or stash them before pulling if `git pull` refuses to proceed (it will tell you).

- **"Your branch and 'origin/main' have diverged"** → both you and someone else pushed different
  commits. Pull first (`git pull origin main`) and resolve any merge conflicts Git reports before
  continuing.

### Step 2 — Commit your own changes

```bash
git add <files>
git commit -m "clear, specific message"
```

### Step 3 — Push

```bash
git push origin main
```

**Summary — the order is always: fetch/check → pull if needed → commit → push.** Never push
before checking; never commit over unpulled remote changes without merging them first.

---

## 2. After pulling — sync everything else that `git pull` doesn't cover

`git pull` only updates code files. It does **not** automatically:
- install new/updated npm dependencies
- apply new database migrations
- run one-off data-fix scripts
- rebuild Docker containers

So after every `git pull` that brings in new commits, run all of these in order:

```bash
# 1. Pull the code
git pull origin main

# 2. Sync npm dependencies (skip if package-lock.json didn't change)
cd app
npm install
cd ..

# 3. Regenerate the Prisma client (safe to always run)
cd app/backend
npx prisma generate

# 4. Apply any new database migrations to YOUR local database
npx prisma migrate status
npx prisma migrate deploy
cd ../..

# 5. Rebuild and restart Docker with the new code
cd app/docker
docker compose up -d --build
cd ../..
```

**Before step 5**, make sure nothing else is already using ports 5173 (frontend) or 4000
(backend) — e.g. a local `npm run dev` process left running. Stop those first, or
`docker compose up` will fail with a port-already-in-use error.

---

## 3. One-off data-fix scripts (not covered by `prisma migrate deploy`)

Some CP12 legacy-migration fixes are **standalone scripts**, not Prisma migrations — running
`prisma migrate deploy` does **not** run them. If a commit's message or docs mention a new script
under `app/backend/scripts/`, check whether you need to run it too:

```bash
cd app/backend
npx tsx scripts/<script-name>.ts --dry-run   # preview first, always
npx tsx scripts/<script-name>.ts             # then run for real
```

These scripts read from the local legacy MongoDB dump (`legacy/MongoDB dump/extracted/...` —
gitignored, each person has their own copy) and are idempotent/safe to re-run. If a script
expects a dump folder you don't have yet, get the matching dump export before running it —
don't guess or substitute an older one, since the data may differ.

**If in doubt whether you need to re-run a script:** don't guess — run the automated check:

```bash
cd app/backend
npx tsx scripts/check-migration-status.ts
```

It reports PASS / ACTION NEEDED for every known CP12 script, read-only, against your current
database. See `docs/Architecture/MIGRATION_LEDGER.md` for the full script dependency order and
the per-device log of what's already been run where.

---

## 4. Quick reference — full sync checklist

- [ ] `git fetch origin` + `git status` — check for remote updates
- [ ] `git pull origin main` — if behind or diverged
- [ ] `npm install` (from `app/`) — if `package-lock.json` changed
- [ ] `npx prisma generate` (from `app/backend/`)
- [ ] `npx prisma migrate deploy` (from `app/backend/`)
- [ ] `npx tsx scripts/check-migration-status.ts` (from `app/backend/`) — run any script it flags ACTION NEEDED
- [ ] `docker compose up -d --build` (from `app/docker/`)
- [ ] Commit your own work
- [ ] `git push origin main`
