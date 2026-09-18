"use client";

import Link from "next/link";
import { useAuthProfile } from "@/lib/use-auth-profile";

const buttons=[
  ["🔄","データ同期","CAマスターとActivityを更新"],
  ["🔗","Community割当","CAとCommunityの紐付け"],
  ["👥","CAアカウント","承認・権限を管理"],
  ["🧾","同期履歴","取得結果とエラーを確認"],
  ["⚙️","データ設定","取得元・更新条件を管理"],
  ["🛡️","権限設定","ADMIN / CA / pendingを管理"],
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
      {buttons.map(([i,t,d])=><button key={t} className="clover-card min-h-40 p-5 text-left transition hover:-translate-y-1 hover:border-lime-300">
        <div className="text-3xl">{i}</div><div className="mt-4 font-black text-lime-950">{t}</div><div className="mt-1 text-xs font-semibold text-slate-500">{d}</div>
      </button>)}
    </div>
  </main>;
}
