# CA Clover Phase E | operator Windows PC | audit a restored LOCAL DB.
# READ ONLY. Never connects to production, never restores or resets a DB.
[CmdletBinding()]
param(
 [Parameter(Mandatory=$true)][string]$Container,
 [ValidateSet("postgres","ca_master_restore_qa")][string]$Database="postgres",
 [ValidateSet("postgres","supabase_admin")][string]$DbUser="postgres",
 [ValidateSet("/tmp","/var/run/postgresql")][string]$SocketDir="/tmp",
 [string]$ReportRoot="C:\CA-Clover-Restore-Test\phase-e-local-audit"
)
$ErrorActionPreference="Stop"
Set-StrictMode -Version Latest
if ($Container -cnotmatch '^ca-clover-(supabase-)?restore-[0-9]{8}(-[A-Za-z0-9_-]+)?$') {
 throw "STOP: Expected dedicated dated LOCAL restore container name."
}
if ($Container -match 'wgiittrvgtiosogyhfcl') { throw "STOP: Production identifier in target." }
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
 throw "STOP: Docker Desktop required."
}
$inspectOutput=@(& docker inspect --type container $Container 2>&1)
if ($LASTEXITCODE -ne 0) { throw "STOP: Local restore container not found." }
$info=@(($inspectOutput -join [Environment]::NewLine | ConvertFrom-Json))
if ($info.Count -ne 1 -or $info[0].Name -cne ("/"+$Container)) {
 throw "STOP: Docker identity mismatch."
}
$c=$info[0]
if ($c.State.Running -ne $true) { throw "STOP: Local restore container not running." }
if ($c.Config.Image -notmatch '^(public\.ecr\.aws/supabase/postgres:17(?:\.|$)|postgres:17(?:\.|$))') {
 throw "STOP: Expected PostgreSQL 17 restore image."
}
if ($c.HostConfig.NetworkMode -eq "host") { throw "STOP: Host network forbidden." }
if ($null -ne $c.HostConfig.PortBindings -and @($c.HostConfig.PortBindings.PSObject.Properties).Count -gt 0) {
 throw "STOP: Restore container exposes port bindings."
}
if ($null -ne $c.NetworkSettings.Ports) {
 foreach ($p in $c.NetworkSettings.Ports.PSObject.Properties) {
  if ($null -ne $p.Value -and @($p.Value).Count -gt 0) {
   throw "STOP: Restore container exposes mapped ports."
  }
 }
}
$sqlPath=Join-Path $PSScriptRoot "phase-e-restored-local-readonly-audit.sql"
if (-not (Test-Path -LiteralPath $sqlPath -PathType Leaf)) {
 throw "STOP: Missing companion read-only SQL."
}
$sql=Get-Content -LiteralPath $sqlPath -Encoding UTF8 -Raw
foreach ($needle in @("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY",
 "AUDIT_LOCAL_PASS|12_TABLES|COUNTS_AND_FINGERPRINTS",
 "ca_master_sync_enabled IS FALSE", "RESTRICT")) {
 if (-not $sql.Contains($needle)) { throw "STOP: Audit content contract missing." }
}
Write-Host "[STEP] Verify restored LOCAL PostgreSQL 17 using Unix socket only."
$output=@($sql | & docker exec -i -u postgres $Container psql -X -v ON_ERROR_STOP=1 -A -t -U $DbUser -h $SocketDir -d $Database 2>&1)
$exit=$LASTEXITCODE
if ($exit -ne 0) { throw "STOP: Restored local audit failed." }
$lines=@($output | ForEach-Object { "$_" })
if ($lines -notcontains "AUDIT_LOCAL_PASS|12_TABLES|COUNTS_AND_FINGERPRINTS") {
 throw "STOP: Missing local audit PASS marker."
}
$data=@($lines | Where-Object { $_ -match '^DATA\|[a-z_]+\|[0-9]+\|[a-f0-9]{64}$' })
if ($data.Count -ne 12) { throw "STOP: Missing 12 complete fingerprints." }
if (-not (Test-Path -LiteralPath $ReportRoot)) {
 New-Item -ItemType Directory -Path $ReportRoot -Force | Out-Null
}
$stamp=(Get-Date).ToUniversalTime().ToString("yyyyMMdd-HHmmss")
$report=Join-Path $ReportRoot ("private-local-restore-audit-"+$stamp+".txt")
if (Test-Path -LiteralPath $report) { throw "STOP: Refusing to overwrite evidence." }
@(
 "CA_CLOVER_PHASE_E_LOCAL_RESTORE_AUDIT"
 "GeneratedUTC="+(Get-Date).ToUniversalTime().ToString("o")
 "Container="+$Container
 "Database="+$Database
 "ExpectedSource=latest owner-controlled backup; origin NOT proven by this standalone test"
 "WARNING=Fingerprints private; never post to public GitHub"
) + $data + @("AUDIT_LOCAL_PASS|12_TABLES|COUNTS_AND_FINGERPRINTS") |
 Out-File -LiteralPath $report -Encoding utf8 -NoClobber
Write-Host "[PASS] LOCAL_RESTORE_INTEGRITY: 12 tables, OFF, 2099, RESTRICT."
Write-Host "[PASS] Private counts/fingerprints retained only on operator PC."
Write-Host "[REVIEW] Compare fingerprints with the private original source snapshot."
Write-Host "[STOP] No production restore, sync resume, or release authorization."
