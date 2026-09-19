import { createClient } from "npm:@supabase/supabase-js@2";
import {
  CampfireClient,
  StaticTokenProvider,
  TOKEN_CHECK_QUERY,
} from "../_shared/campfire/mod.ts";

const corsHeaders={
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type",
};

function json(data:unknown,status=200){
  return new Response(JSON.stringify(data),{
    status,
    headers:{...corsHeaders,"Content-Type":"application/json"},
  });
}

function decodeJwt(token:string){
  const parts=token.split(".");
  if(parts.length!==3) throw new Error("JWT形式ではありません");
  let b64=parts[1].replace(/-/g,"+").replace(/_/g,"/");
  b64+="=".repeat((4-b64.length%4)%4);
  const raw=atob(b64);
  const bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes)) as {exp?:number;email?:string;sub?:string};
}

async function validateCampfireToken(token:string){
  const campfire=new CampfireClient({
    tokenProvider:new StaticTokenProvider(token),
    maxRetries:3,
    retryDelayMs:600,
    minRequestIntervalMs:0,
  });
  const data=await campfire.request<{me?:{id?:string}|null}>(TOKEN_CHECK_QUERY);
  if(!data.me?.id) throw new Error("Campfire tokenを確認できませんでした");
  return data.me.id;
}

async function requireAdmin(req:Request){
  const supabaseUrl=Deno.env.get("SUPABASE_URL");
  const anonKey=Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if(!supabaseUrl||!anonKey||!serviceRoleKey) throw new Error("Supabase environment is incomplete");

  const authorization=req.headers.get("Authorization")??"";
  const userClient=createClient(supabaseUrl,anonKey,{
    global:{headers:{Authorization:authorization}},
    auth:{persistSession:false},
  });
  const {data:userData,error:userError}=await userClient.auth.getUser();
  if(userError||!userData.user) return {error:json({error:"unauthorized"},401)} as const;

  const {data:profile,error:profileError}=await userClient.from("profiles").select("role").eq("id",userData.user.id).single();
  if(profileError||profile?.role!=="admin") return {error:json({error:"admin required"},403)} as const;

  const admin=createClient(supabaseUrl,serviceRoleKey,{
    auth:{persistSession:false,autoRefreshToken:false},
  });
  return {userClient,admin,error:null} as const;
}

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:corsHeaders});

  try{
    const auth=await requireAdmin(req);
    if(auth.error) return auth.error;
    const {userClient,admin}=auth;

    const body=await req.json().catch(()=>({}));
    const action=String(body.action??"status");

    if(action==="status"){
      const {data,error}=await userClient
        .from("campfire_connection_state")
        .select("status,token_email,expires_at,last_validated_at,last_sync_at,last_error,updated_at")
        .eq("id",1)
        .maybeSingle();
      if(error) throw error;

      const expiresAt=data?.expires_at ? new Date(data.expires_at).getTime() : null;
      let status=data?.status??"missing";
      if(expiresAt){
        const remaining=expiresAt-Date.now();
        if(remaining<=0) status="expired";
        else if(remaining<=24*60*60*1000) status="expiring";
      }
      return json({ok:true,state:{...data,status}});
    }

    if(action==="set"){
      const token=String(body.token??"").trim();
      if(!token) return json({error:"tokenを入力してください"},400);

      const claims=decodeJwt(token);
      if(!claims.exp) return json({error:"tokenの有効期限を確認できません"},400);
      const expiresAt=new Date(claims.exp*1000);
      if(expiresAt.getTime()<=Date.now()+60_000) return json({error:"このtokenは期限切れ、またはまもなく期限切れです"},400);

      await validateCampfireToken(token);

      const {error}=await admin.rpc("internal_set_campfire_token",{
        p_token:token,
        p_email:claims.email??null,
        p_expires_at:expiresAt.toISOString(),
      });
      if(error) throw error;

      return json({
        ok:true,
        status:"ready",
        email:claims.email??null,
        expires_at:expiresAt.toISOString(),
      });
    }

    if(action==="test"){
      const {data:token,error}=await admin.rpc("internal_get_campfire_token");
      if(error) throw error;
      if(!token) return json({error:"Campfire tokenが登録されていません"},400);

      await validateCampfireToken(String(token));
      await admin.from("campfire_connection_state").update({
        status:"ready",
        last_validated_at:new Date().toISOString(),
        last_error:null,
        updated_at:new Date().toISOString(),
      }).eq("id",1);

      return json({ok:true});
    }

    if(action==="clear"){
      const {error}=await admin.rpc("internal_clear_campfire_token");
      if(error) throw error;
      return json({ok:true});
    }

    return json({error:"unknown action"},400);
  }catch(error){
    return json({error:error instanceof Error?error.message:String(error)},500);
  }
});
