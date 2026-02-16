@echo off
title Guild Manager Server Launcher
echo ====================================
echo   Guild Manager - Server Startskript
echo ====================================
echo.

REM Starte Datenbank via Docker
echo [1/2] Starte Datenbank (Docker)...
docker-compose up -d

REM Starte Backend
echo [2/2] Starte Backend Server...
cd /d "%~dp0backend"
start "Guild Manager Backend" npm run dev

echo.
echo Server wurden gestartet! 
echo Das Backend läuft in einem separaten Fenster.
echo Bitte starte die Desktop-App nun manuell.
echo.
pause