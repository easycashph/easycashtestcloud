#!/bin/bash
set -u

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
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

echo "[1/8] Hinahanap ang pinaka-bagong .zip sa \"$MONGO_DIR\"..."
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
  echo "[2/8] Na-extract na dati ang backup na ito - lalaktawan ang extraction."
else
  echo "[2/8] Ina-extract ang \"$(basename "$LATEST_ZIP")\" (maaaring tumagal ng ilang minuto)..."
  mkdir -p "$TARGET_DIR"
  if ! unzip -q -o "$LATEST_ZIP" -d "$TARGET_DIR"; then
    echo "      FAILED ang extraction. Suriin ang error sa itaas."
    echo
    read -n 1 -s -r -p "Pindutin ang kahit anong key para lumabas..."
    exit 1
  fi
fi
echo

echo "[3/8] Chinicheck kung tumatakbo ang Postgres..."
if ! docker inspect -f '{{.State.Running}}' easycash-postgres-1 >/dev/null 2>&1; then
  echo "      Hindi tumatakbo ang Postgres. Sinisimulan ang docker compose stack..."
  (cd "$ROOT_DIR/app/docker" && docker compose up -d postgres)
  sleep 5
fi
echo

echo "[4/8] Dry run muna - tinitignan kung ano ang mga BAGONG record..."
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
echo "[5/8] Ina-apply ang mga bagong record sa database..."
if ! (cd "$BACKEND_DIR" && npx tsx scripts/migrate-legacy-data.ts --apply); then
  echo
  echo "      May error sa migration - suriin ang error sa itaas bago ulitin."
  echo
  read -n 1 -s -r -p "Pindutin ang kahit anong key para lumabas..."
  exit 1
fi

echo
echo "[6/8] Ina-update ang repayment schedules (kung magkano na ang"
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
echo "[7/8] Kinukumpleto ang balance ng bagong loans na walang"
echo "      account-level snapshot mula sa SDevTech (kinukuha mula sa"
echo "      kanya-kanyang repayment schedule)..."
(cd "$BACKEND_DIR" && npx tsx scripts/recompute-active-loan-balances-from-schedule.ts)

echo
echo "[8/8] Huling spot-check - tinitignan kung may loan na"
echo "      kailangan pa ng manual na atensyon..."
(cd "$BACKEND_DIR" && npx tsx scripts/check-legacy-balance-integrity.ts)

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
echo "Kung may lumabas na loan(s) sa [8/8] sa itaas, i-check muna ang"
echo "mga iyon (tingnan ang comment sa loob ng"
echo "check-legacy-balance-integrity.ts para sa susunod na hakbang)"
echo "bago ipalagay na kumpleto ang update."
echo
read -n 1 -s -r -p "Pindutin ang kahit anong key para isara ang window na ito..."
