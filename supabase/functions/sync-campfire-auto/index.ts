import { createClient } from "npm:@supabase/supabase-js@2";

const CRON_HEADER="x-ca-clover-cron-secret";

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
    const error=new Error(message) as Error&{code?:string};
    error.code=typeof payload?.code==="string"?payload.code:undefined;
    throw error;
  }
  return payload as Record<string,unknown>;
}

Deno.serve(async(req:Request)=>{
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

    const {data:state,error:stateError}=await admin.from("sync_automation_state").select("*").eq("id",1).single();
    if(stateError) throw stateError;
    if(!state.enabled) return json({ok:true,status:"disabled"});

    const now=Date.now();
    const lastStarted=state.last_started_at?new Date(state.last_started_at).getTime():0;
    const lastFinished=state.last_finished_at?new Date(state.last_finished_at).getTime():0;
    if(lastStarted>lastFinished&&now-lastStarted<12*60*1000) return json({ok:true,status:"busy"});

    const startedAt=new Date().toISOString();
    await admin.from("sync_automation_state").update({last_started_at:startedAt,updated_at:startedAt}).eq("id",1);

    const errors:string[]=[];
    let masterResult:Record<string,unknown>|null=null;
    let publicResult:Record<string,unknown>|null=null;
    let historyResult:Record<string,unknown>|null=null;
    let notificationResult:Record<string,unknown>|null=null;
    let claimNotificationResult:Record<string,unknown>|null=null;
    let eventCalendarResult:Record<string,unknown>|null=null;
    let historyCommunity:{id:string;name:string}|null=null;
    let currentPublicOffset=Math.max(0,Number(state.public_offset??0)||0);
    let nextOffset=currentPublicOffset;
    let publicImported=0;
    let historyImported=0;
    const hotResults:Array<Record<string,unknown>>=[];

    const {data:watchSettings,error:watchSettingsError}=await admin
      .from("watch_settings")
      .select("enabled,hot_batch_size,hot_scan_interval_minutes,normal_scan_interval_minutes,event_calendar_sync_interval_minutes")
      .eq("id",1)
      .maybeSingle();
    if(watchSettingsError) errors.push("watch settings: "+watchSettingsError.message);

    const lastCaMasterAt=state.last_ca_master_at?new Date(state.last_ca_master_at).getTime():0;
    const coordinateRefreshDue=!lastCaMasterAt||now-lastCaMasterAt>=24*60*60*1000;
    if(coordinateRefreshDue){
      try{
        masterResult=await invokeInternal(supabaseUrl,anonKey,suppliedSecret,"sync-ca-master",{});
        const communitiesCreated=Math.max(0,Number(masterResult.communitiesCreated??0)||0);
        if(communitiesCreated>0) currentPublicOffset=0;
      }catch(error){
        errors.push("ca master: "+(error instanceof Error?error.message:String(error)));
      }
    }

    const calendarInterval=Math.max(
      30,
      Number(watchSettings?.event_calendar_sync_interval_minutes??360)||360,
    );
    const lastEventCalendarAt=state.last_event_calendar_at
      ?new Date(state.last_event_calendar_at).getTime()
      :0;
    const eventCalendarDue=!lastEventCalendarAt||now-lastEventCalendarAt>=calendarInterval*60*1000;

    if(eventCalendarDue){
      try{
        eventCalendarResult=await invokeInternal(
          supabaseUrl,
          anonKey,
          suppliedSecret,
          "sync-event-calendar",
          {},
        );
      }catch(error){
        errors.push("event calendar: "+(error instanceof Error?error.message:String(error)));
      }
    }

    if(watchSettings?.enabled===true){
      try{
        const nowIso=new Date().toISOString();
        const batchSize=Math.max(1,Math.min(20,Number(watchSettings.hot_batch_size??3)||3));
        const intervalMinutes=Math.max(5,Number(watchSettings.hot_scan_interval_minutes??5)||5);
        const {data:hotStates,error:hotError}=await admin
          .from("watch_community_state")
          .select("community_id,hot_until,next_hot_scan_at")
          .gt("hot_until",nowIso)
          .order("next_hot_scan_at",{ascending:true,nullsFirst:true})
          .limit(batchSize*3);
        if(hotError) throw hotError;

        const due=(hotStates??[])
          .filter(row=>!row.next_hot_scan_at||Date.parse(row.next_hot_scan_at)<=Date.now())
          .slice(0,batchSize);

        for(const hot of due){
          try{
            const result=await invokeInternal(
              supabaseUrl,anonKey,suppliedSecret,"sync-campfire-public",{communityId:hot.community_id}
            );
            hotResults.push({community_id:hot.community_id,status:"success",result});
          }catch(error){
            hotResults.push({
              community_id:hot.community_id,
              status:"error",
              error:error instanceof Error?error.message:String(error),
            });
          }finally{
            const scannedAt=new Date();
            await admin.from("watch_community_state").update({
              last_hot_scan_at:scannedAt.toISOString(),
              next_hot_scan_at:new Date(scannedAt.getTime()+intervalMinutes*60*1000).toISOString(),
              updated_at:scannedAt.toISOString(),
            }).eq("community_id",hot.community_id);
          }
        }
      }catch(error){
        errors.push("hot: "+(error instanceof Error?error.message:String(error)));
      }
    }

    const normalInterval=Math.max(5,Number(watchSettings?.normal_scan_interval_minutes??15)||15);
    const lastPublicAt=state.last_public_at?new Date(state.last_public_at).getTime():0;
    const normalPublicDue=!lastPublicAt||now-lastPublicAt>=normalInterval*60*1000;

    if(normalPublicDue){
      try{
        publicResult=await invokeInternal(
          supabaseUrl,
          anonKey,
          suppliedSecret,
          "sync-campfire-public",
          {
            offset:currentPublicOffset,
            limit:Math.max(1,Math.min(10,Number(state.public_batch_size??10)||10)),
          },
        );
        const processed=Math.max(0,Number(publicResult.processed??0)||0);
        const total=Math.max(0,Number(publicResult.total??0)||0);
        publicImported=Math.max(0,Number(publicResult.importedEvents??0)||0);
        if(processed===0||total===0||currentPublicOffset+processed>=total) nextOffset=0;
        else nextOffset=currentPublicOffset+processed;
      }catch(error){
        errors.push("public: "+(error instanceof Error?error.message:String(error)));
      }
    }

    const {data:connection,error:connectionError}=await admin
      .from("campfire_connection_state")
      .select("status,expires_at")
      .eq("id",1)
      .single();
    if(connectionError){
      errors.push("token state: "+connectionError.message);
    }else{
      const expiresAt=connection?.expires_at?new Date(connection.expires_at).getTime():0;
      const tokenUsable=["ready","expiring"].includes(String(connection?.status??""))&&expiresAt>Date.now();
      if(!tokenUsable&&connection?.expires_at&&expiresAt<=Date.now()){
        await admin.from("campfire_connection_state").update({
          status:"expired",
          last_error:"Campfire token expired",
          updated_at:new Date().toISOString(),
        }).eq("id",1);
      }
      if(tokenUsable){
        const {data:candidate,error:candidateError}=await admin
          .from("communities")
          .select("id,name")
          .eq("coverage","missing")
          .not("campfire_community_id","is",null)
          .order("created_at",{ascending:true})
          .limit(1)
          .maybeSingle();
        if(candidateError){
          errors.push("history candidate: "+candidateError.message);
        }else if(candidate){
          historyCommunity={id:candidate.id,name:candidate.name};
          try{
            historyResult=await invokeInternal(
              supabaseUrl,anonKey,suppliedSecret,"sync-campfire",{communityId:candidate.id}
            );
            historyImported=Math.max(0,Number(historyResult.importedEvents??0)||0);
          }catch(error){
            errors.push("history "+candidate.name+": "+(error instanceof Error?error.message:String(error)));
          }
        }
      }
    }

    try{
      notificationResult=await invokeInternal(
        supabaseUrl,anonKey,suppliedSecret,"meetup-watch-notify",{}
      );
    }catch(error){
      errors.push("notify: "+(error instanceof Error?error.message:String(error)));
    }

    try{
      claimNotificationResult=await invokeInternal(
        supabaseUrl,anonKey,suppliedSecret,"community-claim-notify",{}
      );
    }catch(error){
      errors.push("claim notify: "+(error instanceof Error?error.message:String(error)));
    }

    const finishedAt=new Date().toISOString();
    await admin.from("sync_automation_state").update({
      public_offset:nextOffset,
      last_finished_at:finishedAt,
      last_public_at:publicResult?finishedAt:state.last_public_at,
      last_public_imported:publicResult?publicImported:state.last_public_imported,
      last_history_at:historyResult?finishedAt:state.last_history_at,
      last_history_imported:historyResult?historyImported:state.last_history_imported,
      last_event_calendar_at:eventCalendarResult?finishedAt:state.last_event_calendar_at,
      last_error:errors.length?errors.join(" | "):null,
      updated_at:finishedAt,
    }).eq("id",1);

    await admin.from("sync_runs").insert({
      source:"campfire-auto",
      status:errors.length?"partial":"success",
      started_at:startedAt,
      finished_at:finishedAt,
      details:{
        public_offset_before:state.public_offset,
        public_offset_after:nextOffset,
        normal_public_due:normalPublicDue,
        ca_master_result:masterResult,
        hot_results:hotResults,
        public_result:publicResult,
        history_community:historyCommunity,
        history_result:historyResult,
        notification_result:notificationResult,
        claim_notification_result:claimNotificationResult,
        event_calendar_result:eventCalendarResult,
        event_calendar_due:eventCalendarDue,
        errors,
      },
    });

    return json({
      ok:true,
      status:errors.length?"partial":"success",
      nextOffset,
      normalPublicDue,
      masterResult,
      hotResults,
      publicResult,
      historyCommunity,
      historyResult,
      notificationResult,
      claimNotificationResult,
      eventCalendarResult,
      eventCalendarDue,
      errors,
    });
  }catch(error){
    return json({error:error instanceof Error?error.message:String(error)},500);
  }
});
