import test from 'node:test';
import assert from 'node:assert/strict';
import {harness,request} from './zoroark-route-harness.mjs';
const room='11111111-1111-4111-8111-111111111111';
const hex='a'.repeat(64);
const deviceCookie='__Host-zg_device='+'b'.repeat(64);
test('target/branch/endpoint/database/role/TLS/production GO gates fail closed',()=>{
 const {runtime,env}=harness();assert.ok(runtime.runtimeConfig('gm',env));
 for(const patch of [{VERCEL_ENV:'development'},{VERCEL_GIT_COMMIT_REF:'other'},{VERCEL_ENV:'production'},
 {ZOROARK_NEON_GM_DATABASE_URL:env.ZOROARK_NEON_GM_DATABASE_URL.replace('frosty-grass-betfuvsp','billowing-unit-beco2lbg')},
 {ZOROARK_NEON_GM_DATABASE_URL:env.ZOROARK_NEON_GM_DATABASE_URL.replace('zoroark_prod','ca_clover_test')},
 {ZOROARK_NEON_GM_DATABASE_URL:env.ZOROARK_NEON_GM_DATABASE_URL.replace('runtime_gm','owner')},
 {ZOROARK_NEON_GM_DATABASE_URL:env.ZOROARK_NEON_GM_DATABASE_URL.replace('require','disable')},
 {ZOROARK_NEON_GM_DATABASE_URL:''}])assert.equal(runtime.runtimeConfig('gm',{...env,...patch}),null);
 const prod={...env,VERCEL_ENV:'production',VERCEL_GIT_COMMIT_REF:'main',ZOROARK_PRODUCTION_ENABLED:'true',
 ZOROARK_NEON_GM_DATABASE_URL:env.ZOROARK_NEON_GM_DATABASE_URL.replace('frosty-grass-betfuvsp','billowing-unit-beco2lbg')};
 assert.ok(runtime.runtimeConfig('gm',prod));
 assert.equal(runtime.runtimeConfig('gm',{...prod,VERCEL_GIT_COMMIT_REF:'pages'}),null);
});
test('disabled production rejects every handler before database work',async()=>{
 for(const name of ['rooms','gm','guest']){
  const h=harness({env:{VERCEL_ENV:'production',VERCEL_GIT_COMMIT_REF:'main'}});
  const response=await h.route(name).POST(request(name,{action:'me'}));
  assert.equal(response.status,503);assert.equal(h.calls.length,0);
 }
});
test('all routes reject cross-origin and cross-site JSON',async()=>{
 for(const name of ['rooms','gm','guest'])for(const headers of [{origin:'https://evil.example'},{'sec-fetch-site':'cross-site'}]){
  const h=harness();assert.equal((await h.route(name).POST(request(name,{},headers))).status,403);assert.equal(h.calls.length,0);
 }
});
test('bounded streamed body, invalid JSON, arrays, and content length fail before DB',async()=>{
 for(const name of ['rooms','gm','guest'])for(const [body,headers,status] of [
  ['x'.repeat(4096),{},413],['{',{},400],['[]',{},400],['{}',{'content-length':'-1'},413],['{}',{'content-type':'text/plain'},415]]){
  const h=harness();assert.equal((await h.route(name).POST(request(name,body,headers))).status,status);assert.equal(h.calls.length,0);
 }
});
test('GM verifies auth and current CA role, not claimed client fields',async()=>{
 for(const name of ['rooms','gm'])for(const [options,status] of [[{invalidAuth:true},401],[{role:'trainer'},403]]){
  const h=harness(options),body=name==='gm'?{roomId:room,action:'list'}:{action:'create',mode:'simple',maxPlayers:3,talkSeconds:120};
  assert.equal((await h.route(name).POST(request(name,body))).status,status);assert.equal(h.calls.length,0);
 }
});
test('runtime DB identity mismatch blocks every operation',async()=>{
 const h=harness({identity:{target:'production'}});
 assert.equal((await h.route('guest').POST(request('guest',{action:'inspect',invite:hex}))).status,503);
 assert.equal(h.calls.length,1);
});
test('guest joins return only safe fields; secret goes in secure HttpOnly cookie',async()=>{
 const h=harness({query:(q,args)=>q.includes('guest_join')?[{guest_id:'guest',game_room_id:room,join_state:'pending'}]:[]});
 const response=await h.route('guest').POST(request('guest',{action:'join',invite:hex,nickname:'　Ｔｒａｉｎｅｒ　'},{cookie:deviceCookie}));
 assert.equal(response.status,201);const body=await response.json();assert.equal(body.nickname,'Trainer');
 assert.deepEqual(Object.keys(body).sort(),['joined','nickname','roomId','state']);
 const cookie=response.headers.get('set-cookie');
 for(const part of ['__Host-zg_guest=','Path=/','HttpOnly','Secure','SameSite=strict'])assert.ok(cookie.includes(part));
 const token=cookie.match(/__Host-zg_guest=([^;]+)/)[1];assert.match(token,/^[a-f0-9]{64}$/);
 assert.ok(!JSON.stringify(body).includes(token));
 const joined=h.calls.find(x=>x.text.includes('guest_join'));assert.equal(joined.args[1],'Trainer');assert.notEqual(joined.args[3],token);
 assert.match(joined.args[3],/^[a-f0-9]{64}$/);assert.match(response.headers.get('cache-control'),/no-store/);
});
test('duplicate cookies and forged/missing sessions are refused',async()=>{
 for(const cookie of ['',`__Host-zg_guest=bad`,`__Host-zg_guest=${hex}; __Host-zg_guest=${hex}`]){
  const h=harness();assert.equal((await h.route('guest').POST(request('guest',{action:'me'},{cookie:cookie+'; '+deviceCookie}))).status,401);
 }
 const h=harness();const response=await h.route('guest').POST(request('guest',{action:'me'},{cookie:`__Host-zg_guest=${hex}; ${deviceCookie}`}));
 assert.equal(response.status,401);assert.match(response.headers.get('set-cookie'),/Max-Age=0/);
});
test('nickname controls, duplicate joins, durable rate gate and GM IDOR',async()=>{
 for(const nickname of ['','\u202eGM','\u200bGM','x'.repeat(25)]){
  const h=harness();assert.equal((await h.route('guest').POST(request('guest',{action:'join',invite:hex,nickname},{cookie:deviceCookie}))).status,400);
 }
 let h=harness({query:q=>q.includes('guest_existing')?[{present:true}]:[]});
 assert.equal((await h.route('guest').POST(request('guest',{action:'join',invite:hex,nickname:'Trainer'},{cookie:`__Host-zg_guest=${hex}; ${deviceCookie}`}))).status,409);
 h=harness({rate:false});assert.equal((await h.route('guest').POST(request('guest',{action:'inspect',invite:hex}))).status,429);
 h=harness();assert.equal((await h.route('gm').POST(request('gm',{action:'list',roomId:room}))).status,404);
});
