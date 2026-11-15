// Pure, local-only JSON library utilities. Never publishes or writes remote data.
export const pairKey=x=>[String(x.aNo||x.a).trim(),String(x.bNo||x.b).trim()].sort().join("|");
const validString=(x,max=200)=>typeof x==="string"&&x.length<=max;
export function normalizeEntry(x){
 if(!x||typeof x!=="object"||Array.isArray(x)||!validString(x.a,80)||!validString(x.b,80)||!x.a.trim()||!x.b.trim())throw Error("名前の形式が正しくありません");
 const aNo=String(x.aNo||"").trim(),bNo=String(x.bNo||"").trim();
 if(aNo&&!/^\d{1,4}$/.test(aNo))throw Error("図鑑番号が不正です");
 if(bNo&&!/^\d{1,4}$/.test(bNo))throw Error("図鑑番号が不正です");
 if(x.a===x.b||(aNo&&bNo&&Number(aNo)===Number(bNo)))throw Error("同じポケモンは登録できません");
 if(x.note!=null&&!validString(x.note,2000))throw Error("メモが長すぎます");
 if(x.difference!=null&&!validString(x.difference,500))throw Error("違いの説明が長すぎます");
 if(x.level!=null&&!["","easy","normal","hard"].includes(x.level))throw Error("難易度の指定が不正です");
 return {a:x.a.trim(),b:x.b.trim(),aNo,bNo,note:(x.note||"").trim(),difference:(x.difference||"").trim(),level:x.level||"",at:validString(x.at,60)?x.at:"",status:x.status==="adopted"?"adopted":x.status==="archived"?"archived":"draft"};
}
export function mergeEntries(existing,incoming){
 const output=existing.map(normalizeEntry),seen=new Set(output.map(pairKey));let added=0,skipped=0;
 for(const item of incoming){
  const x=normalizeEntry(item),k=pairKey(x);
  if(seen.has(k)){skipped++;continue}
  seen.add(k);output.push(x);added++;
 }
 if(output.length>500)throw Error("登録上限500件を超えます");
 return {entries:output,added,skipped};
}
export function parseImport(content){
 if(typeof content!=="string"||content.length>2000000)throw Error("JSONは2MB以内にしてください");
 let root;try{root=JSON.parse(content)}catch{throw Error("JSONを読み取れません")}
 const rows=Array.isArray(root)?root:root?.format==="ca-zoroark-ideas-v2"?root.entries:null;
 if(!Array.isArray(rows)||rows.length>500)throw Error("対応していないJSON形式です");
 return rows.map(normalizeEntry);
}
export function exportDocument(entries){
 return {format:"ca-zoroark-ideas-v2",version:2,exportedAt:new Date().toISOString(),entries:entries.map(normalizeEntry)};
}

export function ideaStatusCounts(entries){
 const counts={total:0,draft:0,adopted:0,archived:0};
 for(const x of entries){const entry=normalizeEntry(x);counts.total++;counts[entry.status]++}
 return counts;
}
export function ideaVisibleIndexes(entries,filter="draft",query=""){
 if(!["all","draft","adopted","archived"].includes(filter))throw Error("一覧の絞り込みが不正です");
 const q=String(query||"").normalize("NFKC").trim().toLocaleLowerCase("ja-JP");
 return entries.map((x,i)=>({x:normalizeEntry(x),i}))
 .filter(({x})=>filter==="all"||x.status===filter)
 .filter(({x})=>!q||[x.a,x.b,x.note,x.aNo,x.bNo].some(s=>String(s).normalize("NFKC").toLocaleLowerCase("ja-JP").includes(q)))
 .map(({i})=>i).reverse();
}

/** The server catalog is authoritative; local "adopted" alone never means live. */
export const topicNameKey=(a,b)=>[String(a).normalize("NFKC").trim().toLocaleLowerCase("ja-JP"),
 String(b).normalize("NFKC").trim().toLocaleLowerCase("ja-JP")].sort().join("|");
export function candidateForServer(row){
 const x=normalizeEntry(row);
 if(!x.note||x.note.length>500||!x.difference||!x.level)return null;
 return {a:x.a,b:x.b,aNo:x.aNo,bNo:x.bNo,common:x.note,
  difference:x.difference,level:x.level};
}
export function compareServerCatalog(row,result){
 if(!result||!Array.isArray(result.baseKeys)||!Array.isArray(result.entries))
  return {state:"unchecked",label:"🔍 サーバー未照合"};
 const x=normalizeEntry(row),key=topicNameKey(x.a,x.b);
 if(result.baseKeys.includes(key))
  return {state:"live",label:"✅ 正式42組で利用中",id:null};
 const matching=result.entries.find(v=>v&&topicNameKey(v.a,v.b)===key);
 if(!matching)return {state:"missing",label:"⏳ サーバー未登録",id:null};
 const id=Number(matching.id);
 if(matching.status==="published"&&matching.activeInGame===true)
  return {state:"live",label:"✅ ゲームで利用中・版"+matching.version,id};
 if(matching.status==="published")return {state:"queued",label:"⏳ 公開済み・ゲーム出題OFF",id};
 if(matching.status==="approved")return {state:"approved",label:"🟡 審査済み・未公開",id};
 if(matching.status==="pending")return {state:"pending",label:"📨 サーバー申請済み",id};
 if(matching.status==="retired")return {state:"retired",label:"📦 公開停止・ゲーム対象外",id};
 return {state:"unchecked",label:"🔍 状態を確認できません"};
}

/** ADMIN-only, full baseline snapshot returned by the authenticated QA catalog API. */
export function officialCatalogRows(result){
 if(!result||!Array.isArray(result.basePairs)||!Array.isArray(result.baseKeys))return null;
 const count=result.baseCount;
 if(!Number.isSafeInteger(count)||count<1||count>500||count!==result.basePairs.length||count!==result.baseKeys.length)return null;
 const keys=new Set(result.baseKeys),seenKeys=new Set(),seenIds=new Set(),rows=[];
 if(keys.size!==count)return null;
 for(const entry of result.basePairs){
  if(!entry||typeof entry!=="object"||Array.isArray(entry))return null;
  const {id,level,a,b,common,difference}=entry;
  if(typeof id!=="string"||!(/^[emh]\d{2}$/).test(id)||seenIds.has(id))return null;
  if(!["easy","normal","hard"].includes(level))return null;
  if([a,b,common,difference].some(x=>typeof x!=="string"||!x.trim()||x.length>500))return null;
  const key=topicNameKey(a,b);
  if(a.trim()===b.trim()||!keys.has(key)||seenKeys.has(key))return null;
  seenKeys.add(key);seenIds.add(id);rows.push({id,level,a:a.trim(),b:b.trim(),common:common.trim(),difference:difference.trim()});
 }
 return rows;
}
export function filterOfficialCatalog(rows,level="all",query=""){
 if(!["all","easy","normal","hard"].includes(level))throw Error("難易度フィルターが不正です");
 if(!Array.isArray(rows))throw Error("正式お題一覧が不正です");
 const q=String(query||"").normalize("NFKC").trim().toLocaleLowerCase("ja-JP");
 return rows.filter(x=>(level==="all"||x.level===level)&&
  (!q||[x.id,x.a,x.b,x.common,x.difference].some(v=>
   String(v).normalize("NFKC").toLocaleLowerCase("ja-JP").includes(q))));
}
