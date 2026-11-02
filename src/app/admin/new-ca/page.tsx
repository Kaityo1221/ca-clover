"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import NewCaApprovalDeck, { type NewCaReviewCard } from "@/components/new-ca-approval-deck";
import { useAuthProfile } from "@/lib/use-auth-profile";

// Synthetic UI fixtures only. No real CA identifiers, Discord IDs, or write endpoints.
// The live application queue will require a new, server-authenticated bridge and an
// explicitly approved production migration. Existing account tables are unchanged.
const PREVIEW: NewCaReviewCard[] = [
  {
    id: "synthetic-001",
    trainerName: "SyntheticCA0001",
    discordDisplayName: "テスト参加者 A",
    discordUsername: "synthetic_ca_1",
    discordNickname: "テストCA 1",
    discordUserId: null,
    displayNameSource: "not_verified",
    campfireUrl: "架空のCommunity URL（プレビュー）",
    status: "pending_admin",
  },
  {
    id: "synthetic-002",
    trainerName: "SyntheticCA0002",
    discordDisplayName: "テスト参加者 B",
    discordUsername: "synthetic_ca_2",
    discordNickname: null,
    discordUserId: null,
    displayNameSource: "not_verified",
    campfireUrl: "架空のCommunity URL（プレビュー）",
    status: "held",
  },
  {
    id: "synthetic-003",
    trainerName: "SyntheticCA0003",
    discordDisplayName: "テスト参加者 C",
    discordUsername: "synthetic_ca_3",
    discordNickname: "テストCA 3",
    discordUserId: null,
    displayNameSource: "not_verified",
    campfireUrl: "架空のCommunity URL（プレビュー）",
    status: "pending_admin",
  },
];

export default function NewCaApprovalPreviewPage() {
  const { supabase, user, profile, loading, error, retry } = useAuthProfile();
  const [liveQueue, setLiveQueue] = useState<NewCaReviewCard[] | null>(null);
  const [connectionState, setConnectionState] = useState<"checking" | "isolated" | "disabled">("checking");

  useEffect(() => {
    if (loading || !user || profile?.role !== "admin" || error) return;
    let alive = true;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) { if (alive) setConnectionState("disabled"); return; }
      try {
        const response = await fetch("/api/new-ca/bridge", {
          cache: "no-store",
          headers: { Authorization: "Bearer " + session.access_token },
        });
        if (!response.ok) throw Error("disabled");
        const data = await response.json();
        if (!data.isolated || data.productionActivated !== false ||
            !Array.isArray(data.applications)) throw Error("invalid");
        if (alive) {
          setLiveQueue(data.applications as NewCaReviewCard[]);
          setConnectionState("isolated");
        }
      } catch {
        if (alive) { setLiveQueue(null); setConnectionState("disabled"); }
      }
    })();
    return () => { alive = false; };
  }, [loading, user, profile?.role, error, supabase]);

  if (loading) return <main className="grid min-h-[70vh] place-items-center text-sm font-black text-lime-800">
    🍀 認証を確認中…
  </main>;

  if (error) return <main className="mx-auto max-w-lg px-4 py-16 text-center">
    <h1 className="text-xl font-black text-lime-950">認証情報を確認できません</h1>
    <p className="mt-3 text-sm text-slate-600">{error}</p>
    <button type="button" onClick={retry} className="mt-5 rounded-full bg-lime-400 px-5 py-3 text-sm font-black">再確認</button>
  </main>;

  if (!user) return <main className="mx-auto max-w-lg px-4 py-16 text-center">
    <h1 className="text-xl font-black text-lime-950">Googleログインが必要です</h1>
    <Link href="/login?next=%2Fadmin%2Fnew-ca" className="mt-5 inline-block rounded-full bg-lime-400 px-5 py-3 text-sm font-black">
      ログイン
    </Link>
  </main>;

  if (profile?.role !== "admin") return <main className="grid min-h-[70vh] place-items-center text-sm font-black text-slate-600">
    🔒 ADMIN専用です
  </main>;

  return <main className="mx-auto max-w-5xl px-4 py-7 md:px-8">
    <Link href="/admin" className="text-sm font-black text-lime-700">← 管理メニュー</Link>
    <div className="mt-5 flex flex-wrap items-center gap-3">
      <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-800">開発プレビュー / 申請データは架空</span>
      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">実承認は無効</span>
    </div>
    <h1 className="mt-4 text-3xl font-black text-lime-950">🪪 新規CA承認</h1>
    <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-slate-600">
      Discord認証から会長承認までの管理画面をCA Cloverに統合するためのデザイン確認用です。
      表裏の切り替えとスワイプは操作できますが、申請取得・承認・アカウント変更は行いません。
    </p>
    <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold leading-6 text-amber-900">
      この画面の3件はテスト用サンプルです。実際の審査待ち人数ではありません。
      既存CAのGoogleログイン、メダル、Meetup履歴、所属Communityには影響しません。
    </div>
    <div className="mt-5 text-sm font-black text-slate-600" aria-live="polite">
      {connectionState === "isolated"
        ? "🧪 隔離Neonの申請 " + (liveQueue?.length ?? 0) + "件を読み込みました。実承認は無効です。"
        : connectionState === "checking"
          ? "隔離申請との接続を確認中…"
          : "隔離申請接続はOFFです。以下は架空のデザイン確認用カードです。"}
    </div>
    <div className="mt-7"><NewCaApprovalDeck applications={liveQueue ?? PREVIEW}/></div>
  </main>;
}
