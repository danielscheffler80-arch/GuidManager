# Guild Manager Universal Installer (Bootstrap)
# This script always downloads the latest version of the Guild Manager from Railway.

$URL = "https://guidmanager-production.up.railway.app/updates/latest.yml"
$TEMP_DIR = "$env:TEMP\GuildManagerInstaller"

if (!(Test-Path $TEMP_DIR)) {
    New-Item -ItemType Directory -Path $TEMP_DIR | Out-Null
}

Write-Host "Checking for latest version..." -ForegroundColor Cyan

try {
    $yml = Invoke-RestMethod -Uri $URL
    # Simple regex to extract path from latest.yml
    if ($yml -match "path:\s*(.*\.exe)") {
        $filename = $matches[1].Trim()
        $downloadUrl = "https://guidmanager-production.up.railway.app/updates/$filename"
        $targetPath = "$TEMP_DIR\$filename"

        Write-Host "Downloading version: $filename..." -ForegroundColor Yellow
        Invoke-WebRequest -Uri $downloadUrl -OutFile $targetPath

        Write-Host "Starting Installation..." -ForegroundColor Green
        Start-Process -FilePath $targetPath -Wait
        
        Write-Host "Done!" -ForegroundColor Green
    } else {
        Write-Error "Could not find latest version info in latest.yml"
    }
} catch {
    Write-Error "Failed to download installer: $($_.Exception.Message)"
} finally {
    # Optional cleanup after some delay or on next run
}
