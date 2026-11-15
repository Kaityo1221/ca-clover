import "server-only";
import { PAIRS } from "@/lib/zoroark-catalog.server";

export const OFFICIAL_TOPIC_CONTROL_ENABLED =
  process.env.ZOROARK_OFFICIAL_CONTROL_ENABLED === "true";
export const OFFICIAL_TOPIC_WRITE_ENABLED =
  OFFICIAL_TOPIC_CONTROL_ENABLED && process.env.ZOROARK_OFFICIAL_WRITE_ENABLED === "true";

export type StateRow={topic_id:string;disabled:boolean;revision:number};
const baseIds = new Set(PAIRS.map(pair=>pair.id));
export function isOfficialTopicId(value:unknown):value is string{
 return typeof value==="string"&&baseIds.has(value);
}
export function validateOfficialTopicState(input:unknown):StateRow[]{
 if(!Array.isArray(input)||input.length>42)throw Error("invalid official topic state");
 const seen=new Set<string>();
 return input.map((v):StateRow=>{
  if(!v||typeof v!=="object"||Array.isArray(v))throw Error("invalid official state row");
  const row=v as Record<string,unknown>;
  if(!isOfficialTopicId(row.topic_id)||seen.has(row.topic_id)||
      typeof row.disabled!=="boolean"||!Number.isSafeInteger(row.revision)||
      (row.revision as number)<1||(row.revision as number)>1000000)
   throw Error("invalid official state value");
  seen.add(row.topic_id);
  return {topic_id:row.topic_id,disabled:row.disabled,revision:row.revision as number};
 });
}
export function activeOfficialTopicIds(rows:readonly StateRow[]):Set<string>{
 const disabled=new Set(rows.filter(x=>x.disabled).map(x=>x.topic_id));
 return new Set(PAIRS.filter(x=>!disabled.has(x.id)).map(x=>x.id));
}
