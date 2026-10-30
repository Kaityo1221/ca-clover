// ISOLATED P1 candidate. NOT deployed. Requires the service-role-only
// public.ca_p1_live_role_v1 RPC (from private backend review SQL).
import type {SupabaseClient} from "@supabase/supabase-js";

const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export type LiveMapRoleResult =
  | {ok:true; role:"admin"|"ca";userId:string}
  | {ok:false;code:"INVALID_SESSION"|"ROLE_DENIED"|"AUTH_UNAVAILABLE"};

export async function verifyLiveMapRole(
  admin:SupabaseClient, bearer:string
):Promise<LiveMapRoleResult> {
  if(typeof bearer!=="string"||bearer.length>8192) return {ok:false,code:"INVALID_SESSION"};
  try{
    // Auth validates the exact signed user token before ANY claim is decoded.
    const {data:identity,error:authError}=await admin.auth.getUser(bearer);
    const userId=identity?.user?.id;
    if(authError||!userId||!uuid.test(userId))return {ok:false,code:"INVALID_SESSION"};
    const segments=bearer.split(".");
    if(segments.length!==3||segments.some(s=>!s))return {ok:false,code:"INVALID_SESSION"};
    const claim=JSON.parse(Buffer.from(segments[1],"base64url").toString("utf8"));
    if(!claim||!uuid.test(claim.sub??"")||!uuid.test(claim.session_id??"")||
      claim.sub.toLowerCase()!==userId.toLowerCase()||
      claim.aud!=="authenticated"||claim.role!=="authenticated"||
      !Number.isSafeInteger(claim.exp)||claim.exp*1000<=Date.now())
        return {ok:false,code:"INVALID_SESSION"};
    // Server service_role only. Checks auth.sessions AND CURRENT profiles.role
    // in a single PostgreSQL statement. Never trust JWT role for authorization.
    const {data:role,error}=await admin.rpc("ca_p1_live_role_v1",{
      p_actor:userId,p_session:claim.session_id
    });
    if(error)return {ok:false,code:"AUTH_UNAVAILABLE"};
    if(role!=="admin"&&role!=="ca")return {ok:false,code:"ROLE_DENIED"};
    return {ok:true,role,userId};
  }catch{
    return {ok:false,code:"AUTH_UNAVAILABLE"};
  }
}
