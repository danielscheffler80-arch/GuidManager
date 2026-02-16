# Render Environment Variables

Kopiere diese Werte und trage sie auf Render unter **Environment** ein.

## Datenbank (WICHTIG: IPv4 Fix für Render)

**Key**: `DATABASE_URL`  
**Value**: `postgresql://postgres.byxdneprmynjwbxsrnop:b4PZevKB7NpjHn@aws-1-eu-west-3.pooler.supabase.com:6543/postgres?pgbouncer=true`

> [!CAUTION]
> Nutzt du den Standard-Port 5432, wird die Verbindung von Render aus fehlschlagen (IPv6 Problem).

## Battle.net OAuth

**Key**: `BNET_CLIENT_ID`  
**Value**: `840050255f984ec088a0284a5d3535ee`

**Key**: `BNET_CLIENT_SECRET`  
**Value**: `Ia3SmO1akrFfiVlGBgiTSTpU5LuiAggl`

**Key**: `BNET_REDIRECT_URI`  
**Value**: `https://guild-manager-backend.onrender.com/auth/callback`
> ⚠️ **WICHTIG**: Ersetze `guild-manager-backend` mit deinem echten Render Service-Namen!

**Key**: `BNET_AUTH_URL`  
**Value**: `https://oauth.battle.net/authorize`

**Key**: `BNET_TOKEN_URL`  
**Value**: `https://oauth.battle.net/token`

**Key**: `BNET_API_URL`  
**Value**: `https://eu.api.blizzard.com`

**Key**: `BNET_SCOPE`  
**Value**: `wow.profile openid`

**Key**: `BNET_REGION`  
**Value**: `eu`

## Secrets (für JWT und Sessions)

**Key**: `JWT_SECRET`  
**Value**: `gm-production-jwt-secret-2026-change-this-to-random-string`

**Key**: `SESSION_SECRET`  
**Value**: `gm-production-session-secret-2026-change-this-to-random-string`

## Nach dem Deployment

Sobald alle Environment Variables eingetragen sind und der Build durchgelaufen ist:

1. Öffne die **Render Shell** für deinen Service
2. Führe folgenden Befehl aus, um die Datenbank-Struktur zu erstellen:
   ```bash
   npx prisma migrate deploy
   ```
