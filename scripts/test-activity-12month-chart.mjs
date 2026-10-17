// Isolated public UI regression: no login, DB, Campfire, or production calls.
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";

const html=readFileSync(new URL("../docs/index.html",import.meta.url),"utf8");
const match=html.match(/  function activityBucket\(period\)\{[\s\S]*?(?=  function route\(\))/);
assert(match,"Chart implementation must remain extractable for offline checks");
const activityChartHtml=runInNewContext(match[0]+"\nactivityChartHtml",{
 e:v=>String(v).replace(/&/g,"&amp;").replace(/</g,"&lt;")
});
const buckets=Array.from({length:13},(_,i)=>{
 const month=9+i;
 return {
  bucket:String(2025+Math.floor(month/12))+"-"+String(month%12+1).padStart(2,"0")+"-01",
  meetup_count:i+1,
  checkin_count:(i+1)*100
 };
});
const count=(text,regex)=>[...text.matchAll(regex)].length;
const chart=activityChartHtml([...buckets].reverse(),"month","1年",365);
assert.equal(count(chart,/<rect x="/g),12,"365-day RPC yields 13 buckets but chart displays exactly 12");
assert.equal(count(chart,/<circle cx="/g),12,"All months have Check-in points");
const polyline=[...chart.matchAll(/<polyline points="([^"]+)"/g)];
assert.equal(polyline.length,1,"All twelve months must share one continuous line");
const points=polyline[0][1].trim().split(/\s+/);
assert.equal(points.length,12);
const x=points.map(point=>Number(point.split(",")[0]));
assert(x.every((v,i)=>i===0||v>x[i-1]),"Monthly coordinates must increase left to right");
const months=[...chart.matchAll(/font-weight="700" fill="#475569">([^<]+)<\/text>/g)].map(x=>x[1]);
assert.deepEqual(months,["11月","12月","1月","2月","3月","4月","5月","6月","7月","8月","9月","10月"]);
assert.match(chart,/2025\/11 ～ 2026\/10（直近12か月）/);
assert.doesNotMatch(chart,/2025\/10/);
assert.match(chart,/Check-in 1,300/,"Keep original Check-in values in tooltips");
assert.match(chart,/Meetup 13回/,"Keep original Meetup values in tooltips");
assert.match(chart,/class="trendbox activity-chart-scroll" role="region" tabindex="0"/);
assert.match(chart,/左右にスワイプして12か月を表示/);
const other=activityChartHtml(buckets.slice(0,7),"month","6か月",180);
assert.equal(count(other,/<rect x="/g),7,"Do not truncate other periods");
assert.doesNotMatch(other,/直近12か月|左右にスワイプして12か月/);
assert.match(html,/\.activity-scroll-hint\{display:block\}/,"Mobile swipe affordance must be visible");
assert.match(html,/\.activity-chart-scroll:focus-visible/,"Keyboard scroll region needs focus styling");
assert.match(html,/html\+=activityChartHtml\(trend,trendBucket,periodLabel,period\)/);
console.log("PASS Activity 12-month chronology, continuous line, scroll, numerical tooltips and other periods");
