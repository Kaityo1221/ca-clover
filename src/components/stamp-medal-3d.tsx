"use client";

import { useEffect, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

type StampMedal3DProps = {
  supabase?: SupabaseClient;
  imageUrl?: string | null;
  fallbackImageUrl?: string | null;
  thumbnailPath?: string | null;
  archivePath?: string | null;
  engravingLines?: readonly string[] | null;
  className?: string;
};

function disposeObject(root: THREE.Object3D) {
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.geometry?.dispose();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      if (!material) continue;
      const candidate = material as THREE.MeshStandardMaterial;
      candidate.map?.dispose();
      candidate.bumpMap?.dispose();
      material.dispose();
    }
  });
}

export function StampMedal3D({
  supabase,
  imageUrl,
  fallbackImageUrl,
  thumbnailPath,
  archivePath,
  engravingLines,
  className = "",
}: StampMedal3DProps) {
  const engravingKey=(engravingLines??[])
    .map(value=>String(value??"").trim())
    .filter(Boolean)
    .slice(0,4)
    .join("\n");
  const mountRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let disposed = false;
    let frameId = 0;
    let medal: THREE.Object3D | null = null;
    let faceTexture: THREE.Texture | null = null;
    let faceObjectUrl: string | null = null;
    let engravingVisualTexture: THREE.CanvasTexture | null = null;
    let engravingBumpTexture: THREE.CanvasTexture | null = null;

    setReady(false);
    setFailed(false);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(28, 1, 0.01, 100);
    camera.position.set(0, 0.03, 4.10);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.92;
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.display = "block";
    renderer.domElement.style.touchAction = "none";
    mount.appendChild(renderer.domElement);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    const environment = pmrem.fromScene(room, 0.04).texture;
    room.dispose();
    scene.environment = environment;

    scene.add(new THREE.HemisphereLight(0xffffff, 0x6f685f, 1.7));
    const keyLight = new THREE.DirectionalLight(0xffffff, 3.1);
    keyLight.position.set(2.4, 3.2, 4.2);
    scene.add(keyLight);
    const rimLight = new THREE.DirectionalLight(0xffe5b4, 1.6);
    rimLight.position.set(-3.2, 0.8, -2.4);
    scene.add(rimLight);

    // Keep the back readable head-on without flattening the metallic glint.
    const backFillLight = new THREE.DirectionalLight(0xffffff, 0.72);
    backFillLight.position.set(0.35, 1.15, -4.2);
    scene.add(backFillLight);

    const holder = new THREE.Group();
    holder.rotation.x = -0.055;
    holder.rotation.y = 0.22;
    scene.add(holder);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.enablePan = false;
    controls.enableZoom = false;
    controls.rotateSpeed = 0.55;
    controls.target.set(0, 0, 0);

    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
    controls.autoRotate = !reduceMotion;
    controls.autoRotateSpeed = 1.15;

    const goldMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xb8922e,
      metalness: 0.95,
      roughness: 0.34,
      reflectivity: 0.52,
      clearcoat: 0.08,
      clearcoatRoughness: 0.18,
    });
    const faceMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      metalness: 0,
      roughness: 0.18,
      reflectivity: 0.38,
      clearcoat: 0.25,
      clearcoatRoughness: 0.2,
    });
    const backMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xd7d7d7,
      metalness: 0.95,
      roughness: 0.16,
      reflectivity: 0.85,
      clearcoat: 0.4,
      clearcoatRoughness: 0.08,
    });
    const brushedMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xd2d2d2,
      metalness: 0.65,
      roughness: 0.42,
      reflectivity: 0.45,
      clearcoat: 0.1,
    });
    const pinMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xf0f0f0,
      metalness: 0.9,
      roughness: 0.22,
      reflectivity: 0.8,
      clearcoat: 0.2,
      clearcoatRoughness: 0.08,
    });

    if (engravingKey) {
      const visualCanvas=document.createElement("canvas");
      visualCanvas.width=1024;
      visualCanvas.height=1024;
      const bumpCanvas=document.createElement("canvas");
      bumpCanvas.width=1024;
      bumpCanvas.height=1024;
      const visualCtx=visualCanvas.getContext("2d");
      const bumpCtx=bumpCanvas.getContext("2d");
      if(visualCtx&&bumpCtx){
        visualCtx.clearRect(0,0,visualCanvas.width,visualCanvas.height);
        visualCtx.textAlign="center";
        visualCtx.textBaseline="middle";

        bumpCtx.fillStyle="#000";
        bumpCtx.fillRect(0,0,bumpCanvas.width,bumpCanvas.height);
        bumpCtx.fillStyle="#fff";
        bumpCtx.textAlign="center";
        bumpCtx.textBaseline="middle";

        const lines=engravingKey.split("\n");
        const isTemporarySuzukiBurn=lines[0]?.toLowerCase()==="suzukipm";

        // TEMP: SuzukiPM-only dragon-fire scorch. Remove this branch after the joke event.
        if(isTemporarySuzukiBurn){
          visualCtx.save();
          visualCtx.translate(500,650);
          visualCtx.rotate(-0.20);
          visualCtx.scale(1.75,0.78);
          const heat=visualCtx.createRadialGradient(-40,-10,12,-10,0,250);
          heat.addColorStop(0,"rgba(255,118,24,0.26)");
          heat.addColorStop(0.24,"rgba(177,57,9,0.22)");
          heat.addColorStop(0.58,"rgba(74,30,10,0.22)");
          heat.addColorStop(0.82,"rgba(34,18,10,0.16)");
          heat.addColorStop(1,"rgba(20,12,8,0)");
          visualCtx.fillStyle=heat;
          visualCtx.beginPath();
          visualCtx.arc(0,0,250,0,Math.PI*2);
          visualCtx.fill();
          visualCtx.restore();

          visualCtx.save();
          visualCtx.lineCap="round";
          visualCtx.lineJoin="round";
          visualCtx.shadowBlur=26;
          visualCtx.shadowColor="rgba(255,82,12,0.34)";
          visualCtx.strokeStyle="rgba(84,30,7,0.34)";
          visualCtx.lineWidth=48;
          visualCtx.beginPath();
          visualCtx.moveTo(155,390);
          visualCtx.bezierCurveTo(300,445,330,565,520,620);
          visualCtx.bezierCurveTo(650,658,760,694,858,770);
          visualCtx.stroke();
          visualCtx.strokeStyle="rgba(255,101,18,0.20)";
          visualCtx.lineWidth=18;
          visualCtx.beginPath();
          visualCtx.moveTo(150,383);
          visualCtx.bezierCurveTo(305,438,350,548,525,606);
          visualCtx.bezierCurveTo(670,654,758,683,866,755);
          visualCtx.stroke();
          visualCtx.restore();

          const scorchMarks=[
            [318,520,64,0.20],[405,596,88,0.16],[532,655,108,0.14],
            [646,710,74,0.17],[724,758,54,0.15],[268,456,38,0.18]
          ];
          for(const [x,y,r,a] of scorchMarks){
            const scorch=visualCtx.createRadialGradient(x,y,0,x,y,r);
            scorch.addColorStop(0,"rgba(47,20,8,"+a+")");
            scorch.addColorStop(0.62,"rgba(93,36,7,"+(a*0.62)+")");
            scorch.addColorStop(1,"rgba(93,36,7,0)");
            visualCtx.fillStyle=scorch;
            visualCtx.beginPath();
            visualCtx.arc(x,y,r,0,Math.PI*2);
            visualCtx.fill();
          }
        }

        const yPositions=[520,610,700,790];
        const baseSizes=[68,56,52,50];
        const weights=[650,620,540,500];
        lines.forEach((line,index)=>{
          let fontSize=baseSizes[index]??50;
          const weight=weights[index]??500;
          do{
            const font=weight+" "+fontSize+'px Arial, "Helvetica Neue", sans-serif';
            visualCtx.font=font;
            bumpCtx.font=font;
            if(visualCtx.measureText(line).width<=650) break;
            fontSize-=2;
          }while(fontSize>30);
          const y=yPositions[index]??790;
          if(isTemporarySuzukiBurn){
            visualCtx.shadowBlur=10;
            visualCtx.shadowColor="rgba(255,83,12,0.38)";
            visualCtx.fillStyle="rgba(255,164,72,0.26)";
            visualCtx.fillText(line,512,y-2);
            visualCtx.shadowBlur=0;
            visualCtx.fillStyle="rgba(36,15,6,0.88)";
            visualCtx.fillText(line,512,y+2);
          }else{
            visualCtx.fillStyle="rgba(255,255,255,0.30)";
            visualCtx.fillText(line,512,y-2);
            visualCtx.fillStyle="rgba(66,66,66,0.72)";
            visualCtx.fillText(line,512,y+1);
          }
          bumpCtx.fillText(line,512,y);
        });

        engravingVisualTexture=new THREE.CanvasTexture(visualCanvas);
        engravingVisualTexture.colorSpace=THREE.SRGBColorSpace;
        engravingVisualTexture.anisotropy=Math.min(renderer.capabilities.getMaxAnisotropy(),8);

        engravingBumpTexture=new THREE.CanvasTexture(bumpCanvas);
        engravingBumpTexture.colorSpace=THREE.NoColorSpace;
        engravingBumpTexture.anisotropy=Math.min(renderer.capabilities.getMaxAnisotropy(),8);

        backMaterial.bumpMap=engravingBumpTexture;
        backMaterial.bumpScale=-0.016;
        backMaterial.needsUpdate=true;
      }
    }

    async function applyFaceTexture(model: THREE.Object3D) {
      const front = model.getObjectByName("FrontFace");
      if (!(front instanceof THREE.Mesh)) return;

      const existing = Array.isArray(front.material) ? front.material[0] : front.material;
      const activeFaceMaterial =
        existing instanceof THREE.MeshPhysicalMaterial
          ? existing.clone()
          : existing instanceof THREE.MeshStandardMaterial
            ? new THREE.MeshPhysicalMaterial({
                color: existing.color.clone(),
                metalness: existing.metalness,
                roughness: existing.roughness,
                side: existing.side,
                transparent: existing.transparent,
                opacity: existing.opacity,
              })
            : faceMaterial.clone();

      activeFaceMaterial.color.set(0xffffff);
      activeFaceMaterial.metalness = 0;
      activeFaceMaterial.roughness = 0.18;
      activeFaceMaterial.clearcoat = 0.25;
      activeFaceMaterial.clearcoatRoughness = 0.2;

      const loader = new THREE.TextureLoader();

      const applyTexture = async (candidate: string) => {
        try {
          const texture = await loader.loadAsync(candidate);
          if (disposed) {
            texture.dispose();
            return false;
          }
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.flipY = false;
          texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
          faceTexture = texture;
          activeFaceMaterial.map = texture;
          activeFaceMaterial.needsUpdate = true;
          front.material = activeFaceMaterial;
          return true;
        } catch {
          return false;
        }
      };

      if (supabase && thumbnailPath) {
        try {
          const downloaded = await supabase.storage.from("community-icon-thumbs").download(thumbnailPath);
          if (!downloaded.error && downloaded.data && !disposed) {
            faceObjectUrl = URL.createObjectURL(downloaded.data);
            if (await applyTexture(faceObjectUrl)) return;
            URL.revokeObjectURL(faceObjectUrl);
            faceObjectUrl = null;
          }
        } catch {
          // Try the next source.
        }
      }

      if (supabase && archivePath) {
        try {
          const downloaded = await supabase.storage.from("community-icon-archive").download(archivePath);
          if (!downloaded.error && downloaded.data && !disposed) {
            faceObjectUrl = URL.createObjectURL(downloaded.data);
            if (await applyTexture(faceObjectUrl)) return;
            URL.revokeObjectURL(faceObjectUrl);
            faceObjectUrl = null;
          }
        } catch {
          // Try the next source.
        }
      }

      const candidates = [imageUrl, fallbackImageUrl].filter(
        (value, index, array): value is string => Boolean(value) && array.indexOf(value) === index,
      );
      for (const candidate of candidates) {
        if (await applyTexture(candidate)) return;
      }
    }

    new GLTFLoader().load(
      "/models/medal_template_final.glb?v=7",
      (gltf) => {
        if (disposed) {
          disposeObject(gltf.scene);
          return;
        }

        medal = gltf.scene;
        medal.traverse((object) => {
          if (object instanceof THREE.Camera || object instanceof THREE.Light) {
            object.visible = false;
            return;
          }
          if (!(object instanceof THREE.Mesh)) return;

          if (object.name === "SplineSkyHdriBackground") {
            object.visible = false;
            return;
          }

          if (object.name === "MedalBody") object.material = goldMaterial;
          else if (object.name === "back_shell") object.material = backMaterial;
          else if (object.name === "brushed_detail") object.material = brushedMaterial;
          else if (object.name === "pin_assembly") object.material = pinMaterial;
        });

        const backShell=medal.getObjectByName("back_shell");
        if(engravingVisualTexture&&backShell instanceof THREE.Mesh){
          backShell.geometry.computeBoundingBox();
          const bounds=backShell.geometry.boundingBox;
          if(bounds){
            const shellSize=bounds.getSize(new THREE.Vector3());
            const shellCenter=bounds.getCenter(new THREE.Vector3());
            const overlayGeometry=new THREE.PlaneGeometry(shellSize.x*0.84,shellSize.y*0.84);
            const overlayMaterial=new THREE.MeshBasicMaterial({
              map:engravingVisualTexture,
              transparent:true,
              alphaTest:0.02,
              depthTest:true,
              depthWrite:false,
              side:THREE.FrontSide,
              toneMapped:false,
            });
            const overlay=new THREE.Mesh(overlayGeometry,overlayMaterial);
            overlay.name="engraving_overlay";
            overlay.position.set(
              shellCenter.x,
              shellCenter.y-shellSize.y*0.035,
              bounds.min.z-Math.max(shellSize.z*0.04,0.35),
            );
            overlay.rotation.y=Math.PI;
            overlay.renderOrder=1000;
            backShell.add(overlay);
          }
        }

        void applyFaceTexture(medal);

        const box = new THREE.Box3().setFromObject(medal);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        medal.position.sub(center);

        const maxDimension = Math.max(size.x, size.y, size.z);
        const scale = maxDimension > 0 ? 1.75 / maxDimension : 1;
        holder.scale.setScalar(scale);
        holder.add(medal);

        setReady(true);
      },
      undefined,
      () => {
        if (!disposed) setFailed(true);
      },
    );

    const resize = () => {
      const width = Math.max(1, mount.clientWidth);
      const height = Math.max(1, mount.clientHeight);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mount);
    resize();

    const animate = () => {
      if (disposed) return;
      controls.update();
      renderer.render(scene, camera);
      frameId = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      controls.dispose();
      if (medal) disposeObject(medal);
      faceTexture?.dispose();
      engravingVisualTexture?.dispose();
      engravingBumpTexture?.dispose();
      if (faceObjectUrl) URL.revokeObjectURL(faceObjectUrl);
      goldMaterial.dispose();
      faceMaterial.dispose();
      backMaterial.dispose();
      brushedMaterial.dispose();
      pinMaterial.dispose();
      environment.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [archivePath, engravingKey, fallbackImageUrl, imageUrl, supabase, thumbnailPath]);

  return (
    <div className={"relative " + className}>
      <div ref={mountRef} className="absolute inset-0" />
      {!ready && !failed ? (
        <div className="absolute inset-0 grid place-items-center text-xs font-black text-[#8a6d51]">
          3Dメダルを準備中... 🪙
        </div>
      ) : null}
      {failed ? (
        <div className="absolute inset-0 grid place-items-center overflow-hidden rounded-full bg-[#eef2e9]">
          {imageUrl ? <img src={imageUrl} alt="" className="h-full w-full rounded-full object-cover" /> : <span className="text-5xl">🍀</span>}
        </div>
      ) : null}
    </div>
  );
}
