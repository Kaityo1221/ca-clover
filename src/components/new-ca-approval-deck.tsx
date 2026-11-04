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
  status: "pending_admin" | "held" | "ready_to_activate";
  cloverLinked?: boolean;
  sameGoogleAsViewer?: boolean;
  exploreId?: string | null;
  caLevel?: string | null;
  masterResult?: string | null;
  communityName?: string | null;
  roleCheckedAt?: string | null;
  createdAt?: string | null;
  duplicateWarning?: string | null;
  approvalHistory?: readonly { event: string; at: string }[];
};

type Props = {
  applications: readonly NewCaReviewCard[];
  onRevalidate?: (application: NewCaReviewCard) => Promise<string>;
  // Deliberately no approval/write callback until the protected server bridge exists.
};

export default function NewCaApprovalDeck({ applications, onRevalidate }: Props) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [copied, setCopied] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<string | null>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const unique = [...new Map(applications.map((row) => [row.id, row])).values()];
  const safeIndex = Math.min(index, Math.max(0, unique.length - 1));
  const current = unique[safeIndex] ?? null;

  useEffect(() => { setFlipped(false); setCopied(false); setCheckResult(null); }, [current?.id]);

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

  const activeId = useRef<string | null>(null);
  activeId.current = current?.id ?? null;

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
              {current.status === "held" ? "保留中" : current.status === "ready_to_activate" ? "隔離承認済み" : "確認待ち"}
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
          <p className="mt-10 text-sm font-bold text-lime-700">{current.cloverLinked ? "🍀 CA Clover Google照合（隔離）完了" : "🍀 APAC CA資格確認 → 会長の本人照合へ"}</p>
          {current.sameGoogleAsViewer && !current.cloverLinked
            ? <p className="mt-2 text-xs font-bold text-sky-700">表示中のGoogleアカウントと一致（読み取り確認のみ）</p>
            : null}
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
            <Info label="本人照合用Discord固定ID" value={current.discordUserId ?? "未取得"}/>
            <Info label="SCOPELY EXPLORE ID" value={current.exploreId ?? "正本による照合待ち"}/>
            <Info label="CA区分" value={current.caLevel ?? "未確認"}/>
            <Info label="CAマスター照合結果" value={current.masterResult ?? "未確認"}/>
            <Info label="Community名" value={current.communityName ?? "未確認"}/>
            <Info label="Google本人連携" value={current.cloverLinked ? "隔離環境で連携済み" : "未連携"}/>
            <Info label="Discordロールの記録時刻" value={current.roleCheckedAt ?? "未確認"}/>
            <p className="text-xs text-amber-800">現在のロールは「再検証」で確認してください。</p>
            <Info label="重複登録チェック" value={current.duplicateWarning ?? "未検証（重複なしとは判定していません）"}/>
            <Info label="申請日時" value={current.createdAt ?? "未取得"}/>
            {current.discordUserId && <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(current.discordUserId!); setCopied(true); } catch { setCopied(false); } }} className="rounded-xl border border-lime-300 px-3 py-2 text-xs font-black text-lime-900">{copied ? "コピーしました" : "Discord固定IDをコピー"}</button>}
            <details className="rounded-xl bg-lime-50 p-3 text-sm">
              <summary className="cursor-pointer font-black text-lime-900">Campfireコミュニティ</summary>
              <p className="mt-2 break-all text-xs text-slate-600">{current.campfireUrl ?? "確認待ち"}</p>
            </details>
          </div>
          <details className="mt-5 rounded-xl bg-lime-50 p-3 text-sm">
            <summary className="cursor-pointer font-black text-lime-900">承認履歴</summary>
            {current.approvalHistory?.length
              ? <ul className="mt-2 space-y-2">{current.approvalHistory.map((entry, i) =>
                  <li key={i} className="break-words text-xs text-slate-600">{entry.at} / {entry.event}</li>)}</ul>
              : <p className="mt-2 text-xs text-slate-600">履歴を取得できていません。</p>}
          </details>
          <button type="button" disabled={!onRevalidate || checking} onClick={async () => {
            if (!onRevalidate) return;
            setChecking(true); setCheckResult(null);
            try { const message = await onRevalidate(current); if (activeId.current === current.id) setCheckResult(message); }
            catch { if (activeId.current === current.id) setCheckResult("確認できませんでした。承認は停止しています。"); }
            finally { setChecking(false); }
          }} className="mt-5 w-full rounded-xl border border-lime-300 px-4 py-3 text-sm font-black text-lime-900 disabled:opacity-40">
            {checking ? "再検証中…" : "再検証"}
          </button>
          {checkResult && <p role="status" className="mt-3 break-words text-xs font-bold text-slate-700">{checkResult}</p>}
          <div className="mt-4 grid grid-cols-3 gap-2" aria-label="審査操作">
            {["承認", "保留", "却下"].map(action => <button key={action} type="button" disabled
              className="rounded-xl border px-3 py-3 text-sm font-bold opacity-40">{action}</button>)}
          </div>
          <div className="mt-6 border-t border-lime-100 pt-5" role="status">
            <p className="text-sm font-black text-amber-900">🔒 正式承認は停止中</p>
            <p className="mt-2 text-xs font-semibold leading-6 text-slate-600">このカードは確認専用です。Google本人照合とCampfire公式資格確認、隔離総合試験が完了するまで、本番CA権限は付与しません。</p>
            <p className="mt-2 text-xs font-bold text-lime-800">承認前の詳細チェックは下の「承認前チェック」から実行できます。</p>
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
