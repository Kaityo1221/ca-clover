# CA Clover latest production PostgreSQL backup (operator PC only).
# Reads production only. NEVER restores, updates or restarts CA Master.
# DB archive includes Storage metadata but NOT Storage object bytes.
[CmdletBinding()]
param(
 [Parameter(Mandatory=$true)][string]$DbHost,
 [Parameter(Mandatory=$true)][string]$DbUser,
 [int]$DbPort=5432,
 [string]$BackupRoot="C:\CA-Clover-Backup-Latest"
)
$ErrorActionPreference="Stop"
Set-StrictMode -Version Latest
$ProjectRef="wgiittrvgtiosogyhfcl"
if (-not (($DbHost -like "*$ProjectRef*") -or ($DbUser -like "*$ProjectRef*"))) {
 throw "STOP: Host/user does not identify CA Clover. Check Supabase dashboard Connect settings."
}
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { throw "STOP: Docker Desktop required." }
$sevenZip=(Get-Command 7z.exe -ErrorAction SilentlyContinue)
if (-not $sevenZip -and (Test-Path "C:\Program Files\7-Zip\7z.exe")) {
 $sevenZip=Get-Item "C:\Program Files\7-Zip\7z.exe"
}
if (-not $sevenZip) { throw "STOP: 7-Zip executable required for encrypted backups." }
if ($sevenZip -is [System.Management.Automation.ApplicationInfo]) {
 $sevenZipExe=$sevenZip.Source
} else {
 $sevenZipExe=$sevenZip.FullName
}
if (-not (Test-Path -LiteralPath $BackupRoot)) { New-Item -ItemType Directory -Path $BackupRoot | Out-Null }
$stamp=(Get-Date).ToUniversalTime().ToString("yyyyMMdd-HHmmss")
$dir=Join-Path $BackupRoot ("production-"+$stamp)
if (Test-Path -LiteralPath $dir) { throw "STOP: Refusing to overwrite existing backup." }
New-Item -ItemType Directory -Path $dir | Out-Null
$dump=Join-Path $dir "full-database.pgdump"
$inventory=Join-Path $dir "pg-archive-contents.txt"
$manifest=Join-Path $dir "backup-sha256.tsv"
$archive=$dir+".7z"
$secure=Read-Host "Production Postgres password (never share in chat)" -AsSecureString
$ptr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try { $env:PGPASSWORD=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr); $secure.Dispose() }
$env:PGHOST=$DbHost
$env:PGPORT=[string]$DbPort
$env:PGUSER=$DbUser
$env:PGDATABASE="postgres"
$env:PGSSLMODE="require"
try {
 $mount=$dir.Replace("\","/")+":/backup"
 Write-Host "[STEP] pg_dump Postgres 17. Production read-only."
 & docker run --rm --network bridge -e PGHOST -e PGPORT -e PGUSER -e PGPASSWORD -e PGDATABASE -e PGSSLMODE -v $mount postgres:17 pg_dump --format=custom --no-owner --no-privileges --file=/backup/full-database.pgdump
 if ($LASTEXITCODE -ne 0) { throw "STOP: pg_dump failed. No valid backup may be claimed." }
 if (-not (Test-Path -LiteralPath $dump)) { throw "STOP: Missing dump file." }
 if ((Get-Item -LiteralPath $dump).Length -lt 100000) { throw "STOP: Dump is unexpectedly small." }
 $listing=@(& docker run --rm -v $mount postgres:17 pg_restore --list /backup/full-database.pgdump)
 if ($LASTEXITCODE -ne 0) { throw "STOP: pg_restore catalog failed." }
 $listText=$listing -join [Environment]::NewLine
 foreach($needle in @("TABLE DATA auth users","TABLE DATA storage objects","TABLE DATA public user_ca_identities","TABLE DATA public stamp_collections")) {
  if (-not $listText.Contains($needle)) { throw ("STOP: Required database table absent: "+$needle) }
 }
 [IO.File]::WriteAllLines($inventory,[string[]]$listing)
 $lines=@("sha256"+[char]9+"bytes"+[char]9+"file")
 foreach($file in @($dump,$inventory)){
  $sha=(Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash
  $length=(Get-Item -LiteralPath $file).Length
  $lines+=($sha+[char]9+$length+[char]9+(Split-Path -Leaf $file))
 }
 [IO.File]::WriteAllLines($manifest,[string[]]$lines)
} finally {
 foreach($key in @("PGPASSWORD","PGHOST","PGPORT","PGUSER","PGDATABASE","PGSSLMODE")) {
  Remove-Item ("Env:\"+$key) -ErrorAction SilentlyContinue
 }
}
Write-Host "[STEP] 7-Zip AES-256 encryption. Enter vault password interactively."
# -p has NO literal password, so it prompts interactively instead of leaking argv.
& $sevenZipExe a -t7z -mhe=on -mx=5 -p $archive $dir
if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $archive)) {
 throw ("STOP: Encryption failed. Protect raw backup directory: "+$dir)
}
Write-Host "[STEP] Validate encrypted archive by full 7-Zip read (password prompt)."
& $sevenZipExe t -p $archive
if ($LASTEXITCODE -ne 0) { throw "STOP: Encrypted archive test failed. Raw copy kept." }
Write-Host ("[PASS] Encrypted DB archive: "+$archive)
Write-Host ("[PASS] Archive SHA256: "+(Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash)
Write-Host "[REVIEW] This is a PostgreSQL archive, not a complete Supabase application backup."
Write-Host "[REVIEW] Storage object BYTES, OAuth settings, secrets, Edge source and Cron require separate preservation."
Write-Host "[STOP] Do NOT delete originals, run any restore on production, or restart CA master sync."
