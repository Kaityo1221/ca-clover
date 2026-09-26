import { createClient } from "npm:@supabase/supabase-js@2";

const CRON_HEADER="x-ca-clover-cron-secret";
const CAMPFIRE_GRAPHQL_ENDPOINT="https://niantic-social-api.nianticlabs.com/graphql";
const NORMAL_COMMUNITY_BATCH=10;
const GRAPHQL_BATCH=20;
const POST_END_MINUTES=60;

type MeetupRow={
  id:string;
  campfire_meetup_id:string;
  community_id:string;
  starts_at:string|null;
  ends_at:string|null;
};

type MetricValue={
  id:string;
  rsvp_count:number|null;
  checkin_count:number|null;
};

function json(data:unknown,status=200){
  return new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json"}});
}

function addRows(target:Map<string,MeetupRow>,rows:MeetupRow[]|null|undefined){
  for(const row of rows??[]){
    if(row?.id&&row?.campfire_meetup_id&&row?.community_id) target.set(row.id,row);
  }
}

function chunks<T>(items:T[],size:number){
  const result:T[][]=[];
  for(let index=0;index<items.length;index+=size) result.push(items.slice(index,index+size));
  return result;
}

async function fetchMetricBatch(eventIds:string[]){
  const ids=[...new Set(eventIds.filter(Boolean))];
  const definitions=ids.map((_,index)=>`$id${index}: ID!`).join(", ");
  const fields=ids.map((_,index)=>`e${index}: event(id: $id${index}) {
    id
    members(first: 1) { totalCount }
    checkedInMembersCount
  }`).join("\n");
  const variables=Object.fromEntries(ids.map((id,index)=>[`id${index}`,id]));
  const query=`query CA_Clover_MetricSnapshot(${definitions}) {\n${fields}\n}`;

  const response=await fetch(CAMPFIRE_GRAPHQL_ENDPOINT,{
    method:"POST",
    headers:{"Content-Type":"application/json","Accept":"application/json"},
    body:JSON.stringify({query,variables}),
  });
  if(!response.ok) throw new Error(`Campfire HTTP ${response.status}`);
  const payload=await response.json().catch(()=>null) as {
    data?:Record<string,{id?:string|null;members?:{totalCount?:number|null}|null;checkedInMembersCount?:number|null}|null>;
    errors?:Array<{message?:string}>;
  }|null;
  if(!payload) throw new Error("Campfire response is not valid JSON");

  const values:MetricValue[]=[];
  for(let index=0;index<ids.length;index++){
    const event=payload.data?.[`e${index}`];
    if(!event?.id) continue;
    const rsvp=event.members?.totalCount;
    const checkin=event.checkedInMembersCount;
    values.push({
      id:event.id,
      rsvp_count:Number.isFinite(rsvp)?Number(rsvp):null,
      checkin_count:Number.isFinite(checkin)?Number(checkin):null,
    });
  }

  return {
    values,
    errors:(payload.errors??[]).map(item=>item.message??"GraphQL error"),
  };
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
    const mode=body.mode==="hot"?"hot":"normal";
    const now=new Date();
    const nowIso=now.toISOString();
    const cutoffIso=new Date(now.getTime()-POST_END_MINUTES*60*1000).toISOString();
    const meetupMap=new Map<string,MeetupRow>();
    let offsetBefore=0;
    let offsetAfter=0;
    let totalCommunities=0;

    const {data:state,error:stateError}=await admin
      .from("meetup_metric_sync_state")
      .select("next_offset")
      .eq("id",1)
      .single();
    if(stateError) throw stateError;

    if(mode==="normal"){
      offsetBefore=Math.max(0,Number(state.next_offset??0)||0);
      const {data:communities,error:communityError,count}=await admin
        .from("communities")
        .select("id",{count:"exact"})
        .not("campfire_community_id","is",null)
        .order("name")
        .range(offsetBefore,offsetBefore+NORMAL_COMMUNITY_BATCH-1);
      if(communityError) throw communityError;
      totalCommunities=Math.max(0,Number(count??0)||0);
      const communityIds=(communities??[]).map(row=>row.id);

      if(communityIds.length){
        const [{data:byStart,error:startError},{data:byEnd,error:endError}]=await Promise.all([
          admin.from("meetups")
            .select("id,campfire_meetup_id,community_id,starts_at,ends_at")
            .in("community_id",communityIds)
            .gte("starts_at",cutoffIso),
          admin.from("meetups")
            .select("id,campfire_meetup_id,community_id,starts_at,ends_at")
            .in("community_id",communityIds)
            .gte("ends_at",cutoffIso),
        ]);
        if(startError) throw startError;
        if(endError) throw endError;
        addRows(meetupMap,byStart as MeetupRow[]|null);
        addRows(meetupMap,byEnd as MeetupRow[]|null);
      }

      const [{data:recentEnded,error:recentEndedError},{data:recentNoEnd,error:recentNoEndError}]=await Promise.all([
        admin.from("meetups")
          .select("id,campfire_meetup_id,community_id,starts_at,ends_at")
          .gte("ends_at",cutoffIso)
          .lte("ends_at",nowIso),
        admin.from("meetups")
          .select("id,campfire_meetup_id,community_id,starts_at,ends_at")
          .is("ends_at",null)
          .gte("starts_at",cutoffIso)
          .lte("starts_at",nowIso),
      ]);
      if(recentEndedError) throw recentEndedError;
      if(recentNoEndError) throw recentNoEndError;
      addRows(meetupMap,recentEnded as MeetupRow[]|null);
      addRows(meetupMap,recentNoEnd as MeetupRow[]|null);

      offsetAfter=communityIds.length===0||totalCommunities===0||offsetBefore+communityIds.length>=totalCommunities
        ?0
        :offsetBefore+communityIds.length;
    }else{
      const {data:hotStates,error:hotError}=await admin
        .from("watch_community_state")
        .select("hot_meetup_id,hot_until")
        .gt("hot_until",nowIso)
        .not("hot_meetup_id","is",null)
        .limit(50);
      if(hotError) throw hotError;
      const hotIds=[...new Set((hotStates??[]).map(row=>row.hot_meetup_id).filter(Boolean))];
      if(hotIds.length){
        const {data,error}=await admin
          .from("meetups")
          .select("id,campfire_meetup_id,community_id,starts_at,ends_at")
          .in("id",hotIds);
        if(error) throw error;
        addRows(meetupMap,data as MeetupRow[]|null);
      }
      offsetAfter=Math.max(0,Number(state.next_offset??0)||0);
    }

    const dueMeetups=[...meetupMap.values()].filter(row=>{
      const endRaw=row.ends_at??row.starts_at;
      if(!endRaw) return false;
      const end=Date.parse(endRaw);
      return Number.isFinite(end)&&end>=Date.parse(cutoffIso);
    });
    const byCampfireId=new Map(dueMeetups.map(row=>[row.campfire_meetup_id,row]));
    const metricValues:MetricValue[]=[];
    const graphErrors:string[]=[];

    for(const part of chunks(dueMeetups.map(row=>row.campfire_meetup_id),GRAPHQL_BATCH)){
      try{
        const result=await fetchMetricBatch(part);
        metricValues.push(...result.values);
        graphErrors.push(...result.errors);
      }catch(error){
        graphErrors.push(error instanceof Error?error.message:String(error));
      }
      await new Promise(resolve=>setTimeout(resolve,120));
    }

    const source=mode==="hot"?"campfire-metric-hot":"campfire-metric-normal";
    const snapshotRows=metricValues
      .map(value=>{
        const meetup=byCampfireId.get(value.id);
        if(!meetup) return null;
        return {
          meetup_id:meetup.id,
          community_id:meetup.community_id,
          rsvp_count:value.rsvp_count,
          checkin_count:value.checkin_count,
          observed_at:nowIso,
          source,
        };
      })
      .filter(Boolean);

    if(snapshotRows.length){
      const {error:insertError}=await admin
        .from("meetup_metric_snapshots")
        .upsert(snapshotRows,{onConflict:"meetup_id,observed_at",ignoreDuplicates:true});
      if(insertError) throw insertError;
    }

    const statePatch=mode==="normal"
      ?{next_offset:offsetAfter,last_normal_at:nowIso,updated_at:nowIso,last_error:graphErrors.length?graphErrors.join(" | ").slice(0,4000):null}
      :{last_hot_at:nowIso,updated_at:nowIso,last_error:graphErrors.length?graphErrors.join(" | ").slice(0,4000):null};
    const {error:updateStateError}=await admin.from("meetup_metric_sync_state").update(statePatch).eq("id",1);
    if(updateStateError) throw updateStateError;

    await admin.from("sync_runs").insert({
      source:mode==="hot"?"meetup-metrics-hot":"meetup-metrics-normal",
      status:graphErrors.length?"partial":"success",
      started_at:nowIso,
      finished_at:new Date().toISOString(),
      details:{
        mode,
        post_end_minutes:POST_END_MINUTES,
        offset_before:offsetBefore,
        offset_after:offsetAfter,
        total_communities:totalCommunities,
        due_meetups:dueMeetups.length,
        snapshots_saved:snapshotRows.length,
        graph_errors:graphErrors,
      },
    });

    return json({
      ok:true,
      status:graphErrors.length?"partial":"success",
      mode,
      offsetBefore,
      offsetAfter,
      dueMeetups:dueMeetups.length,
      snapshotsSaved:snapshotRows.length,
      graphErrors,
    });
  }catch(error){
    return json({error:error instanceof Error?error.message:String(error)},500);
  }
});
