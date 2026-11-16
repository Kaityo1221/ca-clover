const view=document.querySelector('#view'),message=document.querySelector('#message');
const room=new URL(location.href).searchParams.get('room');
const el=(tag,text,parent=view)=>{const n=document.createElement(tag);if(text)n.textContent=text;parent.append(n);return n;};
function input(label,type='text'){const l=el('label',label),i=el('input','',l);i.type=type;return i;}
function btn(label,fn,parent=view){const b=el('button',label,parent);b.onclick=async()=>{b.disabled=true;message.textContent='';try{await fn();}catch(e){message.textContent=e.message;}finally{b.disabled=false;}};return b;}
async function api(action,body={},id=null){
 const res=await fetch('/api/'+(id?'room/'+encodeURIComponent(id)+'/':'')+action,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
 const d=await res.json();if(!res.ok)throw Object.assign(Error(d.error),{status:res.status});return d;
}
const clear=()=>{view.replaceChildren();message.textContent='';};
function ticket(d){clear();el('h2','🍀 登録テスト完了！');el('p',d.room);el('strong','参加番号 '+d.entry.number+' ・ '+d.entry.name);el('p','登録済み');el('details','').append();const det=view.lastChild;el('summary','端末変更用の復帰コード',det);el('p',d.recovery,det);el('p','本人だけで保管してください。別端末で使用すると以前の参加証は失効します。',det);btn('自分の抽選結果を確認',async()=>showResult(await api('myresult',{},room)));}
async function guest(){
 let p;try{p=await api('prepare',{},room);}catch(e){if(e.status!==410)throw e;return showResult(await api('myresult',{},room));}
 const me=await api('me',{},room);if(me.entry)return ticket(me);
 clear();el('h2',p.name);
 if(p.state==='open'){const name=input('Pokémon GOトレーナー名');name.maxLength=48;btn('参加登録',async()=>ticket(await api('join',{name:name.value},room)));}
 else el('p','受付は終了しています');
 const code=input('別端末からの復帰コード');code.autocomplete='off';
 btn('参加証を復元',async()=>ticket(await api('recover',{code:code.value.trim()},room)));
}
function showResult(d){
 clear();el('h2','🎲 抽選結果');el('p',d.entry.name+' ・ 参加番号 '+d.entry.number);
 const messages={not_started:'抽選前です。受付終了後の発表をお待ちください。',
  pending:'当選者を順番に発表中です。最後までお待ちください。',
  winner:'🎉 当選しました！ '+d.ordinal+'人目の当選者です。',
  not_selected:'今回は当選しませんでした。ご参加ありがとうございました！'};
 el('strong',messages[d.status]||'結果を確認できません');
 btn('結果を更新',async()=>showResult(await api('myresult',{},room)));
}
function login(){clear();el('h2','CAログイン');const email=input('メールアドレス','email'),password=input('パスワード','password');btn('ログイン',async()=>{await api('login',{email:email.value,password:password.value});password.value='';await rooms();});}
async function rooms(){
 const data=await api('rooms');clear();el('h2','主催ルーム');for(const r of data.rooms)btn(r.name,()=>list(r.id));
 const n=input('新しいルーム名');btn('ルーム作成',async()=>{
 let req=JSON.parse(sessionStorage.getItem('caLotteryCreate')||'null');if(!req||req.name!==n.value){req={name:n.value,request:crypto.randomUUID()};sessionStorage.setItem('caLotteryCreate',JSON.stringify(req));}
 const r=await api('create',req);sessionStorage.removeItem('caLotteryCreate');await list(r.id);
 });btn('ログアウト',async()=>{await api('logout');login();});
}
async function list(id){
 const d=await api('list',{},id),r=d.room;clear();el('h2',r.name);el('p','所属 '+r.community+' ・ 主催CA '+r.owner);el('p','作成 '+new Date(r.created).toLocaleString()+' ・ 期限 '+new Date(r.expires).toLocaleString());
 el('strong',(r.expired?'期限切れ':({open:'受付中',closed:'受付終了',ended:'ルーム終了'})[r.state])+' ・ '+d.entries.length+'人');
 if(!r.expired&&r.state!=='ended'){
 const img=el('img');img.src=d.qr;img.alt='参加用QRコード';const link=el('a','参加用URL');link.href=d.url;
 btn('URLをコピー',async()=>{await navigator.clipboard.writeText(d.url);message.textContent='コピーしました';});
 btn('QRを拡大',()=>{const dialog=el('dialog');const big=img.cloneNode();dialog.append(big);btn('閉じる',()=>dialog.close(),dialog);dialog.onclose=()=>dialog.remove();dialog.showModal();});
 }
 const ol=el('ol');for(const e of d.entries)el('li',e.name+' ・ '+new Date(e.registered).toLocaleString(),ol);
 if(r.state==='closed'||r.state==='ended'){
  const status=await api('drawstatus',{},id);
  el('h3','🎲 お楽しみ抽選');
  if(!status.draw){
   if(r.state==='closed'&&!r.expired&&d.entries.length){
    const amount=input('当選人数（1〜10名）','number');
    amount.min='1';amount.max=String(Math.min(10,d.entries.length));amount.step='1';amount.value=String(Math.min(3,10,d.entries.length));
    el('p','抽選結果は一度だけ確定し、やり直しはできません。');
    btn('抽選を確定',async()=>{
     const count=Number(amount.value);
     if(!Number.isInteger(count)||count<1||count>10||count>d.entries.length)throw Error('当選人数を確認してください');
     if(!confirm(count+'名の当選者を確定しますか？ やり直しはできません。'))return;
     await api('draw',{count},id);await list(id);
    });
   }else el('p','抽選はまだ行われていません');
  }else{
   const draw=status.draw;
   el('p','当選 '+draw.winnerCount+'名 ・ 発表済み '+draw.revealedCount+'名');
   const winners=el('ol');
   for(const w of draw.winners)el('li','🎉 '+w.ordinal+'人目：'+w.name+'（参加番号 '+w.number+'）',winners);
   if(!draw.complete&&r.state==='closed'&&!r.expired)
    btn('次の当選者を発表',async()=>{
     const storageKey='caLotteryReveal:'+id;
     let request=sessionStorage.getItem(storageKey);
     if(!request){request=crypto.randomUUID();sessionStorage.setItem(storageKey,request);}
     await api('reveal',{request},id);
     sessionStorage.removeItem(storageKey);await list(id);
    });
   if(draw.complete)el('strong','🏆 当選者の発表が完了しました');
  }
 }
 btn('一覧を更新',()=>list(id));
 if(!r.expired&&r.state!=='ended'){
 const change=async state=>{await api('state',{state,version:r.version},id);await list(id);};
 btn(r.state==='open'?'受付終了':'受付再開',()=>change(r.state==='open'?'closed':'open'));
 btn('ルーム終了',async()=>{if(confirm('このルームを終了しますか？'))await change('ended');});
 }
 btn('主催ルーム一覧',rooms);
}
(room!==null?guest():rooms()).catch(e=>{if(room===null&&e.status===401)login();else message.textContent=e.message;});

