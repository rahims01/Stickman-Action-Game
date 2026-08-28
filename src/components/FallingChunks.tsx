import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { ProjectilesHandle } from './Projectiles';

export interface ChunkSpawnConfig {
  position: THREE.Vector3;
  // Full world-space box dimensions.
  size: [number, number, number];
  color: string;
  velocity?: THREE.Vector3;
  quaternion?: THREE.Quaternion;
  // Emits flame particles from the chunk while it lives (burning wreckage).
  onFire?: boolean;
  lifetime?: number;
}

export interface FallingChunksHandle {
  spawnChunk: (config: ChunkSpawnConfig) => void;
}

interface FallingChunksProps {
  projectilesRef: React.RefObject<ProjectilesHandle>;
  isPaused: boolean;
}

const POOL_SIZE = 24;
const GRAVITY = -9.81;
const DEFAULT_LIFETIME = 6;
const FADE_DURATION = 1.0;
const FIRE_INTERVAL = 0.12;
const FIRE_COLORS = ['#ff9800', '#ff5722', '#ffca28'];

interface ChunkSlot {
  active: boolean;
  velocity: THREE.Vector3;
  angular: THREE.Vector3;
  landed: boolean;
  restY: number;
  lifeRemaining: number;
  onFire: boolean;
  fireTimer: number;
  baseScale: THREE.Vector3;
}

// Physical debris pieces - armour plates knocked off the Armour Man, the
// charred shapes of a destroyed sentry turret, etc. Follows the standard
// fixed-pool pattern: pre-allocated hidden meshes, an imperative spawn
// handle, per-slot physics (gravity + tumble) integrated in useFrame, and
// a ground landing at each chunk's rest height.
export const FallingChunks = forwardRef<FallingChunksHandle, FallingChunksProps>(({ projectilesRef, isPaused }, ref) => {
  const meshes = useRef<THREE.Mesh[]>([]);
  const slots = useRef<ChunkSlot[]>(
    Array.from({ length: POOL_SIZE }, () => ({
      active: false,
      velocity: new THREE.Vector3(),
      angular: new THREE.Vector3(),
      landed: false,
      restY: 0.1,
      lifeRemaining: 0,
      onFire: false,
      fireTimer: 0,
      baseScale: new THREE.Vector3(1, 1, 1)
    }))
  );
  const nextIndex = useRef(0);

  useImperativeHandle(ref, () => ({
    spawnChunk(config) {
      const i = nextIndex.current;
      nextIndex.current = (nextIndex.current + 1) % POOL_SIZE;
      const mesh = meshes.current[i];
      const slot = slots.current[i];
      if (!mesh) return;
      slot.active = true;
      slot.landed = false;
      slot.velocity.copy(config.velocity ?? new THREE.Vector3((Math.random() - 0.5) * 2, 1.5, (Math.random() - 0.5) * 2));
      slot.angular.set((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 6);
      // Resting height: roughly half the largest dimension keeps the box
      // from sinking into the floor at whatever tumble angle it lands on.
      slot.restY = Math.max(...config.size) * 0.45;
      slot.lifeRemaining = config.lifetime ?? DEFAULT_LIFETIME;
      slot.onFire = config.onFire ?? false;
      slot.fireTimer = Math.random() * FIRE_INTERVAL;
      slot.baseScale.set(...config.size);
      mesh.scale.copy(slot.baseScale);
      mesh.position.copy(config.position);
      if (config.quaternion) mesh.quaternion.copy(config.quaternion);
      else mesh.rotation.set(0, Math.random() * Math.PI * 2, 0);
      mesh.visible = true;
      (mesh.material as THREE.MeshStandardMaterial).color.set(config.color);
    }
  }));

  useFrame((_, delta) => {
    if (isPaused) return;
    const dt = Math.min(delta, 0.05);

    slots.current.forEach((slot, i) => {
      if (!slot.active) return;
      const mesh = meshes.current[i];
      if (!mesh) return;

      slot.lifeRemaining -= dt;
      if (slot.lifeRemaining <= 0) {
        slot.active = false;
        mesh.visible = false;
        return;
      }

      if (!slot.landed) {
        slot.velocity.y += GRAVITY * dt;
        mesh.position.addScaledVector(slot.velocity, dt);
        mesh.rotation.x += slot.angular.x * dt;
        mesh.rotation.y += slot.angular.y * dt;
        mesh.rotation.z += slot.angular.z * dt;
        if (mesh.position.y <= slot.restY && slot.velocity.y < 0) {
          mesh.position.y = slot.restY;
          slot.landed = true;
          slot.velocity.set(0, 0, 0);
          slot.angular.set(0, 0, 0);
        }
      }

      if (slot.onFire) {
        slot.fireTimer -= dt;
        if (slot.fireTimer <= 0) {
          slot.fireTimer = FIRE_INTERVAL;
          const p = mesh.position.clone();
          p.x += (Math.random() - 0.5) * 0.2;
          p.y += slot.restY * 0.6 + Math.random() * 0.25;
          p.z += (Math.random() - 0.5) * 0.2;
          projectilesRef.current?.spawnAmbientParticle(p, FIRE_COLORS[Math.floor(Math.random() * FIRE_COLORS.length)]);
        }
      }

      // Shrink away over the final second instead of popping out.
      if (slot.lifeRemaining < FADE_DURATION) {
        const f = slot.lifeRemaining / FADE_DURATION;
        mesh.scale.set(slot.baseScale.x * f, slot.baseScale.y * f, slot.baseScale.z * f);
      }
    });
  });

  return (
    <group>
      {Array.from({ length: POOL_SIZE }).map((_, i) => (
        <mesh
          key={`chunk-${i}`}
          ref={(el) => {
            if (el) meshes.current[i] = el;
          }}
          visible={false}
          castShadow
        >
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="#cfd8dc" metalness={0.6} roughness={0.45} />
        </mesh>
      ))}
    </group>
  );
});

FallingChunks.displayName = 'FallingChunks';
