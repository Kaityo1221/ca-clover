import {pairKey,normalizeEntry,mergeEntries,parseImport,exportDocument,ideaStatusCounts,ideaVisibleIndexes,compareServerCatalog,candidateForServer,officialCatalogRows,filterOfficialCatalog} from "./zoroark-idea-library.mjs?v=20261115-official42-v1";
const URL_ROOT="https://raw.githubusercontent.com/Kaityo1221/Global-EN-Trainer/main/data/";
const KEY="ca-zoroark-admin-ideas-v1";
const clean=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
export function mountIdeaMemo({host,role,onBack,catalogGateway=null}){
 if(role!=="admin")throw Error("ADMIN only");
 const style=document.createElement("style");
 style.textContent=".zim{max-width:700px;margin:auto}.zim-pair{display:grid;grid-template-columns:1fr 26px 1fr;gap:8px;align-items:center;margin:20px 0}.zim-poke{min-width:0;min-height:115px;border:2px solid #bef264;border-radius:20px;background:#f7fee7;font-size:clamp(20px,5vw,30px);font-weight:950;color:#365314;word-break:keep-all}.zim-poke small{display:block;font-size:11px;margin-bottom:8px}.zim-dlg{border:none;border-radius:20px;max-width:650px;width:95%;max-height:94dvh;padding:0}.zim-dlg::backdrop{background:#0f172a99}.zim-top{position:sticky;top:0;background:#fff;padding:15px}.zim-top input{width:100%;font-size:16px;padding:12px;border:2px solid #bef264;border-radius:10px}.zim-tabs{display:flex;gap:5px;overflow:auto;padding:10px}.zim-tabs button{white-space:nowrap;border:1px solid #bef264;padding:10px;background:#fff;border-radius:10px}.zim-tabs button[aria-selected=true]{background:#a3e635}.zim-list{padding:10px;display:grid;grid-template-columns:1fr 1fr;gap:8px;max-height:49dvh;overflow-y:auto}.zim-list button{border:1px solid #bef264;border-radius:10px;padding:12px 5px;background:#f7fee7;color:#365314;font-size:15px;font-weight:850}.zim-list small{display:block;font-size:10px;color:#64748b}.zim-note{width:100%;min-height:90px;font:inherit;border:1px solid #bef264;border-radius:12px;padding:12px}.zim-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:12px}.zim-act{border:0;border-radius:12px;padding:12px;background:#84cc16;color:#365314;font-weight:900}.zim-entry{border-bottom:1px solid #d9f99d;padding:10px 0}.zim-alert{margin:12px 0;padding:14px;border:1px solid #fed7aa;border-radius:12px;background:#fffbeb;color:#78350f;line-height:1.6}.zim-counts{display:flex;gap:8px;flex-wrap:wrap}.zim-counts span{padding:8px;border:1px solid #d9f99d;border-radius:10px}.zim-tabs{display:flex;gap:7px;flex-wrap:wrap;margin:12px 0}.zim-tabs button{padding:9px 12px;border:1px solid #bef264;border-radius:10px;background:#f7fee7;color:#365314;font-weight:900}.zim-tabs button[aria-pressed=true]{background:#a3e635}.zim-filter-query{width:100%;max-width:400px;box-sizing:border-box;border:1px solid #bef264;border-radius:10px;padding:9px;margin:8px 0;font:inherit}.zim-files summary{padding:10px;cursor:pointer;font-weight:900}.zim-create summary{font-weight:950;font-size:20px;cursor:pointer;color:#365314;list-style-position:inside;padding:8px 0}.zim-archive{background:#fee2e2!important;color:#7f1d1d!important}.zim-memo-pane[hidden]{display:none!important}.zim-official-card{border:1px solid #d9f99d;border-radius:12px;padding:13px;margin:10px 0;background:#fff}.zim-official-card summary{cursor:pointer;font-weight:800;padding:8px 0;color:#365314}.zim-official-title{display:flex;gap:9px;align-items:center;flex-wrap:wrap}.zim-official-title b{font-size:16px}.zim-official-details p{margin:7px 0}.zim-official-state{font-size:12px;color:#64748b}.zim-official-filter{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.zim-official-filter input{flex:1;min-width:150px}.zim-tabs [aria-pressed=true]{background:#a3e635}";
 document.head.append(style);
 const dialog=document.createElement("dialog");dialog.className="zim-dlg";document.body.append(dialog);
 let chosen=[null,null],which=0,gen=1,all=[],term="",error="",destroyed=false,loadId=0,searchMode=false;
 const genCache=new Map();
 let editIndex=-1,editNote="",editDifference="",editLevel="",view="draft",query="",serverCatalog=null,serverError="",serverBusy=false,libraryView="memo",officialDifficulty="all",officialQuery="";
 let entries=[];try{const x=JSON.parse(localStorage.getItem(KEY)||"[]");if(Array.isArray(x))entries=x.slice(0,500).map(normalizeEntry)}catch{}
 function officialMarkup(){
  const rows=officialCatalogRows(serverCatalog);
  if(!rows)return '<section class="card section" aria-live="polite"><h2>📚 正式42組</h2><p class="muted">正式お題の全件データはまだ取得できません。上の「ゲーム反映状況を照合」から管理者認証付きの検証サーバーに接続してください。</p><p class="small muted">APIが停止中、または旧バージョンの場合は一覧を表示しません。ネタ帳の下書きはそのまま保護されます。</p></section>';
  const counts={all:rows.length,easy:0,normal:0,hard:0};
  rows.forEach(x=>{counts[x.level]++});
  const found=filterOfficialCatalog(rows,officialDifficulty,officialQuery);
  const tabs=[["all","すべて"],["easy","初級"],["normal","中級"],["hard","上級"]];
  const levelName={easy:"初級",normal:"中級",hard:"上級"};
  return '<section class="card section"><h2>📚 正式登録のお題（'+rows.length+'組）</h2>'+
   '<p class="small muted">ゲーム本編の正式カタログを表示しています。閲覧専用です。ここから既存42組の編集・削除・公開変更はできません。</p>'+
   '<div class="zim-tabs" role="group" aria-label="正式お題の難易度">'+
   tabs.map(([v,title])=>'<button data-official-level="'+v+'" aria-pressed="'+String(officialDifficulty===v)+'">'+title+' '+counts[v]+'</button>').join("")+'</div>'+
   '<div class="zim-official-filter"><input id="zim-official-query" type="search" aria-label="正式お題を検索" placeholder="ポケモン名・特徴を検索" value="'+clean(officialQuery)+'">'+
   '<button class="zim-act" data-official-search>検索</button><button class="zim-act" data-official-clear>解除</button></div>'+
   '<p class="small muted" role="status">表示 '+found.length+' / '+rows.length+'組</p>'+
   (found.map(x=>'<article class="zim-official-card"><div class="zim-official-title"><b>'+clean(x.a)+' × '+clean(x.b)+'</b><span class="pill">'+clean(levelName[x.level])+'</span><span class="zim-official-state">#'+clean(x.id)+'</span></div>'+
   '<details class="zim-official-details"><summary>共通点・相違点を見る</summary><p><b>似ている部分：</b>'+clean(x.common)+'</p><p><b>違う部分：</b>'+clean(x.difference)+'</p></details></article>').join("")||'<p class="muted">該当するお題はありません。</p>')+
   '</section>';
 }
 function draw(){
  const counts=ideaStatusCounts(entries);
  const visible=ideaVisibleIndexes(entries,view,query).map(i=>({...entries[i],rowIndex:i}));
  host.innerHTML='<main class="zim"><section class="card hero"><button data-back class="zim-act">← 戻る</button><h1>🦊 お題管理</h1><button class="zim-act" data-catalog-check>🔎 ゲーム反映状況を照合</button><p role="status">'+clean(serverError||(serverCatalog?'検証サーバー版 '+serverCatalog.catalogVersion+' ／ 正式42組＋公開候補':'サーバー未照合。採用候補は正式公開ではありません。'))+'</p><p>ADMIN専用：2匹を選んで特徴をメモ</p><div class="zim-alert"><strong>⚠️ ゲームとの接続：未実装</strong><div>この画面で「採用候補」にしてもゲームには反映されません。ゲームは別APIから出題します。重複や実際の使用状況もここでは判定できません。</div></div><div class="zim-counts"><span>📝 未処理 '+counts.draft+'</span><span>⭐ 採用候補 '+counts.adopted+'</span><span>📦 非採用 '+counts.archived+'</span></div><p class="small muted">この端末内に保存。CA共有・端末間同期は未対応です。</p></section><div class="zim-tabs" role="group" aria-label="お題一覧の切り替え"><button data-library="memo" aria-pressed="'+String(libraryView==="memo")+'">✏️ 新規候補 '+counts.total+'件</button><button data-library="official" aria-pressed="'+String(libraryView==="official")+'">📚 正式42組</button></div><div class="zim-memo-pane"'+(libraryView==="official"?' hidden':'')+'><details class="card section zim-create"'+(editIndex>=0||chosen.some(Boolean)?' open':'')+'><summary>＋ お題を追加・編集</summary><div class="zim-pair">'+chosen.map((p,i)=>'<button class="zim-poke" data-choose="'+i+'"><small>ポケモン'+(i?'B':'A')+'</small>'+clean(p?.jp||"選択する")+'</button>').join('<b style="text-align:center;font-size:23px">×</b>')+'</div><label for="zim-note">似てる部分</label><textarea id="zim-note" class="zim-note" placeholder="例：人気ポケモン">'+clean(editNote)+'</textarea><label for="zim-difference">違う部分（正式追加前に必須）</label><textarea id="zim-difference" class="zim-note" placeholder="例：タイプや進化が違う">'+clean(editDifference)+'</textarea><label for="zim-level">難易度（正式追加前に必須）</label><select id="zim-level" class="zim-note">'+[["","未設定"],["easy","初級"],["normal","中級"],["hard","上級"]].map(([v,title])=>'<option value="'+v+'"'+(editLevel===v?' selected':'')+'>'+title+'</option>').join("")+'</select><div class="zim-actions"><button class="zim-act" data-save>'+(editIndex>=0?'編集を保存':'下書き保存')+'</button><details class="zim-files"><summary>📁 バックアップ・開発者向け</summary><button class="zim-act" data-export>JSONバックアップ</button><button class="zim-act" data-export-adopted>採用候補JSON（未反映）</button><label class="zim-act">JSON読み込み<input data-import type="file" accept=".json,application/json" style="max-width:120px;font-size:12px"></label></details></div><p role="status">'+clean(error)+'</p></details><section class="card section"><h2>お題一覧（全'+entries.length+'件）</h2><div class="zim-tabs">'+[["draft","未処理",counts.draft],["adopted","採用候補",counts.adopted],["archived","非採用",counts.archived],["all","全件",counts.total]].map(([v,label,n])=>'<button data-view="'+v+'" aria-pressed="'+String(view===v)+'">'+label+' '+n+'</button>').join("")+'</div><input id="zim-query" class="zim-filter-query" placeholder="ポケモン名・メモで検索" value="'+clean(query)+'"><button class="zim-act" data-filter-search>検索</button><button class="zim-act" data-filter-clear>解除</button><p class="small muted">表示 '+visible.length+'件。採用候補はゲーム未反映です。</p>'+visible.map((x,i)=>'<div class="zim-entry"><b>'+clean(x.a)+' × '+clean(x.b)+'</b><div>'+clean(x.note)+'</div><small>'+(x.status==='adopted'?'⭐ 採用候補・サーバー未承認':x.status==='archived'?'📦 非採用・保管':'📝 未処理')+'</small><div class="zim-alert">'+clean(compareServerCatalog(x,serverCatalog).label)+'</div>'+(x.status==="adopted"?(candidateForServer(x)?'<button class="zim-act" data-catalog-submit="'+x.rowIndex+'"'+(serverBusy?' disabled':'')+'>隔離サーバーへ候補を申請</button>':'<p class="small muted">送信前に「違う部分」「難易度」を編集してください。</p>'):'')+'<div class="zim-actions"><button class="zim-act" data-edit="'+x.rowIndex+'">編集</button>'+(x.status==='archived'?'<button class="zim-act" data-restore="'+x.rowIndex+'">未処理に戻す</button>':'<button class="zim-act" data-adopt="'+x.rowIndex+'">'+(x.status==='adopted'?'候補を解除':'採用候補へ')+'</button><button class="zim-act zim-archive" data-archive="'+x.rowIndex+'">非採用へ</button>')+'</div></div>').join("")+'</section></div>'+(libraryView==="official"?officialMarkup():"")+'</main>';
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
  localStorage.setItem(KEY,JSON.stringify(normalized));entries=normalized;serverCatalog=null;
 }
 function save(){
  const note=host.querySelector("#zim-note").value.trim();
  const difference=(host.querySelector("#zim-difference")?.value||editDifference).trim();
  const level=host.querySelector("#zim-level")?.value||editLevel;
  if(!chosen[0]||!chosen[1]){error="2匹を選択してください";editNote=note;draw();return}
  let candidate;
  try{candidate=normalizeEntry({a:chosen[0].jp,b:chosen[1].jp,aNo:chosen[0].no,bNo:chosen[1].no,note,difference,level,at:new Date().toISOString(),status:editIndex>=0?entries[editIndex].status:"draft"})}
  catch(e){error=e.message;editNote=note;draw();return}
  if(entries.some((item,i)=>i!==editIndex&&pairKey(item)===pairKey(candidate))){error="この組み合わせは登録済みです";editNote=note;draw();return}
  const next=[...entries];if(editIndex>=0)next[editIndex]=candidate;else next.push(candidate);
  try{persist(next);error="端末内に保存しました";editIndex=-1;editNote="";editDifference="";editLevel="";chosen=[null,null]}catch(e){error="保存できません："+e.message;editNote=note}
  draw();
 }
 function exportData(adoptedOnly=false){
  const chosenRows=adoptedOnly?entries.filter(x=>x.status==="adopted"):entries;
  if(adoptedOnly&&!chosenRows.length){error="採用候補がありません";draw();return}
  const blob=new Blob([JSON.stringify(exportDocument(chosenRows),null,2)],{type:"application/json"});
  const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=adoptedOnly?"zoroark-candidates-NOT-LIVE.json":"zoroark-questions-backup.json";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
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
 async function checkCatalog(){
  if(serverBusy||destroyed)return;
  if(!catalogGateway||typeof catalogGateway.getStatus!=="function"){
   serverCatalog=null;serverError="検証用サーバーとの接続はまだ準備中です";draw();return;
  }
  serverBusy=true;serverError="";draw();
  try{
   const result=await catalogGateway.getStatus();
   if(!result||!Array.isArray(result.baseKeys)||!Array.isArray(result.entries))
    throw new Error("カタログ応答が正しくありません");
   if(!destroyed){serverCatalog=result;serverError="";}
  }catch(e){if(!destroyed){serverCatalog=null;serverError="照合できません："+(e instanceof Error?e.message:"接続エラー");}}
  finally{serverBusy=false;if(!destroyed)draw()}
 }
 async function submitCandidate(i){
  if(destroyed||serverBusy||entries[i]?.status!=="adopted")return;
  const topic=candidateForServer(entries[i]);
  if(!topic){serverError="公開前に違いと難易度を入力してください";draw();return}
  if(!catalogGateway||typeof catalogGateway.submit!=="function"){
   serverError="検証サーバーへの申請は準備中です";draw();return}
  serverBusy=true;serverError="";draw();
  try{
   await catalogGateway.submit(topic);
   if(!destroyed){serverCatalog=null;serverError="候補をサーバーに申請しました。正式公開前に審査が必要です。";}
  }catch(e){if(!destroyed)serverError="送信できません："+(e instanceof Error?e.message:"通信エラー")}
  finally{serverBusy=false;if(!destroyed)draw()}
 }
 const onClick=e=>{
  const memo=host.querySelector("#zim-note");if(memo)editNote=memo.value;
  const diff=host.querySelector("#zim-difference");if(diff)editDifference=diff.value;
  const lev=host.querySelector("#zim-level");if(lev)editLevel=lev.value;
  if(e.target.closest("[data-back]")){destroy();onBack();return}
  const c=e.target.closest("[data-choose]");if(c){which=Number(c.dataset.choose);term="";showPicker();dialog.showModal();void changeGen(gen)}
  if(e.target.closest("[data-save]")){save();return}
  if(e.target.closest("[data-catalog-check]")){void checkCatalog();return}
  const sub=e.target.closest("[data-catalog-submit]");if(sub){void submitCandidate(Number(sub.dataset.catalogSubmit));return}
  const library=e.target.closest("[data-library]");
  if(library){libraryView=library.dataset.library==="official"?"official":"memo";draw();
   if(libraryView==="official"&&!serverCatalog&&!serverBusy)void checkCatalog();return}
  const level=e.target.closest("[data-official-level]");
  if(level){officialDifficulty=level.dataset.officialLevel;draw();return}
  if(e.target.closest("[data-official-search]")){
   officialQuery=host.querySelector("#zim-official-query")?.value||"";draw();return}
  if(e.target.closest("[data-official-clear]")){officialQuery="";draw();return}
  const tab=e.target.closest("[data-view]");if(tab){view=tab.dataset.view;draw();return}
  if(e.target.closest("[data-filter-search]")){query=host.querySelector("#zim-query")?.value||"";draw();return}
  if(e.target.closest("[data-filter-clear]")){query="";draw();return}
  const ed=e.target.closest("[data-edit]");if(ed){editIndex=Number(ed.dataset.edit);const x=entries[editIndex];chosen=[{jp:x.a,no:x.aNo},{jp:x.b,no:x.bNo}];editNote=x.note;editDifference=x.difference||"";editLevel=x.level||"";error="編集中";draw();window.scrollTo(0,0);return}
  const ad=e.target.closest("[data-adopt]");if(ad){const i=Number(ad.dataset.adopt);if(!entries[i]||entries[i].status==="archived")return;const next=entries.map((x,j)=>j===i?{...x,status:x.status==="adopted"?"draft":"adopted"}:x);try{persist(next);error="採用候補を変更しました。ゲームには未反映です"}catch{error="保存に失敗しました"}draw();return}
  const ar=e.target.closest("[data-archive]");if(ar){const i=Number(ar.dataset.archive);if(!entries[i]||entries[i].status==="archived")return;try{persist(entries.map((x,j)=>i===j?{...x,status:"archived"}:x));error="非採用として保管しました。あとから戻せます"}catch{error="保存に失敗しました"}draw();return}
  const rs=e.target.closest("[data-restore]");if(rs){const i=Number(rs.dataset.restore);if(entries[i]?.status!=="archived")return;try{persist(entries.map((x,j)=>i===j?{...x,status:"draft"}:x));error="未処理へ戻しました"}catch{error="保存に失敗しました"}draw();return}
  if(e.target.closest("[data-export-adopted]")){exportData(true);return}
  if(e.target.closest("[data-export]")){exportData();return}
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