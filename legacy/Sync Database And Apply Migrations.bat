@echo off
setlocal enabledelayedexpansion

rem This script lives in legacy\, but the project root (app\, legacy\db-exports\) is one level up.
pushd "%~dp0.."
set "ROOT_DIR=%CD%\"
popd
set "EXPORT_DIR=%ROOT_DIR%legacy\db-exports"
set "BACKEND_DIR=%ROOT_DIR%app\backend"
set "POSTGRES_CONTAINER=easycash-postgres-1"
set "BACKEND_CONTAINER=easycash-backend-1"
set "PG_USER=easycash"
set "PG_DB=easycash"

echo ============================================
echo   Easycash LMS - Sync Database + Apply Migrations
echo ============================================
echo.
echo Ito ay nagre-restore ng pinaka-BAGONG .dump file sa
echo "%EXPORT_DIR%" papunta sa LOCAL Postgres container mo
echo (%POSTGRES_CONTAINER%), TAPOS awtomatikong ia-apply ang lahat ng
echo Prisma migrations (prisma migrate deploy).
echo.
echo BAKIT KAILANGAN ITO: ang dump ay maaaring galing sa colleague na may
echo IBANG schema snapshot (hal. wala pang ilang bagong column na idinagdag
echo dito, tulad ng anticipatedDisbursementDate). Ang plain na
echo "Sync Database From Export.bat" ay pumapalit sa SCHEMA din, hindi lang
echo sa data - kaya nawawala ang mga bagong column/migration natin.
echo Ang script na ito ay nagbabalik sa schema sa tama PAGKATAPOS mag-restore,
echo gamit ang mga migration file na naka-Git (hindi umaasa sa dump).
echo.
echo BABALA: Papalitan/dadaanan (--clean) ang laman ng iyong local database
echo ng laman ng dump file. Kung may sarili kang hindi pa naka-export na
echo local changes, huwag magpatuloy.
echo.

echo [1/7] Hinahanap ang pinaka-bagong export file...
set "LATEST_DUMP="
for /f "delims=" %%F in ('dir /b /o-d "%EXPORT_DIR%\*.dump" 2^>nul') do (
  if not defined LATEST_DUMP set "LATEST_DUMP=%%F"
)

if not defined LATEST_DUMP (
  echo       Walang nahanap na .dump file sa "%EXPORT_DIR%".
  echo       Ilagay muna doon ang na-transfer na export file, tapos ulitin.
  goto :end
)
echo       Gagamitin: %LATEST_DUMP%
echo.

set /p CONFIRM="Ituloy ang restore + migrate gamit ang file na ito? (Y/N): "
if /I not "%CONFIRM%"=="Y" (
  echo Kinansela ng user.
  goto :end
)

echo.
echo [2/7] Chinicheck kung tumatakbo ang %POSTGRES_CONTAINER%...
docker inspect -f "{{.State.Running}}" %POSTGRES_CONTAINER% >nul 2>&1
if errorlevel 1 (
  echo       Hindi nahanap ang container. Sinisimulan ang docker compose stack...
  pushd "%ROOT_DIR%app\docker"
  docker compose up -d postgres
  popd
  timeout /t 5 /nobreak >nul
)

echo [3/7] Kinokopya ang dump papasok sa container...
docker cp "%EXPORT_DIR%\%LATEST_DUMP%" %POSTGRES_CONTAINER%:/tmp/restore.dump
if errorlevel 1 (
  echo       FAILED sa docker cp. Suriin kung tama ang container name.
  goto :end
)

echo [4/7] Ni-restore ang database (--clean --if-exists)...
docker exec %POSTGRES_CONTAINER% pg_restore -U %PG_USER% -d %PG_DB% --clean --if-exists /tmp/restore.dump
if errorlevel 1 (
  echo       May mga warning/error sa pg_restore -- normal ito kung may
  echo       "does not exist, skipping" lines. Tignan sa itaas kung may
  echo       ibang seryosong error.
)

echo [5/7] Ini-apply ang Prisma migrations para ibalik ang tamang schema...
pushd "%BACKEND_DIR%"
call npx prisma migrate deploy
if errorlevel 1 (
  echo       FAILED ang prisma migrate deploy - suriin ang error sa itaas.
  popd
  goto :end
)
popd

echo [6/7] Ni-restart ang backend container para fresh connections...
docker restart %BACKEND_CONTAINER% >nul 2>&1

echo [7/7] Ni-verify ang record counts pagkatapos ma-restore...
pushd "%BACKEND_DIR%"
call npx tsx scripts\verify-migration-counts.ts
popd

echo.
echo ============================================
echo   Tapos na. I-refresh ang browser tab mo.
echo   Paalala: baka kailangan mo pa ring i-re-seed
echo   (npx tsx prisma\seed.ts) at i-re-apply ang mga
echo   one-time data scripts (hal. backfill-net-proceeds.ts,
echo   map-sml-document-templates.ts) kung wala pa ang laman
echo   ng dump na ito.
echo ============================================

:end
echo.
pause
