import { forwardRef, useImperativeHandle, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { PUDDLE_LIFETIME, PUDDLE_SHRINK_DURATION } from '../world/gameState';

export interface BloodParticlesHandle {
  // damageScale: 1 = normal, higher = bigger splash + wider puddle.
  // color: overrides the default red (cube enemies bleed their body color).
  spawnBurst: (position: THREE.Vector3, damageScale?: number, color?: string) => void;
}

const DEFAULT_BLOOD = '#8a0e0e';

const MAIN_POOL_SIZE = 24;
const SECONDARY_POOL_SIZE = 60;
const PUDDLE_POOL_SIZE = 40;
const GRAVITY = -9.81;
const MAIN_BASE_RADIUS = 0.06;
const PUDDLE_BASE_RADIUS = 0.1;

interface MainParticle {
  velocity: THREE.Vector3;
  active: boolean;
  radius: number;
  color: string;
}

interface SecondaryParticle {
  velocity: THREE.Vector3;
  active: boolean;
}

interface Puddle {
  active: boolean;
  age: number;
  baseScale: number;
}

export const BloodParticles = forwardRef<BloodParticlesHandle>((_, ref) => {
  const mainMeshes = useRef<THREE.Mesh[]>([]);
  const mainData = useRef<MainParticle[]>(
    Array.from({ length: MAIN_POOL_SIZE }, () => ({ velocity: new THREE.Vector3(), active: false, radius: MAIN_BASE_RADIUS, color: DEFAULT_BLOOD }))
  );
  const secondaryMeshes = useRef<THREE.Mesh[]>([]);
  const secondaryData = useRef<SecondaryParticle[]>(
    Array.from({ length: SECONDARY_POOL_SIZE }, () => ({ velocity: new THREE.Vector3(), active: false }))
  );
  const puddleMeshes = useRef<THREE.Mesh[]>([]);
  const puddleData = useRef<Puddle[]>(Array.from({ length: PUDDLE_POOL_SIZE }, () => ({ active: false, age: 0, baseScale: 1 })));
  const nextPuddleIndex = useRef(0);

  const spawnSecondaryBurst = (position: THREE.Vector3, color: string) => {
    const count = 4 + Math.floor(Math.random() * 4);
    let spawned = 0;
    for (let i = 0; i < secondaryData.current.length && spawned < count; i++) {
      const data = secondaryData.current[i];
      if (data.active) continue;
      const mesh = secondaryMeshes.current[i];
      if (!mesh) continue;
      data.active = true;
      (mesh.material as THREE.MeshStandardMaterial).color.set(color);
      mesh.position.set(position.x, 0.05, position.z);
      mesh.visible = true;
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.5 + Math.random() * 1.2;
      data.velocity.set(Math.cos(angle) * speed, 0.8 + Math.random() * 1, Math.sin(angle) * speed);
      spawned += 1;
    }
  };

  const spawnPuddle = (position: THREE.Vector3, sphereRadius: number, color: string) => {
    const idx = nextPuddleIndex.current;
    nextPuddleIndex.current = (nextPuddleIndex.current + 1) % PUDDLE_POOL_SIZE;
    const mesh = puddleMeshes.current[idx];
    const d = puddleData.current[idx];
    if (!mesh) return;
    // Puddles are a slightly darker shade of the droplet color.
    (mesh.material as THREE.MeshStandardMaterial).color.set(color).multiplyScalar(0.8);
    // Puddle circle area matches the source sphere's surface area (4*pi*r^2),
    // so its radius is 2x the sphere's radius.
    const puddleRadius = sphereRadius * 2;
    const scale = puddleRadius / PUDDLE_BASE_RADIUS;
    mesh.scale.setScalar(scale);
    mesh.position.set(position.x, 0.01, position.z);
    mesh.visible = true;
    d.active = true;
    d.age = 0;
    d.baseScale = scale;
  };

  useImperativeHandle(ref, () => ({
    spawnBurst(position: THREE.Vector3, damageScale = 1, color = DEFAULT_BLOOD) {
      const scale = Math.min(1 + (damageScale - 1) * 0.15, 3);
      const count = 6 + Math.floor(Math.random() * 4);
      let spawned = 0;
      for (let i = 0; i < mainData.current.length && spawned < count; i++) {
        const data = mainData.current[i];
        if (data.active) continue;
        const mesh = mainMeshes.current[i];
        if (!mesh) continue;
        data.active = true;
        data.color = color;
        (mesh.material as THREE.MeshStandardMaterial).color.set(color);
        data.radius = (0.035 + Math.random() * 0.045) * scale;
        mesh.scale.setScalar(data.radius / MAIN_BASE_RADIUS);
        mesh.position.copy(position);
        mesh.visible = true;
        const angle = Math.random() * Math.PI * 2;
        const speed = (1.5 + Math.random() * 2.5) * Math.min(scale, 1.5);
        data.velocity.set(Math.cos(angle) * speed, 2 + Math.random() * 2.5, Math.sin(angle) * speed);
        spawned += 1;
      }
    }
  }));

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);

    mainData.current.forEach((data, i) => {
      if (!data.active) return;
      const mesh = mainMeshes.current[i];
      data.velocity.y += GRAVITY * dt;
      mesh.position.addScaledVector(data.velocity, dt);
      if (mesh.position.y <= 0.02) {
        mesh.position.y = 0.02;
        data.active = false;
        mesh.visible = false;
        spawnPuddle(mesh.position, data.radius, data.color);
        spawnSecondaryBurst(mesh.position, data.color);
      }
    });

    secondaryData.current.forEach((data, i) => {
      if (!data.active) return;
      const mesh = secondaryMeshes.current[i];
      data.velocity.y += GRAVITY * dt;
      mesh.position.addScaledVector(data.velocity, dt);
      if (mesh.position.y <= 0.01) {
        data.active = false;
        mesh.visible = false;
      }
    });

    puddleData.current.forEach((d, i) => {
      if (!d.active) return;
      d.age += dt;
      if (d.age <= PUDDLE_LIFETIME) return;
      const shrinkProgress = (d.age - PUDDLE_LIFETIME) / PUDDLE_SHRINK_DURATION;
      const mesh = puddleMeshes.current[i];
      if (shrinkProgress >= 1) {
        d.active = false;
        mesh.visible = false;
        return;
      }
      mesh.scale.setScalar(d.baseScale * (1 - shrinkProgress));
    });
  });

  return (
    <group>
      {Array.from({ length: MAIN_POOL_SIZE }).map((_, i) => (
        <mesh
          key={`main-${i}`}
          ref={(el) => {
            if (el) mainMeshes.current[i] = el;
          }}
          visible={false}
        >
          <sphereGeometry args={[MAIN_BASE_RADIUS, 8, 8]} />
          <meshStandardMaterial color="#8a0e0e" roughness={0.5} />
        </mesh>
      ))}
      {Array.from({ length: SECONDARY_POOL_SIZE }).map((_, i) => (
        <mesh
          key={`sec-${i}`}
          ref={(el) => {
            if (el) secondaryMeshes.current[i] = el;
          }}
          visible={false}
        >
          <sphereGeometry args={[0.022, 6, 6]} />
          <meshStandardMaterial color="#8a0e0e" roughness={0.5} />
        </mesh>
      ))}
      {Array.from({ length: PUDDLE_POOL_SIZE }).map((_, i) => (
        <mesh
          key={`puddle-${i}`}
          ref={(el) => {
            if (el) puddleMeshes.current[i] = el;
          }}
          visible={false}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <circleGeometry args={[PUDDLE_BASE_RADIUS, 16]} />
          <meshStandardMaterial color="#6b0a0a" roughness={1} />
        </mesh>
      ))}
    </group>
  );
});

BloodParticles.displayName = 'BloodParticles';
