import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const forbiddenPaths = [
  "supabase",
  "docs/campfire-auth-provider.md",
  ".github/workflows/ca-master-minimal-barrier-qa.yml",
  "scripts/test-campfire-share-url.mjs",
  "scripts/test-ca-master-minimal-edge-http.mjs",
  "scripts/ci/ca-master-minimal-barrier-fixture.sql",
  "scripts/ci/ca-master-minimal-barrier-postcheck.sql",
  "scripts/ci/test-ca-master-minimal-guard.mjs",
];
const expectedPublicAssets = [
  "docs/index.html",
  "docs/admin.html",
  "docs/stamp-rally.html",
  "docs/stamp-exchange.html",
  ".github/workflows/pages-deploy.yml",
];
const fail = [];
for (const p of forbiddenPaths) {
  if (existsSync(p)) fail.push("private backend path leaked into public repo: " + p);
}
for (const p of expectedPublicAssets) {
  if (!existsSync(p)) fail.push("public site asset missing: " + p);
}
if (fail.length) {
  fail.forEach(line => console.error("FAIL: " + line));
  process.exit(1);
}
console.log("PUBLIC_BOUNDARY_PASS: no backend source; GitHub Pages assets present");
