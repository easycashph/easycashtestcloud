@echo off
setlocal

set "ROOT_DIR=%~dp0"
set "FRONTEND_DIR=%ROOT_DIR%app\frontend"
set "BACKEND_DIR=%ROOT_DIR%app\backend"

echo ============================================
echo   Easycash LMS - Starting Preview
echo ============================================
echo.
echo Kung nagsara agad ang window na ito nang walang
echo mensahe, buksan ito sa pamamagitan ng PowerShell
echo sa halip na i-double-click:
echo   cd "%ROOT_DIR%"
echo   .\"Run LMS Preview.bat"
echo.

echo [1/4] Sinisimulan ang backend server sa bagong window...
start "Easycash LMS Backend Server" cmd /k "cd /d "%BACKEND_DIR%" && npm run dev"

echo [2/4] Naghihintay habang nagsi-start ang backend (10 segundo)...
timeout /t 10 /nobreak >nul

echo [3/4] Sinisimulan ang frontend server sa bagong window...
start "Easycash LMS Frontend Server" cmd /k "cd /d "%FRONTEND_DIR%" && npm run dev"

echo [4/4] Naghihintay habang nagsi-start ang frontend (8 segundo)...
timeout /t 8 /nobreak >nul

echo Binubuksan ang preview sa iyong default browser...
start "" "http://localhost:5173/"

echo.
echo ============================================
echo Dalawang bagong window ang dapat lumabas:
echo   "Easycash LMS Backend Server"  -- hintayin
echo     ang "listening on port 4000"
echo   "Easycash LMS Frontend Server" -- hintayin
echo     ang "Local: http://localhost:5173/"
echo.
echo Kung "Could not reach the server" pa rin sa
echo pag-login, tingnan ang Backend Server window
echo para sa error (kadalasan Docker/Postgres ay
echo hindi pa tumatakbo -- buksan ang Docker Desktop
echo tapos sa "app\docker" folder patakbuhin:
echo   docker compose up -d postgres
echo ============================================
echo.
echo Isara na lang ang window na ito. Huwag isara ang
echo "Easycash LMS Backend Server" at "Easycash LMS
echo Frontend Server" windows habang ginagamit mo pa
echo ang preview.
echo.
pause
