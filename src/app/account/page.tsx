"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuthProfile } from "@/lib/use-auth-profile";

export default function Page(){
  const { supabase, user, profile, loading } = useAuthProfile();
  const [nianticId, setNianticId] = useState("");
  const [stampMessage, setStampMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [stampSaving, setStampSaving] = useState(false);
  const [stampSaveMessage, setStampSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    setNianticId(profile?.niantic_id ?? "");
    setStampMessage(profile?.stamp_exchange_message ?? "");
  }, [profile?.niantic_id, profile?.stamp_exchange_message]);

  async function save(){
    if (!user) return;
    setSaving(true);
    setMessage(null);
    const value = nianticId.trim().replace(/^@+/, "");
    const { error } = await supabase
      .from("profiles")
      .update({ niantic_id: value || null } as never)
      .eq("id", user.id);

    setSaving(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    setNianticId(value);
    setMessage("保存しました 🍀");
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

      <label className="mt-6 block text-xs font-black text-slate-600" htmlFor="niantic-id">Niantic ID</label>
      <input id="niantic-id" value={nianticId} onChange={e=>setNianticId(e.target.value)} placeholder="Niantic IDを入力" className="mt-2 w-full rounded-2xl border border-lime-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-lime-400" />

      <button onClick={save} disabled={saving} className="mt-4 w-full rounded-2xl bg-lime-400 px-5 py-3 text-sm font-black text-lime-950 disabled:opacity-50">{saving ? "保存中..." : "Niantic IDを保存"}</button>
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

      {profile?.role==="pending" && nianticId.trim() ? (
        <Link href="/my" className="mt-4 flex w-full items-center justify-center rounded-2xl bg-lime-950 px-5 py-3 text-sm font-black text-white">
          CA登録を続ける →
        </Link>
      ) : null}

      <p className="mt-3 text-center text-[11px] font-semibold text-slate-400">
        先頭の「@」は保存時に自動で外します。
      </p>

      <button onClick={signOut} className="mt-6 w-full rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-600">ログアウト</button>
    </section>
  </main>;
}
