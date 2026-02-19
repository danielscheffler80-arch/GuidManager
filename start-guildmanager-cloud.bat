@echo off
echo [GuildManager] Starting in CLOUD CLIENT mode...

:: Ensure app-config.json is set up for Render
echo { "backendUrl": "https://xavaguildmanager-backend.onrender.com", "mode": "client" } > app-config.json

echo [GuildManager] app-config.json updated.
echo [GuildManager] Starting Desktop App...

cd desktop
npm start
