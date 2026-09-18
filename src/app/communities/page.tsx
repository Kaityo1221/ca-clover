import Link from "next/link";
import { communities } from "@/lib/demo";

export default function Page(){
  return <main className="mx-auto max-w-6xl px-4 py-8 md:px-8">
    <Link href="/" className="text-sm font-black text-lime-700">← CA Clover Home</Link>
    <div className="mt-4">
      <span className="rounded-full bg-lime-200 px-3 py-1 text-xs font-black text-lime-900">全国を見る</span>
      <h1 className="mt-3 text-3xl font-black text-lime-950">🌱 Community一覧</h1>
      <p className="mt-2 text-sm font-semibold text-slate-500">全国のCommunityを探す画面です。</p>
    </div>
    <div className="clover-card mt-6 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[850px] text-left text-sm">
          <thead className="bg-lime-50 text-[11px] font-black text-lime-800">
            <tr><th className="px-5 py-3">都道府県</th><th className="px-5 py-3">Community</th><th className="px-5 py-3">担当CA</th><th className="px-5 py-3">Member</th><th className="px-5 py-3">30日</th><th className="px-5 py-3">Data</th></tr>
          </thead>
          <tbody className="divide-y divide-lime-50">
            {communities.map(c=><tr key={c.id} className="bg-white hover:bg-lime-50/70">
              <td className="px-5 py-4 font-bold">{c.prefecture}</td>
              <td className="px-5 py-4"><Link href={"/community/"+c.id} className="font-black text-lime-900">{c.name}</Link></td>
              <td className="px-5 py-4">{c.cas.join(" / ")}</td>
              <td className="px-5 py-4">{c.members?.toLocaleString("ja-JP")??"未取得"}</td>
              <td className="px-5 py-4 font-black">{c.d30}</td>
              <td className="px-5 py-4">{c.coverage==="complete"?"● 取得済み":c.coverage==="partial"?"◐ 一部取得":"○ 未取得"}</td>
            </tr>)}
          </tbody>
        </table>
      </div>
    </div>
  </main>;
}
