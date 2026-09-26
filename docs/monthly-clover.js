(function(){
  "use strict";

  const COLORS=["#edf6db","#d6efa8","#a9de62","#68c94f","#38ad4c"];
  const SCALES=[.84,.90,.95,1,1.035];
  const OPACITY=[.48,.70,.86,.96,1];
  const VEINS=[.05,.14,.28,.43,.58];
  const GLOSS=[.20,.28,.36,.44,.52];
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
    const s=clampStage(stage),scale=SCALES[s],opacity=OPACITY[s],vein=VEINS[s],gloss=GLOSS[s];
    const dew=(key==="join"&&s>=4)
      ?'<g class="ca-month-dew" aria-hidden="true"><circle cx="236" cy="115" r="11"/><ellipse cx="232" cy="110" rx="4.2" ry="3.2" class="ca-month-dew-hi"/></g>'
      :'';
    return '<g id="'+id+'" class="ca-month-leaf ca-month-leaf-'+key+' stage-'+s+'" data-axis="'+key+'" data-stage="'+s+'" aria-label="'+label+' Stage '+s+'" style="--leaf-scale:'+scale+';--leaf-opacity:'+opacity+';--vein-opacity:'+vein+';--gloss-opacity:'+gloss+'" transform="rotate('+rotation+' 200 200)">'+
      '<g class="ca-month-leaf-scale">'+
        '<use href="#caLeafShape" class="ca-month-leaf-fill stage-fill-'+s+'"/>'+
        '<use href="#caLeafShape" class="ca-month-leaf-texture"/>'+
        '<use href="#caLeafShape" class="ca-month-leaf-shade"/>'+
        '<use href="#caLeafLightPatch" class="ca-month-leaf-light"/>'+
        '<use href="#caLeafSoftSpec" class="ca-month-leaf-spec"/>'+
        '<g class="ca-month-vein"><use href="#caLeafVeins"/></g>'+dew+
      '</g></g>';
  }

  function svg(stages,options){
    stages=stages||{}; options=options||{};
    return '<svg class="ca-monthly-clover-svg" viewBox="0 0 400 400" role="img" aria-label="今月のClover">'+
      '<defs>'+
        '<filter id="caCloverShadow" x="-40%" y="-40%" width="180%" height="190%"><feDropShadow dx="0" dy="7" stdDeviation="7" flood-color="#2f6a35" flood-opacity=".14"/></filter>'+
        '<filter id="caLeafTextureFilter" x="-15%" y="-15%" width="130%" height="130%"><feTurbulence type="fractalNoise" baseFrequency=".035" numOctaves="2" seed="17" result="noise"/><feComposite in="noise" in2="SourceAlpha" operator="in" result="texture"/><feColorMatrix in="texture" type="matrix" values=".55 0 0 0 .18  0 .72 0 0 .28  0 0 .45 0 .12  0 0 0 .18 0" result="tinted"/><feBlend in="SourceGraphic" in2="tinted" mode="soft-light"/></filter>'+
        '<filter id="caCloverBlur"><feGaussianBlur stdDeviation="5.5"/></filter>'+
        '<linearGradient id="caStemGradient" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#b8ef6f"/><stop offset=".42" stop-color="#6fca45"/><stop offset=".78" stop-color="#3a963e"/><stop offset="1" stop-color="#237039"/></linearGradient>'+
        '<linearGradient id="caStage0" x1="8%" y1="7%" x2="92%" y2="94%"><stop offset="0" stop-color="#f1f8df"/><stop offset=".48" stop-color="#deedc4"/><stop offset="1" stop-color="#c7dfaa"/></linearGradient>'+
        '<linearGradient id="caStage1" x1="8%" y1="7%" x2="92%" y2="94%"><stop offset="0" stop-color="#e5f6bd"/><stop offset=".48" stop-color="#c7e88e"/><stop offset="1" stop-color="#9dce69"/></linearGradient>'+
        '<linearGradient id="caStage2" x1="8%" y1="7%" x2="92%" y2="94%"><stop offset="0" stop-color="#ccf07c"/><stop offset=".48" stop-color="#9edb58"/><stop offset="1" stop-color="#65b84d"/></linearGradient>'+
        '<linearGradient id="caStage3" x1="8%" y1="7%" x2="92%" y2="94%"><stop offset="0" stop-color="#b9ed60"/><stop offset=".46" stop-color="#70cf4c"/><stop offset="1" stop-color="#2f9d47"/></linearGradient>'+
        '<linearGradient id="caStage4" x1="8%" y1="7%" x2="92%" y2="94%"><stop offset="0" stop-color="#aee94f"/><stop offset=".44" stop-color="#56c747"/><stop offset=".78" stop-color="#2cac49"/><stop offset="1" stop-color="#208640"/></linearGradient>'+
        '<radialGradient id="caLeafSoftLight" cx="26%" cy="18%" r="72%"><stop offset="0" stop-color="#fff" stop-opacity=".78"/><stop offset=".22" stop-color="#f6ffd7" stop-opacity=".45"/><stop offset=".54" stop-color="#fff" stop-opacity=".08"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>'+
        '<linearGradient id="caLeafShade" x1="12%" y1="7%" x2="89%" y2="96%"><stop offset="0" stop-color="#173f25" stop-opacity="0"/><stop offset=".62" stop-color="#1d5e31" stop-opacity=".025"/><stop offset="1" stop-color="#12462a" stop-opacity=".23"/></linearGradient>'+
        '<radialGradient id="caDew" cx="34%" cy="24%" r="76%"><stop offset="0" stop-color="#fff" stop-opacity=".98"/><stop offset=".2" stop-color="#efffdc" stop-opacity=".72"/><stop offset=".58" stop-color="#bde892" stop-opacity=".45"/><stop offset="1" stop-color="#438b56" stop-opacity=".25"/></radialGradient>'+
        '<path id="caLeafShape" d="M200 199 C181 182 153 168 136 145 C116 118 121 86 145 70 C165 57 187 65 199 88 C201 92 202 96 202 100 C202 96 203 92 205 88 C217 65 239 57 259 70 C283 86 288 118 268 145 C251 168 219 184 200 199 Z"/>'+
        '<path id="caLeafLightPatch" d="M195 191 C176 176 151 161 139 142 C126 123 125 99 138 83 C148 70 166 66 181 73 C163 82 153 99 154 118 C156 145 174 169 195 191 Z"/>'+
        '<path id="caLeafSoftSpec" d="M151 89 C164 78 180 76 191 84 C177 83 165 90 158 101 C153 109 149 119 148 131 C141 115 142 99 151 89 Z"/>'+
        '<g id="caLeafVeins"><path d="M200 191 C199 170 199 145 200 119 C200 110 201 102 202 96"/><path d="M199 166 C185 156 173 146 162 133"/><path d="M199 151 C184 141 171 128 160 114"/><path d="M199 136 C185 126 176 116 168 104"/><path d="M201 166 C216 156 229 146 240 133"/><path d="M201 151 C216 141 230 128 241 114"/><path d="M201 136 C216 126 225 116 233 104"/><path d="M198 177 C181 171 165 163 151 153"/><path d="M202 177 C219 171 235 163 249 153"/></g>'+
      '</defs>'+
      '<path class="ca-month-stem" d="M199 203 C190 237 176 273 160 307 C149 331 143 349 143 361"/><path class="ca-month-stem-hi" d="M195 211 C188 242 177 275 162 308"/>'+
      leafGroup("ca-leaf-top",0,stages.host,"host","開催")+
      leafGroup("ca-leaf-right",90,stages.join,"join","参加")+
      leafGroup("ca-leaf-bottom",180,stages.exchange,"exchange","交流")+
      leafGroup("ca-leaf-left",270,stages.continue,"continue","継続")+
      '<circle class="ca-month-center" cx="200" cy="200" r="7.5"/>'+
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
      .ca-month-leaf-scale{transform-box:fill-box;transform-origin:50% 96%;transform:scale(var(--leaf-scale));opacity:var(--leaf-opacity);transition:transform .48s cubic-bezier(.2,.8,.2,1),opacity .35s ease}
      .ca-month-leaf-fill{stroke:#2b8c42;stroke-width:.72;stroke-opacity:.34;stroke-linejoin:round}
      .ca-month-leaf-fill.stage-fill-0{fill:url(#caStage0)}.ca-month-leaf-fill.stage-fill-1{fill:url(#caStage1)}.ca-month-leaf-fill.stage-fill-2{fill:url(#caStage2)}.ca-month-leaf-fill.stage-fill-3{fill:url(#caStage3)}.ca-month-leaf-fill.stage-fill-4{fill:url(#caStage4)}
      .ca-month-leaf-texture{fill:rgba(255,255,255,.02);filter:url(#caLeafTextureFilter);opacity:.72}
      .ca-month-leaf-shade{fill:url(#caLeafShade);opacity:.88}
      .ca-month-leaf-light{fill:url(#caLeafSoftLight);opacity:calc(.55 * var(--gloss-opacity))}
      .ca-month-leaf-spec{fill:#fff;opacity:calc(.18 * var(--gloss-opacity));filter:url(#caCloverBlur)}
      .ca-month-vein{fill:none;stroke:#e7f5a7;stroke-width:1.05;stroke-linecap:round;stroke-linejoin:round;opacity:var(--vein-opacity);transition:opacity .35s ease}.stage-4 .ca-month-vein{stroke-width:1.12}.stage-0 .ca-month-vein{stroke:#b5cf92}
      .ca-month-stem{fill:none;stroke:url(#caStemGradient);stroke-width:9;stroke-linecap:round;filter:url(#caCloverShadow)}.ca-month-stem-hi{fill:none;stroke:#dcf7a2;stroke-width:1.8;stroke-linecap:round;opacity:.78}
      .ca-month-center{fill:#5ebc43;stroke:#d9ef8b;stroke-width:1.3;filter:url(#caCloverShadow)}
      .ca-month-dew circle{fill:url(#caDew);stroke:#fff;stroke-width:.9;stroke-opacity:.8}.ca-month-dew-hi{fill:#fff;opacity:.9;filter:url(#caCloverBlur)}
      .ca-month-leaf.is-flipping .ca-month-leaf-scale{animation:caCloverFlip .76s cubic-bezier(.22,.76,.25,1)}
      @keyframes caCloverFlip{0%{transform:scale(var(--leaf-scale)) rotateX(0deg)}42%{transform:scale(var(--leaf-scale)) rotateX(82deg) translateY(-5px)}58%{transform:scale(calc(var(--leaf-scale) * 1.035)) rotateX(98deg) translateY(-4px)}100%{transform:scale(var(--leaf-scale)) rotateX(180deg)}}
      .ca-monthly-clover-legend{display:grid;grid-template-columns:1fr 1fr;gap:9px}.ca-monthly-axis{border:1px solid #e5e7eb;background:rgba(255,255,255,.9);border-radius:18px;padding:12px;text-align:left;cursor:pointer;box-shadow:0 4px 12px rgba(75,85,99,.035)}.ca-monthly-axis b{display:block;color:#355c30;font-size:13px}.ca-monthly-axis span{display:block;color:#748092;font-size:11px;font-weight:800;margin-top:4px}.ca-monthly-axis .dots{display:flex;gap:5px;margin-top:8px}.ca-monthly-axis .dot{width:9px;height:9px;border-radius:50%;background:#e5eadf}.ca-monthly-axis .dot.on{background:#57b95d}.ca-monthly-note{margin:10px 0 0;color:#7b8792;font-size:11px;font-weight:800;line-height:1.6}
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
