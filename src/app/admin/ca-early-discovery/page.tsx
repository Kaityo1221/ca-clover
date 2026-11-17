"use client";

import Link from "next/link";
import {useEffect,useState} from "react";
import {useAuthProfile} from "@/lib/use-auth-profile";

type Candidate={
  club_id:string;community_name:string;
  first_observed_at:string;last_observed_at:string;
  event_ids:string[];evidence_source:string;
  review_status:"new_candidate"|"reviewed"|"hold";
  report_status:"pending"|"claimed"|"delivered"|"failed"|"suppressed";
  master_status:"unverified"|"listed"|"not_listed"|"blocked";
  reported_at:string|null;revision:number;
};
type ResponseData={enabled:boolean;candidates:Candidate[];checkedAt:string|null;notice:string;error?:string};
const demoRows:Candidate[]=[
 {club_id:"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",community_name:"Pokémon GO サンプルタウン",
  first_observed_at:"2026-11-13T08:00:00Z",last_observed_at:"2026-11-13T08:00:00Z",
  event_ids:["DEMO-MEETUP-001"],evidence_source:"public_map_createdByCommunityAmbassador_true",
  review_status:"new_candidate",report_status:"pending",master_status:"unverified",reported_at:null,revision:0},
 {club_id:"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",community_name:"サンプル北町コミュニティ",
  first_observed_at:"2026-11-12T04:00:00Z",last_observed_at:"2026-11-13T09:00:00Z",
  event_ids:["DEMO-MEETUP-002","DEMO-MEETUP-003"],
  evidence_source:"public_map_createdByCommunityAmbassador_true",
  review_status:"hold",report_status:"delivered",master_status:"listed",
  reported_at:"2026-11-12T05:00:00Z",revision:1},
];
const statusText=(c:Candidate)=>c.review_status==="hold"?"要確認":
  c.review_status==="reviewed"?"確認済み":c.report_status==="delivered"?"再観測 / 報告済み":"新規候補";
const masterText=(s:Candidate["master_status"])=>({
 unverified:"未確認",listed:"掲載確認",not_listed:"未掲載（照合時点）",blocked:"照合不能",
})[s];
const datetime=(v:string|null)=>v&&Number.isFinite(Date.parse(v))?
  new Date(v).toLocaleString("ja-JP"):"未確認";
const toReport=(c:Candidate)=>[
 "🍀 新規CAコミュニティ候補を発見",
 `コミュニティ：${c.community_name}`,
 `CampfireコミュニティID：${c.club_id}`,
 `発見元Meetup：${c.event_ids.join(", ")}`,
 `初回観測：${datetime(c.first_observed_at)}`,
 "確認内容：公開MeetupのCA主催フラグを確認",
 "Clover登録：未登録候補（最新登録との再照合が必要）",
 `公式CAマスター：${masterText(c.master_status)}`,
 `状態：${statusText(c)} / 通知：${c.report_status}`,
 "※正式なCA認定日・バッジ付与日・本人情報は未確認です。",
 "※既存CA・Community・権限・所属の変更を行いません。",
].join("\n");

export default function EarlyDiscoveryPage(){
 const {user,profile,loading,error:authError,retry,supabase}=useAuthProfile();
 const [rows,setRows]=useState<Candidate[]>([]);
 const [enabled,setEnabled]=useState(false);
 const [demo,setDemo]=useState(false);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("本番未接続。候補台帳の有効化前はサンプルで画面を確認できます。");
 const [feedback,setFeedback]=useState("");
 const [filter,setFilter]=useState<"all"|"new"|"hold"|"reviewed">("all");
 async function load(){
   setBusy(true);setError("");setFeedback("");
   try{
     const {data,error:sessionError}=await supabase.auth.getSession();
     const token=data.session?.access_token;
     if(sessionError||!token)throw new Error("管理者のログイン状態を確認できません。");
     const response=await fetch("/api/admin/ca-early-discovery",{
       headers:{Authorization:`Bearer ${token}`},cache:"no-store",
     });
     const payload=await response.json() as ResponseData;
     if(!response.ok)throw new Error(payload.error??"候補を取得できません。");
     setRows(payload.candidates??[]);setEnabled(payload.enabled);setDemo(false);
     setNotice(payload.notice);
   }catch(e){setRows([]);setEnabled(false);setDemo(false);
     setError(e instanceof Error?e.message:"候補を取得できません。");
   }finally{setBusy(false);}
 }
 useEffect(()=>{
   if(!loading&&!authError&&user&&profile?.role==="admin"){void load();}
   // The signed-in admin identity, not any client-visible feature flag, gates access.
   // eslint-disable-next-line react-hooks/exhaustive-deps
 },[loading,authError,user?.id,profile?.role,supabase]);
 function showDemo(){
   setDemo(true);setEnabled(false);setRows(demoRows.map(c=>({...c,event_ids:[...c.event_ids]})));
   setError("");setFeedback("架空データでの動作プレビューです。実際のCA発見ではありません。");
 }
 async function copy(text:string){
   try{await navigator.clipboard.writeText(text);setFeedback("報告文をコピーしました。");}
   catch{setError("コピーできません。端末のクリップボード権限を確認してください。");}
 }
 async function mark(c:Candidate,action:"hold"|"review"|"acknowledge"){
   if(demo){
     setRows(old=>old.map(r=>r.club_id===c.club_id?{
       ...r,review_status:action==="hold"?"hold":"reviewed",
       report_status:action==="acknowledge"?"delivered":r.report_status,
       reported_at:action==="acknowledge"?new Date().toISOString():r.reported_at,
       revision:r.revision+1,
     }:r));
     setFeedback("デモ画面の状態だけを変更しました。DBには保存していません。");return;
   }
   if(!enabled)return;
   setBusy(true);setError("");
   try{
     const {data}=await supabase.auth.getSession();
     if(!data.session?.access_token)throw new Error("再ログインが必要です。");
     const response=await fetch("/api/admin/ca-early-discovery",{
       method:"POST",cache:"no-store",
       headers:{"Content-Type":"application/json",Authorization:`Bearer ${data.session.access_token}`},
       body:JSON.stringify({clubId:c.club_id,action,revision:c.revision}),
     });
     const payload=await response.json() as {error?:string};
     if(!response.ok)throw new Error(payload.error??"状態変更に失敗しました。");
     setFeedback("候補の確認状態を保存しました。");await load();
   }catch(e){setError(e instanceof Error?e.message:"確認できませんでした。");}
   finally{setBusy(false);}
 }
 if(loading)return <main className="grid min-h-[60vh] place-items-center font-bold">🍀 認証確認中...</main>;
 if(authError)return <main className="mx-auto max-w-xl p-8 text-center">
   <p role="alert" className="text-rose-700">{authError}</p>
   <button onClick={retry} className="mt-4 rounded-xl bg-lime-300 px-4 py-3 font-bold">認証を再確認</button>
 </main>;
 if(!user||profile?.role!=="admin")return <main className="grid min-h-[60vh] place-items-center font-black">🔒 ADMIN専用です</main>;
 const filtered=rows.filter(c=>filter==="all"||
   filter==="new"&&c.review_status==="new_candidate"&&c.report_status!=="delivered"||
   filter==="hold"&&c.review_status==="hold"||
   filter==="reviewed"&&(c.review_status==="reviewed"||c.report_status==="delivered"));
 return <main className="mx-auto max-w-5xl px-4 py-8 md:px-8">
   <Link href="/admin" className="text-sm font-black text-lime-800">← 管理メニュー</Link>
   <p className="mt-4 inline-block rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-900">
     {demo?"合成データのプレビュー":enabled?"候補台帳 接続中":"本番接続OFF / NO-GO"}
   </p>
   <h1 className="mt-3 text-2xl font-black text-lime-950 md:text-3xl">🎖️ 新規CA早期発見</h1>
   <p className="mt-3 text-sm leading-7 text-slate-700">
     Campfireの公開Meetupから、CA主催が観測された未登録Community候補を確認します。
     正式CA認定・バッジ付与日の確定ではありません。既存CAや権限は変更しません。
   </p>
   <div className="clover-card mt-5 p-4 md:p-5">
     <div className="flex flex-wrap items-center gap-2">
       <button disabled={busy} onClick={()=>void load()}
         className="rounded-xl bg-lime-400 px-4 py-3 text-sm font-black text-lime-950 disabled:opacity-50">
         {busy?"確認中...":"🔄 台帳を再確認"}
       </button>
       <button onClick={showDemo} className="rounded-xl border border-lime-700 px-4 py-3 text-sm font-black text-lime-900">
         📱 サンプルを表示
       </button>
     </div>
     <p className="mt-3 text-xs leading-6 text-slate-600">{notice}</p>
     {error?<p role="alert" className="mt-3 text-sm font-bold text-rose-700">{error}</p>:null}
     {feedback?<p role="status" className="mt-3 text-sm font-bold text-lime-800">{feedback}</p>:null}
   </div>
   <div className="mt-5 grid grid-cols-3 gap-2 md:gap-4">
     {[
       ["候補",rows.filter(c=>c.review_status==="new_candidate").length],
       ["要確認",rows.filter(c=>c.review_status==="hold").length],
       ["報告済み",rows.filter(c=>c.report_status==="delivered").length],
     ].map(([label,value])=><div key={String(label)} className="clover-card p-3 md:p-5">
       <div className="text-xs font-bold text-slate-600">{label}</div>
       <div className="mt-1 text-2xl font-black text-lime-950">{value}</div>
     </div>)}
   </div>
   <div className="mt-5 flex flex-wrap gap-2">
     {([["all","すべて"],["new","新規"],["hold","要確認"],["reviewed","確認・報告済み"]] as const)
       .map(([key,label])=><button key={key} onClick={()=>setFilter(key)}
       aria-pressed={filter===key}
       className={`rounded-full px-4 py-2 text-xs font-black ${filter===key?"bg-lime-800 text-white":"bg-slate-100 text-slate-700"}`}>
         {label}
       </button>)}
   </div>
   {rows.length>0?<button onClick={()=>void copy(filtered.map(toReport).join("\n\n---\n\n"))}
     className="mt-4 rounded-xl border border-lime-600 px-4 py-3 text-sm font-black text-lime-900">
     📋 表示中の候補をまとめて報告文にする
   </button>:null}
   <section className="mt-4 space-y-4">
     {filtered.map(c=><article key={c.club_id} className="clover-card p-4 md:p-6">
       <div className="flex flex-wrap items-center justify-between gap-2">
         <h2 className="font-black text-lime-950">{c.community_name}</h2>
         <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">{statusText(c)}</span>
       </div>
       <p className="mt-2 break-all text-xs text-slate-500">Campfire ID：{c.club_id}</p>
       <dl className="mt-4 grid grid-cols-2 gap-3 text-xs leading-6">
         <div><dt className="text-slate-500">初回観測</dt><dd className="font-bold">{datetime(c.first_observed_at)}</dd></div>
         <div><dt className="text-slate-500">最終観測</dt><dd className="font-bold">{datetime(c.last_observed_at)}</dd></div>
         <div><dt className="text-slate-500">公式マスター</dt><dd className="font-bold">{masterText(c.master_status)}</dd></div>
         <div><dt className="text-slate-500">報告状況</dt><dd className="font-bold">{c.report_status==="delivered"?"報告済み":c.report_status==="pending"?"未報告":c.report_status}</dd></div>
       </dl>
       <details className="mt-4 rounded-xl bg-slate-50 p-3 text-xs leading-6">
         <summary className="cursor-pointer font-black text-slate-700">証拠・Meetup情報を表示</summary>
         <p className="mt-2">CA主催フラグ：true（公開地図観測）</p>
         <p>照合：同一イベントIDの公開詳細からクラブIDを関連付け</p>
         <p>正式CA本人・認定日時：未確認</p>
         <p>発見元イベント：{c.event_ids.join("、")}</p>
         {!demo?c.event_ids.map(id=><a key={id} target="_blank" rel="noreferrer" className="mt-1 block break-all text-lime-800 underline"
           href={`https://campfire.nianticlabs.com/discover/meetup/${encodeURIComponent(id)}`}>{id} を開く</a>):null}
         <p>報告日：{datetime(c.reported_at)}</p>
       </details>
       <div className="mt-4 flex flex-wrap gap-2">
         <button onClick={()=>void copy(toReport(c))}
           className="rounded-xl bg-lime-100 px-4 py-2 text-xs font-black text-lime-900">報告文をコピー</button>
         <button disabled={busy} onClick={()=>void mark(c,"review")}
           className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold">確認済みにする</button>
         <button disabled={busy} onClick={()=>void mark(c,"hold")}
           className="rounded-xl border border-amber-300 px-4 py-2 text-xs font-bold text-amber-800">保留にする</button>
         {c.report_status==="pending"?<button disabled={busy} onClick={()=>void mark(c,"acknowledge")}
           className="rounded-xl border border-lime-700 px-4 py-2 text-xs font-bold text-lime-900">
           この報告を確認済みにする（再通知を停止）
         </button>:null}
       </div>
     </article>)}
     {!filtered.length?<div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
       {demo||enabled?"表示対象はありません。":"本番データは未接続です。サンプルを表示すると操作を確認できます。"}
     </div>:null}
   </section>
   <p className="mt-6 text-xs leading-6 text-amber-800">
     この画面にはCAマスターや既存Communityの更新・削除、権限付与・新規登録の実行操作はありません。
     候補だけを観測し、正式な登録は別途会長の承認が必要です。
   </p>
 </main>;
}
