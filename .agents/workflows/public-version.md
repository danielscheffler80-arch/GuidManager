---
description: Automatically bump version, commit, and push for a new release
---

This workflow automates the release of a new public version of Guild Manager.

1. Increment the version in `backend/package.json`, `frontend/package.json`, and `desktop/package.json`.
2. Build the frontend.
3. Build the desktop app.
4. Copy the artifacts to the backend.
5. Commit and push everything.

// turbo-all
// Run these commands in order (assuming version is already bumped)
// cd frontend && npm run build && cd ../desktop && npm run build && cd .. && cp "desktop/dist-standalone/*.exe" backend/updates/ && cp "desktop/dist-standalone/*.blockmap" backend/updates/ && cp "desktop/dist-standalone/latest.yml" backend/updates/ && git add . && git commit -m "[RELEASE] New Public Version" && git push origin main
