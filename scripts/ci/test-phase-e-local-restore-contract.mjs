import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const ps=readFileSync("scripts/recovery/Validate-CA-Clover-Restored-Local.ps1","utf8");
const sql=readFileSync("scripts/recovery/phase-e-restored-local-readonly-audit.sql","utf8");
for(const check of [
  "docker inspect --type container", "NetworkMode", "HostConfig.PortBindings",
  "Start-Process", "phase-e-restored-local-readonly-audit.sql",
  "AUDIT_LOCAL_PASS|12_TABLES|COUNTS_AND_FINGERPRINTS"
]) assert.ok(ps.includes(check),"Missing local-only preflight: "+check);
assert.match(ps,/Container -cnotmatch/);
assert.match(ps,/\[ValidateSet\("\/tmp","\/var\/run\/postgresql"\)\]/);
assert.match(ps,/\[ValidateSet\("postgres","ca_master_restore_qa"\)\]/);
assert.match(sql,/BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY;/);
assert.match(sql,/inet_server_addr\(\) IS NOT NULL/);
assert.match(sql,/current_database\(\) NOT IN \('postgres','ca_master_restore_qa'\)/);
assert.match(sql,/ca_master_sync_enabled IS FALSE/);
assert.match(sql,/2099-01-01/);
assert.match(sql,/confdeltype='r' AND convalidated AND NOT condeferrable/);
assert.match(sql,/sha256\(convert_to/);
assert.match(sql,/AUDIT_LOCAL_PASS\|12_TABLES\|COUNTS_AND_FINGERPRINTS/);
for (const needle of ["auth.users","auth.identities","public.profiles",
"public.ca_members","public.communities","public.community_ca_members",
"public.user_ca_identities","public.stamp_collections",
"public.stamp_collection_designs","public.stamp_exchange_sessions",
"public.sync_automation_state","storage.objects"]) assert.ok(sql.includes(needle),needle);
const withoutComments=sql.replace(/^\s*--[^\n]*$/gm,"");
assert.doesNotMatch(withoutComments,/^\s*(?:CREATE|ALTER|DROP|TRUNCATE|INSERT|UPDATE|DELETE|COPY|GRANT|REVOKE|CALL|VACUUM)\b/im);
assert.doesNotMatch(ps,/\b(?:Invoke-Sqlcmd|Invoke-RestMethod|Invoke-WebRequest|pg_restore|pg_dump|supabase\s+db\s+(?:reset|push))\b/i);
console.log("PHASE_E_LOCAL_RESTORE_CONTRACT_STATIC_PASS: local-only, READ ONLY, no restore/network commands");

assert.match(ps,/"exec",\s*"-i",\s*"-u",\s*"postgres",\s*\$Container,\s*"psql"/);
assert.match(ps,/"-U",\s*\$DbUser,\s*"-h",\s*\$SocketDir,\s*"-d",\s*\$Database/);
assert.match(ps,/Start-Process -FilePath "docker\.exe"/);
assert.match(ps,/RedirectStandardInput \$inputFile/);
assert.match(ps,/RedirectStandardOutput \$outFile/);
assert.match(ps,/RedirectStandardError \$errFile/);
assert.match(ps,/if \(\$exit -ne 0\).*throw/);

// Keep the Windows path-race regression in the synthetic-only CI job.
for (const check of ["AuditDirectoryLease", "CreateFileW(current, 0x81, 1",
  "GetFileInformationByHandle", "0x400", "GetFinalPathNameByHandleW",
  "physical path mismatch", "FileMode]::CreateNew", "FileShare]::None",
  "AssertFinalPath($stream.SafeFileHandle", "Directory.CreateDirectory(current, acl)"])
  assert.ok(ps.includes(check), "Missing report path safeguard: " + check);
assert.ok(ps.indexOf('$reportLease=Open-PrivateAuditDirectory') < ps.indexOf('$process = Start-Process'));
assert.ok(ps.includes('if ($null -ne $reportLease) { $reportLease.Dispose() }'));
const workflow=readFileSync('.github/workflows/ca-master-integration-off-qa.yml','utf8');
assert.ok(workflow.includes('test-phase-e-report-paths.ps1'));
console.log("PHASE_E_REPORT_PATH_CONTRACT_PASS");
