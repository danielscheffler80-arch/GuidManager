@echo off
set CSC_PATH=C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe
set SOURCE=bootstrapper.cs
set OUTPUT=..\..\backend\updates\GuildManagerUniversalSetup.exe

if not exist "%CSC_PATH%" (
    echo [ERROR] C# Compiler not found at %CSC_PATH%
    pause
    exit /b 1
)

echo --- Compiling Universal Bootstrapper with Confirmation Prompt ---
"%CSC_PATH%" /out:%OUTPUT% /target:exe /r:System.Windows.Forms.dll %SOURCE%

if %ERRORLEVEL% EQU 0 (
    echo SUCCESS: %OUTPUT% created.
) else (
    echo FAILED: Compilation error.
)
timeout /t 3
