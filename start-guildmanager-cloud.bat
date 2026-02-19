@echo off
echo [GuildManager] Starting in CLOUD CLIENT mode...

:: 1. Set Env for Cloud Backend (Safety fallback)
echo [GuildManager] Configuring Backend for Production...
copy /Y backend\.env.production backend\.env > nul

:: 2. Ensure app-config.json is set up for Render
echo { "backendUrl": "https://xavaguildmanager-backend.onrender.com", "mode": "client" } > app-config.json

echo [GuildManager] Configuration ready.
echo [GuildManager] Starting Desktop App...

cd desktop
npm start
