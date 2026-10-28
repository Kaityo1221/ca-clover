import assert from "node:assert/strict";
import {
  PAIRS, isZoroarkGameMasterRole, makeRound, pickPair, sanitizeRecentIds, winner,
} from "../src/lib/zoroark-game.ts";

assert.equal(PAIRS.length, 42);
assert.equal(new Set(PAIRS.map(p => p.id)).size, PAIRS.length);
assert.deepEqual(["easy","normal","hard"].map(level => PAIRS.filter(p => p.level === level).length), [12,15,15]);
assert.ok(PAIRS.every(p => p.a !== p.b && p.common && p.difference));
assert.equal(isZoroarkGameMasterRole("ca"), true);
assert.equal(isZoroarkGameMasterRole("admin"), true);
assert.equal(isZoroarkGameMasterRole("pending"), false);
assert.equal(isZoroarkGameMasterRole(null), false);
assert.equal(isZoroarkGameMasterRole(undefined), false);
assert.deepEqual(sanitizeRecentIds(["e01","bogus","e01","h01"]), ["e01","h01"]);
assert.deepEqual(sanitizeRecentIds("not-an-array"), []);
const easy = PAIRS.filter(p => p.level === "easy");
const selected = pickPair("easy", easy.slice(0,6).map(p => p.id), () => 0);
assert.equal(selected.id, easy[6].id);
const a = makeRound(6, selected, max => max === 2 ? 0 : 2);
assert.equal(a.prompts.length, 6);
assert.equal(a.prompts.filter(p => p === a.minority).length, 1);
assert.equal(a.prompts.filter(p => p === a.majority).length, 5);
assert.equal(a.wolf, 2);
assert.equal(winner(a,3),"villagers");
assert.equal(winner(a,2),"zoroark");
const b = makeRound(8, selected, max => max === 2 ? 1 : 0);
assert.equal(b.majority, selected.b);
assert.equal(b.minority, selected.a);
assert.equal(b.prompts.filter(p => p === b.minority).length, 1);
assert.throws(() => makeRound(2, selected, () => 0));
assert.throws(() => makeRound(13, selected, () => 0));
assert.throws(() => winner(a, 7));
assert.throws(() => pickPair("easy", [], () => 99));
console.log("zoroark local GM unit checks PASS");
