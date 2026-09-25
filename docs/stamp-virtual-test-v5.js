(function(){
"use strict";
const STORE_PREFIX="ca-clover-virtual-stamps-v1:";
const SUPABASE_URL="https://wgiittrvgtiosogyhfcl.supabase.co";
let scheduled=false;
let activeVirtual=null;
let virtual3dCleanup=null;
let virtual3dToken=0;
let virtual3dKey="";

function loadVirtual(){
 const all=[];
 try{
  for(let i=0;i<localStorage.length;i++){
   const key=localStorage.key(i)||"";
   if(!key.startsWith(STORE_PREFIX))continue;
   const value=JSON.parse(localStorage.getItem(key)||"[]");
   if(Array.isArray(value))all.push(...value);
  }
 }catch(_){return[]}
 const seen=new Set();
 return all.filter(x=>{
  if(!x||!x.ca_member_id||!x.community_id)return false;
  const k=String(x.ca_member_id)+"|"+String(x.community_id);
  if(seen.has(k))return false;
  seen.add(k);
  return true;
 });
}
function clearVirtual(){
 const keys=[];
 for(let i=0;i<localStorage.length;i++){
  const key=localStorage.key(i)||"";
  if(key.startsWith(STORE_PREFIX))keys.push(key);
 }
 keys.forEach(key=>localStorage.removeItem(key));
}
function style(){
 if(document.getElementById("ca-vt-style"))return;
 const s=document.createElement("style");
 s.id="ca-vt-style";
 s.textContent=`
.ca-vt-link{display:block!important;margin-top:12px!important;text-align:center!important;border:1px dashed #d8b873!important;background:#fff8df!important;color:#82601c!important}
.ca-vt-banner{margin:0 0 14px;border:1px solid #e9c978;border-radius:20px;background:#fff8df;padding:12px 14px;display:flex;align-items:center;gap:10px;color:#73551e}
.ca-vt-banner .grow{flex:1}.ca-vt-reset{border:0;border-radius:999px;background:#fff;color:#8b651e;padding:7px 10px;font-size:9px;font-weight:950}
.ca-vt-owned .medal{outline:2px solid rgba(214,166,62,.32);outline-offset:2px}.ca-vt-chip{display:inline-block;margin-top:4px;border-radius:999px;background:#fff2bf;color:#8a641d;padding:2px 6px;font-size:7px;font-weight:950}
.ca-vt-modal-badge{display:inline-block;margin-top:8px;border-radius:999px;background:#fff2bf;color:#8a641d;padding:5px 10px;font-size:9px;font-weight:950}
.ca-vt-modal-note{margin-top:12px;border:1px solid #efd18c;border-radius:18px;background:#fff8df;padding:11px 12px;text-align:left;font-size:10px;line-height:1.55;font-weight:850;color:#76571d}
.ca-vt-switches{display:flex;flex-wrap:wrap;gap:7px;justify-content:center;margin-top:10px}
.ca-vt-switch{font-size:10px!important;padding:8px 10px!important}
.ca-vt-switch.active{background:#fff2bf!important;color:#8a641d!important;border-color:#dfbe61!important}
`;
 document.head.appendChild(s);
}
function installExchange(){
 if(!/(?:^|\/)stamp-exchange\.html$/.test(location.pathname))return;
 style();
 const app=document.getElementById("app");
 if(!app)return;
 const add=()=>{
  if(app.querySelector(".ca-vt-link"))return;
  const grid=app.querySelector(":scope > .grid");
  if(!grid||document.getElementById("qr")||app.querySelector(".person"))return;
  const a=document.createElement("a");
  a.className="btn ca-vt-link";
  a.href="./stamp-test.html";
  a.textContent="🧪 仮想交換（ADMIN）";
  grid.insertAdjacentElement("afterend",a);
 };
 add();
 new MutationObserver(add).observe(app,{childList:true,subtree:true});
}
function norm(v){return String(v||"").replace(/^[●○]\s*/,"").trim().normalize("NFKC").toLowerCase()}
function banner(items){
 const wrap=document.querySelector("main.wrap");
 if(!wrap)return;
 let b=document.getElementById("caVtBanner");
 if(!b){
  b=document.createElement("div");
  b.id="caVtBanner";
  b.className="ca-vt-banner";
  b.innerHTML='<div>🧪</div><div><strong>仮想交換テスト中</strong><div id="caVtCount" style="font-size:9px;font-weight:800;margin-top:2px"></div></div><div class="grow"></div><button class="ca-vt-reset" type="button">リセット</button>';
  const hero=wrap.querySelector(".hero");
  if(hero)wrap.insertBefore(b,hero);else wrap.prepend(b);
  b.querySelector(".ca-vt-reset").onclick=()=>{clearVirtual();location.reload()};
 }
 const c=b.querySelector("#caVtCount"),t="正式記録ではありません ・ "+items.length+"件";
 if(c&&c.textContent!==t)c.textContent=t;
}
function applyCounts(items){
 const total=document.getElementById("totalScore");
 if(total){
  if(!total.dataset.caVtBase){
   const m=String(total.textContent||"").match(/(\d+)\s*\/\s*(\d+)/);
   if(m){total.dataset.caVtBase=m[1];total.dataset.caVtTotal=m[2]}
  }
  const base=Number(total.dataset.caVtBase||0),den=Number(total.dataset.caVtTotal||0),target=Math.min(den,base+items.length),m=String(total.textContent||"").match(/(\d+)\s*\/\s*(\d+)/);
  if(den&&(!m||Number(m[1])!==target||Number(m[2])!==den))total.innerHTML=target+' <span>/ '+den+'</span>';
 }
 const byPref=new Map();
 items.forEach(x=>{const p=String(x.prefecture||"");if(p)byPref.set(p,(byPref.get(p)||0)+1)});
 document.querySelectorAll(".pref").forEach(el=>{
  const name=el.querySelector(".prefname")?.textContent.trim()||"",extra=byPref.get(name)||0;
  if(!extra)return;
  const p=el.querySelector(".progress");
  if(!p)return;
  if(!p.dataset.caVtBase){
   const m=String(p.textContent||"").match(/取得\s*(\d+)\s*\/\s*(\d+)/);
   if(m){p.dataset.caVtBase=m[1];p.dataset.caVtTotal=m[2]}
  }
  const base=Number(p.dataset.caVtBase||0),den=Number(p.dataset.caVtTotal||0),target=Math.min(den,base+extra),text="取得 "+target+" / "+den;
  if(den&&p.textContent!==text)p.textContent=text;
 });
}
function itemsForCommunity(id){
 return loadVirtual().filter(x=>String(x.community_id)===String(id));
}
function virtualKey(item){
 return item?String(item.ca_member_id)+"|"+String(item.community_id)+"|"+String(item.acquired_at||""):"";
}
function prefectureEnglishLabel(value){
 const map={
  "北海道":"Hokkaido","青森県":"Aomori","岩手県":"Iwate","宮城県":"Miyagi","秋田県":"Akita","山形県":"Yamagata","福島県":"Fukushima",
  "茨城県":"Ibaraki","栃木県":"Tochigi","群馬県":"Gunma","埼玉県":"Saitama","千葉県":"Chiba","東京都":"Tokyo","神奈川県":"Kanagawa",
  "新潟県":"Niigata","富山県":"Toyama","石川県":"Ishikawa","福井県":"Fukui","山梨県":"Yamanashi","長野県":"Nagano","岐阜県":"Gifu",
  "静岡県":"Shizuoka","愛知県":"Aichi","三重県":"Mie","滋賀県":"Shiga","京都府":"Kyoto","大阪府":"Osaka","兵庫県":"Hyogo",
  "奈良県":"Nara","和歌山県":"Wakayama","鳥取県":"Tottori","島根県":"Shimane","岡山県":"Okayama","広島県":"Hiroshima","山口県":"Yamaguchi",
  "徳島県":"Tokushima","香川県":"Kagawa","愛媛県":"Ehime","高知県":"Kochi","福岡県":"Fukuoka","佐賀県":"Saga","長崎県":"Nagasaki",
  "熊本県":"Kumamoto","大分県":"Oita","宮崎県":"Miyazaki","鹿児島県":"Kagoshima","沖縄県":"Okinawa"
 };
 const p=map[String(value||"")]||String(value||"").replace(/[都道府県]$/,'');
 return p?p+", Japan":"Japan";
}
function testDate(value){
 const d=value?new Date(value):new Date();
 if(Number.isNaN(d.getTime()))return"";
 return d.toLocaleDateString("ja-JP");
}
function unmountVirtualMedal3D(){
 virtual3dToken++;
 virtual3dKey="";
 if(virtual3dCleanup){try{virtual3dCleanup()}catch(_){}virtual3dCleanup=null}
 const box=document.getElementById("stamp3d");
 if(box){box.classList.remove("show");box.innerHTML=""}
 const zoom=document.getElementById("stampZoom2D");
 if(zoom)zoom.classList.remove("hidden");
}
function publicThumb(item){
 if(!item?.avatar_thumbnail_path)return"";
 const path=String(item.avatar_thumbnail_path).split("/").map(encodeURIComponent).join("/");
 return SUPABASE_URL+"/storage/v1/object/public/community-icon-thumbs/"+path;
}
async function mountVirtualMedal3D(item){
 if(!item)return;
 const container=document.getElementById("stamp3d");
 const zoom=document.getElementById("stampZoom2D");
 const zoomImg=document.getElementById("stampZoomImg");
 if(!container||!zoom)return;
 const key=virtualKey(item);
 if(virtual3dKey===key&&container.classList.contains("show"))return;
 unmountVirtualMedal3D();
 virtual3dKey=key;
 const token=++virtual3dToken;
 container.classList.add("show");
 zoom.classList.add("hidden");
 container.innerHTML='<div style="position:absolute;inset:0;display:grid;place-items:center;font-size:11px;font-weight:900;color:#8a6d51">3Dメダルを準備中... 🪙</div>';
 try{
  const THREE=await import("three");
  const [{OrbitControls},{RoomEnvironment},{GLTFLoader}]=await Promise.all([
   import("three/addons/controls/OrbitControls.js"),
   import("three/addons/environments/RoomEnvironment.js"),
   import("three/addons/loaders/GLTFLoader.js")
  ]);
  if(token!==virtual3dToken)return;

  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:false});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.04;

  const scene=new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff,0x6f685f,1.7));
  const keyLight=new THREE.DirectionalLight(0xffffff,3.1);
  keyLight.position.set(2.4,3.2,4.2);
  scene.add(keyLight);
  const rimLight=new THREE.DirectionalLight(0xffe5b4,1.6);
  rimLight.position.set(-3.2,.8,-2.4);
  scene.add(rimLight);
  const backFillLight=new THREE.DirectionalLight(0xffffff,.72);
  backFillLight.position.set(.35,1.15,-4.2);
  scene.add(backFillLight);
  const pmrem=new THREE.PMREMGenerator(renderer);
  const room=new RoomEnvironment();
  const environment=pmrem.fromScene(room,.04).texture;
  scene.environment=environment;
  room.dispose();

  const camera=new THREE.PerspectiveCamera(28,1,.01,100);
  camera.position.set(0,.03,4.10);
  const controls=new OrbitControls(camera,renderer.domElement);
  controls.enableDamping=true;
  controls.dampingFactor=.06;
  controls.enablePan=false;
  controls.enableZoom=false;
  controls.rotateSpeed=.55;
  controls.autoRotate=true;
  controls.autoRotateSpeed=1.35;
  controls.target.set(0,0,0);

  const holder=new THREE.Group();
  scene.add(holder);

  const gltf=await new GLTFLoader().loadAsync("./models/medal_template_final.glb?v=7");
  if(token!==virtual3dToken){
   controls.dispose();environment.dispose();pmrem.dispose();renderer.dispose();
   return;
  }
  const medal=gltf.scene;
  let front=null,backShell=null;
  const goldMaterial=new THREE.MeshPhysicalMaterial({color:0xe3bd6a,metalness:.72,roughness:.24,clearcoat:.38,clearcoatRoughness:.2});
  const backMaterial=new THREE.MeshPhysicalMaterial({color:0xc8c8c5,metalness:.82,roughness:.34});
  const brushedMaterial=new THREE.MeshPhysicalMaterial({color:0xb9bab8,metalness:.9,roughness:.43});
  const pinMaterial=new THREE.MeshPhysicalMaterial({color:0xb8bab9,metalness:.94,roughness:.25});

  medal.traverse(object=>{
   if(object instanceof THREE.Camera||object instanceof THREE.Light){object.visible=false;return}
   if(!(object instanceof THREE.Mesh))return;
   if(object.name==="SplineSkyHdriBackground"){object.visible=false;return}
   if(object.name==="MedalBody")object.material=goldMaterial;
   else if(object.name==="back_shell"){object.material=backMaterial;backShell=object}
   else if(object.name==="brushed_detail")object.material=brushedMaterial;
   else if(object.name==="pin_assembly")object.material=pinMaterial;
   else if(object.name==="FrontFace")front=object;
  });

  let activeFaceMaterial=null;
  let faceTexture=null;
  if(front instanceof THREE.Mesh){
   const source=Array.isArray(front.material)?front.material[0]:front.material;
   activeFaceMaterial=source instanceof THREE.MeshPhysicalMaterial
    ?source.clone()
    :source instanceof THREE.MeshStandardMaterial
     ?new THREE.MeshPhysicalMaterial({
       color:source.color.clone(),
       metalness:source.metalness,
       roughness:source.roughness,
       side:source.side,
       transparent:source.transparent,
       opacity:source.opacity
      })
     :new THREE.MeshPhysicalMaterial();
   activeFaceMaterial.color.set(0xffffff);
   activeFaceMaterial.metalness=0;
   activeFaceMaterial.roughness=.18;
   activeFaceMaterial.clearcoat=.25;
   activeFaceMaterial.clearcoatRoughness=.2;
   const loader=new THREE.TextureLoader();
   const candidates=[publicThumb(item),item.avatar_url,zoomImg?.currentSrc,zoomImg?.src].filter((v,i,a)=>v&&a.indexOf(v)===i);
   for(const url of candidates){
    try{
     const texture=await loader.loadAsync(url);
     if(token!==virtual3dToken){texture.dispose();return}
     texture.colorSpace=THREE.SRGBColorSpace;
     texture.flipY=false;
     texture.anisotropy=Math.min(renderer.capabilities.getMaxAnisotropy(),8);
     faceTexture=texture;
     activeFaceMaterial.map=texture;
     activeFaceMaterial.needsUpdate=true;
     front.material=activeFaceMaterial;
     break;
    }catch(_){}
   }
  }

  let engravingTexture=null,engravingMaterial=null,engravingGeometry=null;
  if(backShell instanceof THREE.Mesh){
   const canvas=document.createElement("canvas");
   canvas.width=1024;canvas.height=1024;
   const ctx=canvas.getContext("2d");
   if(ctx){
    ctx.clearRect(0,0,1024,1024);
    ctx.textAlign="center";
    ctx.textBaseline="middle";
    const lines=[
     String(item.trainer_name||""),
     String(item.ca_level||"CA"),
     prefectureEnglishLabel(item.prefecture),
     testDate(item.acquired_at)
    ];
    const ys=[520,610,700,790],sizes=[68,56,52,50],weights=[650,620,540,500];
    lines.forEach((line,index)=>{
     let size=sizes[index]||50,weight=weights[index]||500;
     do{
      ctx.font=weight+" "+size+'px Arial, "Helvetica Neue", sans-serif';
      if(ctx.measureText(line).width<=650)break;
      size-=2;
     }while(size>30);
     const y=ys[index]||790;
     ctx.fillStyle="rgba(255,255,255,.30)";
     ctx.fillText(line,512,y-2);
     ctx.fillStyle="rgba(66,66,66,.78)";
     ctx.fillText(line,512,y+1);
    });
    engravingTexture=new THREE.CanvasTexture(canvas);
    engravingTexture.colorSpace=THREE.SRGBColorSpace;
    engravingTexture.anisotropy=Math.min(renderer.capabilities.getMaxAnisotropy(),8);
    backShell.geometry.computeBoundingBox();
    const bounds=backShell.geometry.boundingBox;
    if(bounds){
     const shellSize=bounds.getSize(new THREE.Vector3());
     const shellCenter=bounds.getCenter(new THREE.Vector3());
     engravingGeometry=new THREE.PlaneGeometry(shellSize.x*.84,shellSize.y*.84);
     engravingMaterial=new THREE.MeshBasicMaterial({map:engravingTexture,transparent:true,alphaTest:.02,depthTest:true,depthWrite:false,side:THREE.FrontSide,toneMapped:false});
     const overlay=new THREE.Mesh(engravingGeometry,engravingMaterial);
     overlay.position.set(shellCenter.x,shellCenter.y-shellSize.y*.035,bounds.min.z-Math.max(shellSize.z*.04,.35));
     overlay.rotation.y=Math.PI;
     overlay.renderOrder=1000;
     backShell.add(overlay);
    }
   }
  }

  const box=new THREE.Box3().setFromObject(medal);
  const center=box.getCenter(new THREE.Vector3());
  const size=box.getSize(new THREE.Vector3());
  medal.position.sub(center);
  const maxDimension=Math.max(size.x,size.y,size.z);
  holder.scale.setScalar(maxDimension>0?1.75/maxDimension:1);
  holder.add(medal);

  container.innerHTML="";
  container.appendChild(renderer.domElement);
  const resize=()=>{
   const width=Math.max(1,container.clientWidth),height=Math.max(1,container.clientHeight);
   renderer.setSize(width,height,false);
   camera.aspect=width/height;
   camera.updateProjectionMatrix();
  };
  resize();
  const observer=new ResizeObserver(resize);
  observer.observe(container);

  let stopped=false,frameId=0;
  const animate=()=>{
   if(stopped)return;
   controls.update();
   renderer.render(scene,camera);
   frameId=requestAnimationFrame(animate);
  };
  animate();

  virtual3dCleanup=()=>{
   stopped=true;
   cancelAnimationFrame(frameId);
   observer.disconnect();
   controls.dispose();
   faceTexture?.dispose();
   engravingTexture?.dispose();
   engravingMaterial?.dispose();
   engravingGeometry?.dispose();
   activeFaceMaterial?.dispose();
   goldMaterial.dispose();backMaterial.dispose();brushedMaterial.dispose();pinMaterial.dispose();
   environment.dispose();pmrem.dispose();renderer.dispose();
   renderer.domElement.remove();
  };
 }catch(err){
  console.error("Virtual 3D medal preview failed",err);
  if(token!==virtual3dToken)return;
  virtual3dKey="";
  container.classList.remove("show");
  container.innerHTML="";
  zoom.classList.remove("hidden");
 }
}
function patchModal(item){
 if(!item)return;
 const back=document.getElementById("stampModalBack");
 if(!back||!back.classList.contains("show"))return;
 const title=document.getElementById("stampZoomTitle");
 const area=document.getElementById("stampZoomArea");
 const zoom=document.getElementById("stampZoom2D");
 const img=document.getElementById("stampZoomImg");
 const controls=document.getElementById("stampDesignControls");
 if(zoom)zoom.classList.remove("unowned");
 if(title&&item.community_name&&title.textContent!==item.community_name)title.textContent=item.community_name;
 const areaText=[item.prefecture||"",(item.ca_level||"CA")+" ・ "+(item.trainer_name||""),"取得済み（TEST）"].filter(Boolean).join("\n");
 if(area&&area.textContent!==areaText){
  area.textContent=areaText;
  area.style.whiteSpace="pre-line";
 }
 if(img){
  img.style.display="block";
  img.style.filter="none";
  img.style.opacity="1";
  const src=publicThumb(item)||item.avatar_url||"";
  if(src&&img.src!==src)img.src=src;
 }
 void mountVirtualMedal3D(item);
 if(controls){
  const d=item.acquired_at?new Date(item.acquired_at):new Date();
  const date=Number.isNaN(d.getTime())?"":d.toLocaleDateString("ja-JP");
  const sameCommunity=itemsForCommunity(item.community_id);
  const switches=sameCommunity.length>1
   ?'<div class="ca-vt-switches">'+sameCommunity.map(x=>'<button type="button" class="btn ca-vt-switch '+(String(x.ca_member_id)===String(item.ca_member_id)?'active':'')+'" data-ca-vt-switch="'+String(x.ca_member_id).replace(/"/g,"&quot;")+'">'+String(x.ca_level||"CA").replace(/[<>&"]/g,"")+" ・ "+String(x.trainer_name||"").replace(/[<>&"]/g,"")+'</button>').join("")+'</div>'
   :"";
  const html=switches+'<div class="ca-vt-modal-badge">🧪 TEST取得済み</div><div class="ca-vt-modal-note">仮想交換で取得した表示です。正式な取得履歴には保存されていません。'+(date?'<br>テスト取得日: '+date:'')+'</div>';
  if(controls.dataset.caVtPatched!==String(item.ca_member_id)||controls.innerHTML!==html){
   controls.innerHTML=html;
   controls.dataset.caVtPatched=String(item.ca_member_id);
   controls.querySelectorAll("[data-ca-vt-switch]").forEach(button=>button.onclick=()=>{
    const next=sameCommunity.find(x=>String(x.ca_member_id)===String(button.dataset.caVtSwitch));
    if(!next)return;
    activeVirtual=next;
    virtual3dKey="";
    patchModal(next);
   });
  }
 }
}
function apply(){
 if(!/(?:^|\/)stamp-rally\.html$/.test(location.pathname))return;
 const items=loadVirtual();
 if(!items.length)return;
 style();
 banner(items);
 for(const item of items){
  const btn=Array.from(document.querySelectorAll('.stamp[data-community]')).find(x=>x.dataset.community===String(item.community_id));
  if(!btn)continue;
  const medal=btn.querySelector(".medal");
  if(medal&&medal.classList.contains("unowned"))medal.classList.remove("unowned");
  if(!btn.classList.contains("ca-vt-owned"))btn.classList.add("ca-vt-owned");
  const row=Array.from(btn.querySelectorAll(".caname")).find(x=>norm(x.textContent)===norm(item.trainer_name));
  if(row){
   if(row.classList.contains("off"))row.classList.remove("off");
   if(!row.classList.contains("on"))row.classList.add("on");
   const txt="● "+String(item.trainer_name||"");
   if(row.textContent!==txt)row.textContent=txt;
  }
  if(!btn.querySelector(".ca-vt-chip")){
   const name=btn.querySelector(".cname");
   if(name){const chip=document.createElement("span");chip.className="ca-vt-chip";chip.textContent="TEST";name.insertAdjacentElement("afterend",chip)}
  }
 }
 applyCounts(items);
}
function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;apply()})}
function installRally(){
 if(!/(?:^|\/)stamp-rally\.html$/.test(location.pathname))return;
 style();
 document.addEventListener("click",ev=>{
  const target=ev.target&&ev.target.closest?ev.target.closest('.stamp[data-community]'):null;
  if(target){
   const items=itemsForCommunity(target.dataset.community);
   activeVirtual=items[0]||null;
   if(activeVirtual){
    virtual3dKey="";
    setTimeout(()=>patchModal(activeVirtual),0);
    setTimeout(()=>patchModal(activeVirtual),90);
   }else{
    unmountVirtualMedal3D();
   }
   return;
  }
  const close=ev.target&&ev.target.closest?ev.target.closest("#stampClose"):null;
  const back=document.getElementById("stampModalBack");
  if(close||(back&&ev.target===back)){
   activeVirtual=null;
   unmountVirtualMedal3D();
  }
 },true);
 schedule();
 const regions=document.getElementById("regions");
 if(regions){
  const observer=new MutationObserver(schedule);
  observer.observe(regions,{childList:true,subtree:true});
 }
}
function start(){installExchange();installRally()}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});else start();
})();