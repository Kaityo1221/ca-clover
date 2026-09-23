"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import { useAuthProfile } from "@/lib/use-auth-profile";
import { sanitizeNextPath } from "@/lib/auth-routing";

export default function Page(){
  const { user, loading } = useAuthProfile();
  const [error, setError] = useState<string | null>(null);
  const [nextPath, setNextPath] = useState("/my");

  useEffect(()=>{
    const params=new URLSearchParams(window.location.search);
    setNextPath(sanitizeNextPath(params.get("next"),"/my"));
  },[]);

  async function login(){
    const supabase=createBrowserSupabaseClient();
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider:"google",
      options:{redirectTo:window.location.origin+nextPath}
    });
    if (error) setError(error.message);
  }

  if (loading) return <main className="grid min-h-screen place-items-center text-sm font-black text-lime-800">🍀 読み込み中...</main>;

  return <main className="grid min-h-screen place-items-center px-4">
    <section className="clover-card w-full max-w-md p-8 text-center">
      <div className="mx-auto grid size-20 place-items-center rounded-[28px] bg-lime-300 text-4xl">🍀</div>
      <h1 className="mt-5 text-3xl font-black text-lime-950">CA Clover</h1>
      <p className="mt-2 text-sm font-semibold text-slate-500">Japan Community Activity Dashboard</p>

      {user ? (
        <>
          <div className="mt-7 rounded-2xl bg-lime-50 p-4 text-sm font-bold text-lime-900">ログイン済みです</div>
          <div className="mt-4 grid gap-2">
            <Link href={nextPath} className="rounded-2xl bg-lime-400 px-5 py-3.5 text-sm font-black text-lime-950">{nextPath==="/my"?"My Communityへ":"元の画面へ戻る"}</Link>
            <Link href="/account" className="rounded-2xl border border-lime-200 bg-white px-5 py-3.5 text-sm font-black text-lime-800">アカウント設定</Link>
          </div>
        </>
      ) : (
        <button onClick={login} className="mt-8 w-full rounded-2xl bg-lime-400 px-5 py-3.5 text-sm font-black text-lime-950">G　Googleでログイン</button>
      )}

      {error ? <p className="mt-4 text-xs font-bold text-rose-600">{error}</p> : null}
      <p className="mt-4 text-xs font-semibold leading-5 text-slate-400">初回ログイン後にNiantic IDを登録し、自分が主催したMeetupを提出してください。承認されるとCAアカウントとCommunityが同時に有効になります。</p>
    </section>
  </main>;
}
