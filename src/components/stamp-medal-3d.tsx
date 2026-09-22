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
  className = "",
}: StampMedal3DProps) {
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
      const faceSafeScale = 0.88;

      const createSafeFaceTexture = (source: THREE.Texture) => {
        const image = source.image as HTMLImageElement | ImageBitmap | HTMLCanvasElement;
        const sourceWidth =
          "naturalWidth" in image && image.naturalWidth ? image.naturalWidth : image.width;
        const sourceHeight =
          "naturalHeight" in image && image.naturalHeight ? image.naturalHeight : image.height;
        if (!sourceWidth || !sourceHeight) return source;

        const size = 1024;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const context = canvas.getContext("2d");
        if (!context) return source;

        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, size, size);

        const safeSize = size * faceSafeScale;
        const scale = Math.max(safeSize / sourceWidth, safeSize / sourceHeight);
        const drawWidth = sourceWidth * scale;
        const drawHeight = sourceHeight * scale;
        const x = (size - drawWidth) / 2;
        const y = (size - drawHeight) / 2;

        context.save();
        context.beginPath();
        context.arc(size / 2, size / 2, safeSize / 2, 0, Math.PI * 2);
        context.clip();
        context.drawImage(image, x, y, drawWidth, drawHeight);
        context.restore();

        const safeTexture = new THREE.CanvasTexture(canvas);
        safeTexture.colorSpace = THREE.SRGBColorSpace;
        safeTexture.flipY = false;
        safeTexture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
        source.dispose();
        return safeTexture;
      };

      const applyTexture = async (candidate: string) => {
        try {
          const texture = await loader.loadAsync(candidate);
          if (disposed) {
            texture.dispose();
            return false;
          }
          const safeTexture = createSafeFaceTexture(texture);
          faceTexture = safeTexture;
          activeFaceMaterial.map = safeTexture;
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
      "/models/medal_template_final.glb",
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
  }, [archivePath, fallbackImageUrl, imageUrl, supabase, thumbnailPath]);

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
