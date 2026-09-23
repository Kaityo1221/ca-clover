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
          // Burnt-board reference translated onto metal:
          // warm exposed metal in the middle, irregular brown/black char invading from the upper-left,
          // and scattered soot/streaks. Deliberately avoid rings, borders, and logo-like symmetry.
          const drawScorchCloud=(
            cx:number,
            cy:number,
            rx:number,
            ry:number,
            rotation:number,
            coreAlpha:number,
            edgeAlpha:number,
          )=>{
            visualCtx.save();
            visualCtx.translate(cx,cy);
            visualCtx.rotate(rotation);
            visualCtx.scale(rx/220,ry/220);
            const scorch=visualCtx.createRadialGradient(-34,-28,8,0,0,220);
            scorch.addColorStop(0,`rgba(16,12,10,${coreAlpha})`);
            scorch.addColorStop(0.24,`rgba(35,22,16,${coreAlpha*0.92})`);
            scorch.addColorStop(0.48,`rgba(79,45,24,${coreAlpha*0.68})`);
            scorch.addColorStop(0.70,`rgba(137,82,35,${edgeAlpha})`);
            scorch.addColorStop(0.88,`rgba(196,132,52,${edgeAlpha*0.48})`);
            scorch.addColorStop(1,"rgba(222,172,82,0)");
            visualCtx.fillStyle=scorch;
            visualCtx.beginPath();
            visualCtx.arc(0,0,220,0,Math.PI*2);
            visualCtx.fill();
            visualCtx.restore();
          };

          // A faint amber heat wash beneath the engraving. This keeps the centre readable and
          // creates the "surviving wood tone" feeling from the reference without turning metal into wood.
          visualCtx.save();
          visualCtx.translate(512,660);
          visualCtx.scale(1.36,0.76);
          const warmWash=visualCtx.createRadialGradient(0,0,35,0,0,245);
          warmWash.addColorStop(0,"rgba(171,103,38,0.18)");
          warmWash.addColorStop(0.48,"rgba(139,75,28,0.13)");
          warmWash.addColorStop(0.78,"rgba(82,43,21,0.08)");
          warmWash.addColorStop(1,"rgba(52,28,18,0)");
          visualCtx.fillStyle=warmWash;
          visualCtx.beginPath();
          visualCtx.arc(0,0,245,0,Math.PI*2);
          visualCtx.fill();
          visualCtx.restore();

          // Heavy irregular burn on the flame-entry side plus smaller islands elsewhere.
          drawScorchCloud(330,525,210,140,-0.42,0.78,0.34);
          drawScorchCloud(392,565,230,128,-0.27,0.62,0.30);
          drawScorchCloud(286,635,165,118,-0.12,0.54,0.28);
          drawScorchCloud(676,740,150,100,0.24,0.36,0.20);
          drawScorchCloud(716,614,118,78,0.08,0.26,0.14);
          drawScorchCloud(484,812,158,72,0.02,0.28,0.16);

          // Dry black char fragments, intentionally broken and asymmetric.
          const charPatches=[
            [286,487,62,24,-0.42,0.42],
            [330,516,88,29,-0.36,0.34],
            [373,548,72,22,-0.28,0.28],
            [267,610,54,18,-0.08,0.28],
            [315,657,66,20,-0.05,0.22],
            [668,739,46,17,0.20,0.18],
            [712,716,30,13,0.18,0.14],
            [465,810,56,15,0.00,0.16],
          ] as const;
          for(const [cx,cy,rx,ry,rotation,alpha] of charPatches){
            visualCtx.save();
            visualCtx.translate(cx,cy);
            visualCtx.rotate(rotation);
            const charGradient=visualCtx.createRadialGradient(-rx*0.18,-ry*0.15,2,0,0,Math.max(rx,ry));
            charGradient.addColorStop(0,`rgba(9,8,7,${alpha})`);
            charGradient.addColorStop(0.52,`rgba(22,16,13,${alpha*0.86})`);
            charGradient.addColorStop(1,"rgba(55,31,19,0)");
            visualCtx.fillStyle=charGradient;
            visualCtx.beginPath();
            visualCtx.ellipse(0,0,rx,ry,0,0,Math.PI*2);
            visualCtx.fill();
            visualCtx.restore();
          }

          // Soot streaks mimic flame lick and rubbed char from the supplied burnt-board references.
          const sootStreaks=[
            [248,505,430,571,11,0.28],
            [258,538,448,603,7,0.23],
            [272,579,420,624,5,0.18],
            [294,620,390,646,4,0.16],
            [614,728,720,760,5,0.13],
            [436,806,564,812,4,0.11],
          ] as const;
          visualCtx.save();
          visualCtx.lineCap="round";
          for(const [x1,y1,x2,y2,width,alpha] of sootStreaks){
            visualCtx.strokeStyle=`rgba(18,13,11,${alpha})`;
            visualCtx.lineWidth=width;
            visualCtx.beginPath();
            visualCtx.moveTo(x1,y1);
            visualCtx.quadraticCurveTo(
              x1+(x2-x1)*0.47,
              y1+(y2-y1)*0.36-8,
              x2,
              y2,
            );
            visualCtx.stroke();
          }
          visualCtx.restore();

          // A tiny trace of steel heat tint remains only at the hottest transition,
          // so the result still reads as scorched metal rather than painted wood.
          const tintWisps=[
            [384,558,74,30,-0.28],
            [427,589,58,24,-0.18],
          ] as const;
          for(const [cx,cy,rx,ry,rotation] of tintWisps){
            visualCtx.save();
            visualCtx.translate(cx,cy);
            visualCtx.rotate(rotation);
            visualCtx.scale(rx/80,ry/80);
            const tint=visualCtx.createRadialGradient(0,0,6,0,0,80);
            tint.addColorStop(0,"rgba(52,31,83,0.12)");
            tint.addColorStop(0.46,"rgba(30,67,117,0.10)");
            tint.addColorStop(0.76,"rgba(147,86,34,0.08)");
            tint.addColorStop(1,"rgba(185,132,48,0)");
            visualCtx.fillStyle=tint;
            visualCtx.beginPath();
            visualCtx.arc(0,0,80,0,Math.PI*2);
            visualCtx.fill();
            visualCtx.restore();
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
            // Carbonised engraving: nearly black in the recess with a dirty burnt-brown shoulder.
            visualCtx.shadowBlur=4;
            visualCtx.shadowColor="rgba(28,15,9,0.34)";
            visualCtx.fillStyle="rgba(104,57,25,0.34)";
            visualCtx.fillText(line,512,y-1);
            visualCtx.shadowBlur=0;
            visualCtx.fillStyle="rgba(22,16,13,0.96)";
            visualCtx.fillText(line,512,y+2);
            visualCtx.strokeStyle="rgba(121,70,30,0.46)";
            visualCtx.lineWidth=1.35;
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
