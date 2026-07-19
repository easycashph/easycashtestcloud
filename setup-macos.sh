#!/bin/bash
# macOS one-time setup for Easycash LMS - automates docs/MACOS_SETUP_GUIDE.md's §1 (prerequisite
# checks) through §4 (Postgres, npm install, Prisma generate/migrate/seed). Deliberately stops
# there - §5 (populating real legacy data, creating your login user) needs a real MongoDB dump and
# a human decision at each step, not something a script should do unattended. Run this from the
# repo root, after cloning: `./setup-macos.sh`.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO_ROOT"

info() { printf '\n\033[1;34m==>\033[0m %s\n' "$1"; }
fail() { printf '\033[1;31merror:\033[0m %s\n' "$1" >&2; exit 1; }

info "1. Checking prerequisites"

command -v git >/dev/null 2>&1 || fail "git not found - see docs/MACOS_SETUP_GUIDE.md §1."
command -v node >/dev/null 2>&1 || fail "node not found - install Node.js 20+ (nodejs.org or 'brew install node@20')."
command -v docker >/dev/null 2>&1 || fail "docker not found - install Docker Desktop for Mac (docker.com/products/docker-desktop)."
command -v gh >/dev/null 2>&1 || fail "gh (GitHub CLI) not found - 'brew install gh', then 'gh auth login'."

NODE_MAJOR="$(node --version | sed 's/^v//' | cut -d. -f1)"
if [ "$NODE_MAJOR" -lt 20 ]; then
  fail "Node.js 20+ required (found $(node --version)) - matches app/package.json's engines.node requirement."
fi

if ! docker info >/dev/null 2>&1; then
  fail "Docker daemon is not running - start Docker Desktop first."
fi

echo "  git:    $(git --version)"
echo "  node:   $(node --version)"
echo "  docker: $(docker --version)"
echo "  gh:     $(gh --version | head -1)"

info "2. Setting up environment files"

if [ -f "app/backend/.env" ]; then
  echo "  app/backend/.env already exists - leaving it as-is."
else
  cp app/backend/.env.example app/backend/.env
  echo "  Created app/backend/.env from .env.example."
fi

if [ -f "app/frontend/.env" ]; then
  echo "  app/frontend/.env already exists - leaving it as-is."
else
  cp app/frontend/.env.example app/frontend/.env
  echo "  Created app/frontend/.env from .env.example."
fi

info "3. Starting PostgreSQL (Docker)"

(cd app/docker && docker compose up -d postgres)

echo "  Waiting for Postgres to become healthy..."
for _ in $(seq 1 30); do
  STATUS="$(docker inspect --format='{{.State.Health.Status}}' easycash-postgres-1 2>/dev/null || echo "starting")"
  if [ "$STATUS" = "healthy" ]; then
    echo "  Postgres is healthy."
    break
  fi
  sleep 2
done
if [ "$STATUS" != "healthy" ]; then
  fail "Postgres did not become healthy in time - check 'docker logs easycash-postgres-1'."
fi

info "4. Installing dependencies and setting up the database schema"

(cd app && npm install)

(
  cd app/backend
  npx prisma generate
  npx prisma migrate deploy
  npx prisma db seed
)

info "Done - §1 through §4 complete."
cat <<'EOF'

Next steps (manual - see docs/MACOS_SETUP_GUIDE.md §5 onward):
  1. Get the legacy MongoDB dump onto this Mac (never via git/email - see §5a).
  2. Preview, then run, the migration scripts in order (§5b).
  3. Verify with: cd app/backend && npx tsx scripts/check-migration-status.ts
  4. Create your login user (§5c) with scripts/bootstrap-admin.ts.
  5. Run the app (§6): npm run dev in app/backend and app/frontend, or docker compose up -d --build.
EOF
