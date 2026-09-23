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

        // TEMP: SuzukiPM-only dragon-fire heat tint. Remove this branch after the joke event.
        if(isTemporarySuzukiBurn){
          // Real heated steel does not form a neat ring. Build an uneven oxidation bloom instead:
          // charred core -> violet/blue temper colours -> brown/straw/gold at the cooler edge.
          const drawHeatBloom=(
            cx:number,
            cy:number,
            rx:number,
            ry:number,
            rotation:number,
            opacity:number,
          )=>{
            visualCtx.save();
            visualCtx.translate(cx,cy);
            visualCtx.rotate(rotation);
            visualCtx.scale(rx/260,ry/260);
            visualCtx.globalAlpha=opacity;
            const tint=visualCtx.createRadialGradient(-28,-34,18,0,0,260);
            tint.addColorStop(0,"rgba(18,15,14,0.52)");
            tint.addColorStop(0.18,"rgba(48,30,25,0.38)");
            tint.addColorStop(0.34,"rgba(72,34,92,0.34)");
            tint.addColorStop(0.50,"rgba(27,67,128,0.34)");
            tint.addColorStop(0.64,"rgba(105,55,73,0.25)");
            tint.addColorStop(0.77,"rgba(151,91,29,0.24)");
            tint.addColorStop(0.88,"rgba(213,164,62,0.18)");
            tint.addColorStop(1,"rgba(232,199,108,0)");
            visualCtx.fillStyle=tint;
            visualCtx.beginPath();
            visualCtx.arc(0,0,260,0,Math.PI*2);
            visualCtx.fill();
            visualCtx.restore();
          };

          // Main heat-affected zone plus offset lobes to break any seal/ring silhouette.
          drawHeatBloom(500,654,330,205,-0.05,0.90);
          drawHeatBloom(410,596,220,150,-0.34,0.64);
          drawHeatBloom(610,710,235,130,0.20,0.48);
          drawHeatBloom(356,548,150,104,-0.52,0.46);

          // Irregular hotter patches, biased toward the upper-left where the "dragon flame" hit first.
          const hotPatches=[
            [342,536,62,36,-0.40,0.30],
            [386,566,78,42,-0.28,0.26],
            [445,604,58,31,-0.14,0.22],
            [548,650,72,34,0.08,0.18],
            [632,718,54,29,0.25,0.14],
          ] as const;
          for(const [cx,cy,rx,ry,rotation,alpha] of hotPatches){
            visualCtx.save();
            visualCtx.translate(cx,cy);
            visualCtx.rotate(rotation);
            visualCtx.scale(rx/90,ry/90);
            const patch=visualCtx.createRadialGradient(-14,-10,4,0,0,90);
            patch.addColorStop(0,`rgba(12,10,9,${alpha})`);
            patch.addColorStop(0.28,`rgba(55,24,20,${alpha*0.92})`);
            patch.addColorStop(0.55,`rgba(78,37,103,${alpha*0.72})`);
            patch.addColorStop(0.75,`rgba(31,73,131,${alpha*0.56})`);
            patch.addColorStop(1,"rgba(194,133,40,0)");
            visualCtx.fillStyle=patch;
            visualCtx.beginPath();
            visualCtx.arc(0,0,90,0,Math.PI*2);
            visualCtx.fill();
            visualCtx.restore();
          }

          // Dry soot flecks keep the burn organic without turning into a drawn line.
          const soot=[
            [327,526,18,9,-0.34,0.22],
            [365,548,27,11,-0.26,0.18],
            [405,579,15,8,-0.18,0.16],
            [469,614,21,8,-0.10,0.13],
            [590,690,17,7,0.18,0.10],
          ] as const;
          visualCtx.save();
          for(const [cx,cy,rx,ry,rotation,alpha] of soot){
            visualCtx.save();
            visualCtx.translate(cx,cy);
            visualCtx.rotate(rotation);
            visualCtx.fillStyle=`rgba(24,18,16,${alpha})`;
            visualCtx.beginPath();
            visualCtx.ellipse(0,0,rx,ry,0,0,Math.PI*2);
            visualCtx.fill();
            visualCtx.restore();
          }
          visualCtx.restore();
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
            // Burnt engraving: deep charcoal-brown with a faint oxidised bronze edge.
            visualCtx.shadowBlur=5;
            visualCtx.shadowColor="rgba(63,25,12,0.30)";
            visualCtx.fillStyle="rgba(112,57,24,0.28)";
            visualCtx.fillText(line,512,y-1);
            visualCtx.shadowBlur=0;
            visualCtx.fillStyle="rgba(31,22,18,0.94)";
            visualCtx.fillText(line,512,y+2);
            visualCtx.strokeStyle="rgba(126,69,31,0.38)";
            visualCtx.lineWidth=1.15;
            visualCtx.strokeText(line,512,y+2);
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
        backMaterial.bumpScale=isTemporarySuzukiBurn?-0.022:-0.016;
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
