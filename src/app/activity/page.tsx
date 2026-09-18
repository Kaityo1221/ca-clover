import Link from "next/link";
export default function Page(){
  return <main className="mx-auto max-w-6xl px-4 py-8 md:px-8">
    <Link href="/" className="text-sm font-black text-lime-700">← CA Clover Home</Link>
    <span className="mt-4 block w-fit rounded-full bg-lime-200 px-3 py-1 text-xs font-black text-lime-900">活動を見る</span>
    <h1 className="mt-3 text-3xl font-black text-lime-950">🔥 Meetup Activity</h1>
    <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {["🔥 Meetup","📨 RSVP","✅ Check-in","📊 月別推移"].map(x=><div key={x} className="clover-card min-h-40 p-5"><div className="font-black text-lime-950">{x}</div><div className="mt-8 text-2xl font-black text-slate-300">実データ接続待ち</div></div>)}
    </div>
  </main>;
}
