"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuthProfile } from "@/lib/use-auth-profile";

type CommunityIdRow={id:string};
type MembershipCommunityRow={community_id:string};

export default function Page(){
  const { supabase,user, profile, loading } = useAuthProfile();
  const [pendingClaims,setPendingClaims]=useState(0);
  const [watchCount,setWatchCount]=useState(0);
  const [unassignedCount,setUnassignedCount]=useState(0);

  useEffect(()=>{
    if(loading||!user||profile?.role!=="admin") return;
    Promise.all([
      supabase.from("community_access_requests").select("id",{count:"exact",head:true}).eq("status","pending"),
      supabase.from("meetup_watch_cases").select("id",{count:"exact",head:true}).eq("review_required",true).eq("status","unreviewed"),
      supabase.from("communities").select("id"),
      supabase.from("community_memberships").select("community_id"),
    ]).then(([claims,watch,communities,memberships])=>{
      setPendingClaims(claims.count??0);
      setWatchCount(watch.count??0);
      const membershipRows=(memberships.data as MembershipCommunityRow[]|null)??[];
      const communityRows=(communities.data as CommunityIdRow[]|null)??[];
      const assigned=new Set(membershipRows.map(row=>row.community_id));
      setUnassignedCount(communityRows.filter(row=>!assigned.has(row.id)).length);
    });
  },[loading,user,profile?.role,supabase]);

  if (loading) return <main className="grid min-h-[70vh] place-items-center text-sm font-black text-lime-800">🍀 読み込み中...</main>;
  if (!user) return <main className="grid min-h-[70vh] place-items-center px-4 text-center"><div><h1 className="text-2xl font-black text-lime-950">ログインが必要です</h1><Link href="/login" className="mt-5 inline-flex rounded-full bg-lime-400 px-5 py-3 text-sm font-black">Googleでログイン</Link></div></main>;
  if (profile?.role !== "admin") return <main className="grid min-h-[70vh] place-items-center px-4 text-center"><div><div className="text-5xl">🔒</div><h1 className="mt-3 text-2xl font-black text-lime-950">ADMIN専用です</h1></div></main>;

  const buttons=[
    ["🔍","要確認Meetup",watchCount?watchCount+"件の未確認があります":"未確認はありません","/admin/meetup-watch"],
    ["🛎️","Community申請",pendingClaims?pendingClaims+"件の承認待ちがあります":"承認待ちはありません","/admin/claims"],
    ["🔐","Campfire接続","ADMIN tokenと接続状態を管理","/admin/campfire"],
    ["🔄","データ同期","Campfire Activityを全国更新","/admin/sync"],
    ["🔗","Community権限調整","通常は自動割当 / 手動補正用","/admin/assignments"],
    ["👀","一般ユーザーページ","一般ユーザーページを確認","/admin/preview/general-ca"],
    ["👥","CAアカウント","pending / CA / ADMINを承認・変更","/admin/accounts"],
    ["🧾","同期履歴","取得件数・失敗・部分取得を確認","/admin/sync-runs"],
    ["🧾","Data Coverage","全国の取得状態を確認","/data"],
    ["🏠","ホームへ","カテゴリホームに戻る","/"],
  ];

  return <main className="mx-auto max-w-5xl px-4 py-8 md:px-8">
    <Link href="/" className="text-sm font-black text-lime-700">← CA Clover Home</Link>
    <span className="mt-4 block w-fit rounded-full bg-lime-200 px-3 py-1 text-xs font-black text-lime-900">管理する</span>
    <h1 className="mt-3 text-3xl font-black text-lime-950">⚙️ 管理メニュー</h1>
    <p className="mt-2 text-sm font-semibold text-slate-500">ADMIN権限でログイン中</p>
    {pendingClaims>0 ? <Link href="/admin/claims" className="mt-5 flex items-center justify-between rounded-3xl border border-amber-200 bg-amber-50 p-4">
      <div><div className="text-xs font-black text-amber-700">新しいCommunity申請</div><div className="mt-1 font-black text-amber-950">{pendingClaims}件の確認が必要です</div></div><div className="text-2xl">🛎️</div>
    </Link> : null}
    <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {buttons.map(([i,t,d,href])=>{
        const attention=(href==="/admin/meetup-watch"&&watchCount>0)||(href==="/admin/claims"&&pendingClaims>0);
        const assignmentCard=href==="/admin/assignments";
        return <Link key={t} href={href} className={(attention
          ?"clover-card relative min-h-40 animate-pulse border-amber-300 bg-amber-50 p-5 text-left ring-2 ring-amber-200 transition hover:-translate-y-1 hover:border-amber-400"
          :"clover-card relative min-h-40 p-5 text-left transition hover:-translate-y-1 hover:border-lime-300")}>
          {assignmentCard?<span className="absolute right-4 top-4 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-black text-slate-600">未割当 {unassignedCount}</span>:null}
          <div className="text-3xl">{i}</div><div className="mt-4 font-black text-lime-950">{t}</div><div className="mt-1 text-xs font-semibold text-slate-500">{d}</div><div className="mt-4 text-xs font-black text-lime-700">開く →</div>
        </Link>;
      })}
    </div>
  </main>;
}
