# CA Clover Phase D: local-only, read-only CSV versus restored DB audit.
# Prints counts / Sheet row numbers. Never prints CA names, UUIDs, or credentials.
[CmdletBinding()]
param([string]$CsvPath = '', [switch]$SheetOnly)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$container = 'supabase_db_CA-Clover-Restore-Test'
$sourceUrl = 'https://docs.google.com/spreadsheets/d/1BtPjOxNX4JhttKKJa_-qrIXdVmK5UsbAX-RcLmLTuwk/export?format=csv&gid=633821294'

function CommunityId([string]$url) {
  if ([string]::IsNullOrWhiteSpace($url)) { return $null }
  $m = [regex]::Match($url, '[?&]clubId=([0-9a-fA-F-]{36})(?:&|$)')
  if ($m.Success) { return $m.Groups[1].Value.ToLowerInvariant() }
  $m = [regex]::Match($url, '[?&]deep_link_sub1=([^&#]+)')
  if (-not $m.Success) { return $null }
  try {
    $encoded = [Uri]::UnescapeDataString($m.Groups[1].Value)
    $encoded = $encoded.Replace('-', '+').Replace('_', '/')
    $encoded += '=' * ((4 - $encoded.Length % 4) % 4)
    $decoded = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($encoded))
    $id = [regex]::Match($decoded, '(?:^|[?&])c=([0-9a-fA-F-]{36})(?:&|$)')
    if ($id.Success) { return $id.Groups[1].Value.ToLowerInvariant() }
  } catch { return $null }
  return $null
}
function NewSet { return ,([Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)) }
function DifferenceCount($a,$b) {
  $count = 0
  foreach ($v in $a) { if (-not $b.Contains($v)) { $count++ } }
  return $count
}
function PrintStat([string]$key,$value) { Write-Output ("{0}={1}" -f $key,$value) }

$tempCsv = $null
try {
  if (-not $CsvPath) {
    $tempCsv = Join-Path ([IO.Path]::GetTempPath()) ('ca-clover-source-' + [guid]::NewGuid().ToString('N') + '.csv')
    try {
      Invoke-WebRequest -Uri $sourceUrl -UseBasicParsing -TimeoutSec 45 -OutFile $tempCsv
    } catch {
      throw 'Sheet CSV download failed. Export gid=633821294 manually, then use -CsvPath. Do NOT use an outdated tab.'
    }
    $CsvPath = $tempCsv
  }
  if (-not (Test-Path -LiteralPath $CsvPath -PathType Leaf)) { throw 'CSV file not found.' }
  $csv = @(Import-Csv -LiteralPath $CsvPath -Encoding UTF8)
  if ($csv.Count -eq 0) { throw 'CSV empty: comparison refused.' }
  $headers = @($csv[0].PSObject.Properties.Name)
  foreach ($col in @('Status','PGO Trainer Name','Campfire Group Name','Campfire URL','Primary City')) {
    if ($headers -notcontains $col) { throw ("Missing CSV column: " + $col) }
  }
  $rows = @()
  for ($i=0; $i -lt $csv.Count; $i++) {
    $row = $csv[$i]
    $name = ([string]$row.'PGO Trainer Name').Trim()
    $group = ([string]$row.'Campfire Group Name').Trim()
    $city = ([string]$row.'Primary City').Trim()
    $pref = $city -replace '^\d{2}_',''
    if (-not $name -or -not $group -or -not $pref) {
      throw ("Missing required data in CSV row " + ($i+2))
    }
    $rows += [pscustomobject]@{
      Row = $i + 2
      Key = $name.ToLowerInvariant()
      ClubId = CommunityId ([string]$row.'Campfire URL')
      Identity = $pref + [char]0 + $group
      Status = ([string]$row.Status).Trim()
    }
  }

  $sheetKeys = NewSet
  $sheetIds = NewSet
  $sheetPairs = NewSet
  $missingRows = @()
  $idIdentity = @{}
  $identityIds = @{}
  $duplicates=0
  foreach ($r in $rows) {
    if (-not $sheetKeys.Add($r.Key)) { $duplicates++ }
    if (-not $r.ClubId) { $missingRows += $r.Row; continue }
    [void]$sheetIds.Add($r.ClubId)
    [void]$sheetPairs.Add($r.Key+'|'+$r.ClubId)
    if (-not $idIdentity.ContainsKey($r.ClubId)) { $idIdentity[$r.ClubId]=NewSet }
    [void]$idIdentity[$r.ClubId].Add($r.Identity)
    if (-not $identityIds.ContainsKey($r.Identity)) { $identityIds[$r.Identity]=NewSet }
    [void]$identityIds[$r.Identity].Add($r.ClubId)
  }
  $idConflict = 0
  foreach ($group in $idIdentity.Values) { if ($group.Count -gt 1) { $idConflict++ } }
  $nameConflict = 0
  foreach ($group in $identityIds.Values) { if ($group.Count -gt 1) { $nameConflict++ } }
  $blankStatus = @($rows | Where-Object {$_.Status -eq ''}).Count
  $inactiveStatus = @($rows | Where-Object {$_.Status -match '(?i)inactive|retired|suspended|休止|停止|卒業|退任|終了'}).Count
  PrintStat 'sheet_rows' $rows.Count
  PrintStat 'sheet_unique_ca_keys' $sheetKeys.Count
  PrintStat 'sheet_unique_community_ids' $sheetIds.Count
  PrintStat 'sheet_resolved_pairs' $sheetPairs.Count
  PrintStat 'sheet_missing_id_rows' ($missingRows -join ',')
  PrintStat 'sheet_duplicate_ca_keys' $duplicates
  PrintStat 'sheet_community_id_identity_conflicts' $idConflict
  PrintStat 'sheet_name_pref_id_conflicts' $nameConflict
  PrintStat 'sheet_blank_status' $blankStatus
  PrintStat 'sheet_inactive_status' $inactiveStatus
  PrintStat 'sheet_other_status' ($rows.Count-$blankStatus-$inactiveStatus)
  if ($SheetOnly) { PrintStat 'result' 'SHEET_ONLY_REVIEW'; return }

  # SQL is fixed and SELECT-only. docker exec uses local PostgreSQL Unix socket.
  $sql = @'
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY;
SELECT 1/CASE WHEN inet_server_addr() IS NULL THEN 1 ELSE 0 END;
SELECT 'CA'||chr(9)||lower(source_key) FROM public.ca_members
UNION ALL
SELECT 'CO'||chr(9)||coalesce(campfire_community_id,'') FROM public.communities
UNION ALL
SELECT 'LINK'||chr(9)||lower(a.source_key)||chr(9)||coalesce(c.campfire_community_id,'')
FROM public.community_ca_members l
JOIN public.ca_members a ON a.id=l.ca_member_id
JOIN public.communities c ON c.id=l.community_id
UNION ALL
SELECT 'ALIAS'||chr(9)||lower(a.source_key)||chr(9)||h.campfire_community_id
FROM public.community_ca_members l
JOIN public.ca_members a ON a.id=l.ca_member_id
JOIN public.community_campfire_ids h ON h.community_id=l.community_id;
COMMIT;
'@
  $lines = @($sql | & docker exec -i $container psql -X -q -A -t -v ON_ERROR_STOP=1 -U postgres -d postgres)
  if ($LASTEXITCODE -ne 0) { throw 'Local restored database read failed. Never substitute production database.' }
  if ($lines -notcontains '1') { throw 'Local Unix socket guarantee not proven.' }
  $dbKeys = NewSet
  $dbIds = NewSet
  $dbDirectPairs = NewSet
  $dbAllPairs = NewSet
  $dbAliasIds = NewSet
  foreach ($line in $lines) {
    $parts = ([string]$line).Split([char]9)
    if ($parts.Count -lt 2) { continue }
    if ($parts[0] -eq 'CA') { [void]$dbKeys.Add($parts[1]); continue }
    if ($parts[0] -eq 'CO') {
      if ($parts[1]) { [void]$dbIds.Add($parts[1]) }
      continue
    }
    if ($parts.Count -lt 3) { continue }
    $pair = $parts[1]+'|'+$parts[2]
    if ($parts[0] -eq 'LINK') {
      [void]$dbDirectPairs.Add($pair)
      if ($parts[2]) { [void]$dbAllPairs.Add($pair) }
      continue
    }
    if ($parts[0] -eq 'ALIAS') {
      [void]$dbAliasIds.Add($parts[2])
      [void]$dbAllPairs.Add($pair)
    }
  }
  $knownIds = NewSet
  foreach ($v in $dbIds) { [void]$knownIds.Add($v) }
  foreach ($v in $dbAliasIds) { [void]$knownIds.Add($v) }
  $newCa = DifferenceCount $sheetKeys $dbKeys
  $oldCa = DifferenceCount $dbKeys $sheetKeys
  $unmappedIds = DifferenceCount $sheetIds $knownIds
  $notInDb = DifferenceCount $sheetPairs $dbAllPairs
  PrintStat 'db_unique_ca_keys' $dbKeys.Count
  PrintStat 'db_current_community_ids' $dbIds.Count
  PrintStat 'db_current_link_pairs' $dbDirectPairs.Count
  PrintStat 'db_historical_community_ids' $dbAliasIds.Count
  PrintStat 'sheet_ca_missing_in_db' $newCa
  PrintStat 'db_ca_missing_in_sheet' $oldCa
  PrintStat 'sheet_ids_not_mapped_in_db' $unmappedIds
  PrintStat 'sheet_pairs_not_mapped_to_db_links' $notInDb
  PrintStat 'db_current_pairs_not_in_sheet' (DifferenceCount $dbDirectPairs $sheetPairs)
  if ($duplicates -gt 0 -or $missingRows.Count -gt 0 -or $idConflict -gt 0 -or
      $nameConflict -gt 0 -or $newCa -gt 0 -or $oldCa -gt 0 -or
      $unmappedIds -gt 0 -or $notInDb -gt 0) {
    PrintStat 'result' 'REVIEW_REQUIRED_SYNC_STOP'
  } else {
    PrintStat 'result' 'KEYS_MATCH_BUT_PREFLIGHT_STILL_REQUIRED'
  }
} finally {
  # Only the temporary file created by this script is removed; backups untouched.
  if ($tempCsv -and (Test-Path -LiteralPath $tempCsv)) {
    Remove-Item -LiteralPath $tempCsv -Force
  }
}
