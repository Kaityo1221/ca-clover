"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAuthProfile } from "@/lib/use-auth-profile";

type MembershipRow = { community_id: string };
type CommunityRow = {
  id: string;
  name: string;
  prefecture: string | null;
  member_count: number | null;
  avatar_url: string | null;
  coverage: "complete" | "partial" | "missing";
};
type MeetupRow = {
  community_id: string | null;
  starts_at: string | null;
  rsvp_count: number | null;
  checkin_count: number | null;
};
type ClaimRow = {
  id:string;
  meetup_title:string|null;
  request_source:"meetup_share"|"community_invite";
  community_name_snapshot:string;
  community_prefecture_snapshot:string|null;
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

export default function Page() {
  const { supabase, user, profile, loading } = useAuthProfile();
  const [communities, setCommunities] = useState<CommunityRow[]>([]);
  const [meetups, setMeetups] = useState<MeetupRow[]>([]);
  const [claims,setClaims]=useState<ClaimRow[]>([]);
  const [claimInput,setClaimInput]=useState("");
  const [claimBusy,setClaimBusy]=useState(false);
  const [claimMessage,setClaimMessage]=useState<string|null>(null);
  const [dataLoading, setDataLoading] = useState(false);

  async function loadClaims(){
    if(!user) return;
    const {data}=await supabase.from("community_access_requests")
      .select("id,meetup_title,request_source,community_name_snapshot,community_prefecture_snapshot,master_match,creator_display_name,creator_username,creator_username_matches_profile,creator_ca_badge_verified,ca_level_snapshot,ca_role_verified,ca_map_status,status,requested_at,reviewed_at")
      .eq("user_id",user.id)
      .order("requested_at",{ascending:false});
    setClaims((data as ClaimRow[]|null)??[]);
  }

  useEffect(() => {
    if (loading || !user || !profile) return;
    let alive = true;
    const userId = user.id;

    async function load() {
      setDataLoading(true);
      const [{data:memberships},{data:claimRows}]=await Promise.all([
        supabase.from("community_memberships").select("community_id").eq("user_id", userId),
        supabase.from("community_access_requests")
          .select("id,meetup_title,request_source,community_name_snapshot,community_prefecture_snapshot,master_match,creator_display_name,creator_username,creator_username_matches_profile,creator_ca_badge_verified,ca_level_snapshot,ca_role_verified,ca_map_status,status,requested_at,reviewed_at")
          .eq("user_id",userId)
          .order("requested_at",{ascending:false}),
      ]);
      if(!alive) return;
      setClaims((claimRows as ClaimRow[]|null)??[]);

      const ids = ((memberships as MembershipRow[] | null) ?? []).map(x => x.community_id);
      if (!ids.length) {
        setCommunities([]);
        setMeetups([]);
        setDataLoading(false);
        return;
      }

      const [{ data: communityRows }, { data: meetupRows }] = await Promise.all([
        supabase.from("communities").select("id,name,prefecture,member_count,avatar_url,coverage").in("id", ids).order("name"),
        supabase.from("meetups").select("community_id,starts_at,rsvp_count,checkin_count").in("community_id", ids).order("starts_at", { ascending: false }),
      ]);

      if (!alive) return;
      setCommunities((communityRows as CommunityRow[]) ?? []);
      setMeetups((meetupRows as MeetupRow[]) ?? []);
      setDataLoading(false);
    }

    load();
    return () => { alive = false; };
  }, [loading, profile, supabase, user]);

  async function submitClaim(){
    const value=claimInput.trim();
    if(!value) return;
    setClaimBusy(true);
    setClaimMessage(null);
    const {data,error}=await supabase.functions.invoke("community-claim",{body:{action:"submit",url:value}});
    if(error){
      let message="申請に失敗しました。コミュニティ招待URL / ミートアップ共有URLを確認してください。";
      try{
        const context=(error as {context?:Response}).context;
        const payload=context?await context.clone().json():null;
        if(payload?.error) message=String(payload.error);
      }catch{}
      setClaimMessage(message);
    }else if(data?.status==="already_assigned"){
      setClaimMessage(data.communityName+" はすでに閲覧できます 🍀");
      setClaimInput("");
    }else{
      if(data?.caMapStatus==="not_listed"){
        setClaimMessage((data?.communityName?data.communityName+" の申請を送りました。 ":"")+"あなたは日本CA地図にまだ掲載されていません。リョータさんに掲載をお願いしてください。");
      }else{
        setClaimMessage(data?.communityName ? data.communityName+" の承認申請を送りました 🍀" : "承認申請を送りました 🍀");
      }
      setClaimInput("");
      await loadClaims();
    }
    setClaimBusy(false);
  }

  const metrics = useMemo(() => {
    const since = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const recent = meetups.filter(m => m.starts_at && new Date(m.starts_at).getTime() >= since);
    return {
      meetups: recent.length,
      rsvp: recent.reduce((sum, m) => sum + (m.rsvp_count ?? 0), 0),
      checkin: recent.reduce((sum, m) => sum + (m.checkin_count ?? 0), 0),
    };
  }, [meetups]);

  if (loading) return <main className="grid min-h-[70vh] place-items-center text-sm font-black text-lime-800">🍀 読み込み中...</main>;
  if (!user) return <main className="grid min-h-[70vh] place-items-center px-4 text-center"><div><div className="text-5xl">🍀</div><h1 className="mt-3 text-2xl font-black text-lime-950">ログインが必要です</h1><Link href="/login" className="mt-5 inline-flex rounded-full bg-lime-400 px-5 py-3 text-sm font-black">Googleでログイン</Link></div></main>;
  return <main className="mx-auto max-w-5xl px-4 py-8 md:px-8">
    <Link href="/" className="text-sm font-black text-lime-700">← CA Clover Home</Link>
    <span className="mt-4 block w-fit rounded-full bg-lime-200 px-3 py-1 text-xs font-black text-lime-900">MY COMMUNITY</span>
    <h1 className="mt-3 text-3xl font-black text-lime-950">🍀 自分のCommunity</h1>
    <p className="mt-2 text-sm font-semibold text-slate-500">{dataLoading ? "読み込み中..." : communities.length ? "✅ 認証済み " + communities.length + " Community" : "0 Community"}</p>

    {profile?.role==="pending" ? <section className="mt-6 rounded-3xl border border-amber-200 bg-amber-50 p-5">
      <div className="text-xs font-black text-amber-700">初回CA登録</div>
      <h2 className="mt-1 text-lg font-black text-amber-950">Campfire URLでCA確認をします</h2>
      <p className="mt-2 text-xs font-semibold leading-5 text-amber-800">Niantic IDを登録してから、コミュニティ招待URLまたは自分が主催したミートアップ共有URLを提出してください。会長が承認するとCAアカウント化とCommunity割当が同時に完了します。</p>
      {!profile.niantic_id?<Link href="/account" className="mt-3 inline-flex rounded-full bg-amber-200 px-4 py-2 text-xs font-black text-amber-950">先にNiantic IDを登録 →</Link>:<div className="mt-3 text-xs font-black text-amber-900">Niantic ID: {profile.niantic_id} ✓</div>}
    </section> : null}

    {profile?.role==="pending" ? <section className="clover-card mt-6 p-6">
      <div className="flex items-start gap-3">
        <div className="text-3xl">🔥</div>
        <div><h2 className="font-black text-lime-950">Campfire URLからCommunityを申請</h2><p className="mt-1 text-xs font-semibold text-slate-500">コミュニティ招待URL、または自分が主催したミートアップ共有URLを貼り付けてください。Niantic ID、Community、日本CA地図の1st/2ndを照合します。ミートアップ共有URLでは紫色CAバッジも確認します。</p></div>
      </div>
      <input value={claimInput} onChange={e=>setClaimInput(e.target.value)} placeholder="コミュニティ招待URL / ミートアップ共有URL" className="mt-5 w-full rounded-2xl border border-lime-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-lime-400"/>
      <button onClick={submitClaim} disabled={claimBusy||!claimInput.trim()||(profile?.role==="pending"&&!profile?.niantic_id)} className="mt-3 w-full rounded-2xl bg-lime-400 px-5 py-3 text-sm font-black text-lime-950 disabled:opacity-50">{claimBusy?"Communityを確認中...":"Communityを確認して申請"}</button>
      {claimMessage ? <p className="mt-3 text-center text-xs font-bold text-lime-700">{claimMessage}</p> : null}
    </section> : null}

    {claims.length ? <section className="mt-6">
      <h2 className="text-lg font-black text-lime-950">申請履歴</h2>
      <div className="mt-3 space-y-3">{claims.map(c=><div key={c.id} className="clover-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><div className="text-xs font-black text-lime-700">{c.community_prefecture_snapshot??"—"}</div><div className="mt-1 font-black text-lime-950">{c.community_name_snapshot}</div><div className="mt-1 text-xs font-semibold text-slate-500">{c.request_source==="community_invite"?"コミュニティ招待URLから申請":c.meetup_title??"ミートアップ共有URLから申請"}</div></div>
          <span className={c.status==="approved"?"rounded-full bg-lime-200 px-3 py-1 text-xs font-black text-lime-900":c.status==="rejected"?"rounded-full bg-rose-100 px-3 py-1 text-xs font-black text-rose-700":"rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-800"}>{c.status==="approved"?"承認済み":c.status==="rejected"?"却下":"承認待ち"}</span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-bold">
          {c.request_source==="meetup_share"?<span className={c.creator_ca_badge_verified===true?"rounded-full bg-violet-100 px-2.5 py-1 text-violet-700":"rounded-full bg-slate-100 px-2.5 py-1 text-slate-500"}>{c.creator_ca_badge_verified===true?"🟣 CAバッジ確認済み":"CAバッジ未確認"}</span>:<span className="rounded-full bg-lime-100 px-2.5 py-1 text-lime-800">コミュニティ招待URL</span>}
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">主催者: {c.creator_display_name??"未取得"} / {c.creator_username??"ID未取得"}</span>
          <span className={c.creator_username_matches_profile===true?"rounded-full bg-sky-100 px-2.5 py-1 text-sky-800":"rounded-full bg-rose-100 px-2.5 py-1 text-rose-700"}>{c.creator_username_matches_profile===true?"Niantic ID一致":"Niantic ID未確認"}</span>
          <span className={c.ca_role_verified===true?"rounded-full bg-lime-100 px-2.5 py-1 text-lime-800":"rounded-full bg-rose-100 px-2.5 py-1 text-rose-700"}>{c.ca_role_verified===true?"日本CA地図 "+(c.ca_level_snapshot??"")+"確認済み":"1st/2nd未確認"}</span>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">日本CA地図: {c.ca_map_status==="matched"?"掲載済み":c.ca_map_status==="not_listed"?"未掲載":c.ca_map_status==="community_mismatch"?"Community要確認":c.ca_map_status==="identity_missing"?"Niantic ID未登録":c.master_match===true?"掲載済み":"要確認"}</span>
        </div>
        {c.ca_map_status==="not_listed"?<p className="mt-2 text-xs font-black text-amber-700">日本CA地図にまだ掲載されていません。リョータさんに掲載をお願いしてください。</p>:null}
        <div className="mt-2 text-[11px] font-bold text-slate-400">申請 {new Date(c.requested_at).toLocaleString("ja-JP")}</div>
      </div>)}</div>
    </section> : null}

    {!dataLoading && communities.length === 0 ? (
      <section className="clover-card mt-6 p-8 text-center">
        <div className="text-5xl">🌱</div>
        <h2 className="mt-3 text-xl font-black text-lime-950">Community未割当です</h2>
        <p className="mt-2 text-sm font-semibold text-slate-500">{profile?.role==="pending"?"コミュニティ招待URLまたは自分が主催したミートアップ共有URLを提出し、承認されるとCAアカウントとCommunity割当が同時に有効になります。":"Community情報を確認中です。認証済みなのに表示されない場合は管理者へお問い合わせください。"}</p>
      </section>
    ) : null}

    {communities.length ? <>
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="clover-card p-5"><div className="text-2xl">🔥</div><div className="mt-2 text-xs font-black text-slate-500">30日Meetup</div><div className="mt-1 text-3xl font-black text-lime-950">{metrics.meetups}</div></div>
        <div className="clover-card p-5"><div className="text-2xl">📨</div><div className="mt-2 text-xs font-black text-slate-500">30日RSVP</div><div className="mt-1 text-3xl font-black text-lime-950">{metrics.rsvp}</div></div>
        <div className="clover-card p-5"><div className="text-2xl">✅</div><div className="mt-2 text-xs font-black text-slate-500">30日Check-in</div><div className="mt-1 text-3xl font-black text-lime-950">{metrics.checkin}</div></div>
      </div>
      <h2 className="mt-7 text-lg font-black text-lime-950">✅ 認証済みCommunity</h2>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        {communities.map(c => <Link key={c.id} href={"/community/"+c.id} className="clover-card relative p-6 transition hover:-translate-y-1 hover:border-lime-300">
          <span className="absolute right-4 top-4 rounded-full bg-lime-100 px-3 py-1 text-[11px] font-black text-lime-800">✅ 認証済み</span>
          <div className="flex items-center gap-4 pr-24">
            <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-[22px] border border-lime-100 bg-lime-50 text-3xl shadow-sm">
              {c.avatar_url?<img src={c.avatar_url} alt="" className="h-full w-full object-cover"/>:<span>🍀</span>}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-black text-lime-700">{c.prefecture ?? "—"}</div>
              <h2 className="mt-1 truncate text-xl font-black text-lime-950">{c.name}</h2>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold text-slate-500">
            <span className="rounded-full bg-lime-50 px-3 py-2">Member: {c.member_count?.toLocaleString("ja-JP") ?? "未取得"}</span>
            <span className="rounded-full bg-lime-50 px-3 py-2">Data: {c.coverage}</span>
          </div>
          <div className="mt-5 text-xs font-black text-lime-700">Activityを見る →</div>
        </Link>)}
      </div>
    </> : null}
  </main>;
}
