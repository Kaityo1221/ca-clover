import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import vm from "node:vm";

const js=await readFile(new URL("../docs/auth-session-72h.js",import.meta.url),"utf8");
const docPaths=["index.html","stamp-rally.html","admin.html","stamp-exchange.html","stamp-bulk.html","stamp-events.html","stamp-exchange-community.html","stamp-kanto.html","map.html"];
for(const name of docPaths){
 const html=await readFile(new URL("../docs/"+name,import.meta.url),"utf8");
 assert.ok(html.includes("./auth-session-72h.js?v=20261122-v1"),name+" loads session guard");
 assert.ok(html.includes("window.CAAuth72.install(client"),name+" installs session guard");
}
const HOUR=3600000;
const make=(start,signin=start,share=null)=>{
 let now=start,session={user:{id:"trainer-a",last_sign_in_at:new Date(signin).toISOString()},access_token:"token-a"};
 const store=share||new Map();
 const callbacks=[];
 const timerCalls=[];
 let signedOut=0,expired=0,redirected=0;
 class Clock extends Date {static now(){return now}}
 const root={
  localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)},
  setTimeout:(fn,delay)=>{timerCalls.push({fn,delay});return timerCalls.length},
  clearTimeout:()=>{},
  addEventListener:()=>{},
  document:{hidden:false,addEventListener:()=>{}},
  location:{href:"https://example.test/ca-clover/",replace:()=>{redirected++}},
 };
 const auth={
  getSession:async()=>({data:{session},error:null}),
  signOut:async()=>{signedOut++;session=null;callbacks.forEach(f=>f("SIGNED_OUT",null));return {error:null}},
  onAuthStateChange:f=>{callbacks.push(f);return {data:{subscription:{unsubscribe(){}}}}},
 };
 vm.runInNewContext(js,{window:root,Date:Clock});
 root.CAAuth72.install({auth},{onExpire:()=>{expired++}});
 return {auth,root,store,timerCalls,callbacks,now:t=>{now=t},read:()=>JSON.parse(store.get("ca-clover-auth-login-72h-v1")||"null"),setSession:(s)=>{session=s},get signedOut(){return signedOut},get expired(){return expired},get redirected(){return redirected}};
};
const epoch=Date.parse("2026-11-22T00:00:00Z");
const h=make(epoch);
await h.auth.getSession();
assert.equal(h.read().startedAt,epoch);
assert.equal(h.signedOut,0);
h.now(epoch+71*HOUR);
await h.auth.getSession();
assert.equal(h.read().startedAt,epoch,"refresh does not extend original login time");
assert.equal(h.signedOut,0);
h.now(epoch+72*HOUR);
const result=await h.auth.getSession();
assert.equal(result.data.session,null,"at exactly 72h the guard hides the session");
assert.equal(h.expired,1,"expiration invokes UI logout callback");
await Promise.resolve();
assert.equal(h.signedOut,1,"expired session signs out locally");
const next={user:{id:"trainer-a",last_sign_in_at:new Date(epoch+73*HOUR).toISOString()},access_token:"token-new"};
h.setSession(next);
h.now(epoch+73*HOUR);
await h.auth.getSession();
assert.equal(h.read().startedAt,epoch+73*HOUR,"new OAuth login starts a fresh 72h clock");
assert.equal(h.signedOut,1);
const existing=new Map();
existing.set("ca-clover-auth-login-72h-v1",JSON.stringify({userId:"trainer-a",startedAt:epoch}));
const old=make(epoch+73*HOUR,epoch,existing);
assert.equal((await old.auth.getSession()).data.session,null,"reopening a page after deadline cannot resume expired login");
assert.equal(old.expired,1);
const unavailable=make(epoch);
unavailable.setSession({user:{id:"trainer-a"},access_token:"x"});
await unavailable.auth.getSession();
assert.equal(unavailable.read().startedAt,epoch,"missing last-sign-in uses a persistent first-seen fallback");
console.log("PASS: absolute 72h expiry, active refresh, fresh OAuth, direct reopening, fallback, and 9 Pages entry points");
