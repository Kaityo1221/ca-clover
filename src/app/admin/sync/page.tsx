"use client";

import Link from "next/link";
import { useAuthProfile } from "@/lib/use-auth-profile";

export default function Page(){
  const { user, profile, loading } = useAuthProfile();

  if(loading) return <main className="grid min-h-[70vh] place-items-center text-sm font-black text-lime-800">🍀 読み込み中...</main>;
  if(!user || profile?.role!=="admin") return <main className="grid min-h-[70vh] place-items-center text-center"><div><div className="text-5xl">🔒</div><h1 className="mt-3 text-2xl font-black">ADMIN専用です</h1></div></main>;

  return <main className="mx-auto max-w-4xl px-4 py-8 md:px-8">
    <Link href="/admin" className="text-sm font-black text-lime-700">← 管理メニュー</Link>
    <span className="mt-4 block w-fit rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-800">SYNC PAUSED</span>
    <h1 className="mt-3 text-3xl font-black text-lime-950">🔄 Activity同期</h1>
    <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">日本CA全体を正しくカバーできる取得方式へ切り替えるため、全国同期を一時停止しています。</p>

    <section className="clover-card mt-6 p-6">
      <div className="text-4xl">🧭</div>
      <h2 className="mt-4 text-xl font-black text-lime-950">Campfire直接取得へ切替中</h2>
      <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">cmpf-toolsは登録済みCommunityに偏るため主データ源から外しました。既存のcmpf-tools由来Meetup・同期履歴は本番DBから削除済みです。</p>
      <div className="mt-5 flex flex-wrap gap-2 text-xs font-bold">
        <span className="rounded-full bg-lime-50 px-3 py-2 text-lime-800">Meetupデータ: リセット済み</span>
        <span className="rounded-full bg-lime-50 px-3 py-2 text-lime-800">Data Coverage: 未取得へ復帰</span>
        <span className="rounded-full bg-amber-50 px-3 py-2 text-amber-800">次: 公開Campfire発見経路を実装</span>
      </div>
    </section>
  </main>;
}
