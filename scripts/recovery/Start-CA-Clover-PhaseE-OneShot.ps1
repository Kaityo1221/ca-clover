# CA Clover Phase E: ONE interactive Windows invocation.
# Production is accessed only by the existing read-only pg_dump child.
# No merge, no production restore, no master sync, no overwrite of prior backups.
[CmdletBinding()]
param(
 [Parameter(Mandatory=$true)][string]$DbHost,
 [Parameter(Mandatory=$true)][string]$DbUser,
 [int]$DbPort=5432,
 [string]$BackupRoot="C:\CA-Clover-Backup-Latest"
)
$ErrorActionPreference="Stop"
Set-StrictMode -Version Latest
if([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) {
 throw "STOP: This operator workflow is for Windows."
}
# Direct PostgreSQL 5432 OR the official Session Pooler 5432 for this project.
# Transaction Pooler 6543 and arbitrary hosts are explicitly forbidden.
$isDirect=($DbHost -ceq "db.wgiittrvgtiosogyhfcl.supabase.co" -and $DbUser -ceq "postgres")
$isSessionPooler=($DbHost -cmatch '^[a-z0-9-]+[.]pooler[.]supabase[.]com$' -and
                  $DbUser -ceq "postgres.wgiittrvgtiosogyhfcl")
if((-not $isDirect -and -not $isSessionPooler) -or $DbPort -ne 5432) {
 throw "STOP: Use only this project's direct connection or Session Pooler on 5432."
}
foreach($name in @("Backup-CA-Clover-Production-Latest.ps1",
 "Restore-CA-Clover-Isolated.ps1","Validate-CA-Clover-Restored-Local.ps1",
 "phase-e-restored-local-readonly-audit.sql")) {
 if(-not(Test-Path -LiteralPath (Join-Path $PSScriptRoot $name) -PathType Leaf)){
  throw ("STOP: Missing companion audited script: "+$name)
 }
}
if($BackupRoot -notmatch '^[A-Za-z]:\\' -or $BackupRoot.Contains('..')){
 throw "STOP: BackupRoot must be an absolute local drive path."
}
if(-not(Test-Path -LiteralPath $BackupRoot)) {
 New-Item -ItemType Directory -Path $BackupRoot -Force | Out-Null
}
$rootItem=Get-Item -LiteralPath $BackupRoot
if($rootItem.Attributes -band [IO.FileAttributes]::ReparsePoint){
 throw "STOP: BackupRoot may not be a junction/symlink."
}
$root=$rootItem.FullName
$nonce=[Guid]::NewGuid().ToString("N").Substring(0,8)
$runId="phase-e-"+(Get-Date).ToUniversalTime().ToString("yyyyMMdd-HHmmss")+"-"+$nonce
$runDir=Join-Path $root $runId
if(Test-Path -LiteralPath $runDir){throw "STOP: Refusing to reuse backup directory."}
New-Item -ItemType Directory -Path $runDir | Out-Null
# Restrict confidential raw backup and logs to user, local Administrators and SYSTEM.
$acl=Get-Acl -LiteralPath $runDir
$acl.SetAccessRuleProtection($true,$false)
$inherit=[System.Security.AccessControl.InheritanceFlags]"ContainerInherit, ObjectInherit"
$prop=[System.Security.AccessControl.PropagationFlags]::None
$allow=[System.Security.AccessControl.AccessControlType]::Allow
foreach($sidText in @([Security.Principal.WindowsIdentity]::GetCurrent().User.Value,
                      "S-1-5-18","S-1-5-32-544")) {
 $sid=New-Object -TypeName System.Security.Principal.SecurityIdentifier -ArgumentList $sidText
 $rule=New-Object -TypeName System.Security.AccessControl.FileSystemAccessRule -ArgumentList @($sid,[System.Security.AccessControl.FileSystemRights]::FullControl,$inherit,$prop,$allow)
 $acl.AddAccessRule($rule)
}
Set-Acl -LiteralPath $runDir -AclObject $acl
$log=Join-Path $runDir "private-restore.log"
$state="PREPARED"
try {
 Write-Host "[1/4] NEW production database backup + encrypted 7z (READS ONLY)."
 $state="BACKUP_STARTED"
 & (Join-Path $PSScriptRoot "Backup-CA-Clover-Production-Latest.ps1") -DbHost $DbHost -DbUser $DbUser -DbPort $DbPort -BackupRoot $runDir
 if(-not $?){throw "STOP: Backup child reported failure."}
 $dirs=@(Get-ChildItem -LiteralPath $runDir -Directory | Where-Object{$_.Name -match '^production-[0-9]{8}-[0-9]{6}$'})
 if($dirs.Count -ne 1){throw "STOP: Expected one fresh backup folder."}
 $folder=$dirs[0].FullName
 $dump=Join-Path $folder "full-database.pgdump"
 $manifest=Join-Path $folder "backup-sha256.tsv"
 $encrypted=$folder+".7z"
 if(-not(Test-Path -LiteralPath $encrypted -PathType Leaf)){throw "STOP: Encrypted backup absent."}
 Write-Host "[2/4] Restore the just-captured dump into a NEW network-none local container."
 $state="LOCAL_RESTORE_STARTED"
 $result=@(& (Join-Path $PSScriptRoot "Restore-CA-Clover-Isolated.ps1") -DumpPath $dump -ManifestPath $manifest -ArchivePath $encrypted -RunId $nonce -PrivateLog $log)
 $verifiedRestore=@($result | Where-Object { $_ -is [psobject] -and $_.PSObject.Properties.Name -contains "LocalOnly" })
 if($verifiedRestore.Count -ne 1 -or $verifiedRestore[0].LocalOnly -ne $true) {
  throw "STOP: Isolated restore did not return verified result."
 }
 $target=$verifiedRestore[0]
 Write-Host "[3/4] Run read-only identity, medal, exchange and stop-gate audit."
 $state="LOCAL_AUDIT_STARTED"
 $auditRoot=Join-Path $runDir "local-audit"
 & (Join-Path $PSScriptRoot "Validate-CA-Clover-Restored-Local.ps1") -Container $target.Container -Database $target.Database -SocketDir $target.SocketDir -ReportRoot $auditRoot
 if(-not $?){throw "STOP: Local audit failed."}
 $state="DB_LOCAL_PASS"
 Write-Host "[4/4] Record outcome. Only DB restore proof, NOT complete Supabase recovery."
 Write-Host "[PASS] PHASE_E_LATEST_BACKUP_AND_ISOLATED_DB_RESTORE"
 Write-Host "[PASS] Original backups untouched. Fresh encrypted archive and private audit preserved."
 Write-Host "[REVIEW] Private data, encrypted archive and network-none Docker container remain on your PC."
 Write-Host "[STOP] Storage bytes, OAuth, Edge secrets/source, Cron and live per-record equality NOT verified."
 Write-Host "[STOP] CA master sync, changes to production and PR merge remain forbidden."
}catch{
 Write-Host ("[STOP] PHASE_E_ONESHOT_FAILED_AT_"+$state)
 Write-Host "[STOP] Keep all raw/encrypted backup materials and the isolated container for diagnosis."
 throw
}
