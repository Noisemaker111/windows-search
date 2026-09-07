# HEADLESS_EXEC: every child process below explicitly uses -WindowStyle Hidden.
param([int]$Port=8320)
$ErrorActionPreference='Stop'
$root=$PSScriptRoot
$lock=New-Object Threading.Mutex($false,'Local\OpenCodeSearchStartup')
if(-not $lock.WaitOne(0)){exit}
try {
  $bun=Join-Path $env:USERPROFILE '.bun\bin\bun.exe'
  $hostExe=Join-Path $env:APPDATA 'npm\node_modules\@opencode-ai\cli\bin\opencode2.exe'
  if(-not (Test-Path $hostExe)){throw 'Installed opencode2 executable not found'}
  function Listening([int]$Number) { [bool](Get-NetTCPConnection -LocalPort $Number -State Listen -ErrorAction SilentlyContinue) }
  # Subscription proxies are externally managed runtime dependencies.
  if(-not (Listening 8322)){
    $env:OPENCODE_CONFIG_DIR=Join-Path $root 'runtime-config'
    $env:OPENCODE_CONFIG_PROJECT_DISABLE='1'
    $env:OPENCODE_DB=Join-Path $root 'search.db'
    $env:OPENCODE_DISABLE_MODELS_FETCH='1'
    Start-Process $hostExe -ArgumentList 'serve --hostname 127.0.0.1 --port 8322' -WorkingDirectory $root -WindowStyle Hidden -RedirectStandardOutput "$root\opencode.out.log" -RedirectStandardError "$root\opencode.err.log"
  }
  if(-not (Listening $Port)){
    $env:SEARCH_SHIM_PORT="$Port"
    Start-Process $bun -ArgumentList ('"'+$root+'\main.ts"') -WorkingDirectory $root -WindowStyle Hidden -RedirectStandardOutput "$root\bar.out.log" -RedirectStandardError "$root\bar.err.log"
  }
  $ready=$false
  foreach($attempt in 1..40){
    try {$health=Invoke-RestMethod "http://127.0.0.1:$Port/health" -TimeoutSec 1;if($health.brain -eq 'OpenCode v2' -and $health.opencode){$ready=$true;break}}catch{}
    Start-Sleep -Milliseconds 250
  }
  if(-not $ready){throw 'OpenCode search bar did not become healthy'}
  $env:SEARCH_SHIM_PORT="$Port"
  $hookPath=Join-Path $root 'hotkey.ps1'
  $running=Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" | Where-Object {$_.CommandLine -and $_.CommandLine.Contains($hookPath)}
  if (-not $running) { Start-Process powershell.exe -ArgumentList ('-NoProfile -NonInteractive -WindowStyle Hidden -File "'+$root+'\hotkey.ps1"') -WorkingDirectory $root -WindowStyle Hidden -RedirectStandardOutput "$root\hotkey.out.log" -RedirectStandardError "$root\hotkey.err.log"
  }
  Write-Output "OpenCode search ready on $Port"
} finally {$lock.ReleaseMutex();$lock.Dispose()}
