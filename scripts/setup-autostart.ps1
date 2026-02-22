$ShortcutPath = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup\GuildManagerBackend.lnk"
$TargetFile = "c:\XavaGuildManager\start-backend-hidden.vbs"
$WorkingDir = "c:\XavaGuildManager"

# Create the VBS wrapper to start hidden
$VBSContent = @"
Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "cmd.exe /c cd /d c:\GuildManagerServer\backend && npm run dev", 0, false
"@
$VBSContent | Out-File -FilePath $TargetFile -Encoding ascii

# Create Shortcut in Startup folder
$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath = "wscript.exe"
$Shortcut.Arguments = "`"$TargetFile`""
$Shortcut.WorkingDirectory = $WorkingDir
$Shortcut.WindowStyle = 7 # Minimized
$Shortcut.Save()

Write-Host "Autostart shortcut created at: $ShortcutPath"
Write-Host "Backend will now start hidden on Windows login."
