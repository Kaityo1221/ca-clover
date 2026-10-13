# CA Clover Phase E: restore a newly captured PostgreSQL archive locally only.
# Never pass production connection information to this script.
[CmdletBinding()]
param(
 [Parameter(Mandatory=$true)][string]$DumpPath,
 [Parameter(Mandatory=$true)][string]$ManifestPath,
 [Parameter(Mandatory=$true)][string]$ArchivePath,
 [Parameter(Mandatory=$true)][string]$RunId,
 [Parameter(Mandatory=$true)][string]$PrivateLog
)
$ErrorActionPreference="Stop"
Set-StrictMode -Version Latest
$Image="public.ecr.aws/supabase/postgres:17.11.0.004"
$Database="ca_master_restore_qa"
$Container="ca-clover-supabase-restore-"+(Get-Date -Format "yyyyMMdd")+"-"+$RunId
function Assert-DockerSuccess([string]$Step) {
 if ($LASTEXITCODE -ne 0) {throw ("STOP: "+$Step+" failed; consult private local log.")}
}
if($RunId -cnotmatch '^[a-f0-9]{8}$'){throw "STOP: Invalid run ID."}
if($Container -cnotmatch '^ca-clover-supabase-restore-[0-9]{8}-[a-f0-9]{8}$'){
 throw "STOP: Invalid isolated container name."
}
foreach($path in @($DumpPath,$ManifestPath,$ArchivePath)){
 if(-not(Test-Path -LiteralPath $path -PathType Leaf)){throw "STOP: Required backup file absent."}
}
$manifest=@(Import-Csv -LiteralPath $ManifestPath -Delimiter ([char]9))
$matches=@($manifest | Where-Object{$_.file -ceq "full-database.pgdump"})
if($matches.Count -ne 1 -or $matches[0].sha256 -cnotmatch '^[A-Fa-f0-9]{64}$'){
 throw "STOP: Manifest missing exact dump digest."
}
$actual=(Get-FileHash -LiteralPath $DumpPath -Algorithm SHA256).Hash
if($actual -cne $matches[0].sha256.ToUpperInvariant() -or [int64]$matches[0].bytes -ne (Get-Item -LiteralPath $DumpPath).Length){
 throw "STOP: Backup SHA256 or file size mismatch."
}
if(-not(Get-Command docker -ErrorAction SilentlyContinue)){throw "STOP: Docker not installed."}
& docker container inspect $Container > $null 2>&1
if($LASTEXITCODE -eq 0){throw "STOP: Refusing to touch an existing Docker container."}
& docker image inspect $Image > $null 2>&1
if($LASTEXITCODE -ne 0){
 Write-Host "[STEP] Fetch pinned PostgreSQL 17 image, not production data."
 & docker pull $Image >> $PrivateLog 2>&1
 Assert-DockerSuccess "Pull pinned local image"
}
$rng=[System.Security.Cryptography.RandomNumberGenerator]::Create()
$bytes=New-Object byte[] 32
try{$rng.GetBytes($bytes)}finally{$rng.Dispose()}
$localSecret=[Convert]::ToBase64String($bytes)
Write-Host "[STEP] Create NEW network-none local container, no published ports."
& docker run -d --name $Container --network none -e ("POSTGRES_PASSWORD="+$localSecret) -e "POSTGRES_DB=postgres" $Image >> $PrivateLog 2>&1
Assert-DockerSuccess "Create isolated container"
$localSecret=$null
$inspectRaw=@(& docker inspect --type container $Container 2>&1)
Assert-DockerSuccess "Inspect isolated container"
$inspect=@(($inspectRaw -join [Environment]::NewLine | ConvertFrom-Json))
if($inspect.Count -ne 1 -or $inspect[0].Name -cne ("/"+$Container) -or $inspect[0].HostConfig.NetworkMode -cne "none" -or
 $inspect[0].Config.Image -cne $Image -or
 ($null -ne $inspect[0].HostConfig.PortBindings -and
  @($inspect[0].HostConfig.PortBindings.PSObject.Properties).Count -gt 0)){
 throw "STOP: Container is not network-none without published ports."
}
$socket=$null
for($attempt=1;$attempt -le 35;$attempt++){
 foreach($candidate in @("/tmp","/var/run/postgresql")){
  & docker exec -u postgres $Container pg_isready -h $candidate -U postgres -d postgres > $null 2>&1
  if($LASTEXITCODE -eq 0){$socket=$candidate;break}
 }
 if($null -ne $socket){break}
 Start-Sleep -Seconds 2
}
if($null -eq $socket){throw "STOP: Local Postgres startup failed."}
& docker exec -u postgres $Container createdb -h $socket -U postgres -T template0 $Database >> $PrivateLog 2>&1
Assert-DockerSuccess "Create empty isolated database"
& docker cp $DumpPath ($Container + ":/tmp/phase-e-private.pgdump") >> $PrivateLog 2>&1
Assert-DockerSuccess "Copy private archive only into isolated container"
& docker exec -u postgres $Container pg_restore -h $socket -U postgres --no-owner --no-privileges --exit-on-error --dbname=$Database /tmp/phase-e-private.pgdump >> $PrivateLog 2>&1
Assert-DockerSuccess "Restore to empty isolated DB"
# Retain private container and original archive for auditing/forensics.
[PSCustomObject]@{Container=$Container; Database=$Database; SocketDir=$socket; DumpSha256=$actual; LocalOnly=$true}
