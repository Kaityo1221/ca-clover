// No Supabase, credentials or network. Execute the real Edge handler with fake clients.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const raw = readFileSync(new URL("../supabase/functions/admin-manage/index.ts", import.meta.url), "utf8");
const edgeSource = raw
  .replace(/^import\s+[^\n]+\n/m, "")
  .replace("async(req:Request)", "async(req)");

function harness({
  actor = "owner",
  authenticated = true,
  failDelete = false,
  failRoleUpdate = false,
  failUpsert = false,
} = {}) {
  const roles = new Map([["owner", "admin"], ["member", "ca"], ["other", "ca"], ["pending", "pending"]]);
  const permissions = new Map([
    ["member:S", { user_id: "member", permission_code: "S" }],
    ["member:D", { user_id: "member", permission_code: "D" }],
  ]);
  const writes = [];
  let handler;

  function from(table) {
    let action = null;
    const filters = {};
    let data = null;

    const builder = {
      select() { action = "select"; return this; },
      eq(key, value) { filters[key] = value; return this; },
      in(key, values) { filters[key] = values; return this; },
      update(value) { action = "update"; data = value; return this; },
      delete() { action = "delete"; return this; },
      upsert(value) { action = "upsert"; data = value; return this.execute(); },
      single() { return this.execute(); },
      async execute() {
        if (table === "profiles" && action === "select") {
          const role = roles.get(filters.id);
          return role ? { data: { role }, error: null } : { data: null, error: new Error("missing profile") };
        }
        if (table === "profiles" && action === "update") {
          writes.push({ action: "update_role", user: filters.id });
          if (failRoleUpdate) return { error: new Error("simulated role update failure") };
          roles.set(filters.id, data.role);
          return { error: null };
        }
        if (table === "user_permissions" && action === "upsert") {
          writes.push({ action: "grant", code: data.permission_code, user: data.user_id });
          if (failUpsert) return { error: new Error("simulated grant failure") };
          permissions.set(data.user_id + ":" + data.permission_code, data);
          return { error: null };
        }
        if (table === "user_permissions" && action === "delete") {
          writes.push({ action: "revoke", code: filters.permission_code ?? filters.permission_code_in ?? null, user: filters.user_id });
          if (failDelete) return { error: new Error("simulated revoke failure") };
          for (const [key, value] of permissions) {
            if (filters.user_id !== value.user_id) continue;
            if (typeof filters.permission_code === "string" && value.permission_code !== filters.permission_code) continue;
            if (Array.isArray(filters.permission_code) && !filters.permission_code.includes(value.permission_code)) continue;
            permissions.delete(key);
          }
          return { error: null };
        }
        return { error: new Error("Unexpected mocked database query: " + table + "/" + action) };
      },
      then(success, failure) { return this.execute().then(success, failure); },
    };
    return builder;
  }

  const Deno = {
    env: { get: name => ({ SUPABASE_URL: "mock-url", SUPABASE_ANON_KEY: "mock-anon", SUPABASE_SERVICE_ROLE_KEY: "mock-service" })[name] },
    serve: callback => { handler = callback; },
  };
  function createClient(_url, key) {
    return {
      auth: { getUser: async () => authenticated
        ? { data: { user: { id: actor } }, error: null }
        : { data: { user: null }, error: new Error("not authenticated") } },
      from,
    };
  }

  runInNewContext(edgeSource, { Deno, createClient, Response, Date, Error, String, Boolean, JSON });
  assert.equal(typeof handler, "function");

  async function request(body, method = "POST") {
    const response = await handler({
      method,
      headers: { get: () => "Bearer simulated-auth" },
      json: async () => body,
    });
    return { status: response.status, body: await response.json() };
  }
  return { request, roles, permissions, writes };
}

test("anonymous request is rejected without service writes", async () => {
  const mock = harness({ authenticated: false });
  const result = await mock.request({ action: "set_permission", permissionCode: "D", userId: "member", enabled: true });
  assert.equal(result.status, 401);
  assert.equal(mock.writes.length, 0);
});
test("non-ADMIN cannot change D or S", async () => {
  const mock = harness({ actor: "member" });
  for (const code of ["S", "D"]) {
    assert.equal((await mock.request({ action: "set_permission", permissionCode: code, userId: "other", enabled: true })).status, 403);
  }
  assert.equal(mock.writes.length, 0);
});
test("D can be granted to CA and keeps S unchanged", async () => {
  const mock = harness();
  assert.equal((await mock.request({ action: "set_permission", permissionCode: "D", userId: "other", enabled: true })).status, 200);
  assert.ok(mock.permissions.has("other:D"));
  assert.ok(mock.permissions.has("member:S"));
  assert.equal(mock.permissions.get("other:D").granted_by, "owner");
});
test("D revocation does not remove S", async () => {
  const mock = harness();
  assert.equal((await mock.request({ action: "set_permission", permissionCode: "D", userId: "member", enabled: false })).status, 200);
  assert.equal(mock.permissions.has("member:D"), false);
  assert.equal(mock.permissions.has("member:S"), true);
});
test("S grant and revoke remain intact", async () => {
  const mock = harness();
  assert.equal((await mock.request({ action: "set_permission", permissionCode: "S", userId: "other", enabled: true })).status, 200);
  assert.equal(mock.permissions.has("other:S"), true);
  assert.equal((await mock.request({ action: "set_permission", permissionCode: "S", userId: "other", enabled: false })).status, 200);
  assert.equal(mock.permissions.has("other:S"), false);
  assert.equal(mock.permissions.has("other:D"), false);
});
test("D cannot be granted to pending or ADMIN", async () => {
  const mock = harness();
  assert.notEqual((await mock.request({ action: "set_permission", permissionCode: "D", userId: "pending", enabled: true })).status, 200);
  assert.notEqual((await mock.request({ action: "set_permission", permissionCode: "D", userId: "owner", enabled: true })).status, 200);
  assert.equal(mock.writes.length, 0);
});
test("S cannot be granted to pending", async () => {
  const mock = harness();
  assert.notEqual((await mock.request({ action: "set_permission", permissionCode: "S", userId: "pending", enabled: true })).status, 200);
  assert.equal(mock.writes.length, 0);
});
test("unexpected permission strings and non-boolean enabled fail closed", async () => {
  const mock = harness();
  for (const code of ["CSV_EXPORT", "ADMIN", "", "D,S"]) {
    assert.notEqual((await mock.request({ action: "set_permission", permissionCode: code, userId: "other", enabled: true })).status, 200);
  }
  for (const enabled of [1, "true", null, undefined]) {
    assert.notEqual((await mock.request({ action: "set_permission", permissionCode: "D", userId: "other", enabled })).status, 200);
  }
  assert.equal(mock.writes.length, 0);
});
test("pending role transition revokes both S and D, before role update", async () => {
  const mock = harness();
  const result = await mock.request({ action: "set_role", userId: "member", role: "pending" });
  assert.equal(result.status, 200);
  assert.equal(mock.roles.get("member"), "pending");
  assert.equal(mock.permissions.has("member:S"), false);
  assert.equal(mock.permissions.has("member:D"), false);
  assert.deepEqual(mock.writes.map(w => w.action), ["revoke", "update_role"]);
});
test("pending transition stops if revocation fails; role remains CA", async () => {
  const mock = harness({ failDelete: true });
  assert.notEqual((await mock.request({ action: "set_role", userId: "member", role: "pending" })).status, 200);
  assert.equal(mock.roles.get("member"), "ca");
  assert.equal(mock.writes.some(w => w.action === "update_role"), false);
});
test("pending transition fails closed if role update fails after revocation", async () => {
  const mock = harness({ failRoleUpdate: true });
  assert.notEqual((await mock.request({ action: "set_role", userId: "member", role: "pending" })).status, 200);
  assert.equal(mock.roles.get("member"), "ca");
  assert.equal(mock.permissions.has("member:S"), false);
  assert.equal(mock.permissions.has("member:D"), false);
});
test("grant DB error does not report success", async () => {
  const mock = harness({ failUpsert: true });
  assert.notEqual((await mock.request({ action: "set_permission", permissionCode: "D", userId: "other", enabled: true })).status, 200);
  assert.equal(mock.permissions.has("other:D"), false);
});
test("invalid/unknown admin action and role are rejected", async () => {
  const mock = harness();
  assert.equal((await mock.request({ action: "unknown" })).status, 400);
  assert.notEqual((await mock.request({ action: "set_role", role: "root", userId: "other" })).status, 200);
  assert.equal(mock.writes.length, 0);
});
