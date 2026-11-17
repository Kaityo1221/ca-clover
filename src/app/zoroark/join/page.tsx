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
type ExistingSession = "same" | "other" | null;
export default function JoinPage(){
  const [invite,setInvite]=useState("");
  const [room,setRoom]=useState<RoomInfo|null>(null);
  const [nickname,setNickname]=useState("");
  const [status,setStatus]=useState("");
  const [busy,setBusy]=useState(true);
  const [done,setDone]=useState(false);
  const [existingSession,setExistingSession]=useState<ExistingSession>(null);
  const [switchConfirmed,setSwitchConfirmed]=useState(false);
  useEffect(()=>{
    const hash=window.location.hash;
    const raw=new URLSearchParams(hash.replace(/^#/,"")).get("invite")??"";
    // Never keep a reusable invite in browser history or the query string.
    window.history.replaceState(null,"",window.location.pathname);
    if(!/^[a-f0-9]{64}$/.test(raw)){setStatus("招待QRが正しくありません。");setBusy(false);return}
    setInvite(raw);
    guestCall({action:"inspect",invite:raw})
      .then(async (result:RoomInfo)=>{
        setRoom(result);
        // Check the current HttpOnly-cookie session through the server, never by reading secrets in JS.
        try {
          const current=await guestCall({action:"me"});
          if(typeof current.roomId==="string" &&
             (current.state==="pending"||current.state==="approved")){
            setExistingSession(current.roomId===result.roomId?"same":"other");
          }
        }catch{
          // No active session is normal for a first-time guest.
        }
      })
      .catch((e:Error)=>setStatus(messages[e.message]??"招待情報を確認できません。"))
      .finally(()=>setBusy(false));
  },[]);
  async function join(){
    if(busy||!room||!invite||existingSession==="same"||
      (existingSession==="other"&&!switchConfirmed))return;
    setBusy(true);setStatus("");
    try{
      await guestCall({action:"join",invite,nickname});
      setInvite("");setDone(true);
    }catch(e){
      const code=(e as Error).message;
      if(code==="already_joined"){
        setExistingSession("same");
        setStatus("");
      }else{
        setStatus(messages[code]??"入室に失敗しました。");
      }
    }
    finally{setBusy(false)}
  }
  return <main className="mx-auto max-w-md px-5 py-10">
    <h1 className="text-3xl font-black">🦊 ゾロアークを探せ！</h1>
    <p className="mt-2 text-slate-600">一般トレーナー用・ゲスト参加</p>
    <section className="mt-6 space-y-4 rounded-2xl border bg-white p-5 shadow-sm">
      {done?<><h2 className="text-xl font-black">参加申請が完了しました！</h2>
       <p>GMの承認をお待ちください。この端末で試合中のページを開けます。</p>
       <Link className="block rounded-xl bg-lime-400 p-4 text-center font-bold" href="/zoroark/guest">専用ページを開く</Link></>:
       <>
       {room&&existingSession==="same"&&<div className="space-y-3 rounded-xl bg-lime-50 p-4">
         <p className="font-bold text-lime-950">✅ この端末はすでにこのルームへ参加しています。</p>
         <p className="text-sm text-slate-700">再申請は不要です。参加状態の確認や再表示は専用ページから行えます。</p>
         <Link href="/zoroark/guest" className="block rounded-xl bg-lime-400 p-4 text-center font-black">参加中の専用ページへ</Link>
       </div>}
       {room&&existingSession==="other"&&!switchConfirmed&&<div className="space-y-3 rounded-xl bg-amber-50 p-4">
         <p className="font-bold">このブラウザでは別のルームに参加しています。</p>
         <p className="text-sm text-slate-700">別の参加者が参加する場合は、別端末をご利用ください。この端末を新しいルームに切り替えると、以前のルームの専用ページにはこのブラウザから戻れなくなる場合があります。</p>
         <Link href="/zoroark/guest" className="block rounded-xl bg-white p-3 text-center font-bold">現在参加中の専用ページへ</Link>
         <button type="button" onClick={()=>setSwitchConfirmed(true)}
           className="w-full rounded-xl border border-amber-600 bg-white p-3 font-bold">以前の参加ページを離れて新しいルームへ進む</button>
       </div>}
       {room&&existingSession!=="same"&&(existingSession!=="other"||switchConfirmed)&&<>
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
       {status&&!room&&<Link href="/zoroark/guest"
         className="block rounded-xl bg-slate-100 p-3 text-center font-bold">すでに参加した方は専用ページへ</Link>}
       </>}
    </section>
    <p className="mt-4 text-xs text-slate-500">ログイン不要。試合限りのCookieを使用し、広告追跡には使いません。</p>
  </main>;
}
