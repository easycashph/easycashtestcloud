#!/bin/bash
# ===============================
# Easycash LMS - Full Legacy Migration (Mac / Macbook Nomer)
# ===============================
# Mac counterpart of "Run Full Legacy Migration (Office Server PC).bat" - same 19 steps, same
# order, same scripts, same backup/restore-native-* + optional Mambu recovery steps. Turnkey re-run
# of the entire CP12 migration + every follow-up backfill script, against whichever
# legacy/mongodb/*.zip backup is newest.
#
# WARNING: this runs "prisma migrate reset --force", which ERASES the local Postgres database
# COMPLETELY (schema + all data) before rebuilding it fresh from the legacy backup. Local-only -
# never touches GitHub or the remote MongoDB server. This is NOT the same as
# "Update Database From SDevTech.bat" (safe, additive, skips already-migrated data) - only use this
# one for a genuine from-scratch rebuild.
#
# Supersedes the older legacy/Run Full Legacy Migration.command, which predates the app/backend ->
# app/easycashbackend rename and is missing the backup-native-*/restore-native-*/Mambu steps below -
# keep this file (and the two Windows .bat siblings) in sync if any of them change.

set -uo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/app/easycashbackend"
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
# 2026-08-27 bug fix (ported from the Windows .bat siblings - user-reported: the newest .zip was
# named as "Gagamitin" but never actually got extracted, so migrate-legacy-data.ts silently fell
# back to whatever OLDER snapshot was already extracted). A single up-front check avoids that class
# of bug entirely - no chained if/else to get wrong.
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

# 2026-08-19/20 (user request, ported from the Windows .bat siblings): these have no MongoDB
# source at all (native LoanApplication rows, user accounts, Roles & Permissions customizations,
# other system settings, Portal accounts) - a reset below would erase them permanently with no way
# to rebuild from the legacy backup. Back them up now, restore them at the very end. See each
# backup-native-*.ts script's own doc comment for its exact scope.
echo ""
echo "[BACKUP] Bina-backup ang mga loan application na hindi galing sa MongoDB"
echo "         (mga naka-encode sa LMS mismo) bago ang reset..."
(cd "$BACKEND_DIR" && npx tsx scripts/backup-native-loan-applications.ts)

echo ""
echo "[BACKUP] Bina-backup ang mga user account (para makapag-log in agad"
echo "         matapos ang migration)..."
(cd "$BACKEND_DIR" && npx tsx scripts/backup-native-users.ts)

echo ""
echo "[BACKUP] Bina-backup ang mga Roles & Permissions setting (para hindi"
echo "         mawala ang custom na binigay na access)..."
(cd "$BACKEND_DIR" && npx tsx scripts/backup-native-role-permissions.ts)

echo ""
echo "[BACKUP] Bina-backup ang ibang system settings (Document Templates,"
echo "         Reminder Settings, Announcements)..."
(cd "$BACKEND_DIR" && npx tsx scripts/backup-native-system-settings.ts)

echo ""
echo "[BACKUP] Bina-backup ang mga Portal account (self-service na login"
echo "         ng mga borrower)..."
(cd "$BACKEND_DIR" && npx tsx scripts/backup-native-portal-accounts.ts)

echo ""
echo "[1/19] Chinicheck kung tumatakbo ang Postgres..."
if ! docker inspect -f '{{.State.Running}}' easycash-postgres-1 >/dev/null 2>&1; then
  (cd "$ROOT_DIR/app/docker" && docker compose up -d postgres)
  sleep 5
fi

run_step "[2/19] Resetting database (schema + seed)" npx prisma migrate reset --force
run_step "[3/19] CP12 core migration (products, borrowers, loans, transactions, attachments)" npx tsx scripts/migrate-legacy-data.ts --apply
run_step "[4/19] PSGC reference data" npx tsx scripts/import-psgc-reference-data.ts --apply
run_step "[5/19] Resolve coded addresses (PSGC lookup)" npx tsx scripts/fix-coded-addresses.ts --apply
run_step "[6/19] Resolve remaining coded addresses (address-api fallback)" npx tsx scripts/resolve-address-codes.ts
run_step "[7/19] Repayment schedules" npx tsx scripts/migrate-repayment-schedules.ts --apply
run_step "[8/19] Flag loans with missing legacy balance data" npx tsx scripts/flag-missing-balance-loans.ts --apply
run_step "[9/19] Recompute active-loan balances from schedule" npx tsx scripts/recompute-active-loan-balances-from-schedule.ts
run_step "[10/19] Document template mappings (BL)" npx tsx scripts/map-bl-document-templates.ts
run_step "[11/19] Document template mappings (SL)" npx tsx scripts/map-sl-document-templates.ts
run_step "[12/19] Document template mappings (SML)" npx tsx scripts/map-sml-document-templates.ts
run_step "[13/19] Origination fees (Excel snapshot, no .xlsm needed)" npx tsx scripts/backfill-loan-origination-fees.ts --apply
run_step "[13b/19] Origination fees (MongoDB source, wider coverage)" npx tsx scripts/backfill-loan-origination-fees-mongo.ts --apply
run_step "[13c/19] Origination fees (inferred stragglers)" npx tsx scripts/backfill-loan-origination-fees-inferred.ts --apply
run_step "[14/19] Add-on / contractual interest rates" npx tsx scripts/backfill-loan-interest-rates.ts --apply
run_step "[15/19] Net proceeds recompute" npx tsx scripts/backfill-net-proceeds.ts
run_step "[16/19] City/municipality ZIP codes" npx tsx scripts/import-ph-zip-codes.ts --apply
run_step "[17/19] NCR barangay-level ZIP codes" npx tsx scripts/import-ncr-barangay-zip-codes.ts --apply
# 2026-08-29: needs step [9/19]'s balance recompute to have already run - old loans without an
# account-level balance snapshot in the source (most Reschedule/Compromise cases) only get a real
# Collections Balance figure after that step, not from the raw legacy dump.
run_step "[18/19] Link rescheduled/compromise-settled loans to their new account" npx tsx scripts/backfill-loan-restructure-compromise.ts --apply

echo ""
echo "[19/19] Final verification..."
(cd "$BACKEND_DIR" && npx tsx scripts/check-migration-status.ts)

echo ""
echo "[RESTORE] Ibinabalik ang mga user account (email/password/roles) na"
echo "          binackup bago ang reset - gamitin ang parehong login mo dati..."
(cd "$BACKEND_DIR" && npx tsx scripts/restore-native-users.ts)

echo ""
echo "[RESTORE] Ibinabalik ang mga Roles & Permissions setting na binackup"
echo "          bago ang reset..."
(cd "$BACKEND_DIR" && npx tsx scripts/restore-native-role-permissions.ts)

echo ""
echo "[RESTORE] Ibinabalik ang mga native loan application (at kanilang"
echo "          attachments) na binackup bago ang reset..."
(cd "$BACKEND_DIR" && npx tsx scripts/restore-native-loan-applications.ts)

echo ""
echo "[RESTORE] Ibinabalik ang ibang system settings (Document Templates,"
echo "          Reminder Settings, Announcements) na binackup bago ang reset..."
(cd "$BACKEND_DIR" && npx tsx scripts/restore-native-system-settings.ts)

echo ""
echo "[RESTORE] Ibinabalik ang mga Portal account (self-service na login"
echo "          ng mga borrower) na binackup bago ang reset..."
(cd "$BACKEND_DIR" && npx tsx scripts/restore-native-portal-accounts.ts)

# 2026-08-27 (ported from the Windows .bat siblings): Mambu (pre-SDevTech) notes/address recovery
# is a completely separate data source from MongoDB (the reset above wipes it too, same as
# everything else) - needs its own MySQL dump (legacy/mambu/easycash.sql), which isn't guaranteed
# to exist on every machine. Guarded, not a hard step: skips cleanly with a message if the file
# isn't there. Both scripts are idempotent (upsert on a legacyId, or "only fill a currently-empty
# field") - safe to run every time. The larger heap limit works around a real out-of-memory crash
# parsing the ~20K-row Mambu "comment" table on Node's default heap.
echo ""
if [ -f "$ROOT_DIR/legacy/mambu/easycash.sql" ]; then
  echo "[OPTIONAL] Mambu notes/address recovery - dump found, ina-apply..."
  (cd "$BACKEND_DIR" && NODE_OPTIONS=--max-old-space-size=8192 npx tsx scripts/migrate-mambu-notes.ts --apply)
  (cd "$BACKEND_DIR" && NODE_OPTIONS=--max-old-space-size=8192 npx tsx scripts/backfill-mambu-customfield-addresses.ts --apply)
else
  echo "[OPTIONAL] Mambu notes/address recovery - walang nahanap na"
  echo "           legacy/mambu/easycash.sql, lalaktawan."
fi

echo ""
echo "============================================"
echo "  Tapos na ang buong migration."
echo ""
echo "  Kung na-backup ka bago mag-reset (tinitignan mo ang [BACKUP]"
echo "  sa itaas), dapat gumagana na agad ang dati mo ring email/password"
echo "  sa pag-log in - hindi na kailangang gumawa ng bagong account."
echo ""
echo "  Kung walang na-backup (unang beses gamitin ang script na ito,"
echo "  o walang laman ang legacy/native-backups/), kailangan mong"
echo "  gumawa ng bagong MIS account. Patakbuhin:"
echo "    cd app/easycashbackend"
echo "    BOOTSTRAP_ADMIN_EMAIL=... BOOTSTRAP_ADMIN_PASSWORD=... \\"
echo "      npx tsx scripts/bootstrap-admin.ts"
echo "============================================"
echo ""
read -p "Pindutin ang Enter para isara..."
