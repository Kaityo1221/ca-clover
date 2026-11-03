"use client";
import { useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import type { NewCaReviewCard } from "@/components/new-ca-approval-deck";

/** Preview-only, read-only. No approval mutation is performed. */
export default function NewCaPreflightPanel({ applications }: { applications: NewCaReviewCard[] }) {
  const [requestId, setRequestId] = useState("");
  const [confirmedDiscordId, setConfirmedDiscordId] = useState("");
  const [working, setWorking] = useState(false);
  const [report, setReport] = useState<{ code: string; requestStatus?: string; missing?: string[]; productionActivated?: boolean } | null>(null);
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
        productionActivated: result.productionActivated });
    } catch {
      setReport({ code: "PREFLIGHT_UNAVAILABLE" });
    } finally { setWorking(false); }
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
    {report && <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm" role="status">
      <div className="font-black text-slate-900">結果：{report.code}</div>
      {report.requestStatus && <p className="mt-1">隔離申請状態：{report.requestStatus}</p>}
      {report.missing && report.missing.length > 0 && <p className="mt-2 break-words">正式承認に必要な未検証条件：{report.missing.join(" / ")}</p>}
      <p className="mt-2 font-bold text-amber-800">本番CA権限は付与されていません。</p>
    </div>}
  </section>;
}
