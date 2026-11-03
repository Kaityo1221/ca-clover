// Isolated preview bridge HTTP contract tests with synthetic GoTrue and Neon adapters.
// Never imports real credentials or reaches an external database.
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

const route = fs.readFileSync(path.join(__dirname, "../src/app/api/new-ca/bridge/route.js"), "utf8")
  .replace(/import[\s\S]*?from\s+"[^"]+";/g, "")
  .replace(/export const /g, "const ")
  .replace(/export async function /g, "async function ");

const env = {
  NEXT_PUBLIC_SUPABASE_URL: "https://wgiittrvgtiosogyhfcl.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_synthetic",
  NEW_CA_LAB_DATABASE_URL: "postgresql://test@localhost/synthetic",
};
const state = { enabled: true, role: "admin", token: "synthetic-session", googleSubject: "synthetic-google-provider", existingLinks: 0, writes: 0, googleMatches: true, linkOwner: null };
const NextResponse = { json: (body, { status }) => ({ status, body }) };
const application = {
  id: "00000000-0000-4000-8000-000000000111",
  trainer_name: "SyntheticCA0001",
  discord_user_id: "837092365658619934",
  discord_display_name: "Synthetic tester",
  discord_username: "synthetic",
  discord_nickname: "Synthetic group",
  discord_display_name_source: "discord_oauth",
  campfire_url: "https://campfire.scopely.com/discover/club/synthetic",
  status: "ready_to_activate",
  clover_linked: false,
  linked_to_viewer: false,
  same_google_as_viewer: true,
};
const supabase = () => ({
  auth: { getUser: async (token) => token === state.token
    ? { data: { user: { id: "00000000-0000-4000-8000-000000000222", identities: [{ provider: "google", provider_id: state.googleSubject }] } }, error: null }
    : { data: { user: null }, error: { message: "unauthorized" } } },
  from: (table) => ({
    select() {
      return {
        eq() {
          return table === "profiles"
            ? { maybeSingle: async () => ({ data: { role: state.role }, error: null }) }
            : Promise.resolve({ count: state.existingLinks, error: null });
        },
      };
    },
  }),
});
class Client {
  async connect() {}
  async end() {}
  async query(sql) {
    if (sql.includes("environment_guard")) return { rowCount: 1, rows: [{ marker: "guard" }] };
    if (sql.includes("SELECT r.id, r.trainer_name")) return { rowCount: 1, rows: [{ ...application, clover_linked: state.linkOwner !== null, linked_to_viewer: state.linkOwner === "00000000-0000-4000-8000-000000000222", same_google_as_viewer: state.googleMatches }] };
    if (sql.includes("FOR UPDATE OF r")) return state.googleMatches ? { rowCount: 1, rows: [{ id: application.id, clover_user_id: state.linkOwner }] } : { rowCount: 0, rows: [] };
    if (sql.includes("INSERT INTO ca_onboarding_lab.clover_identity_links")) {
      const first = state.linkOwner === null;
      if (first) { state.writes++; state.linkOwner = "00000000-0000-4000-8000-000000000222"; }
      return { rowCount: first ? 1 : 0, rows: first ? [{ request_id: application.id }] : [] };
    }
    return { rowCount: 0, rows: [] };
  }
}

const policy = {
  isIsolatedBridgeReady: () => state.enabled,
  verifiedGoogleProviderSubject: (user) => user?.identities?.find(x => x.provider === "google")?.provider_id ?? null,
  allowedToBindPreview: (role, linked, count) => role === "pending" && linked === 0 && count === 1,
};
const api = new Function(
  "NextResponse","createClient","Client","BRIDGE_GUARD_MARKER",
  "isIsolatedBridgeReady","verifiedGoogleProviderSubject","allowedToBindPreview","process",
  route + "\nreturn { GET, POST }",
)(NextResponse,supabase,Client,"synthetic-guard",
  policy.isIsolatedBridgeReady,policy.verifiedGoogleProviderSubject,policy.allowedToBindPreview,{env});

const request = (method, token = state.token, origin = "https://isolated.example", body = {}) => ({
  method, url: "https://isolated.example/api/new-ca/bridge",
  headers: { get: key => ({
    authorization: token ? "Bearer " + token : null,
    origin,
    "content-type": "application/json",
  })[key] ?? null },
  json: async () => body,
});
const assertStatus = (name, value, expected) => {
  assert.equal(value.status, expected, name);
  console.log("PASS", name, expected);
};

(async () => {
  state.enabled = false;
  assertStatus("bridge disabled by default", await api.GET(request("GET")), 503);
  state.enabled = true;
  assertStatus("invalid bearer refused", await api.GET(request("GET","bad")), 401);

  state.role = "admin";
  const list = await api.GET(request("GET"));
  assertStatus("admin may read isolated queue", list, 200);
  assert.equal(list.body.applications.length, 1);
  assert.equal(list.body.productionActivated, false);

  state.role = "pending";
  const own = await api.GET(request("GET"));
  assertStatus("applicant only sees Google-owned application", own, 200);
  assert.equal(own.body.applications.length, 1);

  state.googleMatches = false;
  const foreign = await api.GET(request("GET"));
  assertStatus("different Google identity may request queue safely", foreign, 200);
  assert.equal(foreign.body.applications.length, 0, "foreign user's Discord/CA data not disclosed");
  const foreignPost = await api.POST(request("POST",state.token,"https://isolated.example",{
    action: "bind", requestId: application.id,
  }));
  assertStatus("foreign Google provider subject cannot bind another applicant", foreignPost, 409);
  assert.equal(state.writes, 0, "no link may be inserted for foreign Google identity");
  state.googleMatches = true;

  state.role = "ca";
  assertStatus("existing CA may not bind", await api.POST(request("POST")), 403);
  state.role = "pending";
  assertStatus("cross-origin submission refused", await api.POST(request("POST",state.token,"https://attacker.invalid")), 403);
  state.existingLinks = 1;
  assertStatus("existing user CA identity preserved", await api.POST(request("POST")), 409);
  state.existingLinks = 0;

  const post = request("POST",state.token,"https://isolated.example",{
    action: "bind", requestId: application.id,
  });
  const bound = await api.POST(post);
  assertStatus("pending verified Google binding writes only isolated Neon", bound, 200);
  assert.equal(bound.body.productionActivated, false);
  const replay = await api.POST(post);
  assertStatus("same owner binding replay is idempotent", replay, 200);
  assert.equal(replay.body.alreadyLinked, true);
  assert.equal(state.writes, 1, "replay must not write twice");
  const linkedList = await api.GET(request("GET"));
  assertStatus("applicant sees owned link", linkedList, 200);
  assert.equal(linkedList.body.applications[0].cloverLinkedByViewer, true);
  console.log("ALL SYNTHETIC BRIDGE TESTS PASS; no CA Clover production mutations");
})().catch(e => { console.error(e); process.exitCode = 1; });
