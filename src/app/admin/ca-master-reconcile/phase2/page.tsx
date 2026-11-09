"use client";

import Link from "next/link";
import { useMemo, useState, type ChangeEvent } from "react";
import { useAuthProfile } from "@/lib/use-auth-profile";

type Status = "unresolved" | "held" | "resolved";
type Decision = "仮承認" | "仮保留" | "仮却下";
type Finding = {
  id: string; type: string; category: string; subject: string; source_key: string;
  community_name: string | null; community_id: string | null; message: string;
  status: Status; evidence?: Record<string, unknown>;
};
type Report = { version: 1; lastCheck: { at: string; fingerprint: string; sourceCount: number } | null; findings: Finding[] };
type LocalDecision = { action: Decision; reason: string; at: string };
const object = (x: unknown): x is Record<string, unknown> => Boolean(x && typeof x === "object" && !Array.isArray(x));
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

function parseReport(input: unknown): Report {
  if (!object(input) || input.version !== 1 || !Array.isArray(input.findings) || input.findings.length > 2000)
    throw new Error("第一段階の隔離レポートJSONを選択してください。");
  if (input.lastCheck !== null && (!object(input.lastCheck) || typeof input.lastCheck.at !== "string" ||
    !Number.isFinite(Date.parse(input.lastCheck.at)) || typeof input.lastCheck.fingerprint !== "string" ||
    typeof input.lastCheck.sourceCount !== "number"))
    throw new Error("照合日時・原本情報が不正です。");
  const ids = new Set<string>();
  const findings = input.findings.map((raw): Finding => {
    if (!object(raw)) throw new Error("候補形式が不正です。");
    for (const field of ["id","type","category","subject","source_key","message"])
      if (typeof raw[field] !== "string" || !(raw[field] as string).trim()) throw new Error("候補の必須情報が不足しています。");
    const id=raw.id as string;
    if (ids.has(id)) throw new Error("候補IDが重複しています。");
    ids.add(id);
    if (!["unresolved","held","resolved"].includes(String(raw.status))) throw new Error("候補状態が不正です。");
    if (raw.community_name != null && typeof raw.community_name !== "string") throw new Error("Community名が不正です。");
    if (raw.community_id != null && typeof raw.community_id !== "string") throw new Error("Community IDが不正です。");
    if (raw.evidence != null && !object(raw.evidence)) throw new Error("差分根拠が不正です。");
    return {
      id, type:raw.type as string, category:raw.category as string, subject:raw.subject as string,
      source_key:raw.source_key as string, community_name:(raw.community_name as string|null|undefined)??null,
      community_id:(raw.community_id as string|null|undefined)??null, message:raw.message as string,
      status:raw.status as Status, evidence:raw.evidence as Record<string,unknown>|undefined
    };
  });
  return {version:1,lastCheck:input.lastCheck as Report["lastCheck"],findings};
}

// Preview hints only. Final eligibility is determined by the backend against fresh verified source/DB snapshots.
function eligibility(row: Finding): string {
  if (row.status === "resolved") return "既に解消した候補";
  if (row.type === "ca_attribute_mismatch") {
    const fields = Object.keys(row.evidence ?? {});
    return fields.length && fields.every(field => ["prefecture","join_date"].includes(field))
      ? "属性修正の確認候補" : "資格・状態等の変更は個別審査";
  }
  if (row.type === "missing_link") return row.evidence?.existing_link_count === 0 && uuid.test(row.community_id ?? "")
    ? "所属証跡と別ADMINの確認が必要" : "既存所属・識別IDを個別調査";
  return "自動反映の対象外";
}

export default function CAMasterApprovalPreview() {
  const {user,profile,loading,error:authError,retry}=useAuthProfile();
  const [report,setReport]=useState<Report|null>(null);
  const [error,setError]=useState<string|null>(null);
  const [selection,setSelection]=useState<string>("");
  const [reason,setReason]=useState("");
  const [decisions,setDecisions]=useState<Record<string,LocalDecision>>({});
  const [filter,setFilter]=useState("");
  const current = useMemo(()=>report?.findings.find(x=>x.id===selection)??null,[report,selection]);
  const rows=useMemo(()=>(report?.findings??[]).filter(x=>
    !filter || [x.subject,x.source_key,x.community_name??"",x.message].join(" ").normalize("NFKC").toLowerCase().includes(filter.normalize("NFKC").toLowerCase())
  ),[report,filter]);

  async function importLocal(event:ChangeEvent<HTMLInputElement>) {
    const file=event.target.files?.[0];if(!file)return;
    setReport(null);setDecisions({});setSelection("");setError(null);
    try {
      if(file.size>2_000_000)throw new Error("2MB以下のJSONを選択してください。");
      const value=parseReport(JSON.parse(await file.text()) as unknown);
      setReport(value);setSelection(value.findings[0]?.id??"");
    } catch (e) { setError(e instanceof Error?e.message:"読み込みに失敗しました。"); }
    finally {event.target.value="";}
  }
  function localDecision(action:Decision) {
    if(!current || reason.trim().length<3 || reason.length>500){setError("判断理由を3〜500文字で記入してください。");return;}
    setDecisions(old=>({...old,[current.id]:{action,reason:reason.trim(),at:new Date().toISOString()}}));
    setReason("");setError(null);
  }

  if(loading)return <main className="p-10 text-center font-bold">🍀 ADMIN認証確認中...</main>;
  if(authError)return <main className="p-10 text-center"><p className="text-red-700">{authError}</p><button className="mt-3 rounded-xl bg-lime-400 px-4 py-2" onClick={retry}>再確認</button></main>;
  if(!user || profile?.role!=="admin")return <main className="p-10 text-center font-bold">🔒 ADMIN専用です</main>;
  return <main className="mx-auto max-w-5xl px-4 py-8 md:px-8">
    <Link href="/admin/ca-master-reconcile" className="text-sm font-bold text-lime-800">← 第1段階の差分一覧</Link>
    <p className="mt-4 inline-block rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-900">第2段階 / 未接続プレビュー / 本番NO-GO</p>
    <h1 className="mt-3 text-2xl font-black text-lime-950 md:text-3xl">🍀 CA名簿 修正承認の確認</h1>
    <p className="mt-3 text-sm leading-7 text-slate-700">差分を選択して「承認・保留・却下」の流れを確認する画面です。判断はこの端末の画面内だけに反映され、サーバーには送信されません。実際の承認も名簿更新も実行しません。</p>
    <div className="mt-4 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
      <strong>安全装置：</strong> 現時点で本番反映ボタンはありません。本人・1st/2nd・Inactive・既存所属の変更は別審査です。候補が画面上で選べても、実際の適用可否はバックエンドが再照合して判定します。
    </div>
    <section className="clover-card mt-5 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="font-black">隔離レポートを開く</h2><p className="mt-1 text-xs text-slate-500">第1段階のJSONを端末内で確認。アップロードなし。</p></div>
        <label className="cursor-pointer rounded-xl bg-lime-400 px-4 py-3 text-sm font-black">JSONを選択
          <input className="sr-only" type="file" accept=".json,application/json" onChange={importLocal}/>
        </label>
      </div>
      <p className="mt-2 text-xs text-slate-500">原本件数：{report?.lastCheck?.sourceCount??"未読込"} / 仮判断：{Object.keys(decisions).length}件</p>
      {error?<p role="alert" className="mt-3 text-sm font-bold text-red-700">{error}</p>:null}
    </section>
    {report ? <div className="mt-5 grid gap-5 md:grid-cols-2">
      <section className="clover-card p-4">
        <h2 className="font-black">差分の選択</h2>
        <input aria-label="差分を検索" value={filter} onChange={e=>setFilter(e.target.value)} placeholder="CA・コミュニティ名で検索" className="mt-3 w-full rounded-xl border p-2 text-sm"/>
        <div className="mt-3 max-h-[440px] space-y-2 overflow-y-auto">
          {rows.map(f=><button type="button" key={f.id} onClick={()=>{setSelection(f.id);setReason("");setError(null);}}
            className={"w-full rounded-xl border p-3 text-left text-sm "+(selection===f.id?"border-lime-700 bg-lime-50":"border-slate-200 bg-white")}>
            <span className="font-black">{f.subject}</span><span className="ml-2 text-xs text-slate-500">{f.category}</span>
            <p className="mt-1 text-xs text-slate-600">{eligibility(f)}</p>
            {decisions[f.id]?<p className="mt-1 font-bold text-amber-800">{decisions[f.id].action}（この端末のみ）</p>:null}
          </button>)}
          {!rows.length?<p className="py-8 text-center text-sm text-slate-500">該当候補なし</p>:null}
        </div>
      </section>
      <section className="clover-card p-4">
        <h2 className="font-black">判断プレビュー</h2>
        {current?<div className="mt-3 space-y-3 text-sm">
          <p className="font-black">{current.subject} / {current.category}</p>
          <p className="leading-6">{current.message}</p>
          <p className="text-xs text-slate-600">Community：{current.community_name??"未特定"}</p>
          <p className="rounded-lg bg-slate-100 p-3 text-sm font-bold">{eligibility(current)}</p>
          {current.evidence?<pre className="max-h-40 overflow-auto rounded-lg bg-slate-50 p-3 text-xs">{JSON.stringify(current.evidence,null,2)}</pre>:null}
          <label className="block font-bold" htmlFor="phase2-reason">判断理由（必須）</label>
          <textarea id="phase2-reason" value={reason} onChange={e=>setReason(e.target.value)} maxLength={500} rows={3} placeholder="原本と照合した内容、要調査事項など" className="w-full rounded-xl border p-3"/>
          <div className="flex flex-wrap gap-2">
            <button onClick={()=>localDecision("仮承認")} className="rounded-lg bg-lime-400 px-3 py-2 font-bold">仮承認</button>
            <button onClick={()=>localDecision("仮保留")} className="rounded-lg bg-amber-200 px-3 py-2 font-bold">仮保留</button>
            <button onClick={()=>localDecision("仮却下")} className="rounded-lg bg-slate-200 px-3 py-2 font-bold">仮却下</button>
          </div>
          {decisions[current.id]?<p className="rounded-lg bg-amber-50 p-3 text-xs">現在の画面内の判断：{decisions[current.id].action} / {decisions[current.id].reason}</p>:null}
          <p className="text-xs font-bold text-red-700">この画面の操作は証跡保存・実承認・本番更新を行いません。</p>
        </div>:<p className="mt-4 text-sm text-slate-500">左側から候補を選択してください。</p>}
      </section>
    </div>:<p className="mt-8 text-center text-sm text-slate-500">隔離JSONを選択すると、スマートフォンでも判断画面を確認できます。</p>}
  </main>;
}
