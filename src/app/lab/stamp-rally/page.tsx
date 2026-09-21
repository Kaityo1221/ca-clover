"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAuthProfile } from "@/lib/use-auth-profile";
import { PREFECTURE_ORDER } from "@/lib/prefecture-order";
import { CommunityIcon } from "@/components/community-icon";

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

const REGION_GROUPS = [
  { name: "北海道・東北", prefectures: ["北海道","青森県","岩手県","宮城県","秋田県","山形県","福島県"] },
  { name: "関東", prefectures: ["茨城県","栃木県","群馬県","埼玉県","千葉県","東京都","神奈川県"] },
  { name: "中部", prefectures: ["新潟県","富山県","石川県","福井県","山梨県","長野県","岐阜県","静岡県","愛知県"] },
  { name: "近畿", prefectures: ["三重県","滋賀県","京都府","大阪府","兵庫県","奈良県","和歌山県"] },
  { name: "中国", prefectures: ["鳥取県","島根県","岡山県","広島県","山口県"] },
  { name: "四国", prefectures: ["徳島県","香川県","愛媛県","高知県"] },
  { name: "九州・沖縄", prefectures: ["福岡県","佐賀県","長崎県","熊本県","大分県","宮崎県","鹿児島県","沖縄県"] },
] as const;

export default function Page() {
  const { supabase, user, profile, permissions, loading } = useAuthProfile();
  const canAccessStamp = profile?.role === "admin" || permissions.includes("S");
  const [communities, setCommunities] = useState<CommunityRow[]>([]);
  const [links, setLinks] = useState<CommunityCaLink[]>([]);
  const [cas, setCas] = useState<CaRow[]>([]);
  const [collections, setCollections] = useState<StampCollectionRow[]>([]);
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
          .select("id,stamp_ca_member_id,community_id,role_at_acquisition,first_acquired_at,first_location,first_event_name,acquisition_source,acquisition_icon_version_id")
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

      let designRows:StampDesignLinkRow[]=[];
      let preferenceRows:StampPreferenceRow[]=[];
      let versionRows:IconVersionRow[]=[];

      const collectionIds=collectionRows.map(row=>row.id);
      if(collectionIds.length){
        const [designResult,preferenceResult]=await Promise.all([
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
        const designError=designResult.error??preferenceResult.error;
        if(designError){
          setError(designError.message);
          setDataLoading(false);
          return;
        }

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
      setDesignLinks(designRows);
      setPreferences(preferenceRows);
      setDesignVersions(versionRows);
      setDataLoading(false);
    })();

    return () => {
      alive = false;
    };
  }, [canAccessStamp, loading, supabase, user]);

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

  function openCommunity(community:StampCommunity){
    const firstCa=community.cas.find(ca=>ca.acquired)??community.cas[0]??null;
    const firstDesign=firstCa?displayDesign(firstCa):null;
    setSelectedCommunity(community);
    setSelectedCaId(firstCa?.id??null);
    setSelectedDesignId(firstDesign?.id??null);
  }

  function selectCa(ca:StampCommunity["cas"][number]){
    setSelectedCaId(ca.id);
    setSelectedDesignId(displayDesign(ca)?.id??null);
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

      <Link
        href="/lab/stamp-rally/exchange"
        className="mt-4 flex items-center justify-between rounded-[22px] border border-[#d9c4ad] bg-white px-5 py-4 shadow-[0_8px_22px_rgba(92,69,45,.06)]"
      >
        <div>
          <div className="text-sm font-black text-[#45663a]">🤝 スタンプ交換</div>
          <div className="mt-0.5 text-[10px] font-bold text-[#938478]">QRで1対1交換する</div>
        </div>
        <span className="text-xl font-black text-[#6a8d59]">→</span>
      </Link>

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
                      <span className="rounded-full bg-[#eef5e8] px-2.5 py-1 text-xs font-black text-[#587847]">{acquiredCount} / {prefectureCas.length}</span>
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
                                return coverSrc?<div className={"relative h-full w-full overflow-hidden rounded-full bg-[#eef2e9] "+(!anyAcquired?"grayscale opacity-35":"")}>
                                  <span className="absolute inset-0 grid place-items-center text-3xl text-[#9caf90]">🍀</span>
                                  <img src={coverSrc} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" onError={event=>{event.currentTarget.style.display="none";}}/>
                                </div>:<CommunityIcon
                                  supabase={supabase}
                                  community={community}
                                  className={"h-full w-full rounded-full bg-[#eef2e9] "+(!anyAcquired?"grayscale opacity-35":"")}
                                  fallbackClassName="text-3xl text-[#9caf90]"
                                />;
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

        return <div
          className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/55 p-5 backdrop-blur-sm"
          onClick={() => setSelectedCommunity(null)}
        >
          <div className="mx-auto flex min-h-full max-w-sm items-center justify-center py-4">
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

              <div className="mx-auto mt-1 grid size-56 place-items-center rounded-full bg-gradient-to-br from-[#f8e3bf] via-white to-[#edc993] p-2 shadow-[0_18px_45px_rgba(112,73,35,.22)]">
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
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-black text-[#514941]">取得済み ・ {selectedCa.trainer_name}</div>
                    <div className="mt-1 text-[9px] font-bold text-[#8b7e73]">
                      {new Date(selectedCa.collection.first_acquired_at).toLocaleDateString("ja-JP")}
                      {selectedCa.collection.first_event_name?" ・ "+selectedCa.collection.first_event_name:""}
                    </div>
                  </div>
                  <span className="rounded-full bg-[#eef5e8] px-2 py-1 text-[9px] font-black text-[#5e7d51]">{selectedCa.ca_level??"CA"}</span>
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
