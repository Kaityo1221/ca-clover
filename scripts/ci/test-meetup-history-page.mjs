import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
const html=fs.readFileSync(new URL("../../docs/index.html",import.meta.url),"utf8");
test("every inline script parses",()=>{
 const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m=>m[1]).filter(s=>s.trim());
 assert.ok(scripts.length);
 for(const script of scripts)assert.doesNotThrow(()=>new vm.Script(script));
});
test("history control has 25, 50, 100 and all and category selector",()=>{
 assert.match(html,/MEETUP_HISTORY_LIMITS=\[25,50,100,null\]/);
 assert.match(html,/data-history-limit/);
 assert.match(html,/data-history-category/);
 assert.match(html,/historyCategoryModule\.MEETUP_CATEGORIES/);
});
test("full-history scan and category filters are connected to verified loader",()=>{
 assert.match(html,/historyLoaderReady\.then\(function\(module\)/);
 assert.match(html,/module\.loadMeetupHistory\(/);
 assert.match(html,/scanAll:meetupHistoryLimit===null\|\|meetupHistoryCategory!=="all"/);
 assert.match(html,/historyDisplayEntries=meetupHistoryLimit===null\?categoryFiltered:categoryFiltered\.slice\(0,meetupHistoryLimit\)/);
 assert.match(html,/if\(results\[0\]\.error\)/);
});
test("latest metric updates remain active for more than 120 records",()=>{
 assert.match(html,/for\(let offset=0;offset<metricRows\.length;offset\+=100\)/);
 assert.match(html,/metricRows\.slice\(offset,offset\+100\)/);
});
