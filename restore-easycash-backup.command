#!/bin/bash
# ===============================
# Easycash LMS - Restore easycash-backup.dump into local Docker Postgres (Mac)
# ===============================
# Restores a specific dump file (easycash-backup.dump, sitting at the project
# root) into the local Postgres container (--clean --if-exists: REPLACES the
# current contents of the local DB with the dump's contents, it does not
# merge/keep both). Then applies Prisma migrations on top so any columns/
# tables not yet in this dump's schema snapshot come back.
#
# WARNING: this REPLACES the contents of your LOCAL database with the dump's
# contents. If you have local changes you haven't exported yet, do not
# continue.

set -uo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
DUMP_FILE="$ROOT_DIR/legacy/db-exports/easycash-backup.dump"
BACKEND_DIR="$ROOT_DIR/app/backend"
POSTGRES_CONTAINER="easycash-postgres-1"
BACKEND_CONTAINER="easycash-backend-1"
PG_USER="easycash"
PG_DB="easycash"

echo "============================================"
echo "  Easycash LMS - Restore easycash-backup.dump"
echo "============================================"
echo ""
echo "Ito ay nagre-restore ng \"$DUMP_FILE\""
echo "papunta sa LOCAL Postgres container mo ($POSTGRES_CONTAINER),"
echo "TAPOS awtomatikong ia-apply ang lahat ng Prisma migrations."
echo ""
echo "BABALA: Papalitan (--clean) ang laman ng iyong local database ng laman"
echo "ng dump file na ito. Kung may sarili kang hindi pa naka-export na"
echo "local changes, huwag magpatuloy."
echo ""

if [ ! -f "$DUMP_FILE" ]; then
  echo "X Hindi nahanap ang \"$DUMP_FILE\"."
  echo "  Ilagay muna ang dump file sa lokasyong ito, tapos ulitin."
  read -p "Pindutin ang Enter para isara..."
  exit 1
fi

read -p "Ituloy ang restore + migrate gamit ang file na ito? (Y/N): " CONFIRM
if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
  echo "Kinansela ng user."
  read -p "Pindutin ang Enter para isara..."
  exit 0
fi

echo ""
echo "[1/6] Chinicheck kung tumatakbo ang $POSTGRES_CONTAINER..."
if [ "$(docker inspect -f '{{.State.Running}}' "$POSTGRES_CONTAINER" 2>/dev/null)" != "true" ]; then
  echo "      Hindi nahanap ang container. Sinisimulan ang docker compose stack..."
  (cd "$ROOT_DIR/app/docker" && docker compose up -d postgres)
  sleep 5
fi

echo "[2/6] Kinokopya ang dump papasok sa container..."
if ! docker cp "$DUMP_FILE" "$POSTGRES_CONTAINER:/tmp/restore.dump"; then
  echo "      FAILED sa docker cp. Suriin kung tama ang container name."
  read -p "Pindutin ang Enter para isara..."
  exit 1
fi

echo "[3/6] Ni-restore ang database (--clean --if-exists)..."
if ! docker exec "$POSTGRES_CONTAINER" pg_restore -U "$PG_USER" -d "$PG_DB" --clean --if-exists /tmp/restore.dump; then
  echo "      May mga warning/error sa pg_restore -- normal ito kung may"
  echo "      \"does not exist, skipping\" lines. Tignan sa itaas kung may"
  echo "      ibang seryosong error."
fi

echo "[4/6] Ini-apply ang Prisma migrations para ibalik ang tamang schema..."
if ! (cd "$BACKEND_DIR" && npx prisma migrate deploy); then
  echo "      FAILED ang prisma migrate deploy - suriin ang error sa itaas."
  read -p "Pindutin ang Enter para isara..."
  exit 1
fi

echo "[5/6] Ni-restart ang backend container (kung tumatakbo) para fresh connections..."
docker restart "$BACKEND_CONTAINER" >/dev/null 2>&1 || true

echo "[6/6] Ni-verify ang record counts pagkatapos ma-restore..."
(cd "$BACKEND_DIR" && npx tsx scripts/verify-migration-counts.ts)

echo ""
echo "============================================"
echo "  Tapos na. I-refresh ang browser tab mo."
echo "============================================"
echo ""
read -p "Pindutin ang Enter para isara..."
