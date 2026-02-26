# Release History & Rollback Tracking

This document tracks all public releases of the Xava Guild Manager. For each version, the main changes and the corresponding rollback artifact are listed.

---

## [Current] v0.9.55 - Production Path Fix
- **Status**: Deployment in Progress
- **Backend**: Schema-Logik in `SchemaService` verschoben und direkt in `index.ts` integriert (statt externes Skript).
- **Backend**: Funktioniert jetzt auch im Docker-Container (wo `src/` fehlt).
- **Rollback Artifact**: `git checkout a5643d1` (v0.9.54)

## v0.9.54 - Absolute Schema Sync
- **Status**: Failed (Module Not Found in Prod)

## v0.9.53 - Deployment Finalized
- **Status**: Failed (Schema Drift)
- **Backend**: `start` Skript bereinigt (Migration Recovery entfernt, da Problem gelöst).
- **Rollback Artifact**: `git checkout fe1e65d` (v0.9.52)

## v0.9.52 - Centralized Startup Fix
- **Status**: Success ✅
- **Backend**: `Dockerfile` auf `npm start` umgestellt.
- **Backend**: Migration Lock Fix wird nun korrekt ausgeführt.

## v0.9.51 - Recovery & Migration Fix
- **Status**: Deployment Failed (Dockerfile CMD Override)
- **Backend**: Migration Lock (P3009) behoben durch `migrate resolve`.
- **Rollback Artifact**: `git checkout 765ea22` (v0.9.48)

## v0.9.50 - Recovery & Diagnostics
- **Status**: Deployment Failed (Migration Lock)
- **Backend**: Healthcheck an den Anfang verschoben.
- **Rollback Artifact**: `git checkout 765ea22` (v0.9.48)

## v0.9.48 - Enhanced Raid Selection
- **Status**: Deployment in Progress
- **Admin**: "Exklusiver Raid" ist nun eine Auswahl-Liste (Dropdown). 
- **Admin**: Liste wird aus vorhandenen Raid-Events und Standard-Raids (z.B. Manaschmiede Omega) generiert.
- **Rollback Artifact**: `git checkout 0a9406e` (v0.9.47)

## v0.9.47 - Schema Fix & Admin Raid Feature
- **Status**: Deployment in Progress
- **Changes**:
    - **Database**: Added manual self-healing for missing columns via `/api/debug/db?fix=true`.
    - **Admin**: Added "Raid Progress Override" in Gilden-Verwaltung for Superusers.
    - **Dashboard/Roster**: Prioritize manual raid progress if set by admin.
- **Rollback Artifact**: `git checkout 13e6d11` (v0.9.46)

## [v0.9.46] - 2026-02-26 (Latest)
**Status:** Critical Schema Fix
- **Fix**: Resolved `PrismaClientKnownRequestError` caused by missing `exclusiveRaidName` and roster override columns in the database.
- **Fix**: Added manual Prisma migration to sync the database schema with the model after a wipe.
- **Note**: Version v0.9.45 was unstable if the database was wiped.

## [v0.9.45] - 2026-02-26
**Status:** Discontinued (Schema Mismatch)
- **Fix**: Resolved critical frontend crash on login (membership mapping fix).
- **Fix**: Corrected `latest.yml` to enable automatic desktop updates.
- **Feat**: Added `/api/debug/db` diagnostic endpoint and enhanced backend logging.

## [v0.9.44] - 2026-02-25
**Status:** Partial (Update Signaling Issues)
- **Feat**: Version bump for public release.
- **Note**: This version had issues with the desktop update notification.

## [v0.9.43] - 2026-02-25
**Status:** Stable
- **Fix**: Corrected roster sync data mapping (ranks and stats).
- **Rollback Artifact**: `guild-manager-standalone-0.9.43-x64.nsis.7z`

## [v0.9.42] - 2026-02-24
**Status:** Internal
- **Feat**: Prioritized sync (user's characters are synced in detail first).
- **Fix**: Consolidated sync logs to prevent database flooding.

## [v0.9.35] - 2026-02-24
**Status:** Stable
- **Fix**: Default visibility for all ranks in roster.
- **Rollback Artifact**: `guild-manager-standalone-0.9.35-x64.nsis.7z`

## [v0.9.33] - 2026-02-23
**Status:** Development Major
- **Feat**: 5-phase initial sync operation.
- **Feat**: Sync debugger tools.
- **Rollback Artifact**: `guild-manager-standalone-0.9.33-x64.nsis.7z`

---

## How to Rollback
1. Identify the target version above.
2. In the backend `updates` directory, point `latest.yml` to the corresponding `.7z` file.
3. Update the `version` field in `latest.yml` to the target version.
4. Restart the desktop application.
