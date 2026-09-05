import { asset } from '../world/assetPath';
import { normalizeSkinWeights } from '../world/skinWeights';
import React, { useMemo, useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { useFBX } from '@react-three/drei';
import * as THREE from 'three';
import { useInputs } from '../hooks/useInputs';
import { AnimationState, CROUCH_HOLD_VARIANTS, IDLE_VARIANTS, ViewMode } from '../types/game.types';
import { AABB, CrateDef, WALL_COLLIDERS, getCrateCollider, INITIAL_PLATFORM_DEFS, getPlatformCollider } from '../world/worldObjects';

const PLATFORM_COLLIDERS = INITIAL_PLATFORM_DEFS.map(getPlatformCollider);
import {
  BIG_HIT_REACTION_LOCK_DURATION,
  CivilianState,
  CRIT_DAMAGE_MULTIPLIER,
  DASH_COOLDOWN,
  DASH_DURATION,
  DASH_SPEED,
  DummyState,
  EnemyState,
  FLASHLIGHT_BASE_DISTANCE,
  FLASHLIGHT_BASE_INTENSITY,
  FLASHLIGHT_DISTANCE_PER_LEVEL,
  FLASHLIGHT_INTENSITY_PER_LEVEL,
  FIST_HIT_RADIUS,
  FOOTBALL_KICK_RADIUS,
  FOOTBALL_RADIUS,
  FootballState,
  FOOT_HIT_RADIUS,
  GROUND_SLAM_EXTRA_DAMAGE,
  GROUND_SLAM_RADIUS,
  HIT_REACTION_LOCK_DURATION,
  HUMANOID_RADIUS,
  KICK_DAMAGE,
  LOW_HEALTH_FRACTION_THRESHOLD,
  PARRY_WINDOW_SECONDS,
  PLAYER_MAX_STAMINA,
  PUNCH_DAMAGE,
  STAMINA_DRAIN_PER_SECOND,
  STAMINA_REGEN_PER_SECOND,
  STAMINA_RESUME_THRESHOLD,
  TURRET_HIT_RADIUS,
  TurretState
} from '../world/gameState';
import { circleCollidesWithBox } from '../world/collision';
import { StatusEffects, getSlowFactor, hasAura, isBurning, isFrozen, isMagnetized, isPulled, isRagdollStunned, isSlowed, tickBurn } from '../world/statusEffects';
import { createRagdoll, RagdollHandle } from '../world/ragdoll';
import { physicsWorld } from '../world/physicsWorld';
import { audio, SfxName } from '../world/audio';

interface PlayerProps {
  playerRef: React.RefObject<THREE.Group>;
  tint?: string;
  viewMode: ViewMode;
  chestPositionRef: React.RefObject<THREE.Vector3>;
  headPositionRef: React.RefObject<THREE.Vector3>;
  crates: CrateDef[];
  dummies: DummyState[];
  enemies: EnemyState[];
  onCrateHit: (crateId: string, damage: number) => void;
  onDummyHit: (dummyId: string, damage: number) => void;
  onEnemyHit: (enemyId: string, damage: number, attackKind?: 'punch' | 'kick') => void;
  playerHealth: number;
  maxHealth: number;
  playerStatusEffectsRef: React.MutableRefObject<StatusEffects>;
  onPlayerDamage: (amount: number) => void;
  onPlayerDeath: (position: THREE.Vector3, rotationY: number) => void;
  onInteract: () => void;
  damageBonus: number;
  moveSpeedBonus: number;
  attackSpeedBonus: number;
  maxStamina: number;
  critChance: number;
  flashlightOn: boolean;
  flashlightLevel: number;
  isPaused: boolean;
  onStatusEffectChange: (label: string | null) => void;
  onStaminaChange: (stamina: number, max: number) => void;
  // Ability unlocks (from statModifiers picks).
  dashPicks: number;
  parryPicks: number;
  groundSlamPicks: number;
  // Shared refs written by Player, read by GameCanvas for damage gating.
  parryWindowRef: React.MutableRefObject<number>;
  dashInvincibleRef: React.MutableRefObject<number>;
  // Engineer Man sentries the player can punch/kick down.
  turrets?: TurretState[];
  onTurretHit?: (turretId: string, damage: number) => void;
  // Sandbox civilians - hittable (which scares them off you permanently).
  civilians?: CivilianState[];
  onCivilianHit?: (civilianId: string, damage: number) => void;
  // Ultimate Soccer crossover: footballs lying in the arena. A kick that lands
  // near one launches it instead of (or as well as) damaging whatever else is
  // in range — the ball then rolls and knocks people down on its own.
  footballs?: FootballState[];
  onFootballKick?: (footballId: string, dirX: number, dirZ: number) => void;
  // Arena mode: replaces the procedural map's walls/platforms/crates with
  // the arena's own colliders.
  overrideColliders?: AABB[];
  // Arena fall transition: base floor height (0 = normal ground). Set to a
  // deep negative during the floor-drop so gravity takes over. A ref, since
  // it changes mid-frame during the transition.
  baseGroundYRef?: React.MutableRefObject<number>;
  // Glass Cannon modifier: multiplies all outgoing melee damage.
  damageMultiplier?: number;
  // Written on every swing start - read by Copycat Man to mimic the player.
  lastAttackRef?: React.MutableRefObject<'punch' | 'kick'>;
  // Which footstep sample fits the current ground (grass/wood/rock).
  footstepSound?: SfxName;
}

const GRAVITY = -9.81;
const JUMP_SPEED = 5.5;
const WALK_SPEED = 2.5;
const RUN_SPEED = 6.5;
const CROUCH_SPEED = 1.6;
const ROLL_SPEED = 4.5;
const PLAYER_RADIUS = HUMANOID_RADIUS;
const STAND_EPSILON = 0.05;

const getSupportHeight = (x: number, z: number, colliders: AABB[], baseY = 0): number => {
  let height = baseY;
  colliders.forEach((box) => {
    if (x >= box.minX && x <= box.maxX && z >= box.minZ && z <= box.maxZ) {
      height = Math.max(height, box.topY);
    }
  });
  return height;
};

const resolveCollision = (
  prevX: number,
  prevZ: number,
  newX: number,
  newZ: number,
  playerY: number,
  colliders: AABB[],
  blockerXZ: { x: number; z: number }[]
): { x: number; z: number } => {
  const collidesAt = (x: number, z: number) => {
    const blockedByBox = colliders.some(
      (box) => box.topY > playerY + STAND_EPSILON && circleCollidesWithBox(x, z, PLAYER_RADIUS, box)
    );
    if (blockedByBox) return true;
    const minDist = PLAYER_RADIUS + HUMANOID_RADIUS;
    return blockerXZ.some((d) => {
      const dx = x - d.x;
      const dz = z - d.z;
      return dx * dx + dz * dz < minDist * minDist;
    });
  };

  if (!collidesAt(newX, newZ)) return { x: newX, z: newZ };
  if (!collidesAt(prevX, newZ)) return { x: prevX, z: newZ };
  if (!collidesAt(newX, prevZ)) return { x: newX, z: prevZ };
  return { x: prevX, z: prevZ };
};

const ANIM_FILES: Record<AnimationState, string> = {
  idle: asset('/anims/idle.fbx'),
  idle2: asset('/anims/idle-2.fbx'),
  idle3: asset('/anims/idle-3.fbx'),
  idle4: asset('/anims/idle-4.fbx'),
  idle5: asset('/anims/idle-5.fbx'),
  walk: asset('/anims/walk.fbx'),
  run: asset('/anims/run.fbx'),
  runToStop: asset('/anims/run-to-stop.fbx'),
  jump: asset('/anims/jump.fbx'),
  fallingIdle: asset('/anims/falling-idle.fbx'),
  hardLanding: asset('/anims/hard-landing.fbx'),
  fallingToRoll: asset('/anims/falling-to-roll.fbx'),
  crouchEnter: asset('/anims/stand-to-cover.fbx'),
  crouchEnter2: asset('/anims/stand-to-cover-2.fbx'),
  crouchExit: asset('/anims/cover-to-stand.fbx'),
  crouchExitMoving: asset('/anims/cover-to-stand-2.fbx'),
  crouchSneakLeft: asset('/anims/crouched-sneaking-left.fbx'),
  crouchSneakRight: asset('/anims/crouched-sneaking-right.fbx'),
  coverSneakLeft: asset('/anims/left-cover-sneak.fbx'),
  coverSneakRight: asset('/anims/right-cover-sneak.fbx'),
  punch: asset('/anims/punch.fbx'),
  kick: asset('/anims/kick.fbx'),
  hit: asset('/anims/hit-to-body.fbx'),
  // Reused purely as a dramatic, non-lethal stagger reaction when a hit
  // lands at critically low health - the player never actually dies from
  // this clip (health > 0 the whole time); on an actual kill the FSM still
  // skips straight to the ragdoll corpse, per the project's no-death-clips
  // rule. The clip's filename is just a leftover from its source library.
  bigHit: asset('/anims/falling-back-death.fbx')
};

const ONE_SHOT_STATES: AnimationState[] = [
  'runToStop',
  'hardLanding',
  'fallingToRoll',
  'crouchEnter',
  'crouchEnter2',
  'crouchExit',
  'crouchExitMoving',
  'punch',
  'kick',
  'hit',
  'bigHit'
];

// Crit is rolled once per landed hit, independent of target type (crate,
// dummy, or enemy) - rounded to 1 decimal place so the floating damage
// number never shows an ugly long fraction.
const rollCritDamage = (baseDamage: number, critChance: number): number => {
  if (Math.random() >= critChance) return baseDamage;
  return Math.round(baseDamage * CRIT_DAMAGE_MULTIPLIER * 10) / 10;
};

const ROOT_BONE_NAME = 'mixamorigHips';

// These clips are mocap exports with baked root motion (the hips track
// drifts dozens of units in X/Z over the clip). Game movement is driven
// entirely by code (translateZ/translateX in useFrame), so baked root
// motion would double-move the character and pop on every loop seam.
// Freezing X/Z to the first frame turns them into proper in-place loops
// while keeping the Y track for natural vertical bob/crouch/jump motion.
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

export const Player: React.FC<PlayerProps> = ({
  playerRef,
  tint = '#ffffff',
  viewMode,
  chestPositionRef,
  headPositionRef,
  crates,
  dummies,
  enemies,
  onCrateHit,
  onDummyHit,
  onEnemyHit,
  playerHealth,
  maxHealth,
  playerStatusEffectsRef,
  onPlayerDamage,
  onPlayerDeath,
  onInteract,
  damageBonus,
  moveSpeedBonus,
  attackSpeedBonus,
  maxStamina,
  critChance,
  flashlightOn,
  flashlightLevel,
  isPaused,
  onStatusEffectChange,
  onStaminaChange,
  dashPicks = 0,
  parryPicks = 0,
  groundSlamPicks = 0,
  parryWindowRef,
  dashInvincibleRef,
  turrets = [],
  onTurretHit,
  civilians = [],
  onCivilianHit,
  footballs,
  onFootballKick,
  overrideColliders,
  baseGroundYRef,
  damageMultiplier = 1,
  lastAttackRef,
  footstepSound = 'footGrass'
}) => {
  const footstepTimerRef = useRef(0);
  const inputs = useInputs();
  const colliders = useMemo(
    () => overrideColliders ?? [...WALL_COLLIDERS, ...PLATFORM_COLLIDERS, ...crates.map(getCrateCollider)],
    [crates, overrideColliders]
  );
  // A stable target object passed directly to <spotLight target>, instead of
  // a ref - resolving via ref would only update on a later render, leaving
  // the very first frame aimed at the world origin instead of forward.
  const flashlightTarget = useMemo(() => new THREE.Object3D(), []);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const actionsRef = useRef<{ [key in AnimationState]?: THREE.AnimationAction }>({});
  // 'hit'/'bigHit' are picked randomly from these pools each time rather
  // than always playing the single action registered under that key in
  // actionsRef - this tracks which specific variant is actually playing,
  // since currentActionRef only carries the logical category.
  const hitActionsRef = useRef<THREE.AnimationAction[]>([]);
  const bigHitActionsRef = useRef<THREE.AnimationAction[]>([]);
  const activeVariantActionRef = useRef<THREE.AnimationAction | null>(null);
  const currentActionRef = useRef<AnimationState>('idle');
  const oneShotTimerRef = useRef<number | null>(null);
  const prevCrouchRef = useRef<boolean>(false);
  const prevJumpHeldRef = useRef<boolean>(false);
  const rollQueuedRef = useRef<boolean>(false);
  const prevPunchHeldRef = useRef<boolean>(false);
  const punchQueuedRef = useRef<boolean>(false);
  const punchHitRegisteredRef = useRef<boolean>(false);
  const punchHandWorldPos = useRef(new THREE.Vector3());
  const prevKickHeldRef = useRef<boolean>(false);
  const kickQueuedRef = useRef<boolean>(false);
  const kickHitRegisteredRef = useRef<boolean>(false);
  const kickFootWorldPos = useRef(new THREE.Vector3());
  const prevBackwardHeldRef = useRef<boolean>(false);

  // Dash: double-tap direction within 300ms to dash.
  const dashCooldownRef = useRef(0);
  const dashActiveEndRef = useRef(0);         // clock.elapsedTime when dash expires
  const dashDirRef = useRef(new THREE.Vector3());
  const lastTapKeyRef = useRef<string>('');
  const lastTapTimeRef = useRef(0);           // clock.elapsedTime of last direction press
  const prevDashKeysRef = useRef({ forward: false, backward: false, left: false, right: false });

  // Parry: Q rising edge sets the active window.
  const prevParryHeldRef = useRef(false);

  // Ground slam: kick while airborne → slam on landing.
  const groundSlamPendingRef = useRef(false);
  const groundSlamHitRef = useRef(false);
  const wasGroundedRef = useRef(true);
  const turnAroundTargetRef = useRef<number | null>(null);
  const electricFlashTimerRef = useRef(0);
  const prevInteractHeldRef = useRef<boolean>(false);

  const chestBoneRef = useRef<THREE.Object3D | null>(null);
  const headBoneRef = useRef<THREE.Object3D | null>(null);
  const rightHandBoneRef = useRef<THREE.Object3D | null>(null);
  const rightFootBoneRef = useRef<THREE.Object3D | null>(null);
  const materialsRef = useRef<THREE.MeshStandardMaterial[]>([]);

  const velocityY = useRef<number>(0);
  const isGrounded = useRef<boolean>(true);

  const ragdollRef = useRef<RagdollHandle | null>(null);
  const knockbackVelocityRef = useRef(new THREE.Vector3());
  const deathHandledRef = useRef<boolean>(false);
  const prevStatusLabelRef = useRef<string | null>(null);
  const prevHealthRef = useRef(playerHealth);

  const staminaRef = useRef(PLAYER_MAX_STAMINA);
  const canSprintRef = useRef(true);
  const lastReportedStaminaRef = useRef(-1);

  const baseModel = useFBX(asset('/anims/stickman_base.fbx'));
  // Repair the >4-influence weights three silently truncates on load; shared
  // geometry means this runs once no matter how many actors mount.
  normalizeSkinWeights(baseModel);
  // A small variety pool per reaction tier, loaded separately from the
  // fixed AnimationState-driven `anims` map below since they aren't their
  // own distinct states - one is picked at random each time hit/bigHit
  // triggers instead of always playing the exact same flinch.
  const kidneyHitAnim = useFBX(asset('/anims/kidney-hit.fbx'));
  const stomachHitAnim = useFBX(asset('/anims/stomach-hit.fbx'));
  const bigHitToHeadAnim = useFBX(asset('/anims/big-hit-to-head.fbx'));
  const bigKidneyHitAnim = useFBX(asset('/anims/big-kidney-hit.fbx'));
  const bigSideHitAnim = useFBX(asset('/anims/big-side-hit.fbx'));
  const bigStomachHitAnim = useFBX(asset('/anims/big-stomach-hit.fbx'));
  const anims = {
    idle: useFBX(ANIM_FILES.idle),
    idle2: useFBX(ANIM_FILES.idle2),
    idle3: useFBX(ANIM_FILES.idle3),
    idle4: useFBX(ANIM_FILES.idle4),
    idle5: useFBX(ANIM_FILES.idle5),
    walk: useFBX(ANIM_FILES.walk),
    run: useFBX(ANIM_FILES.run),
    runToStop: useFBX(ANIM_FILES.runToStop),
    jump: useFBX(ANIM_FILES.jump),
    fallingIdle: useFBX(ANIM_FILES.fallingIdle),
    hardLanding: useFBX(ANIM_FILES.hardLanding),
    fallingToRoll: useFBX(ANIM_FILES.fallingToRoll),
    crouchEnter: useFBX(ANIM_FILES.crouchEnter),
    crouchEnter2: useFBX(ANIM_FILES.crouchEnter2),
    crouchExit: useFBX(ANIM_FILES.crouchExit),
    crouchExitMoving: useFBX(ANIM_FILES.crouchExitMoving),
    crouchSneakLeft: useFBX(ANIM_FILES.crouchSneakLeft),
    crouchSneakRight: useFBX(ANIM_FILES.crouchSneakRight),
    coverSneakLeft: useFBX(ANIM_FILES.coverSneakLeft),
    coverSneakRight: useFBX(ANIM_FILES.coverSneakRight),
    punch: useFBX(ANIM_FILES.punch),
    kick: useFBX(ANIM_FILES.kick),
    hit: useFBX(ANIM_FILES.hit),
    bigHit: useFBX(ANIM_FILES.bigHit)
  };

  useEffect(() => {
    if (!baseModel) return;
    const materials: THREE.MeshStandardMaterial[] = [];
    baseModel.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const meshMaterials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        meshMaterials.forEach((mat) => {
          if (mat && 'color' in mat) {
            (mat as THREE.MeshStandardMaterial).color.set(tint);
            materials.push(mat as THREE.MeshStandardMaterial);
          }
        });
      }
    });
    materialsRef.current = materials;
  }, [baseModel, tint]);

  useEffect(() => {
    if (!baseModel) return;
    const mixer = new THREE.AnimationMixer(baseModel);
    mixerRef.current = mixer;

    const nextActions: { [key in AnimationState]?: THREE.AnimationAction } = {};
    (Object.keys(anims) as AnimationState[]).forEach((key) => {
      const clip = anims[key].animations[0];
      if (!clip) return;
      stripRootMotion(clip);
      const action = mixer.clipAction(clip);
      if (ONE_SHOT_STATES.includes(key)) {
        action.setLoop(THREE.LoopOnce, 1);
        action.clampWhenFinished = true;
      }
      nextActions[key] = action;
    });
    actionsRef.current = nextActions;

    const makeVariantAction = (fbx: ReturnType<typeof useFBX>): THREE.AnimationAction | null => {
      const clip = fbx.animations[0];
      if (!clip) return null;
      stripRootMotion(clip);
      const action = mixer.clipAction(clip);
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
      return action;
    };
    hitActionsRef.current = [nextActions.hit, makeVariantAction(kidneyHitAnim), makeVariantAction(stomachHitAnim)].filter(
      (a): a is THREE.AnimationAction => !!a
    );
    bigHitActionsRef.current = [
      nextActions.bigHit,
      makeVariantAction(bigHitToHeadAnim),
      makeVariantAction(bigKidneyHitAnim),
      makeVariantAction(bigSideHitAnim),
      makeVariantAction(bigStomachHitAnim)
    ].filter((a): a is THREE.AnimationAction => !!a);

    baseModel.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    chestBoneRef.current = baseModel.getObjectByName('mixamorigSpine2') ?? null;
    headBoneRef.current = baseModel.getObjectByName('mixamorigHead') ?? null;
    rightHandBoneRef.current = baseModel.getObjectByName('mixamorigRightHand') ?? null;
    rightFootBoneRef.current = baseModel.getObjectByName('mixamorigRightFoot') ?? null;

    currentActionRef.current = 'idle';
    actionsRef.current.idle?.play();

    return () => {
      mixer.stopAllAction();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseModel]);

  // A second, independent ragdoll instance reserved for TEMPORARY stuns
  // (water kick, shock punch, rock punch). Permanent death is handled
  // separately by GameCanvas spawning a standalone PlayerCorpse - this one
  // always gets dispose()'d again once the stun window ends, which hands
  // bone control back to the AnimationMixer with no extra bookkeeping.
  useEffect(() => {
    if (!baseModel) return;
    ragdollRef.current = createRagdoll(baseModel, physicsWorld);
    return () => {
      ragdollRef.current?.dispose();
      ragdollRef.current = null;
    };
  }, [baseModel]);

  // 'hit'/'bigHit' don't have one fixed action in actionsRef (a random
  // variant is picked each time), so resolving "whatever's currently
  // playing" has to fall back to the tracked variant for those two states.
  const getCurrentAction = (): THREE.AnimationAction | undefined => {
    if (currentActionRef.current === 'hit' || currentActionRef.current === 'bigHit') {
      return activeVariantActionRef.current ?? undefined;
    }
    return actionsRef.current[currentActionRef.current];
  };

  const transitionTo = (next: AnimationState, fade = 0.2) => {
    if (currentActionRef.current === next) return;
    const prevAction = getCurrentAction();
    const nextAction = actionsRef.current[next];
    if (!nextAction) return;
    prevAction?.fadeOut(fade);
    nextAction.reset().fadeIn(fade).play();
    currentActionRef.current = next;
    activeVariantActionRef.current = null;
  };

  const playOneShot = (state: AnimationState, fade = 0.15) => {
    const action = actionsRef.current[state];
    if (!action) {
      currentActionRef.current = state;
      return;
    }
    const prevAction = getCurrentAction();
    prevAction?.fadeOut(fade);
    action.reset().fadeIn(fade).play();
    currentActionRef.current = state;
    activeVariantActionRef.current = null;
    // Only punch/kick are affected by the attack-speed upgrade - every other
    // one-shot (landing, crouch transitions, etc.) keeps its normal pace.
    const speedMultiplier = state === 'punch' || state === 'kick' ? 1 + attackSpeedBonus : 1;
    action.timeScale = speedMultiplier;
    oneShotTimerRef.current = action.getClip().duration / speedMultiplier;
  };

  // Picks a random clip from the hit/bigHit variety pool instead of always
  // playing the exact same flinch.
  const playHitReaction = (category: 'hit' | 'bigHit', fade = 0.15) => {
    const pool = category === 'hit' ? hitActionsRef.current : bigHitActionsRef.current;
    const prevAction = getCurrentAction();
    if (pool.length === 0) {
      currentActionRef.current = category;
      activeVariantActionRef.current = null;
      return;
    }
    const action = pool[Math.floor(Math.random() * pool.length)];
    prevAction?.fadeOut(fade);
    action.timeScale = 1;
    action.reset().fadeIn(fade).play();
    currentActionRef.current = category;
    activeVariantActionRef.current = action;
    oneShotTimerRef.current = action.getClip().duration;
  };

  const pickIdleVariant = (): AnimationState => {
    if (IDLE_VARIANTS.includes(currentActionRef.current)) return currentActionRef.current;
    return IDLE_VARIANTS[Math.floor(Math.random() * IDLE_VARIANTS.length)];
  };

  const pickCrouchHold = (): AnimationState => {
    if (CROUCH_HOLD_VARIANTS.includes(currentActionRef.current)) return currentActionRef.current;
    return CROUCH_HOLD_VARIANTS[Math.floor(Math.random() * CROUCH_HOLD_VARIANTS.length)];
  };

  const updateCameraBones = () => {
    if (!playerRef.current) return;
    playerRef.current.updateMatrixWorld(true);
    if (chestBoneRef.current && chestPositionRef.current) {
      chestBoneRef.current.getWorldPosition(chestPositionRef.current);
    }
    if (headBoneRef.current && headPositionRef.current) {
      headBoneRef.current.getWorldPosition(headPositionRef.current);
    }
  };

  useFrame((state, delta) => {
    if (isPaused) return;
    const actualDelta = Math.min(delta, 0.1);
    const now = state.clock.elapsedTime;
    if (mixerRef.current) mixerRef.current.update(actualDelta);
    if (!playerRef.current) return;

    const effects = playerStatusEffectsRef.current;

    let statusLabel: string | null = null;
    if (isRagdollStunned(effects, now)) statusLabel = 'Stunned';
    else if (isFrozen(effects, now)) statusLabel = 'Frozen';
    else if (isPulled(effects, now)) statusLabel = 'Pulled';
    else if (isBurning(effects, now)) statusLabel = 'Burning';
    else if (isSlowed(effects, now)) statusLabel = 'Slowed';
    else if (isMagnetized(effects, now)) statusLabel = effects.magnetStrength < 0 ? 'Repulsed' : 'Magnetized';
    if (statusLabel !== prevStatusLabelRef.current) {
      prevStatusLabelRef.current = statusLabel;
      onStatusEffectChange(statusLabel);
    }

    if (playerHealth > 0) deathHandledRef.current = false;

    // Every kill (the player's included) skips hit/death animations and
    // ragdolls immediately. For the player this means: leave a permanent
    // corpse marker behind (GameCanvas owns that via onPlayerDeath) and
    // reset this live controller back to a fresh spawn instantly.
    if (playerHealth <= 0 && !deathHandledRef.current) {
      deathHandledRef.current = true;
      onPlayerDeath(playerRef.current.position.clone(), playerRef.current.rotation.y);
      playerRef.current.position.set(0, 0, 0);
      playerRef.current.rotation.y = 0;
      velocityY.current = 0;
      isGrounded.current = true;
      oneShotTimerRef.current = null;
      punchQueuedRef.current = false;
      kickQueuedRef.current = false;
      rollQueuedRef.current = false;
      knockbackVelocityRef.current.set(0, 0, 0);
      transitionTo('idle', 0.05);
      return;
    }

    // Temporary stun: full ragdoll takeover until the window expires, then
    // dispose() hands control straight back to the AnimationMixer.
    if (isRagdollStunned(effects, now)) {
      if (!ragdollRef.current?.isActive()) {
        ragdollRef.current?.activate(effects.ragdollStunImpulse ?? undefined);
        effects.ragdollStunImpulse = null;
      }
      ragdollRef.current?.update();
      ragdollRef.current?.getHipsWorldPosition(playerRef.current.position);

      // Electric shock: rapidly alternate body color between #fff176 (yellow)
      // and white, and apply small random impulses to the hips body each
      // frame to simulate a body being jolted by electricity.
      if (effects.isElectricStun) {
        electricFlashTimerRef.current += actualDelta;
        const flashOn = Math.floor(electricFlashTimerRef.current / 0.07) % 2 === 0;
        const shockColor = flashOn ? '#fff176' : '#ffffff';
        materialsRef.current.forEach((mat) => mat.color.set(shockColor));
        const impulse = new THREE.Vector3((Math.random() - 0.5) * 3, 0, (Math.random() - 0.5) * 3);
        ragdollRef.current?.applyImpulseToHips(impulse);
      }

      updateCameraBones();
      return;
    } else if (ragdollRef.current?.isActive()) {
      electricFlashTimerRef.current = 0;
      ragdollRef.current.dispose();
      transitionTo('idle', 0.1);
    }

    // Freeze: locked standing in place, current attack cancelled.
    if (isFrozen(effects, now)) {
      transitionTo('idle', 0.1);
      updateCameraBones();
      return;
    }

    // Telekinesis pull: cannot be resisted, drags the player toward the
    // attacker's position for the pull's duration.
    if (isPulled(effects, now) && effects.pullTarget) {
      transitionTo('idle', 0.1);
      const alpha = 1 - Math.exp(-6 * actualDelta);
      playerRef.current.position.lerp(effects.pullTarget, alpha);
      updateCameraBones();
      return;
    }

    const burnDamage = tickBurn(effects, now);
    if (burnDamage > 0) onPlayerDamage(burnDamage);

    // Slow Cube's hit: temporary movement-speed penalty on everything but
    // dash (the invincible burst stays a true escape option).
    const slowFactor = getSlowFactor(effects, now);

    // Below the low-health threshold, a landed hit escalates from a normal
    // flinch to a bigger, more dramatic stagger - still purely a reaction
    // (health > 0 throughout), never a death clip.
    const tookDamageThisFrame = playerHealth < prevHealthRef.current;
    const isLowHealth = maxHealth > 0 && playerHealth / maxHealth < LOW_HEALTH_FRACTION_THRESHOLD;
    prevHealthRef.current = playerHealth;

    const activeColor = hasAura(effects, now) && effects.auraColor ? effects.auraColor : tint;
    materialsRef.current.forEach((mat) => mat.color.set(activeColor));

    if (effects.pendingKnockback) {
      knockbackVelocityRef.current.copy(effects.pendingKnockback);
      effects.pendingKnockback = null;
    }
    if (knockbackVelocityRef.current.lengthSq() > 0.0004) {
      playerRef.current.position.addScaledVector(knockbackVelocityRef.current, actualDelta);
      knockbackVelocityRef.current.multiplyScalar(Math.exp(-6 * actualDelta));
    } else {
      knockbackVelocityRef.current.set(0, 0, 0);
    }

    // Magnet Man's drag / Repulsor's shove: a steady drift that stacks
    // under normal movement - slower than walk speed, so it's fightable,
    // not a lock. Positive strength pulls toward the emitter; negative
    // pushes away.
    if (isMagnetized(effects, now)) {
      const mdx = effects.magnetTarget.x - playerRef.current.position.x;
      const mdz = effects.magnetTarget.z - playerRef.current.position.z;
      const md = Math.hypot(mdx, mdz);
      const pulling = effects.magnetStrength > 0;
      if (md > (pulling ? 0.6 : 0.05)) {
        playerRef.current.position.x += (mdx / md) * effects.magnetStrength * actualDelta;
        playerRef.current.position.z += (mdz / md) * effects.magnetStrength * actualDelta;
      }
    }

    const rotateTowardAngle = (angle: number, turnRateExp: number) => {
      const currentRotation = playerRef.current!.rotation.y;
      let diff = angle - currentRotation;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      const turnAlpha = 1 - Math.exp(-turnRateExp * actualDelta);
      playerRef.current!.rotation.y += diff * turnAlpha;
    };

    const rotateTowardMovement = (movementVector: THREE.Vector3, turnRateExp: number) => {
      rotateTowardAngle(Math.atan2(movementVector.x, movementVector.z), turnRateExp);
    };

    const prevX = playerRef.current.position.x;
    const prevZ = playerRef.current.position.z;
    const wasAirborneAtFrameStart = !isGrounded.current;

    const supportHeight = getSupportHeight(playerRef.current.position.x, playerRef.current.position.z, colliders, baseGroundYRef?.current ?? 0);
    if (isGrounded.current && playerRef.current.position.y > supportHeight + STAND_EPSILON) {
      // Walked off the edge of a platform with no jump input.
      isGrounded.current = false;
    }

    let justLanded = false;
    if (!isGrounded.current) {
      velocityY.current += GRAVITY * actualDelta;
      playerRef.current.position.y += velocityY.current * actualDelta;
      if (playerRef.current.position.y <= supportHeight) {
        playerRef.current.position.y = supportHeight;
        isGrounded.current = true;
        velocityY.current = 0;
        justLanded = true;
      }
    } else if (inputs.jump && !inputs.crouch && oneShotTimerRef.current === null) {
      isGrounded.current = false;
      velocityY.current = JUMP_SPEED;
    }

    // A fresh tap of jump WHILE already airborne (not the same press that
    // launched the jump) queues a roll for when we land.
    const jumpPressedEdge = inputs.jump && !prevJumpHeldRef.current;
    prevJumpHeldRef.current = inputs.jump;
    if (wasAirborneAtFrameStart && jumpPressedEdge) {
      rollQueuedRef.current = true;
    }

    // Buffer the punch press: if it lands while another one-shot (e.g. a
    // run-to-stop) is still locking the FSM, it fires as soon as that
    // lock clears instead of being silently dropped.
    const punchPressedEdge = inputs.punch && !prevPunchHeldRef.current;
    prevPunchHeldRef.current = inputs.punch;
    if (punchPressedEdge) {
      punchQueuedRef.current = true;
    }

    // Same buffering as the punch press, for the kick.
    const kickPressedEdge = inputs.kick && !prevKickHeldRef.current;
    prevKickHeldRef.current = inputs.kick;
    if (kickPressedEdge) {
      kickQueuedRef.current = true;
    }

    // Parry: Q rising edge activates the parry window.
    const parryPressedEdge = inputs.parry && !prevParryHeldRef.current;
    prevParryHeldRef.current = inputs.parry;
    if (parryPressedEdge && parryPicks > 0 && parryWindowRef) {
      // Use Date.now() (ms) for cross-Canvas boundary timing.
      parryWindowRef.current = Date.now() + PARRY_WINDOW_SECONDS * 1000;
    }

    // Dash: double-tap direction within 300ms activates the dash.
    const DOUBLE_TAP_WINDOW = 0.3;
    if (dashPicks > 0 && dashCooldownRef.current <= 0) {
      const dirs: [string, boolean][] = [
        ['forward', inputs.forward],
        ['backward', inputs.backward],
        ['left', inputs.left],
        ['right', inputs.right]
      ];
      for (const [key, held] of dirs) {
        const prev = prevDashKeysRef.current[key as keyof typeof prevDashKeysRef.current];
        if (held && !prev) {
          if (lastTapKeyRef.current === key && now - lastTapTimeRef.current < DOUBLE_TAP_WINDOW) {
            // Double-tap detected — compute world-space dash direction.
            const dir = new THREE.Vector3();
            if (key === 'forward') dir.set(Math.sin(playerRef.current!.rotation.y), 0, Math.cos(playerRef.current!.rotation.y));
            else if (key === 'backward') dir.set(-Math.sin(playerRef.current!.rotation.y), 0, -Math.cos(playerRef.current!.rotation.y));
            else if (key === 'left') dir.set(Math.cos(playerRef.current!.rotation.y), 0, -Math.sin(playerRef.current!.rotation.y));
            else dir.set(-Math.cos(playerRef.current!.rotation.y), 0, Math.sin(playerRef.current!.rotation.y));
            dashDirRef.current.copy(dir);
            dashActiveEndRef.current = now + DASH_DURATION;
            dashCooldownRef.current = DASH_COOLDOWN;
            if (dashInvincibleRef) dashInvincibleRef.current = Date.now() + DASH_DURATION * 1000;
            lastTapKeyRef.current = '';
          } else {
            lastTapKeyRef.current = key;
            lastTapTimeRef.current = now;
          }
        }
      }
      prevDashKeysRef.current = { forward: inputs.forward, backward: inputs.backward, left: inputs.left, right: inputs.right };
    }
    if (dashCooldownRef.current > 0) dashCooldownRef.current -= actualDelta;

    const interactPressedEdge = inputs.interact && !prevInteractHeldRef.current;
    prevInteractHeldRef.current = inputs.interact;
    if (interactPressedEdge) {
      onInteract();
    }

    // First-person "turn around": capture the 180-degree target ONCE at the
    // moment S is first pressed (relative to whatever you're currently
    // facing), then keep rotating toward that fixed target while held.
    // Recomputing it every frame would chase a moving goalpost and never
    // visibly turn, since it'd always be defined as "current + 180".
    const backwardPressedEdge = inputs.backward && !prevBackwardHeldRef.current;
    prevBackwardHeldRef.current = inputs.backward;
    if (viewMode === 'first' && backwardPressedEdge) {
      turnAroundTargetRef.current = playerRef.current.rotation.y + Math.PI;
    }

    const movementVector = new THREE.Vector3();
    if (inputs.forward) movementVector.z -= 1;
    if (inputs.backward) movementVector.z += 1;
    if (inputs.left) movementVector.x -= 1;
    if (inputs.right) movementVector.x += 1;
    const hasMovementInput = movementVector.lengthSq() > 0;
    if (hasMovementInput) movementVector.normalize();
    const lateralOnly = (inputs.left || inputs.right) && !inputs.forward && !inputs.backward;

    // Stamina gates sprinting only - once it hits 0, sprinting locks out
    // until stamina regenerates back up to STAMINA_RESUME_THRESHOLD, so it
    // can't immediately flicker back on right at the edge.
    const wantsSprint = inputs.run && hasMovementInput && !inputs.crouch;
    const sprinting = wantsSprint && canSprintRef.current;
    if (sprinting) {
      staminaRef.current = Math.max(0, staminaRef.current - STAMINA_DRAIN_PER_SECOND * actualDelta);
      if (staminaRef.current <= 0) canSprintRef.current = false;
    } else {
      staminaRef.current = Math.min(maxStamina, staminaRef.current + STAMINA_REGEN_PER_SECOND * actualDelta);
      if (!canSprintRef.current && staminaRef.current >= STAMINA_RESUME_THRESHOLD) canSprintRef.current = true;
    }
    const roundedStamina = Math.round(staminaRef.current);
    if (roundedStamina !== lastReportedStaminaRef.current) {
      lastReportedStaminaRef.current = roundedStamina;
      onStaminaChange(roundedStamina, maxStamina);
    }

    // Moving while a punch/kick/hit-reaction is mid-play cancels it outright
    // (falls straight through to normal movement next frame) instead of
    // forcing it to finish first.
    const isInterruptibleOneShotActive =
      oneShotTimerRef.current !== null &&
      (currentActionRef.current === 'punch' ||
        currentActionRef.current === 'kick' ||
        currentActionRef.current === 'hit' ||
        currentActionRef.current === 'bigHit');

    if (isInterruptibleOneShotActive && hasMovementInput) {
      oneShotTimerRef.current = null;
      punchHitRegisteredRef.current = true;
      kickHitRegisteredRef.current = true;
      transitionTo('idle', 0.08);
    } else if (oneShotTimerRef.current !== null) {
      oneShotTimerRef.current -= actualDelta;
      if (oneShotTimerRef.current <= 0) oneShotTimerRef.current = null;
      // The roll clip itself doesn't translate the rig (root motion is
      // stripped like every other clip), so without this it plays in place -
      // push the player forward along with it for the duration of the roll.
      if (currentActionRef.current === 'fallingToRoll') {
        playerRef.current.translateZ(ROLL_SPEED * (1 + moveSpeedBonus) * actualDelta);
      }
    } else if (!isGrounded.current) {
      const nextAir: AnimationState = velocityY.current > 0 ? 'jump' : 'fallingIdle';
      transitionTo(nextAir, 0.15);
      if (hasMovementInput) {
        rotateTowardMovement(movementVector, 8);
        const airSpeed = (sprinting ? RUN_SPEED : WALK_SPEED) * (1 + moveSpeedBonus) * slowFactor;
        playerRef.current.translateZ(airSpeed * actualDelta);
      }
    } else if (justLanded) {
      const shouldRoll = rollQueuedRef.current;
      rollQueuedRef.current = false;
      playOneShot(shouldRoll ? 'fallingToRoll' : 'hardLanding');
    } else if (tookDamageThisFrame && !inputs.crouch) {
      playHitReaction(isLowHealth ? 'bigHit' : 'hit');
      // Cap the FSM-lock well below the clip's own length, same reasoning
      // as EnemyActor: death (checked unconditionally above, every frame)
      // always wins instantly regardless, but a multi-second stagger left
      // running gives a follow-up kill a wide window to land while it's
      // still visibly playing, reading as "a hit animation played before
      // it died" even though the kill itself never shows one.
      if (oneShotTimerRef.current !== null) {
        oneShotTimerRef.current = Math.min(oneShotTimerRef.current, isLowHealth ? BIG_HIT_REACTION_LOCK_DURATION : HIT_REACTION_LOCK_DURATION);
      }
    } else if (inputs.crouch !== prevCrouchRef.current) {
      prevCrouchRef.current = inputs.crouch;
      if (inputs.crouch) {
        playOneShot(pickCrouchHold());
      } else {
        playOneShot(hasMovementInput ? 'crouchExitMoving' : 'crouchExit');
      }
    } else if (punchQueuedRef.current && !inputs.crouch) {
      punchQueuedRef.current = false;
      punchHitRegisteredRef.current = false;
      if (lastAttackRef) lastAttackRef.current = 'punch';
      playOneShot('punch');
    } else if (kickQueuedRef.current && !inputs.crouch) {
      kickQueuedRef.current = false;
      kickHitRegisteredRef.current = false;
      if (lastAttackRef) lastAttackRef.current = 'kick';
      // Ground slam: kick while airborne triggers an AOE on landing.
      if (groundSlamPicks > 0 && !isGrounded.current) {
        groundSlamPendingRef.current = true;
        groundSlamHitRef.current = false;
      }
      playOneShot('kick');
    } else {
      let nextAction: AnimationState;
      let speed = 0;
      let mode: 'rotateTranslate' | 'strafe' | 'fpsRelative' | 'none' = 'none';
      let turnDir: 1 | -1 = 1;

      if (inputs.crouch) {
        if (!hasMovementInput) {
          nextAction = pickCrouchHold();
        } else if (lateralOnly) {
          nextAction = inputs.left ? 'coverSneakLeft' : 'coverSneakRight';
          speed = CROUCH_SPEED * (1 + moveSpeedBonus) * slowFactor;
          mode = 'strafe';
          turnDir = inputs.left ? -1 : 1;
        } else {
          nextAction = inputs.right && !inputs.left ? 'crouchSneakRight' : 'crouchSneakLeft';
          speed = CROUCH_SPEED * (1 + moveSpeedBonus) * slowFactor;
          mode = 'rotateTranslate';
        }
      } else if (!hasMovementInput) {
        nextAction = pickIdleVariant();
      } else {
        nextAction = sprinting ? 'run' : 'walk';
        speed = (sprinting ? RUN_SPEED : WALK_SPEED) * (1 + moveSpeedBonus) * slowFactor;
        // First-person controls: W/A/D move relative to wherever you're
        // currently facing with no auto-rotate (classic FPS strafing). S
        // still spins the character around to face back the way it came,
        // since there's no dedicated backward-walk clip to play instead.
        mode = viewMode === 'first' && !inputs.backward ? 'fpsRelative' : 'rotateTranslate';
      }

      if (currentActionRef.current === 'run' && !hasMovementInput) {
        playOneShot('runToStop');
      } else {
        transitionTo(nextAction, 0.2);
        // Keep animation pace in sync with actual movement speed so the feet
        // don't slide at high moveSpeedBonus values.
        if (nextAction === 'walk' || nextAction === 'run') {
          const action = actionsRef.current[nextAction];
          if (action) action.timeScale = 1 + moveSpeedBonus;
        }
        if (mode === 'rotateTranslate') {
          if (viewMode === 'first' && inputs.backward && turnAroundTargetRef.current !== null) {
            rotateTowardAngle(turnAroundTargetRef.current, 10);
          } else {
            rotateTowardMovement(movementVector, 10);
          }
          playerRef.current.translateZ(speed * actualDelta);
        } else if (mode === 'strafe') {
          playerRef.current.translateX(turnDir * speed * actualDelta);
        } else if (mode === 'fpsRelative') {
          // translateX(+1) points toward camera screen-left for this rig's
          // rotation convention, so screen-right (D) needs the negated sign.
          const localX = (inputs.left ? 1 : 0) - (inputs.right ? 1 : 0);
          const localZ = inputs.forward ? 1 : 0;
          const localLen = Math.hypot(localX, localZ);
          if (localLen > 0) {
            playerRef.current.translateX((localX / localLen) * speed * actualDelta);
            playerRef.current.translateZ((localZ / localLen) * speed * actualDelta);
          }
        }
      }
    }

    // Footsteps: tick while grounded and actually moving.
    if (isGrounded.current && hasMovementInput && !inputs.crouch) {
      footstepTimerRef.current -= actualDelta;
      if (footstepTimerRef.current <= 0) {
        footstepTimerRef.current = sprinting ? 0.28 : 0.46;
        audio.play(footstepSound, { volume: 0.45, rateJitter: 0.18 });
      }
    } else {
      footstepTimerRef.current = 0.1;
    }

    // Dash: override normal movement with a burst in dashDirRef while active.
    if (now < dashActiveEndRef.current) {
      playerRef.current.position.x += dashDirRef.current.x * DASH_SPEED * actualDelta;
      playerRef.current.position.z += dashDirRef.current.z * DASH_SPEED * actualDelta;
    }

    // Ground slam: when pending and player just landed, deal AOE damage.
    const currentlyGrounded = isGrounded.current;
    if (groundSlamPendingRef.current && currentlyGrounded && !wasGroundedRef.current && !groundSlamHitRef.current) {
      groundSlamHitRef.current = true;
      groundSlamPendingRef.current = false;
      const slamPos = playerRef.current.position;
      const slamDmg = rollCritDamage((KICK_DAMAGE + GROUND_SLAM_EXTRA_DAMAGE + damageBonus) * damageMultiplier, critChance);
      enemies.forEach((e) => {
        if (e.health <= 0) return;
        const dx = e.position.x - slamPos.x;
        const dz = e.position.z - slamPos.z;
        if (Math.hypot(dx, dz) <= GROUND_SLAM_RADIUS) onEnemyHit(e.id, slamDmg, 'kick');
      });
      dummies.forEach((d) => {
        if (d.health <= 0) return;
        const dx = d.position.x - slamPos.x;
        const dz = d.position.z - slamPos.z;
        if (Math.hypot(dx, dz) <= GROUND_SLAM_RADIUS) onDummyHit(d.id, slamDmg);
      });
      civilians.forEach((c) => {
        if (c.health <= 0) return;
        const dx = c.position.x - slamPos.x;
        const dz = c.position.z - slamPos.z;
        if (Math.hypot(dx, dz) <= GROUND_SLAM_RADIUS) onCivilianHit?.(c.id, slamDmg);
      });
    }
    wasGroundedRef.current = currentlyGrounded;

    // Only LIVING dummies/enemies block movement outright; dead ones (a
    // ragdoll corpse) never inhibit the player - contact just shoves them
    // along instead (see the push block below).
    const blockerXZ = [
      ...dummies.filter((d) => d.health > 0).map((d) => ({ x: d.position.x, z: d.position.z })),
      ...enemies.filter((e) => e.health > 0).map((e) => ({ x: e.position.x, z: e.position.z })),
      ...civilians.filter((c) => c.health > 0).map((c) => ({ x: c.position.x, z: c.position.z }))
    ];

    const resolved = resolveCollision(
      prevX,
      prevZ,
      playerRef.current.position.x,
      playerRef.current.position.z,
      playerRef.current.position.y,
      colliders,
      blockerXZ
    );
    playerRef.current.position.x = resolved.x;
    playerRef.current.position.z = resolved.z;

    // Corpses (dummy or enemy) are loose physics props you shove by walking
    // into them. This is consumed as a one-shot impulse each frame (see
    // DummyActor/EnemyActor), so it must be SET from the current overlap,
    // not accumulated - otherwise sustained contact compounds into runaway
    // velocity frame after frame.
    dummies.forEach((d) => {
      if (d.health > 0) return;
      const dx = playerRef.current!.position.x - d.position.x;
      const dz = playerRef.current!.position.z - d.position.z;
      const dist = Math.hypot(dx, dz);
      const minDist = PLAYER_RADIUS + HUMANOID_RADIUS;
      if (dist > 0.0001 && dist < minDist) {
        const overlap = Math.min(minDist - dist, 0.3);
        d.velocity.x = (-dx / dist) * overlap * 8;
        d.velocity.z = (-dz / dist) * overlap * 8;
      } else {
        d.velocity.x = 0;
        d.velocity.z = 0;
      }
    });

    enemies.forEach((e) => {
      if (e.health > 0) return;
      const dx = playerRef.current!.position.x - e.position.x;
      const dz = playerRef.current!.position.z - e.position.z;
      const dist = Math.hypot(dx, dz);
      const minDist = PLAYER_RADIUS + HUMANOID_RADIUS * (e.sizeMultiplier ?? 1);
      if (dist > 0.0001 && dist < minDist) {
        const overlap = Math.min(minDist - dist, 0.3);
        e.velocity.x = (-dx / dist) * overlap * 8;
        e.velocity.z = (-dz / dist) * overlap * 8;
      } else {
        e.velocity.x = 0;
        e.velocity.z = 0;
      }
    });

    civilians.forEach((c) => {
      if (c.health > 0) return;
      const dx = playerRef.current!.position.x - c.position.x;
      const dz = playerRef.current!.position.z - c.position.z;
      const dist = Math.hypot(dx, dz);
      const minDist = PLAYER_RADIUS + HUMANOID_RADIUS;
      if (dist > 0.0001 && dist < minDist) {
        const overlap = Math.min(minDist - dist, 0.3);
        c.velocity.x = (-dx / dist) * overlap * 8;
        c.velocity.z = (-dz / dist) * overlap * 8;
      } else {
        c.velocity.x = 0;
        c.velocity.z = 0;
      }
    });

    updateCameraBones();

    // Hit detection tracks the actual fist (right hand bone) every frame of
    // the swing, so a hit only lands when the hand physically reaches the
    // target - not the instant the punch animation starts.
    if (currentActionRef.current === 'punch' && !punchHitRegisteredRef.current && rightHandBoneRef.current) {
      rightHandBoneRef.current.getWorldPosition(punchHandWorldPos.current);
      const hand = punchHandWorldPos.current;
      let bestDist = Infinity;
      let bestCrateId: string | null = null;
      let bestDummyId: string | null = null;
      let bestEnemyId: string | null = null;
      let bestTurretId: string | null = null;
      const nowMs = Date.now();

      crates.forEach((crate) => {
        const half = crate.size / 2;
        const closestX = Math.max(crate.position[0] - half, Math.min(hand.x, crate.position[0] + half));
        const closestY = Math.max(0, Math.min(hand.y, crate.size));
        const closestZ = Math.max(crate.position[2] - half, Math.min(hand.z, crate.position[2] + half));
        const dist = Math.hypot(hand.x - closestX, hand.y - closestY, hand.z - closestZ);
        if (dist < FIST_HIT_RADIUS && dist < bestDist) {
          bestDist = dist;
          bestCrateId = crate.id;
          bestDummyId = null;
          bestEnemyId = null;
        }
      });

      dummies.forEach((d) => {
        if (d.health <= 0) return;
        const dx = hand.x - d.position.x;
        const dy = hand.y - (d.position.y + 1.1);
        const dz = hand.z - d.position.z;
        const dist = Math.hypot(dx, dy, dz);
        if (dist < FIST_HIT_RADIUS + HUMANOID_RADIUS && dist < bestDist) {
          bestDist = dist;
          bestDummyId = d.id;
          bestCrateId = null;
          bestEnemyId = null;
        }
      });

      enemies.forEach((e) => {
        if (e.health <= 0) return;
        // Phased (intangible) enemies can't be targeted - the fist passes
        // straight through instead of eating the swing.
        if (e.phasedUntilMs !== undefined && nowMs < e.phasedUntilMs) return;
        const dx = hand.x - e.position.x;
        const dy = hand.y - (e.position.y + 1.1);
        const dz = hand.z - e.position.z;
        const dist = Math.hypot(dx, dy, dz);
        if (dist < FIST_HIT_RADIUS + HUMANOID_RADIUS * (e.sizeMultiplier ?? 1) && dist < bestDist) {
          bestDist = dist;
          bestEnemyId = e.id;
          bestDummyId = null;
          bestCrateId = null;
        }
      });

      turrets.forEach((t) => {
        if (t.owner !== 'enemy' || t.health <= 0) return;
        const dx = hand.x - t.position.x;
        const dy = hand.y - (t.position.y + 0.45);
        const dz = hand.z - t.position.z;
        const dist = Math.hypot(dx, dy, dz);
        if (dist < FIST_HIT_RADIUS + TURRET_HIT_RADIUS && dist < bestDist) {
          bestDist = dist;
          bestTurretId = t.id;
          bestEnemyId = null;
          bestDummyId = null;
          bestCrateId = null;
        }
      });

      let bestCivilianId: string | null = null;
      civilians.forEach((c) => {
        if (c.health <= 0) return;
        const dx = hand.x - c.position.x;
        const dy = hand.y - (c.position.y + 1.1);
        const dz = hand.z - c.position.z;
        const dist = Math.hypot(dx, dy, dz);
        if (dist < FIST_HIT_RADIUS + HUMANOID_RADIUS && dist < bestDist) {
          bestDist = dist;
          bestCivilianId = c.id;
          bestTurretId = null;
          bestEnemyId = null;
          bestDummyId = null;
          bestCrateId = null;
        }
      });
      if (bestCivilianId !== null) {
        punchHitRegisteredRef.current = true;
        onCivilianHit?.(bestCivilianId, rollCritDamage((PUNCH_DAMAGE + damageBonus) * damageMultiplier, critChance));
      }

      if (bestCrateId !== null) {
        punchHitRegisteredRef.current = true;
        onCrateHit(bestCrateId, rollCritDamage((PUNCH_DAMAGE + damageBonus) * damageMultiplier, critChance));
      } else if (bestDummyId !== null) {
        punchHitRegisteredRef.current = true;
        onDummyHit(bestDummyId, rollCritDamage((PUNCH_DAMAGE + damageBonus) * damageMultiplier, critChance));
      } else if (bestEnemyId !== null) {
        punchHitRegisteredRef.current = true;
        onEnemyHit(bestEnemyId, rollCritDamage((PUNCH_DAMAGE + damageBonus) * damageMultiplier, critChance), 'punch');
      } else if (bestTurretId !== null) {
        punchHitRegisteredRef.current = true;
        onTurretHit?.(bestTurretId, rollCritDamage((PUNCH_DAMAGE + damageBonus) * damageMultiplier, critChance));
      }
    }

    // Same swing-tracking hit detection as the punch, but follows the right
    // foot bone and only runs during the kick one-shot. Unlike punch, kick
    // is a sweeping AOE hit - everything within reach when the foot connects
    // takes damage, not just the single closest target.
    if (currentActionRef.current === 'kick' && !kickHitRegisteredRef.current && rightFootBoneRef.current) {
      rightFootBoneRef.current.getWorldPosition(kickFootWorldPos.current);
      const foot = kickFootWorldPos.current;
      let hitSomething = false;

      crates.forEach((crate) => {
        const half = crate.size / 2;
        const closestX = Math.max(crate.position[0] - half, Math.min(foot.x, crate.position[0] + half));
        const closestY = Math.max(0, Math.min(foot.y, crate.size));
        const closestZ = Math.max(crate.position[2] - half, Math.min(foot.z, crate.position[2] + half));
        const dist = Math.hypot(foot.x - closestX, foot.y - closestY, foot.z - closestZ);
        if (dist < FOOT_HIT_RADIUS) {
          hitSomething = true;
          onCrateHit(crate.id, rollCritDamage((KICK_DAMAGE + damageBonus) * damageMultiplier, critChance));
        }
      });

      dummies.forEach((d) => {
        if (d.health <= 0) return;
        const dx = foot.x - d.position.x;
        const dy = foot.y - (d.position.y + 1.1);
        const dz = foot.z - d.position.z;
        const dist = Math.hypot(dx, dy, dz);
        if (dist < FOOT_HIT_RADIUS + HUMANOID_RADIUS) {
          hitSomething = true;
          onDummyHit(d.id, rollCritDamage((KICK_DAMAGE + damageBonus) * damageMultiplier, critChance));
        }
      });

      const nowMsKick = Date.now();
      enemies.forEach((e) => {
        if (e.health <= 0) return;
        if (e.phasedUntilMs !== undefined && nowMsKick < e.phasedUntilMs) return;
        const dx = foot.x - e.position.x;
        const dy = foot.y - (e.position.y + 1.1);
        const dz = foot.z - e.position.z;
        const dist = Math.hypot(dx, dy, dz);
        if (dist < FOOT_HIT_RADIUS + HUMANOID_RADIUS * (e.sizeMultiplier ?? 1)) {
          hitSomething = true;
          onEnemyHit(e.id, rollCritDamage((KICK_DAMAGE + damageBonus) * damageMultiplier, critChance), 'kick');
        }
      });

      turrets.forEach((t) => {
        if (t.owner !== 'enemy' || t.health <= 0) return;
        const dx = foot.x - t.position.x;
        const dy = foot.y - (t.position.y + 0.45);
        const dz = foot.z - t.position.z;
        const dist = Math.hypot(dx, dy, dz);
        if (dist < FOOT_HIT_RADIUS + TURRET_HIT_RADIUS) {
          hitSomething = true;
          onTurretHit?.(t.id, rollCritDamage((KICK_DAMAGE + damageBonus) * damageMultiplier, critChance));
        }
      });

      civilians.forEach((c) => {
        if (c.health <= 0) return;
        const dx = foot.x - c.position.x;
        const dy = foot.y - (c.position.y + 1.1);
        const dz = foot.z - c.position.z;
        const dist = Math.hypot(dx, dy, dz);
        if (dist < FOOT_HIT_RADIUS + HUMANOID_RADIUS) {
          hitSomething = true;
          onCivilianHit?.(c.id, rollCritDamage((KICK_DAMAGE + damageBonus) * damageMultiplier, critChance));
        }
      });

      // Footballs are checked last and don't set hitSomething: booting a ball
      // shouldn't consume the swing, so one kick can catch an enemy AND the
      // ball sitting behind them. Only balls at rest are kickable.
      footballs?.forEach((ball) => {
        if (ball.rollTimer > 0) return;
        const dx = ball.position.x - foot.x;
        const dz = ball.position.z - foot.z;
        const dist = Math.hypot(dx, dz);
        if (dist < FOOTBALL_KICK_RADIUS + FOOTBALL_RADIUS) {
          // Aim along the player's facing rather than foot-to-ball, so the
          // ball goes where you're looking instead of wherever the swing
          // happened to plant the foot.
          const yaw = playerRef.current?.rotation.y ?? 0;
          onFootballKick?.(ball.id, Math.sin(yaw), Math.cos(yaw));
        }
      });

      if (hitSomething) kickHitRegisteredRef.current = true;
    }
  });

  return (
    <group ref={playerRef} position={[0, 0, 0]}>
      <primitive object={baseModel} scale={0.012} />
      {flashlightOn && (
        <>
          <primitive object={flashlightTarget} position={[0, 1, 6]} />
          <spotLight
            position={[0, 1.6, 0.3]}
            target={flashlightTarget}
            angle={0.5}
            penumbra={0.4}
            intensity={FLASHLIGHT_BASE_INTENSITY + flashlightLevel * FLASHLIGHT_INTENSITY_PER_LEVEL}
            distance={FLASHLIGHT_BASE_DISTANCE + flashlightLevel * FLASHLIGHT_DISTANCE_PER_LEVEL}
            color="#fff7d6"
          />
        </>
      )}
    </group>
  );
};
