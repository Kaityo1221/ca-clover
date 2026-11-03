"use client";
import { useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import type { NewCaReviewCard } from "@/components/new-ca-approval-deck";

/** Preview-only, read-only. No approval mutation is performed. */
export default function NewCaPreflightPanel({ applications }: { applications: NewCaReviewCard[] }) {
  const [requestId, setRequestId] = useState("");
  const [confirmedDiscordId, setConfirmedDiscordId] = useState("");
  const [working, setWorking] = useState(false);
  const [approvalGateResult, setApprovalGateResult] = useState<string | null>(null);
  const [report, setReport] = useState<{ code: string; requestStatus?: string; missing?: string[]; checks?: Record<string, boolean>; productionActivated?: boolean } | null>(null);
  const selected = applications.find(a => a.id === requestId);
  async function inspect() {
    setReport(null);
    if (!selected || !confirmedDiscordId.trim()) {
      setReport({ code: "申請を選び、Discord固定IDを確認して入力してください" }); return;
    }
    setWorking(true);
    try {
      const { data: { session } } = await createBrowserSupabaseClient().auth.getSession();
      if (!session?.access_token) throw Error("LOGIN_REQUIRED");
      const response = await fetch("/api/new-ca/approval-preflight", {
        method: "POST", cache: "no-store",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + session.access_token },
        body: JSON.stringify({ requestId: selected.id, confirmedDiscordId: confirmedDiscordId.trim() }),
      });
      const result = await response.json();
      setReport({ code: result.code || "PREFLIGHT_UNAVAILABLE",
        requestStatus: result.requestStatus,
        missing: Array.isArray(result.missing) ? result.missing : [],
        checks: result.checks && typeof result.checks === "object" ? result.checks : undefined,
        productionActivated: result.productionActivated });
    } catch {
      setReport({ code: "PREFLIGHT_UNAVAILABLE" });
    } finally { setWorking(false); }
  }
  async function testApprovalGate() {
    if (!selected || !confirmedDiscordId.trim() || working) return;
    setApprovalGateResult("承認APIの安全ゲートを確認中…");
    setWorking(true);
    try {
      const { data: { session } } = await createBrowserSupabaseClient().auth.getSession();
      if (!session?.access_token) throw Error("LOGIN_REQUIRED");
      const response = await fetch("/api/new-ca/approve", {
        method: "POST", cache: "no-store",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + session.access_token },
        body: JSON.stringify({requestId:selected.id,confirmedDiscordId:confirmedDiscordId.trim()}),
      });
      const data = await response.json();
      setApprovalGateResult(data?.productionActivated === false && !response.ok
        ? "安全ゲートによる拒否を確認：" + (data.code || "UNKNOWN")
        : "想定外の応答です。承認は行わず、運営に確認してください。");
    } catch { setApprovalGateResult("承認ゲートを確認できませんでした。"); }
    finally { setWorking(false); }
  }
  return <section className="mt-7 rounded-2xl border border-lime-200 bg-white px-4 py-5 shadow-sm">
    <h2 className="text-lg font-black text-lime-950">🔍 承認前チェック（読み取り専用）</h2>
    <p className="mt-2 text-sm text-slate-600">申請を選び、表示されたDiscord固定IDを確認して入力します。権限付与や承認処理は一切行いません。</p>
    <label className="mt-4 block text-sm font-bold text-slate-700" htmlFor="preflight-application">隔離Neonの申請</label>
    <select id="preflight-application" value={requestId} onChange={e => { setRequestId(e.target.value); setConfirmedDiscordId(""); setReport(null); }} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm">
      <option value="">申請を選択</option>
      {applications.map(a => <option key={a.id} value={a.id}>{a.trainerName} / {a.discordDisplayName}</option>)}
    </select>
    {selected && <p className="mt-3 break-all text-sm font-semibold text-slate-700">照合するDiscord固定ID：{selected.discordUserId ?? "未取得"}</p>}
    <label className="mt-3 block text-sm font-bold text-slate-700" htmlFor="preflight-discord">確認したDiscord固定ID</label>
    <input id="preflight-discord" value={confirmedDiscordId} onChange={e => setConfirmedDiscordId(e.target.value)} inputMode="numeric" maxLength={22} placeholder="固定IDを入力" className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-3 text-sm"/>
    <button type="button" disabled={working || !selected || !confirmedDiscordId.trim()} onClick={inspect} className="mt-4 rounded-full bg-lime-400 px-5 py-3 text-sm font-black text-lime-950 disabled:opacity-50">
      {working ? "確認中…" : "承認前チェックを実行"}
    </button>
    <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
      <p className="text-sm font-black text-amber-900">🔒 正式承認はロック中</p>
      <p className="mt-1 text-xs font-semibold text-amber-900">STEP 1・2の実認証、Campfire公式照合、正式RPCの総合試験完了まで有効化できません。</p>
      <button type="button" onClick={testApprovalGate} disabled={working || !selected || !confirmedDiscordId.trim()} className="mt-3 rounded-full border border-amber-400 px-4 py-2 text-xs font-black text-amber-900 disabled:opacity-40">承認APIの安全ゲートを検査（権限付与なし）</button>
      {approvalGateResult && <p role="status" className="mt-2 break-words text-xs font-bold text-amber-900">{approvalGateResult}</p>}
    </div>
    {report && <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm" role="status">
      <div className="font-black text-slate-900">結果：{report.code}</div>
      {report.requestStatus && <p className="mt-1">隔離申請状態：{report.requestStatus}</p>}
      {report.checks && <div className="mt-3 space-y-1">
        <p className="font-bold">隔離環境の確認結果</p>
        {Object.entries({
          discordRolePreviouslyVerified: "Discordロールの記録（現在の資格保証ではありません）",
          discordRoleCurrentlyVerified: "Discordの現在のAPAC CAロール（サーバー照会）",
          adminDiscordIdReviewed: "管理者による固定IDの確認履歴",
          neonGoogleProviderLinked: "Neon Googleアカウント",
          syntheticCaMasterMatched: "隔離用CAマスター",
          cloverUserIdentityLinked: "CA Clover本人紐付け",
          isolatedApprovalFinalized: "隔離承認の確定記録",
        }).map(([key,label]) => <p key={key}>{report.checks?.[key] ? "✅" : "⬜"} {label}</p>)}
      </div>}
      {report.missing && report.missing.length > 0 && <p className="mt-3 break-words">残りの確認項目：{report.missing.join(" / ")}</p>}
      <p className="mt-2 font-bold text-amber-800">本番CA権限は付与されていません。</p>
    </div>}
  </section>;
}
