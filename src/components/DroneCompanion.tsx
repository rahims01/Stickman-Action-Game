import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { EnemyState } from '../world/gameState';

interface DroneCompanionProps {
  droneLevel: number;
  playerGroupRef: React.RefObject<THREE.Group>;
  enemies: EnemyState[];
  onAttackEnemy: (enemyId: string, damage: number) => void;
  isPaused: boolean;
}

const DRONE_ORBIT_RADIUS = 0.9;
const DRONE_ORBIT_HEIGHT = 1.85;
const DRONE_ORBIT_SPEED = 1.8;
const DRONE_FIRE_COOLDOWN = 2.0;
const DRONE_FIRE_RANGE = 15;
const DRONE_SPHERE_RADIUS = 0.12;

// Thin wrapper that renders a single drone mesh and manages its own cooldown
// and fire logic. Kept as a simple object tracked by index rather than a
// React component so the whole fleet can share one useFrame call.
export const DroneCompanion: React.FC<DroneCompanionProps> = ({ droneLevel, playerGroupRef, enemies, onAttackEnemy, isPaused }) => {
  const orbitAngleRef = useRef(0);
  // One cooldown ref per possible drone slot (cap at 8 for practicality).
  const cooldownsRef = useRef<number[]>(Array.from({ length: 8 }, () => Math.random() * DRONE_FIRE_COOLDOWN));
  const meshRefs = useRef<(THREE.Mesh | null)[]>([]);
  const flashTimerRefs = useRef<number[]>(Array.from({ length: 8 }, () => 0));

  useFrame((_, delta) => {
    if (isPaused || droneLevel <= 0 || !playerGroupRef.current) return;
    const actualDelta = Math.min(delta, 0.1);
    orbitAngleRef.current += DRONE_ORBIT_SPEED * actualDelta;

    const playerPos = playerGroupRef.current.position;
    // Each pick of the drone option adds one drone AND bumps every drone's
    // damage by 1 — so three picks gives three drones each dealing 3 DMG.
    const damage = droneLevel;

    for (let i = 0; i < droneLevel; i++) {
      const angle = orbitAngleRef.current + (Math.PI * 2 * i) / droneLevel;
      const x = playerPos.x + Math.cos(angle) * DRONE_ORBIT_RADIUS;
      const y = playerPos.y + DRONE_ORBIT_HEIGHT;
      const z = playerPos.z + Math.sin(angle) * DRONE_ORBIT_RADIUS;

      const mesh = meshRefs.current[i];
      if (mesh) {
        mesh.position.set(x, y, z);
        // Flash white briefly after firing.
        if (flashTimerRefs.current[i] > 0) {
          flashTimerRefs.current[i] -= actualDelta;
          (mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = 4;
          (mesh.material as THREE.MeshStandardMaterial).emissive.set('#ffffff');
        } else {
          (mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = 1;
          (mesh.material as THREE.MeshStandardMaterial).emissive.set('#4fc3f7');
        }
      }

      cooldownsRef.current[i] -= actualDelta;
      if (cooldownsRef.current[i] <= 0) {
        // Find the nearest alive enemy in range.
        const dronePos = new THREE.Vector3(x, y, z);
        let bestId: string | null = null;
        let bestDist = Infinity;
        enemies.forEach((e) => {
          if (e.health <= 0) return;
          const dx = e.position.x - dronePos.x;
          const dz = e.position.z - dronePos.z;
          const dist = Math.hypot(dx, dz);
          if (dist < DRONE_FIRE_RANGE && dist < bestDist) {
            bestDist = dist;
            bestId = e.id;
          }
        });
        if (bestId !== null) {
          onAttackEnemy(bestId, damage);
          flashTimerRefs.current[i] = 0.12;
        }
        cooldownsRef.current[i] = DRONE_FIRE_COOLDOWN;
      }
    }

    // Hide inactive slots.
    for (let i = droneLevel; i < 8; i++) {
      const mesh = meshRefs.current[i];
      if (mesh) mesh.visible = false;
    }
  });

  return (
    <>
      {Array.from({ length: 8 }).map((_, i) => (
        <mesh
          key={i}
          ref={(el) => { meshRefs.current[i] = el; }}
          visible={i < droneLevel}
        >
          <sphereGeometry args={[DRONE_SPHERE_RADIUS, 10, 8]} />
          <meshStandardMaterial
            color="#4fc3f7"
            emissive="#4fc3f7"
            emissiveIntensity={1}
            metalness={0.7}
            roughness={0.2}
          />
        </mesh>
      ))}
    </>
  );
};
