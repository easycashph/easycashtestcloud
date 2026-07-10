@echo off
set "PATH=C:\Program Files\nodejs;%PATH%"
cd /d "%~dp0..\app\frontend"
call "C:\Program Files\nodejs\npm.cmd" run dev -- --port 5173
