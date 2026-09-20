"use client";

import Link from "next/link";
import {useEffect,useMemo,useState} from "react";
import {useAuthProfile} from "@/lib/use-auth-profile";
import WatchHighlight from "@/components/watch-highlight";

type CaseRow={
  id:string;
  meetup_id:string;
  community_id:string|null;
  status:"unreviewed"|"no_issue"|"contact_host"|"sop_in_progress"|"completed";
  review_required:boolean;
  priority:number;
  flags:string[];
  reason_summary:string|null;
  last_evaluated_at:string;
};
type MeetupRow={
  id:string;
  title:string;
  details:string|null;
  starts_at:string|null;
  ends_at:string|null;
  location:string|null;
  rsvp_count:number|null;
  checkin_count:number|null;
  event_url:string|null;
  community_id:string|null;
};
type FindingRow={
  id:string;
  meetup_id:string;
  flag_code:string;
  severity:number;
  reason:string;
  matched_field:string|null;
  matched_text:string|null;
  match_start:number|null;
  match_end:number|null;
  active:boolean;
};
type CommunityRow={id:string;name:string;prefecture:string|null};
type HotRow={community_id:string;hot_until:string|null;hot_reasons:string[]};

const statusLabels={
  unreviewed:"未確認",
  no_issue:"問題なし",
  contact_host:"本人確認",
  sop_in_progress:"SOP対応中",
  completed:"完了",
} as const;

export default function Page(){
  const {supabase,user,profile,loading}=useAuthProfile();
  const [cases,setCases]=useState<CaseRow[]>([]);
  const [meetups,setMeetups]=useState<MeetupRow[]>([]);
  const [findings,setFindings]=useState<FindingRow[]>([]);
  const [communities,setCommunities]=useState<CommunityRow[]>([]);
  const [hot,setHot]=useState<HotRow[]>([]);
  const [dataLoading,setDataLoading]=useState(false);
  const [busy,setBusy]=useState<string|null>(null);
  const [error,setError]=useState<string|null>(null);

  async function load(){
    setDataLoading(true);
    setError(null);
    const {data:caseRows,error:caseError}=await supabase
      .from("meetup_watch_cases")
      .select("id,meetup_id,community_id,status,review_required,priority,flags,reason_summary,last_evaluated_at")
      .eq("review_required",true)
      .order("priority",{ascending:false})
      .order("last_evaluated_at",{ascending:false})
      .limit(100);
    if(caseError){
      setError(caseError.message);
      setDataLoading(false);
      return;
    }

    const typedCases=(caseRows as CaseRow[]|null)??[];
    setCases(typedCases);
    if(!typedCases.length){
      setMeetups([]);
      setFindings([]);
      setCommunities([]);
      setHot([]);
      setDataLoading(false);
      return;
    }

    const meetupIds=[...new Set(typedCases.map(row=>row.meetup_id))];
    const communityIds=[...new Set(typedCases.map(row=>row.community_id).filter(Boolean) as string[])];

    const [meetupResult,findingResult,communityResult,hotResult]=await Promise.all([
      supabase.from("meetups")
        .select("id,title,details,starts_at,ends_at,location,rsvp_count,checkin_count,event_url,community_id")
        .in("id",meetupIds),
      supabase.from("meetup_watch_findings")
        .select("id,meetup_id,flag_code,severity,reason,matched_field,matched_text,match_start,match_end,active")
        .in("meetup_id",meetupIds)
        .eq("active",true)
        .order("severity",{ascending:false}),
      communityIds.length
        ?supabase.from("communities").select("id,name,prefecture").in("id",communityIds)
        :Promise.resolve({data:[],error:null}),
      communityIds.length
        ?supabase.from("watch_community_state").select("community_id,hot_until,hot_reasons").in("community_id",communityIds)
        :Promise.resolve({data:[],error:null}),
    ]);

    const firstError=meetupResult.error||findingResult.error||communityResult.error||hotResult.error;
    if(firstError) setError(firstError.message);
    setMeetups((meetupResult.data as MeetupRow[]|null)??[]);
    setFindings((findingResult.data as FindingRow[]|null)??[]);
    setCommunities((communityResult.data as CommunityRow[]|null)??[]);
    setHot((hotResult.data as HotRow[]|null)??[]);
    setDataLoading(false);
  }

  useEffect(()=>{
    if(!loading&&user&&profile?.role==="admin") load();
  },[loading,user,profile?.role]);

  const meetupMap=useMemo(()=>new Map(meetups.map(row=>[row.id,row])),[meetups]);
  const communityMap=useMemo(()=>new Map(communities.map(row=>[row.id,row])),[communities]);
  const hotMap=useMemo(()=>new Map(hot.map(row=>[row.community_id,row])),[hot]);

  async function changeStatus(caseId:string,status:CaseRow["status"]){
    setBusy(caseId);
    setError(null);
    const {error}=await supabase.functions.invoke("meetup-watch-admin",{
      body:{action:"set_status",caseId,status},
    });
    if(error){
      setError(error.message);
    }else{
      setCases(current=>current.map(row=>row.id===caseId?{...row,status}:row));
    }
    setBusy(null);
  }

  if(loading) return <main className="grid min-h-[70vh] place-items-center text-sm font-black text-lime-800">🍀 読み込み中...</main>;
  if(!user||profile?.role!=="admin") return <main className="grid min-h-[70vh] place-items-center text-center"><div>🔒 ADMIN専用です</div></main>;

  return <main className="mx-auto max-w-6xl px-4 py-8 md:px-8">
    <Link href="/admin" className="text-sm font-black text-lime-700">← 管理メニュー</Link>
    <span className="mt-4 block w-fit rounded-full bg-lime-200 px-3 py-1 text-xs font-black text-lime-900">MEETUP WATCH</span>
    <h1 className="mt-3 text-3xl font-black text-lime-950">🔍 要確認Meetup</h1>
    <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-500">
      検知フラグは確認材料です。不正を自動認定するものではなく、最終判断はADMIN・コミュニティチームが行います。
    </p>

    {error?<div className="mt-5 rounded-2xl bg-rose-50 p-4 text-sm font-bold text-rose-700">{error}</div>:null}
    <div className="mt-5 text-xs font-black text-slate-500">
      {dataLoading?"読み込み中...":"要確認 "+cases.length+"件"}
    </div>

    <div className="mt-4 space-y-5">
      {cases.map(item=>{
        const meetup=meetupMap.get(item.meetup_id);
        if(!meetup) return null;
        const community=item.community_id?communityMap.get(item.community_id):null;
        const activeFindings=findings.filter(f=>f.meetup_id===item.meetup_id&&f.active);
        const hotState=item.community_id?hotMap.get(item.community_id):null;
        const hotActive=Boolean(hotState?.hot_until&&Date.parse(hotState.hot_until)>Date.now());

        return <article key={item.id} className="clover-card p-5 md:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xs font-black text-lime-700">{community?.prefecture??"—"} / {community?.name??"Community未取得"}</div>
              <h2 className="mt-2 text-xl font-black text-lime-950">
                <WatchHighlight text={meetup.title} field="title" findings={activeFindings}/>
              </h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {hotActive?<span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-black text-orange-700">🔥 HOT監視中</span>:null}
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-800">優先度 {item.priority}</span>
            </div>
          </div>

          {meetup.details?<div className="mt-4 whitespace-pre-wrap rounded-2xl bg-slate-50 p-4 text-sm font-semibold leading-6 text-slate-700">
            <WatchHighlight text={meetup.details} field="details" findings={activeFindings}/>
          </div>:null}

          <div className="mt-4 grid gap-2 text-xs font-semibold text-slate-600 sm:grid-cols-2 lg:grid-cols-4">
            <div>🕒 {meetup.starts_at?new Date(meetup.starts_at).toLocaleString("ja-JP"):"開始未取得"}</div>
            <div>🏁 {meetup.ends_at?new Date(meetup.ends_at).toLocaleString("ja-JP"):"終了未取得"}</div>
            <div>📍 {meetup.location??"場所未取得"}</div>
            <div>📨 RSVP {meetup.rsvp_count??"—"} / ✅ Check-in {meetup.checkin_count??"—"}</div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {item.flags.map(flag=><span key={flag} className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black text-slate-700">{flag}</span>)}
          </div>

          <div className="mt-4 space-y-1">
            {activeFindings.map(f=><div key={f.id} className="text-xs font-semibold text-slate-600">・{f.reason}</div>)}
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <select
              value={item.status}
              disabled={busy===item.id}
              onChange={e=>changeStatus(item.id,e.target.value as CaseRow["status"])}
              className="rounded-xl border border-lime-200 bg-white px-3 py-2 text-xs font-black text-lime-900"
            >
              {Object.entries(statusLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}
            </select>
            {meetup.event_url?<a href={meetup.event_url} target="_blank" rel="noreferrer" className="rounded-xl border border-lime-200 bg-white px-3 py-2 text-xs font-black text-lime-700">Campfireを開く ↗</a>:null}
            <span className="text-[11px] font-bold text-slate-400">最終判定 {new Date(item.last_evaluated_at).toLocaleString("ja-JP")}</span>
          </div>
        </article>;
      })}
    </div>

    {!dataLoading&&!cases.length?<section className="clover-card mt-5 p-8 text-center">
      <div className="text-4xl">🍀</div>
      <div className="mt-3 font-black text-lime-950">現在、要確認Meetupはありません</div>
    </section>:null}
  </main>;
}
