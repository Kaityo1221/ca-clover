const URL_ROOT="https://raw.githubusercontent.com/Kaityo1221/Global-EN-Trainer/main/data/";
const KEY="ca-zoroark-admin-ideas-v1";
const clean=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
export function mountIdeaMemo({host,role,onBack}){
 if(role!=="admin")throw Error("ADMIN only");
 const style=document.createElement("style");
 style.textContent=".zim{max-width:700px;margin:auto}.zim-pair{display:grid;grid-template-columns:1fr 26px 1fr;gap:8px;align-items:center;margin:20px 0}.zim-poke{min-width:0;min-height:115px;border:2px solid #bef264;border-radius:20px;background:#f7fee7;font-size:clamp(20px,5vw,30px);font-weight:950;color:#365314;word-break:keep-all}.zim-poke small{display:block;font-size:11px;margin-bottom:8px}.zim-dlg{border:none;border-radius:20px;max-width:650px;width:95%;max-height:94dvh;padding:0}.zim-dlg::backdrop{background:#0f172a99}.zim-top{position:sticky;top:0;background:#fff;padding:15px}.zim-top input{width:100%;font-size:16px;padding:12px;border:2px solid #bef264;border-radius:10px}.zim-tabs{display:flex;gap:5px;overflow:auto;padding:10px}.zim-tabs button{white-space:nowrap;border:1px solid #bef264;padding:10px;background:#fff;border-radius:10px}.zim-tabs button[aria-selected=true]{background:#a3e635}.zim-list{padding:10px;display:grid;grid-template-columns:1fr 1fr;gap:8px;max-height:49dvh;overflow-y:auto}.zim-list button{border:1px solid #bef264;border-radius:10px;padding:12px 5px;background:#f7fee7;color:#365314;font-size:15px;font-weight:850}.zim-list small{display:block;font-size:10px;color:#64748b}.zim-note{width:100%;min-height:90px;font:inherit;border:1px solid #bef264;border-radius:12px;padding:12px}.zim-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:12px}.zim-act{border:0;border-radius:12px;padding:12px;background:#84cc16;color:#365314;font-weight:900}.zim-entry{border-bottom:1px solid #d9f99d;padding:10px 0}";
 document.head.append(style);
 const dialog=document.createElement("dialog");dialog.className="zim-dlg";document.body.append(dialog);
 let chosen=[null,null],which=0,gen=1,all=[],term="",error="",destroyed=false,loadId=0;
 let entries=[];try{const x=JSON.parse(localStorage.getItem(KEY)||"[]");if(Array.isArray(x))entries=x.slice(0,200)}catch{}
 function draw(){
  host.innerHTML='<main class="zim"><section class="card hero"><button data-back class="zim-act">← 戻る</button><h1>🦊 お題ひらめきメモ</h1><p>ADMIN専用：2匹を選んで特徴をメモ</p><p class="small muted">この段階では端末内に保存します。CA共有・端末間同期は未対応です。</p></section><section class="card section"><div class="zim-pair">'+chosen.map((p,i)=>'<button class="zim-poke" data-choose="'+i+'"><small>ポケモン'+(i?'B':'A')+'</small>'+clean(p?.jp||"選択する")+'</button>').join('<b style="text-align:center;font-size:23px">×</b>')+'</div><label for="zim-note">似てる部分</label><textarea id="zim-note" class="zim-note" placeholder="例：人気ポケモン"></textarea><div class="zim-actions"><button class="zim-act" data-save>下書き保存</button><button class="zim-act" data-export>JSONバックアップ</button></div><p role="status">'+clean(error)+'</p></section><section class="card section"><h2>記録 '+entries.length+'件</h2>'+entries.slice().reverse().map(x=>'<div class="zim-entry"><b>'+clean(x.a)+' × '+clean(x.b)+'</b><div>'+clean(x.note)+'</div></div>').join("")+'</section></main>';
 }
 function renderChoices(){
  const choices=all.filter(x=>!term||x.jp.includes(term)||(x.en||"").toLowerCase().includes(term.toLowerCase())||x.no.includes(term)).slice(0,200);
  const list=dialog.querySelector(".zim-list");
  if(list)list.innerHTML=choices.map(x=>'<button data-id="'+clean(x.no)+'">'+clean(x.jp)+'<small>No.'+clean(x.no)+' / '+clean(x.en)+'</small></button>').join("")||'<p>候補がありません</p>';
 }
 function showPicker(){
  dialog.innerHTML='<div class="zim-top"><div style="display:flex;justify-content:space-between"><b>ポケモン'+(which?'B':'A')+'を選択</b><button data-close class="zim-act">閉じる</button></div><input aria-label="名前検索" placeholder="名前・図鑑番号で検索" value="'+clean(term)+'"></div><div class="zim-tabs">'+Array.from({length:9},(_,i)=>'<button data-gen="'+(i+1)+'" aria-selected="'+(gen===i+1)+'">Gen '+(i+1)+'</button>').join("")+'</div><div class="zim-list"></div>';
  renderChoices();
 }
 async function changeGen(n){
  gen=n;all=[];const requestId=++loadId;dialog.querySelectorAll("[data-gen]").forEach(b=>b.setAttribute("aria-selected",String(Number(b.dataset.gen)===n)));renderChoices();
  try{const r=await fetch(URL_ROOT+"gen"+n+".json");if(!r.ok)throw Error();const v=await r.json();if(!destroyed&&requestId===loadId){all=v.filter(x=>x&&typeof x.jp==="string"&&typeof x.no==="string");renderChoices()}}
  catch{if(!destroyed&&requestId===loadId)dialog.querySelector(".zim-list").textContent="一覧を取得できませんでした。通信を確認してください。"}
 }
 function save(){
  const note=host.querySelector("#zim-note").value.trim();
  if(!chosen[0]||!chosen[1]||chosen[0].no===chosen[1].no){error="異なる2匹を選択してください";draw();return}
  entries.push({a:chosen[0].jp,b:chosen[1].jp,aNo:chosen[0].no,bNo:chosen[1].no,note,at:new Date().toISOString()});
  try{localStorage.setItem(KEY,JSON.stringify(entries));error="端末内に保存しました"}catch{error="保存できません。バックアップをご利用ください"}
  draw();
 }
 function exportData(){const blob=new Blob([JSON.stringify(entries,null,2)],{type:"application/json"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="zoroark-ideas.json";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
 const onClick=e=>{
  if(e.target.closest("[data-back]")){destroy();onBack();return}
  const c=e.target.closest("[data-choose]");if(c){which=Number(c.dataset.choose);term="";showPicker();dialog.showModal();void changeGen(gen)}
  if(e.target.closest("[data-save]"))save();
  if(e.target.closest("[data-export]"))exportData();
 };
 const onDialog=e=>{
  if(e.target.closest("[data-close]")){dialog.close();return}
  const g=e.target.closest("[data-gen]");if(g){term="";void changeGen(Number(g.dataset.gen));return}
  const b=e.target.closest("[data-id]");if(b){const x=all.find(p=>p.no===b.dataset.id);if(x){chosen[which]=x;dialog.close();draw()}}
 };
 const onInput=e=>{if(!e.target.matches(".zim-top input"))return;term=e.target.value;renderChoices()};
 host.addEventListener("click",onClick);dialog.addEventListener("click",onDialog);dialog.addEventListener("input",onInput);
 function destroy(){destroyed=true;host.removeEventListener("click",onClick);dialog.removeEventListener("click",onDialog);dialog.removeEventListener("input",onInput);dialog.close();dialog.remove();style.remove()}
 draw();return destroy;
}