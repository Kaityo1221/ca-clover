"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAuthProfile } from "@/lib/use-auth-profile";

type CommunityRow={
  id:string;
  name:string;
  prefecture:string|null;
  avatar_url:string|null;
  avatar_last_changed_at:string|null;
};

type IconChangeRow={
  id:string;
  community_id:string;
  change_type:"initial"|"changed";
  detection_method:"content_sha256"|"url_fallback";
  previous_avatar_url:string|null;
  new_avatar_url:string;
  detected_at:string;
  reviewed_at:string|null;
};

export default function Page(){
  const {supabase,user,profile,loading}=useAuthProfile();
  const [communities,setCommunities]=useState<CommunityRow[]>([]);
  const [changes,setChanges]=useState<IconChangeRow[]>([]);
  const [selectedId,setSelectedId]=useState<string|null>(null);
  const [busy,setBusy]=useState(false);

  async function load(){
    const [{data:communityRows},{data:changeRows}]=await Promise.all([
      supabase.from("communities")
        .select("id,name,prefecture,avatar_url,avatar_last_changed_at")
        .order("prefecture")
        .order("name"),
      supabase.from("community_icon_changes")
        .select("id,community_id,change_type,detection_method,previous_avatar_url,new_avatar_url,detected_at,reviewed_at")
        .order("detected_at",{ascending:false}),
    ]);
    setCommunities((communityRows as CommunityRow[]|null)??[]);
    setChanges((changeRows as IconChangeRow[]|null)??[]);
  }

  useEffect(()=>{
    if(!loading&&user&&profile?.role==="admin") void load();
  },[loading,user,profile?.role]);

  const pendingByCommunity=useMemo(()=>{
    const map=new Map<string,IconChangeRow[]>();
    for(const change of changes){
      if(change.reviewed_at || change.change_type!=="changed") continue;
      const list=map.get(change.community_id)??[];
      list.push(change);
      map.set(change.community_id,list);
    }
    return map;
  },[changes]);

  const selected=communities.find(row=>row.id===selectedId)??null;
  const selectedChanges=selectedId?(pendingByCommunity.get(selectedId)??[]):[];

  async function markReviewed(){
    if(!selectedChanges.length) return;
    setBusy(true);
    for(const change of selectedChanges){
      await supabase.functions.invoke("admin-manage",{body:{action:"review_icon_change",changeId:change.id}});
    }
    await load();
    setBusy(false);
  }

  if(loading) return <main className="grid min-h-[70vh] place-items-center text-sm font-black text-lime-800">🍀 読み込み中...</main>;
  if(!user||profile?.role!=="admin") return <main className="grid min-h-[70vh] place-items-center text-center"><div>🔒 ADMIN専用です</div></main>;

  return <main className="mx-auto max-w-6xl px-4 py-8 md:px-8">
    <Link href="/admin" className="text-sm font-black text-lime-700">← 管理メニュー</Link>
    <span className="mt-4 block w-fit rounded-full bg-lime-200 px-3 py-1 text-xs font-black text-lime-900">ICON REVIEW</span>
    <h1 className="mt-3 text-3xl font-black text-lime-950">🖼️ アイコン一覧</h1>
    <p className="mt-2 text-sm font-semibold text-slate-500">
      Campfire Communityのアイコンをスタンプ帳のように確認します。変更があるものは光ります。
    </p>

    <div className="mt-5 flex flex-wrap gap-2 text-xs font-black">
      <span className="rounded-full bg-white px-3 py-2 text-lime-800 shadow-sm">全国 {communities.length}</span>
      <span className={pendingByCommunity.size?"animate-pulse rounded-full bg-amber-200 px-3 py-2 text-amber-950":"rounded-full bg-lime-100 px-3 py-2 text-lime-800"}>
        要確認 {pendingByCommunity.size}
      </span>
    </div>

    <div className="mt-7 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {communities.map((community,index)=>{
        const pending=pendingByCommunity.get(community.id)??[];
        const tilt=["-rotate-1","rotate-1","rotate-0"][index%3];
        return <button
          key={community.id}
          type="button"
          onClick={()=>setSelectedId(community.id)}
          className={(pending.length
            ?"relative rounded-[28px] border-2 border-amber-300 bg-amber-50 p-4 text-center shadow-[0_12px_30px_rgba(245,158,11,.22)] ring-2 ring-amber-200 animate-pulse "
            :"relative rounded-[28px] border border-dashed border-lime-200 bg-white/90 p-4 text-center shadow-[0_10px_24px_rgba(77,124,15,.08)] ") + tilt}
        >
          {pending.length?<span className="absolute right-2 top-2 rounded-full bg-amber-300 px-2 py-1 text-[10px] font-black text-amber-950">要確認</span>:null}
          <div className="mx-auto grid size-24 place-items-center overflow-hidden rounded-full border-4 border-white bg-lime-50 text-4xl shadow-md">
            {community.avatar_url?<img src={community.avatar_url} alt="" className="h-full w-full object-cover"/>:<span>🍀</span>}
          </div>
          <div className="mt-3 line-clamp-2 text-sm font-black leading-5 text-lime-950">{community.name}</div>
          <div className="mt-1 text-[11px] font-bold text-lime-600">{community.prefecture??"—"}</div>
        </button>;
      })}
    </div>

    {selected?<div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/45 p-4" onClick={()=>setSelectedId(null)}>
      <div className="mx-auto flex min-h-full max-w-2xl items-center justify-center py-4">
        <section className="w-full rounded-[30px] bg-white p-6 shadow-2xl" onClick={event=>event.stopPropagation()}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs font-black text-lime-600">{selected.prefecture??"—"}</div>
              <h2 className="mt-1 text-2xl font-black text-lime-950">{selected.name}</h2>
            </div>
            <button type="button" onClick={()=>setSelectedId(null)} className="grid size-10 place-items-center rounded-full bg-slate-100 font-black text-slate-600">×</button>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="rounded-3xl bg-lime-50 p-4 text-center">
              <div className="text-xs font-black text-lime-700">現在</div>
              <div className="mx-auto mt-3 size-36 overflow-hidden rounded-full border-4 border-white bg-white shadow-md">
                {selected.avatar_url?<img src={selected.avatar_url} alt="" className="h-full w-full object-cover"/>:<div className="grid h-full place-items-center text-5xl">🍀</div>}
              </div>
            </div>
            <div className="rounded-3xl bg-slate-50 p-4 text-center">
              <div className="text-xs font-black text-slate-500">変更前</div>
              <div className="mx-auto mt-3 size-36 overflow-hidden rounded-full border-4 border-white bg-white shadow-md">
                {selectedChanges[0]?.previous_avatar_url?<img src={selectedChanges[0].previous_avatar_url} alt="" className="h-full w-full object-cover"/>:<div className="grid h-full place-items-center text-sm font-bold text-slate-400">初回取得</div>}
              </div>
            </div>
          </div>

          {selectedChanges.length?<div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <div className="text-xs font-black text-amber-700">要確認</div>
            <div className="mt-1 text-sm font-black text-amber-950">
              {selectedChanges[0].change_type==="initial"?"アイコンを初回取得しました":"アイコンの変更を検知しました"}
            </div>
            <div className="mt-2 text-xs font-semibold text-amber-800">検知: {new Date(selectedChanges[0].detected_at).toLocaleString("ja-JP")}</div>
            <div className="mt-1 text-[11px] font-semibold text-amber-700">比較方式: {selectedChanges[0].detection_method==="content_sha256"?"画像内容":"URL（画像取得失敗時の代替）"}</div>
          </div>:<div className="mt-5 rounded-2xl bg-lime-50 p-4 text-sm font-bold text-lime-800">確認待ちの変更はありません 🍀</div>}

          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            {selectedChanges.length?<button type="button" disabled={busy} onClick={markReviewed} className="rounded-2xl bg-lime-400 px-5 py-3 text-sm font-black text-lime-950 disabled:opacity-50">{busy?"更新中...":"✓ 確認済みにする"}</button>:<div/>}
            <Link href={"/community/"+selected.id} className="rounded-2xl border border-lime-200 bg-white px-5 py-3 text-center text-sm font-black text-lime-700">Community詳細 →</Link>
          </div>
        </section>
      </div>
    </div>:null}
  </main>;
}
