$ErrorActionPreference='Stop'
$truth=Get-Content -Raw .cache/discovery-private-ground-truth.json | ConvertFrom-Json
$connection=New-Object -ComObject ADODB.Connection
$rows=@()
try{
 $connection.ConnectionTimeout=5
 $connection.CommandTimeout=5
 $connection.Open("Provider=Search.CollatorDSO;Extended Properties='Application=Windows';")
 for($i=0;$i -lt $truth.Count;$i++){
  $f=$truth[$i];$name=$f.name.Replace("'","''");$watch=[Diagnostics.Stopwatch]::StartNew()
  $rs=New-Object -ComObject ADODB.Recordset
  try{
   $scope=('file:'+(Join-Path $env:USERPROFILE $f.root)).Replace("'","''")
   $rs.Open("SELECT TOP 20 System.ItemPathDisplay FROM SYSTEMINDEX WHERE SCOPE='$scope' AND System.FileName='$name'",$connection)
   $rank=0;$count=0
   while(-not $rs.EOF){$count++;if([string]$rs.Fields.Item(0).Value -ieq $f.path){$rank=$count};$rs.MoveNext()}
   $rows+=@{sample=$i;root=$f.root;depth=$f.depth;rank=$rank;returned=$count;elapsedMs=$watch.ElapsedMilliseconds}
  }finally{if($rs.State -eq 1){$rs.Close()};[void][Runtime.InteropServices.Marshal]::ReleaseComObject($rs)}
 }
 $report=@{interface='Windows Search SYSTEMINDEX, exact filename, top 20; not Win+S UI';samples=$rows.Count;found=@($rows | Where-Object rank -gt 0).Count;rows=$rows}
 $report | ConvertTo-Json -Depth 8 | Set-Content .cache/windows-index-baseline.json
 $report | ConvertTo-Json -Depth 8
}finally{if($connection.State -eq 1){$connection.Close()};[void][Runtime.InteropServices.Marshal]::ReleaseComObject($connection)}
