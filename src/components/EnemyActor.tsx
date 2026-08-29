import { asset } from '../world/assetPath';
import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useFBX, Html } from '@react-three/drei';
import * as THREE from 'three';
import { SkeletonUtils } from 'three-stdlib';
import { createRagdoll, RagdollHandle } from '../world/ragdoll';
import { physicsWorld } from '../world/physicsWorld';
import { circleCollidesWithBox, resolveCircleVsBoxes } from '../world/collision';
import { AABB } from '../world/worldObjects';
import { AMBIENT_PARTICLE_CONFIG, AttackPayload, ENEMY_CONFIGS, EnemyType, SpecialKind } from '../world/enemyConfig';
import { StatusEffects, applyMagnetDrift, isRagdollStunned } from '../world/statusEffects';
import { ProjectilesHandle } from './Projectiles';
import { applyBodySliders, cacheBoneTransforms } from '../world/characterMorph';
import { FallingChunksHandle } from './FallingChunks';
import {
  ARMOUR_PIECE_COUNT,
  ASSASSIN_BACKSTAB_MULTIPLIER,
  ASSASSIN_TELEPORT_COOLDOWN,
  BIG_HIT_REACTION_LOCK_DURATION,
  BOMBER_THROW_COOLDOWN,
  BRAIN_SPAWNER_COOLDOWN,
  BRAIN_SPAWN_CLOSE_DISTANCE,
  CLEAR_VARIANT_OPACITY,
  CivilianState,
  ENGINEER_DEPLOY_COOLDOWN,
  PHASE_DURATION_SECONDS,
  ENEMY_GUARD_FOLLOW_DISTANCE,
  PHASE_INTERVAL_SECONDS,
  PHASE_OPACITY,
  SNIPER_AIM_DURATION,
  TRAPPER_PLACE_COOLDOWN,
  CLEAR_VARIANT_WEAKNESS,
  CORPSE_SINK_DELAY,
  CORPSE_SINK_DURATION,
  ENEMY_ATTACK_RANGE,
  ENEMY_BASE_MOVE_SPEED,
  ENEMY_CHASE_RANGE,
  ENEMY_RANGED_ATTACK_RANGE,
  EnemyState,
  FIST_HIT_RADIUS,
  FOOT_HIT_RADIUS,
  GIANT_INSTANCE_DAMAGE_MULTIPLIER,
  GIANT_INSTANCE_SPEED_MULTIPLIER,
  GREY_MAN_MIN_DISTANCE,
  HUMANOID_RADIUS,
  HelperState,
  HIT_REACTION_LOCK_DURATION,
  INVISIBILITY_DURATION,
  LOW_HEALTH_FRACTION_THRESHOLD,
  MEDIC_HEAL_AMOUNT as MEDIC_HEAL_AMOUNT_VAL,
  MAGNET_PULL_SPEED,
  MAGNET_RANGE,
  MEDIC_HEAL_RADIUS as MEDIC_HEAL_RADIUS_VAL,
  MELEE_ATTACK_COOLDOWN,
  RAGE_DAMAGE_MULTIPLIER,
  RAGE_HEALTH_THRESHOLD,
  RAGE_SPEED_MULTIPLIER,
  REPULSE_PUSH_SPEED,
  REPULSE_RANGE,
  SPECIAL_ATTACK_COOLDOWN
} from '../world/gameState';

interface EnemyActorProps {
  id: string;
  type: EnemyType;
  health: number;
  maxHealth: number;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  playerRef: React.RefObject<THREE.Group>;
  playerStatusEffectsRef: React.MutableRefObject<StatusEffects>;
  helpers: HelperState[];
  enemies: EnemyState[];
  civilians?: CivilianState[];
  colliders: AABB[];
  projectilesRef: React.RefObject<ProjectilesHandle>;
  onAttackPlayer: (payload: AttackPayload, attackerPosition: THREE.Vector3, now: number, attackerColor: string, attackerId: string) => void;
  onAttackHelper: (helperId: string, payload: AttackPayload, now: number, attackerColor: string, attackerId?: string) => void;
  onAttackCivilian?: (civilianId: string, payload: AttackPayload, now: number, attackerColor: string, attackerId?: string) => void;
  onSunk: (id: string) => void;
  onSpawnAdd: (position: THREE.Vector3, kind: 'melee' | 'ranged') => void;
  onHealNearbyEnemies?: (position: THREE.Vector3, radius: number, amount: number) => void;
  // Engineer Man: asks GameCanvas to place a killable sentry turret.
  onDeployTurret?: (position: THREE.Vector3, ownerId: string) => void;
  // Bomb Man: asks GameCanvas to drop a sticky fused bomb at the target.
  onThrowBomb?: (position: THREE.Vector3, ownerId: string) => void;
  // Trapper Man: asks GameCanvas to place a near-invisible proximity mine.
  onPlaceMine?: (position: THREE.Vector3, ownerId: string) => void;
  // Armour Man: shared falling-chunk pool used when a plate breaks off.
  chunksRef?: React.RefObject<FallingChunksHandle>;
  // Phase Man: mirrors the intangibility window up to the EnemyState record
  // so every damage path can be gated off it centrally.
  onPhaseChange?: (id: string, untilMs: number) => void;
  // Copycat Man: the player's last-used attack kind, written by Player.tsx.
  playerLastAttackRef?: React.MutableRefObject<'punch' | 'kick'>;
  damageBonus: number;
  moveSpeedBonus: number;
  attackSpeedBonus: number;
  isClear?: boolean;
  isGiant?: boolean;
  sizeMultiplier?: number;
  isPaused: boolean;
  forceSinkNow?: boolean;
  colorOverride?: string;
  showLastWords?: boolean;
  ragdollStunUntilMs?: number;
  ignorePlayer?: boolean;
  // While Date.now() < this, hunt the player exclusively (set when the
  // player melees this enemy - e.g. to peel it off a fleeing civilian).
  aggroPlayerUntilMs?: number;
  // Enemy Bodyguard: the enemy it shadows + the alert window during which
  // it fights normally (opened when the protectee takes damage).
  protecteeId?: string;
  guardAlertUntilMs?: number;
  // Overhead HP bar (accessibility setting, default on).
  showHealthBar?: boolean;
  // Sandbox "Armoured" spawn option: force armour plates on any type.
  hasArmourOverride?: boolean;
}

type EnemyAnimState = 'idle' | 'walk' | 'punch' | 'kick' | 'hit' | 'bigHit' | 'throw' | 'dead';

// What this enemy is currently engaging - resolved fresh every decision
// frame from whichever of {player, ...helpers} is closest, but pinned to a
// stable lookup (kind + id) for the duration of an active swing/cast so a
// closer target appearing mid-swing doesn't retarget a hit already in
// flight onto someone else.
interface AttackTarget {
  kind: 'player' | 'helper' | 'civilian';
  helperId?: string;
  civilianId?: string;
  position: THREE.Vector3;
}

const ROOT_BONE_NAME = 'mixamorigHips';

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

const SINK_DEPTH = 2.2;

// Arena material men's skin textures: one shared THREE.Texture per URL for
// every actor instance (the map is read-only; per-instance tinting still
// works because each instance clones its materials, not the texture).
const skinTextureCache = new Map<string, THREE.Texture>();
const getSkinTexture = (url: string): THREE.Texture => {
  let tex = skinTextureCache.get(url);
  if (!tex) {
    tex = new THREE.TextureLoader().load(url);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    skinTextureCache.set(url, tex);
  }
  return tex;
};

export const EnemyActor: React.FC<EnemyActorProps> = ({
  id,
  type,
  health,
  maxHealth,
  position,
  velocity,
  playerRef,
  playerStatusEffectsRef,
  helpers,
  enemies,
  civilians = [],
  colliders,
  projectilesRef,
  onAttackPlayer,
  onAttackHelper,
  onAttackCivilian,
  onSunk,
  onSpawnAdd,
  onHealNearbyEnemies,
  onDeployTurret,
  onThrowBomb,
  onPlaceMine,
  chunksRef,
  onPhaseChange,
  playerLastAttackRef,
  damageBonus,
  moveSpeedBonus,
  attackSpeedBonus,
  isClear = false,
  isGiant = false,
  sizeMultiplier = 1,
  isPaused,
  forceSinkNow,
  colorOverride,
  showLastWords = false,
  ragdollStunUntilMs = 0,
  ignorePlayer = false,
  aggroPlayerUntilMs = 0,
  protecteeId,
  guardAlertUntilMs = 0,
  showHealthBar = true,
  hasArmourOverride = false
}) => {
  const config = ENEMY_CONFIGS[type];
  const armourEnabled = config.hasArmourPieces || hasArmourOverride;

  const groupRef = useRef<THREE.Group>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const actionsRef = useRef<{ [key in EnemyAnimState]?: THREE.AnimationAction }>({});
  // 'hit'/'bigHit' are picked randomly from these pools each time rather
  // than living under a single fixed key in actionsRef - this tracks which
  // specific variant is actually playing right now, since currentActionRef
  // only carries the logical category ('hit'/'bigHit'), not the variant.
  const hitActionsRef = useRef<THREE.AnimationAction[]>([]);
  const bigHitActionsRef = useRef<THREE.AnimationAction[]>([]);
  const activeVariantActionRef = useRef<THREE.AnimationAction | null>(null);
  const currentActionRef = useRef<EnemyAnimState>('idle');
  const oneShotTimerRef = useRef<number | null>(null);
  const activePayloadRef = useRef<AttackPayload | null>(null);
  const activeTargetRef = useRef<AttackTarget | null>(null);
  const hitRegisteredRef = useRef(false);
  const attackCooldownRef = useRef(Math.random() * 1.2);
  const specialCooldownRef = useRef(Math.random() * 2 + 1);
  const spawnerCooldownRef = useRef(Math.random() * 3 + 1);
  const invisibleUntilRef = useRef(0);
  const prevHealthRef = useRef(health);
  const hasSpawnedRef = useRef(false);
  const ambientParticleTimerRef = useRef(Math.random() * 0.4);
  const medicCrossRef = useRef<THREE.Sprite | null>(null);
  const isStunRagdollingRef = useRef(false);

  // New rare-enemy behaviors: assassin blink, engineer deploys, phase cycle,
  // sniper aim telegraph, armour cubes.
  const teleportCooldownRef = useRef(2 + Math.random() * 3);
  const engineerCooldownRef = useRef(3 + Math.random() * 3);
  const bombCooldownRef = useRef(2 + Math.random() * 3);
  const trapperCooldownRef = useRef(2 + Math.random() * 2);
  const phaseCycleTimerRef = useRef(PHASE_INTERVAL_SECONDS * (0.5 + Math.random() * 0.5));
  const phaseRemainingRef = useRef(0);
  const isPhasedRef = useRef(false);
  const sniperAimTimerRef = useRef(0);
  const sniperAimSpecialRef = useRef<(AttackPayload & { kind: SpecialKind }) | null>(null);
  const sniperAimTargetRef = useRef<AttackTarget | null>(null);
  const laserMeshRef = useRef<THREE.Mesh>(null);
  const armourCubesRef = useRef<THREE.Mesh[]>([]);

  const frozenRef = useRef(false);
  const deadTimeRef = useRef(0);
  const sunkNotifiedRef = useRef(false);
  const frozenBaseYRef = useRef(0);
  const materialsRef = useRef<THREE.MeshStandardMaterial[]>([]);
  const medicCooldownRef = useRef(Math.random() * 2 + 1);
  const lastWordsRef = useRef<string | null>(null);
  const lastWordsTimerRef = useRef(0);
  const ragdollRef = useRef<RagdollHandle | null>(null);

  const rightHandBoneRef = useRef<THREE.Object3D | null>(null);
  const rightFootBoneRef = useRef<THREE.Object3D | null>(null);
  const tmpVec = useRef(new THREE.Vector3()).current;
  const kickHitTargetsRef = useRef<Set<string>>(new Set());

  const baseFbx = useFBX(asset('/anims/stickman_base.fbx'));
  const idleAnim = useFBX(asset('/anims/fighting-idle.fbx'));
  const walkAnim = useFBX(asset('/anims/walk.fbx'));
  // Cowards flee with the goofy-run clip instead of the normal walk.
  const goofyRunAnim = useFBX(asset('/anims/goofy-running.fbx'));
  const punchAnim = useFBX(asset('/anims/punch.fbx'));
  const kickAnim = useFBX(asset('/anims/kick.fbx'));
  // A small variety pool per reaction tier - one is picked at random each
  // time a hit/bigHit reaction triggers, instead of always playing the
  // exact same flinch.
  const hitAnim = useFBX(asset('/anims/hit-to-body.fbx'));
  const kidneyHitAnim = useFBX(asset('/anims/kidney-hit.fbx'));
  const stomachHitAnim = useFBX(asset('/anims/stomach-hit.fbx'));
  // Reused purely as dramatic, non-lethal staggers at critically low health
  // - never played on an actual kill, which still skips straight to the
  // ragdoll corpse per the project's no-death-clips rule. "falling-back-death"
  // is just a leftover filename from its source library.
  const bigHitAnim = useFBX(asset('/anims/falling-back-death.fbx'));
  const bigHitToHeadAnim = useFBX(asset('/anims/big-hit-to-head.fbx'));
  const bigKidneyHitAnim = useFBX(asset('/anims/big-kidney-hit.fbx'));
  const bigSideHitAnim = useFBX(asset('/anims/big-side-hit.fbx'));
  const bigStomachHitAnim = useFBX(asset('/anims/big-stomach-hit.fbx'));
  // Windup for ranged specials (greyMan, lavaMan, purpleMan, etc.) - a
  // throwing motion reads far better than reusing the melee punch clip.
  const throwAnim = useFBX(asset('/anims/throw.fbx'));

  const model = useMemo(() => SkeletonUtils.clone(baseFbx) as THREE.Group, [baseFbx]);

  // Cached synchronously during render, right alongside the clone itself -
  // BEFORE any effect gets a chance to touch the bones. Caching inside the
  // effect below instead would re-cache the ALREADY-morphed pose on React's
  // dev-mode double-invoke of effects (mount -> cleanup -> mount again),
  // compounding the slider on top of itself every time the component mounts.
  const bodyMorphCache = useMemo(() => cacheBoneTransforms(model), [model]);

  useEffect(() => {
    ragdollRef.current = createRagdoll(model, physicsWorld);
    return () => {
      ragdollRef.current?.dispose();
      ragdollRef.current = null;
    };
  }, [model]);

  // Bone-morph presets (tall/fat/skinny/brain's big head, etc.) are applied
  // once per model mount, before the ragdoll is ever activated - safe,
  // since createRagdoll above only reads bone world position/quaternion,
  // never bone.scale. Safe to re-run (idempotent) even if this effect were
  // ever double-invoked, since it always resets from the same pristine
  // bodyMorphCache before reapplying.
  useEffect(() => {
    if (!config.bodySliders) return;
    applyBodySliders(model, bodyMorphCache, config.bodySliders);
  }, [model, bodyMorphCache]);

  useEffect(() => {
    const materials: THREE.MeshStandardMaterial[] = [];
    // Textured skins force white so the map shows untinted; the death
    // charring / aura tints still work since color multiplies the map.
    const skinTex = config.skinTexture ? getSkinTexture(config.skinTexture) : null;
    const effectiveColor = skinTex ? '#ffffff' : colorOverride ?? config.color;
    model.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const sourceMaterials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        const cloned = sourceMaterials.map((mat) => (mat as THREE.MeshStandardMaterial).clone());
        mesh.material = Array.isArray(mesh.material) ? cloned : cloned[0];
        cloned.forEach((mat) => {
          if (mat && 'color' in mat) {
            mat.color.set(effectiveColor);
            if (skinTex) {
              mat.map = skinTex;
              mat.needsUpdate = true;
            }
            if (config.opacity !== undefined) {
              mat.transparent = true;
              mat.opacity = config.opacity;
            }
            if (config.roughness !== undefined) mat.roughness = config.roughness;
            if (config.metalness !== undefined) mat.metalness = config.metalness;
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
  }, [model, config.color, config.opacity, config.skinTexture, colorOverride]);

  useEffect(() => {
    if (!config.isMedic) return;
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    const r = 10;
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.moveTo(r, 0); ctx.lineTo(size - r, 0);
    ctx.quadraticCurveTo(size, 0, size, r);
    ctx.lineTo(size, size - r);
    ctx.quadraticCurveTo(size, size, size - r, size);
    ctx.lineTo(r, size);
    ctx.quadraticCurveTo(0, size, 0, size - r);
    ctx.lineTo(0, r);
    ctx.quadraticCurveTo(0, 0, r, 0);
    ctx.closePath();
    ctx.fill();
    const arm = 22, thick = 14, cx2 = 32, cy2 = 32;
    ctx.fillStyle = '#d32f2f';
    ctx.fillRect(cx2 - arm, cy2 - thick / 2, arm * 2, thick);
    ctx.fillRect(cx2 - thick / 2, cy2 - arm, thick, arm * 2);
    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false });
    const sprite = new THREE.Sprite(mat);
    sprite.renderOrder = 2;
    sprite.scale.setScalar(22);
    const spineBone = model.getObjectByName('mixamorigSpine2');
    if (spineBone) {
      spineBone.add(sprite);
      medicCrossRef.current = sprite;
    }
    return () => {
      const s = medicCrossRef.current;
      if (!s) return;
      s.parent?.remove(s);
      (s.material as THREE.SpriteMaterial).map?.dispose();
      s.material.dispose();
      medicCrossRef.current = null;
    };
  }, [model, config.isMedic]);

  // Armour Man: metal plates strapped to the body, each sized and placed for
  // its bone. Core plates (head/chest/hips) are fixed boxes; limb guards are
  // boxes stretched along the bone segment toward the child joint, so they
  // ride and BEND with the limb through animations. Pieces are hidden one at
  // a time as health thresholds are crossed (see useFrame). All dimensions
  // are bone-local units (Mixamo rigs are ~cm scale; the model root's 0.012
  // scale brings them to world size).
  useEffect(() => {
    if (!armourEnabled) return;
    const makeMaterial = () => new THREE.MeshStandardMaterial({ color: '#cfd8dc', metalness: 0.85, roughness: 0.35 });
    const cubes: THREE.Mesh[] = [];

    const corePlates: { bone: string; size: [number, number, number]; offset: [number, number, number] }[] = [
      { bone: 'mixamorigHead', size: [22, 22, 22], offset: [0, 12, 1] },
      { bone: 'mixamorigSpine2', size: [30, 26, 20], offset: [0, 8, 0] },
      { bone: 'mixamorigHips', size: [30, 14, 20], offset: [0, 2, 0] }
    ];
    corePlates.forEach(({ bone: boneName, size, offset }) => {
      const bone = model.getObjectByName(boneName);
      if (!bone) return;
      const cube = new THREE.Mesh(new THREE.BoxGeometry(...size), makeMaterial());
      cube.position.set(...offset);
      cube.castShadow = true;
      // World-space size (bone-local cm × the 0.012 model-root scale),
      // used when the plate breaks off and becomes a falling chunk.
      cube.userData.worldSize = size.map((s) => s * 0.012 * sizeMultiplier);
      bone.add(cube);
      cubes.push(cube);
    });

    const limbGuards: { bone: string; child: string; thickness: number }[] = [
      { bone: 'mixamorigLeftArm', child: 'mixamorigLeftForeArm', thickness: 10 },
      { bone: 'mixamorigRightArm', child: 'mixamorigRightForeArm', thickness: 10 },
      { bone: 'mixamorigLeftForeArm', child: 'mixamorigLeftHand', thickness: 9 },
      { bone: 'mixamorigRightForeArm', child: 'mixamorigRightHand', thickness: 9 },
      { bone: 'mixamorigLeftUpLeg', child: 'mixamorigLeftLeg', thickness: 12 },
      { bone: 'mixamorigRightUpLeg', child: 'mixamorigRightLeg', thickness: 12 },
      { bone: 'mixamorigLeftLeg', child: 'mixamorigLeftFoot', thickness: 11 },
      { bone: 'mixamorigRightLeg', child: 'mixamorigRightFoot', thickness: 11 }
    ];
    limbGuards.forEach(({ bone: boneName, child: childName, thickness }) => {
      const bone = model.getObjectByName(boneName);
      const child = model.getObjectByName(childName);
      if (!bone || !child) return;
      // The child joint's local position IS the limb segment in bone space -
      // stretch the guard along it and center it on the segment midpoint, so
      // the guard spans exactly this limb section and bends at the joints.
      const segment = child.position.clone();
      const length = segment.length();
      if (length < 1e-3) return;
      const guard = new THREE.Mesh(new THREE.BoxGeometry(thickness, length * 0.8, thickness), makeMaterial());
      guard.position.copy(segment).multiplyScalar(0.5);
      guard.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), segment.normalize());
      guard.castShadow = true;
      guard.userData.worldSize = [thickness, length * 0.8, thickness].map((s) => s * 0.012 * sizeMultiplier);
      bone.add(guard);
      cubes.push(guard);
    });

    armourCubesRef.current = cubes;
    return () => {
      cubes.forEach((c) => {
        c.parent?.remove(c);
        c.geometry.dispose();
        (c.material as THREE.MeshStandardMaterial).dispose();
      });
      armourCubesRef.current = [];
    };
  }, [model, armourEnabled]);

  useEffect(() => {
    const mixer = new THREE.AnimationMixer(model);
    mixerRef.current = mixer;

    const idleClip = idleAnim.animations[0];
    const walkClip = config.isCoward ? goofyRunAnim.animations[0] : walkAnim.animations[0];
    const punchClip = punchAnim.animations[0];
    const kickClip = kickAnim.animations[0];
    const throwClip = throwAnim.animations[0];
    const hitClips = [hitAnim, kidneyHitAnim, stomachHitAnim]
      .map((a) => a.animations[0])
      .filter((c): c is THREE.AnimationClip => !!c);
    const bigHitClips = [bigHitAnim, bigHitToHeadAnim, bigKidneyHitAnim, bigSideHitAnim, bigStomachHitAnim]
      .map((a) => a.animations[0])
      .filter((c): c is THREE.AnimationClip => !!c);
    [idleClip, walkClip, punchClip, kickClip, throwClip, ...hitClips, ...bigHitClips].forEach((clip) => clip && stripRootMotion(clip));

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
      actionsRef.current[key as EnemyAnimState] = action;
    });

    const makeOneShotAction = (clip: THREE.AnimationClip) => {
      const action = mixer.clipAction(clip);
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
      return action;
    };
    hitActionsRef.current = hitClips.map(makeOneShotAction);
    bigHitActionsRef.current = bigHitClips.map(makeOneShotAction);

    actionsRef.current.idle?.play();

    return () => {
      mixer.stopAllAction();
    };
  }, [
    model,
    idleAnim,
    walkAnim,
    goofyRunAnim,
    punchAnim,
    kickAnim,
    throwAnim,
    hitAnim,
    kidneyHitAnim,
    stomachHitAnim,
    bigHitAnim,
    bigHitToHeadAnim,
    bigKidneyHitAnim,
    bigSideHitAnim,
    bigStomachHitAnim
  ]);

  // 'hit'/'bigHit' don't live under a fixed key in actionsRef (a random
  // variant is picked each time), so resolving "whatever's currently
  // playing" has to fall back to the tracked variant for those two states.
  const getCurrentAction = (): THREE.AnimationAction | undefined => {
    if (currentActionRef.current === 'hit' || currentActionRef.current === 'bigHit') {
      return activeVariantActionRef.current ?? undefined;
    }
    return actionsRef.current[currentActionRef.current];
  };

  const transitionTo = (next: 'idle' | 'walk', fade = 0.2) => {
    if (currentActionRef.current === next) return;
    const prevAction = getCurrentAction();
    const nextAction = actionsRef.current[next];
    if (!nextAction) return;
    prevAction?.fadeOut(fade);
    nextAction.reset().fadeIn(fade).play();
    currentActionRef.current = next;
    activeVariantActionRef.current = null;
  };

  const playOneShot = (next: 'punch' | 'kick' | 'throw', fade = 0.12) => {
    const action = actionsRef.current[next];
    const prevAction = getCurrentAction();
    if (!action) {
      currentActionRef.current = next;
      return;
    }
    prevAction?.fadeOut(fade);
    action.reset().fadeIn(fade).play();
    currentActionRef.current = next;
    activeVariantActionRef.current = null;
    oneShotTimerRef.current = action.getClip().duration;
  };

  // Picks a random clip from the hit/bigHit variety pool instead of always
  // playing the exact same flinch.
  const playHitReaction = (category: 'hit' | 'bigHit', fade = 0.1) => {
    const pool = category === 'hit' ? hitActionsRef.current : bigHitActionsRef.current;
    const prevAction = getCurrentAction();
    if (pool.length === 0) {
      currentActionRef.current = category;
      activeVariantActionRef.current = null;
      return;
    }
    const action = pool[Math.floor(Math.random() * pool.length)];
    prevAction?.fadeOut(fade);
    action.reset().fadeIn(fade).play();
    currentActionRef.current = category;
    activeVariantActionRef.current = action;
    oneShotTimerRef.current = action.getClip().duration;
  };

  // Most types carry exactly one special per range; a few (the Glowing
  // Green Man) carry more than one sharing the same range - pick randomly
  // among whichever match the range currently being considered.
  const pickSpecial = (range: 'self' | 'ranged' | 'melee'): (AttackPayload & { kind: SpecialKind }) | null => {
    const matches = config.specials?.filter((s) => s.range === range) ?? [];
    if (matches.length === 0) return null;
    return matches[Math.floor(Math.random() * matches.length)];
  };

  const triggerSpecial = (now: number, target: AttackTarget, special: AttackPayload & { kind: SpecialKind }) => {
    if (!groupRef.current) return;
    const speedFactor = (1 + attackSpeedBonus) * (isGiant ? GIANT_INSTANCE_SPEED_MULTIPLIER : 1);
    const cooldown = (config.specialCooldownOverride ?? SPECIAL_ATTACK_COOLDOWN) / speedFactor;
    specialCooldownRef.current = cooldown;

    if (special.range === 'self') {
      invisibleUntilRef.current = now + INVISIBILITY_DURATION;
      return;
    }

    if (special.range === 'ranged') {
      hitRegisteredRef.current = true;
      activePayloadRef.current = null;
      activeTargetRef.current = target;
      playOneShot('throw');
      const from = groupRef.current.position.clone().add(new THREE.Vector3(0, 1.2, 0));
      const to = target.position.clone().add(new THREE.Vector3(0, 1.0, 0));
      const damageMultiplier = (isClear ? CLEAR_VARIANT_WEAKNESS : 1) * (isGiant ? GIANT_INSTANCE_DAMAGE_MULTIPLIER : 1);
      projectilesRef.current?.spawn({
        from,
        to,
        color: special.projectileColor ?? config.color,
        payload: { ...special, damage: (special.damage + damageBonus) * damageMultiplier, isProjectile: true },
        growing: special.growing,
        trail: special.trail,
        speed: special.speed,
        curveSpin: special.curveSpin,
        attackerId: id,
        targetHelperId: target.kind === 'helper' ? target.helperId : undefined,
        targetCivilianId: target.kind === 'civilian' ? target.civilianId : undefined
      });
      return;
    }

    activePayloadRef.current = special;
    activeTargetRef.current = target;
    hitRegisteredRef.current = false;
    playOneShot('punch');
  };

  const triggerBasicAttack = (kind: 'punch' | 'kick', payload: AttackPayload, target: AttackTarget) => {
    if (kind === 'kick') kickHitTargetsRef.current.clear();
    activePayloadRef.current = payload;
    activeTargetRef.current = target;
    hitRegisteredRef.current = false;
    playOneShot(kind);
    const speedFactor = config.attackSpeedMultiplier * (1 + attackSpeedBonus) * (isGiant ? GIANT_INSTANCE_SPEED_MULTIPLIER : 1);
    attackCooldownRef.current = MELEE_ATTACK_COOLDOWN / speedFactor;
  };

  const resolveTargetPosition = (target: AttackTarget): THREE.Vector3 | null => {
    if (target.kind === 'player') return playerRef.current?.position ?? null;
    if (target.kind === 'civilian') {
      const civilian = civilians.find((c) => c.id === target.civilianId && c.health > 0);
      return civilian ? civilian.position : null;
    }
    const helper = helpers.find((h) => h.id === target.helperId && h.health > 0);
    return helper ? helper.position : null;
  };

  useFrame((state, delta) => {
    if (isPaused) return;
    const actualDelta = Math.min(delta, 0.1);
    const now = state.clock.elapsedTime;
    if (mixerRef.current) mixerRef.current.update(actualDelta);
    if (!groupRef.current || !playerRef.current) return;

    // Parry stun: temporary ragdoll that disposes when the window expires.
    // Stagger-immune types (Juggernaut) shrug it off entirely.
    const stunActive = !config.staggerImmune && ragdollStunUntilMs > 0 && Date.now() < ragdollStunUntilMs;
    if (stunActive && !isStunRagdollingRef.current && !frozenRef.current) {
      isStunRagdollingRef.current = true;
      ragdollRef.current?.activate();
      const awayDir = groupRef.current.position.clone().sub(playerRef.current.position).setY(0);
      if (awayDir.lengthSq() < 0.001) awayDir.set(0, 0, 1);
      awayDir.normalize().multiplyScalar(4);
      ragdollRef.current?.applyImpulseToHips(awayDir);
    }
    if (!stunActive && isStunRagdollingRef.current && !frozenRef.current) {
      isStunRagdollingRef.current = false;
      ragdollRef.current?.dispose();
      transitionTo('idle');
    }
    if (isStunRagdollingRef.current) {
      ragdollRef.current?.update();
      ragdollRef.current?.getHipsWorldPosition(position);
      return;
    }

    if (frozenRef.current) {
      if (velocity.lengthSq() > 0.0001) {
        ragdollRef.current?.applyImpulseToHips(velocity);
        velocity.set(0, 0, 0);
      }
      ragdollRef.current?.update();
      if (lastWordsTimerRef.current > 0) lastWordsTimerRef.current -= actualDelta;

      deadTimeRef.current += actualDelta;
      if (forceSinkNow) deadTimeRef.current = Math.max(deadTimeRef.current, CORPSE_SINK_DELAY);
      if (deadTimeRef.current > CORPSE_SINK_DELAY) {
        const sinkProgress = Math.min(1, (deadTimeRef.current - CORPSE_SINK_DELAY) / CORPSE_SINK_DURATION);
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
      materialsRef.current.forEach((mat) => mat.color.set('#0a0a0a'));
      ragdollRef.current?.activate();
      if (laserMeshRef.current) laserMeshRef.current.visible = false;
      if (showLastWords && lastWordsRef.current === null) {
        const pool = ['...', 'No!', 'Ugh!', 'You got lucky!', 'I\'ll be back!', 'This isn\'t over!', 'Not bad...', 'Impossible!'];
        lastWordsRef.current = pool[Math.floor(Math.random() * pool.length)];
        lastWordsTimerRef.current = 1.5;
      }
      return;
    }

    if (!hasSpawnedRef.current) {
      hasSpawnedRef.current = true;
      groupRef.current.position.copy(position);
    }

    // Phase Man: tick the intangibility cycle, mirroring the phased window
    // up to GameCanvas (which gates every damage path off it centrally).
    if (config.isPhaser) {
      if (isPhasedRef.current) {
        phaseRemainingRef.current -= actualDelta;
        if (phaseRemainingRef.current <= 0) {
          isPhasedRef.current = false;
          phaseCycleTimerRef.current = PHASE_INTERVAL_SECONDS;
          onPhaseChange?.(id, 0);
        }
      } else {
        phaseCycleTimerRef.current -= actualDelta;
        if (phaseCycleTimerRef.current <= 0) {
          isPhasedRef.current = true;
          phaseRemainingRef.current = PHASE_DURATION_SECONDS;
          onPhaseChange?.(id, Date.now() + PHASE_DURATION_SECONDS * 1000);
        }
      }
    }
    const isPhased = isPhasedRef.current;

    const baseOpacity = isClear ? CLEAR_VARIANT_OPACITY : config.opacity ?? 1;
    const isInvisible = now < invisibleUntilRef.current;
    const targetOpacity = isPhased ? PHASE_OPACITY : isInvisible ? 0.08 : baseOpacity;
    materialsRef.current.forEach((mat) => {
      mat.transparent = targetOpacity < 1;
      mat.opacity = targetOpacity;
    });

    const apc = AMBIENT_PARTICLE_CONFIG[type];
    if (apc) {
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

    // Armour Man: hide one random remaining cube each time cumulative damage
    // crosses another (maxHealth / ARMOUR_PIECE_COUNT) threshold.
    if (armourEnabled && armourCubesRef.current.length > 0 && maxHealth > 0) {
      const expected = Math.min(ARMOUR_PIECE_COUNT, Math.ceil((health / maxHealth) * ARMOUR_PIECE_COUNT));
      const visibleCubes = armourCubesRef.current.filter((c) => c.visible);
      let toDrop = visibleCubes.length - expected;
      while (toDrop > 0 && visibleCubes.length > 0) {
        const idx = Math.floor(Math.random() * visibleCubes.length);
        const cube = visibleCubes.splice(idx, 1)[0];
        cube.visible = false;
        cube.getWorldPosition(tmpVec);
        // The knocked-off plate becomes a real falling chunk that drops and
        // lands on the ground instead of just vanishing.
        const plateQuat = new THREE.Quaternion();
        cube.getWorldQuaternion(plateQuat);
        chunksRef?.current?.spawnChunk({
          position: tmpVec.clone(),
          size: (cube.userData.worldSize as [number, number, number]) ?? [0.15, 0.15, 0.15],
          color: '#cfd8dc',
          quaternion: plateQuat,
          velocity: new THREE.Vector3((Math.random() - 0.5) * 2.4, 1.6 + Math.random() * 1.2, (Math.random() - 0.5) * 2.4)
        });
        for (let i = 0; i < 4; i++) {
          const p = tmpVec.clone();
          p.x += (Math.random() - 0.5) * 0.3;
          p.y += (Math.random() - 0.5) * 0.3;
          p.z += (Math.random() - 0.5) * 0.3;
          projectilesRef.current?.spawnAmbientParticle(p, '#cfd8dc');
        }
        toDrop--;
      }
    }

    // Sniper: while aiming, keep the laser tracking the target and fire when
    // the aim timer elapses (cancel if the target became invalid).
    if (config.isSniper && sniperAimTimerRef.current > 0 && sniperAimSpecialRef.current && sniperAimTargetRef.current) {
      const aimTargetPos = resolveTargetPosition(sniperAimTargetRef.current);
      const laser = laserMeshRef.current;
      if (!aimTargetPos) {
        sniperAimTimerRef.current = 0;
        sniperAimSpecialRef.current = null;
        if (laser) laser.visible = false;
      } else {
        const from = groupRef.current.position.clone().add(new THREE.Vector3(0, 1.2, 0));
        const to = aimTargetPos.clone().add(new THREE.Vector3(0, 1.0, 0));
        if (laser) {
          const dir = to.clone().sub(from);
          const len = Math.max(dir.length(), 0.001);
          laser.visible = true;
          laser.position.copy(from).addScaledVector(dir, 0.5);
          laser.scale.set(1, len, 1);
          laser.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
        }
        sniperAimTimerRef.current -= actualDelta;
        if (sniperAimTimerRef.current <= 0) {
          if (laser) laser.visible = false;
          triggerSpecial(now, sniperAimTargetRef.current, sniperAimSpecialRef.current);
          sniperAimSpecialRef.current = null;
        }
      }
    }

    const prevX = groupRef.current.position.x;
    const prevZ = groupRef.current.position.z;

    if (oneShotTimerRef.current !== null) {
      oneShotTimerRef.current -= actualDelta;
      if (oneShotTimerRef.current <= 0) {
        oneShotTimerRef.current = null;
        activePayloadRef.current = null;
        transitionTo('idle');
      }
    } else {
      attackCooldownRef.current = Math.max(0, attackCooldownRef.current - actualDelta);
      specialCooldownRef.current = Math.max(0, specialCooldownRef.current - actualDelta);

      if (health < prevHealthRef.current && currentActionRef.current === 'idle' && !config.staggerImmune) {
        const healthFraction = maxHealth > 0 ? health / maxHealth : 1;
        const isBigHit = healthFraction < LOW_HEALTH_FRACTION_THRESHOLD;
        playHitReaction(isBigHit ? 'bigHit' : 'hit', 0.1);
        // Cap the FSM-lock well below the clip's own length - death (checked
        // unconditionally at the top of this frame loop, every frame) always
        // wins instantly regardless, but a multi-second stagger left running
        // gives a follow-up kill a wide window to land while it's still
        // visibly playing, reading as "a hit animation played before it died."
        if (oneShotTimerRef.current !== null) {
          oneShotTimerRef.current = Math.min(oneShotTimerRef.current, isBigHit ? BIG_HIT_REACTION_LOCK_DURATION : HIT_REACTION_LOCK_DURATION);
        }
      } else {
        // Pick whichever of {player, helpers, civilians} is currently
        // closest as this frame's engagement target - unless the player
        // recently melee'd this enemy, which locks aggro onto the player
        // (so hitting an enemy chasing a civilian actually peels it off).
        let target: AttackTarget = { kind: 'player', position: playerRef.current.position };
        let bestDist = ignorePlayer ? Infinity : Math.hypot(playerRef.current.position.x - groupRef.current.position.x, playerRef.current.position.z - groupRef.current.position.z);
        const aggroOnPlayer = !ignorePlayer && aggroPlayerUntilMs > 0 && Date.now() < aggroPlayerUntilMs;
        if (!aggroOnPlayer) {
          helpers.forEach((h) => {
            if (h.health <= 0) return;
            const d = Math.hypot(h.position.x - groupRef.current!.position.x, h.position.z - groupRef.current!.position.z);
            if (d < bestDist) {
              bestDist = d;
              target = { kind: 'helper', helperId: h.id, position: h.position };
            }
          });
          // Every combat-capable enemy (melee AND ranged - projectiles
          // collide with civilians too) will hunt civilians; only the
          // never-attacking types (coward, spawners) ignore them.
          if (config.canPunch || config.canKick || (config.specials?.length ?? 0) > 0) {
            civilians.forEach((c) => {
              if (c.health <= 0) return;
              const d = Math.hypot(c.position.x - groupRef.current!.position.x, c.position.z - groupRef.current!.position.z);
              if (d < bestDist) {
                bestDist = d;
                target = { kind: 'civilian', civilianId: c.id, position: c.position };
              }
            });
          }
        }

        const dx = target.position.x - groupRef.current.position.x;
        const dz = target.position.z - groupRef.current.position.z;
        const distance = (ignorePlayer && target.kind === 'player') ? Infinity : Math.hypot(dx, dz);
        const angleToTarget = Math.atan2(dx, dz);
        const effectiveRadius = HUMANOID_RADIUS * sizeMultiplier;

        // Magnet Man drags the player toward himself; the Repulsor shoves
        // the player away. Same drift plumbing, opposite sign.
        if (target.kind === 'player' && playerStatusEffectsRef.current) {
          if (config.isMagnet && distance < MAGNET_RANGE) {
            applyMagnetDrift(playerStatusEffectsRef.current, now, groupRef.current.position, MAGNET_PULL_SPEED);
          } else if (config.isRepulsor && distance < REPULSE_RANGE) {
            applyMagnetDrift(playerStatusEffectsRef.current, now, groupRef.current.position, -REPULSE_PUSH_SPEED);
          }
        }

        const eligibleBasic: { kind: 'punch' | 'kick'; payload: AttackPayload }[] = [];
        if (config.canPunch && config.punch) eligibleBasic.push({ kind: 'punch', payload: config.punch });
        if (config.canKick && config.kick) eligibleBasic.push({ kind: 'kick', payload: config.kick });
        const meleeInRange = distance <= ENEMY_ATTACK_RANGE;
        const selfSpecial = pickSpecial('self');
        const rangedSpecial = pickSpecial('ranged');
        const meleeSpecial = pickSpecial('melee');

        const healthFraction = maxHealth > 0 ? health / maxHealth : 1;
        const isFleeing = config.fleeHealthThreshold !== undefined && healthFraction < config.fleeHealthThreshold;
        // Adaptive Man: badly hurt, he stops brawling and turns into a kiting
        // thrower - staysAtRange movement plus his ranged special unlock.
        const adaptiveRangedMode =
          config.rangedBelowHealthFraction !== undefined && healthFraction <= config.rangedBelowHealthFraction;
        const staysAtRange = config.staysAtRange || adaptiveRangedMode;

        // Enemy Bodyguard: while the protectee is alive and no alert window
        // is open, it just shadows them - no chasing, no attacking. It only
        // fights while alerted (protectee hurt) or once the protectee dies.
        const guardProtectee = config.isGuard && protecteeId ? enemies.find((en) => en.id === protecteeId && en.health > 0) : undefined;
        const guardPassive = !!guardProtectee && !(guardAlertUntilMs > 0 && Date.now() < guardAlertUntilMs);

        if (guardPassive && guardProtectee) {
          const gdx = guardProtectee.position.x - groupRef.current.position.x;
          const gdz = guardProtectee.position.z - groupRef.current.position.z;
          const gdist = Math.hypot(gdx, gdz);
          if (gdist > ENEMY_GUARD_FOLLOW_DISTANCE) {
            const ga = pickOpenHeading(groupRef.current.position, Math.atan2(gdx, gdz), colliders, effectiveRadius);
            rotateTowardAngle(groupRef.current, ga, 9, actualDelta);
            transitionTo('walk');
            groupRef.current.translateZ(ENEMY_BASE_MOVE_SPEED * config.moveSpeedMultiplier * (1 + moveSpeedBonus) * actualDelta);
          } else {
            rotateTowardAngle(groupRef.current, angleToTarget, 6, actualDelta);
            transitionTo('idle');
          }
        } else if (distance < ENEMY_CHASE_RANGE) {
          let desiredAngle = angleToTarget;
          let shouldMove: boolean;

          if (isFleeing) {
            desiredAngle = angleToTarget + Math.PI;
            shouldMove = true;
          } else if (staysAtRange) {
            if (distance > ENEMY_RANGED_ATTACK_RANGE) {
              shouldMove = true;
            } else if (distance < GREY_MAN_MIN_DISTANCE) {
              desiredAngle = angleToTarget + Math.PI;
              shouldMove = true;
            } else {
              shouldMove = false;
            }
          } else {
            shouldMove = !config.isStationary && !meleeInRange;
          }

          // Steer around obstacles directly in the way instead of just
          // facing the target and walking straight into a wall/crate.
          const moveAngle = shouldMove ? pickOpenHeading(groupRef.current.position, desiredAngle, colliders, effectiveRadius) : angleToTarget;
          rotateTowardAngle(groupRef.current, moveAngle, config.isStationary ? 6 : 9, actualDelta);

          if (shouldMove) {
            transitionTo('walk');
            const healthFractionForRage = maxHealth > 0 ? health / maxHealth : 1;
          const isRaging = config.isRageEnemy === true && healthFractionForRage < RAGE_HEALTH_THRESHOLD;
          const speed = ENEMY_BASE_MOVE_SPEED * config.moveSpeedMultiplier * (1 + moveSpeedBonus) * (isGiant ? GIANT_INSTANCE_SPEED_MULTIPLIER : 1) * (isRaging ? RAGE_SPEED_MULTIPLIER : 1);
            groupRef.current.translateZ(speed * actualDelta);
          } else {
            transitionTo('idle');
          }
        } else {
          transitionTo('idle');
        }

        const targetStunned =
          target.kind === 'player' && playerStatusEffectsRef.current ? isRagdollStunned(playerStatusEffectsRef.current, now) : false;

        // Medic: on its own cooldown, heal nearby living enemies.
        if (config.isMedic) {
          medicCooldownRef.current = Math.max(0, medicCooldownRef.current - actualDelta);
          if (medicCooldownRef.current <= 0) {
            medicCooldownRef.current = config.spawnerCooldownOverride ?? BRAIN_SPAWNER_COOLDOWN;
            onHealNearbyEnemies?.(groupRef.current.position.clone(), MEDIC_HEAL_RADIUS_VAL, MEDIC_HEAL_AMOUNT_VAL);
            // Visual pulse: flash green briefly.
            materialsRef.current.forEach((mat) => mat.color.set('#00ff88'));
            setTimeout(() => {
              materialsRef.current.forEach((mat) => mat.color.set(colorOverride ?? config.color));
            }, 250);
          }
        }

        // Engineer: on its own cooldown, drops a killable sentry turret near
        // itself whenever a target is within chase range.
        if (config.isEngineer) {
          engineerCooldownRef.current = Math.max(0, engineerCooldownRef.current - actualDelta);
          if (!targetStunned && engineerCooldownRef.current <= 0 && distance < ENEMY_CHASE_RANGE) {
            engineerCooldownRef.current = ENGINEER_DEPLOY_COOLDOWN;
            const dropPos = groupRef.current.position.clone();
            dropPos.x += (Math.random() - 0.5) * 2.5;
            dropPos.z += (Math.random() - 0.5) * 2.5;
            dropPos.y = 0;
            onDeployTurret?.(dropPos, id);
          }
        }

        // Trapper Man: drops a near-invisible mine between itself and its
        // target, betting they'll step on it while closing/fleeing.
        if (config.isTrapper) {
          trapperCooldownRef.current = Math.max(0, trapperCooldownRef.current - actualDelta);
          if (!targetStunned && trapperCooldownRef.current <= 0 && distance < ENEMY_CHASE_RANGE) {
            trapperCooldownRef.current = TRAPPER_PLACE_COOLDOWN;
            const t = 0.35 + Math.random() * 0.4;
            const mx = groupRef.current.position.x + (target.position.x - groupRef.current.position.x) * t;
            const mz = groupRef.current.position.z + (target.position.z - groupRef.current.position.z) * t;
            onPlaceMine?.(new THREE.Vector3(mx, 0, mz), id);
          }
        }

        // Bomb Man: lob a sticky bomb at the target's current position - the
        // accelerating fuse blink and ground ring are their window to move.
        let threwBomb = false;
        if (config.isBomber) {
          bombCooldownRef.current = Math.max(0, bombCooldownRef.current - actualDelta);
          if (
            !targetStunned &&
            !isPhased &&
            bombCooldownRef.current <= 0 &&
            distance > 2.5 &&
            distance < ENEMY_RANGED_ATTACK_RANGE
          ) {
            bombCooldownRef.current = BOMBER_THROW_COOLDOWN / (1 + attackSpeedBonus);
            hitRegisteredRef.current = true;
            activePayloadRef.current = null;
            playOneShot('throw');
            onThrowBomb?.(target.position.clone(), id);
            threwBomb = true;
          }
        }

        // Cloaked Assassin: on cooldown, blink to the far side of the target
        // and follow up with an immediate backstab punch at bonus damage.
        let assassinBlinked = false;
        if (config.isAssassin) {
          teleportCooldownRef.current = Math.max(0, teleportCooldownRef.current - actualDelta);
          if (
            !targetStunned &&
            teleportCooldownRef.current <= 0 &&
            distance > ENEMY_ATTACK_RANGE &&
            distance < ENEMY_CHASE_RANGE &&
            config.punch
          ) {
            teleportCooldownRef.current = ASSASSIN_TELEPORT_COOLDOWN;
            const approachDir = groupRef.current.position.clone().sub(target.position).setY(0);
            if (approachDir.lengthSq() < 0.001) approachDir.set(0, 0, 1);
            approachDir.normalize();
            const emitBlinkBurst = (center: THREE.Vector3) => {
              for (let i = 0; i < 6; i++) {
                const p = center.clone();
                p.x += (Math.random() - 0.5) * 0.5;
                p.y += 0.6 + Math.random() * 0.9;
                p.z += (Math.random() - 0.5) * 0.5;
                projectilesRef.current?.spawnAmbientParticle(p, '#78909c');
              }
            };
            emitBlinkBurst(groupRef.current.position);
            // approachDir points from target back toward where the assassin
            // was - landing at target MINUS that puts him on the far side.
            groupRef.current.position.set(
              target.position.x - approachDir.x * 1.0,
              groupRef.current.position.y,
              target.position.z - approachDir.z * 1.0
            );
            emitBlinkBurst(groupRef.current.position);
            triggerBasicAttack('punch', { ...config.punch, damage: config.punch.damage * ASSASSIN_BACKSTAB_MULTIPLIER }, target);
            assassinBlinked = true;
          }
        }

        if (config.isSpawner) {
          // Never attacks - on its own cooldown, asks GameCanvas to spawn
          // an ordinary basic enemy nearby instead: melee if its current
          // target is close, ranged (grey man) if far.
          spawnerCooldownRef.current = Math.max(0, spawnerCooldownRef.current - actualDelta);
          if (!targetStunned && spawnerCooldownRef.current <= 0) {
            const cooldownSpeedFactor = (1 + attackSpeedBonus) * (isGiant ? GIANT_INSTANCE_SPEED_MULTIPLIER : 1);
            spawnerCooldownRef.current = (config.spawnerCooldownOverride ?? BRAIN_SPAWNER_COOLDOWN) / cooldownSpeedFactor;
            onSpawnAdd(groupRef.current.position.clone(), distance < BRAIN_SPAWN_CLOSE_DISTANCE ? 'melee' : 'ranged');
          }
        } else if (!targetStunned && !assassinBlinked && !threwBomb && !isPhased && !guardPassive) {
          const rangedSpecialReady =
            !!rangedSpecial &&
            specialCooldownRef.current <= 0 &&
            distance <= ENEMY_RANGED_ATTACK_RANGE &&
            // Adaptive Man only unlocks his ranged attack once he's hurt.
            (config.rangedBelowHealthFraction === undefined || adaptiveRangedMode);
          if (selfSpecial && specialCooldownRef.current <= 0) {
            triggerSpecial(now, target, selfSpecial);
          } else if (rangedSpecialReady) {
            if (config.isSniper) {
              // Telegraph with the laser first; the actual shot fires from
              // the aim-tracking block above once the timer elapses.
              if (sniperAimTimerRef.current <= 0 && !sniperAimSpecialRef.current) {
                sniperAimTimerRef.current = SNIPER_AIM_DURATION;
                sniperAimSpecialRef.current = rangedSpecial!;
                sniperAimTargetRef.current = target;
              }
            } else {
              triggerSpecial(now, target, rangedSpecial!);
            }
          } else if (meleeInRange) {
            if (meleeSpecial && specialCooldownRef.current <= 0) {
              triggerSpecial(now, target, meleeSpecial);
            } else if (attackCooldownRef.current <= 0 && eligibleBasic.length > 0) {
              // Copycat mirrors the player's last-used attack when possible.
              const mimic = config.isCopycat && playerLastAttackRef
                ? eligibleBasic.find((b) => b.kind === playerLastAttackRef.current)
                : undefined;
              const choice = mimic ?? eligibleBasic[Math.floor(Math.random() * eligibleBasic.length)];
              triggerBasicAttack(choice.kind, choice.payload, target);
            }
          }
        }
      }
    }
    prevHealthRef.current = health;

    if (
      (currentActionRef.current === 'punch' || currentActionRef.current === 'kick') &&
      activePayloadRef.current &&
      activeTargetRef.current
    ) {
      const isKick = currentActionRef.current === 'kick';
      const boneRef = isKick ? rightFootBoneRef : rightHandBoneRef;
      if (boneRef.current && (isKick || !hitRegisteredRef.current)) {
        boneRef.current.getWorldPosition(tmpVec);
        const hitRadius = (isKick ? FOOT_HIT_RADIUS : FIST_HIT_RADIUS) + HUMANOID_RADIUS * sizeMultiplier;
        const rageDmgFraction = maxHealth > 0 ? health / maxHealth : 1;
        const isRagingDmg = config.isRageEnemy === true && rageDmgFraction < RAGE_HEALTH_THRESHOLD;
        const totalDamage =
          (activePayloadRef.current.damage + damageBonus) * (isClear ? CLEAR_VARIANT_WEAKNESS : 1) * (isGiant ? GIANT_INSTANCE_DAMAGE_MULTIPLIER : 1) * (isRagingDmg ? RAGE_DAMAGE_MULTIPLIER : 1);

        const tryHit = (targetKind: 'player' | 'helper' | 'civilian', targetId: string, targetPos: THREE.Vector3) => {
          if (kickHitTargetsRef.current.has(targetId)) return;
          const dx = tmpVec.x - targetPos.x;
          const dy = tmpVec.y - (targetPos.y + 1.1);
          const dz = tmpVec.z - targetPos.z;
          if (Math.hypot(dx, dy, dz) < hitRadius) {
            kickHitTargetsRef.current.add(targetId);
            if (targetKind === 'player') {
              hitRegisteredRef.current = true;
              onAttackPlayer({ ...activePayloadRef.current!, damage: totalDamage }, groupRef.current!.position.clone(), now, config.color, id);
            } else if (targetKind === 'civilian') {
              onAttackCivilian?.(targetId, { ...activePayloadRef.current!, damage: totalDamage }, now, config.color, id);
            } else {
              onAttackHelper(targetId, { ...activePayloadRef.current!, damage: totalDamage }, now, config.color, id);
            }
          }
        };

        if (isKick) {
          // Kicks are AoE: check the player and every living helper/civilian.
          if (playerRef.current) tryHit('player', 'player', playerRef.current.position);
          helpers.forEach((h) => { if (h.health > 0) tryHit('helper', h.id, h.position); });
          civilians.forEach((c) => { if (c.health > 0) tryHit('civilian', c.id, c.position); });
        } else {
          // Punches stay single-target (locked target only).
          if (!hitRegisteredRef.current) {
            const targetPos = resolveTargetPosition(activeTargetRef.current);
            if (targetPos) {
              const dx = tmpVec.x - targetPos.x;
              const dy = tmpVec.y - (targetPos.y + 1.1);
              const dz = tmpVec.z - targetPos.z;
              if (Math.hypot(dx, dy, dz) < hitRadius) {
                hitRegisteredRef.current = true;
                if (activeTargetRef.current.kind === 'player') {
                  onAttackPlayer({ ...activePayloadRef.current, damage: totalDamage }, groupRef.current!.position.clone(), now, config.color, id);
                } else if (activeTargetRef.current.kind === 'civilian') {
                  onAttackCivilian?.(activeTargetRef.current.civilianId!, { ...activePayloadRef.current, damage: totalDamage }, now, config.color, id);
                } else {
                  onAttackHelper(activeTargetRef.current.helperId!, { ...activePayloadRef.current, damage: totalDamage }, now, config.color, id);
                }
              }
            }
          }
        }
      }
    }

    // Phased enemies are intangible - they walk straight through walls and
    // crates instead of resolving against them.
    if (!isPhased) {
      const resolved = resolveCircleVsBoxes(
        prevX,
        prevZ,
        groupRef.current.position.x,
        groupRef.current.position.z,
        HUMANOID_RADIUS * sizeMultiplier,
        colliders
      );
      groupRef.current.position.x = resolved.x;
      groupRef.current.position.z = resolved.z;
    }

    // Separate from other living enemies so they don't overlap/clump.
    // Only living enemies block each other; dead ragdolls are shoved by the
    // player already but don't impede pathing.
    const myRadius = HUMANOID_RADIUS * sizeMultiplier;
    enemies.forEach((other) => {
      if (other.id === id || other.health <= 0) return;
      const otherRadius = HUMANOID_RADIUS * (other.sizeMultiplier ?? 1);
      const minDist = myRadius + otherRadius;
      const dx = groupRef.current!.position.x - other.position.x;
      const dz = groupRef.current!.position.z - other.position.z;
      const distSq = dx * dx + dz * dz;
      if (distSq > 0.0001 && distSq < minDist * minDist) {
        const dist = Math.sqrt(distSq);
        // Split the overlap half-and-half — both enemies will push each other
        // in opposite directions so neither dominates.
        const push = (minDist - dist) / dist * 0.5;
        groupRef.current!.position.x += dx * push;
        groupRef.current!.position.z += dz * push;
      }
    });

    position.copy(groupRef.current.position);
  });

  return (
    // Outer identity group exists so the sniper laser can be positioned in
    // world space, outside the moving/rotating enemy group.
    <group>
    <group ref={groupRef}>
      <primitive object={model} scale={0.012 * sizeMultiplier} />
      {showHealthBar && health > 0 && (
        <Html position={[0, config.isSpecial ? 2.35 : 2.05, 0]} center distanceFactor={12} style={{ pointerEvents: 'none' }}>
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
                width: `${Math.max(0, Math.min(100, (health / Math.max(maxHealth, 1)) * 100))}%`,
                height: '100%',
                background: health / Math.max(maxHealth, 1) > 0.5 ? 'linear-gradient(180deg,#9ccc65,#689f38)' : health / Math.max(maxHealth, 1) > 0.25 ? 'linear-gradient(180deg,#ffd54f,#f9a825)' : 'linear-gradient(180deg,#ef5350,#c62828)',
                borderRadius: '3px'
              }}
            />
          </div>
        </Html>
      )}
      {config.isSpecial && (
        <Html position={[0, 2.0, 0]} center distanceFactor={12} style={{ pointerEvents: 'none' }}>
          <div
            style={{
              color: config.color,
              background: 'rgba(0,0,0,0.55)',
              padding: '2px 7px',
              borderRadius: '4px',
              fontSize: '11px',
              fontWeight: 'bold',
              whiteSpace: 'nowrap',
              textShadow: '0 1px 2px rgba(0,0,0,0.7)'
            }}
          >
            {config.label}
          </div>
        </Html>
      )}
      {showLastWords && lastWordsRef.current !== null && lastWordsTimerRef.current > 0 && (
        <Html position={[0, 2.4, 0]} center distanceFactor={12} style={{ pointerEvents: 'none' }}>
          <div
            style={{
              color: '#fff',
              background: 'rgba(0,0,0,0.7)',
              padding: '3px 8px',
              borderRadius: '6px',
              fontSize: '12px',
              fontStyle: 'italic',
              whiteSpace: 'nowrap',
              border: '1px solid rgba(255,255,255,0.25)'
            }}
          >
            {lastWordsRef.current}
          </div>
        </Html>
      )}
    </group>
    {config.isSniper && (
      <mesh ref={laserMeshRef} visible={false}>
        <cylinderGeometry args={[0.02, 0.02, 1, 6]} />
        <meshBasicMaterial color="#ff1744" transparent opacity={0.75} depthWrite={false} />
      </mesh>
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

// Picks the closest-to-direct heading (checked in increasing angular offset
// from the desired one) whose short lookahead step isn't already inside a
// wall/crate, so a chasing (or fleeing/kiting) enemy slides around an
// obstacle in its way instead of pushing straight into it forever.
const pickOpenHeading = (pos: THREE.Vector3, desiredAngle: number, colliders: AABB[], radius: number): number => {
  for (const offset of WALL_AVOID_OFFSETS) {
    const angle = desiredAngle + offset;
    const testX = pos.x + Math.sin(angle) * WALL_AVOID_LOOKAHEAD;
    const testZ = pos.z + Math.cos(angle) * WALL_AVOID_LOOKAHEAD;
    if (!colliders.some((box) => circleCollidesWithBox(testX, testZ, radius, box))) return angle;
  }
  return desiredAngle;
};
