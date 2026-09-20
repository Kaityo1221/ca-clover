import { createClient } from "npm:@supabase/supabase-js@2";
import {
  CampfireClient,
  type CampfireEvent,
} from "../_shared/campfire/mod.ts";

const corsHeaders={
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type",
};

const REALITY_CHANNEL_ID="8947de81-e387-4e03-89c6-31ce2ca47c3c";
const ZOOM_LEVEL=15;
const LAT_RADIUS=0.10;
const LNG_RADIUS=0.15;

function json(data:unknown,status=200){
  return new Response(JSON.stringify(data),{
    status,
    headers:{...corsHeaders,"Content-Type":"application/json"},
  });
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

  const {data:profile,error:profileError}=await userClient
    .from("profiles")
    .select("role")
    .eq("id",userData.user.id)
    .single();
  if(profileError||profile?.role!=="admin") return {error:json({error:"admin required"},403)} as const;

  const admin=createClient(supabaseUrl,serviceRoleKey,{
    auth:{persistSession:false,autoRefreshToken:false},
  });

  return {admin,error:null} as const;
}

function finite(value:unknown):value is number{
  return typeof value==="number"&&Number.isFinite(value);
}

function meetupRow(event:CampfireEvent,communityId:string,nowIso:string){
  return {
    campfire_meetup_id:event.id,
    community_id:communityId,
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
    source:"campfire-public-map",
    fetched_at:nowIso,
  };
}

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:corsHeaders});

  try{
    const auth=await requireAdmin(req);
    if(auth.error) return auth.error;
    const {admin}=auth;

    const body=await req.json().catch(()=>({}));
    const offset=Math.max(0,Number(body.offset??0)||0);
    const limit=Math.max(1,Math.min(10,Number(body.limit??5)||5));
    const requestedCommunityId=typeof body.communityId==="string"?body.communityId:null;

    let query=admin
      .from("communities")
      .select("id,name,campfire_community_id,latitude,longitude",{count:"exact"})
      .order("name");

    if(requestedCommunityId){
      query=query.eq("id",requestedCommunityId);
    }else{
      query=query.range(offset,offset+limit-1);
    }

    const {data:scanCommunities,error:scanError,count}=await query;
    if(scanError) throw scanError;

    const {data:knownCommunities,error:knownError}=await admin
      .from("communities")
      .select("id,name,campfire_community_id")
      .not("campfire_community_id","is",null);
    if(knownError) throw knownError;

    const communityByClubId=new Map<string,{id:string;name:string}>();
    for(const community of knownCommunities??[]){
      const clubId=community.campfire_community_id;
      if(clubId) communityByClubId.set(clubId,{id:community.id,name:community.name});
    }

    const {data:run,error:runError}=await admin.from("sync_runs").insert({
      source:"campfire-public-map",
      status:"running",
      details:{
        offset,
        limit,
        requested_community_id:requestedCommunityId,
        batch_size:scanCommunities?.length??0,
        reality_channel_id:REALITY_CHANNEL_ID,
        zoom_level:ZOOM_LEVEL,
      },
    }).select("id").single();
    if(runError) throw runError;

    const campfire=new CampfireClient({
      maxRetries:3,
      retryDelayMs:600,
      minRequestIntervalMs:180,
    });

    const sources=await campfire.getRealityChannelSources(REALITY_CHANNEL_ID);
    const eventIds=new Set<string>();
    let scannedCommunities=0;
    let skippedNoCoordinates=0;
    let scanFailures=0;
    const scanResults:Array<Record<string,unknown>>=[];

    for(const community of scanCommunities??[]){
      const lat=community.latitude;
      const lng=community.longitude;
      if(!finite(lat)||!finite(lng)){
        skippedNoCoordinates++;
        scanResults.push({
          community_id:community.id,
          name:community.name,
          status:"no_coordinates",
        });
        continue;
      }

      try{
        const objects=await campfire.discoverMapObjects({
          sw:{lat:lat-LAT_RADIUS,lng:lng-LNG_RADIUS},
          ne:{lat:lat+LAT_RADIUS,lng:lng+LNG_RADIUS},
        },{
          realityChannelId:REALITY_CHANNEL_ID,
          zoomLevel:ZOOM_LEVEL,
          sources,
          limitDropCount:false,
        });

        const ids=objects
          .map(item=>item.event?.id)
          .filter((id):id is string=>Boolean(id));
        ids.forEach(id=>eventIds.add(id));
        scannedCommunities++;
        scanResults.push({
          community_id:community.id,
          name:community.name,
          status:"ok",
          discovered:ids.length,
        });
      }catch(error){
        scanFailures++;
        scanResults.push({
          community_id:community.id,
          name:community.name,
          status:"error",
          error:error instanceof Error?error.message:String(error),
        });
      }
    }

    const nowIso=new Date().toISOString();
    const rows:Array<Record<string,unknown>>=[];
    const unmatchedClubIds=new Set<string>();
    let detailFailures=0;

    for(const eventId of eventIds){
      try{
        const event=await campfire.getAnonymousActivityEvent(eventId);
        const clubId=event.clubId??"";
        const community=clubId?communityByClubId.get(clubId):undefined;
        if(!community){
          if(clubId) unmatchedClubIds.add(clubId);
          continue;
        }
        rows.push(meetupRow(event,community.id,nowIso));
      }catch{
        detailFailures++;
      }
    }

    if(rows.length){
      const {error:upsertError}=await admin
        .from("meetups")
        .upsert(rows,{onConflict:"campfire_meetup_id"});
      if(upsertError) throw upsertError;

      const touched=[...new Set(rows.map(row=>String(row.community_id)))];
      if(touched.length){
        const {error:updateError}=await admin
          .from("communities")
          .update({fetched_at:nowIso})
          .in("id",touched);
        if(updateError) throw updateError;
      }
    }

    const finalStatus=scanFailures>0||detailFailures>0?"partial":"success";
    const finishedAt=new Date().toISOString();
    const details={
      offset,
      limit,
      requested_community_id:requestedCommunityId,
      total_available:count??null,
      processed_communities:scanCommunities?.length??0,
      scanned_communities:scannedCommunities,
      skipped_no_coordinates:skippedNoCoordinates,
      scan_failures:scanFailures,
      discovered_event_ids:eventIds.size,
      imported_events:rows.length,
      unmatched_club_ids:[...unmatchedClubIds],
      detail_failures:detailFailures,
      scan_window_degrees:{lat:LAT_RADIUS*2,lng:LNG_RADIUS*2},
      reality_channel_id:REALITY_CHANNEL_ID,
      sources,
      note:"Anonymous public map discovery. Current/future public Meetups only; archived coverage is not implied. Participant identities are not requested or stored.",
      scan_results:scanResults,
    };

    await admin.from("sync_runs").update({
      status:finalStatus,
      finished_at:finishedAt,
      details,
    }).eq("id",run.id);

    return json({
      ok:true,
      status:finalStatus,
      offset,
      limit,
      total:count??scanCommunities?.length??0,
      processed:scanCommunities?.length??0,
      scannedCommunities,
      skippedNoCoordinates,
      discoveredEvents:eventIds.size,
      importedEvents:rows.length,
      unmatchedClubIds:[...unmatchedClubIds],
      scanFailures,
      detailFailures,
    });
  }catch(error){
    const message=error instanceof Error?error.message:String(error);
    return json({error:message},500);
  }
});
