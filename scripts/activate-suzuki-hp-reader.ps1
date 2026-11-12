#Requires -Version 5.1
<#
  CA Clover Suzuki PM daily HP credential bootstrap.
  Run locally in Windows PowerShell. Requires psql and gh CLI already installed
  and an authenticated 'gh auth login'. Do NOT run in CI.
  Neither DB passwords nor generated credentials are printed or saved to disk.
  Changes: dedicated role login/password and GitHub Actions secret ONLY.
  Does NOT merge code, dispatch workflows or modify Pages.
#>
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$Repo = 'Kaityo1221/ca-clover'
$SecretName = 'SUZUKI_HP_READONLY_DATABASE_URL'
$roleEnabled = $false
$completed = $false
$originalPgEnv = @{}
foreach ($name in @('PGHOST','PGPORT','PGDATABASE','PGUSER','PGPASSWORD','PGSSLMODE')) {
  $originalPgEnv[$name] = [Environment]::GetEnvironmentVariable($name,'Process')
}
function Set-PgEnvironment([string]$hostName,[string]$port,[string]$database,[string]$user,[string]$password) {
  $env:PGHOST = $hostName; $env:PGPORT = $port
  $env:PGDATABASE = $database; $env:PGUSER = $user
  $env:PGPASSWORD = $password; $env:PGSSLMODE = 'require'
}
function Run-Sql([string]$query) {
  $result = $query | & psql -X -w -A -t -q -v ON_ERROR_STOP=1 2>&1
  if ($LASTEXITCODE -ne 0) { throw 'psql returned an error (connection or permission denied).' }
  return (($result | Out-String).Trim())
}
$secure = $null
$adminUriText = $null
$adminPassword = $null
$readerPassword = $null
$readerUrl = $null
try {
  if (-not (Get-Command psql -ErrorAction SilentlyContinue)) { throw 'psql not found on PATH.' }
  $ghCommand = Get-Command gh -ErrorAction SilentlyContinue
  if (-not $ghCommand) { throw 'GitHub CLI (gh) not found on PATH.' }
  & gh auth status 1>$null 2>$null
  if ($LASTEXITCODE -ne 0) { throw 'GitHub CLI is not authenticated. Run gh auth login first.' }

  Write-Host 'CA Clover: secure daily HP connection setup (NO publishing)'
  Write-Host 'Provide the Supabase database ADMIN connection URI locally.'
  Write-Host 'Use a direct or session-pooler PostgreSQL URI. Input is hidden.'
  $secure = Read-Host 'Admin PostgreSQL connection URI' -AsSecureString
  $handle = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { $adminUriText = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($handle) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($handle) }
  $url = [Uri]$adminUriText
  if ($url.Scheme -notin @('postgresql','postgres')) { throw 'Invalid PostgreSQL URI scheme.' }
  $directHost = 'db.wgiittrvgtiosogyhfcl.supabase.co'
  $isDirect = $url.Host -eq $directHost
  $isPooler = $url.Host -match '(?i)^[a-z0-9-]+\.pooler\.supabase\.com
  $pair = $url.UserInfo.Split(':',2)
  if ($pair.Length -ne 2) { throw 'The admin URI must contain its own username and password.' }
  $adminUser = [Uri]::UnescapeDataString($pair[0])
  $adminPassword = [Uri]::UnescapeDataString($pair[1])
  $port = if ($url.Port -gt 0) { [string]$url.Port } else { '5432' }
  $dbName = [Uri]::UnescapeDataString($url.AbsolutePath.TrimStart('/'))
  if (-not $dbName) { $dbName='postgres' }
  if ($isDirect -and $adminUser -ne 'postgres') {
    throw 'Direct database connections must use the postgres admin user.'
  }
  if ($isPooler -and $adminUser -ne 'postgres.wgiittrvgtiosogyhfcl') {
    throw 'The pooler account must belong to the CA Clover Supabase project.'
  }
  $readerUser = if ($adminUser.Contains('.')) {
    'suzuki_hp_reader.' + $adminUser.Split('.',2)[1]
  } else { 'suzuki_hp_reader' }
  Set-PgEnvironment $url.Host $port $dbName $adminUser $adminPassword

  $before = Run-Sql "SELECT CASE WHEN EXISTS(SELECT 1 FROM pg_roles WHERE rolname='suzuki_hp_reader' AND rolcanlogin=false) AND has_function_privilege('suzuki_hp_reader','private.suzuki_hp_snapshot()','EXECUTE') AND NOT has_table_privilege('suzuki_hp_reader','public.communities','SELECT') THEN 'PASS' ELSE 'FAIL' END;"
  if ($before -ne 'PASS') { throw 'Database preflight failed: expected NOLOGIN least-privilege role.' }

  $bytes = New-Object byte[] 48
  $rng=[Security.Cryptography.RandomNumberGenerator]::Create()
  try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
  $readerPassword = [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+','-').Replace('/','_')
  [Array]::Clear($bytes,0,$bytes.Length)

  Run-Sql "ALTER ROLE suzuki_hp_reader WITH LOGIN PASSWORD '$readerPassword';" | Out-Null
  $roleEnabled = $true

  Set-PgEnvironment $url.Host $port $dbName $readerUser $readerPassword
  $check = Run-Sql "SELECT CASE WHEN current_user='suzuki_hp_reader' AND has_function_privilege(current_user,'private.suzuki_hp_snapshot()','EXECUTE') AND NOT has_table_privilege(current_user,'public.communities','SELECT') AND NOT has_table_privilege(current_user,'public.communities','INSERT') AND NOT has_table_privilege(current_user,'public.communities','UPDATE') AND NOT has_table_privilege(current_user,'public.communities','DELETE') AND private.suzuki_hp_snapshot()->>'snapshotReady'='true' THEN 'PASS' ELSE 'FAIL' END;"
  if ($check -ne 'PASS') { throw 'Least-privilege actual-login test failed.' }

  $hostPart = if ($url.Host.Contains(':')) { '['+$url.Host+']' } else { $url.Host }
  $encodedUser=[Uri]::EscapeDataString($readerUser)
  $encodedPass=[Uri]::EscapeDataString($readerPassword)
  $encodedDb=[Uri]::EscapeDataString($dbName)
  $readerUrl = "postgresql://${encodedUser}:${encodedPass}@${hostPart}:${port}/${encodedDb}?sslmode=require"

  # Stream the secret into gh directly; do not put it in arguments, files or history.
  $start = New-Object System.Diagnostics.ProcessStartInfo
  $start.FileName = $ghCommand.Source
  $start.Arguments = "secret set $SecretName --repo $Repo"
  $start.UseShellExecute = $false
  $start.RedirectStandardInput = $true
  $start.RedirectStandardOutput = $true
  $start.RedirectStandardError = $true
  $start.CreateNoWindow = $true
  $p = [System.Diagnostics.Process]::Start($start)
  try {
    $p.StandardInput.Write($readerUrl)
    $p.StandardInput.Close()
    $p.WaitForExit()
    if ($p.ExitCode -ne 0) { throw 'GitHub Secret registration failed.' }
  } finally { $p.Dispose() }

  $completed = $true
  Write-Host 'RESULT=PASS'
  Write-Host 'DB_READER=LOGIN_OK_READONLY'
  Write-Host 'GITHUB_SECRET=REGISTERED'
  Write-Host 'PRODUCTION_SCHEDULE=NOT_STARTED'
} catch {
  Write-Host 'RESULT=BLOCKED'
  Write-Host ('REASON=' + $_.Exception.Message)
} finally {
  if ($roleEnabled -and -not $completed) {
    try {
      if ($adminUriText) {
        Set-PgEnvironment $url.Host $port $dbName $adminUser $adminPassword
        Run-Sql 'ALTER ROLE suzuki_hp_reader NOLOGIN;' | Out-Null
        Write-Host 'ROLLBACK=READER_LOGIN_DISABLED'
      }
    } catch {
      Write-Host 'ROLLBACK=MANUAL_VERIFICATION_REQUIRED'
    }
  }
  foreach ($name in $originalPgEnv.Keys) {
    [Environment]::SetEnvironmentVariable($name,$originalPgEnv[$name],'Process')
  }
  $readerPassword=$null; $readerUrl=$null; $adminPassword=$null; $adminUriText=$null
}
if (-not $completed) { exit 1 }

  if (-not ($isDirect -or $isPooler)) {
    throw 'The admin URI host is not an approved CA Clover Supabase DB endpoint.'
  }
  $pair = $url.UserInfo.Split(':',2)
  if ($pair.Length -ne 2) { throw 'The admin URI must contain its own username and password.' }
  $adminUser = [Uri]::UnescapeDataString($pair[0])
  $adminPassword = [Uri]::UnescapeDataString($pair[1])
  $port = if ($url.Port -gt 0) { [string]$url.Port } else { '5432' }
  $dbName = [Uri]::UnescapeDataString($url.AbsolutePath.TrimStart('/'))
  if (-not $dbName) { $dbName='postgres' }
  if ($adminUser -notmatch '^postgres(\.[a-z0-9]+)?$') {
    throw 'Use the dedicated Supabase postgres admin connection. No other admin user is allowed.'
  }
  $readerUser = if ($adminUser.Contains('.')) {
    'suzuki_hp_reader.' + $adminUser.Split('.',2)[1]
  } else { 'suzuki_hp_reader' }
  Set-PgEnvironment $url.Host $port $dbName $adminUser $adminPassword

  $before = Run-Sql "SELECT CASE WHEN EXISTS(SELECT 1 FROM pg_roles WHERE rolname='suzuki_hp_reader' AND rolcanlogin=false) AND has_function_privilege('suzuki_hp_reader','private.suzuki_hp_snapshot()','EXECUTE') AND NOT has_table_privilege('suzuki_hp_reader','public.communities','SELECT') THEN 'PASS' ELSE 'FAIL' END;"
  if ($before -ne 'PASS') { throw 'Database preflight failed: expected NOLOGIN least-privilege role.' }

  $bytes = New-Object byte[] 48
  $rng=[Security.Cryptography.RandomNumberGenerator]::Create()
  try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
  $readerPassword = [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+','-').Replace('/','_')
  [Array]::Clear($bytes,0,$bytes.Length)

  Run-Sql "ALTER ROLE suzuki_hp_reader WITH LOGIN PASSWORD '$readerPassword';" | Out-Null
  $roleEnabled = $true

  Set-PgEnvironment $url.Host $port $dbName $readerUser $readerPassword
  $check = Run-Sql "SELECT CASE WHEN current_user='suzuki_hp_reader' AND has_function_privilege(current_user,'private.suzuki_hp_snapshot()','EXECUTE') AND NOT has_table_privilege(current_user,'public.communities','SELECT') AND NOT has_table_privilege(current_user,'public.communities','INSERT') AND NOT has_table_privilege(current_user,'public.communities','UPDATE') AND NOT has_table_privilege(current_user,'public.communities','DELETE') AND private.suzuki_hp_snapshot()->>'snapshotReady'='true' THEN 'PASS' ELSE 'FAIL' END;"
  if ($check -ne 'PASS') { throw 'Least-privilege actual-login test failed.' }

  $hostPart = if ($url.Host.Contains(':')) { '['+$url.Host+']' } else { $url.Host }
  $encodedUser=[Uri]::EscapeDataString($readerUser)
  $encodedPass=[Uri]::EscapeDataString($readerPassword)
  $encodedDb=[Uri]::EscapeDataString($dbName)
  $readerUrl = "postgresql://${encodedUser}:${encodedPass}@${hostPart}:${port}/${encodedDb}?sslmode=require"

  # Stream the secret into gh directly; do not put it in arguments, files or history.
  $start = New-Object System.Diagnostics.ProcessStartInfo
  $start.FileName = $ghCommand.Source
  $start.Arguments = "secret set $SecretName --repo $Repo"
  $start.UseShellExecute = $false
  $start.RedirectStandardInput = $true
  $start.RedirectStandardOutput = $true
  $start.RedirectStandardError = $true
  $start.CreateNoWindow = $true
  $p = [System.Diagnostics.Process]::Start($start)
  try {
    $p.StandardInput.Write($readerUrl)
    $p.StandardInput.Close()
    $p.WaitForExit()
    if ($p.ExitCode -ne 0) { throw 'GitHub Secret registration failed.' }
  } finally { $p.Dispose() }

  $completed = $true
  Write-Host 'RESULT=PASS'
  Write-Host 'DB_READER=LOGIN_OK_READONLY'
  Write-Host 'GITHUB_SECRET=REGISTERED'
  Write-Host 'PRODUCTION_SCHEDULE=NOT_STARTED'
} catch {
  Write-Host 'RESULT=BLOCKED'
  Write-Host ('REASON=' + $_.Exception.Message)
} finally {
  if ($roleEnabled -and -not $completed) {
    try {
      if ($adminUriText) {
        Set-PgEnvironment $url.Host $port $dbName $adminUser $adminPassword
        Run-Sql 'ALTER ROLE suzuki_hp_reader NOLOGIN;' | Out-Null
        Write-Host 'ROLLBACK=READER_LOGIN_DISABLED'
      }
    } catch {
      Write-Host 'ROLLBACK=MANUAL_VERIFICATION_REQUIRED'
    }
  }
  foreach ($name in $originalPgEnv.Keys) {
    [Environment]::SetEnvironmentVariable($name,$originalPgEnv[$name],'Process')
  }
  $readerPassword=$null; $readerUrl=$null; $adminPassword=$null; $adminUriText=$null
}
if (-not $completed) { exit 1 }
