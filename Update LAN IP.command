#!/bin/bash
set -u

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_ENV="$ROOT_DIR/app/easycashbackend/.env"
FRONTEND_ENV="$ROOT_DIR/app/lmsfrontend/.env"
DOCKER_DIR="$ROOT_DIR/app/docker"

echo "============================================"
echo "  Easycash LMS - Update LAN IP"
echo "============================================"
echo
echo "Patakbuhin ito tuwing nagbago ang WiFi/network mo."
echo "Isang click lang ito para sa lahat: sisiguraduhing"
echo "tumatakbo ang Docker, ide-detect ang bagong LAN IP,"
echo "ia-update ang config, ire-rebuild ang Docker, at"
echo "bubuksan sa browser."
echo

echo "[1/5] Chinicheck kung tumatakbo ang Docker Desktop..."
if ! docker info >/dev/null 2>&1; then
  echo "      Hindi pa tumatakbo ang Docker. Sinisimulan ito..."
  if [ -d "/Applications/Docker.app" ]; then
    open -a Docker
  else
    echo "      HINDI nahanap ang Docker.app sa /Applications."
    echo "      Buksan mo muna ito nang mano-mano, tapos ulitin."
    echo
    read -n 1 -s -r -p "Pindutin ang kahit anong key para lumabas..."
    exit 1
  fi

  echo "      Naghihintay habang nagsi-start ang Docker Desktop"
  echo "      (puwedeng umabot ng 1-2 minuto sa unang buksan)..."
  DOCKER_READY=""
  for i in $(seq 1 60); do
    if docker info >/dev/null 2>&1; then
      DOCKER_READY=1
      break
    fi
    sleep 3
  done

  if [ -z "$DOCKER_READY" ]; then
    echo "      Hindi pa rin ready ang Docker pagkatapos maghintay."
    echo "      Tingnan kung may error sa Docker Desktop window, tapos"
    echo "      ulitin ang script na ito."
    echo
    read -n 1 -s -r -p "Pindutin ang kahit anong key para lumabas..."
    exit 1
  fi
  echo "      Ready na ang Docker."
else
  echo "      Tumatakbo na ang Docker."
fi
echo

echo "[2/5] Hinahanap ang kasalukuyang LAN IP address..."
ACTIVE_IFACE="$(route get default 2>/dev/null | awk '/interface: /{print $2}')"
NEW_IP=""
if [ -n "$ACTIVE_IFACE" ]; then
  NEW_IP="$(ipconfig getifaddr "$ACTIVE_IFACE" 2>/dev/null)"
fi
if [ -z "$NEW_IP" ]; then
  for iface in en0 en1; do
    NEW_IP="$(ipconfig getifaddr "$iface" 2>/dev/null)"
    [ -n "$NEW_IP" ] && break
  done
fi

if [ -z "$NEW_IP" ]; then
  echo "      HINDI mahanap ang LAN IP address. Siguraduhing"
  echo "      naka-connect ka sa WiFi/network, tapos subukan ulit."
  echo
  read -n 1 -s -r -p "Pindutin ang kahit anong key para lumabas..."
  exit 1
fi

echo "      Nahanap: $NEW_IP"
echo

echo "[3/5] Ina-update ang app/easycashbackend/.env at app/lmsfrontend/.env..."
# 2026-08-01: CORS_ORIGIN can carry more than just the LAN entry now (e.g. the
# https://easycash-lms.pages.dev / https://easycash-portal.pages.dev origins for the
# Cloudflare Pages-hosted sites) - a blind whole-line replace used to wipe those out on every
# LAN IP change. Instead: drop only the old LAN-IP-shaped entries (private ranges, port 5173),
# keep everything else untouched, then add the new LAN IP.
CURRENT_CORS="$(grep -E '^CORS_ORIGIN=' "$BACKEND_ENV" | head -1 | cut -d= -f2-)"
KEPT_ORIGINS="$(echo "$CURRENT_CORS" | tr ',' '\n' | grep -vE '^https?://(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)[0-9]+\.[0-9]+:5173$' | grep -v '^$')"
NEW_CORS="$(printf '%s\n%s\n' "$KEPT_ORIGINS" "http://${NEW_IP}:5173" | awk '!seen[$0]++' | paste -sd, -)"
ESCAPED_CORS="$(printf '%s' "$NEW_CORS" | sed 's/[&|]/\\&/g')"
sed -i '' -E "s|^CORS_ORIGIN=.*|CORS_ORIGIN=${ESCAPED_CORS}|" "$BACKEND_ENV"
sed -i '' -E "s|^VITE_API_BASE_URL=.*|VITE_API_BASE_URL=http://${NEW_IP}:4000/api/v1|" "$FRONTEND_ENV"
echo "      Tapos na i-update ang config files."
echo

echo "[4/5] Ina-update ang Docker containers..."
echo "      Ire-rebuild lang ang frontend (kailangan - naka-bake ang IP sa"
echo "      loob ng bundle nito). Ire-restart lang ang backend, walang"
echo "      rebuild - basta CORS_ORIGIN lang naman ang nagbabago, at"
echo "      binabasa iyon habang tumatakbo, hindi habang nagbi-build."
echo "      (Mas mabilis ngayon - nalaktawan na ang backend's mabigat na"
echo "      LibreOffice/npm rebuild, na hindi naman kailangan dito.)"
if ! (cd "$DOCKER_DIR" && docker compose up -d --build lmsfrontend); then
  echo
  echo "      May error sa Docker rebuild ng frontend - malamang may ibang"
  echo "      proseso (hal. \"npm run dev\") na humahawak pa rin sa"
  echo "      port 5173. Isara muna iyon nang mano-mano,"
  echo "      tapos ulitin ang script."
  echo
  read -n 1 -s -r -p "Pindutin ang kahit anong key para lumabas..."
  exit 1
fi
if ! (cd "$DOCKER_DIR" && docker compose up -d --force-recreate easycashbackend); then
  echo
  echo "      May error sa pag-restart ng backend - malamang may ibang"
  echo "      proseso na humahawak pa rin sa port 4000. Isara muna iyon"
  echo "      nang mano-mano, tapos ulitin ang script."
  echo
  read -n 1 -s -r -p "Pindutin ang kahit anong key para lumabas..."
  exit 1
fi

echo
echo "[5/5] Tapos na! Binubuksan sa browser..."
echo "============================================"
echo "  Bagong URL: http://${NEW_IP}:5173"
echo "============================================"
echo
echo "Sa phone mo, buksan din ang URL na ito (basta"
echo "parehong WiFi/network) para ma-access ang LMS system."
echo
echo "Kung may \"insecure download\" warning ang Chrome sa"
echo "pag-download ng file, normal iyan sa plain HTTP + LAN"
echo "IP setup - pindutin lang ang \"Download insecure file\"."
echo
open "http://${NEW_IP}:5173/"
read -n 1 -s -r -p "Pindutin ang kahit anong key para isara ang window na ito..."
