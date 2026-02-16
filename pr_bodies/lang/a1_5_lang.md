## CI: A1.5 Seed-Daten hinzufügen

Summary
Seed-Daten werden in die DB geschrieben, um UI-Tests und Demo-Szenarien zu ermöglichen.

What’s included
- prisma seed (seed.ts)

How to verify (lokal)
- cd backend
- npm run prisma:seed
- Verifiziere, dass Demo-Daten existieren (Demo Guild, Demo Member, Demo Hero)

Next steps
- Optional: A2 MVP-Endpunkte testen oder A1.6 CI/CD-Validation

Branch/PR steps
- gh pr create --title "CI: A1.5 Seed-Daten hinzufügen" --body "<Lang Body>" --base main --head feat/a1-5-prisma-seed
