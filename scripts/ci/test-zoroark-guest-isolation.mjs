import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const load=path=>readFileSync(path,"utf8");
const guest=load("src/app/api/zoroark/guest/route.ts");
const gm=load("src/app/api/zoroark/gm/route.ts");
const join=load("src/app/zoroark/join/page.tsx");
const rooms=load("src/app/zoroark/rooms/page.tsx");
const owner=load("src/app/api/zoroark/rooms/route.ts");
for(const expected of [
  'VERCEL_GIT_COMMIT_REF !== "feature/zoroark-guest-invite-chat-isolated-20261113"',
  'ZOROARK_GUEST_LOBBY_ENABLED !== "true"',
  'process.env.VERCEL_ENV !== "preview"',
  'httpOnly:true','secure:true','sameSite:"strict"','path:"/"',
  'session_sha256','"SHA-256"','joinExpiresAt','join_locked',
  'x-zoroark-request','request.headers.get("origin")',
  'private, no-store','expires_at>now()',
])assert.ok(guest.includes(expected),"Guest security invariant missing: "+expected);
for(const method of ["getItem","setItem","removeItem","clear"])assert.ok(!guest.includes("localStorage."+method+"("),"Credentials cannot use localStorage");
assert.ok(!guest.includes("console.log"),"Session secrets cannot be logged");
assert.ok(guest.includes('previousCookies.length>1'),"Duplicate guest cookies must be rejected");
assert.ok(guest.includes('already_joined'),"Duplicate same-browser join is refused");
for(const expected of [
 'auth.auth.getUser(match[1])','["ca","admin"].includes(p.role)',
 'gm_user_id','zoroark_isolated.gm_lobby_action',
 'join_locked','guest_participants',
])assert.ok(gm.includes(expected),"GM boundary missing: "+expected);
assert.ok(join.includes("window.location.hash"),"Invite comes from URL fragment");
assert.ok(join.includes("history.replaceState"),"Invite fragment must be removed");
assert.ok(join.includes("credentials:\"same-origin\""),"Guest must use same-origin");
assert.ok(join.includes('href="/zoroark/guest"'),"Guest handoff must use fixed safe URL");
assert.ok(rooms.includes('QRCode.toDataURL'),"QR must be rendered locally");
assert.ok(rooms.includes('room.joinEnabled'),"QR cannot be shown without backend enablement");
assert.ok(owner.includes('ZOROARK_GUEST_LOBBY_ENABLED === "true"'),"Room response feature gate missing");
assert.ok(owner.includes('feature/zoroark-guest-invite-chat-isolated-20261113'),"Only isolated branch can show invite");
console.log("ZOROARK_GUEST_ISOLATION_CONTRACT_PASS");
