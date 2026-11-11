"use client";

import Link from "next/link";
import { useState } from "react";
import { useAuthProfile } from "@/lib/use-auth-profile";

type RoomCreated = {
  roomId: string;
  status: "lobby";
  mode: "simple" | "manual";
  maxPlayers: number;
  talkSeconds: number;
  joinExpiresAt: string;
  expiresAt: string;
  invite: string;
  joinEnabled: false;
};

const readableErrors: Record<string, string> = {
  ca_role_required: "CAとして認証されているアカウントが必要です。",
  unauthorized: "ログインし直してください。",
  room_limit_reached: "同時に作成できるゲームルームは3件までです。",
  room_storage_unavailable: "ルーム保存先の準備がまだ完了していません。",
  room_create_failed: "ルームを作成できませんでした。",
  origin_not_allowed: "このアクセス元は許可されていません。",
  not_configured: "サーバー設定が完了していません。",
};

export default function ZoroarkRoomCreatePage() {
  const { supabase, user, profile, loading } = useAuthProfile();
  const [mode, setMode] = useState<"simple" | "manual">("manual");
  const [maxPlayers, setMaxPlayers] = useState(6);
  const [talkSeconds, setTalkSeconds] = useState(180);
  const [room, setRoom] = useState<RoomCreated | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const authorized = Boolean(user && (profile?.role === "ca" || profile?.role === "admin"));

  async function createRoom() {
    if (!authorized || busy || room) return;
    setBusy(true);
    setError("");
    try {
      const { data, error: apiError } = await supabase.functions.invoke("zoroark-room-admin", {
        body: { action: "create", mode, maxPlayers, talkSeconds },
      });
      if (apiError || !data || typeof data.roomId !== "string" || data.joinEnabled !== false) {
        const context = apiError && "context" in apiError ? apiError.context : null;
        const details = context instanceof Response
          ? await context.clone().json().catch(() => null)
          : data;
        const code = details && typeof details.error === "string" ? details.error : "";
        throw new Error(readableErrors[code] ?? "ルーム作成APIを利用できません。隔離環境の設定・認証を確認してください。");
      }
      setRoom(data as RoomCreated);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "ルームを作成できませんでした。");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <main className="mx-auto max-w-lg p-6">🍀 CA認証を確認中...</main>;
  if (!user) return <main className="mx-auto max-w-lg p-6">
    <h1 className="text-2xl font-black">🦊 ゾロアーク ルーム作成</h1>
    <p className="mt-4">ゲームマスターはCA Cloverへのログインが必要です。</p>
    <Link className="mt-5 inline-block rounded-xl bg-lime-400 px-5 py-3 font-bold" href="/login?next=%2Fzoroark%2Frooms">ログインへ</Link>
  </main>;
  if (!authorized) return <main className="mx-auto max-w-lg p-6">
    <h1 className="text-2xl font-black">🔒 CA限定機能</h1>
    <p className="mt-4">ルームの作成は認証済みのCAだけが利用できます。</p>
    <Link href="/my" className="mt-4 inline-block underline">My Communityへ戻る</Link>
  </main>;

  return <main className="mx-auto max-w-xl px-4 py-8">
    <Link href="/my" className="text-sm font-bold text-lime-800">← My Community</Link>
    <h1 className="mt-4 text-3xl font-black text-lime-950">🦊 ゾロアークを探せ！</h1>
    <p className="mt-2 font-semibold text-slate-500">GM専用ルーム作成（隔離開発版）</p>

    {!room ? <section className="mt-6 space-y-5 rounded-3xl border border-lime-200 bg-white p-5 shadow-sm">
      <div>
        <label htmlFor="zg-room-mode" className="block font-bold">ゲームモード</label>
        <select id="zg-room-mode" className="mt-2 w-full rounded-xl border border-slate-300 p-3"
          value={mode} onChange={e => setMode(e.target.value as "simple" | "manual")}>
          <option value="simple">シンプル</option>
          <option value="manual">マニュアル（ミミッキュ）</option>
        </select>
      </div>
      <div>
        <label htmlFor="zg-room-count" className="block font-bold">参加人数（GMを除く）</label>
        <select id="zg-room-count" className="mt-2 w-full rounded-xl border border-slate-300 p-3"
          value={maxPlayers} onChange={e => setMaxPlayers(Number(e.target.value))}>
          {Array.from({ length: 10 }, (_, i) => i + 3).map(n => <option key={n} value={n}>{n}人</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="zg-room-time" className="block font-bold">トーク時間</label>
        <select id="zg-room-time" className="mt-2 w-full rounded-xl border border-slate-300 p-3"
          value={talkSeconds} onChange={e => setTalkSeconds(Number(e.target.value))}>
          <option value={120}>2分</option>
          <option value={180}>3分</option>
          <option value={300}>5分</option>
          <option value={0}>制限なし</option>
        </select>
      </div>
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}
      <button type="button" onClick={createRoom} disabled={busy}
        className="w-full rounded-xl bg-lime-400 px-5 py-4 text-lg font-black text-lime-950 disabled:opacity-50">
        {busy ? "ルーム作成中..." : "🍀 新しいルームを作る"}
      </button>
      <p className="text-xs text-slate-500">この段階ではQR入室・ゲスト参加は未接続です。実際の参加者には共有しないでください。</p>
    </section> : <section className="mt-6 rounded-3xl border border-lime-200 bg-white p-5 shadow-sm">
      <span className="inline-block rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-900">🛠️ 入室機能は開発中</span>
      <h2 className="mt-4 text-xl font-black">ルームを作成しました</h2>
      <p className="mt-3 font-semibold">ルームID</p>
      <output className="mt-1 block break-all rounded-xl bg-slate-100 p-3 font-mono text-xs">{room.roomId}</output>
      <p className="mt-3 text-sm">最大 {room.maxPlayers}人・招待期限 {new Date(room.joinExpiresAt).toLocaleString("ja-JP")}</p>
      <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm font-bold text-amber-900">
        QRコードおよび一般参加者の入室ページは次の工程で実装します。現時点では招待リンクを発行しません。
      </p>
      <p className="mt-2 text-xs text-slate-500">招待資格はサーバーから一度だけ発行され、この画面からは表示・保存しません。</p>
    </section>}
  </main>;
}
