import { createClient } from "npm:@supabase/supabase-js@2";

const CRON_HEADER="x-ca-clover-cron-secret";
const CORS_HEADERS={
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":"POST, OPTIONS",
};

function json(data:unknown,status=200){
  return new Response(JSON.stringify(data),{
    status,
    headers:{"Content-Type":"application/json",...CORS_HEADERS},
  });
}

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:CORS_HEADERS});
  try{
    const supabaseUrl=Deno.env.get("SUPABASE_URL");
    const anonKey=Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if(!supabaseUrl||!anonKey||!serviceRoleKey) return json({error:"Supabase environment is incomplete"},500);

    const authHeader=req.headers.get("Authorization")??"";
    const token=authHeader.replace(/^Bearer\s+/i,"").trim();
    if(!token) return json({error:"unauthorized"},401);

    const admin=createClient(supabaseUrl,serviceRoleKey,{auth:{persistSession:false,autoRefreshToken:false}});
    const {data:userData,error:userError}=await admin.auth.getUser(token);
    if(userError||!userData.user) return json({error:"unauthorized"},401);

    const {data:profile,error:profileError}=await admin
      .from("profiles")
      .select("role")
      .eq("id",userData.user.id)
      .maybeSingle();
    if(profileError||profile?.role!=="admin") return json({error:"forbidden"},403);

    const {data:secret,error:secretError}=await admin.rpc("internal_get_sync_cron_secret");
    if(secretError||typeof secret!=="string"||!secret) return json({error:"sync authorization is unavailable"},500);

    const response=await fetch(supabaseUrl+"/functions/v1/sync-ca-master",{
      method:"POST",
      headers:{
        "Content-Type":"application/json",
        "apikey":anonKey,
        "Authorization":"Bearer "+anonKey,
        [CRON_HEADER]:secret,
      },
      body:"{}",
    });
    const payload=await response.json().catch(()=>({}));
    if(!response.ok){
      return json({error:typeof payload?.error==="string"?payload.error:"CA master sync failed"},response.status);
    }
    return json(payload);
  }catch(error){
    return json({error:error instanceof Error?error.message:String(error)},500);
  }
});
