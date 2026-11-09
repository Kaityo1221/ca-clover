import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyFullRosterBytes} from '../../docs/participant-export/full-roster-validate.mjs';
const headers=['username','display_name','rsvp_status','checked_in'];
const cell=x=>'"'+String(x).replace(/"/g,'""')+'"';
const csv=(rows,overrideHeaders=headers)=>new TextEncoder().encode('\uFEFF'+[overrideHeaders,...rows].map(fields=>fields.map(cell).join(',')).join('\r\n')+'\r\n');
const sample=[['abc','名前','CHECKED_IN','TRUE'],['def','山田,さん\n二行目','ACCEPTED','FALSE'],['ghi','引用"テスト','DECLINED','FALSE']];
test('valid 4-column UTF-8 BOM CSV, escaped commas, quotes and embedded newline',()=>{
 const result=verifyFullRosterBytes(csv(sample),3);
 assert.deepEqual(result,{count:3,checkedInCount:1,unresolvedCount:0});
});
test('header-only never counts as valid participants',()=>{
 assert.throws(()=>verifyFullRosterBytes(csv([]),1),/COUNT_MISMATCH/);
 assert.throws(()=>verifyFullRosterBytes(csv([]),0),/INVALID_SIZE/);
});
test('server count 89 cannot hide one missing row',()=>{
 assert.throws(()=>verifyFullRosterBytes(csv(sample),89),/COUNT_MISMATCH/);
});
test('malformed or reordered columns rejected',()=>{
 assert.throws(()=>verifyFullRosterBytes(csv(sample,['display_name','username','rsvp_status','checked_in']),3),/HEADERS/);
 assert.throws(()=>verifyFullRosterBytes(csv(sample.map(row=>row.slice(0,3))),3),/COLUMNS/);
});
test('invalid RSVP or checked-in mismatch rejected',()=>{
 assert.throws(()=>verifyFullRosterBytes(csv([['abc','表示','UNKNOWN','FALSE']]),1),/RECORD/);
 assert.throws(()=>verifyFullRosterBytes(csv([['abc','表示','CHECKED_IN','FALSE']]),1),/RECORD/);
});
test('missing name and malformed CSV rejected',()=>{
 assert.throws(()=>verifyFullRosterBytes(csv([['abc','','ACCEPTED','FALSE']]),1),/RECORD/);
 assert.throws(()=>verifyFullRosterBytes(new TextEncoder().encode('username,display_name\r\n'),1),/BOM/);
});
test('truncated quoted CSV rejected, even when header count matches',()=>{
 const broken=csv(sample).slice(0,-5);
 assert.throws(()=>verifyFullRosterBytes(broken,3),/COUNT_MISMATCH|DELIMITER|COLUMNS/);
});
test('too many rows or wrong header count rejected',()=>{
 assert.throws(()=>verifyFullRosterBytes(csv(sample),5001),/INVALID_SIZE/);
 const withDuplicate=csv([sample[0],sample[0]]);
 assert.equal(verifyFullRosterBytes(withDuplicate,2).count,2); // No IDs in CSV. Server must deduplicate.
});

test('missing DECLINED names are accepted only when server declares exact number',()=>{
 const rows=[...sample,['','','DECLINED','FALSE']];
 const value=csv(rows);
 assert.deepEqual(verifyFullRosterBytes(value,4,1),{count:4,checkedInCount:1,unresolvedCount:1});
 assert.throws(()=>verifyFullRosterBytes(value,4,0),/UNRESOLVED_COUNT/);
 assert.throws(()=>verifyFullRosterBytes(value,4,2),/UNRESOLVED_COUNT/);
});
test('missing participant names for accepted/check-in or one-sided declined still rejected',()=>{
 for(const row of [['','', 'ACCEPTED','FALSE'],['','person','DECLINED','FALSE'],
   ['person','','DECLINED','FALSE'],['','','CHECKED_IN','TRUE']]){
  assert.throws(()=>verifyFullRosterBytes(csv([row]),1,1),/RECORD/);
 }
});
