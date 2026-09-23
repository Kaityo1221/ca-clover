(function(){
"use strict";
if(!/(?:^|\/)stamp-rally\.html$/.test(location.pathname))return;

/*
 TEMP SuzukiPM-only cleanup sequence.
 The forge screen (#szReal) owns the fire/burn animation.
 This file only arms AFTER a real forge has happened, then adds cleanup UI
 to the normal stamp detail modal. Normal CA details are never touched.
*/

const css=document.createElement("style");
css.id="suzuki-detail-cleanup-style";
css.textContent=`
#stamp3d{overflow:visible}
.szDetailCleanupRow{display:flex;justify-content:center;margin:12px 0 2px}
.szDetailCleanupBtn{border:1px solid #c8a96a;background:#fffaf0;color:#5a4528;border-radius:999px;padding:10px 18px;font-weight:900;font-size:13px;box-shadow:0 7px 18px #3c2b1730;transition:opacity .2s,transform .2s}
.szDetailCleanupBtn:disabled{opacity:.38;transform:scale(.97)}
.szCleanFx{position:absolute;inset:-4px;z-index:30;pointer-events:none;overflow:visible}
.szCleanBrush{position:absolute;left:50%;top:45%;width:96px;height:34px;opacity:0;transform:translate(-190px,-50%) rotate(-8deg)}
.szCleanBrush:before{content:"";position:absolute;left:28px;top:0;width:68px;height:11px;border-radius:8px;background:linear-gradient(#8b6038,#5a371f);box-shadow:inset 0 2px #b98a5c,0 2px 4px #0002}
.szCleanBrush:after{content:"";position:absolute;left:0;top:9px;width:47px;height:24px;border-radius:8px 8px 5px 5px;background:repeating-linear-gradient(90deg,#806c56 0 3px,#d8c7ae 3px 5px);box-shadow:0 3px 5px #0003}
.szCleanShine{position:absolute;inset:0;border-radius:50%;opacity:0;background:linear-gradient(115deg,transparent 24%,#fff9 44%,#fff 50%,#fff7 56%,transparent 73%);transform:translateX(-135%);mix-blend-mode:screen}
.szCleanSparkle{position:absolute;right:18px;top:20px;font-size:30px;opacity:0;filter:drop-shadow(0 3px 8px #fff)}
#stamp3d.szCleaning .szCleanBrush{opacity:1;animation:szDetailScrub 1.85s cubic-bezier(.45,.05,.55,.95) both}
#stamp3d.szCleaning .szCleanShine{animation:szDetailShine 1.5s 1.05s ease-out both}
#stamp3d.szCleaning .szCleanSparkle{animation:szDetailSparkle .78s 1.62s ease-out both}
#stamp3d.szCleaning>canvas{animation:szBurnLift 1.9s ease both}
.szCleanRenderer{position:absolute;inset:0;z-index:12;opacity:0;transition:opacity .38s ease;pointer-events:auto}
.szCleanRenderer.ready{opacity:1}
.szCleanRenderer canvas{display:block;width:100%;height:100%;touch-action:none}
@keyframes szDetailScrub{0%{transform:translate(-190px,-50%) rotate(-8deg)}16%{transform:translate(55px,-50%) rotate(7deg)}32%{transform:translate(-150px,-50%) rotate(-7deg)}48%{transform:translate(50px,-50%) rotate(6deg)}64%{transform:translate(-125px,-50%) rotate(-5deg)}80%{transform:translate(38px,-50%) rotate(4deg)}100%{opacity:0;transform:translate(112px,-50%) rotate(8deg)}}
@keyframes szDetailShine{0%{opacity:0;transform:translateX(-135%)}22%{opacity:.72}100%{opacity:0;transform:translateX(135%)}}
@keyframes szDetailSparkle{0%{opacity:0;transform:scale(.4) rotate(-12deg)}45%{opacity:1;transform:scale(1.28) rotate(4deg)}100%{opacity:0;transform:scale(.8) rotate(10deg)}}
@keyframes szBurnLift{0%{filter:brightness(.92) contrast(1.16) saturate(.82)}100%{filter:brightness(1.04) contrast(1.04) saturate(.96)}}
`;
document.head.appendChild(css);

let state="normal"; // normal -> burned -> cleaning -> clean
let forgeSeen=false;
let cleanupRow=null;
let fx=null;
let cleanRendererCleanup=null;
let cleanRenderToken=0;
let observerBusy=false;

function suzukiDetailOpen(){
 const modal=document.getElementById("stampModalBack");
 if(!modal||!modal.classList.contains("show"))return false;
 const controls=document.getElementById("stampDesignControls");
 const area=document.getElementById("stampZoomArea");
 const text=((controls&&controls.textContent)||"")+" "+((area&&area.textContent)||"");
 return /SuzukiPM/i.test(text);
}

function specialRootHidden(){
 const root=document.getElementById("szReal");
 if(!root)return false;
 const s=getComputedStyle(root);
 return s.display==="none"||Number(s.opacity||1)<=0.01;
}

function removeCleanupUi(){
 if(cleanupRow){cleanupRow.remove();cleanupRow=null}
 const stamp3d=document.getElementById("stamp3d");
 if(stamp3d){stamp3d.classList.remove("szCleaning");const old=stamp3d.querySelector(".szCleanFx");if(old)old.remove()}
 fx=null;
}

function disposeCleanRenderer(){
 cleanRenderToken++;
 if(cleanRendererCleanup){try{cleanRendererCleanup()}catch(_){}cleanRendererCleanup=null}
 const stamp3d=document.getElementById("stamp3d");
 if(stamp3d){
  const overlay=stamp3d.querySelector(".szCleanRenderer");if(overlay)overlay.remove();
  stamp3d.querySelectorAll(":scope>canvas").forEach(c=>{c.style.opacity="";c.style.pointerEvents=""});
 }
}

function resetForNewRitual(){
 state="normal";
 forgeSeen=false;
 removeCleanupUi();
 disposeCleanRenderer();
}

function addFx(){
 const stamp3d=document.getElementById("stamp3d");
 if(!stamp3d)return null;
 let layer=stamp3d.querySelector(".szCleanFx");
 if(!layer){
  layer=document.createElement("div");layer.className="szCleanFx";
  layer.innerHTML='<div class="szCleanBrush"></div><div class="szCleanShine"></div><div class="szCleanSparkle">✨</div>';
  stamp3d.appendChild(layer);
 }
 fx=layer;
 return layer;
}

function insertCleanupButton(){
 if(state!=="burned"||!forgeSeen||!suzukiDetailOpen()||!specialRootHidden())return;
 const controls=document.getElementById("stampDesignControls");
 if(!controls||cleanupRow&&document.contains(cleanupRow))return;
 cleanupRow=document.createElement("div");
 cleanupRow.className="szDetailCleanupRow";
 cleanupRow.innerHTML='<button type="button" class="szDetailCleanupBtn">🧹 煤をお掃除</button>';
 const first=controls.firstElementChild;
 if(first&&first.nextSibling)controls.insertBefore(cleanupRow,first.nextSibling);else controls.appendChild(cleanupRow);
 addFx();
 const button=cleanupRow.querySelector("button");
 button.onclick=async e=>{
  e.preventDefault();e.stopPropagation();
  if(state!=="burned")return;
  state="cleaning";
  button.disabled=true;
  const stamp3d=document.getElementById("stamp3d");
  if(stamp3d){addFx();stamp3d.classList.remove("szCleaning");void stamp3d.offsetWidth;stamp3d.classList.add("szCleaning")}
  // Build the clean engraved 3D medal while the brush is moving.
  const ready=mountCleanSuzukiMedal3D();
  await new Promise(r=>setTimeout(r,1880));
  try{await ready}catch(_){}
  if(stamp3d)stamp3d.classList.remove("szCleaning");
  if(cleanupRow){cleanupRow.remove();cleanupRow=null}
  state="clean";
  setTimeout(()=>{const layer=document.querySelector("#stamp3d .szCleanFx");if(layer)layer.remove();fx=null},650);
 };
}

async function mountCleanSuzukiMedal3D(){
 const stamp3d=document.getElementById("stamp3d");
 if(!stamp3d)return;
 const token=++cleanRenderToken;
 const previous=stamp3d.querySelector(".szCleanRenderer");if(previous)previous.remove();
 const overlay=document.createElement("div");overlay.className="szCleanRenderer";stamp3d.appendChild(overlay);
 let renderer=null,observer=null,controls=null,environment=null,pmrem=null,frameId=0,stopped=false;
 let faceTexture=null,engravingVisualTexture=null,engravingBumpTexture=null,engravingOverlayGeometry=null,engravingOverlayMaterial=null;
 const materials=[];
 try{
  const THREE=await import("three");
  const [{OrbitControls},{RoomEnvironment},{GLTFLoader}]=await Promise.all([
   import("three/addons/controls/OrbitControls.js"),
   import("three/addons/environments/RoomEnvironment.js"),
   import("three/addons/loaders/GLTFLoader.js")
  ]);
  if(token!==cleanRenderToken)return;

  const scene=new THREE.Scene();
  const camera=new THREE.PerspectiveCamera(28,1,.01,100);camera.position.set(0,.03,4.10);
  renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:"high-performance"});
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.92;
  renderer.setClearColor(0x000000,0);renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
  renderer.domElement.style.width="100%";renderer.domElement.style.height="100%";renderer.domElement.style.touchAction="none";

  pmrem=new THREE.PMREMGenerator(renderer);const room=new RoomEnvironment();environment=pmrem.fromScene(room,.04).texture;room.dispose();scene.environment=environment;
  scene.add(new THREE.HemisphereLight(0xffffff,0x6f685f,1.7));
  const key=new THREE.DirectionalLight(0xffffff,3.1);key.position.set(2.4,3.2,4.2);scene.add(key);
  const rim=new THREE.DirectionalLight(0xffe5b4,1.6);rim.position.set(-3.2,.8,-2.4);scene.add(rim);
  const backFill=new THREE.DirectionalLight(0xffffff,.72);backFill.position.set(.35,1.15,-4.2);scene.add(backFill);
  const holder=new THREE.Group();holder.rotation.x=-.055;holder.rotation.y=.22;scene.add(holder);

  controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.06;controls.enablePan=false;controls.enableZoom=false;controls.rotateSpeed=.55;controls.autoRotate=true;controls.autoRotateSpeed=1.35;controls.target.set(0,0,0);

  const gold=new THREE.MeshPhysicalMaterial({color:0xb8922e,metalness:.95,roughness:.34,reflectivity:.52,clearcoat:.08,clearcoatRoughness:.18});materials.push(gold);
  const back=new THREE.MeshPhysicalMaterial({color:0xd7d7d7,metalness:.95,roughness:.16,reflectivity:.85,clearcoat:.4,clearcoatRoughness:.08});materials.push(back);
  const brushed=new THREE.MeshPhysicalMaterial({color:0xd2d2d2,metalness:.65,roughness:.42,reflectivity:.45,clearcoat:.1});materials.push(brushed);
  const pin=new THREE.MeshPhysicalMaterial({color:0xf0f0f0,metalness:.9,roughness:.22,reflectivity:.8,clearcoat:.2,clearcoatRoughness:.08});materials.push(pin);

  const visualCanvas=document.createElement("canvas");visualCanvas.width=1024;visualCanvas.height=1024;
  const bumpCanvas=document.createElement("canvas");bumpCanvas.width=1024;bumpCanvas.height=1024;
  const v=visualCanvas.getContext("2d"),b=bumpCanvas.getContext("2d");
  const lines=["SuzukiPM","1st","Chiba, Japan","2026.09.22"];
  if(v&&b){
   v.clearRect(0,0,1024,1024);v.textAlign="center";v.textBaseline="middle";
   b.fillStyle="#000";b.fillRect(0,0,1024,1024);b.fillStyle="#fff";b.textAlign="center";b.textBaseline="middle";
   const ys=[520,610,700,790],sizes=[68,56,52,50],weights=[650,620,540,500];
   lines.forEach((line,index)=>{
    let size=sizes[index],weight=weights[index];
    do{const font=weight+" "+size+'px Arial, "Helvetica Neue", sans-serif';v.font=font;b.font=font;if(v.measureText(line).width<=650)break;size-=2}while(size>30);
    const y=ys[index];v.fillStyle="rgba(255,255,255,.30)";v.fillText(line,512,y-2);v.fillStyle="rgba(66,66,66,.72)";v.fillText(line,512,y+1);b.fillText(line,512,y);
   });
   engravingVisualTexture=new THREE.CanvasTexture(visualCanvas);engravingVisualTexture.colorSpace=THREE.SRGBColorSpace;engravingVisualTexture.anisotropy=Math.min(renderer.capabilities.getMaxAnisotropy(),8);
   engravingBumpTexture=new THREE.CanvasTexture(bumpCanvas);engravingBumpTexture.colorSpace=THREE.NoColorSpace;engravingBumpTexture.anisotropy=Math.min(renderer.capabilities.getMaxAnisotropy(),8);
   back.bumpMap=engravingBumpTexture;back.bumpScale=-.016;back.needsUpdate=true;
  }

  const gltf=await new GLTFLoader().loadAsync("./models/medal_template_final.glb?v=7");
  if(token!==cleanRenderToken)return;
  const medal=gltf.scene;
  medal.traverse(o=>{
   if(o instanceof THREE.Camera||o instanceof THREE.Light){o.visible=false;return}
   if(!(o instanceof THREE.Mesh))return;
   if(o.name==="SplineSkyHdriBackground"){o.visible=false;return}
   if(o.name==="MedalBody")o.material=gold;
   else if(o.name==="back_shell")o.material=back;
   else if(o.name==="brushed_detail")o.material=brushed;
   else if(o.name==="pin_assembly")o.material=pin;
  });

  const backShell=medal.getObjectByName("back_shell");
  if(engravingVisualTexture&&backShell instanceof THREE.Mesh){
   backShell.geometry.computeBoundingBox();const bounds=backShell.geometry.boundingBox;
   if(bounds){
    const size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
    engravingOverlayGeometry=new THREE.PlaneGeometry(size.x*.84,size.y*.84);
    engravingOverlayMaterial=new THREE.MeshBasicMaterial({map:engravingVisualTexture,transparent:true,alphaTest:.02,depthTest:true,depthWrite:false,side:THREE.FrontSide,toneMapped:false});
    const engraving=new THREE.Mesh(engravingOverlayGeometry,engravingOverlayMaterial);engraving.position.set(center.x,center.y-size.y*.035,bounds.min.z-Math.max(size.z*.04,.35));engraving.rotation.y=Math.PI;engraving.renderOrder=1000;backShell.add(engraving);
   }
  }

  const front=medal.getObjectByName("FrontFace");
  if(front instanceof THREE.Mesh){
   const source=Array.isArray(front.material)?front.material[0]:front.material;
   const face=source&&source.clone?source.clone():new THREE.MeshPhysicalMaterial({color:0xffffff,metalness:0,roughness:.18,clearcoat:.25,clearcoatRoughness:.2});
   materials.push(face);face.color&&face.color.set(0xffffff);face.metalness=0;face.roughness=.18;face.clearcoat=.25;face.clearcoatRoughness=.2;
   const img=document.getElementById("stampZoomImg");const url=img&&(img.currentSrc||img.src)||"";
   if(url){try{faceTexture=await new THREE.TextureLoader().loadAsync(url);if(token!==cleanRenderToken){faceTexture.dispose();return}faceTexture.colorSpace=THREE.SRGBColorSpace;faceTexture.flipY=false;faceTexture.anisotropy=Math.min(renderer.capabilities.getMaxAnisotropy(),8);face.map=faceTexture;face.needsUpdate=true}catch(_){}}
   front.material=face;
  }

  const box=new THREE.Box3().setFromObject(medal),center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3());medal.position.sub(center);const max=Math.max(size.x,size.y,size.z);holder.scale.setScalar(max>0?1.75/max:1);holder.add(medal);
  overlay.appendChild(renderer.domElement);
  const resize=()=>{const w=Math.max(1,stamp3d.clientWidth),h=Math.max(1,stamp3d.clientHeight);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix()};resize();observer=new ResizeObserver(resize);observer.observe(stamp3d);
  const animate=()=>{if(stopped)return;controls.update();renderer.render(scene,camera);frameId=requestAnimationFrame(animate)};animate();

  await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
  if(token!==cleanRenderToken)return;
  overlay.classList.add("ready");
  stamp3d.querySelectorAll(":scope>canvas").forEach(c=>{c.style.opacity="0";c.style.pointerEvents="none"});

  cleanRendererCleanup=()=>{
   stopped=true;cancelAnimationFrame(frameId);observer&&observer.disconnect();controls&&controls.dispose();faceTexture&&faceTexture.dispose();engravingOverlayGeometry&&engravingOverlayGeometry.dispose();engravingOverlayMaterial&&engravingOverlayMaterial.dispose();engravingVisualTexture&&engravingVisualTexture.dispose();engravingBumpTexture&&engravingBumpTexture.dispose();materials.forEach(m=>{try{m.dispose()}catch(_){}});environment&&environment.dispose();pmrem&&pmrem.dispose();renderer&&renderer.dispose();overlay.remove();
  };
 }catch(err){
  console.warn("Suzuki clean 3D failed",err);overlay.remove();
 }
}

function inspect(){
 if(observerBusy)return;observerBusy=true;queueMicrotask(()=>{
  observerBusy=false;
  const root=document.getElementById("szReal");
  if(root){
   const ritualVisible=root.querySelector(".srB")&&getComputedStyle(root).display!=="none";
   if(ritualVisible&&!root.querySelector(".srCard"))resetForNewRitual();
   if(root.querySelector(".srCard.forge")){forgeSeen=true;if(state==="normal")state="burned"}
  }
  if(forgeSeen&&state==="burned"&&specialRootHidden()&&suzukiDetailOpen())insertCleanupButton();
  const modal=document.getElementById("stampModalBack");
  if(modal&&!modal.classList.contains("show")&&(state==="clean"||state==="burned"||state==="cleaning")){
   removeCleanupUi();disposeCleanRenderer();state="normal";forgeSeen=false;
  }
 });
}

const mo=new MutationObserver(inspect);mo.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:["class","style"]});
document.addEventListener("click",()=>setTimeout(inspect,0),true);
window.CASuzukiCleanup={version:"detail-cleanup-20260923-2320",get state(){return state},reset:resetForNewRitual};
})();