"use client";

import { createBrowserSupabaseClient } from "@/lib/supabase";

export default function Page(){
  async function login(){
    const supabase=createBrowserSupabaseClient();
    if(!supabase){ alert("Supabase環境変数が未設定です。"); return; }
    await supabase.auth.signInWithOAuth({provider:"google",options:{redirectTo:window.location.origin+"/my"}});
  }
  return <main className="grid min-h-screen place-items-center px-4">
    <section className="clover-card w-full max-w-md p-8 text-center">
      <div className="mx-auto grid size-20 place-items-center rounded-[28px] bg-lime-300 text-4xl">🍀</div>
      <h1 className="mt-5 text-3xl font-black text-lime-950">CA Clover</h1>
      <p className="mt-2 text-sm font-semibold text-slate-500">Japan Community Activity Dashboard</p>
      <button onClick={login} className="mt-8 w-full rounded-2xl bg-lime-400 px-5 py-3.5 text-sm font-black text-lime-950">G　Googleでログイン</button>
      <p className="mt-4 text-xs font-semibold leading-5 text-slate-400">初回ログイン後にNiantic IDを登録し、管理者がCommunityを割り当てます。</p>
    </section>
  </main>;
}
