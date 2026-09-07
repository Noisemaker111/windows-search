$ErrorActionPreference='Stop'
Add-Type -Path @((Join-Path $PSScriptRoot 'native\WindowController.cs'),(Join-Path $PSScriptRoot 'native\WindowController.Tests.cs'))
$count=[NativeChecks]::Run()
Write-Output "$count native lifecycle checks passed (fake window host; no hooks, windows or input)"
& powershell.exe -NoProfile -NonInteractive -File (Join-Path $PSScriptRoot 'hotkey.ps1') -Check
if($LASTEXITCODE -ne 0){exit $LASTEXITCODE}
