@echo off
setlocal

set "ROOT_DIR=%~dp0"
set "FRONTEND_DIR=%ROOT_DIR%app\frontend"
set "BACKEND_DIR=%ROOT_DIR%app\backend"

echo ============================================
echo   Easycash LMS - Starting Preview
echo   [HOT RELOAD MODE] http://localhost:5173
echo ============================================
echo.
echo Kung nagsara agad ang window na ito nang walang
echo mensahe, buksan ito sa pamamagitan ng PowerShell
echo sa halip na i-double-click:
echo   cd "%ROOT_DIR%"
echo   .\"Run LMS Preview.bat"
echo.

echo [1/4] Chinicheck kung may process na gumagamit ng port 5173 o 4000...
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }" >nul 2>&1
echo       Naglinis ng stale processes sa port 5173.

set "BACKEND_ALREADY_RUNNING="
for /f %%A in ('powershell -NoProfile -Command "(Test-NetConnection -ComputerName localhost -Port 4000 -WarningAction SilentlyContinue).TcpTestSucceeded"') do set "BACKEND_ALREADY_RUNNING=%%A"

if /I "%BACKEND_ALREADY_RUNNING%"=="True" (
  echo       May backend na naka-detect sa port 4000 ^(malamang Docker^) -- hindi na
  echo       magsisimula ng bagong local backend, gagamitin na lang ang meron.
) else (
  echo       Walang backend sa port 4000 -- sinisimulan ang local backend sa bagong window...
  start "Easycash LMS Backend Server" cmd /k "cd /d "%BACKEND_DIR%" && npm run dev"
  echo [2/4] Naghihintay habang nagsi-start ang backend ^(10 segundo^)...
  timeout /t 10 /nobreak >nul
)

echo [3/4] Sinisimulan ang frontend hot-reload dev server sa PORT 5173...
start "Easycash LMS Frontend Server [HOT RELOAD - localhost:5173]" cmd /k "cd /d "%FRONTEND_DIR%" && echo. && echo ============================================== && echo   HOT RELOAD MODE -- http://localhost:5173 && echo   Live-reloading local dev server, hindi Docker. && echo   I-edit ang code, automatic na mag-re-refresh && echo   ang browser. && echo ============================================== && echo. && npm run dev"

echo [4/4] Naghihintay habang nagsi-start ang frontend ^(8 segundo^)...
timeout /t 8 /nobreak >nul

echo Binubuksan ang preview sa iyong default browser...
start "" "http://localhost:5173/"

echo.
echo ============================================
echo   [HOT RELOAD MODE] Nagba-browse ka ngayon sa
echo   http://localhost:5173 -- ito yung LOCAL DEV
echo   SERVER (may hot-reload), HINDI ang Docker
echo   frontend container.
echo ============================================
echo Bagong window na dapat lumabas (title ay may
echo "[HOT RELOAD - localhost:5173]"):
echo   "Easycash LMS Frontend Server" -- hintayin
echo     ang "Local: http://localhost:5173/"
echo   ^(Kung may backend window din, hintayin ang
echo     "listening on port 4000"^)
echo.
echo Kung "Could not reach the server" pa rin sa
echo pag-login, tingnan ang Backend window para sa
echo error (kadalasan Docker/Postgres ay hindi pa
echo tumatakbo -- buksan ang Docker Desktop tapos
echo sa "app\docker" folder patakbuhin:
echo   docker compose up -d postgres backend
echo ============================================
echo.
echo Isara na lang ang window na ito. Huwag isara ang
echo "Easycash LMS Backend Server" (kung meron) at ang
echo "Easycash LMS Frontend Server [HOT RELOAD]" window
echo habang ginagamit mo pa ang preview.
echo.
pause
