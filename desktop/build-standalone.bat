@echo off
title Guild Manager Standalone Builder
echo ======================================
echo   Guild Manager Standalone Builder
echo ======================================
echo.

REM Prüfe ob Frontend gebaut ist
if not exist "..\frontend\dist\index.html" (
    echo [FEHLER] Frontend nicht gebaut!
    echo Bitte zuerst im frontend Ordner "npm run build" ausführen.
    pause
    exit /b 1
)

REM Installiere Dependencies
echo [1/4] Installiere Dependencies...
cd /d "%~dp0"
if not exist "node_modules" (
    npm install
)

REM Kopiere Standalone Config
echo [2/4] Bereite Build vor...
copy package-standalone.json package.json

REM Erstelle Icon falls nötig
if not exist "assets\app-icon.ico" (
    echo [3/4] Erstelle Icon...
    npm run icons:frompng
)

REM Baue Standalone App
echo [4/4] Baue Standalone App...
npm run build

REM Stelle Original wieder her
echo Stelle Original-Config wieder her...
copy package.json package-standalone.json.bak
move package.json package-standalone.json
if exist "package-standalone.json.bak" (
    move package-standalone.json.bak package.json
)

echo.
echo Fertig! Die Standalone-EXE liegt in:
echo %~dp0dist-standalone\Guild Manager Standalone Setup 0.2.0.exe
echo.
pause