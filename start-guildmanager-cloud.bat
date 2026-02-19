@echo off
echo [GuildManager] Starting in CLOUD CLIENT mode...

:: 1. Ensure app-config.json is set up for Cloud (cloud-only, no localhost)
echo [GuildManager] Configuring Backend for Production...
echo { "backendUrls": ["https://guild-manager-backend.onrender.com"], "backendUrl": "https://guild-manager-backend.onrender.com", "mode": "cloud" } > app-config.json

echo [GuildManager] Configuration ready.
echo [GuildManager] Starting Desktop App...

cd desktop
npm start
