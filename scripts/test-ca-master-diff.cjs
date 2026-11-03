const assert=require("node:assert/strict");
const fs=require("node:fs");
const {pathToFileURL}=require("node:url");
const os=require("node:os");
const path=require("node:path");

(async()=>{
 const source=fs.readFileSync(path.join(__dirname,"../src/lib/ca-master-diff.js"),"utf8");
 // Avoid requiring an additional compiler for this platform-neutral ESM helper.
 const url="data:text/javascript;base64,"+Buffer.from(source).toString("base64");
 const {parseCsv,parseMasterRows,compareMaster}=await import(url);
 const headers=["Status","PGO Trainer Name","2nd CA","Discord Name","Campfire Group Name","Campfire URL","Primary City","CA Join date"];
 const rows=[headers];
 for(let n=0;n<150;n++)rows.push(["",n===2?"Jackson5103":"Tester"+n,n===1?"2nd":"","","Pokémon GO 松山","https://campfire.onelink.me/eBr8?code=abc","38_愛媛県","10/19/2026"]);
 const csv=rows.map(row=>row.map(value=>'"'+value.replaceAll('"','""')+'"').join(",")).join("\r\n");
 const roster=parseMasterRows(parseCsv(csv));
 assert.equal(roster.rows.length,150);
 assert.deepEqual(roster.issues,[]);
 const db=[
  {source_key:"tester0",trainer_name:"Tester0",ca_level:"1st",status:"active"},
  {source_key:"tester1",trainer_name:"Tester1",ca_level:"1st",status:"active"},
  {source_key:"absent",trainer_name:"Absent",ca_level:"1st",status:"active"}
 ];
 const comparison=compareMaster(roster,db);
 assert.equal(comparison.added.length,148);
 assert.ok(comparison.added.some(x=>x.name==="Jackson5103"));
 assert.equal(comparison.changed.length,1);
 assert.equal(comparison.absent.length,1);
 assert.equal(comparison.writeAllowed,false);
 console.log("PASS 7/7 base comparison assertions");
 const badHeader=rows.map(r=>[...r]);badHeader[0][1]="UNKNOWN";
 assert.throws(()=>parseMasterRows(badHeader),/SOURCE_SCHEMA_CHANGED/);
 const duplicate=rows.map(r=>[...r]);duplicate[2][1]=duplicate[1][1];
 assert.ok(parseMasterRows(duplicate).issues.includes("DUPLICATE_NAME"));
 assert.throws(()=>parseMasterRows(rows.slice(0,10)),/SOURCE_ROW_COUNT_INVALID/);
 assert.throws(()=>parseCsv('"unclosed'),/SOURCE_CSV_UNCLOSED_QUOTE/);
 const multiline=parseCsv('name,notes\n"Jackson,5103","line one\nline two"');
 assert.deepEqual(multiline[1],["Jackson,5103","line one\nline two"]);
 assert.equal(roster.rows[2].status,"active");
 console.log("PASS 6/6 rejection, RFC CSV, and status assertions");
})().catch(error=>{console.error(error);process.exitCode=1;});
