// CA Clover Pages mini game. Authorization is enforced ONLY by the Vercel API.
// This UI never stores a bearer token and receives only a granted round.
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const ZOROARK_QA_ROOM_URL="https://ca-clover-4h7xyw0fg-kaityo1222.vercel.app/zoroark/rooms"; // Preview lobby only. No tokens.
const topics=["見た目で特徴的なのは？","どこで出会えそう？","相棒にするなら？","進化はする？","どんな技が強そう？","Pokémon GOではどう？","初めて見た印象は？","一言で説明すると？","何が得意そう？","自慢したいところは？","どんな鳴き声？","似ているポケモンは？"];
// Role visibility is intentionally limited to manual mode. The basic word-wolf mode hides roles.
export function zoroarkRoleInfo(gameMode, playerIndex, wolfIndex, mimikyuIndex=-1){
 if(gameMode!=="manual")return null;
 if(playerIndex===wolfIndex)return {icon:"🦊",name:"ゾロアーク",description:"あなたは少数派。正体を隠して投票を切り抜けよう。"};
 if(mimikyuIndex>=0&&playerIndex===mimikyuIndex)return {icon:"👻",name:"ミミッキュ",description:"ゾロアークと間違われたら単独勝利！"};
 return {icon:"👥",name:"村人",description:"あなたは多数派。会話からゾロアークを見つけよう。"};
}

/**
 * Calculate the outcome from counted ballots. Indexes are zero-based.
 * Tied top vote counts require another vote among the tied candidates.
 * This function does not reveal roles until the result phase.
 */
export function judgeZoroarkVotes({counts,gameMode,wolfIndex,mimikyuIndex=-1,eligibleCandidates=null,voterCount}){
 if(!Array.isArray(counts)||counts.length<3||!Number.isInteger(voterCount)||voterCount!==counts.length||
    !Number.isInteger(wolfIndex)||wolfIndex<0||wolfIndex>=counts.length||
    !Number.isInteger(mimikyuIndex)||mimikyuIndex< -1||mimikyuIndex>=counts.length||mimikyuIndex===wolfIndex||
    !counts.every(n=>Number.isInteger(n)&&n>=0))return {status:"invalid"};
 const eligible=eligibleCandidates===null?counts.map((_,i)=>i):eligibleCandidates;
 if(!Array.isArray(eligible)||eligible.length<1||new Set(eligible).size!==eligible.length||
    !eligible.every(i=>Number.isInteger(i)&&i>=0&&i<counts.length)||
    counts.some((n,i)=>n>0&&!eligible.includes(i)))return {status:"invalid"};
 const total=counts.reduce((sum,n)=>sum+n,0);
 if(total>voterCount)return {status:"invalid"};
 if(total<voterCount)return {status:"incomplete",remaining:voterCount-total};
 const maximum=Math.max(...eligible.map(i=>counts[i]));
 const leaders=eligible.filter(i=>counts[i]===maximum);
 if(leaders.length>1)return {status:"runoff",candidates:leaders};
 const selectedIndex=leaders[0];
 const specialMimikyu=gameMode==="manual"&&mimikyuIndex>=0;
 if(specialMimikyu&&selectedIndex===mimikyuIndex){
   return {status:"winner",winner:"mimikyu",selectedIndex,points:{villagers:0,zoroark:0,mimikyu:5}};
 }
 if(selectedIndex===wolfIndex){
   return {status:"winner",winner:"villagers",selectedIndex,points:gameMode==="manual"?{villagers:1,zoroark:0,mimikyu:specialMimikyu?1:0}:null};
 }
 return {status:"winner",winner:"zoroark",selectedIndex,points:gameMode==="manual"?{villagers:0,zoroark:2,mimikyu:0}:null};
}
// This is an aggregate-only, single-device game state. No giver-to-recipient history is retained.
export function suspicionLeaders(totals){
 if(!Array.isArray(totals)||!totals.length||!totals.every(v=>Number.isInteger(v)&&v>=0))return [];
 const top=Math.max(...totals);
 return top===0?[]:totals.map((v,i)=>v===top?i:-1).filter(i=>i>=0);
}
const styles=[
".zg{max-width:720px;margin:auto}.zg-head{display:flex;align-items:center;gap:12px;flex-wrap:wrap}.zg-panel{margin-top:16px;background:#fff;border:1px solid #d9f99d;border-radius:24px;padding:20px;box-shadow:0 12px 26px #36531412}",
".zg-label{display:block;margin:18px 0 7px;font-size:13px;font-weight:900;color:#365314}.zg-select{display:block;width:100%;min-height:47px;border:1px solid #d9f99d;border-radius:12px;background:#fff;color:#1f2937;padding:10px;font-size:16px}",
".zg-controls{display:flex;align-items:center;justify-content:center;gap:16px;margin:16px 0}.zg-controls strong{min-width:45px;text-align:center;font-size:32px}.zg-controls button{width:54px;height:46px}",
".zg .zg-btn{display:inline-flex;justify-content:center;align-items:center;min-height:48px;padding:12px 16px;border:0;border-radius:15px;background:#84cc16;color:#1a2e05;font-weight:950;font-size:15px}.zg .zg-btn.secondary{background:#f7fee7;border:1px solid #d9f99d;color:#365314}.zg-btn[disabled]{opacity:.5}",
".zg-full{width:100%;margin-top:12px}.zg-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin-top:12px}.zg-hint{margin:12px 0;padding:12px;border:1px solid #d9f99d;border-radius:13px;background:#f7fee7;color:#365314;font-size:13px;font-weight:750;line-height:1.7}",
".zg-role-reveal{margin-top:4px;width:100%;max-width:360px;padding:14px;border-radius:15px;border:1px solid #a8b9d6;background:#233a55;text-align:center;line-height:1.55}.zg-role-reveal .zg-role-title{display:block;font-size:13px;font-weight:850;color:#dbeafe}.zg-role-reveal .zg-role-name{display:block;font-size:25px;font-weight:950;margin:4px 0;color:#fff}.zg-role-reveal .zg-role-desc{font-size:14px;color:#e2e8f0}",
 ".zg-question-overlay{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:max(18px,env(safe-area-inset-top)) max(16px,env(safe-area-inset-right)) max(18px,env(safe-area-inset-bottom)) max(16px,env(safe-area-inset-left));background:rgba(16,31,25,.82);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}.zg-question-modal{box-sizing:border-box;width:min(100%,560px);max-height:calc(100dvh - 44px);overflow-y:auto;border:3px solid #f5c363;border-radius:26px;padding:clamp(20px,5vw,38px);background:#fffbeb;color:#493015;text-align:center;box-shadow:0 24px 60px #0008;animation:zg-question-pop .45s ease-out}.zg-question-modal .zg-question-title{font-size:clamp(24px,6vw,35px);line-height:1.4;font-weight:950}.zg-question-modal .zg-question-person{margin:18px 0 6px;font-size:clamp(16px,4vw,21px);font-weight:850}.zg-question-modal .zg-question-text{font-size:clamp(23px,6vw,36px);line-height:1.5;font-weight:950;overflow-wrap:anywhere;padding:16px 0}.zg-question-modal .zg-question-note{font-size:14px;font-weight:800;color:#78551b}.zg-question-overlay .zg-btn{margin-top:18px;min-width:170px}.zg-question-choice{display:block;width:100%;text-align:left;margin:9px 0;padding:15px;border:1px solid #d9f99d;border-radius:13px;background:#f7fee7;color:#365314;font-weight:800;cursor:pointer;line-height:1.5}.zg-question-banner{margin:14px 0;padding:18px;border:2px solid #eab85e;border-radius:16px;background:#fffbeb;color:#6b450d;text-align:center;animation:zg-question-pop .5s ease-out}.zg-question-banner strong{font-size:20px}.zg-question-history{border-bottom:1px solid #d9f99d;padding:8px 2px;color:#365314;font-size:14px}.zg-card-leaf{display:inline-block;animation:zg-leaf-fall 1.3s ease-in-out}.zg-question-help{margin:12px 0;font-size:13px;color:#365314}@keyframes zg-question-pop{from{opacity:0;transform:translateY(-24px)}to{opacity:1;transform:none}}@keyframes zg-leaf-fall{from{transform:translate(-15px,-18px) rotate(-40deg);opacity:.25}to{transform:translate(0,0) rotate(25deg);opacity:1}}@media(prefers-reduced-motion:reduce){.zg-question-banner,.zg-card-leaf{animation:none}}",
 ".zg-secret{min-height:215px;margin:16px 0;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:14px;border-radius:22px;background:#162438;color:white;padding:20px;text-align:center}.zg-secret strong{font-size:clamp(23px,7vw,35px)}",
".zg-timer{text-align:center;font-size:clamp(45px,13vw,68px);font-weight:950;color:#365314;font-variant-numeric:tabular-nums;margin:20px 0}.zg-votes{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:18px 0}",
".zg-medal-circle{display:inline-flex;align-items:center;justify-content:center;width:38px;height:38px;border-radius:50%;border:3px ridge #e9c879;background:radial-gradient(circle at 30% 24%,#fff7c3,#d9b36a 45%,#956427 90%);box-shadow:inset 0 2px 3px #fff9,0 3px 9px #0002;color:#6a4512;font-weight:950;font-size:21px}.zg-medal-large{width:62px;height:62px;font-size:30px}.zg-medal-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;margin:18px 0}.zg-medal-grid button{min-height:69px}.zg-medal-warning{padding:14px;border:1px solid #dab46a;background:#fff7e1;border-radius:14px;font-weight:850;color:#754a13}.zg-medal-row{margin:9px 0;padding:12px;border:1px solid #ead5a5;background:#fffaf0;border-radius:15px;display:flex;align-items:center;justify-content:space-between;gap:9px}.zg-medal-row.zg-wolf{border-color:#d48793;background:#fff2f2}.zg-medal-stack{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:3px;max-width:65%}.zg-medal-stack .zg-medal-circle{width:24px;height:24px;font-size:14px;border-width:2px;animation:zg-medal-drop .45s both}.zg-suspicion-popup{position:fixed;inset:0;z-index:2147483001;display:flex;justify-content:center;align-items:center;padding:18px;background:#101c2bdd;backdrop-filter:blur(5px)}.zg-suspicion-popup article{max-width:560px;width:100%;background:#fffbeb;border:3px solid #d8b068;border-radius:24px;padding:25px;text-align:center;color:#4d3512}.zg-suspicion-popup h2{font-size:clamp(24px,7vw,35px)}@keyframes zg-medal-drop{from{opacity:0;transform:translateY(-30px) rotate(-18deg)}to{opacity:1;transform:translateY(0) rotate(0)}}@media(prefers-reduced-motion:reduce){.zg-medal-stack .zg-medal-circle{animation:none}}",
 ".zg-tally-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:16px 0}.zg-tally-item{padding:12px;border:1px solid #d9f99d;border-radius:13px;background:#f7fee7}.zg-tally-item strong{font-size:18px}.zg-tally-buttons{display:flex;justify-content:space-between;align-items:center;gap:6px;margin-top:10px}.zg-tally-buttons .zg-btn{min-width:42px;min-height:40px}.zg-tally-count{font-variant-numeric:tabular-nums;font-size:24px;font-weight:950;color:#365314}.zg-vote-progress{margin:12px 0;padding:10px 13px;border-radius:12px;background:#ecfccb;color:#365314;font-weight:900}.zg-result-winner{padding:12px 14px;background:#f7fee7;border:1px solid #d9f99d;border-radius:14px;text-align:center;color:#365314;font-weight:900}",
 ".zg-votes button{min-height:54px;border:1px solid #d9f99d;border-radius:13px;background:#fff;color:#365314;font-weight:950;font-size:16px}.zg-votes button[aria-pressed=true]{background:#84cc16;border-color:#65a30d}",
".zg-mode-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:20px 0}.zg-mode-card{display:flex;flex-direction:column;gap:10px;align-items:flex-start;min-height:175px;padding:20px;border-radius:20px;border:2px solid #bef264;background:#f7fee7;color:#365314;text-align:left;cursor:pointer}.zg-mode-card.manual{border-color:#fed7aa;background:#fff7ed}.zg-mode-card .mode-icon{font-size:32px}.zg-mode-card strong{font-size:20px}.zg-mode-card .mode-desc{font-size:13px;line-height:1.6;font-weight:700}.zg-role-option{display:flex;gap:10px;align-items:center;border:1px solid #d9f99d;border-radius:14px;padding:14px;margin-top:10px;font-weight:800}.zg-role-option input{width:20px;height:20px;accent-color:#65a30d}",
 ".zg-reveal{margin:15px 0;padding:30px 12px;border-radius:22px;text-align:center;color:white;background:radial-gradient(circle at 50% 30%,#7653a9,#241837 68%)}.zg-reveal .zg-fox{font-size:70px;animation:zg-pop .55s ease-out both}.zg-winner{font-size:22px;font-weight:950;text-align:center;color:#365314}",
"@keyframes zg-pop{from{opacity:0;transform:translateY(20px) scale(.7)}to{opacity:1;transform:none}}@media(prefers-reduced-motion:reduce){.zg-reveal .zg-fox{animation:none}}@media(max-width:450px){.zg-panel{padding:15px}.zg-grid{gap:7px}.zg .zg-btn{font-size:13px;padding:10px 8px}.zg-mode-grid{grid-template-columns:1fr}.zg-mode-card{min-height:116px;padding:15px}.zg-mode-card strong{font-size:18px}}"
].join("");
function ensureStyle(){
 if(document.getElementById("zoroark-pages-v1-style"))return;
 const el=document.createElement("style");el.id="zoroark-pages-v1-style";el.textContent=styles;document.head.appendChild(el);
}
function fmt(sec){const v=Math.max(0,Math.ceil(sec));return String(Math.floor(v/60)).padStart(2,"0")+":"+String(v%60).padStart(2,"0")}
function recentLoad(){try{const v=JSON.parse(sessionStorage.getItem("ca-zoroark-recent-v3")||"[]");return Array.isArray(v)?v.filter(x=>typeof x==="string"&&/^[a-z][0-9]{2}$/.test(x)).slice(-6):[]}catch{return []}}
function recentSave(history){try{sessionStorage.setItem("ca-zoroark-recent-v3",JSON.stringify(history.slice(-6)))}catch{}}
export function mountZoroark({host,gateway,onBack}){
 if(!host||!gateway||typeof gateway.newRound!=="function")throw Error("GM権限を確認できません");
 ensureStyle();
 let destroyed=false,phase="play-style",playStyle=null,gameMode=null,enableMimikyu=true,mimikyuIndex=-1,count=6,level="all",duration=180,mode="free",round=null,player=0,visible=false,
  remaining=duration,running=false,deadline=0,topic=0,talkRound=1,vote=0,voteCounts=[],voteFinalists=null,voteRound=1,voteDecision=null,reveal=false,roundNo=0,
  busy=false,error="",history=recentLoad(),questionHands=[],questionUsed=[],cardPlayer=-1,cardCooldownUntil=0,cardAnnouncement=null,cardAnnouncementUntil=0,cardWasRunning=false,medalTotals=[],medalUsed=[],medalActor=-1,medalTarget=-1,medalWasRunning=false,midpointFired=false,midpointUntil=0,midpointNotice=null,talkElapsedMs=0,talkResumeAt=0;
 const panel=()=>'<div class="zg"><section class="card hero"><div class="zg-head"><button data-act="back" type="button" class="zg-btn secondary">← My Communityへ戻る</button><span class="pill">🦊 CA専用GM</span></div><h1 style="margin-top:13px">🎭 ゾロアークを探せ！</h1><p class="muted strong">対面かリモートを選んでから、ゲームモードを決めよう。</p></section><section class="zg-panel">'+body()+'</section>'+questionOverlay()+midpointOverlay()+'</div>';
 function action(text,id,other=false,disabled=false){return '<button type="button" data-act="'+id+'" class="zg-btn'+(other?' secondary':'')+' zg-full"'+(disabled?' disabled':'')+'>'+text+'</button>'}
 function questionOverlay(){
  if(phase!=="talk"||!cardAnnouncement||Date.now()>=cardAnnouncementUntil)return '';
  const announcement=cardAnnouncement;
  return '<div class="zg-question-overlay" role="presentation"><div class="zg-question-modal" role="dialog" aria-modal="true" aria-labelledby="zg-question-title" aria-describedby="zg-question-text">'+
   '<div id="zg-question-title" class="zg-question-title">🍂 🎤 トークタイム！</div>'+
   '<div class="zg-question-person">プレイヤー'+(announcement.owner+1)+'番からの質問</div>'+
   '<div id="zg-question-text" class="zg-question-text">'+esc(announcement.text)+'</div>'+
   '<div class="zg-question-note">10秒間表示</div>'+
   action('会話に戻る',"closeQuestionOverlay",true)+'</div></div>';
 }
 function privatePrompt(){
   const info=zoroarkRoleInfo(gameMode,player,round.wolf,mimikyuIndex);
   return '<span>あなたの秘密のお題</span><strong>'+esc(round.prompts[player])+'</strong>'+
     (info?'<div class="zg-role-reveal"><span class="zg-role-title">🎭 あなたの役職</span><span class="zg-role-name">'+esc(info.icon)+' '+esc(info.name)+'</span><span class="zg-role-desc">'+esc(info.description)+'</span></div>':'<span>名前は話さないでね</span>');
 }


 function drawQuestion(){
   const bytes=new Uint32Array(1);
   crypto.getRandomValues(bytes);
   return bytes[0]%topics.length;
 }
 function cardScreen(){
   if(phase==="card-owner")return '<span class="pill">🍂 質問カード</span><h2>誰がカードを使う？</h2><p class="zg-question-help">本人の番号を選んで端末を渡してください。手札は他の参加者に見せないでね。</p><div class="zg-votes">'+Array.from({length:count},(_,i)=>'<button type="button" data-act="cardOwner:'+i+'">'+(i+1)+'番</button>').join("")+'</div>'+action('会話に戻る',"cardClose",true);
   if(phase==="card-handoff")return '<span class="pill">🔒 秘密の手札</span><h2>プレイヤー'+(cardPlayer+1)+'番</h2><div class="zg-secret"><strong>本人だけが開いてね</strong><span>他の人にカードを見せないようにしましょう</span></div>'+action('手札を確認する',"cardOpen")+action('使わずに戻る',"cardClose",true);
   if(phase==="card-private")return '<span class="pill">🍂 質問カード</span><h2>プレイヤー'+(cardPlayer+1)+'番の手札</h2><p class="zg-question-help">カードは5枚。使うと全員に使用者と質問が公開されます。</p>'+
     questionHands[cardPlayer].map((id,i)=>'<button type="button" class="zg-question-choice" data-act="cardUse:'+i+'">'+esc(topics[id])+'</button>').join("")+
     action('使わずに戻る',"cardClose",true);
   return '';
 }
 function closeCards(){
   if(cardWasRunning)resumeTalk()
   cardWasRunning=false;cardPlayer=-1;phase="talk";render();
 }

 function tickTalk(now=Date.now()){if(running&&talkResumeAt){talkElapsedMs+=Math.max(0,now-talkResumeAt);talkResumeAt=now}}
 function pauseTalk(){tickTalk();running=false;talkResumeAt=0}
 function resumeTalk(){if(duration>0&&remaining>0){running=true;deadline=Date.now()+remaining*1000;talkResumeAt=Date.now()}}
 function midpointOverlay(){
  if(phase!=="talk"||!midpointNotice||Date.now()>=midpointUntil)return '';
  return '<div class="zg-suspicion-popup"><article role="dialog" aria-modal="true"><span class="zg-medal-circle zg-medal-large">?</span><h2>📣 疑惑速報！</h2><p style="font-size:23px;font-weight:950">'+esc(midpointNotice)+'</p><p>投票者・獲得枚数は秘密</p>'+action('会話に戻る',"closeMidpoint",true)+'</article></div>';
 }
 function medalScreen(){
  if(phase==="medal-owner")return '<span class="pill">🪙 疑惑メダル</span><h2>誰が投げる？</h2><p class="zg-medal-warning">1人3枚。本人だけが投票先を確認してください。</p><div class="zg-medal-grid">'+Array.from({length:count},(_,i)=>'<button type="button" class="zg-btn secondary" data-act="medalActor:'+i+'">'+(i+1)+'番</button>').join("")+'</div>'+action('会話に戻る',"medalClose",true);
  if(phase==="medal-handoff")return '<span class="pill">🔒 非公開操作</span><h2>プレイヤー'+(medalActor+1)+'番</h2><div class="zg-secret"><strong>本人だけが開いてね</strong><span>ほかの人には見せないでください</span></div>'+action('メダルを確認する',"medalOpen")+action('投げずに戻る',"medalClose",true);
  if(phase==="medal-private")return '<span class="pill">🪙 疑惑メダル</span><h2>プレイヤー'+(medalActor+1)+'番</h2><p class="zg-medal-warning">残り '+(3-medalUsed[medalActor])+' / 3枚。同じ相手に複数枚投げてもOK！</p>'+(medalUsed[medalActor]===3?'<p>すべて使用しました。</p>':'<p>怪しい相手を選んでください</p><div class="zg-medal-grid">'+Array.from({length:count},(_,i)=>i===medalActor?'':'<button type="button" class="zg-btn secondary" data-act="medalTarget:'+i+'">'+(i+1)+'番</button>').join("")+'</div>')+action('画面を隠して戻る',"medalClose",true);
  if(phase==="medal-confirm")return '<span class="pill">⚠️ 最終確認</span><h2>メダルを投げる？</h2><div class="zg-medal-warning" style="font-size:22px;text-align:center">🪙 '+(medalTarget+1)+'番へ1枚<br>確定後は取消・変更できません！</div>'+action('確定して投げる',"medalCommit")+action('キャンセル',"medalCancel",true);
  if(phase==="medal-done")return '<span class="pill">🪙 投票完了</span><h2>メダルを投げました</h2><div class="zg-secret"><strong>投票先は非公開</strong><span>画面を伏せてGMに返してください。</span></div>'+action('画面を隠して会話へ',"medalClose");
  return '';
 }
 function medalsResult(){
  const sorted=medalTotals.map((total,i)=>({i,total})).sort((a,b)=>b.total-a.total||a.i-b.i);
  const leaders=suspicionLeaders(medalTotals);
  return '<span class="pill">🪙 結果 2/2</span><h2>疑惑メダル集計</h2><p>投票者・投票先の組み合わせは非公開。合計枚数のみ公開します。</p>'+
   sorted.map((item,rank)=>'<div class="zg-medal-row'+(item.i===round.wolf?' zg-wolf':'')+'"><div><strong>'+(item.i+1)+'番 '+(item.i===round.wolf?'🦊':'')+'</strong><div style="font-size:12px">'+(leaders.includes(item.i)?'最多疑惑！':'')+'</div></div><div><strong>'+item.total+'枚</strong><div class="zg-medal-stack">'+Array.from({length:item.total},(_,j)=>'<span class="zg-medal-circle" style="animation-delay:'+Math.min(j*90+rank*65,1400)+'ms">?</span>').join("")+'</div></div></div>').join("")+
   action('← 正体発表へ戻る',"backResults",true)+action('次のゲームへ',"start")+action('人数設定へ戻る',"reset",true);
 }
 function voteView(){
  const total=voteCounts.reduce((sum,n)=>sum+n,0);
  const ready=total===count;
  const allowed=voteFinalists===null?Array.from({length:count},(_,i)=>i):voteFinalists;
  return '<span class="pill">🗳️ '+(voteRound===1?'最終投票':'決選投票 '+voteRound+'回目')+'</span>'+
   '<h2>ゾロアークは誰だ？</h2><p>GMが指差し投票の票数を入力します。プレイヤー全員が各1票、GMは投票しません。</p>'+
   (voteRound>1?'<div class="zg-hint">同数最多だった参加者だけで決選投票します。前回の票数は引き継ぎません。</div>':'')+
   '<div class="zg-tally-grid">'+allowed.map(i=>'<div class="zg-tally-item"><strong>'+(i+1)+'番</strong><div class="zg-tally-buttons"><button type="button" data-act="subtractVote:'+i+'" class="zg-btn secondary" aria-label="'+(i+1)+'番を1票減らす"'+(voteCounts[i]===0?' disabled':'')+'>−</button><span class="zg-tally-count">'+voteCounts[i]+'</span><button type="button" data-act="addVote:'+i+'" class="zg-btn secondary" aria-label="'+(i+1)+'番を1票増やす"'+(total>=count?' disabled':'')+'>＋</button></div></div>').join("")+'</div>'+
   '<div class="zg-vote-progress">入力済み '+total+' / '+count+'票'+(ready?' ✓':'')+'</div>'+
   (voteRound===1?'<div class="zg-hint">最多得票が同数なら、自動で決選投票に進みます。</div>':'')+
   action(ready?'票数を確定して判定':'全員分の票数を入力してください',"judgeVotes",false,!ready)+
   action('トークに戻る',"returnTalk",true);
 }
 function resultView(){
  if(!reveal)return '<h2>🎭 いよいよ正体発表！</h2><div class="zg-secret"><div style="font-size:60px">🦊</div><strong>みんなが画面を見たら公開</strong></div>'+action('🦊 正体を公開する',"reveal");
  if(!voteDecision||voteDecision.status!=="winner")return '<div class="notice err">投票結果が確定していません。</div>'+action('投票に戻る',"vote",true);
  const winner=voteDecision.winner;
  const labels={mimikyu:'👻 ミミッキュの単独勝利！',villagers:'🎉 村人側の勝利！',zoroark:'🎭 ゾロアークの勝利！'};
  const score=voteDecision.points;
  const scoreLine=!score?'':winner==="mimikyu"?'ミミッキュ：5点':winner==="villagers"?'村人：各1点'+(mimikyuIndex>=0?'／ミミッキュ：1点':''):'ゾロアーク：2点';
  return '<h2>🦊 正体発表！</h2><div class="zg-reveal"><div class="zg-fox">🦊</div><p>ゾロアークは…</p><strong style="font-size:40px">'+(round.wolf+1)+'番！</strong></div>'+
   '<p class="zg-winner">'+labels[winner]+'</p>'+
   (scoreLine?'<div class="zg-result-winner">獲得点：'+scoreLine+'</div>':'')+
   (mimikyuIndex>=0?'<p>👻 ミミッキュ：<strong>'+(mimikyuIndex+1)+'番</strong></p>':'')+
   '<p>最多得票：<strong>'+vote+'番（'+voteCounts[vote-1]+'票）</strong></p>'+
   (voteRound>1?'<p>決選投票：'+voteRound+'回目で決着</p>':'')+
   '<p>多数派：<strong>'+esc(round.majority)+'</strong><br>少数派：<strong>'+esc(round.minority)+'</strong></p>'+
   '<div class="zg-hint"><strong>共通点：</strong>'+esc(round.pair.common)+'<br><strong>違い：</strong>'+esc(round.pair.difference)+'</div>'+
   action(busy?'CA権限を確認中…':'次のゲームへ',"start",false,busy)+action('🪙 疑惑メダル集計へ →',"medalResults")+action('人数設定に戻る',"reset",true);
 }
 function body(){
  if(phase.startsWith("medal-")&&phase!=="medal-summary")return medalScreen();
  if(phase==="medal-summary")return medalsResult();
  if(phase==="card-owner"||phase==="card-handoff"||phase==="card-private")return cardScreen();
 if(phase==="play-style")return '<span class="pill">PLAY STYLE</span><h2 style="margin-top:12px">遊び方を選ぶ</h2><p class="muted strong">どちらもGMが必要です。</p><div class="zg-mode-grid"><button type="button" class="zg-mode-card" data-act="face-to-face"><span class="mode-icon">🤝</span><strong>対面</strong><span class="mode-desc">会場で集まる対面プレイ。シンプル／マニュアルを選び、1台プレイかQRルームを利用。</span></button><button type="button" class="zg-mode-card manual" data-act="remote"><span class="mode-icon">🌐</span><strong>リモート</strong><span class="mode-desc">離れた場所から参加。ルーム番号を発行・入力して参加する方式を開発予定。現在は準備中。</span></button></div>';
 if(phase==="remote-entry")return '<span class="pill">🌐 REMOTE</span><h2 style="margin-top:12px">リモートは準備中</h2><div class="zg-hint" role="status">今後はGMが<strong>ルーム番号を発行</strong>し、離れた場所の参加者が<strong>ルーム番号を入力</strong>して入室する方式を予定しています。現在は番号発行・入室・リモートゲームを利用できません。</div>'+action('← 遊び方を選ぶ',"chooseStyle",true);
 if(phase==="mode-select")return '<span class="pill">'+(playStyle==="remote"?"🌐 リモート":"🤝 対面")+'</span><h2 style="margin-top:12px">モードを選ぶ</h2><p class="muted strong">どちらもGMが必要です。人数・難易度・トーク時間・進行操作は共通です。</p><div class="zg-mode-grid"><button type="button" class="zg-mode-card" data-act="simple"><span class="mode-icon">🎮</span><strong>シンプルモード</strong><span class="mode-desc">村人とゾロアークだけで遊ぶ基本ルール。</span></button><button type="button" class="zg-mode-card manual" data-act="manual"><span class="mode-icon">🎭</span><strong>マニュアルモード</strong><span class="mode-desc">基本ルールにミミッキュなどの追加役職を組み込む。</span></button></div>'+action('← 対面・リモート選択へ',"chooseStyle",true);
 if(phase==="setup")return '<span class="pill">'+(playStyle==="remote"?"🌐 リモート":"🤝 対面")+' · '+(gameMode==="manual"?"🎭 マニュアルモード":"🎮 シンプルモード")+' · ROUND '+(roundNo+1)+'</span><h2 style="margin-top:12px">ゲームを準備する</h2><div class="zg-hint">'+(gameMode==="manual"?'多数派とは異なるお題を受け取る人が1人います。役職も本人だけに知らせます。<br>役職とポケモン名は秘密。嘘やブラフもOK！':'多数派とは異なるお題を受け取る人が1人います。本人には少数派だと知らせません。<br>ポケモン名を言わずに話そう。嘘やブラフもOK！')+'</div><label class="zg-label">人数（GMを除く）</label><div class="zg-controls"><button class="zg-btn secondary" data-act="minus">−</button><strong>'+count+'</strong><button class="zg-btn secondary" data-act="plus">＋</button></div><p class="muted small center">推奨6〜8人（3〜12人）</p><label for="zg-level" class="zg-label">難易度</label><select class="zg-select" id="zg-level"><option value="all">おまかせ（42組）</option><option value="easy">初級（12組）</option><option value="normal">中級（15組）</option><option value="hard">上級（15組）</option></select><label for="zg-mode" class="zg-label">会話形式</label><select class="zg-select" id="zg-mode"><option value="free">自由トーク</option><option value="rounds">順番に2周</option></select><label for="zg-duration" class="zg-label">トーク時間</label><select class="zg-select" id="zg-duration"><option value="120">2分</option><option value="180">3分</option><option value="300">5分</option><option value="0">制限なし</option></select>'+(gameMode==="manual"?'<label class="zg-role-option"><input id="zg-mimikyu" type="checkbox"'+(enableMimikyu?' checked':'')+'>👻 ミミッキュ役を1名追加</label><div class="zg-hint">ミミッキュは多数派のお題を受け取り、自分が特別役職であることを知っています。誤って選ばれると単独勝利します。</div>':'')+(playStyle==="remote"?'<div class="zg-hint" role="status">🌐 リモート通信・個別のお題配布・遠隔投票は現在開発準備中です。まだゲームは開始できません。</div>':'')+(error?'<div class="notice err" role="alert">'+esc(error)+'</div>':'')+action(playStyle==="remote"?'リモート機能は準備中':busy?'CA権限を確認中…':'ゲームを開始する',"start",false,busy||playStyle==="remote")+(playStyle==="face-to-face"?'<div class="zg-hint" role="note"><strong>📱 対面QRルーム（検証版）</strong><br>参加者が各自のスマホから入室してGM承認を受けられます。<strong>選択したシンプル／マニュアル・人数・難易度・トーク時間はQRルームにまだ連携されません。</strong> 役職配布・投票などのゲーム本編も未接続です。</div><a class="zg-btn secondary zg-full" href="'+ZOROARK_QA_ROOM_URL+'">📱 QRルームを作成（検証版）</a>':'')+action('← モード選択へ',"chooseMode",true);
 if(phase==="pass")return '<span class="pill">お題配布 '+(player+1)+' / '+round.count+'</span><h2 style="margin-top:12px">自分のお題を確認</h2><div class="zg-hint">プレイヤー'+(player+1)+'番だけが画面を見てください。次の人へ渡すときは必ず隠してください。</div><div class="zg-secret">'+(visible?privatePrompt():'<div style="font-size:56px">🔒</div><strong>本人だけが開いてね</strong>')+'</div>'+action(visible?'確認した・お題を隠す':'お題を見る',visible?'next':'show')+action('最初からやり直す','reset',true);
 if(phase==="talk")return '<span class="pill">🎤 '+(mode==="free"?"自由トーク":"順番に2周・"+talkRound+"周目")+'</span><h2 style="margin-top:12px">会話で探り合おう！</h2><p class="muted strong">全員に発言の機会を。うまく嘘を混ぜるのも作戦！</p><div class="zg-timer" data-clock>'+ (duration===0?'∞':fmt(remaining))+'</div><div class="zg-grid"><button data-act="timer" class="zg-btn secondary"'+(!duration?' disabled':'')+'>'+(running?'⏸ 一時停止':'▶ タイマー')+'</button><button data-act="extend" class="zg-btn secondary"'+(!duration?' disabled':'')+'>＋30秒</button><button data-act="topic" class="zg-btn secondary">🎤 別の話題</button><button data-act="talkRound" class="zg-btn secondary">🔁 次の周へ</button></div><div class="zg-hint">GM向けトーク補助：<strong>'+esc(topics[topic])+'</strong></div>'+

   action(cardCooldownUntil>Date.now()?'🍂 質問カード（クールダウン中）':'🍂 質問カードを使う',"cardChoose",true,cardCooldownUntil>Date.now())+
   (questionUsed.length?'<h3>使用済みの質問</h3>'+questionUsed.map(q=>'<div class="zg-question-history">プレイヤー'+(q.owner+1)+'番：'+esc(q.text)+'</div>').join(""):'')+
   action('🪙 疑惑メダルを投げる',"medalChoose",true)+(duration===0?'<p class="muted small">制限時間なし：中間疑惑速報はありません。</p>':'')+action('指差し投票へ','vote');
  if(phase==="vote")return voteView();
  if(phase==="results")return resultView();
 return '<p>ゲームを準備してください</p>';
 }
 function render(){if(destroyed)return;host.innerHTML=panel();const set=(id,v)=>{const e=host.querySelector(id);if(e)e.value=String(v)};if(phase==="setup"){set("#zg-level",level);set("#zg-mode",mode);set("#zg-duration",duration)}}
 const timer=window.setInterval(()=>{if(!destroyed&&phase==="talk"&&cardAnnouncement&&Date.now()>=cardAnnouncementUntil){cardAnnouncement=null;render()}
   if(!destroyed&&phase==="talk"&&cardCooldownUntil&&Date.now()>=cardCooldownUntil){cardCooldownUntil=0;render()}
   if(!destroyed&&phase==="talk"&&midpointNotice&&Date.now()>=midpointUntil){midpointNotice=null;render()}
   if(!destroyed&&phase==="talk"&&running&&duration){
    tickTalk();
    if(!midpointFired&&talkElapsedMs>=duration*500&&!cardAnnouncement){
      midpointFired=true;const leaders=suspicionLeaders(medalTotals);
      midpointNotice=leaders.length?'最も疑われているのは '+leaders.map(i=>(i+1)+'番').join('・')+'！':'まだ疑惑メダルは投げられていません';
      midpointUntil=Date.now()+8000;render();
    }
    remaining=Math.max(0,Math.ceil((deadline-Date.now())/1000));const el=host.querySelector("[data-clock]");if(el)el.textContent=fmt(remaining);if(!remaining){running=false;render()}}},250);
 async function begin(){
  if(busy||destroyed||playStyle!=="face-to-face")return;
  busy=true;error="";render();
  try{
   const result=await gateway.newRound({count,difficulty:level,recent:history});
   if(destroyed)return;
   const value=result?.round;
   if(!value||!Array.isArray(value.prompts)||value.prompts.length!==count||!Number.isInteger(value.wolf)||value.wolf<0||value.wolf>=count||!value.pair?.id)throw Error("お題の形式を確認できませんでした");
   round=value;mimikyuIndex=-1;
    if(gameMode==="manual"&&enableMimikyu){
      const candidates=Array.from({length:count},(_,i)=>i).filter(i=>i!==value.wolf);
      const random=new Uint32Array(1);crypto.getRandomValues(random);
      mimikyuIndex=candidates[random[0]%candidates.length];
    }
    roundNo++;history=[...history,value.pair.id].slice(-6);recentSave(history);
   questionHands=Array.from({length:count},()=>Array.from({length:5},drawQuestion));questionUsed=[];cardPlayer=-1;cardCooldownUntil=0;cardAnnouncement=null;cardAnnouncementUntil=0;cardWasRunning=false;
    medalTotals=Array(count).fill(0);medalUsed=Array(count).fill(0);medalActor=-1;medalTarget=-1;medalWasRunning=false;midpointFired=false;midpointNotice=null;midpointUntil=0;talkElapsedMs=0;talkResumeAt=0;
    phase="pass";player=0;visible=false;remaining=duration;running=false;talkRound=1;topic=(topic+1)%topics.length;vote=0;voteCounts=Array(count).fill(0);voteFinalists=null;voteRound=1;voteDecision=null;reveal=false;
  }catch(e){if(!destroyed){error=e instanceof Error?e.message:"お題を取得できませんでした";phase="setup"}}
  finally{busy=false;render()}
 }
 function reset(){medalTotals=[];medalUsed=[];medalActor=-1;medalTarget=-1;medalWasRunning=false;midpointFired=false;midpointNotice=null;midpointUntil=0;talkElapsedMs=0;talkResumeAt=0;questionHands=[];questionUsed=[];cardPlayer=-1;cardCooldownUntil=0;cardAnnouncement=null;cardAnnouncementUntil=0;cardWasRunning=false;phase="setup";round=null;mimikyuIndex=-1;player=0;visible=false;running=false;vote=0;voteCounts=[];voteFinalists=null;voteRound=1;voteDecision=null;reveal=false;error="";render()}
 function chooseMode(){if(busy)return;phase="mode-select";gameMode=null;round=null;mimikyuIndex=-1;running=false;visible=false;error="";render()}
 function chooseStyle(){if(busy)return;phase="play-style";playStyle=null;gameMode=null;round=null;mimikyuIndex=-1;running=false;visible=false;error="";render()}
 function act(name){
  if(destroyed)return;
  if(name==="closeQuestionOverlay"){if(phase==="talk"&&cardAnnouncement){cardAnnouncement=null;cardAnnouncementUntil=0;render()}return}
  if(name==="closeMidpoint"){if(phase==="talk"&&midpointNotice){midpointNotice=null;midpointUntil=0;render()}return}
  if(phase==="talk"&&midpointNotice&&Date.now()<midpointUntil)return;
  if(phase==="talk"&&cardAnnouncement&&Date.now()<cardAnnouncementUntil)return;
  if(name==="back"){destroy();onBack();return}
  if(name==="remote"){playStyle="remote";phase="remote-entry";render();return}
  if(name==="face-to-face"){playStyle="face-to-face";phase="mode-select";render();return}
  if(name==="chooseStyle"){chooseStyle();return}
  if(name==="simple"||name==="manual"){gameMode=name;enableMimikyu=name==="manual";phase="setup";error="";render();return}
  if(name==="chooseMode"){chooseMode();return}
  if(name==="minus"){count=Math.max(3,count-1);render();return}
  if(name==="plus"){count=Math.min(12,count+1);render();return}
  if(name==="start"){void begin();return}
  if(name==="show"){visible=true;render();return}
  if(name==="next"){visible=false;if(player+1===round.count){phase="talk"}else player++;render();return}
  if(name==="medalChoose"){
    if(phase!=="talk")return;
    medalWasRunning=Boolean(running);
    if(running){remaining=Math.max(0,Math.ceil((deadline-Date.now())/1000));pauseTalk()}
    phase="medal-owner";medalActor=-1;medalTarget=-1;render();return;
   }
   if(name.startsWith("medalActor:")&&phase==="medal-owner"){
    const i=Number(name.slice("medalActor:".length));
    if(Number.isInteger(i)&&i>=0&&i<count){medalActor=i;phase="medal-handoff";render()}return;
   }
   if(name==="medalOpen"&&phase==="medal-handoff"&&medalActor>=0){phase="medal-private";render();return}
   if(name.startsWith("medalTarget:")&&phase==="medal-private"&&medalActor>=0&&medalUsed[medalActor]<3){
    const i=Number(name.slice("medalTarget:".length));
    if(Number.isInteger(i)&&i>=0&&i<count&&i!==medalActor){medalTarget=i;phase="medal-confirm";render()}return;
   }
   if(name==="medalCancel"&&phase==="medal-confirm"){medalTarget=-1;phase="medal-private";render();return}
   if(name==="medalCommit"&&phase==="medal-confirm"&&medalActor>=0&&medalTarget>=0&&medalActor!==medalTarget&&medalUsed[medalActor]<3){
    medalUsed[medalActor]++;medalTotals[medalTarget]++;medalTarget=-1;phase="medal-done";render();return;
   }
   if(name==="medalClose"&&phase.startsWith("medal-")&&phase!=="medal-summary"){
    if(medalWasRunning)resumeTalk();
    medalWasRunning=false;medalActor=-1;medalTarget=-1;phase="talk";render();return;
   }
   if(name==="medalResults"&&phase==="results"&&reveal){phase="medal-summary";render();return}
   if(name==="backResults"&&phase==="medal-summary"){phase="results";render();return}
   if(name==="cardChoose"){
    if(phase!=="talk"||Date.now()<cardCooldownUntil)return;
    cardWasRunning=Boolean(running);
    if(running){remaining=Math.max(0,Math.ceil((deadline-Date.now())/1000));pauseTalk()}
    phase="card-owner";render();return;
   }
   if(name.startsWith("cardOwner:")){
    if(phase!=="card-owner")return;
    const i=Number(name.slice("cardOwner:".length));
    if(Number.isInteger(i)&&i>=0&&i<count){cardPlayer=i;phase="card-handoff";render()}
    return;
   }
   if(name==="cardOpen"&&phase==="card-handoff"&&cardPlayer>=0){phase="card-private";render();return}
   if(name.startsWith("cardUse:")){
    if(phase!=="card-private"||cardPlayer<0||Date.now()<cardCooldownUntil)return;
    const i=Number(name.slice("cardUse:".length));
    if(!Number.isInteger(i)||i<0||i>=questionHands[cardPlayer].length)return;
    const id=questionHands[cardPlayer][i],owner=cardPlayer;
    questionUsed.push({owner,text:topics[id]});
    questionHands[owner][i]=drawQuestion();
    cardCooldownUntil=Date.now()+10000;
    cardAnnouncement={owner,text:topics[id]};cardAnnouncementUntil=Date.now()+10000;
    closeCards();return;
   }
   if(name==="cardClose"&&(phase==="card-owner"||phase==="card-handoff"||phase==="card-private")){closeCards();return}
   if(name==="timer"){if(duration===0)return;if(running){remaining=Math.max(0,Math.ceil((deadline-Date.now())/1000));pauseTalk()}else if(remaining>0){resumeTalk()}render();return}
  if(name==="extend"){if(!duration)return;remaining+=30;if(running)deadline+=30000;render();return}
  if(name==="topic"){topic=(topic+1)%topics.length;render();return}
  if(name==="talkRound"){talkRound=talkRound===1?2:1;render();return}
  if(name==="vote"){pauseTalk();phase="vote";vote=0;voteCounts=Array(count).fill(0);voteFinalists=null;voteRound=1;voteDecision=null;render();return}
  if(name.startsWith("addVote:")||name.startsWith("subtractVote:")){
   if(phase!=="vote")return;
   const index=Number(name.split(":")[1]);
   const allowed=voteFinalists===null||voteFinalists.includes(index);
   if(!Number.isInteger(index)||index<0||index>=count||!allowed)return;
   const total=voteCounts.reduce((sum,n)=>sum+n,0);
   if(name.startsWith("addVote:")&&total<count)voteCounts[index]++;
   if(name.startsWith("subtractVote:")&&voteCounts[index]>0)voteCounts[index]--;
   render();return;
  }
  if(name==="judgeVotes"){
   if(phase!=="vote")return;
   const result=judgeZoroarkVotes({counts:voteCounts,gameMode,wolfIndex:round.wolf,mimikyuIndex,eligibleCandidates:voteFinalists,voterCount:count});
   if(result.status==="runoff"){
     voteFinalists=result.candidates;voteCounts=Array(count).fill(0);voteRound++;render();return;
   }
   if(result.status==="winner"){
     voteDecision=result;vote=result.selectedIndex+1;phase="results";reveal=false;render();
   }
   return;
  }
  if(name==="returnTalk"){phase="talk";render();return}
  
  if(name==="reveal"){reveal=true;render();return}
  if(name==="reset"){reset()}
 }
 let swipeStart=null;
 const onTouchStart=event=>{if((phase==="results"&&reveal)||phase==="medal-summary"){const t=event.touches?.[0];if(t)swipeStart={x:t.clientX,y:t.clientY}}};
 const onTouchEnd=event=>{if(!swipeStart)return;const t=event.changedTouches?.[0],start=swipeStart;swipeStart=null;if(!t)return;const dx=t.clientX-start.x,dy=t.clientY-start.y;if(Math.abs(dx)<70||Math.abs(dy)>85)return;if(phase==="results"&&reveal&&dx<0){phase="medal-summary";render()}else if(phase==="medal-summary"&&dx>0){phase="results";render()}};
 const click=event=>{const b=event.target.closest("[data-act]");if(b&&host.contains(b)&&!b.disabled)act(b.dataset.act)};
 const change=event=>{if(event.target.id==="zg-level")level=event.target.value;if(event.target.id==="zg-mode")mode=event.target.value;if(event.target.id==="zg-duration"){duration=Number(event.target.value);remaining=duration}if(event.target.id==="zg-mimikyu")enableMimikyu=Boolean(event.target.checked)};
 const hidden=()=>{if(document.hidden&&phase==="pass"&&visible){visible=false;render()}if(document.hidden&&phase==="card-private"){phase="card-handoff";render()}if(document.hidden&&(phase==="medal-private"||phase==="medal-confirm")){medalTarget=-1;phase="medal-handoff";render()}};
 host.addEventListener("click",click);host.addEventListener("touchstart",onTouchStart);host.addEventListener("touchend",onTouchEnd);host.addEventListener("change",change);document.addEventListener("visibilitychange",hidden);
 function destroy(){if(destroyed)return;destroyed=true;clearInterval(timer);host.removeEventListener("click",click);host.removeEventListener("touchstart",onTouchStart);host.removeEventListener("touchend",onTouchEnd);host.removeEventListener("change",change);document.removeEventListener("visibilitychange",hidden)}
 render();
 return destroy;
}
