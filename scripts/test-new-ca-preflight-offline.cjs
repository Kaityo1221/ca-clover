// Offline-only regression for read-only new CA approval preflight.
// Synthetic adapters only: no external requests, secrets, or DB writes.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { isIsolatedPreflightReady } = require("../src/lib/new-ca-bridge-policy.ts");
const source = fs.readFileSync(path.join(__dirname, "../src/app/api/new-ca/approval-preflight/route.js"), "utf8");
const route = source.replace(/import[\s\S]*?from\s+"[^"]+";/g, "")
  .replace(/export const /g, "const ")
  .replace(/export async function /g, "async function ");
const state = { admin: true, enabled: true, authorized: true, matching: true,
  duplicate: false, discordCurrent: true, throwDb: false, dbQueries: [], externalCalls: 0 };
const env = {
  NEW_CA_BRIDGE_ENABLED: "true",
  VERCEL_ENV: "preview",
  VERCEL_GIT_COMMIT_REF: "qa/newca-webkit-validation-20261105",
  NEXT_PUBLIC_SUPABASE_URL: "https://wgiittrvgtiosogyhfcl.supabase.co",
  NEW_CA_LAB_DATABASE_URL: "postgresql://qa_user:synthetic_pass@ep-test-pooler.us-east-2.aws.neon.tech/ca_clover_test?sslmode=require",
};
const NextResponse = { json: (body, options) => ({ status: options.status, body }) };
const createClient = () => ({
  auth: { getUser: async () => state.authorized
    ? { data: { user: { id: "00000000-0000-4000-8000-000000000222" } }, error: null }
    : { data: { user: null }, error: true } },
  from: table => ({ select: () => ({ eq: () => ({
    maybeSingle: async () => ({ data: { role: state.admin ? "admin" : "pending" }, error: null }),
    then: callback => callback({ count: 0, error: null }),
  }) }) }),
});
class Client {
  async connect() { if (state.throwDb) throw new Error("synthetic offline DB unavailable"); }
  async query(sql) {
    state.dbQueries.push(sql);
    if (/\b(INSERT|UPDATE|DELETE|TRUNCATE|CREATE|ALTER|DROP|GRANT)\b/i.test(sql))
      throw new Error("preflight must not modify anything");
    if (sql.includes("environment_guard")) return { rowCount: 1, rows: [{ marker: "synthetic" }] };
    if (sql.includes("FROM ca_onboarding_lab.requests")) return { rows: state.duplicate ? [] : [{
      status: "ready_to_activate", discord_user_id: "837092365658619934",
      admin_verified_discord_id: "837092365658619934",
      reviewed_at: new Date().toISOString(), guild_id: "1463804285681926373",
      apac_role_id: "1506624152541466685", role_verified_at: new Date().toISOString(),
      linked: false, finalized: false, neon_google_linked: true, synthetic_master_valid: state.matching,
    }] };
    return { rowCount: 0, rows: [] };
  }
  async end() {}
}
const checkDiscordCurrentRole = async () => { state.externalCalls++; return state.discordCurrent; };
const api = new Function("NextResponse", "createClient", "Client",
  "isIsolatedPreflightReady", "BRIDGE_GUARD_MARKER", "checkDiscordCurrentRole", "process",
  route + "\nreturn { POST };")(
    NextResponse, createClient, Client, isIsolatedPreflightReady, "synthetic-guard",
    checkDiscordCurrentRole, { env });
const valid = {
  requestId: "00000000-0000-4000-8000-000000000111",
  confirmedDiscordId: "837092365658619934",
};
const req = (body = valid, origin = "https://isolated.example", token = "synthetic-admin-token-123456") => ({
  url: "https://isolated.example/api/new-ca/approval-preflight",
  headers: { get: key => ({
    origin, authorization: "Bearer " + token, "content-type": "application/json",
  })[key] ?? null },
  json: async () => body,
});
(async () => {
  let checks = 0;
  const verify = (name, response, status, code) => {
    assert.equal(response.status, status, name);
    assert.equal(response.body.code, code, name);
    assert.equal(response.body.productionActivated, false);
    checks++;
  };
  env.VERCEL_ENV = "production";
  verify("production is closed", await api.POST(req()), 503, "PREVIEW_ONLY");
  env.VERCEL_ENV = "preview";
  env.VERCEL_GIT_COMMIT_REF = "main";
  verify("main branch is closed", await api.POST(req()), 503, "PREVIEW_ONLY");
  env.VERCEL_GIT_COMMIT_REF = "qa/newca-webkit-validation-20261105";
  verify("cross origin refused", await api.POST(req(valid, "https://evil.invalid")), 403, "ORIGIN_MISMATCH");
  verify("unexpected fields refused", await api.POST(req({...valid, role: "admin"})), 400, "INVALID_REQUEST");
  verify("invalid bearer refused", await api.POST(req(valid, "https://isolated.example", "short")), 401, "BEARER_REQUIRED");
  state.authorized = false;
  verify("invalid session refused", await api.POST(req()), 401, "INVALID_SESSION");
  state.authorized = true;
  state.admin = false;
  verify("nonadmin refused", await api.POST(req()), 403, "ADMIN_REQUIRED");
  state.admin = true;
  state.duplicate = true;
  verify("unknown or ambiguous request refused", await api.POST(req()), 404, "APPLICATION_NOT_FOUND_OR_AMBIGUOUS");
  state.duplicate = false;
  verify("discord mismatch refused", await api.POST(req({...valid, confirmedDiscordId: "837092365658619935"})), 409, "DISCORD_ID_MISMATCH");
  state.matching = false;
  const unmatched = await api.POST(req());
  verify("missing master is read-only", unmatched, 200, "PREFLIGHT_READ_ONLY");
  assert.equal(unmatched.body.readyToActivate, false);
  assert.equal(unmatched.body.checks.syntheticCaMasterMatched, false);
  state.matching = true;
  const good = await api.POST(req());
  verify("matching synthetic evidence remains read-only", good, 200, "PREFLIGHT_READ_ONLY");
  assert.equal(good.body.readyToActivate, false);
  assert.ok(good.body.missing.includes("TRUSTED_CAMPFIRE_RESOLUTION"));
  assert.ok(good.body.missing.includes("PRODUCTION_SCHEMA_RPC_E2E"));
  state.throwDb = true;
  verify("database failure fails closed", await api.POST(req()), 503, "ISOLATED_PREFLIGHT_UNAVAILABLE");
  assert.ok(state.dbQueries.some(sql => sql === "BEGIN READ ONLY"), "read-only transaction required");
  assert.doesNotMatch(source, /\b(INSERT INTO|UPDATE public\.|DELETE FROM|GRANT )/i);
  console.log("TOTAL", checks, "PASS: synthetic approval preflight; zero DB writes");
})().catch(error => { console.error(error); process.exitCode = 1; });
