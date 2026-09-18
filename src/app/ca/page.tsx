"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuthProfile } from "@/lib/use-auth-profile";

type CaRow = {
  id: string;
  trainer_name: string;
  ca_level: "1st" | "2nd" | null;
  prefecture: string | null;
  join_date: string | null;
  status: string | null;
};

export default function Page() {
  const { supabase, user, profile, loading } = useAuthProfile();
  const [rows, setRows] = useState<CaRow[]>([]);
  const [dataLoading, setDataLoading] = useState(false);

  useEffect(() => {
    if (loading || !user || profile?.role !== "admin") return;
    let alive = true;
    setDataLoading(true);

    supabase
      .from("ca_members")
      .select("id,trainer_name,ca_level,prefecture,join_date,status")
      .order("prefecture")
      .order("trainer_name")
      .then(({ data }) => {
        if (!alive) return;
        setRows((data as CaRow[]) ?? []);
        setDataLoading(false);
      });

    return () => { alive = false; };
  }, [loading, profile?.role, supabase, user]);

  if (loading) return <main className="grid min-h-[70vh] place-items-center text-sm font-black text-lime-800">🍀 読み込み中...</main>;
  if (!user) return <main className="grid min-h-[70vh] place-items-center px-4 text-center"><div><h1 className="text-2xl font-black text-lime-950">ログインが必要です</h1><Link href="/login" className="mt-5 inline-flex rounded-full bg-lime-400 px-5 py-3 text-sm font-black">Googleでログイン</Link></div></main>;
  if (profile?.role !== "admin") return <main className="grid min-h-[70vh] place-items-center px-4 text-center"><div><div className="text-5xl">🔒</div><h1 className="mt-3 text-2xl font-black text-lime-950">ADMIN専用です</h1></div></main>;

  return <main className="mx-auto max-w-6xl px-4 py-8 md:px-8">
    <Link href="/" className="text-sm font-black text-lime-700">← CA Clover Home</Link>
    <span className="mt-4 block w-fit rounded-full bg-lime-200 px-3 py-1 text-xs font-black text-lime-900">全国を見る</span>
    <h1 className="mt-3 text-3xl font-black text-lime-950">🏕️ CA一覧</h1>
    <p className="mt-2 text-sm font-semibold text-slate-500">{dataLoading ? "読み込み中..." : rows.length + " CA"}</p>

    <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map(r=><div key={r.id} className="clover-card p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs font-black text-lime-700">{r.prefecture ?? "—"}</div>
          <span className={r.ca_level==="2nd"?"rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-black text-emerald-800":"rounded-full bg-lime-200 px-2 py-1 text-[10px] font-black text-lime-900"}>{r.ca_level ?? "CA"}</span>
        </div>
        <div className="mt-3 text-lg font-black text-lime-950">{r.trainer_name}</div>
        <div className="mt-2 text-xs font-semibold text-slate-500">就任: {r.join_date ?? "未取得"}</div>
        <div className="mt-1 text-xs font-semibold text-slate-500">Status: {r.status ?? "—"}</div>
      </div>)}
    </div>
  </main>;
}
