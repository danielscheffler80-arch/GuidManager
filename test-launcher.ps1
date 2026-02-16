# Guild Manager Launcher - Testskript
# Dieses Skript testet die Startskripte und stellt sicher, dass nur eine Instanz läuft

Write-Host "=== Guild Manager Launcher Test ===" -ForegroundColor Magenta
Write-Host ""

# Test 1: PowerShell-Skript mit Prozesskontrolle
Write-Host "Test 1: Starte PowerShell-Skript erstes Mal..." -ForegroundColor Yellow
.\start-guildmanager.ps1

Write-Host "Warte 5 Sekunden..." -ForegroundColor Gray
Start-Sleep -Seconds 5

# Test 2: Versuche, zweite Instanz zu starten (sollte verhindert werden)
Write-Host "Test 2: Versuche zweite Instanz zu starten..." -ForegroundColor Yellow
.\start-guildmanager.ps1

Write-Host "Test abgeschlossen!" -ForegroundColor Green
Write-Host ""
Write-Host "Ergebnis: Wenn nur eine App-Instanz läuft, funktioniert die Prozesskontrolle korrekt." -ForegroundColor Green