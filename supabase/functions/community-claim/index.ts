import { createClient } from "npm:@supabase/supabase-js@2";
import { CampfireClient, type CampfireEvent } from "../_shared/campfire/mod.ts";
import { resolveCampfireShareUrl } from "../_shared/campfire-share-url.js";

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

function normalizeCommunityName(value:unknown){
  return String(value??"").normalize("NFKC").trim().toLowerCase().replace(/\s+/g," ");
}

function isRecentMeetup(event:CampfireEvent){
  const raw=event.eventEndTime??event.eventTime;
  if(!raw) return false;
  const time=Date.parse(raw);
  if(!Number.isFinite(time)) return false;
  return time>=Date.now()-60*24*60*60*1000;
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
      const requestSource=String(request.request_source??"meetup_share");
      const requiresMeetupBadge=requestSource==="meetup_share";
      if(
        (requiresMeetupBadge && request.creator_ca_badge_verified!==true) ||
        request.creator_username_matches_profile!==true ||
        request.ca_role_verified!==true ||
        request.ca_map_status!=="matched" ||
        request.master_match!==true ||
        !["1st","2nd"].includes(String(request.ca_level_snapshot??""))
      ){
        return json({
          error:requiresMeetupBadge
            ?"本人・CAバッジ・Community・1st/2ndの確認が完了していないため承認できません"
            :"本人・Community・1st/2ndの確認が完了していないため承認できません",
          code:"VERIFICATION_INCOMPLETE",
        },409);
      }

      const {data:requesterProfile,error:requesterProfileError}=await admin.from("profiles")
        .select("role,niantic_id")
        .eq("id",request.user_id)
        .single();
      if(requesterProfileError||!requesterProfile) throw requesterProfileError??new Error("requester profile not found");

      const currentIdentity=String(requesterProfile.niantic_id??"").trim().replace(/^@+/,"").toLowerCase();
      const snapshotIdentity=String(request.niantic_id_snapshot??"").trim().replace(/^@+/,"").toLowerCase();
      const creatorIdentity=String(request.creator_username??"").trim().replace(/^@+/,"").toLowerCase();
      if(
        !currentIdentity ||
        currentIdentity!==snapshotIdentity ||
        (requestSource==="meetup_share" && currentIdentity!==creatorIdentity)
      ){
        return json({
          error:requestSource==="meetup_share"
            ?"申請後にNiantic IDが変更されたか、Meetup主催者と一致しないため承認できません"
            :"申請後にNiantic IDが変更されたため承認できません",
          code:"IDENTITY_CHANGED",
        },409);
      }

      const {data:currentCa,error:currentCaError}=await admin.from("ca_members")
        .select("id,ca_level,status")
        .eq("source_key",currentIdentity)
        .maybeSingle();
      if(currentCaError) throw currentCaError;
      if(!currentCa || currentCa.status!=="active" || !["1st","2nd"].includes(String(currentCa.ca_level??""))){
        return json({error:"日本CA地図で現在の1st/2nd資格を確認できないため承認できません",code:"CA_ROLE_CHANGED"},409);
      }
      const {data:currentLink,error:currentLinkError}=await admin.from("community_ca_members")
        .select("id")
        .eq("ca_member_id",currentCa.id)
        .eq("community_id",request.community_id)
        .maybeSingle();
      if(currentLinkError) throw currentLinkError;
      if(!currentLink){
        return json({error:"日本CA地図で現在このCommunityの担当CAとして確認できないため承認できません",code:"CA_COMMUNITY_CHANGED"},409);
      }

      const campfireCommunityIdSnapshot=String(request.campfire_community_id_snapshot??"").trim();
      if(campfireCommunityIdSnapshot){
        const {data:idHistory,error:idHistoryError}=await admin.from("community_campfire_ids")
          .select("id")
          .eq("community_id",request.community_id)
          .eq("campfire_community_id",campfireCommunityIdSnapshot)
          .maybeSingle();
        if(idHistoryError) throw idHistoryError;
        if(!idHistory){
          return json({error:"申請時のCampfire Community IDが現在このCommunityの履歴に属していないため承認できません",code:"COMMUNITY_ID_RELATION_CHANGED"},409);
        }
      }

      if(requesterProfile.role==="pending"){
        const {error:roleError}=await admin.from("profiles")
          .update({role:"ca"})
          .eq("id",request.user_id)
          .eq("role","pending");
        if(roleError) throw roleError;
      }

      const {error:membershipError}=await admin.from("community_memberships").upsert({
        user_id:request.user_id,
        community_id:request.community_id,
      },{onConflict:"user_id,community_id"});
      if(membershipError) throw membershipError;

      if(requestSource==="meetup_share" && request.campfire_meetup_id && request.meetup_title){
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
      }

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
    const profileNianticId=String(profile.niantic_id??"").trim();
    if(!profileNianticId){
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
        club:publicEvent.clubId&&publicEvent.clubName?{id:publicEvent.clubId,name:publicEvent.clubName}:null,
        address:publicEvent.address??publicEvent.place?.formattedAddress??publicEvent.place?.name??null,
        eventTime:publicEvent.eventTime??null,
        eventEndTime:publicEvent.eventEndTime??null,
      };
    }

    const creatorDisplayName=String(event.creator?.displayName??"").trim();
    const creatorUsername=String(event.creator?.username??"").trim();
    const creatorCaBadgeVerified=Boolean(event.creator?.badges?.some(badge=>
      badge?.badgeType==="PGO_COMMUNITY_AMBASSADOR" ||
      badge?.alias==="PGO_COMMUNITY_AMBASSADOR"
    ));

    if(event.createdByCommunityAmbassador!==true || !creatorDisplayName || !creatorUsername || !creatorCaBadgeVerified){
      return json({
        error:"自分が主催したCommunity AmbassadorのMeetupを入力してください。主催者の紫CAバッジまたはNiantic IDを確認できませんでした。",
        code:"CA_HOST_VERIFICATION_FAILED",
      },422);
    }

    const identity=profileNianticId.toLowerCase();
    const creatorUsernameNormalized=creatorUsername.toLowerCase();
    const creatorUsernameMatchesProfile=creatorUsernameNormalized===identity;
    if(!creatorUsernameMatchesProfile){
      return json({
        error:"登録したNiantic IDとMeetup主催者のNiantic IDが一致しません。自分が主催したMeetupを入力してください。",
        code:"CREATOR_ID_MISMATCH",
        creatorUsername,
      },422);
    }

    if(!event.clubId) return json({error:"MeetupからCommunity IDを取得できませんでした",code:"COMMUNITY_ID_MISSING"},422);

    const liveCommunityName=String(event.club?.name??"").trim();

    // CA資格は日本CA地図、Communityの現在実体はCampfireをそれぞれ正とする。
    const {data:caMember,error:caMemberError}=await admin.from("ca_members")
      .select("id,source_key,trainer_name,ca_level,status")
      .eq("source_key",identity)
      .maybeSingle();
    if(caMemberError) throw caMemberError;

    if(!caMember){
      return json({
        error:"あなたは日本CA地図にまだ掲載されていません。リョータさんに掲載をお願いしてください。",
        code:"CA_MAP_NOT_LISTED",
        creatorUsername,
        communityName:liveCommunityName||null,
      },422);
    }

    const caLevel=String(caMember.ca_level??"").trim();
    const caRoleVerified=(caLevel==="1st"||caLevel==="2nd") && caMember.status==="active";
    if(!caRoleVerified){
      return json({
        error:"日本CA地図で有効な1st/2ndとして確認できませんでした。掲載内容を確認してください。",
        code:"CA_ROLE_NOT_VERIFIED",
        caLevel:caLevel||null,
        caStatus:caMember.status??null,
      },422);
    }

    const {data:caLinks,error:caLinksError}=await admin.from("community_ca_members")
      .select("community_id")
      .eq("ca_member_id",caMember.id);
    if(caLinksError) throw caLinksError;
    const linkedCommunityIds=[...new Set((caLinks??[]).map(row=>String(row.community_id)).filter(Boolean))];
    if(linkedCommunityIds.length===0){
      return json({
        error:"日本CA地図で担当Communityを確認できませんでした。",
        code:"CA_COMMUNITY_MISMATCH",
        creatorUsername,
        caLevel,
      },422);
    }

    const {data:linkedCommunities,error:linkedCommunitiesError}=await admin.from("communities")
      .select("id,name,prefecture,campfire_community_id")
      .in("id",linkedCommunityIds);
    if(linkedCommunitiesError) throw linkedCommunitiesError;

    let community=(linkedCommunities??[]).find(row=>row.campfire_community_id===event.clubId)??null;
    let communityIdResolution="current_id";

    if(!community){
      const {data:history,error:historyError}=await admin.from("community_campfire_ids")
        .select("community_id,status")
        .eq("campfire_community_id",event.clubId)
        .maybeSingle();
      if(historyError) throw historyError;

      if(history){
        community=(linkedCommunities??[]).find(row=>row.id===history.community_id)??null;
        if(!community){
          return json({
            error:"このCampfire Community IDは別のCommunityに紐づいています。",
            code:"CA_COMMUNITY_MISMATCH",
            creatorUsername,
            campfireCommunityId:event.clubId,
          },422);
        }
        communityIdResolution=history.status==="active"?"history_active":"history_retired";

        if(history.status==="retired" && isRecentMeetup(event)){
          const {error:promoteError}=await admin.rpc("internal_set_community_campfire_id",{
            p_community_id:community.id,
            p_campfire_community_id:event.clubId,
            p_source:"campfire-claim",
            p_observed_name:liveCommunityName||community.name,
          });
          if(promoteError) throw promoteError;
          community={...community,campfire_community_id:event.clubId,name:liveCommunityName||community.name};
          communityIdResolution="history_reactivated";
        }
      }
    }

    if(!community){
      const normalizedLiveName=normalizeCommunityName(liveCommunityName);
      const nameMatches=normalizedLiveName
        ?(linkedCommunities??[]).filter(row=>normalizeCommunityName(row.name)===normalizedLiveName)
        :[];

      if(nameMatches.length===1){
        community=nameMatches[0];
        communityIdResolution="ca_link_name";
      }else if((linkedCommunities??[]).length===1){
        community=(linkedCommunities??[])[0];
        communityIdResolution="ca_link_single";
      }else{
        return json({
          error:"担当Communityが複数あるため、このMeetupのCommunityを一意に特定できませんでした。",
          code:"COMMUNITY_ID_AMBIGUOUS",
          campfireCommunityId:event.clubId,
          campfireCommunityName:liveCommunityName||null,
          candidates:(linkedCommunities??[]).map(row=>({id:row.id,name:row.name,prefecture:row.prefecture})),
        },422);
      }

      if(isRecentMeetup(event)){
        const {error:promoteError}=await admin.rpc("internal_set_community_campfire_id",{
          p_community_id:community.id,
          p_campfire_community_id:event.clubId,
          p_source:"campfire-claim",
          p_observed_name:liveCommunityName||community.name,
        });
        if(promoteError) throw promoteError;
        community={...community,campfire_community_id:event.clubId,name:liveCommunityName||community.name};
        communityIdResolution+="_promoted";
      }else{
        const {data:existingHistory,error:existingHistoryError}=await admin.from("community_campfire_ids")
          .select("community_id")
          .eq("campfire_community_id",event.clubId)
          .maybeSingle();
        if(existingHistoryError) throw existingHistoryError;
        if(existingHistory && existingHistory.community_id!==community.id){
          return json({error:"Campfire Community IDが別Communityの履歴と競合しています",code:"COMMUNITY_ID_CONFLICT"},409);
        }
        if(!existingHistory){
          const {error:historyInsertError}=await admin.from("community_campfire_ids").insert({
            community_id:community.id,
            campfire_community_id:event.clubId,
            status:"retired",
            source:"campfire-claim-historical",
            observed_name:liveCommunityName||community.name,
            last_seen_at:new Date().toISOString(),
            retired_at:new Date().toISOString(),
          });
          if(historyInsertError) throw historyInsertError;
        }
        communityIdResolution+="_historical";
      }
    }else{
      await admin.from("community_campfire_ids")
        .update({
          last_seen_at:new Date().toISOString(),
          observed_name:liveCommunityName||community.name,
        })
        .eq("community_id",community.id)
        .eq("campfire_community_id",event.clubId);
    }

    const masterMatch=true;
    const caMapStatus="matched" as const;

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
      campfireCommunityId:event.clubId,
      communityIdResolution,
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
      campfireCommunityId:event.clubId,
      communityIdResolution,
    });

    const canonicalUrl="https://campfire.scopely.com/discover/meetup/"+meetupId;
    const {data:created,error:createError}=await admin.from("community_access_requests").insert({
      user_id:userData.user.id,
      community_id:community.id,
      campfire_meetup_id:meetupId,
      meetup_url:canonicalUrl,
      meetup_title:event.name,
      community_name_snapshot:community.name,
      community_prefecture_snapshot:community.prefecture,
      campfire_community_id_snapshot:event.clubId,
      campfire_community_name_snapshot:liveCommunityName||community.name,
      community_id_resolution:communityIdResolution,
      is_ca_meetup:event.createdByCommunityAmbassador??null,
      meetup_starts_at:event.eventTime??null,
      meetup_ends_at:event.eventEndTime??null,
      meetup_location:event.address??event.location??null,
      rsvp_count:Number.isFinite(event.members?.totalCount)?Number(event.members?.totalCount):null,
      checkin_count:Number.isFinite(event.checkedInMembersCount)?Number(event.checkedInMembersCount):null,
      campfire_live_event_name:event.campfireLiveEvent?.eventName??null,
      creator_display_name:creatorDisplayName,
      creator_username:creatorUsername,
      creator_username_matches_profile:creatorUsernameMatchesProfile,
      creator_ca_badge_verified:creatorCaBadgeVerified,
      ca_level_snapshot:caLevel,
      ca_role_verified:caRoleVerified,
      niantic_id_snapshot:profileNianticId,
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
      campfireCommunityName:liveCommunityName||community.name,
      communityIdResolution,
      meetupId,
      meetupTitle:event.name,
      isCaMeetup:event.createdByCommunityAmbassador??null,
      creatorDisplayName,
      creatorUsername,
      creatorUsernameMatchesProfile,
      creatorCaBadgeVerified,
      caLevel,
      caRoleVerified,
      caMapStatus,
      masterMatch,
    });
  }catch(error){
    return json({error:error instanceof Error?error.message:String(error)},500);
  }
});
