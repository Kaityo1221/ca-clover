"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuthProfile } from "@/lib/use-auth-profile";

type ConnectionState={
  status:string;
  expires_at:string|null;
  last_sync_at:string|null;
};

type AutomationState={
  enabled:boolean;
  public_offset:number;
  public_batch_size:number;
  last_public_at:string|null;
  last_history_at:string|null;
  last_ca_master_at:string|null;
  last_public_imported:number;
  last_history_imported:number;
  last_ca_master_updated:number;
  last_error:string|null;
};

type SyncResult={
  ok?:boolean;
  total?:number;
  processed?:number;
  importedEvents?:number;
  discoveredEvents?:number;
  failedCommunities?:number;
  scanFailures?:number;
  detailFailures?:number;
  error?:string;
  code?:string;
};

type SyncMode="public"|"history"|"history-one"|null;
type CommunityOption={id:string;name:string;prefecture:string|null};

export default function Page(){
  const {supabase,user,profile,loading}=useAuthProfile();
  const [connection,setConnection]=useState<ConnectionState|null>(null);
  const [automation,setAutomation]=useState<AutomationState|null>(null);
  const [running,setRunning]=useState<SyncMode>(null);
  const [progress,setProgress]=useState({done:0,total:0,events:0,failed:0,discovered:0});
  const [message,setMessage]=useState<string|null>(null);
  const [communities,setCommunities]=useState<CommunityOption[]>([]);
  const [selectedCommunityId,setSelectedCommunityId]=useState("");

  async function loadConnection(){
    const {data,error}=await supabase.functions.invoke("campfire-token-admin",{body:{action:"status"}});
    if(!error) setConnection((data?.state??null) as ConnectionState|null);
  }

  async function loadAutomation(){
    const {data,error}=await supabase
      .from("sync_automation_state")
      .select("enabled,public_offset,public_batch_size,last_public_at,last_history_at,last_ca_master_at,last_public_imported,last_history_imported,last_ca_master_updated,last_error")
      .eq("id",1)
      .maybeSingle();
    if(!error) setAutomation((data??null) as AutomationState|null);
  }

  async function loadCommunities(){
    const {data,error}=await supabase
      .from("communities")
      .select("id,name,prefecture")
      .not("campfire_community_id","is",null)
      .order("name");
    if(error) return;
    const rows=(data as CommunityOption[]|null)??[];
    setCommunities(rows);
    setSelectedCommunityId(current=>{
      if(current&&rows.some(row=>row.id===current)) return current;
      return rows.find(row=>row.name==="Pokémon GO Club Tokyo")?.id??rows[0]?.id??"";
    });
  }

  useEffect(()=>{
    if(!loading&&user&&profile?.role==="admin"){
      loadConnection();
      loadAutomation();
      loadCommunities();
    }
  },[loading,user,profile?.role]);

  function resetProgress(){
    setMessage(null);
    setProgress({done:0,total:0,events:0,failed:0,discovered:0});
  }

  async function runPublicAll(){
    setRunning("public");
    resetProgress();

    let offset=0;
    let total=0;
    let events=0;
    let failed=0;
    let discovered=0;

    try{
      while(true){
        const {data,error}=await supabase.functions.invoke("sync-campfire-public",{body:{offset,limit:5}});
        if(error) throw error;
        const result=(data??{}) as SyncResult;
        if(result.error) throw new Error(result.error);

        const processed=result.processed??0;
        total=result.total??total;
        events+=result.importedEvents??0;
        discovered+=result.discoveredEvents??0;
        failed+=(result.scanFailures??0)+(result.detailFailures??0);
        offset+=processed;

        setProgress({done:offset,total,events,failed,discovered});
        if(processed===0||offset>=total) break;
      }

      setMessage(failed>0
        ?"公開Meetup同期は完了しましたが、一部の探索または詳細取得に失敗があります。"
        :"公開Meetup同期が完了しました 🍀");
      await loadAutomation();
    }catch(error){
      setMessage(error instanceof Error?error.message:String(error));
    }finally{
      setRunning(null);
    }
  }

  async function runHistoryOne(){
    if(!selectedCommunityId) return;
    setRunning("history-one");
    resetProgress();

    try{
      const {data,error}=await supabase.functions.invoke("sync-campfire",{body:{communityId:selectedCommunityId}});
      if(error) throw error;
      const result=(data??{}) as SyncResult;
      if(result.error) throw new Error(result.error);

      const processed=result.processed??0;
      const events=result.importedEvents??0;
      const failed=result.failedCommunities??0;
      setProgress({done:processed,total:processed||1,events,failed,discovered:0});

      const selected=communities.find(row=>row.id===selectedCommunityId);
      setMessage(failed>0
        ?(selected?.name??"選択Community")+" の過去履歴同期でエラーがありました。"
        :(selected?.name??"選択Community")+" の過去履歴を "+events+" 件保存しました 🍀");
      await loadConnection();
      await loadAutomation();
    }catch(error){
      setMessage(error instanceof Error?error.message:String(error));
      await loadConnection();
    }finally{
      setRunning(null);
    }
  }

  async function runHistoryAll(){
    setRunning("history");
    resetProgress();

    let offset=0;
    let total=0;
    let events=0;
    let failed=0;

    try{
      while(true){
        const {data,error}=await supabase.functions.invoke("sync-campfire",{body:{offset,limit:3}});
        if(error) throw error;
        const result=(data??{}) as SyncResult;
        if(result.error) throw new Error(result.error);

        const processed=result.processed??0;
        total=result.total??total;
        events+=result.importedEvents??0;
        failed+=result.failedCommunities??0;
        offset+=processed;

        setProgress({done:offset,total,events,failed,discovered:0});
        if(processed===0||offset>=total) break;
      }

      setMessage(failed>0
        ?"過去履歴同期は完了しましたが、一部Communityでエラーがあります。"
        :"過去履歴同期が完了しました 🍀");
      await loadConnection();
      await loadAutomation();
    }catch(error){
      setMessage(error instanceof Error?error.message:String(error));
      await loadConnection();
    }finally{
      setRunning(null);
    }
  }

  if(loading) return <main className="grid min-h-[70vh] place-items-center text-sm font-black text-lime-800">🍀 読み込み中...</main>;
  if(!user||profile?.role!=="admin") return <main className="grid min-h-[70vh] place-items-center text-center"><div>🔒 ADMIN専用です</div></main>;

  const ready=connection?.status==="ready"||connection?.status==="expiring";
  const expiresAt=connection?.expires_at?new Date(connection.expires_at).getTime():0;
  const tokenHoursLeft=expiresAt?Math.round((expiresAt-Date.now())/3600000):null;
  const tokenWarning=tokenHoursLeft!==null&&tokenHoursLeft<=48;
  const percent=progress.total?Math.min(100,Math.round(progress.done/progress.total*100)):0;
  const isRunning=running!==null;

  return <main className="mx-auto max-w-4xl px-4 py-8 md:px-8">
    <Link href="/admin" className="text-sm font-black text-lime-700">← 管理メニュー</Link>
    <span className="mt-4 block w-fit rounded-full bg-lime-200 px-3 py-1 text-xs font-black text-lime-900">DATA SYNC</span>
    <h1 className="mt-3 text-3xl font-black text-lime-950">🔄 Campfire Activity同期</h1>
    <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
      公開Map discoveryから現在・未来のMeetupをtokenなしで取得します。過去履歴だけ、必要なときにADMIN tokenを使います。
    </p>

    <section className="clover-card mt-6 border border-emerald-200 bg-emerald-50/60 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs font-black text-emerald-700">AUTOMATION</div>
          <div className="mt-1 text-xl font-black text-lime-950">
            {automation?automation.enabled?"🟢 自動同期 ON":"⚪ 自動同期 OFF":"⚪ 自動同期を確認中…"}
          </div>
          <div className="mt-2 text-xs font-semibold leading-5 text-slate-600">
            15分ごとに10 Communityずつ公開Meetupを巡回します。全国1周は約2時間半です。
            CAマスターは1日1回更新し、新規CA / Communityも取り込みます。coverage=missing があれば、token有効時に1件ずつ過去履歴も自動補完します。
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-bold">
            <span className="rounded-full bg-white px-3 py-2 text-emerald-800">
              最終公開同期 {automation?.last_public_at?new Date(automation.last_public_at).toLocaleString("ja-JP"):"まだ"}
            </span>
            <span className="rounded-full bg-white px-3 py-2 text-emerald-800">
              最終Backfill {automation?.last_history_at?new Date(automation.last_history_at).toLocaleString("ja-JP"):"まだ"}
            </span>
            <span className="rounded-full bg-white px-3 py-2 text-emerald-800">
              CAマスター {automation?.last_ca_master_at?new Date(automation.last_ca_master_at).toLocaleString("ja-JP"):"未取得"}
            </span>
          </div>
          {automation?.last_error
            ?<div className="mt-3 rounded-2xl bg-rose-50 p-3 text-xs font-bold text-rose-700">⚠ {automation.last_error}</div>
            :null}
        </div>
      </div>
    </section>

    <section className="clover-card mt-5 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-xs font-black text-emerald-600">TOKEN不要</div>
          <div className="mt-1 text-xl font-black text-lime-950">🗺️ 公開Meetup同期</div>
          <div className="mt-2 max-w-2xl text-xs font-semibold leading-5 text-slate-500">
            日本CA一覧のCommunity座標を中心にCampfireの公開地図を探索し、公開中のMeetup IDを発見します。
            Meetup詳細も匿名取得し、現行ID・ID履歴・一意なCommunity名を照合してCA CloverのCommunityへ保存します。
          </div>
        </div>
        <button
          onClick={runPublicAll}
          disabled={isRunning}
          className="rounded-2xl bg-lime-400 px-6 py-3 text-sm font-black text-lime-950 disabled:opacity-40"
        >
          {running==="public"?"公開Meetupを同期中…":"公開Meetupを全国同期"}
        </button>
      </div>
    </section>

    <section className="clover-card mt-5 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-xs font-black text-slate-500">過去履歴 BACKFILL</div>
          <div className="mt-1 text-xl font-black text-lime-950">
            {ready?"📚 activeFeed / archivedFeed":"🔑 Campfire tokenが必要です"}
          </div>
          <div className="mt-2 text-xs font-semibold leading-5 text-slate-500">
            過去Meetupを含む完全履歴を取り直す場合だけ使用します。通常の公開Meetup同期にはtokenは不要です。
          </div>
          <div className={`mt-2 text-xs font-black ${tokenWarning?"text-rose-600":"text-slate-400"}`}>
            {connection?.expires_at
              ?(tokenWarning?"⚠ Token期限 ":"Token期限 ")+new Date(connection.expires_at).toLocaleString("ja-JP")
              :"Token未登録"}
            {tokenHoursLeft!==null&&tokenWarning?`（残り約${Math.max(0,tokenHoursLeft)}時間）`:""}
          </div>
        </div>
        <div className="w-full md:w-auto">
          <div className="flex flex-col gap-2">
            <select
              value={selectedCommunityId}
              onChange={e=>setSelectedCommunityId(e.target.value)}
              disabled={isRunning||!ready}
              className="max-w-full rounded-2xl border border-lime-200 bg-white px-4 py-3 text-xs font-black text-lime-900 outline-none disabled:opacity-40"
            >
              {communities.map(row=><option key={row.id} value={row.id}>{row.prefecture?row.prefecture+" / ":""}{row.name}</option>)}
            </select>
            <button
              onClick={runHistoryOne}
              disabled={isRunning||!ready||!selectedCommunityId}
              className="rounded-2xl bg-lime-400 px-5 py-3 text-xs font-black text-lime-950 disabled:opacity-40"
            >
              {running==="history-one"?"このCommunityを同期中…":"選択Communityだけ過去同期"}
            </button>
            <div className="flex flex-wrap gap-2">
              <Link href="/admin/campfire" className="rounded-2xl border border-lime-200 bg-white px-4 py-3 text-xs font-black text-lime-700">
                token設定
              </Link>
              <button
                onClick={runHistoryAll}
                disabled={isRunning||!ready}
                className="rounded-2xl border border-lime-300 bg-white px-5 py-3 text-xs font-black text-lime-800 disabled:opacity-40"
              >
                {running==="history"?"全国の過去履歴を同期中…":"全国の過去履歴を同期"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section className="clover-card mt-5 p-6">
      <div className="text-xs font-black text-slate-500">同期進捗</div>
      <div className="mt-4 h-3 overflow-hidden rounded-full bg-lime-50">
        <div className="h-full rounded-full bg-lime-400 transition-all" style={{width:percent+"%"}}/>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold text-slate-600">
        <span className="rounded-full bg-lime-50 px-3 py-2">Community {progress.done}/{progress.total||"?"}</span>
        {running==="public"||progress.discovered>0
          ?<span className="rounded-full bg-sky-50 px-3 py-2 text-sky-700">発見Event {progress.discovered}</span>
          :null}
        <span className="rounded-full bg-lime-50 px-3 py-2">保存Event {progress.events}</span>
        <span className="rounded-full bg-rose-50 px-3 py-2 text-rose-700">失敗 {progress.failed}</span>
      </div>

      {message?<div className="mt-5 rounded-2xl bg-lime-50 p-4 text-sm font-bold text-lime-900">{message}</div>:null}
    </section>

    <section className="mt-5 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-xs font-semibold leading-5 text-sky-900">
      公開同期は現在・未来の公開Meetup用です。過去Meetupの完全な取得範囲は保証しません。
      参加者の名前・IDは要求せず、Meetupごとの参加表明数とCheck-in数だけを保存します。
    </section>
  </main>;
}
