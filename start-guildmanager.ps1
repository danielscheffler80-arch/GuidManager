# Guild Manager Server Startskript
Write-Host "====================================" -ForegroundColor Cyan
Write-Host "   Guild Manager - Server Startskript" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""

# Starte Datenbank via Docker
Write-Host "[1/2] Starte Datenbank (Docker)..." -ForegroundColor Cyan
docker-compose up -d

# Starte Backend
Write-Host "[2/2] Starte Backend Server..." -ForegroundColor Cyan
$backendPath = Join-Path $PSScriptRoot "backend"
if (Test-Path (Join-Path $backendPath "node_modules")) {
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$backendPath'; npm run dev" -Title "Guild Manager Backend" -WindowStyle Minimized
}
else {
    Write-Host "[FEHLER] Backend-Abhängigkeiten nicht gefunden. Bitte 'npm install' im backend Ordner ausführen." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Server wurden gestartet!" -ForegroundColor Green
Write-Host "Das Backend läuft in einem separaten Fenster." -ForegroundColor Gray
Write-Host "Bitte starte die Desktop-App nun manuell." -ForegroundColor Yellow
Write-Host ""
pause