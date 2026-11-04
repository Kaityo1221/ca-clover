# New CA final audit candidate — 2026-11-04

**NO-GO.** This is an incremental draft inheriting PR #200, not a production activation.

Changes: approval card fields, timestamps/history from isolated GET, read-only revalidation action and stale-result protection, repair of the isolated enrollment test harness, and a replayable WebKit test fixture. Official approve/hold/reject remain disabled; unavailable source fields are labeled unverified.

Validation: 100 checks across 9 existing frontend scripts, 24 WebKit checks at 320/375/390px (actual component bundled with React, generated CSS), TypeScript and Next build PASS. Physical iPhone, live pending Google/Discord link, official EXPLORE source and final activation remain unverified. Supabase/Neon UUIDs are not substituted for provider subject. No production writes or deploys.

## Browser reproduction

Build the application first. With Playwright, WebKit and esbuild available:

```
npm run build
mkdir -p .qa
npx esbuild scripts/fixtures/new-ca-card-browser.tsx --bundle --format=iife --jsx=automatic --outfile=.qa/new-ca-card-bundle.js
node scripts/test-new-ca-card-webkit.cjs
```

The test loads the actual card in a local, synthetic HTML surface; no Auth calls or registration writes occur. Optional NEW_CA_PLAYWRIGHT_MODULE, NEW_CA_WEBKIT_EXECUTABLE, NEW_CA_BROWSER_BUNDLE and NEW_CA_BROWSER_REPORT select external test tools/paths. The mobile tests verify presentation and interaction, not real Safari OAuth.

No dependency, hosting, auth configuration, existing CA, or unrelated feature changes are included. The inherited #200 vs main add/add workflow conflict remains a separate integration item; do not resolve it by running the Pages workflow.
