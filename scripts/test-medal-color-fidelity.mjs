// CA Clover shared 3D medal color/glare guard, without live APIs or secrets.
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const html=readFileSync(new URL("../docs/stamp-rally.html",import.meta.url),"utf8");
const rulesModule=readFileSync(new URL("../docs/medal-render-preset.js",import.meta.url),"utf8");
const {MEDAL_DESIGN_RULES:rules,createMedalFaceMaterial,createMedalFaceGlossMaterial}=await import(
 "data:text/javascript,"+encodeURIComponent(rulesModule)
);

assert(Object.isFrozen(rules)&&Object.isFrozen(rules.lights)&&Object.isFrozen(rules.face));
assert.equal(rules.version,"2026-10-17-soft-gloss-d");
assert.deepEqual(
 [rules.lights.hemisphere,rules.lights.key,rules.lights.rim,rules.lights.back],
 [1.2,1.75,.82,.4],
 "Approved light intensity values must not drift"
);
assert.equal(rules.exposure,.92);
assert.equal(rules.face.material,"MeshBasicMaterial");
assert.equal(rules.face.toneMapped,false);
assert.equal(rules.face.clearcoat,0);
assert.equal(rules.face.roughness,null);
assert.equal(rules.face.insetScale,.97);
assert.equal(rules.gold.color,0xb8922e);
assert(Object.isFrozen(rules.faceGloss),"D gloss standard is immutable");
assert.deepEqual(
 [rules.faceGloss.opacity,rules.faceGloss.metalness,rules.faceGloss.roughness,rules.faceGloss.reflectivity,
  rules.faceGloss.clearcoat,rules.faceGloss.clearcoatRoughness,rules.faceGloss.zOffset],
 [.16,0,.55,.16,.20,.50,.0006],
 "D gloss standard must not drift"
);


class BasicMaterialFixture { constructor(options){Object.assign(this,options)} }
const basic=createMedalFaceMaterial({
 MeshBasicMaterial:BasicMaterialFixture,
 FrontSide:333,
});
assert(basic instanceof BasicMaterialFixture);
assert.equal(basic.color,0xffffff);
assert.equal(basic.toneMapped,false);
assert.equal(basic.side,333);
assert.equal(Object.hasOwn(basic,"metalness"),false);
assert.equal(Object.hasOwn(basic,"roughness"),false);
assert.equal(Object.hasOwn(basic,"clearcoat"),false);

// The transparent gloss is independent from the faithful base texture.
class PhysicalMaterialFixture { constructor(options){Object.assign(this,options)} }
const gloss=createMedalFaceGlossMaterial({
 MeshPhysicalMaterial:PhysicalMaterialFixture,
 FrontSide:333
});
assert(gloss instanceof PhysicalMaterialFixture);
assert.equal(gloss.color,0xffffff);
assert.equal(gloss.transparent,true);
assert.equal(gloss.opacity,.16);
assert.equal(gloss.roughness,.55);
assert.equal(gloss.reflectivity,.16);
assert.equal(gloss.clearcoat,.20);
assert.equal(gloss.clearcoatRoughness,.50);
assert.equal(gloss.metalness,0);
assert.equal(gloss.depthWrite,false);
assert.equal(gloss.polygonOffset,true);
assert.equal(gloss.side,333);
assert.equal(gloss.map,undefined,"Gloss layer must not duplicate or wash out the image");


assert.match(html,/import\("\.\/medal-render-preset\.js\?v=20261017-soft-gloss-d"\)/,
 "3D must load common rules explicitly");
assert.match(html,/const faceMaterial=createMedalFaceMaterial\(THREE\)/);
assert.match(html,/const activeFaceMaterial=faceMaterial\.clone\(\)/);
assert.match(html,/faceGloss=new THREE\.Mesh\(front\.geometry\.clone\(\),createMedalFaceGlossMaterial\(THREE\)\)/);
assert.match(html,/faceGloss\.name="FrontFaceGloss"/);
assert.match(html,/faceGloss\.position\.z=MEDAL_DESIGN_RULES\.faceGloss\.zOffset/);
assert.match(html,/front\.add\(faceGloss\)/,"Gloss must be child of face, not positioned in scene coordinates");
assert.match(html,/faceGloss\?\.geometry\.dispose\(\)/,"Release cloned gloss geometry");
assert.match(html,/faceGloss\?\.material\.dispose\(\)/,"Release gloss material");
assert(html.indexOf("if(!textureApplied||token!==stamp3dToken)")<html.indexOf("faceGloss=new THREE.Mesh("),
 "Do not allocate gloss before texture succeeds");

assert.match(html,/activeFaceMaterial\.map=faceTexture/);
assert.match(html,/front\.material=activeFaceMaterial/);
assert.doesNotMatch(html,/const sourceFaceMaterial=/,
 "GLB material must not re-enable glossy physical reflection on Community artwork");
assert.doesNotMatch(rulesModule,/WebGLRenderer\.prototype\.render|__caCloverMedalPreset/,
 "Common rules may not globally patch the renderer");
for(const [label,regex] of Object.entries({
 hemisphere:/new THREE\.HemisphereLight\(0xffffff,0x6f685f,MEDAL_DESIGN_RULES\.lights\.hemisphere\)/,
 key:/new THREE\.DirectionalLight\(0xffffff,MEDAL_DESIGN_RULES\.lights\.key\)/,
 rim:/new THREE\.DirectionalLight\(0xffe5b4,MEDAL_DESIGN_RULES\.lights\.rim\)/,
 back:/new THREE\.DirectionalLight\(0xffffff,MEDAL_DESIGN_RULES\.lights\.back\)/,
 exposure:/renderer\.toneMappingExposure=MEDAL_DESIGN_RULES\.exposure/,
 toneMap:/renderer\.toneMapping=THREE\.ACESFilmicToneMapping/
})){
 assert.match(html,regex,label+" must use the approved common rule");
}
assert.match(html,/const goldMaterial=new THREE\.MeshPhysicalMaterial\(\{color:0xb8922e/,
 "Gold frame must retain its existing metallic material");
assert.match(html,/const backMaterial=new THREE\.MeshPhysicalMaterial/,
 "Back of medal must keep PBR reflection and engraving");
assert.match(html,/const pinMaterial=new THREE\.MeshPhysicalMaterial/,
 "Pin must remain metallic");
assert.match(html,/gachiMonFaceFit\?GACHI_MON_FACE\.modal3DScale:MEDAL_DESIGN_RULES\.face\.insetScale/,
 "Community override remains isolated, while shared default uses 97% crop");
assert.match(html,/faceOffset=options\?\.gachiMonFaceFit\?resolution\*GACHI_MON_FACE\.offset:0/,
 "Gachi-mon offset unchanged");
assert.match(html,/texture\.colorSpace=THREE\.SRGBColorSpace/,
 "Input texture must be sRGB");
assert.match(html,/fitted\.colorSpace=texture\.colorSpace/,
 "Fitted CanvasTexture must preserve sRGB");
assert.match(html,/ctx\.filter="saturate\("\+MEDAL_DESIGN_RULES\.face\.saturation\+"\) contrast\("\+MEDAL_DESIGN_RULES\.face\.contrast\+"\)";/,
 "The 3D image uses the shared color adjustment");
assert(html.includes(`filter:saturate(${rules.face.saturation}) contrast(${rules.face.contrast})`),
 "2D image must have the same color filter as the 3D texture");
assert.match(html,/MEDAL_TEXTURE_FALLBACK_BEGIN[\s\S]*?unmountStampMedal3D\(\)[\s\S]*?MEDAL_TEXTURE_FALLBACK_END/,
 "2D fallback retained on failed texture");
assert.match(html,/suzukiBurned,gachiMonFaceFit,communityId:c\.id/,
 "Special engraving, per-community positioning and auth relay arguments preserved");
const allScripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)]
 .map(m=>m[1].trim()).filter(s=>s&&!s.startsWith('{"imports"'));
for(const script of allScripts)new Function(script);
console.log("PASS medal color fidelity: unlit sRGB artwork, metallic gold, approved lights, shared rules, special face/engraving, 2D fallback");
