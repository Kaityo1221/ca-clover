"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuthProfile } from "@/lib/use-auth-profile";

declare global {
  interface Window {
    QRCode?: new (element: HTMLElement, options: Record<string, unknown>) => unknown;
    jsQR?: (data: Uint8ClampedArray, width: number, height: number, options?: Record<string, unknown>) => { data: string } | null;
  }
}

type ExchangeCommunity={
  id:string;
  name:string;
  prefecture:string|null;
  avatar_url:string|null;
  avatar_thumbnail_path:string|null;
  avatar_last_changed_at:string|null;
};

type ExchangePerson={
  user_id:string;
  niantic_id:string|null;
  ca_member_id:string;
  trainer_name:string;
  ca_level:"1st"|"2nd"|null;
  community:ExchangeCommunity;
};

type ExchangeSession={
  id:string;
  status:"open"|"paired"|"completed"|"cancelled"|"expired";
  expires_at:string;
  created_at:string;
  paired_at:string|null;
  completed_at:string|null;
  my_role:"issuer"|"scanner";
  my_confirmed:boolean;
  partner_confirmed:boolean;
  me:ExchangePerson|null;
  partner:ExchangePerson|null;
  result:any;
};

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
    const match=value.match(/^CACLOVER:S1:([A-Za-z0-9_-]{20,})$/);
    return match?.[1]??null;
  }
}

export default function StampExchangePage(){
  const {supabase,user,profile,permissions,loading}=useAuthProfile();
  const canAccess=profile?.role==="admin"||permissions.includes("S");
  const [session,setSession]=useState<ExchangeSession|null>(null);
  const [token,setToken]=useState<string|null>(null);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState<string|null>(null);
  const [secondsLeft,setSecondsLeft]=useState(60);
  const [scanning,setScanning]=useState(false);
  const [cameraError,setCameraError]=useState<string|null>(null);
  const qrRef=useRef<HTMLDivElement|null>(null);
  const videoRef=useRef<HTMLVideoElement|null>(null);
  const canvasRef=useRef<HTMLCanvasElement|null>(null);
  const scanFrame=useRef<number|null>(null);
  const streamRef=useRef<MediaStream|null>(null);
  const initialTokenHandled=useRef(false);

  async function callExchange(body:Record<string,unknown>){
    const {data,error}=await supabase.functions.invoke("stamp-exchange",{body});
    if(error) throw new Error(error.message);
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

  async function createQr(){
    setBusy(true);setMessage(null);stopCamera();
    try{
      const data=await callExchange({action:"create"});
      setSession(data.session);
      setToken(data.token);
    }catch(error){
      setMessage(error instanceof Error?error.message:String(error));
    }finally{setBusy(false);}
  }

  async function claimToken(nextToken:string){
    setBusy(true);setMessage(null);stopCamera();
    try{
      const data=await callExchange({action:"claim",token:nextToken});
      setSession(data.session);
      setToken(null);
      window.history.replaceState({}, "", window.location.pathname);
    }catch(error){
      setMessage(error instanceof Error?error.message:String(error));
    }finally{setBusy(false);}
  }

  async function refreshStatus(){
    if(!session?.id) return;
    try{
      const data=await callExchange({action:"status",sessionId:session.id});
      setSession(data.session);
    }catch(error){
      setMessage(error instanceof Error?error.message:String(error));
    }
  }

  async function confirmExchange(){
    if(!session) return;
    setBusy(true);setMessage(null);
    try{
      const data=await callExchange({action:"confirm",sessionId:session.id});
      setSession(data.session);
    }catch(error){
      setMessage(error instanceof Error?error.message:String(error));
    }finally{setBusy(false);}
  }

  async function cancelExchange(){
    if(!session) return;
    setBusy(true);
    try{
      const data=await callExchange({action:"cancel",sessionId:session.id});
      setSession(data.session);
      setToken(null);
    }catch(error){
      setMessage(error instanceof Error?error.message:String(error));
    }finally{setBusy(false);}
  }

  async function startScanner(){
    setMessage(null);setCameraError(null);setToken(null);
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
                void claimToken(foundToken);
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
      setCameraError(error instanceof Error?error.message:String(error));
    }
  }

  useEffect(()=>()=>stopCamera(),[]);

  useEffect(()=>{
    if(loading||!user||!canAccess||initialTokenHandled.current) return;
    const incoming=new URLSearchParams(window.location.search).get("t")?.trim();
    if(incoming){
      initialTokenHandled.current=true;
      void claimToken(incoming);
    }
  },[loading,user,canAccess]);

  useEffect(()=>{
    if(!session) return;
    const timer=window.setInterval(()=>{
      setSecondsLeft(Math.max(0,Math.ceil((new Date(session.expires_at).getTime()-Date.now())/1000)));
    },250);
    return()=>window.clearInterval(timer);
  },[session?.id,session?.expires_at]);

  useEffect(()=>{
    if(!session||!["open","paired"].includes(session.status)) return;
    const timer=window.setInterval(()=>void refreshStatus(),1500);
    return()=>window.clearInterval(timer);
  },[session?.id,session?.status]);

  useEffect(()=>{
    if(!token||!qrRef.current) return;
    let alive=true;
    void loadScript("https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js","QRCode")
      .then(()=>{
        if(!alive||!qrRef.current||!window.QRCode) return;
        qrRef.current.innerHTML="";
        const url=window.location.origin+"/lab/stamp-rally/exchange?t="+encodeURIComponent(token);
        new window.QRCode(qrRef.current,{text:url,width:240,height:240,correctLevel:2});
      })
      .catch(error=>setMessage(error instanceof Error?error.message:String(error)));
    return()=>{alive=false;};
  },[token]);

  const myResultStatus=useMemo(()=>{
    const participants=session?.result?.participants;
    if(!Array.isArray(participants)||!user) return null;
    return participants.find((item:any)=>item?.user_id===user.id)?.status??null;
  },[session?.result,user]);

  function avatarSrc(person:ExchangePerson|null){
    if(!person) return null;
    const community=person.community;
    if(community.avatar_thumbnail_path){
      const {data}=supabase.storage.from("community-icon-thumbs").getPublicUrl(community.avatar_thumbnail_path);
      return data.publicUrl+(community.avatar_last_changed_at?"?v="+encodeURIComponent(community.avatar_last_changed_at):"");
    }
    return community.avatar_url;
  }

  if(loading){
    return <main className="grid min-h-screen place-items-center bg-[#fff8ef] text-sm font-black text-[#5d7f4f]">🍀 読み込み中...</main>;
  }

  if(!user||!canAccess){
    return <main className="grid min-h-screen place-items-center bg-[#fff8ef] px-5 text-center">
      <div><div className="text-5xl">🔒</div><h1 className="mt-3 text-2xl font-black">スタンプ交換</h1><p className="mt-2 text-sm font-bold text-slate-500">S権限が必要です。</p></div>
    </main>;
  }

  const partner=session?.partner??null;
  const partnerAvatar=avatarSrc(partner);

  return <main className="min-h-screen bg-[linear-gradient(180deg,#fffaf4,#fff4e8)]">
    <div className="mx-auto max-w-md px-4 py-6">
      <div className="flex items-center justify-between">
        <Link href="/lab/stamp-rally" className="text-sm font-black text-[#567d48]">← スタンプ一覧</Link>
        <span className="rounded-full bg-[#eef5e8] px-3 py-1 text-[10px] font-black text-[#587848]">1対1交換</span>
      </div>

      <section className="mt-5 rounded-[30px] border border-[#ead6bf] bg-white/85 p-5 shadow-[0_18px_44px_rgba(98,70,40,.10)]">
        <div className="text-center">
          <div className="text-4xl">🍀</div>
          <h1 className="mt-2 text-2xl font-black text-[#413b36]">CAスタンプ交換</h1>
          <p className="mt-2 text-xs font-bold leading-5 text-[#88786a]">QRを見せる人と、読み取る人。ふたりがOKしたら交換成立です。</p>
        </div>

        {!session ? <div className="mt-6 grid gap-3">
          <button disabled={busy} onClick={()=>void createQr()} className="rounded-2xl bg-[#5f8e50] px-4 py-4 text-sm font-black text-white shadow-lg disabled:opacity-50">QRを見せる</button>
          <button disabled={busy} onClick={()=>void startScanner()} className="rounded-2xl border-2 border-[#a9c89c] bg-white px-4 py-4 text-sm font-black text-[#537647] disabled:opacity-50">QRを読み取る</button>
        </div> : null}

        {scanning ? <div className="mt-6">
          <div className="overflow-hidden rounded-[24px] bg-black">
            <video ref={videoRef} className="aspect-[3/4] w-full object-cover" muted playsInline />
          </div>
          <canvas ref={canvasRef} className="hidden" />
          <p className="mt-3 text-center text-xs font-bold text-[#7d7168]">相手のQRコードを枠内に入れてください</p>
          <button onClick={stopCamera} className="mt-3 w-full rounded-2xl bg-[#eee9e4] px-4 py-3 text-sm font-black text-[#675f59]">キャンセル</button>
        </div> : <><video ref={videoRef} className="hidden" muted playsInline /><canvas ref={canvasRef} className="hidden" /></>}

        {cameraError ? <div className="mt-4 rounded-2xl bg-rose-50 p-3 text-xs font-bold text-rose-700">{cameraError}</div> : null}
        {message ? <div className="mt-4 rounded-2xl bg-amber-50 p-3 text-xs font-bold text-amber-800">{message}</div> : null}

        {session?.status==="open"&&session.my_role==="issuer" ? <div className="mt-6 text-center">
          {secondsLeft>0 ? <>
            <div className="mx-auto w-fit rounded-[24px] bg-white p-4 shadow-[0_12px_30px_rgba(73,58,43,.12)]"><div ref={qrRef} /></div>
            <div className="mt-4 text-sm font-black text-[#4f7045]">有効時間 {secondsLeft}秒</div>
            <p className="mt-1 text-[11px] font-bold text-[#9b8d82]">相手が読み取るまでお待ちください</p>
          </> : <>
            <div className="rounded-2xl bg-[#f4eee8] p-4 text-sm font-black text-[#796d63]">QRコードの有効期限が切れました</div>
            <button disabled={busy} onClick={()=>void createQr()} className="mt-3 w-full rounded-2xl bg-[#5f8e50] px-4 py-4 text-sm font-black text-white disabled:opacity-50">再発行</button>
          </>}
        </div> : null}

        {session?.status==="paired"&&partner ? <div className="mt-6">
          <div className="rounded-[26px] border border-[#ead8c6] bg-[#fffaf4] p-5 text-center">
            <div className="relative mx-auto grid size-28 place-items-center overflow-hidden rounded-full border-4 border-white bg-[#edf4e8] text-4xl shadow-lg">
              <span>🍀</span>
              {partnerAvatar ? <img src={partnerAvatar} alt="" className="absolute inset-0 h-full w-full object-cover" onError={event=>{event.currentTarget.style.display="none";}} /> : null}
            </div>
            <h2 className="mt-4 text-xl font-black text-[#423b35]">{partner.trainer_name}</h2>
            <p className="mt-1 text-sm font-black text-[#5b7e4e]">{partner.community.name}</p>
            <p className="mt-1 text-[11px] font-bold text-[#94877c]">{partner.community.prefecture??""}</p>
          </div>

          {!session.my_confirmed ? <>
            <div className="mt-4 text-center text-lg font-black text-[#403a35]">交換しますか？</div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <button disabled={busy} onClick={()=>void cancelExchange()} className="rounded-2xl bg-[#eee9e4] px-4 py-4 text-sm font-black text-[#6d655f] disabled:opacity-50">やめる</button>
              <button disabled={busy} onClick={()=>void confirmExchange()} className="rounded-2xl bg-[#5f8e50] px-4 py-4 text-sm font-black text-white disabled:opacity-50">OK</button>
            </div>
          </> : <div className="mt-4 rounded-2xl bg-[#edf5e8] p-4 text-center text-sm font-black text-[#587848]">あなたはOK済みです。相手の確認を待っています 🍀</div>}
        </div> : null}

        {session?.status==="completed" ? <div className="mt-6 text-center">
          <div className="text-5xl">🎉</div>
          <h2 className="mt-3 text-2xl font-black text-[#3f3934]">{myResultStatus==="reunion"?"また会えた！":myResultStatus==="duplicate_same_day"?"本日の再会は記録済み":"スタンプ交換完了！"}</h2>
          <p className="mt-2 text-xs font-bold leading-5 text-[#87796d]">{partner?.trainer_name??"相手"}さんとの交換を保存しました。</p>
          <Link href="/lab/stamp-rally" className="mt-5 block rounded-2xl bg-[#5f8e50] px-4 py-4 text-sm font-black text-white">スタンプ一覧へ戻る</Link>
        </div> : null}

        {session?.status==="cancelled" ? <div className="mt-6 text-center">
          <div className="rounded-2xl bg-[#f3eee9] p-4 text-sm font-black text-[#756b62]">この交換はキャンセルされました。</div>
          <button onClick={()=>{setSession(null);setToken(null);setMessage(null);}} className="mt-3 w-full rounded-2xl bg-white px-4 py-3 text-sm font-black text-[#567d48]">最初に戻る</button>
        </div> : null}

        {session?.status==="expired" ? <div className="mt-6 text-center">
          <div className="rounded-2xl bg-[#f3eee9] p-4 text-sm font-black text-[#756b62]">QRコードの有効期限が切れました。</div>
          {session.my_role==="issuer"
            ? <button disabled={busy} onClick={()=>void createQr()} className="mt-3 w-full rounded-2xl bg-[#5f8e50] px-4 py-4 text-sm font-black text-white disabled:opacity-50">再発行</button>
            : <button onClick={()=>{setSession(null);setMessage(null);}} className="mt-3 w-full rounded-2xl bg-white px-4 py-3 text-sm font-black text-[#567d48]">別のQRを読む</button>}
        </div> : null}
      </section>

      <p className="mt-4 text-center text-[10px] font-bold leading-4 text-[#9a8b7e]">QRは60秒で失効します。読み取り後はその2人だけの確認画面に切り替わります。</p>
    </div>
  </main>;
}
