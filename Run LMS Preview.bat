@echo off
setlocal

set "ROOT_DIR=%~dp0"
set "FRONTEND_DIR=%ROOT_DIR%app\frontend"
set "BACKEND_DIR=%ROOT_DIR%app\backend"

echo ============================================
echo   Easycash LMS - Starting Preview
echo ============================================
echo.

REM --- Backend: needs Docker Desktop running with the Postgres container up ---
echo Sinusuri kung tumatakbo ang Postgres (Docker)...
docker ps >nul 2>&1
if errorlevel 1 (
    echo.
    echo BABALA: Hindi mahanap ang Docker o hindi ito tumatakbo.
    echo Ang LMS (login, Payment Recording) ay nangangailangan ng backend + Postgres.
    echo Buksan muna ang Docker Desktop, tapos patakbuhin: docker compose up -d postgres
    echo sa loob ng "app\docker" folder, saka ulitin ang script na ito.
    echo.
    pause
)

cd /d "%BACKEND_DIR%"

if not exist node_modules (
    echo Unang beses lang ito: nag-iinstall ng backend dependencies, sandali lang...
    call npm install
    if errorlevel 1 (
        echo.
        echo Nagka-error sa npm install ng backend. Suriin ang mensahe sa itaas.
        pause
        exit /b 1
    )
)

echo Sinisimulan ang backend server sa bagong window...
start "Easycash LMS Backend Server" cmd /k npm run dev

echo Naghihintay habang nagsi-start ang backend...
timeout /t 6 /nobreak >nul

REM --- Frontend ---
cd /d "%FRONTEND_DIR%"

if not exist node_modules (
    echo Unang beses lang ito: nag-iinstall ng frontend dependencies, sandali lang...
    call npm install
    if errorlevel 1 (
        echo.
        echo Nagka-error sa npm install ng frontend. Suriin ang mensahe sa itaas.
        pause
        exit /b 1
    )
)

echo Sinisimulan ang frontend dev server sa bagong window...
start "Easycash LMS Frontend Server" cmd /k npm run dev

echo Naghihintay habang nagsi-start ang frontend...
timeout /t 6 /nobreak >nul

echo Binubuksan ang preview sa iyong default browser...
start "" "http://localhost:5173/"

echo.
echo ============================================
echo Kung hindi nag-load ang page, o lumalabas ang
echo "Could not reach the server" pagka-login, tingnan
echo ang "Easycash LMS Backend Server" window - dapat
echo may nakalagay doong "listening on port 4000".
echo Tingnan din ang "Easycash LMS Frontend Server"
echo window para sa tamang URL/port (posibleng iba
echo kung 5173 ay busy), tapos buksan iyon nang manual.
echo ============================================
echo.
echo Isara na lang ang window na ito. Huwag isara ang
echo "Easycash LMS Backend Server" at "Easycash LMS
echo Frontend Server" windows habang ginagamit mo pa
echo ang preview.
echo.
pause
