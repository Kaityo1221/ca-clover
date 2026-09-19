import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders={
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type",
};

const endpoint="https://niantic-social-api.nianticlabs.com/graphql";
const PAGE_SIZE=100;
const MAX_PAGES=100;

type FeedEvent={
  __typename?:string;
  id?:string;
  name?:string;
  address?:string|null;
  location?:string|null;
  eventTime?:string|null;
  eventEndTime?:string|null;
  createdByCommunityAmbassador?:boolean|null;
  checkedInMembersCount?:number|null;
  members?:{totalCount?:number|null}|null;
  campfireLiveEvent?:{eventName?:string|null}|null;
};

type FeedPage={
  totalCount?:number;
  edges?:Array<{node?:FeedEvent|null}>|null;
  pageInfo?:{hasNextPage?:boolean;endCursor?:string|null}|null;
};

function json(data:unknown,status=200){
  return new Response(JSON.stringify(data),{
    status,
    headers:{...corsHeaders,"Content-Type":"application/json"},
  });
}

const sleep=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));

async function fetchGraphql(token:string,query:string,variables:Record<string,unknown>){
  let lastError:Error|undefined;

  for(let attempt=0;attempt<3;attempt++){
    try{
      const rs=await fetch(endpoint,{
        method:"POST",
        headers:{
          "Content-Type":"application/json",
          "Accept":"application/json",
          "Authorization":"Bearer "+token,
        },
        body:JSON.stringify({query,variables}),
      });

      const payload=await rs.json().catch(()=>null) as {data?:Record<string,unknown>;errors?:Array<{message?:string}>}|null;

      if([429,502,503,504].includes(rs.status)){
        lastError=new Error("Campfire HTTP "+rs.status);
        await sleep(600*(attempt+1));
        continue;
      }

      if(!rs.ok) throw new Error("Campfire HTTP "+rs.status);

      if(payload?.errors?.length){
        const message=payload.errors.map(e=>e.message||"GraphQL error").join(" / ");
        if(/DeadlineExceeded|temporar|timeout/i.test(message)){
          lastError=new Error(message);
          await sleep(600*(attempt+1));
          continue;
        }
        throw new Error(message);
      }

      return payload?.data??{};
    }catch(error){
      lastError=error instanceof Error?error:new Error(String(error));
      if(attempt<2) await sleep(600*(attempt+1));
    }
  }

  throw lastError??new Error("Campfire request failed");
}

function makeFeedQuery(field:"activeFeed"|"archivedFeed"){
  return `query CA_Clover_Feed($clubId: ID!, $first: Int!, $after: String) {
    club(id:$clubId) {
      id
      name
      members { totalCount }
      ${field}(first:$first, after:$after) {
        totalCount
        edges {
          node {
            __typename
            ... on Event {
              id
              name
              address
              location
              eventTime
              eventEndTime
              createdByCommunityAmbassador
              checkedInMembersCount
              members(first:1) { totalCount }
              campfireLiveEvent { eventName }
            }
          }
        }
        pageInfo { hasNextPage endCursor }
      }
    }
  }`;
}

async function fetchFeed(token:string,clubId:string,field:"activeFeed"|"archivedFeed"){
  const query=makeFeedQuery(field);
  const events:FeedEvent[]=[];
  let after:string|null=null;
  let memberCount:number|null=null;

  for(let page=0;page<MAX_PAGES;page++){
    const data=await fetchGraphql(token,query,{
      clubId,
      first:PAGE_SIZE,
      after,
    }) as {
      club?:{
        id?:string;
        members?:{totalCount?:number|null}|null;
        activeFeed?:FeedPage;
        archivedFeed?:FeedPage;
      }|null;
    };

    if(!data.club) throw new Error("Communityを取得できません");

    if(memberCount===null && Number.isFinite(data.club.members?.totalCount)){
      memberCount=Number(data.club.members?.totalCount);
    }

    const feed=(field==="activeFeed"?data.club.activeFeed:data.club.archivedFeed)??{};
    for(const edge of feed.edges??[]){
      const node=edge?.node;
      if(node?.__typename==="Event" && node.id && node.name) events.push(node);
    }

    const pageInfo=feed.pageInfo;
    if(!pageInfo?.hasNextPage) return {events,memberCount,complete:true};
    if(!pageInfo.endCursor) throw new Error(field+" pagination cursor missing");
    after=pageInfo.endCursor;
    await sleep(180);
  }

  return {events,memberCount,complete:false};
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

  const {data:profile,error:profileError}=await userClient.from("profiles").select("role").eq("id",userData.user.id).single();
  if(profileError||profile?.role!=="admin") return {error:json({error:"admin required"},403)} as const;

  const admin=createClient(supabaseUrl,serviceRoleKey,{
    auth:{persistSession:false,autoRefreshToken:false},
  });

  return {admin,error:null} as const;
}

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:corsHeaders});

  try{
    const auth=await requireAdmin(req);
    if(auth.error) return auth.error;
    const {admin}=auth;

    const {data:token,error:tokenError}=await admin.rpc("internal_get_campfire_token");
    if(tokenError) throw tokenError;
    if(!token) return json({error:"Campfire tokenが登録されていません",code:"TOKEN_MISSING"},409);

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
        const active=await fetchFeed(String(token),clubId,"activeFeed");
        await sleep(180);
        const archived=await fetchFeed(String(token),clubId,"archivedFeed");

        const byId=new Map<string,FeedEvent>();
        for(const event of [...archived.events,...active.events]){
          if(event.id) byId.set(event.id,event);
        }

        const nowIso=new Date().toISOString();
        const rows=[...byId.values()].map(event=>({
          campfire_meetup_id:event.id!,
          community_id:community.id,
          title:event.name!,
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
        note:"Campfire authenticated feeds; participant identities are not requested or stored",
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
