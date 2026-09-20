"use client";

import Link from "next/link";
import {useEffect,useMemo,useState} from "react";
import {useAuthProfile} from "@/lib/use-auth-profile";
import WatchHighlight from "@/components/watch-highlight";
import {buildMeetupWatchContactTemplate} from "@/lib/meetup-watch-contact-template";

type CaseRow={
  id:string;
  meetup_id:string;
  community_id:string|null;
  status:"unreviewed"|"no_issue"|"contact_host"|"sop_in_progress"|"completed";
  review_required:boolean;
  score:number;
  priority_level:"record"|"review"|"high";
  high_priority:boolean;
  discord_candidate:boolean;
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
  event_url:string|null;
  campfire_created_at:string|null;
  rsvp_count:number|null;
  checkin_count:number|null;
  community_id:string|null;
};
type FindingRow={
  id:string;
  meetup_id:string;
  flag_code:string;
  severity:number;
  score_weight:number;
  reason:string;
  matched_field:string|null;
  matched_text:string|null;
  match_start:number|null;
  match_end:number|null;
  active:boolean;
};
type CommunityRow={id:string;name:string;prefecture:string|null};
type HotRow={community_id:string;hot_until:string|null;hot_reasons:string[]};
type RelatedRow={
  id:string;
  community_id:string|null;
  title:string;
  starts_at:string|null;
  ends_at:string|null;
  rsvp_count:number|null;
  checkin_count:number|null;
};

const statusLabels={
  unreviewed:"未確認",
  no_issue:"問題なし",
  contact_host:"本人確認",
  sop_in_progress:"SOP対応中",
  completed:"完了",
} as const;

function formatDate(value:string|null){
  if(!value) return "—";
  return new Date(value).toLocaleString("ja-JP");
}

function duration(start:string|null,end:string|null){
  if(!start||!end) return null;
  const value=(Date.parse(end)-Date.parse(start))/60000;
  return Number.isFinite(value)&&value>=0?Math.round(value):null;
}

export default function Page(){
  const {supabase,user,profile,loading}=useAuthProfile();
  const [cases,setCases]=useState<CaseRow[]>([]);
  const [meetups,setMeetups]=useState<MeetupRow[]>([]);
  const [findings,setFindings]=useState<FindingRow[]>([]);
  const [communities,setCommunities]=useState<CommunityRow[]>([]);
  const [hot,setHot]=useState<HotRow[]>([]);
  const [related,setRelated]=useState<RelatedRow[]>([]);
  const [templates,setTemplates]=useState<Record<string,string>>({});
  const [dataLoading,setDataLoading]=useState(false);
  const [busy,setBusy]=useState<string|null>(null);
  const [error,setError]=useState<string|null>(null);
  const [discordTest,setDiscordTest]=useState<"idle"|"sending"|"success"|"unconfigured"|"error">("idle");

  async function load(){
    setDataLoading(true);
    setError(null);
    const {data:caseRows,error:caseError}=await supabase
      .from("meetup_watch_cases")
      .select("id,meetup_id,community_id,status,review_required,score,priority_level,high_priority,discord_candidate,flags,reason_summary,last_evaluated_at")
      .eq("review_required",true)
      .order("score",{ascending:false})
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
      setRelated([]);
      setDataLoading(false);
      return;
    }

    const meetupIds=[...new Set(typedCases.map(row=>row.meetup_id))];
    const communityIds=[...new Set(typedCases.map(row=>row.community_id).filter(Boolean) as string[])];
    const from=new Date(Date.now()-31*24*60*60*1000).toISOString();
    const to=new Date(Date.now()+120*24*60*60*1000).toISOString();

    const [meetupResult,findingResult,communityResult,hotResult,relatedResult]=await Promise.all([
      supabase.from("meetups")
        .select("id,title,details,starts_at,ends_at,location,event_url,campfire_created_at,rsvp_count,checkin_count,community_id")
        .in("id",meetupIds),
      supabase.from("meetup_watch_findings")
        .select("id,meetup_id,flag_code,severity,score_weight,reason,matched_field,matched_text,match_start,match_end,active")
        .in("meetup_id",meetupIds)
        .eq("active",true)
        .order("score_weight",{ascending:false}),
      communityIds.length
        ?supabase.from("communities").select("id,name,prefecture").in("id",communityIds)
        :Promise.resolve({data:[],error:null}),
      communityIds.length
        ?supabase.from("watch_community_state").select("community_id,hot_until,hot_reasons").in("community_id",communityIds)
        :Promise.resolve({data:[],error:null}),
      communityIds.length
        ?supabase.from("meetups")
          .select("id,community_id,title,starts_at,ends_at,rsvp_count,checkin_count")
          .in("community_id",communityIds)
          .gte("starts_at",from)
          .lte("starts_at",to)
          .order("starts_at")
          .limit(2000)
        :Promise.resolve({data:[],error:null}),
    ]);

    const firstError=meetupResult.error||findingResult.error||communityResult.error||hotResult.error||relatedResult.error;
    if(firstError) setError(firstError.message);
    setMeetups((meetupResult.data as MeetupRow[]|null)??[]);
    setFindings((findingResult.data as FindingRow[]|null)??[]);
    setCommunities((communityResult.data as CommunityRow[]|null)??[]);
    setHot((hotResult.data as HotRow[]|null)??[]);
    setRelated((relatedResult.data as RelatedRow[]|null)??[]);
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
    if(error) setError(error.message);
    else setCases(current=>current.map(row=>row.id===caseId?{...row,status}:row));
    setBusy(null);
  }

  async function testDiscord(){
    setDiscordTest("sending");
    setError(null);
    const {data,error}=await supabase.functions.invoke("meetup-watch-notify",{
      body:{action:"test"},
    });
    if(error){
      const message=error.message??"Discordテスト通知に失敗しました";
      setDiscordTest(message.includes("409")||message.includes("not configured")?"unconfigured":"error");
      setError(message);
      return;
    }
    if(data?.status==="test_sent") setDiscordTest("success");
    else if(data?.error?.includes("not configured")) setDiscordTest("unconfigured");
    else setDiscordTest("error");
  }

  async function copyTemplate(caseId:string,text:string){
    try{
      await navigator.clipboard.writeText(text);
      setTemplates(current=>({...current,[caseId]:text+"\n\n✓ コピーしました"}));
    }catch{
      setTemplates(current=>({...current,[caseId]:text}));
    }
  }

  function nearby(meetup:MeetupRow){
    if(!meetup.community_id||!meetup.starts_at) return [];
    const current=Date.parse(meetup.starts_at);
    return related
      .filter(row=>row.community_id===meetup.community_id&&row.id!==meetup.id&&row.starts_at)
      .map(row=>({row,diff:Date.parse(row.starts_at as string)-current}))
      .sort((a,b)=>Math.abs(a.diff)-Math.abs(b.diff))
      .slice(0,4)
      .sort((a,b)=>a.diff-b.diff);
  }

  if(loading) return <main className="grid min-h-[70vh] place-items-center text-sm font-black text-lime-800">🍀 読み込み中...</main>;
  if(!user||profile?.role!=="admin") return <main className="grid min-h-[70vh] place-items-center text-center"><div>🔒 ADMIN専用です</div></main>;

  return <main className="mx-auto max-w-6xl px-4 py-8 md:px-8">
    <Link href="/admin" className="text-sm font-black text-lime-700">← 管理メニュー</Link>
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
      <span className="block w-fit rounded-full bg-lime-200 px-3 py-1 text-xs font-black text-lime-900">MEETUP WATCH v1.0</span>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={testDiscord}
          disabled={discordTest==="sending"}
          className="rounded-xl border border-lime-200 bg-white px-3 py-2 text-xs font-black text-lime-700 disabled:opacity-50"
        >
          {discordTest==="sending"?"送信中...":"🔔 Discordテスト通知"}
        </button>
        <Link href="/admin/meetup-watch/windows" className="text-xs font-black text-lime-700">公式イベント時間マスター →</Link>
      </div>
    </div>
    <h1 className="mt-3 text-3xl font-black text-lime-950">🔍 要確認Meetup</h1>
    <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-500">
      CA Cloverは裁判官ではなくレーダーです。検知した事実と理由を表示し、最終判断はADMIN・コミュニティチームが行います。
    </p>

    {discordTest==="success"?<div className="mt-5 rounded-2xl bg-lime-50 p-4 text-sm font-bold text-lime-800">✓ Discordテスト通知を送信しました。</div>:null}
    {discordTest==="unconfigured"?<div className="mt-5 rounded-2xl bg-amber-50 p-4 text-sm font-bold text-amber-800">Webhook Secret が未設定です。DISCORD_MEETUP_WATCH_WEBHOOK_URL を設定してください。</div>:null}
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
        const minutes=duration(meetup.starts_at,meetup.ends_at);
        const relatedMeetups=nearby(meetup);
        const template=buildMeetupWatchContactTemplate(item.flags,activeFindings);

        return <article id={"meetup-"+meetup.id} key={item.id} className="clover-card p-5 md:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xs font-black text-lime-700">{community?.prefecture??"—"} / {community?.name??"Community未取得"}</div>
              <h2 className="mt-2 text-xl font-black text-lime-950">
                <WatchHighlight text={meetup.title} field="title" findings={activeFindings}/>
              </h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {hotActive?<span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-black text-orange-700">🔥 HOT監視中</span>:null}
              <span className={item.high_priority
                ?"rounded-full bg-orange-100 px-3 py-1 text-xs font-black text-orange-800"
                :"rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-800"}>
                {item.high_priority?"🟠 高優先要確認":"🟡 要確認"} / {item.score}点
              </span>
              {item.discord_candidate?<span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-black text-white">Discord対象</span>:null}
            </div>
          </div>

          <div className="mt-4 whitespace-pre-wrap rounded-2xl bg-slate-50 p-4 text-sm font-semibold leading-6 text-slate-700">
            {meetup.details
              ?<WatchHighlight text={meetup.details} field="details" findings={activeFindings}/>
              :<span className="text-slate-400">概要なし</span>}
          </div>

          <div className="mt-4 grid gap-2 text-xs font-semibold text-slate-600 sm:grid-cols-2 lg:grid-cols-4">
            <div>🕒 {formatDate(meetup.starts_at)}</div>
            <div>⏱️ {minutes===null?"—":minutes+"分"}</div>
            <div>📍 {meetup.location??"場所未取得"}</div>
            <div>📨 RSVP {meetup.rsvp_count??"—"} / ✅ Check-in {meetup.checkin_count??"—"}</div>
            {meetup.campfire_created_at?<div>🆕 作成 {formatDate(meetup.campfire_created_at)}</div>:null}
            {hotActive&&hotState?.hot_until?<div>🔥 HOT解除予定 {formatDate(hotState.hot_until)}</div>:null}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {item.flags.map(flag=><span key={flag} className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black text-slate-700">{flag}</span>)}
          </div>

          <div className="mt-4 space-y-1">
            {activeFindings.map(f=><div key={f.id} className="text-xs font-semibold text-slate-600">
              ・{f.reason} <span className="font-black text-slate-400">+{f.score_weight}</span>
            </div>)}
          </div>

          {relatedMeetups.length?<div className="mt-5 rounded-2xl border border-slate-200 p-4">
            <div className="text-xs font-black text-slate-500">同一Communityの前後Meetup</div>
            <div className="mt-2 space-y-2">
              {relatedMeetups.map(({row,diff})=><div key={row.id} className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-bold text-slate-700">{diff<0?"← 前":"→ 後"} {row.title}</span>
                <span className="text-slate-500">{formatDate(row.starts_at)} / {duration(row.starts_at,row.ends_at)??"—"}分 / Check-in {row.checkin_count??"—"}</span>
              </div>)}
            </div>
          </div>:null}

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <select
              value={item.status}
              disabled={busy===item.id}
              onChange={e=>changeStatus(item.id,e.target.value as CaseRow["status"])}
              className="rounded-xl border border-lime-200 bg-white px-3 py-2 text-xs font-black text-lime-900"
            >
              {Object.entries(statusLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}
            </select>
            <button
              type="button"
              onClick={()=>setTemplates(current=>({...current,[item.id]:template}))}
              className="rounded-xl border border-lime-200 bg-white px-3 py-2 text-xs font-black text-lime-700"
            >
              本人確認文を作る
            </button>
            {meetup.event_url?<a href={meetup.event_url} target="_blank" rel="noreferrer" className="rounded-xl border border-lime-200 bg-white px-3 py-2 text-xs font-black text-lime-700">Campfireを開く ↗</a>:null}
            <span className="text-[11px] font-bold text-slate-400">最終判定 {formatDate(item.last_evaluated_at)}</span>
          </div>

          {templates[item.id]?<div className="mt-4 rounded-2xl bg-lime-50 p-4">
            <div className="whitespace-pre-wrap text-sm font-semibold leading-6 text-slate-700">{templates[item.id]}</div>
            <button
              type="button"
              onClick={()=>copyTemplate(item.id,template)}
              className="mt-3 rounded-xl bg-lime-500 px-4 py-2 text-xs font-black text-white"
            >
              文面をコピー
            </button>
          </div>:null}
        </article>;
      })}
    </div>

    {!dataLoading&&!cases.length?<section className="clover-card mt-5 p-8 text-center">
      <div className="text-4xl">🍀</div>
      <div className="mt-3 font-black text-lime-950">現在、要確認Meetupはありません</div>
      <div className="mt-2 text-xs font-semibold text-slate-500">0〜2点の記録・HOT監視案件はこの一覧には表示しません。</div>
    </section>:null}
  </main>;
}
