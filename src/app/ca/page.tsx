import Link from "next/link";
import { communities } from "@/lib/demo";

export default function Page(){
  const rows=communities.flatMap(c=>c.cas.map((ca,i)=>({ca,community:c.name,prefecture:c.prefecture,level:i===0?"1st":"2nd"})));
  return <main className="mx-auto max-w-5xl px-4 py-8 md:px-8">
    <Link href="/" className="text-sm font-black text-lime-700">← CA Clover Home</Link>
    <span className="mt-4 block w-fit rounded-full bg-lime-200 px-3 py-1 text-xs font-black text-lime-900">全国を見る</span>
    <h1 className="mt-3 text-3xl font-black text-lime-950">🏕️ CA一覧</h1>
    <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map((r,i)=><div key={r.ca+i} className="clover-card p-5">
        <div className="text-xs font-black text-lime-700">{r.prefecture} · {r.level}</div>
        <div className="mt-2 text-lg font-black text-lime-950">{r.ca}</div>
        <div className="mt-1 text-xs font-semibold text-slate-500">{r.community}</div>
      </div>)}
    </div>
  </main>;
}
