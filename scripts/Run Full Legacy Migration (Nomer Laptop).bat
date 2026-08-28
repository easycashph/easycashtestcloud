@echo off
setlocal EnableDelayedExpansion

REM ===============================
REM Easycash LMS - Full Legacy Migration (Windows / Nomer Laptop)
REM ===============================
REM Identical to "Run Full Legacy Migration (Office Server PC).bat" - nothing in that script is
REM actually Office-Server-specific (every path is %~dp0.. relative), this is just a per-machine
REM named copy so it's obvious at a glance which machine a session log entry was about. Keep both
REM files in sync if either one changes - see that file's own header/comments for the full 18-step
REM breakdown and the 2026-08-27 extraction if/else bug fix.
REM
REM WARNING: this runs "prisma migrate reset --force", which ERASES the local Postgres database
REM COMPLETELY (schema + all data) before rebuilding it fresh from the legacy backup. Local-only -
REM never touches GitHub or the remote MongoDB server. This is NOT the same as
REM "Update Database From SDevTech.bat" (safe, additive, skips already-migrated data) - only use
REM this one for a genuine from-scratch rebuild.

pushd "%~dp0.."
set "ROOT_DIR=%CD%\"
popd
set "BACKEND_DIR=%ROOT_DIR%app\easycashbackend"
set "MONGO_DIR=%ROOT_DIR%legacy\mongodb"
set "EXTRACTED_DIR=%MONGO_DIR%\extracted"

echo ============================================
echo   Easycash LMS - Full Legacy Migration
echo ============================================
echo.
echo BABALA: Ganap na tatanggalin (prisma migrate reset) ang laman ng iyong LOCAL
echo Postgres database bago ito muling itayo mula sa pinaka-bagong legacy MongoDB
echo backup. Local lang ang epekto nito - walang epekto sa GitHub o sa remote
echo MongoDB server.
echo.

echo Hinahanap ang pinaka-bagong .zip sa "%MONGO_DIR%"...
set "LATEST_ZIP="
for /f "delims=" %%F in ('dir /b /o-d "%MONGO_DIR%\*.zip" 2^>nul') do (
  if not defined LATEST_ZIP set "LATEST_ZIP=%%F"
)

if not defined LATEST_ZIP (
  echo X Walang nahanap na .zip backup sa "%MONGO_DIR%".
  echo   Patakbuhin muna ang backup-mongodb.bat, tapos ulitin.
  echo.
  pause
  exit /b 1
)
echo Gagamitin: !LATEST_ZIP!
echo.

set "ZIP_BASENAME=!LATEST_ZIP:.zip=!"
set "TARGET_DIR=%EXTRACTED_DIR%\!ZIP_BASENAME!"

REM 2026-08-27 bug fix (user-reported: the newest .zip was named as "Gagamitin" but never actually
REM got extracted, so migrate-legacy-data.ts silently fell back to whatever OLDER snapshot was
REM already extracted). Root cause: `if exist A if exist B (X) else (Y)` in batch only binds the
REM `else` to the SECOND `if` - when the target folder doesn't exist yet (the normal case for a
REM brand-new zip), the FIRST `if exist` is false and the whole two-if chain is a silent no-op,
REM never reaching either branch. Computing a single flag first sidesteps the chained-if/else
REM binding gotcha entirely.
set "NEED_EXTRACT=1"
if exist "%TARGET_DIR%\db-easycash" if exist "%TARGET_DIR%\db-address-api" set "NEED_EXTRACT=0"

if "%NEED_EXTRACT%"=="0" (
  echo Na-extract na dati ang backup na ito sa "%TARGET_DIR%" - lalaktawan ang extraction.
) else (
  echo Ina-extract ang db-easycash/ at db-address-api/...
  powershell -NoProfile -Command "Expand-Archive -Path '%MONGO_DIR%\!LATEST_ZIP!' -DestinationPath '%TARGET_DIR%' -Force"
  if errorlevel 1 (
    echo X FAILED ang extraction. Suriin ang error sa itaas.
    echo.
    pause
    exit /b 1
  )
)
echo.

set /p CONFIRM="Ituloy ang buong migration (reset + full rebuild)? (Y/N): "
if /I not "%CONFIRM%"=="Y" (
  echo Kinansela ng user.
  echo.
  pause
  exit /b 0
)

REM 2026-08-19 (user request): LoanApplication rows (and native, non-legacy Attachment uploads on
REM them - e.g. ID photos, contracts uploaded through the LMS itself) have no MongoDB source at
REM all, so the reset below would erase them with no way to rebuild them from the legacy backup.
REM Back them up here, before the reset, and restore them at the very end (after the fresh
REM migration finishes) - see backup-native-loan-applications.ts's own doc comment for the exact
REM scope (does NOT cover native Borrower/LoanAccount data - see that comment for why).
echo.
echo [BACKUP] Bina-backup ang mga loan application na hindi galing sa MongoDB
echo          (mga naka-encode sa LMS mismo) bago ang reset...
pushd "%BACKEND_DIR%"
call npx tsx scripts\backup-native-loan-applications.ts
popd

REM 2026-08-19 (user request): so staff can log in immediately after the migration, without
REM needing to re-run bootstrap-admin.ts and re-create every account by hand - see
REM backup-native-users.ts's own doc comment for the exact scope (email/password hash/roles/branch,
REM not sessions).
echo.
echo [BACKUP] Bina-backup ang mga user account (para makapag-log in agad
echo          matapos ang migration)...
pushd "%BACKEND_DIR%"
call npx tsx scripts\backup-native-users.ts
popd

REM 2026-08-20 (user request, prompted by a real 6-grant loss recovered manually via a lucky
REM same-day pg_dump - see session log §31): Roles & Permissions customizations made via the
REM live settings page have no other record and get silently reverted to seed.ts's defaults on
REM every reset - see backup-native-role-permissions.ts's own doc comment for the exact scope.
echo.
echo [BACKUP] Bina-backup ang mga Roles ^& Permissions setting (para hindi
echo          mawala ang custom na binigay na access)...
pushd "%BACKEND_DIR%"
call npx tsx scripts\backup-native-role-permissions.ts
popd

REM 2026-08-20 (user request): "buong system setting" - Document Templates customizations,
REM Reminder Settings (SMS/Email toggles), at System Announcements - see
REM backup-native-system-settings.ts's own doc comment for the exact scope (deliberately excludes
REM Loan Products, handled separately due to its financial-ledger impact).
echo.
echo [BACKUP] Bina-backup ang ibang system settings (Document Templates,
echo          Reminder Settings, Announcements)...
pushd "%BACKEND_DIR%"
call npx tsx scripts\backup-native-system-settings.ts
popd

REM 2026-08-20 (user request, real 6-account loss found and recovered manually via a lucky
REM same-day pg_dump - see session log): Portal self-service borrower login accounts have no other
REM record and are permanently wiped by a reset - see backup-native-portal-accounts.ts's own doc
REM comment for the exact scope (also where the "Borrower.id is not actually stable across a
REM reset" finding came from).
echo.
echo [BACKUP] Bina-backup ang mga Portal account (self-service na login
echo          ng mga borrower)...
pushd "%BACKEND_DIR%"
call npx tsx scripts\backup-native-portal-accounts.ts
popd

echo.
echo [1/18] Chinicheck kung tumatakbo ang Postgres...
docker inspect -f "{{.State.Running}}" easycash-postgres-1 >nul 2>&1
if errorlevel 1 (
  pushd "%ROOT_DIR%app\docker"
  docker compose up -d postgres
  popd
  timeout /t 5 /nobreak >nul
)

echo.
echo [2/18] Resetting database (schema + seed)...
pushd "%BACKEND_DIR%"
call npx prisma migrate reset --force
if errorlevel 1 goto :step_failed
popd

echo.
echo [3/18] CP12 core migration (products, borrowers, loans, transactions, attachments)...
pushd "%BACKEND_DIR%"
call npx tsx scripts\migrate-legacy-data.ts --apply
if errorlevel 1 goto :step_failed
popd

echo.
echo [4/18] PSGC reference data...
pushd "%BACKEND_DIR%"
call npx tsx scripts\import-psgc-reference-data.ts --apply
if errorlevel 1 goto :step_failed
popd

echo.
echo [5/18] Resolve coded addresses (PSGC lookup)...
pushd "%BACKEND_DIR%"
call npx tsx scripts\fix-coded-addresses.ts --apply
if errorlevel 1 goto :step_failed
popd

echo.
echo [6/18] Resolve remaining coded addresses (address-api fallback)...
pushd "%BACKEND_DIR%"
call npx tsx scripts\resolve-address-codes.ts
if errorlevel 1 goto :step_failed
popd

echo.
echo [7/18] Repayment schedules...
pushd "%BACKEND_DIR%"
call npx tsx scripts\migrate-repayment-schedules.ts --apply
if errorlevel 1 goto :step_failed
popd

echo.
echo [8/18] Flag loans with missing legacy balance data...
pushd "%BACKEND_DIR%"
call npx tsx scripts\flag-missing-balance-loans.ts --apply
if errorlevel 1 goto :step_failed
popd

echo.
echo [9/18] Recompute active-loan balances from schedule...
pushd "%BACKEND_DIR%"
call npx tsx scripts\recompute-active-loan-balances-from-schedule.ts
if errorlevel 1 goto :step_failed
popd

echo.
echo [10/18] Document template mappings (BL)...
pushd "%BACKEND_DIR%"
call npx tsx scripts\map-bl-document-templates.ts
if errorlevel 1 goto :step_failed
popd

echo.
echo [11/18] Document template mappings (SL)...
pushd "%BACKEND_DIR%"
call npx tsx scripts\map-sl-document-templates.ts
if errorlevel 1 goto :step_failed
popd

echo.
echo [12/18] Document template mappings (SML)...
pushd "%BACKEND_DIR%"
call npx tsx scripts\map-sml-document-templates.ts
if errorlevel 1 goto :step_failed
popd

echo.
echo [13/18] Origination fees (Excel snapshot, no .xlsm needed)...
pushd "%BACKEND_DIR%"
call npx tsx scripts\backfill-loan-origination-fees.ts --apply
if errorlevel 1 goto :step_failed
popd

echo.
echo [13b/18] Origination fees (MongoDB source, wider coverage)...
pushd "%BACKEND_DIR%"
call npx tsx scripts\backfill-loan-origination-fees-mongo.ts --apply
if errorlevel 1 goto :step_failed
popd

echo.
echo [13c/18] Origination fees (inferred stragglers)...
pushd "%BACKEND_DIR%"
call npx tsx scripts\backfill-loan-origination-fees-inferred.ts --apply
if errorlevel 1 goto :step_failed
popd

echo.
echo [14/18] Add-on / contractual interest rates...
pushd "%BACKEND_DIR%"
call npx tsx scripts\backfill-loan-interest-rates.ts --apply
if errorlevel 1 goto :step_failed
popd

echo.
echo [15/18] Net proceeds recompute...
pushd "%BACKEND_DIR%"
call npx tsx scripts\backfill-net-proceeds.ts
if errorlevel 1 goto :step_failed
popd

echo.
echo [16/18] City/municipality ZIP codes...
pushd "%BACKEND_DIR%"
call npx tsx scripts\import-ph-zip-codes.ts --apply
if errorlevel 1 goto :step_failed
popd

echo.
echo [17/18] NCR barangay-level ZIP codes...
pushd "%BACKEND_DIR%"
call npx tsx scripts\import-ncr-barangay-zip-codes.ts --apply
if errorlevel 1 goto :step_failed
popd

echo.
echo [18/18] Final verification...
pushd "%BACKEND_DIR%"
call npx tsx scripts\check-migration-status.ts
popd

echo.
echo [RESTORE] Ibinabalik ang mga user account (email/password/roles) na
echo           binackup bago ang reset - gamitin ang parehong login mo dati...
pushd "%BACKEND_DIR%"
call npx tsx scripts\restore-native-users.ts
popd

echo.
echo [RESTORE] Ibinabalik ang mga Roles ^& Permissions setting na binackup
echo           bago ang reset...
pushd "%BACKEND_DIR%"
call npx tsx scripts\restore-native-role-permissions.ts
popd

echo.
echo [RESTORE] Ibinabalik ang mga native loan application (at kanilang
echo           attachments) na binackup bago ang reset...
pushd "%BACKEND_DIR%"
call npx tsx scripts\restore-native-loan-applications.ts
popd

echo.
echo [RESTORE] Ibinabalik ang ibang system settings (Document Templates,
echo           Reminder Settings, Announcements) na binackup bago ang reset...
pushd "%BACKEND_DIR%"
call npx tsx scripts\restore-native-system-settings.ts
popd

echo.
echo [RESTORE] Ibinabalik ang mga Portal account (self-service na login
echo           ng mga borrower) na binackup bago ang reset...
pushd "%BACKEND_DIR%"
call npx tsx scripts\restore-native-portal-accounts.ts
popd

REM 2026-08-27 (user request): Mambu (pre-SDevTech) notes/address recovery is a completely
REM separate data source from MongoDB (a `prisma migrate reset --force` above wipes it too, same as
REM everything else) - needs its own MySQL dump (legacy\mambu\easycash.sql), which isn't guaranteed
REM to exist on every machine. Guarded, not a hard step: skips cleanly with a message if the file
REM isn't there. Both scripts are idempotent (upsert on a legacyId, or "only fill a currently-empty
REM field") - safe to run every time. The larger heap limit works around a real out-of-memory crash
REM parsing the ~20K-row Mambu `comment` table on Node's default heap.
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
echo   Tapos na ang buong migration.
echo.
echo   Kung na-backup ka bago mag-reset (tinitignan mo ang [BACKUP]
echo   sa itaas), dapat gumagana na agad ang dati mo ring email/password
echo   sa pag-log in - hindi na kailangang gumawa ng bagong account.
echo.
echo   Kung walang na-backup (unang beses gamitin ang .bat na ito,
echo   o walang laman ang legacy\native-backups\), kailangan mong
echo   gumawa ng bagong MIS account. Patakbuhin:
echo     cd app\easycashbackend
echo     set BOOTSTRAP_ADMIN_EMAIL=...
echo     set BOOTSTRAP_ADMIN_PASSWORD=...
echo     npx tsx scripts\bootstrap-admin.ts
echo ============================================
echo.
pause
exit /b 0

:step_failed
echo.
echo X FAILED - suriin ang error sa itaas.
popd
echo.
pause
exit /b 1
