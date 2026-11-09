"use client";

import {useState} from "react";
import type {createBrowserSupabaseClient} from "@/lib/supabase";

type Props={
  meetupId:string;
  supabase:ReturnType<typeof createBrowserSupabaseClient>;
  enabled?:boolean;
};
// Compiled OFF unless a separately reviewed preview/release explicitly enables it.
const approvedAtBuild=process.env.NEXT_PUBLIC_CA_MEETUP_ROSTER_EXPORT_ENABLED==="true";
export default function MeetupFullRosterExport({meetupId,supabase,enabled=false}:Props){
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState<string|null>(null);
  const canExport=approvedAtBuild&&enabled&&!busy;
  async function download(){
    if(!canExport||!meetupId)return;
    setBusy(true);setMessage(null);
    try{
      const {data:{session},error}=await supabase.auth.getSession();
      if(error||!session?.access_token)throw new Error("ログイン情報を確認できませんでした。");
      const api=new URL(supabase.supabaseUrl);
      if(api.protocol!=="https:"||!/^\w{20}\.supabase\.co$/.test(api.hostname))
        throw new Error("接続先を確認できませんでした。");
      const response=await fetch(api.origin+"/functions/v1/meetup-roster",{
        method:"POST",
        headers:{
          authorization:"Bearer "+session.access_token,
          apikey:supabase.supabaseKey,
          "content-type":"application/json",
          accept:"text/csv",
        },
        body:JSON.stringify({meetupId,purpose:"attendance",note:""}),
        credentials:"omit",
        cache:"no-store",
        redirect:"error",
      });
      if(!response.ok||!response.headers.get("content-type")?.startsWith("text/csv"))
        throw new Error(response.status===401?"セッションを更新して再度お試しください。":
          response.status===403?"この名簿を取得する権限がありません。":
          "名簿を取得できませんでした。");
      const blob=await response.blob();
      if(blob.size<20||blob.size>8000000)throw new Error("CSVサイズを確認できませんでした。");
      const url=URL.createObjectURL(blob);
      const a=document.createElement("a");
      a.href=url;
      a.download="meetup-roster-"+meetupId+".csv";
      a.style.display="none";
      document.body.appendChild(a);
      try{a.click();setMessage("CSVの保存操作を開始しました。");}
      finally{a.remove();window.setTimeout(()=>URL.revokeObjectURL(url),30000);}
    }catch(err){
      setMessage(err instanceof Error?err.message:"CSVを取得できませんでした。");
    }finally{setBusy(false);}
  }
  return <section aria-label="参加者名簿CSV" className="mt-5 rounded-2xl border border-lime-200 bg-lime-50 p-4">
    <h3 className="text-sm font-black text-lime-950">📄 参加者名簿CSV</h3>
    <p className="mt-2 text-xs font-semibold leading-5 text-slate-600">
      チェックイン済みを先頭に、参加表明者を含む4項目で出力します。不参加者は含みません。
    </p>
    <button type="button" onClick={()=>{void download();}} disabled={!canExport||!meetupId}
      aria-disabled={!canExport}
      className="mt-3 w-full rounded-2xl bg-lime-400 px-5 py-3 text-sm font-black text-lime-950 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500">
      {busy?"取得中...":"参加者名簿CSVを取得"}
    </button>
    {message?<p role="status" className="mt-2 text-xs font-semibold text-slate-600">{message}</p>:null}
    {!approvedAtBuild||!enabled?<p role="status" className="mt-2 text-xs font-semibold text-amber-700">
      準備中：認証・監査APIの公開承認後に利用できます。
    </p>:null}
  </section>;
}
