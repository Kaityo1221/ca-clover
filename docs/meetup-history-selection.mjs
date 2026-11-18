import {MEETUP_BATCH_ENDPOINT} from './meetup-batch-config.mjs?v=20261114-live1';
import {RosterBatch} from './meetup-roster-batch.mjs';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function sessionKey(token){try{return JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).session_id||null;}catch{return null;}}
export async function mountHistorySelection({root,meetups,communityId,client,publicKey,getIdentity,isCurrent,endpoint=MEETUP_BATCH_ENDPOINT}){
  // Production safety gate: do not advertise CSV batch mode until the
  // audited Edge endpoint has passed real-auth integration and is configured.
  // Individual roster CSV remains available through its existing control.
  if(!endpoint)return ()=>{};
  let disposed=false,mode=false,job=null,timer=null,waiting=null;
  const MAX_SELECTED=20;
  const userId=getIdentity()?.userId,selected=new Set();
  const current=()=>!disposed&&root.isConnected&&isCurrent()&&getIdentity()?.userId===userId;
  const authorize=async()=>{
    if(!current())throw Error('FORBIDDEN');
    const {data,error}=await client.auth.getSession();const s=data?.session;
    if(error||!s?.access_token||s.user?.id!==userId)throw Error('FORBIDDEN');
    const role=await client.from('profiles').select('role').eq('id',userId).maybeSingle();
    if(role.error||!['ca','admin'].includes(role.data?.role))throw Error('FORBIDDEN');
    if(role.data.role==='ca'){
      const d=await client.from('user_permissions').select('permission_code').eq('user_id',userId).eq('permission_code','D').maybeSingle();
      const member=await client.from('community_memberships').select('community_id').eq('user_id',userId).eq('community_id',communityId).maybeSingle();
      if(d.error||d.data?.permission_code!=='D'||member.error||member.data?.community_id!==communityId)throw Error('FORBIDDEN');
    }
    const sid=sessionKey(s.access_token);
    if(!current()||!sid)throw Error('FORBIDDEN');
    return {userId,sessionId:sid,accessToken:s.access_token,publicKey};
  };
  const dispose=()=>{disposed=true;job?.destroy();clearInterval(timer);if(waiting){clearTimeout(waiting.timer);waiting.resolve();waiting=null;}window.removeEventListener('pagehide',dispose);};
  try{await authorize();}catch{return dispose;}
  if(!current())return dispose;
  const tabs=document.createElement('div');tabs.className='history-tabs';tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','Meetup履歴の表示');
  const list=document.createElement('button'),csv=document.createElement('button');
  list.type=csv.type='button';list.textContent='☷ 履歴一覧';csv.textContent='↓ CSV選択';
  for(const [button,id] of [[list,'history-list-tab'],[csv,'history-csv-tab']]){button.id=id;button.setAttribute('role','tab');button.setAttribute('aria-controls','meetup-history-list');}
  tabs.append(list,csv);root.querySelector('.history-controls').before(tabs);
  const panel=document.createElement('div');panel.className='batch-panel';panel.hidden=true;
  panel.innerHTML='<div class="batch-count" aria-live="polite"></div><div class="batch-tools"><button type="button" data-select-all>先頭20件を選択</button><button type="button" data-select-none>全解除</button></div><p class="batch-help">表示が20件を超える場合は先頭20件だけを選択します。最大20件・10件ずつ順次取得・CSV合計8MBまで。表示やカテゴリを変えると選択はリセットされます。</p><p>15秒以上の取得間隔を維持します。20件の取得は数分かかることがあります。取得済み分はこの画面で最大70分保持し、画面を離れると破棄します。</p><progress max="20" value="0" aria-label="取得済みMeetup数"></progress><p class="batch-status" role="status"></p><button type="button" class="btn" data-batch-run></button><button type="button" class="btn batch-cancel" data-batch-cancel hidden>中止してデータを破棄</button>';
  tabs.after(panel);
  const count=panel.querySelector('.batch-count'),status=panel.querySelector('.batch-status'),run=panel.querySelector('[data-batch-run]'),cancel=panel.querySelector('[data-batch-cancel]'),progress=panel.querySelector('progress');
  const checks=[];
  for(const entry of root.querySelectorAll('.history-entry')){
    const id=entry.dataset.historyMeetup;if(!UUID.test(id||''))continue;
    const label=document.createElement('label');label.className='history-check';label.hidden=true;
    const input=document.createElement('input');input.type='checkbox';input.value=id;
    input.setAttribute('aria-label',String(meetups.find(m=>m.id===id)?.title||'Meetup')+'を選択');
    label.append(input,document.createTextNode('このMeetupを選択'));entry.prepend(label);checks.push({input,label});
    input.onchange=()=>{
      if(input.checked&&selected.size>=MAX_SELECTED&&!selected.has(id)){
        input.checked=false;
        status.textContent='1回に選べるのは20件までです。別のMeetupのチェックを外してから選択してください。';
        update();return;
      }
      clearJob();if(input.checked)selected.add(id);else selected.delete(id);update();
    };
  }
  function clearJob(){job?.destroy();job=null;status.textContent='';}
  function update(){
    if(!current())return;
    list.setAttribute('aria-selected',String(!mode));csv.setAttribute('aria-selected',String(mode));list.tabIndex=mode?-1:0;csv.tabIndex=mode?0:-1;
    const content=root.querySelector('#meetup-history-list');if(content){content.setAttribute('role','tabpanel');content.setAttribute('aria-labelledby',mode?csv.id:list.id);}
    panel.hidden=!mode;
    for(const {input,label} of checks){label.hidden=!mode;input.checked=selected.has(input.value);input.disabled=!!job?.busy;}
    panel.querySelectorAll('.batch-tools button').forEach(b=>b.disabled=!!job?.busy);
    count.textContent='選択中 '+selected.size+' / '+MAX_SELECTED+'件'+(checks.length>MAX_SELECTED?'（表示'+checks.length+'件のうち）':'');
    const remaining=job?Math.max(0,Math.ceil((job.retryAt-Date.now())/1000)):0;
    const complete=job&&!job.destroyed&&job.files.length===job.meetups.length;
    run.disabled=!!job?.busy||selected.size===0||selected.size>20||!endpoint||(!complete&&remaining>0);
    run.textContent=selected.size>20?'20件以下に絞ってください':!endpoint?'一括保存は準備中':job?.busy?'名簿を取得中…':complete?'ZIPを保存（'+job.files.length+'件）':remaining?'再試行まで '+Math.ceil(remaining/60)+'分 '+remaining%60+'秒':job?'未取得分を再試行':'選択した'+selected.size+'件を取得';
    progress.max=job?.meetups.length||20;progress.value=job?.files.length||0;cancel.hidden=!job;
  }
  function selectFirstTwenty(){selected.clear();checks.slice(0,MAX_SELECTED).forEach(({input})=>selected.add(input.value));}
  function setMode(value){
    if(job?.busy)return;
    mode=value;clearJob();selected.clear();
    if(mode)status.textContent='未選択です。必要なMeetupにチェックを入れてください。';
    update();
  }
  list.onclick=()=>setMode(false);csv.onclick=async()=>{try{await authorize();setMode(true);}catch{dispose();tabs.remove();panel.remove();}};
  tabs.onkeydown=event=>{if(['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();(document.activeElement===list?csv:list).focus();}};
  panel.querySelector('[data-select-all]').onclick=()=>{clearJob();selectFirstTwenty();if(checks.length>MAX_SELECTED)status.textContent='先頭20件を選択しました。';update();};
  panel.querySelector('[data-select-none]').onclick=()=>{clearJob();selected.clear();update();};
  cancel.onclick=()=>{clearJob();if(waiting){clearTimeout(waiting.timer);waiting.resolve();waiting=null;}status.textContent='中止しました。取得済みデータを破棄しました。';update();};
  run.onclick=async()=>{
    if(run.disabled||!current())return;
    try{
      const identity=await authorize();
      if(job?.files.length===job?.meetups.length&&job){
        const blob=await job.zip();if(!current())return;
        const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='meetup-rosters-'+new Date().toISOString().slice(0,10)+'.zip';a.hidden=true;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
        status.textContent='ZIPの保存を開始しました（'+job.files.length+'件）。ブラウザのダウンロードをご確認ください。';return;
      }
      if(!job||job.destroyed){job=new RosterBatch({meetups:meetups.filter(m=>selected.has(m.id)),...identity,endpoint,authorize,onProgress:update});}
      const active=job;
      for(;;){
        const task=active.run();update();const complete=await task;
        if(!current()||job!==active||active.destroyed)return;
        status.textContent=active.files.length+' / '+active.meetups.length+'件取得済み · '+(active.bytes/1000).toFixed(1)+'KB / 8MB';update();
        if(complete){status.textContent+='。ZIPを保存できます。';break;}
        // Only the successful next stage starts automatically. Any failure stops this loop.
        status.textContent+='。次の10件まで15秒待機します。';
        await new Promise(resolve=>{waiting={resolve,timer:setTimeout(()=>{waiting=null;resolve();},15010)};});
        if(!current()||job!==active||active.destroyed)return;
      }
    }catch(error){
      if(!current())return;
      const messages={RATE_LIMITED:'取得制限で停止しました。取得済み分を保持しています。待機後に未取得分を再試行できます。',
        BYTE_LIMIT:'CSV合計が8MBを超えるため中止しました。選択を減らしてください。',FORBIDDEN:'利用権限またはログインを確認できません。取得済みデータを破棄しました。',EXPIRED:'一時保持の期限が切れました。再選択してください。',WAIT:'取得間隔を空けて再試行してください。',BUSY:'別のCSVを取得中です。完了後にお試しください。'};
      if(error.message==='FORBIDDEN'){job?.destroy();}
      status.textContent=messages[error.message]||'取得に失敗したため停止しました。取得済み分を保持しています。待機後に再試行してください。';
    }finally{update();}
  };
  timer=setInterval(()=>{
    if(!current()){dispose();return;}
    if(job&&!job.destroyed&&Date.now()>=job.expiresAt){clearJob();status.textContent='一時保持の期限が切れたため、データを破棄しました。';}
    update();
  },500);
  window.addEventListener('pagehide',dispose,{once:true});update();return dispose;
}
