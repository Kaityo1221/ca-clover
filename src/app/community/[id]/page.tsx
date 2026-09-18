import Link from "next/link";
import { notFound } from "next/navigation";
import { communities, meetups } from "@/lib/demo";

export default async function Page({params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  const c=communities.find(x=>x.id===id);
  if(!c) notFound();
  return <main className="mx-auto max-w-6xl px-4 py-7 md:px-8">
    <Link href="/" className="text-sm font-black text-lime-700">← 日本CA一覧</Link>
    <section className="clover-card mt-4 p-6">
      <div className="text-xs font-black text-lime-600">{c.prefecture}</div>
      <h1 className="mt-2 text-3xl font-black text-lime-950">{c.name}</h1>
      <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold text-slate-500"><span className="rounded-full bg-lime-50 px-3 py-2">Community ID: {c.id}</span><span className="rounded-full bg-lime-50 px-3 py-2">CA: {c.cas.join(" / ")}</span></div>
    </section>
    <div className="mt-5 flex gap-2"><button className="clover-pill active">30日</button><button className="clover-pill">90日</button><button className="clover-pill">180日</button><button className="clover-pill">1年</button></div>
    <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {[["🔥","Meetup",c.d30],["🍀","CA Meetup",Math.max(c.d30-1,0)],["📨","RSVP",c.rsvp],["✅","Check-in",c.checkin],["🗓️","最終開催",c.last??"—"]].map(([i,l,v])=><div key={String(l)} className="clover-card p-5"><div className="text-2xl">{i}</div><div className="mt-2 text-xs font-black text-slate-500">{l}</div><div className="mt-1 text-2xl font-black text-lime-950">{v}</div></div>)}
    </div>
    <div className="mt-5 grid gap-5 lg:grid-cols-[.8fr_1.2fr]">
      <section className="clover-card p-5"><h2 className="font-black text-lime-950">📊 月別Activity</h2><div className="mt-8 flex h-52 items-end gap-4">{[40,65,52,88,74,96].map((h,i)=><div key={i} className="flex flex-1 flex-col items-center gap-2"><div className="w-full rounded-t-2xl bg-lime-300" style={{height:h+"%"}}/><span className="text-[10px] font-bold text-slate-400">{i+4}月</span></div>)}</div></section>
      <section className="clover-card overflow-hidden"><div className="border-b border-lime-100 px-5 py-4"><h2 className="font-black text-lime-950">🔥 Meetup履歴</h2></div><div className="divide-y divide-lime-50">{meetups.map(m=><div key={m.date+m.title} className="p-5"><div className="flex justify-between gap-3"><div><div className="text-xs font-black text-lime-700">{m.date}</div><div className="mt-1 font-black text-lime-950">{m.title}</div><div className="mt-1 text-xs text-slate-500">📍 {m.place}</div></div>{m.ca?<span className="h-fit rounded-full bg-lime-200 px-2.5 py-1 text-[11px] font-black text-lime-900">CA Meetup</span>:null}</div><div className="mt-3 flex gap-4 text-xs font-bold text-slate-600"><span>RSVP {m.rsvp}</span><span>Check-in {m.checkin}</span></div></div>)}</div></section>
    </div>
    <section className="clover-card mt-5 p-5"><h2 className="font-black text-lime-950">🧾 Data Coverage</h2><div className="mt-4 grid gap-4 sm:grid-cols-4 text-sm"><div><div className="text-xs text-slate-400">取得期間</div><b>2025/09/18〜2026/09/18</b></div><div><div className="text-xs text-slate-400">保存Meetup</div><b>52件</b></div><div><div className="text-xs text-slate-400">状態</div><b>{c.coverage}</b></div><div><div className="text-xs text-slate-400">最終同期</div><b>2026/09/18 14:30</b></div></div></section>
  </main>;
}
