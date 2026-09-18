"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useAuthProfile } from "@/lib/use-auth-profile";

type CommunityRow = {
  id: string;
  campfire_community_id: string | null;
  name: string;
  prefecture: string | null;
  campfire_url: string | null;
  member_count: number | null;
  coverage: "complete" | "partial" | "missing";
  coverage_from: string | null;
  coverage_to: string | null;
  fetched_at: string | null;
};

type MeetupRow = {
  id: string;
  title: string;
  starts_at: string | null;
  location: string | null;
  is_ca_meetup: boolean | null;
  rsvp_count: number | null;
  checkin_count: number | null;
};

type LinkRow = { ca_member_id: string };
type CaRow = {
  id: string;
  trainer_name: string;
  ca_level: "1st" | "2nd" | null;
};

export default function Page() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { supabase, user, profile, loading } = useAuthProfile();

  const [community, setCommunity] = useState<CommunityRow | null>(null);
  const [meetups, setMeetups] = useState<MeetupRow[]>([]);
  const [cas, setCas] = useState<CaRow[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (loading || !user || !profile || profile.role === "pending" || !id) return;
    let alive = true;

    async function load() {
      setDataLoading(true);

      const { data: communityRow, error: communityError } = await supabase
        .from("communities")
        .select("id,campfire_community_id,name,prefecture,campfire_url,member_count,coverage,coverage_from,coverage_to,fetched_at")
        .eq("id", id)
        .maybeSingle();

      if (!alive) return;
      if (communityError || !communityRow) {
        setNotFound(true);
        setDataLoading(false);
        return;
      }

      const [meetupResult, linkResult] = await Promise.all([
        supabase
          .from("meetups")
          .select("id,title,starts_at,location,is_ca_meetup,rsvp_count,checkin_count")
          .eq("community_id", id)
          .order("starts_at", { ascending: false }),
        supabase
          .from("community_ca_members")
          .select("ca_member_id")
          .eq("community_id", id),
      ]);

      const links = (linkResult.data as LinkRow[] | null) ?? [];
      let caRows: CaRow[] = [];

      if (links.length) {
        const { data } = await supabase
          .from("ca_members")
          .select("id,trainer_name,ca_level")
          .in("id", links.map(link => link.ca_member_id))
          .order("ca_level");
        caRows = (data as CaRow[] | null) ?? [];
      }

      if (!alive) return;
      setCommunity(communityRow as CommunityRow);
      setMeetups((meetupResult.data as MeetupRow[] | null) ?? []);
      setCas(caRows);
      setDataLoading(false);
    }

    load();
    return () => { alive = false; };
  }, [id, loading, profile, supabase, user]);

  const summary = useMemo(() => ({
    meetup: meetups.length,
    caMeetup: meetups.filter(row => row.is_ca_meetup).length,
    rsvp: meetups.reduce((sum, row) => sum + (row.rsvp_count ?? 0), 0),
    checkin: meetups.reduce((sum, row) => sum + (row.checkin_count ?? 0), 0),
    last: meetups[0]?.starts_at ?? null,
  }), [meetups]);

  if (loading) return <main className="grid min-h-[70vh] place-items-center text-sm font-black text-lime-800">🍀 読み込み中...</main>;
  if (!user) return <main className="grid min-h-[70vh] place-items-center px-4 text-center"><div><h1 className="text-2xl font-black text-lime-950">ログインが必要です</h1><Link href="/login" className="mt-5 inline-flex rounded-full bg-lime-400 px-5 py-3 text-sm font-black">Googleでログイン</Link></div></main>;
  if (profile?.role === "pending") return <main className="grid min-h-[70vh] place-items-center px-4 text-center"><div><div className="text-5xl">🌱</div><h1 className="mt-3 text-2xl font-black text-lime-950">アカウント確認中</h1></div></main>;
  if (notFound) return <main className="grid min-h-[70vh] place-items-center px-4 text-center"><div><div className="text-5xl">🔒</div><h1 className="mt-3 text-2xl font-black text-lime-950">このCommunityは表示できません</h1><p className="mt-2 text-sm font-semibold text-slate-500">割り当て外、または存在しないCommunityです。</p></div></main>;
  if (dataLoading || !community) return <main className="grid min-h-[70vh] place-items-center text-sm font-black text-lime-800">🍀 Communityを読み込み中...</main>;

  return <main className="mx-auto max-w-6xl px-4 py-7 md:px-8">
    <Link href="/communities" className="text-sm font-black text-lime-700">← Community一覧</Link>

    <section className="clover-card mt-4 p-6">
      <div className="text-xs font-black text-lime-600">{community.prefecture ?? "—"}</div>
      <h1 className="mt-2 text-3xl font-black text-lime-950">{community.name}</h1>
      <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold text-slate-500">
        <span className="rounded-full bg-lime-50 px-3 py-2">Community ID: {community.campfire_community_id ?? "未取得"}</span>
        <span className="rounded-full bg-lime-50 px-3 py-2">Member: {community.member_count?.toLocaleString("ja-JP") ?? "未取得"}</span>
        {cas.map(ca => <span key={ca.id} className="rounded-full bg-lime-100 px-3 py-2 text-lime-800">{ca.ca_level ?? "CA"}: {ca.trainer_name}</span>)}
      </div>
      {community.campfire_url ? <a href={community.campfire_url} target="_blank" rel="noreferrer" className="mt-4 inline-flex rounded-full border border-lime-200 bg-white px-4 py-2 text-xs font-black text-lime-700">Campfireを開く ↗</a> : null}
    </section>

    <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {[
        ["🔥","Meetup",summary.meetup],
        ["🍀","CA Meetup",summary.caMeetup],
        ["📨","RSVP",summary.rsvp],
        ["✅","Check-in",summary.checkin],
        ["🗓️","最終開催",summary.last ? new Date(summary.last).toLocaleDateString("ja-JP") : "—"],
      ].map(([icon,label,value])=><div key={String(label)} className="clover-card p-5"><div className="text-2xl">{icon}</div><div className="mt-2 text-xs font-black text-slate-500">{label}</div><div className="mt-1 text-2xl font-black text-lime-950">{value}</div></div>)}
    </div>

    <section className="clover-card mt-5 overflow-hidden">
      <div className="border-b border-lime-100 px-5 py-4"><h2 className="font-black text-lime-950">🔥 Meetup履歴</h2></div>
      {meetups.length === 0 ? <div className="p-8 text-center text-sm font-semibold text-slate-500">まだMeetupデータがありません。</div> : null}
      <div className="divide-y divide-lime-50">
        {meetups.map(m => <div key={m.id} className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xs font-black text-lime-700">{m.starts_at ? new Date(m.starts_at).toLocaleString("ja-JP") : "日時未取得"}</div>
              <div className="mt-1 font-black text-lime-950">{m.title}</div>
              <div className="mt-1 text-xs text-slate-500">📍 {m.location ?? "場所未取得"}</div>
            </div>
            {m.is_ca_meetup ? <span className="h-fit rounded-full bg-lime-200 px-2.5 py-1 text-[11px] font-black text-lime-900">CA Meetup</span> : null}
          </div>
          <div className="mt-3 flex gap-4 text-xs font-bold text-slate-600"><span>RSVP {m.rsvp_count ?? "—"}</span><span>Check-in {m.checkin_count ?? "—"}</span></div>
        </div>)}
      </div>
    </section>

    <section className="clover-card mt-5 p-5">
      <h2 className="font-black text-lime-950">🧾 Data Coverage</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-4 text-sm">
        <div><div className="text-xs text-slate-400">取得開始</div><b>{community.coverage_from ? new Date(community.coverage_from).toLocaleDateString("ja-JP") : "未取得"}</b></div>
        <div><div className="text-xs text-slate-400">取得終了</div><b>{community.coverage_to ? new Date(community.coverage_to).toLocaleDateString("ja-JP") : "未取得"}</b></div>
        <div><div className="text-xs text-slate-400">状態</div><b>{community.coverage}</b></div>
        <div><div className="text-xs text-slate-400">最終同期</div><b>{community.fetched_at ? new Date(community.fetched_at).toLocaleString("ja-JP") : "未取得"}</b></div>
      </div>
    </section>
  </main>;
}
