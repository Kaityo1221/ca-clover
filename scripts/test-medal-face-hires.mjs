// Regression checks for high-resolution 3D medal image source selection.
// No network, Supabase, storage mutations or user data needed.
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";

const html=readFileSync(new URL("../docs/stamp-rally.html",import.meta.url),"utf8");
const begin=html.indexOf("function medalFaceTextureSources(");
const end=html.indexOf("\nasync function mountStampMedal3D(",begin);
assert.ok(begin>=0&&end>begin,"Source picker must exist in 3D medal page");
const pick=runInNewContext(html.slice(begin,end)+"\nmedalFaceTextureSources");
function names(...args){
 return Array.from(pick(...args),entry=>entry.kind==="storage"
  ?entry.bucket+":"+entry.path:"url:"+entry.url);
}
const design={
 archive_path:"full/a.png",
 thumbnail_path:"small/a.webp",
 source_avatar_url:"https://example.test/a-original.png"
};
assert.deepEqual(names(design,"https://example.test/a-thumb.webp","https://example.test/current.png"),[
 "community-icon-archive:full/a.png",
 "url:https://example.test/a-original.png",
 "url:https://example.test/current.png",
 "community-icon-thumbs:small/a.webp",
 "url:https://example.test/a-thumb.webp"
],"Original archived image must be first, thumbnails last");
assert.deepEqual(names(design,"https://example.test/a-thumb.webp","https://example.test/a-original.png"),[
 "community-icon-archive:full/a.png",
 "url:https://example.test/a-original.png",
 "community-icon-thumbs:small/a.webp",
 "url:https://example.test/a-thumb.webp"
],"Identical URLs must not be requested twice");
assert.deepEqual(names({thumbnail_path:"small/x.png"},"https://example.test/a-thumb.webp","https://example.test/current.png"),[
 "url:https://example.test/current.png",
 "community-icon-thumbs:small/x.png",
 "url:https://example.test/a-thumb.webp"
],"Missing archive must gracefully fall back to avatar then thumbnail");
assert.deepEqual(names(null,"https://example.test/thumb.png","https://example.test/current.png"),[
 "url:https://example.test/current.png",
 "url:https://example.test/thumb.png"
],"No saved design must still work");
assert.deepEqual(names(null,"",""),[],"Missing every source must not crash");
assert.match(html,/for\(const source of medalFaceTextureSources\(design,imageUrl,fallbackImageUrl\)\)/,
 "3D renderer must use the tested ordering");
assert.match(html,/client\.storage\.from\(source\.bucket\)\.download\(source\.path\)/,
 "Storage images must be downloaded with the existing authenticated client");
assert.match(html,/if\(objectUrl\)URL\.revokeObjectURL\(objectUrl\)/,
 "Failed blob URLs must be revoked");
assert.doesNotMatch(html,/if\(design\?\.thumbnail_path\)\s*\{/,
 "Old eager thumbnail-first path must not return");
assert.ok(html.includes("const imageScale=options?.gachiMonFaceFit?GACHI_MON_FACE.modal3DScale:.97;"),
 "3D medal icons must retain the 97% default and the isolated Gachi Mon override");
assert.ok(html.includes("const faceOffset=options?.gachiMonFaceFit?resolution*GACHI_MON_FACE.offset:0;"),
 "Gachi Mon 3D medal must use its targeted offset, with zero offset for other medals");
assert.ok(html.includes("const inset=resolution*(1-imageScale)/2;"),
 "3D inset should be symmetric, leaving the gold rim unchanged");
assert.ok(html.includes('ctx.filter="saturate(1.12) contrast(1.06)";'),
 "3D medal should gently restore washed-out source colors");
assert.ok(html.includes("transform:scale(.97);filter:saturate(1.12) contrast(1.06)"),
 "2D medal should use the same conservative tuning");
assert.ok(!html.includes("Math.abs(width-height)<1)return texture"),
 "Square images must also receive the 3% inset");
const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)]
 .map(match=>match[1].trim()).filter(script=>script&&!script.startsWith('{"imports"'));
for(const script of scripts)new Function(script);
console.log("3D medal high-resolution source preference: 9 regression checks PASS");

const fallback=html.match(/\/\/ MEDAL_TEXTURE_FALLBACK_BEGIN([\s\S]*?)\/\/ MEDAL_TEXTURE_FALLBACK_END/)?.[1];
assert.ok(fallback,'Texture failure must be handled before displaying a model');
function exercise(textureApplied,token=1,currentToken=1){
 const calls=[];const resource=name=>({dispose(){calls.push(name)}});
 const shared=resource('faceMaterial');
 const context={textureApplied,token,stamp3dToken:currentToken,
  controls:resource('controls'),faceTexture:null,engravingOverlayGeometry:null,engravingOverlayMaterial:null,engravingVisualTexture:null,engravingBumpTexture:null,
  faceObjectUrl:'blob:fixture',URL:{revokeObjectURL(){calls.push('blob')}},activeFaceMaterial:resource('activeFaceMaterial'),
  goldMaterial:resource('goldMaterial'),faceMaterial:shared,backMaterial:resource('backMaterial'),brushedMaterial:resource('brushedMaterial'),pinMaterial:resource('pinMaterial'),
  environment:resource('environment'),pmrem:resource('pmrem'),renderer:{...resource('renderer'),domElement:{remove(){calls.push('canvas')}}},
  unmountStampMedal3D(){calls.push('show2D')},
 };
 const result=runInNewContext('(function(){'+fallback+';return "3D"})()',context);
 return {calls,result};
}
const failed=exercise(false);assert.equal(failed.result,undefined);assert(failed.calls.includes('show2D'));assert(failed.calls.includes('renderer'));assert(failed.calls.includes('blob'));
const success=exercise(true);assert.equal(success.result,'3D');assert.deepEqual(success.calls,[]);
const stale=exercise(false,1,2);assert(!stale.calls.includes('show2D'));assert(stale.calls.includes('renderer'));
assert(html.indexOf('// MEDAL_TEXTURE_FALLBACK_BEGIN')<html.indexOf('stamp3d.appendChild(renderer.domElement)'),'Blank model must never be mounted');
console.log('Medal fallback: failed texture restores 2D, success keeps 3D, stale load preserves next medal, resources released PASS');
