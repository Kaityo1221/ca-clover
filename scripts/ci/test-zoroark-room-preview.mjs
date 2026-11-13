import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const handler = readFileSync("src/app/api/zoroark/rooms/route.ts", "utf8");
const page = readFileSync("src/app/zoroark/rooms/page.tsx", "utf8");

const invariants = [
  'process.env.VERCEL_ENV !== "preview"',
  'process.env.ZOROARK_ROOM_CREATE_ENABLED !== "true"',
  'process.env.ZOROARK_NEON_DATABASE_URL',
  'isolated_room_api_not_configured',
  'request.headers.get("origin") !== expectedOrigin',
  'auth.auth.getUser(match[1])',
  '.from("profiles")',
  '["ca", "admin"].includes(profile.role)',
  'identity?.database_name !== "ca_clover_test"',
  'crypto.getRandomValues(random)',
  '"SHA-256"',
  'zoroark_isolated.create_gm_room',
  'joinEnabled: false',
  '"Cache-Control": "no-store"',
  '"isolated_room_service_unavailable"',
];
for (const required of invariants) {
  assert.ok(handler.includes(required), "Room API missing safety guard: " + required);
}
assert.ok(!handler.includes("SUPABASE_SERVICE_ROLE_KEY"), "Production Supabase service role must never be used");
assert.ok(!handler.includes("DATABASE_URL ||"), "Database connection must never silently fall back");
assert.ok(!handler.includes("process.env.DATABASE_URL"), "Only dedicated Zoroark DB URL may be used");
assert.ok(!handler.includes("console.log"), "Credentials or invites must never be logged");
assert.ok(page.includes('fetch("/api/zoroark/rooms"'), "UI must use isolated Next route");
assert.ok(page.includes("Authorization: \"Bearer \" + accessToken"), "UI sends only the Supabase access token for server verification");
assert.ok(!page.includes('supabase.functions.invoke("zoroark-room-admin"'), "No production Edge function should be called");
console.log("ZOROARK_PREVIEW_ISOLATION_CONTRACT_PASS");
