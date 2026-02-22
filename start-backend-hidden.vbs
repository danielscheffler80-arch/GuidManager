Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "cmd.exe /c cd /d c:\GuildManagerServer\backend && npm run dev", 0, false
