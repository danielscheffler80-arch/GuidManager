# Xava Guild Manager - Web Installer (Bootstrapper)
# This script downloads the latest version of the Guild Manager from the production server and runs the setup.

$ErrorActionPreference = "Stop"

$downloadUrl = "https://guidmanager-production.up.railway.app/api/download/latest"
$tempPath = "$env:TEMP\GuildManagerSetup.exe"

Write-Host "============================" -ForegroundColor Cyan
Write-Host " Xava Guild Manager Installer" -ForegroundColor Cyan
Write-Host "============================" -ForegroundColor Cyan
Write-Host ""

try {
    Write-Host "[1/3] Checking for latest version..." -ForegroundColor Gray
    $response = Invoke-WebRequest -Uri $downloadUrl -Method Get -MaximumRedirection 0 -ErrorAction Ignore
    
    # We expect a redirect (302) to the actual EXE
    $realDownloadUrl = if ($response.Headers.Location) { $response.Headers.Location } else { $downloadUrl }
    
    if ($realDownloadUrl -like "*/updates/*") {
        Write-Host "Found latest version at: $realDownloadUrl" -ForegroundColor DarkGray
    }

    Write-Host "[2/3] Downloading Guild Manager Setup..." -ForegroundColor Cyan
    Invoke-WebRequest -Uri $realDownloadUrl -OutFile $tempPath
    
    Write-Host "[3/3] Starting Setup..." -ForegroundColor Green
    Start-Process -FilePath $tempPath -Wait -Verb RunAs
    
    Write-Host ""
    Write-Host "DONE! Xava Guild Manager has been installed." -ForegroundColor Green
    Write-Host "You can find it in your Start Menu or on your Desktop."
}
catch {
    Write-Host "ERROR: Could not download or run the installer." -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor DarkRed
    Write-Host "Please check your internet connection or try again later."
}
finally {
    if (Test-Path $tempPath) {
        Remove-Item $tempPath -Force -ErrorAction Ignore
    }
}

Write-Host ""
Write-Host "Press any key to exit..."
$Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown") | Out-Null
