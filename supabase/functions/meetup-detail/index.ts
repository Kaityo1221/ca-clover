import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders={
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type",
};

const EVENT_QUERY=`query CA_Clover_Event($id: ID!) {
  event(id: $id) {
    id
    name
    details
    createdAt
    clubId
    address
    location
    eventTime
    eventEndTime
    createdByCommunityAmbassador
    checkedInMembersCount
    members(first: 1) { totalCount }
    campfireLiveEvent { eventName }
  }
}`;

function json(data:unknown,status=200){
  return new Response(JSON.stringify(data),{
    status,
    headers:{...corsHeaders,"Content-Type":"application/json"},
  });
}

async function fetchCampfireEvent(eventId:string,token:string){
  const response=await fetch("https://niantic-social-api.nianticlabs.com/graphql",{
    method:"POST",
    headers:{
      "Content-Type":"application/json",
      "Accept":"application/json",
      "Authorization":"Bearer "+token,
    },
    body:JSON.stringify({query:EVENT_QUERY,variables:{id:eventId}}),
  });
  if(!response.ok) throw new Error("Campfire HTTP "+response.status);
  const payload=await response.json();
  if(payload?.errors?.length){
    throw new Error(payload.errors.map((item:{message?:string})=>item.message??"GraphQL error").join(" / "));
  }
  if(!payload?.data?.event) throw new Error("Meetup detail not found");
  return payload.data.event as Record<string,unknown>;
}

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:corsHeaders});

  try{
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
    if(userError||!userData.user) return json({error:"unauthorized"},401);

    const body=await req.json().catch(()=>({}));
    const meetupId=String(body.meetupId??"").trim();
    if(!meetupId) return json({error:"meetupId is required"},400);

    // RLS itself proves that this user may read this Meetup.
    const {data:meetup,error:meetupError}=await userClient
      .from("meetups")
      .select("id,campfire_meetup_id,community_id,title,starts_at,ends_at,location,event_url,details,is_ca_meetup,rsvp_count,checkin_count")
      .eq("id",meetupId)
      .maybeSingle();

    if(meetupError) throw meetupError;
    if(!meetup) return json({error:"meetup not found or not allowed"},404);

    if(typeof meetup.details==="string"&&meetup.details.trim()){
      return json({ok:true,source:"cache",meetup});
    }

    const admin=createClient(supabaseUrl,serviceRoleKey,{
      auth:{persistSession:false,autoRefreshToken:false},
    });
    const {data:token,error:tokenError}=await admin.rpc("internal_get_campfire_token");
    if(tokenError) throw tokenError;
    if(!token) return json({ok:true,source:"cache",meetup,detailUnavailable:"token_missing"});

    const event=await fetchCampfireEvent(String(meetup.campfire_meetup_id),String(token));
    const details=typeof event.details==="string"&&event.details.trim()?event.details.trim():null;

    const patch={
      title:typeof event.name==="string"&&event.name?event.name:meetup.title,
      starts_at:typeof event.eventTime==="string"?event.eventTime:meetup.starts_at,
      ends_at:typeof event.eventEndTime==="string"?event.eventEndTime:meetup.ends_at,
      location:(typeof event.address==="string"&&event.address)||
        (typeof event.location==="string"&&event.location)||
        meetup.location,
      details,
      is_ca_meetup:typeof event.createdByCommunityAmbassador==="boolean"
        ?event.createdByCommunityAmbassador
        :meetup.is_ca_meetup,
      rsvp_count:Number.isFinite(event?.members?.totalCount)?Number(event.members.totalCount):meetup.rsvp_count,
      checkin_count:Number.isFinite(event.checkedInMembersCount)?Number(event.checkedInMembersCount):meetup.checkin_count,
      campfire_live_event_name:typeof event?.campfireLiveEvent?.eventName==="string"
        ?event.campfireLiveEvent.eventName
        :null,
      fetched_at:new Date().toISOString(),
    };

    const {data:updated,error:updateError}=await admin
      .from("meetups")
      .update(patch)
      .eq("id",meetup.id)
      .select("id,campfire_meetup_id,community_id,title,starts_at,ends_at,location,event_url,details,is_ca_meetup,rsvp_count,checkin_count")
      .single();
    if(updateError) throw updateError;

    return json({
      ok:true,
      source:"campfire_event",
      meetup:updated,
      detailUnavailable:details?null:"campfire_returned_empty_details",
    });
  }catch(error){
    return json({error:error instanceof Error?error.message:String(error)},500);
  }
});
