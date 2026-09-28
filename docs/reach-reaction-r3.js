(function(){
  "use strict";

  const VERSION="reach-reaction-r3-20260928";
  const MIN_TOTAL=5;
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

  function formatGrowth(v){
    if(!Number.isFinite(v))return "—";
    return (v>0?"+":"")+Number(v).toLocaleString("ja-JP");
  }

  function eligibleCells(result){
    const rows=result&&result.summary&&Array.isArray(result.summary.byWeekdayTwoHour)
      ?result.summary.byWeekdayTwoHour:[];
    return rows.filter(function(row){
      return row&&row.sampleCount>=MIN_CELL_SAMPLE&&Number.isFinite(row.median24h);
    }).slice().sort(function(a,b){
      if(b.median24h!==a.median24h)return b.median24h-a.median24h;
      if(b.sampleCount!==a.sampleCount)return b.sampleCount-a.sampleCount;
      return String(a.label).localeCompare(String(b.label),"ja");
    });
  }

  function deriveRecommendation(result){
    const summary=result&&result.summary?result.summary:{};
    const total=Number(summary.analyzable24hCount)||0;
    const windowLabel=summary.analysisWindowLabel||"直近12か月";
    if(total<MIN_TOTAL){
      return {
        ready:false,
        reason:"total_sample_shortage",
        total,
        remain:Math.max(0,MIN_TOTAL-total),
        windowLabel,
        primary:null,
        secondary:null
      };
    }

    const cells=eligibleCells(result);
    if(!cells.length){
      return {
        ready:false,
        reason:"cell_sample_shortage",
        total,
        remain:0,
        windowLabel,
        primary:null,
        secondary:null
      };
    }

    return {
      ready:true,
      reason:null,
      total,
      remain:0,
      windowLabel,
      primary:cells[0],
      secondary:cells[1]||null
    };
  }

  function ensureStyle(){
    if(document.getElementById("caReachReactionR3Style"))return;
    const style=document.createElement("style");
    style.id="caReachReactionR3Style";
    style.textContent=`
      .reaction-r3{width:100%;max-width:100%;min-width:0;box-sizing:border-box;margin:12px 0 2px;border:1px solid #c4b5fd;border-radius:22px;padding:17px;background:linear-gradient(145deg,#fff,#faf5ff);overflow:hidden}
      .reaction-r3-head{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
      .reaction-r3-kicker{font-size:10px;font-weight:950;letter-spacing:.06em;color:#7c3aed;text-transform:uppercase}
      .reaction-r3-window{display:inline-flex;align-items:center;border-radius:999px;padding:6px 10px;font-size:10px;font-weight:950;border:1px solid #ddd6fe;background:#fff;color:#6d28d9}
      .reaction-r3-main{margin-top:12px;border:1px solid #ede9fe;border-radius:18px;padding:15px;background:#fff}
      .reaction-r3-title{font-size:12px;font-weight:900;color:#64748b}
      .reaction-r3-primary{margin-top:5px;font-size:24px;line-height:1.2;font-weight:950;color:#4c1d95;overflow-wrap:anywhere}
      .reaction-r3-score{margin-top:6px;font-size:11px;font-weight:900;color:#7c3aed}
      .reaction-r3-secondary{margin-top:10px;padding-top:10px;border-top:1px dashed #ddd6fe;font-size:11px;font-weight:900;color:#64748b;line-height:1.6}
      .reaction-r3-wait{margin-top:12px;border:1px dashed #c4b5fd;border-radius:18px;padding:15px;background:#faf5ff;color:#6d28d9;font-size:12px;font-weight:900;line-height:1.7}
      .reaction-r3-foot{margin-top:10px;font-size:10px;font-weight:850;line-height:1.6;color:#94a3b8}
      @media(max-width:480px){.reaction-r3{padding:14px}.reaction-r3-primary{font-size:22px}}
    `;
    document.head.appendChild(style);
  }

  function cardHtml(result){
    const rec=deriveRecommendation(result);
    const head='<div class="reaction-r3-head"><div><div class="reaction-r3-kicker">Recommended Timing</div><h3 style="margin:3px 0 0;color:#4c1d95;font-size:18px">📣 Meetupを作るなら</h3></div><span class="reaction-r3-window">'+esc(rec.windowLabel)+'</span></div>';

    if(!rec.ready){
      const text=rec.reason==="total_sample_shortage"
        ?"まだおすすめは出しません。分析対象があと"+rec.remain+"件たまると、作成タイミングを比較できるようになります。"
        :"分析対象は増えてきましたが、同じ曜日×2時間帯の実績がまだ3件未満です。もう少し蓄積してからおすすめを表示します。";
      return head+'<div class="reaction-r3-wait">'+esc(text)+'</div><div class="reaction-r3-foot">推薦条件：分析対象5件以上 ＋ 同じ曜日×2時間帯で3件以上。1件だけの好結果ではおすすめにしません。</div>';
    }

    const second=rec.secondary
      ?'<div class="reaction-r3-secondary">次点：'+esc(rec.secondary.label)+'　24h中央値 '+esc(formatGrowth(rec.secondary.median24h))+' / '+rec.secondary.sampleCount+'件</div>'
      :'<div class="reaction-r3-secondary">次点はまだサンプル不足です。</div>';

    return head+'<div class="reaction-r3-main"><div class="reaction-r3-title">反応が高かった作成タイミング</div><div class="reaction-r3-primary">'+esc(rec.primary.label)+'</div><div class="reaction-r3-score">24h RSVP中央値 '+esc(formatGrowth(rec.primary.median24h))+' / '+rec.primary.sampleCount+'件</div>'+second+'</div><div class="reaction-r3-foot">'+esc(rec.windowLabel)+'の実績から判定。JST、日本の休日判定を使用しています。</div>';
  }

  async function mountOnce(){
    const feature=document.querySelector('.feature-app.reach.on');
    const root=document.getElementById("reach7Root");
    if(!feature||!root||!root.parentElement)return false;
    if(document.getElementById("reachReactionR3"))return true;
    if(!window.CAReachReactionR1||typeof window.CAReachReactionR1.loadCommunity!=="function")return false;
    const r2=document.getElementById("reachReactionR2");
    if(!r2||!r2.parentElement||r2.parentElement!==root.parentElement)return false;
    const id=communityId();
    if(!id)return false;

    ensureStyle();
    const serial=++mountSerial;
    const box=document.createElement("section");
    box.id="reachReactionR3";
    box.className="reaction-r3";
    box.dataset.version=VERSION;
    box.innerHTML='<div class="reaction-r3-wait">おすすめ作成タイミングを分析中...</div>';
    r2.insertAdjacentElement("afterend",box);

    try{
      let result=window.CAReachReactionR2LastResult;
      if(!result||result.communityId!==id)result=await window.CAReachReactionR1.loadCommunity(id);
      if(serial!==mountSerial||!document.body.contains(box))return true;
      box.innerHTML=cardHtml(result);
      window.CAReachReactionR3LastResult={result,recommendation:deriveRecommendation(result)};
    }catch(err){
      console.warn("Community Reaction R3 failed",err);
      if(document.body.contains(box))box.innerHTML='<div class="reaction-r3-wait">おすすめ作成タイミングの読み込みに失敗しました。Meetup個別データは引き続き確認できます。</div>';
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
        else if(attempts>=30&&retryTimer){clearInterval(retryTimer);retryTimer=null}
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

  window.CAReachReactionR3={VERSION,MIN_TOTAL,MIN_CELL_SAMPLE,deriveRecommendation,cardHtml,mount:scheduleMount};
})();