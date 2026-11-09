"use client";

// Preview-only bridge: no network calls until the dedicated private endpoint,
// live D/Community authorization and terminal audit are approved.
export default function MeetupFullRosterExport({
  meetupId,
  enabled = false,
}: {
  meetupId: string;
  enabled?: boolean;
}) {
  const available = false; // Explicit NO-GO until private Edge + audit is integrated.
  const canExport = enabled && available;
  return (
    <section aria-label="参加者名簿CSV" className="mt-5 rounded-2xl border border-lime-200 bg-lime-50 p-4">
      <h3 className="text-sm font-black text-lime-950">📄 参加者名簿CSV</h3>
      <p className="mt-2 text-xs font-semibold leading-5 text-slate-600">
        チェックイン済みと参加表明者を含む4項目（ユーザー名・表示名・参加状態・チェックイン）。
        不参加者は除外します。
      </p>
      <button
        type="button"
        disabled={!canExport || !meetupId}
        aria-disabled={!canExport}
        className="mt-3 w-full rounded-2xl bg-lime-400 px-5 py-3 text-sm font-black text-lime-950 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
      >
        参加者名簿CSVを取得
      </button>
      {!canExport && <p role="status" className="mt-2 text-xs font-semibold text-amber-700">
        準備中：権限・監査DBの接続試験が完了するまで取得できません。
      </p>}
    </section>
  );
}
