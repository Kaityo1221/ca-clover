"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuthProfile } from "@/lib/use-auth-profile";

type MenuItem = {
  icon: string;
  title: string;
  description: string;
  href: string;
  badge?: string;
  access?: "一般" | "管理者";
};

const adminSections = [
  {
    title: "全国を見る",
    subtitle: "日本のCAとCommunityを探す",
    items: [
      { icon: "🌱", title: "Community一覧", description: "全国のCommunityを検索・確認", href: "/communities", badge: "141", access: "一般" },
      { icon: "🏕️", title: "CA一覧", description: "担当CA・1st / 2ndを確認", href: "/ca", badge: "177", access: "管理者" },
      { icon: "🗾", title: "Activity Map", description: "地域ごとの活動を地図で見る", href: "/map", access: "一般" },
    ],
  },
  {
    title: "活動を見る",
    subtitle: "Meetupの動きを数字から追う",
    items: [
      { icon: "🔥", title: "Meetup活動", description: "開催履歴・最近の活動を確認", href: "/activity", access: "一般" },
      { icon: "📊", title: "Activity集計", description: "RSVP・Check-in・期間別集計", href: "/activity", access: "一般" },
      { icon: "🧾", title: "Data Coverage", description: "取得済み・一部・未取得を確認", href: "/data", access: "管理者" },
    ],
  },
  {
    title: "管理する",
    subtitle: "CA Cloverのデータと権限を整える",
    items: [
      { icon: "🔄", title: "データ同期", description: "Campfire Activityを更新", href: "/admin/sync", access: "管理者" },
      { icon: "🔗", title: "Community割当", description: "CAアカウントへCommunityを割当", href: "/admin/assignments", access: "管理者" },
      { icon: "⚙️", title: "管理設定", description: "承認・同期履歴・権限を管理", href: "/admin", access: "管理者" },
    ],
  },
  {
    title: "自分のCommunity",
    subtitle: "普段使う場所",
    items: [
      { icon: "🍀", title: "My Community", description: "自分のCommunity活動を見る", href: "/my", access: "一般" },
      { icon: "👤", title: "アカウント", description: "Niantic IDとログイン設定", href: "/account", access: "一般" },
    ],
  },
] satisfies { title: string; subtitle: string; items: MenuItem[] }[];

const caSections = [
  {
    title: "自分のCommunity",
    subtitle: "普段使う場所",
    items: [
      { icon: "🍀", title: "My Community", description: "自分のCommunity活動を見る", href: "/my" },
      { icon: "🌱", title: "Community", description: "割り当てられたCommunityを確認", href: "/communities" },
      { icon: "🔥", title: "Meetup活動", description: "Meetup履歴と集計を見る", href: "/activity" },
      { icon: "👤", title: "アカウント", description: "Niantic IDとログイン設定", href: "/account" },
    ],
  },
] satisfies { title: string; subtitle: string; items: MenuItem[] }[];

function MenuButton({ item }: { item: MenuItem }) {
  return <Link href={item.href} className="group relative min-h-36 rounded-[26px] border border-lime-100 bg-white p-5 shadow-[0_14px_40px_rgba(77,124,15,.08)] transition hover:-translate-y-1 hover:border-lime-300 hover:shadow-[0_20px_45px_rgba(77,124,15,.14)]">
    {item.badge ? <span className="absolute right-4 top-4 rounded-full bg-lime-100 px-2.5 py-1 text-xs font-black text-lime-800">{item.badge}</span> : null}
    <div className="grid size-12 place-items-center rounded-2xl bg-lime-100 text-2xl transition group-hover:bg-lime-200">{item.icon}</div>
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <div className="text-base font-black text-lime-950">{item.title}</div>
      {item.access ? (
        <span className={item.access === "管理者"
          ? "rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-600"
          : "rounded-full bg-lime-100 px-2 py-1 text-[10px] font-black text-lime-700"}>
          {item.access}
        </span>
      ) : null}
    </div>
    <div className="mt-1 text-xs font-semibold leading-5 text-slate-500">{item.description}</div>
    <div className="mt-3 text-xs font-black text-lime-700">開く →</div>
  </Link>;
}

export default function Page() {
  const { supabase, user, profile, loading } = useAuthProfile();
  const [counts,setCounts]=useState({communities:0,cas:0,unresolved:0});

  useEffect(()=>{
    if(profile?.role!=="admin") return;
    Promise.all([
      supabase.from("communities").select("id",{count:"exact",head:true}),
      supabase.from("ca_members").select("id"),
      supabase.from("community_ca_members").select("ca_member_id"),
    ]).then(([communities,cas,links])=>{
      const caIds=((cas.data as {id:string}[]|null)??[]).map(x=>x.id);
      const linked=new Set(((links.data as {ca_member_id:string}[]|null)??[]).map(x=>x.ca_member_id));
      setCounts({
        communities:communities.count??0,
        cas:caIds.length,
        unresolved:caIds.filter(id=>!linked.has(id)).length,
      });
    });
  },[profile?.role,supabase]);

  const roleLabel = loading ? "..." : !user ? "GUEST" : profile?.role === "admin" ? "ADMIN" : profile?.role === "ca" ? "CA" : "確認中";
  const sections = profile?.role === "admin" ? adminSections : profile?.role === "ca" ? caSections : [];

  return <>
    <header className="sticky top-0 z-20 border-b border-lime-100 bg-white/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 md:px-8">
        <span className="grid size-11 place-items-center rounded-2xl bg-lime-300 text-2xl">🍀</span>
        <div><div className="font-black text-lime-950">CA Clover</div><div className="text-[11px] font-bold text-lime-700">Japan Community Activity Dashboard</div></div>
        <div className="ml-auto rounded-full bg-lime-50 px-3 py-2 text-xs font-black text-lime-800">{roleLabel}</div>
      </div>
    </header>

    <main className="mx-auto max-w-6xl px-4 py-7 md:px-8">
      <section className="rounded-[30px] border border-lime-100 bg-gradient-to-br from-lime-100 via-white to-emerald-50 p-6 md:p-8">
        <span className="rounded-full bg-lime-300 px-3 py-1 text-xs font-black text-lime-950">CA CLOVER HOME</span>
        <h1 className="mt-4 text-3xl font-black tracking-tight text-lime-950 md:text-4xl">今日は何を見る？ 🍀</h1>
        <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-slate-600">目的から機能を選ぶ、カテゴリ型のホーム画面です。</p>

        {profile?.role === "admin" ? <div className="mt-5 flex flex-wrap gap-2">
          <span className="rounded-full bg-white px-3 py-2 text-xs font-black text-lime-800">🌱 {counts.communities} Community</span>
          <span className="rounded-full bg-white px-3 py-2 text-xs font-black text-lime-800">🏕️ {counts.cas} CA</span>
          <span className="rounded-full bg-white px-3 py-2 text-xs font-black text-amber-700">◐ 未解決 {counts.unresolved}</span>
        </div> : null}
      </section>

      {!loading && !user ? <section className="clover-card mt-7 p-8 text-center">
        <div className="text-5xl">🍀</div>
        <h2 className="mt-3 text-xl font-black text-lime-950">CA Cloverへようこそ</h2>
        <p className="mt-2 text-sm font-semibold text-slate-500">利用するにはGoogleログインが必要です。</p>
        <Link href="/login" className="mt-5 inline-flex rounded-full bg-lime-400 px-5 py-3 text-sm font-black text-lime-950">Googleでログイン</Link>
      </section> : null}

      {!loading && user && profile?.role === "pending" ? <section className="clover-card mt-7 p-8 text-center">
        <div className="text-5xl">🌱</div>
        <h2 className="mt-3 text-xl font-black text-lime-950">アカウント確認中</h2>
        <p className="mt-2 text-sm font-semibold text-slate-500">Niantic IDを登録して、Community割当を待ってください。</p>
        <Link href="/account" className="mt-5 inline-flex rounded-full bg-lime-400 px-5 py-3 text-sm font-black text-lime-950">アカウント設定へ</Link>
      </section> : null}

      {sections.length ? <div className="mt-7 space-y-7">
        {sections.map(section => <section key={section.title}>
          <div className="mb-3"><h2 className="text-lg font-black text-lime-950">{section.title}</h2><p className="mt-0.5 text-xs font-semibold text-slate-500">{section.subtitle}</p></div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{section.items.map(item => <MenuButton key={item.title} item={item} />)}</div>
        </section>)}
      </div> : null}
    </main>
  </>;
}
