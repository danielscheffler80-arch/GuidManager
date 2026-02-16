@echo off
title Guild Manager - Cloud Client
echo ====================================
echo   Guild Manager - Cloud Client Mode
echo ====================================
echo.
echo [INFO] Verbindung zu: https://guild-manager-backend.onrender.com
echo [INFO] Lokaler Server/Docker wird NICHT benötigt.
echo.
echo Starte App...
cd /d "%~dp0desktop"
npm run start
