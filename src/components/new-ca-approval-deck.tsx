"use client";

import { useEffect, useRef, useState } from "react";

export type NewCaReviewCard = {
  id: string;
  trainerName: string;
  discordDisplayName: string | null;
  discordUsername: string | null;
  discordNickname: string | null;
  discordUserId: string | null;
  displayNameSource: "discord_oauth" | "user_screenshot" | "not_verified";
  campfireUrl: string | null;
  status: "pending_admin" | "held";
};

type Props = {
  applications: readonly NewCaReviewCard[];
  // Deliberately no approval/write callback until the protected server bridge exists.
};

export default function NewCaApprovalDeck({ applications }: Props) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const unique = [...new Map(applications.map((row) => [row.id, row])).values()];
  const safeIndex = Math.min(index, Math.max(0, unique.length - 1));
  const current = unique[safeIndex] ?? null;

  useEffect(() => { setFlipped(false); }, [safeIndex]);

  function move(direction: number) {
    setIndex((value) => Math.max(0, Math.min(unique.length - 1, value + direction)));
    setFlipped(false);
  }

  function onTouchStart(event: React.TouchEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest("button, a, input, details, summary, label")) {
      touch.current = null;
      return;
    }
    const p = event.changedTouches[0];
    touch.current = { x: p.clientX, y: p.clientY };
  }
  function onTouchEnd(event: React.TouchEvent<HTMLDivElement>) {
    if (!touch.current) return;
    const p = event.changedTouches[0];
    const dx = p.clientX - touch.current.x, dy = p.clientY - touch.current.y;
    touch.current = null;
    if (Math.abs(dx) > 65 && Math.abs(dx) > Math.abs(dy) * 1.35) {
      move(dx < 0 ? 1 : -1);
    }
  }

  const faceStyle: React.CSSProperties = {
    backfaceVisibility: "hidden",
    WebkitBackfaceVisibility: "hidden",
  };

  if (!current) return <div className="clover-card rounded-3xl p-9 text-center text-sm font-bold text-slate-500">
    確認待ちの申請はありません 🍀
  </div>;

  return <section aria-label="新規CA承認カード" className="mx-auto max-w-xl">
    <div className="mb-4 flex items-center justify-between gap-2">
      <button type="button" onClick={() => move(-1)} disabled={safeIndex === 0}
        className="rounded-xl border border-lime-200 bg-white px-4 py-3 text-sm font-black text-lime-900 disabled:opacity-30">‹ 前へ</button>
      <div aria-live="polite" className="text-sm font-black tabular-nums text-lime-950">
        {safeIndex + 1} / {unique.length} 人
      </div>
      <button type="button" onClick={() => move(1)} disabled={safeIndex === unique.length - 1}
        className="rounded-xl border border-lime-200 bg-white px-4 py-3 text-sm font-black text-lime-900 disabled:opacity-30">次へ ›</button>
    </div>

    <div className="w-full [perspective:1200px]" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <div className={"relative min-h-[690px] w-full [transform-style:preserve-3d] transition-transform duration-500 motion-reduce:transition-none " +
        (flipped ? "[transform:rotateY(180deg)]" : "")}>
        <section aria-label="申請カード表面" aria-hidden={flipped} inert={flipped}
          style={faceStyle}
          className="absolute inset-0 flex flex-col rounded-[28px] border border-lime-200 bg-white p-6 shadow-xl sm:p-8">
          <div className="flex items-start justify-between gap-3">
            <span className="text-xs font-black tracking-widest text-lime-800">CA CLOVER</span>
            <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-black text-amber-800">
              {current.status === "held" ? "保留中" : "確認待ち"}
            </span>
          </div>
          <div className="mt-14">
            <span className="text-xs font-black text-slate-500">ポケモンGO トレーナー名</span>
            <h2 className="mt-2 break-words text-3xl font-black text-lime-950">{current.trainerName}</h2>
          </div>
          <div className="mt-10">
            <span className="text-xs font-black text-slate-500">Discord表示名</span>
            <p className="mt-2 break-words text-xl font-black leading-8 text-lime-950">
              {current.discordDisplayName ?? "未取得"}
            </p>
            {current.displayNameSource === "user_screenshot"
              ? <p className="mt-2 text-xs font-bold text-amber-700">画像から転記。OAuth本人確認ではありません。</p>
              : null}
          </div>
          <p className="mt-10 text-sm font-bold text-lime-700">🍀 APAC CA資格確認 → 会長の本人照合へ</p>
          <button type="button" onClick={() => setFlipped(true)}
            className="mt-auto rounded-2xl bg-lime-400 px-5 py-4 font-black text-lime-950">
            カードをめくって確認 ↻
          </button>
        </section>

        <section aria-label="申請カード裏面" aria-hidden={!flipped} inert={!flipped}
          style={{ ...faceStyle, transform: "rotateY(180deg)" }}
          className="absolute inset-0 overflow-y-auto rounded-[28px] border border-lime-200 bg-white p-6 shadow-xl sm:p-8">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-black text-lime-950">🔍 本人確認</h2>
            <button type="button" onClick={() => setFlipped(false)}
              className="rounded-xl border border-lime-200 px-3 py-2 text-xs font-black text-lime-800">↶ 表に戻る</button>
          </div>
          <div className="mt-6 space-y-5">
            <Info label="トレーナー名" value={current.trainerName}/>
            <Info label="Discord表示名" value={current.discordDisplayName ?? "未取得"}/>
            <Info label="Discordユーザー名" value={current.discordUsername ? "@" + current.discordUsername : "未取得"}/>
            <Info label="サーバー内ニックネーム" value={current.discordNickname ?? "設定なし"}/>
            <Info label="本人照合用Discord固定ID" value={current.discordUserId ?? "本番接続待ち"}/>
            <details className="rounded-xl bg-lime-50 p-3 text-sm">
              <summary className="cursor-pointer font-black text-lime-900">Campfireコミュニティ</summary>
              <p className="mt-2 break-all text-xs text-slate-600">{current.campfireUrl ?? "確認待ち"}</p>
            </details>
          </div>
          <div className="mt-6 border-t border-lime-100 pt-5">
            <p className="text-sm font-black text-slate-700">本人照合・承認</p>
            <p className="mt-1 text-xs font-semibold text-slate-500">正式連携前のため、操作は無効です。Discord固定IDの照合を実装後に有効化します。</p>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <button type="button" disabled className="rounded-xl bg-lime-400 px-1 py-3 text-xs font-black text-lime-950 disabled:opacity-40">承認</button>
              <button type="button" disabled className="rounded-xl border border-lime-200 px-1 py-3 text-xs font-black text-lime-800 disabled:opacity-40">保留</button>
              <button type="button" disabled className="rounded-xl border border-rose-200 px-1 py-3 text-xs font-black text-rose-700 disabled:opacity-40">却下</button>
            </div>
          </div>
        </section>
      </div>
    </div>
    <p className="mt-4 text-center text-xs font-bold text-slate-500">
      タップで裏返し、左右スワイプで申請者を切り替え
    </p>
  </section>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div>
    <div className="text-xs font-black text-slate-500">{label}</div>
    <div className="mt-1 break-all text-sm font-bold text-lime-950">{value}</div>
  </div>;
}
