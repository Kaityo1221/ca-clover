(function(){
"use strict";
const STYLE_ID="caCommunityMinigamesPlaceholderStyle";
const GAME_ITEMS=[
 ["✨","ゲットチャレンジ","色違い・100%・背景・CP下一桁など"],
 ["❓","クイズ","タイプクイズ・GBL・自由問題"],
 ["⏳","タイムチャレンジ","制限時間内の捕獲など"],
 ["📸","AR・写真チャレンジ","推しポケ・証拠写真"],
 ["🔍","探索ゲーム","CAを探せ・指定場所を巡る"],
 ["🏆","ランキング","XXS / XXL・重さ・CP・タイムなど"],
 ["🤝","グループゲーム","並び替え・ジェスチャーなど"],
 ["⚔️","レイドチャレンジ","色違い・背景・100%など"]
];
const TOOL_ITEMS=[
 ["⏱️","ストップウォッチ","経過時間を測る"],
 ["⏳","タイマー","制限時間・カウントダウン"],
 ["🎲","数字抽選","0〜9などをランダム決定"],
 ["🎰","ルーレット・抽選","当選者・景品を決める"],
 ["🔢","カウンター","参加者・達成者を数える"],
 ["🎁","景品カウンター","景品残数を管理"],
 ["🏆","ランキング","数値から順位付け"],
 ["👥","チーム分け","ランダムにグループ分け"],
 ["📝","お題表示","ジェスチャー・クイズ等"],
 ["📋","告知文メーカー","Campfire用文章を作る"]
];
function ensureStyle(){
 if(document.getElementById(STYLE_ID))return;
 const style=document.createElement("style");style.id=STYLE_ID;
 style.textContent=`
.community-hub-layout{position:relative}
.community-hub-layout>.community-minigames-btn{position:absolute;right:0;top:0;z-index:4;min-width:132px;height:46px;border:1px solid #fdba74;border-radius:18px;background:linear-gradient(145deg,#fff7ed,#ffedd5);box-shadow:0 6px 16px rgba(194,65,12,.12);color:#9a3412;font-weight:950;font-size:12px;display:flex;align-items:center;justify-content:center;gap:6px;padding:0 12px;white-space:nowrap}
.community-hub-layout>.community-minigames-btn:active{transform:translateY(1px)}
.community-minigames-btn .game-icon{font-size:18px;line-height:1}
.ca-minigames-view{max-width:920px;margin:0 auto}
.ca-minigames-head{display:flex;align-items:flex-start;gap:12px}
.ca-minigames-back{border:0;background:#f7fee7;color:#4d7c0f;border-radius:999px;padding:10px 14px;font-weight:950}
.ca-minigames-lead{margin:8px 0 0;color:#64748b;font-weight:800}
.ca-minigames-entry-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-top:18px}
.ca-minigames-entry{border:1px solid #ecfccb;border-radius:24px;padding:22px;background:#fff;text-align:left;box-shadow:0 10px 28px rgba(77,124,15,.07)}
.ca-minigames-entry.orange{border-color:#fed7aa;background:linear-gradient(145deg,#fff,#fff7ed)}
.ca-minigames-entry.green{background:linear-gradient(145deg,#fff,#f7fee7)}
.ca-minigames-entry-icon{font-size:32px;line-height:1}
.ca-minigames-entry h2{margin-top:12px}
.ca-minigames-entry p{margin:7px 0 0;color:#64748b;font-size:13px;font-weight:800}
.ca-minigames-list-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:20px}
.ca-minigames-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:12px}
.ca-minigames-item{border:1px solid #e2e8f0;border-radius:18px;padding:15px;background:#fff;text-align:left;display:flex;gap:12px;align-items:flex-start}
.ca-minigames-item:disabled{opacity:1;cursor:default}
.ca-minigames-item-icon{font-size:24px;line-height:1.1}
.ca-minigames-item-title{font-weight:950;color:#365314}
.ca-minigames-item-desc{margin-top:4px;color:#64748b;font-size:11px;font-weight:800;line-height:1.5}
.ca-minigames-soon{display:inline-flex;margin-top:7px;border-radius:999px;background:#f1f5f9;color:#64748b;padding:4px 8px;font-size:9px;font-weight:950}
@media(max-width:760px){.ca-minigames-entry-grid,.ca-minigames-list{grid-template-columns:1fr}.ca-minigames-entry{padding:18px}}
@media(max-width:480px){.community-hub-layout>.community-minigames-btn{min-width:124px;height:42px;padding:0 10px}.community-hub-layout>.community-minigames-btn+div .community-hero-row>div:last-child{min-width:0}.community-hub-layout>.community-minigames-btn+div .community-hero-row h1{font-size:clamp(25px,8.2vw,34px);line-height:1.05;overflow-wrap:normal;word-break:normal}.ca-minigames-head{display:block}.ca-minigames-back{margin-bottom:14px}}
`;
 document.head.appendChild(style);
}
function itemHtml(item){
 return '<button type="button" class="ca-minigames-item" disabled><span class="ca-minigames-item-icon">'+item[0]+'</span><span><span class="ca-minigames-item-title">'+item[1]+'</span><span class="ca-minigames-item-desc">'+item[2]+'</span><span class="ca-minigames-soon">準備中</span></span></button>';
}
function renderList(kind){
 const games=kind==="games",items=games?GAME_ITEMS:TOOL_ITEMS;
 const app=document.getElementById("app");if(!app)return;
 app.innerHTML='<div class="ca-minigames-view"><section class="card hero"><div class="ca-minigames-head"><button type="button" class="ca-minigames-back">← ミニゲーム集</button><div><span class="pill">'+(games?'GAME LIST':'TOOLS')+'</span><h1 style="margin-top:10px">'+(games?'🎮 ミニゲーム一覧':'🧰 ツール')+'</h1><p class="ca-minigames-lead">'+(games?'すぐ使えるゲームの候補です。':'ゲームづくりに使える道具の候補です。')+'</p></div></div></section><div class="ca-minigames-list">'+items.map(itemHtml).join("")+'</div></div>';
 app.querySelector(".ca-minigames-back").onclick=function(){renderHub()};
 window.scrollTo({top:0,behavior:"auto"});
}
function renderHub(){
 const app=document.getElementById("app");if(!app)return;
 app.innerHTML='<div class="ca-minigames-view"><section class="card hero"><button type="button" class="ca-minigames-back">← Communityへ戻る</button><span class="pill" style="margin-left:8px">MINI GAMES</span><h1 style="margin-top:14px">🎮 ミニゲーム集</h1><p class="ca-minigames-lead">Meetupを、ちょっと楽しく。</p></section><div class="ca-minigames-entry-grid"><button type="button" class="ca-minigames-entry orange" data-kind="games"><div class="ca-minigames-entry-icon">🎮</div><h2>ミニゲーム一覧</h2><p>すぐ使えるゲームから選ぶ　›</p></button><button type="button" class="ca-minigames-entry green" data-kind="tools"><div class="ca-minigames-entry-icon">🧰</div><h2>ツール</h2><p>ゲームづくりに使える道具　›</p></button></div></div>';
 app.querySelector('[data-kind="games"]').onclick=function(){renderList("games")};
 app.querySelector('[data-kind="tools"]').onclick=function(){renderList("tools")};
 app.querySelector(".ca-minigames-back").onclick=function(){history.back()};
 window.scrollTo({top:0,behavior:"auto"});
}
function install(){
 if((location.hash||"").indexOf("#community:")!==0)return;
 const hub=document.querySelector(".community-hub-layout");
 if(!hub||hub.querySelector(".community-minigames-btn"))return;
 ensureStyle();
 const button=document.createElement("button");button.type="button";button.className="community-minigames-btn";button.setAttribute("aria-label","ミニゲーム集");
 button.innerHTML='<span class="game-icon">🎮</span><span>ミニゲーム集</span><span aria-hidden="true">›</span>';
 button.addEventListener("click",function(){renderHub()});
 hub.insertBefore(button,hub.firstChild);
}
ensureStyle();
let timer=0;function schedule(){clearTimeout(timer);timer=setTimeout(install,80)}
new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
window.addEventListener("hashchange",schedule);
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",schedule,{once:true});else schedule();
})();