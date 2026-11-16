// Isolated, read-only-by-default UI: no auth token is ever handed to this module.
const esc=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const levels={easy:"初級",normal:"中級",hard:"上級"};
const status={pending:"審査待ち",approved:"採用候補",published:"公開済み",retired:"出題停止",rejected:"非採用",deleted:"削除済み"};
const blank=()=>({a:"",b:"",aNo:"",bNo:"",common:"",difference:"",level:"normal"});

export function mountCANotebook({host,gateway,onBack}){
 if(!host||!gateway||typeof gateway.request!=="function")throw Error("CA notebook gateway required");
 let destroyed=false,busy=false,loading=true,rows=[],form=blank(),editing=null,notice="",error="";
 const style=document.createElement("style");
 style.textContent=".zca{max-width:740px;margin:0 auto}.zca .card{margin:12px 0}.zca label{display:block;margin:12px 0 5px;font-weight:850}.zca input,.zca textarea,.zca select{display:block;width:100%;font:inherit;font-size:16px;min-height:44px;padding:10px;border:1px solid #a3e635;border-radius:9px;box-sizing:border-box;background:white;color:#1f2937}.zca textarea{min-height:85px}.zca .actions{display:flex;flex-wrap:wrap;gap:9px;margin:16px 0}.zca button{min-height:44px;border-radius:12px;border:1px solid #84cc16;background:#d9f99d;color:#365314;padding:9px 14px;font:inherit;font-weight:800}.zca button:disabled{opacity:.55}.zca .entry{border:1px solid #d9f99d;padding:14px;border-radius:15px;margin:12px 0;overflow-wrap:anywhere}.zca .meta{font-size:13px;color:#64748b}.zca .notice{padding:12px;border-radius:10px;background:#fef9c3}.zca button:focus-visible{outline:3px solid #365314;outline-offset:3px}";
 document.head.append(style);
 const fields=["a","b","aNo","bNo","common","difference","level"];
 function render(){
  if(destroyed)return;
  host.innerHTML='<div class="zca"><section class="card"><div class="actions"><button type="button" data-back>← ゲームへ戻る</button><button type="button" data-refresh '+(busy?'disabled':'')+'>🔄 更新</button></div>'+
   '<h1>📚 みんなのネタ帳</h1><p>CA専用。お題を提案できます。投稿だけではゲームに出題されません。会長による審査と公開承認が必要です。</p>'+
   (notice?'<p class="notice" role="status">'+esc(notice)+'</p>':'')+
   (error?'<p class="notice" role="alert">'+esc(error)+'</p>':'')+'</section>'+
   '<section class="card"><h2>'+(editing?'✏️ 審査前の投稿を編集':'📝 お題を投稿')+'</h2>'+
   '<label for="zca-a">ポケモンA</label><input id="zca-a" data-field="a" maxlength="80" value="'+esc(form.a)+'" required>'+
   '<label for="zca-b">ポケモンB</label><input id="zca-b" data-field="b" maxlength="80" value="'+esc(form.b)+'" required>'+
   '<div class="meta">図鑑番号は任意です。</div>'+
   '<label for="zca-aNo">Aの図鑑番号（任意）</label><input id="zca-aNo" data-field="aNo" inputmode="numeric" maxlength="4" value="'+esc(form.aNo)+'">'+
   '<label for="zca-bNo">Bの図鑑番号（任意）</label><input id="zca-bNo" data-field="bNo" inputmode="numeric" maxlength="4" value="'+esc(form.bNo)+'">'+
   '<label for="zca-common">似ている部分・共通点</label><textarea id="zca-common" data-field="common" maxlength="500" required>'+esc(form.common)+'</textarea>'+
   '<label for="zca-difference">違う部分</label><textarea id="zca-difference" data-field="difference" maxlength="500" required>'+esc(form.difference)+'</textarea>'+
   '<label for="zca-level">難易度</label><select id="zca-level" data-field="level">'+Object.entries(levels).map(([k,v])=>'<option value="'+k+'" '+(form.level===k?'selected':'')+'>'+v+'</option>').join("")+'</select>'+
   '<div class="actions"><button type="button" data-send '+(busy?'disabled':'')+'>'+(editing?'編集を保存':'会長へ投稿')+'</button>'+
   (editing?'<button type="button" data-cancel>編集をやめる</button>':'')+'</div></section>'+
   '<section class="card"><h2>📬 自分の投稿・審査状況</h2>'+
   (loading?'<p>読み込み中…</p>':rows.length===0?'<p>まだ投稿はありません。</p>':
   rows.map(row=>'<article class="entry"><b>'+esc(row.a)+' × '+esc(row.b)+'</b>'+
    '<p class="meta">#'+esc(row.id)+' · '+esc(status[row.status]||"確認中")+' · '+esc(levels[row.level]||"")+'</p>'+
    '<p>共通点：'+esc(row.common)+'</p><p>違い：'+esc(row.difference)+'</p>'+
    (row.status==="pending"?'<button type="button" data-edit="'+esc(row.id)+'" '+(busy?'disabled':'')+'>✏️ 審査前に編集</button>':'')+
    (row.status==="published"?'<p class="meta">公開承認済み。実ゲームへの収録状況は会長が確認します。</p>':'')+
    '</article>').join(""))+'</section></div>';
 }
 function onInput(e){const k=e.target?.dataset?.field;if(fields.includes(k))form[k]=e.target.value}
 async function refresh(){
  if(destroyed)return;
  loading=true;render();
  try{
   const data=await gateway.request("GET",null,"mine");
   if(!data||!Array.isArray(data.entries))throw Error("取得内容が不正です");
   rows=data.entries;error="";
  }catch(e){error="投稿一覧を確認できません："+(e.message||"通信エラー");rows=[]}
  loading=false;render();
 }
 function validate(){
  const a=form.a.trim(),b=form.b.trim();
  if(!a||!b||a.normalize("NFKC")===b.normalize("NFKC")||
     !form.common.trim()||!form.difference.trim()||!levels[form.level])return "全必須項目を入力してください。";
  if(form.aNo&&!/^\d{1,4}$/.test(form.aNo))return "Aの図鑑番号は4桁以内で入力してください。";
  if(form.bNo&&!/^\d{1,4}$/.test(form.bNo))return "Bの図鑑番号は4桁以内で入力してください。";
  return "";
 }
 async function send(){
  if(busy)return;
  const invalid=validate();
  if(invalid){error=invalid;render();return}
  busy=true;error="";notice="";render();
  const submitted={...form};
  const action=editing?"edit":"submit";
  const payload=editing?{action,id:editing.id,expectedRevision:editing.edit_revision,topic:submitted}:{action,topic:submitted};
  try{
   await gateway.request("POST",payload);
   if(destroyed)return;
   notice=editing?"審査前の投稿を更新しました。":"投稿を受け付けました。会長の公開承認までは出題されません。";
   editing=null;form=blank();
   loading=true;render();await refresh();
  }catch(e){error="送信できません："+(e.message||"通信エラー")+". 内容は画面に保持しました。"}
  busy=false;render();
 }
 function onClick(e){
  const target=e.target.closest("button");
  if(!target)return;
  if(target.hasAttribute("data-back")){destroy();onBack();return}
  if(target.hasAttribute("data-refresh")){if(!busy)void refresh();return}
  if(target.hasAttribute("data-cancel")){editing=null;form=blank();error="";render();return}
  if(target.hasAttribute("data-send")){void send();return}
  if(target.hasAttribute("data-edit")){
   const row=rows.find(v=>String(v.id)===target.dataset.edit);
   if(!row||row.status!=="pending")return;
   editing=row;
   form={a:row.a,b:row.b,aNo:row.a_no||"",bNo:row.b_no||"",
    common:row.common,difference:row.difference,level:row.level};
   error="";notice="審査前の投稿だけ編集できます。";render();host.scrollIntoView({behavior:"auto",block:"start"});
  }
 }
 host.addEventListener("click",onClick);
 host.addEventListener("input",onInput);
 function destroy(){destroyed=true;host.removeEventListener("click",onClick);host.removeEventListener("input",onInput);style.remove()}
 render();void refresh();return destroy;
}
