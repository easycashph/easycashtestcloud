#!/bin/bash
set -u

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/app/easycashbackend"

echo "============================================"
echo "  Easycash LMS - Backfill SDevTech Attachments"
echo "============================================"
echo
echo "Ito ay kukuha ng totoong FILES (IDs, payslips, signed"
echo "contracts, atbp.) mula sa SDevTech SFTP server, para sa mga"
echo "attachment record na metadata pa lang sa database mo (hal."
echo "pagkatapos mong patakbuhin ang \"Update Database From"
echo "SDevTech.command\")."
echo
echo "LIGTAS ITO: laktaw lang ang mga attachment na na-download na"
echo "dati - dadagdagan lang ang mga bago/kulang. Read-only ang"
echo "pag-access sa SFTP server, walang binabago doon."
echo

echo "[1/3] Chinicheck kung tumatakbo ang Postgres..."
if ! docker inspect -f '{{.State.Running}}' easycash-postgres-1 >/dev/null 2>&1; then
  echo "      Hindi tumatakbo ang Postgres. Sinisimulan ang docker compose stack..."
  (cd "$ROOT_DIR/app/docker" && docker compose up -d postgres)
  sleep 5
fi
echo

echo "[2/3] Dry run muna - tinitignan kung ilan ang kulang na files..."
echo "      (walang ida-download pa sa hakbang na ito)"
echo
(cd "$BACKEND_DIR" && npx tsx scripts/backfill-legacy-attachments.ts)
echo

read -r -p "Ituloy ang pag-download ng mga files sa itaas? (Y/N): " CONFIRM
if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
  echo "Kinansela ng user - walang na-download."
  echo
  read -n 1 -s -r -p "Pindutin ang kahit anong key para lumabas..."
  exit 0
fi

echo
echo "[3/3] Dina-download ang mga files mula SFTP..."
echo "      (maaaring tumagal ito depende sa dami ng files)"
echo
if ! (cd "$BACKEND_DIR" && npx tsx scripts/backfill-legacy-attachments.ts --apply); then
  echo
  echo "      May error sa backfill - suriin ang error sa itaas."
  echo
  read -n 1 -s -r -p "Pindutin ang kahit anong key para lumabas..."
  exit 1
fi

echo
echo "============================================"
echo "  Tapos na! Tignan sa itaas ang Reconciliation"
echo "  summary - kung may \"skipped (no remote folder)\""
echo "  o \"skipped (file not found)\", ibig sabihin wala pa"
echo "  sa SFTP server yung mga files na iyon - normal ito"
echo "  kung kararating lang ng mga bagong record, subukan"
echo "  ulit mamaya."
echo "============================================"
echo
read -n 1 -s -r -p "Pindutin ang kahit anong key para isara ang window na ito..."
