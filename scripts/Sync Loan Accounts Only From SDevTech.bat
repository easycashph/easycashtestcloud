@echo off
setlocal EnableDelayedExpansion

pushd "%~dp0.."
set "ROOT_DIR=%CD%\"
popd
set "MONGO_DIR=%ROOT_DIR%legacy\mongodb"
set "EXTRACTED_DIR=%MONGO_DIR%\extracted"
set "BACKEND_DIR=%ROOT_DIR%app\easycashbackend"

echo ============================================
echo   Easycash LMS - Sync Loan Accounts Only (SDevTech)
echo ============================================
echo.
echo Ito ay kukuha ng pinaka-bagong .zip na inilagay mo sa
echo "%MONGO_DIR%", i-eextract ito, tapos i-sync LANG ang
echo LOAN ACCOUNTS (kasama ang schedule at payment history nila) -
echo hindi ito ang buong migration (walang clients/comments/
echo attachments/co-borrowers/products na gagalawin).
echo.
echo LIGTAS ITO: hindi nito bubura-hin ang kahit anong existing na
echo data. Ang mga loan na may sariling transaction na naitala DITO
echo sa LMS mismo (hindi galing SDevTech) ay awtomatikong nilalaktawan.
echo.
echo IMPORTANTE: kailangan ALAM MO NA ang eksaktong loan code(s) na
echo gusto mong i-sync (hal. SML-REG_00391) - ang client ay dapat
echo NA EXISTING NA sa LMS bago pa man (hahanapin lang ito, hindi
echo ito gagawing bago). Kung hindi mo pa alam kung ano ang mga bagong
echo loan code, kanselahin muna ito at itanong sa iyong AI assistant.
echo.

echo [1/4] Hinahanap ang pinaka-bagong .zip sa "%MONGO_DIR%"...
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
  echo [2/4] Na-extract na dati ang backup na ito - lalaktawan ang extraction.
) else (
  echo [2/4] Ina-extract ang "!LATEST_ZIP!" ^(maaaring tumagal ng ilang minuto^)...
  powershell -NoProfile -Command "Expand-Archive -Path '%MONGO_DIR%\!LATEST_ZIP!' -DestinationPath '%TARGET_DIR%' -Force"
  if errorlevel 1 (
    echo       FAILED ang extraction. Suriin ang error sa itaas.
    echo.
    pause
    exit /b 1
  )
)
echo.

echo [3/4] Chinicheck kung tumatakbo ang Postgres...
docker inspect -f "{{.State.Running}}" easycash-postgres-1 >nul 2>&1
if errorlevel 1 (
  echo       Hindi tumatakbo ang Postgres. Sinisimulan ang docker compose stack...
  pushd "%ROOT_DIR%app\docker"
  docker compose up -d postgres
  popd
  timeout /t 5 /nobreak >nul
)
echo.

set "LOAN_CODES="
set /p LOAN_CODES="Ilagay ang loan code(s) na i-sync, comma-separated (hal. SML-REG_00391,SML-REG_00392): "
if "!LOAN_CODES!"=="" (
  echo.
  echo Walang inilagay na loan code - kinansela.
  echo.
  pause
  exit /b 0
)

echo.
echo [4/4] Dry run muna - tinitignan kung ano ang ise-sync...
echo       ^(walang isusulat pa sa database sa hakbang na ito^)
echo.
pushd "%BACKEND_DIR%"
call npx tsx scripts\sync-loan-accounts-only.ts --only=!LOAN_CODES!
popd
echo.

echo Suriin munang mabuti ang Preview sa itaas - lalo na kung may
echo makikitang "DUPLICATE loan code" o "borrower not found" o
echo outlier na amount. Huwag ipagpatuloy kung may kaduda-duda.
echo.
set /p CONFIRM="Ituloy ang pag-apply ng mga record sa itaas? (Y/N): "
if /I not "%CONFIRM%"=="Y" (
  echo Kinansela ng user - walang isinulat sa database.
  echo.
  pause
  exit /b 0
)

echo.
echo Ina-apply ang mga loan account sa database...
pushd "%BACKEND_DIR%"
call npx tsx scripts\sync-loan-accounts-only.ts --only=!LOAN_CODES! --apply
if errorlevel 1 (
  echo.
  echo       May error sa sync - suriin ang error sa itaas bago ulitin.
  popd
  echo.
  pause
  exit /b 1
)
popd

echo.
echo ============================================
echo   Tapos na! Na-sync ang loan account(s): !LOAN_CODES!
echo ============================================
echo.
echo Paalala: loan_accounts, repayment_schedules, at loan_transactions
echo lang ang nagalaw nito. Kung kailangan mo rin ng ibang backfill
echo (hal. origination fees, interest rates, Net Proceeds) para dito
echo sa bagong loan, patakbuhin pa ang mga kaukulang script - tingnan
echo ang "Update Database From SDevTech.bat" bilang reference sa
echo kung anong sunod na hakbang ang kadalasang kailangan.
echo.
pause
