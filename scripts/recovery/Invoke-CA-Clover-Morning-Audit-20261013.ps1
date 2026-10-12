# CA Clover | morning local-only audit | 2026-10-13
# Read-only local restored PostgreSQL; GitHub public metadata only.
# NEVER connects to Supabase production; NEVER syncs/deploys/merges.
$ErrorActionPreference = 'Stop'
$Lab = 'ca-clover-supabase-restore-20261012'
$Db = 'postgres'
$OutDir = 'C:\CA-Clover-Restore-Test\morning-audit-20261013'
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$Stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$Report = Join-Path $OutDir "report-$Stamp.txt"
$Errors = @()
function Report([string]$s) { $s | Tee-Object -FilePath $Report -Append }
function LocalSql([string]$sql) {
  $out = $sql | docker exec -i -u postgres $Lab psql -X -v ON_ERROR_STOP=1 -U supabase_admin -d $Db -At 2>&1
  if ($LASTEXITCODE -ne 0) { throw "LOCAL SQL failed: $($out -join ' ')" }
  return @($out)
}
Report 'CA CLOVER MORNING AUDIT 2026-10-13'
Report 'PRODUCTION: NO ACCESS / NO WRITES'
$LocalOK = $false
try {
  $inspect = docker inspect $Lab --format '{{.Config.Image}}|{{.State.Running}}|{{json .HostConfig.PortBindings}}' 2>&1
  if ($LASTEXITCODE -ne 0) { throw "Missing restore container" }
  $parts = "$inspect".Split('|')
  if ($parts.Count -ne 3 -or $parts[0] -ne 'public.ecr.aws/supabase/postgres:17.11.0.004' -or $parts[1] -ne 'true') {
    throw 'Restore container image/state mismatch'
  }
  if ($parts[2] -ne 'null' -and $parts[2] -ne '{}') { throw 'Restore container exposes ports; stop' }
  $identity = LocalSql "BEGIN READ ONLY; SELECT current_database() || '|' || coalesce(inet_server_addr()::text,'socket'); COMMIT;"
  if ($identity -notcontains 'postgres|socket') { throw "Unexpected local database/socket: $($identity -join ',')" }
  $LocalOK = $true
  Report 'LOCAL_TARGET_CHECK=PASS'
} catch { $Errors += "TARGET: $($_.Exception.Message)"; Report 'LOCAL_TARGET_CHECK=STOP' }
if ($LocalOK) {
  try {
    $sql = @'
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY;
SELECT 'auth_users',count(*) FROM auth.users
UNION ALL SELECT 'auth_identities',count(*) FROM auth.identities
UNION ALL SELECT 'ca_identities',count(*) FROM public.user_ca_identities
UNION ALL SELECT 'medals',count(*) FROM public.stamp_collections
UNION ALL SELECT 'medal_designs',count(*) FROM public.stamp_collection_designs
UNION ALL SELECT 'exchange_sessions',count(*) FROM public.stamp_exchange_sessions
UNION ALL SELECT 'storage_metadata',count(*) FROM storage.objects
ORDER BY 1;
SELECT 'orphan_ca_identities',count(*) FROM public.user_ca_identities i
LEFT JOIN public.community_ca_members m ON i.community_id=m.community_id AND i.ca_member_id=m.ca_member_id
WHERE m.id IS NULL;
SELECT 'orphan_medal_refs',count(*) FROM public.stamp_collections s
LEFT JOIN auth.users u ON u.id=s.owner_user_id
LEFT JOIN public.ca_members m ON m.id=s.stamp_ca_member_id
LEFT JOIN public.communities c ON c.id=s.community_id
WHERE u.id IS NULL OR m.id IS NULL OR c.id IS NULL
UNION ALL SELECT 'orphan_designs',count(*) FROM public.stamp_collection_designs d
LEFT JOIN public.stamp_collections s ON s.id=d.collection_id WHERE s.id IS NULL
UNION ALL SELECT 'duplicate_primary',count(*) FROM
(SELECT user_id FROM public.user_ca_identities WHERE is_primary IS TRUE GROUP BY user_id HAVING count(*)>1) x
UNION ALL SELECT 'unvalidated_fk',count(*) FROM pg_constraint WHERE contype='f'
AND connamespace IN ('auth'::regnamespace,'storage'::regnamespace,'public'::regnamespace)
AND convalidated IS NOT TRUE;
COMMIT;
'@
    # Actual exchange-session relation name is checked before running the aggregate.
    $names = LocalSql "BEGIN READ ONLY; SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename LIKE '%exchange%'; COMMIT;"
    $exchange = @($names | Where-Object { $_ -like '*exchange*' })
    if ($exchange -notcontains 'stamp_exchange_sessions') { throw "Exchange table name needs review: $($exchange -join ',')" }
    $out = LocalSql $sql
    $expect = @('auth_users|7','auth_identities|7','ca_identities|7','medals|14','medal_designs|14','exchange_sessions|20','storage_metadata|418','orphan_ca_identities|0','orphan_medal_refs|0','orphan_designs|0','duplicate_primary|0','unvalidated_fk|0')
    foreach ($line in $out) { Report "DATA $line" }
    if (@($expect | Where-Object { $out -notcontains $_ }).Count -gt 0) { throw 'Expected counts/integrity mismatch' }
    Report 'STEP_1_INTEGRITY=PASS'
  } catch { $Errors += "INTEGRITY: $($_.Exception.Message)"; Report 'STEP_1_INTEGRITY=REVIEW' }
  try {
    $sql = @'
BEGIN READ ONLY;
SELECT 'identity_fk_action',CASE confdeltype WHEN 'r' THEN 'RESTRICT' WHEN 'c' THEN 'CASCADE' ELSE confdeltype::text END
FROM pg_constraint WHERE conrelid='public.user_ca_identities'::regclass
AND conname='user_ca_identities_community_id_ca_member_id_fkey';
SELECT 'dedicated_master_gate',CASE WHEN EXISTS(
SELECT 1 FROM information_schema.columns WHERE table_schema='public'
AND table_name='sync_automation_state' AND column_name='ca_master_sync_enabled'
) THEN 'PRESENT' ELSE 'MISSING' END;
SELECT 'master_pause',CASE WHEN last_ca_master_at > now()+interval '365 days' THEN 'PAUSED' ELSE 'NOT_PAUSED' END
FROM public.sync_automation_state WHERE id=1;
COMMIT;
'@
    $out=LocalSql $sql
    foreach ($line in $out) { Report "GUARD $line" }
    if ($out -contains 'identity_fk_action|RESTRICT' -and $out -contains 'dedicated_master_gate|PRESENT' -and $out -contains 'master_pause|PAUSED') {
      Report 'STEP_2_PROTECTION_STATIC=PASS'
    } else {
      Report 'STEP_2_PROTECTION_STATIC=STOP_UNSAFE_BASELINE'
    }
    Report 'STEP_2_DELETION_SIMULATION=NOT_RUN (no destructive operations performed)'
  } catch { $Errors += "PROTECTION: $($_.Exception.Message)"; Report 'STEP_2_PROTECTION_STATIC=REVIEW' }
}
try {
  foreach ($n in @(128,130,131)) {
    $uri = "https://api.github.com/repos/Kaityo1221/ca-clover/pulls/$n"
    $pr = Invoke-RestMethod -Uri $uri -Headers @{Accept='application/vnd.github+json';'User-Agent'='ca-clover-morning-audit'} -TimeoutSec 20
    Report "PR#$n state=$($pr.state) draft=$($pr.draft) merged=$($pr.merged) base=$($pr.base.ref) head=$($pr.head.sha)"
    $runs = Invoke-RestMethod -Uri ("https://api.github.com/repos/Kaityo1221/ca-clover/actions/runs?head_sha="+$pr.head.sha+"&per_page=30") -Headers @{Accept='application/vnd.github+json';'User-Agent'='ca-clover-morning-audit'} -TimeoutSec 20
    $selected = @($runs.workflow_runs | Where-Object { $_.head_sha -eq $pr.head.sha -and $_.event -eq 'pull_request' })
    if ($selected.Count -eq 0) { Report "PR#$n CI=NOT_FOUND_OR_NOT_VISIBLE" }
    foreach($run in $selected) { Report "PR#$n CI $($run.name) status=$($run.status) conclusion=$($run.conclusion)" }
  }
  Report 'STEP_3_GITHUB_QUERY=PASS (not a CI success guarantee)'
} catch { $Errors += "GITHUB: $($_.Exception.Message)"; Report 'STEP_3_GITHUB_QUERY=REVIEW' }
if ($Errors.Count -gt 0) { foreach ($e in $Errors) { Report "ERROR $e" } }
Report 'MORNING_AUDIT_FINISHED (review results before any production operation)'
Report "REPORT_PATH=$Report"
