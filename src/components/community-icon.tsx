"use client";

import { useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

export type CommunityIconSource = {
  avatar_url: string | null;
  avatar_thumbnail_path: string | null;
  avatar_last_changed_at: string | null;
};

type Props = {
  supabase: SupabaseClient;
  community: CommunityIconSource;
  className?: string;
  imageClassName?: string;
  fallbackClassName?: string;
  fallback?: string;
  loading?: "eager" | "lazy";
  alt?: string;
};

export function communityIconPublicUrl(
  supabase: SupabaseClient,
  community: CommunityIconSource,
){
  if(!community.avatar_thumbnail_path) return community.avatar_url;
  const {data}=supabase.storage
    .from("community-icon-thumbs")
    .getPublicUrl(community.avatar_thumbnail_path);
  const version=community.avatar_last_changed_at
    ?"?v="+encodeURIComponent(community.avatar_last_changed_at)
    :"";
  return data.publicUrl+version;
}

export function CommunityIcon({
  supabase,
  community,
  className="",
  imageClassName="",
  fallbackClassName="",
  fallback="🍀",
  loading="lazy",
  alt="",
}:Props){
  const initialStage=community.avatar_thumbnail_path
    ?"thumbnail"
    :community.avatar_url
      ?"original"
      :"fallback";
  const [stage,setStage]=useState<"thumbnail"|"original"|"fallback">(initialStage);

  useEffect(()=>{
    setStage(
      community.avatar_thumbnail_path
        ?"thumbnail"
        :community.avatar_url
          ?"original"
          :"fallback"
    );
  },[
    community.avatar_thumbnail_path,
    community.avatar_url,
    community.avatar_last_changed_at,
  ]);

  const src=useMemo(()=>{
    if(stage==="fallback") return null;
    if(stage==="original") return community.avatar_url;
    return communityIconPublicUrl(supabase,community);
  },[community,stage,supabase]);

  return <div className={"relative overflow-hidden "+className}>
    <span className={"absolute inset-0 grid place-items-center "+fallbackClassName}>{fallback}</span>
    {src?<img
      src={src}
      alt={alt}
      loading={loading}
      decoding="async"
      className={"absolute inset-0 h-full w-full object-cover "+imageClassName}
      onError={()=>{
        if(stage==="thumbnail"&&community.avatar_url){
          setStage("original");
          return;
        }
        setStage("fallback");
      }}
    />:null}
  </div>;
}
