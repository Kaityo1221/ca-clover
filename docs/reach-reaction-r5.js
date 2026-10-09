(function(){
  "use strict";

  const VERSION="reach-reaction-r5-20261002";
  const TIME_ZONE="Asia/Tokyo";
  const RELIABLE_FALLBACK="2026-10-02T04:43:55.543Z";
  const WINDOW_HOURS=24;
  const FIRST_OBSERVATION_LIMIT_HOURS=6;
  const MAX_INTERVAL_MINUTES=45;
  const PAGE_SIZE=1000;
  const MAX_SNAPSHOT_PAGES=50;
  const SUPABASE_URL="https://wgiittrvgtiosogyhfcl.supabase.co";
  const SUPABASE_KEY="sb_publishable_QTCqijfNvnysUTMylNIyTA_6ngosaPN";
  const SLOT_KEYS=Array.from({length:12},function(_v,i){
    return String(i*2).padStart(2,"0")+"-"+String(i*2+2).padStart(2,"0");
  });
  let client=null;
  let mountSerial=0;
  let retryTimer=null;

  function esc(v){
    return String(v==null?"":v).replace(/[&<>"']/g,function(c){
      return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c];
    });
  }

  function getClient(){
    if(client)return client;
    if(!window.supabase)return null;
    client=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{
      auth:{persistSession:true,autoRefreshToken:false,detectSessionInUrl:false}
    });
    return client;
  }

  function communityId(){
    const raw=(location.hash||"").slice(1);
    if(!raw.startsWith("community:"))return "";
    try{return decodeURIComponent(raw.slice("community:".length))}catch(_e){return raw.slice("community:".length)}
  }

  function reliableFrom(){
    return window.CAReachReactionR1&&window.CAReachReactionR1.REACTION_RELIABLE_FROM
      ?window.CAReachReactionR1.REACTION_RELIABLE_FROM
      :RELIABLE_FALLBACK;
  }

  function hourInJst(value){
    const d=value instanceof Date?value:new Date(value);
    if(!Number.isFinite(d.getTime()))return null;
    const parts=new Intl.DateTimeFormat("en-US",{
      timeZone:TIME_ZONE,
      hour:"2-digit",
      hourCycle:"h23"
    }).formatToParts(d);
    const hourPart=parts.find(function(p){return p.type==="hour"});
    const hour=hourPart?Number(hourPart.value):NaN;
    return Number.isFinite(hour)?hour:null;
  }

  function slotFor(value){
    const hour=hourInJst(value);
    if(hour==null)return null;
    const start=Math.floor(hour/2)*2;
    return String(start).padStart(2,"0")+"-"+String(start+2).padStart(2,"0");
  }

  function formatSlot(key){
    const p=String(key).split("-").map(Number);
    return p[0]+"〜"+p[1]+"時";
  }

  function normalizeRsvp(value){
    if(value==null)return null;
    const n=Number(value);
    return Number.isFinite(n)?n:null;
  }

  async function fetchSnapshots(sb,id,startIso){
    const rows=[];
    for(let page=0;page<MAX_SNAPSHOT_PAGES;page++){
      const from=page*PAGE_SIZE,to=from+PAGE_SIZE-1;
      const r=await sb.from("meetup_metric_snapshots")
        .select("meetup_id,rsvp_count,observed_at,source")
        .eq("community_id",id)
        .eq("source","campfire-metric-reaction")
        .gte("observed_at",startIso)
        .order("observed_at",{ascending:true})
        .range(from,to);
      if(r.error)throw r.error;
      const chunk=r.data||[];
      rows.push(...chunk);
      if(chunk.length<PAGE_SIZE)return {rows,truncated:false};
    }
    return {rows,truncated:true};
  }

  function analyzeData(meetups,snapshots){
    const byMeetup=new Map();
    (snapshots||[]).forEach(function(row){
      const list=byMeetup.get(row.meetup_id)||[];
      list.push({
        ...row,
        time:new Date(row.observed_at).getTime(),
        rsvp:normalizeRsvp(row.rsvp_count)
      });
      byMeetup.set(row.meetup_id,list);
    });

    const slots=new Map(SLOT_KEYS.map(function(key){
      return [key,{key,label:formatSlot(key),rsvpIncrease:0,positiveIntervals:0}];
    }));

    let trackedMeetups=0;
    let excludedLateMeetups=0;
    let usableIntervals=0;
    let positiveIntervals=0;
    let positiveRsvp=0;
    let cancellationIntervals=0;
    let cancelledRsvp=0;
    let longGapIntervals=0;
    let unattributedInitialRsvp=0;

    (meetups||[]).forEach(function(meetup){
      const created=new Date(meetup.campfire_created_at).getTime();
      if(!Number.isFinite(created))return;

      const rows=(byMeetup.get(meetup.id)||[])
        .filter(function(row){
          return Number.isFinite(row.time)&&row.time>=created&&row.time<=created+(WINDOW_HOURS+1)*60*60*1000&&row.rsvp!=null;
        })
        .sort(function(a,b){return a.time-b.time});

      if(!rows.length)return;
      const firstLag=rows[0].time-created;
      if(firstLag>FIRST_OBSERVATION_LIMIT_HOURS*60*60*1000){
        excludedLateMeetups++;
        return;
      }

      trackedMeetups++;
      if(rows[0].rsvp>0)unattributedInitialRsvp+=rows[0].rsvp;

      for(let i=1;i<rows.length;i++){
        const prev=rows[i-1],curr=rows[i];
        const interval=curr.time-prev.time;
        if(!(interval>0))continue;

        const midpoint=prev.time+interval/2;
        const elapsed=midpoint-created;
        if(elapsed<0||elapsed>WINDOW_HOURS*60*60*1000)continue;

        const intervalMinutes=interval/60000;
        if(intervalMinutes>MAX_INTERVAL_MINUTES){
          longGapIntervals++;
          continue;
        }

        usableIntervals++;
        const delta=curr.rsvp-prev.rsvp;
        if(delta>0){
          const slot=slotFor(midpoint);
          if(slot&&slots.has(slot)){
            const item=slots.get(slot);
            item.rsvpIncrease+=delta;
            item.positiveIntervals++;
          }
          positiveIntervals++;
          positiveRsvp+=delta;
        }else if(delta<0){
          cancellationIntervals++;
          cancelledRsvp+=Math.abs(delta);
        }
      }
    });

    const slotRows=SLOT_KEYS.map(function(key){return slots.get(key)});
    const ranked=slotRows.filter(function(row){return row.rsvpIncrease>0}).slice().sort(function(a,b){
      if(b.rsvpIncrease!==a.rsvpIncrease)return b.rsvpIncrease-a.rsvpIncrease;
      if(b.positiveIntervals!==a.positiveIntervals)return b.positiveIntervals-a.positiveIntervals;
      return SLOT_KEYS.indexOf(a.key)-SLOT_KEYS.indexOf(b.key);
    });

    return {
      timeZone:TIME_ZONE,
      reliableCollectionStart:reliableFrom(),
      windowHours:WINDOW_HOURS,
      maxIntervalMinutes:MAX_INTERVAL_MINUTES,
      trackedMeetups,
      excludedLateMeetups,
      usableIntervals,
      positiveIntervals,
      positiveRsvp,
      cancellationIntervals,
      cancelledRsvp,
      longGapIntervals,
      unattributedInitialRsvp,
      slots:slotRows,
      topSlot:ranked[0]||null
    };
  }

  async function loadCommunity(id){
    const sb=getClient();
    if(!sb)throw new Error("Supabase client is not available");
    if(!id)throw new Error("communityId is required");
    const startIso=reliableFrom();

    const [meetupResult,snapshotResult]=await Promise.all([
      sb.from("meetups")
        .select("id,title,campfire_created_at")
        .eq("community_id",id)
        .gte("campfire_created_at",startIso)
        .order("campfire_created_at",{ascending:true})
        .limit(1000),
      fetchSnapshots(sb,id,startIso)
    ]);
    if(meetupResult.error)throw meetupResult.error;

    return {
      communityId:id,
      analysis:analyzeData(meetupResult.data||[],snapshotResult.rows),
      snapshotRows:snapshotResult.rows.length,
      snapshotRowsTruncated:snapshotResult.truncated
    };
  }

  function ensureStyle(){
    if(document.getElementById("caReachReactionR5Style"))return;
    const style=document.createElement("style");
    style.id="caReachReactionR5Style";
    style.textContent=`
      .reaction-r5{width:100%;max-width:100%;min-width:0;box-sizing:border-box;margin:12px 0 2px;border:1px solid #c4b5fd;border-radius:22px;padding:17px;background:linear-gradient(145deg,#fff,#faf5ff);overflow:hidden}
      .reaction-r5-head{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
      .reaction-r5-kicker{font-size:10px;font-weight:950;letter-spacing:.06em;color:#7c3aed;text-transform:uppercase}
      .reaction-r5-badge{display:inline-flex;align-items:center;border-radius:999px;padding:6px 10px;font-size:10px;font-weight:950;border:1px solid #ddd6fe;background:#fff;color:#6d28d9}
      .reaction-r5-note{margin-top:8px;font-size:11px;font-weight:850;color:#64748b;line-height:1.6}
      .reaction-r5-slots{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:12px}
      .reaction-r5-slot{border:1px solid #ede9fe;border-radius:13px;padding:9px;background:#fff;min-width:0}
      .reaction-r5-slot-top{display:flex;justify-content:space-between;gap:8px;align-items:center;font-size:10px;font-weight:950;color:#475569}
      .reaction-r5-slot-value{color:#6d28d9}
      .reaction-r5-track{height:6px;margin-top:7px;border-radius:999px;background:#f3e8ff;overflow:hidden}
      .reaction-r5-fill{height:100%;border-radius:inherit;background:#a78bfa}
      .reaction-r5-meta{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:12px}
      .reaction-r5-stat{border:1px solid #ede9fe;border-radius:13px;padding:10px;background:#fff}
      .reaction-r5-stat b{display:block;font-size:16px;color:#4c1d95}.reaction-r5-stat span{display:block;margin-top:2px;font-size:9px;font-weight:900;color:#94a3b8}
      .reaction-r5-foot{margin-top:10px;font-size:9px;font-weight:800;color:#94a3b8;line-height:1.55}
      @media(max-width:480px){.reaction-r5{padding:14px}}
    `;
    document.head.appendChild(style);
  }

  function cardHtml(result){
    const a=result.analysis||{};
    const max=Math.max(0,...(a.slots||[]).map(function(row){return Number(row.rsvpIncrease)||0}));
    const top=a.topSlot;
    let note="";
    if(!a.trackedMeetups){
      note="新しい収集方式で作成されたMeetupを待っています。データが入ると、実際にRSVPが増えた時刻を2時間枠で表示します。";
    }else if(!a.positiveRsvp){
      note="追跡中ですが、まだ時刻を特定できるRSVP増加はありません。";
    }else{
      note="作成後24時間の15分観測から、RSVPが増えた区間の中点時刻をJSTで集計しています。";
    }

    const badge=top?"最多 "+top.label+" +"+top.rsvpIncrease:"データ収集中";
    let slotsHtml="";
    if(a.trackedMeetups){
      slotsHtml='<div class="reaction-r5-slots">'+(a.slots||[]).map(function(row){
        const value=Number(row.rsvpIncrease)||0;
        const width=max>0?Math.max(0,value/max*100):0;
        return '<div class="reaction-r5-slot"><div class="reaction-r5-slot-top"><span>'+esc(row.label)+'</span><span class="reaction-r5-slot-value">+'+esc(value)+'</span></div><div class="reaction-r5-track"><div class="reaction-r5-fill" style="width:'+width.toFixed(1)+'%"></div></div></div>';
      }).join("")+'</div>';
    }

    return '<div class="reaction-r5-head"><div><div class="reaction-r5-kicker">Reaction Timing</div><h3 style="margin:3px 0 0;color:#4c1d95;font-size:18px">⏱️ RSVPが増えた時間</h3></div><span class="reaction-r5-badge">'+esc(badge)+'</span></div>'+
      '<div class="reaction-r5-note">'+esc(note)+'</div>'+slotsHtml+
      '<div class="reaction-r5-meta">'+
        '<div class="reaction-r5-stat"><b>+'+esc(a.positiveRsvp||0)+'</b><span>時刻を特定できたRSVP増加</span></div>'+
        '<div class="reaction-r5-stat"><b>'+esc(a.positiveIntervals||0)+'</b><span>増加した観測区間</span></div>'+
        '<div class="reaction-r5-stat"><b>-'+esc(a.cancelledRsvp||0)+'</b><span>キャンセル相当の減少</span></div>'+
        '<div class="reaction-r5-stat"><b>+'+esc(a.unattributedInitialRsvp||0)+'</b><span>初回観測前で時刻不明</span></div>'+
      '</div>'+
      '<div class="reaction-r5-foot">45分を超える観測間隔は時間帯集計から除外。初回観測時点ですでに付いていたRSVPは、正確な時刻が分からないためランキングへ入れません。長間隔除外 '+esc(a.longGapIntervals||0)+'区間 / 初回観測6時間超のMeetup '+esc(a.excludedLateMeetups||0)+'件。</div>';
  }

  async function mountOnce(){
    const feature=document.querySelector('.feature-app.reach.on');
    const root=document.getElementById("reach7Root");
    if(!feature||!root||!root.parentElement)return false;
    if(document.getElementById("reachReactionR5"))return true;
    const r4=document.getElementById("reachReactionR4");
    if(!r4||!r4.parentElement||r4.parentElement!==root.parentElement)return false;
    const id=communityId();
    if(!id)return false;

    ensureStyle();
    const serial=++mountSerial;
    const box=document.createElement("section");
    box.id="reachReactionR5";
    box.className="reaction-r5";
    box.dataset.version=VERSION;
    box.innerHTML='<div class="reaction-r5-note">RSVPの反応時刻を集計中...</div>';
    r4.insertAdjacentElement("afterend",box);

    try{
      const result=await loadCommunity(id);
      if(serial!==mountSerial||!document.body.contains(box))return true;
      box.innerHTML=cardHtml(result);
      window.CAReachReactionR5LastResult=result;
      window.dispatchEvent(new CustomEvent("ca-clover:reach-timing",{detail:{communityId:id,result}}));
    }catch(err){
      console.warn("Community Reaction R5 failed",err);
      if(document.body.contains(box))box.innerHTML='<div class="reaction-r5-note">反応時刻の読み込みに失敗しました。Meetup個別データは引き続き確認できます。</div>';
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

  window.CAReachReactionR5={
    VERSION,
    TIME_ZONE,
    WINDOW_HOURS,
    MAX_INTERVAL_MINUTES,
    analyzeData,
    loadCommunity,
    cardHtml,
    mount:scheduleMount
  };
})();