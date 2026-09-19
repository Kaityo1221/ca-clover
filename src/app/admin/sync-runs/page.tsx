"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuthProfile } from "@/lib/use-auth-profile";

type SyncRun={
  id:string;
  source:string;
  status:string;
  started_at:string;
  finished_at:string|null;
  details:Record<string,unknown>|null;
};

function n(value:unknown){ return typeof value==="number"?value:0; }

export default function Page(){
  const {supabase,user,profile,loading}=useAuthProfile();
  const [rows,setRows]=useState<SyncRun[]>([]);

  useEffect(()=>{
    if(loading||!user||profile?.role!=="admin") return;
    supabase.from("sync_runs").select("id,source,status,started_at,finished_at,details").order("started_at",{ascending:false}).limit(100)
      .then(({data})=>setRows((data as SyncRun[]|null)??[]));
  },[loading,user,profile?.role,supabase]);

  if(loading) return <main className="grid min-h-[70vh] place-items-center text-sm font-black text-lime-800">🍀 読み込み中...</main>;
  if(!user || profile?.role!=="admin") return <main className="grid min-h-[70vh] place-items-center text-center"><div>🔒 ADMIN専用です</div></main>;

  return <main className="mx-auto max-w-6xl px-4 py-8 md:px-8">
    <Link href="/admin" className="text-sm font-black text-lime-700">← 管理メニュー</Link>
    <span className="mt-4 block w-fit rounded-full bg-lime-200 px-3 py-1 text-xs font-black text-lime-900">SYNC HISTORY</span>
    <h1 className="mt-3 text-3xl font-black text-lime-950">🧾 同期履歴</h1>
    <p className="mt-2 text-sm font-semibold text-slate-500">最新100件の同期結果です。</p>

    <div className="mt-6 space-y-3">
      {rows.map(row=>{
        const d=row.details??{};
        const ok=row.status==="success";
        return <section key={row.id} className="clover-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><div className="text-xs font-black text-lime-700">{row.source}</div><div className="mt-1 text-sm font-bold text-slate-600">{new Date(row.started_at).toLocaleString("ja-JP")}</div></div>
            <span className={ok?"rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-800":row.status==="running"?"rounded-full bg-sky-100 px-3 py-1 text-xs font-black text-sky-800":"rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-800"}>{row.status}</span>
          </div>
          <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold text-slate-600">
            <span className="rounded-full bg-lime-50 px-3 py-2">Community {n(d.processed_communities)}</span>
            <span className="rounded-full bg-lime-50 px-3 py-2">Event {n(d.imported_events)}</span>
            <span className="rounded-full bg-amber-50 px-3 py-2 text-amber-700">データなし {n(d.no_data_communities)}</span>
            <span className="rounded-full bg-rose-50 px-3 py-2 text-rose-700">失敗 {n(d.failed_communities)}</span>
          </div>
        </section>;
      })}
    </div>
  </main>;
}
