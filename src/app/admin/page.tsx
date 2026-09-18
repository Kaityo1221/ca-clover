import Link from "next/link";
const buttons=[
  ["🔄","データ同期","CAマスターとActivityを更新"],
  ["🔗","Community割当","CAとCommunityの紐付け"],
  ["👥","CAアカウント","承認・権限を管理"],
  ["🧾","同期履歴","取得結果とエラーを確認"],
  ["⚙️","データ設定","取得元・更新条件を管理"],
  ["🛡️","権限設定","ADMIN / CA / pendingを管理"],
];
export default function Page(){
  return <main className="mx-auto max-w-5xl px-4 py-8 md:px-8">
    <Link href="/" className="text-sm font-black text-lime-700">← CA Clover Home</Link>
    <span className="mt-4 block w-fit rounded-full bg-lime-200 px-3 py-1 text-xs font-black text-lime-900">管理する</span>
    <h1 className="mt-3 text-3xl font-black text-lime-950">⚙️ 管理メニュー</h1>
    <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {buttons.map(([i,t,d])=><button key={t} className="clover-card min-h-40 p-5 text-left transition hover:-translate-y-1 hover:border-lime-300">
        <div className="text-3xl">{i}</div><div className="mt-4 font-black text-lime-950">{t}</div><div className="mt-1 text-xs font-semibold text-slate-500">{d}</div>
      </button>)}
    </div>
  </main>;
}
