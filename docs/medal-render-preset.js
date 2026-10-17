// CA Clover shared medal rendering rules (2026-10-17).
// Explicitly imported by the Medal Rally. No prototype patches or implicit
// rendering side effects. Gold rim and engraved back remain PBR materials.
//
// Design policy:
// 1. Community artwork remains an accurate unlit sRGB base with translucent gloss.
// 2. Metallic parts, a light physical gloss and a view-dependent softbox reflection use lighting; the artwork does not.
// 3. Keep the existing per-community crop/offset, rotations and engravings.
// 4. Never edit saved medal, acquisition, or image version records for styling.
export const MEDAL_DESIGN_RULES = Object.freeze({
 version:"2026-10-17-soft-gloss-e-reflection",
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
  opacity:.18,metalness:0,roughness:.42,reflectivity:.24,
  clearcoat:.30,clearcoatRoughness:.32,
  zOffset:.0006
 }),
 // A broad, dim virtual softbox; its reflection is computed from the real
 // model orientation and view direction (not animated with a timer).
 faceReflection:Object.freeze({
  maxOpacity:.15,lightX:-.55,lightY:.55,lightZ:2.85,
  halfWidth:.32,halfLength:1.65,edgeFeather:.26,
  zOffset:.08
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

// The virtual softbox creates a *moving* reflected strip: changing medal tilt
// changes the surface normal and the reflected ray, with no frame-time effects.
// Its translucency is capped so KOGA yellow and all artwork remain faithful.
export function createMedalFaceReflectionMaterial(THREE){
 const spec=MEDAL_DESIGN_RULES.faceReflection;
 return new THREE.ShaderMaterial({
  name:"MedalFaceSoftboxReflection",
  uniforms:{
   uOpacity:{value:spec.maxOpacity},
   uLightCenter:{value:new THREE.Vector3(spec.lightX,spec.lightY,spec.lightZ)},
   uHalfWidth:{value:spec.halfWidth},
   uHalfLength:{value:spec.halfLength},
   uEdgeFeather:{value:spec.edgeFeather}
  },
  vertexShader:`
   varying vec3 vWorldPosition;
   varying vec3 vWorldNormal;
   varying float vLocalNormalZ;
   void main(){
    vec4 worldPos=modelMatrix*vec4(position,1.0);
    vWorldPosition=worldPos.xyz;
    vWorldNormal=normalize(mat3(modelMatrix)*normal);
    vLocalNormalZ=normal.z;
    gl_Position=projectionMatrix*viewMatrix*worldPos;
   }
  `,
  fragmentShader:`
   uniform float uOpacity;
   uniform vec3 uLightCenter;
   uniform float uHalfWidth;
   uniform float uHalfLength;
   uniform float uEdgeFeather;
   varying vec3 vWorldPosition;
   varying vec3 vWorldNormal;
   varying float vLocalNormalZ;
   void main(){
    // FrontFace GLB also contains its bevel and back: only illuminate the artwork.
    if(vLocalNormalZ<0.92)discard;
    vec3 N=normalize(vWorldNormal);
    vec3 V=normalize(cameraPosition-vWorldPosition);
    if(dot(N,V)<=0.0)discard;
    vec3 R=reflect(-V,N);
    if(R.z<=0.08)discard;
    // Intersection of reflected camera ray with a fixed, wide softbox plane.
    float distanceToLight=(uLightCenter.z-vWorldPosition.z)/R.z;
    if(distanceToLight<=0.0)discard;
    vec2 lightHit=(vWorldPosition+R*distanceToLight).xy-uLightCenter.xy;
    vec2 across=vec2(0.928,0.371);
    vec2 along=vec2(-0.371,0.928);
    float x=abs(dot(lightHit,across));
    float y=abs(dot(lightHit,along));
    float ends=1.0-smoothstep(uHalfLength-uEdgeFeather,uHalfLength+uEdgeFeather,y);
    float core=1.0-smoothstep(uHalfWidth*0.12,uHalfWidth,x);
    float halo=1.0-smoothstep(uHalfWidth,uHalfWidth*2.25,x);
    float strip=ends*(0.84*core+0.16*halo);
    float facing=smoothstep(0.08,0.30,R.z);
    float alpha=clamp(uOpacity*strip*facing,0.0,uOpacity);
    gl_FragColor=vec4(1.0,0.965,0.91,alpha);
   }
  `,
  side:THREE.FrontSide,
  transparent:true,
  depthTest:true,
  depthWrite:false,
  toneMapped:false,
  polygonOffset:true,
  polygonOffsetFactor:-2,
  polygonOffsetUnits:-2
 });
}
