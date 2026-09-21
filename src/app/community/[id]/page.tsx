"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useAuthProfile } from "@/lib/use-auth-profile";
import MonthlyActivityChart from "@/components/monthly-activity-chart";

type CommunityRow={
  id:string;
  campfire_community_id:string|null;
  name:string;
  prefecture:string|null;
  campfire_url:string|null;
  member_count:number|null;
  coverage:"complete"|"partial"|"missing";
  coverage_from:string|null;
  coverage_to:string|null;
  fetched_at:string|null;
};
type MeetupRow={
  id:string;
  title:string;
  starts_at:string|null;
  ends_at:string|null;
  location:string|null;
  event_url:string|null;
  details:string|null;
  is_ca_meetup:boolean|null;
  rsvp_count:number|null;
  checkin_count:number|null;
};
type LinkRow={ca_member_id:string};
type CaRow={id:string;trainer_name:string;ca_level:"1st"|"2nd"|null};
type SummaryRow={
  meetup_count:number;
  ca_meetup_count:number;
  rsvp_count:number;
  checkin_count:number;
  last_event_at:string|null;
};
type MonthlyRow={month:string;meetup_count:number;rsvp_count:number;checkin_count:number};

const periods=[30,90,180,365] as const;

export default function Page(){
  const params=useParams<{id:string}>();
  const id=params.id;
  const {supabase,user,profile,loading}=useAuthProfile();

  const [community,setCommunity]=useState<CommunityRow|null>(null);
  const [cas,setCas]=useState<CaRow[]>([]);
  const [meetups,setMeetups]=useState<MeetupRow[]>([]);
  const [summary,setSummary]=useState<SummaryRow>({meetup_count:0,ca_meetup_count:0,rsvp_count:0,checkin_count:0,last_event_at:null});
  const [monthly,setMonthly]=useState<MonthlyRow[]>([]);
  const [period,setPeriod]=useState<number>(30);
  const [dataLoading,setDataLoading]=useState(false);
  const [notFound,setNotFound]=useState(false);
  const [selectedMeetup,setSelectedMeetup]=useState<MeetupRow|null>(null);
  const [copied,setCopied]=useState(false);

  useEffect(()=>{
    if(loading||!user||!profile||profile.role==="pending"||!id) return;
    let alive=true;

    async function loadBase(){
      setDataLoading(true);
      const {data:communityRow,error:communityError}=await supabase
        .from("communities")
        .select("id,campfire_community_id,name,prefecture,campfire_url,member_count,coverage,coverage_from,coverage_to,fetched_at")
        .eq("id",id)
        .maybeSingle();

      if(!alive) return;
      if(communityError||!communityRow){
        setNotFound(true);
        setDataLoading(false);
        return;
      }

      const [linksResult,monthlyResult]=await Promise.all([
        supabase.from("community_ca_members").select("ca_member_id").eq("community_id",id),
        supabase.rpc("community_monthly_activity",{p_community_id:id,p_months:12} as never),
      ]);

      const links=(linksResult.data as LinkRow[]|null)??[];
      let caRows:CaRow[]=[];
      if(links.length){
        const {data}=await supabase.from("ca_members")
          .select("id,trainer_name,ca_level")
          .in("id",links.map(link=>link.ca_member_id))
          .order("ca_level");
        caRows=(data as CaRow[]|null)??[];
      }

      if(!alive) return;
      setCommunity(communityRow as CommunityRow);
      setCas(caRows);
      setMonthly((monthlyResult.data as MonthlyRow[]|null)??[]);
      setDataLoading(false);
    }

    loadBase();
    return()=>{alive=false;};
  },[id,loading,user,profile?.role,supabase]);

  useEffect(()=>{
    if(loading||!user||!profile||profile.role==="pending"||!id||notFound) return;
    let alive=true;
    setDataLoading(true);
    const since=new Date(Date.now()-period*24*60*60*1000).toISOString();

    Promise.all([
      supabase.rpc("community_activity_summary",{p_community_id:id,p_days:period} as never),
      supabase.from("meetups")
        .select("id,title,starts_at,ends_at,location,event_url,details,is_ca_meetup,rsvp_count,checkin_count")
        .eq("community_id",id)
        .gte("starts_at",since)
        .order("starts_at",{ascending:false})
        .limit(50),
    ]).then(([summaryResult,meetupResult])=>{
      if(!alive) return;
      const first=((summaryResult.data as SummaryRow[]|null)??[])[0];
      setSummary(first??{meetup_count:0,ca_meetup_count:0,rsvp_count:0,checkin_count:0,last_event_at:null});
      setMeetups((meetupResult.data as MeetupRow[]|null)??[]);
      setDataLoading(false);
    });

    return()=>{alive=false;};
  },[id,loading,user,profile?.role,period,notFound,supabase]);

  function meetupOverview(m:MeetupRow){
    const lines=[
      "【"+m.title+"】",
      "日時: "+(m.starts_at?new Date(m.starts_at).toLocaleString("ja-JP"):"未取得")+
        (m.ends_at?" 〜 "+new Date(m.ends_at).toLocaleString("ja-JP"):""),
      "場所: "+(m.location??"未取得"),
      "RSVP: "+(m.rsvp_count??"—"),
      "Check-in: "+(m.checkin_count??"—"),
      "CA Meetup: "+(m.is_ca_meetup?"はい":"いいえ"),
    ];
    if(m.details?.trim()) lines.push("",m.details.trim());
    if(m.event_url) lines.push("","Campfire: "+m.event_url);
    return lines.join("\n");
  }

  async function copyMeetupOverview(){
    if(!selectedMeetup) return;
    await navigator.clipboard.writeText(meetupOverview(selectedMeetup));
    setCopied(true);
    window.setTimeout(()=>setCopied(false),1600);
  }

  const monthMap=useMemo(()=>{
    const source=new Map(monthly.map(row=>[row.month.slice(0,7),row]));
    const now=new Date();
    const result:Array<[string,MonthlyRow]>=[];
    for(let i=11;i>=0;i--){
      const d=new Date(now.getFullYear(),now.getMonth()-i,1);
      const key=d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0");
      result.push([key,source.get(key)??{month:key+"-01",meetup_count:0,rsvp_count:0,checkin_count:0}]);
    }
    return result;
  },[monthly]);

  if(loading) return <main className="grid min-h-[70vh] place-items-center text-sm font-black text-lime-800">🍀 読み込み中...</main>;
  if(!user) return <main className="grid min-h-[70vh] place-items-center px-4 text-center"><div><h1 className="text-2xl font-black text-lime-950">ログインが必要です</h1><Link href="/login" className="mt-5 inline-flex rounded-full bg-lime-400 px-5 py-3 text-sm font-black">Googleでログイン</Link></div></main>;
  if(profile?.role==="pending") return <main className="grid min-h-[70vh] place-items-center px-4 text-center"><div><div className="text-5xl">🌱</div><h1 className="mt-3 text-2xl font-black text-lime-950">アカウント確認中</h1></div></main>;
  if(notFound) return <main className="grid min-h-[70vh] place-items-center px-4 text-center"><div><div className="text-5xl">🔒</div><h1 className="mt-3 text-2xl font-black text-lime-950">このCommunityは表示できません</h1><p className="mt-2 text-sm font-semibold text-slate-500">割り当て外、または存在しないCommunityです。</p></div></main>;
  if(!community) return <main className="grid min-h-[70vh] place-items-center text-sm font-black text-lime-800">🍀 Communityを読み込み中...</main>;

  return <main className="mx-auto max-w-6xl px-4 py-7 md:px-8">
    <Link href="/communities" className="text-sm font-black text-lime-700">← Community一覧</Link>

    <section className="clover-card mt-4 p-6">
      <div className="text-xs font-black text-lime-600">{community.prefecture??"—"}</div>
      <h1 className="mt-2 text-3xl font-black text-lime-950">{community.name}</h1>
      <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold text-slate-500">
        <span className="rounded-full bg-lime-50 px-3 py-2">Member: {community.member_count?.toLocaleString("ja-JP")??"未取得"}</span>
        {cas.map(ca=><span key={ca.id} className="rounded-full bg-lime-100 px-3 py-2 text-lime-800">{ca.ca_level??"CA"}: {ca.trainer_name}</span>)}
      </div>
      {community.campfire_url?<a href={community.campfire_url} target="_blank" rel="noreferrer" className="mt-4 inline-flex rounded-full border border-lime-200 bg-white px-4 py-2 text-xs font-black text-lime-700">Campfireを開く ↗</a>:null}
    </section>

    <div className="mt-5 flex flex-wrap gap-2">
      {periods.map(days=><button key={days} onClick={()=>setPeriod(days)} className={period===days?"clover-pill active":"clover-pill"}>{days}日</button>)}
    </div>

    <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {[
        ["🔥","Meetup",summary.meetup_count],
        ["🍀","CA Meetup",summary.ca_meetup_count],
        ["📨","RSVP",summary.rsvp_count],
        ["✅","Check-in",summary.checkin_count],
        ["🗓️","最終開催",summary.last_event_at?new Date(summary.last_event_at).toLocaleDateString("ja-JP"):"—"],
      ].map(([icon,label,value])=><div key={String(label)} className="clover-card p-5"><div className="text-2xl">{icon}</div><div className="mt-2 text-xs font-black text-slate-500">{label}{label!=="最終開催"?" / "+period+"日":""}</div><div className="mt-1 text-2xl font-black text-lime-950">{typeof value==="number"?value.toLocaleString("ja-JP"):value}</div></div>)}
    </div>

    <section className="clover-card mt-5 p-5">
      <h2 className="font-black text-lime-950">📊 月別Activity</h2>
      <p className="mt-1 text-xs font-semibold text-slate-500">過去12か月 / Meetup回数とCheck-in数の推移</p>
      <div className="mt-5">
        <MonthlyActivityChart
          data={monthMap.map(([month,value])=>({
            month,
            meetup_count:Number(value.meetup_count)||0,
            checkin_count:Number(value.checkin_count)||0,
          }))}
        />
      </div>
    </section>

    <section className="clover-card mt-5 overflow-hidden">
      <div className="border-b border-lime-100 px-5 py-4"><h2 className="font-black text-lime-950">🔥 Meetup履歴 / {period}日</h2><p className="mt-1 text-[11px] font-semibold text-slate-400">最新50件まで表示</p></div>
      {meetups.length===0&&!dataLoading?<div className="p-8 text-center text-sm font-semibold text-slate-500">この期間のMeetupデータはありません。</div>:null}
      <div className="divide-y divide-lime-50">
        {meetups.map(m=><button
          key={m.id}
          type="button"
          onClick={()=>{setSelectedMeetup(m);setCopied(false);}}
          className="block w-full p-5 text-left transition hover:bg-lime-50/70"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xs font-black text-lime-700">{m.starts_at?new Date(m.starts_at).toLocaleString("ja-JP"):"日時未取得"}</div>
              <div className="mt-1 font-black text-lime-950">{m.title}</div>
              <div className="mt-1 text-xs text-slate-500">📍 {m.location??"場所未取得"}</div>
            </div>
            <div className="flex items-center gap-2">
              {m.is_ca_meetup?<span className="h-fit rounded-full bg-lime-200 px-2.5 py-1 text-[11px] font-black text-lime-900">CA Meetup</span>:null}
              <span className="text-xs font-black text-lime-700">概要を見る →</span>
            </div>
          </div>
          <div className="mt-3 flex gap-4 text-xs font-bold text-slate-600"><span>RSVP {m.rsvp_count??"—"}</span><span>Check-in {m.checkin_count??"—"}</span></div>
        </button>)}
      </div>
    </section>

    {selectedMeetup?<div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4" onClick={()=>setSelectedMeetup(null)}>
      <section className="w-full max-w-2xl rounded-[28px] border border-lime-100 bg-white p-6 shadow-2xl" onClick={event=>event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="rounded-full bg-lime-100 px-3 py-1 text-[11px] font-black text-lime-800">MEETUP OVERVIEW</span>
            <h2 className="mt-3 text-2xl font-black text-lime-950">{selectedMeetup.title}</h2>
          </div>
          <button type="button" onClick={()=>setSelectedMeetup(null)} className="grid size-10 shrink-0 place-items-center rounded-full bg-slate-100 text-lg font-black text-slate-600">×</button>
        </div>

        <div className="mt-5 grid gap-3 rounded-2xl bg-lime-50 p-4 text-sm sm:grid-cols-2">
          <div><div className="text-[11px] font-black text-slate-400">日時</div><div className="mt-1 font-bold text-slate-700">{selectedMeetup.starts_at?new Date(selectedMeetup.starts_at).toLocaleString("ja-JP"):"未取得"}{selectedMeetup.ends_at?" 〜 "+new Date(selectedMeetup.ends_at).toLocaleString("ja-JP"):""}</div></div>
          <div><div className="text-[11px] font-black text-slate-400">場所</div><div className="mt-1 font-bold text-slate-700">{selectedMeetup.location??"未取得"}</div></div>
          <div><div className="text-[11px] font-black text-slate-400">RSVP</div><div className="mt-1 font-bold text-slate-700">{selectedMeetup.rsvp_count??"—"}</div></div>
          <div><div className="text-[11px] font-black text-slate-400">Check-in</div><div className="mt-1 font-bold text-slate-700">{selectedMeetup.checkin_count??"—"}</div></div>
        </div>

        {selectedMeetup.details?.trim()?<div className="mt-4 whitespace-pre-wrap rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm font-medium leading-6 text-slate-600">{selectedMeetup.details}</div>:<div className="mt-4 rounded-2xl border border-dashed border-slate-200 p-4 text-sm font-semibold text-slate-400">概要文はありません。</div>}

        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <button type="button" onClick={copyMeetupOverview} className="rounded-2xl bg-lime-400 px-5 py-3 text-sm font-black text-lime-950">{copied?"✓ コピーしました":"📋 概要をコピー"}</button>
          {selectedMeetup.event_url?<a href={selectedMeetup.event_url} target="_blank" rel="noreferrer" className="rounded-2xl border border-lime-200 bg-white px-5 py-3 text-center text-sm font-black text-lime-700">Campfireを開く ↗</a>:<button type="button" disabled className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3 text-sm font-black text-slate-400">Campfire URLなし</button>}
        </div>
      </section>
    </div>:null}

    <section className="clover-card mt-5 p-5">
      <h2 className="font-black text-lime-950">🧾 Data Coverage</h2>
      <div className="mt-4 grid gap-4 text-sm sm:grid-cols-4">
        <div><div className="text-xs text-slate-400">取得開始</div><b>{community.coverage_from?new Date(community.coverage_from).toLocaleDateString("ja-JP"):"未取得"}</b></div>
        <div><div className="text-xs text-slate-400">取得終了</div><b>{community.coverage_to?new Date(community.coverage_to).toLocaleDateString("ja-JP"):"未取得"}</b></div>
        <div><div className="text-xs text-slate-400">状態</div><b>{community.coverage==="partial"?"◐ 一部取得":community.coverage==="complete"?"● 取得済み":"○ 未取得"}</b></div>
        <div><div className="text-xs text-slate-400">最終同期</div><b>{community.fetched_at?new Date(community.fetched_at).toLocaleString("ja-JP"):"未取得"}</b></div>
      </div>
      {community.coverage==="partial"?<p className="mt-4 text-xs font-semibold text-amber-700">同期が途中で終了したため「一部取得」と表示しています。</p>:null}
    </section>
  </main>;
}
