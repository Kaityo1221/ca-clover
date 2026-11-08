import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
const require=createRequire(import.meta.url);
const {summarize}=require("../docs/stamp-exchange-breakdown.js");
const row=(exchange_key, completed_at, user_a_id, user_b_id)=>({exchange_key,completed_at,user_a_id,user_b_id});
function check(label,fn){fn();process.stdout.write("PASS: "+label+"\n");}
const example=[
 row("k-3","2026-11-07T15:15:00Z","alice","bob"),
 row("k-1","2026-11-06T15:00:00Z","alice","bob"),
 row("k-2","2026-11-07T11:00:00Z","bob","charlie"),
 row("k-4","2026-11-07T15:50:00Z","alice","bob"),
 row("k-5","2026-11-07T15:59:00Z","alice","dan"),
 row("k-6","2026-11-07T14:59:59Z","dan","charlie"),
 row("k-5","2026-11-07T15:59:00Z","alice","dan")
];
const report=summarize(example,"2026-11-09T00:00:00Z");
check("completed exchange counted once despite replay",()=>assert.equal(report.total,6));
check("JST day partition and unique participants",()=>{
 assert.equal(report.byDay["2026-11-07"].exchangeCount,2);
 assert.equal(report.byDay["2026-11-08"].exchangeCount,4);
 assert.equal(report.byDay["2026-11-08"].participantCount,4);
});
check("globally first-time vs repeat pairs includes prior days and same-day duplicate pair",()=>{
 assert.deepEqual([report.byDay["2026-11-08"].firstPairs,report.byDay["2026-11-08"].repeatPairs],[2,2]);
 assert.equal(report.byDay["2026-11-08"].uniquePairs,3);
 assert.equal(report.byDay["2026-11-08"].firstPairs+report.byDay["2026-11-08"].repeatPairs,4);
});
check("hourly JST bins",()=>{
 assert.equal(report.byDay["2026-11-08"].hours[0],3);
 assert.equal(report.byDay["2026-11-08"].hours[23],1);
 assert.equal(report.byDay["2026-11-07"].hours[23],1);
 assert.equal(report.byDay["2026-11-08"].hours.reduce((s,v)=>s+v,0),4);
});
check("leaderboard counts both exchange sides and unique partners",()=>{
 const all=report.overall.ranking;
 const a=all.find(v=>v.userId==="alice");
 assert.equal(a.count,4);
 assert.equal(a.partners,2);
 const bob=all.find(v=>v.userId==="bob");
 assert.equal(bob.count,4);
 assert.equal(bob.partners,2);
 assert.equal(report.overall.participantCount,4);
 assert.equal(report.overall.uniquePairs,4);
 assert.equal(all.reduce((s,x)=>s+x.count,0),report.total*2);
});
check("no transactions is empty not an error",()=>{
 assert.deepEqual(summarize([],"2026-11-09T00:00:00Z").byDay,{});
 assert.deepEqual(summarize([],"2026-11-09T00:00:00Z").overall.ranking,[]);
});
check("malformed or spoofed pairs rejected",()=>{
 assert.throws(()=>summarize([row("a",null,"alice","bob")]),/不整合/);
 assert.throws(()=>summarize([row("a","2026-11-08T00:00:00Z","alice","alice")]),/不整合/);
 assert.throws(()=>summarize([row("a","2099-01-01T00:00:00Z","alice","bob")],"2026-11-09T00:00:00Z"),/未来/);
});
check("admin HTML script parses",()=>{
 const html=fs.readFileSync("docs/stamp-exchange-stats.html","utf8");
 const inline=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(x=>x[1]);
 assert.equal(inline.length,1);
 assert.doesNotThrow(()=>new vm.Script(inline[0]));
 assert.match(html,/getUser\(\)/);
 assert.match(html,/role!=="admin"/);
 assert.match(html,/fetchConfirmedCaNames/);
 assert.match(html,/client\.from\("stamp_exchange_transactions"\)/);
 assert.match(html,/\.eq\("status","completed"\)/);
 assert.match(html,/data-ranking="all"/);
 assert.match(html,/data-ranking="day"/);
 assert.match(html,/get\("dailyBody"\)\.addEventListener\("click"/);
 assert.match(html,/escapeHtml\(ca\.name\)/);
 assert.doesNotMatch(html,/\.insert\(|\.upsert\(|\.update\(|\.delete\(/);
});
