(function(){
  "use strict";

  const COLORS=["#edf4d8","#d9edaa","#a8df67","#65cb55","#2fab58"];
  const SCALES=[.86,.91,.96,1,1.04];
  const OPACITY=[.52,.72,.88,.97,1];
  const VEINS=[0,.06,.16,.24,.31];
  const GLOSS=[.44,.58,.72,.86,1];
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
    const s=clampStage(stage),color=COLORS[s],scale=SCALES[s],opacity=OPACITY[s],vein=VEINS[s],gloss=GLOSS[s];
    return '<g id="'+id+'" class="ca-month-leaf ca-month-leaf-'+key+' stage-'+s+'" data-axis="'+key+'" data-stage="'+s+'" aria-label="'+label+' Stage '+s+'" style="--leaf-color:'+color+';--leaf-scale:'+scale+';--leaf-opacity:'+opacity+';--vein-opacity:'+vein+';--gloss-opacity:'+gloss+'" transform="rotate('+rotation+' 200 200)">'+
      '<g class="ca-month-leaf-scale">'+
        '<use href="#caLeafShape" class="ca-month-leaf-fill"/>'+
        '<use href="#caLeafShape" class="ca-month-leaf-shade"/>'+
        '<use href="#caLeafShape" class="ca-month-leaf-gloss"/>'+
        '<use href="#caLeafGlowPatch" class="ca-month-leaf-warm"/>'+
        '<use href="#caLeafSoftSpec" class="ca-month-leaf-spec"/>'+
        '<g class="ca-month-vein"><use href="#caLeafVeins"/></g>'+
      '</g></g>';
  }

  function svg(stages,options){
    stages=stages||{}; options=options||{};
    return '<svg class="ca-monthly-clover-svg" viewBox="0 0 400 400" role="img" aria-label="今月のClover">'+
      '<defs>'+
        '<filter id="caCloverShadow" x="-35%" y="-35%" width="170%" height="180%"><feDropShadow dx="0" dy="8" stdDeviation="8" flood-color="#315b35" flood-opacity=".18"/></filter>'+
        '<filter id="caCloverBlur"><feGaussianBlur stdDeviation="7"/></filter>'+
        '<linearGradient id="caStemGradient" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#92df63"/><stop offset=".52" stop-color="#58b84d"/><stop offset="1" stop-color="#267b43"/></linearGradient>'+
        '<radialGradient id="caLeafGloss" cx="31%" cy="23%" r="62%"><stop offset="0" stop-color="#fff" stop-opacity=".74"/><stop offset=".24" stop-color="#f4ffd8" stop-opacity=".48"/><stop offset=".58" stop-color="#fff" stop-opacity=".10"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>'+
        '<linearGradient id="caLeafShade" x1="15%" y1="10%" x2="85%" y2="92%"><stop offset="0" stop-color="#214c31" stop-opacity="0"/><stop offset=".6" stop-color="#275d35" stop-opacity=".035"/><stop offset="1" stop-color="#16472b" stop-opacity=".22"/></linearGradient>'+
        '<path id="caLeafShape" d="M200 199 C188 187 164 175 145 157 C121 134 116 101 135 79 C151 61 176 59 190 74 C196 80 199 88 200 98 C201 88 204 80 210 74 C224 59 249 61 265 79 C284 101 279 134 255 157 C236 175 212 187 200 199 Z"/>'+
        '<path id="caLeafGlowPatch" d="M196 190 C181 176 158 163 145 145 C132 126 129 103 139 88 C149 74 165 68 180 73 C164 83 155 100 157 119 C160 147 179 169 196 190 Z"/>'+
        '<path id="caLeafSoftSpec" d="M170 86 C182 78 191 80 198 91 C188 88 180 93 174 102 C169 110 166 119 165 128 C158 111 159 95 170 86 Z"/>'+
        '<g id="caLeafVeins"><path d="M200 191 C200 163 200 132 200 99"/><path d="M200 153 C185 141 174 129 164 114"/><path d="M200 138 C215 127 226 115 237 99"/><path d="M200 169 C184 160 171 151 159 139"/><path d="M200 161 C215 152 229 143 241 132"/></g>'+
      '</defs>'+
      '<path class="ca-month-stem" d="M198 202 C191 236 181 271 164 307 C154 328 149 344 148 358"/><path class="ca-month-stem-hi" d="M195 211 C190 244 179 280 164 312"/>'+
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
      .ca-month-leaf{cursor:pointer;filter:url(#caCloverShadow)}
      .ca-month-leaf-scale{transform-box:fill-box;transform-origin:center;transform:scale(var(--leaf-scale));opacity:var(--leaf-opacity);transition:transform .48s cubic-bezier(.2,.8,.2,1),opacity .35s ease}
      .ca-month-leaf-fill{fill:var(--leaf-color);stroke:#368c49;stroke-width:.85;stroke-opacity:.38;stroke-linejoin:round;transition:fill .48s ease}
      .ca-month-leaf-shade{fill:url(#caLeafShade);opacity:.9}
      .ca-month-leaf-gloss{fill:url(#caLeafGloss);opacity:calc(.72 * var(--gloss-opacity))}
      .ca-month-leaf-warm{fill:#f2ff9b;opacity:calc(.12 * var(--gloss-opacity))}
      .ca-month-leaf-spec{fill:#fff;opacity:calc(.13 * var(--gloss-opacity));filter:url(#caCloverBlur)}
      .ca-month-vein{fill:none;stroke:#2d6c3b;stroke-width:1.15;stroke-linecap:round;opacity:var(--vein-opacity);transition:opacity .35s ease}
      .ca-month-stem{fill:none;stroke:url(#caStemGradient);stroke-width:10;stroke-linecap:round}.ca-month-stem-hi{fill:none;stroke:#d8f5a7;stroke-width:2.1;stroke-linecap:round;opacity:.72}
      .ca-month-leaf.is-flipping .ca-month-leaf-scale{animation:caCloverFlip .76s cubic-bezier(.22,.76,.25,1)}
      @keyframes caCloverFlip{0%{transform:scale(var(--leaf-scale)) rotateX(0deg)}42%{transform:scale(var(--leaf-scale)) rotateX(82deg) translateY(-5px)}58%{transform:scale(calc(var(--leaf-scale) * 1.035)) rotateX(98deg) translateY(-4px)}100%{transform:scale(var(--leaf-scale)) rotateX(180deg)}}
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
    setTimeout(()=>leaf.classList.remove("is-flipping"),800);
  }

  function stagesFromMetrics(metrics){
    metrics=metrics||{};
    return {host:hostStage(Number(metrics.meetups)||0),join:joinStage(Number(metrics.checkins)||0),exchange:exchangeStage(Number(metrics.exchanges)||0),continue:continueStage(Number(metrics.activeWeeks)||0)};
  }

  window.CAMonthlyClover={AXES,COLORS,hostStage,joinStage,exchangeStage,continueStage,stagesFromMetrics,monthLabel,svg,cardHtml,flip,ensureStyle};
})();
