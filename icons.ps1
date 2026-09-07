# Extract installed shortcut/file icons once; no network or UI interaction.
param([string]$Manifest)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Drawing
Add-Type @'
using System;
using System.Runtime.InteropServices;
public class FileIcon {
 [StructLayout(LayoutKind.Sequential,CharSet=CharSet.Unicode)]
 public struct Info { public IntPtr icon; public int index; public uint attributes;
 [MarshalAs(UnmanagedType.ByValTStr,SizeConst=260)] public string display;
 [MarshalAs(UnmanagedType.ByValTStr,SizeConst=80)] public string type; }
 [DllImport("shell32.dll",CharSet=CharSet.Unicode)] public static extern IntPtr SHGetFileInfo(string path,uint attr,ref Info info,uint size,uint flags);
 [DllImport("user32.dll")] public static extern bool DestroyIcon(IntPtr handle);
}
'@
$folder=Join-Path $PSScriptRoot '.cache\icons'
New-Item -ItemType Directory -Force $folder | Out-Null
foreach($hit in (Get-Content -LiteralPath $Manifest -Raw | ConvertFrom-Json)){
 $output=Join-Path $folder ($hit.id+'.png')
 if(Test-Path $output){continue}
 $path=if($hit.iconPath){$hit.iconPath}else{$hit.path}
 if(-not (Test-Path -LiteralPath $path -ErrorAction SilentlyContinue)){continue}
 try {
  $info=New-Object FileIcon+Info
  [FileIcon]::SHGetFileInfo($path,0,[ref]$info,[Runtime.InteropServices.Marshal]::SizeOf($info),0x100) | Out-Null
  if($info.icon -ne [IntPtr]::Zero){
   $icon=[Drawing.Icon]::FromHandle($info.icon)
   $bitmap=$icon.ToBitmap();$bitmap.Save($output,[Drawing.Imaging.ImageFormat]::Png);$bitmap.Dispose()
   [FileIcon]::DestroyIcon($info.icon) | Out-Null
  }
 } catch {}
}
