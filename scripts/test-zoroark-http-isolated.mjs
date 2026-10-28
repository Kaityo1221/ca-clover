import assert from "node:assert/strict";
import http from "node:http";
import net from "node:net";
import { spawn } from "node:child_process";

/**
 * Hermetic HTTP integration: actual Next route -> synthetic Supabase Auth / REST.
 * No production database, keys, remote services or user records are contacted.
 */
const USER_ID = "00000000-0000-4000-8000-000000000001";
const PUBLIC_KEY = "sb_publishable_zoroark_synthetic_test_only";
const TOKENS = {
  ca: "synthetic-ca-token-00000000000001",
  admin: "synthetic-admin-token-0000000001",
  pending: "synthetic-pending-token-0000001",
  revoked: "synthetic-revoked-token-0000001",
  invalid: "synthetic-invalid-token-0000001",
  dbDown: "synthetic-dbdown-token-0000001",
  authDown: "synthetic-authdown-token-000001",
  noRole: "synthetic-norole-token-0000001",
};
const state = { requests: [], wrongAuthorization: 0, forbiddenWrites: 0, queryMismatch: 0 };
const roles = new Map([
  [TOKENS.ca, "ca"],
  [TOKENS.admin, "admin"],
  [TOKENS.pending, "pending"],
  [TOKENS.revoked, "pending"],
  [TOKENS.dbDown, "ca"],
  [TOKENS.noRole, null],
]);
const asJson = (res, code, value) => {
  res.writeHead(code, { "content-type": "application/json" });
  res.end(JSON.stringify(value));
};
const fakeSupabase = http.createServer((req, res) => {
  const url = new URL(req.url || "/", "http://127.0.0.1");
  const token = (req.headers.authorization || "").replace(/^Bearer /, "");
  state.requests.push({ path: url.pathname, method: req.method, token });
  if (req.method !== "GET") {
    state.forbiddenWrites++;
    asJson(res, 405, { error: "Synthetic service forbids writes" });
    return;
  }
  if (url.pathname === "/auth/v1/user") {
    if (token === TOKENS.authDown) return asJson(res, 503, { msg: "synthetic auth service unavailable" });
    if (!roles.has(token)) return asJson(res, 401, { msg: "synthetic invalid JWT" });
    return asJson(res, 200, {
      id: USER_ID, aud: "authenticated", role: "authenticated",
      email: "synthetic@example.invalid", app_metadata: {}, user_metadata: {},
      created_at: "2026-01-01T00:00:00Z",
    });
  }
  if (url.pathname === "/rest/v1/profiles") {
    if (!roles.has(token)) {
      state.wrongAuthorization++;
      return asJson(res, 401, { message: "token missing or unrecognized" });
    }
    if (url.searchParams.get("id") !== "eq." + USER_ID) state.queryMismatch++;
    if (token === TOKENS.dbDown) return asJson(res, 503, {
      code: "PGRST000", message: "Synthetic PostgREST unavailable",
    });
    return asJson(res, 200, { role: roles.get(token) });
  }
  asJson(res, 404, { error: "unexpected mock endpoint" });
});

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve(server.address().port);
    });
  });
}
function freePort() {
  const srv = net.createServer();
  return listen(srv).then(port => new Promise((resolve,reject) => {
    srv.close(err => err ? reject(err) : resolve(port));
  }));
}
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const timeoutAt = Date.now() + 90000;
let child, logs = "", fakePort;
try {
  fakePort = await listen(fakeSupabase);
  const port = await freePort();
  const base = "http://127.0.0.1:" + port;
  child = spawn(process.execPath,
    ["node_modules/next/dist/bin/next", "dev", "--hostname", "127.0.0.1", "--port", String(port)],
    { cwd: process.cwd(), stdio: ["ignore", "pipe", "pipe"], env: {
      ...process.env,
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:" + fakePort,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: PUBLIC_KEY,
      SUPABASE_SERVICE_ROLE_KEY: "",
      NEXT_TELEMETRY_DISABLED: "1",
    }});
  child.stdout.on("data", chunk => logs += chunk.toString());
  child.stderr.on("data", chunk => logs += chunk.toString());
  async function request(token, body = {count: 6, difficulty: "easy", recent: []}, origin = "https://kaityo1221.github.io", raw) {
    const headers = {"Content-Type": "application/json", "Origin": origin};
    if (token) headers.Authorization = "Bearer " + token;
    const response = await fetch(base + "/api/zoroark/round", {
      method: "POST", headers, body: raw ?? JSON.stringify(body),
    });
    const payload = await response.json();
    return { status: response.status, payload, headers: response.headers };
  }
  let ready = false;
  while (Date.now() < timeoutAt) {
    if (child.exitCode !== null) throw new Error("Next dev exited early (" + child.exitCode + ")\n" + logs.slice(-4000));
    try {
      const response = await request(null);
      if (response.status === 401) { ready = true; break; }
    } catch {}
    await sleep(750);
  }
  if (!ready) throw new Error("Next dev did not start\n" + logs.slice(-5000));
  const tests = [
    ["guest", null, 401],
    ["invalid JWT", TOKENS.invalid, 401],
    ["CA", TOKENS.ca, 200],
    ["ADMIN", TOKENS.admin, 200],
    ["pending", TOKENS.pending, 403],
    ["revoked CA", TOKENS.revoked, 403],
    ["missing role", TOKENS.noRole, 403],
    ["DB error", TOKENS.dbDown, 503],
    ["Auth error", TOKENS.authDown, 401],
  ];
  for (const [title, token, status] of tests) {
    const result = await request(token);
    assert.equal(result.status, status, title + " status: " + JSON.stringify(result.payload));
    assert.equal(result.headers.get("cache-control")?.includes("no-store"), true, title + " cache");
    if (status !== 200) {
      assert.equal(Object.hasOwn(result.payload, "round"), false, title + " leaks round");
    } else {
      const round = result.payload.round;
      assert.equal(round.prompts.length, 6, title + " count");
      assert.equal(round.prompts.filter(p => p === round.minority).length, 1, title + " minority");
      assert.equal(round.prompts.filter(p => p === round.majority).length, 5, title + " majority");
      assert.ok(round.wolf >= 0 && round.wolf < 6);
      assert.equal(round.pair.level, "easy");
    }
    console.log("ZOROARK_HTTP", title, "PASS");
  }
  const badOrigin = await request(TOKENS.ca, undefined, "https://not-allowed.example");
  assert.equal(badOrigin.status, 403, "bad origin");

  for (const [title, body, expected] of [
    ["too few", {count:2},400],
    ["too many", {count:13},400],
    ["wrong level", {count:6,difficulty:"guest"},400],
    ["injected role", {count:6,role:"admin"},200],
  ]) {
    const value=await request(title==="injected role"?TOKENS.pending:TOKENS.ca,body);
    assert.equal(value.status,title==="injected role"?403:expected,title);
    assert.equal(Object.hasOwn(value.payload,"round"),false,title+" no secret leak");
  }
  const oversized=await request(TOKENS.ca,{},"https://kaityo1221.github.io","{\"padding\":\"" + "a".repeat(2400) + "\"}");
  assert.equal(oversized.status, 413, "request size limit");

  assert.equal(state.wrongAuthorization,0, "RLS query carries user JWT");
  assert.equal(state.queryMismatch,0, "RLS query targets authenticated user");
  assert.equal(state.forbiddenWrites,0, "mock observed no database writes");
  assert.ok(state.requests.some(x=>x.path==="/auth/v1/user"),"real auth request");
  assert.ok(state.requests.some(x=>x.path==="/rest/v1/profiles"),"real RLS profile request");
  console.log("ZOROARK_HTTP_ISOLATED_PASS supabase=synthetic");
} catch (err) {
  console.error("ZOROARK_HTTP_ISOLATED_FAIL", err);
  console.error("NEXT_LOGS_LAST", logs.slice(-3500));
  process.exitCode = 1;
} finally {
  if (child && child.exitCode === null) {
    child.kill("SIGTERM");
    await Promise.race([
      new Promise(resolve => child.once("exit",resolve)),
      sleep(4500),
    ]);
    if (child.exitCode === null) child.kill("SIGKILL");
  }
  if (fakeSupabase.listening) await new Promise(resolve=>fakeSupabase.close(resolve));
}
