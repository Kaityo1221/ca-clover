// Synthetic Discord live-role regression. No network or real credentials.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const source = fs.readFileSync(path.join(__dirname, "../src/lib/new-ca-discord-live.js"), "utf8")
  .replace("export async function", "async function");
const check = new Function("fetch", "AbortSignal", source + "\nreturn checkDiscordCurrentRole;")(
  () => { throw Error("unexpected live network"); }, { timeout: () => ({}) });
const id = "837092365658619934";
const role = "1506624152541466685";
const token = "synthetic_bot_token_1234567890";
(async () => {
  const cases = [
    ["current APAC CA role", { ok: true, json: async () => ({ user: { id }, pending: false, roles: [role] }) }, true],
    ["missing role", { ok: true, json: async () => ({ user: { id }, pending: false, roles: [] }) }, false],
    ["wrong Discord identity", { ok: true, json: async () => ({ user: { id: "837092365658619935" }, pending: false, roles: [role] }) }, false],
    ["pending Discord membership", { ok: true, json: async () => ({ user: { id }, pending: true, roles: [role] }) }, false],
    ["Discord API denied", { ok: false }, false],
  ];
  for (const [name, response, expected] of cases) {
    assert.equal(await check(id, token, async () => response), expected, name);
    console.log("PASS", name);
  }
  assert.equal(await check(id, "", () => { throw Error("must not fetch"); }), false);
  console.log("PASS no bot token fails closed");
  console.log("ALL 6 SYNTHETIC DISCORD LIVE ROLE CHECKS PASS");
})().catch(e => { console.error(e); process.exitCode = 1; });
