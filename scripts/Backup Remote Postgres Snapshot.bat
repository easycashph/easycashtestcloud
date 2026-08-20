@echo off
setlocal EnableDelayedExpansion

pushd "%~dp0.."
set "ROOT_DIR=%CD%\"
popd

echo ============================================
echo   Easycash LMS - Remote Postgres Snapshot
echo ============================================
echo.
echo Ito ay direktang kukuha ng bagong pg_dump snapshot mula sa
echo Postgres database ng office server, sa network/internet -
echo katulad ng pagkuha ng bagong MongoDB dump mula sa SDevTech,
echo pero direkta nang kumokonekta ang script (walang manual
echo zip-and-drop na kailangan).
echo.
echo Mase-save sa: local\backups\remote\
echo   - easycash_remote_^<timestamp^>.dump
echo.
echo Kailangan munang punan ang connection details sa
echo local\postgres-remote-backup.env - gagawa ang script ng
echo blangkong template kung wala pa ito.
echo.

echo [1/2] Chinicheck kung tumatakbo ang local Postgres container...
docker inspect -f "{{.State.Running}}" easycash-postgres-1 >nul 2>&1
if errorlevel 1 (
  echo       Hindi tumatakbo ang Postgres. Sinisimulan ang docker compose stack...
  pushd "%ROOT_DIR%app\docker"
  docker compose up -d postgres
  popd
  timeout /t 5 /nobreak >nul
)
echo.

echo [2/2] Kumukuha ng remote snapshot...
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT_DIR%scripts\backup-remote-postgres.ps1"
if errorlevel 1 (
  echo.
  echo       May error sa backup - suriin ang error sa itaas.
  echo       Tignan din ang log: local\backups\remote\backup.log
  echo.
  pause
  exit /b 1
)

echo.
echo ============================================
echo   Tapos na! Nasa local\backups\remote\ ang
echo   bagong snapshot.
echo ============================================
echo.
pause
