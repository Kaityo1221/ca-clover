import "server-only";
import {createClient, type SupabaseClient, type User} from "@supabase/supabase-js";
import type {NextRequest} from "next/server";

export type NotebookRole = "ca"|"admin";
export type NotebookAuth = {client:SupabaseClient; user:User; role:NotebookRole};
export class NotebookHttpError extends Error {
 constructor(public status:number, public code:string){super(code)}
}
const PROD_URL="https://wgiittrvgtiosogyhfcl.supabase.co";
const isIsolatedExecution=()=>
 process.env.VERCEL_ENV==="preview" ||
 (process.env.NODE_ENV==="development" && process.env.ZOROARK_CATALOG_LOCAL_TEST==="true");
const prodAuthorized=()=>process.env.VERCEL_ENV==="production" &&
 process.env.ZOROARK_NOTEBOOK_PRODUCTION_ENABLED==="true";
const localStackAllowed=()=>!process.env.VERCEL_ENV &&
 process.env.NODE_ENV==="development" &&
 process.env.ZOROARK_CATALOG_LOCAL_TEST==="true" &&
 process.env.ZOROARK_NOTEBOOK_LOCAL_STACK_ENABLED==="true";
const LOCAL_URL=/^http:\/\/(?:127\.0\.0\.1|localhost):\d{2,5}$/;
const CLOUD_URL=/^https:\/\/[a-z0-9.-]+\.supabase\.co$/;
/** Two independent explicit release guards. No production endpoint in local/preview,
 * no isolated endpoint in production, no service-role token, no cross-project fallback. */
export function notebookConfig(){
 const prod=process.env.VERCEL_ENV==="production";
 if((prod?!prodAuthorized():!isIsolatedExecution()) ||
   process.env.ZOROARK_NOTEBOOK_API_ENABLED!=="true")
  throw new NotebookHttpError(503,"notebook_api_disabled");
 const url=(prod?process.env.ZOROARK_NOTEBOOK_PRODUCTION_SUPABASE_URL:
                    process.env.ZOROARK_NOTEBOOK_ISOLATED_SUPABASE_URL)?.trim();
 const key=(prod?process.env.ZOROARK_NOTEBOOK_PRODUCTION_PUBLISHABLE_KEY:
                    process.env.ZOROARK_NOTEBOOK_ISOLATED_PUBLISHABLE_KEY)?.trim();
 if(!url||!key||!(CLOUD_URL.test(url)||(localStackAllowed()&&LOCAL_URL.test(url))))
  throw new NotebookHttpError(503,"notebook_auth_unconfigured");
 if(prod?url!==PROD_URL:url===PROD_URL ||
    (LOCAL_URL.test(url)&&!localStackAllowed()))
  throw new NotebookHttpError(503,"notebook_cross_environment_denied");
 const mainUrl=process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
 const mainKey=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
 if(url!==mainUrl||key!==mainKey)
  throw new NotebookHttpError(503,"notebook_catalog_auth_mismatch");
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
