# install-backend.ps1
$ErrorActionPreference = "Stop"

$MainPcIp = "192.168.178.65"
$Port = 8080
$TargetDir = "C:\GuildManagerServer"
$BackendDir = "$TargetDir\backend"

Write-Host ">>> Starte Guild Manager Server Setup auf 2. PC..." -ForegroundColor Cyan

if (!(Test-Path $TargetDir)) {
    New-Item -ItemType Directory -Force -Path $TargetDir | Out-Null
}

Write-Host ">>> Lade Backend-Dateien vom Haupt-PC herunter..." -ForegroundColor Yellow
$ZipPath = "$TargetDir\GuildManagerBackend.zip"
Invoke-WebRequest -Uri "http://$($MainPcIp):$($Port)/GuildManagerBackend.zip" -OutFile $ZipPath

Write-Host ">>> Entpacke Dateien..." -ForegroundColor Yellow
if (Test-Path $BackendDir) { Remove-Item -Recurse -Force $BackendDir }
Expand-Archive -Path $ZipPath -DestinationPath $TargetDir -Force
# Expand-Archive erstellt oft einen Unterordner "backend", je nachdem wie gepackt wurde.
# Falls der Ordner "GuildManagerBackend" heißt, umbenennen:
if (Test-Path "$TargetDir\GuildManagerBackend") {
    Rename-Item "$TargetDir\GuildManagerBackend" "backend"
}

Remove-Item $ZipPath -Force

Write-Host ">>> Installiere Node-Abhängigkeiten..." -ForegroundColor Yellow
Set-Location $BackendDir
npm install

Write-Host ">>> Initialisiere Datenbank..." -ForegroundColor Yellow
npx prisma generate
npx prisma db push

Write-Host ">>> Kompiliere Backend..." -ForegroundColor Yellow
npm run build

Write-Host ">>> Installiere PM2 Server-Dienst..." -ForegroundColor Yellow
npm install -g pm2
# PM2 so einrichten, dass es bei jedem Windows-Start automatisch im Hintergrund lädt
npm install -g pm2-windows-startup
pm2-startup install
pm2 start dist/index.js --name "GuildManagerBackend"
pm2 save

Write-Host ""
Write-Host "========================================================" -ForegroundColor Green
Write-Host "                     SETUP ABGECHLOSSEN                  " -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Green
Write-Host "Der Guild Manager Server laeuft jetzt dauerhaft im Hintergrund!"
Write-Host "Du kannst nun das PowerShell-Fenster schliessen."
