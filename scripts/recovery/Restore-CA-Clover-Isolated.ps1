# CA Clover Phase E: restore a newly captured PostgreSQL archive locally only.
# Never pass production connection information to this script.
[CmdletBinding()]
param(
 [Parameter(Mandatory=$true)][string]$DumpPath,
 [Parameter(Mandatory=$true)][string]$ManifestPath,
 [Parameter(Mandatory=$true)][string]$ArchivePath,
 [Parameter(Mandatory=$true)][string]$RunId,
 [Parameter(Mandatory=$true)][string]$PrivateLog,
 [switch]$PrepareOnly
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
$dumpRows=@($manifest | Where-Object{$_.file -ceq "full-database.pgdump"})
if($dumpRows.Count -ne 1 -or $dumpRows[0].sha256 -cnotmatch '^[A-Fa-f0-9]{64}$'){
 throw "STOP: Manifest missing exact dump digest."
}
$actual=(Get-FileHash -LiteralPath $DumpPath -Algorithm SHA256).Hash
if($actual -cne $dumpRows[0].sha256.ToUpperInvariant() -or [int64]$dumpRows[0].bytes -ne (Get-Item -LiteralPath $DumpPath).Length){
 throw "STOP: Backup SHA256 or file size mismatch."
}
if(-not(Get-Command docker -ErrorAction SilentlyContinue)){throw "STOP: Docker not installed."}
$containerNames=@(& docker ps -a --format "{{.Names}}")
Assert-DockerSuccess "List local containers"; if($containerNames -ccontains $Container){throw "STOP: Refusing to touch an existing Docker container."}
$imageIds=@(& docker image ls $Image --format "{{.ID}}")
Assert-DockerSuccess "List pinned images"; if($imageIds.Count -eq 0){
 Write-Host "[STEP] Fetch pinned PostgreSQL 17 image, not production data."
 & docker pull $Image >> $PrivateLog 2>&1
 Assert-DockerSuccess "Pull pinned local image"
}
$rng=[System.Security.Cryptography.RandomNumberGenerator]::Create()
$bytes=New-Object byte[] 32
try{$rng.GetBytes($bytes)}finally{$rng.Dispose()}
$localSecret=[Convert]::ToBase64String($bytes)
Write-Host "[STEP] Create NEW network-none local container, no published ports."
& docker run -d --name $Container --network none -e ("POSTGRES_PASSWORD="+$localSecret) -e "POSTGRES_DB=postgres" $Image postgres -D /etc/postgresql -c cron.launch_active_jobs=off -c ("cron.database_name="+$Database) >> $PrivateLog 2>&1
Assert-DockerSuccess "Create isolated container"
$localSecret=$null
$inspectRaw=@(& docker inspect --type container $Container 2>&1)
Assert-DockerSuccess "Inspect isolated container"
$inspect = ConvertFrom-Json -InputObject ($inspectRaw -join "`n")

if (@($inspect).Count -ne 1) {
 throw "STOP: Unexpected Docker inspection result."
}

$item = $inspect[0]

$hasPorts = $false
if ($null -ne $item.HostConfig.PortBindings) {
 $hasPorts = @($item.HostConfig.PortBindings.PSObject.Properties).Count -gt 0
}

$hasMounts = @($item.Mounts | Where-Object { $null -ne $_ }).Count -gt 0

if ($item.Name -cne ("/" + $Container) -or
    $item.Config.Image -cne $Image -or
    -not $item.State.Running -or
    $item.HostConfig.NetworkMode -cne "none" -or
    $hasPorts -or $hasMounts) {
 throw "STOP: Docker isolation verification failed."
}
$socket=$null
$startupComplete=$false

for($attempt=1;$attempt -le 90;$attempt++){

  $logFile = Join-Path $env:TEMP ("ca-clover-docker-" + $Container + ".log")
 $logErrorFile = "$logFile.stderr"

 try {
  $process = Start-Process -FilePath "docker.exe" `
   -ArgumentList @("logs", $Container) `
   -NoNewWindow -Wait -PassThru `
   -RedirectStandardOutput $logFile `
   -RedirectStandardError $logErrorFile

  if($process.ExitCode -ne 0){
   throw "STOP: Docker logs command failed."
  }

  $logs = (Get-Content -LiteralPath $logFile -Raw) +
          (Get-Content -LiteralPath $logErrorFile -Raw)
 }
 finally {
  Write-Verbose "Docker diagnostic logs retained."
 }

 if($logs -match "PostgreSQL init process complete"){
  $startupComplete=$true
 }

 $health = & docker inspect $Container --format "{{.State.Health.Status}}"

 if($startupComplete -and $health -eq "healthy"){

  foreach($candidate in @("/tmp","/var/run/postgresql")){

   & docker exec -u postgres $Container pg_isready -h $candidate -U postgres -d postgres > $null 2>&1

   if($LASTEXITCODE -eq 0){
    $socket=$candidate
    break
   }
  }
 }

 if($null -ne $socket){break}

 Start-Sleep -Seconds 2
}

if($null -eq $socket){
 throw "STOP: PostgreSQL initialization or startup failed."
}
& docker exec -u postgres $Container createdb -h $socket -U supabase_admin -T template0 $Database >> $PrivateLog 2>&1
Assert-DockerSuccess "Create empty isolated database"
# Phase E pre-restore safety gate
$settings = @(
 & docker exec -u postgres $Container `
  psql -X -At -v ON_ERROR_STOP=1 -U postgres -d postgres `
  -c "SELECT current_setting('cron.launch_active_jobs') || '|' ||
             current_setting('cron.database_name');"
)
Assert-DockerSuccess "Read Cron settings"

if (($settings -join "").Trim() -cne ("off|" + $Database)) {
 throw "STOP: Cron settings are unsafe for restore."
}

$tableCount = @(
 & docker exec -u postgres $Container `
  psql -X -At -v ON_ERROR_STOP=1 -U postgres -d $Database `
  -c "SELECT count(*) FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relkind IN ('r','p')
        AND n.nspname NOT IN
        ('pg_catalog','information_schema');"
)
Assert-DockerSuccess "Read destination table count"

if (($tableCount -join "").Trim() -cne "0") {
 throw "STOP: Restore destination is not empty."
}

Write-Host "PASS: PRE_RESTORE_SAFETY_GATE"

if ($PrepareOnly) {
    Write-Host "PASS: PREPARE_ONLY_NO_RESTORE"
    [PSCustomObject]@{
        Container = $Container
        Database = $Database
        SocketDir = $socket
        DumpSha256 = $actual
        RestoreExecuted = $false
        LocalOnly = $true
    }
    return
}
& docker cp $DumpPath ($Container + ":/tmp/phase-e-private.pgdump") >> $PrivateLog 2>&1
Assert-DockerSuccess "Copy private archive only into isolated container"
& docker exec -u postgres $Container pg_restore -h $socket -U supabase_admin --no-owner --no-privileges --exit-on-error --single-transaction --dbname=$Database /tmp/phase-e-private.pgdump >> $PrivateLog 2>&1
Assert-DockerSuccess "Restore to empty isolated DB"
# Retain private container and original archive for auditing/forensics.
[PSCustomObject]@{Container=$Container; Database=$Database; SocketDir=$socket; DumpSha256=$actual; LocalOnly=$true}
