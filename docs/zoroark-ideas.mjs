import {pairKey,normalizeEntry,mergeEntries,parseImport,exportDocument} from "./zoroark-idea-library.mjs";
import {OFFICIAL_ZOROARK_42,OFFICIAL_ZOROARK_LEVELS,findOfficialZoroarkPairs} from "./zoroark-official42.mjs?v=20261115-v1";
const URL_ROOT="https://raw.githubusercontent.com/Kaityo1221/Global-EN-Trainer/main/data/";
const KEY="ca-zoroark-admin-ideas-v1";
const clean=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
export function mountIdeaMemo({host,role,onBack}){
 if(role!=="admin")throw Error("ADMIN only");
 const style=document.createElement("style");
 style.textContent=".zim{max-width:700px;margin:auto}.zim-pair{display:grid;grid-template-columns:1fr 26px 1fr;gap:8px;align-items:center;margin:20px 0}.zim-poke{min-width:0;min-height:115px;border:2px solid #bef264;border-radius:20px;background:#f7fee7;font-size:clamp(20px,5vw,30px);font-weight:950;color:#365314;word-break:keep-all}.zim-poke small{display:block;font-size:11px;margin-bottom:8px}.zim-dlg{border:none;border-radius:20px;max-width:650px;width:95%;max-height:94dvh;padding:0}.zim-dlg::backdrop{background:#0f172a99}.zim-top{position:sticky;top:0;background:#fff;padding:15px}.zim-top input{width:100%;font-size:16px;padding:12px;border:2px solid #bef264;border-radius:10px}.zim-tabs{display:flex;gap:5px;overflow:auto;padding:10px}.zim-tabs button{white-space:nowrap;border:1px solid #bef264;padding:10px;background:#fff;border-radius:10px}.zim-tabs button[aria-selected=true]{background:#a3e635}.zim-list{padding:10px;display:grid;grid-template-columns:1fr 1fr;gap:8px;max-height:49dvh;overflow-y:auto}.zim-list button{border:1px solid #bef264;border-radius:10px;padding:12px 5px;background:#f7fee7;color:#365314;font-size:15px;font-weight:850}.zim-list small{display:block;font-size:10px;color:#64748b}.zim-note{width:100%;min-height:90px;font:inherit;border:1px solid #bef264;border-radius:12px;padding:12px}.zim-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:12px}.zim-act{border:0;border-radius:12px;padding:12px;background:#84cc16;color:#365314;font-weight:900}.zim-entry{border-bottom:1px solid #d9f99d;padding:10px 0}.zim-tabs{display:flex;gap:8px;flex-wrap:wrap;margin:14px 0}.zim-tabs button{border:1px solid #bef264;border-radius:11px;padding:10px 12px;background:#f7fee7;font:inherit;font-weight:850;color:#365314;cursor:pointer}.zim-tabs button[aria-pressed=true]{background:#a3e635}.zim-official-card{border:1px solid #d9f99d;border-radius:13px;background:#fff;margin:9px 0;padding:12px}.zim-official-card summary{cursor:pointer;font-weight:800}.zim-official-card summary:focus-visible{outline:3px solid #65a30d;outline-offset:3px}.zim-official-meta{color:#64748b;font-size:12px;margin-top:7px}.zim-official-card p{margin:9px 0}.zim-official-search{display:flex;flex-wrap:wrap;gap:8px;align-items:center}.zim-official-search input{flex:1;min-width:145px;padding:11px;border:1px solid #bef264;border-radius:10px;font:inherit}.zim-act:focus-visible{outline:3px solid #365314;outline-offset:2px}";
 document.head.append(style);
 const dialog=document.createElement("dialog");dialog.className="zim-dlg";document.body.append(dialog);
 let chosen=[null,null],which=0,gen=1,all=[],term="",error="",destroyed=false,loadId=0,searchMode=false;
 const genCache=new Map();
 let editIndex=-1,editNote="",officialMode=false,officialLevel="all",officialQuery="";
 let entries=[];try{const x=JSON.parse(localStorage.getItem(KEY)||"[]");if(Array.isArray(x))entries=x.slice(0,500).map(normalizeEntry)}catch{}
 function officialNavigation(){
  return '<div class="zim-tabs" role="group" aria-label="お題帳の種類">'+
   '<button type="button" data-catalog-view="memo" aria-pressed="'+String(!officialMode)+'">✏️ 新規お題メモ</button>'+
   '<button type="button" data-catalog-view="official" aria-pressed="'+String(officialMode)+'">📚 正式42組</button></div>';
 }
 function officialScreen(){
  const levels=[["all","すべて"],["easy","初級"],["normal","中級"],["hard","上級"]];
  const counts={all:OFFICIAL_ZOROARK_42.length,easy:0,normal:0,hard:0};
  for(const row of OFFICIAL_ZOROARK_42)counts[row.level]++;
  const found=findOfficialZoroarkPairs({level:officialLevel,query:officialQuery});
  return '<main class="zim"><section class="card hero"><button data-back class="zim-act">← 戻る</button>'+
   '<h1>🦊 お題管理</h1><p>ADMIN専用・正式42組（閲覧専用）</p>'+officialNavigation()+'</section>'+
   '<section class="card section"><h2>📚 ゲームの正式お題 '+counts.all+'組</h2>'+
   '<p class="muted small">現在のゲーム側の正式カタログから取得した2026年11月15日時点の読み取り専用一覧です。変更・削除・公開操作はできません。</p>'+
   '<div class="zim-tabs" role="group" aria-label="難易度を選択">'+
   levels.map(([k,label])=>'<button type="button" data-official-level="'+k+'" aria-pressed="'+String(officialLevel===k)+'">'+label+' '+counts[k]+'</button>').join("")+'</div>'+
   '<div class="zim-official-search"><input id="zim-official-query" type="search" aria-label="正式お題を検索" placeholder="ポケモン名・共通点・違い" value="'+clean(officialQuery)+'">'+
   '<button type="button" class="zim-act" data-official-search>検索</button>'+
   '<button type="button" class="zim-act" data-official-clear>解除</button></div>'+
   '<p class="muted small" role="status">表示 '+found.length+' / '+counts.all+' 組</p>'+
   (found.map(row=>'<article class="zim-official-card"><details>'+
    '<summary>'+clean(row.a)+' × '+clean(row.b)+'</summary>'+
    '<div class="zim-official-meta">#'+clean(row.id)+' · '+clean(OFFICIAL_ZOROARK_LEVELS[row.level])+'</div>'+
    '<p><b>似ている部分：</b>'+clean(row.common)+'</p>'+
    '<p><b>違う部分：</b>'+clean(row.difference)+'</p></details></article>').join("")||
    '<p class="muted">条件に一致するお題はありません。</p>')+'</section></main>';
 }
 function draw(){
  if(officialMode){host.innerHTML=officialScreen();return}
  host.innerHTML='<main class="zim"><section class="card hero"><button data-back class="zim-act">← 戻る</button><h1>🦊 お題ひらめきメモ</h1><p>ADMIN専用：2匹を選んで特徴をメモ</p><p class="small muted">この段階では端末内に保存します。CA共有・端末間同期は未対応です。</p>'+officialNavigation()+'</section><section class="card section"><div class="zim-pair">'+chosen.map((p,i)=>'<button class="zim-poke" data-choose="'+i+'"><small>ポケモン'+(i?'B':'A')+'</small>'+clean(p?.jp||"選択する")+'</button>').join('<b style="text-align:center;font-size:23px">×</b>')+'</div><label for="zim-note">似てる部分</label><textarea id="zim-note" class="zim-note" placeholder="例：人気ポケモン">'+clean(editNote)+'</textarea><div class="zim-actions"><button class="zim-act" data-save>'+(editIndex>=0?'編集を保存':'下書き保存')+'</button><button class="zim-act" data-export>JSONバックアップ</button><label class="zim-act">JSON読み込み<input data-import type="file" accept=".json,application/json" style="max-width:120px;font-size:12px"></label></div><p role="status">'+clean(error)+'</p></section><section class="card section"><h2>記録 '+entries.length+'件</h2>'+entries.slice().reverse().map((x,i)=>'<div class="zim-entry"><b>'+clean(x.a)+' × '+clean(x.b)+'</b><div>'+clean(x.note)+'</div><small>'+(x.status==='adopted'?'✅ 採用済み':'📝 下書き')+'</small><div class="zim-actions"><button class="zim-act" data-edit="'+(entries.length-1-i)+'">編集</button><button class="zim-act" data-adopt="'+(entries.length-1-i)+'">'+(x.status==='adopted'?'採用を解除':'採用する')+'</button></div></div>').join("")+'</section></main>';
 }
 function renderChoices(){
  const choices=all.filter(x=>!term||x.jp.includes(term)||(x.en||"").toLowerCase().includes(term.toLowerCase())||x.no.includes(term)).slice(0,200);
  const list=dialog.querySelector(".zim-list");
  if(list)list.innerHTML=choices.map(x=>'<button data-id="'+clean(x.no)+'">'+clean(x.jp)+'<small>No.'+clean(x.no)+' / Gen '+clean(x.gen)+' / '+clean(x.en)+'</small></button>').join("")||'<p>候補がありません</p>';
 }
 function showPicker(){
  dialog.innerHTML='<div class="zim-top"><div style="display:flex;justify-content:space-between"><b>ポケモン'+(which?'B':'A')+'を選択</b><button data-close class="zim-act">閉じる</button></div><input aria-label="名前検索" placeholder="名前・図鑑番号を入力" autocomplete="off" value="'+clean(term)+'"><button type="button" class="zim-act" data-search style="display:block;width:100%;margin-top:8px">🔎 検索する</button></div><div class="zim-tabs">'+Array.from({length:9},(_,i)=>'<button data-gen="'+(i+1)+'" aria-selected="'+(gen===i+1)+'">Gen '+(i+1)+'</button>').join("")+'</div><div class="zim-list"></div>';
  renderChoices();
 }
 async function changeGen(n){
  gen=n;searchMode=false;term="";const search=dialog.querySelector(".zim-top input");if(search){search.value="";search.blur()}all=[];const requestId=++loadId;dialog.querySelectorAll("[data-gen]").forEach(b=>b.setAttribute("aria-selected",String(Number(b.dataset.gen)===n)));renderChoices();
  try{const v=await getGen(n);if(!destroyed&&requestId===loadId){all=v;renderChoices()}}
  catch{if(!destroyed&&requestId===loadId)dialog.querySelector(".zim-list").textContent="一覧を取得できませんでした。通信を確認してください。"}
 }
 async function getGen(n){
  if(genCache.has(n))return genCache.get(n);
  const r=await fetch(URL_ROOT+"gen"+n+".json");
  if(!r.ok)throw Error("Generation "+n+" unavailable");
  const v=await r.json();
  if(!Array.isArray(v))throw Error("Invalid list");
  const list=v.filter(x=>x&&typeof x.jp==="string"&&typeof x.no==="string");
  genCache.set(n,list);return list;
 }
 async function searchAll(){
  const search=dialog.querySelector(".zim-top input");
  const value=(search?.value||"").trim();
  search?.blur();
  if(!value){await changeGen(gen);return}
  const requestId=++loadId;term=value;searchMode=true;all=[];
  dialog.querySelectorAll("[data-gen]").forEach(b=>b.setAttribute("aria-selected","false"));
  const list=dialog.querySelector(".zim-list");if(list)list.textContent="全世代を検索中…";
  const results=await Promise.allSettled(Array.from({length:9},(_,i)=>getGen(i+1)));
  if(destroyed||requestId!==loadId)return;
  all=results.filter(x=>x.status==="fulfilled").flatMap(x=>x.value);
  if(results.every(x=>x.status==="rejected")){if(list)list.textContent="一覧を取得できませんでした。通信を確認してください。";return}
  const first=all.find(x=>x.jp.includes(value)||(x.en||"").toLowerCase().includes(value.toLowerCase())||x.no.includes(value));
  if(first){gen=Number(first.gen)||gen}
  dialog.querySelectorAll("[data-gen]").forEach(b=>b.setAttribute("aria-selected",String(!!first&&Number(b.dataset.gen)===gen)));
  renderChoices();
 }
 function persist(next){
  const normalized=next.map(normalizeEntry);
  if(normalized.length>500)throw Error("登録上限500件です");
  localStorage.setItem(KEY,JSON.stringify(normalized));entries=normalized;
 }
 function save(){
  const note=host.querySelector("#zim-note").value.trim();
  if(!chosen[0]||!chosen[1]){error="2匹を選択してください";editNote=note;draw();return}
  let candidate;
  try{candidate=normalizeEntry({a:chosen[0].jp,b:chosen[1].jp,aNo:chosen[0].no,bNo:chosen[1].no,note,at:new Date().toISOString(),status:editIndex>=0?entries[editIndex].status:"draft"})}
  catch(e){error=e.message;editNote=note;draw();return}
  if(entries.some((item,i)=>i!==editIndex&&pairKey(item)===pairKey(candidate))){error="この組み合わせは登録済みです";editNote=note;draw();return}
  const next=[...entries];if(editIndex>=0)next[editIndex]=candidate;else next.push(candidate);
  try{persist(next);error="端末内に保存しました";editIndex=-1;editNote="";chosen=[null,null]}catch(e){error="保存できません："+e.message;editNote=note}
  draw();
 }
 function exportData(){
  const blob=new Blob([JSON.stringify(exportDocument(entries),null,2)],{type:"application/json"});
  const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="zoroark-questions-backup.json";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 async function importData(file){
  if(!file)return;
  try{
   if(file.size>2000000)throw Error("JSONは2MB以内にしてください");
   const incoming=parseImport(await file.text());
   const merged=mergeEntries(entries,incoming);
   if(!window.confirm("新規"+merged.added+"件を追加、重複"+merged.skipped+"件を除外します。実行しますか？"))return;
   persist(merged.entries);error="追加"+merged.added+"件、重複"+merged.skipped+"件";
  }catch(e){error="読み込み失敗："+e.message}
  draw();
 }
 const onClick=e=>{
  if(e.target.closest("[data-back]")){destroy();onBack();return}
  const viewTab=e.target.closest("[data-catalog-view]");
  if(viewTab){if(!officialMode){const note=host.querySelector("#zim-note");if(note)editNote=note.value}
   officialMode=viewTab.dataset.catalogView==="official";draw();return}
  const difficulty=e.target.closest("[data-official-level]");
  if(difficulty){officialLevel=difficulty.dataset.officialLevel;draw();return}
  if(e.target.closest("[data-official-search]")){
   officialQuery=host.querySelector("#zim-official-query")?.value||"";draw();return}
  if(e.target.closest("[data-official-clear]")){officialQuery="";draw();return}
  const c=e.target.closest("[data-choose]");if(c){which=Number(c.dataset.choose);term="";showPicker();dialog.showModal();void changeGen(gen)}
  if(e.target.closest("[data-save]"))save();
  const ed=e.target.closest("[data-edit]");if(ed){editIndex=Number(ed.dataset.edit);const x=entries[editIndex];chosen=[{jp:x.a,no:x.aNo},{jp:x.b,no:x.bNo}];editNote=x.note;error="編集中";draw();window.scrollTo(0,0);return}
  const ad=e.target.closest("[data-adopt]");if(ad){const i=Number(ad.dataset.adopt);const next=entries.map((x,j)=>j===i?{...x,status:x.status==="adopted"?"draft":"adopted"}:x);try{persist(next);error="採用状態を変更しました"}catch{error="保存に失敗しました"}draw();return}
  if(e.target.closest("[data-export]"))exportData();
 };
 const onDialog=e=>{
  if(e.target.closest("[data-close]")){dialog.close();return}
  if(e.target.closest("[data-search]")){void searchAll();return}
  const g=e.target.closest("[data-gen]");if(g){void changeGen(Number(g.dataset.gen));return}
  const b=e.target.closest("[data-id]");if(b){const x=all.find(p=>p.no===b.dataset.id);if(x){chosen[which]=x;gen=Number(x.gen)||gen;dialog.close();draw()}}
 };
 // Do not modify search UI during Japanese IME composition.
 const onKey=e=>{if(e.target.matches(".zim-top input")&&e.key==="Enter"&&!e.isComposing){e.preventDefault();void searchAll()}};
 const onImport=e=>{if(e.target.matches("[data-import]"))void importData(e.target.files?.[0])};
 host.addEventListener("change",onImport);
 host.addEventListener("click",onClick);dialog.addEventListener("click",onDialog);dialog.addEventListener("keydown",onKey);
 function destroy(){destroyed=true;host.removeEventListener("click",onClick);host.removeEventListener("change",onImport);dialog.removeEventListener("click",onDialog);dialog.removeEventListener("keydown",onKey);dialog.close();dialog.remove();style.remove()}
 draw();return destroy;
}