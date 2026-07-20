#!/bin/bash
# ===============================
# Easycash LMS - Sync Database + Apply Migrations (Mac)
# ===============================
# Mac equivalent of "Sync Database And Apply Migrations.bat". Same logic:
# restore the newest .dump in legacy/db-exports into the local Postgres
# container, then apply Prisma migrations on top (so new columns/migrations
# not yet in the colleague's dump come back), then restart the backend
# container and verify record counts.
#
# WARNING: this restores (--clean) the dump's contents into your LOCAL
# database, replacing what's there. If you have local changes you haven't
# exported yet, do not continue.

set -uo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
EXPORT_DIR="$ROOT_DIR/legacy/db-exports"
BACKEND_DIR="$ROOT_DIR/app/backend"
POSTGRES_CONTAINER="easycash-postgres-1"
BACKEND_CONTAINER="easycash-backend-1"
PG_USER="easycash"
PG_DB="easycash"

echo "============================================"
echo "  Easycash LMS - Sync Database + Apply Migrations"
echo "============================================"
echo ""
echo "Ito ay nagre-restore ng pinaka-BAGONG .dump file sa"
echo "\"$EXPORT_DIR\" papunta sa LOCAL Postgres container mo"
echo "($POSTGRES_CONTAINER), TAPOS awtomatikong ia-apply ang lahat ng"
echo "Prisma migrations (prisma migrate deploy)."
echo ""
echo "BABALA: Papalitan/dadaanan (--clean) ang laman ng iyong local database"
echo "ng laman ng dump file. Kung may sarili kang hindi pa naka-export na"
echo "local changes, huwag magpatuloy."
echo ""

echo "[1/7] Hinahanap ang pinaka-bagong export file..."
LATEST_DUMP="$(ls -t "$EXPORT_DIR"/*.dump 2>/dev/null | head -n 1)"

if [ -z "$LATEST_DUMP" ]; then
  echo "      Walang nahanap na .dump file sa \"$EXPORT_DIR\"."
  echo "      Ilagay muna doon ang na-transfer na export file, tapos ulitin."
  read -p "Pindutin ang Enter para isara..."
  exit 1
fi
echo "      Gagamitin: $(basename "$LATEST_DUMP")"
echo ""

read -p "Ituloy ang restore + migrate gamit ang file na ito? (Y/N): " CONFIRM
if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
  echo "Kinansela ng user."
  read -p "Pindutin ang Enter para isara..."
  exit 0
fi

echo ""
echo "[2/7] Chinicheck kung tumatakbo ang $POSTGRES_CONTAINER..."
if [ "$(docker inspect -f '{{.State.Running}}' "$POSTGRES_CONTAINER" 2>/dev/null)" != "true" ]; then
  echo "      Hindi nahanap ang container. Sinisimulan ang docker compose stack..."
  (cd "$ROOT_DIR/app/docker" && docker compose up -d postgres)
  sleep 5
fi

echo "[3/7] Kinokopya ang dump papasok sa container..."
if ! docker cp "$LATEST_DUMP" "$POSTGRES_CONTAINER:/tmp/restore.dump"; then
  echo "      FAILED sa docker cp. Suriin kung tama ang container name."
  read -p "Pindutin ang Enter para isara..."
  exit 1
fi

echo "[4/7] Ni-restore ang database (--clean --if-exists)..."
if ! docker exec "$POSTGRES_CONTAINER" pg_restore -U "$PG_USER" -d "$PG_DB" --clean --if-exists /tmp/restore.dump; then
  echo "      May mga warning/error sa pg_restore -- normal ito kung may"
  echo "      \"does not exist, skipping\" lines. Tignan sa itaas kung may"
  echo "      ibang seryosong error."
fi

echo "[5/7] Ini-apply ang Prisma migrations para ibalik ang tamang schema..."
if ! (cd "$BACKEND_DIR" && npx prisma migrate deploy); then
  echo "      FAILED ang prisma migrate deploy - suriin ang error sa itaas."
  read -p "Pindutin ang Enter para isara..."
  exit 1
fi

echo "[6/7] Ni-restart ang backend container para fresh connections..."
docker restart "$BACKEND_CONTAINER" >/dev/null 2>&1 || true

echo "[7/7] Ni-verify ang record counts pagkatapos ma-restore..."
(cd "$BACKEND_DIR" && npx tsx scripts/verify-migration-counts.ts)

echo ""
echo "============================================"
echo "  Tapos na. I-refresh ang browser tab mo."
echo "  Paalala: baka kailangan mo pa ring i-re-seed"
echo "  (npx tsx prisma/seed.ts) at i-re-apply ang mga"
echo "  one-time data scripts (hal. backfill-net-proceeds.ts,"
echo "  map-sml-document-templates.ts,"
echo "  backfill-loan-interest-rates.ts --apply) kung wala pa"
echo "  ang laman ng dump na ito."
echo "============================================"
echo ""
read -p "Pindutin ang Enter para isara..."
