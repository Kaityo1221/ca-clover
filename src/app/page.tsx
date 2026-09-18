import Link from "next/link";
import { communities, type Coverage } from "@/lib/demo";

function Header(){
  return <header className="sticky top-0 z-20 border-b border-lime-100 bg-white/90 backdrop-blur-xl">
    <div className="mx-auto flex max-w-[1500px] items-center gap-3 px-4 py-3 md:px-8">
      <span className="grid size-11 place-items-center rounded-2xl bg-lime-300 text-2xl">🍀</span>
      <div><div className="font-black text-lime-950">CA Clover</div><div className="text-[11px] font-bold text-lime-700">Japan Community Activity Dashboard</div></div>
      <div className="ml-auto rounded-full bg-lime-50 px-3 py-2 text-xs font-black text-lime-800">ADMIN</div>
    </div>
  </header>;
}
function Stat({icon,label,value}:{icon:string;label:string;value:string|number}){
  return <div className="clover-card p-5"><div className="text-2xl">{icon}</div><div className="mt-3 text-xs font-black text-slate-500">{label}</div><div className="mt-1 text-3xl font-black text-lime-950">{value}</div></div>;
}
function Coverage({value}:{value:Coverage}){
  const labels={complete:"● 取得済み",partial:"◐ 一部取得",missing:"○ 未取得"};
  const styles={complete:"bg-emerald-100 text-emerald-800",partial:"bg-lime-100 text-lime-800",missing:"bg-slate-100 text-slate-600"};
  return <span className={"rounded-full px-2.5 py-1 text-[11px] font-black "+styles[value]}>{labels[value]}</span>;
}

export default function Page(){
  const caCount=new Set(communities.flatMap(x=>x.cas)).size;
  const d30=communities.reduce((a,b)=>a+b.d30,0);
  const rsvp=communities.reduce((a,b)=>a+b.rsvp,0);
  const ci=communities.reduce((a,b)=>a+b.checkin,0);
  return <>
    <Header/>
    <main className="mx-auto max-w-[1500px] px-4 py-7 md:px-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <span className="rounded-full bg-lime-200 px-3 py-1 text-xs font-black text-lime-900">ADMIN DASHBOARD</span>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-lime-950 md:text-4xl">日本CAの活動を、ひと目で。🍀</h1>
          <p className="mt-2 text-sm font-semibold text-slate-500">CA Members Mapの基礎情報とCommunity活動データを重ねます。</p>
        </div>
        <div className="flex flex-wrap gap-2"><button className="clover-pill active">全国</button><button className="clover-pill">関東</button><button className="clover-pill">近畿</button><button className="clover-pill">活動あり</button><button className="clover-pill">未取得</button></div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Stat icon="🌱" label="登録Community" value={communities.length}/>
        <Stat icon="🏕️" label="現役CA" value={caCount}/>
        <Stat icon="🔥" label="30日Meetup" value={d30}/>
        <Stat icon="📨" label="30日RSVP" value={rsvp}/>
        <Stat icon="✅" label="30日Check-in" value={ci}/>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.1fr_.9fr]">
        <section className="clover-card min-h-[360px] p-5">
          <h2 className="font-black text-lime-950">🗾 日本CA Activity Map</h2>
          <p className="mt-1 text-xs font-semibold text-slate-500">CA Members Mapの座標同期後に実地図へ差し替えます。</p>
          <div className="mx-auto mt-8 grid h-64 max-w-2xl place-items-center rounded-[45%] border-2 border-dashed border-lime-300 bg-lime-100/70 text-center">
            <div><div className="text-6xl">🍀</div><div className="mt-3 text-sm font-black text-lime-800">Japan CA Activity Map</div></div>
          </div>
        </section>
        <section className="clover-card p-5">
          <h2 className="font-black text-lime-950">🔎 管理チェック</h2>
          <div className="mt-5 space-y-3">
            <div className="rounded-2xl bg-lime-50 p-4"><div className="text-xs font-black text-lime-800">◐ 一部取得</div><div className="mt-1 text-2xl font-black">2 Community</div></div>
            <div className="rounded-2xl bg-slate-50 p-4"><div className="text-xs font-black text-slate-600">○ 未取得</div><div className="mt-1 text-2xl font-black">1 Community</div></div>
            <div className="rounded-2xl bg-emerald-50 p-4"><div className="text-xs font-black text-emerald-700">● 取得済み</div><div className="mt-1 text-2xl font-black">1 Community</div></div>
          </div>
        </section>
      </div>

      <section className="clover-card mt-5 overflow-hidden">
        <div className="border-b border-lime-100 px-5 py-4"><h2 className="font-black text-lime-950">🏕️ Community一覧</h2></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[980px] text-left text-sm">
          <thead className="bg-lime-50 text-[11px] font-black text-lime-800"><tr><th className="px-5 py-3">都道府県</th><th className="px-5 py-3">Community</th><th className="px-5 py-3">担当CA</th><th className="px-5 py-3">Member</th><th className="px-5 py-3">最終開催</th><th className="px-5 py-3">30日</th><th className="px-5 py-3">90日</th><th className="px-5 py-3">RSVP</th><th className="px-5 py-3">CI</th><th className="px-5 py-3">Data</th></tr></thead>
          <tbody className="divide-y divide-lime-50">{communities.map(c=><tr key={c.id} className="bg-white hover:bg-lime-50/70"><td className="px-5 py-4 font-bold">{c.prefecture}</td><td className="px-5 py-4"><Link className="font-black text-lime-900" href={"/community/"+c.id}>{c.name}</Link></td><td className="px-5 py-4">{c.cas.join(" / ")}</td><td className="px-5 py-4">{c.members?.toLocaleString("ja-JP")??"未取得"}</td><td className="px-5 py-4">{c.last??"—"}</td><td className="px-5 py-4 font-black">{c.d30}</td><td className="px-5 py-4 font-black">{c.d90}</td><td className="px-5 py-4">{c.rsvp}</td><td className="px-5 py-4">{c.checkin}</td><td className="px-5 py-4"><Coverage value={c.coverage}/></td></tr>)}</tbody>
        </table></div>
      </section>
    </main>
  </>;
}
