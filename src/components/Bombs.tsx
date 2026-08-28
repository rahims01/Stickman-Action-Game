import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { BOMB_RADIUS, BombState } from '../world/gameState';

interface BombsProps {
  bombs: BombState[];
  isPaused: boolean;
  onExplode: (id: string, now: number) => void;
}

// Bomb Man's sticky bombs: a dark sphere whose fuse glow blinks faster and
// faster as detonation approaches, plus a flat ground ring showing the
// exact blast radius - the whole telegraph is "get out of the circle".
// The fuse is ticked with frame delta (not wall-clock), so pausing freezes it.
export const Bombs: React.FC<BombsProps> = ({ bombs, isPaused, onExplode }) => {
  const sphereRefs = useRef<Map<string, THREE.Mesh>>(new Map());
  const ringRefs = useRef<Map<string, THREE.Mesh>>(new Map());
  // A bomb must detonate exactly once - the state update that removes it may
  // not have flushed by the next frame, so track fired ids locally too.
  const explodedRef = useRef<Set<string>>(new Set());

  useFrame((state, delta) => {
    if (isPaused) return;
    const dt = Math.min(delta, 0.1);
    const now = state.clock.elapsedTime;

    if (explodedRef.current.size > 0) {
      const liveIds = new Set(bombs.map((b) => b.id));
      explodedRef.current.forEach((id) => {
        if (!liveIds.has(id)) explodedRef.current.delete(id);
      });
    }

    bombs.forEach((bomb) => {
      if (explodedRef.current.has(bomb.id)) return;
      bomb.fuseRemaining -= dt;
      if (bomb.fuseRemaining <= 0) {
        explodedRef.current.add(bomb.id);
        onExplode(bomb.id, now);
        return;
      }
      const burnt = 1 - bomb.fuseRemaining / bomb.fuseTotal;
      // Blink accelerates toward detonation.
      const blink = Math.sin(state.clock.elapsedTime * (6 + burnt * 26)) > 0;
      const sphere = sphereRefs.current.get(bomb.id);
      if (sphere) {
        const mat = sphere.material as THREE.MeshStandardMaterial;
        mat.emissiveIntensity = blink ? 2.6 : 0.25;
      }
      const ring = ringRefs.current.get(bomb.id);
      if (ring) {
        (ring.material as THREE.MeshBasicMaterial).opacity = 0.18 + burnt * 0.3 + (blink ? 0.08 : 0);
      }
    });
  });

  return (
    <>
      {bombs.map((bomb) => (
        <group key={bomb.id} position={bomb.position}>
          <mesh
            position={[0, 0.16, 0]}
            castShadow
            ref={(el) => {
              if (el) sphereRefs.current.set(bomb.id, el);
              else sphereRefs.current.delete(bomb.id);
            }}
          >
            <sphereGeometry args={[0.17, 12, 10]} />
            <meshStandardMaterial color="#1c1c1c" emissive="#ff9800" emissiveIntensity={0.25} roughness={0.5} />
          </mesh>
          {/* Danger-zone ring flat on the ground. */}
          <mesh
            position={[0, 0.03, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
            ref={(el) => {
              if (el) ringRefs.current.set(bomb.id, el);
              else ringRefs.current.delete(bomb.id);
            }}
          >
            <ringGeometry args={[BOMB_RADIUS - 0.12, BOMB_RADIUS, 40]} />
            <meshBasicMaterial color="#ff9800" transparent opacity={0.2} side={THREE.DoubleSide} depthWrite={false} />
          </mesh>
        </group>
      ))}
    </>
  );
};
