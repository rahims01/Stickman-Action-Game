import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface MedkitProps {
  position: [number, number, number];
}

export const Medkit: React.FC<MedkitProps> = ({ position }) => {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!groupRef.current) return;
    groupRef.current.rotation.y = state.clock.elapsedTime * 1.4;
    groupRef.current.position.y = position[1] + 0.35 + Math.sin(state.clock.elapsedTime * 2) * 0.06;
  });

  return (
    <group ref={groupRef} position={position}>
      <mesh castShadow>
        <boxGeometry args={[0.36, 0.28, 0.36]} />
        <meshStandardMaterial color="#f5f5f5" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0, 0.001]}>
        <boxGeometry args={[0.22, 0.07, 0.02]} />
        <meshStandardMaterial color="#d32f2f" emissive="#d32f2f" emissiveIntensity={0.4} />
      </mesh>
      <mesh position={[0, 0, 0.001]}>
        <boxGeometry args={[0.07, 0.22, 0.02]} />
        <meshStandardMaterial color="#d32f2f" emissive="#d32f2f" emissiveIntensity={0.4} />
      </mesh>
    </group>
  );
};
