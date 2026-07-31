@echo off
setlocal EnableDelayedExpansion

set "CLOUDFLARED_EXE=C:\Program Files (x86)\cloudflared\cloudflared.exe"

echo ============================================
echo   Easycash LMS - Start Cloudflare Tunnel
echo ============================================
echo.
echo Patakbuhin ito para gawan ng bagong pampublikong link
echo ang backend na tumatakbo dito sa laptop, para ma-access
echo ito ng Cloudflare Pages site (easycash-lms.pages.dev) mula
echo sa internet.
echo.
echo PAALALA: Bagong random URL ito kada patakbuhin - kailangan
echo mo pa itong i-update sa Cloudflare Pages dashboard
echo (VITE_API_BASE_URL), tapos i-retry ang deployment.
echo.

if not exist "%CLOUDFLARED_EXE%" (
  echo HINDI nahanap ang cloudflared.exe sa default location:
  echo   !CLOUDFLARED_EXE!
  echo.
  echo I-install muna ito, tapos ulitin ang script na ito:
  echo   winget install --id Cloudflare.cloudflared -e
  echo.
  pause
  exit /b 1
)

echo [1/2] Chinicheck kung tumatakbo na ang backend sa localhost:4000...
powershell -NoProfile -Command "try { Invoke-WebRequest -Uri 'http://localhost:4000/health' -UseBasicParsing -TimeoutSec 3 | Out-Null; exit 0 } catch { exit 1 }"
if errorlevel 1 (
  echo       HINDI pa tumatakbo ang backend sa port 4000.
  echo       Siguraduhing naka-start ang Docker backend container
  echo       ^(docker compose up^) bago patakbuhin ito ulit.
  echo.
  pause
  exit /b 1
)
echo       OK, tumatakbo ang backend.
echo.

echo [2/2] Sinisimulan ang tunnel sa bagong window...
echo       Hintayin lumabas doon ang link na
echo       "https://xxxx-xxxx-xxxx.trycloudflare.com" - ilalagay
echo       ito sa Cloudflare Pages dashboard sa susunod na hakbang.
echo.
start "Cloudflare Tunnel - Easycash LMS (huwag isara)" "%CLOUDFLARED_EXE%" tunnel --url http://localhost:4000

echo ============================================
echo   Susunod na gagawin, pagkatapos mong makuha ang link:
echo ============================================
echo   1. Cloudflare dashboard - Workers ^& Pages - easycash-lms
echo      - Settings - Environment variables
echo   2. I-edit ang VITE_API_BASE_URL, ilagay ang bagong link
echo      + /api/v1 sa dulo
echo      ^(hal. https://xxxx-xxxx-xxxx.trycloudflare.com/api/v1^)
echo   3. I-save, tapos Deployments tab - Retry deployment
echo.
echo HUWAG isara ang "Cloudflare Tunnel" window na bagong bumukas -
echo doon tumatakbo ang tunnel habang ginagamit ang link.
echo.
pause
