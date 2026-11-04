const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const source = fs.readFileSync(path.join(__dirname, "../src/app/api/new-ca/isolated-enroll/route.js"), "utf8")
  .replace(/import[\s\S]*?from\s+"[^"]+";/g, "")
  .replace(/export const /g, "const ")
  .replace(/export async function /g, "async function ");
const state = { ready: true, user: true, google: true, role: null, identities: 0, labRole: null, writes: 0, guard: true };
const response = { json: (body, options) => ({ status: options.status, body }) };
const createClient = () => ({
  auth: { getUser: async () => ({ data: { user: state.user ? { id: "00000000-0000-4000-8000-000000000222" } : null }, error: null }) },
  from: table => ({ select: () => ({ eq: () => table === "profiles"
    ? { maybeSingle: async () => ({ data: state.role ? { role: state.role } : null, error: null }) }
    : Promise.resolve({ count: state.identities, error: null }) }) }),
});
class Client {
  async connect() {}
  async end() {}
  async query(sql) {
    if (sql.includes("environment_guard")) return { rowCount: state.guard ? 1 : 0, rows: [] };
    if (sql.includes("INSERT INTO ca_onboarding_lab.synthetic_profiles")) {
      if (state.labRole === null) { state.labRole = "pending"; state.writes++; }
      return { rowCount: 1, rows: [] };
    }
    if (sql.includes("SELECT role FROM ca_onboarding_lab.synthetic_profiles"))
      return { rowCount: state.labRole === null ? 0 : 1, rows: state.labRole === null ? [] : [{ role: state.labRole }] };
    return { rowCount: 0, rows: [] };
  }
}
const { POST } = new Function("NextResponse", "createClient", "Client", "isIsolatedBridgeReady",
  "BRIDGE_GUARD_MARKER", "verifiedGoogleProviderSubject", "process",
  source + "\nreturn { POST };")(response,createClient,Client,()=>state.ready,"synthetic-guard",
  ()=>state.google ? "synthetic-google-sub" : null,{env:{}});
const request = (origin="https://preview.example", token="synthetic.valid.token.123456789") => ({
  url: "https://preview.example/api/new-ca/isolated-enroll",
  headers: { get: key => ({ origin, authorization: "Bearer "+token, "content-length": null })[key] ?? null },
});
(async()=>{
  let r = await POST(request()); assert.equal(r.body.code,"ISOLATED_PENDING_READY"); assert.equal(state.writes,1);
  r = await POST(request()); assert.equal(r.body.code,"ISOLATED_PENDING_READY"); assert.equal(state.writes,1);
  state.role="ca"; r=await POST(request()); assert.equal(r.body.code,"EXISTING_PROFILE_PROTECTED"); state.role=null;
  state.identities=1; r=await POST(request()); assert.equal(r.body.code,"EXISTING_CA_IDENTITY_PROTECTED"); state.identities=0;
  state.google=false; r=await POST(request()); assert.equal(r.body.code,"GOOGLE_IDENTITY_REQUIRED"); state.google=true;
  r=await POST(request("https://attacker.example")); assert.equal(r.body.code,"ORIGIN_MISMATCH");
  state.ready=false; r=await POST(request()); assert.equal(r.body.code,"PREVIEW_ONLY");
  assert.equal(state.writes,1);
  console.log("PASS isolated pending enrollment synthetic cases: no production writes");
})().catch(e=>{console.error(e);process.exitCode=1;});
