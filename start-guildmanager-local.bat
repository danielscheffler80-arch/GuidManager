@echo off
echo [GuildManager] Starting in LOCAL DEVELOPMENT mode...

:: 1. Start Docker Database
echo [GuildManager] Starting Docker Postgres...
docker-compose up -d

:: 2. Set Env for Local Backend
echo [GuildManager] Configuring Backend for Local DB...
copy /Y backend\.env.docker backend\.env > nul

:: 3. Generate Prisma Client
echo [GuildManager] Generating Prisma Client...
cd backend
call npx prisma generate
cd ..

:: 4. Ensure app-config.json is set up for local (localhost-first, cloud fallback)
echo { "backendUrls": ["http://localhost:3334", "https://guild-manager-backend.onrender.com"], "backendUrl": "https://guild-manager-backend.onrender.com", "mode": "auto" } > app-config.json

echo [GuildManager] Configuration ready.
echo [GuildManager] Starting Desktop App (Backend will be started automatically)...

cd desktop
npm start
