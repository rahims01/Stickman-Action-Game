import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import {
  FOOTBALL_DAMPING,
  FOOTBALL_HIT_DAMAGE,
  FOOTBALL_RADIUS,
  FOOTBALL_REST_SPEED,
  FootballState,
  HUMANOID_RADIUS
} from '../world/gameState';
import { EnemyState } from '../world/gameState';
import { AABB } from '../world/worldObjects';
import { resolveCircleVsBoxes } from '../world/collision';

interface FootballsProps {
  footballs: FootballState[];
  enemies: EnemyState[];
  colliders: AABB[];
  onEnemyStruck: (enemyId: string, damage: number) => void;
}

// Panel directions for the dark patches. Six is enough to read as a football
// while it spins; a real 32-panel ball at this size is invisible detail.
const PANEL_DIRS: [number, number, number][] = [
  [0, 1, 0],
  [0, -1, 0],
  [0.94, 0.34, 0],
  [-0.94, 0.34, 0],
  [0, 0.34, 0.94],
  [0, 0.34, -0.94]
];

const spin = new THREE.Vector3();
const rollAxis = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

export const Footballs: React.FC<FootballsProps> = ({ footballs, enemies, colliders, onEnemyStruck }) => {
  const groupRefs = useRef<Map<string, THREE.Group>>(new Map());

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const now = Date.now();

    footballs.forEach((ball) => {
      const group = groupRefs.current.get(ball.id);
      if (!group) return;

      if (ball.rollTimer > 0) {
        ball.rollTimer -= dt;

        const prevX = ball.position.x;
        const prevZ = ball.position.z;
        const stepX = ball.velocity.x * dt;
        const stepZ = ball.velocity.z * dt;

        // Walls and crates stop the ball dead rather than bouncing it — a
        // bounce reads as a bug at this speed, and stopping keeps it findable.
        const resolved = resolveCircleVsBoxes(prevX, prevZ, prevX + stepX, prevZ + stepZ, FOOTBALL_RADIUS, colliders);
        if (resolved.x === prevX && resolved.z === prevZ) {
          ball.velocity.set(0, 0, 0);
          ball.rollTimer = 0;
        } else {
          ball.position.x = resolved.x;
          ball.position.z = resolved.z;
        }

        // Rolling contact: knock down anything the ball runs into, once per
        // kick per enemy so it can bowl through a line rather than stunlocking
        // the first body it touches.
        enemies.forEach((e) => {
          if (e.health <= 0 || ball.hitThisKick.has(e.id)) return;
          if (e.phasedUntilMs !== undefined && now < e.phasedUntilMs) return;
          const dx = ball.position.x - e.position.x;
          const dz = ball.position.z - e.position.z;
          if (Math.hypot(dx, dz) < FOOTBALL_RADIUS + HUMANOID_RADIUS * (e.sizeMultiplier ?? 1)) {
            ball.hitThisKick.add(e.id);
            onEnemyStruck(e.id, FOOTBALL_HIT_DAMAGE);
          }
        });

        const decay = Math.pow(FOOTBALL_DAMPING, dt);
        ball.velocity.multiplyScalar(decay);

        if (ball.velocity.length() < FOOTBALL_REST_SPEED || ball.rollTimer <= 0) {
          ball.velocity.set(0, 0, 0);
          ball.rollTimer = 0;
          ball.hitThisKick.clear();
        }
      }

      group.position.set(ball.position.x, FOOTBALL_RADIUS, ball.position.z);

      // Roll the ball about the axis perpendicular to travel, by
      // distance / radius, so it rolls rather than slides.
      spin.copy(ball.velocity);
      if (spin.lengthSq() > 1e-6) {
        rollAxis.crossVectors(UP, spin).normalize();
        group.rotateOnWorldAxis(rollAxis, (spin.length() * dt) / FOOTBALL_RADIUS);
      }
    });
  });

  return (
    <group>
      {footballs.map((ball) => (
        <group
          key={ball.id}
          ref={(el) => {
            if (el) groupRefs.current.set(ball.id, el);
            else groupRefs.current.delete(ball.id);
          }}
          position={[ball.position.x, FOOTBALL_RADIUS, ball.position.z]}
        >
          <mesh castShadow>
            <sphereGeometry args={[FOOTBALL_RADIUS, 18, 18]} />
            <meshStandardMaterial color="#f7f7f7" roughness={0.65} />
          </mesh>
          {PANEL_DIRS.map((d, i) => (
            <mesh key={i} position={[d[0] * FOOTBALL_RADIUS * 0.9, d[1] * FOOTBALL_RADIUS * 0.9, d[2] * FOOTBALL_RADIUS * 0.9]}>
              <sphereGeometry args={[FOOTBALL_RADIUS * 0.36, 8, 8]} />
              <meshStandardMaterial color="#1c1c1c" roughness={0.7} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
};
