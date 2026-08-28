import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import {
  ENEMY_TURRET_DAMAGE,
  TURRET_FIRE_COOLDOWN,
  TURRET_FIRE_RANGE,
  TURRET_PROJECTILE_SPEED,
  EnemyState,
  TurretState
} from '../world/gameState';
import { ProjectilesHandle } from './Projectiles';

interface TurretsProps {
  turrets: TurretState[];
  // Damage per shot for PLAYER turrets - mirrors the drone: each 'turret'
  // pick adds a turret AND raises every player turret's damage by 1.
  playerTurretDamage: number;
  playerRef: React.RefObject<THREE.Group>;
  enemies: EnemyState[];
  projectilesRef: React.RefObject<ProjectilesHandle>;
  isPaused: boolean;
  showHealthBar?: boolean;
  // Enemy turrets ran out their lifetime (not killed - no debris).
  onExpire: (id: string) => void;
}

const PLAYER_TURRET_COLOR = '#4fc3f7';
const ENEMY_TURRET_COLOR = '#ff8f00';
const MUZZLE_HEIGHT = 0.62;

// Both the player's upgrade turrets (permanent, indestructible) and the
// Engineer Man's deployed sentries (killable via Player.tsx's hit-test,
// auto-expiring) render and fire from this one component. Actual shots are
// real pooled projectiles: shooterTeam 'helper' collides with enemies,
// 'enemy' collides with the player - so both sides reuse the existing
// projectile collision/damage chokepoints instead of a parallel hit path.
export const Turrets: React.FC<TurretsProps> = ({
  turrets,
  playerTurretDamage,
  playerRef,
  enemies,
  projectilesRef,
  isPaused,
  showHealthBar = true,
  onExpire
}) => {
  const cooldownsRef = useRef<Map<string, number>>(new Map());
  const headRefs = useRef<Map<string, THREE.Group>>(new Map());

  useFrame((_, delta) => {
    if (isPaused) return;
    const actualDelta = Math.min(delta, 0.1);
    const nowMs = Date.now();

    turrets.forEach((turret) => {
      if (turret.health <= 0) return;
      if (turret.expiresAtMs !== undefined && nowMs > turret.expiresAtMs) {
        onExpire(turret.id);
        return;
      }

      const cooldown = (cooldownsRef.current.get(turret.id) ?? Math.random() * TURRET_FIRE_COOLDOWN) - actualDelta;
      cooldownsRef.current.set(turret.id, cooldown);

      // Acquire a target: player turrets pick the nearest living (and not
      // phased) enemy; enemy turrets aim at the player.
      let targetPos: THREE.Vector3 | null = null;
      if (turret.owner === 'player') {
        let bestDist = TURRET_FIRE_RANGE;
        enemies.forEach((e) => {
          if (e.health <= 0) return;
          if (e.phasedUntilMs !== undefined && nowMs < e.phasedUntilMs) return;
          const d = Math.hypot(e.position.x - turret.position.x, e.position.z - turret.position.z);
          if (d < bestDist) {
            bestDist = d;
            targetPos = e.position;
          }
        });
      } else if (playerRef.current) {
        const p = playerRef.current.position;
        if (Math.hypot(p.x - turret.position.x, p.z - turret.position.z) < TURRET_FIRE_RANGE) targetPos = p;
      }

      const head = headRefs.current.get(turret.id);
      if (head && targetPos !== null) {
        const t = targetPos as THREE.Vector3;
        head.rotation.y = Math.atan2(t.x - turret.position.x, t.z - turret.position.z);
      }

      if (cooldown <= 0 && targetPos !== null) {
        cooldownsRef.current.set(turret.id, TURRET_FIRE_COOLDOWN);
        const t = targetPos as THREE.Vector3;
        const from = turret.position.clone().add(new THREE.Vector3(0, MUZZLE_HEIGHT, 0));
        const to = t.clone().add(new THREE.Vector3(0, 1.0, 0));
        if (turret.owner === 'player') {
          projectilesRef.current?.spawn({
            from,
            to,
            color: PLAYER_TURRET_COLOR,
            payload: { damage: playerTurretDamage, range: 'ranged', isProjectile: true },
            speed: TURRET_PROJECTILE_SPEED,
            shooterTeam: 'helper',
            attackerId: turret.id
          });
        } else {
          projectilesRef.current?.spawn({
            from,
            to,
            color: ENEMY_TURRET_COLOR,
            payload: { damage: ENEMY_TURRET_DAMAGE, range: 'ranged', isProjectile: true, projectileColor: ENEMY_TURRET_COLOR },
            speed: TURRET_PROJECTILE_SPEED,
            shooterTeam: 'enemy',
            attackerId: turret.id
          });
        }
      }
    });
  });

  return (
    <>
      {turrets.map((turret) => {
        if (turret.health <= 0) return null;
        const color = turret.owner === 'player' ? PLAYER_TURRET_COLOR : ENEMY_TURRET_COLOR;
        return (
          <group key={turret.id} position={turret.position}>
            {/* Base */}
            <mesh position={[0, 0.15, 0]} castShadow>
              <cylinderGeometry args={[0.28, 0.34, 0.3, 10]} />
              <meshStandardMaterial color="#37474f" metalness={0.6} roughness={0.4} />
            </mesh>
            {/* Rotating head + barrel */}
            <group
              position={[0, 0.45, 0]}
              ref={(el) => {
                if (el) headRefs.current.set(turret.id, el);
                else headRefs.current.delete(turret.id);
              }}
            >
              <mesh castShadow>
                <boxGeometry args={[0.3, 0.24, 0.3]} />
                <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} metalness={0.5} roughness={0.35} />
              </mesh>
              <mesh position={[0, MUZZLE_HEIGHT - 0.45, 0.28]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.045, 0.045, 0.3, 8]} />
                <meshStandardMaterial color="#263238" metalness={0.7} roughness={0.3} />
              </mesh>
            </group>
            {/* Killable enemy sentries show their remaining health. */}
            {showHealthBar && turret.owner === 'enemy' && (
              <Html position={[0, 1.05, 0]} center distanceFactor={12} style={{ pointerEvents: 'none' }}>
                <div
                  style={{
                    width: '44px',
                    height: '6px',
                    background: 'rgba(0,0,0,0.6)',
                    border: '1px solid rgba(255,183,77,0.6)',
                    borderRadius: '4px',
                    overflow: 'hidden'
                  }}
                >
                  <div
                    style={{
                      width: `${Math.max(0, Math.min(100, (turret.health / Math.max(turret.maxHealth, 1)) * 100))}%`,
                      height: '100%',
                      background: 'linear-gradient(180deg,#ffb74d,#f57c00)',
                      borderRadius: '3px'
                    }}
                  />
                </div>
              </Html>
            )}
          </group>
        );
      })}
    </>
  );
};
