#!/bin/bash
# ===============================
# Easycash LMS - Sync After Pull (Mac / Macbook Nomer)
# ===============================
# 2026-08-29 (user request): a git pull alone only updates the CODE on disk - it does NOT apply
# new database migrations/permissions, install new dependencies, or rebuild the running Docker
# containers. Skipping those steps is exactly how this machine ended up missing a real permission
# (two_factor_enforcement.manage) that had already been pulled into seed.ts days earlier - the code
# was there, the database just never got told about it.
#
# Every step below is safe to run EVERY time, whether or not it was actually needed - npm install
# is a no-op if package.json didn't change, prisma migrate deploy skips already-applied migrations,
# prisma db seed only ever upserts, docker compose --build only rebuilds what changed. That's the
# whole point: run this after every pull, always, and never have to guess which steps you need.

set -uo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/app/easycashbackend"
LMS_DIR="$ROOT_DIR/app/lmsfrontend"
PORTAL_DIR="$ROOT_DIR/app/portalfrontend"

echo "============================================"
echo "  Easycash LMS - Sync After Pull"
echo "============================================"
echo ""

echo "[1/8] Git pull..."
if ! (cd "$ROOT_DIR" && git pull); then
  echo "X FAILED: git pull - resolve any conflicts manually, then re-run this script."
  read -p "Pindutin ang Enter para isara..."
  exit 1
fi

echo ""
echo "[2/8] Chinicheck kung tumatakbo ang Docker..."
if ! docker info >/dev/null 2>&1; then
  echo "      Sinisimulan ang Docker Desktop..."
  open -a Docker
  echo "      Naghihintay habang nagsi-start ang Docker (puwedeng umabot ng 1-2 minuto)..."
  READY=""
  for i in $(seq 1 60); do
    if docker info >/dev/null 2>&1; then READY=1; break; fi
    sleep 3
  done
  if [ -z "$READY" ]; then
    echo "X Hindi pa rin ready ang Docker pagkatapos maghintay. Tingnan ang Docker Desktop window."
    read -p "Pindutin ang Enter para isara..."
    exit 1
  fi
fi
(cd "$ROOT_DIR/app/docker" && docker compose up -d postgres)

run_step() {
  local description="$1"
  local dir="$2"
  shift 2
  echo ""
  echo "--- $description ---"
  if ! (cd "$dir" && "$@"); then
    echo "X FAILED: $description"
    read -p "Pindutin ang Enter para isara..."
    exit 1
  fi
}

run_step "[3/8] Backend dependencies (npm install)" "$BACKEND_DIR" npm install
run_step "[4/8] Database migrations (prisma migrate deploy)" "$BACKEND_DIR" npx prisma migrate deploy
run_step "[5/8] Prisma client (prisma generate)" "$BACKEND_DIR" npx prisma generate
run_step "[6/8] Roles, permissions, reference data (prisma db seed)" "$BACKEND_DIR" npx prisma db seed

echo ""
echo "[7/8] Frontend dependencies (npm install)..."
(cd "$LMS_DIR" && npm install) || { echo "X FAILED: lmsfrontend npm install"; read -p "Pindutin ang Enter para isara..."; exit 1; }
if [ -d "$PORTAL_DIR" ]; then
  (cd "$PORTAL_DIR" && npm install) || { echo "X FAILED: portalfrontend npm install"; read -p "Pindutin ang Enter para isara..."; exit 1; }
fi

echo ""
echo "[8/8] Docker rebuild (backend + frontends)..."
if ! (cd "$ROOT_DIR/app/docker" && docker compose up -d --build easycashbackend lmsfrontend portalfrontend); then
  echo "X FAILED: docker compose build - suriin ang error sa itaas."
  read -p "Pindutin ang Enter para isara..."
  exit 1
fi

echo ""
echo "============================================"
echo "  Tapos na! Bago at kumpleto ang code, database,"
echo "  at mga tumatakbong container mo."
echo "============================================"
echo ""
read -p "Pindutin ang Enter para isara..."
