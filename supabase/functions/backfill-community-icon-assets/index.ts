import { createClient } from "npm:@supabase/supabase-js@2";
import {observeCommunityIcon} from "../_shared/community-icon.ts";

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

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:corsHeaders});
  if(req.method!=="POST") return json({error:"method not allowed"},405);

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
      .select("role")
      .eq("id",userData.user.id)
      .single();
    if(profileError||profile?.role!=="admin") return json({error:"admin required"},403);

    const admin=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
    const body=await req.json().catch(()=>({}));
    const offset=Math.max(0,Number(body.offset??0)||0);
    const limit=Math.max(1,Math.min(8,Number(body.limit??8)||8));

    const {data:communities,error,count}=await admin
      .from("communities")
      .select("id,name,avatar_url,avatar_thumbnail_path",{count:"exact"})
      .not("avatar_url","is",null)
      .order("name")
      .range(offset,offset+limit-1);
    if(error) throw error;

    let thumbnailBackfilled=0;
    let archiveEnsured=0;
    let unavailable=0;
    let failed=0;
    const results:Array<Record<string,unknown>>=[];

    for(const community of communities??[]){
      try{
        const observed=await observeCommunityIcon(
          admin,
          community.id,
          community.avatar_url,
          {
            generateMissingThumbnail:!community.avatar_thumbnail_path,
            ensureArchive:true,
            allowUrlFallbackChange:false,
          },
        );
        if(!community.avatar_thumbnail_path && "thumbnail_path" in observed && observed.thumbnail_path){
          thumbnailBackfilled++;
        }
        if("archive_path" in observed && observed.archive_path) archiveEnsured++;
        if(observed.reason==="source_unavailable") unavailable++;

        results.push({
          community_id:community.id,
          name:community.name,
          status:observed.changed?"changed":observed.reason,
          thumbnail_path:"thumbnail_path" in observed?observed.thumbnail_path:null,
          archive_path:"archive_path" in observed?observed.archive_path:null,
          version_thumbnail_path:"version_thumbnail_path" in observed?observed.version_thumbnail_path:null,
          error:"version_error" in observed?observed.version_error:null,
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

    const total=count??0;
    const nextOffset=offset+(communities?.length??0);
    return json({
      ok:true,
      offset,
      limit,
      total,
      processed:communities?.length??0,
      nextOffset:nextOffset<total?nextOffset:null,
      thumbnailBackfilled,
      archiveEnsured,
      unavailable,
      failed,
      results,
    });
  }catch(error){
    return json({error:error instanceof Error?error.message:String(error)},500);
  }
});
