// Local-only draft/edit helpers. No network calls and no writes to game catalog.
import {OFFICIAL_ZOROARK_42} from "./zoroark-official42.mjs?v=20261115-v1";
import {parseImport,mergeEntries,exportDocument} from "./zoroark-idea-library.mjs";
export const OFFICIAL_DRAFTS_KEY="ca-zoroark-official42-drafts-v1";
export const NOTEBOOK_FORMAT="ca-zoroark-notebook-v1";
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
export function notebookRows(entries,drafts,{kind="all",level="all",query=""}={}){
 if(!["all","official","memo"].includes(kind)||!["all","easy","normal","hard"].includes(level))throw Error("一覧の絞り込みが不正です");
 const term=String(query||"").normalize("NFKC").trim().toLocaleLowerCase("ja-JP");
 const official=kind==="memo"?[]:OFFICIAL_ZOROARK_42.map(row=>({...effectiveOfficial(row,drafts),source:"official"}));
 const memo=kind==="official"?[]:entries.map((row,index)=>({...row,source:"memo",index}));
 return [...official,...memo].filter(row=>{
  if(level!=="all"&&row.level!==level)return false;
  if(!term)return true;
  return [row.id,row.a,row.b,row.common,row.note,row.difference].some(v=>String(v??"").normalize("NFKC").toLocaleLowerCase("ja-JP").includes(term));
 });
}
export function notebookBackup(entries,drafts){
 const verified=verifyOfficialDrafts(drafts);
 return {format:NOTEBOOK_FORMAT,version:1,exportedAt:new Date().toISOString(),
  entries:exportDocument(entries).entries,officialDrafts:verified,
  notice:"端末内の編集・新規候補のみ。ゲームには反映されません。"};
}
export function parseNotebookImport(content){
 if(typeof content!=="string"||content.length>2000000)throw Error("JSONは2MB以内にしてください");
 let value;try{value=JSON.parse(content)}catch{throw Error("JSONを読み取れません")}
 if(value?.format===NOTEBOOK_FORMAT){
  if(!Array.isArray(value.entries))throw Error("保存形式が不正です");
  return {entries:parseImport(JSON.stringify({format:"ca-zoroark-ideas-v2",entries:value.entries})),
   officialDrafts:verifyOfficialDrafts(value.officialDrafts||{})};
 }
 return {entries:parseImport(content),officialDrafts:{}};
}
export function safeMergeNotebook(currentEntries,currentDrafts,incoming){
 const entries=mergeEntries(currentEntries,incoming.entries);
 const drafts={...verifyOfficialDrafts(currentDrafts)};
 let added=0,skipped=0;
 for(const [id,change] of Object.entries(incoming.officialDrafts)){
  if(Object.prototype.hasOwnProperty.call(drafts,id)){skipped++;continue}
  drafts[id]=change;added++;
 }
 return {entries:entries.entries,drafts:verifyOfficialDrafts(drafts),
  addedMemo:entries.added,skippedMemo:entries.skipped,addedOfficial:added,skippedOfficial:skipped};
}
