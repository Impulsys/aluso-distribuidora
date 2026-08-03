"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { CajaColocada, PalletDims } from "@/lib/pallet";

/**
 * Visor 3D del armado del pallet. Dibuja cada bulto en su posición, coloreado
 * por pedido, y se puede girar/acercar con el mouse o el dedo. Escala en cm.
 */
export default function PalletViewer3D({
  cajas,
  pallet,
  palletIndex,
}: {
  cajas: CajaColocada[];
  pallet: PalletDims;
  palletIndex: number;
}) {
  const mount = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = mount.current;
    if (!el) return;

    const w = el.clientWidth;
    const h = el.clientHeight || 420;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#eef2f5");

    const camera = new THREE.PerspectiveCamera(45, w / h, 1, 5000);
    // Vista 3/4 desde arriba, distancia según el tamaño del pallet.
    const d = Math.max(pallet.ancho, pallet.prof, pallet.alto);
    camera.position.set(d * 1.3, d * 1.2, d * 1.5);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h);
    el.appendChild(renderer.domElement);

    // Luces
    scene.add(new THREE.AmbientLight(0xffffff, 0.75));
    const dir = new THREE.DirectionalLight(0xffffff, 0.9);
    dir.position.set(1, 2, 1.5);
    scene.add(dir);

    // Grupo centrado: el pallet va con su esquina en el origen, lo centramos.
    const grupo = new THREE.Group();
    grupo.position.set(-pallet.ancho / 2, 0, -pallet.prof / 2);
    scene.add(grupo);

    // Base del pallet (madera)
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(pallet.ancho, 12, pallet.prof),
      new THREE.MeshLambertMaterial({ color: "#9a7b4f" })
    );
    base.position.set(pallet.ancho / 2, -6, pallet.prof / 2);
    grupo.add(base);

    // Cajas de ESTE pallet
    for (const c of cajas.filter((x) => x.pallet === palletIndex)) {
      const geo = new THREE.BoxGeometry(c.ancho, c.alto, c.prof);
      const mat = new THREE.MeshLambertMaterial({ color: c.color });
      const box = new THREE.Mesh(geo, mat);
      box.position.set(c.x + c.ancho / 2, c.z + c.alto / 2, c.y + c.prof / 2);
      grupo.add(box);
      // Contorno para distinguir cajas pegadas del mismo color
      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(geo),
        new THREE.LineBasicMaterial({ color: "#1a2530", transparent: true, opacity: 0.35 })
      );
      edges.position.copy(box.position);
      grupo.add(edges);
    }

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.target.set(0, pallet.alto * 0.25, 0);
    controls.update();

    let raf = 0;
    const animate = () => {
      raf = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      const nw = el.clientWidth;
      const nh = el.clientHeight || 420;
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
      renderer.setSize(nw, nh);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      controls.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        if (m.material) {
          const mm = m.material as THREE.Material | THREE.Material[];
          Array.isArray(mm) ? mm.forEach((x) => x.dispose()) : mm.dispose();
        }
      });
    };
  }, [cajas, pallet, palletIndex]);

  return (
    <div
      ref={mount}
      className="h-[420px] w-full overflow-hidden rounded-xl bg-[#eef2f5]"
      style={{ touchAction: "none" }}
    />
  );
}
