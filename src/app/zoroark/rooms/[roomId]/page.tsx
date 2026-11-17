"use client";

import Link from "next/link";
import {useParams,useRouter} from "next/navigation";
import {useEffect,useState} from "react";
import {useAuthProfile} from "@/lib/use-auth-profile";
import {QRInvite,type RoomCreated} from "@/components/zoroark/gm-room-controls";

type OwnedRoom = {
 id:string;mode:"simple"|"manual";max_players:number;talk_seconds:number;
 state:string;join_locked:boolean;join_expires_at:string;expires_at:string;
 created_at:string;occupied:number;
};

const ID_PATTERN=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function ZoroarkRoomManagementPage(){
 const params=useParams();
 const router=useRouter();
 const roomId=typeof params.roomId==="string"?params.roomId:"";
 const {supabase,user,profile,loading}=useAuthProfile();
 const authorized=Boolean(user&&(profile?.role==="ca"||profile?.role==="admin"));
 const [room,setRoom]=useState<OwnedRoom|null>(null);
 const [busy,setBusy]=useState(true);
 const [error,setError]=useState("");

 useEffect(()=>{
  if(loading)return;
  if(!authorized){setBusy(false);return}
  if(!ID_PATTERN.test(roomId)){setError("ルームIDが正しくありません。");setBusy(false);return}
  let active=true;
  async function load(){
   setBusy(true);setError("");
   try{
    const {data}=await supabase.auth.getSession();
    if(!data.session?.access_token)throw new Error("ログインし直してください。");
    // "mine" returns only rooms owned by the CA authenticated on the server.
    // Never use the URL ID alone to grant GM management permissions.
    const response=await fetch("/api/zoroark/gm",{
     method:"POST",cache:"no-store",
     headers:{"Content-Type":"application/json","X-Zoroark-Request":"gm-lobby-v1",
      Authorization:"Bearer "+data.session.access_token},
     body:JSON.stringify({action:"mine"}),
    });
    const result=await response.json();
    if(!response.ok||!Array.isArray(result.rooms))throw new Error("ルーム一覧を取得できませんでした。");
    const selected=(result.rooms as OwnedRoom[]).find(item=>item.id===roomId);
    if(!selected)throw new Error("このルームは見つからないか、管理する権限がありません。");
    if(selected.state!=="lobby"||new Date(selected.expires_at).getTime()<=Date.now())
     throw new Error("このルームは終了または期限切れです。");
    if(active)setRoom(selected);
   }catch(cause){if(active)setError(cause instanceof Error?cause.message:"ルームを開けませんでした。")}
   finally{if(active)setBusy(false)}
  }
  void load();
  return ()=>{active=false};
 },[authorized,loading,roomId,supabase]);

 if(loading)return <main className="mx-auto max-w-xl p-6">🍀 CA認証を確認中...</main>;
 if(!user)return <main className="mx-auto max-w-xl p-6 space-y-4">
  <h1 className="text-2xl font-black">🦊 ルーム管理</h1>
  <p>ゲームマスターはCA Cloverへのログインが必要です。</p>
  <Link href={"/login?next="+encodeURIComponent("/zoroark/rooms/"+roomId)}
   className="inline-block rounded-xl bg-lime-300 px-5 py-3 font-bold">ログインへ</Link>
 </main>;
 if(!authorized)return <main className="mx-auto max-w-xl p-6 space-y-4">
  <h1 className="text-2xl font-black">🔒 CA限定機能</h1>
  <p>このルームを管理するにはCA権限が必要です。</p>
  <Link href="/zoroark/rooms" className="underline">ルーム一覧に戻る</Link>
 </main>;

 const restored:RoomCreated|null=room?{
  roomId:room.id,status:"lobby",mode:room.mode,maxPlayers:room.max_players,
  talkSeconds:room.talk_seconds,joinExpiresAt:room.join_expires_at,
  expiresAt:room.expires_at,invite:"",joinEnabled:true
 }:null;
 return <main className="mx-auto max-w-xl px-4 py-8">
   <Link href="/zoroark/rooms" className="inline-block rounded-xl bg-slate-100 px-4 py-3 font-bold">
    ← ルーム選択画面へ
   </Link>
   <h1 className="mt-6 text-3xl font-black text-lime-950">🦊 ルーム管理</h1>
   <p className="mt-2 text-slate-600">ゲームマスター専用</p>
   {busy&&<p className="mt-6">ルームを確認中...</p>}
   {error&&<div role="alert" className="mt-6 rounded-xl bg-red-50 p-4 text-red-700">{error}</div>}
   {restored&&<section className="mt-6 rounded-3xl border border-lime-200 bg-white p-5 shadow-sm">
     <h2 className="text-xl font-black">{room?.mode==="manual"?"マニュアル（ミミッキュ）":"シンプル"}</h2>
     <p className="mt-2 text-sm">参加 {room?.occupied}/{room?.max_players}人・トーク {room?.talk_seconds===0?"制限なし":(room?.talk_seconds??0)/60+"分"}</p>
     <p className="mt-2 text-sm text-slate-500">作成日時：{new Date(room!.created_at).toLocaleString("ja-JP")}</p>
     <div className="mt-5"><QRInvite room={restored} onFinish={()=>router.replace("/zoroark/rooms")}/></div>
   </section>}
   <Link href="/zoroark/rooms"
     className="mt-6 block w-full rounded-xl bg-lime-300 px-5 py-4 text-center text-lg font-black text-lime-950">
     ← ルーム選択画面へ
   </Link>
 </main>;
}
