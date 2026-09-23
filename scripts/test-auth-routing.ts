import assert from "node:assert/strict";
import { getAdminRedirect, sanitizeNextPath } from "../src/lib/auth-routing.ts";

assert.equal(sanitizeNextPath("/admin"), "/admin");
assert.equal(sanitizeNextPath("/admin/claims?filter=pending"), "/admin/claims?filter=pending");
assert.equal(sanitizeNextPath("https://example.com/admin"), "/my");
assert.equal(sanitizeNextPath("//example.com/admin"), "/my");
assert.equal(sanitizeNextPath(null), "/my");

assert.equal(getAdminRedirect({
  loading:true,
  userPresent:false,
  role:null,
  pathname:"/admin/claims",
}),null);

assert.equal(getAdminRedirect({
  loading:false,
  error:"temporary auth error",
  userPresent:false,
  role:null,
  pathname:"/admin/claims",
}),null);

assert.equal(getAdminRedirect({
  loading:false,
  userPresent:false,
  role:null,
  pathname:"/admin/claims",
}),"/login?next=%2Fadmin%2Fclaims");

assert.equal(getAdminRedirect({
  loading:false,
  userPresent:true,
  role:"ca",
  pathname:"/admin/claims",
}),"/my");

assert.equal(getAdminRedirect({
  loading:false,
  userPresent:true,
  role:"pending",
  pathname:"/admin",
}),"/my");

assert.equal(getAdminRedirect({
  loading:false,
  userPresent:true,
  role:"admin",
  pathname:"/admin/claims",
}),null);

assert.equal(getAdminRedirect({
  loading:false,
  userPresent:true,
  role:"ca",
  pathname:"/admin",
  nonAdminRedirectTo:"/account",
}),"/account");

console.log("auth routing regression tests: ok");
