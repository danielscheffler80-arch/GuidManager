@echo off
setlocal
title Guild Manager Cloud Launcher

echo ========================================================
echo           GUILD MANAGER - CLOUD LAUNCHER
echo ========================================================
echo.
echo [1/2] Checking Cloud Configuration...

:: Ensure app-config.json exists and is set to Railway
echo { "backendUrls": ["https://guidmanager-production.up.railway.app"], "backendUrl": "https://guidmanager-production.up.railway.app", "mode": "cloud" } > app-config.json

echo [2/2] Starting Desktop App...
echo.

:: Check if desktop folder and dependencies exist
if not exist "desktop\node_modules" (
    echo [ERROR] Desktop dependencies not found.
    echo Running npm install...
    cd desktop
    call npm install
    cd ..
)

:: Start the app
cd desktop
npm start

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Failed to start the app.
    pause
)

endlocal
