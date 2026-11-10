// CA Clover full Meetup roster CSV. Independent of the older raffle/check-in CSV.
// The server is authoritative for D, verified CA, Community and Meetup scope.
const ENDPOINT='https://wgiittrvgtiosogyhfcl.supabase.co/functions/v1/meetup-roster';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
let inFlight=false;

export async function mountRosterButton({root,meetup,client,getIdentity,publicKey}={}){
  if(!root?.isConnected||!UUID.test(meetup?.id||'')||!client||
     typeof getIdentity!=='function'||typeof publicKey!=='string'||!publicKey)return false;
  const initial=getIdentity();
  const userId=initial?.userId;
  if(!UUID.test(userId||'')||!['ca','admin'].includes(initial?.role))return false;
  let permission;
  try{
    permission=await client.from('user_permissions').select('permission_code')
      .eq('user_id',userId).eq('permission_code','D').maybeSingle();
  }catch{return false;}
  if(!root.isConnected||getIdentity()?.userId!==userId)return false;
  const hasD=permission?.data?.permission_code==='D'&&!permission?.error;
  const container=root.querySelector('section.modal');
  if(!container)return false;
  const wrapper=document.createElement('div');
  wrapper.className='section';
  wrapper.style.cssText='padding:14px;border:1px solid #bddba8;border-radius:15px;background:#f5fce9';
  const heading=document.createElement('h3');heading.textContent='📄 参加者名簿CSV';
  const help=document.createElement('p');
  help.className='small muted strong';
  help.textContent='チェックイン済みを先頭に、参加表明者を含む4列で出力。不参加者は除外します。';
  const button=document.createElement('button');button.type='button';button.className='btn';
  button.textContent='名簿CSVを取得';
  button.style.width='100%';
  button.disabled=!hasD;
  const status=document.createElement('p');status.className='small muted strong';status.setAttribute('role','status');
  if(!hasD) status.textContent=permission?.error
    ?'D権限を確認できませんでした。再ログイン後にお試しください'
    :'名簿取得にはD権限が必要です。管理者も対象です';
  wrapper.append(heading,help,button,status);container.append(wrapper);
  button.onclick=async()=>{
    if(!hasD||inFlight||!root.isConnected||getIdentity()?.userId!==userId)return;
    inFlight=true;button.disabled=true;button.textContent='取得中…';status.textContent='名簿を確認しています';
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
      if(root.isConnected){button.disabled=!hasD;button.textContent='名簿CSVを取得';}
    }
  };
  return true;
}
