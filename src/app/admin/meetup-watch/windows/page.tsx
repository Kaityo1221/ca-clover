"use client";

import Link from "next/link";
import {useEffect,useMemo,useState,type FormEvent} from "react";
import {useAuthProfile} from "@/lib/use-auth-profile";

type WindowRow={
  id:string;
  event_name:string;
  starts_at:string;
  ends_at:string;
  enabled:boolean;
  notes:string|null;
  source:string;
  auto_managed:boolean;
};

type CalendarEntry={
  id:string;
  event_name:string;
  starts_at:string;
  ends_at:string;
  duration_minutes:number;
  watch_window_eligible:boolean;
  is_all_day:boolean;
  last_seen_at:string;
};

function fmt(value:string){
  return new Date(value).toLocaleString("ja-JP");
}

function durationText(minutes:number){
  if(minutes>=24*60){
    const days=Math.round(minutes/(24*60)*10)/10;
    return days+"日";
  }
  if(minutes>=60){
    const hours=Math.round(minutes/60*10)/10;
    return hours+"時間";
  }
  return minutes+"分";
}

export default function Page(){
  const {supabase,user,profile,loading}=useAuthProfile();
  const [rows,setRows]=useState<WindowRow[]>([]);
  const [calendar,setCalendar]=useState<CalendarEntry[]>([]);
  const [name,setName]=useState("");
  const [start,setStart]=useState("");
  const [end,setEnd]=useState("");
  const [notes,setNotes]=useState("");
  const [error,setError]=useState<string|null>(null);
  const [syncState,setSyncState]=useState<"idle"|"syncing"|"success"|"error">("idle");

  async function load(){
    setError(null);
    const from=new Date(Date.now()-7*24*60*60*1000).toISOString();
    const [windowResult,calendarResult]=await Promise.all([
      supabase
        .from("official_event_windows")
        .select("id,event_name,starts_at,ends_at,enabled,notes,source,auto_managed")
        .order("starts_at",{ascending:false}),
      supabase
        .from("event_calendar_entries")
        .select("id,event_name,starts_at,ends_at,duration_minutes,watch_window_eligible,is_all_day,last_seen_at")
        .gte("ends_at",from)
        .order("starts_at",{ascending:true})
        .limit(300),
    ]);

    const firstError=windowResult.error||calendarResult.error;
    if(firstError){
      setError(firstError.message);
      return;
    }
    setRows((windowResult.data as WindowRow[]|null)??[]);
    setCalendar((calendarResult.data as CalendarEntry[]|null)??[]);
  }

  useEffect(()=>{
    if(!loading&&user&&profile?.role==="admin") load();
  },[loading,user,profile?.role]);

  async function syncCalendar(){
    setSyncState("syncing");
    setError(null);
    const {data,error}=await supabase.functions.invoke("sync-event-calendar",{body:{}});
    if(error){
      setSyncState("error");
      setError(error.message);
      return;
    }
    if(data?.ok!==true){
      setSyncState("error");
      setError(data?.error??"イベントカレンダー同期に失敗しました");
      return;
    }
    setSyncState("success");
    await load();
  }

  async function submit(event:FormEvent){
    event.preventDefault();
    setError(null);
    if(!name.trim()||!start||!end) return;
    const {error}=await supabase.from("official_event_windows").insert({
      event_name:name.trim(),
      starts_at:new Date(start).toISOString(),
      ends_at:new Date(end).toISOString(),
      notes:notes.trim()||null,
      source:"manual",
      auto_managed:false,
      enabled:true,
      updated_at:new Date().toISOString(),
    } as never);
    if(error){
      setError(error.message);
      return;
    }
    setName("");
    setStart("");
    setEnd("");
    setNotes("");
    await load();
  }

  async function toggle(row:WindowRow){
    const {error}=await supabase.from("official_event_windows").update({
      enabled:!row.enabled,
      updated_at:new Date().toISOString(),
    } as never).eq("id",row.id);
    if(error) setError(error.message);
    else await load();
  }

  const longEvents=useMemo(
    ()=>calendar.filter(row=>!row.watch_window_eligible),
    [calendar],
  );
  const latestSync=useMemo(()=>{
    const values=calendar
      .map(row=>Date.parse(row.last_seen_at))
      .filter(Number.isFinite);
    return values.length?new Date(Math.max(...values)).toLocaleString("ja-JP"):null;
  },[calendar]);

  if(loading) return <main className="grid min-h-[70vh] place-items-center text-sm font-black text-lime-800">🍀 読み込み中...</main>;
  if(!user||profile?.role!=="admin") return <main className="grid min-h-[70vh] place-items-center text-center">🔒 ADMIN専用です</main>;

  return <main className="mx-auto max-w-5xl px-4 py-8 md:px-8">
    <Link href="/admin/meetup-watch" className="text-sm font-black text-lime-700">← 要確認Meetup</Link>
    <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-3xl font-black text-lime-950">🕐 イベント時間マスター</h1>
        <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-500">
          みんポケ「イベント」iCalを参照データとして自動同期します。12時間以下のイベントだけをWatchの時間窓に使用し、
          12時間を超える長期イベントは参考表示だけにします。
        </p>
      </div>
      <button
        type="button"
        onClick={syncCalendar}
        disabled={syncState==="syncing"}
        className="rounded-xl bg-lime-500 px-4 py-2 text-xs font-black text-white disabled:opacity-50"
      >
        {syncState==="syncing"?"同期中...":"🔄 みんポケから今すぐ同期"}
      </button>
    </div>

    <div className="mt-4 rounded-2xl bg-lime-50 p-4 text-sm font-semibold leading-6 text-lime-950">
      <div className="font-black">Meetup Watchの時間ルール</div>
      <div className="mt-1">公式開始60分前〜開始：PRE_GRACE（待ち合わせ・受付として判定除外）</div>
      <div>開催中〜終了後60分：GRACE（原則判定除外）</div>
      <div>開始60分より前：通常のWatch判定</div>
      <div>12時間超のイベント：開催期間中でも通常のWatch判定</div>
    </div>

    <div className="mt-4 flex flex-wrap gap-2 text-xs font-black">
      <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">
        情報源：みんポケ イベントiCal
      </span>
      <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">
        これはNiantic公式フィードではなく参照データです
      </span>
      {latestSync?<span className="rounded-full bg-lime-100 px-3 py-1 text-lime-800">最終取得 {latestSync}</span>:null}
      {syncState==="success"?<span className="rounded-full bg-lime-500 px-3 py-1 text-white">同期完了</span>:null}
    </div>

    {error?<div className="mt-4 rounded-2xl bg-rose-50 p-4 text-sm font-bold text-rose-700">{error}</div>:null}

    <form onSubmit={submit} className="clover-card mt-6 grid gap-3 p-5 md:grid-cols-2">
      <div className="md:col-span-2">
        <div className="font-black text-lime-950">手動追加・補正</div>
        <div className="mt-1 text-xs font-semibold text-slate-500">
          自動取得できない特殊イベントだけ、ここから追加できます。
        </div>
      </div>
      <label className="md:col-span-2">
        <span className="text-xs font-black text-slate-500">Campfire Live Event名</span>
        <input value={name} onChange={e=>setName(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" placeholder="例：Community Day"/>
      </label>
      <label>
        <span className="text-xs font-black text-slate-500">開始</span>
        <input type="datetime-local" value={start} onChange={e=>setStart(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"/>
      </label>
      <label>
        <span className="text-xs font-black text-slate-500">終了</span>
        <input type="datetime-local" value={end} onChange={e=>setEnd(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"/>
      </label>
      <label className="md:col-span-2">
        <span className="text-xs font-black text-slate-500">メモ</span>
        <input value={notes} onChange={e=>setNotes(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"/>
      </label>
      <button className="w-fit rounded-xl bg-lime-500 px-5 py-2 text-sm font-black text-white">登録</button>
    </form>

    <section className="mt-8">
      <h2 className="text-lg font-black text-lime-950">Watchで使う時間窓</h2>
      <p className="mt-1 text-xs font-semibold text-slate-500">
        みんポケ自動取得は12時間以下のみ。OFFにした自動行は次回同期でもOFFを維持します。
      </p>
      <div className="mt-3 space-y-3">
        {rows.map(row=><div key={row.id} className="clover-card flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="font-black text-lime-950">{row.event_name}</div>
              <span className={row.source==="minpoke_event_ical"
                ?"rounded-full bg-sky-100 px-2 py-1 text-[10px] font-black text-sky-700"
                :"rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-600"}>
                {row.source==="minpoke_event_ical"?"みんポケ自動":"手動"}
              </span>
            </div>
            <div className="mt-1 text-xs font-semibold text-slate-500">
              {fmt(row.starts_at)} 〜 {fmt(row.ends_at)}
            </div>
            {row.notes?<div className="mt-1 text-xs text-slate-500">{row.notes}</div>:null}
          </div>
          <button
            type="button"
            onClick={()=>toggle(row)}
            className={row.enabled
              ?"rounded-full bg-lime-100 px-3 py-1 text-xs font-black text-lime-800"
              :"rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-500"}
          >
            {row.enabled?"ON":"OFF"}
          </button>
        </div>)}
        {!rows.length?<div className="rounded-2xl bg-slate-50 p-6 text-center text-sm font-semibold text-slate-500">時間窓はまだありません。</div>:null}
      </div>
    </section>

    <section className="mt-8">
      <h2 className="text-lg font-black text-lime-950">長期イベント・参考のみ</h2>
      <p className="mt-1 text-xs font-semibold text-slate-500">
        12時間を超えるイベントは記録しますが、Meetup Watchの判定除外には使いません。
      </p>
      <div className="mt-3 space-y-2">
        {longEvents.slice(0,60).map(row=><div key={row.id} className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="font-bold text-slate-700">{row.event_name}</div>
            <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-500">
              参考のみ / {durationText(row.duration_minutes)}
            </span>
          </div>
          <div className="mt-1 text-xs font-semibold text-slate-500">
            {fmt(row.starts_at)} 〜 {fmt(row.ends_at)}
          </div>
        </div>)}
        {!longEvents.length?<div className="rounded-2xl bg-slate-50 p-6 text-center text-sm font-semibold text-slate-500">現在表示する長期イベントはありません。</div>:null}
      </div>
    </section>
  </main>;
}
