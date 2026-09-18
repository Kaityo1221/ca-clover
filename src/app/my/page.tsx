import Link from "next/link";
import { communities } from "@/lib/demo";

export default function Page(){
  const c=communities[0];
  return <main className="mx-auto max-w-4xl px-4 py-10">
    <span className="rounded-full bg-lime-200 px-3 py-1 text-xs font-black text-lime-900">MY COMMUNITY</span>
    <h1 className="mt-3 text-3xl font-black text-lime-950">こんにちは、SyoGo 🍀</h1>
    <p className="mt-2 text-sm font-semibold text-slate-500">あなたに割り当てられたCommunityの活動状況です。</p>
    <section className="clover-card mt-6 p-6">
      <div className="text-xs font-black text-lime-600">{c.prefecture}</div><h2 className="mt-1 text-2xl font-black text-lime-950">{c.name}</h2>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[["🌱","Member",c.members?.toLocaleString("ja-JP")??"未取得"],["🔥","30日Meetup",c.d30],["📨","30日RSVP",c.rsvp],["✅","30日Check-in",c.checkin]].map(([i,l,v])=><div key={String(l)} className="rounded-2xl bg-lime-50 p-4"><div>{i}</div><div className="mt-2 text-xs font-black text-slate-500">{l}</div><div className="mt-1 text-xl font-black">{v}</div></div>)}</div>
      <Link href={"/community/"+c.id} className="mt-6 inline-flex rounded-full bg-lime-400 px-5 py-3 text-sm font-black text-lime-950">Community Activityを見る →</Link>
    </section>
  </main>;
}
