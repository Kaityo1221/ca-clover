import { createClient } from "npm:@supabase/supabase-js@2";
import {
  createCommunityIconThumbnail,
  createCommunityIconVersionThumbnail,
} from "../_shared/community-icon-thumbnail.ts";

const corsHeaders={
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type, x-ca-clover-cron-secret",
};

function json(data:unknown,status=200){
  return new Response(JSON.stringify(data),{
    status,
    headers:{...corsHeaders,"Content-Type":"application/json"},
  });
}

function isWebP(bytes:Uint8Array){
  if(bytes.byteLength<12) return false;
  return String.fromCharCode(...bytes.slice(0,4))==="RIFF"
    && String.fromCharCode(...bytes.slice(8,12))==="WEBP";
}

async function requireAdmin(req:Request){
  const url=Deno.env.get("SUPABASE_URL");
  const anon=Deno.env.get("SUPABASE_ANON_KEY");
  const service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if(!url||!anon||!service) throw new Error("Supabase environment is incomplete");

  const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});

  const cronSecret=req.headers.get("x-ca-clover-cron-secret")??"";
  if(cronSecret){
    const {data:expected,error}=await admin.rpc("internal_get_sync_cron_secret");
    if(!error&&typeof expected==="string"&&expected&&cronSecret===expected){
      return {admin,error:null} as const;
    }
    return {error:json({error:"invalid cron secret"},401)} as const;
  }

  const authorization=req.headers.get("Authorization")??"";
  const userClient=createClient(url,anon,{
    global:{headers:{Authorization:authorization}},
    auth:{persistSession:false},
  });
  const {data:userData,error:userError}=await userClient.auth.getUser();
  if(userError||!userData.user) return {error:json({error:"unauthorized"},401)} as const;
  const {data:profile,error:profileError}=await userClient
    .from("profiles")
    .select("role")
    .eq("id",userData.user.id)
    .single();
  if(profileError||profile?.role!=="admin") return {error:json({error:"admin required"},403)} as const;
  return {admin,error:null} as const;
}

async function storedThumbnailIsValid(admin:any,path:string|null){
  if(!path) return false;
  const {data,error}=await admin.storage.from("community-icon-thumbs").download(path);
  if(error||!data) return false;
  const bytes=new Uint8Array(await data.arrayBuffer());
  return isWebP(bytes);
}

async function fetchSource(url:string){
  const response=await fetch(url,{
    redirect:"follow",
    headers:{"Accept":"image/*","User-Agent":"CA-Clover/1.0"},
  });
  if(!response.ok) throw new Error("avatar HTTP "+response.status);
  const buffer=await response.arrayBuffer();
  if(buffer.byteLength>5*1024*1024) throw new Error("avatar too large");
  const rawType=(response.headers.get("content-type")??"").split(";")[0].trim().toLowerCase();
  return {
    buffer,
    contentType:rawType.startsWith("image/")?rawType:"application/octet-stream",
  };
}

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:corsHeaders});
  if(req.method!=="POST") return json({error:"method not allowed"},405);

  try{
    const auth=await requireAdmin(req);
    if(auth.error) return auth.error;
    const {admin}=auth;
    const body=await req.json().catch(()=>({}));
    const requestedIds=Array.isArray(body.communityIds)
      ?body.communityIds.filter((value:unknown):value is string=>typeof value==="string"&&value.length>0)
      :[];
    const offset=Math.max(0,Number(body.offset??0)||0);
    const limit=Math.max(1,Math.min(8,Number(body.limit??6)||6));

    let query=admin
      .from("communities")
      .select("id,name,avatar_url,avatar_thumbnail_path,avatar_content_hash",{count:"exact"})
      .not("avatar_url","is",null);
    if(requestedIds.length){
      query=query.in("id",requestedIds);
    }else{
      query=query.order("name").range(offset,offset+limit-1);
    }
    const {data:rows,error,count}=await query;
    if(error) throw error;

    let repaired=0;
    let valid=0;
    let failed=0;
    const results:Array<Record<string,unknown>>=[];

    for(const community of rows??[]){
      try{
        const communityValid=await storedThumbnailIsValid(admin,community.avatar_thumbnail_path);
        const {data:version,error:versionError}=await admin
          .from("community_icon_versions")
          .select("id,thumbnail_path,content_hash,is_current")
          .eq("community_id",community.id)
          .eq("is_current",true)
          .maybeSingle();
        if(versionError) throw versionError;

        const versionValid=version?.thumbnail_path
          ?await storedThumbnailIsValid(admin,version.thumbnail_path)
          :true;

        if(communityValid&&versionValid){
          valid++;
          results.push({community_id:community.id,name:community.name,status:"valid"});
          continue;
        }

        const source=await fetchSource(community.avatar_url);
        let archivePath:string|null=null;
        if(version&&community.avatar_content_hash){
          archivePath=community.id+"/"+community.avatar_content_hash;
          const {error:archiveError}=await admin.storage
            .from("community-icon-archive")
            .upload(archivePath,new Uint8Array(source.buffer),{
              contentType:source.contentType,
              cacheControl:"31536000",
              upsert:true,
            });
          if(archiveError) throw archiveError;
        }

        let communityPath:string|null=null;
        let versionPath:string|null=null;
        try{
          communityPath=await createCommunityIconThumbnail(admin,community.id,source.buffer);
          if(version&&community.avatar_content_hash){
            versionPath=await createCommunityIconVersionThumbnail(
              admin,
              community.id,
              community.avatar_content_hash,
              source.buffer,
            );
          }
        }catch(error){
          if(!(error instanceof Error)||error.message!=="source_dimensions_too_large"){
            throw error;
          }
        }

        const {error:updateCommunityError}=await admin
          .from("communities")
          .update({avatar_thumbnail_path:communityPath})
          .eq("id",community.id);
        if(updateCommunityError) throw updateCommunityError;

        if(version){
          const {error:updateVersionError}=await admin
            .from("community_icon_versions")
            .update({
              thumbnail_path:versionPath,
              archive_path:archivePath,
            })
            .eq("id",version.id);
          if(updateVersionError) throw updateVersionError;
        }

        repaired++;
        results.push({
          community_id:community.id,
          name:community.name,
          status:communityPath?"repaired":"archive_fallback",
          community_thumbnail_path:communityPath,
          version_thumbnail_path:versionPath,
          archive_path:archivePath,
        });
      }catch(error){
        failed++;
        results.push({
          community_id:community.id,
          name:community.name,
          status:"error",
          error:error instanceof Error?error.message:String(error),
        });
      }
    }

    const total=requestedIds.length?requestedIds.length:(count??0);
    const nextOffset=offset+(rows?.length??0);
    return json({
      ok:true,
      offset,
      limit,
      total,
      processed:rows?.length??0,
      nextOffset:requestedIds.length?null:(nextOffset<total?nextOffset:null),
      valid,
      repaired,
      failed,
      results,
    });
  }catch(error){
    return json({error:error instanceof Error?error.message:String(error)},500);
  }
});
