from pathlib import Path

p=Path('docs/index.html')
s=p.read_text()

css_anchor='''    .claim{border:1px solid #ecfccb;border-radius:20px;padding:16px;background:white}.claim+.claim{margin-top:10px}.claim.clickable{cursor:pointer;transition:.18s transform,.18s border-color,.18s box-shadow}.claim.clickable:hover{transform:translateY(-2px);border-color:#bef264;box-shadow:0 12px 30px rgba(77,124,15,.10)}.tags{display:flex;gap:7px;flex-wrap:wrap;margin-top:10px}\n'''
css_new=css_anchor+'''    .upcoming-strip{display:flex;gap:14px;overflow-x:auto;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;padding:7px 2px 14px;overscroll-behavior-x:contain}.upcoming-strip::-webkit-scrollbar{height:7px}.upcoming-strip::-webkit-scrollbar-thumb{background:#d6b07b;border-radius:999px}.upcoming-sign{position:relative;flex:0 0 min(84vw,420px);scroll-snap-align:start;border:1px solid #b88146;border-radius:22px;padding:19px 18px 17px;text-align:left;background:linear-gradient(92deg,rgba(255,255,255,.18),transparent 22%,rgba(116,75,33,.08) 45%,transparent 68%,rgba(255,255,255,.16)),repeating-linear-gradient(0deg,#e8c790 0,#e8c790 8px,#e2bc80 9px,#e2bc80 11px);box-shadow:0 10px 24px rgba(91,55,23,.14),inset 0 1px 0 rgba(255,255,255,.45);color:#4a2b14}.upcoming-sign:before,.upcoming-sign:after{content:"";position:absolute;top:10px;width:8px;height:8px;border-radius:50%;background:#8b6a48;box-shadow:inset 0 1px 1px rgba(255,255,255,.35)}.upcoming-sign:before{left:11px}.upcoming-sign:after{right:11px}.upcoming-sign h3{color:#4a2b14}.upcoming-sign .wood-date{color:#6b4a2b;font-weight:950;font-size:12px;display:flex;align-items:center;gap:5px}.upcoming-sign .wood-location{color:#6b5743;font-weight:900;font-size:12px;margin-top:6px}.upcoming-sign .pill{background:#fff7e8;color:#5f452f;border:1px solid rgba(128,87,45,.12)}.upcoming-sign .wood-action{background:#f4f7cc;color:#4d7c0f;border-color:#d9e999}\n'''
assert css_anchor in s, 'css anchor not found'
s=s.replace(css_anchor,css_new,1)

func_anchor='''  function communityIconHtml(community,large){\n'''
helper='''  function upcomingMeetupCardHtml(m,index){\n    return '<button type="button" class="upcoming-sign" data-meetup-index="'+index+'"><div class="wood-date">'+e(fmt(m.starts_at))+(m.is_ca_meetup?'<span title="Host: Ambassador" aria-label="Host: Ambassador" style="font-size:9px;line-height:1">🟪</span>':'')+'</div><h3 style="margin-top:7px">'+e(m.title)+'</h3>'+(m.campfire_live_event_name?'<div style="margin-top:8px"><span class="pill" style="max-width:100%;white-space:normal;line-height:1.35">🏷️ '+e(m.campfire_live_event_name)+'</span></div>':'')+'<div class="wood-location">📍 '+e(m.location||"場所未取得")+'</div><div class="tags"><span class="pill wood-action">概要を見る →</span></div><div class="tags"><span class="pill">RSVP '+e(m.rsvp_count==null?"—":m.rsvp_count)+'</span><span class="pill">Check-in '+e(m.checkin_count==null?"—":m.checkin_count)+'</span>'+participationRateHtml(m)+'</div></button>';\n  }\n'''
assert func_anchor in s, 'function anchor not found'
s=s.replace(func_anchor,helper+func_anchor,1)

old='''    if(upcoming.length){\n      html+='<section class="card section"><h2>📅 今後のMeetup</h2><p class="muted small strong">開催予定 '+upcoming.length+'件</p><div class="section">'+upcoming.map(function(m,index){return meetupCardHtml(m,index)}).join("")+'</div></section>';\n    }\n'''
new='''    if(upcoming.length){\n      html+='<section class="card section"><div class="row between wraprow"><div><h2>📅 今後のMeetup</h2><p class="muted small strong">開催予定 '+upcoming.length+'件 · 横にスワイプ</p></div><span class="pill">⇆ SWIPE</span></div><div class="upcoming-strip section">'+upcoming.map(function(m,index){return upcomingMeetupCardHtml(m,index)}).join("")+'</div></section>';\n    }\n'''
assert old in s, 'upcoming section not found'
s=s.replace(old,new,1)

s=s.replace('const VERSION="my-community-20260927-history-count1";', 'const VERSION="my-community-20260927-upcoming-wood1";',1)
p.write_text(s)
