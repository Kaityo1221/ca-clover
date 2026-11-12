"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
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
  joinEnabled: boolean;
};

function QRInvite({room}:{room:RoomCreated}){
 const [qr,setQr]=useState("");
 const [error,setError]=useState("");
 const enabled=room.joinEnabled&&/^[a-f0-9]{64}$/.test(room.invite);
 useEffect(()=>{
  if(!enabled)return;
  const url=window.location.origin+"/zoroark/join#invite="+room.invite;
  // Generate QR inside the browser. Never send invite to a remote QR image provider.
  QRCode.toDataURL(url,{width:320,margin:2,errorCorrectionLevel:"M"})
   .then(setQr).catch(()=>setError("QRコードを生成できませんでした。"));
 },[room,enabled]);
 if(!enabled)return <p className="rounded-xl bg-amber-50 p-3 font-bold text-amber-900">
  QR招待は未有効化です。ゲストAPIとDBの安全試験が済むまで配布しないでください。
 </p>;
 return <div className="space-y-3">
   <p className="font-bold">📱 一般トレーナーにこのQRコードを読み取ってもらいます</p>
   {qr&&<img alt="このゲームの招待QRコード" width={320} height={320} src={qr}
     className="mx-auto max-w-full rounded-xl border p-2" />}
   {error&&<p role="alert">{error}</p>}
   <p className="text-sm text-amber-800">招待資格はQRの中だけに含まれます。SNSに公開せず、現地参加者だけに提示してください。</p>
   <GMLobby roomId={room.roomId}/>
  </div>;
}
type Participant={id:string;display_name:string;state:"pending"|"approved"|"rejected"};
function GMLobby({roomId}:{roomId:string}){
 const {supabase}=useAuthProfile();
 const [participants,setParticipants]=useState<Participant[]>([]);
 const [locked,setLocked]=useState(false);
 const [message,setMessage]=useState("");
 const [busy,setBusy]=useState(false);
 async function request(action:string,guestId?:string){
  if(busy)return;setBusy(true);setMessage("");
  try{
   const {data}=await supabase.auth.getSession();
   if(!data.session?.access_token)throw Error("ログインし直してください。");
   const response=await fetch("/api/zoroark/gm",{
    method:"POST",cache:"no-store",
    headers:{"Content-Type":"application/json","X-Zoroark-Request":"gm-lobby-v1",
      Authorization:"Bearer "+data.session.access_token},
    body:JSON.stringify({action,roomId,guestId}),
   });
   const result=await response.json();
   if(!response.ok)throw Error(result.error??"ロビーの取得に失敗しました");
   if(action==="list"){setParticipants(result.participants);setLocked(result.room.locked)}
   else await refresh();
  }catch(e){setMessage((e as Error).message)}finally{setBusy(false)}
 }
 // Fetch latest state on explicit action. Avoid polling sensitive endpoint without user intent.
 async function refresh(){
  const {data}=await supabase.auth.getSession();
  if(!data.session?.access_token)throw Error("認証セッションがありません");
  const response=await fetch("/api/zoroark/gm",{
   method:"POST",cache:"no-store",headers:{"Content-Type":"application/json",
    "X-Zoroark-Request":"gm-lobby-v1",Authorization:"Bearer "+data.session.access_token},
   body:JSON.stringify({action:"list",roomId}),
  });
  if(!response.ok)throw Error("ロビーを更新できません");
  const result=await response.json();
  setParticipants(result.participants);setLocked(result.room.locked);
 }
 return <div className="rounded-xl border p-3 space-y-3">
  <h3 className="font-black">👑 GM入室管理</h3>
  <button onClick={()=>request("list")} disabled={busy} className="rounded-lg bg-slate-200 px-3 py-2 font-bold">参加者を更新</button>
  <button onClick={()=>request(locked?"unlock":"lock")} disabled={busy}
    className="ml-2 rounded-lg bg-yellow-200 px-3 py-2 font-bold">{locked?"受付を再開":"受付を締切"}</button>
  {participants.map(p=><div key={p.id} className="flex items-center justify-between gap-2 border-t py-2">
    <span className="break-all">{p.display_name} ({p.state==="pending"?"承認待ち":p.state==="approved"?"承認済み":"拒否"})</span>
    {p.state==="pending"&&<div className="flex gap-1">
      <button disabled={busy} onClick={()=>request("approve",p.id)}
        className="rounded bg-lime-300 p-2">承認</button>
      <button disabled={busy} onClick={()=>request("reject",p.id)}
        className="rounded bg-rose-200 p-2">拒否</button>
    </div>}
  </div>)}
  {message&&<p role="alert" className="text-rose-700">{message}</p>}
 </div>;
}
const readableErrors: Record<string, string> = {
  ca_role_required: "CAとして認証されているアカウントが必要です。",
  unauthorized: "ログインし直してください。",
  room_limit_reached: "同時に作成できるゲームルームは3件までです。",
  room_storage_unavailable: "ルーム保存先の準備がまだ完了していません。",
  room_create_failed: "ルームを作成できませんでした。",
  isolated_room_api_not_configured: "隔離DBへの安全な接続設定がまだ完了していません。",
  isolated_database_mismatch: "隔離DBの接続先が一致しないため、安全のため作成を停止しました。",
  isolated_room_service_unavailable: "隔離DBに接続できません。管理者が環境設定を確認してください。",
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
      const { data: authData, error: authError } = await supabase.auth.getSession();
      const accessToken = authData.session?.access_token;
      if (authError || !accessToken) throw new Error("ログインセッションがありません。再ログインしてください。");
      // The server independently verifies this token and current CA role with Supabase Auth.
      const response = await fetch("/api/zoroark/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + accessToken },
        body: JSON.stringify({ action: "create", mode, maxPlayers, talkSeconds }),
        cache: "no-store",
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data || typeof data.roomId !== "string" || typeof data.joinEnabled !== "boolean") {
        const code = data && typeof data.error === "string" ? data.error : "";
        throw new Error(readableErrors[code] ?? "ルーム作成サービスが準備できていません。隔離環境の接続を確認してください。");
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
      <div className="mt-5"><QRInvite room={room}/></div>
      <p className="mt-2 text-xs text-slate-500">招待資格はこの画面だけに表示され、ページを再読込すると復元できません。</p>
    </section>}
  </main>;
}
