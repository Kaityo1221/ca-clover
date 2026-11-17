import {NextRequest,NextResponse} from "next/server";
import {PAIRS} from "@/lib/zoroark-catalog.server";
import {isExistingCatalogPair,topicPairKey,validateTopicCandidate} from "@/lib/zoroark-catalog-review";
import {allowNotebookOrigin,authorizeNotebook,NotebookHttpError} from "@/lib/zoroark-ca-notebook.server";
import {catalogRuntimeEnabled,catalogPublishEnabled} from "@/lib/zoroark-catalog-management.server";

export const runtime="nodejs";
export const dynamic="force-dynamic";
const LIMIT=8192;
const TARGETS=["pending","approved","published","rejected","deleted"] as const;
const SOURCES=[...TARGETS,"retired"] as const;
const allowedStatus=(v:unknown,items:readonly string[])=>typeof v==="string"&&items.includes(v);
const privateView=(x:Record<string,unknown>)=>{
 const {id,a,b,a_no,b_no,common,difference,level,edit_revision,submitted_at}=x;
 return {id,a,b,a_no,b_no,common,difference,level,edit_revision,submitted_at};
};
function rpcError(req:NextRequest,e:{code?:string}|null,op:string){
 if(!e)return null;
 const code=e.code||"";
 return answer(req,{error:op+"_"+(code==="40001"||code==="23505"?"conflict":
   code==="42501"?"forbidden":code==="22023"?"invalid":"unavailable")},
   code==="40001"||code==="23505"?409:code==="42501"?403:code==="22023"?400:503);
}
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
  // SECURITY: users cannot directly SELECT unpublished rows or review status.
  // SQL RPCs re-check DB role; CA rows have review metadata removed.
  const {data,error}=await auth.client.rpc(scope==="all"?
   "zoroark_topic_admin_list":"zoroark_topic_list_mine");
  if(error||!Array.isArray(data))return answer(req,{error:"list_unavailable"},503);
  const entries=scope==="all"?data:data.map(privateView);
  const isAdmin=scope==="all";
  const runtimeEnabled=isAdmin&&catalogRuntimeEnabled();
  const catalogVersion=isAdmin?Math.max(0,...entries.map(x=>Number(x.version)||0)):0;
  return answer(req,{entries,catalogVersion,baseCount:PAIRS.length,
   runtimeEnabled,publishEnabled:isAdmin&&catalogPublishEnabled(),
   liveIds:runtimeEnabled?entries.filter(x=>x.status==="published").map(x=>x.id):[]});
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
  if(action==="submit" || action==="edit" || action==="edit-published"){
   if(action==="edit-published"&&auth.role!=="admin")return answer(req,{error:"admin_only"},403);
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
    return answer(req,{entry:auth.role==="admin"?data:privateView(data),liveInGame:false},201);
   }
   if(!validId(input.id)||!validRevision(input.expectedRevision))
    return answer(req,{error:"invalid_edit_revision"},400);
   if(action==="edit"){
    const {data,error}=await auth.client.rpc("zoroark_topic_update",{
     p_id:input.id,p_topic:safe,p_expected_revision:input.expectedRevision});
    const failed=rpcError(req,error,"edit");if(failed)return failed;
    return answer(req,{entry:auth.role==="admin"?data:privateView(data),liveInGame:false});
   }
   if(!validRevision(input.expectedVersion)||input.confirmPublishEdit!==true)
    return answer(req,{error:"published_edit_confirmation_required"},400);
   if(!catalogPublishEnabled())return answer(req,{error:"publishing_disabled"},403);
   const {data,error}=await auth.client.rpc("zoroark_topic_edit_published",{
    p_id:input.id,p_topic:safe,p_expected_revision:input.expectedRevision,
    p_expected_version:input.expectedVersion,p_confirm:true});
   const failed=rpcError(req,error,"published_edit");if(failed)return failed;
   if(data?.status!=="published")return answer(req,{error:"published_edit_unverified"},503);
   return answer(req,{entry:data,liveInGame:catalogRuntimeEnabled()});
  }
  if(auth.role!=="admin")return answer(req,{error:"admin_only"},403);
  // V8 CAS-only transitions. Never silently fall back to legacy decide RPC.
  if(action!=="move-status")return answer(req,{error:"invalid_action"},400);
  if(!validId(input.id)||!validRevision(input.expectedRevision)||
     !allowedStatus(input.expectedStatus,SOURCES)||
     !allowedStatus(input.targetStatus,TARGETS)||
     input.expectedStatus===input.targetStatus)
   return answer(req,{error:"invalid_transition"},400);
  if(input.targetStatus==="published"){
   if(input.confirmPublish!==true)return answer(req,{error:"publish_confirmation_required"},400);
   if(!catalogPublishEnabled())return answer(req,{error:"publishing_disabled"},403);
  }
  if(input.targetStatus==="deleted"&&input.confirmDelete!==true)
   return answer(req,{error:"delete_confirmation_required"},400);
  const {data,error}=await auth.client.rpc("zoroark_topic_move_status",{
   p_id:input.id,p_target:input.targetStatus,
   p_expected_status:input.expectedStatus,p_expected_revision:input.expectedRevision,
   p_confirm_publish:input.confirmPublish===true,p_confirm_delete:input.confirmDelete===true});
  const failed=rpcError(req,error,"move");if(failed)return failed;
  if(data?.status!==input.targetStatus)return answer(req,{error:"transition_unverified"},503);
  return answer(req,{entry:data,liveInGame:catalogRuntimeEnabled()&&data.status==="published"});
 }catch(e){return errorAnswer(req,e)}
}
