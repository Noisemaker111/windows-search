# HEADLESS_EXEC: only the task's hidden startup script is launched.
# Local installation requested by the user; preserves the prior Startup shortcut.
$ErrorActionPreference='Stop'
$root=$PSScriptRoot
$startup=Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\Startup\OpenCode Search Shim.lnk'
$backup=Join-Path $root 'startup-before.lnk'
if((Test-Path $startup) -and -not(Test-Path $backup)){Copy-Item -LiteralPath $startup -Destination $backup}
$owned=@((Join-Path $root 'main.ts'),(Join-Path $root 'hotkey.ps1'))
# Stop only this checkout's bar/hook. OpenCode and proxies are externally owned.
foreach($process in Get-CimInstance Win32_Process){
  if($process.Name -notin @('bun.exe','powershell.exe')){continue}
  if($process.CommandLine -and ($owned | Where-Object {$process.CommandLine.Contains($_)})){
    Stop-Process -Id $process.ProcessId
  }
}
$ws=New-Object -ComObject WScript.Shell
$link=$ws.CreateShortcut($startup)
$link.TargetPath=Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$link.Arguments='-NoProfile -NonInteractive -WindowStyle Hidden -File "'+$root+'\start.ps1"'
$link.WorkingDirectory=$root
$link.WindowStyle=7
$link.Description='OpenCode Windows search bar'
$link.Save()
& (Join-Path $root 'start.ps1') -Port 8320
