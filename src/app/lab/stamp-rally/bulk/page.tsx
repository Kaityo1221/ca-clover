"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuthProfile } from "@/lib/use-auth-profile";
import { CommunityIcon } from "@/components/community-icon";

declare global {
  interface Window {
    QRCode?: new (element: HTMLElement, options: Record<string, unknown>) => unknown;
    jsQR?: (data: Uint8ClampedArray, width: number, height: number, options?: Record<string, unknown>) => { data: string } | null;
  }
}

type BulkCommunity={
  id:string|null;
  name:string;
  prefecture:string|null;
  avatar_url:string|null;
  avatar_thumbnail_path:string|null;
  avatar_last_changed_at:string|null;
};

type BulkParticipant={
  user_id:string;
  joined_at:string;
  locked_at:string|null;
  is_me:boolean;
  is_host:boolean;
  trainer_name:string;
  community:BulkCommunity;
};

type BulkMission={id:string;title:string;instruction:string};

type BulkRoom={
  id:string;
  status:"open"|"processing"|"partial_failed"|"completed"|"closed"|"expired";
  my_role:"host"|"participant";
  created_at:string;
  started_at:string|null;
  completed_at:string|null;
  closed_at:string|null;
  event:{id:string;name:string;location:string|null;timezone:string};
  participant_count:number;
  frozen_participant_count:number|null;
  each_receives:number;
  total_pairs:number;
  completed_pairs:number;
  failed_pairs:number;
  pending_pairs:number;
  participants:BulkParticipant[];
  today_local_date:string;
  today_mission:BulkMission|null;
};

type Phase="idle"|"creating"|"joining"|"starting"|"processing"|"retrying"|"closing";

function loadScript(src:string,globalName:"QRCode"|"jsQR"){
  return new Promise<void>((resolve,reject)=>{
    if(window[globalName]){resolve();return;}
    const existing=document.querySelector<HTMLScriptElement>('script[data-lib="'+globalName+'"]');
    if(existing){
      existing.addEventListener("load",()=>resolve(),{once:true});
      existing.addEventListener("error",()=>reject(new Error("ライブラリを読み込めませんでした")),{once:true});
      return;
    }
    const script=document.createElement("script");
    script.src=src;
    script.async=true;
    script.dataset.lib=globalName;
    script.onload=()=>resolve();
    script.onerror=()=>reject(new Error("ライブラリを読み込めませんでした"));
    document.head.appendChild(script);
  });
}

function extractToken(raw:string){
  const value=raw.trim();
  try{
    const url=new URL(value);
    return url.searchParams.get("t")?.trim()||null;
  }catch{
    const match=value.match(/^CACLOVER:B1:([A-Za-z0-9_-]{20,})$/);
    return match?.[1]??null;
  }
}

const sleep=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));

export default function StampBulkPage(){
  const {supabase,user,profile,permissions,loading}=useAuthProfile();
  const canAccess=profile?.role==="admin"||permissions.includes("S");
  const [room,setRoom]=useState<BulkRoom|null>(null);
  const [token,setToken]=useState<string|null>(null);
  const [phase,setPhase]=useState<Phase>("idle");
  const [message,setMessage]=useState<string|null>(null);
  const [online,setOnline]=useState(true);
  const [scanning,setScanning]=useState(false);
  const [missionCountdown,setMissionCountdown]=useState(0);
  const qrRef=useRef<HTMLDivElement|null>(null);
  const videoRef=useRef<HTMLVideoElement|null>(null);
  const canvasRef=useRef<HTMLCanvasElement|null>(null);
  const streamRef=useRef<MediaStream|null>(null);
  const scanFrame=useRef<number|null>(null);
  const initialHandled=useRef(false);

  const busy=phase!=="idle";

  function roomTokenKey(roomId:string){
    return "ca-clover-bulk-token:"+roomId;
  }

  function rememberRoom(next:BulkRoom|null){
    setRoom(next);
    if(!user) return;
    const key="ca-clover-bulk-room:"+user.id;
    if(next) sessionStorage.setItem(key,next.id);
    else sessionStorage.removeItem(key);
  }

  async function call(body:Record<string,unknown>){
    const {data:authData}=await supabase.auth.getSession();
    const accessToken=authData.session?.access_token;
    if(!accessToken) throw new Error("ログインセッションが切れています。再ログインしてください。");
    const {data,error}=await supabase.functions.invoke("stamp-bulk",{
      body,
      headers:{Authorization:"Bearer "+accessToken},
    });
    if(error){
      let detail=error.message;
      const context=(error as {context?:Response}).context;
      if(context){
        try{
          const payload=await context.clone().json() as {error?:unknown};
          if(payload?.error) detail=String(payload.error);
        }catch{}
      }
      throw new Error(detail);
    }
    if(data?.error) throw new Error(String(data.error));
    return data;
  }

  function stopCamera(){
    if(scanFrame.current!==null) cancelAnimationFrame(scanFrame.current);
    scanFrame.current=null;
    streamRef.current?.getTracks().forEach(track=>track.stop());
    streamRef.current=null;
    setScanning(false);
  }

  async function createRoom(){
    if(busy||!online) return;
    setPhase("creating");setMessage(null);stopCamera();
    try{
      const data=await call({action:"create"});
      rememberRoom(data.room);
      if(data.token){
        setToken(data.token);
        sessionStorage.setItem(roomTokenKey(data.room.id),data.token);
      }
    }catch(error){
      setMessage(error instanceof Error?error.message:String(error));
    }finally{setPhase("idle");}
  }

  async function rotateQr(){
    if(!room||busy||!online) return;
    setPhase("creating");setMessage(null);
    try{
      const data=await call({action:"rotate_token",roomId:room.id});
      rememberRoom(data.room);
      setToken(data.token);
      sessionStorage.setItem(roomTokenKey(room.id),data.token);
    }catch(error){
      setMessage(error instanceof Error?error.message:String(error));
    }finally{setPhase("idle");}
  }

  async function joinToken(nextToken:string){
    if(busy||!online) return;
    setPhase("joining");setMessage(null);stopCamera();
    try{
      const data=await call({action:"join",token:nextToken});
      rememberRoom(data.room);
      setToken(null);
      window.history.replaceState({},"",window.location.pathname);
    }catch(error){
      setMessage(error instanceof Error?error.message:String(error));
    }finally{setPhase("idle");}
  }

  async function refreshRoom(silent=true){
    if(!room||!online) return;
    try{
      const data=await call({action:"status",roomId:room.id});
      rememberRoom(data.room);
    }catch(error){
      if(!silent) setMessage(error instanceof Error?error.message:String(error));
    }
  }

  async function processUntilSettled(mode:"pending"|"failed",retryCutoff?:string){
    if(!room) return;
    setPhase(mode==="failed"?"retrying":"processing");
    setMessage(null);
    try{
      for(let i=0;i<25;i++){
        const data=await call({
          action:"process",
          roomId:room.id,
          mode,
          retryCutoff:retryCutoff??null,
        });
        rememberRoom(data.room);
        const remaining=Number(data.summary?.eligible_remaining??0);
        if(remaining<=0) break;
        await sleep(120);
      }
      await refreshRoom(true);
    }catch(error){
      setMessage("交換処理の結果確認が必要です。"+(error instanceof Error?error.message:String(error)));
    }finally{
      setPhase("idle");
    }
  }

  async function startBulk(){
    if(!room||room.my_role!=="host"||room.status!=="open"||busy) return;
    const count=room.participant_count;
    if(count<2){
      setMessage("大交換には2人以上必要です。");
      return;
    }
    if(!window.confirm(count+"人で交換を開始します。よろしいですか？")) return;

    setPhase("starting");setMessage(null);
    try{
      const data=await call({action:"start",roomId:room.id,expectedCount:count});
      rememberRoom(data.room);
      setPhase("idle");
      await processUntilSettled("pending");
    }catch(error){
      setMessage(error instanceof Error?error.message:String(error));
      setPhase("idle");
    }
  }

  async function retryFailed(){
    if(!room||room.my_role!=="host"||room.status!=="partial_failed"||busy) return;
    await processUntilSettled("failed",new Date().toISOString());
  }

  async function endRoom(){
    if(!room||room.my_role!=="host"||busy) return;
    setPhase("closing");setMessage(null);
    try{
      const data=await call({action:"end",roomId:room.id});
      rememberRoom(data.room);
      setToken(null);
      sessionStorage.removeItem(roomTokenKey(room.id));
    }catch(error){
      setMessage(error instanceof Error?error.message:String(error));
    }finally{setPhase("idle");}
  }

  async function leaveRoom(){
    if(!room||room.my_role==="host"||room.status!=="open"||busy) return;
    setPhase("closing");setMessage(null);
    try{
      await call({action:"leave",roomId:room.id});
      rememberRoom(null);
    }catch(error){
      setMessage(error instanceof Error?error.message:String(error));
    }finally{setPhase("idle");}
  }

  async function startScanner(){
    if(!online||busy) return;
    setMessage(null);setToken(null);
    try{
      await loadScript("https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js","jsQR");
      const stream=await navigator.mediaDevices.getUserMedia({
        video:{facingMode:{ideal:"environment"}},
        audio:false,
      });
      streamRef.current=stream;
      setScanning(true);
      const video=videoRef.current;
      if(!video) throw new Error("カメラを準備できませんでした");
      video.srcObject=stream;
      video.setAttribute("playsinline","true");
      await video.play();

      const loop=()=>{
        const v=videoRef.current;
        const canvas=canvasRef.current;
        if(!v||!canvas||!window.jsQR||!streamRef.current) return;
        if(v.readyState>=2&&v.videoWidth>0&&v.videoHeight>0){
          const width=Math.min(720,v.videoWidth);
          const scale=width/v.videoWidth;
          const height=Math.max(1,Math.round(v.videoHeight*scale));
          canvas.width=width;
          canvas.height=height;
          const ctx=canvas.getContext("2d",{willReadFrequently:true});
          if(ctx){
            ctx.drawImage(v,0,0,width,height);
            const image=ctx.getImageData(0,0,width,height);
            const found=window.jsQR(image.data,width,height,{inversionAttempts:"dontInvert"});
            if(found?.data){
              const foundToken=extractToken(found.data);
              if(foundToken){
                stopCamera();
                void joinToken(foundToken);
                return;
              }
            }
          }
        }
        scanFrame.current=requestAnimationFrame(loop);
      };
      scanFrame.current=requestAnimationFrame(loop);
    }catch(error){
      stopCamera();
      setMessage(error instanceof Error?error.message:String(error));
    }
  }

  useEffect(()=>{
    setOnline(navigator.onLine);
    const onOnline=()=>{setOnline(true);setMessage(null);};
    const onOffline=()=>setOnline(false);
    window.addEventListener("online",onOnline);
    window.addEventListener("offline",onOffline);
    return()=>{
      window.removeEventListener("online",onOnline);
      window.removeEventListener("offline",onOffline);
      stopCamera();
    };
  },[]);

  useEffect(()=>{
    if(loading||!user||!canAccess||initialHandled.current) return;
    initialHandled.current=true;

    const incoming=new URLSearchParams(window.location.search).get("t")?.trim();
    if(incoming){
      void joinToken(incoming);
      return;
    }

    void (async()=>{
      try{
        const data=await call({action:"resume"});
        if(data.room){
          rememberRoom(data.room);
          if(data.room.my_role==="host"){
            const saved=sessionStorage.getItem(roomTokenKey(data.room.id));
            if(saved) setToken(saved);
          }
          if(data.room.my_role==="host"&&data.room.status==="processing"){
            await processUntilSettled("pending");
          }
        }
      }catch(error){
        setMessage(error instanceof Error?error.message:String(error));
      }
    })();
  },[loading,user,canAccess]);

  useEffect(()=>{
    if(!room||!online||["closed","expired"].includes(room.status)) return;
    const timer=window.setInterval(()=>void refreshRoom(true),2000);
    return()=>window.clearInterval(timer);
  },[room?.id,room?.status,online]);

  useEffect(()=>{
    if(!token||!qrRef.current||!room||room.status!=="open") return;
    let alive=true;
    void loadScript("https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js","QRCode")
      .then(()=>{
        if(!alive||!qrRef.current||!window.QRCode) return;
        qrRef.current.innerHTML="";
        const url=window.location.origin+"/lab/stamp-rally/bulk?t="+encodeURIComponent(token);
        new window.QRCode(qrRef.current,{text:url,width:240,height:240,correctLevel:2});
      })
      .catch(error=>setMessage(error instanceof Error?error.message:String(error)));
    return()=>{alive=false;};
  },[token,room?.id,room?.status]);

  useEffect(()=>{
    if(missionCountdown<=0) return;
    const timer=window.setInterval(()=>{
      setMissionCountdown(current=>current<=1?0:current-1);
    },1000);
    return()=>window.clearInterval(timer);
  },[missionCountdown]);

  const phaseLabel=
    phase==="creating"?"ルームを準備中..."
    :phase==="joining"?"ルームに参加中..."
    :phase==="starting"?"参加者を固定中..."
    :phase==="processing"?"全ペアを保存中..."
    :phase==="retrying"?"失敗ペアだけ再試行中..."
    :phase==="closing"?"ルームを終了中..."
    :null;

  const progress=useMemo(()=>{
    if(!room?.total_pairs) return 0;
    return Math.round((room.completed_pairs/room.total_pairs)*100);
  },[room?.completed_pairs,room?.total_pairs]);

  if(loading){
    return <main className="grid min-h-screen place-items-center bg-[#fff8ef] text-sm font-black text-[#5d7f4f]">🍀 読み込み中...</main>;
  }

  if(!user||!canAccess){
    return <main className="grid min-h-screen place-items-center bg-[#fff8ef] px-5 text-center"><div><div className="text-5xl">🔒</div><h1 className="mt-3 text-2xl font-black">大交換モード</h1><p className="mt-2 text-sm font-bold text-slate-500">S権限が必要です。</p></div></main>;
  }

  return <main className="min-h-screen bg-[linear-gradient(180deg,#fffaf4,#fff1df)]">
    <style>{`
      @keyframes bulk-medal-fly {
        0% { transform: translateY(180px) rotate(-180deg) scale(.45); opacity:0; }
        55% { opacity:1; }
        82% { transform: translateY(-18px) rotate(330deg) scale(1.05); opacity:1; }
        100% { transform: translateY(0) rotate(360deg) scale(1); opacity:1; }
      }
    `}</style>
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="flex items-center justify-between">
        <Link href="/lab/stamp-rally/events" className="text-sm font-black text-[#567d48]">← イベントモード</Link>
        <span className="rounded-full bg-[#fff0d9] px-3 py-1 text-[10px] font-black text-[#8a6131]">大交換 MODE</span>
      </div>

      <section className="mt-5 rounded-[30px] border border-[#edcfaa] bg-gradient-to-br from-[#ffd6a3] via-[#ffe4bd] to-[#fff7ea] p-5 shadow-[0_18px_44px_rgba(110,75,35,.10)]">
        <div className="text-4xl">🪙</div>
        <h1 className="mt-2 text-2xl font-black text-[#413a34]">みんなで大交換</h1>
        <p className="mt-2 text-xs font-bold leading-5 text-[#756759]">ひとつのQRから集まって、開始時にいる全員どうしで一気にスタンプ交換します。</p>
      </section>

      {!online?<div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs font-black text-amber-800">📡 オフラインです。ルーム状態は保持します。</div>:null}
      {phaseLabel?<div className="mt-4 rounded-2xl bg-sky-50 p-3 text-center text-xs font-black text-sky-800">⏳ {phaseLabel}</div>:null}
      {message?<div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-700">{message}</div>:null}

      {!room?<section className="mt-5 rounded-[28px] border border-[#ead6c2] bg-white p-5 shadow-sm">
        <div className="text-center text-sm font-black text-[#4a423b]">開催中のイベントに参加しているCAが使えます</div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <button disabled={busy||!online} onClick={()=>void createRoom()} className="rounded-2xl bg-[#5f8e50] px-4 py-4 text-sm font-black text-white disabled:opacity-50">大交換を始める</button>
          <button disabled={busy||!online} onClick={()=>void startScanner()} className="rounded-2xl border-2 border-[#a9c89c] bg-white px-4 py-4 text-sm font-black text-[#537647] disabled:opacity-50">大交換QRを読む</button>
        </div>
      </section>:null}

      {scanning?<section className="mt-5 rounded-[28px] bg-white p-4 shadow-sm">
        <div className="overflow-hidden rounded-[22px] bg-black"><video ref={videoRef} className="aspect-[3/4] w-full object-cover" muted playsInline /></div>
        <canvas ref={canvasRef} className="hidden"/>
        <p className="mt-3 text-center text-xs font-bold text-[#7d7168]">主催者の大交換QRを読み取ってください</p>
        <button onClick={stopCamera} className="mt-3 w-full rounded-2xl bg-[#eee9e4] px-4 py-3 text-sm font-black text-[#675f59]">キャンセル</button>
      </section>:<><video ref={videoRef} className="hidden" muted playsInline/><canvas ref={canvasRef} className="hidden"/></>}

      {room?<>
        <section className="mt-5 rounded-[26px] border border-orange-200 bg-orange-50 p-4">
          <div className="text-[10px] font-black text-orange-700">🎪 {room.event.name}</div>
          <div className="mt-1 text-xs font-bold text-orange-900">📍 {room.event.location??"場所未設定"} ・ {room.event.timezone}</div>
          <div className="mt-2 flex flex-wrap gap-2">
            <span className="rounded-full bg-white px-2.5 py-1 text-[9px] font-black text-orange-700">
              {room.status==="open"?"参加受付中":room.status==="processing"?"交換保存中":room.status==="partial_failed"?"一部再試行待ち":room.status==="completed"?"交換完了":room.status==="closed"?"終了":"イベント終了"}
            </span>
            <span className="rounded-full bg-white px-2.5 py-1 text-[9px] font-black text-[#587848]">{room.participant_count}人</span>
          </div>
        </section>

        {room.today_mission&&room.status==="open"?<section className="mt-4 rounded-[24px] border border-[#d9e9d2] bg-[#f3f9ef] p-4 text-center">
          <div className="text-[10px] font-black text-[#678057]">TODAY'S MISSION ・ {room.today_local_date}</div>
          <div className="mt-2 text-base font-black text-[#403b36]">{room.today_mission.title}</div>
          <div className="mt-1 text-xs font-bold leading-5 text-[#756d66]">{room.today_mission.instruction}</div>
          {missionCountdown>0?<div className="mt-3 text-5xl font-black text-[#5f8e50]">{missionCountdown}</div>:<button type="button" onClick={()=>setMissionCountdown(5)} className="mt-3 rounded-full bg-white px-4 py-2 text-[10px] font-black text-[#5f8e50] shadow-sm">5秒カウント</button>}
          <div className="mt-2 text-[9px] font-bold text-[#9a918a]">遊びの合図です。動作は検知しません。</div>
        </section>:null}

        {room.status==="open"&&room.my_role==="host"?<section className="mt-4 rounded-[28px] border border-[#ead6c2] bg-white p-5 text-center shadow-sm">
          <div className="text-xs font-black text-[#6d6258]">このQRをみんなに見せてください</div>
          {token?<div className="mx-auto mt-3 w-fit rounded-[22px] bg-white p-3 shadow-[0_10px_28px_rgba(70,55,42,.12)]"><div ref={qrRef}/></div>:<button disabled={busy||!online} onClick={()=>void rotateQr()} className="mt-4 rounded-2xl bg-[#5f8e50] px-5 py-3 text-sm font-black text-white disabled:opacity-50">QRを再表示</button>}
          <div className="mt-3 text-[10px] font-bold text-[#94877b]">受付中は同じQRから参加できます</div>
        </section>:null}

        <section className="mt-4 rounded-[28px] border border-[#ead6c2] bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div><div className="text-sm font-black text-[#423c36]">参加CA</div><div className="mt-1 text-[10px] font-bold text-[#94877c]">{room.status==="open"?"リアルタイム受付中":"開始時のメンバーで固定済み"}</div></div>
            <div className="text-2xl font-black text-[#5f8e50]">{room.participant_count}</div>
          </div>
          <div className="mt-4 space-y-2">
            {room.participants.map(participant=><div key={participant.user_id} className={"flex items-center gap-3 rounded-[18px] border px-3 py-2.5 "+(
              participant.is_me?"border-[#9fc78f] bg-[#f0f8eb]":"border-[#eee5dc] bg-[#fffaf5]"
            )}>
              <CommunityIcon supabase={supabase} community={participant.community} className="size-11 shrink-0 rounded-full bg-[#edf4e8]" fallbackClassName="text-lg"/>
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-black text-[#433c36]">{participant.trainer_name}{participant.is_me?"（あなた）":""}</div>
                <div className="mt-0.5 truncate text-[10px] font-bold text-[#8e8175]">{participant.community.name}</div>
              </div>
              {participant.is_host?<span className="rounded-full bg-[#fff0d9] px-2 py-1 text-[8px] font-black text-[#8a6131]">HOST</span>:null}
            </div>)}
          </div>
        </section>

        {room.status==="open"&&room.my_role==="host"?<section className="mt-4 rounded-[28px] border border-[#d5e6cd] bg-[#f5faf2] p-5">
          <div className="text-center text-sm font-black text-[#45663a]">{room.participant_count}人なら、1人あたり {Math.max(0,room.participant_count-1)} 枚受け取ります</div>
          <button disabled={busy||!online||room.participant_count<2} onClick={()=>void startBulk()} className="mt-4 w-full rounded-2xl bg-[#5f8e50] px-4 py-4 text-sm font-black text-white disabled:opacity-50">交換開始</button>
        </section>:null}

        {room.status==="open"&&room.my_role==="participant"?<button disabled={busy} onClick={()=>void leaveRoom()} className="mt-4 w-full rounded-2xl bg-white px-4 py-3 text-xs font-black text-[#75695f] shadow-sm disabled:opacity-50">ルームから退出</button>:null}

        {["processing","partial_failed","completed"].includes(room.status)?<section className="mt-4 rounded-[28px] border border-[#dbe8d5] bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="text-sm font-black text-[#433c36]">交換保存</div>
            <div className="text-xs font-black text-[#5f8e50]">{progress}%</div>
          </div>
          <div className="mt-3 h-3 overflow-hidden rounded-full bg-[#edf1ea]"><div className="h-full rounded-full bg-[#6a985a] transition-all" style={{width:progress+"%"}}/></div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-[#edf6e9] p-2"><div className="text-sm font-black text-[#587848]">{room.completed_pairs}</div><div className="text-[8px] font-black text-[#7a8f70]">保存済み</div></div>
            <div className="rounded-xl bg-[#fff4df] p-2"><div className="text-sm font-black text-[#946b2c]">{room.pending_pairs}</div><div className="text-[8px] font-black text-[#a18458]">未処理</div></div>
            <div className="rounded-xl bg-[#fff0f2] p-2"><div className="text-sm font-black text-[#b04458]">{room.failed_pairs}</div><div className="text-[8px] font-black text-[#b77985]">要再試行</div></div>
          </div>
          <div className="mt-3 text-center text-[10px] font-bold text-[#8b7d71]">全 {room.total_pairs} ペア ・ 1人あたり {room.each_receives} 枚</div>

          {room.status==="processing"&&room.my_role==="host"&&phase==="idle"?<button onClick={()=>void processUntilSettled("pending")} className="mt-4 w-full rounded-2xl bg-sky-600 px-4 py-3 text-xs font-black text-white">交換処理を再開</button>:null}
          {room.status==="partial_failed"&&room.my_role==="host"?<button disabled={busy||!online} onClick={()=>void retryFailed()} className="mt-4 w-full rounded-2xl bg-amber-500 px-4 py-3 text-xs font-black text-white disabled:opacity-50">失敗した {room.failed_pairs} ペアだけ再試行</button>:null}
          {room.status==="partial_failed"&&room.my_role!=="host"?<div className="mt-4 rounded-2xl bg-amber-50 p-3 text-center text-xs font-black text-amber-800">一部の交換を主催者が再試行しています</div>:null}
        </section>:null}

        {room.status==="completed"?<section className="relative mt-4 overflow-hidden rounded-[30px] border border-[#ecd09e] bg-gradient-to-b from-[#fff8dc] to-[#fff] p-5 text-center shadow-lg">
          <div className="text-5xl">🎉</div>
          <h2 className="mt-2 text-2xl font-black text-[#433b34]">大交換 完了！</h2>
          <p className="mt-2 text-xs font-bold text-[#7f7165]">{room.frozen_participant_count}人で交換しました。あなたには {room.each_receives} 枚分の交換結果が保存されています。</p>
          <div className="relative mx-auto mt-3 h-40 max-w-md">
            {room.participants.map((participant,index)=><div
              key={participant.user_id}
              className="absolute bottom-1"
              style={{
                left:((index+1)/(room.participants.length+1)*100)+"%",
                transform:"translateX(-50%)",
                animation:"bulk-medal-fly .9s cubic-bezier(.2,.8,.2,1) both",
                animationDelay:(index*55)+"ms",
              }}
            >
              <CommunityIcon supabase={supabase} community={participant.community} className="size-11 rounded-full border-2 border-white bg-[#edf4e8] shadow-lg" fallbackClassName="text-lg"/>
            </div>)}
          </div>
          {room.my_role==="host"?<button disabled={busy} onClick={()=>void endRoom()} className="mt-3 w-full rounded-2xl bg-[#5f8e50] px-4 py-3 text-sm font-black text-white disabled:opacity-50">終了</button>:<div className="mt-3 rounded-2xl bg-[#eef6e9] p-3 text-xs font-black text-[#587848]">主催者が「終了」を押すまで、この結果画面を共有します。</div>}
        </section>:null}

        {["closed","expired"].includes(room.status)?<section className="mt-4 rounded-[26px] bg-white p-5 text-center shadow-sm">
          <div className="text-4xl">{room.status==="expired"?"⏰":"🍀"}</div>
          <div className="mt-2 text-lg font-black text-[#433c36]">{room.status==="expired"?"イベント終了":"大交換ルーム終了"}</div>
          <Link href="/lab/stamp-rally" className="mt-4 block rounded-2xl bg-[#5f8e50] px-4 py-3 text-sm font-black text-white">スタンプ一覧へ</Link>
        </section>:null}

        {room.my_role==="host"&&room.status!=="processing"&&!["closed","expired"].includes(room.status)&&room.status!=="completed"?<button disabled={busy} onClick={()=>void endRoom()} className="mt-4 w-full rounded-2xl bg-[#eee9e4] px-4 py-3 text-xs font-black text-[#75695f] disabled:opacity-50">ルームを終了</button>:null}
      </>:null}

      <p className="mt-5 text-center text-[10px] font-bold leading-5 text-[#9a8b7e]">開始時に参加者を固定し、全ペアを先に登録してから保存します。主催者の接続が5分以上途切れたルームは自動終了します。</p>
    </div>
  </main>;
}
