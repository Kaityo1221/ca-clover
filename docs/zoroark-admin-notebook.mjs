// Admin-controlled shared notebook. Never reads tokens or local iPhone drafts.
const esc=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const statuses={pending:"審査待ち",approved:"採用・公開待ち",published:"公開済み",retired:"出題停止",rejected:"非採用",deleted:"削除済み"};
const levels={easy:"初級",normal:"中級",hard:"上級"};
const transitions={
 pending:[["approve","採用候補へ"],["reject","非採用"],["delete","削除"]],
 approved:[["publish","📣 公開して出題"],["reject","非採用"],["delete","削除"]],
 published:[["retire","⏸ 出題停止"]],
 retired:[["resume","▶ 出題再開"],["delete","削除"]],
 rejected:[["delete","削除"]],
 deleted:[["restore","♻️ 審査待ちへ復元"]]
};
const description={
 approve:"採用候補にします。まだゲームには出題されません。",
 publish:"全CA向けの出題候補として公開しますか？",
 resume:"停止中のお題を全CAの出題候補に戻しますか？",
 retire:"新しいラウンドでの出題を停止しますか？",
 reject:"非採用にしますか？",
 delete:"削除済みに移しますか？ゲーム公開中のお題は先に停止が必要です。",
 restore:"削除済みから審査待ちに戻しますか？自動公開はしません。"
};
export function mountAdminNotebook({host,gateway,onBack}){
 if(!host||typeof gateway?.request!=="function")throw Error("ADMIN notebook gateway required");
 let destroyed=false,rows=[],busy=false,loading=true,filter="pending",query="",error="",message="",info=null,editing=null,editForm=null;
 const style=document.createElement("style");
 style.textContent=".zad{max-width:840px;margin:0 auto}.zad .card{margin:10px 0}.zad button{min-height:42px;padding:9px 12px;font:inherit;font-weight:800;border-radius:11px;background:#d9f99d;color:#365314;border:1px solid #84cc16}.zad button[aria-pressed=true]{background:#84cc16}.zad button:disabled{opacity:.55}.zad .actions,.zad .filters{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}.zad article{border:1px solid #bef264;background:#fff;border-radius:15px;margin:10px 0;padding:13px;overflow-wrap:anywhere}.zad .meta{font-size:12px;color:#64748b}.zad input,.zad textarea,.zad select{display:block;width:100%;font:inherit;font-size:16px;padding:10px;border:1px solid #bef264;border-radius:8px;box-sizing:border-box}.zad label{display:block;font-weight:800;margin:11px 0 5px}.zad textarea{min-height:80px}.zad .msg{padding:11px;border-radius:10px;background:#fef9c3}.zad button:focus-visible{outline:3px solid #365314;outline-offset:2px}";
 document.head.append(style);
 const fields=["a","b","aNo","bNo","common","difference","level"];
 function entryView(x){
  const acts=transitions[x.status]||[];
  const active=info?.runtimeEnabled===true&&x.status==="published"&&info.liveIds?.includes(x.id);
  return '<article><h3>#'+esc(x.id)+' · '+esc(x.a)+' × '+esc(x.b)+'</h3>'+
   '<p class="meta">投稿者ID：'+esc(x.submitted_by)+'　難易度：'+esc(levels[x.level]||"")+
   '　審査：'+esc(statuses[x.status]||"不明")+'</p>'+
   '<p><b>共通点：</b>'+esc(x.common)+'</p><p><b>違い：</b>'+esc(x.difference)+'</p>'+
   '<p class="meta">公開版：'+esc(x.version)+' · 編集版：'+esc(x.edit_revision)+
   ' · 実出題：'+(active?"反映候補":"未反映／出題OFF／未照合")+'</p>'+
   '<div class="actions">'+
   (["pending","approved","rejected","retired"].includes(x.status)?'<button data-edit="'+esc(x.id)+'" '+(busy?'disabled':'')+'>✏️ 内容を編集</button>':"")+
   acts.map(([act,label])=>'<button data-act="'+act+'" data-id="'+esc(x.id)+'" '+(busy?'disabled':'')+'>'+esc(label)+'</button>').join("")+
   '</div></article>';
 }
 function render(){
  if(destroyed)return;
  const visible=rows.filter(x=>(filter==="all"||x.status===filter)&&
   (!query||[x.a,x.b,x.common,x.difference,x.submitted_by].some(t=>String(t||"").toLowerCase().includes(query.toLowerCase()))));
  host.innerHTML='<section class="zad">'+
   '<section class="card"><div class="actions"><button data-back>← 戻る</button><button data-refresh '+(busy?'disabled':'')+'>🔄 サーバーと照合</button></div>'+
   '<h1>📚 会長のお題管理</h1><p>CA投稿は審査後、会長の明示的な「公開」操作で初めて出題候補になります。</p>'+
   (info?'<p class="meta">正式 '+esc(info.baseCount)+'組 · 追加お題 '+esc(rows.length)+'件 · 公開版 '+esc(info.catalogVersion)+
    ' · 実ゲーム読み取り '+(info.runtimeEnabled?"ON（候補）":"OFF")+
    ' · 公開操作 '+(info.publishEnabled?"許可":"停止")+'</p>':'')+
   (message?'<p class="msg" role="status">'+esc(message)+'</p>':'')+
   (error?'<p class="msg" role="alert">'+esc(error)+'</p>':'')+'</section>'+
   (editing?'<section class="card"><h2>#'+esc(editing.id)+' の内容を編集</h2>'+
    fields.map(k=>'<label for="zad-'+k+'">'+esc(({a:"ポケモンA",b:"ポケモンB",aNo:"Aの図鑑番号",bNo:"Bの図鑑番号",common:"共通点",difference:"違う部分",level:"難易度"})[k])+'</label>'+
     (k==="common"||k==="difference"?'<textarea data-field="'+k+'" id="zad-'+k+'" maxlength="500">'+esc(editForm[k])+'</textarea>':
      k==="level"?'<select id="zad-level" data-field="level">'+Object.entries(levels).map(([v,label])=>'<option value="'+v+'" '+(editForm.level===v?'selected':'')+'>'+label+'</option>').join("")+'</select>':
      '<input id="zad-'+k+'" data-field="'+k+'" maxlength="'+(k.endsWith("No")?4:80)+'" value="'+esc(editForm[k])+'">')).join("")+
    '<div class="actions"><button data-save '+(busy?'disabled':'')+'>編集内容を保存（再審査）</button><button data-cancel>キャンセル</button></div></section>':"")+
   '<section class="card"><h2>CA投稿一覧</h2><div class="filters">'+
   Object.entries({pending:"審査待ち",approved:"採用候補",published:"公開済み",retired:"停止中",rejected:"非採用",deleted:"削除済み",all:"全件"}).map(([v,label])=>
    '<button data-filter="'+v+'" aria-pressed="'+(filter===v)+'">'+label+' '+(v==="all"?rows.length:rows.filter(x=>x.status===v).length)+'</button>').join("")+'</div>'+
   '<label for="zad-search">投稿を検索</label><input id="zad-search" placeholder="名前・共通点・投稿者ID" value="'+esc(query)+'">'+
   (loading?'<p>読み込み中…</p>':visible.length?visible.map(entryView).join(""):'<p>該当する投稿はありません。</p>')+
   '</section></section>';
 }
 async function refresh(){
  if(destroyed)return;
  loading=true;render();
  try{
   const response=await gateway.request("GET",null,"all");
   if(!Array.isArray(response?.entries))throw Error("一覧の形式が不正です");
   rows=response.entries;info=response;error="";
  }catch(e){error="サーバー照合に失敗："+(e.message||"通信エラー");info=null}
  loading=false;render();
 }
 async function decide(action,id){
  if(busy)return;
  const row=rows.find(x=>String(x.id)===String(id));
  if(!row||!(transitions[row.status]||[]).some(x=>x[0]===action))return;
  if(!window.confirm("「"+row.a+" × "+row.b+"」\n"+description[action]))return;
  busy=true;error="";message="";render();
  try{
   const result=await gateway.request("POST",{action,id:row.id});
   if(!result?.entry||result.entry.id!==row.id)throw Error("サーバー反映を確認できません");
   message="操作を受け付けました。ゲーム反映状態を再照合してください。";
   await refresh();
  }catch(e){error="審査操作が完了していません："+(e.message||"通信エラー");info=null}
  busy=false;render();
 }
 async function save(){
  if(busy||!editing)return;
  busy=true;error="";render();
  try{
   const payload={action:"edit",id:editing.id,expectedRevision:editing.edit_revision,topic:{...editForm}};
   const data=await gateway.request("POST",payload);
   if(!data?.entry||data.entry.id!==editing.id)throw Error("保存確認に失敗");
   editing=null;editForm=null;message="編集を保存しました。公開前の再審査が必要です。";
   await refresh();
  }catch(e){error="保存できません："+(e.message||"再確認してください")}
  busy=false;render();
 }
 function onInput(e){
  const field=e.target?.dataset?.field;
  if(editing&&fields.includes(field))editForm[field]=e.target.value;
  if(e.target?.id==="zad-search")query=e.target.value;
 }
 function onClick(e){
  const target=e.target.closest("button");if(!target)return;
  if(target.hasAttribute("data-back")){destroy();onBack();return}
  if(target.hasAttribute("data-refresh")){if(!busy)void refresh();return}
  if(target.hasAttribute("data-filter")){filter=target.dataset.filter;render();return}
  if(target.hasAttribute("data-cancel")){editing=null;editForm=null;render();return}
  if(target.hasAttribute("data-save")){void save();return}
  if(target.hasAttribute("data-edit")){
   const x=rows.find(r=>String(r.id)===target.dataset.edit);
   if(!x||!["pending","approved","rejected","retired"].includes(x.status))return;
   editing=x;editForm={a:x.a,b:x.b,aNo:x.a_no||"",bNo:x.b_no||"",
    common:x.common,difference:x.difference,level:x.level};
   error="";render();host.scrollIntoView({block:"start"});
  }
  if(target.hasAttribute("data-act"))void decide(target.dataset.act,Number(target.dataset.id));
 }
 host.addEventListener("input",onInput);host.addEventListener("click",onClick);
 function destroy(){destroyed=true;host.removeEventListener("input",onInput);host.removeEventListener("click",onClick);style.remove()}
 render();void refresh();return destroy;
}
