"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuthProfile } from "@/lib/use-auth-profile";

export default function Page(){
  const { supabase, user, profile, loading } = useAuthProfile();
  const [nianticId, setNianticId] = useState("");
  const [scopelyId, setScopelyId] = useState("");
  const [savedIds, setSavedIds] = useState<{trainer: string; scopely: string} | null>(null);
  const [discordStatus, setDiscordStatus] = useState<"loading"|"verified"|"missing"|"unavailable">("loading");
  const [discordBusy, setDiscordBusy] = useState(false);
  const [discordMessage, setDiscordMessage] = useState<string | null>(null);
  const [stampMessage, setStampMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [stampSaving, setStampSaving] = useState(false);
  const [stampSaveMessage, setStampSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    setNianticId(profile?.niantic_id ?? "");
    setScopelyId(profile?.scopely_id ?? "");
    setSavedIds(profile?.niantic_id && profile?.scopely_id ? { trainer: profile.niantic_id, scopely: profile.scopely_id } : null);
    setStampMessage(profile?.stamp_exchange_message ?? "");
  }, [profile?.niantic_id, profile?.scopely_id, profile?.stamp_exchange_message]);

  useEffect(() => {
    if (!user || profile?.role!=="pending") return;
    let cancelled=false;
    (async()=>{
      const {data,error}=await supabase.functions.invoke("ca-claim-discord-oauth",{body:{action:"status"}});
      if(cancelled)return;
      setDiscordStatus(error||!data?.ok?"unavailable":data.verified===true?"verified":"missing");
    })();
    return ()=>{cancelled=true;};
  },[user?.id,profile?.role,supabase]);

  async function startDiscordVerification(){
    setDiscordBusy(true);
    setDiscordMessage(null);
    const {data,error}=await supabase.functions.invoke("ca-claim-discord-oauth",{body:{action:"start"}});
    setDiscordBusy(false);
    if(error||typeof data?.authorizationUrl!=="string"){
      setDiscordMessage("Discord認証を開始できません。接続環境の設定を確認してください。");
      return;
    }
    try{
      const target=new URL(data.authorizationUrl);
      if(target.origin!=="https://discord.com"||target.pathname!=="/oauth2/authorize")
        throw Error("Unexpected OAuth destination");
      window.location.assign(target.toString());
    }catch{setDiscordMessage("Discord認証先のURLを確認できませんでした。");}
  }

  async function save(){
    if (!user) return;
    setSaving(true);
    setMessage(null);
    const value = nianticId.trim().replace(/^@+/, "");
    const scopelyValue = scopelyId.trim().replace(/^@+/, "");
    if (!value || !scopelyValue) {
      setSaving(false);
      setMessage("トレーナー名とScopely IDの両方を入力してください。");
      return;
    }

    // A PostgREST UPDATE can affect 0 rows without an error under RLS.
    // Read back the two stored IDs before allowing the applicant to proceed.
    const { data, error } = await supabase
      .from("profiles")
      .update({ niantic_id: value, scopely_id: scopelyValue } as never)
      .eq("id", user.id)
      .select("niantic_id,scopely_id")
      .single();

    setSaving(false);
    const persisted = data as {niantic_id: string|null; scopely_id: string|null} | null;
    if (error || !persisted || persisted.niantic_id !== value || persisted.scopely_id !== scopelyValue) {
      setSavedIds(null);
      setMessage(error?.message ?? "保存結果を確認できませんでした。もう一度お試しください。");
      return;
    }
    setNianticId(value);
    setScopelyId(scopelyValue);
    setSavedIds({ trainer:value, scopely:scopelyValue });
    setMessage("2つのIDを保存しました 🍀");
  }

  async function saveStampMessage(){
    if(!user) return;
    setStampSaving(true);
    setStampSaveMessage(null);
    const chars=Array.from(stampMessage.trim());
    const value=chars.slice(0,24).join("");
    const {data,error}=await (supabase as any).rpc("set_stamp_exchange_message",{
      p_message:value||null,
    });
    setStampSaving(false);
    if(error){
      setStampSaveMessage(error.message);
      return;
    }
    setStampMessage(String(data??""));
    setStampSaveMessage(value?"保存しました 🍀":"一言を未設定にしました");
  }

  async function signOut(){
    await supabase.auth.signOut();
    window.location.href="/";
  }

  if (loading) return <main className="grid min-h-[70vh] place-items-center text-sm font-black text-lime-800">🍀 読み込み中...</main>;
  if (!user) return <main className="grid min-h-[70vh] place-items-center px-4 text-center"><div><h1 className="text-2xl font-black text-lime-950">ログインが必要です</h1><Link href="/login" className="mt-5 inline-flex rounded-full bg-lime-400 px-5 py-3 text-sm font-black">Googleでログイン</Link></div></main>;

  return <main className="mx-auto max-w-2xl px-4 py-8 md:px-8">
    <Link href={profile?.role==="admin"?"/":"/my"} className="text-sm font-black text-lime-700">{profile?.role==="admin"?"← CA Clover Home":"← My Community"}</Link>
    <span className="mt-4 block w-fit rounded-full bg-lime-200 px-3 py-1 text-xs font-black text-lime-900">ACCOUNT</span>
    <h1 className="mt-3 text-3xl font-black text-lime-950">👤 アカウント</h1>

    <section className="clover-card mt-6 p-6">
      <div className="text-xs font-black text-slate-500">Google account</div>
      <div className="mt-1 font-black text-lime-950">{user.email ?? "—"}</div>
      <div className="mt-5 text-xs font-black text-slate-500">Role</div>
      <div className="mt-1 inline-flex rounded-full bg-lime-100 px-3 py-1 text-xs font-black text-lime-800">{profile?.role ?? "pending"}</div>

      {profile?.role==="pending"?<div className="mt-6 rounded-2xl border border-indigo-200 bg-indigo-50 p-4">
        <div className="text-sm font-black text-indigo-950">🛡️ Discord APAC CAロール認証</div>
        <p className="mt-2 text-xs font-semibold leading-5 text-indigo-800">Googleログイン中のCA Cloverアカウントに、DiscordのAPAC CAロールをOAuthで結び付けます。DiscordユーザーIDを手入力する必要はありません。</p>
        <div className="mt-3 text-xs font-black text-indigo-900" role="status">{discordStatus==="loading"?"認証状態を確認中…":discordStatus==="verified"?"✓ APAC CAロール認証済み（15分間有効）":discordStatus==="unavailable"?"認証接続がまだ利用できません":"APAC CAロールが未確認です"}</div>
        <button type="button" onClick={startDiscordVerification} disabled={discordBusy} className="mt-3 w-full rounded-2xl bg-indigo-700 px-4 py-3 text-sm font-black text-white disabled:opacity-50">{discordBusy?"Discordへ接続中…":discordStatus==="verified"?"Discordで再認証する":"DiscordでAPAC CAロールを確認"}</button>
        {discordMessage?<p className="mt-2 text-xs font-semibold text-rose-700">{discordMessage}</p>:null}
      </div>:null}

      <label className="mt-6 block text-xs font-black text-slate-600" htmlFor="niantic-id">① Pokémon GO トレーナー名</label>
      <input id="niantic-id" value={nianticId} onChange={e=>{setNianticId(e.target.value);setSavedIds(null);setMessage(null);}} placeholder="ゲーム内のトレーナー名を入力" className="mt-2 w-full rounded-2xl border border-lime-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-lime-400" />

      <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">Pokémon GOのプロフィールに表示されるトレーナー名を入力してください。</p>

      <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">日本CAマスターの「PGO Trainer Name」と照合します。</p>
      <label className="mt-5 block text-xs font-black text-slate-600" htmlFor="scopely-id">② Scopely ID（Campfireユーザー名）</label>
      <input id="scopely-id" value={scopelyId} onChange={e=>{setScopelyId(e.target.value);setSavedIds(null);setMessage(null);}} placeholder="CampfireのScopely IDを入力" autoComplete="off" className="mt-2 w-full rounded-2xl border border-lime-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-lime-400" />
      <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">ミートアップ共有URLから取得した主催者のScopely IDと照合します。トレーナー名と異なっていても構いません。</p>
      <button onClick={save} disabled={saving} className="mt-4 w-full rounded-2xl bg-lime-400 px-5 py-3 text-sm font-black text-lime-950 disabled:opacity-50">{saving ? "保存中..." : "2つのIDを保存"}</button>
      {message ? <p className="mt-3 text-center text-xs font-bold text-lime-700">{message}</p> : null}

      <div className="mt-7 border-t border-lime-100 pt-6">
        <div className="flex items-end justify-between gap-3">
          <label className="block text-xs font-black text-slate-600" htmlFor="stamp-message">スタンプ交換時の一言</label>
          <span className="text-[11px] font-black text-slate-400">{Array.from(stampMessage).length} / 24</span>
        </div>
        <p className="mt-2 text-[11px] font-semibold leading-5 text-slate-400">
          新しく交換した相手が、あなたのバッジを初めて開いた時に表示されます。
        </p>
        <input
          id="stamp-message"
          value={stampMessage}
          onChange={event=>setStampMessage(Array.from(event.target.value).slice(0,24).join(""))}
          maxLength={48}
          placeholder="またどこかで会いましょう🍀"
          className="mt-3 w-full rounded-2xl border border-lime-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-lime-400"
        />
        <button
          onClick={saveStampMessage}
          disabled={stampSaving}
          className="mt-3 w-full rounded-2xl bg-lime-950 px-5 py-3 text-sm font-black text-white disabled:opacity-50"
        >
          {stampSaving?"保存中...":"一言を保存"}
        </button>
        {stampSaveMessage?<p className="mt-3 text-center text-xs font-bold text-lime-700">{stampSaveMessage}</p>:null}
      </div>

      {profile?.role==="pending" && discordStatus==="verified" && !saving && savedIds && savedIds.trainer===nianticId.trim().replace(/^@+/, "") && savedIds.scopely===scopelyId.trim().replace(/^@+/, "") ? (
        <Link href="/my" className="mt-4 flex w-full items-center justify-center rounded-2xl bg-lime-950 px-5 py-3 text-sm font-black text-white">
          CA登録を続ける →
        </Link>
      ) : null}

      <p className="mt-3 text-center text-[11px] font-semibold text-slate-400">
        各IDの先頭の「@」は保存時に自動で外します。2つのIDの保存とDiscord APAC CAロール認証が完了するとCA申請へ進めます。
      </p>

      <button onClick={signOut} className="mt-6 w-full rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-600">ログアウト</button>
    </section>
  </main>;
}
