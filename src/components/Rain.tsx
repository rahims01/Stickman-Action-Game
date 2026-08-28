import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface RainProps {
  playerRef: React.RefObject<THREE.Group>;
  isPaused: boolean;
}

const DROP_COUNT = 500;
const AREA_HALF = 22;
const CEILING = 16;
const FALL_SPEED = 19;

// Stormy Weather modifier: a simple recycled droplet cloud that follows the
// player. Each drop is a point falling at constant speed; hitting the ground
// teleports it back to a random spot at the ceiling.
export const Rain: React.FC<RainProps> = ({ playerRef, isPaused }) => {
  const pointsRef = useRef<THREE.Points>(null);

  const geometry = useMemo(() => {
    const positions = new Float32Array(DROP_COUNT * 3);
    for (let i = 0; i < DROP_COUNT; i++) {
      positions[i * 3] = (Math.random() - 0.5) * AREA_HALF * 2;
      positions[i * 3 + 1] = Math.random() * CEILING;
      positions[i * 3 + 2] = (Math.random() - 0.5) * AREA_HALF * 2;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return geo;
  }, []);

  useFrame((_state, delta) => {
    if (isPaused || !pointsRef.current) return;
    const dt = Math.min(delta, 0.1);
    // The cloud rides along with the player so rain never "runs out".
    if (playerRef.current) {
      pointsRef.current.position.x = playerRef.current.position.x;
      pointsRef.current.position.z = playerRef.current.position.z;
    }
    const positions = geometry.attributes.position as THREE.BufferAttribute;
    const arr = positions.array as Float32Array;
    for (let i = 0; i < DROP_COUNT; i++) {
      arr[i * 3 + 1] -= FALL_SPEED * dt;
      if (arr[i * 3 + 1] < 0) {
        arr[i * 3] = (Math.random() - 0.5) * AREA_HALF * 2;
        arr[i * 3 + 1] = CEILING;
        arr[i * 3 + 2] = (Math.random() - 0.5) * AREA_HALF * 2;
      }
    }
    positions.needsUpdate = true;
  });

  return (
    <points ref={pointsRef} geometry={geometry} frustumCulled={false}>
      <pointsMaterial color="#9fb8c8" size={0.07} transparent opacity={0.55} sizeAttenuation depthWrite={false} />
    </points>
  );
};
