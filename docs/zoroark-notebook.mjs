// Local-only draft/edit helpers. No network calls and no writes to game catalog.
import {OFFICIAL_ZOROARK_42} from "./zoroark-official42.mjs?v=20261115-v1";
import {parseImport,mergeEntries,exportDocument,pairKey} from "./zoroark-idea-library.mjs";
export const OFFICIAL_DRAFTS_KEY="ca-zoroark-official42-drafts-v1";
export const NOTEBOOK_FORMAT="ca-zoroark-notebook-v1";
export const NOTEBOOK_TRASH_KEY="ca-zoroark-notebook-trash-v1";
const BASE=new Map(OFFICIAL_ZOROARK_42.map(row=>[row.id,row]));
const valid=(x,max)=>typeof x==="string"&&x.trim().length>0&&x.length<=max&&!/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(x);
const normalizeName=x=>String(x).normalize("NFKC").trim().toLocaleLowerCase("ja-JP");
export const pairNamesKey=(a,b)=>[normalizeName(a),normalizeName(b)].sort().join("|");
export function normalizeOfficialDraft(value,id){
 const base=BASE.get(id);
 if(!base||!value||typeof value!=="object"||Array.isArray(value))throw Error("正式お題のIDが不正です");
 const a=value.a,b=value.b,common=value.common,difference=value.difference,level=value.level;
 if(!valid(a,80)||!valid(b,80)||normalizeName(a)===normalizeName(b))throw Error("ポケモン名を2つ入力してください");
 if(!valid(common,500)||!valid(difference,500))throw Error("共通点と違う部分を500文字以内で入力してください");
 if(!["easy","normal","hard"].includes(level))throw Error("難易度を指定してください");
 return {a:a.trim(),b:b.trim(),common:common.trim(),difference:difference.trim(),level};
}
export function effectiveOfficial(row,drafts){
 const draft=drafts?.[row.id];
 return draft?{...row,...normalizeOfficialDraft(draft,row.id),localDraft:true}:row;
}
export function hasOfficialChanges(row,draft){
 if(!draft)return false;
 const effective=normalizeOfficialDraft(draft,row.id);
 return ["a","b","common","difference","level"].some(k=>effective[k]!==row[k]);
}
export function verifyOfficialDrafts(drafts){
 if(!drafts||typeof drafts!=="object"||Array.isArray(drafts)||Object.keys(drafts).length>42)throw Error("正式お題の編集データが不正です");
 const out={};
 for(const [id,value] of Object.entries(drafts)){
  const base=BASE.get(id);
  if(!base)throw Error("正式お題に存在しないIDです");
  const edit=normalizeOfficialDraft(value,id);
  if(hasOfficialChanges(base,edit))out[id]=edit;
 }
 const pairs=new Set();
 for(const row of OFFICIAL_ZOROARK_42){
  const pair=effectiveOfficial(row,out);
  const key=pairNamesKey(pair.a,pair.b);
  if(pairs.has(key))throw Error("正式お題の組み合わせが重複しています");
  pairs.add(key);
 }
 return out;
}
export function loadOfficialDrafts(storage){
 const text=storage.getItem(OFFICIAL_DRAFTS_KEY);
 if(!text)return {drafts:{},error:null};
 try{
  if(text.length>120000)throw Error("データが大きすぎます");
  return {drafts:verifyOfficialDrafts(JSON.parse(text)),error:null};
 }catch(e){
  // Never silently overwrite corrupt data. Export/recovery remains possible via browser storage.
  return {drafts:{},error:"正式お題の編集データを読み取れません。元データを保護するため編集保存を停止しています。"};
 }
}
export function saveOfficialDrafts(storage,proposed){
 const checked=verifyOfficialDrafts(proposed);
 storage.setItem(OFFICIAL_DRAFTS_KEY,JSON.stringify(checked));
 return checked;
}

const EMPTY_TRASH=()=>({officialIds:[],memoKeys:[]});
export function verifyNotebookTrash(value){
 if(value===undefined||value===null)return EMPTY_TRASH();
 if(!value||typeof value!=="object"||Array.isArray(value))throw Error("削除済みデータの形式が不正です");
 const {officialIds=[],memoKeys=[]}=value;
 if(!Array.isArray(officialIds)||!Array.isArray(memoKeys)||officialIds.length>42||memoKeys.length>500)
  throw Error("削除済みデータの件数が不正です");
 if(officialIds.some(id=>typeof id!=="string"||!BASE.has(id))||
    memoKeys.some(key=>typeof key!=="string"||key.length<1||key.length>200||/[\u0000-\u001F]/.test(key)))
  throw Error("削除済みデータに不正な項目があります");
 if(new Set(officialIds).size!==officialIds.length||new Set(memoKeys).size!==memoKeys.length)
  throw Error("削除済みデータが重複しています");
 return {officialIds:[...officialIds],memoKeys:[...memoKeys]};
}
export function loadNotebookTrash(storage){
 try{
  const raw=storage.getItem(NOTEBOOK_TRASH_KEY);
  if(!raw)return {trash:EMPTY_TRASH(),error:null};
  if(raw.length>180000)throw Error("保存サイズが大きすぎます");
  return {trash:verifyNotebookTrash(JSON.parse(raw)),error:null};
 }catch{
  return {trash:EMPTY_TRASH(),error:"削除済みデータを読み取れません。元データ保護のため削除・復元・読み込みを停止しています。"};
 }
}
export function saveNotebookTrash(storage,proposed){
 const value=verifyNotebookTrash(proposed);
 storage.setItem(NOTEBOOK_TRASH_KEY,JSON.stringify(value));
 return value;
}
export function isNotebookDeleted(row,trash){
 const t=verifyNotebookTrash(trash);
 return row.source==="official"?t.officialIds.includes(row.id):
  row.source==="memo"?t.memoKeys.includes(pairKey(row)):false;
}
export function notebookRows(entries,drafts,{kind="all",level="all",query="",trash=EMPTY_TRASH()}={}){
 if(!["all","official","memo","trash"].includes(kind)||!["all","easy","normal","hard"].includes(level))throw Error("一覧の絞り込みが不正です");
 const checked=verifyNotebookTrash(trash),officialHidden=new Set(checked.officialIds),memoHidden=new Set(checked.memoKeys);
 const term=String(query||"").normalize("NFKC").trim().toLocaleLowerCase("ja-JP");
 const official=kind==="memo"?[]:OFFICIAL_ZOROARK_42.map(row=>({...effectiveOfficial(row,drafts),source:"official",deleted:officialHidden.has(row.id)}));
 const memo=kind==="official"?[]:entries.map((row,index)=>({...row,source:"memo",index,deleted:memoHidden.has(pairKey(row))}));
 return [...official,...memo].filter(row=>{
  if(kind==="trash"?!row.deleted:row.deleted)return false;
  if(level!=="all"&&row.level!==level)return false;
  if(!term)return true;
  return [row.id,row.a,row.b,row.common,row.note,row.difference].some(v=>String(v??"").normalize("NFKC").toLocaleLowerCase("ja-JP").includes(term));
 });
}
export function notebookBackup(entries,drafts,trash=EMPTY_TRASH()){
 const verified=verifyOfficialDrafts(drafts);
 return {format:NOTEBOOK_FORMAT,version:2,exportedAt:new Date().toISOString(),
  entries:exportDocument(entries).entries,officialDrafts:verified,trash:verifyNotebookTrash(trash),
  notice:"端末内の編集・削除済み状態・新規候補のバックアップ。ゲーム本編には反映されません。"};
}
export function parseNotebookImport(content){
 if(typeof content!=="string"||content.length>2000000)throw Error("JSONは2MB以内にしてください");
 let value;try{value=JSON.parse(content)}catch{throw Error("JSONを読み取れません")}
 if(value?.format===NOTEBOOK_FORMAT){
  if(!Array.isArray(value.entries))throw Error("保存形式が不正です");
  return {entries:parseImport(JSON.stringify({format:"ca-zoroark-ideas-v2",entries:value.entries})),
   officialDrafts:verifyOfficialDrafts(value.officialDrafts||{}),trash:verifyNotebookTrash(value.trash)};
 }
 return {entries:parseImport(content),officialDrafts:{},trash:EMPTY_TRASH()};
}
export function safeMergeNotebook(currentEntries,currentDrafts,incoming,currentTrash=EMPTY_TRASH()){
 const entries=mergeEntries(currentEntries,incoming.entries);
 const drafts={...verifyOfficialDrafts(currentDrafts)};
 let added=0,skipped=0;
 for(const [id,change] of Object.entries(incoming.officialDrafts)){
  if(Object.prototype.hasOwnProperty.call(drafts,id)){skipped++;continue}
  drafts[id]=change;added++;
 }
 const before=verifyNotebookTrash(currentTrash),source=verifyNotebookTrash(incoming.trash);
 const mergedTrash=verifyNotebookTrash({officialIds:[...new Set([...before.officialIds,...source.officialIds])],
   memoKeys:[...new Set([...before.memoKeys,...source.memoKeys])]});
 return {entries:entries.entries,drafts:verifyOfficialDrafts(drafts),trash:mergedTrash,
  addedMemo:entries.added,skippedMemo:entries.skipped,addedOfficial:added,skippedOfficial:skipped,
  addedDeleted:mergedTrash.officialIds.length+mergedTrash.memoKeys.length-
   before.officialIds.length-before.memoKeys.length};
}
