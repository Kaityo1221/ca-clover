"use client";
import {useEffect,useState} from "react";
import {useAuthProfile} from "@/lib/use-auth-profile";
type Player={id:string;name:string;number:number;role?:string;prompt?:string};
type Game={phase:"lobby"|"talk"|"vote"|"reveal";players:Player[];voted?:number;voteRound?:number;
 questions?:Array<{id:number;playerId:string}>;winner?:string;selectedGuest?:string;};
const topics=["見た目で特徴的なのは？","どこで出会えそう？","相棒にするなら？","進化はする？",
 "どんな技が強そう？","Pokémon GOではどう？","初めて見た印象は？","一言で説明すると？",
 "何が得意そう？","自慢したいところは？","どんな鳴き声？","似ているポケモンは？"];
const role=(r?:string)=>r==="zoroark"?"ゾロアーク":r==="mimikyu"?"ミミッキュ":r==="villager"?"村人":"未公開";
const outcome=(w?:string)=>w==="villagers"?"村人の勝利":w==="zoroark"?"ゾロアークの勝利":w==="mimikyu"?"ミミッキュの勝利":"判定中";
export function GmGameControls({roomId,mode,approved,pending,onFinish}:{
 roomId:string;mode:"simple"|"manual";approved:number;pending:number;onFinish:()=>void
}){
 const {supabase}=useAuthProfile();
 const [game,setGame]=useState<Game|null>(null),[difficulty,setDifficulty]=useState("all");
 const [mimikyu,setMimikyu]=useState(mode==="manual"),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
 async function invoke(action:"status"|"start"|"vote"|"tally"|"finish"){
  const {data}=await supabase.auth.getSession();
  if(!data.session?.access_token)throw Error("CAとして再ログインしてください。");
  const response=await fetch("/api/zoroark/game/gm",{method:"POST",cache:"no-store",
   headers:{"Content-Type":"application/json","X-Zoroark-Request":"game-v1",
     Authorization:"Bearer "+data.session.access_token},
   body:JSON.stringify({action,roomId,...(action==="start"?{difficulty,enableMimikyu:mode==="manual"&&mimikyu}:{})})});
  const result=await response.json().catch(()=>({error:"不正な応答"}));
  if(!response.ok)throw Error(String(result.error??"処理に失敗しました"));
  return result;
 }
 async function run(action:"status"|"start"|"vote"|"tally"|"finish"){
  if(busy)return;
  setBusy(true);setMessage("");
  try{
   const answer=await invoke(action);
   if(action==="finish"){if(answer.ok!==true)throw Error("ルームを終了できません");onFinish();return}
   if(action==="start"&&answer.ok!==true)throw Error("試合を開始できません");
   const state=await invoke("status");
   setGame(state.game as Game);
   if(answer.phase==="runoff")setMessage("同票です。候補者だけで再投票を行います。");
   else if(action==="start")setMessage("試合を開始しました。各参加者は自分の画面を更新してください。");
  }catch(e){
   const raw=e instanceof Error?e.message:"操作できませんでした";
   const text:Record<string,string>={game_not_enabled:"ゲーム本編は隔離検証中です。現在の入室・承認はそのまま利用できます。",
    roster_not_ready:"承認済み3人以上、承認待ち0人にしてください。",
    votes_incomplete:"全員の投票が揃っていません。",
    canonical_round_unavailable:"正式なお題の取得に失敗しました。再度お試しください。",
    canonical_round_invalid:"正式なお題の形式が不正です。",
    game_service_unavailable:"ゲームサーバーに接続できません。"};
   setMessage(text[raw]??raw);
  }finally{setBusy(false)}
 }
 useEffect(()=>{void run("status")},[]);
 const players=Array.isArray(game?.players)?game.players:[];
 const questions=Array.isArray(game?.questions)?game.questions:[];
 const ready=approved>=3&&pending===0;
 return <section className="mt-5 space-y-3 rounded-xl border border-indigo-200 bg-indigo-50 p-4">
  <div className="flex items-center justify-between gap-2">
   <h3 className="text-lg font-black">🎭 QRルームゲーム進行（隔離版）</h3>
   <button type="button" disabled={busy} onClick={()=>void run("status")}
    className="rounded-lg bg-white px-3 py-2 text-sm font-bold">更新</button>
  </div>
  <p className="text-xs text-indigo-900">試合開始・投票・集計はCA主催者だけが操作します。進行するまで役職は公開されません。</p>
  {!game||game.phase==="lobby"?<>
   <p className="text-sm">承認済み {approved}人・承認待ち {pending}人。3人以上かつ承認待ち0人で開始できます。</p>
   <label className="block text-sm font-bold">お題の難易度</label>
   <select value={difficulty} onChange={e=>setDifficulty(e.target.value)} className="w-full rounded-lg border p-3">
    <option value="all">おまかせ（正式42組）</option><option value="easy">初級</option>
    <option value="normal">中級</option><option value="hard">上級</option>
   </select>
   {mode==="manual"&&<label className="flex items-center gap-2 text-sm font-bold">
    <input type="checkbox" checked={mimikyu} onChange={e=>setMimikyu(e.target.checked)}/>👻 ミミッキュを追加（4人以上）
   </label>}
   <button type="button" disabled={busy||!ready||(mimikyu&&approved<4)} onClick={()=>{
    if(window.confirm("全員の承認が終わりましたか？開始後は参加者とお題を変更できません。"))void run("start");
   }} className="w-full rounded-lg bg-indigo-500 p-3 font-black text-white disabled:opacity-40">🎮 試合を開始する</button>
  </>:<>
   <p className="font-bold">フェーズ：{game.phase==="talk"?"🎤 会話中":game.phase==="vote"?"🗳️ 投票中":"🎉 結果発表"}</p>
   <p className="text-sm">参加 {players.length}人{game.phase==="vote"?"・投票済み "+(game.voted??0)+"人・第"+(game.voteRound??1)+"回":""}</p>
   {game.phase==="talk"&&<button type="button" disabled={busy}
    onClick={()=>{if(window.confirm("会話を終了し投票を始めますか？"))void run("vote")}}
    className="w-full rounded-lg bg-amber-300 p-3 font-black">🗳️ 投票を開始する</button>}
   {game.phase==="vote"&&<button type="button" disabled={busy||Number(game.voted)<players.length}
    onClick={()=>void run("tally")} className="w-full rounded-lg bg-amber-300 p-3 font-black disabled:opacity-40">
    {Number(game.voted)<players.length?"全員の投票を待っています":"📊 投票を集計する"}</button>}
   {game.phase==="reveal"&&<>
    <p className="rounded-lg bg-white p-4 text-xl font-black">🏆 {outcome(game.winner)}</p>
    <p className="text-sm">選ばれた参加者：{players.find(p=>p.id===game.selectedGuest)?.name??"不明"}</p>
    {players.map(p=><div key={p.id} className="rounded-lg bg-white p-3 text-sm">
     <strong>{p.number}番 {p.name}：{role(p.role)}</strong><p>お題：{p.prompt}</p>
    </div>)}
   </>}
   <h4 className="font-bold">📣 公開質問</h4>
   {questions.length===0?<p className="text-sm">まだ質問はありません。</p>:
    questions.slice(-6).map((q,i)=><p key={i} className="rounded bg-white p-2 text-sm">
     {players.find(p=>p.id===q.playerId)?.name??"参加者"}：{topics[q.id]??"質問"}</p>)}
   <button type="button" disabled={busy} onClick={()=>{
     if(window.confirm("この試合を終了しますか？参加者のセッションは使えなくなります。"))void run("finish");
   }} className="w-full rounded-lg bg-rose-100 p-3 font-bold">ルームを終了</button>
  </>}
  {message&&<p role="status" className="rounded-lg bg-white p-3 text-sm text-red-800">{message}</p>}
 </section>;
}
