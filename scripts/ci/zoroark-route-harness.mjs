import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {webcrypto} from 'node:crypto';
import ts from 'typescript';
const require=createRequire(import.meta.url);
export function harness(options={}) {
 const env={VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:'integration/zoroark-pages-current-isolated-20261114',
  ZOROARK_ROOM_CREATE_ENABLED:'true',ZOROARK_GUEST_LOBBY_ENABLED:'true',
  ZOROARK_NEON_GM_DATABASE_URL:'postgresql://zoroark_runtime_gm:synthetic@ep-frosty-grass-betfuvsp-pooler.c-9.us-east-2.aws.neon.tech/zoroark_prod?sslmode=require',
  ZOROARK_NEON_GUEST_DATABASE_URL:'postgresql://zoroark_runtime_guest:synthetic@ep-frosty-grass-betfuvsp-pooler.c-9.us-east-2.aws.neon.tech/zoroark_prod?sslmode=require',...options.env};
 const calls=[];
 const neon=options.neon??(url=>async (strings,...args)=>{
  const text=strings.join('?'); calls.push({text,args});
  if(text.includes('runtime_identity'))return [{database_name:'zoroark_prod',role_name:new URL(url).username,target:env.VERCEL_ENV,version:3,...options.identity}];
  if(text.includes('guest_rate_gate'))return [{allowed:options.rate!==false}];
  return options.query ? options.query(text,args) : [];
 });
 const auth={auth:{getUser:async()=>({data:{user:options.invalidAuth?null:{id:options.userId??'22222222-2222-4222-8222-222222222222'}},error:null})},
  from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{role:options.role??'ca'},error:null})})})})};
 const cache=new Map();
 function load(path){
  if(cache.has(path))return cache.get(path);
  const source=fs.readFileSync(path,'utf8');
  const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const module={exports:{}};cache.set(path,module.exports);
  const localRequire=name=>name==='@neondatabase/serverless'?{neon}:name==='@supabase/supabase-js'?{createClient:()=>auth}:
   name==='@/lib/zoroark/runtime'?load('src/lib/zoroark/runtime.ts'):require(name);
  vm.runInNewContext(js,{module,exports:module.exports,require:localRequire,process:{env},Request,Response,Headers,URL,
   TextEncoder,TextDecoder,Uint8Array,crypto:webcrypto,console},{filename:path});
  return module.exports;
 }
 return {env,calls,runtime:load('src/lib/zoroark/runtime.ts'),route:name=>load(`src/app/api/zoroark/${name}/route.ts`)};
}
export function request(name,body,headers={}){
 return new Request(`https://preview.example/api/zoroark/${name}`,{method:'POST',headers:{origin:'https://preview.example',
  'content-type':'application/json','x-zoroark-request':name==='guest'?'guest-lobby-v1':'gm-lobby-v1',authorization:'Bearer synthetic',...headers},
  body:typeof body==='string'?body:JSON.stringify(body)});
}
