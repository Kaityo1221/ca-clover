(function(){
  "use strict";

  const VERSION="reach-reaction-r4-20260928";
  const WEEKDAYS=["月","火","水","木","金","土","日"];
  const SLOT_KEYS=Array.from({length:12},function(_v,i){
    const a=String(i*2).padStart(2,"0"),b=String(i*2+2).padStart(2,"0");
    return a+"-"+b;
  });
  const SLOT_LABELS=SLOT_KEYS.map(function(k){
    const p=k.split("-").map(Number);return p[0]+"-"+p[1];
  });
  const DAYPARTS=["深夜","朝","昼","夜"];
  const DAYTYPES=["平日","休日"];
  const MIN_CELL_SAMPLE=3;
  let mountSerial=0;
  let retryTimer=null;

  function esc(v){
    return String(v==null?"":v).replace(/[&<>"']/g,function(c){
      return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c];
    });
  }

  function communityId(){
    const raw=(location.hash||"").slice(1);
    if(!raw.startsWith("community:"))return "";
    try{return decodeURIComponent(raw.slice("community:".length))}catch(_e){return raw.slice("community:".length)}
  }

  function fmt(v){
    if(!Number.isFinite(v))return "—";
    return (v>0?"+":"")+Number(v).toLocaleString("ja-JP");
  }

  function heatValueClass(v,max){
    if(!Number.isFinite(v))return "empty";
    if(max<=0)return "l1";
    const ratio=Math.max(0,v)/max;
    if(ratio>=.75)return "l4";
    if(ratio>=.5)return "l3";
    if(ratio>=.25)return "l2";
    return "l1";
  }

  function ensureStyle(){
    if(document.getElementById("caReachReactionR4Style"))return;
    const style=document.createElement("style");
    style.id="caReachReactionR4Style";
    style.textContent=`
      .reaction-r4{width:100%;max-width:100%;min-width:0;box-sizing:border-box;margin:12px 0 2px;border:1px solid #c4b5fd;border-radius:22px;padding:17px;background:linear-gradient(145deg,#fff,#faf5ff);overflow:hidden}
      .reaction-r4-head{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
      .reaction-r4-kicker{font-size:10px;font-weight:950;letter-spacing:.06em;color:#7c3aed;text-transform:uppercase}
      .reaction-r4-window{display:inline-flex;align-items:center;border-radius:999px;padding:6px 10px;font-size:10px;font-weight:950;border:1px solid #ddd6fe;background:#fff;color:#6d28d9}
      .reaction-r4-note{margin-top:8px;font-size:11px;font-weight:850;color:#64748b;line-height:1.6}
      .reaction-r4-scroll{margin-top:12px;width:100%;max-width:100%;overflow-x:auto;overflow-y:hidden;-webkit-overflow-scrolling:touch;overscroll-behavior-x:contain;padding-bottom:6px}
      .reaction-r4-grid{display:grid;grid-template-columns:34px repeat(12,48px);gap:5px;min-width:max-content;align-items:stretch}
      .reaction-r4-corner,.reaction-r4-col,.reaction-r4-row{display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:950;color:#64748b;min-height:34px}
      .reaction-r4-row{position:sticky;left:0;z-index:2;background:#fff;border-radius:9px;border:1px solid #f1f5f9;color:#475569}
      .reaction-r4-cell{width:48px;height:44px;border-radius:11px;border:1px solid #ede9fe;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#f8fafc;color:#94a3b8;box-sizing:border-box}
      .reaction-r4-cell b{font-size:12px;line-height:1;color:inherit}.reaction-r4-cell small{margin-top:4px;font-size:8px;font-weight:900;opacity:.72}
      .reaction-r4-cell.weak{opacity:.48}
      .reaction-r4-cell.l1{background:#faf5ff;color:#7c3aed}.reaction-r4-cell.l2{background:#f3e8ff;color:#6d28d9}.reaction-r4-cell.l3{background:#e9d5ff;color:#5b21b6}.reaction-r4-cell.l4{background:#c4b5fd;color:#3b0764;border-color:#a78bfa}
      .reaction-r4-cell.empty{background:#f8fafc;color:#cbd5e1;border-color:#f1f5f9}
      .reaction-r4-legend{display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-top:8px;font-size:9px;font-weight:900;color:#94a3b8}
      .reaction-r4-swatch{width:18px;height:12px;border-radius:4px;border:1px solid #ede9fe}.reaction-r4-swatch.l1{background:#faf5ff}.reaction-r4-swatch.l2{background:#f3e8ff}.reaction-r4-swatch.l3{background:#e9d5ff}.reaction-r4-swatch.l4{background:#c4b5fd}
      .reaction-r4-compare{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:14px}
      .reaction-r4-box{min-width:0;border:1px solid #ede9fe;border-radius:18px;padding:13px;background:#fff}
      .reaction-r4-box h4{margin:0;color:#4c1d95;font-size:13px}
      .reaction-r4-list{display:grid;gap:7px;margin-top:9px}
      .reaction-r4-line{display:grid;grid-template-columns:52px 1fr auto;gap:8px;align-items:center;font-size:10px;font-weight:900;color:#64748b}
      .reaction-r4-track{height:7px;border-radius:999px;background:#f1f5f9;overflow:hidden}.reaction-r4-fill{height:100%;border-radius:999px;background:#c4b5fd}
      .reaction-r4-value{color:#4c1d95;min-width:34px;text-align:right}.reaction-r4-sub{font-size:8px;color:#94a3b8;font-weight:850}
      .reaction-r4-foot{margin-top:10px;font-size:10px;font-weight:850;line-height:1.6;color:#94a3b8}
      @media(max-width:480px){.reaction-r4{padding:14px}.reaction-r4-compare{grid-template-columns:1fr}.reaction-r4-grid{grid-template-columns:32px repeat(12,46px)}.reaction-r4-cell{width:46px}}
    `;
    document.head.appendChild(style);
  }

  function heatmapData(result){
    const summary=result&&result.summary?result.summary:{};
    const source=Array.isArray(summary.byWeekdayTwoHour)?summary.byWeekdayTwoHour:[];
    const map=new Map();
    source.forEach(function(row){
      if(!row||!row.key)return;
      map.set(String(row.key),row);
    });
    const values=source.map(function(r){return Number(r&&r.median24h)}).filter(Number.isFinite);
    const max=values.length?Math.max.apply(null,values):0;
    return {map,max};
  }

  function heatmapHtml(result){
    const data=heatmapData(result);
    let html='<div class="reaction-r4-scroll"><div class="reaction-r4-grid"><div class="reaction-r4-corner"></div>';
    SLOT_LABELS.forEach(function(label){html+='<div class="reaction-r4-col">'+esc(label)+'</div>'});
    WEEKDAYS.forEach(function(day){
      html+='<div class="reaction-r4-row">'+esc(day)+'</div>';
      SLOT_KEYS.forEach(function(slot){
        const row=data.map.get(day+'|'+slot)||null;
        const count=row?Number(row.sampleCount)||0:0;
        const value=row&&Number.isFinite(row.median24h)?Number(row.median24h):null;
        const cls=heatValueClass(value,data.max)+(count>0&&count<MIN_CELL_SAMPLE?' weak':'');
        const title=count?day+' '+slot+' / 24h中央値 '+fmt(value)+' / '+count+'件':day+' '+slot+' / データなし';
        html+='<div class="reaction-r4-cell '+cls+'" title="'+esc(title)+'"><b>'+esc(fmt(value))+'</b><small>'+(count?count+'件':'—')+'</small></div>';
      });
    });
    html+='</div></div>';
    html+='<div class="reaction-r4-legend"><span>低</span><span class="reaction-r4-swatch l1"></span><span class="reaction-r4-swatch l2"></span><span class="reaction-r4-swatch l3"></span><span class="reaction-r4-swatch l4"></span><span>高</span><span>・ 3件未満は薄く表示</span></div>';
    return html;
  }

  function comparisonHtml(groups,labels,title){
    const map=new Map();
    (groups||[]).forEach(function(r){if(r&&r.key!=null)map.set(String(r.key),r)});
    const vals=labels.map(function(label){const r=map.get(label);return r&&Number.isFinite(r.median24h)?Number(r.median24h):null}).filter(Number.isFinite);
    const max=vals.length?Math.max(1,Math.max.apply(null,vals)):1;
    let html='<div class="reaction-r4-box"><h4>'+esc(title)+'</h4><div class="reaction-r4-list">';
    labels.forEach(function(label){
      const r=map.get(label)||null;
      const value=r&&Number.isFinite(r.median24h)?Number(r.median24h):null;
      const count=r?Number(r.sampleCount)||0:0;
      const width=value==null?0:Math.max(0,Math.min(100,(Math.max(0,value)/max)*100));
      html+='<div class="reaction-r4-line"><div>'+esc(label)+'<div class="reaction-r4-sub">'+(count?count+'件':'データなし')+'</div></div><div class="reaction-r4-track"><div class="reaction-r4-fill" style="width:'+width.toFixed(1)+'%"></div></div><div class="reaction-r4-value">'+esc(fmt(value))+'</div></div>';
    });
    html+='</div></div>';
    return html;
  }

  function cardHtml(result){
    const summary=result&&result.summary?result.summary:{};
    const windowLabel=summary.analysisWindowLabel||"直近12か月";
    const count=Number(summary.analyzable24hCount)||0;
    const note=count
      ?"色が濃いほど、Meetup作成後24時間のRSVP増加中央値が高い時間帯です。"
      :"まだ分析対象がありません。Meetupの観測データが貯まると、この表に反応の強さが現れます。";
    return '<div class="reaction-r4-head"><div><div class="reaction-r4-kicker">Reaction Heatmap</div><h3 style="margin:3px 0 0;color:#4c1d95;font-size:18px">🗓️ 曜日 × 作成時間</h3></div><span class="reaction-r4-window">'+esc(windowLabel)+'</span></div>'+
      '<div class="reaction-r4-note">'+esc(note)+'</div>'+heatmapHtml(result)+
      '<div class="reaction-r4-compare">'+comparisonHtml(summary.byDaypart,DAYPARTS,"朝・昼・夜・深夜")+comparisonHtml(summary.byDayType,DAYTYPES,"平日・休日")+'</div>'+
      '<div class="reaction-r4-foot">セルは24h RSVP増加の中央値。JST、日本の休日判定を使用。サンプル3件未満は参考値として薄く表示します。</div>';
  }

  async function mountOnce(){
    const feature=document.querySelector('.feature-app.reach.on');
    const root=document.getElementById("reach7Root");
    if(!feature||!root||!root.parentElement)return false;
    if(document.getElementById("reachReactionR4"))return true;
    if(!window.CAReachReactionR1||typeof window.CAReachReactionR1.loadCommunity!=="function")return false;
    const r3=document.getElementById("reachReactionR3");
    if(!r3||!r3.parentElement||r3.parentElement!==root.parentElement)return false;
    const id=communityId();
    if(!id)return false;

    ensureStyle();
    const serial=++mountSerial;
    const box=document.createElement("section");
    box.id="reachReactionR4";
    box.className="reaction-r4";
    box.dataset.version=VERSION;
    box.innerHTML='<div class="reaction-r4-note">ヒートマップを準備中...</div>';
    r3.insertAdjacentElement("afterend",box);

    try{
      let result=window.CAReachReactionR2LastResult;
      if(!result||result.communityId!==id)result=await window.CAReachReactionR1.loadCommunity(id);
      if(serial!==mountSerial||!document.body.contains(box))return true;
      box.innerHTML=cardHtml(result);
      window.CAReachReactionR4LastResult=result;
    }catch(err){
      console.warn("Community Reaction R4 failed",err);
      if(document.body.contains(box))box.innerHTML='<div class="reaction-r4-note">ヒートマップの読み込みに失敗しました。Meetup個別データは引き続き確認できます。</div>';
    }
    return true;
  }

  function scheduleMount(){
    if(retryTimer)clearInterval(retryTimer);
    let attempts=0;
    const tryMount=function(){
      attempts++;
      void mountOnce().then(function(done){
        if(done&&retryTimer){clearInterval(retryTimer);retryTimer=null}
        else if(attempts>=40&&retryTimer){clearInterval(retryTimer);retryTimer=null}
      });
    };
    tryMount();
    retryTimer=setInterval(tryMount,200);
  }

  document.addEventListener("click",function(ev){
    const button=ev.target&&ev.target.closest?ev.target.closest("[data-community-feature='reach'],.feature-app.reach"):null;
    if(button)setTimeout(scheduleMount,0);
  },true);
  window.addEventListener("hashchange",function(){setTimeout(scheduleMount,0)});
  document.addEventListener("DOMContentLoaded",scheduleMount,{once:true});
  scheduleMount();

  window.CAReachReactionR4={VERSION,MIN_CELL_SAMPLE,cardHtml,mount:scheduleMount};
})();