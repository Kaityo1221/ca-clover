// Run with Playwright installed, or PLAYWRIGHT_MODULE pointing to its module.
// Optional: BROWSER_ENGINE (chromium/webkit), BROWSER_PATH, SCREENSHOT_DIR.
import assert from "node:assert/strict";
import { readFile, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { join } from "node:path";

const require = createRequire(import.meta.url);
const playwright = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const engine = process.env.BROWSER_ENGINE || "chromium";
const html = await readFile(new URL("../docs/stamp-rally.html", import.meta.url), "utf8");
const map = await readFile(new URL("../docs/assets/geolonia-map-mobile.svg", import.meta.url), "utf8");
const browser = await playwright[engine].launch({
  headless: true,
  ...(process.env.BROWSER_PATH ? { executablePath: process.env.BROWSER_PATH } : {}),
});
const origin = "http://stamp-rally.test";
const ca = (id, community, prefecture, level = "1st") => ({
  ca_member_id: id, community_id: community, prefecture,
  community_name: `${community} Community`, trainer_name: id, ca_level: level,
});
const catalog = [
  ca("ca-a", "base", "東京都"), ca("ca-b", "base", "東京都", "2nd"),
  ca("ca-c", "north", "北海道"), ca("ca-d", "west", "大阪府"),
  { community_id: "no-ca", community_name: "CA未設定", prefecture: "香川県" },
];
const collection = (id, community, source = "normal") => ({
  id: `collection-${id}`, stamp_ca_member_id: id, community_id: community,
  acquisition_source: source, first_acquired_at: "2026-10-10T00:00:00Z",
});
const identity = { ca_member_id: "ca-a", community_id: "base" };

async function openPage(fixture = {}, width = 375) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(({ fixture, catalog }) => {
    window.testRequests = [];
    const data = {
      profiles: { role: fixture.role || "ca" },
      stamp_collections: fixture.collections || [],
      stamp_reunions: fixture.reunions || [],
      stamp_collection_designs: [], stamp_collection_preferences: [],
      user_ca_identities: fixture.identity ?? null,
      communities: catalog.map(row => ({ id: row.community_id, prefecture: row.prefecture })),
    };
    window.supabase = { createClient: () => ({
      auth: { getSession: async () => ({ data: { session: fixture.loggedOut ? null : { user: { id: "current-user" } } } }) },
      rpc: async name => {
        window.testRequests.push({ rpc: name });
        return { data: fixture.catalog || catalog, error: null };
      },
      from: table => {
        const request = { table, filters: [] };
        window.testRequests.push(request);
        const result = () => ({
          data: table === "communities"
            ? data.communities.filter(row => request.filters.find(([key]) => key === "id")?.[1].includes(row.id))
            : data[table] ?? [],
          error: table === "user_ca_identities" ? fixture.identityError || null : null,
        });
        const query = {
          select: columns => { request.columns = columns; return query; },
          eq: (key, value) => { request.filters.push([key, value]); return query; },
          in: (key, value) => { request.filters.push([key, value]); return query; },
          order: () => query,
          maybeSingle: async () => result(),
          then: resolve => Promise.resolve(result()).then(resolve),
        };
        return query;
      },
    }) };
    window.CACommunityIcon = { url: () => "", img: () => "", bind: () => {} };
  }, { fixture, catalog });
  await page.route("**/*", route => {
    const url = new URL(route.request().url());
    if (url.origin === origin && url.pathname === "/stamp-rally.html") {
      return route.fulfill({ contentType: "text/html", body: html });
    }
    if (url.origin === origin && url.pathname.endsWith(".svg")) {
      return route.fulfill({ contentType: "image/svg+xml", body: map });
    }
    if (url.hostname === "kaityo1221.github.io") {
      return route.fulfill({ contentType: "text/html", body: "<p>Home</p>" });
    }
    // Keep fixtures isolated from live APIs, audio, icons and external modules.
    return route.fulfill({ body: "", contentType: "text/javascript" });
  });
  await page.goto(`${origin}/stamp-rally.html`);
  if (fixture.loggedOut) await page.waitForURL("https://kaityo1221.github.io/ca-clover/");
  if (!fixture.loggedOut && fixture.role !== "pending") {
    await page.locator("#regions").waitFor({ state: "visible" });
  }
  assert.deepEqual(errors, [], "page should load without JavaScript errors");
  return page;
}

async function summary(fixture, expected) {
  const page = await openPage(fixture);
  const actual = await page.locator("#totalScore, #ownMedalStatus, #reunionScore").allTextContents();
  assert.deepEqual(actual, expected);
  const requests = await page.evaluate(() => window.testRequests);
  assert.deepEqual(requests.find(x => x.table === "stamp_collections").filters, [["owner_user_id", "current-user"]]);
  assert.deepEqual(requests.find(x => x.table === "user_ca_identities").filters, [["user_id", "current-user"], ["is_primary", true]]);
  if (fixture.collections?.length) {
    assert.deepEqual(requests.find(x => x.table === "stamp_reunions").filters, [["collection_id", fixture.collections.map(x => x.id)]]);
  } else {
    assert.equal(requests.some(x => x.table === "stamp_reunions"), false);
  }
  await page.close();
}

try {
  await summary({}, ["0枚", "確認中", "0回"]);
  await summary({ identity }, ["0枚", "未取得", "0回"]);
  await summary({ identity, collections: [collection("ca-a", "base", "self")] }, ["1枚", "取得済み", "0回"]);
  await summary({ role: "admin", identity, collections: [collection("ca-a", "base", "admin")] }, ["1枚", "取得済み", "0回"]);
  await summary({ collections: [collection("ca-a", "base", "self")] }, ["1枚", "確認中", "0回"]);
  await summary({ identity, identityError: { message: "RLS denied" } }, ["0枚", "確認中", "0回"]);
  await summary({ identity: { ...identity, community_id: "unlisted" } }, ["0枚", "確認中", "0回"]);
  await summary({ identity: { ...identity, community_id: "north" }, collections: [collection("ca-a", "base")] }, ["1枚", "確認中", "0回"]);
  await summary({ identity, collections: [collection("ca-a", "base"), collection("retired-ca", "old-base")], reunions: [{ id: "r1" }, { id: "r2" }] }, ["2枚", "取得済み", "2回"]);

  const fixture = {
    role: "admin", identity,
    collections: [collection("ca-a", "base", "admin"), collection("ca-c", "north")],
    reunions: [{ id: "r1", collection_id: "collection-ca-c" }],
  };
  const page = await openPage(fixture);
  const regions = await page.locator(".region").evaluateAll(nodes => nodes.map(node => ({
    title: node.querySelector(".regiontitle").textContent,
    communities: node.querySelector(".regionmeta .sub").textContent,
    progress: node.querySelector(".regionprogress").textContent,
    partial: node.classList.contains("has-medals"),
    complete: node.classList.contains("complete"),
  })));
  assert.deepEqual(regions[0], { title: "北海道・東北", communities: "1コミュニティ", progress: "メダル 1 / 1", partial: true, complete: true });
  assert.deepEqual(regions[1], { title: "関東", communities: "1コミュニティ", progress: "メダル 1 / 2", partial: true, complete: false });
  assert.equal(regions[2].complete, false); // No communities, no CA.
  assert.equal(regions[5].communities, "1コミュニティ");
  assert.equal(regions[5].progress, "メダル 0 / 0"); // Community with no CA.
  assert.equal(regions[5].complete, false);
  assert.equal(await page.locator(".complete-label").count(), 1);
  assert.equal(await page.locator(".exchange-card").getAttribute("href"), "./stamp-exchange.html");
  assert.equal(await page.evaluate(() => document.querySelector(".hero").nextElementSibling.matches(".exchange-card")), true);
  assert.equal(await page.locator(".mapbox .prefecture.acquired").count(), 2);
  await page.locator(".regionbtn").nth(1).click();
  await page.getByRole("button", { name: /^東京都/ }).click();
  assert.equal(await page.locator(".pref.open .progress").textContent(), "取得 1 / 2");
  await page.locator('.stamp[data-community="base"]').click();
  assert.equal(await page.locator("#stampModalBack").getAttribute("aria-hidden"), "false");
  await page.locator("#stampClose").click();
  assert.equal(await page.locator("#stampModalBack").getAttribute("aria-hidden"), "true");
  await page.locator(".regionbtn").nth(1).click();
  await page.locator('.mapbox .prefecture[data-code="13"]').press("Enter");
  assert.equal(await page.locator(".region.open .pref.open .prefname").textContent(), "東京都");
  await page.close();

  for (const role of ["ca", "admin"]) {
    for (const width of [320, 360, 375, 390, 430, 1280]) {
      const page = await openPage({ ...fixture, role }, width);
      assert.equal(await page.locator("#stampBackLink").getAttribute("href"), role === "admin" ? "./admin.html" : "./");
      // Inspect the closed and expanded lists; opening must not jump to the top.
      for (const expanded of [false, true]) {
        if (expanded) {
          await page.locator(".regionbtn").nth(1).click();
          await page.getByRole("button", { name: /^東京都/ }).click();
        }
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${role}/${width}: horizontal overflow`);
        assert.equal(await page.locator(".summary-item").evaluateAll(nodes => nodes.every(node => node.scrollWidth <= node.clientWidth)), true, `${width}: summary overflow`);
        assert.equal(await page.locator(".exchange-card").evaluate(node => node.getBoundingClientRect().height >= 44), true);
      }
      await page.locator(".pref.open").scrollIntoViewIfNeeded();
      const scrollBefore = await page.evaluate(() => scrollY);
      await page.locator('.stamp[data-community="base"]').click();
      await page.locator("#stampClose").click();
      assert.equal(await page.evaluate(() => scrollY), scrollBefore, "closing a medal keeps list position");
      if (process.env.SCREENSHOT_DIR && role === "admin") {
        await mkdir(process.env.SCREENSHOT_DIR, { recursive: true });
        await page.evaluate(() => scrollTo(0, 0));
        await page.screenshot({ path: join(process.env.SCREENSHOT_DIR, `medal-rally-${width}.png`), fullPage: true });
      }
      await page.close();
    }
  }
  for (const fixture of [{ role: "pending" }, { loggedOut: true }]) {
    const page = await openPage(fixture);
    assert.equal(await page.locator("#regions:visible").count(), 0);
    assert.equal(await page.evaluate(() => window.testRequests.some(x => x.rpc === "stamp_rally_catalog")), false);
    if (fixture.role) assert.match(await page.locator("#status").textContent(), /CA登録/);
    else assert.equal(page.url(), "https://kaityo1221.github.io/ca-clover/");
    await page.close();
  }
  console.log(`${engine} Medal Rally UI: summary boundaries, identity fallback, region progress, guards, map/accordion/modal, and 12 viewport/role combinations passed.`);
} finally {
  await browser.close();
}
