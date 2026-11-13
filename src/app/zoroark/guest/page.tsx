"use client";
import { useEffect,useState } from "react";
type Guest={roomId:string;nickname:string;state:"pending"|"approved"|"rejected";expiresAt:string};
export default function GuestPage(){
 const [guest,setGuest]=useState<Guest|null>(null),[message,setMessage]=useState("認証中...");
 async function refresh(){
  try{
   const response=await fetch("/api/zoroark/guest",{method:"POST",credentials:"same-origin",cache:"no-store",
    headers:{"Content-Type":"application/json","X-Zoroark-Request":"guest-lobby-v1"},
    body:JSON.stringify({action:"me"})});
   const result=await response.json();
   if(!response.ok){setGuest(null);setMessage("参加資格を確認できません。期限切れ・Cookie削除・ゲーム終了の可能性があります。");return}
   setGuest(result);setMessage("");
  }catch{setMessage("通信に失敗しました。接続を確認してください。")}
 }
 useEffect(()=>{void refresh()},[]);
 return <main className="mx-auto max-w-md p-5 pt-10">
  <h1 className="text-3xl font-black">🦊 あなた専用のゲームページ</h1>
  <p className="mt-3 text-sm text-slate-600">この試合にだけ有効な秘密セッションで参加しています。</p>
  <section className="mt-5 space-y-3 rounded-2xl border bg-white p-5">
   {guest?<><p className="text-xl font-bold">{guest.nickname}</p>
    <p>現在の状態：{guest.state==="approved"?"✅ GM承認済み":guest.state==="pending"?"⌛ GM承認待ち":"❌ 参加は承認されませんでした"}</p>
    <p className="text-xs break-all text-slate-500">ルーム：{guest.roomId}</p>
    <p className="text-sm">有効期限：{new Date(guest.expiresAt).toLocaleString("ja-JP")}</p>
    <p className="rounded-xl bg-amber-50 p-3 text-sm">役職・質問カード・メダルは次の工程で接続します。</p></>:
    <p role="status">{message}</p>}
   <button type="button" onClick={()=>void refresh()} className="rounded-xl bg-lime-400 px-4 py-3 font-bold">状態を更新</button>
  </section>
 </main>;
}
