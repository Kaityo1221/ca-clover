import type { Pair, Difficulty } from "./zoroark-game";

export type TopicCandidate = {
  a:string; b:string; aNo:string; bNo:string;
  common:string; difference:string; level:Difficulty;
};
export type PublishedTopicRecord = TopicCandidate & { id:number; status:string; version:number };
const clean=(v:unknown,max:number):string|null=>{
 if(typeof v!=="string")return null;
 const s=v.normalize("NFKC").trim();
 if(!s||s.length>max||/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(s))return null;
 return s;
};
export function topicPairKey(a:string,b:string):string {
 return [a.normalize("NFKC").trim().toLocaleLowerCase("ja-JP"),
  b.normalize("NFKC").trim().toLocaleLowerCase("ja-JP")].sort().join("|");
}
export function validateTopicCandidate(value:unknown):TopicCandidate|null {
 if(!value||typeof value!=="object"||Array.isArray(value))return null;
 const v=value as Record<string,unknown>;
 const a=clean(v.a,80),b=clean(v.b,80);
 const common=clean(v.common,500),difference=clean(v.difference,500);
 const aNo=v.aNo===undefined||v.aNo===""?"":clean(v.aNo,8);
 const bNo=v.bNo===undefined||v.bNo===""?"":clean(v.bNo,8);
 if(!a||!b||a===b||!common||!difference||aNo===null||bNo===null)return null;
 if(!["easy","normal","hard"].includes(String(v.level))||typeof v.level!=="string")return null;
 if(aNo&&!/^\d{1,4}$/.test(aNo))return null;
 if(bNo&&!/^\d{1,4}$/.test(bNo))return null;
 return {a,b,aNo,bNo,common,difference,level:v.level as Difficulty};
}
export function isExistingCatalogPair(c:TopicCandidate,pairs:readonly Pair[]):boolean {
 const key=topicPairKey(c.a,c.b);
 return pairs.some(p=>topicPairKey(p.a,p.b)===key);
}
export function publishedTopicToPair(value:unknown):Pair {
 const candidate=validateTopicCandidate(value);
 const record=value as Partial<PublishedTopicRecord>|null;
 const id=record?.id;
 if(!candidate||record?.status!=="published"||!Number.isSafeInteger(id)||Number(id)<1||Number(id)>9999)
  throw new Error("Invalid published topic");
 return {id:"x"+String(id).padStart(4,"0"),...candidate};
}
