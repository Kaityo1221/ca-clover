"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAuthProfile } from "@/lib/use-auth-profile";

type MeetupRow = {
  id: string;
  title: string;
  starts_at: string | null;
  location: string | null;
  is_ca_meetup: boolean | null;
  rsvp_count: number | null;
  checkin_count: number | null;
};

export default function Page() {
  const { supabase, user, profile, loading } = useAuthProfile();
  const [rows, setRows] = useState<MeetupRow[]>([]);
  const [dataLoading, setDataLoading] = useState(false);

  useEffect(() => {
    if (loading || !user || !profile || profile.role === "pending") return;
    let alive = true;
    setDataLoading(true);

    supabase
      .from("meetups")
      .select("id,title,starts_at,location,is_ca_meetup,rsvp_count,checkin_count")
      .order("starts_at", { ascending: false })
      .limit(200)
      .then(({ data }) => {
        if (!alive) return;
        setRows((data as MeetupRow[]) ?? []);
        setDataLoading(false);
      });

    return () => { alive = false; };
  }, [loading, profile, supabase, user]);

  const summary = useMemo(() => ({
    meetup: rows.length,
    rsvp: rows.reduce((sum, row) => sum + (row.rsvp_count ?? 0), 0),
    checkin: rows.reduce((sum, row) => sum + (row.checkin_count ?? 0), 0),
    ca: rows.filter(row => row.is_ca_meetup).length,
  }), [rows]);

  if (loading) return <main className="grid min-h-[70vh] place-items-center text-sm font-black text-lime-800">🍀 読み込み中...</main>;
  if (!user) return <main className="grid min-h-[70vh] place-items-center px-4 text-center"><div><h1 className="text-2xl font-black text-lime-950">ログインが必要です</h1><Link href="/login" className="mt-5 inline-flex rounded-full bg-lime-400 px-5 py-3 text-sm font-black">Googleでログイン</Link></div></main>;
  if (profile?.role === "pending") return <main className="grid min-h-[70vh] place-items-center px-4 text-center"><div><div className="text-5xl">🌱</div><h1 className="mt-3 text-2xl font-black text-lime-950">アカウント確認中</h1></div></main>;

  return <main className="mx-auto max-w-6xl px-4 py-8 md:px-8">
    <Link href="/" className="text-sm font-black text-lime-700">← CA Clover Home</Link>
    <span className="mt-4 block w-fit rounded-full bg-lime-200 px-3 py-1 text-xs font-black text-lime-900">活動を見る</span>
    <h1 className="mt-3 text-3xl font-black text-lime-950">🔥 Meetup Activity</h1>
    <p className="mt-2 text-sm font-semibold text-slate-500">{dataLoading ? "読み込み中..." : "RLSで閲覧可能なMeetupを表示中"}</p>

    <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {[
        ["🔥","Meetup",summary.meetup],
        ["🍀","CA Meetup",summary.ca],
        ["📨","RSVP",summary.rsvp],
        ["✅","Check-in",summary.checkin],
      ].map(([icon,label,value])=><div key={String(label)} className="clover-card min-h-36 p-5"><div className="text-2xl">{icon}</div><div className="mt-3 text-xs font-black text-slate-500">{label}</div><div className="mt-1 text-3xl font-black text-lime-950">{value}</div></div>)}
    </div>

    <section className="clover-card mt-5 overflow-hidden">
      <div className="border-b border-lime-100 px-5 py-4"><h2 className="font-black text-lime-950">最近のMeetup</h2></div>
      {rows.length === 0 && !dataLoading ? <div className="p-8 text-center text-sm font-semibold text-slate-500">まだMeetupデータがありません。Campfire同期後にここへ表示されます。</div> : null}
      <div className="divide-y divide-lime-50">
        {rows.map(row => <div key={row.id} className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xs font-black text-lime-700">{row.starts_at ? new Date(row.starts_at).toLocaleString("ja-JP") : "日時未取得"}</div>
              <div className="mt-1 font-black text-lime-950">{row.title}</div>
              <div className="mt-1 text-xs font-semibold text-slate-500">📍 {row.location ?? "場所未取得"}</div>
            </div>
            {row.is_ca_meetup ? <span className="rounded-full bg-lime-200 px-2.5 py-1 text-[11px] font-black text-lime-900">CA Meetup</span> : null}
          </div>
          <div className="mt-3 flex gap-4 text-xs font-bold text-slate-600"><span>RSVP {row.rsvp_count ?? "—"}</span><span>Check-in {row.checkin_count ?? "—"}</span></div>
        </div>)}
      </div>
    </section>
  </main>;
}
