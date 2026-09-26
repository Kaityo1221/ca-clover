import {createClient} from "npm:@supabase/supabase-js@2";

const CRON_HEADER="x-ca-clover-cron-secret";
const CAMPFIRE_GRAPHQL_ENDPOINT="https://niantic-social-api.nianticlabs.com/graphql";
const BATCH_SIZE=40;
const RECHECK_HOURS=24;
const RECENT_LOOKBACK_HOURS=24;
const REQUEST_INTERVAL_MS=180;

function json(data:unknown,status=200){
  return new Response(JSON.stringify(data),{
    status,
    headers:{"Content-Type":"application/json"},
  });
}

const sleep=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));

async function fetchRewardEligibility(eventId:string){
  const query=`query CA_Clover_RewardEligibility($id: ID!) {
    event(id: $id) {
      id
      isPasscodeRewardEligible
    }
  }`;
  const response=await fetch(CAMPFIRE_GRAPHQL_ENDPOINT,{
    method:"POST",
    headers:{"Content-Type":"application/json","Accept":"application/json"},
    body:JSON.stringify({query,variables:{id:eventId}}),
  });
  if(!response.ok) throw new Error(`Campfire HTTP ${response.status}`);
  const payload=await response.json().catch(()=>null) as {
    data?:{event?:{id?:string;isPasscodeRewardEligible?:boolean|null}|null};
    errors?:Array<{message?:string}>;
  }|null;
  if(!payload) throw new Error("Campfire response is not valid JSON");
  if(payload.errors?.length){
    throw new Error(payload.errors.map(item=>item.message??"GraphQL error").join(" / "));
  }
  const event=payload.data?.event;
  if(!event?.id) throw new Error("event not found");
  if(typeof event.isPasscodeRewardEligible!=="boolean"){
    throw new Error("reward eligibility unavailable");
  }
  return event.isPasscodeRewardEligible;
}

Deno.serve(async(req:Request)=>{
  try{
    const supabaseUrl=Deno.env.get("SUPABASE_URL");
    const serviceRoleKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if(!supabaseUrl||!serviceRoleKey) return json({error:"Supabase environment is incomplete"},500);

    const admin=createClient(supabaseUrl,serviceRoleKey,{
      auth:{persistSession:false,autoRefreshToken:false},
    });
    const suppliedSecret=req.headers.get(CRON_HEADER)??"";
    const {data:expectedSecret,error:secretError}=await admin.rpc("internal_get_sync_cron_secret");
    if(secretError||typeof expectedSecret!=="string"||!expectedSecret||suppliedSecret!==expectedSecret){
      return json({error:"unauthorized"},401);
    }

    const body=await req.json().catch(()=>({}));
    const requestedCommunityId=typeof body.communityId==="string"?body.communityId:null;
    const force=body.force===true;
    const now=new Date();
    const nowIso=now.toISOString();
    const recentFrom=new Date(now.getTime()-RECENT_LOOKBACK_HOURS*60*60*1000).toISOString();
    const staleBefore=new Date(now.getTime()-RECHECK_HOURS*60*60*1000).getTime();

    let query=admin
      .from("meetups")
      .select("id,campfire_meetup_id,community_id,title,starts_at,is_passcode_reward_eligible,reward_checked_at")
      .gte("starts_at",recentFrom)
      .order("reward_checked_at",{ascending:true,nullsFirst:true})
      .order("starts_at",{ascending:true})
      .limit(requestedCommunityId?100:200);

    if(requestedCommunityId) query=query.eq("community_id",requestedCommunityId);

    const {data,error}=await query;
    if(error) throw error;

    const due=(data??[]).filter(row=>{
      if(force) return true;
      if(!row.reward_checked_at) return true;
      const checked=Date.parse(row.reward_checked_at);
      return !Number.isFinite(checked)||checked<=staleBefore;
    }).slice(0,requestedCommunityId?100:BATCH_SIZE);

    const successes:Array<{id:string;eligible:boolean}>=[];
    const failures:Array<{id:string;campfire_meetup_id:string;error:string}>=[];

    for(const row of due){
      try{
        const eligible=await fetchRewardEligibility(row.campfire_meetup_id);
        successes.push({id:row.id,eligible});
      }catch(error){
        failures.push({
          id:row.id,
          campfire_meetup_id:row.campfire_meetup_id,
          error:error instanceof Error?error.message:String(error),
        });
      }
      await sleep(REQUEST_INTERVAL_MS);
    }

    const trueIds=successes.filter(item=>item.eligible).map(item=>item.id);
    const falseIds=successes.filter(item=>!item.eligible).map(item=>item.id);
    if(trueIds.length){
      const {error:updateError}=await admin.from("meetups").update({
        is_passcode_reward_eligible:true,
        reward_checked_at:nowIso,
      }).in("id",trueIds);
      if(updateError) throw updateError;
    }
    if(falseIds.length){
      const {error:updateError}=await admin.from("meetups").update({
        is_passcode_reward_eligible:false,
        reward_checked_at:nowIso,
      }).in("id",falseIds);
      if(updateError) throw updateError;
    }
    if(failures.length){
      const {error:updateError}=await admin.from("meetups").update({
        reward_checked_at:nowIso,
      }).in("id",failures.map(item=>item.id));
      if(updateError) throw updateError;
    }

    await admin.from("sync_runs").insert({
      source:"campfire-rewards",
      status:failures.length?"partial":"success",
      started_at:nowIso,
      finished_at:new Date().toISOString(),
      details:{
        requested_community_id:requestedCommunityId,
        force,
        candidates:data?.length??0,
        due:due.length,
        updated:successes.length,
        rewards_true:trueIds.length,
        rewards_false:falseIds.length,
        failures,
        recheck_hours:RECHECK_HOURS,
      },
    });

    return json({
      ok:true,
      status:failures.length?"partial":"success",
      requestedCommunityId,
      candidates:data?.length??0,
      due:due.length,
      updated:successes.length,
      rewardsTrue:trueIds.length,
      rewardsFalse:falseIds.length,
      failures,
    });
  }catch(error){
    return json({error:error instanceof Error?error.message:String(error)},500);
  }
});
