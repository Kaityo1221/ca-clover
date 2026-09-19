"use client";

import Link from "next/link";
import { useAuthProfile } from "@/lib/use-auth-profile";

const buttons=[
  ["🔄","データ同期","Campfire Activityを全国更新","/admin/sync"],
  ["🔗","Community割当","CAアカウントへCommunityを割当","/admin/assignments"],
  ["👥","CAアカウント","pending / CA / ADMINを承認・変更","/admin/accounts"],
  ["🧾","同期履歴","取得件数・失敗・部分取得を確認","/admin/sync-runs"],
  ["🧾","Data Coverage","全国の取得状態を確認","/data"],
  ["🏠","ホームへ","カテゴリホームに戻る","/"],
];

export default function Page(){
  const { user, profile, loading } = useAuthProfile();

  if (loading) return <main className="grid min-h-[70vh] place-items-center text-sm font-black text-lime-800">🍀 読み込み中...</main>;
  if (!user) return <main className="grid min-h-[70vh] place-items-center px-4 text-center"><div><h1 className="text-2xl font-black text-lime-950">ログインが必要です</h1><Link href="/login" className="mt-5 inline-flex rounded-full bg-lime-400 px-5 py-3 text-sm font-black">Googleでログイン</Link></div></main>;
  if (profile?.role !== "admin") return <main className="grid min-h-[70vh] place-items-center px-4 text-center"><div><div className="text-5xl">🔒</div><h1 className="mt-3 text-2xl font-black text-lime-950">ADMIN専用です</h1></div></main>;

  return <main className="mx-auto max-w-5xl px-4 py-8 md:px-8">
    <Link href="/" className="text-sm font-black text-lime-700">← CA Clover Home</Link>
    <span className="mt-4 block w-fit rounded-full bg-lime-200 px-3 py-1 text-xs font-black text-lime-900">管理する</span>
    <h1 className="mt-3 text-3xl font-black text-lime-950">⚙️ 管理メニュー</h1>
    <p className="mt-2 text-sm font-semibold text-slate-500">ADMIN権限でログイン中</p>
    <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {buttons.map(([i,t,d,href])=><Link key={t} href={href} className="clover-card min-h-40 p-5 text-left transition hover:-translate-y-1 hover:border-lime-300">
        <div className="text-3xl">{i}</div><div className="mt-4 font-black text-lime-950">{t}</div><div className="mt-1 text-xs font-semibold text-slate-500">{d}</div><div className="mt-4 text-xs font-black text-lime-700">開く →</div>
      </Link>)}
    </div>
  </main>;
}
