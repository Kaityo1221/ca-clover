#Requires -Version 5.1
<#
CA Clover Suzuki PM: one-pass connection activation (Docker edition).
Requires Docker (local postgres:17.11 image) and authenticated GitHub CLI.
Never paste credentials into ChatGPT, GitHub issues, or command-line arguments.
Does NOT merge code, deploy Pages, dispatch workflows, or start scheduling.
#>
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$repo = 'Kaityo1221/ca-clover'
$secretKey = 'SUZUKI_HP_READONLY_DATABASE_URL'
$image = 'postgres:17.11'
$oldPg = @{}
foreach ($name in @('PGHOST','PGPORT','PGDATABASE','PGUSER','PGPASSWORD','PGSSLMODE')) {
  $oldPg[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
}
$adminUrl = $null
$adminHost = $null
$adminPort = $null
$adminDb = $null
$adminUser = $null
$adminPassword = $null
$readerPassword = $null
$readerUri = $null
$roleEnabled = $false
$completed = $false

function Set-PgConnection([string]$dbHost, [string]$port, [string]$database, [string]$username, [string]$password) {
  $env:PGHOST = $dbHost
  $env:PGPORT = $port
  $env:PGDATABASE = $database
  $env:PGUSER = $username
  $env:PGPASSWORD = $password
  $env:PGSSLMODE = 'require'
}
function Invoke-Sql([string]$statement) {
  # Docker --env NAME forwards host environment by name, not value.
  # SQL is passed by stdin. The ephemeral container is removed after psql exits.
  $output = $statement | & docker run --rm -i --env PGHOST --env PGPORT --env PGDATABASE --env PGUSER --env PGPASSWORD --env PGSSLMODE --entrypoint psql postgres:17.11 -X -w -A -t -q -v ON_ERROR_STOP=1 2>&1
  if ($LASTEXITCODE -ne 0) { throw 'Docker psql failed. Check host, credentials, firewall or DB permissions.' }
  return (($output | Out-String).Trim())
}

try {
  if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { throw 'Docker command unavailable.' }
  if (-not (Get-Command gh -ErrorAction SilentlyContinue)) { throw 'GitHub CLI unavailable.' }
  & gh auth status 1>$null 2>$null
  if ($LASTEXITCODE -ne 0) { throw 'GitHub CLI not authenticated.' }
  & docker image inspect $image 1>$null 2>$null
  if ($LASTEXITCODE -ne 0) { throw 'postgres:17.11 Docker image unavailable.' }

  Write-Host 'CA Clover: Docker-based HP reader activation'
  Write-Host 'Paste the CA Clover Supabase ADMIN PostgreSQL URI when prompted.'
  Write-Host 'It will be hidden and will never be written to disk.'
  $secure = Read-Host 'Supabase admin PostgreSQL URI' -AsSecureString
  $handle = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { $adminUrl = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($handle) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($handle) }

  $uri = [Uri]$adminUrl
  if ($uri.Scheme -notin @('postgresql','postgres')) { throw 'Invalid DB URI scheme.' }
  $adminHost = $uri.Host
  $direct = ($adminHost -eq 'db.wgiittrvgtiosogyhfcl.supabase.co')
  $pooler = ($adminHost -match '^[a-z0-9-]+\.pooler\.supabase\.com$')
  if (-not ($direct -or $pooler)) { throw 'Host is not a recognized CA Clover Supabase endpoint.' }

  $credentials = $uri.UserInfo.Split(':', 2)
  if ($credentials.Count -ne 2) { throw 'Admin URI must include username and password.' }
  $adminUser = [Uri]::UnescapeDataString($credentials[0])
  $adminPassword = [Uri]::UnescapeDataString($credentials[1])
  if ($direct -and $adminUser -ne 'postgres') { throw 'Invalid direct-connection admin username.' }
  if ($pooler -and $adminUser -ne 'postgres.wgiittrvgtiosogyhfcl') { throw 'Pooler belongs to another project.' }
  $adminPort = if ($uri.Port -gt 0) { [string]$uri.Port } else { '5432' }
  $adminDb = [Uri]::UnescapeDataString($uri.AbsolutePath.TrimStart('/'))
  if (-not $adminDb) { $adminDb = 'postgres' }
  $readerUser = if ($pooler) { 'suzuki_hp_reader.wgiittrvgtiosogyhfcl' } else { 'suzuki_hp_reader' }
  Set-PgConnection $adminHost $adminPort $adminDb $adminUser $adminPassword

  $preflight = Invoke-Sql @'
SELECT CASE WHEN EXISTS(
 SELECT 1 FROM pg_roles WHERE rolname='suzuki_hp_reader'
 AND rolcanlogin=false AND rolbypassrls=false
) AND has_function_privilege(
 'suzuki_hp_reader','private.suzuki_hp_snapshot()','EXECUTE'
) AND NOT has_table_privilege(
 'suzuki_hp_reader','public.communities','SELECT'
) THEN 'PASS' ELSE 'FAIL' END;
'@
  if ($preflight -ne 'PASS') { throw 'Preflight failed: dedicated NOLOGIN reader is not isolated.' }

  $bytes = New-Object byte[] 48
  $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
  try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
  $readerPassword = [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+','-').Replace('/','_')
  [Array]::Clear($bytes, 0, $bytes.Length)

  # A freshly generated password uses a strict [A-Za-z0-9_-] alphabet.
  $grantStatement = "ALTER ROLE suzuki_hp_reader WITH LOGIN PASSWORD '$readerPassword';"
  Invoke-Sql $grantStatement | Out-Null
  $roleEnabled = $true
  $grantStatement = $null

  Set-PgConnection $adminHost $adminPort $adminDb $readerUser $readerPassword
  $verification = Invoke-Sql @'
SELECT CASE
 WHEN current_user='suzuki_hp_reader'
 AND (private.suzuki_hp_snapshot()->>'snapshotReady')::boolean
 AND has_function_privilege(current_user,'private.suzuki_hp_snapshot()','EXECUTE')
 AND NOT has_table_privilege(current_user,'public.communities','SELECT')
 AND NOT has_table_privilege(current_user,'public.communities','INSERT')
 AND NOT has_table_privilege(current_user,'public.communities','UPDATE')
 AND NOT has_table_privilege(current_user,'public.communities','DELETE')
 THEN 'PASS' ELSE 'FAIL' END;
'@
  if ($verification -ne 'PASS') { throw 'Reader login or least-privilege verification failed.' }

  $encodedUser = [Uri]::EscapeDataString($readerUser)
  $encodedPassword = [Uri]::EscapeDataString($readerPassword)
  $encodedDb = [Uri]::EscapeDataString($adminDb)
  $readerUri = 'postgresql://' + $encodedUser + ':' + $encodedPassword + '@' + $adminHost + ':' + $adminPort + '/' + $encodedDb + '?sslmode=require'

  # GitHub CLI reads the credential from stdin, not command-line arguments.
  $readerUri | & gh secret set $secretKey --repo $repo
  if ($LASTEXITCODE -ne 0) { throw 'GitHub Secret registration failed.' }
  $completed = $true
  Write-Host 'RESULT=PASS'
  Write-Host 'DB_READER=LOGIN_OK_READONLY'
  Write-Host 'GITHUB_SECRET=REGISTERED'
  Write-Host 'PRODUCTION_SCHEDULE=NOT_STARTED'
}
catch {
  Write-Host 'RESULT=BLOCKED'
  Write-Host ('REASON=' + $_.Exception.Message)
}
finally {
  if ($roleEnabled -and -not $completed) {
    try {
      Set-PgConnection $adminHost $adminPort $adminDb $adminUser $adminPassword
      Invoke-Sql 'ALTER ROLE suzuki_hp_reader NOLOGIN;' | Out-Null
      Write-Host 'ROLLBACK=READER_LOGIN_DISABLED'
    }
    catch {
      Write-Host 'ROLLBACK=MANUAL_VERIFICATION_REQUIRED'
    }
  }
  foreach ($name in $oldPg.Keys) {
    [Environment]::SetEnvironmentVariable($name, $oldPg[$name], 'Process')
  }
  $readerPassword = $null
  $readerUri = $null
  $adminPassword = $null
  $adminUrl = $null
}
if (-not $completed) { exit 1 }
