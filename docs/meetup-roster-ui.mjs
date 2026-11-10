// CA Clover full Meetup roster: both card and overview use the SAME three-column endpoint.
// The previous two-column raffle/check-in module remains separately stored but is not mounted.
const ENDPOINT='https://wgiittrvgtiosogyhfcl.supabase.co/functions/v1/meetup-roster';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
let inFlight=false;

// Ephemeral single-roster cache: never persisted to disk or sent elsewhere.
const MEMORY_TTL_MS=5*60*1000;
let cachedRoster=null;
function currentCached(userId,meetupId){
  if(cachedRoster&&(cachedRoster.expiresAt<=Date.now()||cachedRoster.userId!==userId)){
    cachedRoster=null;
  }
  return cachedRoster&&cachedRoster.meetupId===meetupId?cachedRoster:null;
}
function saveRosterBlob(blob,meetupId){
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.hidden=true;a.href=url;a.download='meetup-roster-'+meetupId+'.csv';
  document.body.append(a);
  try{a.click();}
  finally{a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
}

const COOLDOWN_MS=15000;
let cooldownUntil=0;
let cooldownTimer=null;
const controls=new Set();
const idleLabel=compact=>compact?'CSV ↓':'名簿CSVを取得';
function updateCooldown(){
  const seconds=Math.ceil(Math.max(0,cooldownUntil-Date.now())/1000);
  for(const control of controls){
    if(!control.button.isConnected){controls.delete(control);continue;}
    if(control.resave)control.resave.hidden=!currentCached(control.userId,control.meetupId);
    if(control.button.classList.contains('roster-peach-loading'))continue;
    control.button.disabled=inFlight||seconds>0;
    control.button.textContent=seconds>0?'再試行まであと'+seconds+'秒':idleLabel(control.compact);
  }
  if(seconds===0&&cooldownTimer!==null){clearInterval(cooldownTimer);cooldownTimer=null;}
}
function beginCooldown(){
  cooldownUntil=Math.max(cooldownUntil,Date.now()+COOLDOWN_MS);
  if(cooldownTimer===null)cooldownTimer=setInterval(updateCooldown,500);
  updateCooldown();
}
function downloadLocationHint(){
  // Browsers cannot inspect or open an arbitrary OS download directory.
  const ua=globalThis.navigator?.userAgent||'';
  if(/iPhone|iPad|iPod/i.test(ua)||(ua.includes('Macintosh')&&globalThis.navigator?.maxTouchPoints>1))
    return '「ファイル」→「ブラウズ」→「ダウンロード」';
  if(/Android/i.test(ua))return '「Files」などのアプリ →「ダウンロード」';
  return 'ブラウザのダウンロード履歴をご確認ください';
}

function ensureRosterStyle(){
  if(document.getElementById('meetup-roster-purple-peach-style'))return;
  const style=document.createElement('style');
  style.id='meetup-roster-purple-peach-style';
  style.textContent=[
    '.meetup-roster-button{position:relative;isolation:isolate;overflow:hidden;background:linear-gradient(118deg,#6232bb 0%,#9d47d6 52%,#b35bec 100%)!important;border:1px solid #d4b0ff!important;color:#fff!important;font-weight:800!important;text-shadow:0 1px 2px #53218a;box-shadow:0 3px 12px #7833bc45, inset 0 1px 0 #ffffff65;transition:filter .2s,box-shadow .2s}',
    '.meetup-roster-button:not(:disabled):active{filter:brightness(1.12);box-shadow:0 2px 5px #7833bc4f}',
    '.meetup-roster-button.roster-peach-loading{background:linear-gradient(110deg,#7634c7,#c363d3,#ef8fb8)!important;box-shadow:0 2px 14px #d17aae55;opacity:1!important;cursor:progress}',
    '.meetup-roster-button::before,.meetup-roster-button::after{content:"❀";position:absolute;z-index:-1;pointer-events:none;font-size:15px;color:#ffe5f2;text-shadow:0 1px 4px #b03d8d;animation:roster-peach-fall 3.6s ease-in-out infinite;top:-18px;left:10%;will-change:transform,opacity}',
    '.meetup-roster-button::after{left:77%;font-size:12px;animation-delay:-1.9s;animation-duration:4.3s;color:#ffd0e5}',
    '.meetup-roster-button.roster-peach-loading::before{animation-duration:1.7s;font-size:18px}',
    '.meetup-roster-button.roster-peach-loading::after{animation-duration:2s;font-size:15px}',
    '@keyframes roster-peach-fall{0%{transform:translate(0,-10px) rotate(-25deg);opacity:0}25%{opacity:.75}75%{opacity:.65}100%{transform:translate(18px,65px) rotate(110deg);opacity:0}}',
    '.roster-location-hint{font-size:12px;margin-top:5px;overflow-wrap:anywhere}',
    '.roster-location-button{border:0;background:transparent;color:#7938af;text-decoration:underline;padding:3px;font-size:12px;font-weight:700;cursor:pointer}',
    '.participant-roster-action{position:relative;box-sizing:border-box;display:grid!important;grid-template-columns:minmax(0,1fr) auto;grid-template-rows:40px 22px 26px;align-items:center;column-gap:8px;row-gap:0;min-height:96px;height:96px;margin:5px 0 10px;overflow:visible}',
    '.participant-roster-action>.meetup-roster-button{grid-column:2;grid-row:1;justify-self:end;white-space:nowrap;min-width:126px}',
    '.participant-roster-action>[role=status]{grid-column:1 / -1;grid-row:2;justify-self:end;min-width:0;width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:right;line-height:22px;margin:0}',
    '.participant-roster-action>.roster-secondary-actions{grid-column:1 / -1;grid-row:3;justify-self:end;display:flex;align-items:center;gap:9px;min-width:0;white-space:nowrap}',
    '.roster-secondary-actions{display:flex;gap:10px;align-items:center;justify-content:flex-end;flex-wrap:nowrap}',
    '.roster-secondary-actions>.roster-location-button{font-size:11px;white-space:nowrap;padding:2px}',
    '.roster-resave-button{border:0;background:transparent;color:#7938af;text-decoration:underline;padding:2px;font-size:11px;font-weight:700;white-space:nowrap;cursor:pointer}',
    '.participant-roster-action>.roster-location-hint{position:absolute;z-index:20;top:calc(100% - 4px);right:0;margin:0;padding:9px 12px;max-width:calc(100vw - 48px);border-radius:9px;border:1px solid #d7bee9;background:#fff;color:#432265;box-shadow:0 7px 24px #3620472e}',
    '.participant-roster-action>.roster-location-hint[hidden]{display:none}',

    '@media (prefers-reduced-motion:reduce){.meetup-roster-button{transition:none}.meetup-roster-button::before,.meetup-roster-button::after{animation:none;top:3px;opacity:.55}}'
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
  const guide=document.createElement('button');
  guide.type='button';guide.className='roster-location-button';
  guide.textContent='📁 保存したファイルを探す';guide.hidden=true;
  const hint=document.createElement('p');hint.className='roster-location-hint';hint.hidden=true;
  guide.onclick=()=>{hint.hidden=!hint.hidden;if(!hint.hidden)hint.textContent=downloadLocationHint();};
  const resave=document.createElement('button');
  resave.type='button';resave.className='roster-resave-button';
  resave.textContent='もう一度保存';resave.hidden=!currentCached(userId,meetup.id);
  resave.setAttribute('aria-label','前回の名簿を通信なしでもう一度保存');
  const actionLinks=document.createElement('div');
  actionLinks.className='roster-secondary-actions';
  actionLinks.append(resave,guide);
  wrapper.append(button,status,actionLinks,hint);container.append(wrapper);
  const control={button,compact,resave,meetupId:meetup.id,userId};
  controls.add(control);
  updateCooldown();
  resave.onclick=async()=>{
    if(inFlight||!root.isConnected||getIdentity()?.userId!==userId)return;
    const previous=currentCached(userId,meetup.id);
    if(!previous){resave.hidden=true;status.textContent='一時保存の期限が切れました';return;}
    resave.disabled=true;
    try{
      const {data,error}=await client.auth.getSession();
      if(error||!data?.session?.access_token||data.session.user?.id!==userId)
        throw new Error('ログインし直してからお試しください');
      const roleCheck=await client.from('profiles').select('role').eq('id',userId).maybeSingle();
      if(roleCheck.error||!['admin','ca'].includes(roleCheck.data?.role))
        throw new Error('名簿の利用権限を確認できません');
      if(roleCheck.data.role==='ca'&&!await allowed({client,getIdentity:()=>({userId,role:'ca'})}))
        throw new Error('名簿の利用権限を確認できません');
      if(!root.isConnected||!currentCached(userId,meetup.id))
        throw new Error('一時保存の期限が切れました');
      saveRosterBlob(previous.blob,meetup.id);
      status.textContent='前回の名簿を再保存しました（'+previous.count+'名）';
      guide.hidden=false;
    }catch(error){
      status.textContent=error instanceof Error?error.message:'再保存に失敗しました';
    }finally{resave.disabled=false;updateCooldown();}
  };
  button.onclick=async()=>{
    if(inFlight||Date.now()<cooldownUntil||!root.isConnected||getIdentity()?.userId!==userId)return;
    inFlight=true;button.disabled=true;button.classList.add('roster-peach-loading');button.textContent='名簿を準備中';status.textContent='';
    guide.hidden=true;hint.hidden=true;updateCooldown();
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
      if(response.status===200||response.status===429)beginCooldown();
      if(response.status!==200){
        if(response.status===401)throw new Error('ログイン情報を確認できませんでした');
        if(response.status===403)throw new Error('この名簿の取得権限がありません');
        if(response.status===429)throw new Error('取得制限中：15秒間隔・1時間12回まで。時間を空けて再試行してください');
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
      saveRosterBlob(blob,meetup.id);
      cachedRoster={blob,userId,meetupId:meetup.id,count,expiresAt:Date.now()+MEMORY_TTL_MS};
      status.textContent='ダウンロードしました（'+count+'名）';guide.hidden=false;
      updateCooldown();
    }catch(error){
      status.textContent=error instanceof Error?error.message:'CSVを取得できませんでした';
      status.title=status.textContent;
    }finally{
      inFlight=false;
      if(root.isConnected)button.classList.remove('roster-peach-loading');
      updateCooldown();
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
    style.textContent='.participant-roster-wrap{min-width:0}.upcoming-strip>.participant-roster-wrap{flex:0 0 min(84vw,420px);scroll-snap-align:start}.participant-roster-wrap>.upcoming-sign{width:100%;box-sizing:border-box}.participant-roster-action .btn{padding:7px 13px;font-size:12px;width:auto}.participant-roster-action [role=status]{font-size:11px}';
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
