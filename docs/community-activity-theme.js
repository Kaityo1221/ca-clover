(function(){
  "use strict";

  // Presentation only. Period controls, RPC results and SVG geometry stay intact.
  const STYLE_ID="caCommunityActivityTheme";
  const decoratedHeads=new WeakSet();
  const decoratedPanels=new WeakSet();
  let observedChart=null;
  const chartObserver=new ResizeObserver(function(){fitChartLabels()});

  function fitChartLabels(){
    if(!observedChart)return;
    const width=observedChart.getBoundingClientRect().width;
    if(!width)return;
    const scale=String(observedChart.viewBox.baseVal.width/width);
    if(observedChart.style.getPropertyValue("--activity-label-scale")!==scale){
      observedChart.style.setProperty("--activity-label-scale",scale);
    }
    // Keep every original tick readable. Use two text rows only when adjacent
    // labels would overlap; their values and horizontal positions stay put.
    const ticks=Array.from(observedChart.querySelectorAll('text[text-anchor="middle"]'));
    let stagger=false;
    for(let i=1;i<ticks.length;i++){
      const gap=(Number(ticks[i].getAttribute("x"))-Number(ticks[i-1].getAttribute("x")))/Number(scale);
      const textWidth=(ticks[i].getBBox().width+ticks[i-1].getBBox().width)/2;
      if(gap<textWidth+3)stagger=true;
    }
    ticks.forEach(function(tick,i){
      const offset=stagger&&i%2?"18px":"0px";
      if(tick.style.getPropertyValue("--activity-tick-offset")!==offset){
        tick.style.setProperty("--activity-tick-offset",offset);
      }
    });
  }

  function ensureStyle(){
    if(document.getElementById(STYLE_ID))return;
    const style=document.createElement("style");
    style.id=STYLE_ID;
    style.textContent=`
      .ca-activity-head,.ca-activity-panel{
        --activity-primary:#388DA8;--activity-light:#79BFD8;--activity-heading:#34505A;
        --activity-body:#71858D;--activity-border:#DDEEF5;
        min-width:0;max-width:100%;color:var(--activity-body);
        border-color:var(--activity-border);box-shadow:0 4px 16px rgba(52,80,90,.035);
      }
      [data-activity-theme-hero],[data-activity-theme-trend],[data-activity-theme-legend]{display:none}
      .ca-activity-head{
        position:relative;isolation:isolate;overflow:hidden;padding:32px;
        background:linear-gradient(120deg,#EDF7FC 0%,#F7FBFE 60%,#DDEEF5 100%);
      }
      .ca-activity-head::before,.ca-activity-head::after{
        content:"";position:absolute;z-index:-1;border-radius:50%;pointer-events:none;
        border:1px solid rgba(121,191,216,.2);background:rgba(121,191,216,.08);
      }
      .ca-activity-head::before{width:220px;height:220px;right:0;top:-85px}
      .ca-activity-head::after{width:140px;height:140px;right:85px;top:-75px;background:transparent}
      .ca-activity-head .feature-page-head{display:block}
      .ca-activity-head .ca-activity-original-title,
      .ca-activity-panel .ca-activity-original-title,
      .ca-activity-panel .ca-activity-original-legend{display:none}
      .ca-activity-head [data-activity-theme-hero]{display:block;position:relative}
      .ca-activity-eyebrow{color:var(--activity-primary);font-size:11px;font-weight:800;letter-spacing:.18em}
      .ca-activity-head .ca-activity-title{
        margin:12px 0 0;color:var(--activity-heading);font-size:clamp(24px,4vw,34px);
        font-weight:800;line-height:1.4;letter-spacing:-.025em;overflow-wrap:anywhere;
      }
      .ca-activity-description{margin:12px 0 0;font-size:13px;line-height:1.85;font-weight:500}
      .ca-activity-head .periodbar{
        display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:4px;
        width:100%;max-width:520px;margin-top:26px!important;padding:5px;
        border:1px solid var(--activity-border);border-radius:14px;background:rgba(255,255,255,.8);
      }
      .ca-activity-head .periodbtn{
        min-width:0;width:100%;min-height:44px;padding:10px 2px;border:1px solid transparent;
        border-radius:10px;background:transparent;color:var(--activity-heading);
        font-size:13px;line-height:1.2;font-weight:700;
      }
      .ca-activity-head .periodbtn.active{background:var(--activity-primary);color:#fff;border-color:var(--activity-primary)}
      .ca-activity-head .periodbtn:not(.active):hover{background:#EDF7FC}
      .ca-activity-head .periodbtn:focus-visible{outline:2px solid var(--activity-heading);outline-offset:2px}
      .ca-activity-panel{padding:28px;background:#F7FBFE}
      .ca-activity-panel [data-activity-theme-trend]{display:block}
      .ca-activity-panel [data-activity-theme-trend] h3{margin-top:9px;font-size:21px;line-height:1.5;color:var(--activity-heading)}
      .ca-activity-panel [data-activity-theme-trend] p{margin:8px 0 0;font-size:12px;line-height:1.8;font-weight:500}
      .ca-activity-panel .ca-activity-unit{
        margin:16px 0 0;padding:10px 12px;border:1px solid var(--activity-border);border-radius:10px;
        background:#EDF7FC;color:var(--activity-body);font-size:11px;font-weight:500;line-height:1.8;
      }
      .ca-activity-panel [data-activity-theme-legend]{
        display:flex;flex-wrap:wrap;gap:12px 22px;margin-top:22px;color:var(--activity-heading);font-size:12px;font-weight:600;
      }
      .ca-activity-panel [data-activity-theme-legend] span{display:inline-flex;align-items:center;gap:8px;line-height:1.7}
      .ca-activity-key-bars::before{
        content:"";width:18px;height:14px;border-radius:2px;
        background:repeating-linear-gradient(90deg,var(--activity-light) 0 4px,transparent 4px 6px);
      }
      .ca-activity-key-line::before{content:"";width:18px;height:3px;border-radius:3px;background:var(--activity-primary)}
      .ca-activity-panel .trendbox{
        min-width:0;max-width:100%;overflow:hidden;border-color:var(--activity-border);
        border-radius:16px;padding:18px 28px;background:#fff;
      }
      .ca-activity-panel .trendsvg{display:block;width:100%;max-width:100%;min-width:0!important;height:290px;overflow:visible}
      .ca-activity-panel .trendsvg rect[rx]{fill:var(--activity-light)}
      .ca-activity-panel .trendsvg polyline{stroke:var(--activity-primary);vector-effect:non-scaling-stroke}
      .ca-activity-panel .trendsvg circle{fill:var(--activity-primary);stroke:var(--activity-primary);stroke-width:1px;vector-effect:non-scaling-stroke}
      .ca-activity-panel .trendsvg line{stroke:var(--activity-border);vector-effect:non-scaling-stroke}
      .ca-activity-panel .trendsvg text{
        fill:var(--activity-body);transform-box:fill-box;transform-origin:left center;
        transform:scaleX(var(--activity-label-scale,1));
      }
      .ca-activity-panel .trendsvg text[text-anchor="end"]{transform-origin:right center}
      .ca-activity-panel .trendsvg text[text-anchor="middle"]{
        transform-origin:center;transform:translateY(var(--activity-tick-offset,0px)) scaleX(var(--activity-label-scale,1));
      }
      .ca-activity-panel .trendsvg text:nth-last-child(2){fill:var(--activity-heading)}
      .ca-activity-panel .trendsvg text:last-child{fill:var(--activity-primary)}
      @media(max-width:760px){
        .ca-activity-head{padding:26px 20px}
        .ca-activity-panel{padding:20px 16px}
        .ca-activity-head .periodbtn{font-size:12px}
        .ca-activity-panel [data-activity-theme-legend]{gap:10px 16px}
        .ca-activity-panel .trendbox{padding-top:14px;padding-bottom:14px}
      }
    `;
    document.head.appendChild(style);
  }

  function decorateHead(head){
    if(decoratedHeads.has(head))return;
    const layout=head.querySelector(".feature-page-head");
    const original=layout&&layout.firstElementChild;
    if(!original||!head.querySelector("[data-community-period]"))return;
    original.classList.add("ca-activity-original-title");
    const hero=document.createElement("div");
    hero.dataset.activityThemeHero="1";
    hero.innerHTML='<div class="ca-activity-eyebrow">ACTIVITY</div><h2 class="ca-activity-title">活動のようす</h2><p class="ca-activity-description">MeetupとCheck-inから、Communityの活動の流れを見える化します。</p>';
    layout.prepend(hero);
    decoratedHeads.add(head);
  }

  function decoratePanel(panel){
    if(decoratedPanels.has(panel))return;
    const original=panel.querySelector("h2");
    const unit=panel.querySelector("p");
    const legend=panel.querySelector(".trendlegend");
    const chart=panel.querySelector(".trendbox");
    const svg=chart&&chart.querySelector("svg");
    if(!original||!unit||!legend||!svg)return;
    original.classList.add("ca-activity-original-title");
    unit.classList.add("ca-activity-unit");
    legend.classList.add("ca-activity-original-legend");
    const title=document.createElement("div");
    title.dataset.activityThemeTrend="1";
    title.innerHTML='<div class="ca-activity-eyebrow">ACTIVITY TREND</div><h3>MeetupとCheck-inの推移</h3><p>選択した期間における、Meetup開催数とCheck-in数の推移です。</p>';
    original.before(title);
    const key=document.createElement("div");
    key.dataset.activityThemeLegend="1";
    key.innerHTML='<span class="ca-activity-key-bars">Meetup回数（棒）</span><span class="ca-activity-key-line">Check-in数（線）</span>';
    chart.before(key);
    // Only the rendered viewport changes; every existing axis value, bar,
    // line coordinate and tooltip stays untouched, including the empty chart.
    svg.setAttribute("preserveAspectRatio","none");
    decoratedPanels.add(panel);
  }

  function applyTheme(){
    const app=document.getElementById("app");
    if(!app)return;
    const head=app.querySelector("#communityFeaturePanel");
    const panel=head&&head.nextElementSibling;
    const active=Boolean(app.querySelector(".feature-app.activity.on"));
    const isActivity=active&&panel&&panel.matches("section.card.section")&&
      (panel.dataset.activityChart==="1"||Array.from(panel.querySelectorAll("h2")).some(function(h){
        return h.textContent.includes("Activity推移");
      }));
    app.querySelectorAll(".ca-activity-head,.ca-activity-panel").forEach(function(node){
      if(!isActivity||node!==head&&node!==panel)node.classList.remove("ca-activity-head","ca-activity-panel");
    });
    if(!isActivity){
      chartObserver.disconnect();
      observedChart=null;
      return;
    }
    decorateHead(head);
    decoratePanel(panel);
    if(decoratedHeads.has(head)&&!head.classList.contains("ca-activity-head"))head.classList.add("ca-activity-head");
    if(decoratedPanels.has(panel)&&!panel.classList.contains("ca-activity-panel"))panel.classList.add("ca-activity-panel");
    const svg=panel.querySelector("svg");
    if(svg!==observedChart){
      chartObserver.disconnect();
      observedChart=svg;
      if(svg){
        fitChartLabels();
        chartObserver.observe(svg);
      }
    }
  }

  function init(){
    const app=document.getElementById("app");
    if(!app)return;
    ensureStyle();
    // Idempotent decoration: mutations from this theme settle without redraws.
    const observer=new MutationObserver(applyTheme);
    observer.observe(app,{childList:true,subtree:true,attributes:true,attributeFilter:["class"]});
    applyTheme();
  }

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});
  else init();
})();
