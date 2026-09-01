#!/bin/bash
set -u

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MONGO_DIR="$ROOT_DIR/legacy/mongodb"
EXTRACTED_DIR="$MONGO_DIR/extracted"
BACKEND_DIR="$ROOT_DIR/app/easycashbackend"

echo "============================================"
echo "  Easycash LMS - Update Database from SDevTech"
echo "============================================"
echo
echo "Ito ay kukuha ng pinaka-bagong .zip na inilagay mo sa"
echo "\"$MONGO_DIR\", i-eextract ito, tapos i-sync ang local Postgres"
echo "database mo mula doon."
echo
echo "LIGTAS ITO: hindi nito bubura-hin ang kahit anong existing na"
echo "data. Ang mga loan na may sariling transaction na naitala DITO"
echo "sa LMS mismo (hindi galing SDevTech) ay awtomatikong nilalaktawan"
echo "- protektado sila, hindi na sila ino-overwrite ng SDevTech."
echo

echo "[1/18] Hinahanap ang pinaka-bagong .zip sa \"$MONGO_DIR\"..."
LATEST_ZIP="$(ls -t "$MONGO_DIR"/*.zip 2>/dev/null | head -1)"

if [ -z "$LATEST_ZIP" ]; then
  echo "      Walang nahanap na .zip file sa \"$MONGO_DIR\"."
  echo "      Ilagay muna doon ang bagong export mula sa SDevTech, tapos ulitin."
  echo
  read -n 1 -s -r -p "Pindutin ang kahit anong key para lumabas..."
  exit 1
fi
ZIP_BASENAME="$(basename "$LATEST_ZIP" .zip)"
echo "      Gagamitin: $(basename "$LATEST_ZIP")"
echo

TARGET_DIR="$EXTRACTED_DIR/$ZIP_BASENAME"

if [ -d "$TARGET_DIR/db-easycash" ]; then
  echo "[2/18] Na-extract na dati ang backup na ito - lalaktawan ang extraction."
else
  echo "[2/18] Ina-extract ang \"$(basename "$LATEST_ZIP")\" (maaaring tumagal ng ilang minuto)..."
  mkdir -p "$TARGET_DIR"
  if ! unzip -q -o "$LATEST_ZIP" -d "$TARGET_DIR"; then
    echo "      FAILED ang extraction. Suriin ang error sa itaas."
    echo
    read -n 1 -s -r -p "Pindutin ang kahit anong key para lumabas..."
    exit 1
  fi
fi
echo

echo "[3/18] Chinicheck kung tumatakbo ang Postgres..."
if ! docker inspect -f '{{.State.Running}}' easycash-postgres-1 >/dev/null 2>&1; then
  echo "      Hindi tumatakbo ang Postgres. Sinisimulan ang docker compose stack..."
  (cd "$ROOT_DIR/app/docker" && docker compose up -d postgres)
  sleep 5
fi
echo

echo "[4/18] Dry run muna - tinitignan kung ano ang mga BAGONG record..."
echo "      (walang isusulat pa sa database sa hakbang na ito)"
echo
(cd "$BACKEND_DIR" && npx tsx scripts/migrate-legacy-data.ts)
echo

read -r -p "Ituloy ang pag-apply ng mga bagong record sa itaas? (Y/N): " CONFIRM
if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
  echo "Kinansela ng user - walang isinulat sa database."
  echo
  read -n 1 -s -r -p "Pindutin ang kahit anong key para lumabas..."
  exit 0
fi

echo
echo "[5/18] Ina-apply ang mga bagong record sa database..."
if ! (cd "$BACKEND_DIR" && npx tsx scripts/migrate-legacy-data.ts --apply); then
  echo
  echo "      May error sa migration - suriin ang error sa itaas bago ulitin."
  echo
  read -n 1 -s -r -p "Pindutin ang kahit anong key para lumabas..."
  exit 1
fi

# 2026-08-27 (user request, ported from Update Database From SDevTech.bat): migrateBorrowers()
# already sets facebookLink/createdAt correctly for BRAND-NEW borrowers created in step [5/18]
# above, but its upsert's update: {} is a no-op for borrowers already migrated in an earlier run -
# so a client whose Facebook link or creation date was added to SDevTech after they were first
# migrated here would never pick it up without these. Both scripts are additive/idempotent - safe
# to run every time, they only ever fill a currently-blank field, never overwrite one a staff
# member edited manually.
echo
echo "[6/18] Facebook Link backfill (SDevTech-sourced, existing clients)..."
if ! (cd "$BACKEND_DIR" && npx tsx scripts/backfill-legacy-borrower-facebook-links.ts --apply); then
  echo
  echo "      May error sa Facebook Link backfill - suriin ang error sa itaas."
  echo
  read -n 1 -s -r -p "Pindutin ang kahit anong key para lumabas..."
  exit 1
fi

echo
echo "[7/18] Client creation-date backfill (SDevTech-sourced, existing clients)..."
if ! (cd "$BACKEND_DIR" && npx tsx scripts/backfill-legacy-borrower-created-dates.ts --apply); then
  echo
  echo "      May error sa creation-date backfill - suriin ang error sa itaas."
  echo
  read -n 1 -s -r -p "Pindutin ang kahit anong key para lumabas..."
  exit 1
fi

echo
echo "[8/18] Ina-update ang repayment schedules (kung magkano na ang"
echo "      nabayaran kada installment) mula sa SDevTech..."
# 2026-08-14 (bug fix, ported from Update Database From SDevTech.bat): this step was MISSING
# entirely, even though legacy/Run Full Legacy Migration.command has always had it as its step
# [7/18], BETWEEN the core migration and the balance recompute below. Without it, every run
# imported new SDevTech payments as loan_transactions rows but never updated the matching
# repayment_schedules paid amounts - so a loan could show a real payment in its transaction
# history while its installments still read unpaid. The balance recompute below reads FROM this
# schedule, so a stale schedule quietly propagated the error into account-level balances too.
# Order matters: this must run BEFORE that recompute.
if ! (cd "$BACKEND_DIR" && npx tsx scripts/migrate-repayment-schedules.ts); then
  echo
  echo "      May error sa repayment schedules - suriin ang error sa itaas bago ulitin."
  echo
  read -n 1 -s -r -p "Pindutin ang kahit anong key para lumabas..."
  exit 1
fi

echo
echo "[9/18] Kinukumpleto ang balance ng bagong loans na walang"
echo "      account-level snapshot mula sa SDevTech (kinukuha mula sa"
echo "      kanya-kanyang repayment schedule)..."
(cd "$BACKEND_DIR" && npx tsx scripts/recompute-active-loan-balances-from-schedule.ts)

# 2026-08-29 (bug fix, ported from Update Database From SDevTech.bat): these three origination-fee
# steps and the interest-rate step below were entirely MISSING, even though the full-reset
# counterpart has always had them, in this exact order. MUST run before Net Proceeds below -
# netProceeds = principal - origination fees, so computing it before fees exist silently produces
# a wrong (too-high) value. Found via a real incident: this gap had already left 658 loans'
# netProceeds wrong until both were backfilled and Net Proceeds was re-run.
echo
echo "[10/18] Origination fees (Excel snapshot, no .xlsm needed)..."
(cd "$BACKEND_DIR" && npx tsx scripts/backfill-loan-origination-fees.ts --apply)

echo
echo "[11/18] Origination fees (MongoDB source, wider coverage)..."
(cd "$BACKEND_DIR" && npx tsx scripts/backfill-loan-origination-fees-mongo.ts --apply)

echo
echo "[12/18] Origination fees (inferred stragglers)..."
(cd "$BACKEND_DIR" && npx tsx scripts/backfill-loan-origination-fees-inferred.ts --apply)

echo
echo "[13/18] Add-on / contractual interest rates..."
(cd "$BACKEND_DIR" && npx tsx scripts/backfill-loan-interest-rates.ts --apply)

# 2026-09-01 (user-confirmed: "sa sdev system ang Total Miscellaneous Fee ay Notarial Fee + Web Fee
# + Insurance Fee"): SDevTech's "Miscellaneous Fee" (mapped to this LMS's `otherFees` by step
# [11/18] above) is a displayed SUBTOTAL of Notarial+Web+Insurance, not a real distinct 9th fee -
# leaving it populated double-counts those three in netProceeds (= principal - ALL 9 origination
# fee fields). MUST run before Net Proceeds below, same ordering reasoning as the origination-fee
# steps above. Found via a real incident affecting 117+ loans (SL-CORP_00135, SL-REG_00119, and
# others) - see session log.
echo
echo "[14/18] Inaalis ang duplicate na \"Other Fees\" (SDevTech Miscellaneous"
echo "      Fee subtotal ng Notarial+Web+Insurance)..."
(cd "$BACKEND_DIR" && npx tsx scripts/backfill-remove-duplicate-other-fees.ts --apply)

echo
echo "[15/18] Kinukumpleto ang Net Proceeds (principal minus origination"
echo "      fees) ng mga bagong loans..."
(cd "$BACKEND_DIR" && npx tsx scripts/backfill-net-proceeds.ts)

echo
echo "[16/18] Ina-link ang mga na-reschedule/compromise-settle na loan"
echo "      (2026-08-29) sa bago nilang account, para malinaw sa LMS"
echo "      kung bakit sila na-close - kailangan munang tumakbo ang"
echo "      balance recompute sa itaas, kaya nandito ito pagkatapos."
if ! (cd "$BACKEND_DIR" && npx tsx scripts/backfill-loan-restructure-compromise.ts --apply); then
  echo
  echo "      May error sa restructure/compromise backfill - suriin ang"
  echo "      error sa itaas."
  echo
  read -n 1 -s -r -p "Pindutin ang kahit anong key para lumabas..."
  exit 1
fi

echo
echo "[17/18] Huling spot-check - tinitignan kung may loan na"
echo "      kailangan pa ng manual na atensyon..."
(cd "$BACKEND_DIR" && npx tsx scripts/check-legacy-balance-integrity.ts)

# 2026-08-30 (user request, found via a real Dashboard Portfolio at Risk mismatch against
# Office Server PC): catches loans whose balance is stale relative to their own schedule - the
# exact bug class this session hit repeatedly when a partial/manual fix skipped the recompute step
# above. Read-only - only reports, never writes; exit code 1 if it finds anything.
echo
echo "[18/18] Sanity check - tinitignan kung may loan na kailangan pang"
echo "      i-recompute ang balance (baka may na-miss na hakbang sa itaas)..."
(cd "$BACKEND_DIR" && npx tsx scripts/check-balance-recompute-needed.ts)

echo
echo "============================================"
echo "  Tapos na! Na-update ang database mula sa SDevTech."
echo "============================================"
echo
echo "Paalala: kung may mga bagong attachments (documents) na kasama"
echo "dito, metadata lang muna ang na-dagdag - patakbuhin pa ang"
echo "\"Backfill SDevTech Attachments.command\" kung gusto mong makuha"
echo "rin ang totoong files nila."
echo
echo "Kung may lumabas na loan(s) sa [17/18] sa itaas, i-check muna ang"
echo "mga iyon (tingnan ang comment sa loob ng"
echo "check-legacy-balance-integrity.ts para sa susunod na hakbang)"
echo "bago ipalagay na kumpleto ang update."
echo
read -n 1 -s -r -p "Pindutin ang kahit anong key para isara ang window na ito..."
