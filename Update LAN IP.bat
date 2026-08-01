@echo off
setlocal

set "ROOT_DIR=%~dp0"
set "BACKEND_ENV=%ROOT_DIR%app\easycashbackend\.env"
set "FRONTEND_ENV=%ROOT_DIR%app\lmsfrontend\.env"
set "DOCKER_DIR=%ROOT_DIR%app\docker"

echo ============================================
echo   Easycash LMS - Update LAN IP
echo ============================================
echo.
echo Patakbuhin ito tuwing nagbago ang WiFi/network mo.
echo Isang click lang ito para sa lahat: sisiguraduhing
echo tumatakbo ang Docker, ide-detect ang bagong LAN IP,
echo ia-update ang config, ire-rebuild ang Docker, at
echo bubuksan sa browser.
echo.

echo [1/5] Chinicheck kung tumatakbo ang Docker Desktop...
docker info >nul 2>&1
if errorlevel 1 (
  echo       Hindi pa tumatakbo ang Docker. Sinisimulan ito...
  set "DOCKER_EXE=%ProgramFiles%\Docker\Docker\Docker Desktop.exe"
  if exist "%DOCKER_EXE%" (
    start "" "%DOCKER_EXE%"
  ) else (
    echo       HINDI nahanap ang Docker Desktop.exe sa default location.
    echo       Buksan mo muna ito nang mano-mano, tapos ulitin.
    echo.
    pause
    exit /b 1
  )
  echo       Naghihintay habang nagsi-start ang Docker Desktop
  echo       ^(puwedeng umabot ng 1-2 minuto sa unang buksan^)...
  set "DOCKER_READY="
  for /l %%i in (1,1,60) do (
    if not defined DOCKER_READY (
      docker info >nul 2>&1
      if not errorlevel 1 (
        set "DOCKER_READY=1"
      ) else (
        timeout /t 3 /nobreak >nul
      )
    )
  )
  if not defined DOCKER_READY (
    echo       Hindi pa rin ready ang Docker pagkatapos maghintay.
    echo       Tingnan kung may error sa Docker Desktop window, tapos
    echo       ulitin ang script na ito.
    echo.
    pause
    exit /b 1
  )
  echo       Ready na ang Docker.
) else (
  echo       Tumatakbo na ang Docker.
)
echo.

echo [2/5] Hinahanap ang kasalukuyang LAN IP address...
set "NEW_IP="
for /f %%A in ('powershell -NoProfile -Command "$route = Get-NetRoute -DestinationPrefix '0.0.0.0/0' -ErrorAction SilentlyContinue | Sort-Object -Property RouteMetric | Select-Object -First 1; if ($route) { (Get-NetIPAddress -InterfaceIndex $route.InterfaceIndex -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.IPAddress -notlike '169.254.*' } | Select-Object -First 1).IPAddress }"') do set "NEW_IP=%%A"

if "%NEW_IP%"=="" (
  echo       HINDI mahanap ang LAN IP address. Siguraduhing
  echo       naka-connect ka sa WiFi/network, tapos subukan ulit.
  echo.
  pause
  exit /b 1
)

echo       Nahanap: %NEW_IP%
echo.

echo [3/5] Ina-update ang app\easycashbackend\.env at app\lmsfrontend\.env...
REM 2026-08-01: CORS_ORIGIN can carry more than just the LAN entry now (e.g. the
REM https://easycash-lms.pages.dev / https://easycash-portal.pages.dev origins for the
REM Cloudflare Pages-hosted sites) - a blind whole-line replace used to wipe those out on every
REM LAN IP change. Instead: drop only the old LAN-IP-shaped entries (private ranges, port 5173),
REM keep everything else untouched, then add the new LAN IP.
powershell -NoProfile -Command ^
  "$lines = Get-Content '%BACKEND_ENV%';" ^
  "$corsLine = $lines | Where-Object { $_ -match '^CORS_ORIGIN=' } | Select-Object -First 1;" ^
  "$current = if ($corsLine) { $corsLine -replace '^CORS_ORIGIN=', '' } else { '' };" ^
  "$origins = $current -split ',' | Where-Object { $_ -and ($_ -notmatch '^https?://(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)[0-9]+\.[0-9]+:5173$') };" ^
  "$origins = @($origins) + @('http://%NEW_IP%:5173') | Select-Object -Unique;" ^
  "$newCors = 'CORS_ORIGIN=' + ($origins -join ',');" ^
  "(Get-Content '%BACKEND_ENV%') -replace '^CORS_ORIGIN=.*', $newCors | Set-Content '%BACKEND_ENV%';" ^
  "(Get-Content '%FRONTEND_ENV%') -replace '^VITE_API_BASE_URL=.*', 'VITE_API_BASE_URL=http://%NEW_IP%:4000/api/v1' | Set-Content '%FRONTEND_ENV%';"

echo       Tapos na i-update ang config files.
echo.

echo [4/5] Ina-update ang Docker containers...
echo       Ire-rebuild lang ang frontend ^(kailangan - naka-bake ang IP sa
echo       loob ng bundle nito^). Ire-restart lang ang backend, walang
echo       rebuild - basta CORS_ORIGIN lang naman ang nagbabago, at
echo       binabasa iyon habang tumatakbo, hindi habang nagbi-build.
echo       ^(Mas mabilis ngayon - nalaktawan na ang backend's mabigat na
echo       LibreOffice/npm rebuild, na hindi naman kailangan dito.^)
pushd "%DOCKER_DIR%"
docker compose up -d --build lmsfrontend
if errorlevel 1 (
  popd
  echo.
  echo       May error sa Docker rebuild ng frontend - malamang may ibang
  echo       proseso ^(hal. "npm run dev"^) na humahawak pa rin sa
  echo       port 5173. Isara muna iyon nang mano-mano
  echo       ^(o i-close ang window nito^), tapos ulitin ang script.
  echo.
  pause
  exit /b 1
)
docker compose up -d --force-recreate easycashbackend
if errorlevel 1 (
  popd
  echo.
  echo       May error sa pag-restart ng backend - malamang may ibang
  echo       proseso na humahawak pa rin sa port 4000. Isara muna iyon
  echo       nang mano-mano, tapos ulitin ang script.
  echo.
  pause
  exit /b 1
)
popd

echo.
echo [5/5] Tapos na! Binubuksan sa browser...
echo ============================================
echo   Bagong URL: http://%NEW_IP%:5173
echo ============================================
echo.
echo Sa phone mo, buksan din ang URL na ito (basta
echo parehong WiFi/network) para ma-access ang LMS system.
echo.
echo Kung may "insecure download" warning ang Chrome sa
echo pag-download ng file, normal iyan sa plain HTTP + LAN
echo IP setup - pindutin lang ang "Download insecure file".
echo.
start "" "http://%NEW_IP%:5173/"
pause
