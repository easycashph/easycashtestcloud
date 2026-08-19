@echo off
setlocal EnableDelayedExpansion

pushd "%~dp0.."
set "ROOT_DIR=%CD%\"
popd

echo ============================================
echo   Easycash LMS - Backup Database + Attachments
echo ============================================
echo.
echo Ito ay kukuha ng backup ng LMS Postgres database (buong
echo borrower/loan/transaction data) AT ng attachment storage
echo folder (mga uploaded files - IDs, payslips, signed
echo contracts, atbp.), pareho mula sa Docker containers.
echo.
echo Mase-save sa: local\backups\
echo   - easycash_^<timestamp^>.dump   (database dump)
echo   - storage_^<timestamp^>.tar.gz  (attachment files)
echo.
echo Awtomatiko ring buburahin ang mga backup na mas matanda
echo sa 7 araw, at i-susync sa Google Drive kung naka-configure
echo na ang rclone.
echo.

echo [1/2] Chinicheck kung tumatakbo ang Postgres at backend...
docker inspect -f "{{.State.Running}}" easycash-postgres-1 >nul 2>&1
if errorlevel 1 (
  echo       Hindi tumatakbo ang Postgres. Sinisimulan ang docker compose stack...
  pushd "%ROOT_DIR%app\docker"
  docker compose up -d
  popd
  timeout /t 5 /nobreak >nul
)
echo.

echo [2/2] Ginagawa ang backup...
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT_DIR%local\backup-database.ps1"
if errorlevel 1 (
  echo.
  echo       May error sa backup - suriin ang error sa itaas.
  echo       Tignan din ang log: local\backups\backup.log
  echo.
  pause
  exit /b 1
)

echo.
echo ============================================
echo   Tapos na! Nasa local\backups\ ang bagong
echo   backup files. Tignan ang itaas kung na-sync
echo   din sa Google Drive.
echo ============================================
echo.
pause
