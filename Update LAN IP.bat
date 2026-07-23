@echo off
setlocal

set "ROOT_DIR=%~dp0"
set "BACKEND_ENV=%ROOT_DIR%app\backend\.env"
set "FRONTEND_ENV=%ROOT_DIR%app\frontend\.env"
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

echo [3/5] Ina-update ang app\backend\.env at app\frontend\.env...
powershell -NoProfile -Command ^
  "(Get-Content '%BACKEND_ENV%') -replace '^CORS_ORIGIN=.*', 'CORS_ORIGIN=http://%NEW_IP%:5173' | Set-Content '%BACKEND_ENV%';" ^
  "(Get-Content '%FRONTEND_ENV%') -replace '^VITE_API_BASE_URL=.*', 'VITE_API_BASE_URL=http://%NEW_IP%:4000/api/v1' | Set-Content '%FRONTEND_ENV%';"

echo       Tapos na i-update ang config files.
echo.

echo [4/5] Ire-rebuild ang Docker backend at frontend...
echo       (Puwedeng tumagal ito ng 1-2 minuto)
pushd "%DOCKER_DIR%"
docker compose up -d --build backend frontend
if errorlevel 1 (
  popd
  echo.
  echo       May error sa Docker rebuild - malamang may ibang
  echo       proseso ^(hal. "npm run dev"^) na humahawak pa rin sa
  echo       port 4000 o 5173. Isara muna iyon nang mano-mano
  echo       ^(o i-close ang window nito^), tapos ulitin ang script.
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
