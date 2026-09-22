"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuthProfile } from "@/lib/use-auth-profile";

type Mission={id:string;title:string;instruction:string};
type EventRow={
  id:string;
  name:string;
  location:string|null;
  timezone:string;
  starts_at:string;
  ends_at:string;
  phase:"scheduled"|"active"|"ended"|"cancelled";
  joined:boolean;
  active_for_me:boolean;
  today_local_date:string;
  today_mission:Mission|null;
  starts_local:string;
  ends_local:string;
};

export default function StampEventsPage(){
  const {supabase,user,profile,permissions,loading}=useAuthProfile();
  const canAccess=profile?.role==="admin"||permissions.includes("S");
  const [events,setEvents]=useState<EventRow[]>([]);
  const [serverNow,setServerNow]=useState<string|null>(null);
  const [busyId,setBusyId]=useState<string|null>(null);
  const [error,setError]=useState<string|null>(null);

  async function call(body:Record<string,unknown>){
    const {data:authData}=await supabase.auth.getSession();
    const accessToken=authData.session?.access_token;
    if(!accessToken) throw new Error("ログインセッションが切れています。再ログインしてください。");
    const {data,error}=await supabase.functions.invoke("stamp-event",{
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

  async function refresh(){
    setError(null);
    try{
      const data=await call({action:"list"});
      setEvents(data.events??[]);
      setServerNow(data.server_now??null);
    }catch(error){
      setError(error instanceof Error?error.message:String(error));
    }
  }

  async function join(eventId:string){
    setBusyId(eventId);setError(null);
    try{
      const data=await call({action:"join",eventId});
      setEvents(data.events??[]);
      setServerNow(data.server_now??null);
    }catch(error){
      setError(error instanceof Error?error.message:String(error));
    }finally{
      setBusyId(null);
    }
  }

  async function leave(eventId:string){
    setBusyId(eventId);setError(null);
    try{
      const data=await call({action:"leave",eventId});
      setEvents(data.events??[]);
      setServerNow(data.server_now??null);
    }catch(error){
      setError(error instanceof Error?error.message:String(error));
    }finally{
      setBusyId(null);
    }
  }

  useEffect(()=>{
    if(loading||!user||!canAccess) return;
    void refresh();
  },[loading,user,canAccess]);

  if(loading){
    return <main className="grid min-h-[70vh] place-items-center text-sm font-black text-[#5d7f4f]">🍀 読み込み中...</main>;
  }

  if(!user||!canAccess){
    return <main className="grid min-h-[70vh] place-items-center px-4 text-center">
      <div><div className="text-5xl">🔒</div><h1 className="mt-3 text-2xl font-black">イベントモード</h1><p className="mt-2 text-sm font-bold text-slate-500">S権限が必要です。</p></div>
    </main>;
  }

  const visible=events.filter(event=>event.phase!=="cancelled");

  return <main className="min-h-screen bg-[#fff8ef]">
    <div className="mx-auto max-w-2xl px-4 py-7">
      <div className="flex items-center justify-between gap-3">
        <Link href="/lab/stamp-rally" className="text-sm font-black text-[#567d48]">← スタンプ一覧</Link>
        <span className="rounded-full bg-[#eef5e8] px-3 py-1 text-[10px] font-black text-[#587848]">EVENT MODE</span>
      </div>

      <section className="mt-5 rounded-[30px] border border-[#efd7bd] bg-gradient-to-br from-[#f6c58f] via-[#f7d7ae] to-[#fff0dc] p-5 shadow-[0_18px_45px_rgba(154,97,42,.12)]">
        <div className="text-4xl">🎪</div>
        <h1 className="mt-2 text-2xl font-black text-[#403a35]">イベントモード</h1>
        <p className="mt-2 text-xs font-bold leading-5 text-[#6f6257]">
          参加するイベントを一度選ぶだけ。開催中のQR交換にはイベント名・場所・現地日付が自動で入ります。
        </p>
        {serverNow?<p className="mt-3 text-[9px] font-bold text-[#927c69]">判定はサーバー時刻を使用しています</p>:null}
      </section>

      {error?<div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-bold text-rose-700">{error}</div>:null}

      <div className="mt-5 space-y-4">
        {visible.length?visible.map(event=>{
          const active=event.phase==="active";
          const scheduled=event.phase==="scheduled";
          const ended=event.phase==="ended";

          return <section key={event.id} className={"rounded-[26px] border p-5 shadow-[0_10px_28px_rgba(92,69,45,.06)] "+(
            event.active_for_me
              ?"border-[#9fc78f] bg-[#f2f8ee]"
              :"border-[#ead6c2] bg-white"
          )}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={"rounded-full px-2.5 py-1 text-[9px] font-black "+(
                    active?"bg-[#dff0d7] text-[#4f753f]"
                    :scheduled?"bg-[#fff1d5] text-[#8b682d]"
                    :"bg-slate-100 text-slate-500"
                  )}>
                    {active?"開催中":scheduled?"開催前":"終了"}
                  </span>
                  {event.joined?<span className="rounded-full bg-[#e8eef8] px-2.5 py-1 text-[9px] font-black text-[#55709a]">
                    {event.active_for_me?"イベントモード ON":"参加済み"}
                  </span>:null}
                </div>
                <h2 className="mt-2 text-lg font-black text-[#433c36]">{event.name}</h2>
                <p className="mt-1 text-xs font-bold text-[#82756a]">📍 {event.location||"場所未設定"}</p>
                <p className="mt-1 text-[10px] font-bold text-[#9b8d81]">
                  {event.starts_local.replace("T"," ")} → {event.ends_local.replace("T"," ")} ・ {event.timezone}
                </p>
              </div>
              <div className="text-3xl">{active?"🔥":"🎟️"}</div>
            </div>

            {event.active_for_me?<div className="mt-4 rounded-[20px] bg-white p-4">
              <div className="text-[10px] font-black text-[#678057]">TODAY'S MISSION ・ {event.today_local_date}</div>
              {event.today_mission?<div className="mt-2">
                <div className="text-sm font-black text-[#413b36]">{event.today_mission.title}</div>
                <div className="mt-1 text-xs font-bold leading-5 text-[#7e7166]">{event.today_mission.instruction}</div>
                <div className="mt-2 text-[9px] font-bold text-[#a09285]">遊びの合図です。端末で動作判定はしません。</div>
              </div>:<div className="mt-2 text-xs font-bold text-[#9a8f85]">今日のミッションは設定されていません。</div>}
            </div>:null}

            {!ended&&!event.joined?<button
              type="button"
              disabled={busyId===event.id}
              onClick={()=>void join(event.id)}
              className="mt-4 w-full rounded-2xl bg-[#5f8e50] px-4 py-3.5 text-sm font-black text-white disabled:opacity-50"
            >
              {busyId===event.id?"参加設定中...":"このイベントに参加する"}
            </button>:null}

            {!ended&&event.joined&&!event.active_for_me?<div className="mt-4 grid grid-cols-[1fr_auto] gap-2">
              <div className="rounded-2xl bg-[#edf5e8] px-4 py-3 text-xs font-black text-[#587848]">✓ 参加登録済み</div>
              <button
                type="button"
                disabled={busyId===event.id}
                onClick={()=>void leave(event.id)}
                className="rounded-2xl bg-[#f2eee9] px-4 py-3 text-xs font-black text-[#75695f] disabled:opacity-50"
              >取消</button>
            </div>:null}

            {event.active_for_me?<div className="mt-4 grid gap-2 sm:grid-cols-2">
              <Link
                href="/lab/stamp-rally/exchange"
                className="block rounded-2xl bg-[#5f8e50] px-4 py-3.5 text-center text-sm font-black text-white"
              >1対1交換 →</Link>
              <Link
                href="/lab/stamp-rally/bulk"
                className="block rounded-2xl bg-[#d99039] px-4 py-3.5 text-center text-sm font-black text-white"
              >🪙 大交換モード →</Link>
            </div>:null}
          </section>;
        }):<div className="rounded-[24px] border border-dashed border-[#d8c7b5] bg-white/70 p-7 text-center text-sm font-bold text-[#8d7c6c]">現在参加できるイベントはありません。</div>}
      </div>

      <div className="mt-5 rounded-[20px] bg-white/70 p-4 text-[10px] font-bold leading-5 text-[#8d7c6c]">
        開催時刻を過ぎると参加モードは自動でOFFになります。端末時刻ではなくサーバー時刻とイベントのタイムゾーンで判定します。
      </div>
    </div>
  </main>;
}
