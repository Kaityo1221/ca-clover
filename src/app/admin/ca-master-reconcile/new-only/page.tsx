"use client";

import Link from "next/link";
import {useState, type ChangeEvent} from "react";
import {useAuthProfile} from "@/lib/use-auth-profile";
import type {CaMasterDiffReport,CaMasterDiffRow} from "@/lib/ca-master-new-only-diff";
import {formatCaMasterDiffReport} from "@/lib/ca-master-new-only-diff";

type ApiReport={
  report:CaMasterDiffReport;
  checkedAt:string;
  source:string;
  historyVerified:boolean;
  writeEnabled:false;
};
type Group={name:string;rows:CaMasterDiffRow[];description:string};
const sheetUrl="https://docs.google.com/spreadsheets/d/1BtPjOxNX4JhttKKJa_-qrIXdVmK5UsbAX-RcLmLTuwk/edit?gid=633821294#gid=633821294";

export default function NewOnlyCaMasterDiff(){
  const {user,profile,loading,error:authError,retry,supabase}=useAuthProfile();
  const [result,setResult]=useState<ApiReport|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [copied,setCopied]=useState("");

  async function run(kind:"official"|"manual",csv?:string){
    setBusy(true);setError("");setCopied("");setResult(null);
    try{
      const {data,error:sessionError}=await supabase.auth.getSession();
      const token=data.session?.access_token;
      if(sessionError||!token) throw new Error("ログイン状態を確認できません。");
      const response=await fetch("/api/admin/ca-master-diff",{
        method:kind==="official"?"GET":"POST",
        headers:{
          Authorization:`Bearer ${token}`,
          ...(kind==="manual"?{"Content-Type":"text/csv; charset=utf-8"}:{}),
        },
        body:kind==="manual"?csv:undefined,
        cache:"no-store",
      });
      const payload=await response.json() as (ApiReport&{error?:string});
      if(!response.ok||!payload.report) throw new Error(payload.error||"差分を照合できません。");
      setResult(payload);
    }catch(e){
      setError(e instanceof Error?e.message:"照合できませんでした。");
    }finally{setBusy(false);}
  }
  async function importCsv(event:ChangeEvent<HTMLInputElement>){
    const file=event.target.files?.[0];
    event.target.value="";
    if(!file)return;
    if(file.size>2_000_000){setError("CSVは2MB以下にしてください。");return;}
    await run("manual",await file.text());
  }
  async function copyBadgeHelp(){
    const text=[
      "🍀 新人CAのバッジについて",
      "公式CAマスターへの掲載と、Pokémon GO・CampfireでのCAバッジ表示は別の確認事項です。",
      "公式名簿への掲載が確認できても、こちらではバッジの反映状況や反映予定日までは確認できません。",
      "どの画面（Pokémon GO / Campfire）で表示されないのかと、CAとして認定された日付を教えてください。",
      "必要に応じて、CAプログラムの公式窓口で反映状況を確認してください。",
      "※具体的な反映期限は公式情報で確認できていません。",
    ].join("\n");
    try{await navigator.clipboard.writeText(text);setCopied("CAバッジの案内文をコピーしました。");}
    catch{setError("コピーできませんでした。");}
  }
  async function copyReport(){
    if(!result)return;
    try{
      await navigator.clipboard.writeText(formatCaMasterDiffReport(result.report,result.source,result.checkedAt));
      setCopied("報告文をコピーしました。");
    }catch{setError("コピーできませんでした。端末のクリップボード権限を確認してください。");}
  }
  async function copyAdditionRequest(record:CaMasterDiffRow){
    if(!result)return;
    try{
      const text=[
        "🍀 CAマスター新規追加の個別承認依頼",
        `照合日時：${result.checkedAt}`,`照合元：${result.source}`,
        `CA：${record.trainerName}`,`CA区分：${record.caLevel??"未確定"}`,
        `Community：${record.communityName}`,`Campfire ID：${record.campfireCommunityId??"未確認"}`,
        `都道府県：${record.prefecture}`,`就任日：${record.joinDate??"未確認"}`,
        "登録直前に公式原本・重複・過去ID・所属を再照合すること。",
        "既存CA・コミュニティ・権限・所属を変更・削除しないこと。",
        "※この操作ではDBへの追加はしていません。",
      ].join("\n");
      await navigator.clipboard.writeText(text);
      setCopied(record.trainerName+"さんの追加依頼をコピーしました。");
    }catch{setError("コピーできませんでした。");}
  }

  if(loading)return <main className="grid min-h-[65vh] place-items-center text-sm font-bold">🍀 認証確認中...</main>;
  if(authError)return <main className="mx-auto max-w-lg p-8 text-center"><p className="text-rose-700">{authError}</p><button className="mt-4 rounded-xl bg-lime-300 px-4 py-3 font-bold" onClick={retry}>認証を再確認</button></main>;
  if(!user||profile?.role!=="admin")return <main className="grid min-h-[65vh] place-items-center font-black">🔒 ADMIN専用です</main>;

  const report=result?.report;
  const groups:Group[]=report?[
    {name:"新規追加候補",rows:report.newCandidates,description:"個別承認と追加直前の再確認が必要"},
    {name:"保留・競合",rows:report.holds,description:"ID・所属等の不確実性。追加しない"},
    {name:"既存CAの差異",rows:report.existingDifferences,description:"既存レコードは更新しない"},
    {name:"公式Inactive",rows:report.inactiveUnregistered,description:"新規追加しない"},
    {name:"Cloverのみ",rows:report.cloverOnly,description:"自動削除・資格変更しない"},
  ]:[];
  return <main className="mx-auto max-w-5xl px-4 py-8 md:px-8">
    <Link href="/admin" className="text-sm font-black text-lime-800">← 管理メニュー</Link>
    <p className="mt-4 inline-block rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">新規追加候補の検出専用 / DB書込OFF</p>
    <h1 className="mt-3 text-2xl font-black text-lime-950 md:text-3xl">🍀 CAマスター差分確認</h1>
    <p className="mt-3 text-sm leading-7 text-slate-700">公式CA名簿とCloverを照合し、会長が確認する新規追加候補を抽出します。既存CA・Communityの変更、削除、所属・本人権限の操作は行いません。</p>
    <section className="clover-card mt-5 p-5">
      <h2 className="font-black text-lime-950">公式CAマスターをチェック</h2>
      <p className="mt-2 text-xs leading-6 text-slate-600">公式シートの現行タブから直接読み取ります。Google側のアクセス制限で取得できない場合は、公式タブのCSVを読み込んでください。</p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button disabled={busy} onClick={()=>run("official")} className="rounded-xl bg-lime-400 px-5 py-3 text-sm font-black text-lime-950 disabled:opacity-50">{busy?"照合中...":"🔍 差分を検出する"}</button>
        <label className="cursor-pointer rounded-xl border border-lime-700 bg-white px-5 py-3 text-sm font-black text-lime-900">
          CSVから照合<input type="file" accept=".csv,text/csv" onChange={importCsv} disabled={busy} className="sr-only"/>
        </label>
        <a href={sheetUrl} target="_blank" rel="noreferrer" className="text-sm font-bold text-lime-800 underline">公式シートを開く</a>
      </div>
      {error?<p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-700">{error}</p>:null}
      {result?<p className="mt-4 text-xs leading-6 text-slate-600">照合：{new Date(result.checkedAt).toLocaleString("ja-JP")} / {result.source} / 旧ID照合：{result.historyVerified?"確認済み":"未確認（新規追加候補は保留）"}</p>:null}
    </section>

    <section className="clover-card mt-5 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="font-black text-lime-950">🎖️ 新人CAのバッジ相談</h2>
          <p className="mt-2 text-xs leading-6 text-slate-600">公式CAマスターへの掲載は確認できても、Pokémon GO・Campfire側のバッジ反映とは別です。反映日数は推測せず、どの画面に付いていないのかを確認して案内します。</p>
        </div>
        <button onClick={copyBadgeHelp} className="rounded-xl border border-lime-600 px-4 py-3 text-sm font-black text-lime-900">案内文をコピー</button>
      </div>
    </section>

    {report?<section className="mt-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[
          ["公式CA行",report.sourceCount],["Clover登録",report.existingCount],
          ["新規追加候補",report.newCandidates.length],["保留",report.holds.length],
          ["既存差異",report.existingDifferences.length],
          ["公式Inactive",report.inactiveUnregistered.length],
        ].map(([label,count])=><div key={String(label)} className="clover-card p-4">
          <div className="text-xs font-bold text-slate-500">{label}</div>
          <div className="mt-2 text-2xl font-black text-lime-950">{count}</div>
        </div>)}
      </div>
      <div className="clover-card mt-4 flex flex-wrap items-center justify-between gap-3 p-4">
        <div><h2 className="font-black">会長への差分報告</h2><p className="mt-1 text-xs text-slate-600">新規候補と保留理由、既存差異をまとめます。</p></div>
        <button onClick={copyReport} className="rounded-xl border border-lime-700 px-4 py-3 text-sm font-black text-lime-800">📋 報告文をコピー</button>
      </div>
      {copied?<p role="status" className="mt-3 text-sm font-bold text-lime-800">{copied}</p>:null}
      {groups.map(group=><section key={group.name} className="clover-card mt-4 p-4 md:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-black text-lime-950">{group.name}（{group.rows.length}件）</h2>
          <span className="text-xs font-semibold text-slate-500">{group.description}</span>
        </div>
        {!group.rows.length?<p className="mt-3 text-sm text-slate-500">該当なし</p>:null}
        <div className="mt-3 space-y-3">{group.rows.map((row,index)=><article key={row.sourceKey+row.kind+index} className="rounded-xl border border-slate-200 p-4">
          <div className="font-black">{row.trainerName} <span className="text-xs font-normal text-slate-500">{row.prefecture} / {row.caLevel??"区分未確認"}</span></div>
          <p className="mt-1 text-sm text-slate-700">{row.communityName||"Community未特定"}</p>
          <p className="mt-2 text-xs leading-6 text-slate-600">{row.reason}</p>
          {row.kind==="new_candidate"?<button onClick={()=>copyAdditionRequest(row)}
            className="mt-3 rounded-xl bg-lime-100 px-4 py-2 text-xs font-black text-lime-900">このCAの追加依頼をコピー（DBは変更しない）</button>:null}
        </article>)}</div>
      </section>)}
    </section>:<p className="mt-8 text-center text-sm text-slate-500">「差分を検出する」で最新の公式名簿を照合できます。</p>}
    <p className="mt-6 text-xs font-semibold leading-6 text-amber-800">安全上の制限：追加実行APIと自動更新は未接続です。候補のコピーは追加承認や本番登録を意味しません。既存CAは常に変更対象外です。</p>
  </main>;
}
