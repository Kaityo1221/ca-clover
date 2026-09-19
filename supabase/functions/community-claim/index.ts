import { createClient } from "npm:@supabase/supabase-js@2";
import { CampfireClient, type CampfireEvent } from "../_shared/campfire/mod.ts";

const corsHeaders={
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type",
};

function json(data:unknown,status=200){
  return new Response(JSON.stringify(data),{
    status,
    headers:{...corsHeaders,"Content-Type":"application/json"},
  });
}

const UUID_RE=/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i;

function extractMeetupId(value:unknown){
  const raw=String(value??"").trim();
  return raw.match(UUID_RE)?.[0]??null;
}

async function resolveMeetupId(value:unknown){
  const raw=String(value??"").trim();
  const direct=extractMeetupId(raw);
  if(direct) return direct;

  let parsed:URL;
  try{
    parsed=new URL(raw);
  }catch{
    return null;
  }

  if(parsed.protocol!=="https:" || parsed.hostname.toLowerCase()!=="cmpf.re") return null;

  const response=await fetch(parsed.toString(),{
    method:"GET",
    redirect:"follow",
    headers:{"User-Agent":"CA-Clover/1.0"},
  });

  const finalUrl=new URL(response.url);
  if(finalUrl.protocol!=="https:" || finalUrl.hostname.toLowerCase()!=="campfire.scopely.com") return null;

  return extractMeetupId(finalUrl.toString());
}

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:corsHeaders});

  try{
    const url=Deno.env.get("SUPABASE_URL");
    const anon=Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if(!url||!anon||!serviceKey) throw new Error("Supabase environment is incomplete");

    const authorization=req.headers.get("Authorization")??"";
    const userClient=createClient(url,anon,{
      global:{headers:{Authorization:authorization}},
      auth:{persistSession:false},
    });
    const {data:userData,error:userError}=await userClient.auth.getUser();
    if(userError||!userData.user) return json({error:"unauthorized"},401);

    const {data:profile,error:profileError}=await userClient
      .from("profiles")
      .select("role,niantic_id")
      .eq("id",userData.user.id)
      .single();
    if(profileError||!profile) return json({error:"profile not found"},403);

    const body=await req.json().catch(()=>({}));
    const action=String(body.action??"submit");
    const admin=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});

    if(action==="approve"||action==="reject"){
      if(profile.role!=="admin") return json({error:"admin required"},403);
      const requestId=String(body.requestId??"");
      if(!requestId) return json({error:"requestId is required"},400);

      const {data:request,error:requestError}=await admin
        .from("community_access_requests")
        .select("*")
        .eq("id",requestId)
        .single();
      if(requestError||!request) return json({error:"request not found"},404);
      if(request.status!=="pending") return json({error:"request already reviewed"},409);

      const reviewedAt=new Date().toISOString();
      if(action==="reject"){
        const {error:updateError}=await admin.from("community_access_requests").update({
          status:"rejected",
          reviewed_at:reviewedAt,
          reviewed_by:userData.user.id,
          review_note:typeof body.note==="string"?body.note.trim()||null:null,
        }).eq("id",requestId);
        if(updateError) throw updateError;
        return json({ok:true,status:"rejected"});
      }

      const {error:membershipError}=await admin.from("community_memberships").upsert({
        user_id:request.user_id,
        community_id:request.community_id,
      },{onConflict:"user_id,community_id"});
      if(membershipError) throw membershipError;

      const {data:requesterProfile,error:requesterProfileError}=await admin.from("profiles")
        .select("role")
        .eq("id",request.user_id)
        .single();
      if(requesterProfileError||!requesterProfile) throw requesterProfileError??new Error("requester profile not found");
      if(requesterProfile.role==="pending"){
        const {error:roleError}=await admin.from("profiles")
          .update({role:"ca"})
          .eq("id",request.user_id)
          .eq("role","pending");
        if(roleError) throw roleError;
      }

      const {error:meetupError}=await admin.from("meetups").upsert({
        campfire_meetup_id:request.campfire_meetup_id,
        community_id:request.community_id,
        title:request.meetup_title,
        starts_at:request.meetup_starts_at,
        ends_at:request.meetup_ends_at,
        location:request.meetup_location,
        event_url:request.meetup_url,
        details:null,
        is_ca_meetup:request.is_ca_meetup,
        rsvp_count:request.rsvp_count,
        checkin_count:request.checkin_count,
        accepted_count:null,
        declined_count:null,
        campfire_live_event_name:request.campfire_live_event_name,
        source:"campfire-claim",
        fetched_at:request.requested_at,
      },{onConflict:"campfire_meetup_id"});
      if(meetupError) throw meetupError;

      const {error:updateError}=await admin.from("community_access_requests").update({
        status:"approved",
        reviewed_at:reviewedAt,
        reviewed_by:userData.user.id,
        review_note:typeof body.note==="string"?body.note.trim()||null:null,
      }).eq("id",requestId);
      if(updateError) throw updateError;

      return json({
        ok:true,
        status:"approved",
        communityId:request.community_id,
        accountRole:requesterProfile.role==="pending"?"ca":requesterProfile.role,
      });
    }

    if(action!=="submit") return json({error:"unknown action"},400);
    if(profile.role!=="ca" && profile.role!=="pending") return json({error:"CA申請を利用できません",code:"CA_ROLE_REQUIRED"},403);
    if(profile.role==="pending" && !String(profile.niantic_id??"").trim()){
      return json({error:"先にアカウント設定でNiantic IDを登録してください",code:"NIANTIC_ID_REQUIRED"},422);
    }

    const meetupId=await resolveMeetupId(body.meetup);
    if(!meetupId) return json({error:"Campfire共有URL / Meetup URL / Meetup IDを確認してください",code:"INVALID_MEETUP"},400);

    const campfire=new CampfireClient({
      maxRetries:2,
      retryDelayMs:800,
      minRequestIntervalMs:500,
    });

    let event:CampfireEvent;
    let source="campfire-anonymous";
    try{
      event=await campfire.getAnonymousEvent(meetupId);
    }catch{
      const publicEvents=await campfire.getPublicEvents([meetupId]);
      const publicEvent=publicEvents[0];
      if(!publicEvent) return json({error:"公開Meetupを取得できませんでした",code:"MEETUP_NOT_FOUND"},404);
      source="campfire-public";
      event={
        id:publicEvent.id,
        name:publicEvent.name,
        clubId:publicEvent.clubId??null,
        address:publicEvent.address??publicEvent.place?.formattedAddress??publicEvent.place?.name??null,
        eventTime:publicEvent.eventTime??null,
        eventEndTime:publicEvent.eventEndTime??null,
      };
    }

    const creatorDisplayName=String(event.creator?.displayName??"").trim();
    const creatorCaBadgeVerified=Boolean(event.creator?.badges?.some(badge=>
      badge?.badgeType==="PGO_COMMUNITY_AMBASSADOR" ||
      badge?.alias==="PGO_COMMUNITY_AMBASSADOR"
    ));

    if(event.createdByCommunityAmbassador!==true || !creatorDisplayName || !creatorCaBadgeVerified){
      return json({
        error:"自分が主催したCommunity AmbassadorのMeetupを入力してください。主催者の紫CAバッジを確認できませんでした。",
        code:"CA_HOST_VERIFICATION_FAILED",
      },422);
    }

    if(!event.clubId) return json({error:"MeetupからCommunity IDを取得できませんでした",code:"COMMUNITY_ID_MISSING"},422);

    const {data:community,error:communityError}=await admin
      .from("communities")
      .select("id,name,prefecture,campfire_community_id")
      .eq("campfire_community_id",event.clubId)
      .maybeSingle();
    if(communityError) throw communityError;
    if(!community) return json({
      error:"このCommunityはCA CloverのCAマスターに未登録です",
      code:"COMMUNITY_NOT_REGISTERED",
      campfireCommunityId:event.clubId,
    },404);

    const {data:membership}=await admin.from("community_memberships")
      .select("id")
      .eq("user_id",userData.user.id)
      .eq("community_id",community.id)
      .maybeSingle();
    if(membership) return json({
      ok:true,
      status:"already_assigned",
      communityId:community.id,
      communityName:community.name,
    });

    const {data:pending}=await admin.from("community_access_requests")
      .select("id,status,community_name_snapshot")
      .eq("user_id",userData.user.id)
      .eq("community_id",community.id)
      .eq("status","pending")
      .maybeSingle();
    if(pending) return json({
      ok:true,
      status:"pending",
      requestId:pending.id,
      communityId:community.id,
      communityName:pending.community_name_snapshot,
      alreadyPending:true,
    });

    let masterMatch:boolean|null=null;
    let caMapStatus:"matched"|"not_listed"|"community_mismatch"|"identity_missing"="identity_missing";
    const identity=String(profile.niantic_id??"").trim().toLowerCase();
    if(identity){
      const {data:caMember}=await admin.from("ca_members")
        .select("id")
        .eq("source_key",identity)
        .maybeSingle();
      if(!caMember){
        caMapStatus="not_listed";
      }else{
        const {data:link}=await admin.from("community_ca_members")
          .select("id")
          .eq("ca_member_id",caMember.id)
          .eq("community_id",community.id)
          .maybeSingle();
        masterMatch=Boolean(link);
        caMapStatus=link?"matched":"community_mismatch";
      }
    }

    const canonicalUrl="https://campfire.scopely.com/discover/meetup/"+meetupId;
    const {data:created,error:createError}=await admin.from("community_access_requests").insert({
      user_id:userData.user.id,
      community_id:community.id,
      campfire_meetup_id:meetupId,
      meetup_url:canonicalUrl,
      meetup_title:event.name,
      community_name_snapshot:community.name,
      community_prefecture_snapshot:community.prefecture,
      is_ca_meetup:event.createdByCommunityAmbassador??null,
      meetup_starts_at:event.eventTime??null,
      meetup_ends_at:event.eventEndTime??null,
      meetup_location:event.address??event.location??null,
      rsvp_count:Number.isFinite(event.members?.totalCount)?Number(event.members?.totalCount):null,
      checkin_count:Number.isFinite(event.checkedInMembersCount)?Number(event.checkedInMembersCount):null,
      campfire_live_event_name:event.campfireLiveEvent?.eventName??null,
      creator_display_name:creatorDisplayName,
      creator_ca_badge_verified:creatorCaBadgeVerified,
      ca_map_status:caMapStatus,
      master_match:masterMatch,
      status:"pending",
    }).select("id,status,requested_at").single();
    if(createError) throw createError;

    return json({
      ok:true,
      status:"pending",
      source,
      requestId:created.id,
      communityId:community.id,
      communityName:community.name,
      communityPrefecture:community.prefecture,
      campfireCommunityId:event.clubId,
      meetupId,
      meetupTitle:event.name,
      isCaMeetup:event.createdByCommunityAmbassador??null,
      creatorDisplayName,
      creatorCaBadgeVerified,
      caMapStatus,
      masterMatch,
    });
  }catch(error){
    return json({error:error instanceof Error?error.message:String(error)},500);
  }
});
