const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
let checks = 0;
function check(actual, expected) { assert.deepEqual(actual, expected); checks++; }
function compile(path, imports) {
  const exports = {};
  const js = ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  vm.runInNewContext(js,{exports,require:name => {assert.ok(name in imports,name);return imports[name]},process:{env:{}},Buffer,console:{error:()=>{}},Response});
  return exports;
}
const config = compile('src/lib/sendai-map-server.ts',{'@supabase/supabase-js':{createClient(){throw new Error('not used')}}});
check(config.sendaiMapServerConfig({NEXT_PUBLIC_SUPABASE_URL:' ',SUPABASE_SERVICE_ROLE_KEY:' server-secret '}).url,'https://wgiittrvgtiosogyhfcl.supabase.co');
check(config.sendaiMapServerConfig({}).key,'');
check(config.sendaiMapServerConfig({SUPABASE_SERVICE_ROLE_KEY:' server-secret '}).key,'server-secret');
let active = true, configured = true, role = 'admin', invalid = false, bucketPublic = false, corrupt = false, writeError = false, body, reads = 0;
const nonces = new Set();
const workspace = {version:2,current:'B',plans:{B:{squads:[]}},caRoster:[{private:'excluded'}]};
const admin = {
 auth:{getUser:async token=>({data:{user:invalid || token !== 'valid' ? null : {id:'user'}},error:null})},
 from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:role?{role}:null,error:null})})})}),
 storage:{getBucket:async()=>({data:{public:bucketPublic},error:null}),
  from:()=>({upload:async(_path,bytes)=>{body=bytes;return {error:writeError?{name:'StorageError'}:null}},
   download:async(_path,options,parameters)=>{
    assert.match(options?.cacheNonce,/^[0-9a-f-]{36}$/);
    assert.equal(nonces.has(options.cacheNonce),false,'Each read must avoid prior cached responses');
    nonces.add(options.cacheNonce);
    assert.equal(parameters?.cache,'no-store');
    reads++;return {data:body?new Blob([corrupt?Buffer.from('x'.repeat(body.length)):body]):null,error:null}}})}
};
class NextResponse extends Response {static json(value,init){return new NextResponse(JSON.stringify(value),{...init,headers:{'content-type':'application/json',...init?.headers}})}}
const api=compile('src/app/api/sendai-map/route.ts',{
 'node:crypto':require('node:crypto'),
 'next/server':{NextResponse},
 '@/lib/sendai-map-server':{createSendaiMapAdminClient:()=>configured?admin:null},
 '@/lib/sendai-map-policy':{sendaiMapIsActive:()=>active,sendaiMapRoleAllowed:r=>r==='ca'||r==='admin',SENDAI_MAP_BUCKET:'private',SENDAI_MAP_OBJECT:'snapshot.json'}
});
function request(method,token='valid',origin='https://kaityo1221.github.io',payload=workspace){return new Request('https://ca-clover.vercel.app/api/sendai-map',{method,headers:{...(token?{authorization:'Bearer '+token}:{}),...(origin?{origin}:{}),'content-type':'application/json'},...(method==='POST'?{body:JSON.stringify(payload)}:{})})}
(async()=>{
 // Exercise the installed SDK as well: both the cache nonce and Fetch cache option
 // must reach the actual HTTP request rather than being ignored by the SDK.
 const requests=[];
 const {createClient}=require('@supabase/supabase-js');
 const sdk=createClient('https://storage.example.test','synthetic-key',{
  auth:{persistSession:false,autoRefreshToken:false},
  global:{fetch:async(url,init)=>{requests.push({url:String(url),init});
   return new Response('{"latest":true}',{headers:{'content-type':'application/json'}});}}
 });
 for(let i=0;i<2;i++){
  const nonce=require('node:crypto').randomUUID();
  const result=await sdk.storage.from('private').download('snapshot.json',{cacheNonce:nonce},{cache:'no-store'});
  check(result.error,null);check(await result.data.text(),'{"latest":true}');
  check(new URL(requests[i].url).searchParams.get('cacheNonce'),nonce);
  check(requests[i].init.cache,'no-store');
 }
 check(requests[0].url===requests[1].url,false);
 check((await api.OPTIONS(request('OPTIONS'))).status,204);
 check((await api.OPTIONS(request('OPTIONS','valid','https://evil.example'))).status,403);
 check((await api.GET(request('GET',null))).status,401);
 invalid=true;check((await api.GET(request('GET'))).status,401);invalid=false;
 for(const r of ['pending',null,'guest']){role=r;check((await api.GET(request('GET'))).status,403);check((await api.POST(request('POST'))).status,403)}
 role='ca';check((await api.POST(request('POST'))).status,403);
 role='admin';check((await api.POST(request('POST'))).status,200);
 check('caRoster' in JSON.parse(body),false);
 role='ca';const got=await api.GET(request('GET'));check(got.status,200);check((await got.json()).workspace.caRoster,undefined);
 check(got.headers.get('access-control-allow-origin'),'https://kaityo1221.github.io');check(got.headers.get('cache-control').includes('no-store'),true);
 let before=reads;check((await api.HEAD(request('HEAD'))).status,200);check(reads,before);
 role='pending';check((await api.HEAD(request('HEAD'))).status,403);
 role='admin';bucketPublic=true;check((await api.GET(request('GET'))).status,503);check((await api.POST(request('POST'))).status,503);bucketPublic=false;
 corrupt=true;check((await api.POST(request('POST'))).status,503);corrupt=false;
 writeError=true;check((await api.POST(request('POST'))).status,503);writeError=false;
 check((await api.POST(request('POST','valid',undefined,{version:2,current:'no',plans:{}}))).status,400);
 check((await api.GET(request('GET','valid','https://evil.example'))).status,403);
 configured=false;const missing=await api.GET(request('GET'));check(missing.status,503);check((await missing.json()).code,'MAP_AUTH_CONFIG');configured=true;
 active=false;check((await api.GET(request('GET'))).status,410);check((await api.POST(request('POST'))).status,410);check((await api.HEAD(request('HEAD'))).status,410);
 console.log(`Sendai API mocked auth/storage/CORS/expiry: ${checks} assertions PASS (real Auth not exercised)`);
})().catch(e=>{console.error(e);process.exitCode=1});
