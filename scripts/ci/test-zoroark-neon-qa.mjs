// Explicit opt-in, QA endpoint only. Uses synthetic auth stub; never claims real CA E2E.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {neon} from '@neondatabase/serverless';
import {harness,request} from './zoroark-route-harness.mjs';
if(!process.env.ZOROARK_QA_CONFIG)throw Error('Explicit QA config path required');
const config=JSON.parse(fs.readFileSync(process.env.ZOROARK_QA_CONFIG,'utf8'));
for(const value of Object.values(config)){
 const u=new URL(value);
 assert.equal(u.hostname.replace('-pooler.','.'),'ep-frosty-grass-betfuvsp.c-9.us-east-2.aws.neon.tech');
 assert.equal(u.pathname,'/zoroark_prod');
}
const owner=neon(config.owner),gm=randomUUID(),rooms=[];
const h=harness({neon,userId:gm,env:{ZOROARK_NEON_GM_DATABASE_URL:config.gm,ZOROARK_NEON_GUEST_DATABASE_URL:config.guest}});
const guest=h.route('guest'),admin=h.route('gm');
const cookie=()=>`__Host-zg_device=${randomBytes(32).toString('hex')}`;
async function create(){
 const response=await h.route('rooms').POST(request('rooms',{action:'create',mode:'simple',maxPlayers:3,talkSeconds:120}));
 assert.equal(response.status,201);const body=await response.json();rooms.push(body.roomId);return body;
}
async function join(r,nickname,device=cookie()){
 const response=await guest.POST(request('guest',{action:'join',invite:r.invite,nickname},{cookie:device}));
 const body=await response.json();return {status:response.status,body,cookie:response.headers.get('set-cookie')?.split(';')[0],device};
}
try{
 const r=await create();
 const inspect=await guest.POST(request('guest',{action:'inspect',invite:r.invite}));
 assert.equal(inspect.status,200);assert.match(inspect.headers.get('set-cookie'),/__Host-zg_device=/);
 assert.equal((await guest.POST(request('guest',{action:'join',invite:r.invite,nickname:'No cookie'}))).status,403);
 const results=await Promise.all(Array.from({length:12},(_,i)=>join(r,`Parallel ${i}`)));
 assert.equal(results.filter(x=>x.status===201).length,3);assert.equal(results.filter(x=>x.status===410).length,9);
 const accepted=results.find(x=>x.status===201);
 const me=await guest.POST(request('guest',{action:'me'},{cookie:`${accepted.cookie}; ${accepted.device}`}));
 assert.equal(me.status,200);assert.equal((await me.json()).state,'pending');
 assert.equal((await guest.POST(request('guest',{action:'me'},{cookie:`${accepted.cookie}; ${cookie()}`}))).status,401);
 const other=harness({neon,userId:randomUUID(),env:{ZOROARK_NEON_GM_DATABASE_URL:config.gm,ZOROARK_NEON_GUEST_DATABASE_URL:config.guest}});
 assert.equal((await other.route('gm').POST(request('gm',{action:'list',roomId:r.roomId}))).status,404);
 const list=await admin.POST(request('gm',{action:'list',roomId:r.roomId}));assert.equal(list.status,200);
 const listed=await list.json();assert.equal(listed.participants.length,3);
 for(const p of listed.participants)assert.deepEqual(Object.keys(p).sort(),['created_at','display_name','id','state']);
 const participant=listed.participants.find(p=>p.display_name===accepted.body.nickname);
 assert.equal((await admin.POST(request('gm',{action:'reject',roomId:r.roomId,guestId:participant.id}))).status,200);
 assert.equal((await guest.POST(request('guest',{action:'me'},{cookie:`${accepted.cookie}; ${accepted.device}`}))).status,401);
 const rotated=await admin.POST(request('gm',{action:'rotate',roomId:r.roomId}));assert.equal(rotated.status,200);
 assert.equal((await guest.POST(request('guest',{action:'inspect',invite:r.invite}))).status,410);
 const second=await create();const names=await Promise.all(Array.from({length:8},()=>join(second,'Same name')));
 assert.equal(names.filter(x=>x.status===201).length,1);assert.equal(names.filter(x=>x.status===409).length,7);
 const third=await create(),device=cookie();
 const devices=await Promise.all(Array.from({length:8},(_,i)=>join(third,`Same device ${i}`,device)));
 assert.equal(devices.filter(x=>x.status===201).length,1);assert.equal(devices.filter(x=>x.status===409).length,7);
 console.log('NEON_QA_PASS: actual role logins, API+DB, 12-way capacity, duplicate name/device races, Cookie binding, GM IDOR, rejection, QR rotation');
}finally{
 for(const room of rooms)await owner`delete from zoroark_isolated.rooms where id=${room}::uuid and gm_user_id=${gm}::uuid`;
 console.log(`QA_SYNTHETIC_CLEANUP: ${rooms.length} rooms`);
}
