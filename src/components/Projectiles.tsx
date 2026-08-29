import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { AttackPayload } from '../world/enemyConfig';
import { CROSSOVER_BALL_MASS, CROSSOVER_MAGNUS_K, CivilianState, EnemyState, HUMANOID_RADIUS, HelperState } from '../world/gameState';
import { AABB } from '../world/worldObjects';

export interface ProjectileSpawnConfig {
  from: THREE.Vector3;
  to: THREE.Vector3;
  color: string;
  payload: AttackPayload;
  growing?: boolean;
  trail?: boolean;
  speed?: number;
  attackerId?: string;
  // When set, this helper is checked for collision before the player so
  // helper-aimed projectiles aren't intercepted by the player walking between them.
  targetHelperId?: string;
  // Same priority treatment for a projectile aimed at a specific civilian.
  targetCivilianId?: string;
  // 'helper' projectiles skip the player/helpers and instead check enemies.
  shooterTeam?: 'enemy' | 'helper';
  // Striker's football: angular velocity (rad/s) about the vertical axis. The
  // heading is bent by the resulting Magnus acceleration every frame; the side
  // it bends toward is randomised per shot so the same enemy isn't readable.
  curveSpin?: number;
}

export interface ProjectilesHandle {
  spawn: (config: ProjectileSpawnConfig) => void;
  spawnAmbientParticle: (position: THREE.Vector3, color: string) => void;
}

interface ProjectilesProps {
  playerRef: React.RefObject<THREE.Group>;
  helpers: HelperState[];
  enemies?: EnemyState[];
  civilians?: CivilianState[];
  // Destructible cover: bolts die against crates/walls that are tall
  // enough to intercept their flight height.
  colliders?: AABB[];
  onHitPlayer: (payload: AttackPayload, attackerPosition: THREE.Vector3, now: number, attackerColor: string, attackerId: string) => void;
  onHitHelper: (helperId: string, payload: AttackPayload, now: number, attackerColor: string, attackerId?: string) => void;
  onHitEnemy?: (enemyId: string, damage: number, now: number) => void;
  onHitCivilian?: (civilianId: string, payload: AttackPayload, now: number, attackerColor: string, attackerId?: string) => void;
}

const CURVE_AXIS = new THREE.Vector3(0, 1, 0);

const POOL_SIZE = 16;
const TRAIL_POOL_SIZE = 128;
const BASE_RADIUS = 0.12;
const MAX_DISTANCE = 40;
const HIT_RADIUS = 0.5;
const GROWTH_RATE = 0.12;

interface ProjectileSlot {
  active: boolean;
  direction: THREE.Vector3;
  traveled: number;
  speed: number;
  color: string;
  payload: AttackPayload | null;
  growing: boolean;
  trail: boolean;
  attackerPosition: THREE.Vector3;
  attackerId: string;
  trailTimer: number;
  targetHelperId: string | null;
  targetCivilianId: string | null;
  shooterTeam: 'enemy' | 'helper';
  // Signed: magnitude is the spin, sign is which way this particular shot bends.
  curveSpin: number;
}

interface TrailSlot {
  active: boolean;
  age: number;
}

export const Projectiles = forwardRef<ProjectilesHandle, ProjectilesProps>(({ playerRef, helpers, enemies, civilians, colliders, onHitPlayer, onHitHelper, onHitEnemy, onHitCivilian }, ref) => {
  const helpersRef = useRef(helpers);
  helpersRef.current = helpers;
  const enemiesRef = useRef(enemies ?? []);
  enemiesRef.current = enemies ?? [];
  const civiliansRef = useRef(civilians ?? []);
  civiliansRef.current = civilians ?? [];
  const collidersRef = useRef(colliders ?? []);
  collidersRef.current = colliders ?? [];

  const meshes = useRef<THREE.Mesh[]>([]);
  const slots = useRef<ProjectileSlot[]>(
    Array.from({ length: POOL_SIZE }, () => ({
      active: false,
      direction: new THREE.Vector3(),
      traveled: 0,
      speed: 9,
      color: '#ffffff',
      payload: null,
      growing: false,
      trail: false,
      attackerPosition: new THREE.Vector3(),
      attackerId: '',
      trailTimer: 0,
      targetHelperId: null,
      targetCivilianId: null,
      shooterTeam: 'enemy' as 'enemy' | 'helper',
      curveSpin: 0
    }))
  );
  const nextIndex = useRef(0);

  const trailMeshes = useRef<THREE.Mesh[]>([]);
  const trailSlots = useRef<TrailSlot[]>(Array.from({ length: TRAIL_POOL_SIZE }, () => ({ active: false, age: 0 })));
  const nextTrailIndex = useRef(0);

  const spawnTrailParticle = (position: THREE.Vector3, color: string) => {
    const i = nextTrailIndex.current;
    nextTrailIndex.current = (nextTrailIndex.current + 1) % TRAIL_POOL_SIZE;
    const mesh = trailMeshes.current[i];
    const slot = trailSlots.current[i];
    if (!mesh) return;
    slot.active = true;
    slot.age = 0;
    mesh.position.copy(position);
    mesh.scale.setScalar(1);
    mesh.visible = true;
    const mat = mesh.material as THREE.MeshStandardMaterial;
    mat.color.set(color);
    mat.emissive.set(color);
  };

  useImperativeHandle(ref, () => ({
    spawn(config) {
      const i = nextIndex.current;
      nextIndex.current = (nextIndex.current + 1) % POOL_SIZE;
      const mesh = meshes.current[i];
      const slot = slots.current[i];
      if (!mesh) return;
      slot.active = true;
      slot.traveled = 0;
      slot.speed = config.speed ?? 9;
      slot.color = config.color;
      slot.payload = config.payload;
      slot.growing = config.growing ?? false;
      slot.trail = config.trail ?? false;
      slot.attackerPosition.copy(config.from);
      slot.attackerId = config.attackerId ?? '';
      slot.trailTimer = 0;
      slot.targetHelperId = config.targetHelperId ?? null;
      slot.targetCivilianId = config.targetCivilianId ?? null;
      slot.shooterTeam = config.shooterTeam ?? 'enemy';
      slot.curveSpin = (config.curveSpin ?? 0) * (Math.random() < 0.5 ? -1 : 1);
      slot.direction.copy(config.to).sub(config.from);
      slot.direction.y = 0;
      if (slot.direction.lengthSq() < 1e-6) slot.direction.set(0, 0, 1);
      slot.direction.normalize();
      mesh.position.copy(config.from);
      mesh.visible = true;
      mesh.scale.setScalar(1);
      const mat = mesh.material as THREE.MeshStandardMaterial;
      mat.color.set(config.color);
      mat.emissive.set(config.color);
    },
    spawnAmbientParticle(position, color) {
      spawnTrailParticle(position, color);
    }
  }));

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    const now = state.clock.elapsedTime;
    const playerPos = playerRef.current?.position;

    slots.current.forEach((slot, i) => {
      if (!slot.active) return;
      const mesh = meshes.current[i];
      if (!mesh) return;
      // Magnus curve. Perpendicular acceleration is (k/m)*omega*v, and since
      // direction is a unit vector travelling at `speed`, that acceleration is
      // exactly a turn rate of (k/m)*omega radians per second about Y — the
      // speed cancels, so the heading bends at a constant rate regardless of
      // how fast the ball was struck.
      if (slot.curveSpin !== 0) {
        slot.direction.applyAxisAngle(
          CURVE_AXIS,
          (CROSSOVER_MAGNUS_K / CROSSOVER_BALL_MASS) * slot.curveSpin * dt
        );
      }
      const step = slot.speed * dt;
      mesh.position.addScaledVector(slot.direction, step);
      slot.traveled += step;
      if (slot.growing) mesh.scale.setScalar(1 + slot.traveled * GROWTH_RATE);

      if (slot.trail) {
        slot.trailTimer += dt;
        if (slot.trailTimer > 0.04) {
          slot.trailTimer = 0;
          spawnTrailParticle(mesh.position, slot.color);
        }
      }

      // Destructible cover: a crate/wall tall enough to intercept the bolt's
      // flight height stops it dead (with a puff where it struck).
      const px = mesh.position.x;
      const pz = mesh.position.z;
      for (const box of collidersRef.current) {
        if (px >= box.minX && px <= box.maxX && pz >= box.minZ && pz <= box.maxZ && mesh.position.y <= box.topY) {
          spawnTrailParticle(mesh.position, slot.color);
          slot.active = false;
          mesh.visible = false;
          slot.payload = null;
          break;
        }
      }
      if (!slot.active) return;

      const projRadius = HIT_RADIUS * (slot.growing ? 1 + slot.traveled * GROWTH_RATE : 1);

      const projHitRadius = projRadius + HUMANOID_RADIUS;
      const inRange = (px: number, py: number, pz: number, targetY = 1.0) =>
        Math.hypot(mesh.position.x - px, mesh.position.y - (py + targetY), mesh.position.z - pz) < projHitRadius;

      let hit = false;
      let hitHelperId: string | null = null;
      let hitEnemyId: string | null = null;
      let hitCivilianId: string | null = null;

      if (slot.shooterTeam === 'helper') {
        // Helper projectiles only collide with living enemies.
        for (const e of enemiesRef.current) {
          if (e.health <= 0) continue;
          if (inRange(e.position.x, e.position.y, e.position.z)) {
            if (e.type === 'reflectorMan') {
              // Mirror-polish: the bolt bounces straight back on the ENEMY
              // team - same payload, now hunting the player/helpers instead.
              slot.direction.multiplyScalar(-1);
              slot.shooterTeam = 'enemy';
              slot.traveled = 0;
              slot.attackerId = e.id;
              slot.attackerPosition.copy(e.position);
              slot.targetHelperId = null;
              slot.targetCivilianId = null;
            } else {
              hitEnemyId = e.id;
            }
            break;
          }
        }
      } else {
        // Enemy projectiles: the specifically-targeted helper/civilian is
        // checked first so the player can't accidentally intercept a special
        // aimed at someone else.
        if (slot.targetHelperId) {
          const intended = helpersRef.current.find((h) => h.id === slot.targetHelperId);
          if (intended && intended.health > 0 && inRange(intended.position.x, intended.position.y, intended.position.z))
            hitHelperId = intended.id;
        }
        if (!hitHelperId && slot.targetCivilianId) {
          const intended = civiliansRef.current.find((c) => c.id === slot.targetCivilianId);
          if (intended && intended.health > 0 && inRange(intended.position.x, intended.position.y, intended.position.z))
            hitCivilianId = intended.id;
        }
        if (!hitHelperId && !hitCivilianId) {
          if (playerPos && inRange(playerPos.x, playerPos.y, playerPos.z)) hit = true;
          if (!hit) {
            for (const h of helpersRef.current) {
              if (h.id === slot.targetHelperId) continue;
              if (h.health > 0 && inRange(h.position.x, h.position.y, h.position.z)) { hitHelperId = h.id; break; }
            }
          }
          if (!hit && !hitHelperId) {
            for (const c of civiliansRef.current) {
              if (c.id === slot.targetCivilianId) continue;
              if (c.health > 0 && inRange(c.position.x, c.position.y, c.position.z)) { hitCivilianId = c.id; break; }
            }
          }
        }
      }

      if (hit && slot.payload) {
        onHitPlayer(slot.payload, slot.attackerPosition, now, slot.color, slot.attackerId);
      }
      if (hitHelperId && slot.payload) {
        onHitHelper(hitHelperId, slot.payload, now, slot.color, slot.attackerId);
      }
      if (hitEnemyId && slot.payload && onHitEnemy) {
        onHitEnemy(hitEnemyId, slot.payload.damage, now);
      }
      if (hitCivilianId && slot.payload && onHitCivilian) {
        onHitCivilian(hitCivilianId, slot.payload, now, slot.color, slot.attackerId);
      }

      if (hit || hitHelperId !== null || hitEnemyId !== null || hitCivilianId !== null || slot.traveled > MAX_DISTANCE) {
        slot.active = false;
        mesh.visible = false;
        slot.payload = null;
      }
    });

    trailSlots.current.forEach((slot, i) => {
      if (!slot.active) return;
      const mesh = trailMeshes.current[i];
      if (!mesh) return;
      slot.age += dt;
      const life = 0.4;
      if (slot.age > life) {
        slot.active = false;
        mesh.visible = false;
        return;
      }
      mesh.scale.setScalar(1 - slot.age / life);
    });
  });

  return (
    <group>
      {Array.from({ length: POOL_SIZE }).map((_, i) => (
        <mesh
          key={`proj-${i}`}
          ref={(el) => {
            if (el) meshes.current[i] = el;
          }}
          visible={false}
        >
          <sphereGeometry args={[BASE_RADIUS, 10, 10]} />
          <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.8} roughness={0.4} />
        </mesh>
      ))}
      {Array.from({ length: TRAIL_POOL_SIZE }).map((_, i) => (
        <mesh
          key={`trail-${i}`}
          ref={(el) => {
            if (el) trailMeshes.current[i] = el;
          }}
          visible={false}
        >
          <sphereGeometry args={[BASE_RADIUS * 0.5, 6, 6]} />
          <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.7} roughness={0.6} />
        </mesh>
      ))}
    </group>
  );
});

Projectiles.displayName = 'Projectiles';
