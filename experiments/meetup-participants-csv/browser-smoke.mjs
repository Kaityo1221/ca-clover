// Offline browser verification of the fixture-only meetup UI.
// No server, credentials, analytics, Campfire, Supabase, or remote navigation.
// Run after installing Playwright + Chromium in this folder.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const dir = dirname(fileURLToPath(import.meta.url));

async function bundledFixtureHtml() {
  let html = await readFile(join(dir, "preview.html"), "utf8");
  const sourceFiles = ["csv-core.mjs", "export-failure.mjs", "csv-permission.mjs", "preview.mjs"];
  let inlineJs = "";
  for (const file of sourceFiles) {
    const source = await readFile(join(dir, file), "utf8");
    inlineJs += "\n" + source
      .replace(/^import\s+\{[^}]+\}\s+from\s+["'][^"']+["'];?\s*$/gm, "")
      .replace(/^export\s+(function|class|const)\s+/gm, "$1 ");
  }
  const marker = '<script type="module" src="./preview.mjs"></script>';
  assert.ok(html.includes(marker), "Standalone fixture entrypoint changed");
  assert.ok(!/<script\b/i.test(html.replace(marker, "")), "Unexpected extra script in preview");
  return html.replace(marker, "<script>\n" + inlineJs.replace(/<\/script/gi, "<\\/script") + "\n</script>");
}


async function bundledAdminFixtureHtml() {
  const html = await readFile(join(dir, "admin-csv-permissions-preview.html"), "utf8");
  const sources = ["csv-permission.mjs", "admin-csv-permissions-preview.mjs"];
  let inlineJs = "";
  for (const file of sources) {
    inlineJs += "\n" + (await readFile(join(dir, file), "utf8"))
      .replace(/^import\s+\{[^}]+\}\s+from\s+["'][^"']+["'];?\s*$/gm, "")
      .replace(/^export\s+(function|class|const)\s+/gm, "$1 ");
  }
  const marker = '<script type="module" src="./admin-csv-permissions-preview.mjs"></script>';
  assert.ok(html.includes(marker));
  return html.replace(marker, "<script>\n" + inlineJs + "\n</script>");
}

async function testAdminPermissions(browser) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [], requests = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("request", request => requests.push(request.url()));
  await page.setContent(await bundledAdminFixtureHtml(), { waitUntil: "load" });
  const cards = page.locator(".account");
  assert.equal(await cards.count(), 3, "Three fake ADMIN account rows");
  const first = cards.nth(0);
  assert.ok((await first.innerText()).includes("CSV権限：なし"), "Initially no CSV grant");
  await first.locator("button").click();
  assert.ok((await first.innerText()).includes("CSV権限：あり"), "ADMIN can grant");
  await first.locator("button").click();
  assert.ok((await first.innerText()).includes("CSV権限：なし"), "ADMIN can revoke");
  assert.equal(await cards.nth(2).locator("button").isDisabled(), true,
    "Pending account cannot receive CSV grant");
  assert.deepEqual(errors, [], "No ADMIN preview browser errors");
  assert.deepEqual(requests, [], "ADMIN preview must not make network requests");
  await page.close();
  console.log("PASS ADMIN permission smoke: grant, revoke, pending blocked, no network");
}

async function testBrowser() {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
      acceptDownloads: true,
      deviceScaleFactor: 1,
    });
    const errors = [];
    const requests = [];
    const downloads = [];
    page.on("pageerror", err => errors.push(err.message));
    page.on("request", req => requests.push(req.url()));
    page.on("download", download => downloads.push(download.suggestedFilename()));
    await page.setContent(await bundledFixtureHtml(), { waitUntil: "load" });
    await page.locator(".meetup-card").first().waitFor();

    assert.equal(await page.locator(".meetup-card").count(), 3, "Three mock meetup cards");
    assert.equal(await page.locator(".stat-label").first().innerText(), "参加表明");
    assert.equal(await page.locator(".stat-label").nth(1).innerText(), "チェックイン");

    // Hide the control without a verified user-specific CSV grant.
    assert.equal(await page.locator(".csv-button").count(), 0, "Default CA must not see CSV");
    for (const mode of ["pending", "other-community"]) {
      await page.selectOption("#viewer-mode", mode);
      assert.equal(await page.locator(".csv-button").count(), 0,
        "CSV must be hidden for " + mode);
    }
    await page.selectOption("#viewer-mode", "granted");
    assert.equal(await page.locator(".csv-button").count(), 3, "Granted CA sees CSV");


    for (const width of [320, 375, 390, 430, 768]) {
      await page.setViewportSize({ width, height: 844 });
      const metrics = await page.evaluate(() => {
        const button = document.querySelector(".csv-button");
        const rect = button.getBoundingClientRect();
        return {
          scrollWidth: document.documentElement.scrollWidth,
          tapWidth: rect.width,
          tapHeight: rect.height,
        };
      });
      assert.ok(metrics.scrollWidth <= width,
        "Horizontal overflow at " + width + "px: " + metrics.scrollWidth);
      assert.ok(metrics.tapWidth >= 44 && metrics.tapHeight >= 44,
        "CSV tap target too small at " + width + "px");
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.selectOption("#viewer-mode", "admin");
    assert.equal(await page.locator(".csv-button").count(), 3, "ADMIN sees CSV");
    await page.selectOption("#viewer-mode", "granted");

    // Card-body click opens the original detail action, not CSV.
    await page.locator(".card-primary").first().click();
    assert.equal(await page.locator("#detail").evaluate(d => d.open), true);
    assert.equal(downloads.length, 0, "Card tap must not initiate a download");
    await page.locator("#close-detail").click();

    const button = page.locator(".csv-button").first();
    await page.selectOption("#demo-mode", "normal");

    // Opening the confirmation must NOT generate a CSV or fetch account data.
    await button.click();
    assert.equal(await page.locator("#confirm-export").evaluate(d => d.open), true);
    assert.equal(downloads.length, 0, "First CSV tap only opens confirmation");
    assert.equal(await button.isDisabled(), false);
    await page.locator("#confirm-cancel").click();
    assert.equal(await page.locator("#confirm-export").evaluate(d => d.open), false);
    assert.equal(downloads.length, 0, "Cancel must never download");
    assert.ok(!(await page.locator("#feedback").innerText()).includes("完了"));

    // Escape also aborts without generating and preserves the details flow.
    await button.click();
    await page.keyboard.press("Escape");
    assert.equal(await page.locator("#confirm-export").evaluate(d => d.open), false);
    assert.equal(downloads.length, 0, "Escape must never download");

    await button.click();
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.locator("#confirm-generate").click(),
    ]);
    assert.equal(download.suggestedFilename(), "meetup_20261011_demo-past-001.csv");
    const csv = await readFile(await download.path(), "utf8");
    assert.ok(csv.startsWith("\uFEFF"), "CSV must include UTF-8 BOM");
    assert.ok(csv.includes("アカウント名"));
    assert.ok(csv.includes("Trainer_A"));
    assert.ok(csv.includes("Trainer_B"));
    assert.ok(!csv.includes("Trainer_C"), "Declined member must be excluded");
    await page.locator("#feedback").getByText("完了", { exact: false }).waitFor();

    const errorsToCheck = [
      ["busy", "混み合っています"],
      ["incomplete", "全件取得できなかった"],
      ["timeout", "タイムアウトしました"],
    ];
    for (const [mode, message] of errorsToCheck) {
      await page.selectOption("#demo-mode", mode);
      await button.click();
      assert.equal(downloads.length, 1, "Confirmation cannot generate on its own");
      await page.locator("#confirm-generate").click();
      await page.waitForFunction(expected => {
        const text = document.querySelector("#feedback")?.textContent ?? "";
        return text.includes(expected);
      }, message);
      assert.equal(downloads.length, 1,
        "CSV download must be suppressed for " + mode);
      assert.equal(await button.isDisabled(), false,
        "Button must be enabled after " + mode);
    }

    assert.deepEqual(errors, [], "Uncaught browser errors");
    assert.deepEqual(requests, [], "Preview must not make network requests");
    await page.close();
    await testAdminPermissions(browser);
    console.log("PASS browser smoke: default deny, membership gate, confirmation/cancel/Escape, 3 failure modes, 5 widths, no network requests");
  } finally {
    await browser.close();
  }
}

try {
  await testBrowser();
} catch (error) {
  console.error("FAIL isolated browser smoke:", error.message);
  process.exitCode = 1;
}
