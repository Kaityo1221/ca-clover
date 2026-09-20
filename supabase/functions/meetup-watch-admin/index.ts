import { createClient } from "npm:@supabase/supabase-js@2";

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

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:corsHeaders});

  try{
    const supabaseUrl=Deno.env.get("SUPABASE_URL");
    const anonKey=Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if(!supabaseUrl||!anonKey||!serviceRoleKey) return json({error:"Supabase environment is incomplete"},500);

    const authorization=req.headers.get("Authorization")??"";
    const userClient=createClient(supabaseUrl,anonKey,{
      global:{headers:{Authorization:authorization}},
      auth:{persistSession:false},
    });
    const {data:userData,error:userError}=await userClient.auth.getUser();
    if(userError||!userData.user) return json({error:"unauthorized"},401);

    const {data:profile,error:profileError}=await userClient
      .from("profiles")
      .select("role")
      .eq("id",userData.user.id)
      .single();
    if(profileError||profile?.role!=="admin") return json({error:"admin required"},403);

    const admin=createClient(supabaseUrl,serviceRoleKey,{auth:{persistSession:false,autoRefreshToken:false}});
    const body=await req.json().catch(()=>({}));
    if(body.action!=="set_status") return json({error:"unsupported action"},400);

    const caseId=typeof body.caseId==="string"?body.caseId:"";
    const status=typeof body.status==="string"?body.status:"";
    const note=typeof body.note==="string"?body.note.trim().slice(0,2000):null;
    const allowed=["unreviewed","no_issue","contact_host","sop_in_progress","completed"];
    if(!caseId||!allowed.includes(status)) return json({error:"invalid status update"},400);

    const reviewed=status==="unreviewed"?null:new Date().toISOString();
    const {data,error}=await admin
      .from("meetup_watch_cases")
      .update({
        status,
        review_note:note||null,
        reviewed_at:reviewed,
        reviewed_by:reviewed?userData.user.id:null,
        updated_at:new Date().toISOString(),
      })
      .eq("id",caseId)
      .select("id,status,review_note,reviewed_at")
      .single();
    if(error) throw error;

    return json({ok:true,case:data});
  }catch(error){
    return json({error:error instanceof Error?error.message:String(error)},500);
  }
});
