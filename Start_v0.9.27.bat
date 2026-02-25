@echo off
setlocal
title Guild Manager v0.9.27 Launcher

echo ========================================================
echo           GUILD MANAGER v0.9.27 - LAUNCHER
echo ========================================================
echo.

:: Ensure the app-config.json is up-to-date with production URL
echo { "backendUrl": "https://guidmanager-production.up.railway.app", "mode": "cloud" } > app-config.json

echo [1/1] Starting Desktop App...
echo.

:: Navigate to desktop and start
cd desktop
npm start

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Failed to start Guild Manager.
    echo Please make sure Node.js is installed.
    pause
)

endlocal
