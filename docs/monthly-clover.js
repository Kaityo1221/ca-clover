(function(){
  "use strict";

  const COLORS=["#edf5dd","#d8edb4","#acd977","#67c567","#2f9f58"];
  const SCALES=[.82,.88,.94,1,1.06];
  const OPACITY=[.56,.76,.9,.97,1];
  const VEINS=[0,.08,.2,.32,.44];
  const AXES=[
    {key:"host",label:"開催",position:"上",icon:"🔥"},
    {key:"join",label:"参加",position:"右",icon:"✅"},
    {key:"exchange",label:"交流",position:"下",icon:"🤝"},
    {key:"continue",label:"継続",position:"左",icon:"🌱"}
  ];

  function clampStage(value){
    const n=Number(value)||0;
    return Math.max(0,Math.min(4,Math.round(n)));
  }
  function hostStage(count){return count<=0?0:count===1?1:count===2?2:count===3?3:4}
  function joinStage(count){return count<=0?0:count<5?1:count<15?2:count<30?3:4}
  function exchangeStage(count){return count<=0?0:count===1?1:count===2?2:count<5?3:4}
  function continueStage(count){return count<=0?0:count===1?1:count===2?2:count===3?3:4}

  function monthLabel(date){
    const d=date instanceof Date?date:new Date(date||Date.now());
    return d.getFullYear()+"."+String(d.getMonth()+1).padStart(2,"0");
  }

  function leafGroup(id,rotation,stage,key,label){
    const s=clampStage(stage),color=COLORS[s],scale=SCALES[s],opacity=OPACITY[s],vein=VEINS[s];
    return '<g id="'+id+'" class="ca-month-leaf ca-month-leaf-'+key+' stage-'+s+'" data-axis="'+key+'" data-stage="'+s+'" aria-label="'+label+' Stage '+s+'" style="--leaf-color:'+color+';--leaf-scale:'+scale+';--leaf-opacity:'+opacity+';--vein-opacity:'+vein+'" transform="rotate('+rotation+' 200 200)">'+
      '<g class="ca-month-leaf-scale"><use href="#caLeafShape" class="ca-month-leaf-fill"/><use href="#caLeafHighlight" class="ca-month-leaf-highlight"/><g class="ca-month-vein"><use href="#caLeafVeins"/></g></g></g>';
  }

  function svg(stages,options){
    stages=stages||{}; options=options||{};
    return '<svg class="ca-monthly-clover-svg" viewBox="0 0 400 400" role="img" aria-label="今月のClover">'+
      '<defs><filter id="caCloverShadow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="7" stdDeviation="7" flood-color="#315b35" flood-opacity=".15"/></filter><linearGradient id="caStemGradient" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#70bf58"/><stop offset="1" stop-color="#2f7f45"/></linearGradient><path id="caLeafShape" d="M200 197 C181 178 137 162 126 121 C114 78 143 49 177 58 C191 62 199 72 200 88 C201 72 209 62 223 58 C257 49 286 78 274 121 C263 162 219 178 200 197 Z"/><path id="caLeafHighlight" d="M199 188 C183 168 155 155 144 128 C134 104 144 79 165 71 C148 92 150 121 164 143 C174 159 188 170 199 188 Z"/><g id="caLeafVeins"><path d="M200 190 C200 161 199 128 200 89"/><path d="M200 151 C185 137 173 124 162 107"/><path d="M200 137 C215 126 227 113 238 96"/><path d="M200 167 C185 158 173 149 161 138"/><path d="M200 160 C215 151 228 142 240 130"/></g></defs>'+
      '<path class="ca-month-stem" d="M198 202 C190 238 179 274 161 308 C151 327 145 344 143 357"/><path class="ca-month-stem-hi" d="M195 211 C188 247 176 282 160 312"/>'+
      leafGroup("ca-leaf-top",0,stages.host,"host","開催")+
      leafGroup("ca-leaf-right",90,stages.join,"join","参加")+
      leafGroup("ca-leaf-bottom",180,stages.exchange,"exchange","交流")+
      leafGroup("ca-leaf-left",270,stages.continue,"continue","継続")+
      '</svg>';
  }

  function ensureStyle(){
    if(document.getElementById("caMonthlyCloverStyle"))return;
    const style=document.createElement("style");
    style.id="caMonthlyCloverStyle";
    style.textContent=`
      .ca-monthly-clover-card{position:relative;overflow:hidden;background:linear-gradient(145deg,#fffaf2,#fff,#f1f8eb);border:1px solid #eadfce;border-radius:28px;padding:20px;box-shadow:0 18px 46px rgba(89,103,68,.10)}
      .ca-monthly-clover-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap}
      .ca-monthly-clover-title{margin:0;color:#3f5f36;font-size:22px;font-weight:950}.ca-monthly-clover-month{font-size:12px;font-weight:950;color:#7b6b58;background:#fff7ea;border:1px solid #eadfce;border-radius:999px;padding:7px 10px}
      .ca-monthly-clover-body{display:grid;grid-template-columns:minmax(220px,360px) 1fr;align-items:center;gap:18px;margin-top:12px}.ca-monthly-clover-stage{min-width:0}.ca-monthly-clover-svg{width:100%;max-width:350px;display:block;margin:auto;overflow:visible}
      .ca-month-leaf{cursor:pointer;filter:url(#caCloverShadow)}.ca-month-leaf-scale{transform-box:fill-box;transform-origin:center;transform:scale(var(--leaf-scale));opacity:var(--leaf-opacity);transition:transform .45s cubic-bezier(.2,.8,.2,1),opacity .35s ease}.ca-month-leaf-fill{fill:var(--leaf-color);stroke:#4f9854;stroke-width:1.5;stroke-linejoin:round;transition:fill .45s ease}.ca-month-leaf-highlight{fill:#fff;opacity:.18}.ca-month-vein{fill:none;stroke:#245d38;stroke-width:1.4;stroke-linecap:round;opacity:var(--vein-opacity);transition:opacity .35s ease}.ca-month-stem{fill:none;stroke:url(#caStemGradient);stroke-width:12;stroke-linecap:round}.ca-month-stem-hi{fill:none;stroke:#b6e695;stroke-width:3;stroke-linecap:round;opacity:.62}
      .ca-month-leaf.is-flipping .ca-month-leaf-scale{animation:caCloverFlip .72s cubic-bezier(.22,.76,.25,1)}@keyframes caCloverFlip{0%{transform:scale(var(--leaf-scale)) scaleX(1)}43%{transform:scale(var(--leaf-scale)) scaleX(.08) translateY(-6px)}58%{transform:scale(calc(var(--leaf-scale) * 1.04)) scaleX(.18) translateY(-4px)}100%{transform:scale(var(--leaf-scale)) scaleX(1)}}
      .ca-monthly-clover-legend{display:grid;grid-template-columns:1fr 1fr;gap:9px}.ca-monthly-axis{border:1px solid #e7eadf;background:rgba(255,255,255,.86);border-radius:17px;padding:11px;text-align:left;cursor:pointer}.ca-monthly-axis b{display:block;color:#3f5f36;font-size:13px}.ca-monthly-axis span{display:block;color:#7b8792;font-size:11px;font-weight:800;margin-top:4px}.ca-monthly-axis .dots{display:flex;gap:4px;margin-top:8px}.ca-monthly-axis .dot{width:8px;height:8px;border-radius:50%;background:#dfe8d6}.ca-monthly-axis .dot.on{background:#5db85d}.ca-monthly-note{margin:10px 0 0;color:#7b8792;font-size:11px;font-weight:800;line-height:1.6}
      @media(max-width:680px){.ca-monthly-clover-card{padding:17px}.ca-monthly-clover-body{grid-template-columns:1fr;gap:8px}.ca-monthly-clover-stage{max-width:320px;margin:auto}.ca-monthly-clover-legend{grid-template-columns:1fr 1fr}.ca-monthly-clover-title{font-size:20px}}
    `;
    document.head.appendChild(style);
  }

  function axisHtml(axis,stage,detail){
    const s=clampStage(stage);
    let dots="";for(let i=1;i<=4;i++)dots+='<i class="dot '+(i<=s?'on':'')+'"></i>';
    return '<button type="button" class="ca-monthly-axis" data-clover-axis="'+axis.key+'"><b>'+axis.icon+' '+axis.label+'</b><span>'+String(detail||"まだ記録はありません")+'</span><span class="dots" aria-label="成長段階 '+s+' / 4">'+dots+'</span></button>';
  }

  function cardHtml(model){
    ensureStyle(); model=model||{}; const stages=model.stages||{}; const details=model.details||{};
    return '<section class="ca-monthly-clover-card" data-monthly-clover="1"><div class="ca-monthly-clover-head"><div><div style="font-size:11px;font-weight:950;color:#8e7758;letter-spacing:.08em">MONTHLY CLOVER</div><h2 class="ca-monthly-clover-title">今月のClover 🍀</h2></div><span class="ca-monthly-clover-month">'+monthLabel(model.date)+'</span></div><div class="ca-monthly-clover-body"><div class="ca-monthly-clover-stage">'+svg(stages)+'</div><div><div class="ca-monthly-clover-legend">'+AXES.map(a=>axisHtml(a,stages[a.key],details[a.key])).join("")+'</div><p class="ca-monthly-note">4枚の葉は「開催・参加・交流・継続」。その月の活動に合わせて、それぞれ別々に育ちます。</p></div></div></section>';
  }

  function flip(root,key){
    if(!root)return;
    const leaf=root.querySelector('[data-axis="'+key+'"]');
    if(!leaf)return;
    leaf.classList.remove("is-flipping"); void leaf.getBoundingClientRect(); leaf.classList.add("is-flipping");
    setTimeout(()=>leaf.classList.remove("is-flipping"),780);
  }

  function stagesFromMetrics(metrics){
    metrics=metrics||{};
    return {host:hostStage(Number(metrics.meetups)||0),join:joinStage(Number(metrics.checkins)||0),exchange:exchangeStage(Number(metrics.exchanges)||0),continue:continueStage(Number(metrics.activeWeeks)||0)};
  }

  window.CAMonthlyClover={AXES,COLORS,hostStage,joinStage,exchangeStage,continueStage,stagesFromMetrics,monthLabel,svg,cardHtml,flip,ensureStyle};
})();
