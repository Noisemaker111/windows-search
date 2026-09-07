param([switch]$Check, [ValidateRange(1024,65535)][int]$Port=8320)
$ErrorActionPreference='Stop'
Add-Type -Path @((Join-Path $PSScriptRoot 'native\WindowController.cs'),(Join-Path $PSScriptRoot 'native\WindowsHost.cs'))
# Compilation must not acquire the live helper mutex or register shortcuts.
if($Check){Write-Output 'Native helper compiled; no hooks or windows created';exit}
if($env:SEARCH_SHIM_PORT){$Port=[int]$env:SEARCH_SHIM_PORT}
$created=$false
$mutex=New-Object Threading.Mutex($true,'Local\OpenCodeSearchHotkeyV2',[ref]$created)
if(-not $created){$mutex.Dispose();throw 'A search hotkey helper is already running'}
try {
  $edge=@("$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe","${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe") | Where-Object {Test-Path -LiteralPath $_} | Select-Object -First 1
  if(-not $edge){throw 'Microsoft Edge executable not found'}
  $profile=Join-Path $env:LOCALAPPDATA ('windows-search-'+$Port)
  [SearchShimHook]::Run($edge,$profile,$Port)
} finally {$mutex.ReleaseMutex();$mutex.Dispose()}
