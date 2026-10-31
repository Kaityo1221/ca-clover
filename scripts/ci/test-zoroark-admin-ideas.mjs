import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {Script} from "node:vm";
const html=readFileSync("docs/index.html","utf8");
const module=readFileSync("docs/zoroark-ideas.mjs","utf8");
for(const [,inline] of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)){if(inline.trim())new Script(inline)}
assert.ok(html.includes('if(v==="zoroark-ideas")'));
assert.ok(html.includes('if(profile?.role!=="admin")'));
assert.ok(html.includes('ideasLeave()'));
assert.ok(html.includes('if(profile?.role==="admin")items.push'));
assert.ok(module.includes('if(role!=="admin")throw Error'));
assert.ok(module.includes('data-gen'));
assert.ok(module.includes('data-choose'));
assert.ok(module.includes('data-save'));
assert.ok(module.includes('JSON.stringify(entries)'));
assert.ok(module.includes('data-export'));
assert.ok(module.includes('raw.githubusercontent.com/Kaityo1221/Global-EN-Trainer/main/data/'));
assert.ok(!module.includes('service_role'));
console.log("ZOROARK_ADMIN_IDEA_UI_PASS");
