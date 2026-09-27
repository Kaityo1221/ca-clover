from pathlib import Path

p=Path('docs/index.html')
s=p.read_text()

# Feature hub styles.
anchor='''    .community-avatar{position:relative;width:64px;height:64px;flex:0 0 64px;border-radius:21px;overflow:hidden;border:1px solid #ecfccb;background:#f7fee7;display:grid;place-items:center;font-size:30px;box-shadow:0 8px 22px rgba(77,124,15,.08)}.community-avatar.large{width:88px;height:88px;flex-basis:88px;border-radius:28px;font-size:38px;box-shadow:0 12px 30px rgba(77,124,15,.12)}.community-avatar .icon-fallback{position:absolute;inset:0;display:grid;place-items:center}.community-avatar img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}.community-hero-row{display:flex;align-items:center;gap:16px;min-width:0}.community-hero-row>div:last-child{min-width:0}\n'''
insert=anchor+'''    .community-hub-layout{display:grid;grid-template-columns:minmax(0,1fr) 250px;gap:22px;align-items:start}.feature-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.feature-app{aspect-ratio:1;border:1px solid #d9f99d;border-radius:24px;background:linear-gradient(145deg,#fff,#f7fee7);box-shadow:0 8px 22px rgba(77,124,15,.08);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px;color:#365314;font-weight:950;text-align:center;padding:10px;transition:.18s transform,.18s box-shadow}.feature-app:hover{transform:translateY(-2px);box-shadow:0 12px 28px rgba(77,124,15,.13)}.feature-app .feature-icon{font-size:28px;line-height:1}.feature-app .feature-label{font-size:12px;line-height:1.15}.feature-app.growth{background:linear-gradient(145deg,#f7fee7,#ecfccb)}.feature-app.activity{background:linear-gradient(145deg,#eff6ff,#f8fafc)}.feature-app.insights{background:linear-gradient(145deg,#fff7ed,#fffbeb)}.feature-app.reach{background:linear-gradient(145deg,#faf5ff,#f5f3ff)}.feature-app.on{outline:3px solid rgba(132,204,22,.24);border-color:#84cc16}.feature-page-head{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}\n'''
assert anchor in s, 'community avatar CSS anchor not found'
s=s.replace(anchor,insert,1)

mobile='''    @media(max-width:760px){.g2,.g3,.g4{grid-template-columns:1fr}.topin{align-items:flex-start}.nav{max-width:55vw;justify-content:flex-end}.brandblock{display:none}.wrap{padding-top:14px}.card{padding:18px}.modalback{align-items:flex-start;padding:12px}.modal{max-height:calc(100dvh - 24px);padding:18px}.modal>.row:first-child{position:sticky;top:-18px;z-index:5;background:#fff;padding:18px 0 10px}}\n'''
mobile_new='''    @media(max-width:760px){.g2,.g3,.g4{grid-template-columns:1fr}.topin{align-items:flex-start}.nav{max-width:55vw;justify-content:flex-end}.brandblock{display:none}.wrap{padding-top:14px}.card{padding:18px}.community-hub-layout{grid-template-columns:1fr;gap:16px}.feature-grid{max-width:330px;width:100%;margin:0 auto}.feature-app{border-radius:21px}.modalback{align-items:flex-start;padding:12px}.modal{max-height:calc(100dvh - 24px);padding:18px}.modal>.row:first-child{position:sticky;top:-18px;z-index:5;background:#fff;padding:18px 0 10px}}\n'''
assert mobile in s, 'mobile CSS anchor not found'
s=s.replace(mobile,mobile_new,1)

# Reset hub when entering a Community from My Community.
s=s.replace('''    app.querySelectorAll("[data-community]").forEach(function(b){\n      b.onclick=function(){go("community:"+encodeURIComponent(b.dataset.community))}\n    });\n''','''    app.querySelectorAll("[data-community]").forEach(function(b){\n      b.onclick=function(){communityFeatureView="home";meetupHistoryLimit=25;go("community:"+encodeURIComponent(b.dataset.community))}\n    });\n''',1)

start=s.find("    let html='<button id=\"backMy\"")
end=s.find('    app.innerHTML=html;\n',start)
assert start>=0 and end>start, 'render HTML block not found'

new_block=r'''    const featureMeta={
      growth:{icon:"🌱",label:"Growth",title:"Community Growth"},
      activity:{icon:"📈",label:"Activity",title:"Activity"},
      insights:{icon:"📊",label:"Insights",title:"Insights"},
      reach:{icon:"📣",label:"Reach",title:"Reach"}
    };
    const featureButtons='<div class="feature-grid">'+Object.keys(featureMeta).map(function(key){
      const f=featureMeta[key];
      return '<button type="button" class="feature-app '+key+' '+(communityFeatureView===key?'on':'')+'" data-community-feature="'+key+'"><span class="feature-icon">'+f.icon+'</span><span class="feature-label">'+f.label+'</span></button>';
    }).join("")+'</div>';
    const backLabel=communityFeatureView==="home"?'← My Community':'← Community';
    let html='<button id="backMy" class="linkbtn">'+backLabel+'</button>'+
      '<section class="card hero section"><div class="community-hub-layout"><div><div class="community-hero-row">'+communityIconHtml(community,true)+'<div><span class="pill">'+e(community.prefecture||"—")+'</span><h1 style="margin-top:10px">'+e(community.name)+'</h1></div></div>'+
      '<div class="tags">'+
      cas.map(function(ca){const mine=(profile&&profile.niantic_id?String(profile.niantic_id):"").replace(/^@+/,"").toLowerCase()===String(ca.trainer_name||"").replace(/^@+/,"").toLowerCase();const cls=ca.ca_level==="1st"?"amber":ca.ca_level==="2nd"?"blue":"";return '<span class="pill '+cls+'">'+e(ca.ca_level||"CA")+': '+e(ca.trainer_name)+(mine?'（あなた）':'')+'</span>'}).join("")+
      '</div><div class="tags"><span class="pill slate">Member: '+e(community.member_count==null?"未取得":Number(community.member_count).toLocaleString("ja-JP"))+'</span></div>'+(community.coverage!=="complete"?'<div class="notice section">⚠️ 一部の過去データが未取得のため、全期間集計は参考値です</div>':'')+(community.campfire_url?'<p><a href="'+e(community.campfire_url)+'" target="_blank" rel="noreferrer" style="color:#65a30d;font-weight:900">Campfireを開く ↗</a></p>':'')+'</div><div>'+featureButtons+'</div></div></section>';

    if(communityFeatureView==="home"){
      html+='<section class="card section"><div class="row between wraprow"><div><h2>📅 今後のMeetup</h2><p class="muted small strong">'+(upcoming.length?'開催予定 '+upcoming.length+'件 · 横にスワイプ':'現在、開催予定のMeetupはありません')+'</p></div>'+(upcoming.length?'<span class="pill">⇆ SWIPE</span>':'')+'</div>';
      if(upcoming.length){
        html+='<div class="upcoming-strip section">'+upcoming.map(function(m,index){return upcomingMeetupCardHtml(m,index)}).join("")+'</div>';
      }else{
        html+='<div class="notice section">新しいMeetupが作成されると、ここに表示されます。</div>';
      }
      html+='</section>';

      html+='<section class="card section"><div class="row between wraprow"><div><h2>🔥 Meetup履歴</h2><p class="muted small strong">RSVP '+historyRsvp.toLocaleString("ja-JP")+' / Check-in '+historyCheckin.toLocaleString("ja-JP")+' · 最新'+meetupHistoryLimit+'件表示</p></div><div class="periodbar" style="margin-top:0">'+MEETUP_HISTORY_LIMITS.map(function(n){return '<button type="button" class="periodbtn '+(n===meetupHistoryLimit?'active':'')+'" data-history-limit="'+n+'">'+n+'件</button>'}).join("")+'</div></div>';
      if(!meetups.length){
        html+='<div class="notice section">Meetup履歴はありません。</div>';
      }else{
        html+='<div class="section">'+meetups.map(function(m,index){return meetupCardHtml(m,upcoming.length+index)}).join("")+'</div>';
      }
      html+='</section>';
    }else{
      const current=featureMeta[communityFeatureView]||featureMeta.growth;
      html+='<section class="card section"><div class="feature-page-head"><div><span class="pill">'+current.icon+' '+e(current.label)+'</span><h2 style="margin-top:9px">'+e(current.title)+'</h2></div>'+(communityFeatureView!=="reach"?'<div class="periodbar" style="margin-top:0">'+COMMUNITY_PERIODS.map(function(item){return '<button type="button" class="periodbtn '+(item[1]===period?'active':'')+'" data-community-period="'+(item[1]===null?'all':item[1])+'">'+item[0]+'</button>'}).join("")+'</div>':'')+'</div></section>';
      if(communityFeatureView==="growth"){
        html+=memberGrowthHtml(memberSnapshots,periodLabel,community.member_count);
      }else if(communityFeatureView==="activity"){
        html+=activityChartHtml(trend,trendBucket,periodLabel);
      }else if(communityFeatureView==="insights"){
        html+='<section class="grid g4 section"><div class="metric"><span class="tiny strong muted">🔥 Meetup / '+e(periodLabel)+'</span><b>'+meetupCount.toLocaleString("ja-JP")+'</b></div><div class="metric"><span class="tiny strong muted">🍀 CA Meetup / '+e(periodLabel)+'</span><b>'+caMeetups.toLocaleString("ja-JP")+'</b></div><div class="metric"><span class="tiny strong muted">✅ Check-in / '+e(periodLabel)+'</span><b>'+totalCheckin.toLocaleString("ja-JP")+'</b></div><div class="metric"><span class="tiny strong muted">📊 参加率 / '+e(periodLabel)+'</span><b>'+e(periodRateText)+'</b>'+(periodRate==null?'<div class="tiny muted strong" style="margin-top:5px">RSVP 0のため</div>':'<div class="tiny muted strong" style="margin-top:5px">RSVP → Check-in</div>')+'</div></section>';
      }else if(communityFeatureView==="reach"){
        html+='<section class="card section"><h2>📣 Reach</h2><p class="muted strong">Meetup作成後にRSVPがどのように増えていったかを見る機能を、ここに追加します。</p><div class="notice section">Phase 7で実装予定です。データ蓄積は進めています。</div></section>';
      }
    }
    html+='<div class="version">mirror '+VERSION+'</div>';
'''
s=s[:start]+new_block+s[end:]

# Replace handlers so feature pages can be opened and returned from.
old='''    document.getElementById("backMy").onclick=function(){go("my")};\n'''
new='''    document.getElementById("backMy").onclick=function(){\n      if(communityFeatureView==="home"){go("my");return}\n      communityFeatureView="home";\n      void renderCommunity(id);\n    };\n    app.querySelectorAll("[data-community-feature]").forEach(function(b){\n      b.onclick=function(){communityFeatureView=b.dataset.communityFeature||"home";void renderCommunity(id)};\n    });\n'''
assert old in s, 'back handler not found'
s=s.replace(old,new,1)

s=s.replace('const VERSION="my-community-20260927-upcoming-wood1";', 'const VERSION="my-community-20260927-community-hub1";',1)
p.write_text(s)
