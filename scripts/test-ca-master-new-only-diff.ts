import assert from "node:assert/strict";
import {compareCaMasterNewOnly,formatCaMasterDiffReport} from "../src/lib/ca-master-new-only-diff.ts";
import type {CaMasterRecord} from "../src/lib/ca-master.ts";
const id1="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const id2="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const id3="cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const make=(name:string,id:string|null,status="🆕"):CaMasterRecord=>({
  sourceKey:name.toLowerCase(),trainerName:name,caLevel:"1st",
  communityName:"Community "+name,campfireUrl:"",communityId:id,
  prefecture:"北海道",joinDate:"2026-11-09",status,latitude:40,longitude:140,
});
const existing=[{source_key:"oldca",trainer_name:"OldCA",ca_level:"1st",prefecture:"北海道",join_date:"2025-11-09",status:"active"},
{source_key:"cloveronly",trainer_name:"CloverOnly",ca_level:"1st",prefecture:"北海道",join_date:"2024-11-09",status:"active"}];
const source=[make("OldCA",id1),make("NewOne",id2),make("Retired",id3,"🏝️ Inactive")];
source[0].joinDate="2026-11-09";
let report=compareCaMasterNewOnly(source,existing,[],[],true);
assert.deepEqual(report.newCandidates.map(x=>x.trainerName),["NewOne"]);
assert.equal(report.existingDifferences.length,1);
assert.equal(report.inactiveUnregistered.length,1);
assert.deepEqual(report.cloverOnly.map(x=>x.trainerName),["CloverOnly"]);
assert.equal(report.holds.length,0);
assert.ok(formatCaMasterDiffReport(report,"公式タブ","2026-11-13T00:00:00Z").includes("既存CA・所属・権限の変更"));

report=compareCaMasterNewOnly(source,existing,[],[],false);
assert.equal(report.newCandidates.length,0);
assert.ok(report.holds[0].reason.includes("旧Campfire ID"));

report=compareCaMasterNewOnly([make("NewOne",id2),make("NewOne",id2)],[],[],[],true);
assert.equal(report.newCandidates.length,0);
assert.equal(report.holds.length,2);

report=compareCaMasterNewOnly([make("NewOne",id2)],[],[{name:"Other",prefecture:"北海道",campfire_community_id:id2}],[],true);
assert.equal(report.newCandidates.length,0);
assert.ok(report.holds[0].reason.includes("既存コミュニティ"));

report=compareCaMasterNewOnly([make("NewOne",id2)],[],[],[{campfire_community_id:id2,status:"retired"}],true);
assert.equal(report.newCandidates.length,0);
assert.ok(report.holds[0].reason.includes("過去ID"));

report=compareCaMasterNewOnly([make("NewOne",id2,"")],[],[],[],true);
assert.equal(report.newCandidates.length,0);
report=compareCaMasterNewOnly([make("NewOne",null)],[],[],[],true);
assert.equal(report.newCandidates.length,0);

const second=make("Second",id2);
second.caLevel="2nd";
report=compareCaMasterNewOnly([second],[],[],[],true);
assert.equal(report.newCandidates.length,0);

const sameId=[make("First",id2),make("Second",id2)];
report=compareCaMasterNewOnly(sameId,[],[],[],true);
assert.equal(report.newCandidates.length,0);
assert.equal(report.holds.length,2);
console.log("PASS: 11 new-only CA master diff cases, existing records never mutated");
