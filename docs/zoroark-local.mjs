// CA Clover Pages mini game. Authorization is enforced ONLY by the Vercel API.
// This UI never stores a bearer token and receives only a granted round.
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const topics=["見た目で特徴的なのは？","どこで出会えそう？","相棒にするなら？","進化はする？","どんな技が強そう？","Pokémon GOではどう？","初めて見た印象は？","一言で説明すると？","何が得意そう？","自慢したいところは？","どんな鳴き声？","似ているポケモンは？"];
// Role visibility is intentionally limited to manual mode. The basic word-wolf mode hides roles.
export function zoroarkRoleInfo(gameMode, playerIndex, wolfIndex, mimikyuIndex=-1){
 if(gameMode!=="manual")return null;
 if(playerIndex===wolfIndex)return {icon:"🦊",name:"ゾロアーク",description:"あなたは少数派。正体を隠して投票を切り抜けよう。"};
 if(mimikyuIndex>=0&&playerIndex===mimikyuIndex)return {icon:"👻",name:"ミミッキュ",description:"ゾロアークと間違われたら単独勝利！"};
 return {icon:"👥",name:"村人",description:"あなたは多数派。会話からゾロアークを見つけよう。"};
}
const styles=[
".zg{max-width:720px;margin:auto}.zg-head{display:flex;align-items:center;gap:12px;flex-wrap:wrap}.zg-panel{margin-top:16px;background:#fff;border:1px solid #d9f99d;border-radius:24px;padding:20px;box-shadow:0 12px 26px #36531412}",
".zg-label{display:block;margin:18px 0 7px;font-size:13px;font-weight:900;color:#365314}.zg-select{display:block;width:100%;min-height:47px;border:1px solid #d9f99d;border-radius:12px;background:#fff;color:#1f2937;padding:10px;font-size:16px}",
".zg-controls{display:flex;align-items:center;justify-content:center;gap:16px;margin:16px 0}.zg-controls strong{min-width:45px;text-align:center;font-size:32px}.zg-controls button{width:54px;height:46px}",
".zg .zg-btn{display:inline-flex;justify-content:center;align-items:center;min-height:48px;padding:12px 16px;border:0;border-radius:15px;background:#84cc16;color:#1a2e05;font-weight:950;font-size:15px}.zg .zg-btn.secondary{background:#f7fee7;border:1px solid #d9f99d;color:#365314}.zg-btn[disabled]{opacity:.5}",
".zg-full{width:100%;margin-top:12px}.zg-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin-top:12px}.zg-hint{margin:12px 0;padding:12px;border:1px solid #d9f99d;border-radius:13px;background:#f7fee7;color:#365314;font-size:13px;font-weight:750;line-height:1.7}",
".zg-role-reveal{margin-top:4px;width:100%;max-width:360px;padding:14px;border-radius:15px;border:1px solid #a8b9d6;background:#233a55;text-align:center;line-height:1.55}.zg-role-reveal .zg-role-title{display:block;font-size:13px;font-weight:850;color:#dbeafe}.zg-role-reveal .zg-role-name{display:block;font-size:25px;font-weight:950;margin:4px 0;color:#fff}.zg-role-reveal .zg-role-desc{font-size:14px;color:#e2e8f0}",
 ".zg-secret{min-height:215px;margin:16px 0;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:14px;border-radius:22px;background:#162438;color:white;padding:20px;text-align:center}.zg-secret strong{font-size:clamp(23px,7vw,35px)}",
".zg-timer{text-align:center;font-size:clamp(45px,13vw,68px);font-weight:950;color:#365314;font-variant-numeric:tabular-nums;margin:20px 0}.zg-votes{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:18px 0}",
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
  remaining=duration,running=false,deadline=0,topic=0,talkRound=1,vote=0,reveal=false,roundNo=0,
  busy=false,error="",history=recentLoad();
 const panel=()=>'<div class="zg"><section class="card hero"><div class="zg-head"><button data-act="back" type="button" class="zg-btn secondary">← My Communityへ戻る</button><span class="pill">🦊 CA専用GM</span></div><h1 style="margin-top:13px">🎭 ゾロアークを探せ！</h1><p class="muted strong">対面かリモートを選んでから、ゲームモードを決めよう。</p></section><section class="zg-panel">'+body()+'</section></div>';
 function action(text,id,other=false,disabled=false){return '<button type="button" data-act="'+id+'" class="zg-btn'+(other?' secondary':'')+' zg-full"'+(disabled?' disabled':'')+'>'+text+'</button>'}
 function privatePrompt(){
   const info=zoroarkRoleInfo(gameMode,player,round.wolf,mimikyuIndex);
   return '<span>あなたの秘密のお題</span><strong>'+esc(round.prompts[player])+'</strong>'+
     (info?'<div class="zg-role-reveal"><span class="zg-role-title">🎭 あなたの役職</span><span class="zg-role-name">'+esc(info.icon)+' '+esc(info.name)+'</span><span class="zg-role-desc">'+esc(info.description)+'</span></div>':'<span>名前は話さないでね</span>');
 }
 function body(){
 if(phase==="play-style")return '<span class="pill">PLAY STYLE</span><h2 style="margin-top:12px">遊び方を選ぶ</h2><p class="muted strong">どちらもGMが必要です。</p><div class="zg-mode-grid"><button type="button" class="zg-mode-card" data-act="face-to-face"><span class="mode-icon">🤝</span><strong>対面</strong><span class="mode-desc">会場で集まって、GMのスマホを順番に回して遊ぶ。</span></button><button type="button" class="zg-mode-card manual" data-act="remote"><span class="mode-icon">🌐</span><strong>リモート</strong><span class="mode-desc">各自の端末で参加する方式。通信機能は開発準備中。</span></button></div>';
 if(phase==="mode-select")return '<span class="pill">'+(playStyle==="remote"?"🌐 リモート":"🤝 対面")+'</span><h2 style="margin-top:12px">モードを選ぶ</h2><p class="muted strong">どちらもGMが必要です。人数・難易度・トーク時間・進行操作は共通です。</p><div class="zg-mode-grid"><button type="button" class="zg-mode-card" data-act="simple"><span class="mode-icon">🎮</span><strong>シンプルモード</strong><span class="mode-desc">村人とゾロアークだけで遊ぶ基本ルール。</span></button><button type="button" class="zg-mode-card manual" data-act="manual"><span class="mode-icon">🎭</span><strong>マニュアルモード</strong><span class="mode-desc">基本ルールにミミッキュなどの追加役職を組み込む。</span></button></div>'+action('← 対面・リモート選択へ',"chooseStyle",true);
 if(phase==="setup")return '<span class="pill">'+(playStyle==="remote"?"🌐 リモート":"🤝 対面")+' · '+(gameMode==="manual"?"🎭 マニュアルモード":"🎮 シンプルモード")+' · ROUND '+(roundNo+1)+'</span><h2 style="margin-top:12px">ゲームを準備する</h2><div class="zg-hint">'+(gameMode==="manual"?'多数派とは異なるお題を受け取る人が1人います。役職も本人だけに知らせます。<br>役職とポケモン名は秘密。嘘やブラフもOK！':'多数派とは異なるお題を受け取る人が1人います。本人には少数派だと知らせません。<br>ポケモン名を言わずに話そう。嘘やブラフもOK！')+'</div><label class="zg-label">人数（GMを除く）</label><div class="zg-controls"><button class="zg-btn secondary" data-act="minus">−</button><strong>'+count+'</strong><button class="zg-btn secondary" data-act="plus">＋</button></div><p class="muted small center">推奨6〜8人（3〜12人）</p><label for="zg-level" class="zg-label">難易度</label><select class="zg-select" id="zg-level"><option value="all">おまかせ（42組）</option><option value="easy">初級（12組）</option><option value="normal">中級（15組）</option><option value="hard">上級（15組）</option></select><label for="zg-mode" class="zg-label">会話形式</label><select class="zg-select" id="zg-mode"><option value="free">自由トーク</option><option value="rounds">順番に2周</option></select><label for="zg-duration" class="zg-label">トーク時間</label><select class="zg-select" id="zg-duration"><option value="120">2分</option><option value="180">3分</option><option value="300">5分</option><option value="0">制限なし</option></select>'+(gameMode==="manual"?'<label class="zg-role-option"><input id="zg-mimikyu" type="checkbox"'+(enableMimikyu?' checked':'')+'>👻 ミミッキュ役を1名追加</label><div class="zg-hint">ミミッキュは多数派のお題を受け取り、自分が特別役職であることを知っています。誤って選ばれると単独勝利します。</div>':'')+(playStyle==="remote"?'<div class="zg-hint" role="status">🌐 リモート通信・個別のお題配布・遠隔投票は現在開発準備中です。まだゲームは開始できません。</div>':'')+(error?'<div class="notice err" role="alert">'+esc(error)+'</div>':'')+action(playStyle==="remote"?'リモート機能は準備中':busy?'CA権限を確認中…':'ゲームを開始する',"start",false,busy||playStyle==="remote")+action('← モード選択へ',"chooseMode",true);
 if(phase==="pass")return '<span class="pill">お題配布 '+(player+1)+' / '+round.count+'</span><h2 style="margin-top:12px">自分のお題を確認</h2><div class="zg-hint">プレイヤー'+(player+1)+'番だけが画面を見てください。次の人へ渡すときは必ず隠してください。</div><div class="zg-secret">'+(visible?privatePrompt():'<div style="font-size:56px">🔒</div><strong>本人だけが開いてね</strong>')+'</div>'+action(visible?'確認した・お題を隠す':'お題を見る',visible?'next':'show')+action('最初からやり直す','reset',true);
 if(phase==="talk")return '<span class="pill">🎤 '+(mode==="free"?"自由トーク":"順番に2周・"+talkRound+"周目")+'</span><h2 style="margin-top:12px">会話で探り合おう！</h2><p class="muted strong">全員に発言の機会を。うまく嘘を混ぜるのも作戦！</p><div class="zg-timer" data-clock>'+ (duration===0?'∞':fmt(remaining))+'</div><div class="zg-grid"><button data-act="timer" class="zg-btn secondary"'+(!duration?' disabled':'')+'>'+(running?'⏸ 一時停止':'▶ タイマー')+'</button><button data-act="extend" class="zg-btn secondary"'+(!duration?' disabled':'')+'>＋30秒</button><button data-act="topic" class="zg-btn secondary">🎤 別の話題</button><button data-act="talkRound" class="zg-btn secondary">🔁 次の周へ</button></div><div class="zg-hint">GM向けトーク補助：<strong>'+esc(topics[topic])+'</strong></div>'+action('指差し投票へ','vote');
 if(phase==="vote")return '<span class="pill">🗳️ 指差し投票</span><h2 style="margin-top:12px">ゾロアークは誰だ？</h2><p>せーので指差し！ 最多得票者をGMが選びます。同票なら決選投票をしてください。</p><div class="zg-votes">'+round.prompts.map((_,i)=>'<button data-vote="'+(i+1)+'" aria-pressed="'+(vote===i+1)+'">'+(i+1)+'番</button>').join("")+'</div>'+action('正体発表へ','results',false,vote===0)+action('トークに戻る','returnTalk',true);
 if(phase==="results")return reveal?'<h2>🦊 正体発表！</h2><div class="zg-reveal"><div class="zg-fox">🦊</div><p>ゾロアークは…</p><strong style="font-size:40px">'+(round.wolf+1)+'番！</strong></div><p class="zg-winner">'+(mimikyuIndex>=0&&vote===mimikyuIndex+1?'👻 ミミッキュの単独勝利！ （5点）':vote===round.wolf+1?(mimikyuIndex>=0?'🎉 多数派の勝利！ （1点）':'🎉 多数派の勝利！'):(mimikyuIndex>=0?'🎭 ゾロアークの勝利！ （2点）':'🎭 ゾロアークの勝利！'))+'</p>'+(mimikyuIndex>=0?'<p>ミミッキュ：<strong>'+(mimikyuIndex+1)+'番</strong></p>':'')+'<p>最多得票：<strong>'+vote+'番</strong></p><p>多数派：<strong>'+esc(round.majority)+'</strong><br>少数派：<strong>'+esc(round.minority)+'</strong></p><div class="zg-hint"><strong>共通点：</strong>'+esc(round.pair.common)+'<br><strong>違い：</strong>'+esc(round.pair.difference)+'</div>'+action(busy?'CA権限を確認中…':'次のゲームへ','start',false,busy)+action('人数設定に戻る','reset',true):'<h2>🎭 いよいよ正体発表！</h2><div class="zg-secret"><div style="font-size:60px">🦊</div><strong>みんなが画面を見たら公開</strong></div>'+action('🦊 正体を公開する','reveal');
 return '<p>ゲームを準備してください</p>';
 }
 function render(){if(destroyed)return;host.innerHTML=panel();const set=(id,v)=>{const e=host.querySelector(id);if(e)e.value=String(v)};if(phase==="setup"){set("#zg-level",level);set("#zg-mode",mode);set("#zg-duration",duration)}}
 const timer=window.setInterval(()=>{if(!destroyed&&phase==="talk"&&running&&duration){remaining=Math.max(0,Math.ceil((deadline-Date.now())/1000));const el=host.querySelector("[data-clock]");if(el)el.textContent=fmt(remaining);if(!remaining){running=false;render()}}},250);
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
   phase="pass";player=0;visible=false;remaining=duration;running=false;talkRound=1;topic=(topic+1)%topics.length;vote=0;reveal=false;
  }catch(e){if(!destroyed){error=e instanceof Error?e.message:"お題を取得できませんでした";phase="setup"}}
  finally{busy=false;render()}
 }
 function reset(){phase="setup";round=null;mimikyuIndex=-1;player=0;visible=false;running=false;vote=0;reveal=false;error="";render()}
 function chooseMode(){if(busy)return;phase="mode-select";gameMode=null;round=null;mimikyuIndex=-1;running=false;visible=false;error="";render()}
 function chooseStyle(){if(busy)return;phase="play-style";playStyle=null;gameMode=null;round=null;mimikyuIndex=-1;running=false;visible=false;error="";render()}
 function act(name){
  if(destroyed)return;
  if(name==="back"){destroy();onBack();return}
  if(name==="face-to-face"||name==="remote"){playStyle=name;phase="mode-select";render();return}
  if(name==="chooseStyle"){chooseStyle();return}
  if(name==="simple"||name==="manual"){gameMode=name;enableMimikyu=name==="manual";phase="setup";error="";render();return}
  if(name==="chooseMode"){chooseMode();return}
  if(name==="minus"){count=Math.max(3,count-1);render();return}
  if(name==="plus"){count=Math.min(12,count+1);render();return}
  if(name==="start"){void begin();return}
  if(name==="show"){visible=true;render();return}
  if(name==="next"){visible=false;if(player+1===round.count){phase="talk"}else player++;render();return}
  if(name==="timer"){if(duration===0)return;if(running){remaining=Math.max(0,Math.ceil((deadline-Date.now())/1000));running=false}else if(remaining>0){deadline=Date.now()+remaining*1000;running=true}render();return}
  if(name==="extend"){if(!duration)return;remaining+=30;if(running)deadline+=30000;render();return}
  if(name==="topic"){topic=(topic+1)%topics.length;render();return}
  if(name==="talkRound"){talkRound=talkRound===1?2:1;render();return}
  if(name==="vote"){running=false;phase="vote";render();return}
  if(name==="returnTalk"){phase="talk";render();return}
  if(name==="results"){if(vote){phase="results";reveal=false;render()}return}
  if(name==="reveal"){reveal=true;render();return}
  if(name==="reset"){reset()}
 }
 const click=event=>{const v=event.target.closest("[data-vote]");if(v&&host.contains(v)){vote=Number(v.dataset.vote);render();return}const b=event.target.closest("[data-act]");if(b&&host.contains(b)&&!b.disabled)act(b.dataset.act)};
 const change=event=>{if(event.target.id==="zg-level")level=event.target.value;if(event.target.id==="zg-mode")mode=event.target.value;if(event.target.id==="zg-duration"){duration=Number(event.target.value);remaining=duration}if(event.target.id==="zg-mimikyu")enableMimikyu=Boolean(event.target.checked)};
 const hidden=()=>{if(document.hidden&&phase==="pass"&&visible){visible=false;render()}};
 host.addEventListener("click",click);host.addEventListener("change",change);document.addEventListener("visibilitychange",hidden);
 function destroy(){if(destroyed)return;destroyed=true;clearInterval(timer);host.removeEventListener("click",click);host.removeEventListener("change",change);document.removeEventListener("visibilitychange",hidden)}
 render();
 return destroy;
}
