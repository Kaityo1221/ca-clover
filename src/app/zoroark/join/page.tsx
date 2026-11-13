"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

async function guestCall(data: Record<string,unknown>) {
  const response=await fetch("/api/zoroark/guest",{
    method:"POST",credentials:"same-origin",cache:"no-store",
    headers:{"Content-Type":"application/json","X-Zoroark-Request":"guest-lobby-v1"},
    body:JSON.stringify(data),
  });
  const result=await response.json().catch(()=>({error:"unknown"}));
  if(!response.ok)throw new Error(result.error??"guest_service_unavailable");
  return result;
}
const messages:Record<string,string>={
  guest_lobby_unavailable:"現在は開発中です。参加受付はまだ開始していません。",
  invalid_invite:"この招待QRを利用できません。",
  expired_or_closed:"招待期限が切れたか、受付が終了しました。",
  expired_or_full:"満員または招待受付終了です。",
  nickname_unavailable:"このニックネームは既に使用されています。",
  invalid_nickname:"1〜24文字のニックネームを入力してください。",
  already_joined:"この端末はすでに参加申請済みです。専用ページを開いてください。",
  guest_service_unavailable:"参加サーバーへ接続できません。",
};
type RoomInfo={roomId:string;maxPlayers:number;occupied:number;joinExpiresAt:string};
export default function JoinPage(){
  const [invite,setInvite]=useState("");
  const [room,setRoom]=useState<RoomInfo|null>(null);
  const [nickname,setNickname]=useState("");
  const [status,setStatus]=useState("");
  const [busy,setBusy]=useState(true);
  const [done,setDone]=useState(false);
  useEffect(()=>{
    const hash=window.location.hash;
    const raw=new URLSearchParams(hash.replace(/^#/,"")).get("invite")??"";
    // Never keep a reusable invite in browser history or the query string.
    window.history.replaceState(null,"",window.location.pathname);
    if(!/^[a-f0-9]{64}$/.test(raw)){setStatus("招待QRが正しくありません。");setBusy(false);return}
    setInvite(raw);
    guestCall({action:"inspect",invite:raw})
      .then((result:RoomInfo)=>setRoom(result))
      .catch((e:Error)=>setStatus(messages[e.message]??"招待情報を確認できません。"))
      .finally(()=>setBusy(false));
  },[]);
  async function join(){
    if(busy||!room||!invite)return;
    setBusy(true);setStatus("");
    try{
      await guestCall({action:"join",invite,nickname});
      setInvite("");setDone(true);
    }catch(e){setStatus(messages[(e as Error).message]??"入室に失敗しました。")}
    finally{setBusy(false)}
  }
  return <main className="mx-auto max-w-md px-5 py-10">
    <h1 className="text-3xl font-black">🦊 ゾロアークを探せ！</h1>
    <p className="mt-2 text-slate-600">一般トレーナー用・ゲスト参加</p>
    <section className="mt-6 space-y-4 rounded-2xl border bg-white p-5 shadow-sm">
      {done?<><h2 className="text-xl font-black">参加申請が完了しました！</h2>
       <p>GMの承認をお待ちください。この端末で試合中のページを開けます。</p>
       <Link className="block rounded-xl bg-lime-400 p-4 text-center font-bold" href="/zoroark/guest">専用ページを開く</Link></>:
       <>{room&&<>
        <p className="font-bold">受付：{room.occupied}/{room.maxPlayers}人</p>
        <p className="text-sm">招待期限：{new Date(room.joinExpiresAt).toLocaleString("ja-JP")}</p>
        <label htmlFor="guest-nickname" className="block font-bold">ニックネーム（24文字以内）</label>
        <input id="guest-nickname" maxLength={24} autoComplete="off" value={nickname}
          onChange={e=>setNickname(e.target.value)}
          className="w-full rounded-xl border p-3" placeholder="トレーナー名"/>
        <button type="button" disabled={busy||!nickname.trim()} onClick={join}
          className="w-full rounded-xl bg-lime-400 p-4 font-black disabled:opacity-50">参加申請する</button>
       </>}
       {busy&&<p>招待情報を確認しています...</p>}
       {status&&<p role="alert" className="rounded-xl bg-red-50 p-3 font-bold text-red-700">{status}</p>}
       </>}
    </section>
    <p className="mt-4 text-xs text-slate-500">ログイン不要。試合限りのCookieを使用し、広告追跡には使いません。</p>
  </main>;
}
