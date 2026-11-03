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
class Client { constructor() { throw Error("DB must not be reached while synthetic gate is closed"); } }
const BRIDGE_GUARD_MARKER = "ca-onboarding-neon-auth-branch-20261103";
const processMock = { env: {
  NEXT_PUBLIC_SUPABASE_URL: "https://wgiittrvgtiosogyhfcl.supabase.co",
  NEW_CA_ISOLATED_APPROVAL_ENABLED: "true",
  NEW_CA_STEP2_TRUSTED_RESOLVER_READY: "true",
  NEW_CA_PENDING_USER_VALIDATOR_READY: "true",
} };
const { POST } = new Function("NextResponse", "createClient", "isIsolatedBridgeReady",
  "checkDiscordCurrentRole", "Client", "BRIDGE_GUARD_MARKER", "process", route + "\nreturn { POST };")(
    NextResponse, createClient, () => state.ready, checkDiscordCurrentRole, Client, BRIDGE_GUARD_MARKER, processMock);
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
  assert.equal(r.body.code, "SYNTHETIC_ACTIVATION_GATE_CLOSED");
  assert.equal(r.body.productionActivated, false);
  assert.equal(state.discordCalls, 1);
  processMock.env.NEW_CA_SYNTHETIC_ACTIVATION_ENABLED = "true";
  r = await POST(request(valid, "https://attacker.invalid"));
  assert.equal(r.status, 403, "origin guard still applies when synthetic gate is enabled");
  r = await POST(request({ ...valid, unexpected: "write" }));
  assert.equal(r.status, 400, "extra input rejected before any DB connection");
  processMock.env.NEW_CA_SYNTHETIC_ACTIVATION_ENABLED = "false";
  r = await POST(request());
  assert.equal(r.body.code, "SYNTHETIC_ACTIVATION_GATE_CLOSED");
  assert.equal(r.body.productionActivated, false);
  // A closed synthetic activation gate must prevent all DB writes.
  assert.match(source, /NEW_CA_SYNTHETIC_ACTIVATION_ENABLED/);
  assert.match(source, /BEGIN/);
  assert.match(source, /ROLLBACK/);
  assert.match(source, /synthetic_community_memberships/);
  assert.doesNotMatch(source, /supabase\.from\([^)]*\)\.(insert|update|upsert|delete)/);
  console.log("PASS 7 isolated approval fail-closed checks; productionActivated=false");
})().catch(e => { console.error(e); process.exitCode = 1; });
