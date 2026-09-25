import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";

// Shared visual baseline for CA Clover 3D medals.
// Keeps official and virtual-test medals visually identical without touching
// collection/storage semantics. Suzuki-only engraving/burn layers are preserved.
const PRESET={
 exposure:.94,
 holderX:-.055,
 holderY:.22,
 lights:{key:2.55,rim:1.35,back:.65},
 front:{metalness:0,roughness:.30,clearcoat:.12,clearcoatRoughness:.32,reflectivity:.24},
 gold:{color:0xe3bd6a,metalness:.72,roughness:.24,clearcoat:.38,clearcoatRoughness:.20},
 back:{color:0xc8c8c5,metalness:.82,roughness:.34},
 brushed:{color:0xb9bab8,metalness:.90,roughness:.43},
 pin:{color:0xb8bab9,metalness:.94,roughness:.25}
};

function setPhysical(material,values){
 if(!material)return;
 const list=Array.isArray(material)?material:[material];
 for(const m of list){
  if(!m)continue;
  if(values.color!=null&&m.color?.set)m.color.set(values.color);
  for(const [key,value] of Object.entries(values)){
   if(key==="color")continue;
   if(key in m)m[key]=value;
  }
  m.needsUpdate=true;
 }
}

function applyPreset(renderer,scene){
 const front=scene.getObjectByName?.("FrontFace");
 if(!front)return;
 renderer.toneMappingExposure=PRESET.exposure;

 let medalRoot=front;
 while(medalRoot.parent&&medalRoot.parent!==scene)medalRoot=medalRoot.parent;
 if(medalRoot.parent===scene){
  medalRoot.rotation.x=PRESET.holderX;
  medalRoot.rotation.y=PRESET.holderY;
 }

 let key=null,rim=null,back=null;
 scene.traverse(object=>{
  if(object?.isDirectionalLight){
   if(object.color?.getHex?.()===0xffe5b4)rim=object;
   else if(object.position?.z<0)back=object;
   else key=object;
  }
 });
 if(key)key.intensity=PRESET.lights.key;
 if(rim)rim.intensity=PRESET.lights.rim;
 if(back)back.intensity=PRESET.lights.back;

 setPhysical(front.material,PRESET.front);
 setPhysical(scene.getObjectByName?.("MedalBody")?.material,PRESET.gold);
 setPhysical(scene.getObjectByName?.("back_shell")?.material,PRESET.back);
 setPhysical(scene.getObjectByName?.("brushed_detail")?.material,PRESET.brushed);
 setPhysical(scene.getObjectByName?.("pin_assembly")?.material,PRESET.pin);
}

if(!THREE.WebGLRenderer.prototype.__caCloverMedalPreset){
 const originalRender=THREE.WebGLRenderer.prototype.render;
 THREE.WebGLRenderer.prototype.render=function(scene,camera){
  try{applyPreset(this,scene)}catch(_){}
  return originalRender.call(this,scene,camera);
 };
 Object.defineProperty(THREE.WebGLRenderer.prototype,"__caCloverMedalPreset",{value:true});
}

window.CAMedalRenderPreset=PRESET;
