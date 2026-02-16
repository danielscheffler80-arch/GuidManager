## CI: A1.4 Migrationen anwenden

Summary
Migrationen werden gegen die lokale/CI-Postgres-Instanz angewendet; das Ziel ist ein synchrones Schema, das mit dem Prisma-Modell übereinstimmt.

What’s included
- prisma migrate

How to verify (lokal)
- export DATABASE_URL=postgresql://postgres:postgres@localhost:5432/guilds_dev?sslmode=disable
- npm run prisma:migrate
- Prüfe, via psql oder pg_isready, dass Tabellen erstellt wurden

Next steps
- A1.5 Seed-Daten hinzufügen

Branch/PR steps
- gh pr create --title "CI: A1.4 Migrationen anwenden" --body "<Lang Body>" --base main --head feat/a1-4-prisma-migrate
