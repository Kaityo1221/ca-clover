import test from "node:test";
import assert from "node:assert/strict";
import {loadMeetupHistory} from "../../docs/meetup-history-loader.mjs";
const rows=Array.from({length:277},(_,i)=>({id:"meetup-"+i,starts_at:new Date(Date.UTC(2026,10,1)-i*86400000).toISOString()}));
function fixture({failAt=-1,duplicate=false,badCount=false}={}){
  let rangeCalls=[],limitCalls=[];
  const client={from(table){
    assert.equal(table,"meetups");
    let countRequested=false;
    const q={
      select(_fields,opts){countRequested=opts.count==="exact";return q;},
      eq(){return q;},lte(){return q;},order(){return q;},
      range(start,end){rangeCalls.push([start,end]);return Promise.resolve(start===failAt?{error:{message:"network"}}:
        {data:(duplicate&&start===200?[rows[199],...rows.slice(start,end+1).slice(1)]:rows.slice(start,end+1)),count:badCount?null:countRequested?rows.length:null});},
      limit(n){limitCalls.push(n);return Promise.resolve({data:rows.slice(0,n),error:null})}
    };
    return q;
  }};
  return {client,rangeCalls,limitCalls};
}
const args={communityId:"fixture-community",fields:"id,starts_at",through:"2026-11-13T00:00:00Z"};
test("all mode obtains 277 entries including oldest with deterministic page boundaries",async()=>{
 const f=fixture();
 const list=await loadMeetupHistory({...args,client:f.client,scanAll:true});
 assert.equal(list.length,277);assert.equal(list.at(-1).id,"meetup-276");
 assert.deepEqual(f.rangeCalls,[[0,199],[200,399]]);
});
test("normal modes keep existing 25,50,100 limits",async()=>{
 for(const limit of [25,50,100]){
   const f=fixture();const items=await loadMeetupHistory({...args,client:f.client,limit});
   assert.equal(items.length,limit);assert.deepEqual(f.limitCalls,[limit]);
 }
});
test("partial result is blocked, never labeled all",async()=>{
 const f=fixture({failAt:200});
 await assert.rejects(()=>loadMeetupHistory({...args,client:f.client,scanAll:true}),/HISTORY_FETCH_FAILED/);
});
test("duplicate page edge blocked",async()=>{
 const f=fixture({duplicate:true});
 await assert.rejects(()=>loadMeetupHistory({...args,client:f.client,scanAll:true}),/HISTORY_DUPLICATE/);
});
test("unknown total blocked",async()=>{
 const f=fixture({badCount:true});
 await assert.rejects(()=>loadMeetupHistory({...args,client:f.client,scanAll:true}),/HISTORY_COUNT_UNAVAILABLE/);
});
