"use client";

import Link from "next/link";
import { useMemo, useState, type ChangeEvent } from "react";
import { useAuthProfile } from "@/lib/use-auth-profile";

type FindingStatus = "unresolved" | "held" | "resolved";
type Finding = {
  id: string;
  type: string;
  category: string;
  subject: string;
  source_key: string;
  community_name: string | null;
  community_id: string | null;
  message: string;
  status: FindingStatus;
};
type AuditReport = {
  version: 1;
  lastCheck: { at: string; sourceCount: number; fingerprint: string } | null;
  findings: Finding[];
};
const statuses: Record<FindingStatus, string> = {
  unresolved: "未対応",
  held: "保留",
  resolved: "対応済み",
};
function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}
function parseReport(raw: unknown): AuditReport {
  if (!isRecord(raw) || raw.version !== 1 || !Array.isArray(raw.findings) || raw.findings.length > 2000) {
    throw new Error("第一段階のレポート形式ではありません。");
  }
  if (raw.lastCheck !== null && (
    !isRecord(raw.lastCheck) || typeof raw.lastCheck.at !== "string" ||
    !Number.isFinite(Date.parse(raw.lastCheck.at)) ||
    typeof raw.lastCheck.fingerprint !== "string" ||
    typeof raw.lastCheck.sourceCount !== "number"
  )) throw new Error("照合日時・原本件数が不正です。");
  const seen = new Set<string>();
  const findings = raw.findings.map((item): Finding => {
    if (!isRecord(item)) throw new Error("候補データが不正です。");
    const mandatory = ["id", "type", "category", "subject", "source_key", "message"];
    if (mandatory.some(field => typeof item[field] !== "string" || !(item[field] as string).trim())) {
      throw new Error("候補の必須項目が不足しています。");
    }
    if (seen.has(item.id as string)) throw new Error("候補IDが重複しています。");
    seen.add(item.id as string);
    if (item.status !== "unresolved" && item.status !== "held" && item.status !== "resolved") {
      throw new Error("候補の進捗情報が不正です。");
    }
    if (item.community_name != null && typeof item.community_name !== "string") throw new Error("Community名が不正です。");
    if (item.community_id != null && typeof item.community_id !== "string") throw new Error("Community IDが不正です。");
    return {
      id: item.id as string,
      type: item.type as string,
      category: item.category as string,
      subject: item.subject as string,
      source_key: item.source_key as string,
      community_name: (item.community_name as string | null | undefined) ?? null,
      community_id: (item.community_id as string | null | undefined) ?? null,
      message: item.message as string,
      status: item.status,
    };
  });
  return { version: 1, lastCheck: raw.lastCheck as AuditReport["lastCheck"], findings };
}

export default function CAMasterReconcilePage() {
  const { user, profile, loading, error: authError, retry } = useAuthProfile();
  const [report, setReport] = useState<AuditReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | FindingStatus>("all");
  const [category, setCategory] = useState("all");

  const summary = useMemo(() => {
    const rows = report?.findings ?? [];
    return {
      open: rows.filter(row => row.status === "unresolved").length,
      held: rows.filter(row => row.status === "held").length,
      resolved: rows.filter(row => row.status === "resolved").length,
    };
  }, [report]);
  const categories = useMemo(() => [...new Set((report?.findings ?? []).map(f => f.category))].sort(), [report]);
  const visible = useMemo(() => {
    const needle = query.normalize("NFKC").trim().toLocaleLowerCase();
    return (report?.findings ?? []).filter(f =>
      (status === "all" || f.status === status) &&
      (category === "all" || f.category === category) &&
      (!needle || [f.subject, f.source_key, f.community_name ?? "", f.message].join(" ").toLocaleLowerCase().includes(needle))
    );
  }, [report, category, query, status]);

  async function importAudit(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setReport(null); setError(null);
    try {
      if (file.size > 2_000_000) throw new Error("2MBを超えるレポートは読み込めません。");
      const parsed = parseReport(JSON.parse(await file.text()) as unknown);
      setReport(parsed);
    } catch (e) {
      setError(e instanceof Error ? e.message : "レポートを読み込めませんでした。");
    } finally {
      event.target.value = "";
    }
  }

  if (loading) return <main className="grid min-h-[70vh] place-items-center text-sm font-bold text-lime-900">🍀 認証確認中...</main>;
  if (authError) return <main className="mx-auto max-w-xl px-5 py-16 text-center"><p className="font-bold text-rose-700">{authError}</p><button onClick={retry} className="mt-4 rounded-xl bg-lime-400 px-5 py-3 font-black">認証を再確認</button></main>;
  if (!user || profile?.role !== "admin") return <main className="grid min-h-[70vh] place-items-center text-center font-black">🔒 ADMIN専用です</main>;

  return <main className="mx-auto max-w-6xl px-4 py-8 md:px-8">
    <Link href="/admin" className="text-sm font-black text-lime-800">← 管理メニュー</Link>
    <span className="mt-4 block w-fit rounded-full bg-slate-200 px-3 py-1 text-xs font-black text-slate-700">隔離レビュー / 本番自動照合 OFF</span>
    <h1 className="mt-3 text-3xl font-black text-lime-950">🍀 CA名簿の不整合レポート</h1>
    <Link href="/admin/ca-master-reconcile/phase2" className="mt-3 inline-block rounded-xl border border-lime-600 px-4 py-2 text-sm font-black text-lime-900">第2段階の承認フローを試す（端末内のみ）</Link>
    <p className="mt-2 text-sm font-semibold leading-7 text-slate-600">公式CA名簿とCloverの差異を確認する第一段階の画面です。既存CAの権限・所属・本人連携を変更しません。</p>
    <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold leading-7 text-amber-900">
      現在は開発用の表示画面です。自動取得APIと日次チェックは本番に接続していません。安全な隔離台帳から書き出したレポートJSONだけを、この端末内で読み込んで確認できます。データはアップロードされません。
    </div>
    <section className="clover-card mt-5 p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div><h2 className="font-black text-lime-950">レポートを開く</h2><p className="mt-1 text-xs font-semibold text-slate-500">隔離台帳のJSON出力を選択。手動チェック・修正・承認は無効です。</p></div>
        <label className="cursor-pointer rounded-xl bg-lime-400 px-5 py-3 text-sm font-black text-lime-950">
          JSONを選択<input type="file" accept=".json,application/json" onChange={importAudit} className="sr-only"/>
        </label>
      </div>
      {error ? <p role="alert" className="mt-3 text-sm font-black text-rose-700">{error}</p> : null}
    </section>
    <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
      {[
        ["公式CA行数",report?.lastCheck?.sourceCount ?? "－"],
        ["未対応",summary.open],
        ["保留",summary.held],
        ["対応済み",summary.resolved],
      ].map(([label,value]) => <div key={String(label)} className="clover-card p-4"><div className="text-xs font-bold text-slate-500">{label}</div><div className="mt-2 text-2xl font-black text-lime-950">{value}</div></div>)}
    </div>
    <p className="mt-5 text-xs font-semibold text-slate-500">最終照合：{report?.lastCheck?.at ? new Date(report.lastCheck.at).toLocaleString("ja-JP") : "レポート未読込"}</p>
    <div className="mt-4 flex flex-wrap gap-3">
      <input aria-label="CA名・Community名を検索" value={query} onChange={event => setQuery(event.target.value)} placeholder="CA名・Community名で検索" className="min-w-40 flex-1 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm"/>
      <select aria-label="進捗で絞り込み" value={status} onChange={event => setStatus(event.target.value as "all" | FindingStatus)} className="rounded-xl border border-slate-300 bg-white p-2 text-sm"><option value="all">すべての進捗</option><option value="unresolved">未対応</option><option value="held">保留</option><option value="resolved">対応済み</option></select>
      <select aria-label="分類で絞り込み" value={category} onChange={event => setCategory(event.target.value)} className="rounded-xl border border-slate-300 bg-white p-2 text-sm"><option value="all">すべての分類</option>{categories.map(c=><option key={c} value={c}>{c}</option>)}</select>
    </div>
    <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
      <table className="min-w-[730px] w-full text-left text-sm">
        <thead className="bg-lime-50 text-lime-950"><tr><th className="p-4">CA</th><th className="p-4">分類</th><th className="p-4">Community</th><th className="p-4">要確認の内容</th><th className="p-4">進捗</th></tr></thead>
        <tbody>{visible.map(f => <tr key={f.id} className="border-t border-slate-100 align-top">
          <td className="p-4 font-bold">{f.subject}<div className="mt-1 text-xs font-normal text-slate-400">{f.source_key}</div></td>
          <td className="p-4">{f.category}</td><td className="p-4">{f.community_name ?? "－"}</td>
          <td className="p-4 text-slate-600">{f.message}</td>
          <td className="p-4 font-bold">{statuses[f.status]}</td>
        </tr>)}
          {!visible.length ? <tr><td colSpan={5} className="p-10 text-center text-slate-500">{report ? "該当する差分はありません。" : "レポートを選択してください。"}</td></tr> : null}
        </tbody>
      </table>
    </div>
    <p className="mt-4 text-xs font-semibold text-slate-500">表示 {visible.length} 件。未連携を理由に自動退任・削除・本人確定しません。</p>
  </main>;
}
