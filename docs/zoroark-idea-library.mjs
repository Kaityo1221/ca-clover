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
 if(x.level!=null&& !["","easy","normal","hard"].includes(x.level))throw Error("難易度が不正です");
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
