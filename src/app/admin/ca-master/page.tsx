"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuthProfile } from "@/lib/use-auth-profile";

type Count={database:number;active:number;source:number;newCandidates:number;changed:number;missingFromSource:number};
type Applicant={trainerName:string;caLevel:string;status:string;communityName:string;prefecture:string;joinDate:string};
type Changed={name:string;fields:string[];previous:{level:string;status:string};current:{level:string;status:string;statusRaw:string}};
type DiffReport={code:string;readOnly:boolean;updated:boolean;counts:Count;
  newCandidates:Applicant[];changes:Changed[];missingFromSource:{name:string}[];
  warnings:string[];source:{title:string;tab:string;checkedAt:string};automaticWrite:boolean};

const sourceLink="https://docs.google.com/spreadsheets/d/1BtPjOxNX4JhttKKJa_-qrIXdVmK5UsbAX-RcLmLTuwk/edit?gid=633821294";
const backupLink="https://docs.google.com/spreadsheets/d/1r2EoVF6AXFITFgmLCeV5dB_xDxEjN9n4zJ8Yp0hnBpw/edit";

export default function CaMasterManagementPage(){
  const {supabase,user,profile,loading,error,retry}=useAuthProfile();
  const [counts,setCounts]=useState<{total:number;active:number}|null>(null);
  const [dbError,setDbError]=useState<string|null>(null);
  const [busy,setBusy]=useState(false);
  const [report,setReport]=useState<DiffReport|null>(null);
  const [checkError,setCheckError]=useState<string|null>(null);
  useEffect(()=>{
    if(loading||error||!user||profile?.role!=="admin")return;
    let alive=true;
    Promise.all([
      supabase.from("ca_members").select("id",{count:"exact",head:true}),
      supabase.from("ca_members").select("id",{count:"exact",head:true}).eq("status","active"),
    ]).then(([all,active])=>{
      if(!alive)return;
      if(all.error||active.error||all.count==null||active.count==null)setDbError("CAマスターの件数を取得できません");
      else setCounts({total:all.count,active:active.count});
    }).catch(()=>{if(alive)setDbError("CAマスターに接続できません");});
    return()=>{alive=false;};
  },[loading,error,user,profile?.role,supabase]);

  async function checkLatest(){
    if(busy)return;
    setBusy(true);setReport(null);setCheckError(null);
    try{
      const {data:{session}}=await supabase.auth.getSession();
      if(!session?.access_token)throw Error("LOGIN_REQUIRED");
      const response=await fetch("/api/admin/ca-master/check",{
        method:"POST",headers:{Authorization:"Bearer "+session.access_token},cache:"no-store",
      });
      const data=await response.json();
      if(!response.ok)throw Error(String(data?.code||"LATEST_CHECK_UNAVAILABLE"));
      if(data.readOnly!==true||data.updated!==false||data.automaticWrite!==false||!data.counts)
        throw Error("INVALID_CHECK_RESULT");
      setReport(data as DiffReport);
    }catch(cause){setCheckError(cause instanceof Error?cause.message:"LATEST_CHECK_UNAVAILABLE");}
    finally{setBusy(false);}
  }

  if(loading)return <main className="grid min-h-[70vh] place-items-center">🍀 認証を確認中…</main>;
  if(error)return <main className="mx-auto max-w-lg p-8"><h1 className="text-xl font-black">認証エラー</h1><p>{error}</p><button className="mt-3 rounded-full bg-lime-300 px-4 py-2" onClick={retry}>再確認</button></main>;
  if(!user)return <main className="mx-auto max-w-lg p-8"><Link className="font-bold text-lime-700" href="/login?next=%2Fadmin%2Fca-master">Googleでログイン</Link></main>;
  if(profile?.role!=="admin")return <main className="mx-auto max-w-lg p-8">🔒 ADMIN専用ページです。</main>;

  return <main className="mx-auto max-w-5xl px-4 py-8">
    <Link href="/admin" className="text-sm font-bold text-lime-700">← 管理メニュー</Link>
    <p className="mt-5 w-fit rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-800">開発プレビュー / 本番データの読み取りのみ</p>
    <h1 className="mt-3 text-3xl font-black text-lime-950">🗂️ CAマスター管理</h1>
    <p className="mt-3 text-sm leading-6 text-slate-600">確定済みの人数はDBから表示します。「最新確認」を押したときだけ元台帳を取得し、追加・変更・台帳未掲載の差分を比較します。<strong>本番DBやCA権限は更新しません。</strong></p>
    <section className="mt-6 grid gap-3 sm:grid-cols-2">
      <div className="rounded-2xl border border-lime-200 bg-white p-5"><p className="text-xs text-slate-500">CAマスター 登録総数</p><p className="mt-2 text-4xl font-black tabular-nums">{counts?.total??"..."}</p></div>
      <div className="rounded-2xl border border-lime-200 bg-white p-5"><p className="text-xs text-slate-500">有効CA</p><p className="mt-2 text-4xl font-black tabular-nums">{counts?.active??"..."}</p></div>
    </section>
    {dbError&&<p className="mt-2 text-sm font-bold text-red-700" role="alert">{dbError}</p>}
    <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="text-lg font-black">元台帳を最新確認</h2>
      <p className="mt-2 text-sm text-slate-600">対象：[APAC] CA in Japan / [new]CA List 20260828。自動同期は停止したままです。</p>
      <div className="mt-3 flex flex-wrap gap-3 text-sm font-bold text-lime-700">
        <a href={sourceLink} target="_blank" rel="noopener noreferrer">元台帳を開く ↗</a>
        <a href={backupLink} target="_blank" rel="noopener noreferrer">保全版を開く ↗</a>
      </div>
      <button type="button" disabled={busy} onClick={checkLatest} className="mt-5 w-full rounded-xl bg-lime-400 px-5 py-3 font-black text-lime-950 disabled:opacity-50">{busy?"元台帳を確認中…":"🔍 CAマスターを最新確認（読み取りのみ）"}</button>
      {checkError&&<div role="alert" className="mt-4 rounded-xl bg-amber-50 p-3 text-sm font-bold text-amber-900">元台帳の直接取得・照合に失敗しました：{checkError}。元台帳のアクセス権やプレビューの接続状態を確認してください。DBは変更されていません。</div>}
    </section>
    {report&&<section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5" aria-live="polite">
      <h2 className="text-lg font-black">比較結果（書き込みなし）</h2>
      <p className="mt-2 text-xs text-slate-500">確認日時：{new Date(report.source.checkedAt).toLocaleString("ja-JP",{timeZone:"Asia/Tokyo"})} / 元台帳掲載数と確定DB数は異なる場合があります。</p>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {([["元台帳の掲載CA",report.counts.source],["新規候補",report.counts.newCandidates],["変更候補",report.counts.changed],["未掲載候補",report.counts.missingFromSource]] as const).map(([name,value])=><div className="rounded-xl bg-slate-50 p-3" key={name}><div className="text-xs text-slate-500">{name}</div><div className="mt-1 text-2xl font-black tabular-nums">{value}</div></div>)}
      </div>
      {report.warnings.length>0&&<div className="mt-4 rounded-lg bg-amber-50 p-3 text-xs font-bold text-amber-900">台帳構造の注意：{report.warnings.join(" / ")}。自動反映は禁止です。</div>}
      <h3 className="mt-6 font-black">新規CA候補</h3>
      <div className="mt-2 max-h-80 space-y-2 overflow-y-auto">{report.newCandidates.length?report.newCandidates.map(c=><div key={c.trainerName} className="rounded-xl border border-lime-100 p-3 text-sm"><div className="font-black">{c.trainerName} <span className="text-xs text-slate-500">{c.caLevel}</span></div><p className="mt-1 text-xs text-slate-600">{c.communityName} / {c.prefecture} / 加入日 {c.joinDate||"未記載"}</p></div>):<p className="text-sm text-slate-500">新規候補なし</p>}</div>
      <h3 className="mt-6 font-black">既存CAの変更候補</h3>
      <div className="mt-2 max-h-64 space-y-2 overflow-auto">{report.changes.length?report.changes.map(c=><p className="rounded-xl bg-slate-50 p-3 text-sm" key={c.name}>{c.name}：{c.fields.join(" / ")}（確認・承認待ち）</p>):<p className="text-sm text-slate-500">変更候補なし</p>}</div>
      <h3 className="mt-6 font-black">元台帳に見つからない既存CA</h3>
      <p className="mt-1 text-xs text-amber-800">台帳にないことは退任・削除の根拠になりません。削除処理はありません。</p>
      <div className="mt-2 max-h-40 space-y-2 overflow-auto">{report.missingFromSource.length?report.missingFromSource.map(c=><p className="rounded-lg bg-slate-50 p-2 text-sm" key={c.name}>{c.name}</p>):<p className="text-sm text-slate-500">未掲載候補なし</p>}</div>
      <p className="mt-5 rounded-xl bg-amber-50 p-3 text-sm font-bold text-amber-900">🔒 差分確認のみ。新規CA追加・既存CA更新・退任・Community変更・CA権限付与は一切行いません。</p>
    </section>}
  </main>;
}
