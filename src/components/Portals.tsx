import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export interface PortalPairDef {
  id: string;
  a: [number, number]; // x, z
  b: [number, number];
}

interface PortalsProps {
  pairs: PortalPairDef[];
  playerRef: React.RefObject<THREE.Group>;
  isPaused: boolean;
}

const TRIGGER_RADIUS = 1.0;
// After a jump the player must first walk clear of BOTH endpoints before
// any portal fires again - prevents instant ping-pong teleporting.
const REARM_RADIUS = 2.2;

// Sandbox portal shortcut pair: two linked standing rings; step into one,
// come out of the other.
export const Portals: React.FC<PortalsProps> = ({ pairs, playerRef, isPaused }) => {
  const armedRef = useRef(true);
  const ringRefs = useRef<Map<string, THREE.Mesh>>(new Map());

  useFrame((frameState) => {
    const now = frameState.clock.elapsedTime;
    ringRefs.current.forEach((mesh) => {
      mesh.rotation.z = now * 1.2;
    });
    if (isPaused || !playerRef.current) return;
    const p = playerRef.current.position;

    if (!armedRef.current) {
      const nearAny = pairs.some(
        (pair) =>
          Math.hypot(p.x - pair.a[0], p.z - pair.a[1]) < REARM_RADIUS ||
          Math.hypot(p.x - pair.b[0], p.z - pair.b[1]) < REARM_RADIUS
      );
      if (!nearAny) armedRef.current = true;
      return;
    }

    for (const pair of pairs) {
      const nearA = Math.hypot(p.x - pair.a[0], p.z - pair.a[1]) < TRIGGER_RADIUS;
      const nearB = !nearA && Math.hypot(p.x - pair.b[0], p.z - pair.b[1]) < TRIGGER_RADIUS;
      if (nearA || nearB) {
        const dest = nearA ? pair.b : pair.a;
        p.x = dest[0];
        p.z = dest[1];
        armedRef.current = false;
        break;
      }
    }
  });

  return (
    <>
      {pairs.map((pair) =>
        ([['a', pair.a, '#26c6da'] as const, ['b', pair.b, '#ab47bc'] as const]).map(([endKey, pos, color]) => (
          <group key={`${pair.id}-${endKey}`} position={[pos[0], 1.25, pos[1]]}>
            <mesh
              ref={(m) => {
                if (m) ringRefs.current.set(`${pair.id}-${endKey}`, m);
                else ringRefs.current.delete(`${pair.id}-${endKey}`);
              }}
            >
              <torusGeometry args={[1.0, 0.09, 10, 40]} />
              <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.1} metalness={0.4} roughness={0.3} />
            </mesh>
            <mesh>
              <circleGeometry args={[0.9, 28]} />
              <meshBasicMaterial color={color} transparent opacity={0.28} side={THREE.DoubleSide} depthWrite={false} />
            </mesh>
          </group>
        ))
      )}
    </>
  );
};
