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
function Assert-StrictAuditAcl {
 param(
  [System.Security.AccessControl.DirectorySecurity]$Acl,
  [string]$Label
 )

 $allowed = @(
  [System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value,
  "S-1-5-18",
  "S-1-5-32-544"
 ) | Sort-Object

 if (-not $Acl.AreAccessRulesProtected) {
  throw "STOP: $Label ACL inheritance enabled."
 }

 $rules = @($Acl.Access)

 if ($rules.Count -ne 3) {
  throw "STOP: $Label ACL rule count invalid."
 }

 $actual = @()

 foreach ($rule in $rules) {
  $sid = $rule.IdentityReference.Translate(
   [System.Security.Principal.SecurityIdentifier]
  ).Value

  $actual += $sid

  if ($rule.AccessControlType -ne [System.Security.AccessControl.AccessControlType]::Allow) {
   throw "STOP: $Label contains non-Allow rule."
  }

  if ($rule.FileSystemRights -ne [System.Security.AccessControl.FileSystemRights]::FullControl) {
   throw "STOP: $Label does not grant FullControl."
  }

  if ($rule.IsInherited) {
   throw "STOP: $Label contains inherited rule."
  }

  $requiredFlags = [System.Security.AccessControl.InheritanceFlags]::ContainerInherit -bor
                   [System.Security.AccessControl.InheritanceFlags]::ObjectInherit

  if ($rule.InheritanceFlags -ne $requiredFlags) {
   throw "STOP: $Label inheritance flags invalid."
  }

  if ($rule.PropagationFlags -ne [System.Security.AccessControl.PropagationFlags]::None) {
   throw "STOP: $Label propagation flags invalid."
  }
 }

 if (Compare-Object $allowed ($actual | Sort-Object)) {
  throw "STOP: $Label SID mismatch."
 }

 Write-Host "PASS: STRICT_ACL_$Label"
}

# Pin every directory component without write/delete sharing. Attribute and final-path
# checks use those handles, so a checked parent cannot be renamed or made a junction
# during capture/save. Privileged or same-token ACL tampering is outside this boundary.
if (-not ('CaClover.AuditDirectoryLease' -as [type])) {
 Add-Type -TypeDefinition @'
using System;
using System.IO;
using System.Collections.Generic;
using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Security.AccessControl;
using System.Text;
using Microsoft.Win32.SafeHandles;
namespace CaClover {
 public sealed class AuditDirectoryLease : IDisposable {
  [StructLayout(LayoutKind.Sequential)] struct FileInfo {
   public uint Attributes;
   public System.Runtime.InteropServices.ComTypes.FILETIME Creation, Access, Write;
   public uint Volume, SizeHigh, SizeLow, Links, IndexHigh, IndexLow;
  }
  [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)]
  static extern SafeFileHandle CreateFileW(string path, uint access, uint share,
   IntPtr security, uint disposition, uint flags, IntPtr template);
  [DllImport("kernel32.dll", SetLastError=true)]
  static extern bool GetFileInformationByHandle(SafeFileHandle handle, out FileInfo info);
  [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)]
  static extern uint GetFinalPathNameByHandleW(SafeFileHandle handle, StringBuilder path, uint length, uint flags);
  readonly List<SafeFileHandle> handles = new List<SafeFileHandle>();
  public string Path { get; private set; }
  public static void AssertFinalPath(SafeFileHandle handle, string expected) {
   var buffer = new StringBuilder(32768);
   uint length = GetFinalPathNameByHandleW(handle, buffer, (uint)buffer.Capacity, 0);
   if (length == 0 || length >= buffer.Capacity ||
       !String.Equals(buffer.ToString().TrimEnd('\\'), ("\\\\?\\" + expected).TrimEnd('\\'), StringComparison.OrdinalIgnoreCase))
    throw new IOException("STOP: Audit destination physical path mismatch.");
  }
  public static AuditDirectoryLease Open(string path, DirectorySecurity acl) {
   // Reject UNC/device/provider/relative paths, ADS, aliases and ambiguous components.
   if (String.IsNullOrEmpty(path) || !System.Text.RegularExpressions.Regex.IsMatch(path, @"^[A-Za-z]:\\[^:/*?""<>|]+$") || path.Length > 240)
    throw new IOException("STOP: Audit destination must be an unambiguous absolute local path.");
   path = path.TrimEnd('\\');
   string[] parts = path.Substring(3).Split('\\');
   foreach (string part in parts) {
    if (part.Length == 0 || part == "." || part == ".." || part.EndsWith(".") || part.EndsWith(" ") ||
        System.Text.RegularExpressions.Regex.IsMatch(part, @"[\x00-\x1f]|^(CON|PRN|AUX|NUL|COM[0-9]|LPT[0-9])(?:\.|$)", System.Text.RegularExpressions.RegexOptions.IgnoreCase))
     throw new IOException("STOP: Ambiguous audit destination component.");
   }
   if (new DriveInfo(path.Substring(0,3)).DriveType != DriveType.Fixed)
    throw new IOException("STOP: Audit destination requires a fixed local drive.");
   var lease = new AuditDirectoryLease();
   try {
    string current = path.Substring(0,3);
    for (int i = -1; i < parts.Length; i++) {
     if (i >= 0) current = System.IO.Path.Combine(current, parts[i]);
     // FILE_LIST_DIRECTORY is required: attributes-only opens do not enforce sharing.
     SafeFileHandle handle = CreateFileW(current, 0x81, 1, IntPtr.Zero, 3, 0x02200000, IntPtr.Zero);
     if (handle.IsInvalid) {
      int error = Marshal.GetLastWin32Error(); handle.Dispose();
      if (error != 2 && error != 3) throw new Win32Exception(error, "STOP: Cannot pin audit destination.");
      // Explicit ACL at creation: no interval with an inherited permissive ACL.
      Directory.CreateDirectory(current, acl);
      handle = CreateFileW(current, 0x81, 1, IntPtr.Zero, 3, 0x02200000, IntPtr.Zero);
      if (handle.IsInvalid) { error=Marshal.GetLastWin32Error(); handle.Dispose(); throw new Win32Exception(error, "STOP: Cannot pin created audit directory."); }
     }
     lease.handles.Add(handle);
     FileInfo info;
     if (!GetFileInformationByHandle(handle, out info)) throw new Win32Exception(Marshal.GetLastWin32Error());
     if ((info.Attributes & 0x400) != 0) throw new IOException("STOP: Audit destination contains a reparse point.");
     if ((info.Attributes & 0x10) == 0) throw new IOException("STOP: Audit destination is not a directory.");
     AssertFinalPath(handle, current);
    }
    lease.Path = path;
    return lease;
   } catch { lease.Dispose(); throw; }
  }
  public void Dispose() {
   for (int i=handles.Count-1; i>=0; i--) handles[i].Dispose();
   handles.Clear();
  }
 }
}
'@
}

function Open-PrivateAuditDirectory {
 param([string]$Path, [System.Security.AccessControl.DirectorySecurity]$Acl, [string]$Label)
 $lease = [CaClover.AuditDirectoryLease]::Open($Path, $Acl)
 try {
  Assert-StrictAuditAcl -Acl (Get-Acl -LiteralPath $lease.Path) -Label $Label
  return $lease
 } catch { $lease.Dispose(); throw }
}

function Write-PrivateAuditReport {
 param($Lease, [string[]]$Lines)
 # Recheck ACL immediately before atomic create; no check-then-open overwrite race.
 Assert-StrictAuditAcl -Acl (Get-Acl -LiteralPath $Lease.Path) -Label "REPORT_ROOT"
 $stamp=(Get-Date).ToUniversalTime().ToString("yyyyMMdd-HHmmss")
 $report=Join-Path $Lease.Path ("private-local-restore-audit-"+$stamp+".txt")
 $stream=$null
 $writer=$null
 try {
  $stream=[System.IO.FileStream]::new($report, [System.IO.FileMode]::CreateNew, [System.IO.FileAccess]::Write, [System.IO.FileShare]::None)
  [CaClover.AuditDirectoryLease]::AssertFinalPath($stream.SafeFileHandle, $report)
  $writer=[System.IO.StreamWriter]::new($stream, [System.Text.UTF8Encoding]::new($true))
  foreach ($line in $Lines) { $writer.WriteLine($line) }
  $writer.Flush()
  $stream.Flush($true)
 } finally {
  if ($null -ne $writer) { $writer.Dispose() }
  if ($null -ne $stream) { $stream.Dispose() }
 }
}

if ($Container -cnotmatch '^ca-clover-(supabase-)?restore-[0-9]{8}(-[A-Za-z0-9_-]+)?$') {
 throw "STOP: Expected dedicated dated LOCAL restore container name."
}
if ($Container -match 'wgiittrvgtiosogyhfcl') { throw "STOP: Production identifier in target." }
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
 throw "STOP: Docker Desktop required."
}
$inspectOutput=@(& docker inspect --type container $Container 2>&1)
if ($LASTEXITCODE -ne 0) { throw "STOP: Local restore container not found." }
$info = ConvertFrom-Json -InputObject ($inspectOutput -join "`n")
if ($info.Count -ne 1 -or $info[0].Name -cne ("/"+$Container)) {
 throw "STOP: Docker identity mismatch."
}
$c=$info[0]
if ($c.State.Running -ne $true) { throw "STOP: Local restore container not running." }
if ($c.Config.Image -notmatch '^(public\.ecr\.aws/supabase/postgres:17(?:\.|$)|postgres:17(?:\.|$))') {
 throw "STOP: Expected PostgreSQL 17 restore image."
}
if ($c.HostConfig.NetworkMode -cne "none") {
 throw "STOP: Network must be none."
}
if (@($c.Mounts | Where-Object { $null -ne $_ }).Count -ne 0) {
 throw "STOP: Mounted paths forbidden."
}
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
$id = [guid]::NewGuid().ToString("N")
$privateTemp = Join-Path $env:TEMP ("ca-audit-private-" + $id)

$identity = [System.Security.Principal.WindowsIdentity]::GetCurrent()
$acl = New-Object System.Security.AccessControl.DirectorySecurity
$acl.SetAccessRuleProtection($true, $false)
$flags = [System.Security.AccessControl.InheritanceFlags]::ContainerInherit -bor [System.Security.AccessControl.InheritanceFlags]::ObjectInherit

foreach ($sid in @($identity.User.Value, "S-1-5-18", "S-1-5-32-544")) {
 $principal = New-Object System.Security.Principal.SecurityIdentifier($sid)
 $rule = [System.Security.AccessControl.FileSystemAccessRule]::new(
  $principal,
  [System.Security.AccessControl.FileSystemRights]::FullControl,
  $flags,
  [System.Security.AccessControl.PropagationFlags]::None,
  [System.Security.AccessControl.AccessControlType]::Allow
 )
 $acl.AddAccessRule($rule)
}

$reportLease=$null
$tempLease=$null
try {
 # Validate/pin both destinations before any database output is captured.
 $reportLease=Open-PrivateAuditDirectory -Path $ReportRoot -Acl $acl -Label "REPORT_ROOT"
 $tempLease=Open-PrivateAuditDirectory -Path $privateTemp -Acl $acl -Label "PRIVATE_TEMP"
$inputFile = Join-Path $privateTemp "audit.sql"
$outFile = Join-Path $privateTemp "audit.stdout"
$errFile = Join-Path $privateTemp "audit.stderr"

[System.IO.File]::WriteAllText(
 $inputFile, $sql, (New-Object System.Text.UTF8Encoding($false))
)

$argsDocker = @(
 "exec", "-i", "-u", "postgres", $Container, "psql",
 "-X", "-v", "ON_ERROR_STOP=1", "-A", "-t",
 "-U", $DbUser, "-h", $SocketDir, "-d", $Database
)

$process = Start-Process -FilePath "docker.exe" `
 -ArgumentList $argsDocker -NoNewWindow -Wait -PassThru `
 -RedirectStandardInput $inputFile `
 -RedirectStandardOutput $outFile `
 -RedirectStandardError $errFile

$output = @(Get-Content -LiteralPath $outFile)
$exit=$process.ExitCode
if ($exit -ne 0) { throw "STOP: Restored local audit failed." }
$lines=@($output | ForEach-Object { "$_" })
if ($lines -notcontains "AUDIT_LOCAL_PASS|12_TABLES|COUNTS_AND_FINGERPRINTS") {
 throw "STOP: Missing local audit PASS marker."
}
$data=@($lines | Where-Object { $_ -match '^DATA\|[a-z_]+\|[0-9]+\|[a-f0-9]{64}$' })
if ($data.Count -ne 12) { throw "STOP: Missing 12 complete fingerprints." }
$reportLines=@(
 "CA_CLOVER_PHASE_E_LOCAL_RESTORE_AUDIT"
 "GeneratedUTC="+(Get-Date).ToUniversalTime().ToString("o")
 "Container="+$Container
 "Database="+$Database
 "ExpectedSource=latest owner-controlled backup; origin NOT proven by this standalone test"
 "WARNING=Fingerprints private; never post to public GitHub"
) + $data + @("AUDIT_LOCAL_PASS|12_TABLES|COUNTS_AND_FINGERPRINTS")
Write-PrivateAuditReport -Lease $reportLease -Lines $reportLines
Write-Host "[PASS] LOCAL_RESTORE_INTEGRITY: 12 tables, OFF, 2099, RESTRICT."
Write-Host "[PASS] Private counts/fingerprints retained only on operator PC."
Write-Host "[REVIEW] Compare fingerprints with the private original source snapshot."
Write-Host "[STOP] No production restore, sync resume, or release authorization."
} finally {
 if ($null -ne $tempLease) { $tempLease.Dispose() }
 if ($null -ne $reportLease) { $reportLease.Dispose() }
}
