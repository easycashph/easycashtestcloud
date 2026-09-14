@echo off
setlocal EnableDelayedExpansion

REM ===============================
REM Easycash LMS - Sync After Pull (Windows / New Machine)
REM ===============================
REM Identical to "Sync After Pull (Office Server PC).bat" - nothing in that script is actually
REM Office-Server-specific (every path is %~dp0.. relative), this is just a per-machine named copy
REM so it's obvious at a glance which machine a session log entry was about. Keep both files in
REM sync if either one changes - see that file's own header/comments for the full rationale.
REM Rename this file once this machine's permanent name/role is decided.

pushd "%~dp0.."
set "ROOT_DIR=%CD%\"
popd
set "BACKEND_DIR=%ROOT_DIR%app\easycashbackend"
set "LMS_DIR=%ROOT_DIR%app\lmsfrontend"
set "PORTAL_DIR=%ROOT_DIR%app\portalfrontend"

echo ============================================
echo   Easycash LMS - Sync After Pull
echo ============================================
echo.

echo [1/8] Git pull...
pushd "%ROOT_DIR%"
call git pull
if errorlevel 1 (
  echo X FAILED: git pull - resolve any conflicts manually, then re-run this script.
  popd
  echo.
  pause
  exit /b 1
)
popd

echo.
echo [2/8] Chinicheck kung tumatakbo ang Docker...
docker info >nul 2>&1
if errorlevel 1 (
  echo       Hindi tumatakbo ang Docker Desktop. Buksan mo muna ito nang mano-mano,
  echo       tapos ulitin ang script na ito.
  echo.
  pause
  exit /b 1
)
pushd "%ROOT_DIR%app\docker"
docker compose up -d postgres
popd

echo.
echo [3/8] Backend dependencies (npm install)...
pushd "%BACKEND_DIR%"
call npm install
if errorlevel 1 (
  echo X FAILED: backend npm install
  popd
  echo.
  pause
  exit /b 1
)
popd

echo.
echo [4/8] Database migrations (prisma migrate deploy)...
pushd "%BACKEND_DIR%"
call npx prisma migrate deploy
if errorlevel 1 (
  echo X FAILED: prisma migrate deploy
  popd
  echo.
  pause
  exit /b 1
)
popd

echo.
echo [5/8] Prisma client (prisma generate)...
pushd "%BACKEND_DIR%"
call npx prisma generate
if errorlevel 1 (
  echo X FAILED: prisma generate
  popd
  echo.
  pause
  exit /b 1
)
popd

echo.
echo [6/8] Roles, permissions, reference data (prisma db seed)...
pushd "%BACKEND_DIR%"
call npx prisma db seed
if errorlevel 1 (
  echo X FAILED: prisma db seed
  popd
  echo.
  pause
  exit /b 1
)
popd

echo.
echo [7/8] Frontend dependencies (npm install)...
pushd "%LMS_DIR%"
call npm install
if errorlevel 1 (
  echo X FAILED: lmsfrontend npm install
  popd
  echo.
  pause
  exit /b 1
)
popd
if exist "%PORTAL_DIR%" (
  pushd "%PORTAL_DIR%"
  call npm install
  if errorlevel 1 (
    echo X FAILED: portalfrontend npm install
    popd
    echo.
    pause
    exit /b 1
  )
  popd
)

echo.
echo [8/8] Docker rebuild (backend + frontends)...
pushd "%ROOT_DIR%app\docker"
docker compose up -d --build easycashbackend lmsfrontend portalfrontend
if errorlevel 1 (
  echo X FAILED: docker compose build - suriin ang error sa itaas.
  popd
  echo.
  pause
  exit /b 1
)
popd

echo.
echo ============================================
echo   Tapos na! Bago at kumpleto ang code, database,
echo   at mga tumatakbong container mo.
echo ============================================
echo.
pause
