"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAuthProfile } from "@/lib/use-auth-profile";
import MonthlyActivityChart from "@/components/monthly-activity-chart";

type MeetupRow={
  id:string;
  community_id:string|null;
  title:string;
  starts_at:string|null;
  location:string|null;
  event_url:string|null;
  is_ca_meetup:boolean|null;
  rsvp_count:number|null;
  checkin_count:number|null;
};

type CommunityRow={id:string;name:string};
type SummaryRow={
  meetup_count:number;
  ca_meetup_count:number;
  rsvp_count:number;
  checkin_count:number;
  last_event_at:string|null;
};
type MonthlyRow={
  month:string;
  meetup_count:number;
  rsvp_count:number;
  checkin_count:number;
};

const periods=[30,90,180,365] as const;

export default function Page(){
  const {supabase,user,profile,loading}=useAuthProfile();
  const [period,setPeriod]=useState<number>(30);
  const [summary,setSummary]=useState<SummaryRow>({meetup_count:0,ca_meetup_count:0,rsvp_count:0,checkin_count:0,last_event_at:null});
  const [monthly,setMonthly]=useState<MonthlyRow[]>([]);
  const [rows,setRows]=useState<MeetupRow[]>([]);
  const [communities,setCommunities]=useState<CommunityRow[]>([]);
  const [dataLoading,setDataLoading]=useState(false);

  useEffect(()=>{
    if(loading||!user||!profile||profile.role==="pending") return;
    supabase.from("communities").select("id,name").then(({data})=>{
      setCommunities((data as CommunityRow[]|null)??[]);
    });
    supabase.rpc("activity_monthly",{p_months:12} as never).then(({data})=>{
      setMonthly((data as MonthlyRow[]|null)??[]);
    });
  },[loading,user,profile?.role,supabase]);

  useEffect(()=>{
    if(loading||!user||!profile||profile.role==="pending") return;
    let alive=true;
    setDataLoading(true);
    const since=new Date(Date.now()-period*24*60*60*1000).toISOString();

    Promise.all([
      supabase.rpc("activity_summary",{p_days:period} as never),
      supabase.from("meetups")
        .select("id,community_id,title,starts_at,location,event_url,is_ca_meetup,rsvp_count,checkin_count")
        .gte("starts_at",since)
        .order("starts_at",{ascending:false})
        .limit(50),
    ]).then(([summaryResult,meetupResult])=>{
      if(!alive) return;
      const first=((summaryResult.data as SummaryRow[]|null)??[])[0];
      setSummary(first??{meetup_count:0,ca_meetup_count:0,rsvp_count:0,checkin_count:0,last_event_at:null});
      setRows((meetupResult.data as MeetupRow[]|null)??[]);
      setDataLoading(false);
    });

    return()=>{alive=false;};
  },[loading,user,profile?.role,period,supabase]);

  const communityMap=useMemo(()=>new Map(communities.map(c=>[c.id,c.name])),[communities]);

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

  return <main className="mx-auto max-w-6xl px-4 py-8 md:px-8">
    <Link href="/" className="text-sm font-black text-lime-700">← CA Clover Home</Link>
    <span className="mt-4 block w-fit rounded-full bg-lime-200 px-3 py-1 text-xs font-black text-lime-900">活動を見る</span>
    <h1 className="mt-3 text-3xl font-black text-lime-950">🔥 Meetup Activity</h1>
    <p className="mt-2 text-sm font-semibold text-slate-500">{dataLoading?"読み込み中…":profile?.role==="admin"?"全国の取得済みMeetupをDB側で集計":"割り当てCommunityをDB側で集計"}</p>

    <div className="mt-5 flex flex-wrap gap-2">
      {periods.map(days=><button key={days} onClick={()=>setPeriod(days)} className={period===days?"clover-pill active":"clover-pill"}>{days}日</button>)}
    </div>

    <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {[
        ["🔥","Meetup",summary.meetup_count],
        ["🍀","CA Meetup",summary.ca_meetup_count],
        ["📨","RSVP",summary.rsvp_count],
        ["✅","Check-in",summary.checkin_count],
      ].map(([icon,label,value])=><div key={String(label)} className="clover-card min-h-36 p-5"><div className="text-2xl">{icon}</div><div className="mt-3 text-xs font-black text-slate-500">{label} / {period}日</div><div className="mt-1 text-3xl font-black text-lime-950">{Number(value).toLocaleString("ja-JP")}</div></div>)}
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
      <div className="border-b border-lime-100 px-5 py-4"><h2 className="font-black text-lime-950">最近のMeetup / {period}日</h2><p className="mt-1 text-[11px] font-semibold text-slate-400">通信量を抑えるため最新50件まで表示</p></div>
      {rows.length===0&&!dataLoading?<div className="p-8 text-center text-sm font-semibold text-slate-500">この期間のMeetupデータはありません。</div>:null}
      <div className="divide-y divide-lime-50">
        {rows.map(row=><div key={row.id} className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xs font-black text-lime-700">{row.starts_at?new Date(row.starts_at).toLocaleString("ja-JP"):"日時未取得"}</div>
              <div className="mt-1 font-black text-lime-950">{row.event_url?<a href={row.event_url} target="_blank" rel="noreferrer" className="hover:text-lime-700">{row.title} ↗</a>:row.title}</div>
              <div className="mt-1 text-xs font-semibold text-slate-500">{row.community_id?"🏕️ "+(communityMap.get(row.community_id)??"Community"):""}{row.location?"　📍 "+row.location:""}</div>
            </div>
            {row.is_ca_meetup?<span className="rounded-full bg-lime-200 px-2.5 py-1 text-[11px] font-black text-lime-900">CA Meetup</span>:null}
          </div>
          <div className="mt-3 flex gap-4 text-xs font-bold text-slate-600"><span>RSVP {row.rsvp_count??"—"}</span><span>Check-in {row.checkin_count??"—"}</span></div>
        </div>)}
      </div>
    </section>

    <div className="mt-5 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-xs font-semibold leading-5 text-sky-900">集計値はPostgres側で計算し、ブラウザへ大量のMeetup行を送らない構成です。300人規模でも通信量が膨らみにくい設計にしています。</div>
  </main>;
}
