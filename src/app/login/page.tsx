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
  const [isOnboardingPreview, setIsOnboardingPreview] = useState(false);
  const [diagnostic, setDiagnostic] = useState<string | null>(null);
  const previewOAuthEnabled = process.env.NEXT_PUBLIC_NEW_CA_PREVIEW_OAUTH_READY === "true";

  useEffect(()=>{
    const params=new URLSearchParams(window.location.search);
    setNextPath(sanitizeNextPath(params.get("next"),"/my"));
    setIsOnboardingPreview(window.location.hostname.endsWith(".vercel.app") && (params.get("next") === "/admin/new-ca" || params.get("next") === "/new-ca/link"));
  },[]);

  async function checkRedirect() {
    const supabase = createBrowserSupabaseClient();
    setDiagnostic("確認中…");
    const requested = window.location.origin + nextPath;
    const { data, error: authError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: requested, skipBrowserRedirect: true },
    });
    if (authError || !data?.url) {
      setDiagnostic("認証リクエストを確認できませんでした。");
      return;
    }
    try {
      const url = new URL(data.url);
      const sent = url.searchParams.get("redirect_to");
      setDiagnostic(sent === requested
        ? "検査PASS：プレビューの戻り先を正しく送信しています。"
        : "検査FAIL：指定した戻り先と送信値が一致しません。");
    } catch {
      setDiagnostic("認証リクエストの解析に失敗しました。");
    }
  }

  async function login(){
    if (isOnboardingPreview && !previewOAuthEnabled) {
      setError("この検証環境のGoogleログインは本番へ移動するため停止しています。下の隔離テストサイトから認証してください。");
      return;
    }
    const supabase=createBrowserSupabaseClient();
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider:"google",
      options:{redirectTo:window.location.origin+nextPath, ...(isOnboardingPreview ? { queryParams: { prompt: "select_account" } } : {})}
    });
    if (error) setError(error.message);
  }

  if (loading) return <main className="grid min-h-screen place-items-center text-sm font-black text-lime-800">🍀 読み込み中...</main>;

  return <main className="grid min-h-screen place-items-center px-4">
    <section className="clover-card w-full max-w-md p-8 text-center">
      <div className="mx-auto grid size-20 place-items-center rounded-[28px] bg-lime-300 text-4xl">🍀</div>
      <h1 className="mt-5 text-3xl font-black text-lime-950">CA Clover</h1>
      <p className="mt-2 text-sm font-semibold text-slate-500">Japan Community Activity Dashboard</p>

      {isOnboardingPreview && !previewOAuthEnabled ? (
        <div className="mt-7 space-y-4 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-left text-sm font-bold leading-6 text-amber-900">
          <p>⚠️ 新規CA承認の検証用プレビューでは、Googleログインの戻り先が許可されるまで認証を停止しています。</p>
          <p>プレビュー専用URLがSupabase AuthのRedirect URLsに登録された後、安全確認してログインを有効にします。</p>
          <a href="https://ca-clover-discord-oauth.vercel.app/admin-preview.html" className="block rounded-xl bg-lime-400 px-4 py-3 text-center font-black text-lime-950">🍀 隔離CA承認テストを開く</a>
          <p className="text-xs font-semibold">CA Clover本番の権限やログイン設定は変更しません。</p>
        </div>
      ) : user ? (
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

      {isOnboardingPreview && previewOAuthEnabled ? (
        <div className="mt-4 space-y-2">
          <button type="button" onClick={checkRedirect} className="w-full rounded-xl border border-lime-200 px-4 py-3 text-sm font-bold text-lime-900">認証の戻り先を検査（ログインせず確認）</button>
          {diagnostic ? <p role="status" className="rounded-xl bg-lime-50 p-3 text-left text-sm font-semibold text-lime-900">{diagnostic}</p> : null}
        </div>
      ) : null}
      {error ? <p className="mt-4 text-xs font-bold text-rose-600">{error}</p> : null}
      <p className="mt-4 text-xs font-semibold leading-5 text-slate-400">初回ログイン後にNiantic IDを登録し、自分が主催したMeetupを提出してください。承認されるとCAアカウントとCommunityが同時に有効になります。</p>
    </section>
  </main>;
}
