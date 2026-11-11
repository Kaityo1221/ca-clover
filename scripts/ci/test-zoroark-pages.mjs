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
assert.ok(moduleSource.includes('data-act="face-to-face"'),"face-to-face play can be selected");
assert.ok(moduleSource.includes('data-act="remote"'),"remote play can be selected");
assert.ok(moduleSource.includes('phase="mode-select"'),"game-mode selection follows play-style selection");
assert.ok(moduleSource.includes('playStyle!=="face-to-face"'),"remote cannot call local game API");
assert.ok(moduleSource.includes('busy||playStyle==="remote"'),"remote start is disabled");
assert.ok(moduleSource.includes('name==="chooseStyle"'),"can return to play-style selection");
assert.ok(moduleSource.includes('data-act="simple"'),"simple mode is selectable");
assert.ok(moduleSource.includes('data-act="manual"'),"manual mode is selectable");
assert.ok(moduleSource.includes('gameMode==="manual"&&enableMimikyu'),"Mimikyu is restricted to manual mode");
assert.ok(moduleSource.includes('i!==value.wolf'),"Mimikyu never receives the wolf role");
assert.ok(moduleSource.includes('crypto.getRandomValues'),"additional role uses secure random source");
assert.ok(moduleSource.includes('if(name==="chooseMode")'),"player can return to mode chooser");
assert.ok(moduleSource.includes('typeof gateway.newRound!=="function"'),"GM is required in both modes");
assert.ok(index.includes('20261111-medals1'),"question overlay fix avoids old module caches");
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
assert.ok(moduleSource.includes('役職も本人だけに知らせます。'),"manual mode explains role disclosure");
assert.ok(moduleSource.includes('本人には少数派だと知らせません'),"simple mode retains hidden minority role");
assert.ok(moduleSource.includes('esc(round.prompts[player])'),"topic escaped before DOM");
assert.ok(moduleSource.includes('return destroy;'),"timer and handlers cleanup");
assert.ok(nav.includes("data-open-zoroark"),"existing game list card");
assert.ok(nav.includes('if((location.hash||"#my")!=="#my"'),"mini-game entry is scoped to My Community home");
assert.ok(nav.includes('app.querySelector("#sendaiMapHost")'),"top entry requires CA/ADMIN home marker");
assert.ok(nav.includes('const title=hero.querySelector("h1.my-welcome-title")'),"welcome heading must be present");
assert.ok(nav.includes('titleRow.appendChild(title);'),"welcome heading moves into one shared row");
assert.ok(nav.includes('titleRow.appendChild(button);'),"mini-game button appears directly to the right of welcome heading");
assert.ok(nav.includes("flex-direction:column;justify-content:center;width:78px"),"mobile button remains compact and right aligned");
assert.ok(!nav.includes('hero.insertAdjacentElement("afterend",entry)'),"separate card below welcome hero is removed");
assert.ok(!nav.includes("hub.insertBefore(button,hub.firstChild)"),"old Community-detail entry removed");
assert.ok(nav.includes("← My Communityへ戻る"),"mini-game hub returns to My Community");
assert.ok(nav.includes('event.stopImmediatePropagation()'),"My Community top navigation still returns home");

assert.ok(nav.includes('location.hash="mini-games"'),"routes to canonical Pages");
assert.ok(loader.includes("20261111-welcome-right1"),"asset cache busted");
const m=await import(new URL("../../docs/zoroark-local.mjs",import.meta.url));
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
assert.ok(moduleSource.includes('voteCounts.reduce((sum,n)=>sum+n,0)'),"GM enters and totals real votes");
assert.ok(moduleSource.includes('voteFinalists=result.candidates'),"same-count leaders trigger a runoff");
assert.ok(moduleSource.includes('voteDecision=result'),"only finalized winner is displayed");
assert.equal(m.zoroarkRoleInfo("simple",0,0,-1),null,"simple mode does not disclose Zoroark");
assert.equal(m.zoroarkRoleInfo("simple",1,0,1),null,"simple mode does not disclose Mimikyu");
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
const gateway={async newRound(){return {round:fakeRound}}};
const teardown=m.mountZoroark({host:fakeHost,gateway,onBack(){}});
function tap(act){
 const node={dataset:{act},disabled:false};
 handlers.click({target:{closest(selector){return selector==="[data-act]"?node:null}}});
}
tap("face-to-face");tap("manual");tap("start");
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
tap("reset");tap("chooseMode");tap("simple");tap("start");
await new Promise(resolve=>setImmediate(resolve));
tap("show");
assert.ok(!fakeHost.innerHTML.includes("あなたの役職"),"simple mode still hides role identity");
teardown();
Date.now=realNow;
for(const key of Object.keys(originalGlobals)){
 if(originalGlobals[key]===undefined)delete globalThis[key];else globalThis[key]=originalGlobals[key];
}

console.log("ZOROARK_PAGES_UI_CONTRACT_PASS");
