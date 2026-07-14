@echo off
setlocal enabledelayedexpansion

set "ROOT_DIR=%~dp0"
set "EXPORT_DIR=%ROOT_DIR%legacy\db-exports"
set "BACKEND_DIR=%ROOT_DIR%app\backend"
set "POSTGRES_CONTAINER=easycash-postgres-1"
set "BACKEND_CONTAINER=easycash-backend-1"
set "PG_USER=easycash"
set "PG_DB=easycash"

echo ============================================
echo   Easycash LMS - Sync Database From Export
echo ============================================
echo.
echo Ito ay nagre-restore ng pinaka-BAGONG .dump file sa
echo "%EXPORT_DIR%" papunta sa LOCAL Postgres container mo
echo (%POSTGRES_CONTAINER%).
echo.
echo BABALA: Papalitan/dadaanan (--clean) ang laman ng iyong
echo local database ng laman ng dump file. Kung may sarili kang
echo hindi pa naka-export na local changes, huwag magpatuloy.
echo.

echo [1/6] Hinahanap ang pinaka-bagong export file...
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

set /p CONFIRM="Ituloy ang restore gamit ang file na ito? (Y/N): "
if /I not "%CONFIRM%"=="Y" (
  echo Kinansela ng user.
  goto :end
)

echo.
echo [2/6] Chinicheck kung tumatakbo ang %POSTGRES_CONTAINER%...
docker inspect -f "{{.State.Running}}" %POSTGRES_CONTAINER% >nul 2>&1
if errorlevel 1 (
  echo       Hindi nahanap ang container. Sinisimulan ang docker compose stack...
  pushd "%ROOT_DIR%app\docker"
  docker compose up -d postgres
  popd
  timeout /t 5 /nobreak >nul
)

echo [3/6] Kinokopya ang dump papasok sa container...
docker cp "%EXPORT_DIR%\%LATEST_DUMP%" %POSTGRES_CONTAINER%:/tmp/restore.dump
if errorlevel 1 (
  echo       FAILED sa docker cp. Suriin kung tama ang container name.
  goto :end
)

echo [4/6] Ni-restore ang database (--clean --if-exists)...
docker exec %POSTGRES_CONTAINER% pg_restore -U %PG_USER% -d %PG_DB% --clean --if-exists /tmp/restore.dump
if errorlevel 1 (
  echo       May mga warning/error sa pg_restore -- normal ito kung may
  echo       "does not exist, skipping" lines. Tignan sa itaas kung may
  echo       ibang seryosong error.
)

echo [5/6] Ni-restart ang backend container para fresh connections...
docker restart %BACKEND_CONTAINER% >nul 2>&1

echo [6/6] Ni-verify ang record counts pagkatapos ma-restore...
pushd "%BACKEND_DIR%"
call npx tsx scripts\verify-migration-counts.ts
popd

echo.
echo ============================================
echo   Tapos na. I-refresh ang browser tab mo.
echo ============================================

:end
echo.
pause
