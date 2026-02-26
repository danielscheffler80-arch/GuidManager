# Xava Guild Manager - Installation Guide

To install the latest version of the Xava Guild Manager, follow these steps:

## Option 1: One-Liner (Recommended)
Open **PowerShell** and paste the following command:

```powershell
iwr -useb https://guidmanager-production.up.railway.app/api/download/latest -outf setup.exe; .\setup.exe; rm setup.exe
```

## Option 2: Script Download
1.  Download [Installer.ps1](file:///c:/XavaGuildManager/desktop/Installer.ps1)
2.  Right-click the file and select **Run with PowerShell**

## Troubleshooting
If you get a security warning, ensure you have the required permissions to run scripts. You can temporarily enable script execution by running:
`Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process`
