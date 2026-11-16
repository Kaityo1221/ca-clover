import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {Script} from "node:vm";
import {fileURLToPath} from "node:url";
import path from "node:path";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../..");
const read=p=>readFileSync(path.join(root,p),"utf8");
const index=read("docs/index.html");
const nav=read("docs/community-minigames-placeholder.js");
const loader=read("docs/home-clover.js");
const moduleSource=read("docs/zoroark-local.mjs");
const inlineScripts=[...index.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(x=>x[1]).filter(Boolean);
assert.ok(inlineScripts.length>0,"Page has inline controller");
for(const [i,code] of inlineScripts.entries())new Script(code,{filename:"index-inline-"+i+".js"});
new Script(nav,{filename:"community-minigames-placeholder.js"});
new Script(loader,{filename:"home-clover.js"});
assert.ok(index.includes('if(v==="mini-games")'),"Pages route exists");
assert.ok(index.includes('zoroarkGateway'),"canonical session gateway exists");
assert.ok(index.includes("https://ca-clover.vercel.app/api/zoroark/round"),"only canonical API endpoint");
assert.ok(index.includes("data.session.user.id!==session.user.id"),"session identity checked");
assert.ok(index.includes('profile?.role!=="ca"&&profile?.role!=="admin"'),"UI CA-only");
assert.ok(!moduleSource.includes("Bearer "),"no raw JWT in independent game UI");
assert.ok(!moduleSource.includes("supabase"),"game doesn't own auth client");
assert.ok(moduleSource.includes("gateway.newRound("),"round requests use limited bridge");
assert.ok(moduleSource.includes('visible=false'),"handoff hides prompts");
assert.ok(moduleSource.includes('phase="play-style"'),"play-style selection is the first screen");
assert.ok(moduleSource.includes('class="zg-play-top"') && moduleSource.includes('data-act="openNotebook"'),"notebook entry is beside play-style heading");
assert.ok(moduleSource.includes('if(name==="openNotebook"&&phase==="play-style")'),"notebook entry only navigates from play-style");
assert.ok(index.includes('v==="zoroark-submit"') && index.includes('profile?.role!=="ca"&&profile?.role!=="admin"'),"CA submission route enforces approved role gate");
assert.ok(index.includes('onNotebook:function(){go(profile?.role==="admin"?"zoroark-ideas":"zoroark-submit")}'),"ADMIN opens existing editor; CA opens submission entry");
assert.ok(index.includes("notebookQAReady") && index.includes("zoroarkNotebookGateway"),"CA notebook is explicitly gated to QA Auth/API");
assert.ok(index.includes("zoroark-ca-notebook.mjs") && index.includes("zoroark-admin-notebook.mjs"),"CA and ADMIN route to their own notebooks");
assert.ok(index.includes("zoroarkShowLocal") && index.includes("zoroark-ideas.mjs"),"original local and official notebook is preserved");
assert.ok(index.includes('location.origin==="https://kaityo1221.github.io"'),"production notebook only on canonical Pages origin");
assert.ok(index.includes('notebookQAReady?"http://localhost:3000/api/zoroark/notebook":"https://ca-clover.vercel.app/api/zoroark/notebook"'),"QA / production notebook target is explicit");
assert.ok(index.includes('if(!notebookRequestReady)throw Error'),"unexpected host cannot call notebook");
assert.ok(moduleSource.includes('data-act="face-to-face"'),"face-to-face play can be selected");
assert.ok(moduleSource.includes('data-act="remote"') && moduleSource.includes('<strong>リモート</strong>'),"remote play stays independently selectable");
assert.ok(moduleSource.includes('phase==="remote-entry"'),"remote play opens a preparation screen");
assert.ok(moduleSource.includes("ルーム番号を発行") && moduleSource.includes("ルーム番号を入力"),"remote room-number concept is preserved");
assert.ok(moduleSource.includes("href=\"'+ZOROARK_QA_ROOM_URL+'\"") && moduleSource.includes("ca-clover-4h7xyw0fg-kaityo1222.vercel.app/zoroark/rooms"),"room link has fixed Preview destination");
assert.ok(moduleSource.includes('phase==="setup"'),"face-to-face goes directly to unified setup");
assert.ok(moduleSource.includes('phase==="method-select"'),"start proceeds to method choice");
assert.ok(moduleSource.includes('phase==="gm-choice"'),"GM selection follows each method");
assert.ok(moduleSource.includes('if(name==="chooseRoom"&&phase==="method-select")'),"QR method uses dedicated GM picker");
assert.ok(moduleSource.includes('GMなし：準備中'),"unsafe GM-less QR room remains disabled");
assert.ok(moduleSource.includes('gmJoins&&player===0'),"CA host participates as slot one during GM-less handoff");
assert.ok(!moduleSource.includes('data-act="simple"')&&!moduleSource.includes('data-act="manual"'),"legacy simple/manual cards removed");
assert.ok(moduleSource.includes('playStyle!=="face-to-face"'),"remote cannot call local game API");
assert.ok(moduleSource.includes('if(name==="remote")') && moduleSource.includes('phase="remote-entry"'),"remote remains disabled and separate");
assert.ok(moduleSource.includes('name==="chooseStyle"'),"can return to play-style selection");
assert.ok(moduleSource.includes('id="zg-mimikyu"'),"Mimikyu remains optionally selectable");
assert.ok(!moduleSource.includes('zg-show-roles')&&!moduleSource.includes('showRoles'),"role display toggle is completely removed");
assert.ok(moduleSource.includes('enableMimikyu=false'),"Mimikyu defaults off");
assert.ok(moduleSource.includes('gameMode=enableMimikyu?"manual":"simple"'),"legacy scoring remains unchanged internally");
assert.ok(moduleSource.includes('gameMode==="manual"&&enableMimikyu'),"Mimikyu is restricted to manual mode");
assert.ok(moduleSource.includes('i!==value.wolf'),"Mimikyu never receives the wolf role");
assert.ok(moduleSource.includes('crypto.getRandomValues'),"additional role uses secure random source");
assert.ok(moduleSource.includes('if(name==="backSettings")'),"player can return to unified settings");
assert.ok(moduleSource.includes('typeof gateway.newRound!=="function"'),"CA auth remains mandatory without a dedicated GM");
assert.ok(/zoroark-local\.mjs\?v=202611(?:15-always-role1|16-next-round-fix1|16-round-loading-fix1|16-round-error-retry1|16-ca-notebook-entry1)/.test(index),"always-visible private role and next-round fix use cache-busted module");
assert.ok(moduleSource.includes('phase==="card-private"'),"private question screen is present");
assert.ok(moduleSource.includes('phase==="card-handoff"'),"private handoff mask is present");
assert.ok(moduleSource.includes('questionHands=Array.from({length:count},()=>Array.from({length:5},drawQuestion))'),"each player gets five cards");
assert.ok(moduleSource.includes('cardCooldownUntil=Date.now()+10000'),"question card use starts ten-second cooldown");
assert.ok(moduleSource.includes('cardAnnouncementUntil=Date.now()+10000'),"question overlay lasts ten seconds");
assert.ok(moduleSource.includes('cardAnnouncement=null;render()'),"talk alert clears automatically");
assert.ok(moduleSource.includes('.zg-question-overlay{position:fixed;inset:0;'),"question stays centered in the mobile viewport");
assert.ok(moduleSource.includes('role="dialog" aria-modal="true"'),"public question is presented as an accessible dialog");
assert.ok(moduleSource.includes('questionOverlay()'),"overlay is rendered outside normal card flow");
assert.ok(moduleSource.includes('name==="closeQuestionOverlay"'),"question can be dismissed by user");
assert.ok(moduleSource.includes('class="zg-question-note">10秒間表示</div>'),"caption is concise");
assert.ok(!moduleSource.includes('約10秒間表示されます'),"outdated caption removed");
assert.ok(moduleSource.includes('cardCooldownUntil=0;render()'),"cooldown automatically re-enables card button");
assert.ok(moduleSource.includes('questionUsed.push('),"used questions are recorded for everyone");
assert.ok(moduleSource.includes('if(document.hidden&&phase==="card-private")'),"private cards lock on app background");
assert.ok(moduleSource.includes('voteFinalists=result.candidates'),"Mimikyu runoff is retained");
assert.ok(moduleSource.includes('visible?privatePrompt()'),"manual mode role reveal is retained");
assert.ok(moduleSource.includes('(visible?privatePrompt()'),"private roles only render after a player opens the hidden topic");
assert.ok(moduleSource.includes('役職は全員、自分のお題を開いたときに本人だけに表示します'),"private role disclosure is mandatory");
assert.ok(moduleSource.includes('if(!info)throw Error("役職を確認できませんでした")'),"unknown role fails closed rather than silently hiding it");
assert.ok(moduleSource.includes('esc(round.prompts[player])'),"topic escaped before DOM");
assert.ok(moduleSource.includes('return destroy;'),"timer and handlers cleanup");
assert.ok(nav.includes("data-open-zoroark"),"existing game list card");
assert.ok(nav.includes('if((location.hash||"#my")!=="#my"'),"mini-game entry is scoped to My Community home");
assert.ok(nav.includes('app.querySelector("#sendaiMapHost")')&&index.includes('const miniGamesEntry=(profile.role==="admin"||profile.role==="ca")'),"top entry requires CA/ADMIN home marker");
assert.ok(nav.includes('const title=hero.querySelector("h1.my-welcome-title")'),"welcome heading must be present");
assert.ok(nav.includes('titleRow.appendChild(title);'),"welcome heading moves into one shared row");
assert.ok(nav.includes('titleRow.appendChild(button);'),"mini-game button appears directly to the right of welcome heading");
assert.ok(nav.includes("flex-direction:column;justify-content:center;width:78px"),"mobile button remains compact and right aligned");
assert.ok(!nav.includes('hero.insertAdjacentElement("afterend",entry)'),"separate card below welcome hero is removed");
assert.ok(!nav.includes("hub.insertBefore(button,hub.firstChild)"),"old Community-detail entry removed");
assert.ok(nav.includes("← My Communityへ戻る"),"mini-game hub returns to My Community");
assert.ok(nav.includes('event.stopImmediatePropagation()'),"My Community top navigation still returns home");

assert.ok(nav.includes('location.hash="mini-games"'),"routes to canonical Pages");
assert.ok(loader.includes("20261114-nav1"),"asset cache busted");
const m=await import(new URL("../../docs/zoroark-local.mjs",import.meta.url));
assert.deepEqual(m.suspicionLeaders([0,0,0,0]),[],"zero medals have no leader");
assert.deepEqual(m.suspicionLeaders([1,2,2,0]),[1,2],"midpoint can show multiple tied leaders");
assert.deepEqual(m.suspicionLeaders([3,1,2,0]),[0],"unique suspicion leader is found");
assert.deepEqual(m.suspicionLeaders([0,-1,0]),[],"invalid counts cannot be published");
assert.ok(moduleSource.includes('medalUsed[medalActor]<3'),"three medals per player cannot be exceeded");
assert.ok(moduleSource.includes('参加者本人が操作します'),"medal actor is instructed to self-select instead of GM choosing");
assert.ok(moduleSource.includes('GMへ投票先を知らせる必要はありません'),"medal completion does not require revealing private target");
assert.ok(moduleSource.includes('参加者各自のスマホからのメダル投票・遠隔投票もまだ未接続'),"QR device voting is not falsely claimed as working");
assert.ok(moduleSource.includes('medalActor!==medalTarget'),"players cannot vote for themselves");
assert.ok(moduleSource.includes('medalUsed[medalActor]++'),"commits spend a medal");
assert.ok(moduleSource.includes('medalTotals[medalTarget]++'),"commits update only recipient aggregate");
assert.ok(moduleSource.includes('midpointFired=true'),"dormant medal bulletin logic is preserved");
assert.ok(moduleSource.includes('playMethod!=="handoff"&&!midpointFired'),"no medal bulletin interrupts handoff play");
assert.ok(moduleSource.includes('talkElapsedMs>=duration*500'),"midpoint uses actual unpaused half-duration");
assert.ok(moduleSource.includes('onTouchEnd'),"final result pages support swipe");
assert.ok(moduleSource.includes('if(document.hidden&&(phase==="medal-private"||phase==="medal-confirm"))'),"hidden device masks private recipient selection");
assert.equal(typeof m.mountZoroark,"function");
assert.equal(typeof m.zoroarkRoleInfo,"function");
assert.equal(typeof m.judgeZoroarkVotes,"function","round outcome has an explicit judge");
const judge=(counts,wolfIndex,mimikyuIndex,gameMode="manual",eligibleCandidates=null)=>m.judgeZoroarkVotes({
 counts,gameMode,wolfIndex,mimikyuIndex,eligibleCandidates,voterCount:counts.length
});
assert.deepEqual(judge([0,0,6,0,0,0],1,2),{status:"winner",winner:"mimikyu",selectedIndex:2,points:{villagers:0,zoroark:0,mimikyu:5}},"unique Mimikyu majority awards five points");
assert.deepEqual(judge([0,6,0,0,0,0],1,2),{status:"winner",winner:"villagers",selectedIndex:1,points:{villagers:1,zoroark:0,mimikyu:1}},"finding Zoroark gives villagers and Mimikyu one point");
assert.deepEqual(judge([6,0,0,0,0,0],1,2),{status:"winner",winner:"zoroark",selectedIndex:0,points:{villagers:0,zoroark:2,mimikyu:0}},"voting for an ordinary villager gives Zoroark two points");
assert.deepEqual(judge([0,0,6,0,0,0],1,-1),{status:"winner",winner:"zoroark",selectedIndex:2,points:{villagers:0,zoroark:2,mimikyu:0}},"disabling Mimikyu prevents special win");
assert.equal(judge([0,0,6,0,0,0],1,2,"simple").winner,"zoroark","simple mode does not allow special-role victory");
assert.equal(judge([0,0,6,0,0,0],1,2,"simple").points,null,"simple mode does not introduce advanced scoring");
assert.deepEqual(judge([0,0,3,3,0,0],1,2),{status:"runoff",candidates:[2,3]},"a tied Mimikyu is not yet the winner");
assert.deepEqual(judge([0,0,0,6,0,0],1,2,"manual",[2,3]),{status:"winner",winner:"zoroark",selectedIndex:3,points:{villagers:0,zoroark:2,mimikyu:0}},"a runoff among tied candidates can award Zoroark victory");
assert.deepEqual(judge([0,0,6,0,0,0],1,2,"manual",[2,3]),{status:"winner",winner:"mimikyu",selectedIndex:2,points:{villagers:0,zoroark:0,mimikyu:5}},"Mimikyu can win after a runoff");
assert.equal(judge([0,0,4,0,0,0],1,2).status,"incomplete","missing votes cannot determine winner");
assert.equal(judge([0,0,7,0,0,0],1,2).status,"invalid","extra votes cannot determine winner");
assert.equal(judge([0,0,6,0,0,0],1,2,"manual",[1,3]).status,"invalid","non-finalists cannot receive runoff votes");
assert.equal(judge([0,0,6,0,0,0],2,2).status,"invalid","Mimikyu and Zoroark must be distinct players");
assert.ok(moduleSource.includes('voteCounts.reduce((sum,n)=>sum+n,0)'),"counted votes include every player");
assert.ok(moduleSource.includes('主催者も1票を投じ'),"no-GM organizer participates in pointing vote");
assert.ok(moduleSource.includes('playMethod==="handoff"'),"handoff excludes medal results");
assert.ok(moduleSource.includes('voteFinalists=result.candidates'),"same-count leaders trigger a runoff");
assert.ok(moduleSource.includes('voteDecision=result'),"only finalized winner is displayed");
assert.equal(m.zoroarkRoleInfo("simple",0,0,-1).name,"ゾロアーク","Zoroark always knows their role");
assert.equal(m.zoroarkRoleInfo("simple",1,0,1).name,"村人","basic rule does not introduce Mimikyu");
assert.equal(m.zoroarkRoleInfo("simple",2,0,-1).name,"村人","villagers always know their role");
assert.equal(m.zoroarkRoleInfo("unknown",0,0,-1),null,"unknown internal modes remain invalid");
assert.equal(m.zoroarkRoleInfo("manual",0,0,1).name,"ゾロアーク","manual minority knows their role");
assert.equal(m.zoroarkRoleInfo("manual",1,0,1).name,"ミミッキュ","manual Mimikyu knows their role");
assert.equal(m.zoroarkRoleInfo("manual",2,0,1).name,"村人","manual majority knows their role");
assert.equal(m.zoroarkRoleInfo("manual",1,0,-1).name,"村人","manual mode without Mimikyu is valid");
for(const index of [0,1,2])assert.ok(m.zoroarkRoleInfo("manual",index,0,1).description.length>10,"each role explains its objective");

/* Minimal DOM hand-off regression: no browser network or CA secrets are used. */
const originalGlobals={window:globalThis.window,document:globalThis.document,sessionStorage:globalThis.sessionStorage};
const realNow=Date.now;
let clockNow=3000000,intervalTick=()=>{};
const handlers={},documentHandlers={};
globalThis.window={setInterval(fn){intervalTick=fn;return 101},clearInterval(){}};
globalThis.document={
 hidden:false,
 getElementById(){return {}},
 addEventListener(k,fn){documentHandlers[k]=fn},
 removeEventListener(k){delete documentHandlers[k]}
};
globalThis.sessionStorage={getItem(){return null},setItem(){}};
Date.now=()=>clockNow;
const fakeHost={
 innerHTML:"",
 addEventListener(k,fn){handlers[k]=fn},
 removeEventListener(k){delete handlers[k]},
 contains(){return true},
 querySelector(selector){return selector.startsWith("#zg-")?{value:""}:null}
};
const fakeRound={
 count:6,
 wolf:1,
 prompts:["ガーディ","ロコン","ガーディ","ガーディ","ガーディ","ガーディ"],
 majority:"ガーディ",minority:"ロコン",
 pair:{id:"a01",common:"犬・狐に似たポケモン",difference:"タイプと進化"}
};
let roundCallCount=0;const gateway={async newRound(args){roundCallCount++;assert.equal(args.count,6);assert.equal(args.difficulty,"all");return {round:fakeRound}}};
const teardown=m.mountZoroark({host:fakeHost,gateway,onBack(){}});
tap("remote");
assert.ok(fakeHost.innerHTML.includes("リモートは準備中"),"remote mode shows preparation status");
assert.ok(fakeHost.innerHTML.includes("ルーム番号を発行") && fakeHost.innerHTML.includes("ルーム番号を入力"),"remote mode describes planned room-number access");
assert.ok(!fakeHost.innerHTML.includes("ca-clover-4h7xyw0fg-kaityo1222.vercel.app"),"remote preparation screen must not contain a QR Preview link");
assert.ok(!fakeHost.innerHTML.includes("ルーム作成・管理画面へ"),"remote preparation screen must not offer QR creation");
assert.ok(!fakeHost.innerHTML.includes("ゲームを開始する"),"remote entry does not imply full remote game");
assert.ok(!fakeHost.innerHTML.includes("選択したシンプル／マニュアル・人数"),"remote choice remains separate from face-to-face setup");
tap("chooseStyle");
assert.ok(fakeHost.innerHTML.includes('data-act="face-to-face"'),"local play remains selectable");
function tap(act){
 const node={dataset:{act},disabled:false};
 handlers.click({target:{closest(selector){return selector==="[data-act]"?node:null}}});
}
tap("face-to-face");
assert.ok(fakeHost.innerHTML.includes("⚙️ ゲーム設定"),"face-to-face opens unified settings without another mode page");
assert.ok(fakeHost.innerHTML.includes('id="zg-mimikyu" type="checkbox">'),"Mimikyu defaults off");
assert.ok(!fakeHost.innerHTML.includes('zg-show-roles'),"setup has no role visibility checkbox");
assert.ok(fakeHost.innerHTML.includes('役職は全員、自分のお題を開いたときに本人だけに表示します'),"mandatory role disclosure appears in setup");
assert.ok(fakeHost.innerHTML.includes('value="180">3分'),"three-minute talk option exists");
assert.ok(fakeHost.innerHTML.includes("おまかせ（42組）"),"all difficulty option available");
tap("start");
assert.ok(fakeHost.innerHTML.includes("プレイ方法を選ぶ"),"game start opens handoff/room choice");
assert.equal(roundCallCount,0,"game start does not issue or reveal any round");
assert.ok(fakeHost.innerHTML.includes("ルームを作る（検証版）"),"room option available after start");
tap("chooseRoom");
assert.ok(fakeHost.innerHTML.includes('href="https://ca-clover-4h7xyw0fg-kaityo1222.vercel.app/zoroark/rooms"'),"GM-run QR room targets fixed Preview");
assert.ok(fakeHost.innerHTML.includes("GMなし：準備中"),"QR room without GM is not exposed");
assert.ok(fakeHost.innerHTML.includes('disabled aria-disabled="true"'),"unimplemented GM-less QR cannot start");
tap("backMethod");
assert.ok(fakeHost.innerHTML.includes("プレイ方法を選ぶ"),"back to both play methods");
tap("backSettings");
assert.ok(fakeHost.innerHTML.includes("⚙️ ゲーム設定"),"settings can be revised before starting");
handlers.change({target:{id:"zg-mimikyu",checked:true}});
assert.ok(!fakeHost.innerHTML.includes('zg-show-roles'),"Mimikyu never makes role display optional");
tap("start");
assert.equal(roundCallCount,0,"choosing settings never generates a round");
tap("chooseHandoff");
assert.ok(fakeHost.innerHTML.includes("GMなし：主催者も参加"),"GM-less handoff is available");
assert.equal(roundCallCount,0,"choosing handoff does not generate a round");
tap("gmDedicated");
await new Promise(resolve=>setImmediate(resolve));
assert.ok(fakeHost.innerHTML.includes("自分のお題を確認"),"round starts with private prompts");
for(let i=0;i<6;i++){tap("show");tap("next")}
assert.ok(fakeHost.innerHTML.includes("会話で探り合おう"),"all six prompts complete");
assert.ok(fakeHost.innerHTML.includes("質問カードを使う"),"cards are available in manual talk phase");
tap("timer");
tap("cardChoose");
assert.ok(fakeHost.innerHTML.includes("誰がカードを使う？"),"GM chooses a handoff recipient");
tap("cardOwner:0");
assert.ok(fakeHost.innerHTML.includes("本人だけが開いてね"),"hand is hidden before opening");
assert.ok(!fakeHost.innerHTML.includes("zg-question-choice"),"no private card displayed on handoff");
tap("cardOpen");
assert.equal((fakeHost.innerHTML.match(/data-act="cardUse:\d+"/g)||[]).length,5,"private hand shows five cards");
tap("cardUse:0");
assert.ok(fakeHost.innerHTML.includes('role="dialog" aria-modal="true"'),"question is displayed in a modal above the scrolled game screen");
assert.ok(fakeHost.innerHTML.includes('zg-question-overlay'),"question is displayed in a fixed overlay");
assert.ok(fakeHost.innerHTML.includes("トークタイム！"),"used card becomes a public announcement");
assert.ok(fakeHost.innerHTML.includes("プレイヤー1番"),"announced question identifies its owner");
assert.ok(fakeHost.innerHTML.includes("使用済みの質問"),"question is tracked in shared public history");
assert.ok(fakeHost.innerHTML.includes("クールダウン中"),"card cooldown begins immediately");
tap("cardChoose");
assert.ok(fakeHost.innerHTML.includes("会話で探り合おう"),"cooldown cannot be bypassed by direct action");
clockNow+=2500;intervalTick();
assert.ok(fakeHost.innerHTML.includes('role="dialog" aria-modal="true"'),"question remains visible after two and a half seconds");
clockNow+=7501;intervalTick();
assert.ok(!fakeHost.innerHTML.includes('role="dialog" aria-modal="true"'),"question overlay auto-closes after ten seconds");
assert.ok(fakeHost.innerHTML.includes("質問カードを使う"),"card button unlocks after ten seconds without other input");
tap("cardChoose");tap("cardOwner:0");tap("cardOpen");
assert.equal((fakeHost.innerHTML.match(/data-act="cardUse:\d+"/g)||[]).length,5,"a replacement card maintains five-card hand");
globalThis.document.hidden=true;
documentHandlers.visibilitychange();
assert.ok(fakeHost.innerHTML.includes("本人だけが開いてね"),"backgrounding the app re-locks the private hand");
assert.ok(!fakeHost.innerHTML.includes("zg-question-choice"),"background lock hides the card content");
globalThis.document.hidden=false;tap("cardClose");
tap("cardChoose");tap("cardOwner:0");tap("cardOpen");tap("cardUse:0");
assert.ok(fakeHost.innerHTML.includes('role="dialog" aria-modal="true"'),"second card opens centered question");
tap("closeQuestionOverlay");
assert.ok(!fakeHost.innerHTML.includes('role="dialog" aria-modal="true"'),"manual close dismisses the question immediately");
assert.ok(fakeHost.innerHTML.includes("クールダウン中"),"manual close does not skip ten-second cooldown");
tap("vote");
for(let i=0;i<6;i++)tap("addVote:1");
tap("judgeVotes");
assert.ok(fakeHost.innerHTML.includes("いよいよ正体発表！"),"correct vote total determines a winner");
tap("reveal");
assert.ok(fakeHost.innerHTML.includes("村人側の勝利！"),"integrated question cards do not disturb Mimikyu scoring");
tap("reset");
handlers.change({target:{id:"zg-mimikyu",checked:false}});
assert.ok(!fakeHost.innerHTML.includes('zg-show-roles'),"role display switch does not reappear after reset");
tap("start");tap("chooseHandoff");tap("gmPlaying");
await new Promise(resolve=>setImmediate(resolve));
assert.ok(fakeHost.innerHTML.includes("CA主催者はプレイヤー1番"),"GM-less CA host is a real player");
assert.ok(!fakeHost.innerHTML.includes("あなたの役職"),"private role is not visible until the player opens the prompt");
tap("show");
assert.ok(fakeHost.innerHTML.includes("あなたの役職")&&fakeHost.innerHTML.includes("👥 村人"),"player one sees their village role");
tap("next");
assert.ok(!fakeHost.innerHTML.includes("あなたの役職"),"role is hidden again before next player receives the phone");
tap("show");
assert.ok(fakeHost.innerHTML.includes("あなたの役職")&&fakeHost.innerHTML.includes("🦊 ゾロアーク"),"Zoroark always knows their own role with Mimikyu disabled");
teardown();

/* Shared-handset gameplay uses simultaneous pointing, not suspicion medals. */
const teardownPoint=m.mountZoroark({host:fakeHost,gateway,onBack(){}});
tap("face-to-face");
handlers.change({target:{id:"zg-mimikyu",checked:true}});
tap("start");tap("chooseHandoff");tap("gmDedicated");
await new Promise(resolve=>setImmediate(resolve));
for(let i=0;i<6;i++){tap("show");tap("next")}
assert.ok(fakeHost.innerHTML.includes("「せーの！」指差し投票へ"),"handoff exposes simultaneous pointing");
assert.ok(!fakeHost.innerHTML.includes("メダルを投げる"),"handoff medal button is absent");
tap("medalChoose");
assert.ok(fakeHost.innerHTML.includes("会話で探り合おう"),"injected medal action is ignored in handoff");
tap("timer");
clockNow+=90200;intervalTick();
assert.ok(!fakeHost.innerHTML.includes("疑惑速報！"),"no medal bulletin in handoff");
tap("vote");
assert.ok(fakeHost.innerHTML.includes("専任GMは投票せず"),"GM does not cast a vote");
assert.ok(fakeHost.innerHTML.includes("「せーの！」で全員が一斉に"),"simultaneous vote instruction");
for(let i=0;i<6;i++)tap("addVote:1");
tap("judgeVotes");tap("reveal");
assert.ok(fakeHost.innerHTML.includes("村人側の勝利！"),"existing judge still works");
assert.ok(!fakeHost.innerHTML.includes("疑惑メダル集計へ"),"handoff result has no medal tally");
tap("medalResults");
assert.ok(!fakeHost.innerHTML.includes("疑惑メダル集計"),"injected medal tally action is ignored");
handlers.touchstart({touches:[{clientX:165,clientY:150}]});
handlers.touchend({changedTouches:[{clientX:35,clientY:150}]});
assert.ok(fakeHost.innerHTML.includes("正体発表！"),"swiping cannot open handoff medals");
teardownPoint();

const teardownNoGm=m.mountZoroark({host:fakeHost,gateway,onBack(){}});
tap("face-to-face");tap("start");tap("chooseHandoff");tap("gmPlaying");
await new Promise(resolve=>setImmediate(resolve));
for(let i=0;i<6;i++){tap("show");tap("next")}
tap("vote");
assert.ok(fakeHost.innerHTML.includes("主催者も1票を投じ"),"GM-less CA organizer participates");
assert.ok(fakeHost.innerHTML.includes("入力済み 0 / 6票"),"all six players including CA receive one ballot");
for(let i=0;i<6;i++)tap("addVote:1");
tap("judgeVotes");
assert.ok(fakeHost.innerHTML.includes("いよいよ正体発表"),"six votes decide without GM");
teardownNoGm();
Date.now=realNow;
for(const key of Object.keys(originalGlobals)){
 if(originalGlobals[key]===undefined)delete globalThis[key];else globalThis[key]=originalGlobals[key];
}

console.log("ZOROARK_PAGES_UI_CONTRACT_PASS");
