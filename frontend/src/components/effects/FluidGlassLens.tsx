"use client";

/* eslint-disable react/no-unknown-property */
import * as THREE from 'three';
import { useMemo, useRef, useEffect, useState } from 'react';
import { Canvas, createPortal, useFrame, useThree } from '@react-three/fiber';
import { useFBO, MeshTransmissionMaterial } from '@react-three/drei';
import { easing } from 'maath';

function radialTexture(colors: string[]): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, colors[0]);
  grad.addColorStop(1, colors[1]);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function ScenePortal() {
  const group = useRef<THREE.Group>(null);

  const blobs = useMemo(() => {
    const defs: { pos: [number, number, number]; size: number; colors: string[]; speed: number }[] = [
      { pos: [-2.6, -1.4, -2], size: 2.2, colors: ['rgba(139, 92, 246, 0.9)', 'rgba(139, 92, 246, 0)'], speed: 1 },
      { pos: [2.8, -0.9, -1.5], size: 2.6, colors: ['rgba(217, 70, 239, 0.85)', 'rgba(217, 70, 239, 0)'], speed: 1.3 },
      { pos: [0, -2.6, -3], size: 3.2, colors: ['rgba(99, 102, 241, 0.7)', 'rgba(99, 102, 241, 0)'], speed: 0.8 },
      { pos: [-0.8, 1.6, -4], size: 1.6, colors: ['rgba(139, 92, 246, 0.5)', 'rgba(139, 92, 246, 0)'], speed: 1.6 },
      { pos: [1.4, 2.2, -5], size: 1.3, colors: ['rgba(232, 121, 249, 0.45)', 'rgba(232, 121, 249, 0)'], speed: 1.1 },
      { pos: [2.4, -3.2, -4], size: 1.8, colors: ['rgba(59, 130, 246, 0.55)', 'rgba(59, 130, 246, 0)'], speed: 0.9 },
    ];
    return defs.map((d, i) => ({
      key: i,
      def: d,
      mesh: (
        <mesh key={i} position={d.pos}>
          <circleGeometry args={[d.size, 48]} />
          <meshBasicMaterial map={radialTexture(d.colors)} transparent depthWrite={false} />
        </mesh>
      ),
    }));
  }, []);

  useFrame((state) => {
    if (!group.current) return;
    const t = state.clock.elapsedTime;
    group.current.children.forEach((child, i) => {
      const speed = blobs[i]?.def.speed ?? 1;
      child.position.y = blobs[i].def.pos[1] + Math.sin(t * speed + i * 1.7) * 0.18;
      const s = 1 + Math.sin(t * speed * 0.8 + i) * 0.07;
      child.scale.setScalar(s);
      const mat = (child as THREE.Mesh).material as THREE.MeshBasicMaterial;
      mat.opacity = 0.5 + 0.25 * Math.sin(t * speed + i * 2.1);
    });
  });

  return <group ref={group}>{blobs.map((b) => b.mesh)}</group>;
}

function Lens() {
  const ref = useRef<THREE.Mesh>(null);
  const { gl, viewport: vp, camera } = useThree();
  const buffer = useFBO();
  const [scene] = useState(() => new THREE.Scene());
  const target = useRef({ x: 0, y: 0 });
  const lastMove = useRef(0);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      target.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      target.current.y = -(e.clientY / window.innerHeight) * 2 + 1;
      lastMove.current = Date.now();
    };
    const onTouch = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      target.current.x = (t.clientX / window.innerWidth) * 2 - 1;
      target.current.y = -(t.clientY / window.innerHeight) * 2 + 1;
      lastMove.current = Date.now();
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('touchmove', onTouch, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('touchmove', onTouch);
    };
  }, []);

  useFrame((state, delta) => {
    const lens = ref.current;
    if (!lens) return;
    const v = vp.getCurrentViewport(camera, [0, 0, 15]);
    const t = state.clock.elapsedTime;
    const idle = Date.now() - lastMove.current > 2200;

    const destX = idle
      ? Math.sin(t * 0.35) * (v.width * 0.28)
      : (target.current.x * v.width) / 2;
    const destY = idle
      ? -v.height / 2 + 1.4 + Math.cos(t * 0.3) * 0.3
      : -v.height / 2 + 1.4 + (target.current.y * v.height) / 4;

    easing.damp3(lens.position, [destX, destY, 15], 0.18, delta);

    gl.setRenderTarget(buffer);
    gl.render(scene, camera);
    gl.setRenderTarget(null);
  });

  return (
    <>
      {createPortal(<ScenePortal />, scene)}
      <mesh scale={[vp.width, vp.height, 1]}>
        <planeGeometry />
        <meshBasicMaterial map={buffer.texture} transparent />
      </mesh>
      <mesh
        ref={ref}
        position={[0, -vp.height / 2 + 1.4, 15]}
        scale={0.16}
        rotation-x={Math.PI / 2}
      >
        <cylinderGeometry args={[1, 1, 0.42, 64]} />
        <MeshTransmissionMaterial
          buffer={buffer.texture}
          ior={1.18}
          thickness={3.2}
          chromaticAberration={0.06}
          anisotropy={0.01}
          roughness={0.05}
          transmission={1}
          resolution={256}
        />
      </mesh>
    </>
  );
}

export default function FluidGlassLens() {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 40,
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
    >
      <Canvas camera={{ position: [0, 0, 20], fov: 15 }} gl={{ alpha: true, antialias: true }} dpr={[1, 1.25]}>
        <Lens />
      </Canvas>
    </div>
  );
}