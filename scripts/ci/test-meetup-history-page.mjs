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
test("all and category search beyond first 100, with stable ordering",()=>{
 assert.match(html,/meetupHistoryLimit===null\|\|meetupHistoryCategory!=="all"\?200:meetupHistoryLimit/);
 assert.match(html,/\.order\("starts_at",\{ascending:false\}\)\.order\("id",\{ascending:false\}\)\.range\(offset,offset\+199\)/);
 assert.match(html,/if\(next\.error\)/);
 assert.match(html,/meetups=meetups\.concat\(page\)/);
 assert.match(html,/categoryFiltered\.slice\(0,meetupHistoryLimit\)/);
});
