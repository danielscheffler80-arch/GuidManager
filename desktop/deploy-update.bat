@echo off
echo ========================================
echo   Guild Manager Standalone - Deployer
echo ========================================
echo.

set BUILD_DIR=c:\XavaGuildManager\desktop\dist-standalone\nsis-web
set TARGET_DIR=c:\XavaGuildManager\backend\updates

if not exist "%TARGET_DIR%" mkdir "%TARGET_DIR%"

echo [INFO] Kopiere Update-Dateien...
copy "%BUILD_DIR%\latest.yml" "%TARGET_DIR%\"
copy "%BUILD_DIR%\Guild Manager Standalone Web Setup *.exe" "%TARGET_DIR%\"
copy "%BUILD_DIR%\*.7z" "%TARGET_DIR%\"

echo.
echo [ERFOLG] Update-Daten wurden in den Backend-Server kopiert.
echo Clients können nun Version 0.7.0 automatisch anfragen.
pause
