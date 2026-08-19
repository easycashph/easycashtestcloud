@echo off
setlocal EnableDelayedExpansion

pushd "%~dp0.."
set "ROOT_DIR=%CD%\"
popd
set "BACKEND_DIR=%ROOT_DIR%app\easycashbackend"

echo ============================================
echo   Easycash LMS - Backfill SDevTech Attachments
echo ============================================
echo.
echo Ito ay kukuha ng totoong FILES (IDs, payslips, signed
echo contracts, atbp.) mula sa SDevTech SFTP server, para sa mga
echo attachment record na metadata pa lang sa database mo (hal.
echo pagkatapos mong patakbuhin ang "Update Database From
echo SDevTech.bat").
echo.
echo LIGTAS ITO: laktaw lang ang mga attachment na na-download na
echo dati - dadagdagan lang ang mga bago/kulang. Read-only ang
echo pag-access sa SFTP server, walang binabago doon.
echo.

echo [1/3] Chinicheck kung tumatakbo ang Postgres...
docker inspect -f "{{.State.Running}}" easycash-postgres-1 >nul 2>&1
if errorlevel 1 (
  echo       Hindi tumatakbo ang Postgres. Sinisimulan ang docker compose stack...
  pushd "%ROOT_DIR%app\docker"
  docker compose up -d postgres
  popd
  timeout /t 5 /nobreak >nul
)
echo.

echo [2/3] Dry run muna - tinitignan kung ilan ang kulang na files...
echo       ^(walang ida-download pa sa hakbang na ito^)
echo.
pushd "%BACKEND_DIR%"
call npx tsx scripts\backfill-legacy-attachments.ts
popd
echo.

set /p CONFIRM="Ituloy ang pag-download ng mga files sa itaas? (Y/N): "
if /I not "%CONFIRM%"=="Y" (
  echo Kinansela ng user - walang na-download.
  echo.
  pause
  exit /b 0
)

echo.
echo [3/3] Dina-download ang mga files mula SFTP...
echo       ^(maaaring tumagal ito depende sa dami ng files^)
echo.
pushd "%BACKEND_DIR%"
call npx tsx scripts\backfill-legacy-attachments.ts --apply
if errorlevel 1 (
  echo.
  echo       May error sa backfill - suriin ang error sa itaas.
  popd
  echo.
  pause
  exit /b 1
)
popd

echo.
echo ============================================
echo   Tapos na! Tignan sa itaas ang Reconciliation
echo   summary - kung may "skipped (no remote folder)"
echo   o "skipped (file not found)", ibig sabihin wala pa
echo   sa SFTP server yung mga files na iyon - normal ito
echo   kung kararating lang ng mga bagong record, subukan
echo   ulit mamaya.
echo ============================================
echo.
pause
