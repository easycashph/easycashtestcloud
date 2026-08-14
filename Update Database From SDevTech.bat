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
echo "%MONGO_DIR%", i-eextract ito, tapos i-sync ang local Postgres
echo database mo mula doon.
echo.
echo LIGTAS ITO: hindi nito bubura-hin ang kahit anong existing na
echo data. Ang mga loan na may sariling transaction na naitala DITO
echo sa LMS mismo (hindi galing SDevTech) ay awtomatikong nilalaktawan
echo - protektado sila, hindi na sila ino-overwrite ng SDevTech.
echo.

echo [1/8] Hinahanap ang pinaka-bagong .zip sa "%MONGO_DIR%"...
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
  echo [2/8] Na-extract na dati ang backup na ito - lalaktawan ang extraction.
) else (
  echo [2/8] Ina-extract ang "!LATEST_ZIP!" ^(maaaring tumagal ng ilang minuto^)...
  powershell -NoProfile -Command "Expand-Archive -Path '%MONGO_DIR%\!LATEST_ZIP!' -DestinationPath '%TARGET_DIR%' -Force"
  if errorlevel 1 (
    echo       FAILED ang extraction. Suriin ang error sa itaas.
    echo.
    pause
    exit /b 1
  )
)
echo.

echo [3/8] Chinicheck kung tumatakbo ang Postgres...
docker inspect -f "{{.State.Running}}" easycash-postgres-1 >nul 2>&1
if errorlevel 1 (
  echo       Hindi tumatakbo ang Postgres. Sinisimulan ang docker compose stack...
  pushd "%ROOT_DIR%app\docker"
  docker compose up -d postgres
  popd
  timeout /t 5 /nobreak >nul
)
echo.

echo [4/8] Dry run muna - tinitignan kung ano ang mga BAGONG record...
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
echo [5/8] Ina-apply ang mga bagong record sa database...
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
echo [6/8] Ina-update ang repayment schedules (kung magkano na ang
echo       nabayaran kada installment) mula sa SDevTech...
REM 2026-08-14 (bug fix): this step was MISSING from this .bat entirely, even though
REM "legacy/Run Full Legacy Migration.command" has always had it as its step [7/18], BETWEEN the
REM core migration and the balance recompute below. Without it, every run of this file imported
REM new SDevTech payments as `loan_transactions` rows but never updated the matching
REM `repayment_schedules` paid amounts - so a loan could show a real payment in its transaction
REM history while its installments still read unpaid. Found 2026-08-14 on SML-PDC_00035 (Rafael
REM Alarcon Baguio): a real 7,000.00 payment (5,309.86 principal + 1,690.14 interest) existed as a
REM transaction but installment #4 still showed 0.00 principal paid. Worse, step [7/8] below
REM recomputes loan balances FROM this schedule - so a stale schedule quietly propagated the error
REM into the account-level balances too. Order matters: this must run BEFORE that recompute.
pushd "%BACKEND_DIR%"
call npx tsx scripts\migrate-repayment-schedules.ts
if errorlevel 1 (
  echo.
  echo       May error sa repayment schedules - suriin ang error sa itaas bago ulitin.
  popd
  echo.
  pause
  exit /b 1
)
popd

echo.
echo [7/8] Kinukumpleto ang balance ng bagong loans na walang
echo       account-level snapshot mula sa SDevTech (kinukuha mula sa
echo       kanya-kanyang repayment schedule)...
pushd "%BACKEND_DIR%"
call npx tsx scripts\recompute-active-loan-balances-from-schedule.ts
popd

echo.
echo [8/8] Huling spot-check - tinitignan kung may loan na
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
