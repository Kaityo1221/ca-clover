param(
 [string]$SourcePath=(Join-Path $PSScriptRoot '..\recovery\Validate-CA-Clover-Restored-Local.ps1'),
 [string]$EvidenceRoot=$env:TEMP
)
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$tokens=$null;$errors=$null
$ast=[Management.Automation.Language.Parser]::ParseFile($SourcePath,[ref]$tokens,[ref]$errors)
if($errors.Count){throw ($errors | Out-String)}
$source=Get-Content -LiteralPath $SourcePath -Raw
foreach($name in @('Assert-StrictAuditAcl','Open-PrivateAuditDirectory','Write-PrivateAuditReport')){
 $f=@($ast.FindAll({param($n) $n -is [Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq $name},$true))
 if($f.Count -ne 1){throw 'STOP: missing function'}
 . ([scriptblock]::Create($f[0].Extent.Text))
}
$begin=$source.IndexOf("if (-not ('CaClover.AuditDirectoryLease'")
$end=$source.IndexOf('function Open-PrivateAuditDirectory')
. ([scriptblock]::Create($source.Substring($begin,$end-$begin)))
$acl=New-Object Security.AccessControl.DirectorySecurity
$acl.SetAccessRuleProtection($true,$false)
$expected=@([Security.Principal.WindowsIdentity]::GetCurrent().User.Value,'S-1-5-18','S-1-5-32-544')
foreach($sid in $expected){
 $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new([Security.Principal.SecurityIdentifier]::new($sid),[Security.AccessControl.FileSystemRights]::FullControl,[Security.AccessControl.InheritanceFlags]'ContainerInherit,ObjectInherit',[Security.AccessControl.PropagationFlags]::None,[Security.AccessControl.AccessControlType]::Allow))
}
$sandbox=Join-Path $EvidenceRoot ('phase-e-path-synthetic-'+[guid]::NewGuid().ToString('N'))
[IO.Directory]::CreateDirectory($sandbox,$acl) | Out-Null
$results=New-Object 'Collections.Generic.List[object]'
function Pass([string]$name){ $results.Add(@{case=$name;result='PASS'}); Write-Output ('PASS: '+$name) }
function Reject([string]$name,[scriptblock]$action,[string]$pattern='*STOP:*'){
 $caught=$false
 try{ & $action }catch{if($_.Exception.Message -notlike $pattern){throw};$caught=$true}
 if(-not $caught){throw ('STOP: unsafe acceptance '+$name)}
 Pass $name
}
function Get-Date { [datetime]'2026-10-15T00:00:00Z' }
$root=Join-Path $sandbox 'new\nested'
$lease=Open-PrivateAuditDirectory $root $acl 'SYNTHETIC'
try{
 Write-PrivateAuditReport $lease @('SYNTHETIC_ONLY','no real data')
 Pass 'new-nested-directory-save'
 $report=@(Get-ChildItem -LiteralPath $root -File)[0].FullName
 $before=(Get-FileHash -LiteralPath $report).Hash
 Reject 'atomic-no-overwrite' { Write-PrivateAuditReport $lease @('replacement') } '*already exists*'
 if((Get-FileHash -LiteralPath $report).Hash -cne $before){throw 'STOP: overwritten report'}
 Pass 'original-evidence-unchanged'
 # These operations must fail while a destination and all its parents are pinned.
 Reject 'pinned-root-rename' { [IO.Directory]::Move($root,($root+'-moved')) } '*used by another process*'
 $parent=Split-Path $root
 Reject 'pinned-parent-rename' { [IO.Directory]::Move($parent,($parent+'-moved')) } '*used by another process*'
 $read=[IO.File]::OpenRead($report)
 try{Reject 'physical-path-mismatch' { [CaClover.AuditDirectoryLease]::AssertFinalPath($read.SafeFileHandle,($report+'-wrong')) }}finally{$read.Dispose()}
}finally{$lease.Dispose()}
$lease=Open-PrivateAuditDirectory $root $acl 'EXISTING'
$lease.Dispose();Pass 'existing-private-root'
$closedMove=$root+'-after-close'
[IO.Directory]::Move($root,$closedMove)
[IO.Directory]::Move($closedMove,$root)
Pass 'handle-finally-released'
$file=Join-Path $sandbox 'plain-file';[IO.File]::WriteAllText($file,'synthetic')
Reject 'file-as-root' { Open-PrivateAuditDirectory $file $acl 'FILE' }
$inherited=Join-Path $sandbox 'inherited';[IO.Directory]::CreateDirectory($inherited) | Out-Null
Reject 'inherited-acl' { Open-PrivateAuditDirectory $inherited $acl 'INHERITED' }
$extra=Join-Path $sandbox 'extra';[IO.Directory]::CreateDirectory($extra,$acl) | Out-Null
$extraAcl=Get-Acl -LiteralPath $extra
$extraAcl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new([Security.Principal.SecurityIdentifier]::new('S-1-5-32-545'),[Security.AccessControl.FileSystemRights]::ReadAndExecute,[Security.AccessControl.InheritanceFlags]'ContainerInherit,ObjectInherit',[Security.AccessControl.PropagationFlags]::None,[Security.AccessControl.AccessControlType]::Allow))
# SetAccessControl persists DACL only; Set-Acl may request unavailable SACL privilege.
$extraDacl=New-Object Security.AccessControl.DirectorySecurity
$extraDacl.SetSecurityDescriptorSddlForm($extraAcl.GetSecurityDescriptorSddlForm([Security.AccessControl.AccessControlSections]::Access),[Security.AccessControl.AccessControlSections]::Access)
[IO.Directory]::SetAccessControl($extra,$extraDacl)
Reject 'extra-principal-real-directory' { Open-PrivateAuditDirectory $extra $acl 'EXTRA' }
$target=Join-Path $sandbox 'target';[IO.Directory]::CreateDirectory($target,$acl) | Out-Null
$junction=Join-Path $sandbox 'junction';New-Item -ItemType Junction -Path $junction -Target $target | Out-Null
Reject 'root-junction' { Open-PrivateAuditDirectory $junction $acl 'JUNCTION' }
Reject 'ancestor-junction' { Open-PrivateAuditDirectory (Join-Path $junction 'nested') $acl 'JUNCTION_PARENT' }
if(@(Get-ChildItem -LiteralPath $target -Force).Count -ne 0){throw 'STOP: redirected target modified'}
Pass 'redirected-target-untouched'
foreach($path in @('relative\root','C:relative','\\server\share\root','\\?\C:\device','C:\root:ads',($sandbox+'\..\escape'),($sandbox+'\trailing.'),($sandbox+'\NUL'))){
 Reject ('invalid-path-'+$results.Count) { Open-PrivateAuditDirectory $path $acl 'INVALID' }
}
# Open existing writable directory handle, then ensure lease fails closed on sharing.
Add-Type @'
using System;
using System.Runtime.InteropServices;
using Microsoft.Win32.SafeHandles;
public static class SyntheticOpen {
 [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)]
 public static extern SafeFileHandle CreateFileW(string p,uint a,uint s,IntPtr x,uint d,uint f,IntPtr t);
}
'@
$handle=[SyntheticOpen]::CreateFileW($root,0x40000000,7,[IntPtr]::Zero,3,0x02000000,[IntPtr]::Zero)
if($handle.IsInvalid){throw 'STOP: writable-handle fixture failed'}
try{Reject 'preexisting-writable-handle' { Open-PrivateAuditDirectory $root $acl 'RACE' }}finally{$handle.Dispose()}
# A direct SetReparsePoint-style write handle is denied while leased.
$lease=Open-PrivateAuditDirectory $root $acl 'PINNED'
try{
 $handle=[SyntheticOpen]::CreateFileW($root,0x40000000,7,[IntPtr]::Zero,3,0x02200000,[IntPtr]::Zero)
 try{if(-not $handle.IsInvalid){throw 'STOP: writable handle opened during lease'}}finally{$handle.Dispose()}
 Pass 'reparse-write-handle-blocked'
 # Independent process: prevent directory rename, which is the first step of a
 # rename-and-junction replacement attack. The child checks Win32 error 32.
 $attack=@'
$ProgressPreference='SilentlyContinue'
Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class RenameAttempt {
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)]
 public static extern bool MoveFileExW(string p,string q,uint f);
}
"@
'@
 $quotedRoot=$root.Replace("'","''")
 $attack+="`nif ([RenameAttempt]::MoveFileExW('$quotedRoot','${quotedRoot}-child-moved',0)) { exit 10 }; if ([Runtime.InteropServices.Marshal]::GetLastWin32Error() -ne 32) { exit 11 }; exit 0"
 $encoded=[Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($attack))
 & powershell.exe -NoProfile -ExecutionPolicy Bypass -EncodedCommand $encoded
 if($LASTEXITCODE -ne 0){throw 'STOP: cross-process rename was not blocked with sharing violation'}
 Pass 'cross-process-replacement-blocked'
}finally{$lease.Dispose()}
if(@(Get-ChildItem -LiteralPath $extra -File).Count -or @(Get-ChildItem -LiteralPath $inherited -File).Count){throw 'STOP: rejected root received output'}
$results | ConvertTo-Json -Depth 5 | Out-File -LiteralPath (Join-Path $sandbox 'results.json') -Encoding UTF8 -NoClobber
Write-Output ('SYNTHETIC_EVIDENCE_ROOT='+$sandbox)
Write-Output ('SYNTHETIC_MATRIX_PASS: '+$results.Count)
