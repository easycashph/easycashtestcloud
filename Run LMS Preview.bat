@echo off
setlocal

set "FRONTEND_DIR=%~dp0app\frontend"

echo ============================================
echo   Easycash LMS - Starting Preview
echo ============================================
echo.

cd /d "%FRONTEND_DIR%"

if not exist node_modules (
    echo Unang beses lang ito: nag-iinstall ng dependencies, sandali lang...
    call npm install
    if errorlevel 1 (
        echo.
        echo Nagka-error sa npm install. Suriin ang mensahe sa itaas.
        pause
        exit /b 1
    )
)

echo Sinisimulan ang dev server sa bagong window...
start "Easycash LMS Dev Server" cmd /k npm run dev

echo Naghihintay habang nagsi-start ang server...
timeout /t 6 /nobreak >nul

echo Binubuksan ang preview sa iyong default browser...
start "" "http://localhost:5173/"

echo.
echo ============================================
echo Kung hindi nag-load ang page, tingnan ang
echo "Easycash LMS Dev Server" window para sa
echo tamang URL/port (posibleng iba kung 5173
echo ay busy), tapos buksan iyon nang manual.
echo ============================================
echo.
echo Isara na lang ang window na ito. Huwag isara
echo ang "Easycash LMS Dev Server" window habang
echo ginagamit mo pa ang preview.
echo.
pause
