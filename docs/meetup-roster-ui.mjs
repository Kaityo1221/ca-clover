// CA Clover full Meetup roster: both card and overview use the SAME three-column endpoint.
// The previous two-column raffle/check-in module remains separately stored but is not mounted.
const ENDPOINT='https://wgiittrvgtiosogyhfcl.supabase.co/functions/v1/meetup-roster';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
let inFlight=false;
function ensureRosterStyle(){
  if(document.getElementById('meetup-roster-purple-peach-style'))return;
  const style=document.createElement('style');
  style.id='meetup-roster-purple-peach-style';
  style.textContent=[
    '.meetup-roster-button{position:relative;isolation:isolate;overflow:hidden;background:linear-gradient(118deg,#6232bb 0%,#9d47d6 52%,#b35bec 100%)!important;border:1px solid #d4b0ff!important;color:#fff!important;font-weight:800!important;text-shadow:0 1px 2px #53218a;box-shadow:0 3px 12px #7833bc45, inset 0 1px 0 #ffffff65;transition:filter .2s,box-shadow .2s}',
    '.meetup-roster-button:not(:disabled):active{filter:brightness(1.12);box-shadow:0 2px 5px #7833bc4f}',
    '.meetup-roster-button.roster-peach-loading{background:linear-gradient(110deg,#7634c7,#c363d3,#ef8fb8)!important;box-shadow:0 2px 14px #d17aae55;opacity:1!important;cursor:progress}',
    '.meetup-roster-button.roster-peach-loading::before,.meetup-roster-button.roster-peach-loading::after{content:"❀";position:absolute;pointer-events:none;font-size:18px;color:#ffe5f2;text-shadow:0 1px 4px #b03d8d;animation:roster-peach-fall 1.7s ease-in-out infinite;top:-15px;left:9%}',
    '.meetup-roster-button.roster-peach-loading::after{left:84%;font-size:13px;animation-delay:.85s;color:#ffd0e5}',
    '@keyframes roster-peach-fall{0%{transform:translate(0,-10px) rotate(-25deg);opacity:0}30%{opacity:1}100%{transform:translate(18px,66px) rotate(110deg);opacity:0}}',
    '@media (prefers-reduced-motion:reduce){.meetup-roster-button{transition:none}.meetup-roster-button.roster-peach-loading::before,.meetup-roster-button.roster-peach-loading::after{animation:none;top:3px;opacity:.9}}'
  ].join('');
  document.head.append(style);
}

function identityFor(getIdentity){
  const identity=getIdentity?.();
  return identity&&UUID.test(identity.userId||'')&&['ca','admin'].includes(identity.role)
    ? identity : null;
}
async function allowed({client,getIdentity}){
  const initial=identityFor(getIdentity);
  if(!initial)return null;
  if(initial.role==='admin')return initial;
  try{
    const permission=await client.from('user_permissions').select('permission_code')
      .eq('user_id',initial.userId).eq('permission_code','D').maybeSingle();
    if(permission.error||permission.data?.permission_code!=='D')return null;
  }catch{return null;}
  return getIdentity()?.userId===initial.userId?initial:null;
}
function attachAction({root,container,meetup,client,getIdentity,publicKey,compact,identity}){
  if(!root.isConnected||!container.isConnected||!UUID.test(meetup?.id||'')||
     identityFor(getIdentity)?.userId!==identity.userId)return false;
  const userId=identity.userId;
  ensureRosterStyle();
  const wrapper=document.createElement('div');
  wrapper.className=compact?'participant-roster-action':'section';
  if(!compact){
    wrapper.style.cssText='padding:14px;border:1px solid #bddba8;border-radius:15px;background:#f5fce9';
    const heading=document.createElement('h3');heading.textContent='📄 参加者名簿CSV';
    const help=document.createElement('p');help.className='small muted strong';
    help.textContent='チェックイン済みを先頭に、参加表明者を含む3列で出力。不参加者は除外します。';
    wrapper.append(heading,help);
  }
  const button=document.createElement('button');
  button.type='button';button.className=compact?'btn line meetup-roster-button':'btn meetup-roster-button';
  button.textContent=compact?'CSV ↓':'名簿CSVを取得';
  button.setAttribute('aria-label','参加者名簿CSVを取得');
  if(!compact)button.style.width='100%';
  const status=document.createElement('p');
  status.className='small muted strong';status.setAttribute('role','status');
  wrapper.append(button,status);container.append(wrapper);
  button.onclick=async()=>{
    if(inFlight||!root.isConnected||getIdentity()?.userId!==userId)return;
    inFlight=true;button.disabled=true;button.classList.add('roster-peach-loading');button.textContent='名簿を準備中';status.textContent='';
    try{
      const {data,error}=await client.auth.getSession();
      const session=data?.session;
      if(error||!session?.access_token||session?.user?.id!==userId)
        throw new Error('ログインし直してからお試しください');
      const response=await fetch(ENDPOINT,{
        method:'POST',mode:'cors',cache:'no-store',credentials:'omit',redirect:'error',
        headers:{authorization:'Bearer '+session.access_token,
                 apikey:publicKey,'content-type':'application/json','accept':'text/csv'},
        body:JSON.stringify({meetupId:meetup.id,purpose:'attendance',note:''})
      });
      if(response.status!==200){
        if(response.status===401)throw new Error('ログイン情報を確認できませんでした');
        if(response.status===403)throw new Error('この名簿の取得権限がありません');
        if(response.status===429)throw new Error('連続取得は制限されています。しばらくしてお試しください');
        throw new Error('名簿を取得できませんでした');
      }
      const type=response.headers.get('content-type')||'';
      if(!type.toLowerCase().startsWith('text/csv'))throw new Error('CSVの確認に失敗しました');
      const count=response.headers.get('x-ca-clover-roster-count');
      if(!/^(0|[1-9][0-9]{0,3})$/.test(count||'')||Number(count)>5000)
        throw new Error('名簿の人数を確認できませんでした');
      const blob=await response.blob();
      if(blob.size<40||blob.size>8000000)throw new Error('CSVサイズを確認できませんでした');
      if(!root.isConnected||getIdentity()?.userId!==userId)throw new Error('セッションが変わりました');
      const url=URL.createObjectURL(blob);
      const a=document.createElement('a');
      a.hidden=true;a.href=url;a.download='meetup-roster-'+meetup.id+'.csv';
      document.body.append(a);
      try{a.click();status.textContent='CSVの保存を開始しました（'+count+'名）';}
      finally{a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
    }catch(error){
      status.textContent=error instanceof Error?error.message:'CSVを取得できませんでした';
    }finally{
      inFlight=false;
      if(root.isConnected){button.classList.remove('roster-peach-loading');button.disabled=false;button.textContent=compact?'CSV ↓':'名簿CSVを取得';}
    }
  };
  return true;
}
export async function mountRosterButton({root,meetup,client,getIdentity,publicKey}={}){
  if(!root?.isConnected||!client||typeof getIdentity!=='function'||!publicKey)return false;
  const identity=await allowed({client,getIdentity});
  const container=root.querySelector('section.modal');
  return !!(identity&&container&&attachAction({root,container,meetup,client,getIdentity,publicKey,compact:false,identity}));
}
export async function mountRosterCards({root,meetups,client,getIdentity,publicKey,isCurrent=()=>true}={}){
  if(!root?.isConnected||!Array.isArray(meetups)||!client||typeof getIdentity!=='function'||!publicKey)return false;
  const identity=await allowed({client,getIdentity});
  if(!identity||!isCurrent()||!root.isConnected||identityFor(getIdentity)?.userId!==identity.userId)return false;
  if(!document.getElementById('meetup-roster-card-style')){
    const style=document.createElement('style');style.id='meetup-roster-card-style';
    style.textContent='.participant-roster-wrap{min-width:0}.upcoming-strip>.participant-roster-wrap{flex:0 0 min(84vw,420px);scroll-snap-align:start}.participant-roster-wrap>.upcoming-sign{width:100%;box-sizing:border-box}.participant-roster-action{display:flex;justify-content:flex-end;align-items:center;gap:8px;margin:5px 0 10px;flex-wrap:wrap}.participant-roster-action .btn{padding:7px 13px;font-size:12px;width:auto;min-width:64px}.participant-roster-action [role=status]{font-size:11px;max-width:100%;overflow-wrap:anywhere}';
    document.head.append(style);
  }
  let mounted=0;
  for(const card of root.querySelectorAll('[data-meetup-index]')){
    const meetup=meetups[Number(card.dataset.meetupIndex)];
    if(!meetup||!UUID.test(meetup.id||'')||!card.isConnected||card.parentElement?.classList.contains('participant-roster-wrap'))continue;
    const wrap=document.createElement('div');wrap.className='participant-roster-wrap';
    card.replaceWith(wrap);wrap.append(card);
    if(attachAction({root:wrap,container:wrap,meetup,client,getIdentity,publicKey,compact:true,identity})) mounted++;
  }
  return mounted>0;
}
