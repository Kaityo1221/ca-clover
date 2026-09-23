"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuthProfile } from "@/lib/use-auth-profile";
import { PREFECTURE_ORDER, prefectureEnglishLabel } from "@/lib/prefecture-order";
import { CommunityIcon } from "@/components/community-icon";
import { StampMedal3D } from "@/components/stamp-medal-3d";

type CommunityRow = {
  id: string;
  name: string;
  prefecture: string | null;
  avatar_url: string | null;
  avatar_thumbnail_path: string | null;
  avatar_last_changed_at: string | null;
};

type CommunityCaLink = {
  community_id: string;
  ca_member_id: string;
};

type CaRow = {
  id: string;
  trainer_name: string;
  ca_level: "1st" | "2nd" | null;
};

type StampCollectionRow = {
  id: string;
  stamp_ca_member_id: string;
  community_id: string;
  role_at_acquisition: "1st" | "2nd" | null;
  first_acquired_at: string;
  first_location: string | null;
  first_event_name: string | null;
  acquisition_source: "normal" | "event" | "bulk" | "admin" | "import";
  acquisition_icon_version_id: string | null;
  acquisition_message: string | null;
  acquisition_message_seen_at: string | null;
};

type StampReunionRow = {
  id: string;
  collection_id: string;
  met_at: string;
  local_date: string | null;
  timezone: string | null;
  location: string | null;
  event_name: string | null;
  reunion_source: "normal" | "event" | "bulk" | "admin" | "import";
};

type StampDesignLinkRow = {
  collection_id: string;
  icon_version_id: string;
  grant_source: "acquisition" | "acquisition_backfill" | "auto_new_design" | "admin" | "import";
  granted_at: string;
};

type StampPreferenceRow = {
  collection_id: string;
  icon_version_id: string;
  updated_at: string;
};

type IconVersionRow = {
  id: string;
  community_id: string;
  content_hash: string;
  source_avatar_url: string | null;
  archive_path: string | null;
  thumbnail_path: string | null;
  first_seen_at: string;
  last_seen_at: string;
  is_current: boolean;
};

type StampCommunity = CommunityRow & {
  cas: Array<CaRow & {
    acquired: boolean;
    collection: StampCollectionRow | null;
    designs: IconVersionRow[];
  }>;
};

type StampCatalogRow = {
  community_id: string;
  community_name: string;
  prefecture: string | null;
  avatar_url: string | null;
  avatar_thumbnail_path: string | null;
  avatar_last_changed_at: string | null;
  ca_member_id: string | null;
  trainer_name: string | null;
  ca_level: "1st" | "2nd" | null;
};

const SUZUKI_HEARTBEAT_MP3 = "https://upload.wikimedia.org/wikipedia/commons/transcoded/7/72/HROgg.ogg/HROgg.ogg.mp3";
const SUZUKI_HEARTBEAT_OGG = "https://upload.wikimedia.org/wikipedia/commons/7/72/HROgg.ogg";
const SUZUKI_INTRO_MS = 4300;

const REGION_GROUPS = [
  { name: "北海道・東北", prefectures: ["北海道","青森県","岩手県","宮城県","秋田県","山形県","福島県"] },
  { name: "関東", prefectures: ["茨城県","栃木県","群馬県","埼玉県","千葉県","東京都","神奈川県"] },
  { name: "中部", prefectures: ["新潟県","富山県","石川県","福井県","山梨県","長野県","岐阜県","静岡県","愛知県"] },
  { name: "近畿", prefectures: ["三重県","滋賀県","京都府","大阪府","兵庫県","奈良県","和歌山県"] },
  { name: "中国", prefectures: ["鳥取県","島根県","岡山県","広島県","山口県"] },
  { name: "四国", prefectures: ["徳島県","香川県","愛媛県","高知県"] },
  { name: "九州・沖縄", prefectures: ["福岡県","佐賀県","長崎県","熊本県","大分県","宮崎県","鹿児島県","沖縄県"] },
] as const;

function formatEngravingDate(value:string){
  const date=new Date(value);
  if(Number.isNaN(date.getTime())) return "";
  const parts=new Intl.DateTimeFormat("en-CA",{
    timeZone:"Asia/Tokyo",
    year:"numeric",
    month:"2-digit",
    day:"2-digit",
  }).formatToParts(date);
  const map=Object.fromEntries(parts.map(part=>[part.type,part.value]));
  return [map.year,map.month,map.day].filter(Boolean).join(".");
}

export default function Page() {
  const { supabase, user, profile, permissions, loading } = useAuthProfile();
  const canAccessStamp = profile?.role === "admin" || permissions.includes("S");
  const [communities, setCommunities] = useState<CommunityRow[]>([]);
  const [links, setLinks] = useState<CommunityCaLink[]>([]);
  const [cas, setCas] = useState<CaRow[]>([]);
  const [collections, setCollections] = useState<StampCollectionRow[]>([]);
  const [reunions, setReunions] = useState<StampReunionRow[]>([]);
  const [designLinks, setDesignLinks] = useState<StampDesignLinkRow[]>([]);
  const [designVersions, setDesignVersions] = useState<IconVersionRow[]>([]);
  const [preferences, setPreferences] = useState<StampPreferenceRow[]>([]);
  const [openRegions, setOpenRegions] = useState<Set<string>>(new Set());
  const [openPrefectures, setOpenPrefectures] = useState<Set<string>>(new Set());
  const [dataLoading, setDataLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCommunity, setSelectedCommunity] = useState<StampCommunity | null>(null);
  const [selectedCaId, setSelectedCaId] = useState<string | null>(null);
  const [selectedDesignId, setSelectedDesignId] = useState<string | null>(null);
  const [preferenceBusy, setPreferenceBusy] = useState(false);
  const [stampMessagePopup, setStampMessagePopup] = useState<{collectionId:string;message:string}|null>(null);
  const [suzukiIntroActive,setSuzukiIntroActive]=useState(false);
  const shownMessageCollections = useRef<Set<string>>(new Set());
  const suzukiHeartbeatRef=useRef<HTMLAudioElement|null>(null);
  const suzukiIntroTimerRef=useRef<number|null>(null);

  useEffect(() => {
    if (loading || !user || !canAccessStamp) return;
    let alive = true;

    void (async () => {
      setDataLoading(true);
      setError(null);

      const [catalogResult, collectionResult] = await Promise.all([
        supabase.rpc("stamp_rally_catalog"),
        supabase
          .from("stamp_collections")
          .select("id,stamp_ca_member_id,community_id,role_at_acquisition,first_acquired_at,first_location,first_event_name,acquisition_source,acquisition_icon_version_id,acquisition_message,acquisition_message_seen_at")
          .eq("owner_user_id", user.id),
      ]);

      if (!alive) return;
      const firstError=catalogResult.error??collectionResult.error;
      if(firstError){
        setError(firstError.message);
        setDataLoading(false);
        return;
      }

      const rows=(catalogResult.data as StampCatalogRow[]|null)??[];
      const collectionRows=(collectionResult.data as StampCollectionRow[]|null)??[];
      const communityMap=new Map<string,CommunityRow>();
      const caMap=new Map<string,CaRow>();
      const linkRows:CommunityCaLink[]=[];

      for(const row of rows){
        communityMap.set(row.community_id,{
          id:row.community_id,
          name:row.community_name,
          prefecture:row.prefecture,
          avatar_url:row.avatar_url,
          avatar_thumbnail_path:row.avatar_thumbnail_path,
          avatar_last_changed_at:row.avatar_last_changed_at,
        });
        if(row.ca_member_id&&row.trainer_name){
          caMap.set(row.ca_member_id,{
            id:row.ca_member_id,
            trainer_name:row.trainer_name,
            ca_level:row.ca_level,
          });
          linkRows.push({
            community_id:row.community_id,
            ca_member_id:row.ca_member_id,
          });
        }
      }

      let reunionRows:StampReunionRow[]=[];
      let designRows:StampDesignLinkRow[]=[];
      let preferenceRows:StampPreferenceRow[]=[];
      let versionRows:IconVersionRow[]=[];

      const collectionIds=collectionRows.map(row=>row.id);
      if(collectionIds.length){
        const [reunionResult,designResult,preferenceResult]=await Promise.all([
          supabase
            .from("stamp_reunions")
            .select("id,collection_id,met_at,local_date,timezone,location,event_name,reunion_source")
            .in("collection_id",collectionIds)
            .order("met_at",{ascending:false}),
          supabase
            .from("stamp_collection_designs")
            .select("collection_id,icon_version_id,grant_source,granted_at")
            .in("collection_id",collectionIds),
          supabase
            .from("stamp_collection_preferences")
            .select("collection_id,icon_version_id,updated_at")
            .in("collection_id",collectionIds),
        ]);

        if(!alive) return;
        const designError=reunionResult.error??designResult.error??preferenceResult.error;
        if(designError){
          setError(designError.message);
          setDataLoading(false);
          return;
        }

        reunionRows=(reunionResult.data as StampReunionRow[]|null)??[];
        designRows=(designResult.data as StampDesignLinkRow[]|null)??[];
        preferenceRows=(preferenceResult.data as StampPreferenceRow[]|null)??[];

        const versionIds=[...new Set(designRows.map(row=>row.icon_version_id))];
        if(versionIds.length){
          const versionResult=await supabase
            .from("community_icon_versions")
            .select("id,community_id,content_hash,source_avatar_url,archive_path,thumbnail_path,first_seen_at,last_seen_at,is_current")
            .in("id",versionIds);
          if(!alive) return;
          if(versionResult.error){
            setError(versionResult.error.message);
            setDataLoading(false);
            return;
          }
          versionRows=(versionResult.data as IconVersionRow[]|null)??[];
        }
      }

      setCommunities([...communityMap.values()]);
      setCas([...caMap.values()]);
      setLinks(linkRows);
      setCollections(collectionRows);
      setReunions(reunionRows);
      setDesignLinks(designRows);
      setPreferences(preferenceRows);
      setDesignVersions(versionRows);
      setDataLoading(false);
    })();

    return () => {
      alive = false;
    };
  }, [canAccessStamp, loading, supabase, user]);

  useEffect(() => {
    if(!stampMessagePopup) return;
    const timer=window.setTimeout(()=>setStampMessagePopup(null),2800);
    return()=>window.clearTimeout(timer);
  }, [stampMessagePopup?.collectionId, stampMessagePopup?.message]);


  useEffect(()=>()=>{
    if(suzukiIntroTimerRef.current!==null){
      window.clearTimeout(suzukiIntroTimerRef.current);
    }
    const audio=suzukiHeartbeatRef.current;
    if(audio){
      audio.pause();
      audio.currentTime=0;
    }
  },[]);

  const stampCommunities = useMemo<StampCommunity[]>(() => {
    const caById = new Map(cas.map((ca) => [ca.id, ca]));
    const versionById = new Map(designVersions.map((version) => [version.id, version]));
    const designIdsByCollection = new Map<string,string[]>();

    for(const design of designLinks){
      const list=designIdsByCollection.get(design.collection_id)??[];
      list.push(design.icon_version_id);
      designIdsByCollection.set(design.collection_id,list);
    }

    const collectionByCaAndCommunity = new Map(
      collections.map((collection) => [
        collection.stamp_ca_member_id + ":" + collection.community_id,
        collection,
      ])
    );
    const caIdsByCommunity = new Map<string, string[]>();

    for (const link of links) {
      const list = caIdsByCommunity.get(link.community_id) ?? [];
      list.push(link.ca_member_id);
      caIdsByCommunity.set(link.community_id, list);
    }

    return [...communities]
      .sort((a, b) => {
        const aIndex = PREFECTURE_ORDER.indexOf((a.prefecture ?? "") as (typeof PREFECTURE_ORDER)[number]);
        const bIndex = PREFECTURE_ORDER.indexOf((b.prefecture ?? "") as (typeof PREFECTURE_ORDER)[number]);
        const normalizedA = aIndex === -1 ? 999 : aIndex;
        const normalizedB = bIndex === -1 ? 999 : bIndex;
        if (normalizedA !== normalizedB) return normalizedA - normalizedB;
        return a.name.localeCompare(b.name, "ja");
      })
      .map((community) => ({
        ...community,
        cas: (caIdsByCommunity.get(community.id) ?? [])
          .map((caId) => caById.get(caId))
          .filter((ca): ca is CaRow => Boolean(ca))
          .sort((a, b) => {
            if (a.ca_level === b.ca_level) return a.trainer_name.localeCompare(b.trainer_name, "ja");
            if (a.ca_level === "1st") return -1;
            if (b.ca_level === "1st") return 1;
            return a.trainer_name.localeCompare(b.trainer_name, "ja");
          })
          .map((ca) => {
            const collection=collectionByCaAndCommunity.get(ca.id+":"+community.id)??null;
            const designs=collection
              ?(designIdsByCollection.get(collection.id)??[])
                .map(id=>versionById.get(id))
                .filter((version):version is IconVersionRow=>Boolean(version))
                .sort((a,b)=>new Date(a.first_seen_at).getTime()-new Date(b.first_seen_at).getTime())
              :[];
            return {
              ...ca,
              acquired:Boolean(collection),
              collection,
              designs,
            };
          }),
      }));
  }, [cas, collections, communities, designLinks, designVersions, links]);

  const preferenceByCollection=useMemo(
    ()=>new Map(preferences.map(preference=>[preference.collection_id,preference.icon_version_id])),
    [preferences],
  );

  const reunionsByCollection=useMemo(()=>{
    const map=new Map<string,StampReunionRow[]>();
    for(const reunion of reunions){
      const list=map.get(reunion.collection_id)??[];
      list.push(reunion);
      map.set(reunion.collection_id,list);
    }
    for(const list of map.values()){
      list.sort((a,b)=>new Date(b.met_at).getTime()-new Date(a.met_at).getTime());
    }
    return map;
  },[reunions]);

  function formatReunionDate(reunion:StampReunionRow){
    if(reunion.local_date){
      const [year,month,day]=reunion.local_date.split("-").map(Number);
      if(year&&month&&day) return year+"/"+month+"/"+day;
    }
    return new Date(reunion.met_at).toLocaleDateString("ja-JP",{
      timeZone:reunion.timezone??"Asia/Tokyo",
    });
  }

  function newestDesign(ca:StampCommunity["cas"][number]){
    if(!ca.designs.length) return null;
    const current=ca.designs.find(design=>design.is_current);
    return current??ca.designs[ca.designs.length-1]??null;
  }

  function displayDesign(ca:StampCommunity["cas"][number]){
    if(!ca.collection) return null;
    const preferredId=preferenceByCollection.get(ca.collection.id);
    return ca.designs.find(design=>design.id===preferredId)??newestDesign(ca);
  }

  function designUrl(design:IconVersionRow|null){
    if(!design) return null;
    if(design.thumbnail_path){
      return supabase.storage.from("community-icon-thumbs").getPublicUrl(design.thumbnail_path).data.publicUrl;
    }
    if(design.archive_path){
      return supabase.storage.from("community-icon-archive").getPublicUrl(design.archive_path).data.publicUrl;
    }
    return design.source_avatar_url;
  }

  function isSuzukiSpecial(ca:StampCommunity["cas"][number]|null){
    return ca?.trainer_name?.trim().toLowerCase()==="suzukipm";
  }

  function startSuzukiIntro(ca:StampCommunity["cas"][number]|null){
    if(!isSuzukiSpecial(ca)) return;

    if(suzukiIntroTimerRef.current!==null){
      window.clearTimeout(suzukiIntroTimerRef.current);
    }

    const audio=suzukiHeartbeatRef.current;
    if(audio){
      try{
        audio.pause();
        audio.currentTime=0;
        audio.volume=0.72;
        void audio.play().catch(()=>{});
      }catch{
        // The visual ritual still runs if the browser blocks audio.
      }
    }

    setSuzukiIntroActive(false);
    window.requestAnimationFrame(()=>{
      setSuzukiIntroActive(true);
      suzukiIntroTimerRef.current=window.setTimeout(()=>{
        setSuzukiIntroActive(false);
        suzukiIntroTimerRef.current=null;
        const currentAudio=suzukiHeartbeatRef.current;
        if(currentAudio){
          currentAudio.pause();
          currentAudio.currentTime=0;
        }
      },SUZUKI_INTRO_MS);
    });
  }

  function showAcquisitionMessage(ca:StampCommunity["cas"][number]|null){
    const collection=ca?.collection;
    const message=collection?.acquisition_message?.trim()??"";
    if(!collection||!message||collection.acquisition_message_seen_at) return;
    if(shownMessageCollections.current.has(collection.id)) return;

    shownMessageCollections.current.add(collection.id);
    setStampMessagePopup({collectionId:collection.id,message});

    void (supabase as any)
      .rpc("stamp_collection_mark_message_seen",{p_collection_id:collection.id})
      .then(({data,error}:{data:string|null;error:{message:string}|null})=>{
        if(error) return;
        const seenAt=String(data??new Date().toISOString());
        setCollections(current=>current.map(row=>
          row.id===collection.id?{...row,acquisition_message_seen_at:seenAt}:row
        ));
      });
  }

  function openCommunity(community:StampCommunity){
    const firstCa=community.cas.find(ca=>ca.acquired)??community.cas[0]??null;
    const firstDesign=firstCa?displayDesign(firstCa):null;
    setSelectedCommunity(community);
    setSelectedCaId(firstCa?.id??null);
    setSelectedDesignId(firstDesign?.id??null);
    showAcquisitionMessage(firstCa);
    startSuzukiIntro(firstCa);
  }

  function selectCa(ca:StampCommunity["cas"][number]){
    setSelectedCaId(ca.id);
    setSelectedDesignId(displayDesign(ca)?.id??null);
    showAcquisitionMessage(ca);
    startSuzukiIntro(ca);
  }

  async function togglePinnedDesign(ca:StampCommunity["cas"][number],design:IconVersionRow){
    if(!ca.collection||preferenceBusy) return;
    setPreferenceBusy(true);
    setError(null);
    const pinnedId=preferenceByCollection.get(ca.collection.id)??null;

    if(pinnedId===design.id){
      const {error}=await (supabase as any)
        .from("stamp_collection_preferences")
        .delete()
        .eq("collection_id",ca.collection.id);
      if(error){
        setError(error.message);
      }else{
        setPreferences(current=>current.filter(row=>row.collection_id!==ca.collection!.id));
        setSelectedDesignId(newestDesign(ca)?.id??null);
      }
    }else{
      const now=new Date().toISOString();
      const {error}=await (supabase as any)
        .from("stamp_collection_preferences")
        .upsert({
          collection_id:ca.collection.id,
          icon_version_id:design.id,
          updated_at:now,
        },{onConflict:"collection_id"});
      if(error){
        setError(error.message);
      }else{
        setPreferences(current=>[
          ...current.filter(row=>row.collection_id!==ca.collection!.id),
          {collection_id:ca.collection!.id,icon_version_id:design.id,updated_at:now},
        ]);
      }
    }
    setPreferenceBusy(false);
  }


  const totalProgress = useMemo(() => {
    const all = stampCommunities.flatMap((community) => community.cas);
    return {
      acquired: all.filter((ca) => ca.acquired).length,
      total: all.length,
    };
  }, [stampCommunities]);

  const byPrefecture = useMemo(() => {
    const map = new Map<string, StampCommunity[]>();
    for (const community of stampCommunities) {
      const prefecture = community.prefecture ?? "都道府県未設定";
      const rows = map.get(prefecture) ?? [];
      rows.push(community);
      map.set(prefecture, rows);
    }
    return map;
  }, [stampCommunities]);

  function toggleRegion(region: string) {
    setOpenRegions((current) => {
      const next = new Set(current);
      if (next.has(region)) next.delete(region);
      else next.add(region);
      return next;
    });
  }

  function togglePrefecture(prefecture: string) {
    setOpenPrefectures((current) => {
      const next = new Set(current);
      if (next.has(prefecture)) next.delete(prefecture);
      else next.add(prefecture);
      return next;
    });
  }

  if (loading) {
    return <main className="grid min-h-[70vh] place-items-center text-sm font-black text-lime-800">🍀 読み込み中...</main>;
  }

  if (!user || !canAccessStamp) {
    return <main className="grid min-h-[70vh] place-items-center px-4 text-center">
      <div>
        <div className="text-5xl">🔒</div>
        <h1 className="mt-3 text-2xl font-black text-lime-950">Stamp Rally LAB</h1>
        <p className="mt-2 text-sm font-semibold text-slate-500">このページにはS権限が必要です。</p>
      </div>
    </main>;
  }

  return <main className="min-h-screen bg-[#fff8ef]">
    <audio ref={suzukiHeartbeatRef} preload="auto" className="hidden" aria-hidden="true">
      <source src={SUZUKI_HEARTBEAT_MP3} type="audio/mpeg" />
      <source src={SUZUKI_HEARTBEAT_OGG} type="audio/ogg" />
    </audio>

    {suzukiIntroActive ? <>
      <style>{`
        @keyframes suzukiRitualFade{
          0%{opacity:0}
          8%{opacity:1}
          86%{opacity:1}
          100%{opacity:0}
        }
        @keyframes suzukiHeartPulse{
          0%,100%{transform:scale(1);filter:brightness(.78)}
          7%{transform:scale(1.045);filter:brightness(1.55)}
          17%{transform:scale(.985);filter:brightness(.92)}
          28%{transform:scale(1.028);filter:brightness(1.28)}
          42%{transform:scale(1);filter:brightness(.82)}
        }
        @keyframes suzukiRuneWake{
          0%,20%{opacity:.12;text-shadow:0 0 0 transparent}
          42%{opacity:.72;text-shadow:0 0 10px rgba(173,38,20,.72)}
          65%,100%{opacity:.38;text-shadow:0 0 5px rgba(135,28,17,.45)}
        }
        @keyframes suzukiLineOne{
          0%,18%{opacity:0;transform:translateY(8px)}
          30%,100%{opacity:1;transform:translateY(0)}
        }
        @keyframes suzukiLineTwo{
          0%,42%{opacity:0;transform:translateY(8px)}
          56%,100%{opacity:1;transform:translateY(0)}
        }
        @keyframes suzukiAsh{
          0%{transform:translate3d(0,-8px,0) rotate(0deg);opacity:0}
          20%{opacity:.55}
          100%{transform:translate3d(var(--ash-x),110vh,0) rotate(220deg);opacity:0}
        }
      `}</style>
      <div
        className="fixed inset-0 z-[120] overflow-hidden bg-black"
        style={{animation:`suzukiRitualFade ${SUZUKI_INTRO_MS}ms ease both`}}
        aria-live="assertive"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(75,10,8,.20),transparent_42%)]" />

        {Array.from({length:16},(_,index)=><span
          key={index}
          className="absolute left-1/2 top-1/2 size-1 rounded-full bg-[#6e2018]"
          style={{
            ["--ash-x" as string]:`${((index%5)-2)*18}px`,
            marginLeft:`${(index*37)%260-130}px`,
            animation:`suzukiAsh ${2400+(index%4)*360}ms linear ${index*90}ms infinite`,
            opacity:.25,
          }}
        />)}

        <div className="absolute inset-0 grid place-items-center px-6">
          <div className="relative flex w-full max-w-sm flex-col items-center text-center">
            <div
              className="relative grid size-[248px] place-items-center"
              style={{animation:"suzukiHeartPulse .86s ease-out .12s 4"}}
            >
              <div className="absolute inset-[16px] rounded-full border border-[#632018]/55 shadow-[0_0_48px_rgba(110,28,18,.20),inset_0_0_38px_rgba(80,18,14,.16)]" />
              <div className="absolute inset-[34px] rotate-45 rounded-[28%] border border-[#4c1713]/45" />
              <div className="absolute inset-[55px] -rotate-12 rounded-full border border-[#7b241a]/35" />
              <svg viewBox="0 0 200 200" className="absolute inset-[52px] h-[144px] w-[144px] opacity-55" aria-hidden="true">
                <path d="M100 17 L126 72 L183 78 L140 118 L152 177 L100 148 L48 177 L60 118 L17 78 L74 72 Z" fill="none" stroke="#6d2018" strokeWidth="2.3"/>
                <circle cx="100" cy="100" r="45" fill="none" stroke="#8c2b1e" strokeWidth="1.4"/>
                <path d="M67 132 C72 96 85 63 100 49 C116 64 128 98 133 132" fill="none" stroke="#7a261c" strokeWidth="2"/>
              </svg>

              {["ᚱ","ᚨ","ᚷ","ᛟ","ᚾ","ᚺ","ᛖ","ᚨ","ᚱ","ᛏ","ᛒ","ᚱ"].map((rune,index)=>{
                const angle=(index/12)*Math.PI*2-Math.PI/2;
                const radius=104;
                return <span
                  key={index}
                  className="absolute text-[15px] font-black text-[#8d2d21]"
                  style={{
                    left:`calc(50% + ${Math.cos(angle)*radius}px)`,
                    top:`calc(50% + ${Math.sin(angle)*radius}px)`,
                    transform:`translate(-50%,-50%) rotate(${angle+Math.PI/2}rad)`,
                    animation:`suzukiRuneWake 2.2s ease ${index*70}ms both`,
                  }}
                >{rune}</span>;
              })}
            </div>

            <div
              className="-mt-3 text-[19px] font-semibold tracking-[.08em] text-[#c4a8a0]"
              style={{animation:"suzukiLineOne 4.3s ease both",textShadow:"0 0 18px rgba(120,28,18,.35)"}}
            >
              覚者よ、よくきた。
            </div>
            <div
              className="mt-5 max-w-[320px] text-[14px] font-medium leading-7 tracking-[.06em] text-[#a9857d]"
              style={{animation:"suzukiLineTwo 4.3s ease both",textShadow:"0 0 16px rgba(110,24,17,.28)"}}
            >
              お前の心臓と引き換えに、<br />
              この紋章を授けよう。
            </div>
          </div>
        </div>
      </div>
    </> : null}
    <div className="mx-auto max-w-5xl px-3 py-6 sm:px-6 md:py-9">
      <div className="flex items-center justify-between gap-3">
        <Link
          href={profile?.role==="admin"?"/admin":"/"}
          className="text-sm font-black text-[#4f7d3b]"
        >
          {profile?.role==="admin"?"← 管理メニュー":"← CA Clover Home"}
        </Link>
        <span className="rounded-full border border-[#89a97b] bg-white px-3 py-1 text-[10px] font-black tracking-[0.18em] text-[#4f7d3b]">UI LAB</span>
      </div>

      <section className="mt-5 overflow-hidden rounded-[30px] border border-[#efd7bd] bg-gradient-to-br from-[#f6c58f] via-[#f7d7ae] to-[#fff0dc] p-5 shadow-[0_18px_45px_rgba(154,97,42,.12)] sm:p-7">
        <div className="flex items-start gap-4">
          <div className="grid size-14 shrink-0 place-items-center rounded-[20px] bg-white/80 text-3xl shadow-sm">🍀</div>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-black tracking-[0.16em] text-[#6a8d59]">CA CLOVER STAMP RALLY</div>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-[#3d3a36] sm:text-3xl">全国スタンプ一覧</h1>
            <p className="mt-2 text-xs font-bold leading-5 text-[#6f6257]">地方を開いて、都道府県ごとのCommunityメダルを眺めるスタンプシート。</p>
          </div>
        </div>

        <div className="mt-5 flex items-end justify-between gap-4 rounded-[22px] bg-white/70 px-4 py-3 backdrop-blur-sm">
          <div>
            <div className="text-[10px] font-black text-[#7d736b]">出会ったCA</div>
            <div className="mt-0.5 text-2xl font-black text-[#3d3a36]">{totalProgress.acquired} <span className="text-sm text-[#8f857d]">/ {totalProgress.total}</span></div>
          </div>
          <div className="max-w-[180px] text-right text-[10px] font-bold leading-4 text-[#8a6d51]">実際に交換して取得したスタンプだけを表示しています</div>
        </div>
      </section>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Link
          href="/lab/stamp-rally/events"
          className="flex items-center justify-between rounded-[22px] border border-[#e1c9aa] bg-[#fffaf1] px-5 py-4 shadow-[0_8px_22px_rgba(92,69,45,.06)]"
        >
          <div>
            <div className="text-sm font-black text-[#7a5c35]">🎪 イベントモード</div>
            <div className="mt-0.5 text-[10px] font-bold text-[#938478]">参加イベントと日替わりミッション</div>
          </div>
          <span className="text-xl font-black text-[#9a7444]">→</span>
        </Link>
        <Link
          href="/lab/stamp-rally/exchange"
          className="flex items-center justify-between rounded-[22px] border border-[#d9c4ad] bg-white px-5 py-4 shadow-[0_8px_22px_rgba(92,69,45,.06)]"
        >
          <div>
            <div className="text-sm font-black text-[#45663a]">🤝 スタンプ交換</div>
            <div className="mt-0.5 text-[10px] font-bold text-[#938478]">QRで1対1交換する</div>
          </div>
          <span className="text-xl font-black text-[#6a8d59]">→</span>
        </Link>
      </div>

      {error ? <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">{error}</div> : null}

      <section className="mt-5 space-y-3">
        {dataLoading ? <div className="rounded-[24px] border border-[#ead9c7] bg-white p-7 text-center text-sm font-black text-[#6a8d59]">スタンプシートを準備中... 🍀</div> : null}

        {!dataLoading && REGION_GROUPS.map((region) => {
          const regionOpen = openRegions.has(region.name);
          const regionCommunityCount = region.prefectures.reduce((sum, prefecture) => sum + (byPrefecture.get(prefecture)?.length ?? 0), 0);

          return <div key={region.name} className="overflow-hidden rounded-[26px] border border-[#ead6c2] bg-[#fffdf9] shadow-[0_10px_28px_rgba(92,69,45,.06)]">
            <button
              type="button"
              onClick={() => toggleRegion(region.name)}
              aria-expanded={regionOpen}
              className="flex w-full items-center gap-3 px-4 py-4 text-left sm:px-5"
            >
              <span className="grid size-10 place-items-center rounded-2xl bg-[#eef5e8] text-lg">🍀</span>
              <div className="min-w-0 flex-1">
                <div className="font-black text-[#3d3a36]">{region.name}</div>
                <div className="mt-0.5 text-[10px] font-bold text-[#9a8b7f]">{regionCommunityCount} Community</div>
              </div>
              <span className={"text-xl font-black text-[#6f8f5f] transition-transform " + (regionOpen ? "rotate-180" : "")}>⌄</span>
            </button>

            {regionOpen ? <div className="border-t border-[#f1e3d5] bg-[#fffaf4] p-2 sm:p-3">
              <div className="space-y-2">
                {region.prefectures.map((prefecture) => {
                  const rows = byPrefecture.get(prefecture) ?? [];
                  const prefectureOpen = openPrefectures.has(prefecture);
                  const prefectureCas = rows.flatMap((community) => community.cas);
                  const acquiredCount = prefectureCas.filter((ca) => ca.acquired).length;

                  return <div key={prefecture} className="overflow-hidden rounded-[22px] border border-[#eadfd4] bg-white">
                    <button
                      type="button"
                      onClick={() => togglePrefecture(prefecture)}
                      aria-expanded={prefectureOpen}
                      className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-black text-[#47413c]">{prefecture}</div>
                        <div className="mt-0.5 text-[10px] font-bold text-[#a39589]">{rows.length} Community</div>
                      </div>
                      <span className="rounded-full bg-[#eef5e8] px-2.5 py-1 text-xs font-black text-[#587847]">取得 {acquiredCount} / {prefectureCas.length}</span>
                      <span className={"text-lg font-black text-[#8b9e80] transition-transform " + (prefectureOpen ? "rotate-180" : "")}>⌄</span>
                    </button>

                    {prefectureOpen ? <div className="border-t border-[#f3e9df] bg-[#fffdf9] px-3 py-4">
                      {rows.length ? <div className="grid grid-cols-3 gap-x-2 gap-y-5 sm:grid-cols-4 sm:gap-x-4 lg:grid-cols-5">
                        {rows.map((community) => {
                          const acquiredCountForCommunity = community.cas.filter((ca) => ca.acquired).length;
                          const anyAcquired = acquiredCountForCommunity > 0;
                          const allAcquired = community.cas.length > 0 && acquiredCountForCommunity === community.cas.length;

                          return <button
                            key={community.id}
                            type="button"
                            onClick={() => openCommunity(community)}
                            className="group min-w-0 text-center"
                          >
                            <div className={"relative mx-auto grid size-[78px] place-items-center rounded-full p-[5px] transition-transform group-hover:-translate-y-1 sm:size-[96px] " + (
                              anyAcquired
                                ? "bg-gradient-to-br from-[#f9e8c7] via-white to-[#efd0a4] shadow-[0_8px_18px_rgba(115,78,38,.18)]"
                                : "border-2 border-dashed border-[#cfc9c3] bg-[#f2f0ed]"
                            )}>
                              {(() => {
                                const coverCa=community.cas.find(ca=>ca.acquired)??null;
                                const coverDesign=coverCa?displayDesign(coverCa):null;
                                const coverSrc=designUrl(coverDesign);
                                return <div className={"relative h-full w-full overflow-hidden rounded-full bg-[#eef2e9] "+(!anyAcquired?"grayscale opacity-35":"")}>
                                  <CommunityIcon
                                    supabase={supabase}
                                    community={community}
                                    className="absolute inset-0 h-full w-full rounded-full bg-[#eef2e9]"
                                    fallbackClassName="text-3xl text-[#9caf90]"
                                  />
                                  {coverSrc?<img
                                    src={coverSrc}
                                    alt=""
                                    loading="lazy"
                                    className="absolute inset-0 h-full w-full object-cover"
                                    onError={event=>{event.currentTarget.style.display="none";}}
                                  />:null}
                                </div>;
                              })()}
                              {allAcquired ? <span className="absolute -right-1 -top-1 grid size-6 place-items-center rounded-full border-2 border-white bg-[#6e9959] text-[10px] text-white">✓</span> : null}
                            </div>

                            <div className="mt-2 line-clamp-2 min-h-8 text-[11px] font-black leading-4 text-[#49413a] sm:text-xs">{community.name}</div>

                            {community.cas.length ? <div className="mt-1.5 space-y-1">
                              {community.cas.slice(0, 2).map((ca) => <div
                                key={ca.id}
                                className={"mx-auto max-w-full truncate rounded-full px-1.5 py-0.5 text-[9px] font-black " + (
                                  ca.acquired
                                    ? "bg-[#eaf4e4] text-[#567848]"
                                    : "border border-dashed border-[#d5d0ca] bg-[#f7f5f2] text-[#aaa39d]"
                                )}
                              >
                                {ca.acquired ? "● " : "○ "}{ca.trainer_name}
                              </div>)}
                              {community.cas.length > 2 ? <div className="text-[9px] font-black text-[#aaa39d]">+{community.cas.length - 2}</div> : null}
                            </div> : <div className="mt-1.5 text-[9px] font-bold text-[#b2aaa3]">CA未設定</div>}
                          </button>;
                        })}
                      </div> : <div className="py-5 text-center text-xs font-bold text-[#a79b90]">Communityはありません</div>}
                    </div> : null}
                  </div>;
                })}
              </div>
            </div> : null}
          </div>;
        })}
      </section>

      {selectedCommunity ? (() => {
        const selectedCa=selectedCommunity.cas.find(ca=>ca.id===selectedCaId)
          ??selectedCommunity.cas.find(ca=>ca.acquired)
          ??selectedCommunity.cas[0]
          ??null;
        const selectedDesign=selectedCa?.designs.find(design=>design.id===selectedDesignId)
          ??(selectedCa?displayDesign(selectedCa):null);
        const selectedDesignIndex=selectedCa&&selectedDesign
          ?selectedCa.designs.findIndex(design=>design.id===selectedDesign.id)
          :-1;
        const selectedDesignSrc=designUrl(selectedDesign);
        const pinnedId=selectedCa?.collection
          ?preferenceByCollection.get(selectedCa.collection.id)??null
          :null;
        const isAcquisitionDesign=Boolean(
          selectedCa?.collection
          && selectedDesign
          && selectedCa.collection.acquisition_icon_version_id===selectedDesign.id
        );
        const selectedReunions=selectedCa?.collection
          ?reunionsByCollection.get(selectedCa.collection.id)??[]
          :[];
        const engravingLines=selectedCa?.collection
          ?[
              selectedCa.trainer_name,
              selectedCa.ca_level??selectedCa.collection.role_at_acquisition??"CA",
              prefectureEnglishLabel(selectedCommunity.prefecture),
              formatEngravingDate(selectedCa.collection.first_acquired_at),
            ]
          :null;

        return <div
          className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-slate-950/55 p-5 backdrop-blur-sm [-webkit-overflow-scrolling:touch]"
          onClick={() => setSelectedCommunity(null)}
        >
          <div className="mx-auto flex min-h-full max-w-sm items-start justify-center py-4">
            <section
              className="w-full rounded-[30px] border border-[#ead5bf] bg-[#fffaf4] p-5 text-center shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setSelectedCommunity(null)}
                className="ml-auto grid size-9 place-items-center rounded-full bg-white text-lg font-black text-[#75695f] shadow-sm"
                aria-label="閉じる"
              >×</button>

              {stampMessagePopup&&selectedCa?.collection?.id===stampMessagePopup.collectionId ? <>
                <style>{`@keyframes stampMessagePop{0%{opacity:0;transform:translateY(10px) scale(.78)}65%{opacity:1;transform:translateY(-2px) scale(1.06)}100%{opacity:1;transform:translateY(0) scale(1)}}`}</style>
                <div
                  className="mx-auto mt-1 max-w-[280px] rounded-[22px] border border-[#d8e8cf] bg-white px-5 py-3 text-sm font-black leading-6 text-[#4e7043] shadow-[0_14px_34px_rgba(75,105,62,.18)]"
                  style={{animation:"stampMessagePop .52s cubic-bezier(.2,.9,.25,1.25) both"}}
                >
                  💬 {stampMessagePopup.message}
                </div>
              </> : null}

              {selectedCa?.collection ? <div className="mx-auto mt-1 size-56">
                <StampMedal3D
                  supabase={supabase}
                  imageUrl={selectedDesignSrc}
                  fallbackImageUrl={selectedCommunity.avatar_url}
                  thumbnailPath={selectedDesign?.thumbnail_path}
                  archivePath={selectedDesign?.archive_path}
                  engravingLines={engravingLines}
                  className="h-full w-full"
                />
              </div> : <div className="mx-auto mt-1 grid size-56 place-items-center rounded-full border-2 border-dashed border-[#cfc9c3] bg-[#f2f0ed] p-2">
                <div className="grid h-full w-full place-items-center overflow-hidden rounded-full bg-[#eef2e9] grayscale opacity-35">
                  {selectedDesignSrc?<div className="relative h-full w-full overflow-hidden rounded-full bg-[#eef2e9]">
                    <span className="absolute inset-0 grid place-items-center text-6xl text-[#9caf90]">🍀</span>
                    <img
                      src={selectedDesignSrc}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover"
                      onError={event=>{event.currentTarget.style.display="none";}}
                    />
                  </div>:<CommunityIcon
                    supabase={supabase}
                    community={selectedCommunity}
                    className="h-full w-full rounded-full bg-[#eef2e9]"
                    fallbackClassName="text-6xl text-[#9caf90]"
                    loading="eager"
                  />}
                </div>
              </div>}

              <h2 className="mt-5 text-xl font-black leading-snug text-[#443c35]">{selectedCommunity.name}</h2>
              <p className="mt-1 text-xs font-bold text-[#8a7d72]">{selectedCommunity.prefecture ?? "—"}</p>

              {selectedCommunity.cas.length?<div className="mt-4 flex flex-wrap justify-center gap-2">
                {selectedCommunity.cas.map(ca=><button
                  key={ca.id}
                  type="button"
                  onClick={()=>selectCa(ca)}
                  className={"rounded-full px-3 py-2 text-[10px] font-black transition "+(
                    selectedCa?.id===ca.id
                      ?"bg-[#5f8e50] text-white shadow-sm"
                      :ca.acquired
                        ?"bg-[#eaf4e4] text-[#567848]"
                        :"border border-dashed border-[#d5d0ca] bg-white text-[#aaa39d]"
                  )}
                >
                  {ca.ca_level??"CA"} ・ {ca.trainer_name}
                </button>)}
              </div>:null}

              {selectedCa?.collection?<div className="mt-4 rounded-[22px] border border-[#e4d7ca] bg-white/75 p-4 text-left">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs font-black text-[#514941]">取得済み ・ {selectedCa.trainer_name}</div>
                  <span className="rounded-full bg-[#eef5e8] px-2 py-1 text-[9px] font-black text-[#5e7d51]">{selectedCa.ca_level??"CA"}</span>
                </div>

                <div className="mt-3 rounded-2xl border border-[#eadfce] bg-[#fffaf2] p-3">
                  <div className="text-[10px] font-black text-[#745c3f]">🍀 初回取得</div>
                  <div className="mt-1 text-[11px] font-black text-[#514941]">
                    {new Date(selectedCa.collection.first_acquired_at).toLocaleDateString("ja-JP")}
                  </div>
                  {selectedCa.collection.first_event_name?<div className="mt-1 text-[9px] font-bold text-[#8b7e73]">🎪 {selectedCa.collection.first_event_name}</div>:null}
                  {selectedCa.collection.first_location?<div className="mt-1 text-[9px] font-bold text-[#8b7e73]">📍 {selectedCa.collection.first_location}</div>:null}
                </div>

                <div className="mt-3 rounded-2xl border border-[#dce7d5] bg-[#f7fbf4] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-[10px] font-black text-[#567848]">🤝 再会</div>
                    <span className="rounded-full bg-white px-2 py-1 text-[9px] font-black text-[#567848] shadow-sm">×{selectedReunions.length}</span>
                  </div>
                  {selectedReunions.length?<div className="mt-2">
                    {selectedReunions.map((reunion,index)=><div
                      key={reunion.id}
                      className={"py-2 text-[9px] font-bold text-[#756b62] "+(index?"border-t border-[#e4ece0]":"")}
                    >
                      <div className="text-[10px] font-black text-[#514941]">{formatReunionDate(reunion)}</div>
                      {reunion.event_name?<div className="mt-1">🎪 {reunion.event_name}</div>:null}
                      {reunion.location?<div className="mt-1">📍 {reunion.location}</div>:null}
                    </div>)}
                  </div>:<div className="mt-2 text-[9px] font-bold text-[#9b948d]">まだ再会記録はありません。</div>}
                </div>

                {selectedCa.designs.length?<div className="mt-4">
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      disabled={selectedCa.designs.length<2}
                      onClick={()=>{
                        const nextIndex=(selectedDesignIndex-1+selectedCa.designs.length)%selectedCa.designs.length;
                        setSelectedDesignId(selectedCa.designs[nextIndex]?.id??null);
                      }}
                      className="grid size-9 place-items-center rounded-full bg-[#f4eee8] text-lg font-black text-[#75695f] disabled:opacity-30"
                    >‹</button>
                    <div className="text-center">
                      <div className="text-[10px] font-black text-[#6b625b]">デザイン {selectedDesignIndex+1} / {selectedCa.designs.length}</div>
                      <div className="mt-1 flex justify-center gap-1">
                        {isAcquisitionDesign?<span className="rounded-full bg-[#f4dfbd] px-2 py-0.5 text-[8px] font-black text-[#8a6536]">取得時</span>:null}
                        {selectedDesign?.is_current?<span className="rounded-full bg-[#e8f3e3] px-2 py-0.5 text-[8px] font-black text-[#567848]">最新</span>:null}
                        {pinnedId===selectedDesign?.id?<span className="rounded-full bg-[#e8eef8] px-2 py-0.5 text-[8px] font-black text-[#55709a]">📌 固定中</span>:null}
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={selectedCa.designs.length<2}
                      onClick={()=>{
                        const nextIndex=(selectedDesignIndex+1)%selectedCa.designs.length;
                        setSelectedDesignId(selectedCa.designs[nextIndex]?.id??null);
                      }}
                      className="grid size-9 place-items-center rounded-full bg-[#f4eee8] text-lg font-black text-[#75695f] disabled:opacity-30"
                    >›</button>
                  </div>

                  {selectedDesign?<button
                    type="button"
                    disabled={preferenceBusy}
                    onClick={()=>void togglePinnedDesign(selectedCa,selectedDesign)}
                    className={"mt-3 w-full rounded-xl px-3 py-2 text-[10px] font-black disabled:opacity-50 "+(
                      pinnedId===selectedDesign.id
                        ?"bg-[#e8eef8] text-[#55709a]"
                        :"border border-[#cdd8c6] bg-white text-[#567848]"
                    )}
                  >
                    {preferenceBusy
                      ?"保存中..."
                      :pinnedId===selectedDesign.id
                        ?"📌 固定を解除して最新デザインへ"
                        :"📌 このデザインを表紙に固定"}
                  </button>:null}

                  <div className="mt-2 text-center text-[9px] font-bold text-[#9a8d82]">
                    新デザインは既取得者へ自動追加され、再会回数には入りません。
                  </div>
                </div>:<div className="mt-3 text-[9px] font-bold text-[#9a8d82]">デザイン履歴を準備中です。</div>}
              </div>:selectedCa?<div className="mt-4 rounded-2xl border border-dashed border-[#ded8d2] bg-white/70 p-3 text-xs font-bold text-[#aaa29a]">
                このCAスタンプは未取得です
              </div>:null}
            </section>
          </div>
        </div>;
      })() : null}

      <div className="mt-6 rounded-[22px] border border-dashed border-[#d8c7b5] bg-white/60 p-4 text-center text-[11px] font-bold leading-5 text-[#8d7c6c]">
        🍀 取得時デザインを保存し、新デザインは既取得者へ自動追加します。お気に入りの旧デザインは表紙に固定できます。
      </div>
    </div>
  </main>;
}
