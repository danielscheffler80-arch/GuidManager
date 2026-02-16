@echo off
title Guild Manager App Launcher
echo ====================================
echo   Guild Manager - App Startskript
echo ====================================
echo.
echo [HINWEIS] Bitte stelle sicher, dass die Server (DB + Backend)
echo bereits laufen (start-guildmanager.bat).
echo.
echo Starte App...
cd /d "%~dp0desktop"
npm run start
