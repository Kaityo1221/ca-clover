from pathlib import Path

p=Path('docs/index.html')
s=p.read_text()

# Independent Meetup history count state.
s=s.replace('let session=null, profile=null, permissions=new Set(), busy=false, flash=null, communityPeriod=90, renderToken=0;',
            'let session=null, profile=null, permissions=new Set(), busy=false, flash=null, communityPeriod=90, meetupHistoryLimit=25, communityFeatureView="home", renderToken=0;',1)
s=s.replace('const COMMUNITY_PERIODS=[["1か月",30],["3か月",90],["6か月",180],["1年",365],["全期間",null]];',
            'const COMMUNITY_PERIODS=[["1か月",30],["3か月",90],["6か月",180],["1年",365],["全期間",null]];\n  const MEETUP_HISTORY_LIMITS=[25,50,100];',1)

old='''    let meetupQuery=client.from("meetups")\n      .select(meetupFields)\n      .eq("community_id",id)\n      .lte("starts_at",nowIso)\n      .order("starts_at",{ascending:false})\n      .limit(period===null?500:50);\n    if(since) meetupQuery=meetupQuery.gte("starts_at",since);\n'''
new='''    let meetupQuery=client.from("meetups")\n      .select(meetupFields)\n      .eq("community_id",id)\n      .lte("starts_at",nowIso)\n      .order("starts_at",{ascending:false})\n      .limit(meetupHistoryLimit);\n'''
assert old in s, 'meetup query block not found'
s=s.replace(old,new,1)

old='''    const meetupCount=Number(summary.meetup_count||0);\n    const periodRate=totalRsvp>0?(totalCheckin/totalRsvp*100):null;\n'''
new='''    const meetupCount=Number(summary.meetup_count||0);\n    const historyRsvp=meetups.reduce(function(sum,m){const v=Number(m.rsvp_count);return sum+(Number.isFinite(v)?v:0)},0);\n    const historyCheckin=meetups.reduce(function(sum,m){const v=Number(m.checkin_count);return sum+(Number.isFinite(v)?v:0)},0);\n    const periodRate=totalRsvp>0?(totalCheckin/totalRsvp*100):null;\n'''
assert old in s, 'summary anchor not found'
s=s.replace(old,new,1)

old='''      activityChartHtml(trend,trendBucket,periodLabel)+\n      '<section class="card section"><h2>🔥 Meetup履歴 / '+e(periodLabel)+'</h2><p class="muted small strong">RSVP '+totalRsvp.toLocaleString("ja-JP")+' / Check-in '+totalCheckin.toLocaleString("ja-JP")+' · '+(period===null?'最大500件':'最新50件')+'表示</p>';\n'''
new='''      activityChartHtml(trend,trendBucket,periodLabel)+\n      '<section class="card section"><div class="row between wraprow"><div><h2>🔥 Meetup履歴</h2><p class="muted small strong">RSVP '+historyRsvp.toLocaleString("ja-JP")+' / Check-in '+historyCheckin.toLocaleString("ja-JP")+' · 最新'+meetupHistoryLimit+'件表示</p></div><div class="periodbar" style="margin-top:0">'+MEETUP_HISTORY_LIMITS.map(function(n){return '<button type="button" class="periodbtn '+(n===meetupHistoryLimit?'active':'')+'" data-history-limit="'+n+'">'+n+'件</button>'}).join("")+'</div></div>';\n'''
assert old in s, 'history header block not found'
s=s.replace(old,new,1)

old='''    app.querySelectorAll("[data-meetup-index]").forEach(function(b){\n'''
new='''    app.querySelectorAll("[data-history-limit]").forEach(function(b){\n      b.onclick=function(){\n        meetupHistoryLimit=Number(b.dataset.historyLimit)||25;\n        void renderCommunity(id);\n      };\n    });\n    app.querySelectorAll("[data-meetup-index]").forEach(function(b){\n'''
assert old in s, 'meetup handlers anchor not found'
s=s.replace(old,new,1)

s=s.replace('const VERSION="my-community-20260927-event-tag-only1";', 'const VERSION="my-community-20260927-history-count1";',1)

p.write_text(s)
