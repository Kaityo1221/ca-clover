import { createClient } from "npm:@supabase/supabase-js@2";

const CRON_HEADER="x-ca-clover-cron-secret";

function json(data:unknown,status=200){
  return new Response(JSON.stringify(data),{
    status,
    headers:{"Content-Type":"application/json"},
  });
}

async function invokePublic(
  supabaseUrl:string,
  anonKey:string,
  secret:string,
  offset:number,
  limit:number,
){
  const response=await fetch(supabaseUrl+"/functions/v1/sync-campfire-public",{
    method:"POST",
    headers:{
      "Content-Type":"application/json",
      "apikey":anonKey,
      "Authorization":"Bearer "+anonKey,
      [CRON_HEADER]:secret,
    },
    body:JSON.stringify({offset,limit}),
  });
  const payload=await response.json().catch(()=>({}));
  if(!response.ok){
    throw new Error(typeof payload?.error==="string"?payload.error:"sync-campfire-public HTTP "+response.status);
  }
  return payload as Record<string,unknown>;
}

Deno.serve(async(req:Request)=>{
  try{
    const supabaseUrl=Deno.env.get("SUPABASE_URL");
    const anonKey=Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if(!supabaseUrl||!anonKey||!serviceRoleKey){
      return json({error:"Supabase environment is incomplete"},500);
    }

    const admin=createClient(supabaseUrl,serviceRoleKey,{
      auth:{persistSession:false,autoRefreshToken:false},
    });

    const suppliedSecret=req.headers.get(CRON_HEADER)??"";
    const {data:expectedSecret,error:secretError}=await admin.rpc("internal_get_sync_cron_secret");
    if(secretError||typeof expectedSecret!=="string"||!expectedSecret||suppliedSecret!==expectedSecret){
      return json({error:"unauthorized"},401);
    }

    const {data:state,error:stateError}=await admin
      .from("sync_automation_state")
      .select("public_offset,public_batch_size,last_public_at,last_public_imported")
      .eq("id",1)
      .single();
    if(stateError) throw stateError;

    const offset=Math.max(0,Number(state.public_offset??0)||0);
    const limit=Math.max(1,Math.min(10,Number(state.public_batch_size??10)||10));
    const startedAt=new Date().toISOString();

    const result=await invokePublic(supabaseUrl,anonKey,suppliedSecret,offset,limit);
    const processed=Math.max(0,Number(result.processed??0)||0);
    const total=Math.max(0,Number(result.total??0)||0);
    const imported=Math.max(0,Number(result.importedEvents??0)||0);
    const nextOffset=processed===0||total===0||offset+processed>=total?0:offset+processed;
    const finishedAt=new Date().toISOString();

    const {error:updateError}=await admin.from("sync_automation_state").update({
      public_offset:nextOffset,
      last_public_at:finishedAt,
      last_public_imported:imported,
      updated_at:finishedAt,
    }).eq("id",1);
    if(updateError) throw updateError;

    await admin.from("sync_runs").insert({
      source:"reach-discovery-night",
      status:"success",
      started_at:startedAt,
      finished_at:finishedAt,
      details:{
        offset_before:offset,
        offset_after:nextOffset,
        processed,
        total,
        imported_events:imported,
        result,
      },
    });

    return json({
      ok:true,
      offsetBefore:offset,
      offsetAfter:nextOffset,
      processed,
      total,
      importedEvents:imported,
    });
  }catch(error){
    const message=error instanceof Error?error.message:String(error);
    return json({error:message},500);
  }
});
