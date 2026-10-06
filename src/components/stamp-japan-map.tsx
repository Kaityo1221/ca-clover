"use client";

import { PREFECTURE_ORDER } from "@/lib/prefecture-order";

type Props = {
  acquiredPrefectures: ReadonlySet<string>;
  acquiredStampCount: number;
  onSelectPrefecture?: (prefecture: string) => void;
};

const REGION_LAYOUT = [
  { name: "北海道", rows: [["北海道"]] },
  { name: "東北", rows: [["青森県"],["秋田県","岩手県"],["山形県","宮城県"],["福島県"]] },
  { name: "関東", rows: [["群馬県","栃木県","茨城県"],["埼玉県","東京都","千葉県"],["神奈川県"]] },
  { name: "中部", rows: [["新潟県","富山県","石川県","福井県"],["山梨県","長野県","岐阜県"],["静岡県","愛知県"]] },
  { name: "近畿", rows: [["三重県","滋賀県","京都府"],["大阪府","兵庫県","奈良県"],["和歌山県"]] },
  { name: "中国", rows: [["鳥取県","島根県","岡山県","広島県","山口県"]] },
  { name: "四国", rows: [["徳島県","香川県","愛媛県","高知県"]] },
  { name: "九州・沖縄", rows: [["福岡県","佐賀県","長崎県"],["熊本県","大分県"],["宮崎県","鹿児島県"],["沖縄県"]] },
] as const;

const SHORT_LABEL: Record<string,string> = Object.fromEntries(
  PREFECTURE_ORDER.map(name => [name, name.replace(/[都道府県]$/u, "")])
);

export function StampJapanMap({ acquiredPrefectures, acquiredStampCount, onSelectPrefecture }: Props) {
  const acquiredCount=PREFECTURE_ORDER.filter(prefecture=>acquiredPrefectures.has(prefecture)).length;

  return <section className="mt-5 overflow-hidden rounded-[30px] border border-[#d7e3cf] bg-gradient-to-b from-[#f8fcf5] to-white p-4 shadow-[0_16px_38px_rgba(77,112,61,.10)] sm:p-6">
    <div className="flex items-end justify-between gap-4">
      <div>
        <div className="text-[10px] font-black tracking-[.18em] text-[#6f9560]">JAPAN MAP</div>
        <h2 className="mt-1 text-xl font-black text-[#3d4938] sm:text-2xl">出会いで、日本が緑になる。</h2>
      </div>
      <div className="shrink-0 text-right">
        <div className="text-2xl font-black text-[#4f7d3b]">{acquiredCount}<span className="ml-1 text-xs text-[#8ca082]">/ 47</span></div>
        <div className="text-[9px] font-black text-[#87947f]">交流した都道府県</div>
      </div>
    </div>

    <div className="mt-4 rounded-[24px] border border-[#e2eadc] bg-[#f4f6f1] p-3 sm:p-4">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {REGION_LAYOUT.map(region=><div key={region.name} className="rounded-[18px] bg-white/75 p-2.5">
          <div className="mb-2 text-[9px] font-black tracking-[.12em] text-[#9a9f95]">{region.name}</div>
          <div className="space-y-1.5">
            {region.rows.map((row,rowIndex)=><div key={rowIndex} className="flex flex-wrap gap-1.5">
              {row.map(prefecture=>{
                const acquired=acquiredPrefectures.has(prefecture);
                return <button
                  key={prefecture}
                  type="button"
                  onClick={()=>onSelectPrefecture?.(prefecture)}
                  title={prefecture+(acquired?"・交換済み":"・未交換")}
                  aria-label={prefecture+(acquired?" 交換済み":" 未交換")}
                  className={"min-w-0 flex-1 rounded-lg border px-1.5 py-2 text-[10px] font-black transition sm:text-[11px] "+(
                    acquired
                      ?"border-[#6f9a5e] bg-[#78a866] text-white shadow-[0_3px_8px_rgba(84,127,65,.22)]"
                      :"border-[#d9ddd6] bg-[#e9ece7] text-[#a3aaa0]"
                  )}
                >
                  {SHORT_LABEL[prefecture]}
                </button>;
              })}
            </div>)}
          </div>
        </div>)}
      </div>
    </div>

    <div className="mt-3 flex items-center justify-between gap-3 rounded-[18px] bg-[#eef5e9] px-4 py-3">
      <div className="text-[10px] font-bold leading-4 text-[#6d7d65]">
        CAとスタンプ交換すると、そのCAのCommunityがある都道府県が点灯します。
      </div>
      <div className="shrink-0 text-right">
        <div className="text-lg font-black text-[#4f7d3b]">{acquiredStampCount}</div>
        <div className="text-[9px] font-black text-[#819078]">獲得スタンプ</div>
      </div>
    </div>
  </section>;
}
