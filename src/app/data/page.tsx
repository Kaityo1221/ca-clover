"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAuthProfile } from "@/lib/use-auth-profile";

type CaRow={
  id:string;
  trainer_name:string;
  ca_level:"1st"|"2nd"|null;
  prefecture:string|null;
  status:string|null;
};
type CommunityRow={id:string;name:string;prefecture:string|null};
type LinkRow={ca_member_id:string;community_id:string};

export default function Page(){
  const {supabase,user,profile,loading}=useAuthProfile();
  const [caRows,setCaRows]=useState<CaRow[]>([]);
  const [communities,setCommunities]=useState<CommunityRow[]>([]);
  const [links,setLinks]=useState<LinkRow[]>([]);
  const [dataLoading,setDataLoading]=useState(false);
  const [showUnresolved,setShowUnresolved]=useState(false);

  useEffect(()=>{
    if(loading||!user||profile?.role!=="admin") return;
    let alive=true;

    async function load(){
      setDataLoading(true);
      const [{data:cas},{data:communityRows},{data:linkRows}]=await Promise.all([
        supabase.from("ca_members").select("id,trainer_name,ca_level,prefecture,status").order("prefecture").order("trainer_name"),
        supabase.from("communities").select("id,name,prefecture").order("prefecture").order("name"),
        supabase.from("community_ca_members").select("ca_member_id,community_id"),
      ]);
      if(!alive) return;
      setCaRows((cas as CaRow[]|null)??[]);
      setCommunities((communityRows as CommunityRow[]|null)??[]);
      setLinks((linkRows as LinkRow[]|null)??[]);
      setDataLoading(false);
    }

    load();
    return()=>{alive=false;};
  },[loading,profile?.role,supabase,user]);

  const linkedIds=useMemo(()=>new Set(links.map(row=>row.ca_member_id)),[links]);
  const unresolved=useMemo(()=>caRows.filter(row=>!linkedIds.has(row.id)),[caRows,linkedIds]);
  const counts={
    ca:caRows.length,
    communities:communities.length,
    linked:linkedIds.size,
    unresolved:unresolved.length,
  };

  function samePrefectureCandidates(row:CaRow){
    if(!row.prefecture) return [];
    return communities.filter(community=>community.prefecture===row.prefecture).slice(0,6);
  }

  if(loading) return <main className="grid min-h-[70vh] place-items-center text-sm font-black text-lime-800">🍀 読み込み中...</main>;
  if(!user) return <main className="grid min-h-[70vh] place-items-center px-4 text-center"><div><h1 className="text-2xl font-black text-lime-950">ログインが必要です</h1><Link href="/login" className="mt-5 inline-flex rounded-full bg-lime-400 px-5 py-3 text-sm font-black">Googleでログイン</Link></div></main>;
  if(profile?.role!=="admin") return <main className="grid min-h-[70vh] place-items-center px-4 text-center"><div><div className="text-5xl">🔒</div><h1 className="mt-3 text-2xl font-black text-lime-950">ADMIN専用です</h1></div></main>;

  return <main className="mx-auto max-w-5xl px-4 py-8 md:px-8">
    <Link href="/" className="text-sm font-black text-lime-700">← CA Clover Home</Link>
    <span className="mt-4 block w-fit rounded-full bg-lime-200 px-3 py-1 text-xs font-black text-lime-900">活動を見る</span>
    <h1 className="mt-3 text-3xl font-black text-lime-950">🧾 Data Coverage</h1>
    <p className="mt-2 text-sm font-semibold text-slate-500">{dataLoading?"実DBを確認中...":"CA Clover Supabaseの現在値"}</p>

    <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div className="clover-card p-6"><div className="text-xs font-black text-emerald-700">CA MASTER</div><div className="mt-2 text-4xl font-black text-lime-950">{counts.ca}</div><div className="mt-2 text-xs text-slate-500">CA登録済み</div></div>
      <div className="clover-card p-6"><div className="text-xs font-black text-lime-700">COMMUNITY</div><div className="mt-2 text-4xl font-black text-lime-950">{counts.communities}</div><div className="mt-2 text-xs text-slate-500">Community解決済み</div></div>
      <div className="clover-card p-6"><div className="text-xs font-black text-sky-700">LINKED CA</div><div className="mt-2 text-4xl font-black text-lime-950">{counts.linked}</div><div className="mt-2 text-xs text-slate-500">Community紐付け済み</div></div>
      <button type="button" onClick={()=>setShowUnresolved(value=>!value)} className="clover-card p-6 text-left transition hover:-translate-y-1 hover:border-amber-300">
        <div className="text-xs font-black text-amber-700">UNRESOLVED</div>
        <div className="mt-2 text-4xl font-black text-lime-950">{counts.unresolved}</div>
        <div className="mt-2 flex items-center justify-between gap-2 text-xs text-slate-500"><span>紐付け要確認</span><span className="font-black text-amber-700">{showUnresolved?"閉じる ↑":"詳細を見る ↓"}</span></div>
      </button>
    </div>

    {showUnresolved?<section className="mt-6">
      <div className="flex items-end justify-between gap-3">
        <div><h2 className="text-lg font-black text-lime-950">未解決CA</h2><p className="mt-1 text-xs font-semibold text-slate-500">なぜUNRESOLVEDになっているかを表示します。</p></div>
        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-800">{unresolved.length}件</span>
      </div>
      <div className="mt-3 space-y-3">
        {unresolved.length?unresolved.map(row=>{
          const candidates=samePrefectureCandidates(row);
          return <article key={row.id} className="clover-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-xs font-black text-lime-700">{row.prefecture??"都道府県未設定"}</div>
                <div className="mt-1 text-lg font-black text-lime-950">{row.trainer_name}</div>
              </div>
              <span className={row.ca_level==="2nd"?"rounded-full bg-sky-100 px-3 py-1 text-xs font-black text-sky-800":"rounded-full bg-lime-200 px-3 py-1 text-xs font-black text-lime-900"}>{row.ca_level??"CA"}</span>
            </div>
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <div className="text-[11px] font-black text-amber-700">未解決理由</div>
              <div className="mt-1 text-sm font-black text-amber-950">CAマスターには登録されていますが、Communityとの紐付けがありません。</div>
            </div>
            <div className="mt-3 text-xs font-semibold text-slate-500">Status: {row.status??"—"}</div>
            <div className="mt-3">
              <div className="text-[11px] font-black text-slate-400">同じ都道府県のCommunity候補</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {candidates.length?candidates.map(candidate=><span key={candidate.id} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{candidate.name}</span>):<span className="text-xs font-semibold text-slate-400">候補を自動抽出できませんでした</span>}
              </div>
            </div>
          </article>;
        }):<div className="clover-card p-8 text-center text-sm font-bold text-slate-500">未解決CAはありません 🍀</div>}
      </div>
    </section>:null}
  </main>;
}
