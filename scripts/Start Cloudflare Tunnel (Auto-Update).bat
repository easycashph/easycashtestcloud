@echo off
REM Easycash LMS - Cloudflare Tunnel with Auto-Update (double-click launcher)
REM
REM 2026-08-13: thin wrapper so this can be double-clicked directly, instead of having to open
REM PowerShell manually and type the "powershell -ExecutionPolicy Bypass -File ..." command.
REM %~dp0 is this .bat file's own folder, so it works no matter where the repo was cloned to.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Start Cloudflare Tunnel (Auto-Update).ps1"
