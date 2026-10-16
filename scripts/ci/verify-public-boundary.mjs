import { existsSync } from "node:fs";

const backend = [
  "supabase",
  "docs/campfire-auth-provider.md",
  "scripts/test-campfire-share-url.mjs",
];
const ui = ["src/app/page.tsx", "src/app/admin/page.tsx"];
const failures = [
  ...backend.filter(p => existsSync(p)).map(p => "private backend leaked: "+p),
  ...ui.filter(p => !existsSync(p)).map(p => "missing public UI: "+p),
];
if (failures.length) {
  failures.forEach(message => console.error("FAIL: "+message));
  process.exit(1);
}
console.log("PUBLIC_BOUNDARY_PASS: Next public-side frontend present; backend removed");
