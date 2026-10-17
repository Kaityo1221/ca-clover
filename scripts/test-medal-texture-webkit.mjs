import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
const require=createRequire(import.meta.url);
const {webkit}=require('./ci/participant-runtime/node_modules/playwright');
const html=readFileSync(new URL('../docs/stamp-rally.html',import.meta.url),'utf8');
const fallback=html.match(/\/\/ MEDAL_TEXTURE_FALLBACK_BEGIN([\s\S]*?)\/\/ MEDAL_TEXTURE_FALLBACK_END/)[1];
const styles=html.match(/<style>([\s\S]*?)<\/style>/)[1];
// Real local HTTP origins: request interception can bypass native CORS checks.
const imageServer=createServer((req,res)=>{res.writeHead(200,{'content-type':'image/svg+xml'});res.end('<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><rect width="128" height="128" fill="#147caa"/><circle cx="64" cy="64" r="40" fill="#efd45c"/></svg>');});
await new Promise(r=>imageServer.listen(0,'127.0.0.1',r));
const imageUrl='http://127.0.0.1:'+imageServer.address().port+'/icon.svg';
const appServer=createServer((req,res)=>{res.writeHead(200,{'content-type':'text/html'});res.end('<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1"><style>'+styles+'</style><div id="stamp3d" class="stamp3d show"></div><div id="stampZoom2D" class="stampzoom hidden"><div class="medalinner"><img id="face" src="'+imageUrl+'"></div></div>');});
await new Promise(r=>appServer.listen(0,'127.0.0.1',r));
const browser=await webkit.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 await page.goto('http://127.0.0.1:'+appServer.address().port+'/');
 await page.waitForFunction(()=>document.querySelector('#face').naturalWidth>0);
 // Reproduce the real distinction: <img> succeeds but anonymous/CORS loading fails.
 const corsTexture=await page.evaluate(src=>new Promise(resolve=>{const i=new Image();i.crossOrigin='anonymous';i.onload=()=>resolve(true);i.onerror=()=>resolve(false);i.src=src+'?texture';}),imageUrl);
 assert.equal(corsTexture,false);
 const run=async(textureApplied,token=1,current=1)=>page.evaluate(({code,textureApplied,token,current})=>{
  const calls=[],resource=()=>({dispose(){calls.push('dispose')}});
  const stamp3dToken=current;
  const controls=resource(),faceTexture=null,engravingOverlayGeometry=null,engravingOverlayMaterial=null,engravingVisualTexture=null,engravingBumpTexture=null;
  const faceObjectUrl=null,faceMaterial=resource(),activeFaceMaterial=resource(),goldMaterial=resource(),backMaterial=resource(),brushedMaterial=resource(),pinMaterial=resource(),environment=resource(),pmrem=resource();
  const renderer={...resource(),domElement:document.createElement('canvas')};
  function unmountStampMedal3D(){document.querySelector('#stamp3d').classList.remove('show');document.querySelector('#stampZoom2D').classList.remove('hidden');calls.push('2D');}
  const outcome=eval('(function(){'+code+';return "3D"})()');return {calls,outcome};
 },{code:fallback,textureApplied,token,current});
 const r=await run(corsTexture);assert(r.calls.includes('2D'));
 assert(await page.locator('#stampZoom2D').isVisible());assert(!await page.locator('#stamp3d').isVisible());
 assert.equal(await page.locator('#face').evaluate(i=>i.naturalWidth),128);
 await page.evaluate(()=>{document.querySelector('#stamp3d').classList.add('show');document.querySelector('#stampZoom2D').classList.add('hidden')});
 const good=await run(true);assert.equal(good.outcome,'3D');assert.equal(good.calls.length,0);assert(await page.locator('#stamp3d').isVisible());
 const stale=await run(false,1,2);assert(!stale.calls.includes('2D'));assert(await page.locator('#stamp3d').isVisible());
 console.log('PASS mobile WebKit: ordinary image loads; CORS texture fails; correct visible 2D fallback; successful 3D and subsequent selection preserved');
}finally{await browser.close();await Promise.all([new Promise(r=>appServer.close(r)),new Promise(r=>imageServer.close(r))]);}
