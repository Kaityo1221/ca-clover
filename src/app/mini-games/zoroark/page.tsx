"use client";

import Link from "next/link";
import { useAuthProfile } from "@/lib/use-auth-profile";
import { isZoroarkGameMasterRole } from "@/lib/zoroark-game";
import { ZoroarkLocalGame } from "@/components/zoroark-local-game";

export default function ZoroarkGamePage() {
  const { user, profile, loading, error, retry } = useAuthProfile();
  const authorizedUi = Boolean(user && isZoroarkGameMasterRole(profile?.role));
  return <main className="mx-auto max-w-3xl px-4 py-8">
    <Link href="/mini-games" className="text-sm font-black text-lime-700">← ミニゲーム一覧</Link>
    <h1 className="mt-5 text-3xl font-black text-lime-950">🎭 ゾロアークを探せ！</h1>
    <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">CAがゲームマスターを担当する現地用ミニゲームです。</p>
    {loading ? <p role="status" className="mt-6 text-sm font-bold text-slate-600">CA権限を確認しています…</p> :
     error ? <div className="mt-6 rounded-2xl border border-rose-200 bg-white p-5">
       <p role="alert" className="font-bold text-rose-700">CA権限が確定できないためゲームは起動できません。</p>
       <button onClick={retry} className="mt-3 rounded-xl bg-lime-400 px-5 py-2 font-black text-lime-950">再確認</button>
     </div> :
     !user ? <div className="mt-6 rounded-2xl bg-white p-6">
       <p className="text-sm font-bold text-slate-700">CA Cloverへのログインが必要です。</p>
       <Link href="/login?next=%2Fmini-games%2Fzoroark" className="mt-4 inline-flex rounded-2xl bg-lime-400 px-5 py-3 font-black text-lime-950">Googleでログイン</Link>
     </div> :
     !authorizedUi ? <div className="mt-6 rounded-2xl bg-white p-6 text-sm font-bold text-slate-700">
       🔒 CAまたはADMINのアカウントのみゲームマスター画面を起動できます。
     </div> :
     <ZoroarkLocalGame />}
    <p className="mt-7 text-center text-xs font-semibold leading-5 text-slate-500">新しいゲームの開始時にサーバーでCA権限を再確認します。端末を渡す前にお題を隠してください。</p>
  </main>;
}
