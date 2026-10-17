// CA Clover shared medal rendering rules (2026-10-17).
// Explicitly imported by the Medal Rally. No prototype patches or implicit
// rendering side effects. Gold rim and engraved back remain PBR materials.
//
// Design policy:
// 1. Community art is an accurate, unlit sRGB image (no glare or bloom).
// 2. Only metal parts use scene lighting, environment, and ACES tone mapping.
// 3. Keep the existing per-community crop/offset, rotations and engravings.
// 4. Never edit saved medal, acquisition, or image version records for styling.
export const MEDAL_DESIGN_RULES = Object.freeze({
 version:"2026-10-17-color-fidelity",
 exposure:.92,
 holder:Object.freeze({x:-.055,y:.22}),
 lights:Object.freeze({hemisphere:1.20,key:1.60,rim:.70,back:.40}),
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
