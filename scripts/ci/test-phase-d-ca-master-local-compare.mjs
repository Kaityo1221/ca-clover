// Synthetic CSV + local-only PowerShell parser test.
// No production IDs, no Supabase credentials, no database or network access.
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {mkdtempSync,rmSync,writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
const d=mkdtempSync(join(tmpdir(),"ca-master-source-fixture-"));
try{
  const uuid1="10000000-0000-4000-8000-000000000001";
  const uuid2="10000000-0000-4000-8000-000000000002";
  const deep=id=>"https://campfire.onelink.me/eBr8?af_dp=a&deep_link_sub1="+Buffer.from("c="+id).toString("base64");
  const header=["Status","PGO Trainer Name","2nd CA","Discord Name","",
    "Discord Icon","Campfire Group Name","Campfire URL","Primary City",
    "Lng 緯度","Lat 経度","CA Join date","自己紹介"];
  const make=(status,name,group,url)=>[
    status,name,"","","","",group,url,"13_東京都","35.7","139.7","","",
  ];
  const records=[
    header,make("","TESTCA001","Alpha",deep(uuid1)),
    make("🏝️ Inactive","TESTCA002","Beta",deep(uuid1)),
    make("🔰","TESTCA003","Alpha",deep(uuid2)),
    make("🆕","TESTCA004","Alpha",""),
  ];
  const csv=records.map(a=>a.join(",")).join("\r\n")+"\r\n";
  const file=join(d,"fixture.csv");writeFileSync(file,csv,"utf8");
  const result=spawnSync("pwsh",["-NoProfile","-NonInteractive","-File",
    "scripts/phase-d-compare-ca-master-local.ps1","-CsvPath",file,"-SheetOnly"],{
    encoding:"utf8",timeout:30000,
  });
  assert.equal(result.status,0,"Synthetic sheet-only compare must succeed: "+result.stderr);
  const output=result.stdout;
  for(const expected of [
    "sheet_rows=4",
    "sheet_unique_ca_keys=4",
    "sheet_unique_community_ids=2",
    "sheet_resolved_pairs=3",
    "sheet_missing_id_rows=5",
    "sheet_duplicate_ca_keys=0",
    "sheet_community_id_identity_conflicts=1",
    "sheet_name_pref_id_conflicts=1",
    "sheet_blank_status=1",
    "sheet_inactive_status=1",
    "sheet_other_status=2",
    "result=SHEET_ONLY_REVIEW",
  ]) assert.ok(output.includes(expected),"Missing "+expected+" in "+output);
  console.log("Phase D local CSV parser synthetic fixture: PASS (12 assertions, no DB/net)");
}finally{rmSync(d,{recursive:true,force:true});}
