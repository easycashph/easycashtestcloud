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
echo Patakbuhin ito tuwing nagbago ang WiFi/network mo,
echo para awtomatikong ma-detect ang bagong LAN IP address,
echo ma-update ang config, at ma-rebuild ang Docker.
echo.

echo [1/4] Hinahanap ang kasalukuyang LAN IP address...
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

echo [2/4] Ina-update ang app\backend\.env at app\frontend\.env...
powershell -NoProfile -Command ^
  "(Get-Content '%BACKEND_ENV%') -replace '^CORS_ORIGIN=.*', 'CORS_ORIGIN=http://%NEW_IP%:5173' | Set-Content '%BACKEND_ENV%';" ^
  "(Get-Content '%FRONTEND_ENV%') -replace '^VITE_API_BASE_URL=.*', 'VITE_API_BASE_URL=http://%NEW_IP%:4000/api/v1' | Set-Content '%FRONTEND_ENV%';"

echo       Tapos na i-update ang config files.
echo.

echo [3/4] Ire-rebuild ang Docker backend at frontend...
echo       (Puwedeng tumagal ito ng 1-2 minuto)
pushd "%DOCKER_DIR%"
docker compose up -d --build backend frontend
popd

echo.
echo [4/4] Tapos na!
echo ============================================
echo   Bagong URL: http://%NEW_IP%:5173
echo ============================================
echo.
echo Buksan ang URL na ito sa PC o sa phone mo (basta
echo parehong WiFi/network) para ma-access ang LMS system.
echo.
echo Kung may "insecure download" warning ang Chrome sa
echo pag-download ng file, normal iyan sa plain HTTP + LAN
echo IP setup - pindutin lang ang "Download insecure file".
echo.
pause
