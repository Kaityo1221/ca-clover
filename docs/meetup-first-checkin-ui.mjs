// sonicborn: isolated UI for first CHECKED_IN by Community across 1st / 2nd CA.
// Only already-aggregated integers reach the browser. No participant roster or ID.
export const APPROVED_FIRST_CHECKIN_URL =
  'https://wgiittrvgtiosogyhfcl.supabase.co/functions/v1/ca-first-checkin';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function normalizeFirstCheckinResponse(body,meetupIds){
  if(!body||body.version!==1||!Array.isArray(meetupIds)||!meetupIds.every(id=>UUID.test(id)))
    return {status:'unavailable',counts:null};
  if(body.status==='insufficient_history')return {status:'insufficient_history',counts:null};
  if(body.status!=='verified'||!body.counts||typeof body.counts!=='object'||
     Array.isArray(body.counts)||!Number.isFinite(Date.parse(body.asOf)))
    return {status:'unavailable',counts:null};
  const counts=Object.create(null);
  for(const id of meetupIds){
    if(!Object.hasOwn(body.counts,id))continue;
    const n=body.counts[id];
    if(!Number.isSafeInteger(n)||n<0||n>5000)return {status:'unavailable',counts:null};
    counts[id]=n;
  }
  return {status:'verified',counts:{...counts}};
}
export function firstCheckinLabel(model,id){
  if(model?.status==='insufficient_history')return '初チェックイン 履歴不足';
  if(model?.status!=='verified'||!model.counts)return '初チェックイン 未確認';
  if(!Object.hasOwn(model.counts,id))return '初チェックイン —';
  return '初チェックイン '+model.counts[id]+'人';
}
export function mountFirstCheckins({
  root,meetups,communityId,client,publicKey,endpoint='',getIdentity,isCurrent,
  fetcher=globalThis.fetch
}={}){
  if(!root||!Array.isArray(meetups)||!UUID.test(communityId||'')||
     typeof getIdentity!=='function'||typeof isCurrent!=='function')return ()=>{};
  const ids=meetups.map(m=>m?.id).filter(x=>UUID.test(x||''));
  const unique=[...new Set(ids)];
  const labels=new Map();
  for(const entry of root.querySelectorAll('.history-entry')){
    const id=entry.dataset.historyMeetup;
    if(!unique.includes(id))continue;
    const tags=entry.querySelector('.history-body .tags');
    if(!tags)continue;
    const label=document.createElement('span');
    label.className='pill slate history-first-checkin';
    label.setAttribute('aria-live','polite');
    label.textContent='初チェックイン 準備中';
    tags.append(label);
    labels.set(id,label);
  }
  const abort=new AbortController();
  let active=true;
  const current=()=>active&&!abort.signal.aborted&&isCurrent()&&root.isConnected;
  const apply=model=>{
    if(!current())return;
    for(const [id,label] of labels)label.textContent=firstCheckinLabel(model,id);
  };
  const cleanup=()=>{active=false;abort.abort();};
  if(!labels.size||!endpoint)return cleanup;
  // Never forward an authenticated token to a different URL supplied by a page.
  if(endpoint!==APPROVED_FIRST_CHECKIN_URL||typeof fetcher!=='function'){
    apply({status:'unavailable'});return cleanup;
  }
  void (async()=>{
    try{
      if(!current())return;
      const identity=getIdentity();
      if(!identity||!UUID.test(identity.userId||'')||!['ca','admin'].includes(identity.role))
        throw Error('UNAUTHORIZED');
      const {data,error}=await client.auth.getSession();
      if(error||!data?.session?.access_token||data.session.user?.id!==identity.userId)
        throw Error('UNAUTHORIZED');
      if(!current()||getIdentity()?.userId!==identity.userId)return;
      const response=await fetcher(endpoint,{
        method:'POST',mode:'cors',cache:'no-store',redirect:'error',
        credentials:'omit',signal:abort.signal,
        headers:{authorization:'Bearer '+data.session.access_token,
          apikey:publicKey,'content-type':'application/json','accept':'application/json'},
        body:JSON.stringify({communityId})
      });
      if(!current())return;
      if(!response.ok||(response.headers.get('content-type')||'').split(';')[0].toLowerCase()!=='application/json')
        throw Error('UNAVAILABLE');
      const body=await response.json();
      apply(normalizeFirstCheckinResponse(body,unique));
    }catch(error){
      if(error?.name==='AbortError')return;
      apply({status:'unavailable'});
    }
  })();
  return cleanup;
}
