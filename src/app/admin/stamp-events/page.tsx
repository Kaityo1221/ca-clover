"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAuthProfile } from "@/lib/use-auth-profile";

type Mission={id:string;title:string;instruction:string;is_active:boolean};
type Assignment={event_id:string;local_date:string;mission_template_id:string};
type EventRow={
  id:string;
  name:string;
  location:string|null;
  timezone:string;
  starts_at:string;
  ends_at:string;
  status:"scheduled"|"cancelled";
  phase:"scheduled"|"active"|"ended"|"cancelled";
  participant_count:number;
  starts_local:string;
  ends_local:string;
};

export default function AdminStampEventsPage(){
  const {supabase,user,profile,loading}=useAuthProfile();
  const [events,setEvents]=useState<EventRow[]>([]);
  const [missions,setMissions]=useState<Mission[]>([]);
  const [assignments,setAssignments]=useState<Assignment[]>([]);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const [editingId,setEditingId]=useState<string|null>(null);

  const [name,setName]=useState("");
  const [location,setLocation]=useState("");
  const [timezone,setTimezone]=useState("Asia/Tokyo");
  const [startsLocal,setStartsLocal]=useState("");
  const [endsLocal,setEndsLocal]=useState("");

  const [missionTitle,setMissionTitle]=useState("");
  const [missionInstruction,setMissionInstruction]=useState("");
  const [assignEventId,setAssignEventId]=useState("");
  const [assignDate,setAssignDate]=useState("");
  const [assignMissionId,setAssignMissionId]=useState("");

  async function call(body:Record<string,unknown>){
    const {data,error}=await supabase.functions.invoke("stamp-event",{body});
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

  function apply(data:any){
    setEvents(data.events??[]);
    setMissions(data.missions??[]);
    setAssignments(data.assignments??[]);
  }

  async function refresh(){
    setError(null);
    try{
      apply(await call({action:"list"}));
    }catch(error){
      setError(error instanceof Error?error.message:String(error));
    }
  }

  async function saveEvent(){
    if(busy) return;
    setBusy(true);setError(null);
    try{
      const editing=editingId?events.find(event=>event.id===editingId):null;
      const data=await call(editing?{
        action:"update_event",
        eventId:editing.id,
        name,location,timezone,startsLocal,endsLocal,
        status:editing.status,
      }:{
        action:"create_event",
        name,location,timezone,startsLocal,endsLocal,
      });
      apply(data);
      setEditingId(null);
      setName("");setLocation("");setStartsLocal("");setEndsLocal("");
    }catch(error){
      setError(error instanceof Error?error.message:String(error));
    }finally{setBusy(false);}
  }

  function startEdit(event:EventRow){
    setEditingId(event.id);
    setName(event.name);
    setLocation(event.location??"");
    setTimezone(event.timezone);
    setStartsLocal(event.starts_local);
    setEndsLocal(event.ends_local);
    window.scrollTo({top:0,behavior:"smooth"});
  }

  function cancelEdit(){
    setEditingId(null);
    setName("");setLocation("");setTimezone("Asia/Tokyo");setStartsLocal("");setEndsLocal("");
  }

  async function cancelEvent(event:EventRow){
    if(busy) return;
    setBusy(true);setError(null);
    try{
      const data=await call({
        action:"update_event",
        eventId:event.id,
        name:event.name,
        location:event.location??"",
        timezone:event.timezone,
        startsLocal:event.starts_local,
        endsLocal:event.ends_local,
        status:"cancelled",
      });
      apply(data);
    }catch(error){
      setError(error instanceof Error?error.message:String(error));
    }finally{setBusy(false);}
  }

  async function createMission(){
    if(busy) return;
    setBusy(true);setError(null);
    try{
      const data=await call({
        action:"create_mission",
        title:missionTitle,
        instruction:missionInstruction,
      });
      apply(data);
      setMissionTitle("");setMissionInstruction("");
    }catch(error){
      setError(error instanceof Error?error.message:String(error));
    }finally{setBusy(false);}
  }

  async function assignMission(){
    if(busy) return;
    setBusy(true);setError(null);
    try{
      const data=await call({
        action:"assign_mission",
        eventId:assignEventId,
        localDate:assignDate,
        missionId:assignMissionId,
      });
      apply(data);
    }catch(error){
      setError(error instanceof Error?error.message:String(error));
    }finally{setBusy(false);}
  }

  useEffect(()=>{
    if(loading||!user||profile?.role!=="admin") return;
    void refresh();
  },[loading,user,profile?.role]);

  useEffect(()=>{
    if(assignEventId||!events.length) return;
    const first=events.find(event=>event.status==="scheduled")??events[0];
    if(first){
      setAssignEventId(first.id);
      setAssignDate(first.starts_local.slice(0,10));
    }
  },[events,assignEventId]);

  useEffect(()=>{
    if(assignMissionId||!missions.length) return;
    setAssignMissionId(missions[0].id);
  },[missions,assignMissionId]);

  const missionById=useMemo(()=>new Map(missions.map(mission=>[mission.id,mission])),[missions]);

  if(loading) return <main className="grid min-h-[70vh] place-items-center text-sm font-black text-lime-800">🍀 読み込み中...</main>;
  if(!user||profile?.role!=="admin") return <main className="grid min-h-[70vh] place-items-center px-4 text-center"><div><div className="text-5xl">🔒</div><h1 className="mt-3 text-2xl font-black">ADMIN専用です</h1></div></main>;

  return <main className="mx-auto max-w-5xl px-4 py-8 md:px-8">
    <Link href="/admin" className="text-sm font-black text-lime-700">← 管理メニュー</Link>
    <span className="mt-4 block w-fit rounded-full bg-orange-100 px-3 py-1 text-xs font-black text-orange-800">STAMP EVENT</span>
    <h1 className="mt-3 text-3xl font-black text-lime-950">🎪 イベント管理</h1>
    <p className="mt-2 text-sm font-semibold text-slate-500">イベント期間・場所・タイムゾーン・日替わりミッションを設定します。</p>

    {error?<div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">{error}</div>:null}

    <section className="mt-6 rounded-3xl border border-orange-100 bg-orange-50/60 p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-black text-slate-900">{editingId?"イベントを編集":"新しいイベント"}</h2>
        {editingId?<button type="button" onClick={cancelEdit} className="rounded-full bg-white px-3 py-2 text-xs font-black text-slate-500">新規に戻る</button>:null}
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="text-xs font-black text-slate-600">イベント名
          <input value={name} onChange={e=>setName(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm" placeholder="ワイルドエリア仙台 東北"/>
        </label>
        <label className="text-xs font-black text-slate-600">場所
          <input value={location} onChange={e=>setLocation(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm" placeholder="仙台市"/>
        </label>
        <label className="text-xs font-black text-slate-600">開始
          <input type="datetime-local" value={startsLocal} onChange={e=>setStartsLocal(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm"/>
        </label>
        <label className="text-xs font-black text-slate-600">終了
          <input type="datetime-local" value={endsLocal} onChange={e=>setEndsLocal(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm"/>
        </label>
        <label className="text-xs font-black text-slate-600 md:col-span-2">タイムゾーン
          <input value={timezone} onChange={e=>setTimezone(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm" placeholder="Asia/Tokyo"/>
        </label>
      </div>
      <button disabled={busy||!name||!startsLocal||!endsLocal} onClick={()=>void saveEvent()} className="mt-4 rounded-xl bg-lime-600 px-5 py-3 text-sm font-black text-white disabled:opacity-50">{editingId?"変更を保存":"イベントを作成"}</button>
    </section>

    <section className="mt-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-black text-slate-900">イベント一覧</h2>
        <button onClick={()=>void refresh()} className="rounded-full bg-slate-100 px-3 py-2 text-xs font-black text-slate-600">更新</button>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {events.map(event=><article key={event.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className={"rounded-full px-2.5 py-1 text-[10px] font-black "+(
                event.phase==="active"?"bg-lime-100 text-lime-800"
                :event.phase==="scheduled"?"bg-amber-100 text-amber-800"
                :event.phase==="cancelled"?"bg-rose-100 text-rose-700"
                :"bg-slate-100 text-slate-500"
              )}>{event.phase==="active"?"開催中":event.phase==="scheduled"?"開催前":event.phase==="cancelled"?"中止":"終了"}</span>
              <h3 className="mt-2 font-black text-slate-900">{event.name}</h3>
              <p className="mt-1 text-xs font-bold text-slate-500">📍 {event.location||"場所未設定"}</p>
            </div>
            <div className="rounded-2xl bg-lime-50 px-3 py-2 text-center">
              <div className="text-lg font-black text-lime-800">{event.participant_count??0}</div>
              <div className="text-[9px] font-black text-lime-700">参加CA</div>
            </div>
          </div>
          <div className="mt-3 text-[11px] font-bold leading-5 text-slate-500">
            {event.starts_local.replace("T"," ")} → {event.ends_local.replace("T"," ")}<br/>
            {event.timezone}
          </div>
          {event.status==="scheduled"&&event.phase!=="ended"?<div className="mt-3 flex gap-2">
            <button disabled={busy} onClick={()=>startEdit(event)} className="rounded-xl bg-lime-50 px-3 py-2 text-xs font-black text-lime-700 disabled:opacity-50">編集</button>
            <button disabled={busy} onClick={()=>void cancelEvent(event)} className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-black text-slate-600 disabled:opacity-50">イベントを中止</button>
          </div>:null}
        </article>)}
      </div>
    </section>

    <section className="mt-8 rounded-3xl border border-lime-100 bg-lime-50/50 p-5">
      <h2 className="text-lg font-black text-slate-900">🎯 ミッションストック</h2>
      <p className="mt-1 text-xs font-bold text-slate-500">端末で検知する機能ではなく、その日の交換前にみんなで楽しむ合図です。</p>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {missions.map(mission=><div key={mission.id} className="rounded-2xl bg-white p-3">
          <div className="text-sm font-black text-slate-800">{mission.title}</div>
          <div className="mt-1 text-[11px] font-bold leading-5 text-slate-500">{mission.instruction}</div>
        </div>)}
      </div>
      <div className="mt-4 grid gap-2 md:grid-cols-[220px_1fr_auto]">
        <input value={missionTitle} onChange={e=>setMissionTitle(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm" placeholder="ミッション名"/>
        <input value={missionInstruction} onChange={e=>setMissionInstruction(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm" placeholder="内容"/>
        <button disabled={busy||!missionTitle||!missionInstruction} onClick={()=>void createMission()} className="rounded-xl bg-lime-600 px-4 py-3 text-xs font-black text-white disabled:opacity-50">追加</button>
      </div>
    </section>

    <section className="mt-6 rounded-3xl border border-sky-100 bg-sky-50/50 p-5">
      <h2 className="text-lg font-black text-slate-900">📅 日替わりミッション設定</h2>
      <div className="mt-4 grid gap-2 md:grid-cols-3">
        <select value={assignEventId} onChange={e=>{setAssignEventId(e.target.value);const ev=events.find(x=>x.id===e.target.value);if(ev)setAssignDate(ev.starts_local.slice(0,10));}} className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm">
          <option value="">イベントを選択</option>
          {events.filter(event=>event.status==="scheduled").map(event=><option key={event.id} value={event.id}>{event.name}</option>)}
        </select>
        <input type="date" value={assignDate} onChange={e=>setAssignDate(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm"/>
        <select value={assignMissionId} onChange={e=>setAssignMissionId(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm">
          <option value="">ミッションを選択</option>
          {missions.map(mission=><option key={mission.id} value={mission.id}>{mission.title}</option>)}
        </select>
      </div>
      <button disabled={busy||!assignEventId||!assignDate||!assignMissionId} onClick={()=>void assignMission()} className="mt-3 rounded-xl bg-sky-600 px-4 py-3 text-xs font-black text-white disabled:opacity-50">この日のミッションに設定</button>

      {assignments.length?<div className="mt-4 space-y-2">
        {assignments.slice().sort((a,b)=>a.local_date.localeCompare(b.local_date)).map(row=>{
          const event=events.find(x=>x.id===row.event_id);
          const mission=missionById.get(row.mission_template_id);
          return <div key={row.event_id+row.local_date} className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-slate-600">
            <span className="font-black text-slate-800">{row.local_date}</span> ・ {event?.name??"イベント"} → {mission?.title??"ミッション"}
          </div>;
        })}
      </div>:null}
    </section>
  </main>;
}
