"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuthProfile } from "@/lib/use-auth-profile";
import ActivityTrendChart from "@/components/monthly-activity-chart";

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
type TrendBucket="day"|"week"|"month"|"year";
type TrendRow={bucket:string;meetup_count:number;rsvp_count:number;checkin_count:number};

type PeriodValue=30|90|180|365|null;
const periods=[
  {label:"1か月",days:30},
  {label:"3か月",days:90},
  {label:"6か月",days:180},
  {label:"1年",days:365},
  {label:"全期間",days:null},
] as const satisfies ReadonlyArray<{label:string;days:PeriodValue}>;

function trendBucketForPeriod(period:PeriodValue):TrendBucket{
  if(period===30) return "day";
  if(period===90) return "week";
  if(period===null) return "year";
  return "month";
}

function trendUnitLabel(bucket:TrendBucket){
  if(bucket==="day") return "日別";
  if(bucket==="week") return "週別";
  if(bucket==="year") return "年別";
  return "月別";
}

export default function Page(){
  const params=useParams<{id:string}>();
  const id=params.id;
  const {
    supabase,
    user,
    profile,
    loading,
    error:authError,
    retry:retryAuth,
  }=useAuthProfile();

  const [community,setCommunity]=useState<CommunityRow|null>(null);
  const [cas,setCas]=useState<CaRow[]>([]);
  const [meetups,setMeetups]=useState<MeetupRow[]>([]);
  const [summary,setSummary]=useState<SummaryRow>({meetup_count:0,ca_meetup_count:0,rsvp_count:0,checkin_count:0,last_event_at:null});
  const [trend,setTrend]=useState<TrendRow[]>([]);
  const [period,setPeriod]=useState<PeriodValue>(30);
  const [dataLoading,setDataLoading]=useState(false);
  const [accessDenied,setAccessDenied]=useState(false);
  const [notFound,setNotFound]=useState(false);
  const [baseError,setBaseError]=useState<string|null>(null);
  const [activityError,setActivityError]=useState<string|null>(null);
  const [reloadKey,setReloadKey]=useState(0);
  const [selectedMeetup,setSelectedMeetup]=useState<MeetupRow|null>(null);
  const [copied,setCopied]=useState(false);

  useEffect(()=>{
    if(loading||authError||!user||!profile||profile.role==="pending"||!id) return;
    let alive=true;

    async function loadBase(){
      setDataLoading(true);
      setAccessDenied(false);
      setNotFound(false);
      setBaseError(null);

      if(profile?.role!=="admin"){
        const membershipResult=await supabase
          .from("community_memberships")
          .select("community_id")
          .eq("user_id",user!.id)
          .eq("community_id",id)
          .maybeSingle();

        if(!alive) return;
        if(membershipResult.error){
          setBaseError("Communityの閲覧権限を確認できませんでした。通信状態を確認して、もう一度お試しください。");
          setDataLoading(false);
          return;
        }
        if(!membershipResult.data){
          setAccessDenied(true);
          setDataLoading(false);
          return;
        }
      }

      const {data:communityRow,error:communityError}=await supabase
        .from("communities")
        .select("id,campfire_community_id,name,prefecture,campfire_url,member_count,coverage,coverage_from,coverage_to,fetched_at")
        .eq("id",id)
        .maybeSingle();

      if(!alive) return;
      if(communityError){
        setBaseError("Community情報を取得できませんでした。0件として扱わず、再取得を待っています。");
        setDataLoading(false);
        return;
      }
      if(!communityRow){
        setNotFound(true);
        setDataLoading(false);
        return;
      }

      setCommunity(communityRow as CommunityRow);

      const linksResult=await supabase
        .from("community_ca_members")
        .select("ca_member_id")
        .eq("community_id",id);

      if(!alive) return;
      if(linksResult.error){
        setCas([]);
        setBaseError("Communityは表示できますが、担当CA情報を取得できませんでした。");
        setDataLoading(false);
        return;
      }

      const links=(linksResult.data as LinkRow[]|null)??[];
      let caRows:CaRow[]=[];
      if(links.length){
        const caResult=await supabase.from("ca_members")
          .select("id,trainer_name,ca_level")
          .in("id",links.map(link=>link.ca_member_id))
          .order("ca_level");
        if(!alive) return;
        if(caResult.error){
          setCas([]);
          setBaseError("Communityは表示できますが、担当CA情報を取得できませんでした。");
          setDataLoading(false);
          return;
        }
        caRows=(caResult.data as CaRow[]|null)??[];
      }

      if(!alive) return;
      setCas(caRows);
      setDataLoading(false);
    }

    void loadBase();
    return()=>{alive=false;};
  },[authError,id,loading,profile?.role,reloadKey,supabase,user]);

  useEffect(()=>{
    if(loading||authError||!user||!profile||profile.role==="pending"||!id||!community) return;
    let alive=true;
    setDataLoading(true);
    setActivityError(null);
    const since=period===null?null:new Date(Date.now()-period*24*60*60*1000).toISOString();

    let meetupQuery=supabase.from("meetups")
      .select("id,title,starts_at,ends_at,location,event_url,details,is_ca_meetup,rsvp_count,checkin_count")
      .eq("community_id",id)
      .order("starts_at",{ascending:false})
      .limit(period===null?500:50);
    if(since) meetupQuery=meetupQuery.gte("starts_at",since);

    const trendBucket=trendBucketForPeriod(period);

    Promise.all([
      supabase.rpc("community_activity_summary",{p_community_id:id,p_days:period} as never),
      meetupQuery,
      supabase.rpc("community_activity_trend",{
        p_community_id:id,
        p_bucket:trendBucket,
        p_days:period,
      } as never),
    ]).then(([summaryResult,meetupResult,trendResult])=>{
      if(!alive) return;
      if(summaryResult.error||meetupResult.error||trendResult.error){
        setActivityError("Activity情報を取得できませんでした。表示中の数字を0件として確定せず、再読み込みをお願いします。");
        setDataLoading(false);
        return;
      }
      const first=((summaryResult.data as SummaryRow[]|null)??[])[0];
      setSummary(first??{meetup_count:0,ca_meetup_count:0,rsvp_count:0,checkin_count:0,last_event_at:null});
      setMeetups((meetupResult.data as MeetupRow[]|null)??[]);
      setTrend((trendResult.data as TrendRow[]|null)??[]);
      setDataLoading(false);
    }).catch(()=>{
      if(!alive) return;
      setActivityError("Activity情報の読み込み中にエラーが発生しました。もう一度お試しください。");
      setDataLoading(false);
    });

    return()=>{alive=false;};
  },[authError,community,id,loading,user,profile?.role,period,reloadKey,supabase]);

  async function openMeetup(m:MeetupRow){
    setCopied(false);
    if(m.details?.trim()){
      setSelectedMeetup(m);
      return;
    }

    setSelectedMeetup(m);
    const {data,error}=await supabase.functions.invoke("meetup-detail",{
      body:{meetupId:m.id},
    });
    if(error||!data?.meetup) return;

    const refreshed=data.meetup as MeetupRow;
    setSelectedMeetup(refreshed);
    setMeetups(current=>current.map(row=>row.id===refreshed.id?{...row,...refreshed}:row));
  }

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

  const selectedPeriodLabel=periods.find(item=>item.days===period)?.label??"1か月";
  const selectedTrendBucket=trendBucketForPeriod(period);

  if(loading) return <main className="grid min-h-[70vh] place-items-center text-sm font-black text-lime-800">🍀 読み込み中...</main>;
  if(authError) return <main className="grid min-h-[70vh] place-items-center px-4 text-center"><div className="max-w-md"><div className="text-5xl">⚠️</div><h1 className="mt-3 text-2xl font-black text-lime-950">認証情報を確認できませんでした</h1><p className="mt-3 text-sm font-semibold leading-6 text-slate-500">{authError}</p><button onClick={retryAuth} className="mt-5 inline-flex rounded-full bg-lime-400 px-5 py-3 text-sm font-black text-lime-950">もう一度確認する</button></div></main>;
  if(!user) return <main className="grid min-h-[70vh] place-items-center px-4 text-center"><div><h1 className="text-2xl font-black text-lime-950">ログインが必要です</h1><Link href={"/login?next="+encodeURIComponent("/community/"+id)} className="mt-5 inline-flex rounded-full bg-lime-400 px-5 py-3 text-sm font-black">Googleでログイン</Link></div></main>;
  if(profile?.role==="pending") return <main className="grid min-h-[70vh] place-items-center px-4 text-center"><div><div className="text-5xl">🌱</div><h1 className="mt-3 text-2xl font-black text-lime-950">アカウント確認中</h1></div></main>;
  if(accessDenied) return <main className="grid min-h-[70vh] place-items-center px-4 text-center"><div className="max-w-md"><div className="text-5xl">🔒</div><h1 className="mt-3 text-2xl font-black text-lime-950">このCommunityを閲覧する権限がありません</h1><p className="mt-2 text-sm font-semibold text-slate-500">自分に割り当てられたCommunityはMy Communityから確認できます。</p><Link href="/my" className="mt-5 inline-flex rounded-full bg-lime-400 px-5 py-3 text-sm font-black text-lime-950">My Communityへ</Link></div></main>;
  if(notFound) return <main className="grid min-h-[70vh] place-items-center px-4 text-center"><div className="max-w-md"><div className="text-5xl">🔎</div><h1 className="mt-3 text-2xl font-black text-lime-950">Community情報が見つかりません</h1><p className="mt-2 text-sm font-semibold text-slate-500">削除・移行されたか、URLが古い可能性があります。</p></div></main>;
  if(baseError&&!community) return <main className="grid min-h-[70vh] place-items-center px-4 text-center"><div className="max-w-md"><div className="text-5xl">⚠️</div><h1 className="mt-3 text-2xl font-black text-lime-950">Community情報を確認できませんでした</h1><p className="mt-3 text-sm font-semibold leading-6 text-slate-500">{baseError}</p><button onClick={()=>setReloadKey(value=>value+1)} className="mt-5 inline-flex rounded-full bg-lime-400 px-5 py-3 text-sm font-black text-lime-950">もう一度読み込む</button></div></main>;
  if(!community) return <main className="grid min-h-[70vh] place-items-center text-sm font-black text-lime-800">🍀 Communityを読み込み中...</main>;

  return <main className="mx-auto max-w-6xl px-4 py-7 md:px-8">
    <Link href={profile?.role==="admin"?"/communities":"/my"} className="text-sm font-black text-lime-700">{profile?.role==="admin"?"← Community一覧":"← My Community"}</Link>

    {baseError?<section className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800"><div>{baseError}</div><button onClick={()=>setReloadKey(value=>value+1)} className="mt-3 rounded-full bg-amber-200 px-4 py-2 text-xs font-black text-amber-950">担当CA情報を再取得</button></section>:null}

    <section className="clover-card mt-4 p-6">
      <div className="text-xs font-black text-lime-600">{community.prefecture??"—"}</div>
      <h1 className="mt-2 text-3xl font-black text-lime-950">{community.name}</h1>
      <div className="mt-3 flex flex-wrap gap-2 text-xs font-black">
        {cas.map(ca=>{
          const mine=(profile?.niantic_id??"").replace(/^@+/,"").toLowerCase()===ca.trainer_name.replace(/^@+/,"").toLowerCase();
          const klass=ca.ca_level==="1st"
            ?"rounded-full border border-amber-200 bg-amber-100 px-3 py-2 text-amber-900"
            :ca.ca_level==="2nd"
              ?"rounded-full border border-sky-200 bg-sky-100 px-3 py-2 text-sky-900"
              :"rounded-full bg-lime-100 px-3 py-2 text-lime-800";
          return <span key={ca.id} className={klass}>{ca.ca_level??"CA"}: {ca.trainer_name}{mine?"（あなた）":""}</span>;
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold text-slate-500">
        <span className="rounded-full bg-lime-50 px-3 py-2">Member: {community.member_count?.toLocaleString("ja-JP")??"未取得"}</span>
      </div>
      {community.campfire_url?<a href={community.campfire_url} target="_blank" rel="noreferrer" className="mt-4 inline-flex rounded-full border border-lime-200 bg-white px-4 py-2 text-xs font-black text-lime-700">Campfireを開く ↗</a>:null}
    </section>

    <div className="clover-periods mt-5">
      {periods.map(item=><button key={item.label} onClick={()=>setPeriod(item.days)} className={period===item.days?"clover-pill active":"clover-pill"}>{item.label}</button>)}
    </div>

    {activityError?<section className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800"><div>{activityError}</div><button onClick={()=>setReloadKey(value=>value+1)} className="mt-3 rounded-full bg-amber-200 px-4 py-2 text-xs font-black text-amber-950">Activityを再取得</button></section>:null}

    <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {[
        ["🔥","Meetup",summary.meetup_count],
        ["🍀","CA Meetup",summary.ca_meetup_count],
        ["📨","RSVP",summary.rsvp_count],
        ["✅","Check-in",summary.checkin_count],
        ["🗓️","最終開催",summary.last_event_at?new Date(summary.last_event_at).toLocaleDateString("ja-JP"):"—"],
      ].map(([icon,label,value])=><div key={String(label)} className="clover-card p-5"><div className="text-2xl">{icon}</div><div className="mt-2 text-xs font-black text-slate-500">{label}{label!=="最終開催"?" / "+selectedPeriodLabel:""}</div><div className="mt-1 text-2xl font-black text-lime-950">{typeof value==="number"?value.toLocaleString("ja-JP"):value}</div></div>)}
    </div>

    <section className="clover-card mt-5 p-5">
      <h2 className="font-black text-lime-950">📈 Activity推移 / {selectedPeriodLabel}</h2>
      <p className="mt-1 text-xs font-semibold text-slate-500">{trendUnitLabel(selectedTrendBucket)} / Meetup回数とCheck-in数の推移</p>
      <div className="mt-5">
        <ActivityTrendChart
          data={trend.map(row=>({
            bucket:row.bucket,
            meetup_count:Number(row.meetup_count)||0,
            checkin_count:Number(row.checkin_count)||0,
          }))}
          bucket={selectedTrendBucket}
          periodLabel={selectedPeriodLabel}
        />
      </div>
    </section>

    <section className="clover-card mt-5 overflow-hidden">
      <div className="border-b border-lime-100 px-5 py-4"><h2 className="font-black text-lime-950">🔥 Meetup履歴 / {selectedPeriodLabel}</h2><p className="mt-1 text-[11px] font-semibold text-slate-400">{period===null?"最大500件まで表示":"最新50件まで表示"}</p></div>
      {meetups.length===0&&!dataLoading&&!activityError?<div className="p-8 text-center text-sm font-semibold text-slate-500">この期間のMeetupデータはありません。</div>:null}
      <div className="divide-y divide-lime-50">
        {meetups.map(m=><button
          key={m.id}
          type="button"
          onClick={()=>{void openMeetup(m);}}
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

    {selectedMeetup?<div className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-slate-950/45 p-4" onClick={()=>setSelectedMeetup(null)}>
      <div className="mx-auto flex min-h-full max-w-2xl items-center justify-center py-2">
      <section className="max-h-[calc(100dvh-2rem)] w-full overflow-y-auto overscroll-contain rounded-[28px] border border-lime-100 bg-white p-6 shadow-2xl" onClick={event=>event.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 bg-white pb-3">
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
      </div>
    </div>:null}

    {profile?.role==="admin"?<section className="clover-card mt-5 p-5">
      <h2 className="font-black text-lime-950">🧾 Data Coverage</h2>
      <div className="mt-4 grid gap-4 text-sm sm:grid-cols-4">
        <div><div className="text-xs text-slate-400">取得開始</div><b>{community.coverage_from?new Date(community.coverage_from).toLocaleDateString("ja-JP"):"未取得"}</b></div>
        <div><div className="text-xs text-slate-400">取得終了</div><b>{community.coverage_to?new Date(community.coverage_to).toLocaleDateString("ja-JP"):"未取得"}</b></div>
        <div><div className="text-xs text-slate-400">状態</div><b>{community.coverage==="partial"?"◐ 一部取得":community.coverage==="complete"?"● 取得済み":"○ 未取得"}</b></div>
        <div><div className="text-xs text-slate-400">最終同期</div><b>{community.fetched_at?new Date(community.fetched_at).toLocaleString("ja-JP"):"未取得"}</b></div>
      </div>
      {community.coverage==="partial"?<p className="mt-4 text-xs font-semibold text-amber-700">同期が途中で終了したため「一部取得」と表示しています。</p>:null}
    </section>:community.coverage!=="complete"?<section className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">
      ⚠️ 一部の過去データが未取得のため、全期間集計は参考値です
    </section>:null}
  </main>;
}
