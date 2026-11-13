"use client";
import {useEffect,useState} from "react";
import QRCode from "qrcode";
import {useAuthProfile} from "@/lib/use-auth-profile";

export type RoomCreated = {
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

export function QRInvite({room,onFinish}:{room:RoomCreated;onFinish:()=>void}){
 const [qr,setQr]=useState("");
 const [currentInvite,setCurrentInvite]=useState(room.invite);
 const [currentDeadline,setCurrentDeadline]=useState(room.joinExpiresAt);
 const [error,setError]=useState("");
 const enabled=room.joinEnabled;
 const hasInvite=/^[a-f0-9]{64}$/.test(currentInvite);
 useEffect(()=>{
  if(!enabled||!hasInvite)return;
  const url=window.location.origin+"/zoroark/join#invite="+currentInvite;
  // Generate QR inside the browser. Never send invite to a remote QR image provider.
  QRCode.toDataURL(url,{width:320,margin:2,errorCorrectionLevel:"M"})
   .then(setQr).catch(()=>setError("QRコードを生成できませんでした。"));
 },[currentInvite,enabled,hasInvite]);
 if(!enabled)return <p className="rounded-xl bg-amber-50 p-3 font-bold text-amber-900">
  QR招待は未有効化です。ゲストAPIとDBの安全試験が済むまで配布しないでください。
 </p>;
 return <div className="space-y-3">
   {hasInvite?<p className="font-bold">📱 一般トレーナーにこのQRコードを読み取ってもらいます</p>:
    <p className="rounded-xl bg-lime-50 p-3 font-bold">管理画面を再開しました。招待QRは保存していません。「招待QRを再発行」から新しいQRを発行できます。</p>}
   {qr&&<img alt="このゲームの招待QRコード" width={320} height={320} src={qr}
     className="mx-auto max-w-full rounded-xl border p-2" />}
   {error&&<p role="alert">{error}</p>}
   <p className="text-sm">招待期限：{new Date(currentDeadline).toLocaleString("ja-JP")}</p>
   <p className="text-sm text-amber-800">招待資格はQRの中だけに含まれます。SNSに公開せず、現地参加者だけに提示してください。</p>
   <GMLobby roomId={room.roomId} onFinish={onFinish}
     onRotate={(invite,deadline)=>{setQr("");setCurrentInvite(invite);setCurrentDeadline(deadline)}}/>
  </div>;
}
type Participant={id:string;display_name:string;state:"pending"|"approved"|"rejected"};
function GMLobby({roomId,onRotate,onFinish}:{roomId:string;onRotate:(invite:string,deadline:string)=>void;onFinish:()=>void}){
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
   if(!response.ok)throw Error((result.error??"ロビーの取得に失敗しました")+(typeof result.diagnosticStage==="string"?"（診断："+result.diagnosticStage+"）":""));
   if(action==="list"){setParticipants(result.participants);setLocked(result.room.locked)}
   else if(action==="finish"){
    if(result.ok!==true)throw Error("ルームを終了できませんでした。");
    onFinish();
   }
   else if(action==="rotate"){
    if(!/^[a-f0-9]{64}$/.test(result.invite)||typeof result.joinExpiresAt!=="string")throw Error("招待コード更新結果が不正です");
    onRotate(result.invite,result.joinExpiresAt);
    setMessage("新しいQRに更新しました。以前のQRは使えません。");
   } else await refresh();
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
  <button onClick={()=>request("rotate")} disabled={busy} className="ml-2 rounded-lg bg-slate-200 px-3 py-2 font-bold">招待QRを再発行</button>
  <button onClick={()=>{if(window.confirm("このルームを終了しますか？参加者のアクセスも無効になります。"))void request("finish")}}
    disabled={busy} className="ml-2 rounded-lg bg-rose-100 px-3 py-2 font-bold">ルームを終了</button>
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
