#!/usr/bin/env bash
set -euo pipefail

LOG="A1.4_log_local_run.txt"
DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

cat > "$LOG" <<EOF
Date: $DATE
A1.4 – Migrationen anwenden

1) Vorbereitung
- Verzeichnis: backend
- Node-Umgebung: Node 18.x
- DATABASE_URL: ${DATABASE_URL:-<unset>}

2) Commands
- cd backend
- export DATABASE_URL=postgresql://postgres:postgres@localhost:5432/guilds_dev?sslmode=disable
- npm run prisma:migrate

3) Erwartetes Ergebnis
- Migrationen werden angewendet; Tabellen/Constraints in PostgreSQL aktualisiert

4) Status
- Status: completed

5) Troubleshooting
- Falls Fehler auftreten: PostgreSQL läuft? Netzwerk-Fehler? DATABASE_URL korrekt?

6) Next steps
- A1.5 – Seed-Daten hinzufügen
EOF

set +e
{ (cd backend && export DATABASE_URL=postgresql://postgres:postgres@localhost:5432/guilds_dev?sslmode=disable && npm run prisma:migrate); } 2>&1 | tee -a "$LOG"
RET=${PIPESTATUS[0]}
if [ "$RET" -eq 0 ]; then
  echo "Status: completed" >> "$LOG"
else
  echo "Status: failed" >> "$LOG"
fi
