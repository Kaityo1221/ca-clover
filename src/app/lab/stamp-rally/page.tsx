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

type StampCommunity = CommunityRow & {
  cas: Array<CaRow & { acquired: boolean }>;
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

function demoAcquired(id: string) {
  let score = 0;
  for (let index = 0; index < id.length; index += 1) {
    score = (score * 33 + id.charCodeAt(index)) % 9973;
  }
  return score % 10 < 4;
}

export default function Page() {
  const { supabase, user, profile, permissions, loading } = useAuthProfile();
  const canAccessStamp = profile?.role === "admin" || permissions.includes("S");
  const [communities, setCommunities] = useState<CommunityRow[]>([]);
  const [links, setLinks] = useState<CommunityCaLink[]>([]);
  const [cas, setCas] = useState<CaRow[]>([]);
  const [openRegions, setOpenRegions] = useState<Set<string>>(new Set());
  const [openPrefectures, setOpenPrefectures] = useState<Set<string>>(new Set());
  const [dataLoading, setDataLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCommunity, setSelectedCommunity] = useState<StampCommunity | null>(null);

  useEffect(() => {
    if (loading || !user || !canAccessStamp) return;
    let alive = true;
    setDataLoading(true);

    supabase.rpc("stamp_rally_catalog").then(({data,error}) => {
      if (!alive) return;

      if (error) {
        setError(error.message);
        setDataLoading(false);
        return;
      }

      const rows=(data as StampCatalogRow[]|null)??[];
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

      setCommunities([...communityMap.values()]);
      setCas([...caMap.values()]);
      setLinks(linkRows);
      setDataLoading(false);
    });

    return () => {
      alive = false;
    };
  }, [canAccessStamp, loading, supabase, user]);

  const stampCommunities = useMemo<StampCommunity[]>(() => {
    const caById = new Map(cas.map((ca) => [ca.id, ca]));
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
          .map((ca) => ({ ...ca, acquired: demoAcquired(ca.id) })),
      }));
  }, [cas, communities, links]);

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
          <div className="max-w-[180px] text-right text-[10px] font-bold leading-4 text-[#8a6d51]">※ LAB版の取得状況はUI確認用のサンプル表示です</div>
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
                            onClick={() => setSelectedCommunity(community)}
                            className="group min-w-0 text-center"
                          >
                            <div className={"relative mx-auto grid size-[78px] place-items-center rounded-full p-[5px] transition-transform group-hover:-translate-y-1 sm:size-[96px] " + (
                              anyAcquired
                                ? "bg-gradient-to-br from-[#f9e8c7] via-white to-[#efd0a4] shadow-[0_8px_18px_rgba(115,78,38,.18)]"
                                : "border-2 border-dashed border-[#cfc9c3] bg-[#f2f0ed]"
                            )}>
                              <CommunityIcon
                                supabase={supabase}
                                community={community}
                                className={"h-full w-full rounded-full bg-[#eef2e9] "+(!anyAcquired?"grayscale opacity-35":"")}
                                fallbackClassName="text-3xl text-[#9caf90]"
                              />
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

      {selectedCommunity ? <div
        className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 p-5 backdrop-blur-sm"
        onClick={() => setSelectedCommunity(null)}
      >
        <section
          className="w-full max-w-sm rounded-[30px] border border-[#ead5bf] bg-[#fffaf4] p-5 text-center shadow-2xl"
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => setSelectedCommunity(null)}
            className="ml-auto grid size-9 place-items-center rounded-full bg-white text-lg font-black text-[#75695f] shadow-sm"
            aria-label="閉じる"
          >×</button>
          <div className="mx-auto mt-1 grid size-56 place-items-center rounded-full bg-gradient-to-br from-[#f8e3bf] via-white to-[#edc993] p-2 shadow-[0_18px_45px_rgba(112,73,35,.22)]">
            <CommunityIcon
              supabase={supabase}
              community={selectedCommunity}
              className="h-full w-full rounded-full bg-[#eef2e9]"
              fallbackClassName="text-6xl text-[#9caf90]"
              loading="eager"
            />
          </div>
          <h2 className="mt-5 text-xl font-black leading-snug text-[#443c35]">{selectedCommunity.name}</h2>
          <p className="mt-1 text-xs font-bold text-[#8a7d72]">{selectedCommunity.prefecture ?? "—"}</p>
        </section>
      </div> : null}

      <div className="mt-6 rounded-[22px] border border-dashed border-[#d8c7b5] bg-white/60 p-4 text-center text-[11px] font-bold leading-5 text-[#8d7c6c]">
        🍀 通常1対1交換を追加しました。スタンプシートの実取得データ接続は次の段階で進めます。
      </div>
    </div>
  </main>;
}
