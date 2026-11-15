import {pairKey,normalizeEntry,mergeEntries} from "./zoroark-idea-library.mjs";
import {OFFICIAL_ZOROARK_42,OFFICIAL_ZOROARK_LEVELS} from "./zoroark-official42.mjs?v=20261115-v1";
import {loadOfficialDrafts,saveOfficialDrafts,normalizeOfficialDraft,notebookRows,notebookBackup,parseNotebookImport,safeMergeNotebook,OFFICIAL_DRAFTS_KEY,loadNotebookTrash,saveNotebookTrash,NOTEBOOK_TRASH_KEY} from "./zoroark-notebook.mjs?v=20261115-trash1";

const URL_ROOT="https://raw.githubusercontent.com/Kaityo1221/Global-EN-Trainer/main/data/";
const KEY="ca-zoroark-admin-ideas-v1";
const clean=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const levelOptions=[["","未設定"],["easy","初級"],["normal","中級"],["hard","上級"]];
export function mountIdeaMemo({host,role,onBack,gameCatalogGateway}){
 if(role!=="admin")throw Error("ADMIN only");
 const style=document.createElement("style");
 style.textContent=".zim{max-width:700px;margin:auto}.zim-pair{display:grid;grid-template-columns:1fr 24px 1fr;gap:8px;align-items:center;margin:12px 0}.zim-poke{min-width:0;min-height:96px;border:2px solid #bef264;border-radius:18px;background:#f7fee7;font-size:clamp(18px,4vw,26px);font-weight:900;color:#365314;overflow-wrap:anywhere}.zim-tabs{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}.zim-tabs button{border:1px solid #bef264;border-radius:12px;background:#f7fee7;color:#365314;padding:10px 13px;font:inherit;font-weight:800}.zim-tabs button[aria-pressed=true],.zim-tabs button[aria-selected=true]{background:#a3e635}.zim-input{font:inherit;width:100%;min-width:0;box-sizing:border-box;border:1px solid #bef264;border-radius:11px;padding:11px;color:#1f2937;background:#fff;font-size:16px}.zim-note{min-height:90px;resize:vertical}.zim-label{display:block;margin:14px 0 6px;font-weight:850;color:#365314}.zim-actions{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}.zim-act{border:0;border-radius:12px;padding:11px 14px;background:#84cc16;color:#365314;font:inherit;font-weight:900}.zim-act.alt{border:1px solid #bef264;background:#f7fee7}.zim-act.danger{background:#fee2e2;color:#7f1d1d}.zim-msg{padding:12px;border:1px solid #fed7aa;border-radius:12px;background:#fffbeb;color:#854d0e;margin:12px 0}.zim-list-card{border:1px solid #d9f99d;border-radius:14px;margin:11px 0;padding:12px;overflow-wrap:anywhere}.zim-list-card summary{font-weight:850;cursor:pointer;font-size:17px}.zim-list-card summary:focus-visible,.zim-act:focus-visible,.zim-tabs button:focus-visible{outline:3px solid #365314;outline-offset:2px}.zim-meta{font-size:12px;color:#64748b;padding:6px 0}.zim-list-card p{margin:9px 0}.zim-dlg{border:0;border-radius:18px;width:min(94vw,640px);max-height:94dvh;padding:0}.zim-dlg::backdrop{background:#0f172a99}.zim-top{position:sticky;top:0;background:white;padding:15px}.zim-tabs button[aria-selected=true]{background:#a3e635}.zim-list{padding:12px;display:grid;grid-template-columns:1fr 1fr;gap:8px;max-height:50dvh;overflow-y:auto}.zim-list button{padding:12px 5px;border-radius:10px;border:1px solid #bef264;background:#f7fee7;color:#365314;font:inherit;font-weight:850}.zim-list small{display:block;color:#64748b;font-size:11px}.zim-search{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:10px 0}.zim-search .zim-input{flex:1;min-width:165px}.zim-form{padding-top:4px}.zim-form label{display:block}.zim-count{font-weight:850;color:#365314}.zim-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.zim-form details{margin-top:10px}@media(max-width:420px){.zim-grid{grid-template-columns:1fr}.zim-search button{flex:0 0 auto}}";
 document.head.append(style);
 const dialog=document.createElement("dialog");dialog.className="zim-dlg";document.body.append(dialog);
 let destroyed=false,mode="book",kind="all",level="all",query="",editIndex=-1,editOfficialId=null,error="",message="";
 let chosen=[null,null],which=0,gen=1,all=[],term="",loadId=0,searchMode=false;
 let draftCommon="",draftDifference="",draftLevel="";
 const genCache=new Map();
 let entries=[],entryReadError=null;
 try{const raw=JSON.parse(localStorage.getItem(KEY)||"[]");if(!Array.isArray(raw))throw Error("invalid");entries=raw.slice(0,500).map(normalizeEntry)}
 catch{entryReadError="保存済みメモを読み取れません。元データ保護のため書き込みを停止しています。";error=entryReadError}
 const loaded=loadOfficialDrafts(localStorage);
 let officialDrafts=loaded.drafts,officialError=loaded.error;
 const loadedTrash=loadNotebookTrash(localStorage);
 let trash=loadedTrash.trash,trashError=loadedTrash.error;
 let gameStates=new Map(),gameStatusReady=false,gameWritesReady=false,gameBusy=false;
 let gameError="ゲーム出題との接続は未確認です。正式お題の削除・復元は利用できません。";
 function gameTrash(){
  const disabled=gameStatusReady?[...gameStates.values()].filter(x=>x.disabled).map(x=>x.topic_id):[];
  return {officialIds:disabled,memoKeys:trash.memoKeys};
 }
 function canChangeGame(){return !!gameCatalogGateway&&gameStatusReady&&gameWritesReady&&!gameBusy}
 async function refreshGameStatus(){
  if(!gameCatalogGateway){draw();return}
  gameBusy=true;draw();
  try{
   const data=await gameCatalogGateway.listStates();
   if(!data||!Array.isArray(data.states)||data.states.length>42)throw Error("管理APIの応答が不正です");
   const validIds=new Set(OFFICIAL_ZOROARK_42.map(x=>x.id)),states=new Map();
   for(const v of data.states){
    if(!v||!validIds.has(v.topic_id)||typeof v.disabled!=="boolean"||
       !Number.isSafeInteger(v.revision)||v.revision<1||states.has(v.topic_id))
      throw Error("出題状態が一致しません");
    states.set(v.topic_id,v);
   }
   gameStates=states;gameStatusReady=true;gameWritesReady=data.writeEnabled===true;
   gameError=gameWritesReady?"":"ゲームの出題停止操作は現在無効です。";
  }catch(e){gameStatusReady=false;gameWritesReady=false;gameError="ゲーム出題状態を確認できません："+(e.message||"接続エラー")}
  gameBusy=false;if(!destroyed)draw();
 }
 async function changeGameState(id,disabled){
  if(!canChangeGame()){error=gameError||"ゲームとの接続が確認できません";draw();return}
  const row=OFFICIAL_ZOROARK_42.find(x=>x.id===id);if(!row)return;
  const prior=gameStates.get(id)||{topic_id:id,disabled:false,revision:0};
  if(prior.disabled===disabled)return;
  if(!window.confirm("「"+row.a+" × "+row.b+"」を"+(disabled?"ゲームの今後の出題から停止":"ゲームの今後の出題に復帰")+
      "しますか？\nすでに開始したラウンドは変更されません。"))return;
  gameBusy=true;error="";message="";draw();
  try{
   const result=await gameCatalogGateway.setState(id,disabled,prior.revision);
   const v=result?.state;
   if(!result?.gameConfirmed||!v||v.topic_id!==id||v.disabled!==disabled||v.revision!==prior.revision+1)
    throw Error("ゲーム側の反映確認に失敗しました");
   gameStates.set(id,v);editOfficialId=null;
   message=disabled?"ゲームの次回以降の出題から停止しました。削除済みから戻せます。":"ゲームの次回以降の出題対象に戻しました。";
  }catch(e){error="ゲームへの反映に失敗しました："+(e.message||"接続エラー")+
   "。実状態を再確認してください。";gameStatusReady=false;gameWritesReady=false}
  gameBusy=false;if(!destroyed)draw();
 }
 const countLocal=()=>entries.length;
 function nav(){
  return '<div class="zim-tabs" role="group" aria-label="お題の操作モード">'+
   '<button data-catalog-view="create" aria-pressed="'+String(mode==="create")+'">✨ ネタを新しく作る</button>'+
   '<button data-catalog-view="book" aria-pressed="'+String(mode==="book")+'">📚 ネタ帳</button></div>';
 }
 function header(hint){
  return '<section class="card hero"><button data-back class="zim-act alt">← 戻る</button><h1>🦊 お題管理</h1>'+
   '<p class="muted">ADMIN専用 · '+clean(hint)+'</p>'+nav()+'</section>';
 }
 function alerts(){
  return (error?'<p class="zim-msg" role="alert">'+clean(error)+'</p>':"")+
   (message?'<p class="zim-msg" role="status">'+clean(message)+'</p>':"")+
   (officialError?'<p class="zim-msg" role="alert">'+clean(officialError)+'</p>':"")+
   (trashError?'<p class="zim-msg" role="alert">'+clean(trashError)+'</p>':"")+
   (gameError?'<p class="zim-msg" role="status">'+clean(gameError)+'</p>':"");
 }
 function creationScreen(){
  const editing=editIndex>=0;
  return '<main class="zim">'+header(editing?"メモを編集":"新しい組み合わせを作成")+
   '<section class="card section zim-form"><h2>'+(editing?"✏️ 自作メモを編集":"✨ ネタを新しく作る")+'</h2>'+
   '<p class="muted small">新しく作ったお題は端末内のネタ帳に保存します。ゲームへの自動反映はありません。</p>'+
   '<div class="zim-pair">'+chosen.map((p,i)=>'<button type="button" class="zim-poke" data-choose="'+i+'"><small>ポケモン'+(i?"B":"A")+'</small>'+clean(p?.jp||"選択する")+'</button>').join('<b style="text-align:center">×</b>')+'</div>'+
   '<label class="zim-label" for="zim-note">似ている部分・共通点</label>'+
   '<textarea id="zim-note" class="zim-input zim-note" maxlength="2000" placeholder="例：2匹とも尻尾が長い">'+clean(draftCommon)+'</textarea>'+
   '<label class="zim-label" for="zim-difference">違う部分</label>'+
   '<textarea id="zim-difference" class="zim-input zim-note" maxlength="500" placeholder="例：タイプや進化のしかたが違う">'+clean(draftDifference)+'</textarea>'+
   '<label class="zim-label" for="zim-level">難易度</label>'+
   '<select id="zim-level" class="zim-input">'+levelOptions.map(([v,t])=>'<option value="'+v+'"'+(draftLevel===v?' selected':'')+'>'+t+'</option>').join("")+'</select>'+
   '<div class="zim-actions"><button class="zim-act" data-save>'+(editing?"編集を保存":"ネタ帳へ保存")+'</button>'+
   (editing?'<button class="zim-act danger" data-memo-delete="'+editIndex+'">🗑 このメモを削除</button>':"")+
   '<button class="zim-act alt" data-catalog-view="book">ネタ帳に戻る</button></div>'+alerts()+'</section></main>';
 }
 function officialEditor(){
  const base=OFFICIAL_ZOROARK_42.find(x=>x.id===editOfficialId);
  if(!base)return '';
  const row={...base,...(officialDrafts[base.id]||{})};
  return '<section class="card section zim-form"><h2>✏️ 正式お題 #'+clean(base.id)+' を編集</h2>'+
   '<p class="zim-msg">ここで保存する変更は、この端末の<strong>編集下書き</strong>です。ゲーム本編の正式42組は変わりません。</p>'+
   '<div class="zim-grid"><div><label class="zim-label" for="zim-official-a">ポケモンA</label><input id="zim-official-a" class="zim-input" maxlength="80" value="'+clean(row.a)+'"></div>'+
   '<div><label class="zim-label" for="zim-official-b">ポケモンB</label><input id="zim-official-b" class="zim-input" maxlength="80" value="'+clean(row.b)+'"></div></div>'+
   '<label class="zim-label" for="zim-official-common">似ている部分・共通点</label><textarea id="zim-official-common" class="zim-input zim-note" maxlength="500">'+clean(row.common)+'</textarea>'+
   '<label class="zim-label" for="zim-official-difference">違う部分</label><textarea id="zim-official-difference" class="zim-input zim-note" maxlength="500">'+clean(row.difference)+'</textarea>'+
   '<label class="zim-label" for="zim-official-level">難易度</label><select id="zim-official-level" class="zim-input">'+levelOptions.filter(x=>x[0]).map(([v,t])=>'<option value="'+v+'"'+(row.level===v?' selected':'')+'>'+t+'</option>').join("")+'</select>'+
   '<div class="zim-actions"><button class="zim-act" data-official-save>編集下書きを保存</button>'+
   (officialDrafts[base.id]?'<button class="zim-act danger" data-official-revert>元の42組に戻す</button>':"")+
   '<button class="zim-act danger" data-official-delete '+(canChangeGame()?'':'disabled aria-disabled="true"')+'>🗑 ゲームの出題から停止</button>'+
   '<button class="zim-act alt" data-game-refresh '+(gameBusy?'disabled':'')+'>🔄 ゲーム状態を再確認</button>'+ 
   '<button class="zim-act alt" data-official-cancel>キャンセル</button></div>'+
   alerts()+'</section>';
 }
 function bookScreen(){
  const effectiveTrash=gameTrash();
  const rows=notebookRows(entries,officialDrafts,{kind,level,query,trash:effectiveTrash});
  const changed=Object.keys(officialDrafts).length;
  const hiddenCount=effectiveTrash.officialIds.length+effectiveTrash.memoKeys.length;
  const activeCount=notebookRows(entries,officialDrafts,{kind:"all",trash:effectiveTrash}).length;
  const memoDraftCount=entries.filter(x=>x.status!=="adopted"&&!effectiveTrash.memoKeys.includes(pairKey(x))).length;
  const memoAdoptedCount=entries.filter(x=>x.status==="adopted"&&!effectiveTrash.memoKeys.includes(pairKey(x))).length;
  const levels=[["all","すべて"],["easy","初級"],["normal","中級"],["hard","上級"]];
  const groups=[["all","全件"],["official","正式42組"],["memo","自作メモ"],["trash","🗑 削除済み "+hiddenCount]];
  return '<main class="zim">'+header("登録したお題を確認・編集")+
   (editOfficialId?officialEditor():
   '<section class="card section"><h2>📚 ネタ帳</h2>'+
   '<p class="muted small">正式42組の削除・復元は全CA共通のゲーム出題対象にも反映します。管理者認証・サーバー確認が必要です。自作メモは端末内保存のため、削除してもゲーム出題には影響しません。</p>'+
   '<p class="zim-count">正式 '+OFFICIAL_ZOROARK_42.length+'組 ／ 自作 '+countLocal()+'件 ／ 編集下書き '+changed+'件 ／ 削除済み '+hiddenCount+'件</p>'+
   '<p class="muted small">自作メモの内訳：📝 未処理 '+memoDraftCount+'件 ／ ⭐ 採用候補 '+memoAdoptedCount+'件 ／ 🗑 削除済み '+effectiveTrash.memoKeys.length+'件。採用候補はゲーム未反映です。</p>'+
   '<div class="zim-actions"><button class="zim-act alt" data-game-refresh '+(gameBusy?'disabled':'')+'>🔄 ゲーム出題状態を確認</button></div>'+
   '<div class="zim-tabs" role="group" aria-label="お題の種類">'+groups.map(([v,label])=>'<button data-book-kind="'+v+'" aria-pressed="'+String(kind===v)+'">'+label+'</button>').join("")+'</div>'+
   '<div class="zim-tabs" role="group" aria-label="難易度">'+levels.map(([v,label])=>'<button data-book-level="'+v+'" aria-pressed="'+String(level===v)+'">'+label+'</button>').join("")+'</div>'+
   '<div class="zim-search"><input id="zim-book-search" class="zim-input" type="search" aria-label="ネタ帳を検索" placeholder="ポケモン名・共通点・違い" value="'+clean(query)+'">'+
   '<button class="zim-act" data-book-search>検索</button><button class="zim-act alt" data-book-clear>解除</button></div>'+
   '<p class="muted small" role="status">表示 '+rows.length+' / '+(kind==="trash"?hiddenCount:activeCount)+'件</p>'+
   '<details><summary>📁 バックアップ・復元</summary><div class="zim-actions"><button class="zim-act alt" data-export>ネタ帳をJSON保存</button>'+
   '<button class="zim-act alt" data-export-adopted>⭐ 採用候補JSON（ゲーム未反映）</button>'+
   '<label class="zim-act alt">JSON読み込み <input type="file" data-import accept=".json,application/json" style="max-width:130px"></label></div>'+
   '<p class="muted small">自作メモ・正式42組の編集下書き・削除済み状態を保存します。旧形式のメモJSONも読み込めます。</p></details>'+alerts()+'</section>')+
   (!editOfficialId?'<section class="card section"><h2>お題一覧</h2>'+
   (rows.map(row=>{
    const isOfficial=row.source==="official";
    const label=isOfficial?clean(OFFICIAL_ZOROARK_LEVELS[row.level]):clean(OFFICIAL_ZOROARK_LEVELS[row.level]||"難易度未設定");
    const note=isOfficial?row.common:row.note;
    const desc=row.difference||"未記入";
    return '<article class="zim-list-card"><details><summary>'+clean(row.a)+' × '+clean(row.b)+'</summary>'+
     '<div class="zim-meta">'+(isOfficial?"正式 #"+clean(row.id):"自作メモ")+' · '+label+(row.localDraft?" · ✏️ 編集下書きあり":"")+(row.deleted?" · 🗑 ネタ帳から削除済み":"")+'</div>'+
     '<p><b>似ている部分：</b>'+clean(note||"未記入")+'</p><p><b>違う部分：</b>'+clean(desc)+'</p>'+
     '</details><div class="zim-actions">'+(row.deleted?
       (isOfficial?'<button class="zim-act alt" data-official-restore="'+clean(row.id)+'" '+(canChangeGame()?'':'disabled')+'>↩ ゲーム出題へ復元</button>':
       '<button class="zim-act alt" data-memo-restore="'+row.index+'">↩ ネタ帳に復元</button>'):
       isOfficial?
       '<button class="zim-act alt" data-official-edit="'+clean(row.id)+'">✏️ 編集</button>'+
       '<button class="zim-act danger" data-official-delete="'+clean(row.id)+'" '+(canChangeGame()?'':'disabled')+'>🗑 ゲームから停止</button>'+
       (row.localDraft?'<span class="muted small">ゲーム未反映</span>':""):
       '<button class="zim-act alt" data-edit="'+row.index+'">✏️ 編集</button>'+
       '<button class="zim-act danger" data-memo-delete="'+row.index+'">🗑 削除</button>'+
       '<button class="zim-act alt" data-adopt="'+row.index+'">'+(row.status==="adopted"?"採用候補を解除":"採用候補にする")+'</button>'+
       (row.status==="adopted"?'<span class="muted small">ゲーム未反映</span>':""))+'</div></article>';
   }).join("")||'<p class="muted">該当するお題はありません。</p>')+'</section>':"")+'</main>';
 }
 function draw(){host.innerHTML=mode==="create"?creationScreen():bookScreen()}
 function rememberForm(){
  if(mode!=="create")return;
  const note=host.querySelector("#zim-note");if(note)draftCommon=note.value;
  const diff=host.querySelector("#zim-difference");if(diff)draftDifference=diff.value;
  const lvl=host.querySelector("#zim-level");if(lvl)draftLevel=lvl.value;
 }
 function persist(next){
  if(entryReadError)throw Error(entryReadError);
  const normalized=next.map(normalizeEntry);
  if(normalized.length>500)throw Error("登録上限500件です");
  localStorage.setItem(KEY,JSON.stringify(normalized));entries=normalized;
 }
 function save(){
  rememberForm();
  if(!chosen[0]||!chosen[1]){error="2匹のポケモンを選んでください";draw();return}
  let candidate;
  try{
   candidate=normalizeEntry({a:chosen[0].jp,b:chosen[1].jp,aNo:chosen[0].no,bNo:chosen[1].no,
    note:draftCommon,difference:draftDifference,level:draftLevel,at:new Date().toISOString(),
    status:editIndex>=0?entries[editIndex].status:"draft"});
   if(entries.some((row,i)=>i!==editIndex&&pairKey(row)===pairKey(candidate)))throw Error("この組み合わせはネタ帳に登録済みです");
   const next=[...entries];if(editIndex>=0)next[editIndex]=candidate;else next.push(candidate);
   persist(next);
   editIndex=-1;chosen=[null,null];draftCommon="";draftDifference="";draftLevel="";
   mode="book";message="ネタ帳に保存しました。ゲームには未反映です。";error="";
  }catch(e){error=e.message||"保存に失敗しました"}
  draw();
 }
 function saveOfficial(){
  if(!editOfficialId||officialError)return;
  const id=editOfficialId;
  try{
   const value={
    a:host.querySelector("#zim-official-a")?.value||"",
    b:host.querySelector("#zim-official-b")?.value||"",
    common:host.querySelector("#zim-official-common")?.value||"",
    difference:host.querySelector("#zim-official-difference")?.value||"",
    level:host.querySelector("#zim-official-level")?.value||""
   };
   const checked=normalizeOfficialDraft(value,id);
   officialDrafts=saveOfficialDrafts(localStorage,{...officialDrafts,[id]:checked});
   editOfficialId=null;error="";message="編集下書きを保存しました。ゲーム本編にはまだ反映されません。";
  }catch(e){error="保存できません："+(e.message||"不明なエラー")}
  draw();
 }

 function deleteOfficial(id){void changeGameState(id,true)}
 function deleteMemo(index){
  if(!Number.isSafeInteger(index)||index<0||index>=entries.length)return;
  if(trashError){error=trashError;draw();return}
  const row=entries[index],id=pairKey(row);
  if(trash.memoKeys.includes(id))return;
  if(!window.confirm("自作メモ「"+row.a+" × "+row.b+"」をネタ帳から削除しますか？\n「削除済み」から元に戻せます。"))return;
  try{
   trash=saveNotebookTrash(localStorage,{...trash,memoKeys:[...trash.memoKeys,id]});
   editIndex=-1;mode="book";error="";message="自作メモを削除済みに移しました。復元可能です。";
  }catch(e){error="削除できません："+e.message}
  draw();
 }
 function restoreDeleted(type,value){
  if(type==="official"){void changeGameState(value,false);return}
  if(trashError){error=trashError;draw();return}
  if(!entries.some(x=>pairKey(x)===value))return;
  try{
   trash=saveNotebookTrash(localStorage,{...trash,memoKeys:trash.memoKeys.filter(id=>id!==value)});
   error="";message="自作メモをネタ帳へ復元しました。";
  }catch(e){error="復元できません："+e.message}
  draw();
 }
 function exportData(){
  try{
   if(entryReadError||officialError||trashError)throw Error("保存データを読み取れません。元データ保護のため不完全なバックアップを作成しません。");
   const data=notebookBackup(entries,officialDrafts,gameTrash());
   const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
   const url=URL.createObjectURL(blob);
   const link=document.createElement("a");link.href=url;link.download="zoroark-notebook-backup.json";link.click();
   setTimeout(()=>URL.revokeObjectURL(url),1000);
  }catch(e){error="バックアップ失敗："+e.message;draw()}
 }
 function exportAdoptedCandidates(){
  try{
   if(entryReadError||trashError)throw Error("保存データを安全に読み取れません");
   const rows=entries.filter(x=>x.status==="adopted"&&!trash.memoKeys.includes(pairKey(x)));
   if(!rows.length)throw Error("採用候補がありません");
   // Export is local-only and deliberately cannot publish to the shared game.
   const data=notebookBackup(rows,{}, {officialIds:[],memoKeys:[]});
   const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
   const url=URL.createObjectURL(blob),link=document.createElement("a");
   link.href=url;link.download="zoroark-candidates-NOT-LIVE.json";link.click();
   setTimeout(()=>URL.revokeObjectURL(url),1000);
  }catch(e){error="採用候補の保存失敗："+e.message;draw()}
 }
 async function importData(file){
  if(!file)return;
  try{
   if(officialError||entryReadError||trashError)throw Error("保存データに読み取りエラーがあるため、安全のため復元できません");
   if(file.size>2000000)throw Error("JSONは2MB以内にしてください");
   const incoming=parseNotebookImport(await file.text());
   const excludedFromImport=incoming.trash.officialIds.length;
   // Backups cannot directly change globally served game content.
   incoming.trash.officialIds=[];
   const merged=safeMergeNotebook(entries,officialDrafts,incoming,{officialIds:[],memoKeys:trash.memoKeys});
   const label="新規メモ"+merged.addedMemo+"件・正式の編集下書き"+merged.addedOfficial+
    "件・削除済み状態"+merged.addedDeleted+"件を追加します。既存の編集は上書きしません。実行しますか？";
   if(!window.confirm(label))return;
   // Preserve a full JSON backup before import. Each existing storage key remains recoverable.
   trash=saveNotebookTrash(localStorage,{officialIds:trash.officialIds,memoKeys:merged.trash.memoKeys});
   officialDrafts=saveOfficialDrafts(localStorage,merged.drafts);
   persist(merged.entries);
   error="";message="復元しました。メモ"+merged.addedMemo+"件、正式編集"+merged.addedOfficial+"件、削除済み状態"+merged.addedDeleted+"件を追加。"+(excludedFromImport?"正式お題のゲーム停止"+excludedFromImport+"件は安全のため自動適用していません。":"");
  }catch(e){error="読み込み失敗："+e.message}
  draw();
 }
 function renderChoices(){
  const choices=all.filter(x=>!term||x.jp.includes(term)||(x.en||"").toLowerCase().includes(term.toLowerCase())||x.no.includes(term)).slice(0,200);
  const list=dialog.querySelector(".zim-list");
  if(list)list.innerHTML=choices.map(x=>'<button type="button" data-id="'+clean(x.no)+'">'+clean(x.jp)+'<small>No.'+clean(x.no)+' / Gen '+clean(x.gen)+' / '+clean(x.en)+'</small></button>').join("")||'<p>候補がありません</p>';
 }
 function showPicker(){
  dialog.innerHTML='<div class="zim-top"><b>ポケモン'+(which?"B":"A")+'を選択</b> <button type="button" data-close class="zim-act alt">閉じる</button>'+
   '<input class="zim-input" aria-label="名前検索" placeholder="名前・図鑑番号" autocomplete="off" value="'+clean(term)+'">'+
   '<button type="button" data-search class="zim-act">🔎 検索する</button></div>'+
   '<div class="zim-tabs">'+Array.from({length:9},(_,i)=>'<button data-gen="'+(i+1)+'" aria-selected="'+(gen===i+1)+'">Gen '+(i+1)+'</button>').join("")+'</div>'+
   '<div class="zim-list"></div>';renderChoices();
 }
 async function getGen(n){
  if(genCache.has(n))return genCache.get(n);
  const r=await fetch(URL_ROOT+"gen"+n+".json");if(!r.ok)throw Error("Generation "+n+" unavailable");
  const v=await r.json();if(!Array.isArray(v))throw Error("Invalid list");
  const rows=v.filter(x=>x&&typeof x.jp==="string"&&typeof x.no==="string");genCache.set(n,rows);return rows;
 }
 async function changeGen(n){
  gen=n;searchMode=false;term="";const search=dialog.querySelector(".zim-top input");if(search){search.value="";search.blur()}
  all=[];const requestId=++loadId;
  dialog.querySelectorAll("[data-gen]").forEach(b=>b.setAttribute("aria-selected",String(Number(b.dataset.gen)===n)));
  renderChoices();
  try{const v=await getGen(n);if(!destroyed&&requestId===loadId){all=v;renderChoices()}}
  catch{if(!destroyed&&requestId===loadId)dialog.querySelector(".zim-list").textContent="一覧を取得できませんでした。"}
 }
 async function searchAll(){
  const search=dialog.querySelector(".zim-top input");const value=(search?.value||"").trim();search?.blur();
  if(!value){await changeGen(gen);return}
  const requestId=++loadId;term=value;searchMode=true;all=[];
  dialog.querySelectorAll("[data-gen]").forEach(b=>b.setAttribute("aria-selected","false"));
  const list=dialog.querySelector(".zim-list");if(list)list.textContent="全世代を検索中…";
  const results=await Promise.allSettled(Array.from({length:9},(_,i)=>getGen(i+1)));
  if(destroyed||requestId!==loadId)return;
  all=results.filter(x=>x.status==="fulfilled").flatMap(x=>x.value);
  if(results.every(x=>x.status==="rejected")){if(list)list.textContent="一覧を取得できませんでした。";return}
  const first=all.find(x=>x.jp.includes(value)||(x.en||"").toLowerCase().includes(value.toLowerCase())||x.no.includes(value));
  if(first){gen=Number(first.gen)||gen}
  dialog.querySelectorAll("[data-gen]").forEach(b=>b.setAttribute("aria-selected",String(!!first&&Number(b.dataset.gen)===gen)));
  renderChoices();
 }
 const onClick=e=>{
  if(e.target.closest("[data-back]")){destroy();onBack();return}
  const tab=e.target.closest("[data-catalog-view]");
  if(tab){rememberForm();const nextMode=tab.dataset.catalogView==="create"?"create":"book";
   if(nextMode==="create"&&mode!=="create"){editIndex=-1;chosen=[null,null];draftCommon="";draftDifference="";draftLevel=""}
   mode=nextMode;if(mode==="book")editOfficialId=null;error=entryReadError||"";message="";draw();return}
  const group=e.target.closest("[data-book-kind]");
  if(group){query=host.querySelector("#zim-book-search")?.value||query;kind=group.dataset.bookKind;draw();return}
  const lvl=e.target.closest("[data-book-level]");
  if(lvl){query=host.querySelector("#zim-book-search")?.value||query;level=lvl.dataset.bookLevel;draw();return}
  if(e.target.closest("[data-book-search]")){query=host.querySelector("#zim-book-search")?.value||"";draw();return}
  if(e.target.closest("[data-book-clear]")){query="";draw();return}
  const off=e.target.closest("[data-official-edit]");
  if(off){editOfficialId=off.dataset.officialEdit;error="";message="";draw();window.scrollTo(0,0);return}
  if(e.target.closest("[data-official-save]")){saveOfficial();return}
  if(e.target.closest("[data-game-refresh]")){void refreshGameStatus();return}
  const offDelete=e.target.closest("[data-official-delete]");
  if(offDelete){deleteOfficial(offDelete.dataset.officialDelete||editOfficialId);return}
  const memoDelete=e.target.closest("[data-memo-delete]");
  if(memoDelete){deleteMemo(Number(memoDelete.dataset.memoDelete));return}
  const offRestore=e.target.closest("[data-official-restore]");
  if(offRestore){restoreDeleted("official",offRestore.dataset.officialRestore);return}
  const memoRestore=e.target.closest("[data-memo-restore]");
  if(memoRestore){const row=entries[Number(memoRestore.dataset.memoRestore)];
   if(row)restoreDeleted("memo",pairKey(row));return}
  if(e.target.closest("[data-official-cancel]")){editOfficialId=null;error="";draw();return}
  if(e.target.closest("[data-official-revert]")){
   if(officialError||!editOfficialId)return;
   if(!window.confirm("この端末の正式お題の編集下書きを破棄し、元の内容に戻しますか？"))return;
   try{const next={...officialDrafts};delete next[editOfficialId];
    officialDrafts=saveOfficialDrafts(localStorage,next);editOfficialId=null;error="";message="元の正式お題に戻しました。"}
   catch(e){error="元に戻せません："+e.message}
   draw();return;
  }
  const memoEdit=e.target.closest("[data-edit]");
  if(memoEdit){
   const n=Number(memoEdit.dataset.edit),v=entries[n];if(!v)return;
   editIndex=n;chosen=[{jp:v.a,no:v.aNo},{jp:v.b,no:v.bNo}];draftCommon=v.note;draftDifference=v.difference||"";draftLevel=v.level||"";
   mode="create";message="";error="";draw();window.scrollTo(0,0);return;
  }
  const adopt=e.target.closest("[data-adopt]");
  if(adopt){
   const n=Number(adopt.dataset.adopt);
   if(!entries[n])return;
   try{persist(entries.map((x,i)=>i===n?{...x,status:x.status==="adopted"?"draft":"adopted"}:x));
    message="状態を保存しました。採用候補にしてもゲームには自動反映されません。";error=""}
   catch(e){error="保存失敗："+e.message}draw();return;
  }
  const c=e.target.closest("[data-choose]");
  if(c){rememberForm();which=Number(c.dataset.choose);term="";showPicker();dialog.showModal();void changeGen(gen);return}
  if(e.target.closest("[data-save]")){save();return}
  if(e.target.closest("[data-export-adopted]")){exportAdoptedCandidates();return}
  if(e.target.closest("[data-export]")){exportData();return}
 };
 const onDialog=e=>{
  if(e.target.closest("[data-close]")){dialog.close();return}
  if(e.target.closest("[data-search]")){void searchAll();return}
  const g=e.target.closest("[data-gen]");if(g){void changeGen(Number(g.dataset.gen));return}
  const pick=e.target.closest("[data-id]");
  if(pick){const x=all.find(p=>p.no===pick.dataset.id);
   if(x){chosen[which]=x;gen=Number(x.gen)||gen;dialog.close();draw()}return}
 };
 const onKey=e=>{if(e.target.matches(".zim-top input")&&e.key==="Enter"&&!e.isComposing){e.preventDefault();void searchAll()}};
 const onImport=e=>{if(e.target.matches("[data-import]"))void importData(e.target.files?.[0])};
 host.addEventListener("click",onClick);host.addEventListener("change",onImport);
 dialog.addEventListener("click",onDialog);dialog.addEventListener("keydown",onKey);
 function destroy(){destroyed=true;host.removeEventListener("click",onClick);host.removeEventListener("change",onImport);dialog.removeEventListener("click",onDialog);dialog.removeEventListener("keydown",onKey);dialog.close();dialog.remove();style.remove()}
draw();void refreshGameStatus();return destroy;
}
