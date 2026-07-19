#!/bin/bash
# ===============================
# Easycash LMS - Full Legacy Migration (Mac)
# ===============================
# Turnkey re-run of the entire CP12 migration + every follow-up backfill script, against
# whichever legacy/mongodb/*.zip backup is newest. No manual script-path editing needed - every
# script under app/backend/scripts/ that reads the legacy MongoDB export now auto-detects the
# newest extracted backup via scripts/lib/legacyDumpPath.ts.
#
# WARNING: this runs `prisma migrate reset --force`, which ERASES the local Postgres database
# completely (schema + all data) before rebuilding it fresh from the legacy backup. Local-only -
# never touches GitHub or the remote MongoDB server.
#
# Order follows docs/Architecture/MIGRATION_LEDGER.md, plus the later fee/interest-rate/net-proceeds
# backfills (found 2026-07-19 to still be needed on a fresh database, undocumented in that ledger).

set -uo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/app/backend"
MONGO_DIR="$ROOT_DIR/legacy/mongodb"
EXTRACTED_DIR="$MONGO_DIR/extracted"

echo "============================================"
echo "  Easycash LMS - Full Legacy Migration"
echo "============================================"
echo ""
echo "BABALA: Ganap na tatanggalin (prisma migrate reset) ang laman ng iyong LOCAL"
echo "Postgres database bago ito muling itayo mula sa pinaka-bagong legacy MongoDB"
echo "backup. Local lang ang epekto nito - walang epekto sa GitHub o sa remote"
echo "MongoDB server."
echo ""

# --- Find newest backup zip ---
LATEST_ZIP="$(ls -t "$MONGO_DIR"/*.zip 2>/dev/null | head -n 1)"
if [ -z "$LATEST_ZIP" ]; then
  echo "X Walang nahanap na .zip backup sa \"$MONGO_DIR\"."
  echo "  Patakbuhin muna ang backup-mongodb.command, tapos ulitin."
  read -p "Pindutin ang Enter para isara..."
  exit 1
fi
ZIP_BASENAME="$(basename "$LATEST_ZIP" .zip)"
echo "Gagamitin: $(basename "$LATEST_ZIP")"

# --- Extract if not already extracted ---
TARGET_DIR="$EXTRACTED_DIR/$ZIP_BASENAME"
if [ -d "$TARGET_DIR/db-easycash" ] && [ -d "$TARGET_DIR/db-address-api" ]; then
  echo "Na-extract na dati ang backup na ito sa \"$TARGET_DIR\" - lalaktawan ang extraction."
else
  echo "Ina-extract ang db-easycash/ at db-address-api/..."
  mkdir -p "$TARGET_DIR"
  unzip -q "$LATEST_ZIP" "db-easycash/*" "db-address-api/*" -d "$TARGET_DIR"
fi
echo ""

read -p "Ituloy ang buong migration (reset + full rebuild)? (Y/N): " CONFIRM
if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
  echo "Kinansela ng user."
  read -p "Pindutin ang Enter para isara..."
  exit 0
fi

run_step() {
  local description="$1"
  shift
  echo ""
  echo "--- $description ---"
  if ! (cd "$BACKEND_DIR" && "$@"); then
    echo "X FAILED: $description"
    read -p "Pindutin ang Enter para isara..."
    exit 1
  fi
}

echo ""
echo "[1/16] Chinicheck kung tumatakbo ang Postgres..."
if ! docker inspect -f '{{.State.Running}}' easycash-postgres-1 >/dev/null 2>&1; then
  (cd "$ROOT_DIR/app/docker" && docker compose up -d postgres)
  sleep 5
fi

run_step "[2/16] Resetting database (schema + seed)" npx prisma migrate reset --force
run_step "[3/16] CP12 core migration (products, borrowers, loans, transactions, attachments)" npx tsx scripts/migrate-legacy-data.ts --apply
run_step "[4/16] PSGC reference data" npx tsx scripts/import-psgc-reference-data.ts --apply
run_step "[5/16] Resolve coded addresses (PSGC lookup)" npx tsx scripts/fix-coded-addresses.ts --apply
run_step "[6/16] Resolve remaining coded addresses (address-api fallback)" npx tsx scripts/resolve-address-codes.ts
run_step "[7/16] Repayment schedules" npx tsx scripts/migrate-repayment-schedules.ts --apply
run_step "[8/16] Flag loans with missing legacy balance data" npx tsx scripts/flag-missing-balance-loans.ts --apply
run_step "[9/16] Recompute active-loan balances from schedule" npx tsx scripts/recompute-active-loan-balances-from-schedule.ts
run_step "[10/16] Document template mappings (BL)" npx tsx scripts/map-bl-document-templates.ts
run_step "[11/16] Document template mappings (SL)" npx tsx scripts/map-sl-document-templates.ts
run_step "[12/16] Document template mappings (SML)" npx tsx scripts/map-sml-document-templates.ts
run_step "[13/16] Origination fees (Excel source)" npx tsx scripts/backfill-loan-origination-fees.ts --apply
run_step "[13b/16] Origination fees (MongoDB source, wider coverage)" npx tsx scripts/backfill-loan-origination-fees-mongo.ts --apply
run_step "[13c/16] Origination fees (inferred stragglers)" npx tsx scripts/backfill-loan-origination-fees-inferred.ts --apply
run_step "[14/16] Add-on / contractual interest rates" npx tsx scripts/backfill-loan-interest-rates.ts --apply
run_step "[15/16] Net proceeds recompute" npx tsx scripts/backfill-net-proceeds.ts

echo ""
echo "[16/16] Final verification..."
(cd "$BACKEND_DIR" && npx tsx scripts/check-migration-status.ts)

echo ""
echo "============================================"
echo "  Tapos na ang buong migration."
echo ""
echo "  PAALALA: Kailangan mong gumawa ng bagong MIS account -"
echo "  natanggal ang lahat ng users sa reset. Patakbuhin:"
echo "    cd app/backend"
echo "    BOOTSTRAP_ADMIN_EMAIL=... BOOTSTRAP_ADMIN_PASSWORD=... \\"
echo "      npx tsx scripts/bootstrap-admin.ts"
echo "============================================"
echo ""
read -p "Pindutin ang Enter para isara..."
