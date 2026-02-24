@echo off
title Guild Manager Update Deployer
echo ========================================
echo   Guild Manager Standalone - Deployer
echo ========================================
echo.

set BUILD_DIR=%~dp0dist-standalone\nsis-web
set TARGET_DIR=%~dp0..\backend\updates

if not exist "%TARGET_DIR%" (
    echo [INFO] Erstelle Updates-Ordner: %TARGET_DIR%
    mkdir "%TARGET_DIR%"
)

echo [1/3] Bereinige alten Stand...
del /q "%TARGET_DIR%\*" 2>nul

echo [2/3] Kopiere Update-Dateien...
echo Kopiere: latest.yml
copy /y "%BUILD_DIR%\latest.yml" "%TARGET_DIR%\" >nul

echo Kopiere: Installer-Pakete...
copy /y "%BUILD_DIR%\GuildManagerSetup.exe" "%TARGET_DIR%\" >nul
copy /y "%BUILD_DIR%\*.7z" "%TARGET_DIR%\" >nul


echo [3/3] Verifiziere Dateien...
dir "%TARGET_DIR%"

echo.
echo [ERFOLG] Update-Daten wurden in den Backend-Server kopiert.
echo Der Server unter %TARGET_DIR% ist nun bereit.
echo.
pause
