@echo off
set CSC_PATH=C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe
set SOURCE=bootstrapper.cs
set OUTPUT=..\..\backend\updates\GuildManagerUniversalSetup.exe

echo --- Compiling Universal Bootstrapper ---
%CSC_PATH% /out:%OUTPUT% /target:exe %SOURCE%

if %ERRORLEVEL% EQU 0 (
    echo SUCCESS: %OUTPUT% created.
) else (
    echo FAILED: Compilation error.
)
pause
