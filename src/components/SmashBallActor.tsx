import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { resolveCircleVsBoxes } from '../world/collision';
import { AABB } from '../world/worldObjects';
import { AttackPayload, ENEMY_CONFIGS, EnemyType } from '../world/enemyConfig';
import { ProjectilesHandle } from './Projectiles';
import {
  CORPSE_SINK_DELAY,
  CORPSE_SINK_DURATION,
  CivilianState,
  ENEMY_CHASE_RANGE,
  HUMANOID_RADIUS,
  HelperState,
  SMASH_BALL_CHARGE_TRIGGER_RANGE,
  SMASH_BALL_CONTACT_RADIUS,
  SMASH_BALL_COOLDOWN,
  SMASH_BALL_IDLE_RANGE,
  SMASH_BALL_RETREAT_SPEED,
  SMASH_BALL_ROLL_MAX_SECONDS,
  SMASH_BALL_ROLL_SPEED,
  SMASH_BALL_TELEGRAPH_SECONDS
} from '../world/gameState';

interface SmashBallActorProps {
  id: string;
  type: EnemyType;
  health: number;
  maxHealth: number;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  playerRef: React.RefObject<THREE.Group>;
  helpers: HelperState[];
  civilians?: CivilianState[];
  colliders: AABB[];
  projectilesRef: React.RefObject<ProjectilesHandle>;
  damageBonus: number;
  moveSpeedBonus: number;
  attackSpeedBonus: number;
  sizeMultiplier?: number;
  isPaused: boolean;
  forceSinkNow?: boolean;
  ignorePlayer?: boolean;
  showHealthBar?: boolean;
  onAttackPlayer?: (payload: AttackPayload, attackerPosition: THREE.Vector3, now: number, attackerColor: string, attackerId: string) => void;
  onAttackHelper?: (helperId: string, payload: AttackPayload, now: number, attackerColor: string, attackerId?: string) => void;
  onAttackCivilian?: (civilianId: string, payload: AttackPayload, now: number, attackerColor: string, attackerId?: string) => void;
  onSunk: (id: string) => void;
}

const BALL_RADIUS = 0.42;
const SINK_DEPTH = 1.2;

type BallMode = 'watch' | 'telegraph' | 'roll' | 'retreat';

// The Smash Ball (and its burning magma cousin): a rolling sphere that
// lurks at a distance sizing you up, then telegraphs with a shiver, charges
// in a dead-straight high-speed roll dealing contact damage, and retreats
// back out to watching range to wait out its cooldown. Dies like the cubes:
// no ragdoll - it chars black, rests, then sinks.
export const SmashBallActor: React.FC<SmashBallActorProps> = ({
  id,
  type,
  health,
  maxHealth,
  position,
  velocity,
  playerRef,
  helpers,
  civilians = [],
  colliders,
  projectilesRef,
  damageBonus,
  moveSpeedBonus,
  attackSpeedBonus,
  sizeMultiplier = 1,
  isPaused,
  forceSinkNow,
  ignorePlayer = false,
  showHealthBar = true,
  onAttackPlayer,
  onAttackHelper,
  onAttackCivilian,
  onSunk
}) => {
  const config = ENEMY_CONFIGS[type];
  const groupRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const modeRef = useRef<BallMode>('watch');
  const modeTimerRef = useRef(0);
  const cooldownRef = useRef(1 + Math.random() * 2);
  const rollDirRef = useRef(new THREE.Vector3());
  const rollHitIdsRef = useRef<Set<string>>(new Set());
  const rollSpinRef = useRef(0);
  const deadRef = useRef(false);
  const deadTimeRef = useRef(0);
  const sunkNotifiedRef = useRef(false);
  const hasSpawnedRef = useRef(false);
  const ambientTimerRef = useRef(Math.random() * 0.3);

  const radius = BALL_RADIUS * sizeMultiplier;
  const contactPayload = useMemo<AttackPayload>(
    () => ({ ...(config.punch ?? { damage: 3, range: 'melee' as const }) }),
    [config]
  );

  useFrame((frameState, delta) => {
    if (isPaused || !groupRef.current || !playerRef.current) return;
    const dt = Math.min(delta, 0.1);
    const now = frameState.clock.elapsedTime;
    const mesh = meshRef.current;

    if (!hasSpawnedRef.current) {
      hasSpawnedRef.current = true;
      groupRef.current.position.copy(position);
      groupRef.current.position.y = 0;
    }

    if (deadRef.current || health <= 0) {
      if (!deadRef.current) {
        deadRef.current = true;
        if (mesh) {
          const mat = mesh.material as THREE.MeshStandardMaterial;
          mat.color.set('#0d0d0d');
          mat.emissiveIntensity = 0;
        }
      }
      if (velocity.lengthSq() > 0.0001) {
        groupRef.current.position.x += velocity.x * dt;
        groupRef.current.position.z += velocity.z * dt;
        velocity.multiplyScalar(0.85);
      }
      deadTimeRef.current += dt;
      if (forceSinkNow) deadTimeRef.current = Math.max(deadTimeRef.current, CORPSE_SINK_DELAY);
      if (deadTimeRef.current > CORPSE_SINK_DELAY) {
        const sinkProgress = Math.min(1, (deadTimeRef.current - CORPSE_SINK_DELAY) / CORPSE_SINK_DURATION);
        groupRef.current.position.y = -SINK_DEPTH * sinkProgress;
        if (sinkProgress >= 1 && !sunkNotifiedRef.current) {
          sunkNotifiedRef.current = true;
          if (groupRef.current) groupRef.current.visible = false;
          onSunk(id);
        }
      }
      position.copy(groupRef.current.position);
      return;
    }

    // Ambient particles (lava variant smoulders).
    ambientTimerRef.current -= dt;
    if (ambientTimerRef.current <= 0) {
      ambientTimerRef.current = type === 'lavaSmashBall' ? 0.16 : 0.35;
      const p = groupRef.current.position.clone();
      p.x += (Math.random() - 0.5) * 0.3;
      p.y += radius + Math.random() * 0.2;
      p.z += (Math.random() - 0.5) * 0.3;
      projectilesRef.current?.spawnAmbientParticle(p, config.color);
    }

    // Nearest target among player + living helpers + living civilians.
    let targetPos: THREE.Vector3 | null = ignorePlayer ? null : playerRef.current.position;
    let bestDist = ignorePlayer
      ? Infinity
      : Math.hypot(playerRef.current.position.x - groupRef.current.position.x, playerRef.current.position.z - groupRef.current.position.z);
    helpers.forEach((h) => {
      if (h.health <= 0) return;
      const d = Math.hypot(h.position.x - groupRef.current!.position.x, h.position.z - groupRef.current!.position.z);
      if (d < bestDist) {
        bestDist = d;
        targetPos = h.position;
      }
    });
    civilians.forEach((c) => {
      if (c.health <= 0) return;
      const d = Math.hypot(c.position.x - groupRef.current!.position.x, c.position.z - groupRef.current!.position.z);
      if (d < bestDist) {
        bestDist = d;
        targetPos = c.position;
      }
    });

    const prevX = groupRef.current.position.x;
    const prevZ = groupRef.current.position.z;
    const pos = groupRef.current.position;
    const mat = mesh ? (mesh.material as THREE.MeshStandardMaterial) : null;

    cooldownRef.current = Math.max(0, cooldownRef.current - dt);

    if (targetPos === null || bestDist > ENEMY_CHASE_RANGE) {
      modeRef.current = 'watch';
      if (mat) mat.emissiveIntensity = 0.3;
    } else {
      const t = targetPos as THREE.Vector3;
      const dx = t.x - pos.x;
      const dz = t.z - pos.z;
      const dist = Math.hypot(dx, dz) || 0.001;

      switch (modeRef.current) {
        case 'watch': {
          // Hold at watching range; drift to maintain it.
          if (dist > SMASH_BALL_IDLE_RANGE + 2) {
            pos.x += (dx / dist) * SMASH_BALL_RETREAT_SPEED * (1 + moveSpeedBonus) * dt;
            pos.z += (dz / dist) * SMASH_BALL_RETREAT_SPEED * (1 + moveSpeedBonus) * dt;
            rollSpinRef.current += SMASH_BALL_RETREAT_SPEED * dt / radius;
          } else if (dist < SMASH_BALL_IDLE_RANGE - 3) {
            pos.x -= (dx / dist) * SMASH_BALL_RETREAT_SPEED * (1 + moveSpeedBonus) * dt;
            pos.z -= (dz / dist) * SMASH_BALL_RETREAT_SPEED * (1 + moveSpeedBonus) * dt;
            rollSpinRef.current -= SMASH_BALL_RETREAT_SPEED * dt / radius;
          }
          if (cooldownRef.current <= 0 && dist <= SMASH_BALL_IDLE_RANGE + SMASH_BALL_CHARGE_TRIGGER_RANGE) {
            modeRef.current = 'telegraph';
            modeTimerRef.current = SMASH_BALL_TELEGRAPH_SECONDS;
          }
          break;
        }
        case 'telegraph': {
          // Shiver in place, glowing brighter - the "get out of the lane" cue.
          modeTimerRef.current -= dt;
          if (mat) mat.emissiveIntensity = 1.6;
          pos.x += (Math.random() - 0.5) * 0.045;
          pos.z += (Math.random() - 0.5) * 0.045;
          if (modeTimerRef.current <= 0) {
            rollDirRef.current.set(dx / dist, 0, dz / dist);
            rollHitIdsRef.current.clear();
            modeRef.current = 'roll';
            modeTimerRef.current = SMASH_BALL_ROLL_MAX_SECONDS;
          }
          break;
        }
        case 'roll': {
          modeTimerRef.current -= dt;
          const speed = SMASH_BALL_ROLL_SPEED * (1 + moveSpeedBonus);
          pos.x += rollDirRef.current.x * speed * dt;
          pos.z += rollDirRef.current.z * speed * dt;
          rollSpinRef.current += (speed * dt) / radius;
          if (mat) mat.emissiveIntensity = 1.2;

          // Contact damage against anything in the lane (once each per roll).
          const payload: AttackPayload = { ...contactPayload, damage: contactPayload.damage + damageBonus };
          const hitRange = radius + SMASH_BALL_CONTACT_RADIUS;
          if (!ignorePlayer && !rollHitIdsRef.current.has('player')) {
            const pd = Math.hypot(playerRef.current.position.x - pos.x, playerRef.current.position.z - pos.z);
            if (pd < hitRange + HUMANOID_RADIUS) {
              rollHitIdsRef.current.add('player');
              onAttackPlayer?.(payload, pos.clone(), now, config.color, id);
            }
          }
          helpers.forEach((h) => {
            if (h.health <= 0 || rollHitIdsRef.current.has(h.id)) return;
            if (Math.hypot(h.position.x - pos.x, h.position.z - pos.z) < hitRange + HUMANOID_RADIUS) {
              rollHitIdsRef.current.add(h.id);
              onAttackHelper?.(h.id, payload, now, config.color, id);
            }
          });
          civilians.forEach((c) => {
            if (c.health <= 0 || rollHitIdsRef.current.has(c.id)) return;
            if (Math.hypot(c.position.x - pos.x, c.position.z - pos.z) < hitRange + HUMANOID_RADIUS) {
              rollHitIdsRef.current.add(c.id);
              onAttackCivilian?.(c.id, payload, now, config.color, id);
            }
          });

          if (modeTimerRef.current <= 0 || rollHitIdsRef.current.size > 0) {
            modeRef.current = 'retreat';
            cooldownRef.current = SMASH_BALL_COOLDOWN / (1 + attackSpeedBonus);
          }
          break;
        }
        case 'retreat': {
          // Roll back out to watching distance, then resume watching.
          if (mat) mat.emissiveIntensity = 0.3;
          if (dist < SMASH_BALL_IDLE_RANGE) {
            const speed = SMASH_BALL_RETREAT_SPEED * 1.6 * (1 + moveSpeedBonus);
            pos.x -= (dx / dist) * speed * dt;
            pos.z -= (dz / dist) * speed * dt;
            rollSpinRef.current -= (speed * dt) / radius;
          } else {
            modeRef.current = 'watch';
          }
          break;
        }
      }

      // Face the target; spin around the local X axis to read as rolling.
      groupRef.current.rotation.y = Math.atan2(dx, dz);
      if (mesh) mesh.rotation.x = rollSpinRef.current;
    }

    // Rolling into a wall mid-charge ends the charge.
    const resolved = resolveCircleVsBoxes(prevX, prevZ, pos.x, pos.z, radius, colliders);
    if (modeRef.current === 'roll' && (Math.abs(resolved.x - pos.x) > 0.001 || Math.abs(resolved.z - pos.z) > 0.001)) {
      modeRef.current = 'retreat';
      cooldownRef.current = SMASH_BALL_COOLDOWN / (1 + attackSpeedBonus);
    }
    pos.x = resolved.x;
    pos.z = resolved.z;
    position.copy(pos);
  });

  const healthFraction = health / Math.max(maxHealth, 1);
  return (
    <group ref={groupRef}>
      <mesh ref={meshRef} position={[0, radius, 0]} castShadow>
        <sphereGeometry args={[radius, 20, 16]} />
        <meshStandardMaterial color={config.color} emissive={config.color} emissiveIntensity={0.3} roughness={0.4} metalness={0.3} />
      </mesh>
      {showHealthBar && health > 0 && (
        <Html position={[0, radius * 2 + 0.5, 0]} center distanceFactor={12} style={{ pointerEvents: 'none' }}>
          <div
            style={{
              width: '52px',
              height: '7px',
              background: 'rgba(0,0,0,0.6)',
              border: '1px solid rgba(255,255,255,0.35)',
              borderRadius: '4px',
              overflow: 'hidden'
            }}
          >
            <div
              style={{
                width: `${Math.max(0, Math.min(100, healthFraction * 100))}%`,
                height: '100%',
                background: healthFraction > 0.5 ? 'linear-gradient(180deg,#9ccc65,#689f38)' : healthFraction > 0.25 ? 'linear-gradient(180deg,#ffd54f,#f9a825)' : 'linear-gradient(180deg,#ef5350,#c62828)',
                borderRadius: '3px'
              }}
            />
          </div>
        </Html>
      )}
    </group>
  );
};
