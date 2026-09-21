"use client";

import {useEffect,useMemo,useState} from "react";
import Link from "next/link";
import {useAuthProfile} from "@/lib/use-auth-profile";
import MonthlyActivityChart from "@/components/monthly-activity-chart";

type PreviewMode="home"|"pending"|"my"|"detail";

type CommunityRow={
  id:string;
  name:string;
  prefecture:string|null;
  member_count:number|null;
  campfire_url:string|null;
};

type MeetupRow={
  id:string;
  title:string;
  starts_at:string|null;
  location:string|null;
  event_url:string|null;
  is_ca_meetup:boolean|null;
  rsvp_count:number|null;
  checkin_count:number|null;
};

type CaRow={
  id:string;
  trainer_name:string;
  ca_level:"1st"|"2nd"|null;
};

const periods=[
  {value:30,label:"30日"},
  {value:90,label:"3か月"},
  {value:180,label:"6か月"},
  {value:365,label:"1年"},
] as const;

function PreviewShell({
  children,
  width,
}:{
  children:React.ReactNode;
  width:"desktop"|"mobile";
}){
  return <div className={width==="mobile"
    ?"mx-auto overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-xl max-w-[430px]"
    :"mx-auto overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-xl max-w-6xl"
  }>
    {children}
  </div>;
}

function PreviewHeader(){
  return <header className="border-b border-lime-100 bg-white/95">
    <div className="flex items-center gap-3 px-4 py-3 md:px-6">
      <span className="grid size-11 place-items-center rounded-2xl bg-lime-300 text-2xl">🍀</span>
      <div>
        <div className="font-black text-lime-950">CA Clover</div>
        <div className="text-[11px] font-bold text-lime-700">My Community Management</div>
      </div>
      <div className="ml-auto flex items-center gap-2">
        <button type="button" className="grid size-10 place-items-center rounded-full bg-lime-50 text-lg" title="一般CAではアカウント画面への入口">👤</button>
        <div className="rounded-full bg-lime-50 px-3 py-2 text-xs font-black text-lime-800">CA</div>
      </div>
    </div>
  </header>;
}

export default function Page(){
  const {supabase,user,profile,loading}=useAuthProfile();
  const [mode,setMode]=useState<PreviewMode>("home");
  const [width,setWidth]=useState<"desktop"|"mobile">("desktop");
  const [communities,setCommunities]=useState<CommunityRow[]>([]);
  const [selectedId,setSelectedId]=useState("");
  const [meetups,setMeetups]=useState<MeetupRow[]>([]);
  const [cas,setCas]=useState<CaRow[]>([]);
  const [period,setPeriod]=useState(30);
  const [dataLoading,setDataLoading]=useState(false);

  useEffect(()=>{
    if(loading||!user||profile?.role!=="admin") return;
    let alive=true;
    supabase
      .from("communities")
      .select("id,name,prefecture,member_count,campfire_url")
      .order("prefecture")
      .order("name")
      .then(({data})=>{
        if(!alive) return;
        const rows=(data as CommunityRow[]|null)??[];
        setCommunities(rows);
        if(!selectedId&&rows.length){
          const tokyo=rows.find(row=>row.name==="Pokémon GO Club Tokyo")??rows[0];
          setSelectedId(tokyo.id);
        }
      });
    return()=>{alive=false;};
  },[loading,user,profile?.role,supabase,selectedId]);

  useEffect(()=>{
    if(!selectedId||profile?.role!=="admin") return;
    let alive=true;
    setDataLoading(true);
    const since=new Date(Date.now()-365*24*60*60*1000).toISOString();

    Promise.all([
      supabase
        .from("meetups")
        .select("id,title,starts_at,location,event_url,is_ca_meetup,rsvp_count,checkin_count")
        .eq("community_id",selectedId)
        .gte("starts_at",since)
        .order("starts_at",{ascending:false})
        .limit(1000),
      supabase
        .from("community_ca_members")
        .select("ca_member_id")
        .eq("community_id",selectedId),
    ]).then(async([meetupResult,linkResult])=>{
      if(!alive) return;
      setMeetups((meetupResult.data as MeetupRow[]|null)??[]);

      const ids=((linkResult.data as {ca_member_id:string}[]|null)??[]).map(row=>row.ca_member_id);
      if(ids.length){
        const {data}=await supabase
          .from("ca_members")
          .select("id,trainer_name,ca_level")
          .in("id",ids)
          .order("ca_level");
        if(alive) setCas((data as CaRow[]|null)??[]);
      }else{
        setCas([]);
      }
      setDataLoading(false);
    });

    return()=>{alive=false;};
  },[profile?.role,selectedId,supabase]);

  const selected=useMemo(
    ()=>communities.find(row=>row.id===selectedId)??null,
    [communities,selectedId]
  );

  const metrics30=useMemo(()=>{
    const since=Date.now()-30*24*60*60*1000;
    const rows=meetups.filter(row=>row.starts_at&&Date.parse(row.starts_at)>=since);
    return {
      meetups:rows.length,
      rsvp:rows.reduce((sum,row)=>sum+(row.rsvp_count??0),0),
      checkin:rows.reduce((sum,row)=>sum+(row.checkin_count??0),0),
    };
  },[meetups]);

  const periodRows=useMemo(()=>{
    const since=Date.now()-period*24*60*60*1000;
    return meetups.filter(row=>row.starts_at&&Date.parse(row.starts_at)>=since);
  },[meetups,period]);

  const summary=useMemo(()=>({
    meetup_count:periodRows.length,
    ca_meetup_count:periodRows.filter(row=>row.is_ca_meetup).length,
    rsvp_count:periodRows.reduce((sum,row)=>sum+(row.rsvp_count??0),0),
    checkin_count:periodRows.reduce((sum,row)=>sum+(row.checkin_count??0),0),
    last_event_at:periodRows[0]?.starts_at??null,
  }),[periodRows]);

  const monthlyData=useMemo(()=>{
    const now=new Date();
    const base:Array<{month:string;meetup_count:number;checkin_count:number}>=[];
    for(let i=11;i>=0;i--){
      const d=new Date(now.getFullYear(),now.getMonth()-i,1);
      const key=d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0");
      const rows=meetups.filter(row=>row.starts_at&&row.starts_at.slice(0,7)===key);
      base.push({
        month:key,
        meetup_count:rows.length,
        checkin_count:rows.reduce((sum,row)=>sum+(row.checkin_count??0),0),
      });
    }
    return base;
  },[meetups]);

  const periodLabel=periods.find(item=>item.value===period)?.label??period+"日";

  if(loading) return <main className="grid min-h-[70vh] place-items-center text-sm font-black text-lime-800">🍀 読み込み中...</main>;
  if(!user) return <main className="grid min-h-[70vh] place-items-center">ログインが必要です</main>;
  if(profile?.role!=="admin") return <main className="grid min-h-[70vh] place-items-center text-center"><div>🔒 ADMIN専用です</div></main>;

  return <main className="mx-auto max-w-7xl px-4 py-8 md:px-8">
    <Link href="/admin" className="text-sm font-black text-lime-700">← 管理メニュー</Link>

    <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
      <div>
        <span className="inline-flex rounded-full bg-violet-100 px-3 py-1 text-xs font-black text-violet-700">ADMIN PREVIEW</span>
        <h1 className="mt-3 text-3xl font-black text-lime-950">👀 一般CA画面プレビュー</h1>
        <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-500">
          ADMIN権限のまま、一般CAから見える画面だけを再現します。実際のロール・Community割当・RLSは変更しません。
        </p>
      </div>
      <div className="rounded-2xl bg-amber-50 px-4 py-3 text-xs font-bold leading-5 text-amber-800">
        この画面から申請・割当・設定変更は行いません。
      </div>
    </div>

    <section className="mt-6 grid gap-3 rounded-3xl border border-lime-100 bg-white p-4 lg:grid-cols-[1fr_auto]">
      <div>
        <div className="text-xs font-black text-slate-500">表示するCommunity</div>
        <select
          value={selectedId}
          onChange={e=>setSelectedId(e.target.value)}
          className="mt-2 w-full rounded-xl border border-lime-200 bg-white px-3 py-2 text-sm font-bold text-lime-950"
        >
          {communities.map(row=><option key={row.id} value={row.id}>
            {(row.prefecture??"—")+" / "+row.name}
          </option>)}
        </select>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <button type="button" onClick={()=>setWidth("desktop")} className={width==="desktop"?"clover-pill active":"clover-pill"}>🖥️ 通常幅</button>
        <button type="button" onClick={()=>setWidth("mobile")} className={width==="mobile"?"clover-pill active":"clover-pill"}>📱 スマホ幅</button>
      </div>
    </section>

    <div className="mt-4 flex flex-wrap gap-2">
      {[
        ["home","CAホーム"],
        ["pending","初回登録前"],
        ["my","My Community"],
        ["detail","Community詳細"],
      ].map(([value,label])=><button
        key={value}
        type="button"
        onClick={()=>setMode(value as PreviewMode)}
        className={mode===value?"clover-pill active":"clover-pill"}
      >{label}</button>)}
    </div>

    <div className="mt-6 rounded-[34px] bg-slate-100 p-3 md:p-5">
      <PreviewShell width={width}>
        <PreviewHeader/>

        {mode==="home"?<div className="px-4 py-7 md:px-8">
          <section className="rounded-[30px] border border-lime-100 bg-gradient-to-br from-lime-100 via-white to-emerald-50 p-6 md:p-8">
            <span className="rounded-full bg-lime-300 px-3 py-1 text-xs font-black text-lime-950">CA CLOVER HOME</span>
            <h2 className="mt-4 text-3xl font-black tracking-tight text-lime-950 md:text-4xl">My Communityへようこそ。🍀</h2>
            <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-slate-600">
              自分に割り当てられたCommunityの活動だけを確認できます。
            </p>
          </section>

          <section className="mt-7">
            <div className="mb-3">
              <h3 className="text-lg font-black text-lime-950">自分のCommunity</h3>
              <p className="mt-0.5 text-xs font-semibold text-slate-500">自分に割り当てられたCommunityを管理</p>
            </div>
            <div className="mx-auto max-w-md">
              <button
                type="button"
                onClick={()=>setMode(selected?"detail":"my")}
                className="group min-h-36 w-full rounded-[26px] border border-lime-100 bg-white p-5 text-left shadow-[0_14px_40px_rgba(77,124,15,.08)] transition hover:-translate-y-1"
              >
                <div className="grid size-12 place-items-center rounded-2xl bg-lime-100 text-2xl">🍀</div>
                <div className="mt-4 font-black text-lime-950">My Community</div>
                <div className="mt-1 text-xs font-semibold leading-5 text-slate-500">Meetup・RSVP・Check-in・月別推移を確認</div>
                <div className="mt-3 text-xs font-black text-lime-700">開く →</div>
              </button>
            </div>
          </section>
        </div>:null}

        {mode==="pending"?<div className="mx-auto max-w-5xl px-4 py-8 md:px-8">
          <span className="block w-fit rounded-full bg-lime-200 px-3 py-1 text-xs font-black text-lime-900">MY COMMUNITY</span>
          <h2 className="mt-3 text-3xl font-black text-lime-950">🍀 自分のCommunity</h2>

          <section className="mt-6 rounded-3xl border border-amber-200 bg-amber-50 p-5">
            <div className="text-xs font-black text-amber-700">初回CA登録</div>
            <h3 className="mt-1 text-lg font-black text-amber-950">自分主催のMeetupでCA確認をします</h3>
            <p className="mt-2 text-xs font-semibold leading-5 text-amber-800">
              Niantic IDを登録してから、自分が主催したMeetupを1件提出してください。会長が承認するとCAアカウント化とCommunity割当が同時に完了します。
            </p>
            <div className="mt-3 text-xs font-black text-amber-900">Niantic ID: preview_ca ✓</div>
          </section>

          <section className="clover-card mt-6 p-6">
            <div className="flex items-start gap-3">
              <div className="text-3xl">🔥</div>
              <div>
                <h3 className="font-black text-lime-950">MeetupからCommunityを申請</h3>
                <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
                  必ず自分が主催したMeetupを入力してください。紫色Community Ambassadorバッジ、主催者Niantic ID、Community、日本CA地図の1st/2ndを自動照合します。
                </p>
              </div>
            </div>
            <input
              readOnly
              value="https://cmpf.re/XXXXXXXX"
              className="mt-5 w-full rounded-2xl border border-lime-200 bg-white px-4 py-3 text-sm font-bold text-slate-500"
            />
            <button type="button" disabled className="mt-3 w-full rounded-2xl bg-lime-400 px-5 py-3 text-sm font-black text-lime-950 opacity-70">
              Communityを確認して申請
            </button>
            <p className="mt-3 text-center text-[11px] font-bold text-violet-600">プレビューのため送信されません</p>
          </section>

          <section className="clover-card mt-6 p-8 text-center">
            <div className="text-5xl">🌱</div>
            <h3 className="mt-3 text-xl font-black text-lime-950">Community未割当です</h3>
            <p className="mt-2 text-sm font-semibold text-slate-500">
              自分が主催したMeetupを提出し、承認されるとCAアカウントとCommunity割当が同時に有効になります。
            </p>
          </section>
        </div>:null}

        {mode==="my"?<div className="mx-auto max-w-5xl px-4 py-8 md:px-8">
          <span className="block w-fit rounded-full bg-lime-200 px-3 py-1 text-xs font-black text-lime-900">MY COMMUNITY</span>
          <h2 className="mt-3 text-3xl font-black text-lime-950">🍀 自分のCommunity</h2>

          {selected?<>
            <button
              type="button"
              onClick={()=>setMode("detail")}
              className="clover-card mt-6 w-full p-6 text-left transition hover:-translate-y-1 hover:border-lime-300"
            >
              <div className="text-xs font-black text-lime-700">{selected.prefecture??"—"}</div>
              <h3 className="mt-2 text-xl font-black text-lime-950">{selected.name}</h3>
              <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold text-slate-500">
                <span className="rounded-full bg-lime-50 px-3 py-2">Member: {selected.member_count?.toLocaleString("ja-JP")??"未取得"}</span>
              </div>
              <div className="mt-5 text-xs font-black text-lime-700">Activityを見る →</div>
            </button>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {[
                ["🔥","30日Meetup",metrics30.meetups],
                ["📨","30日RSVP",metrics30.rsvp],
                ["✅","30日Check-in",metrics30.checkin],
              ].map(([icon,label,value])=><div key={String(label)} className="clover-card p-5">
                <div className="text-2xl">{icon}</div>
                <div className="mt-2 text-xs font-black text-slate-500">{label}</div>
                <div className="mt-1 text-3xl font-black text-lime-950">{Number(value).toLocaleString("ja-JP")}</div>
              </div>)}
            </div>

            <div className="mt-6">
              <button type="button" className="inline-flex rounded-full border border-lime-200 bg-white px-4 py-2 text-xs font-black text-lime-700">＋ Communityを追加</button>
            </div>
          </>:<div className="mt-6 rounded-2xl bg-slate-50 p-6 text-center text-sm font-semibold text-slate-500">Communityを選択してください。</div>}
        </div>:null}

        {mode==="detail"?<div className="mx-auto max-w-6xl px-4 py-7 md:px-8">
          <button type="button" onClick={()=>setMode("my")} className="text-sm font-black text-lime-700">← My Community</button>

          {selected?<section className="clover-card mt-4 p-6">
            <div className="text-xs font-black text-lime-600">{selected.prefecture??"—"}</div>
            <h2 className="mt-2 text-3xl font-black text-lime-950">{selected.name}</h2>
            <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold text-slate-500">
              <span className="rounded-full bg-lime-50 px-3 py-2">Member: {selected.member_count?.toLocaleString("ja-JP")??"未取得"}</span>
              {cas.map(ca=><span key={ca.id} className="rounded-full bg-lime-100 px-3 py-2 text-lime-800">{ca.ca_level??"CA"}: {ca.trainer_name}</span>)}
            </div>
            {selected.campfire_url?<a href={selected.campfire_url} target="_blank" rel="noreferrer" className="mt-4 inline-flex rounded-full border border-lime-200 bg-white px-4 py-2 text-xs font-black text-lime-700">Campfireを開く ↗</a>:null}
          </section>:null}

          <div className="mt-5 flex flex-wrap gap-2">
            {periods.map(item=><button key={item.value} type="button" onClick={()=>setPeriod(item.value)} className={period===item.value?"clover-pill active":"clover-pill"}>{item.label}</button>)}
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {[
              ["🔥","Meetup",summary.meetup_count],
              ["🍀","CA Meetup",summary.ca_meetup_count],
              ["📨","RSVP",summary.rsvp_count],
              ["✅","Check-in",summary.checkin_count],
              ["🗓️","最終開催",summary.last_event_at?new Date(summary.last_event_at).toLocaleDateString("ja-JP"):"—"],
            ].map(([icon,label,value])=><div key={String(label)} className="clover-card p-5">
              <div className="text-2xl">{icon}</div>
              <div className="mt-2 text-xs font-black text-slate-500">{label}{label!=="最終開催"?" / "+periodLabel:""}</div>
              <div className="mt-1 text-2xl font-black text-lime-950">{typeof value==="number"?value.toLocaleString("ja-JP"):value}</div>
            </div>)}
          </div>

          <section className="clover-card mt-5 p-5">
            <h3 className="font-black text-lime-950">📊 月別Activity</h3>
            <p className="mt-1 text-xs font-semibold text-slate-500">過去12か月 / Meetup回数とCheck-in数の推移</p>
            <div className="mt-5"><MonthlyActivityChart data={monthlyData}/></div>
          </section>

          <section className="clover-card mt-5 overflow-hidden">
            <div className="border-b border-lime-100 px-5 py-4">
              <h3 className="font-black text-lime-950">🔥 Meetup履歴 / {periodLabel}</h3>
              <p className="mt-1 text-[11px] font-semibold text-slate-400">最新50件まで表示</p>
            </div>
            {!periodRows.length&&!dataLoading?<div className="p-8 text-center text-sm font-semibold text-slate-500">この期間のMeetupデータはありません。</div>:null}
            <div className="divide-y divide-lime-50">
              {periodRows.slice(0,50).map(row=><div key={row.id} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-black text-lime-700">{row.starts_at?new Date(row.starts_at).toLocaleString("ja-JP"):"日時未取得"}</div>
                    <div className="mt-1 font-black text-lime-950">{row.title}</div>
                    <div className="mt-1 text-xs text-slate-500">📍 {row.location??"場所未取得"}</div>
                  </div>
                  {row.is_ca_meetup?<span className="rounded-full bg-lime-200 px-2.5 py-1 text-[11px] font-black text-lime-900">CA Meetup</span>:null}
                </div>
                <div className="mt-3 flex gap-4 text-xs font-bold text-slate-600">
                  <span>RSVP {row.rsvp_count??"—"}</span>
                  <span>Check-in {row.checkin_count??"—"}</span>
                </div>
              </div>)}
            </div>
          </section>
        </div>:null}
      </PreviewShell>
    </div>
  </main>;
}
