#!/bin/bash
# Easycash LMS - Mac Preview Launcher (equivalent ng "Run LMS Preview.bat" sa Windows)
# Double-click ito sa Finder para simulan ang Postgres (Docker) + backend + frontend dev servers.

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$ROOT_DIR/app/backend"
FRONTEND_DIR="$ROOT_DIR/app/frontend"
DOCKER_DIR="$ROOT_DIR/app/docker"

echo "============================================"
echo "  Easycash LMS - Starting Preview"
echo "  [HOT RELOAD MODE] http://localhost:5173"
echo "============================================"
echo ""

echo "[1/4] Sinisiguradong tumatakbo ang Docker Desktop..."
if ! docker info >/dev/null 2>&1; then
  echo "      Hindi pa tumatakbo ang Docker Desktop. Sinisimulan..."
  open -a Docker
  echo "      Naghihintay habang nagsi-start ang Docker (max 60 segundo)..."
  for i in $(seq 1 30); do
    docker info >/dev/null 2>&1 && break
    sleep 2
  done
fi

echo "[2/4] Sinisimulan ang Postgres (Docker)..."
(cd "$DOCKER_DIR" && docker compose up -d postgres)

echo "      Naghihintay habang healthy ang Postgres..."
for i in $(seq 1 15); do
  STATUS=$(docker inspect --format='{{.State.Health.Status}}' easycash-postgres-1 2>/dev/null)
  [ "$STATUS" = "healthy" ] && break
  sleep 2
done

BACKEND_RUNNING=$(lsof -i :4000 -sTCP:LISTEN -t 2>/dev/null)
if [ -n "$BACKEND_RUNNING" ]; then
  echo "      May backend na naka-detect sa port 4000 -- gagamitin na lang ang meron."
else
  echo "      Sinisimulan ang backend sa bagong Terminal window..."
  osascript -e "tell application \"Terminal\" to do script \"cd '$BACKEND_DIR' && npm run dev\""
  echo "[3/4] Naghihintay habang nagsi-start ang backend (10 segundo)..."
  sleep 10
fi

echo "[4/4] Sinisimulan ang frontend hot-reload dev server sa PORT 5173..."
osascript -e "tell application \"Terminal\" to do script \"cd '$FRONTEND_DIR' && echo 'HOT RELOAD MODE -- http://localhost:5173' && npm run dev\""

echo "      Naghihintay habang nagsi-start ang frontend (8 segundo)..."
sleep 8

echo "Binubuksan ang preview sa iyong default browser..."
open "http://localhost:5173/"

echo ""
echo "============================================"
echo "  [HOT RELOAD MODE] Nagba-browse ka ngayon sa"
echo "  http://localhost:5173 -- ito ang LOCAL DEV"
echo "  SERVER (may hot-reload), HINDI ang Docker"
echo "  frontend container."
echo ""
echo "  Huwag isara ang bagong Terminal windows na"
echo "  lumabas (backend at frontend) habang ginagamit"
echo "  mo pa ang preview."
echo "============================================"
echo ""
read -p "Pindutin ang Enter para isara ang window na ito..."
