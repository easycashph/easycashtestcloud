@echo off
setlocal EnableDelayedExpansion

pushd "%~dp0.."
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

echo [1/16] Hinahanap ang pinaka-bagong .zip sa "%MONGO_DIR%"...
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
  echo [2/16] Na-extract na dati ang backup na ito - lalaktawan ang extraction.
) else (
  echo [2/16] Ina-extract ang "!LATEST_ZIP!" ^(maaaring tumagal ng ilang minuto^)...
  powershell -NoProfile -Command "Expand-Archive -Path '%MONGO_DIR%\!LATEST_ZIP!' -DestinationPath '%TARGET_DIR%' -Force"
  if errorlevel 1 (
    echo       FAILED ang extraction. Suriin ang error sa itaas.
    echo.
    pause
    exit /b 1
  )
)
echo.

echo [3/16] Chinicheck kung tumatakbo ang Postgres...
docker inspect -f "{{.State.Running}}" easycash-postgres-1 >nul 2>&1
if errorlevel 1 (
  echo       Hindi tumatakbo ang Postgres. Sinisimulan ang docker compose stack...
  pushd "%ROOT_DIR%app\docker"
  docker compose up -d postgres
  popd
  timeout /t 5 /nobreak >nul
)
echo.

echo [4/16] Dry run muna - tinitignan kung ano ang mga BAGONG record...
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
echo [5/16] Ina-apply ang mga bagong record sa database...
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

REM 2026-08-27 (user request): migrateBorrowers() already sets facebookLink/createdAt correctly
REM for BRAND-NEW borrowers created in step [5/16] above, but its upsert's `update: {}` is a no-op
REM for borrowers already migrated in an earlier run - so a client whose Facebook link or creation
REM date was added to SDevTech after they were first migrated here would never pick it up without
REM these. Both scripts are additive/idempotent - safe to run every time, they only ever fill a
REM currently-blank field, never overwrite one a staff member edited manually.
echo.
echo [6/16] Facebook Link backfill (SDevTech-sourced, existing clients)...
pushd "%BACKEND_DIR%"
call npx tsx scripts\backfill-legacy-borrower-facebook-links.ts --apply
if errorlevel 1 (
  echo.
  echo       May error sa Facebook Link backfill - suriin ang error sa itaas.
  popd
  echo.
  pause
  exit /b 1
)
popd

echo.
echo [7/16] Client creation-date backfill (SDevTech-sourced, existing clients)...
pushd "%BACKEND_DIR%"
call npx tsx scripts\backfill-legacy-borrower-created-dates.ts --apply
if errorlevel 1 (
  echo.
  echo       May error sa creation-date backfill - suriin ang error sa itaas.
  popd
  echo.
  pause
  exit /b 1
)
popd

echo.
echo [8/16] Ina-update ang repayment schedules (kung magkano na ang
echo       nabayaran kada installment) mula sa SDevTech...
REM 2026-08-14 (bug fix): this step was MISSING from this .bat entirely, even though
REM "legacy/Run Full Legacy Migration.command" has always had it as its step [7/18], BETWEEN the
REM core migration and the balance recompute below. Without it, every run of this file imported
REM new SDevTech payments as `loan_transactions` rows but never updated the matching
REM `repayment_schedules` paid amounts - so a loan could show a real payment in its transaction
REM history while its installments still read unpaid. Found 2026-08-14 on SML-PDC_00035 (Rafael
REM Alarcon Baguio): a real 7,000.00 payment (5,309.86 principal + 1,690.14 interest) existed as a
REM transaction but installment #4 still showed 0.00 principal paid. Worse, step [9/16] below
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
echo [9/16] Kinukumpleto ang balance ng bagong loans na walang
echo       account-level snapshot mula sa SDevTech (kinukuha mula sa
echo       kanya-kanyang repayment schedule)...
pushd "%BACKEND_DIR%"
call npx tsx scripts\recompute-active-loan-balances-from-schedule.ts
popd

REM 2026-08-29 (user-reported: Loan Releases Report showing blank Add-on/Contractual Interest Rate
REM and origination fee columns for freshly-migrated loans): these three origination-fee steps and
REM the interest-rate step below were entirely MISSING from this .bat, even though
REM "legacy/Run Full Legacy Migration.command"'s full-reset counterpart has always had them, in
REM this exact order. MUST run before Net Proceeds below - netProceeds = principal - origination
REM fees, so computing it before fees exist silently produces a wrong (too-high) value. Found via a
REM real incident: this gap had already left 658 loans' netProceeds wrong until both were backfilled
REM and Net Proceeds was re-run.
echo.
echo [10/16] Origination fees (Excel snapshot, no .xlsm needed)...
pushd "%BACKEND_DIR%"
call npx tsx scripts\backfill-loan-origination-fees.ts --apply
popd

echo.
echo [11/16] Origination fees (MongoDB source, wider coverage)...
pushd "%BACKEND_DIR%"
call npx tsx scripts\backfill-loan-origination-fees-mongo.ts --apply
popd

echo.
echo [12/16] Origination fees (inferred stragglers)...
pushd "%BACKEND_DIR%"
call npx tsx scripts\backfill-loan-origination-fees-inferred.ts --apply
popd

echo.
echo [13/16] Add-on / contractual interest rates...
pushd "%BACKEND_DIR%"
call npx tsx scripts\backfill-loan-interest-rates.ts --apply
popd

echo.
echo [14/16] Kinukumpleto ang Net Proceeds (principal minus origination
echo        fees) ng mga bagong loans...
pushd "%BACKEND_DIR%"
call npx tsx scripts\backfill-net-proceeds.ts
popd

echo.
echo [15/16] Ina-link ang mga na-reschedule/compromise-settle na loan
echo        (2026-08-29) sa bago nilang account, para malinaw sa LMS
echo        kung bakit sila na-close - kailangan munang tumakbo ang
echo        balance recompute sa itaas, kaya nandito ito pagkatapos.
pushd "%BACKEND_DIR%"
call npx tsx scripts\backfill-loan-restructure-compromise.ts --apply
if errorlevel 1 (
  echo.
  echo        May error sa restructure/compromise backfill - suriin ang
  echo        error sa itaas.
  popd
  echo.
  pause
  exit /b 1
)
popd

echo.
echo [16/17] Huling spot-check - tinitignan kung may loan na
echo       kailangan pa ng manual na atensyon...
pushd "%BACKEND_DIR%"
call npx tsx scripts\check-legacy-balance-integrity.ts
popd

REM 2026-08-30 (user request, found via a real Dashboard Portfolio at Risk mismatch against
REM Office Server PC): catches loans whose balance is stale relative to their own schedule - the
REM exact bug class this session hit repeatedly when a partial/manual fix skipped the recompute
REM step above. Read-only - only reports, never writes; exit code 1 if it finds anything.
echo.
echo [17/17] Sanity check - tinitignan kung may loan na kailangan pang
echo       i-recompute ang balance (baka may na-miss na hakbang sa itaas)...
pushd "%BACKEND_DIR%"
call npx tsx scripts\check-balance-recompute-needed.ts
popd

REM 2026-08-27 (user request): Mambu (pre-SDevTech) notes/address recovery is a completely
REM separate data source from the SDevTech dump this script otherwise syncs from - it needs its
REM own MySQL dump (legacy\mambu\easycash.sql), which isn't guaranteed to exist on every machine.
REM Guarded, not a hard step: skips cleanly with a message if the file isn't there, instead of
REM failing the whole sync over an optional input. Both scripts are additive/idempotent (upsert on
REM a legacyId, or "only fill a currently-empty field") - safe to run on every sync. The larger
REM heap limit works around a real out-of-memory crash parsing the ~20K-row `comment` table on
REM Node's default heap - see migrate-mambu-notes.ts's own usage comment.
echo.
if exist "%ROOT_DIR%legacy\mambu\easycash.sql" (
  echo [OPTIONAL] Mambu notes/address recovery - dump found, ina-apply...
  pushd "%BACKEND_DIR%"
  set NODE_OPTIONS=--max-old-space-size=8192
  call npx tsx scripts\migrate-mambu-notes.ts --apply
  call npx tsx scripts\backfill-mambu-customfield-addresses.ts --apply
  set NODE_OPTIONS=
  popd
) else (
  echo [OPTIONAL] Mambu notes/address recovery - walang nahanap na
  echo            legacy\mambu\easycash.sql, lalaktawan.
)

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
echo Kung may lumabas na loan(s) sa [16/17] sa itaas, i-check muna ang
echo mga iyon (tingnan ang comment sa loob ng
echo check-legacy-balance-integrity.ts para sa susunod na hakbang)
echo bago ipalagay na kumpleto ang update.
echo.
pause
