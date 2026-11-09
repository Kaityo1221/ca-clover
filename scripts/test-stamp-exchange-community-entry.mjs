import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
const require=createRequire(import.meta.url);
const core=require("../docs/stamp-exchange-community-core.js");
const rally=readFileSync("docs/stamp-rally.html","utf8");
const page=readFileSync("docs/stamp-exchange-community.html","utf8");
const link='<a class="community-record-card" href="./stamp-exchange-community.html?v=20261109"';
assert.ok(rally.includes(link),"New CTA missing from medal rally");
assert.ok(rally.indexOf(link)<rally.indexOf('href="./stamp-exchange.html"'),"Community CTA must precede QR exchange");
assert.match(rally,/\.admin-catalog \.community-record-card/);
assert.match(page,/href="\.\/stamp-rally\.html"/);
assert.match(page,/id="privateContent" hidden/);
assert.match(page,/\.rpc\("stamp_exchange_community_summary_v1"\)/);
assert.match(page,/getUser\(\)/);
assert.match(page,/\["ca","admin"\]\.includes\(p\.data\?\.role\)/);
assert.match(page,/id="prevMonth"/);
assert.match(page,/id="nextMonth"/);
assert.match(page,/id="daySection" hidden/);
assert.doesNotMatch(page,/\.from\("stamp_exchange_transactions"\)|user_a_id|user_b_id|service_role|trainer_name/);
assert.doesNotMatch(page,/\.insert\(|\.upsert\(|\.delete\(|\.update\(/);
const scripts=[...page.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(x=>x[1]);
assert.equal(scripts.length,1);
assert.doesNotThrow(()=>new vm.Script(scripts[0]));

const d=(day,count,participants,pairs,firstPairs,repeatPairs,hour=12)=>({
 day,count,participants,pairs,firstPairs,repeatPairs,
 hours:Array.from({length:24},(_,i)=>i===hour?count:0)
});
const good={version:1,asOf:"2026-11-09T02:00:00Z",total:3,participants:4,pairs:2,
 firstDate:"2026-11-07",lastDate:"2026-11-08",
 days:[d("2026-11-07",2,3,2,2,0),d("2026-11-08",1,2,1,0,1)]
};
const report=core.normalize(good);
assert.equal(report.total,3);
assert.equal(report.days.length,3);
assert.deepEqual(report.days.map(x=>[x.day,x.count,x.cumulative]),[
 ["2026-11-07",2,2],["2026-11-08",1,3],["2026-11-09",0,3]
]);
assert.equal(report.days[0].hours.reduce((a,b)=>a+b,0),2);
assert.equal(core.asJstDay("2026-11-07T15:00:00Z"),"2026-11-08");
assert.throws(()=>core.normalize({...good,total:4}),/一致/);
assert.throws(()=>core.normalize({...good,pairs:3}),/一致/);
assert.throws(()=>core.normalize({...good,days:[d("2026-11-07",2,3,2,1,1),good.days[1]]}),/一致/);
assert.throws(()=>core.normalize({...good,days:[{...good.days[0],hours:[2]},good.days[1]]}),/時間帯/);
assert.throws(()=>core.normalize({...good,days:[good.days[0],good.days[0]]}),/日付/);
assert.throws(()=>core.normalize({...good,days:[{...good.days[0],day:"2026-02-30"},good.days[1]]}),/日付/);

async function checkAccess(role,loggedIn,profileError,rpcError){
 const els=new Map();
 const ids=["authState","privateContent","authTitle","authMessage","loadStatus","reloadBtn","totalExchanges",
 "totalParticipants","totalPairs","firstDate","lastDate","chart","monthLabel","prevMonth","nextMonth",
 "dailyBody","daySection","selectedTitle","dayCount","dayParticipants","dayPairs","dayFirst",
 "dayRepeat","dayCumulative","hourly","scrollList"];
 for(const id of ids){
  els.set(id,{hidden:id==="privateContent"||id==="daySection",textContent:"",innerHTML:"",
   disabled:false,style:{},scrollTop:0,setAttribute(){},addEventListener(){},scrollIntoView(){}});
 }
 let profiles=0,rpcCalls=0;
 const client={
  auth:{getUser:async()=>({data:{user:loggedIn?{id:"u1"}:null},error:null})},
  from:table=>{
   assert.equal(table,"profiles");profiles++;
   return {select:columns=>{
    assert.equal(columns,"role");
    return {eq:(col,id)=>{
     assert.equal(col,"id");assert.equal(id,"u1");
     return {maybeSingle:async()=>({data:{role},error:profileError?new Error("offline"):null})};
    }};
   }};
  },
  rpc:async name=>{
   assert.equal(name,"stamp_exchange_community_summary_v1");
   rpcCalls++;
   return {data:rpcError?null:good,error:rpcError?new Error("offline"):null};
  }
 };
 const buttons=["all","30","7"].map(period=>({dataset:{period},addEventListener(){},setAttribute(){}}));
 const ctx={
  document:{getElementById:id=>{assert.ok(els.has(id),"Unknown element "+id);return els.get(id)},
   querySelectorAll:selector=>{assert.equal(selector,"[data-period]");return buttons}},
  window:{supabase:{createClient:()=>client},StampExchangeCommunityCore:core,
   StampExchangeStats:{recent:(days,period)=>days.slice(period==="7"?-7:period==="30"?-30:0),
    monthKey:day=>day.slice(0,7),monthDays:(days,month)=>days.filter(x=>x.day.startsWith(month)),
    shiftMonth:()=>null}},
  Date,Number,Math
 };
 vm.runInNewContext(scripts[0],ctx);
 for(let i=0;i<4;i++)await new Promise(resolve=>setImmediate(resolve));
 return {shown:!els.get("privateContent").hidden,profiles,rpcCalls,number:els.get("totalExchanges").textContent};
}
for(const role of ["ca","admin"]){
 const result=await checkAccess(role,true,false,false);
 assert.equal(result.shown,true,role+" must see aggregates");
 assert.equal(result.profiles,1);assert.equal(result.rpcCalls,1);
 assert.equal(result.number,"3 回");
}
for(const role of ["pending",null,"member"]){
 const result=await checkAccess(role,true,false,false);
 assert.equal(result.shown,false,role+" must be denied");
 assert.equal(result.rpcCalls,0);
}
const guest=await checkAccess(null,false,false,false);
assert.equal(guest.profiles,0);assert.equal(guest.rpcCalls,0);assert.equal(guest.shown,false);
const failed=await checkAccess("ca",true,true,false);
assert.equal(failed.rpcCalls,0);assert.equal(failed.shown,false);
const apiError=await checkAccess("ca",true,false,true);
assert.equal(apiError.shown,false);
process.stdout.write("PASS: community exchange CTA, CA-only stats RPC, anonymized response, validation and failure handling\n");
