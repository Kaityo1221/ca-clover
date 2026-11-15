"use client";
import {useEffect,useRef,useState} from "react";

type Player={id:string;number:number;name:string;role?:string;prompt?:string};
type Question={id:number;playerId:string};
type Game={phase:"lobby"|"talk"|"vote"|"reveal";state?:string;nickname?:string;myId?:string;myName?:string;
 role?:string;prompt?:string;players?:Player[];questions?:Question[];voteRound?:number;voted?:boolean;
 runoffIds?:string[];winner?:string|null;selectedGuest?:string|null;pairId?:string|null};
const topics=["見た目で特徴的なのは？","どこで出会えそう？","相棒にするなら？","進化はする？",
 "どんな技が強そう？","Pokémon GOではどう？","初めて見た印象は？","一言で説明すると？",
 "何が得意そう？","自慢したいところは？","どんな鳴き声？","似ているポケモンは？"];
const roleName=(r?:string)=>r==="zoroark"?"🦊 ゾロアーク":r==="mimikyu"?"👻 ミミッキュ":r==="villager"?"👥 村人":"未配布";
const winnerName=(w?:string|null)=>w==="villagers"?"👥 村人の勝利":w==="zoroark"?"🦊 ゾロアークの勝利":w==="mimikyu"?"👻 ミミッキュの単独勝利":"結果未確定";
async function api(action:string,fields:Record<string,unknown>={}){
 const response=await fetch("/api/zoroark/game/guest",{method:"POST",cache:"no-store",credentials:"same-origin",
  headers:{"Content-Type":"application/json","X-Zoroark-Request":"game-v1"},
  body:JSON.stringify({action,...fields})});
 const data=await response.json().catch(()=>({error:"通信内容が不正です"}));
 if(!response.ok)throw new Error(String(data.error??"ゲームに接続できません"));
 return data;
}
export default function GuestPage(){
 const [game,setGame]=useState<Game|null>(null),[busy,setBusy]=useState(false);
 const [message,setMessage]=useState("認証を確認中..."),[showSecret,setShowSecret]=useState(false);
 const [questionId,setQuestionId]=useState(0);
 const phaseRef=useRef<string|null>(null);
 async function refresh(){
  setBusy(true);
  try{
   const data=await api("state");
   if(!data.game||typeof data.game.phase!=="string")throw Error("ゲーム情報を確認できません");
   if(phaseRef.current!==null&&phaseRef.current!==data.game.phase)setShowSecret(false);
   phaseRef.current=data.game.phase;
   setGame(data.game as Game);setMessage("");
  }catch(e){
   const error=e instanceof Error?e.message:"通信エラー";
   if(error==="game_not_enabled"){
    // Old lobby remains available while gameplay stays behind its independent gate.
    try{
     const res=await fetch("/api/zoroark/guest",{method:"POST",credentials:"same-origin",cache:"no-store",
      headers:{"Content-Type":"application/json","X-Zoroark-Request":"guest-lobby-v1"},
      body:JSON.stringify({action:"me"})});
     const data=await res.json();
     if(res.ok){setGame({phase:"lobby",state:data.state,nickname:data.nickname});setMessage("試合開始機能は検証準備中です。");}
     else {setGame(null);setMessage("参加資格を確認できません。招待期限やCookieを確認してください。")}
    }catch{setGame(null);setMessage("サーバーに接続できませんでした。")}
   }else {setGame(null);setMessage(error==="session_missing"?"この端末の参加セッションが見つかりません。":error==="session_not_approved_or_expired"?"GMの承認待ち、または試合終了・期限切れです。":error);}
  }finally{setBusy(false)}
 }
 async function act(action:"vote"|"question",value:string|number){
  if(busy)return;
  setBusy(true);setMessage("");
  try{
   const result=await api(action,action==="vote"?{targetId:value}:{questionId:value});
   if(result.ok!==true)throw Error("既に操作済みか、受付を終了しています。");
   const updated=await api("state");setGame(updated.game as Game);
   setShowSecret(false);
  }catch(e){setMessage(e instanceof Error?e.message:"操作できませんでした")}
  finally{setBusy(false)}
 }
 useEffect(()=>{void refresh()},[]);
 useEffect(()=>{
  const timer=setInterval(()=>{
   if(document.visibilityState!=="visible"||phaseRef.current==="reveal")return;
   void api("state").then(value=>{
    if(!value.game||typeof value.game.phase!=="string")return;
    if(phaseRef.current!==null&&phaseRef.current!==value.game.phase)setShowSecret(false);
    phaseRef.current=value.game.phase;
    setGame(value.game as Game);
   }).catch(()=>{}); // A transient polling error never clears valid session information.
  },10000);
  return ()=>clearInterval(timer);
 },[]);
 useEffect(()=>{
  const hide=()=>setShowSecret(false);
  const visibility=()=>{if(document.hidden)hide()};
  document.addEventListener("visibilitychange",visibility);window.addEventListener("blur",hide);
  return ()=>{document.removeEventListener("visibilitychange",visibility);window.removeEventListener("blur",hide)};
 },[]);
 const players=Array.isArray(game?.players)?game.players:[];
 const questions=Array.isArray(game?.questions)?game.questions:[];
 const runoff=Array.isArray(game?.runoffIds)?game.runoffIds:[];
 const candidates=players.filter(x=>x.id!==game?.myId&&(runoff.length===0||runoff.includes(x.id)));
 const myQuestions=questions.filter(x=>x.playerId===game?.myId).map(x=>x.id);
 return <main className="mx-auto max-w-xl space-y-5 px-4 py-8">
  <h1 className="text-3xl font-black text-lime-950">🦊 ゾロアークを探せ！</h1>
  <p className="text-sm text-slate-600">自分のスマホで参加するゲームルーム。CAログインは不要です。</p>
  <section className="space-y-3 rounded-2xl border border-lime-200 bg-white p-5">
   <div className="flex items-center justify-between gap-2">
    <h2 className="text-xl font-bold">{game?.myName??game?.nickname??"ゲスト参加"}</h2>
    <button type="button" disabled={busy} onClick={()=>{setShowSecret(false);void refresh()}}
     className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-bold disabled:opacity-50">↻ 最新情報</button>
   </div>
   {message&&<p role="status" className="rounded-lg bg-amber-50 p-3 text-sm">{message}</p>}
   {!game&&<p className="text-sm text-slate-500">参加済みのブラウザから開いてください。</p>}
   {game?.phase==="lobby"&&<p className="rounded-xl bg-lime-50 p-4 font-bold">
    {game.state==="approved"?"✅ GM承認済み。試合開始をお待ちください。":game.state==="pending"?"⌛ GMの参加承認をお待ちください。":"試合の準備中です。"}
   </p>}
   {game&&game.phase!=="lobby"&&<>
    <p className="font-bold">状態：{game.phase==="talk"?"🎤 会話・質問":game.phase==="vote"?"🗳️ 投票": "🎉 結果発表"}</p>
    <div className="rounded-2xl bg-slate-900 p-5 text-center text-white">
     {!showSecret?<><div className="text-4xl">🔒</div><p className="mt-3 font-bold">他の人に見えないように、自分だけで開いてください。</p>
      <button type="button" onClick={()=>setShowSecret(true)} className="mt-4 rounded-xl bg-lime-400 px-5 py-3 font-black text-slate-900">自分の役職・お題を見る</button>
     </>:<>
      <p className="text-sm">あなたの秘密のお題</p>
      <p className="mt-2 break-words text-3xl font-black">{game.prompt}</p>
      <p className="mt-4 text-xl font-black">{roleName(game.role)}</p>
      <button type="button" onClick={()=>setShowSecret(false)} className="mt-4 rounded-xl bg-white px-5 py-3 font-bold text-slate-900">🔒 お題と役職を隠す</button>
     </>}
    </div>
   </>}
  </section>
  {game?.phase==="talk"&&<section className="space-y-3 rounded-2xl border bg-white p-5">
   <h2 className="text-xl font-black">🍂 質問カード</h2>
   <p className="text-sm text-slate-600">自分が使えるのは最大5回。質問すると全員に内容が公開されます。</p>
   <select className="w-full rounded-xl border p-3" aria-label="質問を選ぶ" value={questionId}
    onChange={e=>setQuestionId(Number(e.target.value))}>
    {topics.map((q,i)=><option key={i} value={i} disabled={myQuestions.includes(i)}>{q}</option>)}
   </select>
   <button type="button" disabled={busy||myQuestions.length>=5||myQuestions.includes(questionId)}
    onClick={()=>void act("question",questionId)}
    className="w-full rounded-xl bg-amber-200 p-3 font-black disabled:opacity-40">質問する ({myQuestions.length}/5回使用)</button>
  </section>}
  {game?.phase==="vote"&&<section className="space-y-3 rounded-2xl border bg-white p-5">
   <h2 className="text-xl font-black">🗳️ {Number(game.voteRound)>1?"決選投票":"ゾロアークを選ぼう"}</h2>
   <p className="text-sm">1人1票。投票後は取り消しできません。自分には投票できません。</p>
   {game.voted?<p className="rounded-xl bg-lime-50 p-4 font-bold">✅ 投票済み。集計をお待ちください。</p>:
    candidates.length?<div className="grid grid-cols-2 gap-2">{candidates.map(p=><button key={p.id} type="button" disabled={busy}
     onClick={()=>{if(window.confirm(p.name+"さんに投票しますか？"))void act("vote",p.id)}}
     className="min-h-14 rounded-xl border bg-lime-100 p-3 font-bold">{p.number}番 {p.name}</button>)}</div>:
    <p className="text-red-700">投票候補がありません。GMへお知らせください。</p>}
  </section>}
  {game?.phase==="reveal"&&<section className="space-y-3 rounded-2xl border bg-lime-200 p-5">
   <h2 className="text-2xl font-black">{winnerName(game.winner)}</h2>
   <p className="text-sm">投票対象：{players.find(p=>p.id===game.selectedGuest)?.name??"不明"}</p>
   <p className="text-sm">結果発表後のみ全員の役職とお題を表示します。</p>
   {players.map(p=><div key={p.id} className="rounded-lg bg-white p-3">
    <p className="font-bold">{p.number}番 {p.name}：{roleName(p.role)}</p><p className="text-sm">お題：{p.prompt??"非公開"}</p>
   </div>)}
  </section>}
  {game&&game.phase!=="lobby"&&<section className="space-y-3 rounded-2xl border bg-white p-5">
   <h2 className="text-xl font-black">📣 質問履歴</h2>
   {questions.length===0?<p className="text-sm text-slate-500">まだ質問はありません。</p>:
    questions.slice(-6).map((q,i)=><p key={i} className="border-b pb-2 text-sm">
     {players.find(p=>p.id===q.playerId)?.name??"参加者"}：{topics[q.id]??"質問"}</p>)}
  </section>}
 </main>;
}
