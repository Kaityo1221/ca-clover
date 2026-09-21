"use client";

import Link from "next/link";
import { useAuthProfile } from "@/lib/use-auth-profile";

const entries = [
  {
    date: "2026/09/21",
    title: "スマホADMIN・Activity Map・Community申請を整理",
    items: [
      "Activity MapをADMINメニュー最上部へ移動",
      "スマホADMINは普段使うMy Communityを先に表示し、管理機能は管理画面から開く構成へ整理",
      "全国148 Communityのアイコンを巡回。145 Communityのアイコンを取得",
      "アイコン初回取得は通知対象外とし、実際に変更された時だけ要確認表示",
      "Community申請をDiscord通知へ連携。通知からCA Clover審査画面とCampfire確認へ直接移動",
      "Meetup Watchの対応ステータス表示を日本語化",
      "一般ユーザー向け画面ではData Coverage詳細を隠し、不足時だけ注意表示",
      "Campfire自動同期を15分間隔に整理",
    ],
  },
  {
    date: "2026/09/20",
    title: "Activity MapとCommunity管理を強化",
    items: [
      "Activity Mapに期間・指標・都道府県・Community検索を追加",
      "選択期間に合わせてActivity集計を切り替えるよう改善",
      "Community ID履歴管理と申請判定を整理",
      "Community割当・未割当確認の管理導線を改善",
    ],
  },
  {
    date: "2026/09/19",
    title: "Campfire同期基盤を更新",
    items: [
      "Campfire公開Meetupと過去履歴の取得経路を分離",
      "CAマスター同期とCommunity座標取得を自動化",
      "ADMIN向け同期履歴・Coverage確認を追加",
    ],
  },
];

export default function Page(){
  const {user,profile,loading}=useAuthProfile();

  if(loading) return <main className="grid min-h-[70vh] place-items-center text-sm font-black text-lime-800">🍀 読み込み中...</main>;
  if(!user||profile?.role!=="admin") return <main className="grid min-h-[70vh] place-items-center text-center"><div>🔒 ADMIN専用です</div></main>;

  return <main className="mx-auto max-w-3xl px-4 py-8 md:px-8">
    <Link href="/admin" className="text-sm font-black text-lime-700">← 管理メニュー</Link>
    <span className="mt-4 block w-fit rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black text-slate-500">CHANGELOG</span>
    <h1 className="mt-3 text-2xl font-black text-lime-950">更新履歴</h1>
    <p className="mt-2 text-xs font-semibold text-slate-400">CA Cloverの主な変更だけを簡潔に記録しています。</p>

    <div className="mt-7 space-y-5">
      {entries.map(entry=><section key={entry.date} className="clover-card p-5">
        <div className="text-[11px] font-black text-lime-600">{entry.date}</div>
        <h2 className="mt-1 text-base font-black text-lime-950">{entry.title}</h2>
        <ul className="mt-3 space-y-2 text-sm font-semibold leading-6 text-slate-600">
          {entry.items.map(item=><li key={item} className="flex gap-2"><span className="text-lime-500">•</span><span>{item}</span></li>)}
        </ul>
      </section>)}
    </div>
  </main>;
}
