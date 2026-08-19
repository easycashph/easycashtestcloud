@echo off
setlocal enabledelayedexpansion
title Shrink Docker WSL2 VHDX

:: ============================================================
:: Universal Docker WSL2 VHDX shrink tool
:: - Auto-elevates to Administrator
:: - Stops Docker Desktop
:: - Shuts down WSL
:: - Auto-locates the Docker WSL2 virtual disk (any Windows user)
:: - Compacts it with diskpart to reclaim real disk space
:: ============================================================

:: --- Self-elevate to Administrator if not already ---
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo Requesting administrator privileges...
    powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)

echo.
echo ==============================================
echo   Docker WSL2 VHDX Shrink Tool
echo ==============================================
echo.

:: --- Stop Docker Desktop if running ---
echo [1/5] Stopping Docker Desktop...
taskkill /IM "Docker Desktop.exe" /F >nul 2>&1
timeout /t 2 >nul

:: --- Shut down all WSL distros/VMs ---
echo [2/5] Shutting down WSL...
wsl --shutdown
timeout /t 5 >nul

:: --- Locate the Docker vhdx file(s) (works for any user, any Docker Desktop version) ---
echo [3/5] Locating Docker VHDX file(s)...
set "VHDX_LIST=%TEMP%\docker_vhdx_list.txt"
del "%VHDX_LIST%" >nul 2>&1

powershell -NoProfile -Command ^
    "Get-ChildItem -Path \"$env:LOCALAPPDATA\Docker\wsl\" -Recurse -Filter *.vhdx -ErrorAction SilentlyContinue | Sort-Object Length -Descending | Select-Object -ExpandProperty FullName" > "%VHDX_LIST%"

if not exist "%VHDX_LIST%" (
    echo No VHDX files found under %%LOCALAPPDATA%%\Docker\wsl
    goto :END
)

set FOUND=0
for /f "usebackq delims=" %%F in ("%VHDX_LIST%") do (
    set /a FOUND+=1
    call :COMPACT "%%F"
)

if !FOUND! equ 0 (
    echo No Docker VHDX files were found. Nothing to do.
) else (
    echo.
    echo [5/5] Done. Compacted !FOUND! VHDX file(s^).
)

del "%VHDX_LIST%" >nul 2>&1
goto :END

:COMPACT
set "VHDXPATH=%~1"
echo.
echo   Compacting: %VHDXPATH%
set "DPSCRIPT=%TEMP%\diskpart_compact_%RANDOM%.txt"
> "%DPSCRIPT%" echo select vdisk file="%VHDXPATH%"
>> "%DPSCRIPT%" echo attach vdisk readonly
>> "%DPSCRIPT%" echo compact vdisk
>> "%DPSCRIPT%" echo detach vdisk
diskpart /s "%DPSCRIPT%"
del "%DPSCRIPT%" >nul 2>&1
exit /b

:END
echo.
echo [4/5] Restarting Docker Desktop...
set "DOCKER_EXE=%ProgramFiles%\Docker\Docker\Docker Desktop.exe"
if exist "%DOCKER_EXE%" (
    start "" "%DOCKER_EXE%"
) else (
    echo   Docker Desktop.exe not found at default path - start it manually.
)

echo.
echo ==============================================
echo   Finished. Check disk space in File Explorer.
echo ==============================================
pause
