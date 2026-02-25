# Guild Manager - Automated Publisher v0.9.29
# Usage: ./publish.ps1

$ROOT = $PSScriptRoot
$FRONTEND = "$ROOT\frontend"
$DESKTOP = "$ROOT\desktop"
$BACKEND = "$ROOT\backend"
$UPDATES = "$BACKEND\updates"

Write-Host "================================" -ForegroundColor Cyan
Write-Host "   GUILD MANAGER PUBLISHER      " -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan

# 1. Build Frontend
Write-Host "`n[1/4] Building Frontend..." -ForegroundColor Yellow
Set-Location $FRONTEND
npm run build
if ($LASTEXITCODE -ne 0) { Write-Error "Frontend build failed"; exit 1 }

# 2. Build Desktop App
Write-Host "`n[2/4] Building Desktop..." -ForegroundColor Yellow
Set-Location $DESKTOP
npm run build
if ($LASTEXITCODE -ne 0) { Write-Error "Desktop build failed"; exit 1 }

# 3. Cleanup Legacy Updates
Write-Host "`n[3/4] Cleaning legacy updates..." -ForegroundColor Yellow
cd $BACKEND
npm run updates:clean

# 4. Deploy Artifacts
Write-Host "`n[4/4] Deploying artifacts to backend..." -ForegroundColor Yellow
$BUILD_OUT = "$DESKTOP\dist-standalone\nsis-web"

# Move latest.yml, exe and .7z
Copy-Item -Path "$BUILD_OUT\latest.yml" -Destination "$UPDATES\" -Force
Copy-Item -Path "$BUILD_OUT\GuildManagerSetup.exe" -Destination "$UPDATES\" -Force
Copy-Item -Path "$BUILD_OUT\*.7z" -Destination "$UPDATES\" -Force

Write-Host "`n[SUCCESS] Build v$( (Get-Content $DESKTOP\package.json | ConvertFrom-Json).version ) is ready for deployment!" -ForegroundColor Green
Write-Host "Now run: git add . && git commit -m 'release: version ...' && git push" -ForegroundColor Cyan

cd $ROOT
