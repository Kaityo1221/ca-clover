// Isolated browser layout/behavior checks for real CA Clover page source.
// All identity, RPC, image and session values are synthetic.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync,mkdirSync} from 'node:fs';
import {join,extname,normalize,sep} from 'node:path';
import {chromium,webkit} from 'playwright';

const root=process.cwd();
const artifacts=join(root,'qa-artifacts','ca-photo');
mkdirSync(artifacts,{recursive:true});
const fixture=`<!doctype html><html lang="ja"><meta charset="UTF-8"><body>
<section id="testHost">
  <input type="file" id="profilePhotoInput" accept="image/*">
  <img id="profilePhotoPreview" alt="preview" hidden width="96" height="96">
  <button id="profilePhotoSave" disabled>保存</button>
  <button id="profilePhotoDelete" disabled>削除</button>
  <p id="profilePhotoInfo"></p>
  <p id="profilePhotoStatus" role="status"></p>
</section></body></html>`;
const avatar='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#d5efc5"/><circle cx="50" cy="33" r="18" fill="#476d39"/><path d="M18 95C18 55 82 55 82 95" fill="#4c8d6a"/></svg>';
const server=createServer((req,res)=>{
 const u=new URL(req.url,'http://127.0.0.1');
 if(u.pathname==='/qa/photo.svg') {res.writeHead(200,{'content-type':'image/svg+xml','cache-control':'no-store'});res.end(avatar);return}
 if(u.pathname==='/qa/photo-fixture.html') {res.writeHead(200,{'content-type':'text/html; charset=utf-8'});res.end(fixture);return}
 const file=normalize(join(root,decodeURIComponent(u.pathname).replace(/^\/+/,'')));
 if(!file.startsWith(root+sep)){res.writeHead(403);res.end();return}
 try{
  const body=readFileSync(file);
  const mime={'.html':'text/html; charset=utf-8','.js':'application/javascript','.mjs':'application/javascript','.svg':'image/svg+xml','.css':'text/css','.json':'application/json'}[extname(file)]||'application/octet-stream';
  res.writeHead(200,{'content-type':mime,'cache-control':'no-store'});res.end(body);
 }catch{res.writeHead(404);res.end('not found')}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const C='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const rows=[
 {community_id:C,community_name:'QAテストCommunity',prefecture:'東京都',ca_member_id:A,trainer_name:'QA A',ca_level:'1st',avatar_url:null},
 {community_id:C,community_name:'QAテストCommunity',prefecture:'東京都',ca_member_id:B,trainer_name:'QA B',ca_level:'2nd',avatar_url:null}
];
const pass=[];
function record(name){pass.push(name);console.log('PASS '+name)}
async function prep(page,mode){
 await page.route('https://**/*',route=>route.abort());
 await page.route('**/community-icon.js*',route=>route.fulfill({status:200,contentType:'application/javascript',body:''}));
 await page.addInitScript(({mode,rows,A,B})=>{
  window.CACommunityIcon={url:()=>'',bind:()=>{}};
  function chain(table){
   return {
    select(){return this},eq(){return this},in(){return this},order(){return this},
    maybeSingle:async()=>({data:table==='profiles'?{role:'ca'}:null,error:null}),
    then(onFulfilled,onRejected){return Promise.resolve({data:[],error:null}).then(onFulfilled,onRejected)}
   };
  }
  const client={
   auth:{getSession:async()=>({data:{session:{user:{id:'qa-browser-user'},access_token:'qa-only'}}})},
   from:chain,
   rpc:async(name,args)=>{
    if(name==='stamp_rally_catalog')return {data:rows,error:null};
    if(name==='ca_medal_exchange_message'){
     if(mode==='photoOnly')return {data:null,error:null};
     if(mode==='long')return {data:'あ'.repeat(60),error:null};
     if(mode==='race'&&args.p_ca_member_id===A)await new Promise(r=>setTimeout(r,350));
     if(mode==='missing'||(mode==='error'&&args.p_ca_member_id===A))
       return mode==='error'?{data:null,error:{message:'synthetic failure'}}:{data:null,error:null};
     return {data:args.p_ca_member_id===A?'東京から来ました！\nよろしくお願いします😊':'こんにちは！ QA B',error:null};
    }
    if(name==='ca_medal_profile_photo_path'){
     if(mode==='greetingOnly')return {data:null,error:null};
     if(mode==='race'&&args.p_ca_member_id===A)await new Promise(r=>setTimeout(r,350));
     if(mode==='missing'||mode==='error'&&args.p_ca_member_id===A)
       return mode==='error'?{data:null,error:{message:'synthetic failure'}}:{data:null,error:null};
     return {data:args.p_ca_member_id===A?'qa-user/a.webp':'qa-user/b.webp',error:null};
    }
    return {data:null,error:null};
   },
   storage:{from:()=>({
    createSignedUrl:async(path)=>({data:{signedUrl:'/qa/photo.svg?id='+encodeURIComponent(path)},error:null})
   })}
  };
  window.supabase={createClient:()=>client};
 },{mode,rows,A,B});
}
async function openModal(page){
 await page.goto(origin+'/docs/stamp-rally.html',{waitUntil:'domcontentloaded'});
 await page.locator('#regions:not([hidden])').waitFor({timeout:15000});
 await page.locator('.regionbtn').filter({hasText:'関東'}).click();
 await page.locator('.prefbtn').filter({hasText:'東京都'}).click();
 await page.locator('.stamp[data-community]').first().click();
 await page.locator('#stampModalBack.show').waitFor();
}
async function testMedal(browser,name){
 for(const width of [320,375,390,430]){
  const page=await browser.newPage({viewport:{width,height:812},deviceScaleFactor:1});
  await prep(page,'normal');await openModal(page);
  await page.locator('#caMedalPhotoRow:not([hidden])').waitFor({timeout:12000});
  await page.locator('#caMedalExchangeMessage:not([hidden])').waitFor({timeout:12000});
  assert.ok((await page.locator('#caMedalExchangeText').textContent()).includes('東京から来ました！'),'greeting missing on medal');
  const boxes=await page.evaluate(()=>{
   const box=id=>{const b=document.querySelector(id).getBoundingClientRect();return{x:b.x,y:b.y,width:b.width,height:b.height,bottom:b.bottom,right:b.right}};
   return {row:box('#caMedalPhotoRow'),avatar:box('.ca-medal-speaker-avatar'),photo:box('#caMedalPhoto'),bubble:box('#caMedalExchangeMessage'),medal:box('#stampZoom2D'),modal:box('.stampmodal')};
  });
  assert.ok(boxes.photo.x>=boxes.modal.x-1.5&&boxes.photo.right<=boxes.modal.right+1.5,'photo leaves modal frame '+width+' '+JSON.stringify(boxes));
  assert.ok(boxes.photo.bottom+2<=boxes.medal.y,'photo overlaps medal '+width+' '+JSON.stringify(boxes));
  assert.ok(boxes.avatar.width>=68&&boxes.photo.width>=60,'portrait is not enlarged '+width);
  assert.ok(boxes.bubble.x>=boxes.photo.right,'bubble is not to the right of portrait '+width);
  assert.ok(boxes.bubble.right<=boxes.modal.right,'bubble overflows modal '+width);
  assert.ok(boxes.bubble.bottom+2<=boxes.medal.y,'greeting bubble overlaps medal '+width);
  assert.ok(boxes.medal.width>=200,'medal accidentally shrunk '+width);
  assert.equal(await page.locator('#stampZoomTitle').textContent(),'QAテストCommunity');
  await page.screenshot({path:join(artifacts,name+'-'+width+'.png')});
  await page.locator('#stampClose').click();
  assert.ok(await page.locator('#caMedalPhotoRow').evaluate(e=>e.hidden),'avatar not cleared on close');
  assert.ok(await page.locator('#caMedalExchangeMessage').evaluate(e=>e.hidden),'greeting not cleared on close');
  record(name+' '+width+'px corner layout and close');
  await page.close();
 }
 for(const mode of ['missing','error']){
  const page=await browser.newPage({viewport:{width:375,height:812}});
  await prep(page,mode);await openModal(page);
  await page.waitForTimeout(300);
  assert.equal(await page.locator('#caMedalPhotoRow').evaluate(e=>e.hidden),true,'avatar unexpectedly visible in '+mode);
  assert.equal(await page.locator('#caMedalExchangeMessage').evaluate(e=>e.hidden),true,'greeting unexpectedly visible in '+mode);
  assert.ok(await page.locator('#stampZoom2D').isVisible(),'medal hidden in '+mode);
  record(name+' '+mode+' fallbacks');
  await page.close();
 }
 for(const mode of ['greetingOnly','photoOnly','long']){
  const special=await browser.newPage({viewport:{width:320,height:812}});
  await prep(special,mode);await openModal(special);
  await special.locator('#caMedalPhotoRow:not([hidden])').waitFor();
  if(mode==='greetingOnly'){
    await special.locator('#caMedalExchangeMessage:not([hidden])').waitFor();
    assert.equal(await special.locator('#caMedalPhoto').evaluate(e=>e.hidden),true,'unregistered photo shown');
    assert.equal(await special.locator('#caMedalPhotoFallback').evaluate(e=>e.hidden),false,'no avatar fallback');
  }
  if(mode==='photoOnly'){
    await special.locator('#caMedalPhoto').waitFor({state:'visible'});
    assert.equal(await special.locator('#caMedalExchangeMessage').evaluate(e=>e.hidden),true,'unexpected greeting');
  }
  if(mode==='long'){
    await special.locator('#caMedalExchangeMessage:not([hidden])').waitFor();
    const b=await special.evaluate(()=>({bubble:document.querySelector('#caMedalExchangeMessage').getBoundingClientRect().bottom,medal:document.querySelector('#stampZoom2D').getBoundingClientRect().top}));
    assert.ok(b.bubble+2<=b.medal,'60-character bubble overlaps medal');
  }
  record(name+' '+mode+' portrait/greeting fallback');
  await special.close();
 }
 const page=await browser.newPage({viewport:{width:390,height:812}});
 await prep(page,'race');await openModal(page);
 await page.locator('[data-modal-ca="'+B+'"]').click();
 await page.locator('#caMedalPhotoRow:not([hidden])').waitFor();
 await page.waitForTimeout(430);
 const src=await page.locator('#caMedalPhoto').getAttribute('src');
 assert.ok(decodeURIComponent(src).includes('/b.webp'),'old async CA photo replaced newer selection: '+src);
 await page.locator('#caMedalExchangeMessage:not([hidden])').waitFor();
 assert.equal(await page.locator('#caMedalExchangeText').textContent(),'こんにちは！ QA B','stale greeting replaced selected CA greeting');
 record(name+' CA switch ignores stale response');
 await page.close();
}
async function testSettingsAccordion(browser,name){
 const page=await browser.newPage({viewport:{width:390,height:812}});
 await page.goto(origin+'/qa/photo-fixture.html');
 await page.addStyleTag({url:origin+'/docs/settings-accordion.css'});
 await page.evaluate(async()=>{
   window.CA_PROFILE_PHOTO_UPLOAD_ENABLED=true;
   window.confirm=()=>true;
   const uid='qa-browser-user';
   let saved=null;
   const client={
     auth:{getUser:async()=>({data:{user:{id:uid}},error:null})},
     from:table=>{
       let operation='read',row=null;
       return {
         select(){return this},eq(){return this},
         upsert(v){operation='upsert';row=v;return this},
         delete(){operation='delete';return this},
         async maybeSingle(){
           if(table==='ca_profile_photos')return {data:null,error:null};
           if(operation==='upsert'){saved=row;return {data:{message:row.message},error:null};}
           if(operation==='delete'){saved=null;return {data:{user_id:uid},error:null};}
           return {data:saved,error:null};
         }
       };
     },
     storage:{from:()=>({createSignedUrl:async()=>({data:null,error:{message:'not found'}})})}
   };
   const module=await import('/docs/settings-accordion.mjs');
   window.__settingsCleanup=module.mountSettings({
     host:document.querySelector('#testHost'),client,session:{user:{id:uid}},role:'ca',
     onBack:()=>{},onAccount:()=>{}
   });
 });
 assert.equal(await page.locator('#settingsMenuScreen').evaluate(el=>el.hidden),false);
 assert.equal(await page.locator('#settingsProfileScreen').evaluate(el=>el.hidden),true);
 assert.equal(await page.locator('.settings-menu-card').count(),5);
 assert.equal(await page.locator('.settings-future:disabled').count(),3);
 const labels=await page.locator('.settings-menu-card strong').allTextContents();
 assert.deepEqual(labels,['プロフィール写真・一言','アカウント','通知設定','表示設定','プライバシー']);
 assert.equal(await page.locator('#settingsProfileLink small').textContent(),'登録・変更・削除');
 await page.screenshot({path:join(artifacts,name+'-five-card-menu.png'),fullPage:true});
 await page.locator('#settingsProfileLink').click();
 await page.locator('#settingsProfileScreen:not([hidden])').waitFor();
 await page.locator('#exchangeMessageInput').waitFor();
 assert.equal(await page.locator('#settingsMenuScreen').evaluate(el=>el.hidden),true);
 assert.ok(await page.locator('#profilePhotoInput').isVisible(),'photo editor missing in combined screen');
 assert.ok(await page.locator('#exchangeMessageInput').isVisible(),'greeting editor missing in combined screen');
 await page.locator('#exchangeMessageInput').fill('<img src=x onerror=alert(1)>');
 assert.equal(await page.locator('#exchangeMessagePreviewText').textContent(),'<img src=x onerror=alert(1)>');
 assert.equal(await page.locator('#exchangeMessagePreview img').count(),0,'message HTML was interpreted');
 await page.locator('#exchangeMessageInput').fill('東京から来ました！\n気軽に声をかけてください😊');
 await page.locator('#exchangeMessageSave').click();
 await page.waitForFunction(()=>document.querySelector('#exchangeMessageStatus').textContent.includes('保存しました'));
 await page.locator('#settingsProfileBack').click();
 assert.equal(await page.locator('#settingsProfileScreen').evaluate(el=>el.hidden),true);
 assert.equal(await page.locator('#settingsMenuScreen').evaluate(el=>el.hidden),false);
 await page.locator('#settingsProfileLink').click();
 await page.waitForFunction(()=>document.querySelector('#exchangeMessageInput').value.includes('東京から来ました！'));
 assert.ok(await page.locator('#profilePhotoInput').isVisible(),'photo editor lost on return');
 await page.locator('#exchangeMessageDelete').click();
 await page.waitForFunction(()=>document.querySelector('#exchangeMessageStatus').textContent.includes('削除しました'));
 assert.equal(await page.locator('#exchangeMessagePreview').evaluate(el=>el.hidden),true);
 await page.evaluate(()=>window.__settingsCleanup());
 record(name+' five-card menu, unified profile, owner greeting CRUD and XSS-safe preview');
 await page.close();
}

async function testUniversalCloverHome(browser,name){
 const fixtures=[
  {id:'index-logo',body:'<header class="top"><div class="topin"><div class="logo">🍀</div><nav id="nav"></nav></div></header><main></main>',expect:'header .logo'},
  {id:'admin-logo',body:'<header><a class="logo" href="./admin.html">🍀</a></header><main></main>',expect:'header .logo'},
  {id:'stats-mark',body:'<header><a class="mark" href="./admin.html">🍀</a></header><main></main>',expect:'header .mark'},
  {id:'new-ca-demo',body:'<main><header><strong>🍀 CA CLOVER</strong><span>デモ</span></header></main>',expect:'main > header .ca-home-brand-link'},
  {id:'kanto-back',body:'<header><div class="topin"><a class="back" href="./stamp-rally.html">‹</a><strong>関東CA Network</strong></div></header><main></main>',expect:'header .ca-home-icon',back:true},
  {id:'exchange-row',body:'<main><div class="head"><a class="back" href="./stamp-rally.html">← メダル一覧</a></div></main>',expect:'main .head .ca-home-icon',back:true},
  {id:'standalone-admin',body:'<main><a class="back" href="./admin.html">← 管理メニュー</a></main>',expect:'main .ca-home-row .ca-home-icon',back:true},
  {id:'fullscreen-game',body:'<body data-ca-clover-game="true"><canvas id="game"></canvas></body>',expect:'body > .ca-home-game'}
 ];
 for(const item of fixtures){
  const page=await browser.newPage({viewport:{width:390,height:812}});
  await page.goto(origin+'/qa/photo-fixture.html');
  const doc=item.body.startsWith('<body')?'<html><head></head>'+item.body+'</html>':'<html><head></head><body>'+item.body+'</body></html>';
  await page.setContent(doc);
  await page.addStyleTag({url:origin+'/docs/clover-global-home.css'});
  await page.addScriptTag({url:origin+'/docs/clover-global-home.js'});
  const home=page.locator('a[data-ca-home-link]');
  await home.waitFor({state:'visible'});
  assert.equal(await home.count(),1,'duplicate home Clover '+item.id);
  assert.equal(await home.getAttribute('href'),origin+'/docs/index.html#my','wrong home target '+item.id);
  assert.ok((await home.getAttribute('aria-label'))?.includes('トップ画面'),'home inaccessible '+item.id);
  assert.ok(await page.locator(item.expect).isVisible(),'wrong Clover placement '+item.id);
  if(item.back)assert.equal(await page.locator('a.back').count(),1,'standalone back link removed '+item.id);
  await home.click({trial:true});
  record(name+' Clover home '+item.id);
  await page.close();
 }
 // Real index.html: Clover stays in the same app and changes its hash to #my.
 const page=await browser.newPage({viewport:{width:390,height:812}});
 await page.route('https://**/*',route=>route.abort());
 await page.goto(origin+'/docs/index.html',{waitUntil:'domcontentloaded'});
 const home=page.locator('header a[data-ca-home-link]');
 await home.waitFor({state:'visible',timeout:10000});
 assert.equal(await home.getAttribute('href'),'#my','home link should switch index hash route');
 assert.equal(await page.locator('nav#nav button').filter({hasText:'My Community'}).count(),0,'duplicate My Community button remains');
 await home.click();
 assert.equal(new URL(page.url()).hash,'#my','home click did not reach top route');
 record(name+' real index Clover removes duplicate nav and opens #my');
 await page.close();
}

async function testCompression(browser,name){
 const page=await browser.newPage({viewport:{width:390,height:812}});
 await page.goto(origin+'/qa/photo-fixture.html');
 const result=await page.evaluate(async()=>{
  window.CA_PROFILE_PHOTO_UPLOAD_ENABLED=false;
  const module=await import('/docs/profile-photo.mjs');
  module.mountProfilePhoto({host:document.querySelector('#testHost'),role:'ca',session:{user:{id:'qa-browser-user'}},client:{auth:{getUser:async()=>({data:{user:{id:'qa-browser-user'}}})}}});
  return true;
 });
 assert.ok(result);
 const buffer=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGMU2aL7n4GBgYGJAQoAHV8B+NIe2REAAAAASUVORK5CYII=','base64');
 await page.locator('#profilePhotoInput').setInputFiles({name:'tiny.png',mimeType:'image/png',buffer});
 await page.waitForFunction(()=>document.querySelector('#profilePhotoStatus').textContent.includes('プレビュー完了'),{timeout:10000});
 assert.ok(await page.locator('#profilePhotoPreview').isVisible());
 assert.ok((await page.locator('#profilePhotoInfo').textContent()).includes('WebP'));
 assert.equal(await page.locator('#profilePhotoSave').isDisabled(),true);
 record(name+' native canvas WebP compression and disabled writes');
 await page.close();
}
async function testSafariJpegFallback(browser,name){
 const page=await browser.newPage({viewport:{width:390,height:812}});
 await page.goto(origin+'/qa/photo-fixture.html');
 await page.evaluate(async()=>{
  window.CA_PROFILE_PHOTO_UPLOAD_ENABLED=true;
  const nativeToBlob=HTMLCanvasElement.prototype.toBlob;
  HTMLCanvasElement.prototype.toBlob=function(callback,type,quality){
   if(type==='image/webp'){
    // iOS Safari silently gives back PNG when asked to encode WebP.
    callback(new Blob([new Uint8Array(8)],{type:'image/png'}));
    return;
   }
   return nativeToBlob.call(this,callback,type,quality);
  };
  let stored=null;
  window.__photoSafariUploads=[];
  const client={
   auth:{getUser:async()=>({data:{user:{id:'qa-browser-user'}},error:null})},
   from:()=>({
    select(){return this},
    eq(){return this},
    insert(row){stored=row;return this},
    async maybeSingle(){return {data:stored,error:null}}
   }),
   storage:{from:()=>({
    upload:async(path,bytes,options)=>{
     window.__photoSafariUploads.push({path,mime:bytes.type,size:bytes.size,contentType:options.contentType,upsert:options.upsert});
     return {data:{path},error:null};
    },
    remove:async()=>({data:[],error:null}),
    createSignedUrl:async()=>({data:{signedUrl:'/qa/photo.svg'},error:null})
   })}
  };
  const mod=await import('/docs/profile-photo.mjs');
  mod.mountProfilePhoto({host:document.querySelector('#testHost'),role:'ca',session:{user:{id:'qa-browser-user'}},client});
 });
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGMU2aL7n4GBgYGJAQoAHV8B+NIe2REAAAAASUVORK5CYII=','base64');
 await page.locator('#profilePhotoInput').setInputFiles({name:'iphone-photo.png',mimeType:'image/png',buffer:png});
 await page.waitForFunction(()=>document.querySelector('#profilePhotoInfo').textContent.includes('JPEG'),{timeout:10000});
 assert.ok(await page.locator('#profilePhotoPreview').isVisible(),'Safari cannot preview JPEG fallback');
 assert.equal(await page.locator('#profilePhotoSave').isEnabled(),true,'JPEG fallback was not enabled for upload');
 await page.locator('#profilePhotoSave').click();
 await page.waitForFunction(()=>window.__photoSafariUploads?.length===1,{timeout:10000});
 const uploads=await page.evaluate(()=>window.__photoSafariUploads);
 assert.equal(uploads[0].mime,'image/jpeg','Safari fallback stored wrong image MIME');
 assert.equal(uploads[0].contentType,'image/jpeg','Safari fallback supplied wrong storage contentType');
 assert.ok(uploads[0].path.endsWith('.jpg'),'Safari fallback stored wrong extension');
 assert.ok(uploads[0].size>0&&uploads[0].size<=51200,'Safari fallback exceeds 50KiB');
 assert.equal(uploads[0].upsert,false,'Safari fallback unexpectedly uses upsert');
 record(name+' iOS Safari WebP unsupported: JPEG upload and MIME match');
 await page.close();
}

async function testRapidPhotoSelection(browser,name){
 const page=await browser.newPage({viewport:{width:390,height:812}});
 await page.goto(origin+'/qa/photo-fixture.html');
 await page.evaluate(async()=>{
  window.CA_PROFILE_PHOTO_UPLOAD_ENABLED=false;
  let reads=0,encoded=0;
  window.Image=class {
   naturalWidth=200;naturalHeight=200;
   set src(_){
    const initial=++reads===1;
    setTimeout(()=>this.onload?.(),initial?180:12);
   }
  };
  HTMLCanvasElement.prototype.getContext=function(){return {fillRect(){},drawImage(){}}};
  HTMLCanvasElement.prototype.toBlob=function(cb){
   const size=++encoded===1?10*1024:25*1024;
   cb(new Blob([new Uint8Array(size)],{type:'image/webp'}));
  };
  const mod=await import('/docs/profile-photo.mjs');
  mod.mountProfilePhoto({
   host:document.querySelector('#testHost'),
   role:'ca',session:{user:{id:'qa-browser-user'}},
   client:{auth:{getUser:async()=>({data:{user:{id:'qa-browser-user'}}})}}
  });
 });
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGMU2aL7n4GBgYGJAQoAHV8B+NIe2REAAAAASUVORK5CYII=','base64');
 await page.locator('#profilePhotoInput').setInputFiles({name:'first.png',mimeType:'image/png',buffer:png});
 await page.waitForTimeout(20);
 await page.locator('#profilePhotoInput').setInputFiles({name:'second.png',mimeType:'image/png',buffer:png});
 await page.waitForTimeout(300);
 const info=await page.locator('#profilePhotoInfo').textContent();
 assert.ok(info.includes('10KB'),'an older compression overwrote the newer selection: '+info);
 assert.equal(await page.locator('#profilePhotoSave').isDisabled(),true);
 record(name+' rapid image selection keeps most recent preview');
 await page.close();
}
try{
 const configured=(process.env.CA_PHOTO_QA_BROWSERS||'chromium').split(',').map(x=>x.trim()).filter(Boolean);
 for(const name of configured){
  const type={chromium,webkit}[name];
  if(!type)throw Error('Unsupported browser engine '+name);
  const options=name==='chromium'&&process.env.QA_CHROME_BIN?{executablePath:process.env.QA_CHROME_BIN}:{};
  const browser=await type.launch({headless:true,...options});
  try{await testUniversalCloverHome(browser,name);await testMedal(browser,name);await testSettingsAccordion(browser,name);await testCompression(browser,name);await testSafariJpegFallback(browser,name);await testRapidPhotoSelection(browser,name)}
  finally{await browser.close()}
 }
 console.log('CA PHOTO BROWSER PASS '+pass.length+'/'+pass.length);
}catch(error){console.error('CA PHOTO BROWSER FAIL '+error.stack);process.exitCode=1}
finally{await new Promise(resolve=>server.close(resolve))}
