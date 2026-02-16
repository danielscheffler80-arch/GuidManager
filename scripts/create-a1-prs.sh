#!/usr/bin/env bash
set -euo pipefail

if ! command -v gh >/dev/null 2>&1; then
  echo "gh (GitHub CLI) is not installed. Please install gh and login: gh auth login"
  exit 1
fi

BASE="origin/main"

git fetch origin

# A1.3
git checkout -B feat/a1-3-prisma-generate $BASE
git push -u origin feat/a1-3-prisma-generate

# A1.4
git fetch origin
git checkout -B feat/a1-4-prisma-migrate $BASE
git push -u origin feat/a1-4-prisma-migrate

# A1.5
git fetch origin
git checkout -B feat/a1-5-prisma-seed $BASE
git push -u origin feat/a1-5-prisma-seed

echo "Creating PRs..."
gh pr create --title "CI: A1.3 Prisma Client Generieren" --body "$(cat pr_bodies/lang/a1_3_lang.md)" --base main --head feat/a1-3-prisma-generate
gh pr create --title "CI: A1.4 Migrationen anwenden" --body "$(cat pr_bodies/lang/a1_4_lang.md)" --base main --head feat/a1-4-prisma-migrate
gh pr create --title "CI: A1.5 Seed-Daten hinzufügen" --body "$(cat pr_bodies/lang/a1_5_lang.md)" --base main --head feat/a1-5-prisma-seed
