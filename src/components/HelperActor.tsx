import { asset } from '../world/assetPath';
import { normalizeSkinWeights } from '../world/skinWeights';
import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html, useFBX } from '@react-three/drei';
import * as THREE from 'three';
import { SkeletonUtils } from 'three-stdlib';
import { createRagdoll, RagdollHandle } from '../world/ragdoll';
import { physicsWorld } from '../world/physicsWorld';
import { circleCollidesWithBox, resolveCircleVsBoxes } from '../world/collision';
import { AABB } from '../world/worldObjects';
import { AMBIENT_PARTICLE_CONFIG, AttackPayload, CUBE_ENEMY_TYPES, ENEMY_CONFIGS, EnemyType, SMASH_BALL_TYPES, SpecialKind } from '../world/enemyConfig';
import { applyBodySliders, cacheBoneTransforms } from '../world/characterMorph';
import { StatusEffects, getSlowFactor, isFrozen, tickBurn } from '../world/statusEffects';
import { ProjectilesHandle } from './Projectiles';
import {
  CORPSE_SINK_DURATION,
  ENEMY_ATTACK_RANGE,
  ENEMY_BASE_MOVE_SPEED,
  ENEMY_CHASE_RANGE,
  ENEMY_RANGED_ATTACK_RANGE,
  EnemyState,
  FIST_HIT_RADIUS,
  FOOT_HIT_RADIUS,
  GREY_MAN_MIN_DISTANCE,
  HUMANOID_RADIUS,
  MELEE_ATTACK_COOLDOWN,
  HELPER_RANGED_COOLDOWN,
  SPECIAL_ATTACK_COOLDOWN
} from '../world/gameState';

interface HelperActorProps {
  id: string;
  health: number;
  maxHealth: number;
  punchDamage: number;
  kickDamage: number;
  moveSpeedMultiplier: number;
  attackSpeedMultiplier: number;
  tint: string;
  // When set (enemy-turned-helper), the helper renders with the enemy's own
  // color and scale rather than the player's tint at the standard helper size.
  overrideColor?: string;
  overrideSizeMultiplier?: number;
  overrideType?: EnemyType;
  // Own effect struct (see HelperState). Enemy specials now land their burn,
  // freeze, slow and stun on helpers instead of only their damage.
  statusEffects?: StatusEffects;
  onBurnDamage?: (helperId: string, amount: number) => void;
  // Ranged Helpers upgrade: kite at range and throw bolts whose damage
  // scales with punchDamage, instead of closing to melee.
  isRanged?: boolean;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  playerRef: React.RefObject<THREE.Group>;
  enemies: EnemyState[];
  colliders: AABB[];
  isPaused: boolean;
  projectilesRef?: React.RefObject<ProjectilesHandle>;
  showHealthBar?: boolean;
  onAttackEnemy: (enemyId: string, damage: number) => void;
  onSunk: (id: string) => void;
}

type HelperAnimState = 'idle' | 'walk' | 'punch' | 'kick' | 'throw' | 'dead';

const ROOT_BONE_NAME = 'mixamorigHips';
const SINK_DEPTH = 2.2;
const HELPER_CORPSE_DELAY = 15;
const HELPER_FOLLOW_DISTANCE = 1.8;

const stripRootMotion = (clip: THREE.AnimationClip) => {
  const track = clip.tracks.find((t) => t.name === `${ROOT_BONE_NAME}.position`) as THREE.VectorKeyframeTrack | undefined;
  if (!track) return;
  const values = track.values;
  const baseX = values[0];
  const baseZ = values[2];
  for (let i = 0; i < values.length; i += 3) {
    values[i] = baseX;
    values[i + 2] = baseZ;
  }
};

export const HelperActor: React.FC<HelperActorProps> = ({
  id,
  health,
  maxHealth,
  punchDamage,
  kickDamage,
  moveSpeedMultiplier,
  attackSpeedMultiplier,
  tint,
  overrideColor,
  overrideSizeMultiplier,
  overrideType,
  statusEffects,
  onBurnDamage,
  isRanged = false,
  position,
  velocity,
  playerRef,
  enemies,
  colliders,
  isPaused,
  projectilesRef,
  showHealthBar = true,
  onAttackEnemy,
  onSunk
}) => {
  const overrideConfig = overrideType ? ENEMY_CONFIGS[overrideType] : undefined;

  const groupRef = useRef<THREE.Group>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const actionsRef = useRef<{ [key in HelperAnimState]?: THREE.AnimationAction }>({});
  const currentActionRef = useRef<HelperAnimState>('idle');
  const oneShotTimerRef = useRef<number | null>(null);
  const activeTargetIdRef = useRef<string | null>(null);
  const hitRegisteredRef = useRef(false);
  const activePayloadRef = useRef<AttackPayload | null>(null);
  const attackCooldownRef = useRef(0);
  const specialCooldownRef = useRef(Math.random() * 2 + 1);
  const ambientParticleTimerRef = useRef(Math.random() * 0.4);
  const kickHitTargetsRef = useRef<Set<string>>(new Set());
  const hasSpawnedRef = useRef(false);

  const frozenRef = useRef(false);
  const deadTimeRef = useRef(0);
  const sunkNotifiedRef = useRef(false);
  const frozenBaseYRef = useRef(0);
  const materialsRef = useRef<THREE.MeshStandardMaterial[]>([]);
  const ragdollRef = useRef<RagdollHandle | null>(null);

  const rightHandBoneRef = useRef<THREE.Object3D | null>(null);
  const rightFootBoneRef = useRef<THREE.Object3D | null>(null);
  const tmpVec = useRef(new THREE.Vector3()).current;

  const baseFbx = useFBX(asset('/anims/stickman_base.fbx'));
  // Repair the >4-influence weights three silently truncates on load;
  // shared geometry means this runs once no matter how many actors mount.
  normalizeSkinWeights(baseFbx);
  const idleAnim = useFBX(asset('/anims/fighting-idle.fbx'));
  const walkAnim = useFBX(asset('/anims/walk.fbx'));
  const punchAnim = useFBX(asset('/anims/punch.fbx'));
  const kickAnim = useFBX(asset('/anims/kick.fbx'));
  const throwAnim = useFBX(asset('/anims/throw.fbx'));

  const model = useMemo(() => SkeletonUtils.clone(baseFbx) as THREE.Group, [baseFbx]);

  // Cache bone transforms synchronously during render — before any effect
  // can touch the bones — so applyBodySliders always sees the pristine pose.
  const bodyMorphCache = useMemo(() => cacheBoneTransforms(model), [model]);

  useEffect(() => {
    ragdollRef.current = createRagdoll(model, physicsWorld);
    return () => {
      ragdollRef.current?.dispose();
      ragdollRef.current = null;
    };
  }, [model]);

  // Apply bone-morph preset (tall/fat/skinny/brain head, etc.) once per mount.
  useEffect(() => {
    if (!overrideConfig?.bodySliders) return;
    applyBodySliders(model, bodyMorphCache, overrideConfig.bodySliders);
  }, [model, bodyMorphCache, overrideConfig]);

  useEffect(() => {
    const color = overrideColor ?? tint;
    const materials: THREE.MeshStandardMaterial[] = [];
    model.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const sourceMaterials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        const cloned = sourceMaterials.map((mat) => (mat as THREE.MeshStandardMaterial).clone());
        mesh.material = Array.isArray(mesh.material) ? cloned : cloned[0];
        cloned.forEach((mat) => {
          if (mat && 'color' in mat) {
            mat.color.set(color);
            if (overrideConfig?.opacity !== undefined) {
              mat.transparent = true;
              mat.opacity = overrideConfig.opacity;
            }
            if (overrideConfig?.roughness !== undefined) mat.roughness = overrideConfig.roughness;
            if (overrideConfig?.metalness !== undefined) mat.metalness = overrideConfig.metalness;
            materials.push(mat);
          }
        });
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });
    materialsRef.current = materials;
    rightHandBoneRef.current = model.getObjectByName('mixamorigRightHand') ?? null;
    rightFootBoneRef.current = model.getObjectByName('mixamorigRightFoot') ?? null;
  }, [model, tint, overrideColor, overrideConfig]);

  useEffect(() => {
    const mixer = new THREE.AnimationMixer(model);
    mixerRef.current = mixer;

    const idleClip = idleAnim.animations[0];
    const walkClip = walkAnim.animations[0];
    const punchClip = punchAnim.animations[0];
    const kickClip = kickAnim.animations[0];
    const throwClip = throwAnim.animations[0];
    [idleClip, walkClip, punchClip, kickClip, throwClip].forEach((clip) => clip && stripRootMotion(clip));

    if (idleClip) actionsRef.current.idle = mixer.clipAction(idleClip);
    if (walkClip) actionsRef.current.walk = mixer.clipAction(walkClip);
    [
      ['punch', punchClip],
      ['kick', kickClip],
      ['throw', throwClip]
    ].forEach(([key, clip]) => {
      if (!clip) return;
      const action = mixer.clipAction(clip as THREE.AnimationClip);
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
      actionsRef.current[key as HelperAnimState] = action;
    });

    actionsRef.current.idle?.play();

    return () => {
      mixer.stopAllAction();
    };
  }, [model, idleAnim, walkAnim, punchAnim, kickAnim, throwAnim]);

  const transitionTo = (next: 'idle' | 'walk', fade = 0.2) => {
    if (currentActionRef.current === next) return;
    const prevAction = actionsRef.current[currentActionRef.current];
    const nextAction = actionsRef.current[next];
    if (!nextAction) return;
    prevAction?.fadeOut(fade);
    nextAction.reset().fadeIn(fade).play();
    currentActionRef.current = next;
  };

  const playOneShot = (next: 'punch' | 'kick' | 'throw', fade = 0.12) => {
    const action = actionsRef.current[next];
    const prevAction = actionsRef.current[currentActionRef.current];
    if (!action) {
      currentActionRef.current = next;
      return;
    }
    prevAction?.fadeOut(fade);
    action.reset().fadeIn(fade).play();
    currentActionRef.current = next;
    oneShotTimerRef.current = action.getClip().duration;
  };

  useFrame((_, delta) => {
    if (isPaused) return;
    const actualDelta = Math.min(delta, 0.1);
    if (mixerRef.current) mixerRef.current.update(actualDelta);
    if (!groupRef.current || !playerRef.current) return;

    // Status effects, ticked the same way the player and civilians tick
    // theirs. Burn drains health through the same damage path an enemy hit
    // uses; freeze locks the helper in place for its duration.
    if (statusEffects) {
      const nowSec = performance.now() / 1000;
      const burn = tickBurn(statusEffects, nowSec);
      if (burn > 0) onBurnDamage?.(id, burn);
      if (isFrozen(statusEffects, nowSec) && health > 0) {
        groupRef.current.position.set(position.x, position.y, position.z);
        return;
      }
    }

    if (frozenRef.current) {
      if (velocity.lengthSq() > 0.0001) {
        ragdollRef.current?.applyImpulseToHips(velocity);
        velocity.set(0, 0, 0);
      }
      ragdollRef.current?.update();

      deadTimeRef.current += actualDelta;
      if (deadTimeRef.current > HELPER_CORPSE_DELAY) {
        const sinkProgress = Math.min(1, (deadTimeRef.current - HELPER_CORPSE_DELAY) / CORPSE_SINK_DURATION);
        groupRef.current.position.y = frozenBaseYRef.current - SINK_DEPTH * sinkProgress;
        if (sinkProgress >= 1) {
          groupRef.current.visible = false;
          if (!sunkNotifiedRef.current) {
            sunkNotifiedRef.current = true;
            ragdollRef.current?.dispose();
            onSunk(id);
          }
        }
      }
      ragdollRef.current?.getHipsWorldPosition(position);
      return;
    }

    if (health <= 0) {
      frozenRef.current = true;
      frozenBaseYRef.current = groupRef.current.position.y;
      ragdollRef.current?.activate();
      return;
    }

    if (!hasSpawnedRef.current) {
      hasSpawnedRef.current = true;
      groupRef.current.position.copy(position);
    }

    // Emit ambient particles for enemy-type helpers that have a particle config.
    if (overrideType) {
      const apc = AMBIENT_PARTICLE_CONFIG[overrideType];
      if (apc && projectilesRef) {
        ambientParticleTimerRef.current -= actualDelta;
        if (ambientParticleTimerRef.current <= 0) {
          ambientParticleTimerRef.current = apc.interval;
          const emitPos = groupRef.current.position.clone();
          emitPos.x += (Math.random() - 0.5) * 0.3;
          emitPos.y += apc.emitY + (Math.random() - 0.5) * 0.25;
          emitPos.z += (Math.random() - 0.5) * 0.3;
          projectilesRef.current?.spawnAmbientParticle(emitPos, apc.color);
        }
      }
    }

    const prevX = groupRef.current.position.x;
    const prevZ = groupRef.current.position.z;

    if (oneShotTimerRef.current !== null) {
      oneShotTimerRef.current -= actualDelta;
      if (oneShotTimerRef.current <= 0) {
        oneShotTimerRef.current = null;
        activeTargetIdRef.current = null;
        activePayloadRef.current = null;
        transitionTo('idle');
      }
    } else {
      attackCooldownRef.current = Math.max(0, attackCooldownRef.current - actualDelta);
      specialCooldownRef.current = Math.max(0, specialCooldownRef.current - actualDelta);

      let closestId: string | null = null;
      let nearestDist = Infinity;
      enemies.forEach((e) => {
        if (e.health <= 0) return;
        const d = groupRef.current!.position.distanceTo(e.position);
        if (d < nearestDist) {
          nearestDist = d;
          closestId = e.id;
        }
      });

      const engagedEnemy = nearestDist < ENEMY_CHASE_RANGE ? enemies.find((e) => e.id === closestId) ?? null : null;
      const staysAtRange = overrideConfig?.staysAtRange ?? isRanged;
      const targetPos = engagedEnemy ? engagedEnemy.position : playerRef.current.position;
      const engageRange = engagedEnemy
        ? (staysAtRange ? ENEMY_RANGED_ATTACK_RANGE : ENEMY_ATTACK_RANGE)
        : HELPER_FOLLOW_DISTANCE;

      const dx = targetPos.x - groupRef.current.position.x;
      const dz = targetPos.z - groupRef.current.position.z;
      const distance = Math.hypot(dx, dz);
      const angle = Math.atan2(dx, dz);
      let moveAngle = angle;
      let shouldMove = distance > engageRange;

      // staysAtRange helpers kite: back off when too close, like grey man.
      if (staysAtRange && engagedEnemy && distance < GREY_MAN_MIN_DISTANCE) {
        moveAngle = angle + Math.PI;
        shouldMove = true;
      }

      // Flee when badly hurt (if config specifies a threshold).
      const healthFraction = maxHealth > 0 ? health / maxHealth : 1;
      if (overrideConfig?.fleeHealthThreshold && healthFraction < overrideConfig.fleeHealthThreshold && engagedEnemy) {
        moveAngle = angle + Math.PI;
        shouldMove = true;
      }

      if (distance > 0.05) rotateTowardAngle(groupRef.current, moveAngle, 9, actualDelta);

      if (shouldMove) {
        const safeAngle = pickOpenHeading(groupRef.current.position, moveAngle, colliders, HUMANOID_RADIUS);
        rotateTowardAngle(groupRef.current, safeAngle, 9, actualDelta);
        transitionTo('walk');
        // Slow Cube's shot and anything else that slows now bites on helpers too.
        const slowFactor = statusEffects ? getSlowFactor(statusEffects, performance.now() / 1000) : 1;
        groupRef.current.translateZ(ENEMY_BASE_MOVE_SPEED * moveSpeedMultiplier * slowFactor * actualDelta);
      } else {
        transitionTo('idle');
      }

      if (engagedEnemy) {
        // Build list of usable basic attacks based on config (or defaults for
        // plain helpers that have no overrideType).
        const canPunch = overrideConfig ? overrideConfig.canPunch : true;
        const canKick  = overrideConfig ? overrideConfig.canKick  : true;
        const eligibleBasic: ('punch' | 'kick')[] = [];
        if (canPunch) eligibleBasic.push('punch');
        if (canKick)  eligibleBasic.push('kick');

        const specials = overrideConfig?.specials;
        const cooldown = overrideConfig?.specialCooldownOverride ?? (isRanged && !overrideConfig ? HELPER_RANGED_COOLDOWN : SPECIAL_ATTACK_COOLDOWN);
        const rangedSpecials = specials?.filter((s) => s.range === 'ranged') ?? [];
        // Ranged Helpers upgrade: plain helpers get a synthetic bolt whose
        // damage tracks their punch-damage stat (so it grows with picks).
        if (isRanged && rangedSpecials.length === 0) {
          rangedSpecials.push({ kind: 'greyProjectile', damage: Math.max(1, punchDamage), range: 'ranged', projectileColor: tint });
        }
        const meleeSpecials  = specials?.filter((s) => s.range === 'melee')  ?? [];
        const rangedReady = rangedSpecials.length > 0 && specialCooldownRef.current <= 0 && distance <= ENEMY_RANGED_ATTACK_RANGE;
        const meleeReady  = meleeSpecials.length  > 0 && specialCooldownRef.current <= 0 && distance <= ENEMY_ATTACK_RANGE;

        if (rangedReady) {
          const special = rangedSpecials[Math.floor(Math.random() * rangedSpecials.length)];
          triggerHelperSpecial(special, engagedEnemy, cooldown);
        } else if (meleeReady) {
          const special = meleeSpecials[Math.floor(Math.random() * meleeSpecials.length)];
          triggerHelperSpecial(special, engagedEnemy, cooldown);
        } else if (eligibleBasic.length > 0 && attackCooldownRef.current <= 0 && distance <= ENEMY_ATTACK_RANGE) {
          const choice = eligibleBasic[Math.floor(Math.random() * eligibleBasic.length)];
          if (choice === 'kick') kickHitTargetsRef.current.clear();
          activeTargetIdRef.current = engagedEnemy.id;
          hitRegisteredRef.current = false;
          activePayloadRef.current = null; // basic attack — use punchDamage/kickDamage
          playOneShot(choice);
          attackCooldownRef.current = MELEE_ATTACK_COOLDOWN / attackSpeedMultiplier;
        }
      }
    }

    // Bone hit detection — kicks are AoE (all enemies in range), punches are single-target.
    if ((currentActionRef.current === 'punch' || currentActionRef.current === 'kick') && activeTargetIdRef.current) {
      const isKick = currentActionRef.current === 'kick';
      const boneRef = isKick ? rightFootBoneRef : rightHandBoneRef;
      if (boneRef.current && (isKick || !hitRegisteredRef.current)) {
        boneRef.current.getWorldPosition(tmpVec);
        const damage = activePayloadRef.current ? activePayloadRef.current.damage : (isKick ? kickDamage : punchDamage);

        if (isKick) {
          enemies.forEach((e) => {
            if (e.health <= 0 || kickHitTargetsRef.current.has(e.id)) return;
            const hitRadius = FOOT_HIT_RADIUS + HUMANOID_RADIUS * (e.sizeMultiplier ?? 1);
            const dx = tmpVec.x - e.position.x;
            const dy = tmpVec.y - (e.position.y + 1.1);
            const dz = tmpVec.z - e.position.z;
            if (Math.hypot(dx, dy, dz) < hitRadius) {
              kickHitTargetsRef.current.add(e.id);
              onAttackEnemy(e.id, damage);
            }
          });
        } else {
          const target = enemies.find((e) => e.id === activeTargetIdRef.current);
          if (target && target.health > 0) {
            const hitRadius = FIST_HIT_RADIUS + HUMANOID_RADIUS * (target.sizeMultiplier ?? 1);
            const dx = tmpVec.x - target.position.x;
            const dy = tmpVec.y - (target.position.y + 1.1);
            const dz = tmpVec.z - target.position.z;
            if (Math.hypot(dx, dy, dz) < hitRadius) {
              hitRegisteredRef.current = true;
              onAttackEnemy(target.id, damage);
              activePayloadRef.current = null;
            }
          }
        }
      }
    }

    const resolved = resolveCircleVsBoxes(prevX, prevZ, groupRef.current.position.x, groupRef.current.position.z, HUMANOID_RADIUS, colliders);
    groupRef.current.position.x = resolved.x;
    groupRef.current.position.z = resolved.z;
    position.copy(groupRef.current.position);
  });

  // Fire a special attack toward the given target enemy.
  const triggerHelperSpecial = (special: AttackPayload & { kind: SpecialKind }, target: EnemyState, cooldownDuration: number) => {
    if (!groupRef.current) return;
    specialCooldownRef.current = cooldownDuration / attackSpeedMultiplier;

    if (special.range === 'ranged') {
      const from = groupRef.current.position.clone().add(new THREE.Vector3(0, 1.2, 0));
      const to = target.position.clone().add(new THREE.Vector3(0, 1.0, 0));
      projectilesRef?.current?.spawn({
        from,
        to,
        color: special.projectileColor ?? overrideConfig!.color,
        payload: { ...special, isProjectile: true },
        growing: special.growing,
        trail: special.trail,
        speed: special.speed,
        attackerId: id,
        shooterTeam: 'helper'
      });
      playOneShot('throw');
      return;
    }

    if (special.range === 'melee') {
      kickHitTargetsRef.current.clear();
      activePayloadRef.current = special;
      activeTargetIdRef.current = target.id;
      hitRegisteredRef.current = false;
      playOneShot('punch');
      return;
    }

    // Self specials (e.g. invisibility) are skipped for helpers.
  };

  // Enemy-turned-helpers use the enemy base scale (0.012) so they look the same
  // size as they did as enemies; plain helpers use the smaller 0.009 scale.
  const modelScale = overrideSizeMultiplier !== undefined ? 0.012 * overrideSizeMultiplier : 0.009;

  const healthFraction = health / Math.max(maxHealth, 1);
  // Cube and smash-ball enemy types are not humanoids. Recruiting one as a
  // helper previously still drew the stickman rig, so a Slime Block ally
  // looked like a green man — the AI was right, the body was wrong.
  const shape: 'cube' | 'ball' | 'humanoid' = overrideType
    ? CUBE_ENEMY_TYPES.includes(overrideType)
      ? 'cube'
      : SMASH_BALL_TYPES.includes(overrideType)
        ? 'ball'
        : 'humanoid'
    : 'humanoid';
  const bodyScale = overrideSizeMultiplier ?? 1;
  const bodyColor = overrideColor ?? overrideConfig?.color ?? tint ?? '#8bc34a';

  return (
    <group ref={groupRef}>
      {shape === 'humanoid' && <primitive object={model} scale={modelScale} />}
      {shape === 'cube' && (
        <mesh position={[0, 0.45 * bodyScale, 0]} castShadow>
          <boxGeometry args={[0.9 * bodyScale, 0.9 * bodyScale, 0.9 * bodyScale]} />
          <meshStandardMaterial
            color={bodyColor}
            roughness={overrideConfig?.roughness ?? 0.6}
            metalness={overrideConfig?.metalness ?? 0}
            transparent={overrideConfig?.opacity !== undefined}
            opacity={overrideConfig?.opacity ?? 1}
          />
        </mesh>
      )}
      {shape === 'ball' && (
        <mesh position={[0, 0.5 * bodyScale, 0]} castShadow>
          <sphereGeometry args={[0.5 * bodyScale, 18, 18]} />
          <meshStandardMaterial
            color={bodyColor}
            roughness={overrideConfig?.roughness ?? 0.5}
            metalness={overrideConfig?.metalness ?? 0.1}
          />
        </mesh>
      )}
      {overrideColor !== undefined && (
        <mesh rotation-x={-Math.PI / 2} position={[0, 0.02, 0]}>
          <circleGeometry args={[0.55, 24]} />
          <meshBasicMaterial color="#00ff44" opacity={0.65} transparent />
        </mesh>
      )}
      {showHealthBar && health > 0 && (
        <Html position={[0, 2.05, 0]} center distanceFactor={12} style={{ pointerEvents: 'none' }}>
          <div
            style={{
              width: '52px',
              height: '7px',
              background: 'rgba(0,0,0,0.6)',
              border: '1px solid rgba(105,240,174,0.6)',
              borderRadius: '4px',
              overflow: 'hidden'
            }}
          >
            <div
              style={{
                width: `${Math.max(0, Math.min(100, healthFraction * 100))}%`,
                height: '100%',
                background: 'linear-gradient(180deg,#69f0ae,#00c853)',
                borderRadius: '3px'
              }}
            />
          </div>
        </Html>
      )}
    </group>
  );
};

const rotateTowardAngle = (group: THREE.Group, angle: number, turnRateExp: number, actualDelta: number) => {
  const current = group.rotation.y;
  let diff = angle - current;
  diff = Math.atan2(Math.sin(diff), Math.cos(diff));
  const alpha = 1 - Math.exp(-turnRateExp * actualDelta);
  group.rotation.y += diff * alpha;
};

const WALL_AVOID_LOOKAHEAD = 0.9;
const WALL_AVOID_OFFSETS = [0, Math.PI / 4, -Math.PI / 4, Math.PI / 2, -Math.PI / 2, (Math.PI * 3) / 4, -(Math.PI * 3) / 4];

const pickOpenHeading = (pos: THREE.Vector3, desiredAngle: number, colliders: AABB[], radius: number): number => {
  for (const offset of WALL_AVOID_OFFSETS) {
    const angle = desiredAngle + offset;
    const testX = pos.x + Math.sin(angle) * WALL_AVOID_LOOKAHEAD;
    const testZ = pos.z + Math.cos(angle) * WALL_AVOID_LOOKAHEAD;
    if (!colliders.some((box) => circleCollidesWithBox(testX, testZ, radius, box))) return angle;
  }
  return desiredAngle;
};
