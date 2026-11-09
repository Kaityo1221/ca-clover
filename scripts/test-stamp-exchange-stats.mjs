import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const stats = require("../docs/stamp-exchange-stats-core.js");
const row = (exchange_key, completed_at) => ({ exchange_key, completed_at });
const check = (label, fn) => {
  fn();
  process.stdout.write("PASS: " + label + "\n");
};
check("JST midnight cutover", () => {
  assert.equal(stats.jstDate("2026-11-07T14:59:59Z"), "2026-11-07");
  assert.equal(stats.jstDate("2026-11-07T15:00:00Z"), "2026-11-08");
});
check("one pair counts once / duplicates ignored", () => {
  const result = stats.build([
    row("pair-1", "2026-11-07T14:00:00Z"),
    row("pair-1", "2026-11-07T14:00:00Z"),
    row("pair-2", "2026-11-07T15:00:00Z"),
    row("pair-3", "2026-11-09T00:00:00Z")
  ], "2026-11-09T09:00:00Z");
  assert.equal(result.total, 3);
  assert.deepEqual(result.days.map(x => [x.day, x.count, x.cumulative]), [
    ["2026-11-07", 1, 1],
    ["2026-11-08", 1, 2],
    ["2026-11-09", 1, 3]
  ]);
});
check("zero-exchange days retain total", () => {
  const result = stats.build([row("a", "2026-11-01T00:00:00Z"),
    row("b", "2026-11-04T00:00:00Z")], "2026-11-05T01:00:00Z");
  assert.equal(result.days.length, 5);
  assert.deepEqual(result.days.map(x => x.count), [1, 0, 0, 1, 0]);
  assert.deepEqual(result.days.map(x => x.cumulative), [1, 1, 1, 2, 2]);
});
check("7/30/all periods preserve global cumulative", () => {
  const rows = [];
  for (let i=1;i<=40;i++) rows.push(row("exchange-"+i, new Date(Date.UTC(2026,9,i,0)).toISOString()));
  const result = stats.build(rows, "2026-11-10T00:00:00Z");
  const recent7 = stats.recent(result.days, "7");
  const recent30 = stats.recent(result.days, "30");
  assert.equal(recent7.length, 7);
  assert.equal(recent30.length, 30);
  assert.equal(stats.recent(result.days, "all").length, result.days.length);
  assert.equal(recent7.at(-1).cumulative, result.total);
});
check("calendar month view is bounded to one month", () => {
  const days=[
    ...Array.from({length:17},(_,i)=>({day:"2026-10-"+String(i+15).padStart(2,"0"),cumulative:i+1})),
    ...Array.from({length:9},(_,i)=>({day:"2026-11-"+String(i+1).padStart(2,"0"),cumulative:18+i}))
  ];
  const oct=stats.monthDays(days,"2026-10");
  const nov=stats.monthDays(days,"2026-11");
  assert.equal(oct.length,17);
  assert.equal(nov.length,9);
  assert.equal(nov.at(-1).cumulative,26);
  assert.equal(stats.monthKey("2026-11-09"),"2026-11");
  assert.equal(stats.shiftMonth("2026-11",-1),"2026-10");
  assert.equal(stats.shiftMonth("2026-12",1),"2027-01");
  assert.equal(stats.shiftMonth("2027-01",-1),"2026-12");
  assert.throws(()=>stats.monthKey("2026-13"));
  assert.throws(()=>stats.shiftMonth("invalid",1));
});
check("month switch and bounded iPhone scrolling controls", () => {
  const html=fs.readFileSync("docs/stamp-exchange-stats.html","utf8");
  assert.match(html,/id="prevMonthBtn"/);
  assert.match(html,/id="nextMonthBtn"/);
  assert.match(html,/id="historyMonthLabel"/);
  assert.match(html,/core\.monthDays\(aggregate\.days,displayedMonth\)/);
  assert.match(html,/core\.monthKey\(aggregate\.asOfDate\)/);
  assert.match(html,/get\("dailyTableBox"\)\.scrollTop=0/);
  assert.match(html,/scrollTop=0/);
  assert.match(html,/#dailyTableBox\{max-height:340px;overflow-y:auto/);
  assert.match(html,/#dailyTableBox thead th\{position:sticky/);
  assert.match(html,/min-height:44px/);
  assert.match(html,/日付を押すと交換内訳を確認できます/);
  assert.doesNotMatch(html,/dailyExpanded|dailyMoreBtn|直近5日分/);
});
check("empty history", () => {
  assert.deepEqual(stats.build([], "2026-11-09T00:00:00Z").days, []);
  assert.equal(stats.build([], "2026-11-09T00:00:00Z").total, 0);
});
check("incomplete completed transaction fails visibly", () => {
  assert.throws(()=>stats.build([row("missing",null)],"2026-11-09T00:00:00Z"), /未確定/);
});
check("new UI inline JS parses and remains admin-only", () => {
  const html = fs.readFileSync("docs/stamp-exchange-stats.html", "utf8");
  const inline = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  assert.equal(inline.length, 1);
  assert.doesNotThrow(()=>new vm.Script(inline[0], {filename:"stamp-exchange-stats.html:inline"}));
  assert.match(html,/getUser\(\)/);
  assert.match(html,/role!=="admin"/);
  assert.match(html,/\.eq\("status","completed"\)/);
  assert.match(html,/\.order\("exchange_key"/);
  assert.match(html,/\.select\("exchange_key,completed_at,user_a_id,user_b_id"\)/);
  assert.match(html,/\.eq\("is_primary",true\)/);
  assert.match(html,/data-day=/);
  assert.match(html,/\[data-ranking\]/);
  assert.match(html,/escapeHtml\(ca\.name\)/);
  assert.match(html,/data-period="all"/);
  assert.match(html,/data-period="30"/);
  assert.match(html,/data-period="7"/);
});
check("ADMIN menu links to stats page", () => {
  const admin=fs.readFileSync("docs/admin.html","utf8");
  assert.match(admin,/\["stamp-exchange-stats","📈"/);
  assert.match(admin,/\bdata-route===?"stamp-exchange-stats"|\bdataset\.route==="stamp-exchange-stats"/);
  assert.match(admin,/\.\/stamp-exchange-stats\.html/);
});
