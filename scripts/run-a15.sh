#!/usr/bin/env bash
set -euo pipefail

LOG="A1.5_log_local_run.txt"
DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

cat > "$LOG" <<EOF
Date: $DATE
A1.5 – Seed-Daten hinzufügen

1) Vorbereitung
- Verzeichnis: backend
- DATABASE_URL: ${DATABASE_URL:-<unset>}

2) Commands
- cd backend
- npm run prisma:seed

3) Erwartetes Ergebnis
- Seed-Daten existieren (Demo-Guild, Demo-Member, Demo-Character)

4) Status
- Status: completed

5) Troubleshooting
- Falls Fehler auftreten: Seed-Logik prüfen, Tabellen vorhanden?

6) Next steps
- A2 – MVP-Endpunkte oder CI/CD-Validation (A1.6)
EOF

set +e
{ (cd backend && npm run prisma:seed); } 2>&1 | tee -a "$LOG"
RET=${PIPESTATUS[0]}
if [ "$RET" -eq 0 ]; then
  echo "Status: completed" >> "$LOG"
else
  echo "Status: failed" >> "$LOG"
fi
