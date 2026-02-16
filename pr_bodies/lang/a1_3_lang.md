## CI: A1.3 Prisma Client Generieren

Summary
Dieser PR führt die Prisma-Client-Generierung lokal durch, um die Basis für Migrationen (A1.4) und Seeds (A1.5) bereitzustellen.

What’s included
- prisma generate – Generierung des Prisma Client; keine DB-Änderungen

How to verify (lokal)
- cd backend
- npm install
- npm run prisma:generate
- Prüfe, dass node_modules/@prisma/client existieren
- Hinweis: Import-Beispiel in Code: import { PrismaClient } from '@prisma/client'

Next steps
- A1.4 Migrationen anwenden, A1.5 Seed-Daten hinzufügen

Branch/PR steps
- gh pr create --title "CI: A1.3 Prisma Client Generieren" --body "<Lang Body>" --base main --head feat/a1-3-prisma-generate
