import assert from "node:assert/strict";
import { readFileSync, mkdirSync } from "node:fs";
import { webkit } from "playwright";

// Isolated browser harness only: load the real accounts() implementation
// against synthetic data. No production URL, token, requests, or writes.
const source = readFileSync(new URL("../../docs/admin.html", import.meta.url), "utf8");
const start = source.indexOf("async function accounts(){");
const end = source.indexOf("async function assignments(){", start);
assert.ok(start > 0 && end > start, "accounts() source not found");
const functionSource = source.slice(start, end);
const css = source.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? "";
assert.ok(css.length > 1000, "Admin style not found");

const harness = String.raw`
const app = document.getElementById("app");
const profiles = [
  {id:"ca-01",role:"ca",email:"ca01@example.invalid",niantic_id:"FAKE-01",created_at:"2026-10-01"},
  {id:"ca-02",role:"ca",email:"ca02@example.invalid",niantic_id:"FAKE-02",created_at:"2026-10-01"},
  {id:"pending-01",role:"pending",email:"pending@example.invalid",created_at:"2026-10-01"},
  {id:"admin-01",role:"admin",email:"admin@example.invalid",created_at:"2026-10-01"},
];
const grants = new Set(["ca-02"]);
window.__changes = [];
window.__permissionReadFails = false;
const client = {
  from(name) {
    return {
      select(){ return this; },
      order: async()=>({data:profiles,error:null}),
      eq: async()=>({
        data:[...grants].map(user_id=>({user_id,permission_code:"D"})),
        error:window.__permissionReadFails ? new Error("synthetic read error") : null,
      }),
    };
  },
  functions: {
    async invoke(slug,{body}) {
      if(slug!=="admin-manage") throw Error("Unexpected endpoint");
      window.__changes.push(body);
      if(body.action==="set_permission"){
        body.enabled?grants.add(body.userId):grants.delete(body.userId);
      } else if(body.action==="set_role") {
        const p=profiles.find(x=>x.id===body.userId);
        if(p) p.role=body.role;
      }
      return {data:{ok:true},error:null};
    },
  },
};
const title=()=>'<section class="card"><h1>👥 CAアカウント</h1></section>';
const msg=(s)=>'<section class="notice err">'+s+'</section>';
const e=(s)=>String(s).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll('"',"&quot;");
const fmt=(s)=>s;
`;

const html = '<!doctype html><html lang="ja"><head>' +
  '<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">' +
  '<style>' + css + '</style></head><body><main id="app" class="wrap"></main>' +
  '<script>' + harness + '\n' + functionSource + '\naccounts();</script></body></html>';

const browser = await webkit.launch({headless:true});
try {
  const context = await browser.newContext({
    viewport:{width:390,height:844}, deviceScaleFactor:3, isMobile:true, hasTouch:true,
  });
  const page = await context.newPage();
  const errors=[];
  page.on("pageerror", e=>errors.push(e.message));
  await page.route("**/*", route=>route.abort("blockedbyclient"));
  await page.setContent(html, {waitUntil:"domcontentloaded"});
  await page.locator('[data-d="ca-02"]').waitFor();
  assert.equal(await page.locator("[data-d]").count(), 2);
  assert.equal(await page.locator('[data-d="ca-02"]').getAttribute("aria-pressed"),"true");
  assert.equal(await page.locator('[data-d="ca-01"]').getAttribute("aria-pressed"),"false");
  assert.equal(await page.locator('[data-role="pending"][data-id="ca-02"]').isDisabled(),true);
  assert.equal(await page.locator('[data-role="admin"][data-id="ca-02"]').isDisabled(),true);
  assert.equal(await page.locator('[data-role="pending"][data-id="ca-01"]').isDisabled(),false);
  assert.equal(await page.locator('[data-role="pending"][data-id="pending-01"]').isDisabled(),true);
  const width = await page.evaluate(()=>({viewport:innerWidth,document:document.documentElement.scrollWidth}));
  assert.ok(width.document <= width.viewport+1, "Horizontal viewport overflow: "+JSON.stringify(width));
  assert.equal(await page.locator('[data-role="pending"][data-id="ca-02"]').getAttribute("title"),
               "ロール変更前にD権限を解除してください");
  mkdirSync("test-results/d-admin-webkit", {recursive:true});
  await page.screenshot({path:"test-results/d-admin-webkit/iphone-synthetic-before.png",fullPage:true});

  await page.locator('[data-d="ca-02"]').click();
  await page.waitForFunction(()=>document.querySelector('[data-d="ca-02"]')?.getAttribute("aria-pressed")==="false");
  assert.equal(await page.locator('[data-role="pending"][data-id="ca-02"]').isEnabled(),true);

  await page.locator('[data-d="ca-01"]').click();
  await page.waitForFunction(()=>document.querySelector('[data-d="ca-01"]')?.getAttribute("aria-pressed")==="true");
  assert.equal(await page.locator('[data-role="admin"][data-id="ca-01"]').isDisabled(),true);
  await page.screenshot({path:"test-results/d-admin-webkit/iphone-synthetic-after.png",fullPage:true});

  await page.evaluate(async()=>{window.__permissionReadFails=true;await accounts()});
  assert.equal(await page.locator("[data-role],[data-d]").count(),0);
  assert.ok((await page.locator("#list").innerText()).includes("変更操作は停止"));
  assert.deepEqual(errors,[]);
  console.log("PASS: synthetic iPhone 390px WebKit layout and D toggle regression");
  await context.close();
} finally {
  await browser.close();
}
