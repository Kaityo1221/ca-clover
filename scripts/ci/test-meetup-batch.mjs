import test from 'node:test';
import assert from 'node:assert/strict';
import {RosterBatch,readBatchJson,BATCH_MEMORY_TTL} from '../../docs/meetup-roster-batch.mjs';
import {createRosterZip,rosterFilename,crc32} from '../../docs/meetup-roster-zip.mjs';
import {acquireExport,releaseExport,nextExportAt} from '../../docs/meetup-export-lock.mjs';
const id=n=>'00000000-0000-0000-0000-'+String(n).padStart(12,'0');
const rows=Array.from({length:20},(_,i)=>({id:id(i+1),title:'合成 / Meetup🍀',starts_at:'2026-10-03T04:45:00Z'}));
const csv='\uFEFF"username","display_name","rsvp_status"\r\n"sample","合成参加者","CHECKED_IN"\r\n';
const bytes=new TextEncoder().encode(csv);
function fixture({count=20,fetcher,authorize}={}){
  let time=Math.max(Date.now(),nextExportAt())+10;const calls=[];
  const identity={userId:id(90),sessionId:id(91),accessToken:'synthetic',publicKey:'synthetic'};
  const response=body=>{const subset=body.meetupIds.slice(body.offset,body.offset+10);return {version:1,files:subset.map(meetupId=>({meetupId,csv,bytes:bytes.length,count:1})),next:body.offset+subset.length,complete:body.offset+subset.length===count,stop:null};};
  const job=new RosterBatch({meetups:rows.slice(0,count),...identity,endpoint:'https://fixture.invalid/batch',now:()=>time,authorize:authorize||(async()=>identity),
    fetcher:async(url,options)=>{const body=JSON.parse(options.body);calls.push(body);return fetcher?fetcher(body,options,response):Response.json(response(body));}});
  return {job,calls,advance:(n=16001)=>time+=n,identity,response};
}
test('20 CSVs in two stages of ten, accurate UTF-8 budget, ZIP integrity headers',async()=>{
  const f=fixture();assert.equal(await f.job.run(),false);assert.equal(f.job.files.length,10);f.advance();assert.equal(await f.job.run(),true);
  assert.deepEqual(f.calls.map(b=>b.offset),[0,10]);assert.equal(f.calls[1].remainingBytes,8000000-10*bytes.length);
  const zip=await f.job.zip(),buffer=await zip.arrayBuffer(),view=new DataView(buffer);
  assert.equal(view.getUint32(0,true),0x04034b50);assert.equal(view.getUint16(buffer.byteLength-12,true),20);assert.equal(f.job.bytes,20*bytes.length);
});
test('zero, 21 and duplicate selections rejected before network',()=>{
  for(const meetups of [[],[...rows,rows[0]],[rows[0],rows[0]]])assert.throws(()=>new RosterBatch({meetups}));
});
test('a partial 429 response keeps successes, does not retry automatically, resumes only remaining IDs',async()=>{
  let first=true;const f=fixture({count:5,fetcher:async(body,options,make)=>{
    if(first){first=false;const data=make(body);data.files=data.files.slice(0,2);data.next=2;data.complete=false;data.stop={status:429,code:'RATE_LIMITED',retryAfter:3600};return Response.json(data);}return Response.json(make(body));
  }});
  await assert.rejects(f.job.run(),/RATE_LIMITED/);assert.equal(f.calls.length,1);assert.equal(f.job.files.length,2);
  await assert.rejects(f.job.run(),/WAIT/);assert.equal(f.calls.length,1);f.advance(3600001);assert.equal(await f.job.run(),true);assert.equal(f.calls[1].offset,2);
});
test('failed item resume preserves acknowledged CSVs with no partial ZIP',async()=>{
  let first=true;const f=fixture({count:3,fetcher:async(body,options,make)=>{const data=make(body);if(first){first=false;data.files=data.files.slice(0,1);data.next=1;data.complete=false;data.stop={status:503};}return Response.json(data);}});
  await assert.rejects(f.job.run(),/FETCH_FAILED/);await assert.rejects(f.job.zip(),/INCOMPLETE/);f.advance();assert.equal(await f.job.run(),true);assert.equal(f.calls[1].offset,1);
});
test('unknown transport result stops; no automatic duplication',async()=>{const f=fixture({fetcher:async()=>{throw Error('network');}});await assert.rejects(f.job.run(),/network/);assert.equal(f.calls.length,1);assert.equal(f.job.files.length,0);});
for(const status of [401,403])test('authorization failure '+status+' erases held data',async()=>{
  let step=0;const f=fixture({fetcher:async(body,options,make)=>++step===1?Response.json(make(body)):new Response('{}',{status})});await f.job.run();f.advance();await assert.rejects(f.job.run(),/FORBIDDEN/);assert.equal(f.job.files.length,0);assert.equal(f.job.destroyed,true);
});
test('session switch, permission failure and expiry erase held names',async()=>{
  const f=fixture({count:1});await f.job.run();f.identity.sessionId=id(99);await assert.rejects(f.job.zip(),/FORBIDDEN/);assert.equal(f.job.bytes,0);
  const g=fixture({count:1});await g.job.run();g.advance(BATCH_MEMORY_TTL);await assert.rejects(g.job.zip(),/EXPIRED/);assert.equal(g.job.files.length,0);
});
for(const mutate of [d=>d.files.reverse(),d=>d.next++,d=>d.files[0].bytes++,d=>d.files[0].count=5001,d=>d.complete=true])test('malformed stage atomically rejected '+mutate.toString(),async()=>{
  const f=fixture({fetcher:async(body,options,make)=>{const data=make(body);mutate(data);return Response.json(data);}});await assert.rejects(f.job.run(),/INVALID_RESPONSE/);assert.equal(f.job.files.length,0);
});
test('aggregate byte limit prevents ZIP and clears cached data',async()=>{
  const large='x'.repeat(8000001);const f=fixture({count:1,fetcher:async body=>Response.json({version:1,files:[{meetupId:body.meetupIds[0],csv:large,bytes:large.length,count:1}],next:1,complete:true})});
  await assert.rejects(f.job.run(),/BYTE_LIMIT/);assert.equal(f.job.files.length,0);assert.equal(f.job.destroyed,true);
});
test('bounded response reader limits actual streamed JSON, including missing length header',async()=>{
  const stream=new ReadableStream({start(controller){controller.enqueue(new Uint8Array(16100001));controller.close();}});
  await assert.rejects(readBatchJson(new Response(stream,{headers:{'content-type':'application/json'}}),new AbortController().signal),/BYTE_LIMIT/);
});
test('shared individual/batch mutex, then release allows next operation',async()=>{
  const token={};assert.equal(acquireExport(token),true);const f=fixture({count:1});await assert.rejects(f.job.run(),/BUSY/);assert.equal(f.calls.length,0);releaseExport(token);assert.equal(await f.job.run(),true);
});
test('cancel aborts pending network and discards memory',async()=>{
  let started;const ready=new Promise(r=>started=r);const f=fixture({fetcher:async(body,options)=>{started();return new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(Error('aborted')),{once:true}));}});
  const running=f.job.run();await ready;f.job.destroy();await assert.rejects(running,/aborted/);assert.equal(f.job.files.length,0);
});
test('ZIP supports exact 8MB, protects file paths and duplicate names, standard CRC vector',async()=>{
  assert.equal(crc32(new TextEncoder().encode('123456789')),0xcbf43926);
  const name=rosterFilename({...rows[0],title:'../危険\\名前\u202e.csv'});assert.doesNotMatch(name,/[\\/\u202e]/);
  assert.ok((await createRosterZip([{name,bytes:new Uint8Array(8000000)}]).arrayBuffer()).byteLength>8000000);
  assert.throws(()=>createRosterZip([{name,bytes:new Uint8Array(8000001)}]),/BYTE_LIMIT/);
  assert.throws(()=>createRosterZip([{name:'../x.csv',bytes}]),/INVALID_FILE/);
  assert.throws(()=>createRosterZip([{name,bytes},{name,bytes}]),/INVALID_FILE/);
});
