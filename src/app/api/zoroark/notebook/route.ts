import {NextRequest,NextResponse} from "next/server";
import {PAIRS} from "@/lib/zoroark-catalog.server";
import {isExistingCatalogPair,topicPairKey,validateTopicCandidate} from "@/lib/zoroark-catalog-review";
import {allowNotebookOrigin,authorizeNotebook,NotebookHttpError} from "@/lib/zoroark-ca-notebook.server";
import {catalogRuntimeEnabled,catalogPublishEnabled} from "@/lib/zoroark-catalog-management.server";

export const runtime="nodejs";
export const dynamic="force-dynamic";
const LIMIT=8192;
const baseHeaders={"Cache-Control":"private, no-store, max-age=0","Vary":"Origin, Authorization",
 "X-Content-Type-Options":"nosniff","Referrer-Policy":"no-referrer"};

function answer(req:NextRequest,body:object,status=200){
 const res=NextResponse.json(body,{status,headers:baseHeaders});
 const origin=req.headers.get("origin");
 if(origin && allowNotebookOrigin(req))res.headers.set("Access-Control-Allow-Origin",origin);
 return res;
}
function errorAnswer(req:NextRequest,e:unknown){
 if(e instanceof NotebookHttpError)return answer(req,{error:e.code},e.status);
 return answer(req,{error:"notebook_unavailable"},503);
}
function validId(v:unknown){return typeof v==="number"&&Number.isSafeInteger(v)&&v>=1&&v<=9999;}
function validRevision(v:unknown){return typeof v==="number"&&Number.isSafeInteger(v)&&v>=0&&v<=1000000;}
function denied(req:NextRequest){return allowNotebookOrigin(req)?null:answer(req,{error:"origin_denied"},403)}
export async function OPTIONS(req:NextRequest){
 const guard=denied(req);if(guard)return guard;
 const h=new Headers(baseHeaders);
 const o=req.headers.get("origin");
 if(o)h.set("Access-Control-Allow-Origin",o);
 h.set("Access-Control-Allow-Headers","Authorization, Content-Type");
 h.set("Access-Control-Allow-Methods","GET, POST, OPTIONS");
 return new NextResponse(null,{status:204,headers:h});
}
export async function GET(req:NextRequest){
 const guard=denied(req);if(guard)return guard;
 try{
  const auth=await authorizeNotebook(req);
  const scope=req.nextUrl.searchParams.get("scope")||"mine";
  if(scope!=="mine" && scope!=="all")return answer(req,{error:"invalid_scope"},400);
  if(scope==="all" && auth.role!=="admin")return answer(req,{error:"admin_only"},403);
  let query=auth.client.from("zoroark_topic_candidates")
   .select("id,a,b,a_no,b_no,common,difference,level,status,version,edit_revision,submitted_by,submitted_at,reviewed_at,published_at,retired_at,deleted_at")
   .order("id",{ascending:false}).limit(500);
  if(scope==="mine")query=query.eq("submitted_by",auth.user.id);
  const {data,error}=await query;
  if(error||!Array.isArray(data))return answer(req,{error:"list_unavailable"},503);
  const runtimeEnabled=catalogRuntimeEnabled();
  const catalogVersion=Math.max(0,...data.map(x=>Number(x.version)||0));
  return answer(req,{entries:data,catalogVersion,baseCount:PAIRS.length,
   runtimeEnabled,publishEnabled:auth.role==="admin"&&catalogPublishEnabled(),
   // Status is server-owned. A submitted/approved draft can never be live.
   liveIds:runtimeEnabled?data.filter(x=>x.status==="published").map(x=>x.id):[]});
 }catch(e){return errorAnswer(req,e)}
}
export async function POST(req:NextRequest){
 const guard=denied(req);if(guard)return guard;
 try{
  const auth=await authorizeNotebook(req);
  if(Number(req.headers.get("content-length")||0)>LIMIT)
   return answer(req,{error:"payload_too_large"},413);
  const raw=await req.text();
  if(raw.length>LIMIT)return answer(req,{error:"payload_too_large"},413);
  let body:unknown;
  try{body=JSON.parse(raw)}catch{return answer(req,{error:"invalid_json"},400)}
  if(!body||typeof body!=="object"||Array.isArray(body))return answer(req,{error:"invalid_body"},400);
  const input=body as Record<string,unknown>;
  const action=input.action;
  if(action==="submit" || action==="edit"){
   const topic=validateTopicCandidate(input.topic);
   if(!topic)return answer(req,{error:"invalid_topic"},400);
   if(isExistingCatalogPair(topic,PAIRS))
    return answer(req,{error:"already_official"},409);
   const safe={...topic,pair_key:topicPairKey(topic.a,topic.b)};
   if(action==="submit"){
    const {data,error}=await auth.client.rpc("zoroark_topic_submit",{p_topic:safe});
    if(error)return answer(req,{error:error.code==="23505"?"duplicate_pair":
      error.code==="42501"?"submission_disabled_or_denied":"submission_unavailable"},
      error.code==="23505"?409:error.code==="42501"?403:503);
    return answer(req,{entry:data,liveInGame:false},201);
   }
   if(!validId(input.id)||!validRevision(input.expectedRevision))
    return answer(req,{error:"invalid_edit_revision"},400);
   const {data,error}=await auth.client.rpc("zoroark_topic_update",{
    p_id:input.id,p_topic:safe,p_expected_revision:input.expectedRevision});
   if(error)return answer(req,{error:["40001","23505"].includes(error.code)?"edit_conflict":
    error.code==="42501"?"edit_forbidden":"edit_unavailable"},
    ["40001","23505"].includes(error.code)?409:error.code==="42501"?403:503);
   return answer(req,{entry:data,liveInGame:false},200);
  }
  if(auth.role!=="admin")return answer(req,{error:"admin_only"},403);
  if(!["approve","publish","retire","reject","delete","restore"].includes(String(action))||
    !validId(input.id))return answer(req,{error:"invalid_action"},400);
  if(action==="publish"&&!catalogPublishEnabled())
   return answer(req,{error:"publishing_disabled"},403);
  const {data,error}=await auth.client.rpc("zoroark_topic_decide",{
   p_id:input.id,p_action:action});
  if(error)return answer(req,{error:error.code==="42501"?"review_disabled_or_denied":"review_conflict"},
   error.code==="42501"?403:409);
  return answer(req,{entry:data,liveInGame:catalogRuntimeEnabled()&&data?.status==="published"},200);
 }catch(e){return errorAnswer(req,e)}
}
