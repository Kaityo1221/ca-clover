import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {join,resolve} from 'node:path';
import {startPreview} from './serve-meetup-mobile-preview.mjs';
const require=createRequire(join(resolve(process.env.PLAYWRIGHT_RUNTIME||'node_modules'),'playwright/package.json'));
const {chromium,webkit}=require('playwright');
const out=resolve(process.env.QA_OUTPUT||'qa-artifacts/meetup-mobile');await mkdir(out,{recursive:true});
const preview=await startPreview();let passes=0;const results=[];
const check=(name)=>{passes++;results.push(name);console.log('PASS '+name);};
try{for(const [engine,type] of [['Chromium',chromium],['WebKit',webkit]]){
  const browser=await type.launch({headless:true});
  try{
    for(const width of [320,375,390,430]){
      const context=await browser.newContext({viewport:{width,height:844},isMobile:true,hasTouch:true,acceptDownloads:true});const page=await context.newPage();const errors=[];
      page.on('pageerror',e=>errors.push(e.message));
      await page.route('**/*',route=>{const u=new URL(route.request().url());return u.hostname==='127.0.0.1'?route.continue():route.abort();});
      await page.goto(preview.url);const history=page.locator('.meetup-history');await history.getByRole('tab',{name:'↓ CSV選択'}).waitFor();
      assert.equal(await history.locator('.history-entry').count(),25);assert.equal(await history.locator('[data-history-category]').count(),7);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      assert.equal(await history.getByText('統計・分析',{exact:true}).count(),0);
      const date=await history.locator('.history-date').first().boundingBox(),body=await history.locator('.history-body').first().boundingBox();assert.ok(date.x<body.x);
      const typography=await history.locator('.history-entry').first().evaluate(card=>{
        const read=(selector)=>{const el=card.querySelector(selector),css=getComputedStyle(el);return {size:parseFloat(css.fontSize),weight:parseInt(css.fontWeight,10),color:css.color};};
        const time=card.querySelector('.history-time');
        const action=card.querySelector('.participant-roster-action');
        return {year:read('.history-year'),date:read('.history-date>b'),time:read('.history-time'),title:read('.history-body h3'),location:read('.history-location'),metric:read('.history-body .tags .pill'),overview:read('.history-overview'),
          timeHasSeparatedStart:!!time.querySelector('.history-time-start'),actionBelowCard:!action||action.getBoundingClientRect().top>=card.querySelector('.history-card').getBoundingClientRect().bottom-1};
      });
      assert.ok(typography.year.size>=12&&typography.date.size>=24&&typography.time.size>=12,JSON.stringify(typography));
      assert.ok(typography.title.weight>=900&&typography.location.weight>=800&&typography.time.weight>=800,JSON.stringify(typography));
      assert.ok(typography.metric.size>=11&&typography.overview.size>=12&&typography.timeHasSeparatedStart&&typography.actionBelowCard,JSON.stringify(typography));
      if(width===390){await history.screenshot({path:join(out,engine.toLowerCase()+'-390-list.png')});await history.scrollIntoViewIfNeeded();await page.screenshot({path:join(out,engine.toLowerCase()+'-390-viewport.png')});}
      check(engine+' '+width+'px layout + 25 history + six categories');
      await history.getByRole('tab',{name:'↓ CSV選択'}).click();
      assert.equal(await history.getByRole('checkbox').count(),25);
      assert.equal(await history.getByRole('checkbox',{checked:true}).count(),0);
      assert.equal(await history.locator('[data-batch-run]').isDisabled(),true);
      await history.getByRole('checkbox').nth(20).check();
      assert.equal(await history.getByRole('checkbox',{checked:true}).count(),1);
      await history.getByRole('button',{name:'先頭20件を選択',exact:true}).click();
      assert.equal(await history.getByRole('checkbox',{checked:true}).count(),20);
      assert.equal(await history.getByRole('checkbox').nth(20).isChecked(),false);
      await history.getByRole('checkbox').nth(20).click();
      assert.equal(await history.getByRole('checkbox',{checked:true}).count(),20);
      assert.equal(await history.getByRole('checkbox').nth(20).isChecked(),false);
      await history.getByRole('checkbox').nth(0).uncheck();
      await history.getByRole('checkbox').nth(20).check();
      assert.equal(await history.getByRole('checkbox',{checked:true}).count(),20);
      assert.equal(await history.getByRole('checkbox').nth(20).isChecked(),true);
      await history.getByRole('button',{name:'全解除',exact:true}).click();
      assert.equal(await history.getByRole('checkbox',{checked:true}).count(),0);
      assert.equal(await history.locator('[data-batch-run]').isDisabled(),true);
      await history.getByRole('button',{name:'先頭20件を選択',exact:true}).click();
      assert.equal(await history.getByRole('checkbox',{checked:true}).count(),20);
      if(width===390)await history.screenshot({path:join(out,engine.toLowerCase()+'-390-selection.png')});
      check(engine+' '+width+'px initial zero, manual selection, select-first-20, clear, 20 cap');
      assert.equal(errors.length,0,errors.join('\n'));
      if(width===390){
        await page.clock.install();
        await history.locator('[data-batch-run]').click();await page.waitForFunction(()=>window.__fixture.calls.length===1);
        await page.clock.fastForward(16000);await page.waitForFunction(()=>window.__fixture.calls.length===2);
        await history.getByRole('button',{name:'ZIPを保存（20件）',exact:true}).waitFor();
        assert.deepEqual(await page.evaluate(()=>window.__fixture.calls.map(x=>x.offset)),[0,10]);
        const download=page.waitForEvent('download');await history.getByRole('button',{name:'ZIPを保存（20件）',exact:true}).click();const d=await download;await d.saveAs(join(out,engine.toLowerCase()+'-20-rosters.zip'));
        check(engine+' ZIP download with 20 preserved CSV files, sequential stages 0/10');
        // The original overview and individual CSV remain usable.
        await history.getByRole('tab',{name:'☷ 履歴一覧'}).click();await history.locator('[data-meetup-index]').first().click();
        await page.getByRole('heading',{name:'📄 参加者名簿CSV',exact:true}).waitFor();await page.locator('#meetupClose').click();
        check(engine+' existing overview + individual roster entry preserved');
      }
      await context.close();
    }
    for(const [name,query,visible] of [['CA without D','d=0',false],['admin without D','role=admin&d=0',true],['no membership','own=0',false]]){
      const page=await browser.newPage({viewport:{width:390,height:844}});await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
      const url=new URL(preview.url);url.search=query;await page.goto(url.href);await page.waitForTimeout(300);
      assert.equal(await page.getByRole('tab',{name:'↓ CSV選択'}).count(),visible?1:0);check(engine+' permission gate: '+name);await page.close();
    }
    {
      const page=await browser.newPage({viewport:{width:390,height:844}});await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());await page.goto(preview.url);
      const history=page.locator('.meetup-history');await history.getByRole('tab',{name:'↓ CSV選択'}).waitFor();
      await history.locator('[data-history-limit="50"]').click();await page.waitForFunction(()=>document.querySelectorAll('.history-entry').length===50);
      await history.locator('[data-history-limit="100"]').click();await page.waitForFunction(()=>document.querySelectorAll('.history-entry').length===100);
      await history.locator('[data-history-limit="all"]').click();await page.waitForFunction(()=>document.querySelectorAll('.history-entry').length===120);
      await history.locator('[data-history-category="max-battle"]').click();await page.waitForFunction(()=>document.querySelectorAll('.history-entry').length===45);
      check(engine+' 25/50/100/all real pager + category filtering');
      await history.getByRole('tab',{name:'↓ CSV選択'}).click();
      assert.equal(await history.getByRole('checkbox').count(),45);
      assert.equal(await history.getByRole('checkbox',{checked:true}).count(),0);
      assert.equal(await history.locator('[data-batch-run]').isDisabled(),true);
      await history.getByRole('button',{name:'先頭20件を選択',exact:true}).click();
      assert.equal(await history.getByRole('checkbox',{checked:true}).count(),20);
      await history.getByRole('button',{name:'全解除',exact:true}).click();for(let i=0;i<3;i++)await history.getByRole('checkbox').nth(i).check();
      await page.clock.install();await page.evaluate(()=>window.__fixture.stopAfter=1);await history.locator('[data-batch-run]').click();await page.waitForFunction(()=>document.querySelector('.batch-status').textContent.includes('取得制限'));
      assert.equal(await page.evaluate(()=>window.__fixture.calls.length),1);
      await page.evaluate(()=>window.__fixture.stopAfter=null);await page.clock.fastForward(3601000);
      await history.locator('[data-batch-run]').click();await history.getByRole('button',{name:'ZIPを保存（3件）',exact:true}).waitFor();assert.deepEqual(await page.evaluate(()=>window.__fixture.calls.map(x=>x.offset)),[0,1]);
      check(engine+' 429 pause, no automatic retry, resume only remaining IDs');
      await page.close();
    }
  }finally{await browser.close();}
}}finally{await new Promise(r=>preview.server.close(r));await writeFile(join(out,'browser-results.json'),JSON.stringify({passes,results},null,2));}
console.log('BROWSER PASS '+passes);
