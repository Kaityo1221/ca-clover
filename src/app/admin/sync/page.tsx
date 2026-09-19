"use client";

import Link from "next/link";
import { useState } from "react";
import { useAuthProfile } from "@/lib/use-auth-profile";

type SyncResult = {
  ok?: boolean;
  total?: number;
  processed?: number;
  importedEvents?: number;
  failedCommunities?: number;
  noDataCommunities?: number;
};

export default function Page(){
  const { supabase, user, profile, loading } = useAuthProfile();
  const [running,setRunning]=useState(false);
  const [progress,setProgress]=useState({done:0,total:0,events:0,failed:0,noData:0});
  const [message,setMessage]=useState<string|null>(null);

  async function runAll(){
    setRunning(true);
    setMessage(null);
    setProgress({done:0,total:0,events:0,failed:0,noData:0});

    let offset=0;
    let total=0;
    let events=0;
    let failed=0;
    let noData=0;

    try{
      while(true){
        const { data, error } = await supabase.functions.invoke("sync-campfire", {
          body:{offset,limit:10},
        });
        if(error) throw error;

        const result=(data ?? {}) as SyncResult;
        const processed=result.processed ?? 0;
        total=result.total ?? total;
        events += result.importedEvents ?? 0;
        failed += result.failedCommunities ?? 0;
        noData += result.noDataCommunities ?? 0;
        offset += processed;

        setProgress({done:offset,total,events,failed,noData});
        if(processed===0 || offset>=total) break;
      }
      setMessage("全国同期が完了しました 🍀");
    }catch(error){
      setMessage(error instanceof Error ? error.message : String(error));
    }finally{
      setRunning(false);
    }
  }

  if(loading) return <main className="grid min-h-[70vh] place-items-center text-sm font-black text-lime-800">🍀 読み込み中...</main>;
  if(!user || profile?.role!=="admin") return <main className="grid min-h-[70vh] place-items-center text-center"><div><div className="text-5xl">🔒</div><h1 className="mt-3 text-2xl font-black">ADMIN専用です</h1></div></main>;

  const percent=progress.total ? Math.min(100,Math.round(progress.done/progress.total*100)) : 0;

  return <main className="mx-auto max-w-4xl px-4 py-8 md:px-8">
    <Link href="/admin" className="text-sm font-black text-lime-700">← 管理メニュー</Link>
    <span className="mt-4 block w-fit rounded-full bg-lime-200 px-3 py-1 text-xs font-black text-lime-900">DATA SYNC</span>
    <h1 className="mt-3 text-3xl font-black text-lime-950">🔄 Campfire Activity同期</h1>
    <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">公開のcmpf-toolsデータを10 Communityずつ取得します。参加者のIDや名前は保存せず、RSVP / Check-inの件数だけ保存します。</p>

    <section className="clover-card mt-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-xs font-black text-slate-500">全国一括同期</div>
          <div className="mt-1 text-xl font-black text-lime-950">{running ? "同期中..." : "準備OK"}</div>
        </div>
        <button onClick={runAll} disabled={running} className="rounded-2xl bg-lime-400 px-6 py-3 text-sm font-black text-lime-950 disabled:opacity-50">{running ? "同期しています…" : "全国同期を開始"}</button>
      </div>

      <div className="mt-6 h-3 overflow-hidden rounded-full bg-lime-50"><div className="h-full rounded-full bg-lime-400 transition-all" style={{width:percent+"%"}}/></div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold text-slate-600">
        <span className="rounded-full bg-lime-50 px-3 py-2">進捗 {progress.done}/{progress.total || "?"}</span>
        <span className="rounded-full bg-lime-50 px-3 py-2">取得Event {progress.events}</span>
        <span className="rounded-full bg-amber-50 px-3 py-2 text-amber-700">データなし {progress.noData}</span>
        <span className="rounded-full bg-rose-50 px-3 py-2 text-rose-700">失敗 {progress.failed}</span>
      </div>

      {message ? <div className="mt-5 rounded-2xl bg-lime-50 p-4 text-sm font-bold text-lime-900">{message}</div> : null}
    </section>

    <section className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs font-semibold leading-5 text-amber-900">
      cmpf-tools側に取り込まれているイベントだけが対象です。そのためCA Cloverでは取得済みCommunityも「partial / 一部取得」として扱います。
    </section>
  </main>;
}
