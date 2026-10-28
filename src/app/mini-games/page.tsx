"use client";

import Link from "next/link";
import { useAuthProfile } from "@/lib/use-auth-profile";
import { isZoroarkGameMasterRole } from "@/lib/zoroark-game";

export default function MiniGamesPage() {
  const { user, profile, loading, error, retry } = useAuthProfile();
  const allowed = Boolean(user && isZoroarkGameMasterRole(profile?.role));
  return <main className="mx-auto max-w-3xl px-4 py-8">
    <Link href="/" className="text-sm font-black text-lime-700">← CA Clover Home</Link>
    <p className="mt-5 w-fit rounded-full bg-lime-100 px-3 py-1 text-xs font-black text-lime-900">CA CLOVER MINI GAMES</p>
    <h1 className="mt-4 text-3xl font-black text-lime-950">🎮 ミニゲーム</h1>
    <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">CAがゲームマスターになって、現地でみんなと楽しむ交流ゲーム。</p>
    {loading ? <p role="status" className="mt-7 text-sm font-bold text-slate-600">ログイン状態を確認しています…</p> :
     error ? <div className="mt-7 rounded-2xl border border-rose-200 bg-white p-5">
       <p role="alert" className="text-sm font-bold text-rose-700">認証状態を確認できませんでした。ゲームは起動しません。</p>
       <button className="mt-4 rounded-xl bg-lime-400 px-4 py-2 text-sm font-black text-lime-950" onClick={retry}>再試行</button>
     </div> :
     !user ? <div className="mt-7 rounded-2xl bg-white p-6">
       <p className="text-sm font-bold text-slate-700">ゲームマスターになるにはログインが必要です。</p>
       <Link className="mt-4 inline-flex rounded-xl bg-lime-400 px-5 py-3 text-sm font-black text-lime-950" href="/login?next=%2Fmini-games">Googleでログイン</Link>
     </div> :
     !allowed ? <div className="mt-7 rounded-2xl border border-slate-200 bg-white p-6">
       <h2 className="font-black text-slate-900">🔒 CA確認待ち</h2>
       <p className="mt-2 text-sm font-semibold text-slate-600">CAまたはADMINと確認されたアカウントのみGM画面を使えます。</p>
     </div> :
     <div className="mt-7 rounded-[24px] border border-lime-200 bg-white p-6 shadow-sm">
       <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-900">開発中・未公開</span>
       <h2 className="mt-4 text-2xl font-black text-lime-950">🦊 ゾロアークを探せ！</h2>
       <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">6〜8名推奨。GMのスマホを回して秘密のお題を確認し、会話と指差し投票で少数派を探します。</p>
       <Link href="/mini-games/zoroark" className="mt-5 inline-flex rounded-2xl bg-lime-400 px-5 py-3 text-base font-black text-lime-950">現地版を開く →</Link>
     </div>}
    <p className="mt-6 text-xs font-semibold leading-5 text-slate-500">このブランチは権限ゲートのUI試作です。CA限定の本番利用には、サーバー側の認可検証が別途必要です。</p>
  </main>;
}
