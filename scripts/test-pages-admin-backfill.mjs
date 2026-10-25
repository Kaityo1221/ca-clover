import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {execFileSync} from "node:child_process";

const html=readFileSync("docs/admin.html","utf8");
const base=execFileSync("git",["show","origin/pages:docs/admin.html"],{encoding:"utf8"});
const menu='\n  ["meetup-backfill","🧩","Meetup履歴補完","取得漏れをURLから確認",0],';
const route='\n if(r==="meetup-backfill")return meetupBackfill();';
const start='\nasync function meetupBackfill(){';
const end='\nasync function render(){';

assert.equal(html.split(menu).length-1,1,"exactly one additive menu item");
assert.equal(html.split(route).length-1,1,"exactly one additive route");
const si=html.indexOf(start),ei=html.indexOf(end,si+1);
assert(si>0&&ei>si,"isolated additive screen function");
const added=html.slice(si,ei);
assert.match(added,/body:\{action:"preview",url\}/,"read only preview action");
assert.match(added,/typeof data\?\.readOnly!=="boolean"/,"fails closed unless backend explicitly states readOnly");
assert.match(added,/data\.readOnly===false/,"never allow saving from readOnly response");
assert.match(added,/data\.canSave===true/,"commit button requires explicit save capability");
assert.match(added,/data\.registrationContract==="atomic-audit-v1"/,"commit button requires approved atomic audit protocol");
assert.match(added,/previewAge<=600000/,"preview must be no older than ten minutes");
assert.match(added,/idOK\(event\.clubId\)/,"event must have verified Campfire owner");
assert.match(added,/idOK\(community\.id\)/,"community must be a validated UUID");
assert.match(added,/Date\.parse\(event\.createdAt\)/,"event creation time is mandatory before enabling save");
assert.match(added,/checkedAt:data\.checkedAt/,"commit must send the preview timestamp");
assert.match(added,/canCommit\?\x27\x27:\x27disabled aria-disabled="true"\x27/,"button disabled by default");
assert.match(added,/body:\{action:"apply",requestId,url:event.url,expected:/,"commit requires explicit action and idempotency ID");
assert.match(added,/function meetupBackfill\(\)/);
assert.doesNotMatch(added,/\.insert\s*\(|\.update\s*\(|\.upsert\s*\(|\.delete\s*\(|\.rpc\s*\(|auth\.signOut\s*\(/,"new screen must not mutate DB or sessions");
const restored=html.slice(0,si)+html.slice(ei+1); // remove the extra separator newline introduced with the screen
const exact=restored.replace(menu,"").replace(route,"");
if(exact!==base){
 let at=0;while(at<exact.length&&at<base.length&&exact[at]===base[at])at++;
 throw new Error("ADMIN baseline mismatch at byte "+at+"; actual "+JSON.stringify(exact.slice(Math.max(0,at-50),at+120))+" expected "+JSON.stringify(base.slice(Math.max(0,at-50),at+120)));
}
const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(x=>x[1]).filter(x=>x.trim());
assert(scripts.length>=1);
for(const src of scripts)new Function(src); // parse only; don't execute
process.stdout.write("PASS production pages content preserved byte-for-byte outside 3 additions; inline script syntax valid; save button is gated by future audited backend contract.\n");
