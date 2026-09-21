type AdminClient={
  from:(table:string)=>any;
  storage:{
    from:(bucket:string)=>any;
  };
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

async function inspectAvatar(url:string){
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
    return {
      hash:await sha256Bytes(buffer),
      method:"content_sha256" as const,
      buffer,
    };
  }catch{
    return {
      hash:await sha256Text(url),
      method:"url_fallback" as const,
      buffer:null,
    };
  }
}

async function ensureThumbnail(
  admin:AdminClient,
  communityId:string,
  buffer:ArrayBuffer|null,
){
  if(!buffer) return {path:null,error:"source_unavailable"} as const;
  if(buffer.byteLength>2*1024*1024){
    return {path:null,error:"source_too_large"} as const;
  }
  try{
    const module=await import("./community-icon-thumbnail.ts");
    const path=await module.createCommunityIconThumbnail(admin,communityId,buffer);
    return {path,error:null} as const;
  }catch(error){
    return {
      path:null,
      error:error instanceof Error?error.message:String(error),
    } as const;
  }
}

export async function observeCommunityIcon(
  admin:AdminClient,
  communityId:string,
  rawAvatarUrl:unknown,
  options:{generateMissingThumbnail?:boolean}={},
){
  const avatarUrl=typeof rawAvatarUrl==="string"?rawAvatarUrl.trim():"";
  const checkedAt=new Date().toISOString();

  if(!avatarUrl){
    await admin.from("communities").update({avatar_last_checked_at:checkedAt}).eq("id",communityId);
    return {changed:false,reason:"missing"};
  }

  const {data:current,error:currentError}=await admin
    .from("communities")
    .select("avatar_url,avatar_content_hash,avatar_thumbnail_path")
    .eq("id",communityId)
    .single();
  if(currentError) throw currentError;

  const observed=await inspectAvatar(avatarUrl);
  const sameHash=String(current?.avatar_content_hash??"")===observed.hash;

  if(sameHash){
    let thumbnailPath=current?.avatar_thumbnail_path??null;
    let thumbnailError:string|null=null;
    if(!thumbnailPath&&options.generateMissingThumbnail===true){
      const thumbnail=await ensureThumbnail(admin,communityId,observed.buffer);
      thumbnailPath=thumbnail.path;
      thumbnailError=thumbnail.error;
    }

    const updatePayload:Record<string,unknown>={
      avatar_url:avatarUrl,
      avatar_last_checked_at:checkedAt,
    };
    if(thumbnailPath) updatePayload.avatar_thumbnail_path=thumbnailPath;

    const {error:updateError}=await admin.from("communities").update(updatePayload).eq("id",communityId);
    if(updateError) throw updateError;
    return {
      changed:false,
      reason:"same_content",
      hash:observed.hash,
      method:observed.method,
      thumbnail_path:thumbnailPath,
      thumbnail_error:thumbnailError,
    };
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
    reviewed_at:changeType==="initial"?checkedAt:null,
  });
  if(insertError) throw insertError;

  const thumbnail=await ensureThumbnail(admin,communityId,observed.buffer);
  const updatePayload:Record<string,unknown>={
    avatar_url:avatarUrl,
    avatar_content_hash:observed.hash,
    avatar_last_checked_at:checkedAt,
    avatar_last_changed_at:checkedAt,
  };
  if(thumbnail.path) updatePayload.avatar_thumbnail_path=thumbnail.path;

  const {error:updateError}=await admin.from("communities").update(updatePayload).eq("id",communityId);
  if(updateError) throw updateError;

  return {
    changed:true,
    changeType,
    hash:observed.hash,
    method:observed.method,
    thumbnail_path:thumbnail.path,
    thumbnail_error:thumbnail.error,
  };
}
