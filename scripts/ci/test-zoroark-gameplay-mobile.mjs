import assert from "node:assert/strict";
import {createRequire} from "node:module";
const require=createRequire(new URL("./participant-runtime/package.json",import.meta.url));
const {chromium,webkit}=require("playwright");
const ORIGIN="http://127.0.0.1:3111";
const players=[
 {id:"11111111-1111-4111-8111-111111111111",number:1,name:"QA Trainer"},
 {id:"22222222-2222-4222-8222-222222222222",number:2,name:"Guest B"},
 {id:"33333333-3333-4333-8333-333333333333",number:3,name:"Guest C"},
];
for(const [engine,label] of [[chromium,"Chromium"],[webkit,"WebKit"]]){
 const browser=await engine.launch({headless:true,args:label==="Chromium"?["--no-sandbox"]:[]});
 try{
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const page=await context.newPage();
  let phase="talk",voted=false;
  const questions=[];
  await page.route("**/api/zoroark/game/guest",async route=>{
   const req=route.request();
   assert.equal(req.method(),"POST");
   assert.equal(req.headers()["x-zoroark-request"],"game-v1");
   const data=JSON.parse(req.postData());
   if(data.action==="question"){
    questions.push({id:data.questionId,playerId:players[0].id});
    return route.fulfill({contentType:"application/json",body:JSON.stringify({ok:true})});
   }
   if(data.action==="vote"){
    assert.equal(data.targetId,players[1].id);
    voted=true;
    return route.fulfill({contentType:"application/json",body:JSON.stringify({ok:true})});
   }
   if(data.action!=="state")throw Error("Unexpected action "+data.action);
   const roster=phase==="reveal"?players.map((p,i)=>({...p,role:i===1?"zoroark":"villager",
    prompt:i===1?"イーブイ":"ピカチュウ"})):players;
   return route.fulfill({contentType:"application/json",body:JSON.stringify({game:{
    phase,myId:players[0].id,myName:"QA Trainer",role:"villager",prompt:"ピカチュウ",
    players:roster,questions,voted,voteRound:1,runoffIds:[],
    winner:phase==="reveal"?"villagers":null,selectedGuest:phase==="reveal"?players[1].id:null
   }})});
  });
  await page.goto(ORIGIN+"/zoroark/guest");
  await page.getByRole("heading",{name:"🦊 ゾロアークを探せ！"}).waitFor();
  await page.getByText("QA Trainer",{exact:true}).waitFor();
  assert.equal(await page.getByText("ピカチュウ",{exact:true}).count(),0,"secret starts hidden");
  await page.getByRole("button",{name:"自分の役職・お題を見る"}).click();
  assert.equal(await page.getByText("ピカチュウ",{exact:true}).count(),1);
  assert.equal(await page.getByText("👥 村人",{exact:true}).count(),1);
  await page.evaluate(()=>window.dispatchEvent(new Event("blur")));
  assert.equal(await page.getByText("ピカチュウ",{exact:true}).count(),0,"secret hides on app blur");
  await page.getByRole("combobox",{name:"質問を選ぶ"}).selectOption("2");
  await page.getByRole("button",{name:/質問する/}).click();
  await page.getByText("質問する (1/5回使用)").waitFor();
  assert.ok((await page.locator("body").textContent()).includes("相棒にするなら？"));
  phase="vote";await page.getByRole("button",{name:/最新情報/}).click();
  await page.getByRole("heading",{name:"🗳️ ゾロアークを選ぼう"}).waitFor();
  page.once("dialog",d=>d.accept());
  await page.getByRole("button",{name:"2番 Guest B"}).click();
  await page.getByText("投票済み。集計をお待ちください。").waitFor();
  phase="reveal";await page.getByRole("button",{name:/最新情報/}).click();
  await page.getByRole("heading",{name:"👥 村人の勝利"}).waitFor();
  assert.ok((await page.locator("body").textContent()).includes("イーブイ"));
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
  assert.ok(overflow<=1,"mobile horizontal overflow "+label+" "+overflow);
  const reveal=await page.getByRole("button",{name:"自分の役職・お題を見る"}).boundingBox();
  assert.ok(reveal.height>=44,"tap target is too small");
  await context.close();
  console.log(label+" 390x844 guest privacy, questions, vote and reveal PASS");
 }finally{await browser.close()}
}
