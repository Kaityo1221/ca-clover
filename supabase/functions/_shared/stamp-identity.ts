export type StampAccess={
  role:string;
  nianticId:string|null;
  isAdmin:boolean;
  hasStamp:boolean;
};

type IdentityRow={
  ca_member_id:string;
  community_id:string;
  is_primary:boolean;
};

function normalizeIdentity(value:unknown){
  return String(value??"").normalize("NFKC").trim().replace(/^@+/,"").toLowerCase();
}

export async function getStampAccess(admin:any,userId:string):Promise<StampAccess>{
  const [profileResult,permissionResult]=await Promise.all([
    admin.from("profiles").select("role,niantic_id").eq("id",userId).single(),
    admin.from("user_permissions").select("permission_code").eq("user_id",userId).eq("permission_code","S"),
  ]);

  if(profileResult.error||!profileResult.data) throw new Error("profile not found");
  const profile=profileResult.data;
  const isAdmin=profile.role==="admin";
  const hasStamp=isAdmin||(permissionResult.data??[]).some((row:any)=>row.permission_code==="S");

  return {
    role:String(profile.role??""),
    nianticId:profile.niantic_id??null,
    isAdmin,
    hasStamp,
  };
}

async function validateIdentity(admin:any,identity:IdentityRow){
  const [caResult,communityResult,linkResult]=await Promise.all([
    admin.from("ca_members")
      .select("id,trainer_name,ca_level,status")
      .eq("id",identity.ca_member_id)
      .maybeSingle(),
    admin.from("communities")
      .select("id,name,prefecture,avatar_url,avatar_thumbnail_path,avatar_last_changed_at")
      .eq("id",identity.community_id)
      .maybeSingle(),
    admin.from("community_ca_members")
      .select("id")
      .eq("ca_member_id",identity.ca_member_id)
      .eq("community_id",identity.community_id)
      .maybeSingle(),
  ]);

  if(caResult.error) throw caResult.error;
  if(communityResult.error) throw communityResult.error;
  if(linkResult.error) throw linkResult.error;

  const ca=caResult.data;
  const community=communityResult.data;
  if(
    !ca||
    !community||
    !linkResult.data||
    ca.status!=="active"||
    !["1st","2nd"].includes(String(ca.ca_level??""))
  ){
    return null;
  }

  return {ca,community};
}

async function chooseExactMasterIdentity(admin:any,userId:string,nianticId:string|null){
  const normalized=normalizeIdentity(nianticId);
  if(!normalized) return null;

  const {data:ca,error:caError}=await admin.from("ca_members")
    .select("id,source_key,trainer_name,ca_level,status")
    .eq("source_key",normalized)
    .maybeSingle();
  if(caError) throw caError;
  if(!ca||ca.status!=="active"||!["1st","2nd"].includes(String(ca.ca_level??""))) return null;

  const {data:links,error:linksError}=await admin.from("community_ca_members")
    .select("community_id")
    .eq("ca_member_id",ca.id);
  if(linksError) throw linksError;
  const communityIds=[...new Set((links??[]).map((row:any)=>String(row.community_id)).filter(Boolean))];
  if(!communityIds.length) return null;

  let chosenCommunityId:string|null=communityIds.length===1?communityIds[0]:null;

  if(!chosenCommunityId){
    const {data:memberships,error:membershipError}=await admin.from("community_memberships")
      .select("community_id")
      .eq("user_id",userId)
      .in("community_id",communityIds);
    if(membershipError) throw membershipError;
    const matched=[...new Set((memberships??[]).map((row:any)=>String(row.community_id)).filter(Boolean))];
    if(matched.length===1) chosenCommunityId=matched[0];
  }

  if(!chosenCommunityId){
    const {data:claims,error:claimError}=await admin.from("community_access_requests")
      .select("community_id")
      .eq("user_id",userId)
      .eq("status","approved")
      .in("community_id",communityIds);
    if(claimError) throw claimError;
    const matched=[...new Set((claims??[]).map((row:any)=>String(row.community_id)).filter(Boolean))];
    if(matched.length===1) chosenCommunityId=matched[0];
  }

  if(!chosenCommunityId) return null;
  return {ca_member_id:String(ca.id),community_id:chosenCommunityId,is_primary:true};
}

async function persistPrimaryIdentity(admin:any,userId:string,identity:IdentityRow,source:string){
  const {data:owner,error:ownerError}=await admin.from("user_ca_identities")
    .select("user_id")
    .eq("ca_member_id",identity.ca_member_id)
    .eq("community_id",identity.community_id)
    .maybeSingle();
  if(ownerError) throw ownerError;
  if(owner?.user_id&&owner.user_id!==userId){
    throw new Error("CA本人情報が別アカウントに紐づいています。管理者へお問い合わせください。");
  }

  const {error:demoteError}=await admin.from("user_ca_identities")
    .update({is_primary:false})
    .eq("user_id",userId)
    .eq("is_primary",true);
  if(demoteError) throw demoteError;

  const {error:upsertError}=await admin.from("user_ca_identities").upsert({
    user_id:userId,
    ca_member_id:identity.ca_member_id,
    community_id:identity.community_id,
    is_primary:true,
    verification_source:source,
    verified_at:new Date().toISOString(),
    verified_by:null,
  },{onConflict:"user_id,ca_member_id,community_id"});
  if(upsertError) throw upsertError;
}

export async function resolveStampActor(
  admin:any,
  userId:string,
  options:{allowMissing?:boolean}={},
){
  const access=await getStampAccess(admin,userId);
  if(!access.hasStamp) throw new Error("Stamp Rallyの利用権限がありません");

  const {data:identityRows,error:identityError}=await admin.from("user_ca_identities")
    .select("ca_member_id,community_id,is_primary")
    .eq("user_id",userId)
    .order("is_primary",{ascending:false});
  if(identityError) throw identityError;

  const rows=(identityRows??[]) as IdentityRow[];

  for(const identity of rows.filter(row=>row.is_primary)){
    const valid=await validateIdentity(admin,identity);
    if(valid){
      return {
        user_id:userId,
        niantic_id:access.nianticId,
        ca_member_id:valid.ca.id,
        trainer_name:valid.ca.trainer_name,
        ca_level:valid.ca.ca_level,
        community:valid.community,
      };
    }
  }

  const validExisting:Array<{identity:IdentityRow;valid:any}>=[];
  for(const identity of rows.filter(row=>!row.is_primary)){
    const valid=await validateIdentity(admin,identity);
    if(valid) validExisting.push({identity,valid});
  }

  if(validExisting.length===1){
    await persistPrimaryIdentity(admin,userId,validExisting[0].identity,"stamp_auto_existing_identity");
    return {
      user_id:userId,
      niantic_id:access.nianticId,
      ca_member_id:validExisting[0].valid.ca.id,
      trainer_name:validExisting[0].valid.ca.trainer_name,
      ca_level:validExisting[0].valid.ca.ca_level,
      community:validExisting[0].valid.community,
    };
  }

  const exact=await chooseExactMasterIdentity(admin,userId,access.nianticId);
  if(exact){
    const valid=await validateIdentity(admin,exact);
    if(valid){
      await persistPrimaryIdentity(admin,userId,exact,"stamp_auto_niantic_id");
      return {
        user_id:userId,
        niantic_id:access.nianticId,
        ca_member_id:valid.ca.id,
        trainer_name:valid.ca.trainer_name,
        ca_level:valid.ca.ca_level,
        community:valid.community,
      };
    }
  }

  if(options.allowMissing) return null;
  throw new Error("CA本人情報を自動確認できませんでした。管理者へお問い合わせください。");
}
