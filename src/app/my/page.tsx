"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAuthProfile } from "@/lib/use-auth-profile";

type MembershipRow = { community_id: string };
type CommunityRow = {
  id: string;
  name: string;
  prefecture: string | null;
  member_count: number | null;
  coverage: "complete" | "partial" | "missing";
};
type MeetupRow = {
  community_id: string | null;
  starts_at: string | null;
  rsvp_count: number | null;
  checkin_count: number | null;
};

export default function Page() {
  const { supabase, user, profile, loading } = useAuthProfile();
  const [communities, setCommunities] = useState<CommunityRow[]>([]);
  const [meetups, setMeetups] = useState<MeetupRow[]>([]);
  const [dataLoading, setDataLoading] = useState(false);

  useEffect(() => {
    if (loading || !user || !profile || profile.role === "pending") return;
    let alive = true;

    async function load() {
      setDataLoading(true);

      const { data: memberships } = await supabase
        .from("community_memberships")
        .select("community_id")
        .eq("user_id", user.id);

      const ids = ((memberships as MembershipRow[] | null) ?? []).map(x => x.community_id);

      if (!ids.length) {
        if (alive) {
          setCommunities([]);
          setMeetups([]);
          setDataLoading(false);
        }
        return;
      }

      const [{ data: communityRows }, { data: meetupRows }] = await Promise.all([
        supabase
          .from("communities")
          .select("id,name,prefecture,member_count,coverage")
          .in("id", ids)
          .order("name"),
        supabase
          .from("meetups")
          .select("community_id,starts_at,rsvp_count,checkin_count")
          .in("community_id", ids)
          .order("starts_at", { ascending: false }),
      ]);

      if (!alive) return;
      setCommunities((communityRows as CommunityRow[]) ?? []);
      setMeetups((meetupRows as MeetupRow[]) ?? []);
      setDataLoading(false);
    }

    load();
    return () => { alive = false; };
  }, [loading, profile, supabase, user]);

  const metrics = useMemo(() => {
    const since = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const recent = meetups.filter(m => m.starts_at && new Date(m.starts_at).getTime() >= since);
    return {
      meetups: recent.length,
      rsvp: recent.reduce((sum, m) => sum + (m.rsvp_count ?? 0), 0),
      checkin: recent.reduce((sum, m) => sum + (m.checkin_count ?? 0), 0),
    };
  }, [meetups]);

  if (loading) return <main className="grid min-h-[70vh] place-items-center text-sm font-black text-lime-800">🍀 読み込み中...</main>;
  if (!user) return <main className="grid min-h-[70vh] place-items-center px-4 text-center"><div><div className="text-5xl">🍀</div><h1 className="mt-3 text-2xl font-black text-lime-950">ログインが必要です</h1><Link href="/login" className="mt-5 inline-flex rounded-full bg-lime-400 px-5 py-3 text-sm font-black">Googleでログイン</Link></div></main>;
  if (profile?.role === "pending") return <main className="grid min-h-[70vh] place-items-center px-4 text-center"><div><div className="text-5xl">🌱</div><h1 className="mt-3 text-2xl font-black text-lime-950">アカウント確認中</h1><p className="mt-2 text-sm font-semibold text-slate-500">Communityが割り当てられると利用できます。</p></div></main>;

  return <main className="mx-auto max-w-5xl px-4 py-8 md:px-8">
    <Link href="/" className="text-sm font-black text-lime-700">← CA Clover Home</Link>
    <span className="mt-4 block w-fit rounded-full bg-lime-200 px-3 py-1 text-xs font-black text-lime-900">MY COMMUNITY</span>
    <h1 className="mt-3 text-3xl font-black text-lime-950">🍀 自分のCommunity</h1>
    <p className="mt-2 text-sm font-semibold text-slate-500">{dataLoading ? "読み込み中..." : communities.length + " Community"}</p>

    {!dataLoading && communities.length === 0 ? (
      <section className="clover-card mt-6 p-8 text-center">
        <div className="text-5xl">🌱</div>
        <h2 className="mt-3 text-xl font-black text-lime-950">Community未割当です</h2>
        <p className="mt-2 text-sm font-semibold text-slate-500">管理者がCommunityを割り当てると、ここに表示されます。</p>
      </section>
    ) : null}

    {communities.length ? (
      <>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="clover-card p-5"><div className="text-2xl">🔥</div><div className="mt-2 text-xs font-black text-slate-500">30日Meetup</div><div className="mt-1 text-3xl font-black text-lime-950">{metrics.meetups}</div></div>
          <div className="clover-card p-5"><div className="text-2xl">📨</div><div className="mt-2 text-xs font-black text-slate-500">30日RSVP</div><div className="mt-1 text-3xl font-black text-lime-950">{metrics.rsvp}</div></div>
          <div className="clover-card p-5"><div className="text-2xl">✅</div><div className="mt-2 text-xs font-black text-slate-500">30日Check-in</div><div className="mt-1 text-3xl font-black text-lime-950">{metrics.checkin}</div></div>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {communities.map(c => <Link key={c.id} href={"/community/"+c.id} className="clover-card p-6 transition hover:-translate-y-1 hover:border-lime-300">
            <div className="text-xs font-black text-lime-700">{c.prefecture ?? "—"}</div>
            <h2 className="mt-2 text-xl font-black text-lime-950">{c.name}</h2>
            <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold text-slate-500">
              <span className="rounded-full bg-lime-50 px-3 py-2">Member: {c.member_count?.toLocaleString("ja-JP") ?? "未取得"}</span>
              <span className="rounded-full bg-lime-50 px-3 py-2">Data: {c.coverage}</span>
            </div>
            <div className="mt-5 text-xs font-black text-lime-700">Activityを見る →</div>
          </Link>)}
        </div>
      </>
    ) : null}
  </main>;
}
