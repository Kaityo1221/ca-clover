import { createClient } from "npm:@supabase/supabase-js@2";
import {
  CampfireClient,
  CampfireTokenUnavailableError,
  VaultTokenProvider,
} from "../_shared/campfire/mod.ts";
import {observeCommunityIcon} from "../_shared/community-icon.ts";

const corsHeaders={
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type, x-ca-clover-cron-secret",
};

function json(data:unknown,status=200){
  return new Response(JSON.stringify(data),{
    status,
    headers:{...corsHeaders,"Content-Type":"application/json"},
  });
}

const sleep=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));

async function requireAdmin(req:Request){
  const supabaseUrl=Deno.env.get("SUPABASE_URL");
  const anonKey=Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if(!supabaseUrl||!anonKey||!serviceRoleKey) throw new Error("Supabase environment is incomplete");

  const admin=createClient(supabaseUrl,serviceRoleKey,{
    auth:{persistSession:false,autoRefreshToken:false},
  });

  const cronSecret=req.headers.get("x-ca-clover-cron-secret")??"";
  if(cronSecret){
    const {data:expected,error:secretError}=await admin.rpc("internal_get_sync_cron_secret");
    if(!secretError&&typeof expected==="string"&&expected&&cronSecret===expected){
      return {admin,error:null,actor:"cron"} as const;
    }
    return {error:json({error:"invalid cron secret"},401)} as const;
  }

  const authorization=req.headers.get("Authorization")??"";
  const userClient=createClient(supabaseUrl,anonKey,{
    global:{headers:{Authorization:authorization}},
    auth:{persistSession:false},
  });

  const {data:userData,error:userError}=await userClient.auth.getUser();
  if(userError||!userData.user) return {error:json({error:"unauthorized"},401)} as const;

  const {data:profile,error:profileError}=await userClient
    .from("profiles")
    .select("role")
    .eq("id",userData.user.id)
    .single();
  if(profileError||profile?.role!=="admin") return {error:json({error:"admin required"},403)} as const;

  return {admin,error:null,actor:"admin"} as const;
}

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:corsHeaders});

  try{
    const auth=await requireAdmin(req);
    if(auth.error) return auth.error;
    const {admin}=auth;

    const tokenProvider=new VaultTokenProvider(async()=>admin.rpc("internal_get_campfire_token"));
    try{
      await tokenProvider.getToken();
    }catch(error){
      if(error instanceof CampfireTokenUnavailableError&&error.reason==="missing"){
        return json({error:"Campfire tokenが登録されていません",code:"TOKEN_MISSING"},409);
      }
      throw error;
    }

    const {data:connection,error:connectionError}=await admin
      .from("campfire_connection_state")
      .select("expires_at")
      .eq("id",1)
      .single();
    if(connectionError) throw connectionError;
    if(!connection?.expires_at||new Date(connection.expires_at).getTime()<=Date.now()){
      return json({error:"Campfire tokenの有効期限が切れています",code:"TOKEN_EXPIRED"},409);
    }

    const body=await req.json().catch(()=>({}));
    const offset=Math.max(0,Number(body.offset??0)||0);
    const limit=Math.max(1,Math.min(10,Number(body.limit??10)||10));

    const {data:communities,error:communityError,count}=await admin
      .from("communities")
      .select("id,name,campfire_community_id,avatar_thumbnail_path",{count:"exact"})
      .not("campfire_community_id","is",null)
      .order("name")
      .range(offset,offset+limit-1);
    if(communityError) throw communityError;

    const campfire=new CampfireClient({
      tokenProvider,
      maxRetries:3,
      retryDelayMs:600,
      minRequestIntervalMs:180,
    });

    let failed=0;
    let changed=0;
    let initial=0;
    let unchanged=0;
    let missing=0;
    let thumbnailBackfilled=0;
    const results:Array<Record<string,unknown>>=[];

    for(const community of communities??[]){
      const clubId=community.campfire_community_id;
      if(!clubId) continue;

      try{
        const club=await campfire.getClub(clubId);
        const generateMissingThumbnail=!community.avatar_thumbnail_path;
        const observed=await observeCommunityIcon(
          admin,
          community.id,
          club.avatarUrl??null,
          {generateMissingThumbnail,ensureArchive:true},
        );
        if(!community.avatar_thumbnail_path&&observed.thumbnail_path) thumbnailBackfilled++;
        if(observed.changed){
          changed++;
          if(observed.changeType==="initial") initial++;
        }else if(observed.reason==="missing"){
          missing++;
        }else{
          unchanged++;
        }
        results.push({
          community_id:community.id,
          name:community.name,
          campfire_community_id:clubId,
          status:observed.changed?observed.changeType:observed.reason,
          detection_method:"method" in observed?observed.method:null,
          thumbnail_path:"thumbnail_path" in observed?observed.thumbnail_path:null,
          thumbnail_error:"thumbnail_error" in observed?observed.thumbnail_error:null,
        });
      }catch(error){
        failed++;
        results.push({
          community_id:community.id,
          name:community.name,
          campfire_community_id:clubId,
          status:"error",
          error:error instanceof Error?error.message:String(error),
        });
      }

      await sleep(250);
    }

    return json({
      ok:true,
      status:failed>0?"partial":"success",
      offset,
      limit,
      total:count??communities?.length??0,
      processed:communities?.length??0,
      changed,
      initial,
      unchanged,
      missing,
      thumbnailBackfilled,
      failed,
      results,
    });
  }catch(error){
    return json({error:error instanceof Error?error.message:String(error)},500);
  }
});
