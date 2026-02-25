---
description: delete all old versions on GitHub and locally, except current and previous
---

1. Determine the current version (e.g., from `backend/package.json`) and the previous version.
2. Identify all older version tags locally and on GitHub.
3. Delete local distribution/release artifacts for old versions.
4. Delete GitHub releases and tags for any version older than the previous one.
5. Ensure only the last two versions remain active.
