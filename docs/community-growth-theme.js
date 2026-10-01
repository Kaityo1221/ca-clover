(function(){
  "use strict";

  // Presentation only: keep the existing period buttons, metrics and SVG data.
  const STYLE_ID="caCommunityGrowthTheme";
  const decoratedHeads=new WeakSet();
  const decoratedPanels=new WeakSet();
  let observedChart=null;
  const chartObserver=new ResizeObserver(function(){fitChartLabels()});

  function fitChartLabels(){
    if(!observedChart)return;
    const width=observedChart.getBoundingClientRect().width;
    if(!width)return;
    const scale=String(observedChart.viewBox.baseVal.width/width);
    if(observedChart.style.getPropertyValue("--growth-label-scale")!==scale){
      observedChart.style.setProperty("--growth-label-scale",scale);
    }
  }

  function ensureStyle(){
    if(document.getElementById(STYLE_ID))return;
    const style=document.createElement("style");
    style.id=STYLE_ID;
    style.textContent=`
      .ca-growth-head,.ca-growth-panel{
        --growth-primary:#388DA8;--growth-heading:#34505A;--growth-body:#71858D;
        --growth-border:#DDEEF5;
        min-width:0;max-width:100%;color:var(--growth-body);
        border-color:var(--growth-border);box-shadow:0 4px 16px rgba(52,80,90,.035);
      }
      [data-growth-theme-hero],[data-growth-theme-trend]{display:none}
      .ca-growth-head{
        position:relative;isolation:isolate;overflow:hidden;padding:32px;
        background:linear-gradient(120deg,#EDF7FC 0%,#F7FBFE 60%,#DDEEF5 100%);
      }
      .ca-growth-head::before,.ca-growth-head::after{
        content:"";position:absolute;z-index:-1;border-radius:50%;pointer-events:none;
        border:1px solid rgba(121,191,216,.2);background:rgba(121,191,216,.08);
      }
      .ca-growth-head::before{width:220px;height:220px;right:0;top:-85px}
      .ca-growth-head::after{width:140px;height:140px;right:85px;top:-75px;background:transparent}
      .ca-growth-head .feature-page-head{display:block}
      .ca-growth-head .ca-growth-original-title,.ca-growth-panel .ca-growth-original-title{display:none}
      .ca-growth-head [data-growth-theme-hero]{display:block;position:relative}
      .ca-growth-eyebrow{color:var(--growth-primary);font-size:11px;font-weight:800;letter-spacing:.18em}
      .ca-growth-head .ca-growth-title{
        margin:12px 0 0;color:var(--growth-heading);font-size:clamp(24px,4vw,34px);
        font-weight:800;line-height:1.4;letter-spacing:-.025em;overflow-wrap:anywhere;
      }
      .ca-growth-description{margin:12px 0 0;font-size:13px;line-height:1.85;font-weight:500}
      .ca-growth-head .periodbar{
        display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:4px;
        width:100%;max-width:520px;margin-top:26px!important;padding:5px;
        border:1px solid var(--growth-border);border-radius:14px;background:rgba(255,255,255,.8);
      }
      .ca-growth-head .periodbtn{
        min-width:0;width:100%;min-height:44px;padding:10px 2px;border:1px solid transparent;
        border-radius:10px;background:transparent;color:var(--growth-heading);
        font-size:13px;line-height:1.2;font-weight:700;
      }
      .ca-growth-head .periodbtn.active{background:var(--growth-primary);color:#fff;border-color:var(--growth-primary)}
      .ca-growth-head .periodbtn:not(.active):hover{background:#EDF7FC}
      .ca-growth-head .periodbtn:focus-visible{outline:2px solid var(--growth-heading);outline-offset:2px}
      .ca-growth-panel{padding:28px;background:#F7FBFE}
      .ca-growth-panel>.grid{margin-top:0;gap:14px;grid-template-columns:repeat(3,minmax(0,1fr))}
      .ca-growth-panel .metric{
        min-width:0;padding:22px 20px;border:1px solid var(--growth-border);border-radius:16px;background:#fff;
      }
      .ca-growth-panel .metric .muted{color:var(--growth-body);font-weight:500;line-height:1.6}
      .ca-growth-panel .metric>div.tiny{min-height:3.2em}
      .ca-growth-panel .metric>span{font-size:12px;color:var(--growth-heading)!important;font-weight:700!important}
      .ca-growth-panel .metric b{
        margin-top:12px;color:var(--growth-heading);font-size:32px;font-weight:800;
        line-height:1.25;font-variant-numeric:tabular-nums;overflow-wrap:anywhere;
      }
      .ca-growth-panel [data-growth-theme-trend]{display:block;margin-top:32px}
      .ca-growth-panel [data-growth-theme-trend] h3{margin-top:9px;font-size:21px;line-height:1.5;color:var(--growth-heading)}
      .ca-growth-panel [data-growth-theme-trend] p{margin:8px 0 0;font-size:12px;line-height:1.8}
      .ca-growth-panel .trendbox{min-width:0;max-width:100%;overflow:hidden;border-color:var(--growth-border);border-radius:16px;padding:18px 8px;background:#fff}
      .ca-growth-panel .trendsvg{width:100%;max-width:100%;min-width:0!important;height:190px}
      .ca-growth-panel .trendsvg path{stroke:var(--growth-primary);vector-effect:non-scaling-stroke}
      .ca-growth-panel .trendsvg circle{fill:var(--growth-primary);stroke:var(--growth-primary);stroke-width:1px;vector-effect:non-scaling-stroke}
      .ca-growth-panel .trendsvg line{stroke:var(--growth-border);vector-effect:non-scaling-stroke}
      .ca-growth-panel .trendsvg text{
        fill:var(--growth-body);transform-box:fill-box;transform-origin:left center;
        transform:scaleX(var(--growth-label-scale,1));
      }
      .ca-growth-panel .trendsvg text[text-anchor="middle"]{transform-origin:center}
      .ca-growth-panel .trendsvg text.ca-growth-label-first{transform-origin:left center}
      .ca-growth-panel .trendsvg text.ca-growth-label-last{transform-origin:right center}
      .ca-growth-panel .trendsvg text:not([text-anchor]):first-of-type{transform:translateY(-10px) scaleX(var(--growth-label-scale,1))}
      .ca-growth-panel .trendsvg text:not([text-anchor]):nth-of-type(2){transform:translateY(12px) scaleX(var(--growth-label-scale,1))}
      .ca-growth-panel>.notice{
        display:flex;align-items:center;min-height:228px;margin-top:14px;
        background:#EDF7FC;border-color:var(--growth-border);color:var(--growth-heading);font-weight:500;
      }
      .ca-growth-panel .ca-growth-info{
        display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px 18px;
        min-height:54px;margin-top:22px;padding:16px 18px;background:#EDF7FC;border:1px solid var(--growth-border);border-radius:14px;
      }
      .ca-growth-panel .ca-growth-info .pill{padding:0;background:transparent;color:var(--growth-heading);font-size:12px;font-weight:600;line-height:1.7}
      .ca-growth-panel .ca-growth-info .muted{margin:0!important;color:var(--growth-body);font-weight:500;line-height:1.7}
      @media(max-width:760px){
        .ca-growth-head{padding:26px 20px}
        .ca-growth-panel{padding:20px 16px}
        .ca-growth-panel>.grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
        .ca-growth-panel .metric:first-child{grid-column:1/-1}
        .ca-growth-panel .metric{padding:17px 14px}
        .ca-growth-panel .metric:first-child b{font-size:36px}
        .ca-growth-panel .metric b{font-size:28px;margin-top:8px}
        .ca-growth-head .periodbtn{font-size:12px}
        .ca-growth-panel .trendbox{padding:14px 4px}
        .ca-growth-panel>.notice{min-height:220px}
        .ca-growth-panel [data-growth-theme-trend]{margin-top:26px}
        .ca-growth-panel .ca-growth-info{display:grid;min-height:78px;align-content:center;padding:14px}
      }
    `;
    document.head.appendChild(style);
  }

  function decorateHead(head){
    if(decoratedHeads.has(head))return;
    const layout=head.querySelector(".feature-page-head");
    const original=layout&&layout.firstElementChild;
    if(!original||!head.querySelector("[data-community-period]"))return;
    original.classList.add("ca-growth-original-title");
    const hero=document.createElement("div");
    hero.dataset.growthThemeHero="1";
    hero.innerHTML='<div class="ca-growth-eyebrow">GROWTH</div><h2 class="ca-growth-title">コミュニティの成長</h2><p class="ca-growth-description">メンバー数の変化から、Communityの広がりを見える化します。</p>';
    layout.prepend(hero);
    decoratedHeads.add(head);
  }

  function decoratePanel(panel){
    if(decoratedPanels.has(panel))return;
    const original=panel.firstElementChild;
    const metrics=panel.querySelector(".grid.g3");
    const chart=panel.querySelector(".trendbox,.notice");
    if(!original||!metrics||!chart)return;
    original.classList.add("ca-growth-original-title");
    const title=document.createElement("div");
    title.dataset.growthThemeTrend="1";
    title.innerHTML='<div class="ca-growth-eyebrow">MEMBER TREND</div><h3>メンバー数の推移</h3><p>選択した期間における、Communityメンバー数の推移です。</p>';
    chart.before(title);

    const svg=chart.querySelector("svg");
    if(svg){
      // Fit the existing SVG to the card without changing viewBox, points,
      // path, axis values or domains. Keep labels legible at long periods.
      svg.setAttribute("preserveAspectRatio","none");
      const labels=svg.querySelectorAll('text[text-anchor="middle"]');
      if(labels.length){
        labels[0].classList.add("ca-growth-label-first");
        labels[labels.length-1].classList.add("ca-growth-label-last");
      }
    }

    // Move existing information, preserving its exact text (including the date).
    const sync=original.querySelector(".pill");
    const started=Array.from(panel.children).find(function(node){
      return node.classList.contains("tiny")&&node.textContent.trim().startsWith("蓄積開始 ");
    });
    if(sync||started){
      const info=document.createElement("div");
      info.className="ca-growth-info";
      if(sync)info.appendChild(sync);
      if(started)info.appendChild(started);
      panel.appendChild(info);
    }
    decoratedPanels.add(panel);
  }

  function applyTheme(){
    const app=document.getElementById("app");
    if(!app)return;
    const head=app.querySelector("#communityFeaturePanel");
    const panel=head&&head.nextElementSibling;
    const active=Boolean(app.querySelector(".feature-app.growth.on"));
    const isGrowth=active&&panel&&panel.matches("section.card.section")&&
      (panel.dataset.growthPanel==="1"||Array.from(panel.querySelectorAll("h2")).some(function(h){
        return h.textContent.includes("Community Growth");
      }));
    app.querySelectorAll(".ca-growth-head,.ca-growth-panel").forEach(function(node){
      if(!isGrowth||node!==head&&node!==panel)node.classList.remove("ca-growth-head","ca-growth-panel");
    });
    if(!isGrowth){
      chartObserver.disconnect();
      observedChart=null;
      return;
    }
    decorateHead(head);
    decoratePanel(panel);
    if(decoratedHeads.has(head)&&!head.classList.contains("ca-growth-head"))head.classList.add("ca-growth-head");
    if(decoratedPanels.has(panel)&&!panel.classList.contains("ca-growth-panel"))panel.classList.add("ca-growth-panel");
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
    // Observe just the content. Our own DOM additions settle after one extra
    // callback: WeakSets make decoration idempotent, with no timers or redraws.
    const observer=new MutationObserver(applyTheme);
    observer.observe(app,{childList:true,subtree:true,attributes:true,attributeFilter:["class"]});
    applyTheme();
  }

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});
  else init();
})();
