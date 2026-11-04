const {webkit}=require(process.env.NEW_CA_PLAYWRIGHT_MODULE || 'playwright');
const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const root=path.resolve(__dirname,'..');const chunkDir=path.join(root,'.next/static/chunks');
const css=fs.readdirSync(chunkDir).find(f=>f.endsWith('.css'));
if(!css)throw Error('Build the app first to generate CSS');
let browser;
(async()=>{browser=await webkit.launch({headless:true,...(process.env.NEW_CA_WEBKIT_EXECUTABLE?{executablePath:process.env.NEW_CA_WEBKIT_EXECUTABLE}:{})});let n=0;const checks=[];
async function check(name,fn){await fn();checks.push({name,status:'PASS'});n++;}
for(const width of [390,375,320]){
const context=await browser.newContext({viewport:{width,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.setContent('<!doctype html><html lang="ja"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div></body></html>');await page.addStyleTag({path:path.join(chunkDir,css)});await page.addScriptTag({path:process.env.NEW_CA_BROWSER_BUNDLE || path.join(root,'.qa/new-ca-card-bundle.js')});await page.getByRole('button',{name:'カードをめくって確認 ↻'}).waitFor();
await check(width+'px no horizontal overflow',async()=>assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)));
await check(width+'px flip',async()=>{await page.getByRole('button',{name:'カードをめくって確認 ↻'}).click();await page.waitForTimeout(550);await page.getByText('CAマスター照合結果',{exact:true}).waitFor();assert.equal(await page.getByText('SCOPELY EXPLORE ID',{exact:true}).count(),0);});
await check(width+'px five review operations remain safe',async()=>{assert.equal(await page.getByRole('button',{name:'承認',exact:true}).isDisabled(),true);assert.equal(await page.getByRole('button',{name:'保留',exact:true}).isDisabled(),true);assert.equal(await page.getByRole('button',{name:'却下',exact:true}).isDisabled(),true);});
await check(width+'px revalidation action',async()=>{await page.getByRole('button',{name:'再検証',exact:true}).click();await page.getByText('合成再検証が完了しました。',{exact:true}).waitFor();});
await check(width+'px approval history',async()=>{await page.getByText('承認履歴',{exact:true}).click();await page.getByText(/synthetic-created/).waitFor();});
await check(width+'px navigation',async()=>{await page.getByRole('button',{name:'次へ ›'}).click();await page.getByRole('heading',{name:'SyntheticCA2',exact:true}).waitFor();await page.getByRole('button',{name:'‹ 前へ'}).click();await page.getByRole('heading',{name:'SyntheticCA1',exact:true}).waitFor();});
await check(width+'px swipe',async()=>{await page.locator('[class*="perspective"]').evaluate(el=>{const a=new Event('touchstart',{bubbles:true});Object.defineProperty(a,'changedTouches',{value:[{clientX:270,clientY:300}]});el.dispatchEvent(a);const b=new Event('touchend',{bubbles:true});Object.defineProperty(b,'changedTouches',{value:[{clientX:70,clientY:300}]});el.dispatchEvent(b);});await page.getByRole('heading',{name:'SyntheticCA2',exact:true}).waitFor();});
await check(width+'px no runtime errors',async()=>assert.deepEqual(errors,[]));
await context.close();}
await browser.close();fs.writeFileSync(process.env.NEW_CA_BROWSER_REPORT || path.join(root,'.qa/card-webkit-results.json'),JSON.stringify({browser:'Playwright WebKit (Linux), mobile emulation; not physical iPhone Safari',checks},null,2));console.log('TOTAL',n,'PASS');
})().catch(async e=>{if(browser)await browser.close().catch(()=>{});console.error(e);process.exitCode=1;});
