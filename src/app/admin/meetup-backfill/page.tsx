"use client";

import Link from "next/link";
import {useState,type FormEvent} from "react";
import {useAuthProfile} from "@/lib/use-auth-profile";

type MeetupPreview={
  ok:true;
  status:"preview";
  lookup:string;
  event:{
    id:string;title:string;url:string;startsAt:string;endsAt:string;createdAt:string|null;
    location:string|null;rsvpCount:number|null;checkinCount:number|null;countsComplete:boolean;
  };
  community:{id:string;name:string;matchSource:string};
  existing:"missing"|"already_present";
  readOnly:true;
  canSave:false;
  checkedAt:string;
};

function countText(value:number|null|undefined){
  return typeof value==="number"?value.toLocaleString("ja-JP")+"人":"未取得";
}
function timeText(value:string|null|undefined){
  return value?new Date(value).toLocaleString("ja-JP",{timeZone:"Asia/Tokyo"}):"未取得";
}

export default function AdminMeetupBackfillPage(){
  const {supabase,user,profile,loading,error:authError}=useAuthProfile();
  const [url,setUrl]=useState("");
  const [working,setWorking]=useState(false);
  const [preview,setPreview]=useState<MeetupPreview|null>(null);
  const [message,setMessage]=useState("");
  const admin=Boolean(user&&profile?.role==="admin");

  async function inspect(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(!admin||working||!url.trim()) return;
    setWorking(true);setPreview(null);setMessage("");
    try{
      const {data,error}=await supabase.functions.invoke("admin-meetup-backfill",{
        body:{action:"preview",url:url.trim()},
      });
      if(error){
        const context=(error as {context?:unknown}).context;
        if(context instanceof Response){
          const failure=await context.json().catch(()=>null);
          if(typeof failure?.error==="string") throw new Error(failure.error);
        }
        throw new Error("照合APIを利用できません。バックエンドの接続状況を確認してください。");
      }
      if(data?.ok!==true||data?.status!=="preview"||data?.readOnly!==true||data?.canSave!==false){
        throw new Error(typeof data?.error==="string"?data.error:"安全な照合結果を確認できませんでした");
      }
      setPreview(data as MeetupPreview);
    }catch(err){
      setMessage(err instanceof Error?err.message:"照合できませんでした");
    }finally{
      setWorking(false);
    }
  }

  if(loading) return <main className="grid min-h-[70vh] place-items-center text-sm font-black text-lime-800">🍀 読み込み中...</main>;
  if(authError) return <main className="mx-auto max-w-xl px-4 py-12 text-sm font-bold text-rose-700">認証情報を確認できませんでした。ログイン状態をご確認ください。</main>;
  if(!admin) return <main className="mx-auto max-w-xl px-4 py-12 text-center font-black text-lime-950">🔒 ADMIN専用です</main>;

  return <main className="mx-auto max-w-3xl px-4 py-8 md:px-8">
    <Link href="/admin" className="text-sm font-black text-lime-700">← 管理メニュー</Link>
    <span className="mt-4 block w-fit rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-900">隔離試作・確認専用</span>
    <h1 className="mt-3 text-3xl font-black text-lime-950">🍀 Meetup履歴補完</h1>
    <p className="mt-3 text-sm font-semibold leading-7 text-slate-600">
      取得漏れしたMeetupの共有URLを入力し、Campfireの公開情報とCA Cloverの登録状況を照合します。
      この試作では確認のみ可能です。保存操作はありません。
    </p>

    <form onSubmit={inspect} className="clover-card mt-7 p-5 md:p-6">
      <label htmlFor="meetup-url" className="block text-sm font-black text-lime-900">Meetup共有URL</label>
      <input
        id="meetup-url" type="url" required
        value={url} onChange={e=>{setUrl(e.target.value);setPreview(null);setMessage("");}}
        placeholder="https://cmpf.re/… または https://campfire.scopely.com/discover/meetup/…"
        className="mt-3 block w-full rounded-xl border border-lime-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-lime-500"
      />
      <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">
        URLの展開先を確認し、Meetup ID・Community IDを照合します。参加者名簿は取得しません。
      </p>
      <button
        type="submit" disabled={working||!url.trim()}
        className="mt-5 rounded-2xl bg-lime-400 px-6 py-3 text-sm font-black text-lime-950 disabled:opacity-40"
      >
        {working?"照合中…":"URLから照合する"}
      </button>
    </form>

    {message?<section role="status" className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-950">
      {message}
      <p className="mt-2 text-xs font-medium">終了済みMeetupのAPI取得が許可されない場合、画像の数字だけで登録しません。</p>
    </section>:null}

    {preview?<section className="clover-card mt-6 p-5 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-black text-lime-950">{preview.event.title}</h2>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">
          {preview.existing==="missing"?"未登録":"登録済み"}
        </span>
      </div>
      <p className="mt-2 text-sm font-black text-lime-700">{preview.community.name}</p>
      <dl className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
        <div><dt className="text-xs font-semibold text-slate-500">開始日時</dt><dd className="mt-1 font-bold text-slate-900">{timeText(preview.event.startsAt)}</dd></div>
        <div><dt className="text-xs font-semibold text-slate-500">終了日時</dt><dd className="mt-1 font-bold text-slate-900">{timeText(preview.event.endsAt)}</dd></div>
        <div><dt className="text-xs font-semibold text-slate-500">作成日時</dt><dd className="mt-1 font-bold text-slate-900">{timeText(preview.event.createdAt)}</dd></div>
        <div><dt className="text-xs font-semibold text-slate-500">参加表明</dt><dd className="mt-1 font-bold text-slate-900">{countText(preview.event.rsvpCount)}</dd></div>
        <div><dt className="text-xs font-semibold text-slate-500">チェックイン</dt><dd className="mt-1 font-bold text-slate-900">{countText(preview.event.checkinCount)}</dd></div>
        <div><dt className="text-xs font-semibold text-slate-500">ID照合</dt><dd className="mt-1 font-bold text-slate-900">{preview.community.matchSource==="current"?"現行ID一致":"履歴ID一致"}</dd></div>
      </dl>
      <div className="mt-5 rounded-xl bg-slate-50 p-4 text-xs font-semibold leading-6 text-slate-600">
        {preview.existing==="missing"?"保存候補として確認しました。":"同一Meetupが登録済みのため新規追加は不要です。"}
        {!preview.event.countsComplete?" 参加者数に未取得項目があります。":""}
        <p className="mt-2 font-black text-amber-800">🔒 本番DBへの登録はできません。保存契約・監査・復旧試験の承認待ちです。</p>
      </div>
      <Link href={preview.event.url} target="_blank" rel="noopener noreferrer" className="mt-4 inline-block text-xs font-black text-lime-700 underline">
        CampfireのMeetupを開く
      </Link>
    </section>:null}
  </main>;
}
