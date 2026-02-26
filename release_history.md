# Release History & Rollback Points

This document tracks all public releases of the Xava Guild Manager. For each version, the main changes and the corresponding rollback artifact are listed.

---

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
