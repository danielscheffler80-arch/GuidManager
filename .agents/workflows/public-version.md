---
description: Automatically bump version, commit, and push for a new release
---

This workflow automates the release of a new public version of Guild Manager and deploys it to Railway via GitHub.

1. Increment the version in `backend/package.json`, `frontend/package.json`, and `desktop/package.json`.
2. Build the frontend (`cd frontend && npm run build`).
3. Build the desktop app (`cd desktop && npm run build`).
4. Copy the update artifacts (exe, blockmap, latest.yml) to the `backend/updates/` directory.
5. Commit and push everything to GitHub to trigger the Railway deployment.

// turbo-all
// Run these commands in order (assuming version is already bumped)
// cd frontend && npm run build && cd ../desktop && npm run build && cd .. && cp "desktop/dist-standalone/*.exe" backend/updates/ && cp "desktop/dist-standalone/*.blockmap" backend/updates/ && cp "desktop/dist-standalone/latest.yml" backend/updates/ && git add . && git commit -m "[RELEASE] New Public Version for Railway" && git push origin main
