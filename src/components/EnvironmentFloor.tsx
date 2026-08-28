import React, { useMemo } from 'react';
import * as THREE from 'three';

// Procedural grass texture - a base green with random speckle variation,
// tiled across the floor. Generated once on a small canvas instead of
// shipping an image asset, in keeping with the no-assets approach.
const createGroundTexture = (): THREE.CanvasTexture => {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#3a6b2e';
  ctx.fillRect(0, 0, size, size);
  // Speckles: darker and lighter grass tufts.
  for (let i = 0; i < 1400; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 1 + Math.random() * 2.2;
    const shade = Math.random();
    ctx.fillStyle = shade < 0.55 ? 'rgba(24, 48, 18, 0.35)' : shade < 0.85 ? 'rgba(74, 122, 56, 0.4)' : 'rgba(104, 152, 80, 0.3)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(28, 28);
  texture.anisotropy = 8;
  return texture;
};

export const EnvironmentFloor: React.FC = () => {
  const groundTexture = useMemo(createGroundTexture, []);

  return (
    <group>
      <gridHelper args={[160, 160, '#31542a', '#2a4722']} position={[0, -0.01, 0]} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[160, 160]} />
        <meshStandardMaterial map={groundTexture} color="#9fbf8f" roughness={0.95} metalness={0} />
      </mesh>
    </group>
  );
};
