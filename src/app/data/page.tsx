import Link from "next/link";
export default function Page(){
  return <main className="mx-auto max-w-5xl px-4 py-8 md:px-8">
    <Link href="/" className="text-sm font-black text-lime-700">← CA Clover Home</Link>
    <span className="mt-4 block w-fit rounded-full bg-lime-200 px-3 py-1 text-xs font-black text-lime-900">活動を見る</span>
    <h1 className="mt-3 text-3xl font-black text-lime-950">🧾 Data Coverage</h1>
    <div className="mt-6 grid gap-4 sm:grid-cols-3">
      <div className="clover-card p-6"><div className="text-xs font-black text-emerald-700">CA MASTER</div><div className="mt-2 text-4xl font-black text-lime-950">177</div><div className="mt-2 text-xs text-slate-500">CA登録済み</div></div>
      <div className="clover-card p-6"><div className="text-xs font-black text-lime-700">COMMUNITY</div><div className="mt-2 text-4xl font-black text-lime-950">141</div><div className="mt-2 text-xs text-slate-500">Community解決済み</div></div>
      <div className="clover-card p-6"><div className="text-xs font-black text-amber-700">UNRESOLVED</div><div className="mt-2 text-4xl font-black text-lime-950">1</div><div className="mt-2 text-xs text-slate-500">紐付け要確認</div></div>
    </div>
  </main>;
}
