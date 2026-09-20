export const PREFECTURE_ORDER = [
  "北海道",
  "青森県",
  "岩手県",
  "宮城県",
  "秋田県",
  "山形県",
  "福島県",
  "茨城県",
  "栃木県",
  "群馬県",
  "埼玉県",
  "千葉県",
  "東京都",
  "神奈川県",
  "新潟県",
  "富山県",
  "石川県",
  "福井県",
  "山梨県",
  "長野県",
  "岐阜県",
  "静岡県",
  "愛知県",
  "三重県",
  "滋賀県",
  "京都府",
  "大阪府",
  "兵庫県",
  "奈良県",
  "和歌山県",
  "鳥取県",
  "島根県",
  "岡山県",
  "広島県",
  "山口県",
  "徳島県",
  "香川県",
  "愛媛県",
  "高知県",
  "福岡県",
  "佐賀県",
  "長崎県",
  "熊本県",
  "大分県",
  "宮崎県",
  "鹿児島県",
  "沖縄県",
] as const;

const PREFECTURE_INDEX = new Map<string, number>(
  PREFECTURE_ORDER.map((name, index) => [name, index])
);

export function comparePrefectures(
  a: string | null | undefined,
  b: string | null | undefined
) {
  const aName = a ?? "";
  const bName = b ?? "";
  const aIndex = PREFECTURE_INDEX.get(aName);
  const bIndex = PREFECTURE_INDEX.get(bName);

  if (aIndex !== undefined && bIndex !== undefined) return aIndex - bIndex;
  if (aIndex !== undefined) return -1;
  if (bIndex !== undefined) return 1;
  if (!aName && !bName) return 0;
  if (!aName) return 1;
  if (!bName) return -1;
  return aName.localeCompare(bName, "ja");
}
