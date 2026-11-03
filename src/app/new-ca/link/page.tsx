"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAuthProfile } from "@/lib/use-auth-profile";

type LinkedApplication = {
  id: string;
  trainerName: string;
  discordDisplayName: string | null;
  status: string;
  cloverLinked: boolean;
  cloverLinkedByViewer: boolean;
  sameGoogleAsViewer: boolean;
};

export default function NewCaGoogleLinkPage() {
  const { supabase, user, profile, loading, error } = useAuthProfile();
  const [applications, setApplications] = useState<LinkedApplication[]>([]);
  const [state, setState] = useState<"checking" | "ready" | "blocked" | "done">("checking");
  const [message, setMessage] = useState("Googleアカウントの照合を確認しています…");
  const [busy, setBusy] = useState(false);
  const [identityDiagnostic, setIdentityDiagnostic] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user || !profile) return;
    setState("checking");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw Error("Googleログインを確認できません");
      const r = await fetch("/api/new-ca/bridge", {
        cache: "no-store",
        headers: { Authorization: "Bearer " + session.access_token },
      });
      const d = await r.json();
      if (!r.ok || !d.isolated || d.productionActivated !== false) throw Error("隔離接続が準備中です");
      const own = (d.applications as LinkedApplication[]).filter(x => x.sameGoogleAsViewer);
      setApplications(own);
      if (own.length === 1 && own[0].cloverLinkedByViewer && profile.role === "pending") {
        setState("done");
        setMessage("隔離環境でGoogle本人照合が記録されています。本番権限は変更されていません。");
      } else if (own.length === 1 && !own[0].cloverLinked && profile.role === "pending") {
        setState("ready");
        setMessage("同じGoogleアカウントによるDiscord申請が1件見つかりました。");
      } else {
        setState("blocked");
        setMessage(own.length ? "この申請は別のユーザーに連携済み、または既存CA・ADMIN保護の対象です。" : "このGoogleアカウントに一致する隔離申請はありません。");
      }
    } catch {
      setState("blocked");
      setMessage("隔離テストの接続は現在利用できません。既存のCA Cloverデータは変更していません。");
    }
  }, [profile, supabase, user]);

  useEffect(() => { if (!loading && user && profile && !error) { void refresh(); } }, [loading, user, profile, error, refresh]);

  useEffect(() => {
    if (loading || !user || profile) return;
    let active = true;
    void (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) return;
        const response = await fetch("/api/new-ca/identity-diagnostic", {
          cache: "no-store", headers: { Authorization: "Bearer " + session.access_token },
        });
        const result = await response.json();
        if (active) setIdentityDiagnostic(typeof result.code === "string" ? result.code : "UNKNOWN");
      } catch {
        if (active) setIdentityDiagnostic("DIAGNOSTIC_UNAVAILABLE");
      }
    })();
    return () => { active = false; };
  }, [loading, user, profile, supabase]);

  async function bind() {
    if (busy || state !== "ready" || applications.length !== 1 || profile?.role !== "pending") return;
    setBusy(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw Error("ログインが必要です");
      const r = await fetch("/api/new-ca/bridge", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + session.access_token },
        body: JSON.stringify({ action: "bind", requestId: applications[0].id }),
      });
      const d = await r.json();
      if (!r.ok || d.productionActivated !== false || d.isolatedLinked !== true) throw Error("連携に失敗しました");
      setState("done");
      setMessage("隔離NeonにGoogle本人照合の結果を保存しました。本番CA権限は付与されていません。");
    } catch {
      setMessage("本人照合を完了できませんでした。重複申請や既存の権限がある場合は拒否します。");
    } finally { setBusy(false); }
  }

  if (loading) return <main className="p-8 text-center font-black text-lime-900">🍀 ログイン確認中…</main>;
  if (!user) return <main className="mx-auto max-w-lg p-8 text-center">
    <p className="font-black text-lime-950">CA CloverのGoogleログインが必要です。</p>
    <Link href="/login?next=%2Fnew-ca%2Flink" className="mt-5 inline-block rounded-full bg-lime-400 px-5 py-3 font-black">Googleログイン</Link>
  </main>;
  if (error || !profile) return <main className="mx-auto max-w-xl p-8 text-center"><h1 className="text-xl font-black text-lime-950">🍀 Google認証後の登録状態を確認</h1><p className="mt-4 font-semibold leading-7 text-amber-800">Googleログイン後のCA Cloverプロフィールを確認できません。初回利用でpending登録がまだない可能性があります。隔離Neonの接続障害と断定できません。</p><p className="mt-3 text-sm font-bold text-slate-700" role="status">診断結果：{identityDiagnostic ?? "確認中"}</p><p className="mt-4 text-sm text-slate-600">既存のCA権限は変更していません。管理者が新規ユーザー登録経路を確認するまで、再ログインや本人紐付けを繰り返す必要はありません。</p></main>;

  return <main className="mx-auto max-w-xl px-4 py-9">
    <Link href="/" className="text-sm font-black text-lime-700">← CA Cloverへ</Link>
    <h1 className="mt-5 text-3xl font-black text-lime-950">🍀 新規CAのGoogle本人照合</h1>
    <p className="mt-3 text-sm font-semibold leading-7 text-slate-600">
      Discord認証時とCA CloverのGoogleログインが、同じGoogleアカウントであることを確認します。
      ユーザーIDを付け替えたり、既存のCAデータを更新したりしません。
    </p>
    <section className="clover-card mt-6 rounded-3xl p-6">
      <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-800">隔離テスト / 本番権限は変更しません</span>
      <p className="mt-5 font-black text-lime-950" role="status">{message}</p>
      {applications.length === 1 ? <div className="mt-5 rounded-2xl bg-lime-50 p-4">
        <p className="text-xs font-black text-slate-500">一致した申請</p>
        <p className="mt-1 break-words text-lg font-black text-lime-950">{applications[0].trainerName}</p>
        <p className="mt-1 break-words text-sm font-bold text-slate-600">{applications[0].discordDisplayName ?? "Discord表示名未取得"}</p>
      </div> : null}
      <button type="button" onClick={bind} disabled={busy || state !== "ready"} className="mt-6 w-full rounded-2xl bg-lime-400 px-5 py-4 font-black text-lime-950 disabled:opacity-40">
        {busy ? "照合中…" : state === "done" ? "隔離連携済み" : "Google本人照合を隔離環境に記録"}
      </button>
      <button type="button" onClick={() => void refresh()} disabled={busy} className="mt-3 w-full rounded-2xl border border-lime-200 px-5 py-3 text-sm font-black text-lime-800">状態を更新</button>
    </section>
    <p className="mt-5 text-xs font-semibold leading-6 text-slate-500">管理者承認と本番CAアカウント有効化は別工程です。このページからの本番承認はできません。</p>
  </main>;
}
