"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAuthProfile } from "@/lib/use-auth-profile";

type ClaimRow={
  id:string;
  user_id:string;
  meetup_title:string|null;
  meetup_url:string|null;
  input_url:string|null;
  request_source:"meetup_share"|"community_invite";
  community_name_snapshot:string;
  community_prefecture_snapshot:string|null;
  is_ca_meetup:boolean|null;
  master_match:boolean|null;
  creator_display_name:string|null;
  creator_username:string|null;
  creator_username_matches_profile:boolean|null;
  creator_ca_badge_verified:boolean|null;
  ca_level_snapshot:string|null;
  ca_role_verified:boolean|null;
  ca_map_status:"matched"|"not_listed"|"community_mismatch"|"identity_missing"|null;
  status:"pending"|"approved"|"rejected";
  requested_at:string;
  reviewed_at:string|null;
};
type ProfileRow={id:string;email:string|null;niantic_id:string|null};

export default function Page(){
  const {supabase,user,profile,loading}=useAuthProfile();
  const [rows,setRows]=useState<ClaimRow[]>([]);
  const [profiles,setProfiles]=useState<ProfileRow[]>([]);
  const [busy,setBusy]=useState<string|null>(null);

  async function load(){
    const {data:requests}=await supabase.from("community_access_requests")
      .select("id,user_id,meetup_title,meetup_url,input_url,request_source,community_name_snapshot,community_prefecture_snapshot,is_ca_meetup,master_match,creator_display_name,creator_username,creator_username_matches_profile,creator_ca_badge_verified,ca_level_snapshot,ca_role_verified,ca_map_status,status,requested_at,reviewed_at")
      .order("requested_at",{ascending:false});
    const claimRows=(requests as ClaimRow[]|null)??[];
    setRows(claimRows);
    const ids=[...new Set(claimRows.map(row=>row.user_id))];
    if(!ids.length){setProfiles([]);return;}
    const {data:profileRows}=await supabase.from("profiles").select("id,email,niantic_id").in("id",ids);
    setProfiles((profileRows as ProfileRow[]|null)??[]);
  }

  useEffect(()=>{if(!loading&&user&&profile?.role==="admin") load();},[loading,user,profile?.role]);

  const profileMap=useMemo(()=>new Map(profiles.map(p=>[p.id,p])),[profiles]);
  const pending=rows.filter(row=>row.status==="pending");
  const history=rows.filter(row=>row.status!=="pending");

  async function review(id:string,action:"approve"|"reject"){
    setBusy(id);
    const {error}=await supabase.functions.invoke("community-claim",{body:{action,requestId:id}});
    if(!error) await load();
    setBusy(null);
  }

  if(loading) return <main className="grid min-h-[70vh] place-items-center text-sm font-black text-lime-800">🍀 読み込み中...</main>;
  if(!user||profile?.role!=="admin") return <main className="grid min-h-[70vh] place-items-center text-center"><div>🔒 ADMIN専用です</div></main>;

  const card=(row:ClaimRow)=>{
    const requester=profileMap.get(row.user_id);
    return <section key={row.id} className="clover-card p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-start">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-lime-100 px-3 py-1 text-[11px] font-black text-lime-800">{row.community_prefecture_snapshot??"—"}</span>
            {row.request_source==="meetup_share"
              ?<span className={row.creator_ca_badge_verified===true?"rounded-full bg-violet-100 px-3 py-1 text-[11px] font-black text-violet-700":"rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black text-slate-500"}>{row.creator_ca_badge_verified===true?"🟣 紫CAバッジ確認済み":"CAバッジ未確認"}</span>
              :<span className="rounded-full bg-lime-100 px-3 py-1 text-[11px] font-black text-lime-800">コミュニティ招待URL</span>}
            <span className={row.ca_map_status==="matched"?"rounded-full bg-lime-200 px-3 py-1 text-[11px] font-black text-lime-900":row.ca_map_status==="not_listed"?"rounded-full bg-amber-100 px-3 py-1 text-[11px] font-black text-amber-800":row.ca_map_status==="community_mismatch"?"rounded-full bg-rose-100 px-3 py-1 text-[11px] font-black text-rose-700":"rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black text-slate-600"}>日本CA地図: {row.ca_map_status==="matched"?"掲載済み":row.ca_map_status==="not_listed"?"未掲載":row.ca_map_status==="community_mismatch"?"Community不一致":row.ca_map_status==="identity_missing"?"Niantic ID未登録":row.master_match===true?"掲載済み":"要確認"}</span>
            <span className={row.creator_username_matches_profile===true?"rounded-full bg-sky-100 px-3 py-1 text-[11px] font-black text-sky-800":"rounded-full bg-rose-100 px-3 py-1 text-[11px] font-black text-rose-700"}>{row.creator_username_matches_profile===true?"Niantic ID一致":"Niantic ID不一致"}</span>
            <span className={row.ca_role_verified===true?"rounded-full bg-lime-100 px-3 py-1 text-[11px] font-black text-lime-800":"rounded-full bg-rose-100 px-3 py-1 text-[11px] font-black text-rose-700"}>{row.ca_role_verified===true?"日本CA地図 "+(row.ca_level_snapshot??"")+"確認済み":"1st/2nd未確認"}</span>
            {row.request_source==="meetup_share"
              ?<span className={row.is_ca_meetup===true?"rounded-full bg-lime-100 px-3 py-1 text-[11px] font-black text-lime-800":"rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black text-slate-500"}>{row.is_ca_meetup===true?"CA Meetup":"CA判定未確認"}</span>
              :null}
          </div>
          <h2 className="mt-3 text-xl font-black text-lime-950">{row.community_name_snapshot}</h2>
          <div className="mt-2 text-sm font-bold text-slate-600">{row.request_source==="community_invite"?"コミュニティ招待URLから申請":row.meetup_title??"ミートアップ共有URLから申請"}</div>
          <div className="mt-3 text-xs font-black text-violet-700">{row.request_source==="community_invite"?"申請者":"ミートアップ主催者"}: {row.creator_display_name??"未取得"} / Niantic ID: {row.creator_username??"未取得"}</div>
          {row.ca_map_status==="not_listed"?<div className="mt-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-black text-amber-800">日本CA地図に未掲載です。申請者へ「リョータさんに掲載をお願いしてください」と案内してください。</div>:null}
          <div className="mt-3 text-xs font-semibold text-slate-500">申請者: {requester?.email??"—"} / Niantic ID: {requester?.niantic_id??"未登録"}</div>
          <div className="mt-1 text-[11px] font-black text-lime-700">承認すると、pendingアカウントはCA化され、このCommunityが同時に割り当てられます。</div>
          <div className="mt-1 text-[11px] text-slate-400">申請 {new Date(row.requested_at).toLocaleString("ja-JP")}</div>
          {(row.input_url??row.meetup_url)?<a href={row.input_url??row.meetup_url??"#"} target="_blank" rel="noreferrer" className="mt-3 inline-flex text-xs font-black text-lime-700">{row.request_source==="community_invite"?"Campfire Communityを確認 ↗":"Campfire ミートアップを確認 ↗"}</a>:null}
        </div>
        {row.status==="pending" ? <div className="flex shrink-0 gap-2">
          <button disabled={busy===row.id} onClick={()=>review(row.id,"reject")} className="rounded-full border border-rose-200 bg-white px-4 py-2 text-xs font-black text-rose-700 disabled:opacity-50">却下</button>
          <button disabled={busy===row.id||(row.request_source==="meetup_share"&&row.creator_ca_badge_verified!==true)||row.creator_username_matches_profile!==true||row.ca_role_verified!==true||row.ca_map_status!=="matched"} onClick={()=>review(row.id,"approve")} className="rounded-full bg-lime-400 px-5 py-2 text-xs font-black text-lime-950 disabled:opacity-50">{busy===row.id?"処理中...":"承認"}</button>
        </div> : <span className={row.status==="approved"?"rounded-full bg-lime-200 px-3 py-1 text-xs font-black text-lime-900":"rounded-full bg-rose-100 px-3 py-1 text-xs font-black text-rose-700"}>{row.status==="approved"?"承認済み":"却下"}</span>}
      </div>
    </section>;
  };

  return <main className="mx-auto max-w-5xl px-4 py-8 md:px-8">
    <Link href="/admin" className="text-sm font-black text-lime-700">← 管理メニュー</Link>
    <span className="mt-4 block w-fit rounded-full bg-lime-200 px-3 py-1 text-xs font-black text-lime-900">COMMUNITY CLAIMS</span>
    <h1 className="mt-3 text-3xl font-black text-lime-950">🛎️ Community申請</h1>
    <p className="mt-2 text-sm font-semibold text-slate-500">Campfireのコミュニティ招待URL / ミートアップ共有URLからCommunityを判定し、申請者が担当CAかを確認します。</p>

    <div className="mt-6 rounded-3xl border border-amber-200 bg-amber-50 p-5">
      <div className="text-xs font-black text-amber-700">承認待ち</div><div className="mt-1 text-3xl font-black text-amber-950">{pending.length}</div>
    </div>

    <div className="mt-5 space-y-3">{pending.length?pending.map(card):<div className="clover-card p-8 text-center text-sm font-bold text-slate-500">現在、承認待ちはありません 🍀</div>}</div>

    {history.length ? <><h2 className="mt-8 text-lg font-black text-lime-950">処理済み</h2><div className="mt-3 space-y-3">{history.map(card)}</div></> : null}
  </main>;
}
