// CA Clover shared medal rendering rules (2026-10-17).
// Explicitly imported by the Medal Rally. No prototype patches or implicit
// rendering side effects. Gold rim and engraved back remain PBR materials.
//
// Design policy:
// 1. Community artwork remains an accurate unlit sRGB base with translucent gloss.
// 2. Metallic parts and a very light separate gloss use lighting; the artwork does not.
// 3. Keep the existing per-community crop/offset, rotations and engravings.
// 4. Never edit saved medal, acquisition, or image version records for styling.
export const MEDAL_DESIGN_RULES = Object.freeze({
 version:"2026-10-17-soft-gloss-d",
 exposure:.92,
 holder:Object.freeze({x:-.055,y:.22}),
 lights:Object.freeze({hemisphere:1.20,key:1.75,rim:.82,back:.40}),
 face:Object.freeze({
  material:"MeshBasicMaterial",
  color:0xffffff,
  toneMapped:false,
  roughness:null,    // Not applicable to unlit MeshBasicMaterial.
  clearcoat:0,       // No plastic shine on the Community image.
  insetScale:.97,
  saturation:1.12,
  contrast:1.06
 }),
 faceGloss:Object.freeze({
  opacity:.16,metalness:0,roughness:.55,reflectivity:.16,
  clearcoat:.20,clearcoatRoughness:.50,
  zOffset:.0006
 }),
 gold:Object.freeze({
  // Preserve the existing gold frame, including its real metallic reflections.
  color:0xb8922e,metalness:.95,roughness:.34,reflectivity:.52,
  clearcoat:.08,clearcoatRoughness:.18
 })
});

export function createMedalFaceMaterial(THREE){
 return new THREE.MeshBasicMaterial({
  color:MEDAL_DESIGN_RULES.face.color,
  toneMapped:MEDAL_DESIGN_RULES.face.toneMapped,
  side:THREE.FrontSide
 });
}

// The gloss mesh is separate from the artwork. Do not put a PBR shader on
// the Community icon texture itself: the image must keep its accurate color.
export function createMedalFaceGlossMaterial(THREE){
 const gloss=MEDAL_DESIGN_RULES.faceGloss;
 return new THREE.MeshPhysicalMaterial({
  color:0xffffff,
  transparent:true,
  opacity:gloss.opacity,
  metalness:gloss.metalness,
  roughness:gloss.roughness,
  reflectivity:gloss.reflectivity,
  clearcoat:gloss.clearcoat,
  clearcoatRoughness:gloss.clearcoatRoughness,
  side:THREE.FrontSide,
  depthWrite:false,
  polygonOffset:true,
  polygonOffsetFactor:-1,
  polygonOffsetUnits:-1
 });
}
