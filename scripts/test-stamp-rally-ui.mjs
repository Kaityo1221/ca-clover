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
const auth72 = await readFile(new URL("../docs/auth-session-72h.js", import.meta.url), "utf8");
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
      communities: fixture.readableCommunities || catalog.map(row => ({ id: row.community_id, prefecture: row.prefecture })),
    };
    window.supabase = { createClient: () => ({
      auth: { getSession: async () => ({ data: { session: fixture.loggedOut ? null : { user: { id: "current-user" } } } }), signOut: async () => ({error:null}) },
      rpc: async (name, args) => {
        window.testRequests.push({ rpc: name, args });
        if (name === "ca_medal_profile_settings_status") {
          if (fixture.profileError) return { data: null, error: { message: "status unavailable" } };
          return { data: fixture.profileRows ?? [], error: null };
        }
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
    const iconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180" viewBox="0 0 180 180"><rect width="180" height="180" fill="#e83f43"/><circle cx="90" cy="90" r="68" fill="#2bba66"/><path d="M90 38L142 128H38Z" fill="#315ae8"/></svg>';
    const iconUrl = fixture.silhouetteIcons ? "data:image/svg+xml;charset=utf-8," + encodeURIComponent(iconSvg) : "";
    window.CACommunityIcon = {
      url: () => iconUrl,
      img: () => iconUrl ? '<img data-ca-community-icon="1" src="' + iconUrl + '" alt="" loading="lazy">' : "",
      bind: () => {},
    };
  }, { fixture, catalog });
  await page.route("**/*", route => {
    const url = new URL(route.request().url());
    if (url.origin === origin && url.pathname === "/stamp-rally.html") {
      return route.fulfill({ contentType: "text/html", body: html });
    }
    if (url.origin === origin && url.pathname === "/auth-session-72h.js") {
      return route.fulfill({ contentType: "text/javascript", body: auth72 });
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

  // General CA can read only their own community through the communities table.
  // The medal catalog still provides the public prefecture for exchanged medals.
  for (const role of ["ca", "admin"]) {
    const mapPage = await openPage({
      role, identity,
      catalog: [...catalog, ca("ca-kagawa", "kagawa", "香川県")],
      collections: [collection("ca-a", "base", "self"), collection("ca-kagawa", "kagawa")],
      readableCommunities: [{ id: "base", prefecture: "東京都" }],
    });
    assert.equal(await mapPage.locator('.mapbox .prefecture[data-code="37"].acquired').count(), 1, role + ": acquired Kagawa must be green");
    assert.equal(await mapPage.locator('.mapbox .prefecture[data-code="13"].acquired').count(), 1);
    assert.equal(await mapPage.locator('.mapbox .prefecture[data-code="27"].acquired').count(), 0);
    assert.match(await mapPage.locator("#mapScore").textContent(), /^2\s*\/ 47$/);
    assert.equal(await mapPage.evaluate(() => window.testRequests.some(x => x.table === "communities")), false, "map must not replace catalog data with membership-restricted reads");
    await mapPage.close();
  }
  // A previously acquired CA remains on the map even without a current CA link.
  const historicalMapPage = await openPage({
    collections: [collection("retired-ca", "no-ca", "admin")],
    readableCommunities: [],
  });
  assert.equal(await historicalMapPage.locator('.mapbox .prefecture[data-code="37"].acquired').count(), 1);
  assert.equal(await historicalMapPage.locator('.mapbox .prefecture[data-code="13"].acquired').count(), 0);
  await historicalMapPage.close();


  // Unowned icon silhouettes: public Community art stays visible but never becomes an owned medal.
  // The same unowned treatment is required in the regional grid and 2D modal.
  for (const width of [320, 375, 390, 430]) {
    const silhouettePage = await openPage({
      identity, silhouetteIcons: true,
      collections: [collection("ca-a", "base", "self")],
    }, width);
    await silhouettePage.locator("#medalsExpandAll").click();
    const earned = silhouettePage.locator('.stamp[data-community="base"]');
    const unearned = silhouettePage.locator('.stamp[data-community="north"]');
    assert.equal(await earned.locator(".medal.unowned").count(), 0, "Earned medal retains colour at " + width);
    assert.equal(await unearned.locator(".medal.unowned").count(), 1, "Missing medal is gray at " + width);
    assert.equal(await unearned.locator(".medalinner img").count(), 1, "Unowned medal shows Community art at " + width);
    assert.equal(await unearned.locator(".fallback").textContent(), "◇", "No question mark for unowned medals");
    const colors = await silhouettePage.evaluate(() => {
      const earned=document.querySelector('.stamp[data-community="base"] .medalinner');
      const unearned=document.querySelector('.stamp[data-community="north"] .medalinner');
      const img=unearned.querySelector("img");
      return {
        earnedFilter:getComputedStyle(earned).filter,
        unearnedFilter:getComputedStyle(unearned).filter,
        unearnedOpacity:Number(getComputedStyle(unearned).opacity),
        imageFilter:getComputedStyle(img).filter,
        imageSrc:img.getAttribute("src"),
      };
    });
    assert.equal(colors.earnedFilter, "none", "Earned medal must not be desaturated at " + width);
    assert.match(colors.unearnedFilter, /grayscale\(1\)/, "Unowned parent is grayscale at " + width);
    assert.match(colors.imageFilter, /grayscale\(1\)/, "Unowned source image is grayscale at " + width);
    assert.ok(colors.unearnedOpacity >= 0.7, "Silhouette contrast remains readable at " + width);
    assert.ok(colors.imageSrc?.startsWith("data:image/svg+xml"), "Community source art used at " + width);
    await unearned.click();
    assert.equal(await silhouettePage.locator("#stampZoom2D.unowned").count(), 1, "Unowned modal stays unowned");
    assert.equal(await silhouettePage.locator("#stamp3d.show").count(), 0, "Unowned must not unlock 3D");
    assert.equal(await silhouettePage.locator("#stampZoom2D .fallback").textContent(), "◇");
    assert.match(await silhouettePage.locator("#stampZoom2D .medalinner").evaluate(el=>getComputedStyle(el).filter),
      /grayscale\(1\)/, "Unowned zoom is grayscale");
    assert.ok((await silhouettePage.locator("#stampZoomImg").getAttribute("src"))?.startsWith("data:image/svg+xml"),
      "Unowned zoom includes public Community icon");
    await silhouettePage.locator("#stampClose").click();
    if (process.env.SCREENSHOT_DIR) {
      await mkdir(process.env.SCREENSHOT_DIR, {recursive:true});
      await unearned.scrollIntoViewIfNeeded();
      await silhouettePage.screenshot({path:join(process.env.SCREENSHOT_DIR,"unowned-gray-silhouette-" + width + ".png")});
    }
    await silhouettePage.close();
  }
  // A Community without icon metadata must remain unowned with a neutral placeholder,
  // not leak a previous medal image or imply ownership.
  const noIconPage = await openPage({identity});
  await noIconPage.locator("#medalsExpandAll").click();
  const noIcon = noIconPage.locator('.stamp[data-community="north"]');
  assert.equal(await noIcon.locator(".fallback").textContent(), "◇");
  assert.equal(await noIcon.locator(".medalinner img").count(), 0, "Missing source is never fabricated");
  await noIcon.click();
  assert.equal(await noIconPage.locator("#stampZoomImg").getAttribute("src"), null, "Modal clears missing source");
  assert.equal(await noIconPage.locator("#stampZoom2D.unowned").count(), 1);
  assert.equal(await noIconPage.locator("#stamp3d.show").count(), 0);
  await noIconPage.close();

  // Controls must work with the same synthetic catalog and never depend on live RPC.
  const profileRows = [
    { ca_member_id: "ca-a", photo_set: true, message_set: false },
    { ca_member_id: "ca-b", photo_set: false, message_set: true },
    { ca_member_id: "ca-c", photo_set: false, message_set: false },
    { ca_member_id: "ca-d", photo_set: true, message_set: true },
  ];
  const controlPage = await openPage({
    identity, profileRows, collections: [collection("ca-a", "base"), collection("ca-c", "north")],
  });
  assert.equal(await controlPage.locator("#medalsFilterToggle").count(), 1, "Floating filter is present");
  assert.equal(await controlPage.locator("#medalsFilterSheet").isHidden(), true, "Filter sheet starts closed");
  await controlPage.locator("#medalsFilterToggle").click();
  assert.equal(await controlPage.locator("#medalsFilterSheet").isVisible(), true, "Floating filter opens sheet");
  await controlPage.locator("#medalsPhotoFilter:not([disabled])").waitFor();
  // Bulk controls are outside the modal and immediately above the first region panel.
  assert.equal(await controlPage.locator("#medalsFilterSheet #medalsExpandAll").count(), 0);
  assert.equal(await controlPage.locator("#medalsFilterSheet #medalsCollapseAll").count(), 0);
  assert.equal(await controlPage.locator("#medalsBulkToolbar #medalsExpandAll").textContent(), "一括オープン");
  assert.equal(await controlPage.locator("#medalsBulkToolbar #medalsCollapseAll").textContent(), "一括クローズ");
  await controlPage.locator("#medalsFilterClose").click();
  for (const width of [320, 375, 390, 430]) {
    await controlPage.setViewportSize({width, height:900});
    const layout = await controlPage.evaluate(() => {
      const rect = selector => {
        const r=document.querySelector(selector).getBoundingClientRect();
        return {x:r.x, y:r.y, right:r.right, bottom:r.bottom, width:r.width, height:r.height};
      };
      return {
        first:rect("#regions .region"),
        toolbar:rect("#medalsBulkToolbar"),
        open:rect("#medalsExpandAll"),
        close:rect("#medalsCollapseAll"),
      };
    });
    const overlaps=(a,b)=>a.x<b.right-1 && a.right>b.x+1 && a.y<b.bottom-1 && a.bottom>b.y+1;
    assert.ok(layout.toolbar.x>=-1 && layout.toolbar.right<=width+1, "Bulk toolbar within viewport " + width);
    assert.ok(layout.toolbar.bottom<=layout.first.y + 2, "Bulk toolbar remains above first region " + width);
    assert.ok(layout.open.x>=layout.first.x-2 && layout.close.right<=layout.first.right+2, "Bulk buttons align to first region right edge " + width);
    assert.ok(!overlaps(layout.open,layout.close), "Bulk buttons do not overlap " + width);
    assert.ok(layout.open.height<45 && layout.close.height<45, "Bulk buttons remain small at " + width);
    await controlPage.locator("#medalsExpandAll").click();
    assert.equal(await controlPage.locator(".region.open").count(), 4, "Bulk-open operates outside filter " + width);
    // Trainer names retain their original text and wrapping; the two status indicators
    // sit together below that text rather than splitting onto separate lines.
    const caStatusLayout = await controlPage.evaluate(() => {
      return [...document.querySelectorAll(".stamp:not([hidden]) .canames .caname")].filter(label => {
        return !!label.querySelector(".medal-ca-setting-flags") && label.getClientRects().length > 0;
      }).map(label => {
        const flags=label.querySelector(".medal-ca-setting-flags");
        const nameNode=label.firstChild;
        const range=document.createRange();
        if(nameNode?.nodeType===Node.TEXT_NODE)range.selectNodeContents(nameNode);
        const nameRect=range.getBoundingClientRect();
        const flagsRect=flags.getBoundingClientRect();
        const computed=getComputedStyle(flags);
        return {
          hasOriginalTrainerText: nameNode?.nodeType===Node.TEXT_NODE,
          labelText: nameNode?.textContent || "",
          flagsText: flags.textContent || "",
          nameBottom: nameRect.bottom,
          flagsTop: flagsRect.top,
          flagsHeight: flagsRect.height,
          lineHeight: parseFloat(computed.lineHeight),
          whiteSpace: computed.whiteSpace,
          display: computed.display,
        };
      });
    });
    assert.ok(caStatusLayout.length >= 4, "CA status fixture visible at " + width);
    for (const item of caStatusLayout) {
      assert.ok(item.hasOriginalTrainerText, "Trainer name remains unwrapped in its original DOM text node at " + width);
      assert.ok(item.labelText.trim().length > 0, "Trainer name remains displayed at " + width);
      assert.match(item.flagsText, /^📷[済未] 💬[済未]$/, "Photo and message status remain on one row at " + width);
      assert.equal(item.display, "block", "Status indicators occupy a dedicated second row at " + width);
      assert.equal(item.whiteSpace, "nowrap", "Status icons do not wrap internally at " + width);
      assert.ok(item.flagsTop >= item.nameBottom - 2, "Status row follows trainer name at " + width);
      assert.ok(item.flagsHeight <= item.lineHeight + 3, "Photo and message indicators do not split into two lines at " + width);
    }
    await controlPage.locator("#medalsCollapseAll").click();
    assert.equal(await controlPage.locator(".region.open").count(), 0, "Bulk-close operates outside filter " + width);
    if (process.env.SCREENSHOT_DIR) {
      await mkdir(process.env.SCREENSHOT_DIR, {recursive:true});
      await controlPage.locator("#medalsBulkToolbar").scrollIntoViewIfNeeded();
      await controlPage.screenshot({path:join(process.env.SCREENSHOT_DIR,"medal-bulk-region-top-" + width + ".png")});
    }
  }
  await controlPage.setViewportSize({width:375,height:900});
  await controlPage.locator("#medalsFilterToggle").click();
  assert.equal(await controlPage.locator(".medal-ca-setting-flags").count(), 4,
    "All 1st/2nd CAs must show status, including second CA of one community");
  assert.match(await controlPage.locator('.stamp[data-community="base"]').textContent(), /📷済 💬未/);
  assert.match(await controlPage.locator('.stamp[data-community="base"]').textContent(), /📷未 💬済/);
  const visibleStamps = () => controlPage.locator('.stamp[data-community]:visible').count();
  assert.equal(await visibleStamps(), 0, "All accordions should initially be closed");
  // Outside-page accordion controls are not clickable while the modal backdrop is open.
  await controlPage.locator("#medalsFilterClose").click();
  await controlPage.locator("#medalsExpandAll").click();
  assert.equal(await visibleStamps(), 4, "Expand opens all regions and prefectures");
  await controlPage.locator("#medalsCollapseAll").click();
  assert.equal(await visibleStamps(), 0, "Collapse closes all regions and prefectures");
  await controlPage.locator("#medalsExpandAll").click();
  await controlPage.locator("#medalsFilterToggle").click();
  await controlPage.locator("#medalsOwnershipFilter").selectOption("owned");
  assert.equal(await visibleStamps(), 2, "Owned community rule includes either CA");
  await controlPage.locator("#medalsOwnershipFilter").selectOption("unowned");
  assert.equal(await visibleStamps(), 2, "Unowned shows not-yet-acquired and CA-less communities");
  await controlPage.locator("#medalsOwnershipFilter").selectOption("all");
  await controlPage.locator("#medalsPhotoFilter").selectOption("set");
  assert.equal(await visibleStamps(), 2, "Photo set matches either CA in the community");
  await controlPage.locator("#medalsMessageFilter").selectOption("set");
  assert.equal(await visibleStamps(), 2, "Message set matches either CA in the community");
  await controlPage.locator("#medalsPhotoFilter").selectOption("unset");
  assert.equal(await visibleStamps(), 0, "Different CA fields are evaluated at community level");
  await controlPage.locator("#medalsMessageFilter").selectOption("all");
  assert.equal(await visibleStamps(), 2, "Photo unset includes CA-less community");
  await controlPage.locator("#medalsOwnershipFilter").selectOption("owned");
  assert.equal(await visibleStamps(), 1, "Multiple filters are combined safely");
  assert.equal(await controlPage.locator(".region:not([hidden])").count(), 1,
    "Regions containing no matches are hidden");
  assert.equal(await controlPage.locator("#medalsFilterInfo").textContent().then(x=>x.includes("1 Community")), true);
  assert.equal(await controlPage.locator("#medalsFilterToggle").getAttribute("aria-expanded"), "true");
  await controlPage.locator("#medalsFilterReset").click();
  assert.equal(await controlPage.locator("#medalsOwnershipFilter").inputValue(), "all");
  assert.equal(await controlPage.locator("#medalsPhotoFilter").inputValue(), "all");
  assert.equal(await controlPage.locator("#medalsMessageFilter").inputValue(), "all");
  assert.equal(await controlPage.locator(".region:not([hidden])").count(), 4, "Reset restores all four catalog regions");
  await controlPage.keyboard.press("Escape");
  assert.equal(await controlPage.locator("#medalsFilterSheet").isHidden(), true, "Escape dismisses sheet");
  assert.equal(await controlPage.locator("#medalsFilterToggle").getAttribute("aria-expanded"), "false");
  await controlPage.locator("#medalsFilterToggle").click();
  await controlPage.locator("#medalsFilterApply").click();
  assert.equal(await controlPage.locator("#medalsFilterSheet").isHidden(), true, "Close action dismisses sheet");
  await controlPage.setViewportSize({ width: 320, height: 740 });
  const floatingButton = await controlPage.locator("#medalsFilterToggle").boundingBox();
  assert.ok(floatingButton && floatingButton.x >= 0 && floatingButton.x + floatingButton.width <= 320, "Floating button fits 320px screen");
  await controlPage.close();

  // User-reported Shikoku case: acquired 2/11 becomes 1/11 with CA-photo filter.
  // The denominator always remains the original CA-medal catalog size.
  const shikokuCAs = Array.from({length: 11}, (_, i) =>
    ca(`shikoku-${i}`, `shikoku-community-${i}`, "徳島県"));
  const shikokuRows = shikokuCAs.map((row, i) => ({
    ca_member_id: row.ca_member_id, photo_set: i === 0, message_set: i === 1,
  }));
  const shikokuPage = await openPage({
    identity,
    catalog: [...catalog, ...shikokuCAs],
    profileRows: [...profileRows, ...shikokuRows],
    collections: [
      collection("shikoku-0", "shikoku-community-0"),
      collection("shikoku-1", "shikoku-community-1"),
    ],
  });
  // The sheet is intentionally closed on load; readiness must not require visibility.
  await shikokuPage.locator("#medalsPhotoFilter:not([disabled])").waitFor({ state: "attached" });
  const shikoku = shikokuPage.locator(".region").filter({hasText: "四国"});
  const tokushima = shikoku.locator(".pref").filter({hasText: "徳島県"});
  assert.equal(await shikoku.locator(".regionprogress").textContent(), "メダル 2 / 11");
  assert.equal(await tokushima.locator(".progress").textContent(), "取得 2 / 11");
  await shikokuPage.locator("#medalsFilterToggle").click();
  assert.equal(await shikokuPage.locator("#medalsExpandAll").textContent(), "一括オープン");
  assert.equal(await shikokuPage.locator("#medalsCollapseAll").textContent(), "一括クローズ");
  await shikokuPage.locator("#medalsPhotoFilter").selectOption("set");
  assert.equal(await shikoku.locator(".regionprogress").textContent(), "メダル 1 / 11");
  assert.equal(await tokushima.locator(".progress").textContent(), "取得 1 / 11");
  await shikokuPage.locator("#medalsPhotoFilter").selectOption("unset");
  assert.equal(await shikoku.locator(".regionprogress").textContent(), "メダル 1 / 11",
    "Unconfigured-only shows the other acquired CA medal");
  await shikokuPage.locator("#medalsPhotoFilter").selectOption("all");
  await shikokuPage.locator("#medalsOwnershipFilter").selectOption("unowned");
  assert.equal(await shikoku.locator(".regionprogress").textContent(), "メダル 0 / 11");
  await shikokuPage.locator("#medalsFilterReset").click();
  assert.equal(await shikoku.locator(".regionprogress").textContent(), "メダル 2 / 11");
  assert.equal(await tokushima.locator(".progress").textContent(), "取得 2 / 11");
  await shikokuPage.close();

  const unavailablePage = await openPage({ profileError: true });
  await unavailablePage.locator("#medalsFilterToggle").click();
  await unavailablePage.locator("#medalsProfileInfo").waitFor();
  assert.equal(await unavailablePage.locator("#medalsPhotoFilter").isDisabled(), true);
  assert.equal(await unavailablePage.locator("#medalsMessageFilter").isDisabled(), true);
  assert.equal(await unavailablePage.locator(".medal-ca-setting-flags").count(), 0,
    "Unknown status must not be rendered as unset");
  assert.match(await unavailablePage.locator("#medalsProfileInfo").textContent(), /未接続/);
  await unavailablePage.close();

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
  assert.equal(await page.locator(".community-record-card").getAttribute("href"), "./stamp-exchange-community.html?v=20261109");
  assert.equal(await page.evaluate(() =>
    document.querySelector(".hero").nextElementSibling.matches(".community-record-card") &&
    document.querySelector(".community-record-card").nextElementSibling.matches(".exchange-card")), true);
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
