// Synthetic read-only contract test. No external auth, Neon or production calls.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const source = fs.readFileSync(path.join(__dirname, "../src/app/api/new-ca/identity-diagnostic/route.js"), "utf8")
  .replace(/^import .*;$/gm, "")
  .replace(/export const /g, "const ")
  .replace(/export async function /g, "async function ");
const state = { ready: true, valid: true, role: null, profileError: false, google: true, calls: 0 };
const NextResponse = { json: (body, opts) => ({ status: opts.status, body }) };
const createClient = () => ({
  auth: { getUser: async () => ({ data: { user: state.valid ? { id: "synthetic", identities: [] } : null }, error: state.valid ? null : { message: "bad" } }) },
  from: (table) => {
    assert.equal(table, "profiles");
    state.calls++;
    return { select: () => ({ eq: () => ({ maybeSingle: async () => ({
      data: state.role === null ? null : { role: state.role },
      error: state.profileError ? { message: "denied" } : null,
    }) }) }) };
  },
});
const { GET } = new Function("NextResponse", "createClient", "isIsolatedBridgeReady", "verifiedGoogleProviderSubject", "process",
  source + "\nreturn { GET };")(NextResponse, createClient, () => state.ready, () => state.google, {
    env: { NEXT_PUBLIC_SUPABASE_URL: "https://wgiittrvgtiosogyhfcl.supabase.co" },
  });
const request = token => ({ headers: { get: () => token ? "Bearer " + token : null } });
(async () => {
  let result = await GET(request("synthetic.valid.token.123456789"));
  assert.equal(result.body.code, "PROFILE_MISSING");
  assert.equal(result.body.productionActivated, false);
  state.role = "pending";
  result = await GET(request("synthetic.valid.token.123456789"));
  assert.equal(result.body.code, "PROFILE_FOUND");
  assert.equal(result.body.role, "pending");
  state.role = "admin";
  result = await GET(request("synthetic.valid.token.123456789"));
  assert.equal(result.body.code, "PROFILE_FOUND");
  assert.equal(result.body.role, "admin");
  state.role = "unexpected";
  result = await GET(request("synthetic.valid.token.123456789"));
  assert.equal(result.status, 409);
  state.profileError = true;
  result = await GET(request("synthetic.valid.token.123456789"));
  assert.equal(result.body.code, "PROFILE_READ_FAILED");
  state.profileError = false;
  state.valid = false;
  result = await GET(request("synthetic.valid.token.123456789"));
  assert.equal(result.status, 401);
  state.ready = false;
  result = await GET(request("synthetic.valid.token.123456789"));
  assert.equal(result.body.code, "PREVIEW_ONLY");
  state.ready = true;
  result = await GET(request(null));
  assert.equal(result.body.code, "SESSION_REQUIRED");
  assert.equal(/INSERT|UPDATE|DELETE|UPSERT/i.test(source), false, "diagnostic must remain read-only");
  console.log("PASS 8 synthetic diagnostic cases; no production writes");
})().catch(e => { console.error(e); process.exitCode = 1; });
