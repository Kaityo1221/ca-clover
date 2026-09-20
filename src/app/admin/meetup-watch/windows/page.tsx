"use client";

import Link from "next/link";
import {FormEvent,useEffect,useState} from "react";
import {useAuthProfile} from "@/lib/use-auth-profile";

type WindowRow={
  id:string;
  event_name:string;
  starts_at:string;
  ends_at:string;
  enabled:boolean;
  notes:string|null;
};

export default function Page(){
  const {supabase,user,profile,loading}=useAuthProfile();
  const [rows,setRows]=useState<WindowRow[]>([]);
  const [name,setName]=useState("");
  const [start,setStart]=useState("");
  const [end,setEnd]=useState("");
  const [notes,setNotes]=useState("");
  const [error,setError]=useState<string|null>(null);

  async function load(){
    const {data,error}=await supabase
      .from("official_event_windows")
      .select("id,event_name,starts_at,ends_at,enabled,notes")
      .order("starts_at",{ascending:false});
    if(error) setError(error.message);
    else setRows((data as WindowRow[]|null)??[]);
  }

  useEffect(()=>{
    if(!loading&&user&&profile?.role==="admin") load();
  },[loading,user,profile?.role]);

  async function submit(event:FormEvent){
    event.preventDefault();
    setError(null);
    if(!name.trim()||!start||!end) return;
    const {error}=await supabase.from("official_event_windows").insert({
      event_name:name.trim(),
      starts_at:new Date(start).toISOString(),
      ends_at:new Date(end).toISOString(),
      notes:notes.trim()||null,
      enabled:true,
      updated_at:new Date().toISOString(),
    });
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
    }).eq("id",row.id);
    if(error) setError(error.message);
    else await load();
  }

  if(loading) return <main className="grid min-h-[70vh] place-items-center text-sm font-black text-lime-800">🍀 読み込み中...</main>;
  if(!user||profile?.role!=="admin") return <main className="grid min-h-[70vh] place-items-center text-center">🔒 ADMIN専用です</main>;

  return <main className="mx-auto max-w-4xl px-4 py-8 md:px-8">
    <Link href="/admin/meetup-watch" className="text-sm font-black text-lime-700">← 要確認Meetup</Link>
    <h1 className="mt-4 text-3xl font-black text-lime-950">🕐 公式イベント時間マスター</h1>
    <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
      Campfire Live Event名と公式時間を登録します。開始前・開催中・終了後60分以内はWatch判定対象外です。
    </p>

    {error?<div className="mt-4 rounded-2xl bg-rose-50 p-4 text-sm font-bold text-rose-700">{error}</div>:null}

    <form onSubmit={submit} className="clover-card mt-6 grid gap-3 p-5 md:grid-cols-2">
      <label className="md:col-span-2">
        <span className="text-xs font-black text-slate-500">Campfire Live Event名</span>
        <input value={name} onChange={e=>setName(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" placeholder="例：Community Day"/>
      </label>
      <label>
        <span className="text-xs font-black text-slate-500">公式開始</span>
        <input type="datetime-local" value={start} onChange={e=>setStart(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"/>
      </label>
      <label>
        <span className="text-xs font-black text-slate-500">公式終了</span>
        <input type="datetime-local" value={end} onChange={e=>setEnd(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"/>
      </label>
      <label className="md:col-span-2">
        <span className="text-xs font-black text-slate-500">メモ</span>
        <input value={notes} onChange={e=>setNotes(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"/>
      </label>
      <button className="w-fit rounded-xl bg-lime-500 px-5 py-2 text-sm font-black text-white">登録</button>
    </form>

    <div className="mt-6 space-y-3">
      {rows.map(row=><div key={row.id} className="clover-card flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <div className="font-black text-lime-950">{row.event_name}</div>
          <div className="mt-1 text-xs font-semibold text-slate-500">
            {new Date(row.starts_at).toLocaleString("ja-JP")} 〜 {new Date(row.ends_at).toLocaleString("ja-JP")}
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
    </div>
  </main>;
}
