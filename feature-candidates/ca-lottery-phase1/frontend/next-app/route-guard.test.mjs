import assert from 'node:assert/strict';
import test from 'node:test';
import { POST } from './app/api/[...path]/route.js';

const saved={NODE_ENV:process.env.NODE_ENV,VERCEL:process.env.VERCEL,LOTTERY_QA_HTTPS_ORIGIN:process.env.LOTTERY_QA_HTTPS_ORIGIN};
let fetched=[];
const realFetch=globalThis.fetch;
function req(origin,host,url='http://localhost:41739/api/rooms'){
 return new Request(url,{method:'POST',headers:{Origin:origin,Host:host,'content-type':'application/json'},body:'{}'});
}
function reset(){
 delete process.env.VERCEL;process.env.NODE_ENV='development';delete process.env.LOTTERY_QA_HTTPS_ORIGIN;fetched=[];
 globalThis.fetch=async (url,options)=>{
  fetched.push({url,origin:options.headers.origin});
  return new Response(JSON.stringify({rooms:[]}),{status:200,headers:{'content-type':'application/json','set-cookie':'ticket=abc; Path=/api; HttpOnly; SameSite=Strict'}});
 };
}
test.after(()=>{
 globalThis.fetch=realFetch;
 for(const [k,v] of Object.entries(saved))if(v===undefined)delete process.env[k];else process.env[k]=v;
});
test('Next internal URL rewritten to localhost: request admitted only with expected Origin and Host',async()=>{
 reset();const r=await POST(req('http://127.0.0.1:41739','127.0.0.1:41739'),{params:Promise.resolve({path:['rooms']})});
 assert.equal(r.status,200);assert.equal(fetched.length,1);
 assert.equal(fetched[0].url,'http://127.0.0.1:41738/api/rooms');
 assert.equal(r.headers.get('set-cookie')?.includes('ticket=abc'),true);
});
test('missing or wrong Origin is denied, regardless of Host or request URL',async()=>{
 reset();for(const origin of ['http://localhost:41739','http://evil.test','']){
  const r=await POST(req(origin,'127.0.0.1:41739'),{params:Promise.resolve({path:['rooms']})});assert.equal(r.status,403);
 }assert.equal(fetched.length,0);
});
test('unexpected Host is denied even when Origin is allowed',async()=>{
 reset();const r=await POST(req('http://127.0.0.1:41739','evil.test'),{params:Promise.resolve({path:['rooms']})});
 assert.equal(r.status,403);assert.equal(fetched.length,0);
});
test('isolated HTTPS reverse proxy with preserved or rewritten host is admitted',async()=>{
 reset();process.env.LOTTERY_QA_HTTPS_ORIGIN='https://lottery-qa.test';
 for(const host of ['lottery-qa.test','127.0.0.1:41739']){
  const r=await POST(req('https://lottery-qa.test',host),{params:Promise.resolve({path:['rooms']})});assert.equal(r.status,200);
 }assert.equal(fetched.length,2);assert(fetched.every(x=>x.origin==='https://lottery-qa.test'));
});
test('production origin and invalid test config are refused',async()=>{
 reset();for(const bad of ['https://production.example.com','https://lottery-qa.test/path','http://lottery-qa.test','https://lottery-qa.test.evil.com']){
  process.env.LOTTERY_QA_HTTPS_ORIGIN=bad;
  assert.equal((await POST(req(bad,'127.0.0.1:41739'),{params:Promise.resolve({path:['rooms']})})).status,403);
 }
 delete process.env.LOTTERY_QA_HTTPS_ORIGIN;
 process.env.NODE_ENV='production';assert.equal((await POST(req('http://127.0.0.1:41739','127.0.0.1:41739'),{params:Promise.resolve({path:['rooms']})})).status,403);
 process.env.NODE_ENV='development';process.env.VERCEL='1';assert.equal((await POST(req('http://127.0.0.1:41739','127.0.0.1:41739'),{params:Promise.resolve({path:['rooms']})})).status,403);
 assert.equal(fetched.length,0);
});
test('unexpected path rejected without reaching API',async()=>{
 reset();const r=await POST(req('http://127.0.0.1:41739','127.0.0.1:41739'),{params:Promise.resolve({path:['../invalid']})});
 assert.equal(r.status,404);assert.equal(fetched.length,0);
});
