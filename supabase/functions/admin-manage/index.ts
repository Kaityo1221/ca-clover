import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders={
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type",
};

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:corsHeaders});
  try{
    const url=Deno.env.get("SUPABASE_URL");
    const anon=Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if(!url||!anon||!serviceKey) throw new Error("Supabase environment is incomplete");

    const auth=req.headers.get("Authorization")??"";
    const userClient=createClient(url,anon,{global:{headers:{Authorization:auth}},auth:{persistSession:false}});
    const {data:userData,error:userError}=await userClient.auth.getUser();
    if(userError||!userData.user) return new Response(JSON.stringify({error:"unauthorized"}),{status:401,headers:{...corsHeaders,"Content-Type":"application/json"}});

    const {data:profile,error:profileError}=await userClient.from("profiles").select("role").eq("id",userData.user.id).single();
    if(profileError||profile?.role!=="admin") return new Response(JSON.stringify({error:"admin required"}),{status:403,headers:{...corsHeaders,"Content-Type":"application/json"}});

    const body=await req.json();
    const admin=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});

    if(body.action==="set_role"){
      const role=String(body.role??"");
      const userId=String(body.userId??"");
      if(!["pending","ca","admin"].includes(role)||!userId) throw new Error("invalid role request");
      // A membership alone grants access to community data under current RLS.
      // Remove memberships before demoting, so failed cleanup cannot leave a
      // pending account with community access. Preserve CA identity and medals.
      if(role==="pending"){
        const {error:membershipError}=await admin.from("community_memberships")
          .delete().eq("user_id",userId);
        if(membershipError) throw membershipError;
      }
      const {error}=await admin.from("profiles").update({role}).eq("id",userId);
      if(error) throw error;
      return new Response(JSON.stringify({ok:true}),{headers:{...corsHeaders,"Content-Type":"application/json"}});
    }

    if(body.action==="set_permission"){
      return new Response(JSON.stringify({error:"S権限制度は廃止されました"}),{
        status:410,headers:{...corsHeaders,"Content-Type":"application/json"}
      });
    }

    if(body.action==="review_icon_change"){
      const changeId=String(body.changeId??"");
      if(!changeId) throw new Error("invalid icon review request");
      const reviewedAt=new Date().toISOString();
      const {error}=await admin.from("community_icon_changes").update({
        reviewed_at:reviewedAt,
        reviewed_by:userData.user.id,
      }).eq("id",changeId).is("reviewed_at",null);
      if(error) throw error;
      return new Response(JSON.stringify({ok:true,reviewed_at:reviewedAt}),{headers:{...corsHeaders,"Content-Type":"application/json"}});
    }

    if(body.action==="set_membership"){
      const userId=String(body.userId??"");
      const communityId=String(body.communityId??"");
      const assigned=Boolean(body.assigned);
      if(!userId||!communityId) throw new Error("invalid membership request");

      if(assigned){
        // Do not let an admin-side API call regrant memberships to pending users.
        const {data:targetProfile,error:targetError}=await admin.from("profiles")
          .select("role").eq("id",userId).maybeSingle();
        if(targetError) throw targetError;
        if(!targetProfile||!["ca","admin"].includes(targetProfile.role)){
          throw new Error("Community assignment requires an approved CA or ADMIN account");
        }
        const caMemberId=String(body.caMemberId??"");
        if(caMemberId){
          const {data:link,error:linkError}=await admin.from("community_ca_members").select("community_id,ca_member_id").eq("community_id",communityId).eq("ca_member_id",caMemberId).maybeSingle();
          if(linkError) throw linkError;
          if(!link) throw new Error("selected CA is not linked to this Community");
        }
        const {error}=await admin.from("community_memberships").upsert({user_id:userId,community_id:communityId},{onConflict:"user_id,community_id"});
        if(error) throw error;
        if(caMemberId){
          const {error:clearError}=await admin.from("user_ca_identities").update({is_primary:false}).eq("user_id",userId).eq("is_primary",true);
          if(clearError) throw clearError;
          const {error:identityError}=await admin.from("user_ca_identities").upsert({
            user_id:userId,ca_member_id:caMemberId,community_id:communityId,is_primary:true,
            verification_source:"admin_verified",verified_at:new Date().toISOString(),verified_by:userData.user.id
          },{onConflict:"user_id,ca_member_id,community_id"});
          if(identityError) throw identityError;
        }
      }else{
        const {error}=await admin.from("community_memberships").delete().eq("user_id",userId).eq("community_id",communityId);
        if(error) throw error;
      }
      return new Response(JSON.stringify({ok:true}),{headers:{...corsHeaders,"Content-Type":"application/json"}});
    }

    return new Response(JSON.stringify({error:"unknown action"}),{status:400,headers:{...corsHeaders,"Content-Type":"application/json"}});
  }catch(error){
    return new Response(JSON.stringify({error:error instanceof Error?error.message:String(error)}),{status:500,headers:{...corsHeaders,"Content-Type":"application/json"}});
  }
});
