import { forwardRef, useImperativeHandle, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export interface DebrisParticlesHandle {
  spawnBurst: (position: THREE.Vector3, color: string) => void;
}

const POOL_SIZE = 40;
const GRAVITY = -9.81;
const BASE_SIZE = 0.1;

interface DebrisParticle {
  velocity: THREE.Vector3;
  angularVelocity: THREE.Vector3;
  active: boolean;
}

export const DebrisParticles = forwardRef<DebrisParticlesHandle>((_, ref) => {
  const meshes = useRef<THREE.Mesh[]>([]);
  const data = useRef<DebrisParticle[]>(
    Array.from({ length: POOL_SIZE }, () => ({ velocity: new THREE.Vector3(), angularVelocity: new THREE.Vector3(), active: false }))
  );
  const nextIndex = useRef(0);

  useImperativeHandle(ref, () => ({
    spawnBurst(position: THREE.Vector3, color: string) {
      const count = 8 + Math.floor(Math.random() * 5);
      for (let n = 0; n < count; n++) {
        const i = nextIndex.current;
        nextIndex.current = (nextIndex.current + 1) % POOL_SIZE;
        const mesh = meshes.current[i];
        const d = data.current[i];
        if (!mesh) continue;
        d.active = true;
        const scale = 0.5 + Math.random() * 0.8;
        mesh.scale.setScalar(scale);
        (mesh.material as THREE.MeshStandardMaterial).color.set(color);
        mesh.position.copy(position);
        mesh.visible = true;
        const angle = Math.random() * Math.PI * 2;
        const speed = 1.8 + Math.random() * 3;
        d.velocity.set(Math.cos(angle) * speed, 2.5 + Math.random() * 3, Math.sin(angle) * speed);
        d.angularVelocity.set((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12);
      }
    }
  }));

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    data.current.forEach((d, i) => {
      if (!d.active) return;
      const mesh = meshes.current[i];
      d.velocity.y += GRAVITY * dt;
      mesh.position.addScaledVector(d.velocity, dt);
      mesh.rotation.x += d.angularVelocity.x * dt;
      mesh.rotation.y += d.angularVelocity.y * dt;
      mesh.rotation.z += d.angularVelocity.z * dt;
      if (mesh.position.y <= 0.03) {
        d.active = false;
        mesh.visible = false;
      }
    });
  });

  return (
    <group>
      {Array.from({ length: POOL_SIZE }).map((_, i) => (
        <mesh
          key={i}
          ref={(el) => {
            if (el) meshes.current[i] = el;
          }}
          visible={false}
        >
          <boxGeometry args={[BASE_SIZE, BASE_SIZE, BASE_SIZE]} />
          <meshStandardMaterial color="#8a6d3b" roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
});

DebrisParticles.displayName = 'DebrisParticles';
