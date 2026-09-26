import { createClient } from "npm:@supabase/supabase-js@2";

const CRON_HEADER="x-ca-clover-cron-secret";
const CAMPFIRE_GRAPHQL_ENDPOINT="https://niantic-social-api.nianticlabs.com/graphql";
const BATCH_SIZE=10;

function json(data:unknown,status=200){
  return new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json"}});
}

function jstDateKey(value=new Date()){
  const parts=new Intl.DateTimeFormat("en-CA",{
    timeZone:"Asia/Tokyo",year:"numeric",month:"2-digit",day:"2-digit",
  }).formatToParts(value);
  const values=Object.fromEntries(parts.map(part=>[part.type,part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

async function fetchClubViaEvent(eventId:string){
  const query=`query CA_Clover_MemberSnapshot($id: ID!) {
    event(id: $id) {
      id
      club {
        id
        name
        members { totalCount }
      }
    }
  }`;
  const response=await fetch(CAMPFIRE_GRAPHQL_ENDPOINT,{
    method:"POST",
    headers:{"Content-Type":"application/json","Accept":"application/json"},
    body:JSON.stringify({query,variables:{id:eventId}}),
  });
  if(!response.ok) throw new Error(`Campfire HTTP ${response.status}`);
  const payload=await response.json().catch(()=>null) as {
    data?:{event?:{club?:{id?:string|null;name?:string|null;members?:{totalCount?:number|null}|null}|null}|null};
    errors?:Array<{message?:string}>;
  }|null;
  if(!payload) throw new Error("Campfire response is not valid JSON");
  if(payload.errors?.length) throw new Error(payload.errors.map(item=>item.message??"GraphQL error").join(" / "));
  const club=payload.data?.event?.club;
  if(!club?.id) throw new Error("Event club is unavailable");
  return club;
}

Deno.serve(async(req:Request)=>{
  try{
    const supabaseUrl=Deno.env.get("SUPABASE_URL");
    const serviceRoleKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if(!supabaseUrl||!serviceRoleKey) return json({error:"Supabase environment is incomplete"},500);

    const admin=createClient(supabaseUrl,serviceRoleKey,{auth:{persistSession:false,autoRefreshToken:false}});
    const suppliedSecret=req.headers.get(CRON_HEADER)??"";
    const {data:expectedSecret,error:secretError}=await admin.rpc("internal_get_sync_cron_secret");
    if(secretError||typeof expectedSecret!=="string"||!expectedSecret||suppliedSecret!==expectedSecret){
      return json({error:"unauthorized"},401);
    }

    const body=await req.json().catch(()=>({}));
    const observedOn=typeof body.observedOn==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(body.observedOn)
      ?body.observedOn
      :jstDateKey();
    const nowIso=new Date().toISOString();

    const {data:state,error:stateError}=await admin
      .from("community_member_sync_state")
      .select("snapshot_date,next_offset,failed_community_ids,started_at")
      .eq("id",1)
      .single();
    if(stateError) throw stateError;

    let nextOffset=Number(state.next_offset??0)||0;
    let failedIds=Array.isArray(state.failed_community_ids)
      ?state.failed_community_ids.filter((value:unknown):value is string=>typeof value==="string")
      :[];
    let startedAt=state.started_at??nowIso;

    if(state.snapshot_date!==observedOn){
      nextOffset=0;
      failedIds=[];
      startedAt=nowIso;
      const {error:resetError}=await admin.from("community_member_sync_state").update({
        snapshot_date:observedOn,
        next_offset:0,
        failed_community_ids:[],
        started_at:startedAt,
        finished_at:null,
        updated_at:nowIso,
        last_error:null,
      }).eq("id",1);
      if(resetError) throw resetError;
    }

    const {count:total,error:countError}=await admin
      .from("communities")
      .select("id",{count:"exact",head:true})
      .not("campfire_community_id","is",null);
    if(countError) throw countError;
    const totalCommunities=Math.max(0,Number(total??0)||0);

    let mode:"primary"|"retry"|"complete"="primary";
    let candidates:Array<{id:string;name:string;campfire_community_id:string}>=[];
    let nextOffsetAfter=nextOffset;

    if(nextOffset<totalCommunities){
      const {data,error}=await admin
        .from("communities")
        .select("id,name,campfire_community_id")
        .not("campfire_community_id","is",null)
        .order("name")
        .range(nextOffset,nextOffset+BATCH_SIZE-1);
      if(error) throw error;
      candidates=(data??[]) as typeof candidates;
      nextOffsetAfter=Math.min(totalCommunities,nextOffset+candidates.length);
    }else if(failedIds.length){
      mode="retry";
      const retryIds=failedIds.slice(0,BATCH_SIZE);
      const {data,error}=await admin
        .from("communities")
        .select("id,name,campfire_community_id")
        .in("id",retryIds);
      if(error) throw error;
      const byId=new Map((data??[]).map(row=>[row.id,row]));
      candidates=retryIds.map(id=>byId.get(id)).filter(Boolean) as typeof candidates;
    }else{
      mode="complete";
    }

    if(mode==="complete"){
      await admin.from("community_member_sync_state").update({
        finished_at:nowIso,updated_at:nowIso,last_error:null,
      }).eq("id",1);
      return json({ok:true,status:"complete",observedOn,total:totalCommunities});
    }

    const {data:existingRows,error:existingError}=await admin
      .from("community_member_snapshots")
      .select("community_id")
      .eq("observed_on",observedOn)
      .in("community_id",candidates.map(item=>item.id));
    if(existingError) throw existingError;
    const alreadySaved=new Set((existingRows??[]).map(row=>row.community_id));

    const successes:string[]=[];
    const failures:Array<{community_id:string;name:string;error:string}>=[];

    for(const community of candidates){
      if(alreadySaved.has(community.id)){
        successes.push(community.id);
        continue;
      }
      try{
        const {data:meetups,error:meetupError}=await admin
          .from("meetups")
          .select("campfire_meetup_id")
          .eq("community_id",community.id)
          .order("starts_at",{ascending:false,nullsFirst:false})
          .limit(3);
        if(meetupError) throw meetupError;
        if(!meetups?.length) throw new Error("No Meetup available for Community lookup");

        let count:number|null=null;
        let matchedEventId:string|null=null;
        let lastLookupError="";
        for(const meetup of meetups){
          try{
            const club=await fetchClubViaEvent(meetup.campfire_meetup_id);
            if(club.id!==community.campfire_community_id){
              lastLookupError=`Club ID mismatch (${club.id})`;
              continue;
            }
            const value=club.members?.totalCount;
            if(!Number.isFinite(value)) throw new Error("Member count is unavailable");
            count=Number(value);
            matchedEventId=meetup.campfire_meetup_id;
            break;
          }catch(error){
            lastLookupError=error instanceof Error?error.message:String(error);
          }
        }
        if(count===null) throw new Error(lastLookupError||"Community member count lookup failed");

        const {error:snapshotError}=await admin.from("community_member_snapshots").upsert({
          community_id:community.id,
          member_count:count,
          observed_at:nowIso,
          observed_on:observedOn,
          source:"campfire-event-club",
        },{onConflict:"community_id,observed_on",ignoreDuplicates:true});
        if(snapshotError) throw snapshotError;

        const {error:updateError}=await admin.from("communities").update({member_count:count}).eq("id",community.id);
        if(updateError) throw updateError;

        successes.push(community.id);
        await new Promise(resolve=>setTimeout(resolve,120));
        void matchedEventId;
      }catch(error){
        failures.push({
          community_id:community.id,
          name:community.name,
          error:error instanceof Error?error.message:String(error),
        });
      }
    }

    const failureSet=new Set(failedIds);
    for(const id of successes) failureSet.delete(id);
    for(const item of failures) failureSet.add(item.community_id);
    const failedAfter=[...failureSet];
    const primaryFinished=nextOffsetAfter>=totalCommunities;
    const finished=primaryFinished&&failedAfter.length===0;
    const errorText=failures.length
      ?failures.map(item=>`${item.name}: ${item.error}`).join(" | ").slice(0,4000)
      :null;

    const {error:updateStateError}=await admin.from("community_member_sync_state").update({
      snapshot_date:observedOn,
      next_offset:mode==="primary"?nextOffsetAfter:nextOffset,
      failed_community_ids:failedAfter,
      started_at:startedAt,
      finished_at:finished?nowIso:null,
      updated_at:nowIso,
      last_error:errorText,
    }).eq("id",1);
    if(updateStateError) throw updateStateError;

    await admin.from("sync_runs").insert({
      source:"community-member-snapshot",
      status:failures.length?"partial":"success",
      started_at:nowIso,
      finished_at:new Date().toISOString(),
      details:{
        observed_on:observedOn,
        mode,
        total_communities:totalCommunities,
        offset_before:nextOffset,
        offset_after:mode==="primary"?nextOffsetAfter:nextOffset,
        attempted:candidates.length,
        saved:successes.length,
        failures,
        pending_retry_count:failedAfter.length,
      },
    });

    return json({
      ok:true,
      status:failures.length?"partial":"success",
      observedOn,
      mode,
      total:totalCommunities,
      attempted:candidates.length,
      saved:successes.length,
      failures,
      nextOffset:mode==="primary"?nextOffsetAfter:nextOffset,
      pendingRetryCount:failedAfter.length,
      complete:finished,
    });
  }catch(error){
    return json({error:error instanceof Error?error.message:String(error)},500);
  }
});
