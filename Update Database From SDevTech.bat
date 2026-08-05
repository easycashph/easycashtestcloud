@echo off
setlocal EnableDelayedExpansion

pushd "%~dp0"
set "ROOT_DIR=%CD%\"
popd
set "MONGO_DIR=%ROOT_DIR%legacy\mongodb"
set "EXTRACTED_DIR=%MONGO_DIR%\extracted"
set "BACKEND_DIR=%ROOT_DIR%app\easycashbackend"

echo ============================================
echo   Easycash LMS - Update Database from SDevTech
echo ============================================
echo.
echo Ito ay kukuha ng pinaka-bagong .zip na inilagay mo sa
echo "%MONGO_DIR%", i-eextract ito, tapos DAGDAGAN lang ang
echo local Postgres database mo ng mga BAGONG record mula doon.
echo.
echo LIGTAS ITO: hindi nito babaguhin o bubura-hin ang kahit anong
echo existing na data - kasama na yung mga ginawa mo dito sa LMS
echo mismo (bagong loans, e-signature, atbp.). Magdadagdag lang ito
echo ng mga rekord na wala pa dito (bagong clients/loans/transactions
echo mula sa SDevTech).
echo.

echo [1/7] Hinahanap ang pinaka-bagong .zip sa "%MONGO_DIR%"...
set "LATEST_ZIP="
for /f "delims=" %%F in ('dir /b /o-d "%MONGO_DIR%\*.zip" 2^>nul') do (
  if not defined LATEST_ZIP set "LATEST_ZIP=%%F"
)

if not defined LATEST_ZIP (
  echo       Walang nahanap na .zip file sa "%MONGO_DIR%".
  echo       Ilagay muna doon ang bagong export mula sa SDevTech, tapos ulitin.
  echo.
  pause
  exit /b 1
)
echo       Gagamitin: !LATEST_ZIP!
echo.

set "ZIP_BASENAME=!LATEST_ZIP:.zip=!"
set "TARGET_DIR=%EXTRACTED_DIR%\!ZIP_BASENAME!"

if exist "%TARGET_DIR%\db-easycash" (
  echo [2/7] Na-extract na dati ang backup na ito - lalaktawan ang extraction.
) else (
  echo [2/7] Ina-extract ang "!LATEST_ZIP!" ^(maaaring tumagal ng ilang minuto^)...
  powershell -NoProfile -Command "Expand-Archive -Path '%MONGO_DIR%\!LATEST_ZIP!' -DestinationPath '%TARGET_DIR%' -Force"
  if errorlevel 1 (
    echo       FAILED ang extraction. Suriin ang error sa itaas.
    echo.
    pause
    exit /b 1
  )
)
echo.

echo [3/7] Chinicheck kung tumatakbo ang Postgres...
docker inspect -f "{{.State.Running}}" easycash-postgres-1 >nul 2>&1
if errorlevel 1 (
  echo       Hindi tumatakbo ang Postgres. Sinisimulan ang docker compose stack...
  pushd "%ROOT_DIR%app\docker"
  docker compose up -d postgres
  popd
  timeout /t 5 /nobreak >nul
)
echo.

echo [4/7] Dry run muna - tinitignan kung ano ang mga BAGONG record...
echo       ^(walang isusulat pa sa database sa hakbang na ito^)
echo.
pushd "%BACKEND_DIR%"
call npx tsx scripts\migrate-legacy-data.ts
popd
echo.

set /p CONFIRM="Ituloy ang pag-apply ng mga bagong record sa itaas? (Y/N): "
if /I not "%CONFIRM%"=="Y" (
  echo Kinansela ng user - walang isinulat sa database.
  echo.
  pause
  exit /b 0
)

echo.
echo [5/7] Ina-apply ang mga bagong record sa database...
pushd "%BACKEND_DIR%"
call npx tsx scripts\migrate-legacy-data.ts --apply
if errorlevel 1 (
  echo.
  echo       May error sa migration - suriin ang error sa itaas bago ulitin.
  popd
  echo.
  pause
  exit /b 1
)
popd

echo.
echo [6/7] Kinukumpleto ang balance ng bagong loans na walang
echo       account-level snapshot mula sa SDevTech (kinukuha mula sa
echo       kanya-kanyang repayment schedule)...
pushd "%BACKEND_DIR%"
call npx tsx scripts\recompute-active-loan-balances-from-schedule.ts
popd

echo.
echo [7/7] Huling spot-check - tinitignan kung may loan na
echo       kailangan pa ng manual na atensyon...
pushd "%BACKEND_DIR%"
call npx tsx scripts\check-legacy-balance-integrity.ts
popd

echo.
echo ============================================
echo   Tapos na! Na-update ang database mula sa SDevTech.
echo ============================================
echo.
echo Paalala: kung may mga bagong attachments (documents) na kasama
echo dito, metadata lang muna ang na-dagdag - patakbuhin pa ang SFTP
echo backfill script (scripts\backfill-legacy-attachments.ts) kung
echo gusto mong makuha rin ang totoong files nila.
echo.
echo Kung may lumabas na loan(s) sa [7/7] sa itaas, i-check muna ang
echo mga iyon (tingnan ang comment sa loob ng
echo check-legacy-balance-integrity.ts para sa susunod na hakbang)
echo bago ipalagay na kumpleto ang update.
echo.
pause
