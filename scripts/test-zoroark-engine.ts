import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isZoroarkGameMasterRole, winner, type Round } from "../src/lib/zoroark-game.ts";
import { allowedZoroarkOrigin, allowedZoroarkRole, validateRoundRequest } from "../src/lib/zoroark-api-policy.ts";

const catalogSource = readFileSync(new URL("../src/lib/zoroark-catalog.server.ts", import.meta.url), "utf8");
const entries = [...catalogSource.matchAll(/\{ id: "([a-z][0-9]{2})", level: "(easy|normal|hard)", a: "([^"]+)", b: "([^"]+)"/g)];
assert.equal(entries.length,42);
assert.equal(new Set(entries.map(x=>x[1])).size,42);
assert.deepEqual(["easy","normal","hard"].map(level=>entries.filter(x=>x[2]===level).length),[12,15,15]);

for (const role of ["ca","admin"]) {
  assert.equal(allowedZoroarkRole(role), true);
  assert.equal(isZoroarkGameMasterRole(role), true);
}
for (const role of ["pending",null,undefined,"guest","CA",{},false]) {
  assert.equal(allowedZoroarkRole(role), false);
  assert.equal(isZoroarkGameMasterRole(role as null),false);
}
assert.equal(allowedZoroarkOrigin(null,"https://ca-clover.vercel.app"),true);
assert.equal(allowedZoroarkOrigin("https://ca-clover.vercel.app","https://ca-clover.vercel.app"),true);
assert.equal(allowedZoroarkOrigin("https://kaityo1221.github.io","https://ca-clover.vercel.app"),true);
assert.equal(allowedZoroarkOrigin("https://evil.example","https://ca-clover.vercel.app"),false);

assert.deepEqual(validateRoundRequest({count:6,difficulty:"easy",recent:["e01","e02","e01"]}),
  {count:6,difficulty:"easy",recent:["e01","e02"]});
assert.deepEqual(validateRoundRequest({count:8}),{count:8,difficulty:"all",recent:[]});
for (const value of [{count:2},{count:13},{count:6.5},{count:6,difficulty:"other"},
  {count:6,recent:"e01"},{count:6,recent:["not-valid"]},
  {count:6,recent:Array(7).fill("e01")},null,[]]) {
  assert.equal(validateRoundRequest(value),null);
}
const fixture:Round={
 pair:{id:"e01",level:"easy",a:"デデンネ",b:"エモンガ",common:"でんきタイプ",difference:"ひこう"},
 majority:"デデンネ", minority:"エモンガ",wolf:2,count:6,
 prompts:["デデンネ","デデンネ","エモンガ","デデンネ","デデンネ","デデンネ"]
};
assert.equal(winner(fixture,3),"villagers");
assert.equal(winner(fixture,2),"zoroark");
assert.throws(()=>winner(fixture,7));
assert.equal(fixture.prompts.filter(x=>x===fixture.minority).length,1);
console.log("ZOROARK_GM_POLICY_TEST_PASS");
