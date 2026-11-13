// "交換時の一言" owner-controlled UI. No writes if the backend feature is absent.
export function mountExchangeMessage({host,client,session,role,onChange=()=>{}}){
  const TABLE='ca_exchange_messages';
  const MAX_LENGTH=60;
  const allowed=(role==='ca'||role==='admin')&&!!session?.user?.id;
  const input=host.querySelector('#exchangeMessageInput');
  const count=host.querySelector('#exchangeMessageCount');
  const save=host.querySelector('#exchangeMessageSave');
  const remove=host.querySelector('#exchangeMessageDelete');
  const status=host.querySelector('#exchangeMessageStatus');
  const preview=host.querySelector('#exchangeMessagePreview');
  const previewText=host.querySelector('#exchangeMessagePreviewText');
  if(!input||!count||!save||!remove||!status||!preview||!previewText)throw Error('Exchange message controls are missing');
  let active=true, busy=false, exists=false, edited=false;
  const normalized=s=>String(s||'').replace(/\r\n?/g,'\n').trim();
  const length=s=>Array.from(s).length;
  function showStatus(value){if(active)status.textContent=value;}
  function refresh(){
    if(!active)return;
    const value=input.value;
    const trimmed=normalized(value);
    count.textContent=length(value)+' / '+MAX_LENGTH+'文字';
    preview.hidden=!trimmed;
    previewText.textContent=trimmed;
    save.disabled=!allowed||busy||!trimmed||length(value)>MAX_LENGTH;
    remove.disabled=!allowed||busy||!exists;
  }
  function inputChanged(event){
    if(event?.isComposing)return;
    edited=true;
    if(length(input.value)>MAX_LENGTH)input.value=Array.from(input.value).slice(0,MAX_LENGTH).join('');
    refresh();
  }
  async function verifiedUser(){
    const {data,error}=await client.auth.getUser();
    if(error||data?.user?.id!==session.user.id)throw Error('ログイン情報を確認できません。再ログインしてください。');
    return data.user.id;
  }
  async function load(){
    if(!allowed){input.disabled=true;showStatus('承認済みCAのみ設定できます。');refresh();return;}
    showStatus('登録内容を確認中…');
    try{
      const {data,error}=await client.from(TABLE).select('message').eq('user_id',session.user.id).maybeSingle();
      if(!active)return;
      if(error)throw Error('保存先の準備が完了していません。');
      exists=!!data?.message;
      if(!edited)input.value=data?.message||'';
      refresh();
      showStatus(exists?'登録済みの一言を表示しています。':'一言は未登録です。');
    }catch(err){if(active){input.disabled=true;showStatus(err.message||'一言を読み込めませんでした。');refresh();}}
  }
  async function saveCurrent(){
    if(!allowed||!active||busy)return;
    const text=normalized(input.value);
    if(!text||length(text)>MAX_LENGTH){showStatus('1〜60文字で入力してください。');return;}
    busy=true;refresh();showStatus('保存しています…');
    try{
      const uid=await verifiedUser();
      const result=await client.from(TABLE).upsert({
        user_id:uid,message:text,updated_at:new Date().toISOString()
      },{onConflict:'user_id'}).select('message').maybeSingle();
      if(result.error||result.data?.message!==text)throw Error('保存できませんでした。再読み込みしてお試しください。');
      if(!active)return;
      input.value=text;
      exists=true;
      onChange(text);
      showStatus('交換時の一言を保存しました。');
    }catch(err){showStatus(err.message||'保存に失敗しました。');}
    finally{busy=false;refresh();}
  }
  async function removeCurrent(){
    if(!allowed||!active||busy||!exists)return;
    if(!window.confirm('登録済みの「交換時の一言」を削除しますか？'))return;
    busy=true;refresh();showStatus('削除しています…');
    try{
      const uid=await verifiedUser();
      const result=await client.from(TABLE).delete().eq('user_id',uid).select('user_id').maybeSingle();
      if(result.error||result.data?.user_id!==uid)throw Error('削除できませんでした。画面を再読み込みしてください。');
      if(!active)return;
      input.value='';
      exists=false;
      onChange(null);
      showStatus('交換時の一言を削除しました。');
    }catch(err){showStatus(err.message||'削除に失敗しました。');}
    finally{busy=false;refresh();}
  }
  input.disabled=!allowed;
  input.addEventListener('input',inputChanged);
  input.addEventListener('compositionend',inputChanged);
  save.addEventListener('click',saveCurrent);
  remove.addEventListener('click',removeCurrent);
  refresh();
  void load();
  return ()=>{active=false;input.removeEventListener('input',inputChanged);input.removeEventListener('compositionend',inputChanged);save.removeEventListener('click',saveCurrent);remove.removeEventListener('click',removeCurrent);};
}
