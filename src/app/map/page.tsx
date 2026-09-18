import Link from "next/link";
export default function Page(){
  return <main className="mx-auto max-w-6xl px-4 py-8 md:px-8">
    <Link href="/" className="text-sm font-black text-lime-700">← CA Clover Home</Link>
    <span className="mt-4 block w-fit rounded-full bg-lime-200 px-3 py-1 text-xs font-black text-lime-900">全国を見る</span>
    <h1 className="mt-3 text-3xl font-black text-lime-950">🗾 Activity Map</h1>
    <section className="clover-card mt-6 grid min-h-[520px] place-items-center p-6 text-center">
      <div><div className="text-7xl">🍀</div><div className="mt-4 text-xl font-black text-lime-900">Japan CA Activity Map</div><p className="mt-2 text-sm font-semibold text-slate-500">CA Members Mapの座標をCA Clover用の地図に接続します。</p></div>
    </section>
  </main>;
}
