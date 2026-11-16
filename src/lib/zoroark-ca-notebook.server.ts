import "server-only";
import {createClient, type SupabaseClient, type User} from "@supabase/supabase-js";
import type {NextRequest} from "next/server";

export type NotebookRole = "ca"|"admin";
export type NotebookAuth = {client:SupabaseClient; user:User; role:NotebookRole};
export class NotebookHttpError extends Error {
 constructor(public status:number, public code:string){super(code)}
}
const isIsolatedExecution=()=>
 process.env.VERCEL_ENV==="preview" ||
 (process.env.NODE_ENV==="development" && process.env.ZOROARK_CATALOG_LOCAL_TEST==="true");

/** No fallback to a production Auth/DB. The rollout must explicitly identify isolated credentials. */
export function notebookConfig(){
 if(!isIsolatedExecution() || process.env.ZOROARK_NOTEBOOK_API_ENABLED!=="true")
  throw new NotebookHttpError(503,"notebook_api_disabled");
 const url=process.env.ZOROARK_NOTEBOOK_ISOLATED_SUPABASE_URL?.trim();
 const key=process.env.ZOROARK_NOTEBOOK_ISOLATED_PUBLISHABLE_KEY?.trim();
 if(!url || !key || !/^https:\/\/[a-z0-9.-]+\.supabase\.co$/.test(url) ||
    url.includes("wgiittrvgtiosogyhfcl"))
  throw new NotebookHttpError(503,"isolated_auth_unconfigured");
 const mainUrl=process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
 const mainKey=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
 // A preview's game catalog must use precisely the same QA Auth/DB source.
 if(url!==mainUrl || key!==mainKey)
  throw new NotebookHttpError(503,"isolated_runtime_catalog_mismatch");
 return {url,key};
}
export function allowNotebookOrigin(req:NextRequest){
 const origin=req.headers.get("origin");
 if(!origin || origin===req.nextUrl.origin || origin==="https://kaityo1221.github.io")return true;
 return process.env.NODE_ENV==="development" && /^http:\/\/(?:localhost|127\.0\.0\.1):\d{2,5}$/.test(origin);
}
export async function authorizeNotebook(req:NextRequest):Promise<NotebookAuth>{
 const match=/^Bearer ([A-Za-z0-9._~-]{20,8192})$/.exec(req.headers.get("authorization")||"");
 if(!match)throw new NotebookHttpError(401,"login_required");
 const {url,key}=notebookConfig();
 const client=createClient(url,key,{
  global:{headers:{Authorization:"Bearer "+match[1]}},
  auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}
 });
 const {data,error}=await client.auth.getUser(match[1]);
 if(error||!data.user)throw new NotebookHttpError(401,"invalid_session");
 const {data:profile,error:profileError}=await client.from("profiles")
  .select("role").eq("id",data.user.id).maybeSingle();
 if(profileError)throw new NotebookHttpError(503,"role_unavailable");
 if(profile?.role!=="ca" && profile?.role!=="admin")
  throw new NotebookHttpError(403,"ca_role_required");
 return {client,user:data.user,role:profile.role};
}
