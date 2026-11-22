(function(root){
"use strict";
const LIFE_MS=72*60*60*1000;
const KEY="ca-clover-auth-login-72h-v1";
function install(client,options){
 if(!client||!client.auth||client.auth.__ca72hInstalled)return;
 const auth=client.auth;
 const originalGet=auth.getSession.bind(auth);
 const originalSignOut=auth.signOut.bind(auth);
 const config=options||{};
 let deadline=0,timer=null,expiring=false,currentUserId=null,fallbackRecord=null,blockedLogin=null;
 function read(){
  try{const v=JSON.parse(root.localStorage.getItem(KEY)||"null");return v&&typeof v==="object"?v:null}catch(_){return fallbackRecord}
 }
 function write(record){
  fallbackRecord=record;
  try{root.localStorage.setItem(KEY,JSON.stringify(record))}catch(_){}
 }
 function forget(){
  fallbackRecord=null;
  try{root.localStorage.removeItem(KEY)}catch(_){}
 }
 function stop(){if(timer!==null){root.clearTimeout(timer);timer=null}}
 function onExpired(){
  try{
   if(typeof config.onExpire==="function")config.onExpire();
   else if(config.redirectTo&&root.location?.href!==config.redirectTo)root.location.replace(config.redirectTo);
  }catch(_){}
 }
 async function expire(){
  if(expiring)return;
  expiring=true;stop();
  onExpired();
  try{await originalSignOut({scope:"local"})}catch(_){}
 }
 function assess(session){
  if(!session?.user?.id){stop();return true}
  if(expiring)return false;
  const now=Date.now(),id=String(session.user.id);
  const parsed=Date.parse(session.user.last_sign_in_at||"");
  const reported=Number.isFinite(parsed)&&parsed>0&&parsed<=now+300000?parsed:null;
  // Prevent an in-flight getSession from reactivating the login after signOut.
  // A genuinely newer OAuth sign-in is allowed to start a fresh three-day window.
  if(blockedLogin?.userId===id){
   if(reported===null||reported<=blockedLogin.startedAt+1000)return false;
   blockedLogin=null;
  }
  const stored=read();
  let started;
  if(stored?.userId===id&&Number.isFinite(stored.startedAt)&&stored.startedAt>0){
   started=stored.startedAt;
   // Google OAuth performed again: refresh timestamp only on a genuinely newer login.
   if(reported!==null&&reported>started+1000)started=reported;
  }else{
   started=reported!==null?reported:now;
  }
  currentUserId=id;
  if(!stored||stored.userId!==id||stored.startedAt!==started)write({userId:id,startedAt:started});
  deadline=started+LIFE_MS;
  stop();
  if(now>=deadline){blockedLogin={userId:id,startedAt:started};void expire();return false}
  timer=root.setTimeout(()=>{void checkNow()},Math.min(deadline-now+40,2147483647));
  return true;
 }
 async function checkNow(){
  if(expiring)return;
  try{const result=await originalGet();assess(result?.data?.session)}catch(_){}
 }
 auth.getSession=async function(){
  const result=await originalGet(...arguments);
  if(!result?.data?.session)return result;
  if(assess(result.data.session))return result;
  return {...result,data:{...result.data,session:null,user:null}};
 };
 // Keep timestamps stable across token refreshes, refocuses and navigation.
 if(typeof auth.onAuthStateChange==="function"){
  auth.onAuthStateChange((event,session)=>{
   if(event==="SIGNED_OUT"){
    stop();deadline=0;currentUserId=null;forget();expiring=false;
   }else if(session){
    if(event==="SIGNED_IN"&&blockedLogin?.userId===String(session.user?.id)&&!session.user?.last_sign_in_at)blockedLogin=null;
    // Never await signOut inside the Supabase auth event callback.
    Promise.resolve().then(()=>assess(session));
   }
  });
 }
 if(root.document?.addEventListener){
  root.document.addEventListener("visibilitychange",()=>{if(!root.document.hidden)void checkNow()});
 }
 if(root.addEventListener){
  root.addEventListener("focus",()=>{void checkNow()});
  root.addEventListener("storage",e=>{if(e.key===KEY)void checkNow()});
 }
 auth.__ca72hInstalled=true;
 // Covers pages that do not otherwise call getSession immediately.
 Promise.resolve().then(()=>{void checkNow()});
}
root.CAAuth72={install,LIFE_MS};
})(window);
