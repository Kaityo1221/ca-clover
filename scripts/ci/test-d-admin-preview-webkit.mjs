import assert from "node:assert/strict";
import { readFileSync, mkdirSync } from "node:fs";
import { webkit } from "playwright";

const html=readFileSync(new URL("../../docs/d-admin-preview.html",import.meta.url),"utf8");
assert.ok(html.includes("default-src 'none'"),"offline preview must have deny-all CSP");
assert.ok(!/SUPABASE_URL|service_role|anon_key|fetch\(/i.test(html),"no live backend in preview");
const browser=await webkit.launch({headless:true});
try{
  const context=await browser.newContext({
    viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true,
  });
  const page=await context.newPage();
  const requests=[],errors=[];
  page.on("request",r=>requests.push(r.url()));
  page.on("pageerror",e=>errors.push(e.message));
  await page.route("**/*", route=>route.abort("blockedbyclient"));
  await page.setContent(html,{waitUntil:"domcontentloaded"});
  await page.locator('[data-d="ca-midori"]').waitFor();
  assert.equal(await page.locator("[data-d]").count(),3);
  assert.equal(await page.locator('[data-d="ca-midori"]').getAttribute("aria-pressed"),"true");
  assert.equal(await page.locator('[data-d="ca-sakura"]').getAttribute("aria-pressed"),"false");
  assert.equal(await page.locator('[data-role="pending"][data-id="ca-midori"]').isDisabled(),true);
  assert.equal(await page.locator('[data-role="pending"][data-id="ca-sakura"]').isEnabled(),true);
  assert.equal(await page.locator('[data-d="pending-demo"]').count(),0);
  assert.equal(await page.locator('[data-d="admin-demo"]').count(),0);
  const widths=await page.evaluate(()=>({screen:innerWidth,doc:document.documentElement.scrollWidth}));
  assert.ok(widths.doc<=widths.screen+1,"Unexpected horizontal overflow "+JSON.stringify(widths));
  mkdirSync("test-results/d-admin-webkit",{recursive:true});
  await page.screenshot({path:"test-results/d-admin-webkit/github-preview-before.png",fullPage:true});

  await page.locator('[data-d="ca-midori"]').click();
  await page.waitForFunction(()=>document.querySelector('[data-d="ca-midori"]')?.getAttribute("aria-pressed")==="false");
  assert.equal(await page.locator('[data-role="pending"][data-id="ca-midori"]').isEnabled(),true);
  assert.ok((await page.locator("#demo-log").innerText()).includes("解除"));

  await page.locator("#read-fail").check();
  assert.equal(await page.locator("[data-d],[data-role]").count(),0);
  assert.ok((await page.locator("#list").innerText()).includes("変更操作は停止"));
  await page.screenshot({path:"test-results/d-admin-webkit/github-preview-error.png",fullPage:true});
  await page.locator("#reset").click();
  assert.equal(await page.locator('[data-d="ca-midori"]').getAttribute("aria-pressed"),"true");
  assert.equal(await page.locator("#read-fail").isChecked(),false);
  assert.deepEqual(requests,[],"Preview should not issue network requests");
  assert.deepEqual(errors,[],"Browser JS errors");
  console.log("PASS: Github-hosted static D preview works on iPhone-width WebKit, offline only.");
  await context.close();
}finally{await browser.close();}
