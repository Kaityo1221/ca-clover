import {createCsvClient} from './participant-export/client-adapter.mjs';
const PURPOSES=[['minigame','ミニゲーム利用'],['attendance','出欠確認と照合のため'],['operations','イベント運営'],['other','その他']];
const validId=value=>typeof value==='string'&&/^[a-f0-9-]{36}$/i.test(value);
export function createParticipantPanel({client,getIdentity,fetcher=fetch,document:doc=globalThis.document,endpoint='https://wgiittrvgtiosogyhfcl.supabase.co/functions/v1/participant-export',saveBlob}={}){
  if(!client||typeof getIdentity!=='function'||typeof fetcher!=='function'||!doc)throw TypeError('app dependencies required');
  let userId,api,dialog,selectedMeetup,lastFocus,pending=false,refreshTimer;
  let mounted=[];
  const identity=()=>getIdentity()??{};
  const current=()=>identity().userId===userId&&identity().role==='ca';
  const setStatus=text=>{
    if(!dialog?.isConnected)return;
    const target=dialog.querySelector('[data-csv-status]');
    const verified=/^人数確認済み ([0-9]+)人 \/ (.+)$/.exec(text);
    if(verified&&Number.isFinite(Date.parse(verified[2]))){
      const time=new Intl.DateTimeFormat('ja-JP',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date(verified[2]));
      target.replaceChildren(doc.createTextNode('人数確認済み '+verified[1]+'人'),doc.createElement('br'),doc.createTextNode('確認時刻：'+time+'（日本時間）'));
    }else target.textContent=text;
  };
  function refresh(){
    const state=api?.getState();
    for(const b of mounted)if(b.isConnected){b.disabled=!current()||pending||state?.canStart===false;b.title=state?.retryAfterMs?`再取得まで${Math.ceil(state.retryAfterMs/1000)}秒`:'';}
    if(dialog?.isConnected){const submit=dialog.querySelector('[data-csv-submit]');submit.disabled=pending||!current()||state?.canStart===false;submit.textContent=pending?'取得中…':state?.retryAfterMs?'再取得まで'+Math.ceil(state.retryAfterMs/1000)+'秒':'最新の名簿を取得';dialog.querySelector('[data-csv-close]').disabled=pending;}
    clearTimeout(refreshTimer);
    if(!pending&&state?.retryAfterMs>0)refreshTimer=setTimeout(refresh,Math.min(1000,state.retryAfterMs));
  }
  function close(){
    clearTimeout(refreshTimer);
    if(dialog?.isConnected){dialog.close();dialog.remove();}
    dialog=undefined;selectedMeetup=undefined;
    if(lastFocus?.isConnected)lastFocus.focus();
  }
  function leave(){api?.cancel();close();mounted=[];}
  async function download(response,signal){
    const activeMeetup=selectedMeetup;
    if(signal.aborted||!current()||!validId(activeMeetup))throw Error();
    const reader=response.body?.getReader();if(!reader)throw Error();
    let size=0;const parts=[];
    try{for(;;){if(signal.aborted||!current()||selectedMeetup!==activeMeetup)throw Error();const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>2_000_000)throw Error();parts.push(part.value);}}
    finally{void reader.cancel().catch(()=>{});reader.releaseLock();}
    if(signal.aborted||!current()||selectedMeetup!==activeMeetup||size===0)throw Error();
    const blob=new Blob(parts,{type:'text/csv;charset=utf-8'});
    const filename='participants-'+activeMeetup+'.csv';
    if(saveBlob){await saveBlob(blob,filename,signal);return;}
    const url=URL.createObjectURL(blob),link=doc.createElement('a');
    try{link.href=url;link.download=filename;link.hidden=true;doc.body.append(link);link.click();}
    finally{link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  }
  function ensureApi(id){
    if(api&&userId===id)return;
    api?.cancel();userId=id;
    api=createCsvClient({endpoint,origin:'https://wgiittrvgtiosogyhfcl.supabase.co',fetcher,download,onStatus:setStatus,
      getBearer:async()=>{const r=await client.auth.getSession();if(!current()||r.error||r.data?.session?.user?.id!==userId||!r.data?.session?.access_token)throw Error();return r.data.session.access_token;}});
  }
  function open(meetup,trigger){
    if(!current()||pending||!api.getState().canStart)return;
    close();lastFocus=trigger;selectedMeetup=meetup.id;
    dialog=doc.createElement('dialog');dialog.className='participant-csv-dialog';
    dialog.innerHTML='<form><h2>チェックイン名簿CSV</h2><p data-csv-meetup></p><label>利用目的<select class="input" name="purpose" required></select></label><label class="section" style="display:block">補足情報<textarea class="input" name="note" maxlength="300" rows="3" placeholder="通常は任意。「その他」は入力してください"></textarea></label><p class="small muted">ミニゲーム・表彰など、申告した目的で利用してください。取得者・目的・件数・時刻を記録します。名簿を共有せず、利用後は削除してください。補足に参加者の個人情報を書かないでください。</p><p class="small muted">CSV：表示名／抽選番号（同じMeetup内で固定）。確認後にチェックインした方は再取得で反映します。</p><p data-csv-status role="status" aria-live="polite"></p><div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap"><button type="button" class="btn line" data-csv-close>閉じる</button><button type="submit" class="btn" data-csv-submit>最新の名簿を取得</button></div></form>';
    dialog.querySelector('[data-csv-meetup]').textContent=String(meetup.title??'Meetup');
    const form=dialog.querySelector('form'),select=form.elements.namedItem('purpose'),note=form.elements.namedItem('note');
    for(const [value,label] of PURPOSES){const option=doc.createElement('option');option.value=value;option.textContent=label;select.append(option);}
    select.addEventListener('change',()=>{note.required=select.value==='other';});
    dialog.querySelector('[data-csv-close]').onclick=close;
    dialog.addEventListener('cancel',event=>{event.preventDefault();if(!pending)close();});
    form.addEventListener('submit',async event=>{
      event.preventDefault();if(pending||!current()||!api.getState().canStart||!form.reportValidity())return;
      const body={meetupId:meetup.id,purpose:select.value,note:note.value.trim()};
      if(!PURPOSES.some(([v])=>v===body.purpose)||body.note.length>300||/[\p{Cc}\p{Cf}]/u.test(body.note)||(body.purpose==='other'&&!body.note)){setStatus('補足情報を確認してください');return;}
      pending=true;refresh();
      try{const result=await api.exportCsv(body);if(result.kind==='blocked')setStatus('しばらくして再試行');}
      finally{pending=false;refresh();}
    });
    doc.body.append(dialog);dialog.showModal();select.focus();refresh();
  }
  async function mount({root,meetups,communityId,isCurrent=()=>true}){
    const who=identity();
    if(who.role!=='ca'||!validId(who.userId)||!validId(communityId))return false;
    const cards=[...root.querySelectorAll('[data-meetup-index]')];
    let permission,membership;
    try{[permission,membership]=await Promise.all([
      client.from('user_permissions').select('permission_code').eq('user_id',who.userId).eq('permission_code','D').maybeSingle(),
      client.from('community_memberships').select('community_id').eq('user_id',who.userId).eq('community_id',communityId).maybeSingle(),
    ]);}catch{return false;}
    if(permission?.error||membership?.error||permission?.data?.permission_code!=='D'||membership?.data?.community_id!==communityId||
      identity().userId!==who.userId||identity().role!=='ca'||!isCurrent()||!root.isConnected)return false;
    ensureApi(who.userId);mounted=[];
    if(!doc.getElementById('participant-csv-style')){
      const style=doc.createElement('style');style.id='participant-csv-style';
      style.textContent='.participant-csv-wrap{min-width:0}.upcoming-strip>.participant-csv-wrap{flex:0 0 min(84vw,420px);scroll-snap-align:start}.participant-csv-wrap>.upcoming-sign{width:100%;box-sizing:border-box}.participant-csv-action{display:flex;justify-content:flex-end;margin:5px 0 10px}.participant-csv-action .btn{padding:7px 13px;font-size:12px}.participant-csv-dialog{box-sizing:border-box;width:min(540px,calc(100vw - 24px));max-height:90dvh;overflow:auto;border:1px solid #d9e7c9;border-radius:20px;padding:22px;color:#26402b}.participant-csv-dialog::backdrop{background:rgba(15,32,20,.5)}.participant-csv-dialog .input{box-sizing:border-box;width:100%}.participant-csv-dialog [data-csv-status]{min-height:1.5em;font-weight:700;font-size:13px;overflow-wrap:anywhere}';doc.head.append(style);
    }
    for(const card of cards){
      const meetup=meetups[Number(card.dataset.meetupIndex)];
      if(!card.isConnected||!meetup||!validId(meetup.id)||card.parentElement?.classList.contains('participant-csv-wrap'))continue;
      const wrap=doc.createElement('div');wrap.className='participant-csv-wrap';card.replaceWith(wrap);wrap.append(card);
      const bar=doc.createElement('div');bar.className='participant-csv-action';
      const button=doc.createElement('button');button.type='button';button.className='btn line';button.dataset.csvMeetup=meetup.id;button.textContent='CSV ↓';button.setAttribute('aria-label','チェックイン名簿CSV');
      button.onclick=()=>open(meetup,button);bar.append(button);wrap.append(bar);mounted.push(button);
    }
    refresh();return true;
  }
  return Object.freeze({mount,leave});
}
