import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { resolveCircleVsBoxes } from '../world/collision';
import { AABB } from '../world/worldObjects';
import { AttackPayload, ENEMY_CONFIGS, EnemyType, SpecialKind } from '../world/enemyConfig';
import { ProjectilesHandle } from './Projectiles';
import {
  CORPSE_SINK_DELAY,
  CORPSE_SINK_DURATION,
  CivilianState,
  ENEMY_CHASE_RANGE,
  ENEMY_RANGED_ATTACK_RANGE,
  GREY_MAN_MIN_DISTANCE,
  HUMANOID_RADIUS,
  HelperState,
  PULSE_CUBE_RANGE,
  SLIME_KING_SPAWN_COOLDOWN,
  SPECIAL_ATTACK_COOLDOWN
} from '../world/gameState';

interface CubeEnemyActorProps {
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
  // Shocker Cube's AOE pulse needs direct attack callbacks (no projectile).
  onAttackPlayer?: (payload: AttackPayload, attackerPosition: THREE.Vector3, now: number, attackerColor: string, attackerId: string) => void;
  onAttackHelper?: (helperId: string, payload: AttackPayload, now: number, attackerColor: string, attackerId?: string) => void;
  onAttackCivilian?: (civilianId: string, payload: AttackPayload, now: number, attackerColor: string, attackerId?: string) => void;
  // Slime King: asks GameCanvas to spawn a baby slime near this position.
  onSpawnMinion?: (position: THREE.Vector3) => void;
  onSunk: (id: string) => void;
}

const CUBE_SIZE = 0.7;
const SLIDE_SPEED = 2.4;
const SINK_DEPTH = 1.4;

// The cube enemies (Lava Split Cube, Slime Block, Shocker Cube, Slow Cube):
// no skeleton, no ragdoll - a box with eyes that turns to face its target,
// slides and tilts as it moves, kites at range firing projectiles (or, for
// the Shocker Cube, closes in and pulses an AOE stun), and on death turns
// charred black, rests, then sinks away. Splitting into minis on death
// happens in GameCanvas's handleEnemyHit, not here.
export const CubeEnemyActor: React.FC<CubeEnemyActorProps> = ({
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
  onSpawnMinion,
  onSunk
}) => {
  const config = ENEMY_CONFIGS[type];
  const groupRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const specialCooldownRef = useRef(1 + Math.random() * 2);
  const flashTimerRef = useRef(0);
  const deadRef = useRef(false);
  const deadTimeRef = useRef(0);
  const sunkNotifiedRef = useRef(false);
  const hasSpawnedRef = useRef(false);
  const slidePhaseRef = useRef(Math.random() * Math.PI * 2);
  const ambientTimerRef = useRef(Math.random() * 0.3);
  // Slime King: baby-slime spawn cooldown (ticks only with a target near).
  const minionCooldownRef = useRef(2 + Math.random() * 2);

  const size = CUBE_SIZE * sizeMultiplier;
  const special = useMemo(
    () => (config.specials && config.specials.length > 0 ? (config.specials[0] as AttackPayload & { kind: SpecialKind }) : null),
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
        // "Turns black after dying."
        if (mesh) {
          const mat = mesh.material as THREE.MeshStandardMaterial;
          mat.color.set('#0d0d0d');
          mat.emissiveIntensity = 0;
        }
      }
      // Player contact shoves the dead husk a little.
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

    // Ambient trail particles matching the body color.
    ambientTimerRef.current -= dt;
    if (ambientTimerRef.current <= 0) {
      ambientTimerRef.current = 0.25;
      const p = groupRef.current.position.clone();
      p.x += (Math.random() - 0.5) * 0.3;
      p.y += size * 0.7 + Math.random() * 0.2;
      p.z += (Math.random() - 0.5) * 0.3;
      projectilesRef.current?.spawnAmbientParticle(p, config.color);
    }

    // Nearest target among player + living helpers + living civilians.
    let targetPos: THREE.Vector3 | null = ignorePlayer ? null : playerRef.current.position;
    let bestDist = ignorePlayer
      ? Infinity
      : Math.hypot(playerRef.current.position.x - groupRef.current.position.x, playerRef.current.position.z - groupRef.current.position.z);
    let targetHelperId: string | undefined;
    let targetCivilianId: string | undefined;
    let targetIsPlayer = !ignorePlayer;
    helpers.forEach((h) => {
      if (h.health <= 0) return;
      const d = Math.hypot(h.position.x - groupRef.current!.position.x, h.position.z - groupRef.current!.position.z);
      if (d < bestDist) {
        bestDist = d;
        targetPos = h.position;
        targetHelperId = h.id;
        targetCivilianId = undefined;
        targetIsPlayer = false;
      }
    });
    civilians.forEach((c) => {
      if (c.health <= 0) return;
      const d = Math.hypot(c.position.x - groupRef.current!.position.x, c.position.z - groupRef.current!.position.z);
      if (d < bestDist) {
        bestDist = d;
        targetPos = c.position;
        targetCivilianId = c.id;
        targetHelperId = undefined;
        targetIsPlayer = false;
      }
    });

    const prevX = groupRef.current.position.x;
    const prevZ = groupRef.current.position.z;
    let moving = false;

    if (targetPos !== null && bestDist < ENEMY_CHASE_RANGE) {
      const t = targetPos as THREE.Vector3;
      const dx = t.x - groupRef.current.position.x;
      const dz = t.z - groupRef.current.position.z;
      const dist = Math.hypot(dx, dz) || 0.001;

      // Turn to face the target (eyes forward = local +Z).
      const desiredYaw = Math.atan2(dx, dz);
      let yawDiff = desiredYaw - groupRef.current.rotation.y;
      yawDiff = Math.atan2(Math.sin(yawDiff), Math.cos(yawDiff));
      groupRef.current.rotation.y += yawDiff * (1 - Math.exp(-8 * dt));

      // Movement: pulse cubes close to point-blank; the others kite.
      let dir = 0;
      if (config.isPulseCube) {
        if (dist > PULSE_CUBE_RANGE * 0.85) dir = 1;
      } else {
        if (dist > ENEMY_RANGED_ATTACK_RANGE * 0.8) dir = 1;
        else if (dist < GREY_MAN_MIN_DISTANCE) dir = -1;
      }
      if (dir !== 0) {
        const speed = SLIDE_SPEED * config.moveSpeedMultiplier * (1 + moveSpeedBonus) * dir;
        groupRef.current.position.x += (dx / dist) * speed * dt;
        groupRef.current.position.z += (dz / dist) * speed * dt;
        moving = true;
      }

      // Slime King: with a target in range, keep birthing baby slimes.
      if (config.isSlimeKing && onSpawnMinion) {
        minionCooldownRef.current -= dt;
        if (minionCooldownRef.current <= 0) {
          minionCooldownRef.current = SLIME_KING_SPAWN_COOLDOWN / (1 + attackSpeedBonus);
          const birthPos = groupRef.current.position.clone();
          birthPos.x += (Math.random() - 0.5) * 1.6;
          birthPos.z += (Math.random() - 0.5) * 1.6;
          for (let i = 0; i < 6; i++) {
            const p = birthPos.clone();
            p.x += (Math.random() - 0.5) * 0.5;
            p.y += 0.2 + Math.random() * 0.5;
            p.z += (Math.random() - 0.5) * 0.5;
            projectilesRef.current?.spawnAmbientParticle(p, '#66bb6a');
          }
          onSpawnMinion(birthPos);
        }
      }

      specialCooldownRef.current -= dt;
      if (special && specialCooldownRef.current <= 0) {
        const cooldown = (config.specialCooldownOverride ?? SPECIAL_ATTACK_COOLDOWN) / (1 + attackSpeedBonus);
        if (config.isPulseCube) {
          // Shocker Cube: AOE stun pulse around itself once in range.
          if (dist <= PULSE_CUBE_RANGE) {
            specialCooldownRef.current = cooldown;
            flashTimerRef.current = 0.25;
            const center = groupRef.current.position;
            for (let i = 0; i < 12; i++) {
              const a = (i / 12) * Math.PI * 2;
              const p = new THREE.Vector3(center.x + Math.cos(a) * 1.1, 0.35, center.z + Math.sin(a) * 1.1);
              projectilesRef.current?.spawnAmbientParticle(p, config.color);
            }
            const payload: AttackPayload = { ...special, range: 'melee', damage: special.damage + damageBonus };
            const inPulse = (px: number, pz: number) => Math.hypot(px - center.x, pz - center.z) <= PULSE_CUBE_RANGE;
            if (!ignorePlayer && inPulse(playerRef.current.position.x, playerRef.current.position.z)) {
              onAttackPlayer?.(payload, center.clone(), now, config.color, id);
            }
            helpers.forEach((h) => {
              if (h.health > 0 && inPulse(h.position.x, h.position.z)) onAttackHelper?.(h.id, payload, now, config.color, id);
            });
            civilians.forEach((c) => {
              if (c.health > 0 && inPulse(c.position.x, c.position.z)) onAttackCivilian?.(c.id, payload, now, config.color, id);
            });
          }
        } else if (dist <= ENEMY_RANGED_ATTACK_RANGE) {
          specialCooldownRef.current = cooldown;
          const from = groupRef.current.position.clone().add(new THREE.Vector3(0, size * 0.7, 0));
          const to = t.clone().add(new THREE.Vector3(0, 1.0, 0));
          projectilesRef.current?.spawn({
            from,
            to,
            color: special.projectileColor ?? config.color,
            payload: { ...special, damage: special.damage + damageBonus, isProjectile: true },
            trail: special.trail,
            attackerId: id,
            targetHelperId,
            targetCivilianId: targetIsPlayer ? undefined : targetCivilianId
          });
        }
      }
    }

    // Slide feel: bob and tilt while moving; brief emissive flash after a pulse.
    slidePhaseRef.current += dt * (moving ? 9 : 2.5);
    if (mesh) {
      mesh.position.y = size / 2 + Math.abs(Math.sin(slidePhaseRef.current)) * (moving ? 0.09 : 0.03);
      mesh.rotation.z = moving ? Math.sin(slidePhaseRef.current) * 0.12 : 0;
      mesh.rotation.x = moving ? Math.cos(slidePhaseRef.current * 0.7) * 0.08 : 0;
      const mat = mesh.material as THREE.MeshStandardMaterial;
      if (flashTimerRef.current > 0) {
        flashTimerRef.current -= dt;
        mat.emissiveIntensity = 2.2;
      } else {
        mat.emissiveIntensity = 0.35;
      }
    }

    const resolved = resolveCircleVsBoxes(prevX, prevZ, groupRef.current.position.x, groupRef.current.position.z, HUMANOID_RADIUS * sizeMultiplier, colliders);
    groupRef.current.position.x = resolved.x;
    groupRef.current.position.z = resolved.z;
    position.copy(groupRef.current.position);
  });

  const healthFraction = health / Math.max(maxHealth, 1);
  const eyeOffsetX = size * 0.19;
  const eyeY = size * 0.14;
  const eyeZ = size / 2 + 0.015;
  return (
    <group ref={groupRef}>
      <mesh ref={meshRef} position={[0, size / 2, 0]} castShadow>
        <boxGeometry args={[size, size, size]} />
        <meshStandardMaterial color={config.color} emissive={config.color} emissiveIntensity={0.35} roughness={0.5} />
        {/* Eyes on the front face (local +Z = facing direction). */}
        {[-1, 1].map((side) => (
          <group key={side} position={[eyeOffsetX * side, eyeY, eyeZ]}>
            <mesh>
              <sphereGeometry args={[size * 0.11, 10, 8]} />
              <meshStandardMaterial color="#ffffff" roughness={0.3} />
            </mesh>
            <mesh position={[0, 0, size * 0.07]}>
              <sphereGeometry args={[size * 0.05, 8, 6]} />
              <meshStandardMaterial color="#111111" roughness={0.25} />
            </mesh>
          </group>
        ))}
        {/* Slime King's golden crown: band + four spikes on the top face. */}
        {config.isSlimeKing && (
          <group position={[0, size / 2 + size * 0.07, 0]}>
            <mesh castShadow>
              <cylinderGeometry args={[size * 0.24, size * 0.27, size * 0.12, 10]} />
              <meshStandardMaterial color="#ffd54f" metalness={0.75} roughness={0.25} emissive="#ffb300" emissiveIntensity={0.25} />
            </mesh>
            {[0, 1, 2, 3].map((i) => {
              const a = (i / 4) * Math.PI * 2;
              return (
                <mesh key={i} position={[Math.cos(a) * size * 0.19, size * 0.12, Math.sin(a) * size * 0.19]} castShadow>
                  <coneGeometry args={[size * 0.05, size * 0.16, 6]} />
                  <meshStandardMaterial color="#ffd54f" metalness={0.75} roughness={0.25} emissive="#ffb300" emissiveIntensity={0.25} />
                </mesh>
              );
            })}
          </group>
        )}
      </mesh>
      {showHealthBar && health > 0 && (
        <Html position={[0, size + 0.55, 0]} center distanceFactor={12} style={{ pointerEvents: 'none' }}>
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
