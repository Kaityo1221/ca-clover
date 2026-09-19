"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuthProfile } from "@/lib/use-auth-profile";

type State={
  status:string;
  token_email:string|null;
  expires_at:string|null;
  last_validated_at:string|null;
  last_sync_at:string|null;
  last_error:string|null;
  updated_at:string|null;
};

export default function Page(){
  const {supabase,user,profile,loading}=useAuthProfile();
  const [state,setState]=useState<State|null>(null);
  const [token,setToken]=useState("");
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState<string|null>(null);

  async function load(){
    const {data,error}=await supabase.functions.invoke("campfire-token-admin",{body:{action:"status"}});
    if(error){ setMessage(error.message); return; }
    setState((data?.state??null) as State|null);
  }

  useEffect(()=>{ if(!loading&&user&&profile?.role==="admin") load(); },[loading,user,profile?.role]);

  async function run(action:"set"|"test"|"clear"){
    setBusy(true);
    setMessage(null);
    try{
      const body:Record<string,unknown>={action};
      if(action==="set") body.token=token;
      const {data,error}=await supabase.functions.invoke("campfire-token-admin",{body});
      if(error) throw error;
      if(data?.error) throw new Error(data.error);
      if(action==="set"){
        setToken("");
        setMessage("Campfire tokenをVaultへ保存しました 🍀");
      }else if(action==="test"){
        setMessage("Campfire接続を確認できました 🍀");
      }else{
        setMessage("Campfire tokenを削除しました");
      }
      await load();
    }catch(error){
      setMessage(error instanceof Error?error.message:String(error));
    }finally{
      setBusy(false);
    }
  }

  if(loading) return <main className="grid min-h-[70vh] place-items-center text-sm font-black text-lime-800">🍀 読み込み中...</main>;
  if(!user||profile?.role!=="admin") return <main className="grid min-h-[70vh] place-items-center text-center"><div>🔒 ADMIN専用です</div></main>;

  const status=state?.status??"missing";
  const badge=status==="ready"?"bg-emerald-100 text-emerald-800":status==="expiring"?"bg-amber-100 text-amber-800":status==="expired"||status==="error"?"bg-rose-100 text-rose-800":"bg-slate-100 text-slate-600";

  return <main className="mx-auto max-w-4xl px-4 py-8 md:px-8">
    <Link href="/admin" className="text-sm font-black text-lime-700">← 管理メニュー</Link>
    <span className="mt-4 block w-fit rounded-full bg-lime-200 px-3 py-1 text-xs font-black text-lime-900">CAMPFIRE CONNECTION</span>
    <h1 className="mt-3 text-3xl font-black text-lime-950">🔐 Campfire接続</h1>
    <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">ADMIN用のCampfire tokenを1本だけ登録します。生tokenはSupabase Vaultへ暗号化保存され、CAのブラウザには返しません。</p>

    <section className="clover-card mt-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs font-black text-slate-500">接続状態</div>
          <div className="mt-2 flex items-center gap-2"><span className={"rounded-full px-3 py-1 text-xs font-black "+badge}>{status.toUpperCase()}</span></div>
        </div>
        <button disabled={busy||status==="missing"} onClick={()=>run("test")} className="rounded-2xl border border-lime-200 bg-white px-4 py-2 text-xs font-black text-lime-700 disabled:opacity-40">接続テスト</button>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div><div className="text-xs font-black text-slate-400">Token account</div><div className="mt-1 text-sm font-bold text-slate-700">{state?.token_email??"未登録"}</div></div>
        <div><div className="text-xs font-black text-slate-400">有効期限</div><div className="mt-1 text-sm font-bold text-slate-700">{state?.expires_at?new Date(state.expires_at).toLocaleString("ja-JP"):"未登録"}</div></div>
        <div><div className="text-xs font-black text-slate-400">最終確認</div><div className="mt-1 text-sm font-bold text-slate-700">{state?.last_validated_at?new Date(state.last_validated_at).toLocaleString("ja-JP"):"—"}</div></div>
        <div><div className="text-xs font-black text-slate-400">最終同期</div><div className="mt-1 text-sm font-bold text-slate-700">{state?.last_sync_at?new Date(state.last_sync_at).toLocaleString("ja-JP"):"—"}</div></div>
      </div>

      {state?.last_error?<div className="mt-4 rounded-2xl bg-rose-50 p-4 text-xs font-bold text-rose-700">{state.last_error}</div>:null}
    </section>

    <section className="clover-card mt-5 p-6">
      <h2 className="font-black text-lime-950">Tokenを登録・更新</h2>
      <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">この欄へ直接貼り付けてください。チャットへtokenを送る必要はありません。保存後、画面には再表示されません。</p>
      <textarea value={token} onChange={e=>setToken(e.target.value)} spellCheck={false} autoComplete="off" placeholder="eyJ..." className="mt-4 min-h-28 w-full rounded-2xl border border-lime-200 bg-white p-4 text-xs font-mono outline-none focus:border-lime-400"/>
      <div className="mt-4 flex flex-wrap gap-3">
        <button disabled={busy||!token.trim()} onClick={()=>run("set")} className="rounded-2xl bg-lime-400 px-5 py-3 text-sm font-black text-lime-950 disabled:opacity-40">{busy?"確認中…":"Vaultへ保存"}</button>
        <button disabled={busy||status==="missing"} onClick={()=>run("clear")} className="rounded-2xl border border-rose-200 bg-white px-5 py-3 text-sm font-black text-rose-600 disabled:opacity-40">Tokenを削除</button>
      </div>
      {message?<div className="mt-4 rounded-2xl bg-lime-50 p-4 text-sm font-bold text-lime-900">{message}</div>:null}
    </section>

    <div className="mt-5 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-xs font-semibold leading-5 text-sky-900">CAアカウントからCampfire tokenを集める設計にはしません。同期はこのADMIN tokenだけをサーバー側で使い、CAは保存済みデータだけを閲覧します。</div>
  </main>;
}
