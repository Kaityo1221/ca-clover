import { createClient } from "npm:@supabase/supabase-js@2";
import {
  CampfireClient,
  CampfireTokenUnavailableError,
  VaultTokenProvider,
  type CampfireEvent,
} from "../_shared/campfire/mod.ts";

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
    if(!secretError && typeof expected==="string" && expected && cronSecret===expected){
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

  const {data:profile,error:profileError}=await userClient.from("profiles").select("role").eq("id",userData.user.id).single();
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
      if(error instanceof CampfireTokenUnavailableError && error.reason==="missing"){
        return json({error:"Campfire tokenが登録されていません",code:"TOKEN_MISSING"},409);
      }
      throw error;
    }

    const {data:state,error:stateError}=await admin
      .from("campfire_connection_state")
      .select("expires_at")
      .eq("id",1)
      .single();
    if(stateError) throw stateError;
    if(!state?.expires_at || new Date(state.expires_at).getTime()<=Date.now()){
      await admin.from("campfire_connection_state").update({
        status:"expired",
        last_error:"Campfire token expired",
        updated_at:new Date().toISOString(),
      }).eq("id",1);
      return json({error:"Campfire tokenの有効期限が切れています",code:"TOKEN_EXPIRED"},409);
    }

    const campfire=new CampfireClient({
      tokenProvider,
      pageSize:100,
      maxPages:100,
      maxRetries:3,
      retryDelayMs:600,
      minRequestIntervalMs:180,
    });

    const body=await req.json().catch(()=>({}));
    const offset=Math.max(0,Number(body.offset??0)||0);
    const limit=Math.max(1,Math.min(3,Number(body.limit??3)||3));
    const requestedCommunityId=typeof body.communityId==="string"?body.communityId:null;

    let query=admin
      .from("communities")
      .select("id,name,campfire_community_id",{count:"exact"})
      .not("campfire_community_id","is",null)
      .order("name");

    if(requestedCommunityId){
      query=query.eq("id",requestedCommunityId);
    }else{
      query=query.range(offset,offset+limit-1);
    }

    const {data:communities,error:communityError,count}=await query;
    if(communityError) throw communityError;

    const {data:run,error:runError}=await admin.from("sync_runs").insert({
      source:"campfire-authenticated",
      status:"running",
      details:{
        offset,
        limit,
        requested_community_id:requestedCommunityId,
        batch_size:communities?.length??0,
      },
    }).select("id").single();
    if(runError) throw runError;

    let importedEvents=0;
    let failedCommunities=0;
    const results:Array<Record<string,unknown>>=[];

    for(const community of communities??[]){
      const clubId=community.campfire_community_id;
      if(!clubId) continue;

      try{
        const active=await campfire.getActiveFeed(clubId);
        const archived=await campfire.getArchivedFeed(clubId);

        const byId=new Map<string,CampfireEvent>();
        for(const event of [...archived.events,...active.events]){
          if(event.id) byId.set(event.id,event);
        }

        const nowIso=new Date().toISOString();
        const rows=[...byId.values()].map(event=>({
          campfire_meetup_id:event.id,
          community_id:community.id,
          title:event.name,
          starts_at:event.eventTime??null,
          ends_at:event.eventEndTime??null,
          location:event.address??event.location??null,
          event_url:"https://campfire.nianticlabs.com/discover/meetup/"+event.id,
          details:null,
          is_ca_meetup:Boolean(event.createdByCommunityAmbassador),
          rsvp_count:Number.isFinite(event.members?.totalCount)?Number(event.members?.totalCount):null,
          checkin_count:Number.isFinite(event.checkedInMembersCount)?Number(event.checkedInMembersCount):null,
          accepted_count:null,
          declined_count:null,
          campfire_live_event_name:event.campfireLiveEvent?.eventName??null,
          source:"campfire-authenticated",
          fetched_at:nowIso,
        }));

        if(rows.length){
          const {error:upsertError}=await admin.from("meetups").upsert(rows,{onConflict:"campfire_meetup_id"});
          if(upsertError) throw upsertError;
        }

        const times=rows
          .map(row=>row.starts_at?new Date(row.starts_at).getTime():NaN)
          .filter(Number.isFinite);

        const complete=active.complete&&archived.complete;
        const patch:Record<string,unknown>={
          member_count:active.memberCount??archived.memberCount??null,
          coverage:complete?"complete":"partial",
          coverage_from:times.length?new Date(Math.min(...times)).toISOString():null,
          coverage_to:times.length?new Date(Math.max(...times)).toISOString():null,
          fetched_at:nowIso,
        };

        const {error:updateError}=await admin.from("communities").update(patch).eq("id",community.id);
        if(updateError) throw updateError;

        importedEvents+=rows.length;
        results.push({
          community_id:community.id,
          name:community.name,
          status:complete?"complete":"partial",
          events:rows.length,
          active_events:active.events.length,
          archived_events:archived.events.length,
          active_pages:active.pages,
          archived_pages:archived.pages,
        });
      }catch(error){
        failedCommunities++;
        results.push({
          community_id:community.id,
          name:community.name,
          status:"error",
          error:error instanceof Error?error.message:String(error),
        });
      }

      await sleep(250);
    }

    const finalStatus=failedCommunities>0?"partial":"success";
    const finishedAt=new Date().toISOString();

    await admin.from("sync_runs").update({
      status:finalStatus,
      finished_at:finishedAt,
      details:{
        offset,
        limit,
        requested_community_id:requestedCommunityId,
        total_available:count??null,
        processed_communities:communities?.length??0,
        imported_events:importedEvents,
        failed_communities:failedCommunities,
        results,
        note:"CA Clover Campfire client; participant identities are not requested or stored",
      },
    }).eq("id",run.id);

    await admin.from("campfire_connection_state").update({
      status:"ready",
      last_sync_at:finishedAt,
      last_error:failedCommunities>0?failedCommunities+" Community failed":null,
      updated_at:finishedAt,
    }).eq("id",1);

    return json({
      ok:true,
      status:finalStatus,
      offset,
      limit,
      total:count??communities?.length??0,
      processed:communities?.length??0,
      importedEvents,
      failedCommunities,
      results,
    });
  }catch(error){
    const message=error instanceof Error?error.message:String(error);
    return json({error:message},500);
  }
});
