// Fail-closed regression for the isolated CA approval HTTP endpoint.
// No network, credentials, or database. The production writer must remain unreachable.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const source = fs.readFileSync(path.join(__dirname, "../src/app/api/new-ca/approve/route.js"), "utf8");
const route = source.replace(/import[\s\S]*?from\s+"[^"]+";/g, "")
  .replace(/export const /g, "const ")
  .replace(/export async function /g, "async function ");
const state = { ready: false, discordCalls: 0, authCalls: 0 };
const NextResponse = { json: (body, options) => ({ status: options.status, body }) };
const createClient = () => ({
  auth: { getUser: async () => { state.authCalls++; return { data: { user: { id: "synthetic-admin" } }, error: null }; } },
  from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { role: "admin" }, error: null }) }) }) }),
});
const checkDiscordCurrentRole = async () => { state.discordCalls++; return true; };
const processMock = { env: {
  NEXT_PUBLIC_SUPABASE_URL: "https://wgiittrvgtiosogyhfcl.supabase.co",
  NEW_CA_ISOLATED_APPROVAL_ENABLED: "true",
  NEW_CA_STEP2_TRUSTED_RESOLVER_READY: "true",
  NEW_CA_PENDING_USER_VALIDATOR_READY: "true",
} };
const { POST } = new Function("NextResponse", "createClient", "isIsolatedBridgeReady",
  "checkDiscordCurrentRole", "process", route + "\nreturn { POST };")(
    NextResponse, createClient, () => state.ready, checkDiscordCurrentRole, processMock);
const valid = { requestId: "00000000-0000-4000-8000-000000000001", confirmedDiscordId: "837092365658619934" };
function request(body=valid, origin="https://isolated.example", token="synthetic-token-123456") {
  return { url: "https://isolated.example/api/new-ca/approve",
    headers: { get: k => ({ origin, authorization: "Bearer "+token, "content-type": "application/json" })[k] || null },
    json: async () => body };
}
(async () => {
  let r = await POST(request());
  assert.equal(r.status, 503); assert.equal(r.body.code, "APPROVAL_WRITE_GATE_CLOSED");
  assert.equal(state.authCalls, 0);
  state.ready = true;
  r = await POST(request(valid, "https://attacker.invalid"));
  assert.equal(r.status, 403); assert.equal(state.authCalls, 0);
  r = await POST(request({ ...valid, role: "admin" }));
  assert.equal(r.status, 400); assert.equal(state.authCalls, 0);
  r = await POST(request());
  assert.equal(r.status, 503);
  assert.equal(r.body.code, "ATOMIC_FINALIZER_NOT_CONNECTED");
  assert.equal(r.body.productionActivated, false);
  assert.equal(state.discordCalls, 1);
  // Enabling every feature flag must not activate a CA or invoke a writer.
  assert.doesNotMatch(source, /(?:\.rpc\s*\(|finalize_isolated_approval\s*\()/);
  console.log("PASS 4 isolated approval fail-closed checks; productionActivated=false");
})().catch(e => { console.error(e); process.exitCode = 1; });
