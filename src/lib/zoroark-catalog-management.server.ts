import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Pair } from "./zoroark-game";
import { PAIRS } from "./zoroark-catalog.server";
import {notebookConfig} from "./zoroark-ca-notebook.server";
import { publishedTopicToPair, topicPairKey } from "./zoroark-catalog-review";

const isolated=()=>process.env.VERCEL_ENV==="preview"||
 (process.env.NODE_ENV==="development"&&process.env.ZOROARK_CATALOG_LOCAL_TEST==="true");
const productionAuthorized=()=>process.env.VERCEL_ENV==="production" &&
 process.env.ZOROARK_NOTEBOOK_PRODUCTION_ENABLED==="true" &&
 process.env.ZOROARK_CATALOG_PRODUCTION_ENABLED==="true";
const activeScope=()=>isolated()||productionAuthorized();
// The old catalog route and the round runtime share the V8 notebook identity.
// Refuse Preview/Production cross-project reads, even if a catalog flag is enabled.
// A missing notebook configuration always keeps catalog operations disabled.
const catalogAuthMatched=()=>{
 try{notebookConfig();return true}catch{return false}
};
export const catalogManagementEnabled=()=>activeScope()&&
 process.env.ZOROARK_CATALOG_MANAGEMENT_ENABLED==="true"&&catalogAuthMatched();
export const catalogPublishEnabled=()=>catalogManagementEnabled()&&
 process.env.ZOROARK_CATALOG_PUBLISH_ENABLED==="true";
export const catalogRuntimeEnabled=()=>activeScope()&&
 process.env.ZOROARK_CATALOG_RUNTIME_ENABLED==="true"&&catalogAuthMatched();

// Requires the versioned, reviewed SQL schema and row-level security.
// No privileged service-role token is used; this is the requesting CA JWT.
export async function runtimePublishedPairs(client:SupabaseClient):Promise<Pair[]> {
 const {data,error}=await client.from("zoroark_topic_candidates")
  .select("id,a,b,aNo:a_no,bNo:b_no,common,difference,level,status,version")
  .eq("status","published").order("id",{ascending:true}).limit(500);
 if(error||!Array.isArray(data))throw new Error("Published topic catalog unavailable");
 const originalKeys=new Set(PAIRS.map(x=>topicPairKey(x.a,x.b)));
 const keys=new Set<string>();
 return data.map((row:unknown)=>{
  const pair=publishedTopicToPair(row);
  const key=topicPairKey(pair.a,pair.b);
  if(originalKeys.has(key)||keys.has(key))throw new Error("Catalog duplication detected");
  keys.add(key);return pair;
 });
}
