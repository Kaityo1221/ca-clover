type AdminClient={
  from:(table:string)=>any;
};

function bytesToHex(bytes:Uint8Array){
  return Array.from(bytes).map(value=>value.toString(16).padStart(2,"0")).join("");
}

async function sha256Bytes(buffer:ArrayBuffer){
  const digest=await crypto.subtle.digest("SHA-256",buffer);
  return bytesToHex(new Uint8Array(digest));
}

async function sha256Text(value:string){
  return sha256Bytes(new TextEncoder().encode(value).buffer);
}

async function hashAvatar(url:string){
  try{
    const response=await fetch(url,{
      redirect:"follow",
      headers:{
        "Accept":"image/*",
        "User-Agent":"CA-Clover/1.0",
      },
    });
    if(!response.ok) throw new Error("avatar HTTP "+response.status);
    const length=Number(response.headers.get("content-length")??"0");
    if(Number.isFinite(length)&&length>5*1024*1024) throw new Error("avatar too large");
    const buffer=await response.arrayBuffer();
    if(buffer.byteLength>5*1024*1024) throw new Error("avatar too large");
    return {hash:await sha256Bytes(buffer),method:"content_sha256" as const};
  }catch{
    return {hash:await sha256Text(url),method:"url_fallback" as const};
  }
}

export async function observeCommunityIcon(
  admin:AdminClient,
  communityId:string,
  rawAvatarUrl:unknown,
){
  const avatarUrl=typeof rawAvatarUrl==="string"?rawAvatarUrl.trim():"";
  const checkedAt=new Date().toISOString();

  if(!avatarUrl){
    await admin.from("communities").update({avatar_last_checked_at:checkedAt}).eq("id",communityId);
    return {changed:false,reason:"missing"};
  }

  const {data:current,error:currentError}=await admin
    .from("communities")
    .select("avatar_url,avatar_content_hash")
    .eq("id",communityId)
    .single();
  if(currentError) throw currentError;

  const observed=await hashAvatar(avatarUrl);
  const sameHash=String(current?.avatar_content_hash??"")===observed.hash;

  if(sameHash){
    const {error:updateError}=await admin.from("communities").update({
      avatar_url:avatarUrl,
      avatar_last_checked_at:checkedAt,
    }).eq("id",communityId);
    if(updateError) throw updateError;
    return {changed:false,reason:"same_content",hash:observed.hash,method:observed.method};
  }

  const changeType=current?.avatar_content_hash?"changed":"initial";
  const {error:insertError}=await admin.from("community_icon_changes").insert({
    community_id:communityId,
    change_type:changeType,
    detection_method:observed.method,
    previous_avatar_url:current?.avatar_url??null,
    previous_content_hash:current?.avatar_content_hash??null,
    new_avatar_url:avatarUrl,
    new_content_hash:observed.hash,
    detected_at:checkedAt,
  });
  if(insertError) throw insertError;

  const {error:updateError}=await admin.from("communities").update({
    avatar_url:avatarUrl,
    avatar_content_hash:observed.hash,
    avatar_last_checked_at:checkedAt,
    avatar_last_changed_at:checkedAt,
  }).eq("id",communityId);
  if(updateError) throw updateError;

  return {changed:true,changeType,hash:observed.hash,method:observed.method};
}
