import { createClient } from "npm:@supabase/supabase-js@2";

const CRON_HEADER="x-ca-clover-cron-secret";
const PUBLIC_BATCH=10;
const MAX_PUBLIC_BATCHES=30;

function json(data:unknown,status=200){
  return new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json"}});
}

async function invokeInternal(
  supabaseUrl:string,
  anonKey:string,
  secret:string,
  slug:string,
  body:Record<string,unknown>,
){
  const response=await fetch(supabaseUrl+"/functions/v1/"+slug,{
    method:"POST",
    headers:{
      "Content-Type":"application/json",
      "apikey":anonKey,
      "Authorization":"Bearer "+anonKey,
      [CRON_HEADER]:secret,
    },
    body:JSON.stringify(body),
  });
  const payload=await response.json().catch(()=>({}));
  if(!response.ok){
    const message=typeof payload?.error==="string"?payload.error:slug+" HTTP "+response.status;
    throw new Error(message);
  }
  return payload as Record<string,unknown>;
}

Deno.serve(async(req:Request)=>{
  const startedAt=new Date().toISOString();
  try{
    const supabaseUrl=Deno.env.get("SUPABASE_URL");
    const anonKey=Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if(!supabaseUrl||!anonKey||!serviceRoleKey) return json({error:"Supabase environment is incomplete"},500);

    const admin=createClient(supabaseUrl,serviceRoleKey,{auth:{persistSession:false,autoRefreshToken:false}});
    const suppliedSecret=req.headers.get(CRON_HEADER)??"";
    const {data:expectedSecret,error:secretError}=await admin.rpc("internal_get_sync_cron_secret");
    if(secretError||typeof expectedSecret!=="string"||!expectedSecret||suppliedSecret!==expectedSecret){
      return json({error:"unauthorized"},401);
    }

    const body=await req.json().catch(()=>({})) as {mode?:string;communityId?:string};
    const mode=body.mode==="final"?"final":"morning_priority";
    const communityId=typeof body.communityId==="string"?body.communityId.trim():"";
    const errors:string[]=[];
    let result:Record<string,unknown>={};

    if(mode==="morning_priority"){
      if(!communityId) return json({error:"communityId is required for morning_priority"},400);
      let publicResult:Record<string,unknown>|null=null;
      let metricResult:Record<string,unknown>|null=null;
      try{
        publicResult=await invokeInternal(supabaseUrl,anonKey,suppliedSecret,"sync-campfire-public",{communityId});
      }catch(error){
        errors.push("public: "+(error instanceof Error?error.message:String(error)));
      }
      try{
        metricResult=await invokeInternal(supabaseUrl,anonKey,suppliedSecret,"sync-meetup-metrics",{mode:"priority",communityId});
      }catch(error){
        errors.push("metrics: "+(error instanceof Error?error.message:String(error)));
      }
      result={communityId,publicResult,metricResult};
    }else{
      const publicBatches:Array<Record<string,unknown>>=[];
      let offset=0;
      let total=0;
      let completed=false;
      for(let index=0;index<MAX_PUBLIC_BATCHES;index++){
        try{
          const batch=await invokeInternal(supabaseUrl,anonKey,suppliedSecret,"sync-campfire-public",{offset,limit:PUBLIC_BATCH});
          publicBatches.push(batch);
          const processed=Math.max(0,Number(batch.processed??0)||0);
          total=Math.max(0,Number(batch.total??total)||0);
          if(processed===0||total===0||offset+processed>=total){
            completed=true;
            break;
          }
          offset+=processed;
        }catch(error){
          errors.push("public batch "+offset+": "+(error instanceof Error?error.message:String(error)));
          break;
        }
      }

      let metricResult:Record<string,unknown>|null=null;
      try{
        metricResult=await invokeInternal(supabaseUrl,anonKey,suppliedSecret,"sync-meetup-metrics",{mode:"final"});
      }catch(error){
        errors.push("metrics: "+(error instanceof Error?error.message:String(error)));
      }
      result={publicBatches:publicBatches.length,total,completed,metricResult};
    }

    const finishedAt=new Date().toISOString();
    await admin.from("sync_runs").insert({
      source:mode==="final"?"campfire-window-final":"campfire-window-morning-priority",
      status:errors.length?"partial":"success",
      started_at:startedAt,
      finished_at:finishedAt,
      details:{mode,community_id:communityId||null,result,errors},
    });

    return json({ok:true,status:errors.length?"partial":"success",mode,...result,errors});
  }catch(error){
    return json({error:error instanceof Error?error.message:String(error)},500);
  }
});
