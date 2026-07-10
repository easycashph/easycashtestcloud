#!/bin/bash
# Easycash LMS — macOS first-time setup script
# Companion to docs/MACOS_SETUP_GUIDE.md — automates that guide's §1-4
# (prerequisite checks, .env files, local Postgres, npm install, Prisma
# generate/migrate/seed). Deliberately stops there: populating real data
# (§5, legacy MongoDB migration scripts) needs a real dump file and a
# human deciding each dry-run's output looks right before applying it —
# not something a script should do unattended. Creating your login user
# (§5c, bootstrap-admin.ts) also needs a real chosen password, not a
# hardcoded one in a committed script.
#
# Usage: run from anywhere — this script cd's to its own directory (the repo root) first.
#   ./setup-macos.sh

set -euo pipefail

cd "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=================================================="
echo "Easycash LMS — macOS setup"
echo "=================================================="

# --- 1. Prerequisite checks ---
echo
echo "--- Checking prerequisites ---"

missing=0
for cmd in git node npm docker; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "X Missing: $cmd — see docs/MACOS_SETUP_GUIDE.md §1 for how to install it."
    missing=1
  else
    echo "OK Found: $cmd ($(command -v "$cmd"))"
  fi
done

if [ "$missing" -eq 1 ]; then
  echo
  echo "Install the missing tool(s) above, then re-run this script."
  exit 1
fi

node_major=$(node --version | sed -E 's/^v([0-9]+).*/\1/')
if [ "$node_major" -lt 20 ]; then
  echo "X Node.js version is too old ($(node --version)) — this project requires Node 20+."
  exit 1
fi
echo "OK Node.js $(node --version) meets the >=20 requirement."

if ! docker info >/dev/null 2>&1; then
  echo "X Docker daemon isn't running — start Docker Desktop first, then re-run this script."
  exit 1
fi
echo "OK Docker daemon is running."

# --- 2. Environment files ---
echo
echo "--- Setting up .env files ---"

for pair in "app/backend/.env.example:app/backend/.env" "app/frontend/.env.example:app/frontend/.env"; do
  example="${pair%%:*}"
  target="${pair##*:}"
  if [ -f "$target" ]; then
    echo "OK $target already exists — leaving it as-is (not overwriting)."
  else
    cp "$example" "$target"
    echo "OK Created $target from $example."
  fi
done

# --- 3. Local PostgreSQL via Docker ---
echo
echo "--- Starting local PostgreSQL ---"

(cd app/docker && docker compose up -d postgres)

echo "Waiting for PostgreSQL to be healthy..."
for _ in $(seq 1 30); do
  status=$(docker inspect --format '{{.State.Health.Status}}' easycash-postgres-1 2>/dev/null || echo "starting")
  if [ "$status" = "healthy" ]; then
    echo "OK PostgreSQL is healthy."
    break
  fi
  sleep 2
done
if [ "$status" != "healthy" ]; then
  echo "X PostgreSQL did not become healthy in time — check 'docker logs easycash-postgres-1'."
  exit 1
fi

# --- 4. Install dependencies, generate Prisma client, apply migrations, seed ---
echo
echo "--- Installing npm dependencies (backend + frontend workspaces) ---"
(cd app && npm install)

echo
echo "--- Prisma: generate client, apply migrations, seed reference data ---"
(cd app/backend && npx prisma generate)
(cd app/backend && npx prisma migrate deploy)
(cd app/backend && npx prisma db seed)

echo
echo "=================================================="
echo "OK Base setup complete."
echo "=================================================="
echo
echo "Your local database has the schema and seed reference data (Branch/Roles/Permissions),"
echo "but NO real borrower/loan/payment data yet, and no login user."
echo
echo "Next steps (manual — see docs/MACOS_SETUP_GUIDE.md §5 onward):"
echo "  1. Get the legacy MongoDB dump onto this Mac (real client PII — secure transfer only)."
echo "  2. Run the CP12 migration scripts, in order, dry-run first (see the table in §5b —"
echo "     they do NOT all share the same default flag behavior)."
echo "  3. Create your login user: BOOTSTRAP_ADMIN_EMAIL=... BOOTSTRAP_ADMIN_PASSWORD='...' \\"
echo "       npx tsx scripts/bootstrap-admin.ts   (run from app/backend)"
echo "  4. Start the app: npm run dev (in app/backend and app/frontend, separate terminals)."
