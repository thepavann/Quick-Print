@echo off
title QuickPrint Print Agent
cd /d "%~dp0"
:loop
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0run-agent.ps1"
echo.
echo The agent stopped. Restarting in 10 seconds... (close this window to stop)
timeout /t 10 >nul
goto loop
