import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Player } from './Player';
import { CameraController } from './CameraController';
import { EnvironmentFloor } from './EnvironmentFloor';
import { WorldObjects } from './WorldObjects';
import { DummyActor } from './DummyActor';
import { EnemyActor } from './EnemyActor';
import { HelperActor } from './HelperActor';
import { CivilianActor } from './CivilianActor';
import { LevelUpChoice, OPTION_INFO } from './LevelUpChoice';
import { Projectiles, ProjectilesHandle } from './Projectiles';
import { BattleFlag } from './BattleFlag';
import { Medkit } from './Medkit';
import { Footballs } from './Footballs';
import { SkyCycle } from './SkyCycle';
import { PlayerCorpse } from './PlayerCorpse';
import { BloodParticles, BloodParticlesHandle } from './BloodParticles';
import { DebrisParticles, DebrisParticlesHandle } from './DebrisParticles';
import { DamageNumbers, DamageNumbersHandle } from './DamageNumbers';
import { DroneCompanion } from './DroneCompanion';
import { Turrets } from './Turrets';
import { Bombs } from './Bombs';
import { FallingChunks, FallingChunksHandle } from './FallingChunks';
import { ArenaEnvironment, ArenaPhase } from './ArenaEnvironment';
import { PhysicsStepper } from './PhysicsStepper';
import { ViewMode } from '../types/game.types';
import {
  AABB,
  BattleFlagDef,
  CrateDef,
  INITIAL_BASIC_ENEMY_SPAWNS,
  INITIAL_CRATE_DEFS,
  INITIAL_DUMMY_SPAWNS,
  INITIAL_FLAG_DEFS,
  INITIAL_FOOTBALL_SPAWNS,
  INITIAL_MEDKIT_DEFS,
  INITIAL_PLATFORM_DEFS,
  LightBlockDef,
  MAP_RADIUS,
  MedkitDef,
  WALL_COLLIDERS,
  flagCountForLevel,
  generateBasicEnemySpawn,
  generateCrateDef,
  generateDummySpawnPosition,
  generateEnemySpawnPosition,
  generateFlagDef,
  generateLightBlockDef,
  generateMedkitDef,
  getCrateCollider,
  getPlatformCollider,
  regenerateFlagsForLevel
} from '../world/worldObjects';
import {
  CLEAR_VARIANT_CHANCE,
  CLEAR_VARIANT_WEAKNESS,
  BOMB_DAMAGE,
  BOMB_FUSE_SECONDS,
  BOMB_RADIUS,
  BombState,
  BOUNTY_HUNTER_SPAWN_SECONDS,
  CIVILIAN_MAX_HEALTH,
  CIVILIAN_PANIC_MS,
  CIVILIAN_RESCUE_RADIUS,
  CivilianState,
  CRATE_MAX_HEALTH,
  CRATE_MEDKIT_DROP_CHANCE,
  DEAD_BODY_LIMIT,
  DUMMY_KILLS_PER_ENEMY_SCALE,
  DUMMY_MAX_HEALTH,
  DummyState,
  ENEMY_AUTO_SCALE_PER_LEVEL,
  ENEMY_PLAYER_AGGRO_MS,
  ENEMY_TURRET_HEALTH,
  ENEMY_TURRET_LIFETIME_MS,
  ENEMY_COMBO_AMOUNT,
  ENEMY_SPAWN_RATE_AMOUNT_PER_PICK,
  ENEMY_SPAWN_RATE_INTERVAL_MS,
  ENEMY_TIME_SCALE_AMOUNT,
  ENEMY_TIME_SCALE_INTERVAL_MS,
  EnemyState,
  GIANT_INSTANCE_HEALTH_MULTIPLIER,
  GIANT_INSTANCE_SIZE_MULTIPLIER,
  HELPER_BASE_SPEED_MULTIPLIER,
  HELPER_INITIAL_HEALTH,
  HELPER_INITIAL_KICK_DAMAGE,
  HELPER_INITIAL_PUNCH_DAMAGE,
  HELPER_LEVEL_UP_2_AMOUNT,
  HELPER_PICKS_PER_UPGRADE,
  HELPER_SPEED_UPGRADE_AMOUNT,
  HELPER_UPGRADE_AMOUNT,
  HelperState,
  SavedHelper,
  HUMANOID_RADIUS,
  LevelChoiceOption,
  MAX_ACTIVE_BOMBS,
  MAX_ENEMY_TURRETS,
  MEDKIT_PICKUP_RADIUS,
  PLAYER_COMBO_BIG_AMOUNT,
  PLAYER_COMBO_SMALL_AMOUNT,
  PLAYER_MAX_HEALTH,
  PLAYER_MAX_STAMINA,
  PlayerCorpseState,
  PUNCH_DAMAGE,
  SCORE_PER_CRATE,
  SCORE_PER_KILL,
  SPECIAL_HEALTH_BUFFER_OVER_PLAYER,
  SPECIAL_PLAYER_SCALE_GROWTH_FACTOR,
  SPEED_BONUS_PER_PICK,
  SPEED_DEMON_BONUS,
  SPLIT_COPY_SIZE_MULTIPLIER,
  SPLIT_HEALTH_FRACTION,
  DEATH_CHEAT_RAGDOLL_MS,
  MAX_ACTIVE_MINES,
  MINE_STUN_DURATION,
  SLIME_KING_BABY_HEALTH,
  STORM_CHAIN_RANGE,
  STORM_MAN_WEATHER_CHANCE,
  MineState,
  ARMY_AGGRO_MS,
  ARMY_MAX_HEALTH,
  ARMY_SIGHT_RADIUS,
  ARMY_SPAWN_WITH_CIVILIAN_CHANCE,
  BODYGUARD_MAX_HEALTH,
  ENEMY_GUARD_ATTACH_CHANCE,
  GUARD_ALERT_MS,
  ARENA_BOX_GROWTH_PER_WAVE,
  ARENA_BOX_MAX_HALF,
  ARENA_BOX_START_HALF,
  ARENA_CONCRETE_END_WAVE,
  ARENA_CONCRETE_HALF_X,
  ARENA_CONCRETE_HALF_Z,
  ARENA_ENEMY_DAMAGE_PER_WAVE,
  ARENA_ENEMY_HEALTH_PER_WAVE,
  ARENA_FALL_WAVE,
  ARENA_LAVA_TILE_COUNT,
  ARENA_MAGMA_RADIUS,
  BOSS_ARENA_RADIUS,
  HAZARD_TILE_LIFETIME_MS,
  HAZARD_WAVE_INTERVAL,
  HAZARD_WAVE_TILE_COUNT,
  LAVA_TILE_MAX_RADIUS,
  LAVA_TILE_MIN_RADIUS,
  LavaTileDef,
  ARENA_SAND_END_WAVE,
  ARENA_SAND_RADIUS,
  ARENA_SAND_WALL_SEGMENTS,
  ARENA_WALL_HEIGHT,
  ARENA_WAVE_BREAK_SECONDS,
  GameModifiers,
  GLASS_CANNON_DAMAGE_MULTIPLIER,
  createDefaultModifiers,
  STAMINA_MAX_BONUS_PER_PICK,
  StatModifiers,
  THORNS_DAMAGE,
  TurretState,
  VAMPIRE_KILL_HEAL,
  VAMPIRE_LIFESTEAL_FRACTION,
  computeCritChance,
  createStatModifiers,
  ARMY_MEDKIT_HEAL,
  BODYGUARD_PROTECT_DISTANCE,
  VIP_BODYGUARD_COUNT,
  VIP_MAX_HEALTH,
  FOOTBALL_KICK_SPEED,
  FOOTBALL_MAX_ROLL_SECONDS,
  FOOTBALL_STUN_MS,
  FootballState
} from '../world/gameState';
import {
  AttackPayload,
  BASIC_ENEMY_TYPES,
  BOUNTY_HUNTER_TYPE,
  COMMON_BASIC_ENEMY_TYPES,
  CUBE_ENEMY_TYPES,
  ENEMY_BLOOD_COLORS,
  ENEMY_CONFIGS,
  EnemyType,
  RARE_ENEMY_TYPES,
  SMASH_BALL_TYPES,
  SPECIAL_ENEMY_TYPES,
  applyAttackPayload,
  pickRandomSpecialType
} from '../world/enemyConfig';
import { CubeEnemyActor } from './CubeEnemyActor';
import { SmashBallActor } from './SmashBallActor';
import { Mines } from './Mines';
import { LavaTiles } from './LavaTiles';
import { Rain } from './Rain';
import { PortalPairDef, Portals } from './Portals';
import {
  statsRecordArenaWave,
  statsRecordBossWin,
  statsRecordDamageDealt,
  statsRecordDamageTaken,
  statsRecordDeath,
  statsRecordKill,
  statsRecordLevel,
  statsResetRun
} from '../world/stats';
import { audio, SfxName } from '../world/audio';
import { createStatusEffects } from '../world/statusEffects';
import { syncCratePhysicsBodies } from '../world/physicsWorld';

export interface SpawnOptions {
  clear?: boolean;
  giant?: boolean;
  armoured?: boolean;
}

export interface SandboxActions {
  spawnEnemy: (type: EnemyType, options?: SpawnOptions) => void;
  spawnAsHelper: (type: EnemyType) => void;
  spawnDummy: () => void;
  spawnCivilian: () => void;
  spawnCivilianHelper: () => void;
  spawnArmyMan: (kind: 'melee' | 'ranged') => void;
  spawnBodyguard: () => void;
  spawnVip: () => void;
  spawnEnemyBodyguard: () => void;
  spawnEnemyTurret: () => void;
  spawnFlag: (variant: 'normal' | 'giant' | 'bonus' | 'challenge' | 'clear' | 'boss') => void;
  spawnPortalPair: () => void;
  giveUpgrade: (option: LevelChoiceOption) => void;
  patchStatMods: (patch: Partial<StatModifiers>) => void;
  resetStats: () => void;
  upgradeHelper: (id: string, option: 'helperMoveSpeed' | 'helperAttackSpeed' | 'helperLevelUp2') => void;
  setTimeOfDay: (t: 'day' | 'night' | null) => void;
  setEnemiesIgnorePlayer: (ignore: boolean) => void;
}

interface GameCanvasProps {
  playerTint: string;
  viewMode: ViewMode;
  onScoreAdd: (amount: number) => void;
  onPlayerHealthChange: (health: number) => void;
  onMaxHealthChange: (max: number) => void;
  onKill: () => void;
  onLevelChange: (level: number) => void;
  onFlagsProgressChange: (remaining: number, total: number) => void;
  onDeathsChange: (deaths: number) => void;
  onSpecialKillsChange: (count: number) => void;
  onLevelTimeChange: (seconds: number) => void;
  onStatusEffectChange: (label: string | null) => void;
  onPendingSpecialsChange: (count: number) => void;
  onFlagGuideChange: (data: FlagGuideInfo | null) => void;
  onStaminaChange: (stamina: number, max: number) => void;
  onStatModifiersChange?: (mods: StatModifiers) => void;
  onLoaded?: () => void;
  manuallyPaused: boolean;
  showDebugInfo: boolean;
  flashlightOn: boolean;
  showLastWords?: boolean;
  initialLevel?: number;
  initialStatModifiers?: StatModifiers;
  initialHelpers?: SavedHelper[];
  onHelpersChange?: (helpers: SavedHelper[]) => void;
  initialDroneLevel?: number;
  onDroneLevelChange?: (level: number) => void;
  initialTurretLevel?: number;
  onTurretLevelChange?: (level: number) => void;
  isSandbox?: boolean;
  onSandboxReady?: (actions: SandboxActions) => void;
  // Main-menu settings.
  cameraFov?: number;
  // Third-person follow distance factor (1 = classic).
  cameraDistance?: number;
  showBlood?: boolean;
  showDamageNumbers?: boolean;
  showMinimap?: boolean;
  showEnemyHealthBars?: boolean;
  // Run modifiers (one-hit, ironman, glass cannon, speed demon, night).
  modifiers?: GameModifiers;
  onIronmanDeath?: () => void;
  // Arena mode.
  isArena?: boolean;
  onArenaWaveChange?: (wave: number, phase: ArenaPhase) => void;
  // Live entity counts for the sandbox HUD readout.
  onEntityCountsChange?: (counts: { enemies: number; dummies: number; civilians: number; helpers: number; turrets: number }) => void;
  // First-appearance banner for specials/rares ("A Lava Man appears!").
  onSpawnCallout?: (label: string) => void;
  // Fresh normal-mode runs: draft 3 starting upgrades from a pool of 9.
  offerLoadoutDraft?: boolean;
}

export interface FlagGuideInfo {
  near: boolean;
  angleRad: number;
  distanceMeters: number;
}

const FLAG_INTERACT_RADIUS = 2.2;
const ALL_LEVEL_CHOICE_OPTIONS: LevelChoiceOption[] = [
  'enemyHealth',
  'enemyDamage',
  'enemyAttackSpeed',
  'enemyMoveSpeed',
  'playerHealth',
  'playerDamage',
  'playerAttackSpeed',
  'playerMoveSpeed',
  'helper',
  'helperMoveSpeed',
  'helperAttackSpeed',
  'helperLevelUp2',
  'staminaMax',
  'enemySpawnRate',
  'critChance',
  'lightBlock',
  'playerComboSmall',
  'playerComboBig',
  'enemyCombo',
  'flashlightUpgrade',
  'drone',
  'thorns',
  'dash',
  'parry',
  'groundSlam',
  'challengeFlag',
  'turret',
  'helperRanged'
];

// Helper-targeted options are dead-ends with zero helpers to target (the
// dropdown would show nothing to pick), so they're excluded from the pool
// until at least one helper exists.
const HELPER_ONLY_OPTIONS: LevelChoiceOption[] = ['helperMoveSpeed', 'helperAttackSpeed', 'helperLevelUp2', 'helperRanged'];
// Ability upgrades that should only appear once (re-picking doesn't stack any useful benefit).
const ONCE_ONLY_OPTIONS: LevelChoiceOption[] = ['thorns', 'dash', 'parry', 'groundSlam', 'challengeFlag'];

const pickRandomOptions = (count: number, hasHelpers: boolean, statModifiers: { thornsPicks: number; dashPicks: number; parryPicks: number; groundSlamPicks: number }): LevelChoiceOption[] => {
  const pool = ALL_LEVEL_CHOICE_OPTIONS.filter((opt) => {
    if (!hasHelpers && HELPER_ONLY_OPTIONS.includes(opt)) return false;
    if (ONCE_ONLY_OPTIONS.includes(opt)) {
      if (opt === 'thorns' && statModifiers.thornsPicks > 0) return false;
      if (opt === 'dash' && statModifiers.dashPicks > 0) return false;
      if (opt === 'parry' && statModifiers.parryPicks > 0) return false;
      if (opt === 'groundSlam' && statModifiers.groundSlamPicks > 0) return false;
    }
    return true;
  });
  const picks: LevelChoiceOption[] = [];
  const remaining = [...pool];
  for (let i = 0; i < count && remaining.length > 0; i++) {
    picks.push(...remaining.splice(Math.floor(Math.random() * remaining.length), 1));
  }
  return picks;
};

const pickTwoRandomOptions = (hasHelpers: boolean, statMods?: { thornsPicks: number; dashPicks: number; parryPicks: number; groundSlamPicks: number }): LevelChoiceOption[] =>
  pickRandomOptions(2, hasHelpers, statMods ?? { thornsPicks: 0, dashPicks: 0, parryPicks: 0, groundSlamPicks: 0 });

interface MedkitPickupHandlerProps {
  playerRef: React.RefObject<THREE.Group>;
  medkits: MedkitDef[];
  playerHealth: number;
  maxHealth: number;
  onHeal: () => void;
  onMedkitConsumed: (medkitId: string) => void;
}

// useFrame only works on components rendered inside <Canvas>, and
// GameCanvas itself renders the <Canvas> rather than living inside it - so
// the medkit proximity check needs to live in its own tiny child component.
const MedkitPickupHandler: React.FC<MedkitPickupHandlerProps> = ({ playerRef, medkits, playerHealth, maxHealth, onHeal, onMedkitConsumed }) => {
  useFrame(() => {
    if (!playerRef.current || playerHealth >= maxHealth) return;
    const playerPos = playerRef.current.position;
    const hit = medkits.find((m) => {
      const dx = playerPos.x - m.position[0];
      const dz = playerPos.z - m.position[2];
      return Math.hypot(dx, dz) < MEDKIT_PICKUP_RADIUS;
    });
    if (hit) {
      onHeal();
      onMedkitConsumed(hit.id);
    }
  });
  return null;
};

interface FlagGuideHandlerProps {
  playerRef: React.RefObject<THREE.Group>;
  flags: BattleFlagDef[];
  viewMode: ViewMode;
  onChange: (data: FlagGuideInfo | null) => void;
}

const FLAG_GUIDE_ANGLE_EPSILON = 0.02;
const FLAG_GUIDE_DISTANCE_EPSILON = 0.15;

// Drives both the "Press E" prompt and the compass arrow off one shared
// nearest-flag computation each frame, only pushing an update up when the
// result actually changed enough to matter (avoids spamming React state).
const FlagGuideHandler: React.FC<FlagGuideHandlerProps> = ({ playerRef, flags, viewMode, onChange }) => {
  const lastSentRef = useRef<FlagGuideInfo | null>(null);
  useFrame(() => {
    if (!playerRef.current) return;
    if (flags.length === 0) {
      if (lastSentRef.current !== null) {
        lastSentRef.current = null;
        onChange(null);
      }
      return;
    }
    const playerPos = playerRef.current.position;
    let nearestFlag = flags[0];
    let nearestDist = Infinity;
    flags.forEach((f) => {
      const dx = f.position[0] - playerPos.x;
      const dz = f.position[2] - playerPos.z;
      const dist = Math.hypot(dx, dz);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestFlag = f;
      }
    });

    const dx = nearestFlag.position[0] - playerPos.x;
    const dz = nearestFlag.position[2] - playerPos.z;
    // Third-person camera is fixed at world +Z offset → screen-up = world -Z.
    // First-person camera rotates with the player, so subtract player bearing.
    let relativeAngle: number;
    if (viewMode === 'third') {
      relativeAngle = Math.atan2(dx, -dz);
    } else {
      const raw = Math.atan2(dx, dz) - playerRef.current.rotation.y;
      relativeAngle = Math.atan2(Math.sin(raw), Math.cos(raw));
    }
    const near = nearestDist < FLAG_INTERACT_RADIUS;

    const prev = lastSentRef.current;
    const changed =
      !prev ||
      prev.near !== near ||
      Math.abs(prev.angleRad - relativeAngle) > FLAG_GUIDE_ANGLE_EPSILON ||
      Math.abs(prev.distanceMeters - nearestDist) > FLAG_GUIDE_DISTANCE_EPSILON;
    if (changed) {
      const next = { near, angleRad: relativeAngle, distanceMeters: nearestDist };
      lastSentRef.current = next;
      onChange(next);
    }
  });
  return null;
};

const MINIMAP_SIZE = 150;

interface MinimapDriverProps {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  playerRef: React.RefObject<THREE.Group>;
  enemies: EnemyState[];
  flags: BattleFlagDef[];
  medkits: MedkitDef[];
  dummies: DummyState[];
  helpers: HelperState[];
  lightBlocks: LightBlockDef[];
  turrets: TurretState[];
  bombs: BombState[];
  civilians: CivilianState[];
  // Shape/extent of the current playfield so the map outline matches it.
  mapShape: { kind: 'circle' | 'rect' | 'pentagon'; halfX: number; halfZ: number };
}

// A plain 2D-canvas top-down map, redrawn every frame from a ref the parent
// passes in. The minimap itself has to live outside <Canvas> as a normal DOM
// element (it's not a 3D scene object), but the per-frame draw loop that
// fills it needs useFrame, hence this tiny driver mirrors the
// MedkitPickupHandler/FlagGuideHandler pattern of doing the work inside the
// <Canvas> tree and writing out through a ref rather than React state.
const MinimapDriver: React.FC<MinimapDriverProps> = ({ canvasRef, playerRef, enemies, flags, medkits, dummies, helpers, lightBlocks, turrets, bombs, civilians, mapShape }) => {
  useFrame(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !playerRef.current) return;
    const extent = Math.max(mapShape.halfX, mapShape.halfZ) * 1.06;
    const scale = MINIMAP_SIZE / (extent * 2);
    const toMap = (x: number, z: number) => ({ mx: MINIMAP_SIZE / 2 + x * scale, my: MINIMAP_SIZE / 2 + z * scale });

    ctx.clearRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE);
    // Background matches the current playfield's actual shape.
    ctx.fillStyle = 'rgba(15,25,12,0.88)';
    ctx.beginPath();
    if (mapShape.kind === 'rect') {
      const hx = mapShape.halfX * scale;
      const hz = mapShape.halfZ * scale;
      ctx.rect(MINIMAP_SIZE / 2 - hx, MINIMAP_SIZE / 2 - hz, hx * 2, hz * 2);
    } else if (mapShape.kind === 'pentagon') {
      // Corners at angle i*72° to match the world pentagon's orientation.
      const r = mapShape.halfX * scale;
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        const px = MINIMAP_SIZE / 2 + Math.cos(a) * r;
        const py = MINIMAP_SIZE / 2 + Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
    } else {
      ctx.arc(MINIMAP_SIZE / 2, MINIMAP_SIZE / 2, mapShape.halfX * scale, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.strokeStyle = 'rgba(79,195,247,0.4)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    const dot = (x: number, z: number, color: string, r = 2) => {
      const { mx, my } = toMap(x, z);
      if (mx < 0 || mx > MINIMAP_SIZE || my < 0 || my > MINIMAP_SIZE) return;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(mx, my, r, 0, Math.PI * 2);
      ctx.fill();
    };

    lightBlocks.forEach((lb) => dot(lb.position[0], lb.position[2], lb.color, 2));
    turrets.forEach((t) => {
      if (t.health > 0) dot(t.position.x, t.position.z, t.owner === 'player' ? '#4fc3f7' : '#ff8f00', 1.8);
    });
    bombs.forEach((b) => dot(b.position.x, b.position.z, '#ff9800', 2.2));
    civilians.forEach((c) => {
      if (c.health <= 0) return;
      // Neutral-family colors: civilians white, armymen army-green,
      // bodyguards steel grey.
      const color = c.role === 'armyMelee' || c.role === 'armyRanged' ? '#8bc34a' : c.role === 'bodyguard' ? '#90a4ae' : '#f5f0e6';
      dot(c.position.x, c.position.z, color, 1.8);
    });
    flags.forEach((f) => dot(f.position[0], f.position[2], '#ffca28', 2.5));
    medkits.forEach((m) => dot(m.position[0], m.position[2], '#66bb6a', 2));
    dummies.forEach((d) => {
      if (d.health > 0) dot(d.position.x, d.position.z, '#c2b280', 1.6);
    });
    // Threat colors: basics red, rares orange, specials magenta; giants get
    // a bigger dot.
    enemies.forEach((e) => {
      if (e.health <= 0) return;
      const type = e.type as EnemyType;
      const color = SPECIAL_ENEMY_TYPES.includes(type) ? '#e040fb' : RARE_ENEMY_TYPES.includes(type) ? '#ffa726' : '#ef5350';
      dot(e.position.x, e.position.z, color, e.isGiant ? 3.2 : 2);
    });
    helpers.forEach((h) => {
      if (h.health > 0) dot(h.position.x, h.position.z, '#00ff44', 2.5);
    });

    const p = playerRef.current.position;
    const { mx, my } = toMap(p.x, p.z);
    ctx.save();
    ctx.translate(mx, my);
    ctx.rotate(-playerRef.current.rotation.y);
    ctx.fillStyle = '#4fc3f7';
    ctx.beginPath();
    ctx.moveTo(0, 5);
    ctx.lineTo(3.2, -3.5);
    ctx.lineTo(-3.2, -3.5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  });
  return null;
};

const MAX_DEBUG_HITBOXES = 96;
const DEBUG_RING_BASE_RADIUS = 0.5;

interface DebugHitboxesProps {
  enabled: boolean;
  playerRef: React.RefObject<THREE.Group>;
  enemies: EnemyState[];
  dummies: DummyState[];
  helpers: HelperState[];
}

// A flat ring per living entity, sized to its actual collision radius -
// only mounted/ticking when the debug checkbox is on. Reuses the
// fixed-pool pattern (BloodParticles/Projectiles/etc.) since the live
// entity count varies but the mesh count can't change at runtime.
const DebugHitboxes: React.FC<DebugHitboxesProps> = ({ enabled, playerRef, enemies, dummies, helpers }) => {
  const meshRefs = useRef<(THREE.Mesh | null)[]>([]);

  useFrame(() => {
    if (!enabled) {
      meshRefs.current.forEach((m) => {
        if (m) m.visible = false;
      });
      return;
    }
    let slot = 0;
    const place = (pos: THREE.Vector3, radius: number, color: string) => {
      if (slot >= MAX_DEBUG_HITBOXES) return;
      const mesh = meshRefs.current[slot];
      slot++;
      if (!mesh) return;
      mesh.visible = true;
      mesh.position.set(pos.x, pos.y + 0.05, pos.z);
      mesh.scale.setScalar(radius / DEBUG_RING_BASE_RADIUS);
      (mesh.material as THREE.MeshBasicMaterial).color.set(color);
    };

    if (playerRef.current) place(playerRef.current.position, HUMANOID_RADIUS, '#4fc3f7');
    enemies.forEach((e) => {
      if (e.health > 0) place(e.position, HUMANOID_RADIUS * (e.sizeMultiplier ?? 1), '#ff5252');
    });
    helpers.forEach((h) => {
      if (h.health > 0) place(h.position, HUMANOID_RADIUS, '#69f0ae');
    });
    dummies.forEach((d) => {
      if (d.health > 0) place(d.position, HUMANOID_RADIUS, '#ffd54f');
    });

    for (let i = slot; i < MAX_DEBUG_HITBOXES; i++) {
      const mesh = meshRefs.current[i];
      if (mesh) mesh.visible = false;
    }
  });

  return (
    <group>
      {Array.from({ length: MAX_DEBUG_HITBOXES }).map((_, i) => (
        <mesh
          key={i}
          ref={(el) => {
            meshRefs.current[i] = el;
          }}
          visible={false}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <ringGeometry args={[DEBUG_RING_BASE_RADIUS - 0.05, DEBUG_RING_BASE_RADIUS, 20]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.9} depthTest={false} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  );
};

const makeEnemyState = (id: string, type: EnemyType, position: [number, number, number], healthBonus: number): EnemyState => {
  const config = ENEMY_CONFIGS[type];
  const maxHealth = config.maxHealth + healthBonus;
  return {
    id,
    type,
    health: maxHealth,
    maxHealth,
    position: new THREE.Vector3(...position),
    velocity: new THREE.Vector3(),
    sizeMultiplier: config.sizeMultiplier,
    // Resilient family: cheat-death charges baked in at spawn.
    revivesLeft: config.maxRevives,
    // Slime dynasty: how many generations deep this one splits.
    splitsLeft: config.splitGenerations
  };
};

// Summoned specials always stay at least SPECIAL_HEALTH_BUFFER_OVER_PLAYER
// above the player's current effective max health (a hard safety floor),
// on top of the strength chart, PLUS a level-and-player-HP-scaled bonus
// that grows fast early on then tapers off asymptotically (see
// SPECIAL_PLAYER_SCALE_GROWTH_FACTOR) - never literally unbounded, so a
// session that runs to a huge level number doesn't make every special
// unkillable. A small chance of spawning as a translucent, correspondingly
// weaker "Clear" variant is rolled here too, since it's a per-instance
// trait rather than anything baked into the static per-type config.
const makeSpecialEnemyState = (
  id: string,
  type: EnemyType,
  position: [number, number, number],
  healthBonus: number,
  playerEffectiveMaxHealth: number,
  isGiant: boolean,
  level: number,
  forceClear = false
): EnemyState => {
  const config = ENEMY_CONFIGS[type];
  const isClear = forceClear || Math.random() < CLEAR_VARIANT_CHANCE;
  const playerScaledBonus = playerEffectiveMaxHealth * SPECIAL_PLAYER_SCALE_GROWTH_FACTOR * (1 - 1 / Math.max(level, 1));
  let maxHealth = Math.max(
    config.maxHealth + healthBonus + playerScaledBonus,
    playerEffectiveMaxHealth + SPECIAL_HEALTH_BUFFER_OVER_PLAYER
  );
  if (isGiant) maxHealth *= GIANT_INSTANCE_HEALTH_MULTIPLIER;
  if (isClear) maxHealth = Math.round(maxHealth * CLEAR_VARIANT_WEAKNESS);
  maxHealth = Math.round(maxHealth);
  return {
    id,
    type,
    health: maxHealth,
    maxHealth,
    position: new THREE.Vector3(...position),
    velocity: new THREE.Vector3(),
    isClear,
    isGiant,
    sizeMultiplier: isGiant ? GIANT_INSTANCE_SIZE_MULTIPLIER : undefined
  };
};

// Arena fall transition: while the floor is gone, watch the player plummet;
// past the threshold, teleport them above the sand pit and hand control back.
const ArenaFallWatcher: React.FC<{
  active: boolean;
  playerRef: React.RefObject<THREE.Group>;
  onFellThrough: () => void;
}> = ({ active, playerRef, onFellThrough }) => {
  const firedRef = useRef(false);
  useEffect(() => {
    if (active) firedRef.current = false;
  }, [active]);
  useFrame(() => {
    if (!active || firedRef.current || !playerRef.current) return;
    if (playerRef.current.position.y < -14) {
      firedRef.current = true;
      playerRef.current.position.set(0, 7, 0);
      onFellThrough();
    }
  });
  return null;
};

// Applies the settings-menu FOV to the default camera whenever it changes -
// the Canvas `camera` prop only configures the camera at creation time.
const FovUpdater: React.FC<{ fov: number }> = ({ fov }) => {
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    cam.fov = fov;
    cam.updateProjectionMatrix();
  }, [camera, fov]);
  return null;
};

const LoadedNotifier: React.FC<{ onLoaded?: () => void }> = ({ onLoaded }) => {
  const notified = useRef(false);
  useFrame(() => {
    if (!notified.current && onLoaded) {
      notified.current = true;
      onLoaded();
    }
  });
  return null;
};

export const GameCanvas: React.FC<GameCanvasProps> = ({
  playerTint,
  viewMode,
  onScoreAdd,
  onPlayerHealthChange,
  onMaxHealthChange,
  onKill,
  onLevelChange,
  onFlagsProgressChange,
  onDeathsChange,
  onSpecialKillsChange,
  onLevelTimeChange,
  onStatusEffectChange,
  onPendingSpecialsChange,
  onFlagGuideChange,
  onStaminaChange,
  onStatModifiersChange,
  onLoaded,
  manuallyPaused,
  showDebugInfo,
  flashlightOn,
  showLastWords = false,
  initialLevel,
  initialStatModifiers,
  initialHelpers,
  onHelpersChange,
  initialDroneLevel,
  onDroneLevelChange,
  initialTurretLevel,
  onTurretLevelChange,
  isSandbox = false,
  onSandboxReady,
  cameraFov = 60,
  cameraDistance = 1,
  showBlood = true,
  showDamageNumbers = true,
  showMinimap = true,
  showEnemyHealthBars = true,
  modifiers = createDefaultModifiers(),
  onIronmanDeath,
  isArena = false,
  onArenaWaveChange,
  onEntityCountsChange,
  onSpawnCallout,
  offerLoadoutDraft = false
}) => {
  // Sandbox and arena share "no procedural map content" behavior.
  const isEmptyMapMode = isSandbox || isArena;
  const playerGroupRef = useRef<THREE.Group>(null);
  const chestPositionRef = useRef(new THREE.Vector3(0, 1.3, 0));
  const headPositionRef = useRef(new THREE.Vector3(0, 1.6, 0));
  const minimapCanvasRef = useRef<HTMLCanvasElement>(null);
  const bloodRef = useRef<BloodParticlesHandle>(null);
  const debrisRef = useRef<DebrisParticlesHandle>(null);
  const projectilesRef = useRef<ProjectilesHandle>(null);
  const damageNumbersRef = useRef<DamageNumbersHandle>(null);
  const playerStatusEffectsRef = useRef(createStatusEffects());

  const nextCrateId = useRef(INITIAL_CRATE_DEFS.length);
  const nextDummyId = useRef(INITIAL_DUMMY_SPAWNS.length);
  const nextEnemyId = useRef(INITIAL_BASIC_ENEMY_SPAWNS.length);
  const nextCorpseId = useRef(0);
  const nextFlagId = useRef(INITIAL_FLAG_DEFS.length);
  const nextHelperId = useRef(
    (initialHelpers ?? []).reduce((max, h) => {
      const n = parseInt((h.id ?? '').replace('helper-', ''), 10);
      return isNaN(n) ? max : Math.max(max, n + 1);
    }, 0)
  );
  const nextLightBlockId = useRef(0);
  // Plain counter, not React state - read/incremented synchronously inside
  // handleDummyHit so back-to-back kills in the same tick (e.g. AOE) can't
  // race a stale closed-over count the way a useState value would.
  const dummyKillCountRef = useRef(0);
  // Tracks when the player last died (epoch ms). Reset on death.
  // Used to determine when to spawn the Bounty Hunter (survive 3 min).
  const lastDeathTimestampRef = useRef(Date.now());
  const bountyHunterSpawnedRef = useRef(false);
  // Parry window: Player writes clock.elapsedTime + PARRY_WINDOW_SECONDS.
  // handleAttackOnPlayer reads this (in wall-clock seconds from useFrame).
  const parryWindowRef = useRef(0);
  // Dash invincibility: Player writes clock.elapsedTime + DASH_DURATION.
  const dashInvincibleRef = useRef(0);
  // Player's last-used attack kind - written by Player, read by Copycat Man.
  const playerLastAttackRef = useRef<'punch' | 'kick'>('punch');
  const nextTurretId = useRef(0);
  const nextBombId = useRef(0);
  const nextCivilianId = useRef(0);
  const chunksRef = useRef<FallingChunksHandle>(null);

  const [crates, setCrates] = useState<CrateDef[]>(isArena ? [] : INITIAL_CRATE_DEFS);
  const [crateHealth, setCrateHealth] = useState<Record<string, number>>(() =>
    isArena ? {} : Object.fromEntries(INITIAL_CRATE_DEFS.map((c) => [c.id, CRATE_MAX_HEALTH]))
  );
  const [dummies, setDummies] = useState<DummyState[]>(() =>
    isEmptyMapMode ? [] : INITIAL_DUMMY_SPAWNS.map((p, i) => ({
      id: `dummy-${i}`,
      health: DUMMY_MAX_HEALTH,
      position: new THREE.Vector3(...p),
      velocity: new THREE.Vector3()
    }))
  );
  const [enemies, setEnemies] = useState<EnemyState[]>(() =>
    isEmptyMapMode ? [] : INITIAL_BASIC_ENEMY_SPAWNS.map((spawn, i) => makeEnemyState(`enemy-${i}`, spawn.type, spawn.position, 0))
  );
  const [flags, setFlags] = useState(isEmptyMapMode ? [] as typeof INITIAL_FLAG_DEFS : INITIAL_FLAG_DEFS);
  const [medkits, setMedkits] = useState(isArena ? [] as MedkitDef[] : INITIAL_MEDKIT_DEFS);
  // Footballs are never consumed, so unlike medkits they're built once and
  // then mutated in place — position/velocity never go through setState.
  const footballsRef = useRef<FootballState[]>(
    (isArena || !modifiers.footballs ? [] : INITIAL_FOOTBALL_SPAWNS).map((f) => ({
      id: f.id,
      position: new THREE.Vector3(f.position[0], 0, f.position[2]),
      velocity: new THREE.Vector3(),
      rollTimer: 0,
      hitThisKick: new Set<string>()
    }))
  );

  // ── Arena mode state ──────────────────────────────────────────────────
  const [arenaPhase, setArenaPhase] = useState<ArenaPhase>('concrete');
  const [arenaWave, setArenaWave] = useState(0);
  const [arenaBoxHalf, setArenaBoxHalf] = useState(ARENA_BOX_START_HALF);
  const arenaPhaseRef = useRef<ArenaPhase>('concrete');
  arenaPhaseRef.current = arenaPhase;
  const arenaBoxHalfRef = useRef(arenaBoxHalf);
  arenaBoxHalfRef.current = arenaBoxHalf;
  const arenaWaveInProgressRef = useRef(false);
  const arenaTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Player base floor height - dropped to a deep negative during the fall.
  const baseGroundYRef = useRef(0);
  const [playerHealth, setPlayerHealth] = useState(PLAYER_MAX_HEALTH);
  const [playerCorpses, setPlayerCorpses] = useState<PlayerCorpseState[]>([]);

  const [level, setLevel] = useState(initialLevel ?? 1);
  const [levelTime, setLevelTime] = useState(0);
  const [levelChoiceOptions, setLevelChoiceOptions] = useState<LevelChoiceOption[] | null>(null);
  const [statModifiers, setStatModifiers] = useState<StatModifiers>(
    isSandbox ? createStatModifiers() : (initialStatModifiers ?? createStatModifiers())
  );
  const [helpers, setHelpers] = useState<HelperState[]>(() => {
    if (!initialHelpers || initialHelpers.length === 0) return [];
    return initialHelpers.map((h, i) => ({
      instanceKey: 0,
      ...h,
      id: h.id ?? `helper-${i}`,
      health: h.maxHealth,
      position: new THREE.Vector3(i * 1.5 + 2, 0, 0),
      velocity: new THREE.Vector3()
    }));
  });
  const [lightBlocks, setLightBlocks] = useState<LightBlockDef[]>([]);
  const [flashlightLevel, setFlashlightLevel] = useState(0);
  const [sandboxForcedTime, setSandboxForcedTime] = useState<'day' | 'night' | null>(null);
  const [sandboxEnemiesIgnorePlayer, setSandboxEnemiesIgnorePlayer] = useState(false);
  const [droneLevel, setDroneLevel] = useState(initialDroneLevel ?? 0);
  const [turretLevel, setTurretLevel] = useState(initialTurretLevel ?? 0);
  const [bombs, setBombs] = useState<BombState[]>([]);
  const [civilians, setCivilians] = useState<CivilianState[]>([]);
  const [mines, setMines] = useState<MineState[]>([]);
  const nextMineId = useRef(0);
  // Magma-arena lava tiles (permanent scatter + hazard-wave patches).
  const [lavaTiles, setLavaTiles] = useState<LavaTileDef[]>([]);
  const nextLavaTileId = useRef(0);
  // Sandbox Boss Flag fight: a sealed energy ring around the player with a
  // giant Glowing Green Man inside; drops when the boss dies.
  const [bossArena, setBossArena] = useState<{ centerX: number; centerZ: number; bossId: string } | null>(null);
  // Sandbox portal shortcut pairs.
  const [portalPairs, setPortalPairs] = useState<PortalPairDef[]>([]);
  const nextPortalId = useRef(0);
  // Player upgrade turrets + Engineer Man sentries in one list; saved
  // progress restores the player's turret COUNT at fresh random spots.
  const [turrets, setTurrets] = useState<TurretState[]>(() =>
    Array.from({ length: initialTurretLevel ?? 0 }, () => ({
      id: `turret-${nextTurretId.current++}`,
      owner: 'player' as const,
      position: new THREE.Vector3(...generateEnemySpawnPosition()),
      health: 1,
      maxHealth: 1
    }))
  );
  const [deaths, setDeaths] = useState(0);
  const [specialKills, setSpecialKills] = useState(0);
  const [pendingSpecialIds, setPendingSpecialIds] = useState<Set<string>>(new Set());
  // Bonus upgrade (isBonus flag): shows 3 options without advancing the level.
  const [pendingBonusUpgrade, setPendingBonusUpgrade] = useState(false);
  // Challenge flag: surviving all 3 spawned specials earns 3 upgrade choices.
  const [challengeRewardPending, setChallengeRewardPending] = useState(false);
  const [isNight, setIsNight] = useState(false);

  // Loadout draft (fresh normal runs): pick 3 from a random pool of 9.
  const [draftPool, setDraftPool] = useState<LevelChoiceOption[]>(() => {
    if (!offerLoadoutDraft) return [];
    const candidates: LevelChoiceOption[] = [
      'playerHealth', 'playerDamage', 'playerAttackSpeed', 'playerMoveSpeed', 'staminaMax',
      'critChance', 'drone', 'turret', 'helper', 'flashlightUpgrade', 'dash', 'parry',
      'groundSlam', 'thorns', 'playerComboSmall'
    ];
    const pool: LevelChoiceOption[] = [];
    while (pool.length < 9 && candidates.length > 0) {
      pool.push(...candidates.splice(Math.floor(Math.random() * candidates.length), 1));
    }
    return pool;
  });
  const [draftPicksLeft, setDraftPicksLeft] = useState(offerLoadoutDraft ? 3 : 0);
  const draftActive = draftPicksLeft > 0 && draftPool.length > 0;

  const isPaused = levelChoiceOptions !== null || manuallyPaused || draftActive;
  // Mirrors isPaused for the setInterval-based timers below, which close
  // over whatever isPaused was at the time their effect last ran (keyed on
  // `level`, not `isPaused`) - reading a ref instead always sees the
  // current value without needing to tear down/restart the interval (and
  // its elapsed-time progress) every time pause toggles.
  const isPausedRef = useRef(isPaused);
  isPausedRef.current = isPaused;
  // Glass Cannon halves max health (and doubles damage via Player's
  // damageMultiplier prop).
  const baseMaxHealth = PLAYER_MAX_HEALTH + statModifiers.playerHealthBonus;
  const effectiveMaxHealth = modifiers.glassCannon ? Math.max(1, Math.ceil(baseMaxHealth / 2)) : baseMaxHealth;
  const effectiveMaxStamina = PLAYER_MAX_STAMINA + statModifiers.staminaMaxBonus;
  const speedDemonBonus = modifiers.speedDemon ? SPEED_DEMON_BONUS : 0;
  const critChance = computeCritChance(statModifiers.critChancePicks);

  // Night-time bonus is intentionally asymmetric: damage is computed live
  // every render (so it vanishes the instant day returns), while health is
  // only ever added at spawn time below (live-resizing an already-damaged
  // HP pool reversibly was judged not worth the complexity) - only basic,
  // "naturally spawning" enemy types get either bonus, never summoned specials.
  const computeEnemyDamageBonus = (type: EnemyType): number => {
    let bonus = statModifiers.enemyDamageBonus;
    if (isNight && BASIC_ENEMY_TYPES.includes(type)) bonus += level;
    // Mirrors the special health bonus below, but live (not baked at spawn)
    // since damage is recomputed fresh every hit anyway - same asymptotic
    // cap so a special's damage can't run away to "unkillably fast" either.
    if (SPECIAL_ENEMY_TYPES.includes(type)) {
      const playerDamage = PUNCH_DAMAGE + statModifiers.playerDamageBonus;
      bonus += playerDamage * SPECIAL_PLAYER_SCALE_GROWTH_FACTOR * (1 - 1 / Math.max(level, 1));
    }
    return bonus;
  };
  const computeEnemySpawnHealthBonus = (type: EnemyType): number => {
    let bonus = statModifiers.enemyHealthBonus;
    if (isNight && BASIC_ENEMY_TYPES.includes(type)) bonus += Math.ceil(level / 2) + 1;
    return bonus;
  };

  // Mirrors for the long-lived (never torn down) enemy-spawn-rate interval
  // below, which - like the existing enemy-time-scale interval - is set up
  // once with an empty dependency array so it keeps ticking all session
  // long instead of losing progress every time a stat or level changes.
  // Reading through a ref (reassigned fresh every render) instead of
  // closing over the value directly is what lets that one-time effect still
  // always see the current level/stats.
  const levelRef = useRef(level);
  levelRef.current = level;
  const statModifiersRef = useRef(statModifiers);
  statModifiersRef.current = statModifiers;
  const computeEnemySpawnHealthBonusRef = useRef(computeEnemySpawnHealthBonus);
  computeEnemySpawnHealthBonusRef.current = computeEnemySpawnHealthBonus;
  // Live view of helpers for spawn-time reads inside []-dep effects/intervals.
  const helpersLiveRef = useRef(helpers);
  helpersLiveRef.current = helpers;
  const modifiersRef = useRef(modifiers);
  modifiersRef.current = modifiers;

  // Storm Man only exists inside the Stormy Weather modifier: natural
  // respawns have a chance to arrive as him while the storm is on.
  const maybeStormify = (type: EnemyType): EnemyType =>
    modifiersRef.current.weather && !isArena && Math.random() < STORM_MAN_WEATHER_CHANCE ? 'stormMan' : type;

  // Minion: at spawn, copies the strongest living helper's stats (strongest
  // = highest punch damage, max health as tiebreak). With no living helper
  // the config's level-1-helper fallback numbers (2 HP / 0 dmg) stay put.
  const applyMinionStats = (st: EnemyState): EnemyState => {
    if (st.type !== 'minionMan') return st;
    const living = helpersLiveRef.current.filter((h) => h.health > 0);
    if (living.length === 0) return st;
    const strongest = living.reduce((a, b) =>
      b.punchDamage > a.punchDamage || (b.punchDamage === a.punchDamage && b.maxHealth > a.maxHealth) ? b : a
    );
    st.maxHealth = Math.max(1, Math.round(strongest.maxHealth));
    st.health = st.maxHealth;
    st.extraDamage = Math.max(0, strongest.punchDamage - HELPER_INITIAL_PUNCH_DAMAGE);
    return st;
  };

  // Round damage to nearest integer, but keep exact .5 values (e.g. 1.5, 2.5).
  const roundDamage = (v: number): number => {
    const frac = v - Math.floor(v);
    return frac === 0.5 ? v : Math.round(v);
  };

  // Settings-gated wrappers - every blood burst / floating damage number in
  // the game routes through these so the accessibility toggles apply globally.
  const spawnBlood = (position: THREE.Vector3, damageScale?: number, color?: string) => {
    if (showBlood) bloodRef.current?.spawnBurst(position, damageScale, color);
  };
  const spawnDamageNumber = (position: THREE.Vector3, amount: number, color: string) => {
    if (showDamageNumbers) damageNumbersRef.current?.spawn(position, amount, color);
  };

  const platformColliders = useMemo(() => INITIAL_PLATFORM_DEFS.map(getPlatformCollider), []);
  // Arena walls as AABBs: the 4 box walls, or the sand pit's ring segments
  // (each rotated segment approximated by its own axis-aligned box - thin
  // walls at an angle deviate a little, which is fine for containment).
  const arenaColliders = useMemo<AABB[]>(() => {
    if (!isArena) return [];
    const tall = ARENA_WALL_HEIGHT + 2;
    // Ring boundary (sand circle / magma pentagon): each polygon EDGE is
    // subdivided into short chunks, each its own small axis-aligned box that
    // hugs the (possibly diagonal) wall - one big AABB per rotated wall
    // would bulge far into the playfield and read as an invisible wall.
    const ringSegs = (segments: number, radius: number, idPrefix: string): AABB[] => {
      const out: AABB[] = [];
      const segAngle = (Math.PI * 2) / segments;
      for (let i = 0; i < segments; i++) {
        const a0 = i * segAngle;
        const a1 = (i + 1) * segAngle;
        const x0 = Math.cos(a0) * radius;
        const z0 = Math.sin(a0) * radius;
        const x1 = Math.cos(a1) * radius;
        const z1 = Math.sin(a1) * radius;
        const edgeLen = Math.hypot(x1 - x0, z1 - z0);
        const chunks = Math.max(2, Math.ceil(edgeLen / 2.2));
        const half = edgeLen / chunks / 2 + 0.45;
        for (let c = 0; c < chunks; c++) {
          const t = (c + 0.5) / chunks;
          const cx = x0 + (x1 - x0) * t;
          const cz = z0 + (z1 - z0) * t;
          out.push({ id: `${idPrefix}-${i}-${c}`, minX: cx - half, maxX: cx + half, minZ: cz - half, maxZ: cz + half, topY: tall });
        }
      }
      return out;
    };
    const rectWalls = (halfX: number, halfZ: number): AABB[] => [
      { id: 'arena-n', minX: -halfX - 1, maxX: halfX + 1, minZ: -halfZ - 0.6, maxZ: -halfZ + 0.2, topY: tall },
      { id: 'arena-s', minX: -halfX - 1, maxX: halfX + 1, minZ: halfZ - 0.2, maxZ: halfZ + 0.6, topY: tall },
      { id: 'arena-w', minX: -halfX - 0.6, maxX: -halfX + 0.2, minZ: -halfZ - 1, maxZ: halfZ + 1, topY: tall },
      { id: 'arena-e', minX: halfX - 0.2, maxX: halfX + 0.6, minZ: -halfZ - 1, maxZ: halfZ + 1, topY: tall }
    ];
    if (arenaPhase === 'magma') return ringSegs(5, ARENA_MAGMA_RADIUS, 'magmawall');
    if (arenaPhase === 'sand') return ringSegs(ARENA_SAND_WALL_SEGMENTS, ARENA_SAND_RADIUS, 'sandwall');
    if (arenaPhase === 'concrete') return rectWalls(ARENA_CONCRETE_HALF_X, ARENA_CONCRETE_HALF_Z);
    return rectWalls(arenaBoxHalf, arenaBoxHalf);
  }, [isArena, arenaPhase, arenaBoxHalf]);
  // Boss Flag fight: chunked ring colliders sealing the arena around the
  // player (same edge-chunk approach as the arena's polygon walls).
  const bossRingColliders = useMemo<AABB[]>(() => {
    if (!bossArena) return [];
    const out: AABB[] = [];
    const chunks = Math.max(12, Math.ceil((Math.PI * 2 * BOSS_ARENA_RADIUS) / 2));
    for (let c = 0; c < chunks; c++) {
      const a = (c / chunks) * Math.PI * 2;
      const cx = bossArena.centerX + Math.cos(a) * BOSS_ARENA_RADIUS;
      const cz = bossArena.centerZ + Math.sin(a) * BOSS_ARENA_RADIUS;
      out.push({ id: `bosswall-${c}`, minX: cx - 1.0, maxX: cx + 1.0, minZ: cz - 1.0, maxZ: cz + 1.0, topY: 6 });
    }
    return out;
  }, [bossArena]);
  const colliders = useMemo(
    () => [...(isArena ? arenaColliders : [...WALL_COLLIDERS, ...crates.map(getCrateCollider), ...platformColliders]), ...bossRingColliders],
    [isArena, arenaColliders, crates, platformColliders, bossRingColliders]
  );

  // Past DEAD_BODY_LIMIT total dead-but-not-yet-sunk bodies (dummies,
  // enemies, player corpses combined - revived helpers never linger, see
  // handleHelperHit), the OLDEST excess ones are force-sunk immediately
  // instead of waiting out their normal timer, so corpses can never pile up
  // without bound.
  const forceSinkIds = useMemo(() => {
    const deadEntries: { key: string; diedAt: number }[] = [];
    dummies.forEach((d) => {
      if (d.health <= 0 && d.diedAt !== undefined) deadEntries.push({ key: `dummy-${d.id}`, diedAt: d.diedAt });
    });
    enemies.forEach((e) => {
      if (e.health <= 0 && e.diedAt !== undefined) deadEntries.push({ key: `enemy-${e.id}`, diedAt: e.diedAt });
    });
    civilians.forEach((c) => {
      if (c.health <= 0 && c.diedAt !== undefined) deadEntries.push({ key: `civilian-${c.id}`, diedAt: c.diedAt });
    });
    playerCorpses.forEach((c) => deadEntries.push({ key: `corpse-${c.id}`, diedAt: c.diedAt }));
    if (deadEntries.length <= DEAD_BODY_LIMIT) return new Set<string>();
    deadEntries.sort((a, b) => a.diedAt - b.diedAt);
    const excessCount = deadEntries.length - DEAD_BODY_LIMIT;
    return new Set(deadEntries.slice(0, excessCount).map((e) => e.key));
  }, [dummies, enemies, civilians, playerCorpses]);

  useEffect(() => {
    syncCratePhysicsBodies(crates);
  }, [crates]);

  // Background ambience: day/night loops on the open maps, the magma drone
  // in the arena's final phase. Stops when the game unmounts (main menu).
  useEffect(() => {
    const name: SfxName = isArena ? (arenaPhase === 'magma' ? 'ambMagma' : 'ambDay') : isNight ? 'ambNight' : 'ambDay';
    audio.setAmbience(name);
    return () => audio.setAmbience(null);
  }, [isArena, arenaPhase, isNight]);

  // Footstep sample matched to the current floor.
  const footstepSound: SfxName = isArena
    ? arenaPhase === 'box'
      ? 'footWood'
      : arenaPhase === 'concrete' || arenaPhase === 'magma'
        ? 'footRock'
        : 'footGrass'
    : 'footGrass';

  // Spawn callouts: announce the FIRST appearance of each special/rare type.
  const calledOutTypesRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!onSpawnCallout) return;
    enemies.forEach((e) => {
      if (e.health <= 0) return;
      const type = e.type as EnemyType;
      if (calledOutTypesRef.current.has(type)) return;
      if (!SPECIAL_ENEMY_TYPES.includes(type) && !RARE_ENEMY_TYPES.includes(type)) return;
      calledOutTypesRef.current.add(type);
      onSpawnCallout(`${ENEMY_CONFIGS[type].label} appears!`);
    });
  }, [enemies, onSpawnCallout]);

  // Playfield shape for the minimap: arenas are rectangles/circles/pentagon,
  // the normal map is the usual big circle.
  const mapShape = useMemo<{ kind: 'circle' | 'rect' | 'pentagon'; halfX: number; halfZ: number }>(() => {
    if (!isArena) return { kind: 'circle', halfX: MAP_RADIUS, halfZ: MAP_RADIUS };
    if (arenaPhase === 'magma') return { kind: 'pentagon', halfX: ARENA_MAGMA_RADIUS, halfZ: ARENA_MAGMA_RADIUS };
    if (arenaPhase === 'sand') return { kind: 'circle', halfX: ARENA_SAND_RADIUS, halfZ: ARENA_SAND_RADIUS };
    if (arenaPhase === 'concrete') return { kind: 'rect', halfX: ARENA_CONCRETE_HALF_X, halfZ: ARENA_CONCRETE_HALF_Z };
    return { kind: 'rect', halfX: arenaBoxHalf, halfZ: arenaBoxHalf };
  }, [isArena, arenaPhase, arenaBoxHalf]);

  useEffect(() => {
    onPlayerHealthChange(playerHealth);
  }, [playerHealth, onPlayerHealthChange]);

  useEffect(() => {
    onMaxHealthChange(effectiveMaxHealth);
  }, [effectiveMaxHealth, onMaxHealthChange]);

  useEffect(() => {
    onLevelChange(level);
  }, [level, onLevelChange]);

  useEffect(() => {
    onFlagsProgressChange(flags.length, flagCountForLevel(level));
  }, [flags, level, onFlagsProgressChange]);

  useEffect(() => {
    onDeathsChange(deaths);
  }, [deaths, onDeathsChange]);

  useEffect(() => {
    onSpecialKillsChange(specialKills);
  }, [specialKills, onSpecialKillsChange]);

  useEffect(() => {
    onPendingSpecialsChange(pendingSpecialIds.size);
  }, [pendingSpecialIds, onPendingSpecialsChange]);

  useEffect(() => {
    onStatModifiersChange?.(statModifiers);
  }, [statModifiers, onStatModifiersChange]);

  useEffect(() => {
    if (!onHelpersChange) return;
    onHelpersChange(helpers.map((h) => ({
      id: h.id,
      pickCount: h.pickCount,
      maxHealth: h.maxHealth,
      health: h.health,
      punchDamage: h.punchDamage,
      kickDamage: h.kickDamage,
      moveSpeedMultiplier: h.moveSpeedMultiplier,
      attackSpeedMultiplier: h.attackSpeedMultiplier,
      overrideColor: h.overrideColor,
      overrideSizeMultiplier: h.overrideSizeMultiplier,
      overrideType: h.overrideType,
      noRespawn: h.noRespawn,
      isRanged: h.isRanged
    })));
  }, [helpers, onHelpersChange]);

  useEffect(() => {
    onDroneLevelChange?.(droneLevel);
  }, [droneLevel, onDroneLevelChange]);

  useEffect(() => {
    onTurretLevelChange?.(turretLevel);
  }, [turretLevel, onTurretLevelChange]);

  useEffect(() => {
    if (!isSandbox || !onSandboxReady) return;
    onSandboxReady({
      spawnEnemy: (type, options) => {
        const pos = generateEnemySpawnPosition();
        const st = applyMinionStats(makeEnemyState(`enemy-${nextEnemyId.current++}`, type, pos, computeEnemySpawnHealthBonusRef.current(type)));
        if (options?.giant) {
          st.isGiant = true;
          st.sizeMultiplier = GIANT_INSTANCE_SIZE_MULTIPLIER;
          st.maxHealth = Math.round(st.maxHealth * GIANT_INSTANCE_HEALTH_MULTIPLIER);
          st.health = st.maxHealth;
        }
        if (options?.clear) {
          st.isClear = true;
          st.maxHealth = Math.max(1, Math.round(st.maxHealth * CLEAR_VARIANT_WEAKNESS));
          st.health = st.maxHealth;
        }
        if (options?.armoured) st.hasArmour = true;
        setEnemies((prev) => [...prev, st]);
      },
      spawnPortalPair: () => {
        // Two linked rings, forced a good distance apart.
        const a = generateEnemySpawnPosition();
        let b = generateEnemySpawnPosition();
        for (let tries = 0; tries < 8 && Math.hypot(b[0] - a[0], b[2] - a[2]) < 18; tries++) {
          b = generateEnemySpawnPosition();
        }
        setPortalPairs((prev) => [...prev, { id: `portal-${nextPortalId.current++}`, a: [a[0], a[2]], b: [b[0], b[2]] }]);
      },
      spawnFlag: (variant) => {
        setFlags((prev) => {
          const def = generateFlagDef(`flag-${nextFlagId.current++}`);
          const flagDef =
            variant === 'giant' ? { ...def, isGiant: true as const } :
            variant === 'bonus' ? { ...def, isBonus: true as const } :
            variant === 'challenge' ? { ...def, isChallenge: true as const } :
            variant === 'clear' ? { ...def, isClearFlag: true as const } :
            variant === 'boss' ? { ...def, isBossFlag: true as const } : def;
          return [...prev, flagDef];
        });
      },
      giveUpgrade: sandboxApplyUpgrade,
      patchStatMods: (patch) => setStatModifiers((prev) => ({ ...prev, ...patch })),
      resetStats: () => {
        setStatModifiers(createStatModifiers());
        setHelpers([]);
        setDroneLevel(0);
        setTurretLevel(0);
        setTurrets((prev) => prev.filter((t) => t.owner === 'enemy'));
        setLightBlocks([]);
        setFlashlightLevel(0);
      },
      setTimeOfDay: setSandboxForcedTime,
      setEnemiesIgnorePlayer: setSandboxEnemiesIgnorePlayer,
      // Passive practice dummy (the +1 max HP farming target).
      spawnDummy: () => {
        setDummies((prev) => [
          ...prev,
          {
            id: `dummy-${nextDummyId.current++}`,
            health: DUMMY_MAX_HEALTH,
            position: new THREE.Vector3(...generateDummySpawnPosition()),
            velocity: new THREE.Vector3()
          }
        ]);
      },
      // Civilians may bring an armyman escort along with them.
      spawnCivilian: () => {
        const pos = generateEnemySpawnPosition();
        const additions: CivilianState[] = [
          {
            id: `civilian-${nextCivilianId.current++}`,
            health: CIVILIAN_MAX_HEALTH,
            maxHealth: CIVILIAN_MAX_HEALTH,
            position: new THREE.Vector3(...pos),
            velocity: new THREE.Vector3(),
            statusEffects: createStatusEffects()
          }
        ];
        if (Math.random() < ARMY_SPAWN_WITH_CIVILIAN_CHANCE) {
          additions.push(makeArmyUnit(Math.random() < 0.5 ? 'melee' : 'ranged', [pos[0] + 1.5, 0, pos[2] + 1.5]));
        }
        setCivilians((prev) => [...prev, ...additions]);
      },
      // Army Man: a NEUTRAL soldier (not a helper). Passive until he sees a
      // civilian or fellow armyman attacked - by an enemy OR by the player.
      spawnArmyMan: (kind) => {
        setCivilians((prev) => [...prev, makeArmyUnit(kind, generateEnemySpawnPosition())]);
      },
      // VIP: a high-value civilian who never travels alone. Flees like any
      // civilian, but arrives with a permanent escort of three bodyguards
      // assigned to HIM rather than to the player, so they move as a unit.
      spawnVip: () => {
        const pos = generateEnemySpawnPosition();
        const vipId = `civilian-${nextCivilianId.current++}`;
        const vip: CivilianState = {
          id: vipId,
          role: 'vip',
          health: VIP_MAX_HEALTH,
          maxHealth: VIP_MAX_HEALTH,
          position: new THREE.Vector3(...pos),
          velocity: new THREE.Vector3(),
          statusEffects: createStatusEffects()
        };
        const escort: CivilianState[] = Array.from({ length: VIP_BODYGUARD_COUNT }, (_, i) => {
          const angle = (i / VIP_BODYGUARD_COUNT) * Math.PI * 2;
          return {
            id: `civilian-${nextCivilianId.current++}`,
            role: 'bodyguard' as const,
            protectCivilianId: vipId,
            health: BODYGUARD_MAX_HEALTH,
            maxHealth: BODYGUARD_MAX_HEALTH,
            position: new THREE.Vector3(
              pos[0] + Math.sin(angle) * BODYGUARD_PROTECT_DISTANCE,
              0,
              pos[2] + Math.cos(angle) * BODYGUARD_PROTECT_DISTANCE
            ),
            velocity: new THREE.Vector3(),
            statusEffects: createStatusEffects()
          };
        });
        setCivilians((prev) => [...prev, vip, ...escort]);
      },
      // Bodyguard: NOT a helper - a neutral unit that just follows the
      // player and retaliates against whatever hurts him. Dies for good.
      spawnBodyguard: () => {
        const p = playerGroupRef.current ? playerGroupRef.current.position : new THREE.Vector3();
        setCivilians((prev) => [
          ...prev,
          {
            id: `civilian-${nextCivilianId.current++}`,
            role: 'bodyguard',
            health: BODYGUARD_MAX_HEALTH,
            maxHealth: BODYGUARD_MAX_HEALTH,
            position: new THREE.Vector3(p.x - 1.4, 0, p.z),
            velocity: new THREE.Vector3(),
            statusEffects: createStatusEffects()
          }
        ]);
      },
      // Enemy Bodyguard: attaches to a random living enemy (or spawns a
      // fresh Running Man to protect if the map is empty).
      spawnEnemyBodyguard: () => {
        setEnemies((prev) => {
          const candidates = prev.filter((e) => e.health > 0 && !ENEMY_CONFIGS[e.type as EnemyType]?.isGuard);
          const additions: EnemyState[] = [];
          let protectee = candidates.length > 0 ? candidates[Math.floor(Math.random() * candidates.length)] : undefined;
          if (!protectee) {
            const pid = `enemy-${nextEnemyId.current++}`;
            const fresh = makeEnemyState(pid, 'runningMan', generateEnemySpawnPosition(), computeEnemySpawnHealthBonusRef.current('runningMan'));
            additions.push(fresh);
            protectee = fresh;
          }
          const gid = `enemy-${nextEnemyId.current++}`;
          const guard = makeEnemyState(
            gid,
            'enemyBodyguard',
            [protectee.position.x + 1.2, 0, protectee.position.z + 1.2],
            computeEnemySpawnHealthBonusRef.current('enemyBodyguard')
          );
          guard.protecteeId = protectee.id;
          additions.push(guard);
          return [...prev, ...additions];
        });
      },
      // A killable enemy sentry, permanent until destroyed (sandbox toy).
      spawnEnemyTurret: () => {
        const p = playerGroupRef.current ? playerGroupRef.current.position : new THREE.Vector3();
        const a = Math.random() * Math.PI * 2;
        setTurrets((prev) => [
          ...prev,
          {
            id: `turret-${nextTurretId.current++}`,
            owner: 'enemy',
            position: new THREE.Vector3(p.x + Math.cos(a) * 6, 0, p.z + Math.sin(a) * 6),
            health: ENEMY_TURRET_HEALTH,
            maxHealth: ENEMY_TURRET_HEALTH
          }
        ]);
      },
      // A recruited civilian: follows and "fights" like a helper, except he
      // can't actually hurt anything (0 damage) and has civilian health.
      spawnCivilianHelper: () => {
        const pos = playerGroupRef.current ? playerGroupRef.current.position.clone() : new THREE.Vector3();
        pos.x += 1.2;
        setHelpers((prev) => [...prev, {
          id: `helper-${nextHelperId.current++}`,
          instanceKey: 0,
          pickCount: 1,
          maxHealth: CIVILIAN_MAX_HEALTH,
          health: CIVILIAN_MAX_HEALTH,
          punchDamage: 0,
          kickDamage: 0,
          moveSpeedMultiplier: HELPER_BASE_SPEED_MULTIPLIER,
          attackSpeedMultiplier: HELPER_BASE_SPEED_MULTIPLIER,
          position: pos,
          velocity: new THREE.Vector3(),
          overrideColor: '#e8d8c3'
        }]);
      },
      spawnAsHelper: (type) => {
        // Training dummies make no sense as companions - blocked outright.
        if (type === 'fightingDummy' || type === 'punchDummy' || type === 'kickDummy') return;
        const cfg = ENEMY_CONFIGS[type];
        const pos = playerGroupRef.current ? playerGroupRef.current.position.clone() : new THREE.Vector3();
        pos.x += 1.2;
        setHelpers(prev => [...prev, {
          id: `helper-${nextHelperId.current++}`,
          instanceKey: 0,
          pickCount: 1,
          maxHealth: cfg.maxHealth,
          health: cfg.maxHealth,
          punchDamage: cfg.punch?.damage ?? HELPER_INITIAL_PUNCH_DAMAGE,
          kickDamage: cfg.kick?.damage ?? HELPER_INITIAL_KICK_DAMAGE,
          moveSpeedMultiplier: Math.max(cfg.moveSpeedMultiplier, HELPER_BASE_SPEED_MULTIPLIER),
          attackSpeedMultiplier: Math.max(cfg.attackSpeedMultiplier, HELPER_BASE_SPEED_MULTIPLIER),
          position: pos,
          velocity: new THREE.Vector3(),
          overrideColor: cfg.color,
          overrideSizeMultiplier: cfg.sizeMultiplier ?? 1,
          overrideType: type
        }]);
      },
      upgradeHelper: (id, option) => {
        setHelpers((prev) => prev.map((h) => {
          if (h.id !== id) return h;
          if (option === 'helperMoveSpeed') return { ...h, moveSpeedMultiplier: h.moveSpeedMultiplier + SPEED_BONUS_PER_PICK };
          if (option === 'helperAttackSpeed') return { ...h, attackSpeedMultiplier: h.attackSpeedMultiplier + SPEED_BONUS_PER_PICK };
          if (option === 'helperLevelUp2') {
            const nextMaxHealth = h.maxHealth + HELPER_LEVEL_UP_2_AMOUNT;
            return { ...h, maxHealth: nextMaxHealth, punchDamage: h.punchDamage + HELPER_LEVEL_UP_2_AMOUNT, kickDamage: h.kickDamage + HELPER_LEVEL_UP_2_AMOUNT, health: Math.min(h.health + HELPER_LEVEL_UP_2_AMOUNT, nextMaxHealth) };
          }
          return h;
        }));
      },
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A plain JS timer is fine here - GameCanvas is a regular React component
  // that lives outside the <Canvas> tree, so it doesn't need a useFrame tick
  // for something as coarse as a 1-second level clock. Skips the tick
  // entirely while paused so the displayed time actually freezes instead
  // of continuing to climb in the background.
  useEffect(() => {
    setLevelTime(0);
    const intervalId = setInterval(() => {
      if (isPausedRef.current) return;
      setLevelTime((t) => t + 1);
    }, 1000);
    return () => clearInterval(intervalId);
  }, [level]);

  useEffect(() => {
    onLevelTimeChange(levelTime);
  }, [levelTime, onLevelTimeChange]);

  // Lifetime + per-run stat tracking: fresh run per mount, best-level updates.
  useEffect(() => {
    statsResetRun();
  }, []);
  useEffect(() => {
    statsRecordLevel(level);
  }, [level]);

  // Live entity counts for the sandbox HUD readout.
  useEffect(() => {
    onEntityCountsChange?.({
      enemies: enemies.filter((e) => e.health > 0).length,
      dummies: dummies.filter((d) => d.health > 0).length,
      civilians: civilians.filter((c) => c.health > 0).length,
      helpers: helpers.filter((h) => h.health > 0).length,
      turrets: turrets.length
    });
  }, [enemies, dummies, civilians, helpers, turrets, onEntityCountsChange]);

  // Pure wall-clock difficulty creep, independent of level/dummy kills -
  // ticks for the whole session (never reset), same as the other automatic
  // scaling mechanics this stacks additively on top of. Also skips while
  // paused - sitting in a menu or the level-up screen shouldn't quietly
  // toughen every enemy in the background.
  useEffect(() => {
    if (isSandbox || isArena) return;
    const intervalId = setInterval(() => {
      if (isPausedRef.current) return;
      setStatModifiers((prev) => ({
        ...prev,
        enemyHealthBonus: prev.enemyHealthBonus + ENEMY_TIME_SCALE_AMOUNT,
        enemyDamageBonus: prev.enemyDamageBonus + ENEMY_TIME_SCALE_AMOUNT
      }));
    }, ENEMY_TIME_SCALE_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [isSandbox, isArena]);

  // "Swarm" upgrade: every pick adds one extra basic enemy spawned in on
  // this periodic tick, on top of (not instead of) the normal kill-triggers-
  // an-instant-replacement respawn cycle - so picking it more than once
  // makes the world visibly busier over time, independent of how much
  // fighting is actually happening.
  useEffect(() => {
    if (isSandbox || isArena) return;
    const intervalId = setInterval(() => {
      if (isPausedRef.current) return;
      const extra = statModifiersRef.current.enemySpawnRateBonus;
      if (extra <= 0) return;
      setEnemies((prev) => {
        let rareCount = prev.filter((e) => e.health > 0 && RARE_ENEMY_TYPES.includes(e.type as EnemyType)).length;
        const additions: EnemyState[] = [];
        for (let i = 0; i < extra; i++) {
          const spawn = generateBasicEnemySpawn(levelRef.current, rareCount);
          if (!COMMON_BASIC_ENEMY_TYPES.includes(spawn.type)) rareCount += 1;
          const newId = `enemy-${nextEnemyId.current++}`;
          const spawnType = maybeStormify(spawn.type);
          additions.push(applyMinionStats(makeEnemyState(newId, spawnType, spawn.position, computeEnemySpawnHealthBonusRef.current(spawnType))));
        }
        return [...prev, ...additions];
      });
    }, ENEMY_SPAWN_RATE_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [isSandbox, isArena]);

  // Bounty Hunter: spawns once after the player survives BOUNTY_HUNTER_SPAWN_SECONDS
  // without dying. Resets when the player dies. Checked every 5 seconds.
  useEffect(() => {
    if (isSandbox || isArena) return;
    const intervalId = setInterval(() => {
      if (isPausedRef.current || bountyHunterSpawnedRef.current) return;
      const elapsed = (Date.now() - lastDeathTimestampRef.current) / 1000;
      if (elapsed < BOUNTY_HUNTER_SPAWN_SECONDS) return;
      bountyHunterSpawnedRef.current = true;
      const bhId = `enemy-bounty-${nextEnemyId.current++}`;
      const jitter = () => (Math.random() - 0.5) * 6;
      const spawnPos: [number, number, number] = [jitter() + 8, 0, jitter() + 8];
      setEnemies((prev) => [
        ...prev,
        makeEnemyState(bhId, BOUNTY_HUNTER_TYPE, spawnPos, computeEnemySpawnHealthBonusRef.current(BOUNTY_HUNTER_TYPE))
      ]);
    }, 5000);
    return () => clearInterval(intervalId);
  }, [isSandbox, isArena]);

  // ── Arena wave director ────────────────────────────────────────────────
  const randomArenaPos = useCallback((): [number, number, number] => {
    const phase = arenaPhaseRef.current;
    if (phase === 'sand' || phase === 'magma') {
      const a = Math.random() * Math.PI * 2;
      // Pentagon inradius ≈ 0.81 × circumradius; stay well inside either ring.
      const maxR = phase === 'magma' ? ARENA_MAGMA_RADIUS * 0.75 : ARENA_SAND_RADIUS - 10;
      const r = 5 + Math.random() * Math.max(4, maxR - 5);
      return [Math.cos(a) * r, 0, Math.sin(a) * r];
    }
    if (phase === 'concrete') {
      return [(Math.random() * 2 - 1) * (ARENA_CONCRETE_HALF_X - 2), 0, (Math.random() * 2 - 1) * (ARENA_CONCRETE_HALF_Z - 2)];
    }
    const half = Math.max(4, arenaBoxHalfRef.current - 3);
    return [(Math.random() * 2 - 1) * half, 0, (Math.random() * 2 - 1) * half];
  }, []);

  // Anything that ends up outside the playable bounds is snapped back in.
  const arenaContains = useCallback((x: number, z: number): boolean => {
    const phase = arenaPhaseRef.current;
    if (phase === 'sand') return Math.hypot(x, z) < ARENA_SAND_RADIUS - 1;
    if (phase === 'magma') return Math.hypot(x, z) < ARENA_MAGMA_RADIUS * 0.79;
    if (phase === 'concrete') return Math.abs(x) < ARENA_CONCRETE_HALF_X - 0.5 && Math.abs(z) < ARENA_CONCRETE_HALF_Z - 0.5;
    return Math.abs(x) < arenaBoxHalfRef.current - 0.3 && Math.abs(z) < arenaBoxHalfRef.current - 0.3;
  }, []);

  // Out-of-bounds patrol: any living enemy outside the arena is immediately
  // teleported back inside (remounted at a fresh position via a new id).
  useEffect(() => {
    if (!isArena) return;
    const intervalId = setInterval(() => {
      if (isPausedRef.current || arenaPhaseRef.current === 'falling') return;
      setEnemies((prev) => {
        if (!prev.some((e) => e.health > 0 && !arenaContains(e.position.x, e.position.z))) return prev;
        return prev.map((e) => {
          if (e.health <= 0 || arenaContains(e.position.x, e.position.z)) return e;
          return { ...e, id: `enemy-${nextEnemyId.current++}`, position: new THREE.Vector3(...randomArenaPos()) };
        });
      });
    }, 2000);
    return () => clearInterval(intervalId);
  }, [isArena, arenaContains, randomArenaPos]);

  // Wave design across the four arenas. The beginner room covers the easy
  // waves; the brick cage ramps hard and fast; the sand pit runs the sand
  // roster; the magma wasteland is the endless lava endgame, mixing in
  // every enemy family the game has.
  const arenaWaveSpawns = (wave: number): { dummies: number; enemies: { type: EnemyType; giant?: boolean }[] } => {
    const commons: EnemyType[] = ['runningMan', 'punchMan', 'kickMan', 'greyMan', 'woodMan', 'brickMan'];
    const rares: EnemyType[] = ['babyMan', 'rageMan', 'medicMan', 'shieldBearer', 'sniperMan', 'copycatMan', 'vampireMan', 'bombMan', 'coward', 'slimeBlock', 'cloakedAssassin', 'phaseMan', 'splitMan', 'adaptiveMan'];
    const sands: EnemyType[] = ['sandWarrior', 'sandWarrior', 'sandyMan', 'sandyMan', 'sandThrower', 'brickMan'];
    const lavas: EnemyType[] = ['lavaMinion', 'lavaMinion', 'lavaThrower', 'lavaSplitCube', 'lavaSmashBall', 'lavaBaby', 'lavaBaby', 'magmaMan'];
    const randOf = (list: EnemyType[]) => list[Math.floor(Math.random() * list.length)];
    switch (wave) {
      // ── Beginner concrete room ──
      case 1: return { dummies: 0, enemies: [{ type: 'weakFighter' }, { type: 'weakFighter' }, { type: 'concreteMan' }] };
      case 2: return { dummies: 0, enemies: [{ type: 'weakFighter' }, { type: 'weakFighter' }, { type: 'concreteMan' }, { type: 'concreteMan' }, { type: 'coward' }] };
      // ── Brick cage: fast ramp ──
      case 3: return { dummies: 0, enemies: [{ type: 'runningMan' }, { type: 'woodMan' }, { type: 'kickMan' }] };
      case 4: return { dummies: 0, enemies: [{ type: randOf(commons) }, { type: 'woodMan' }, { type: 'greyMan' }, { type: 'babyMan' }] };
      case 5: return { dummies: 0, enemies: [{ type: randOf(commons) }, { type: 'brickMan' }, { type: 'medicMan' }, { type: 'rageMan' }, { type: 'bombMan' }] };
      case 6: return { dummies: 0, enemies: [{ type: 'shieldBearer' }, { type: 'sniperMan' }, { type: 'woodMan' }, { type: randOf(commons) }, { type: 'slimeBlock' }] };
      case 7: return { dummies: 0, enemies: [{ type: pickRandomSpecialType() }, { type: 'brickMan' }, { type: randOf(commons) }, { type: randOf(rares) }] };
      case 8: return { dummies: 0, enemies: [{ type: pickRandomSpecialType() }, { type: 'armourMan' }, { type: 'cloakedAssassin' }, { type: 'woodMan' }, { type: 'brickMan' }] };
      case 9: return { dummies: 0, enemies: [{ type: pickRandomSpecialType() }, { type: pickRandomSpecialType() }, { type: randOf(rares) }, { type: randOf(rares) }] };
      case 10: return { dummies: 0, enemies: [{ type: pickRandomSpecialType(), giant: true }, { type: pickRandomSpecialType() }, { type: randOf(commons) }, { type: randOf(commons) }] };
      // ── Sand pit ──
      case 11: return { dummies: 0, enemies: [{ type: 'sandWarrior' }, { type: 'sandyMan' }, { type: 'sandyMan' }] };
      case 12: return { dummies: 0, enemies: [{ type: 'sandWarrior' }, { type: 'sandyMan' }, { type: 'sandThrower' }, { type: 'sandJuggernaut' }] };
      case 13: return { dummies: 0, enemies: [{ type: 'sandJuggernaut' }, { type: 'sandJuggernaut' }, { type: randOf(sands) }, { type: pickRandomSpecialType() }] };
      case 14: return { dummies: 0, enemies: [{ type: 'sandGiant' }, { type: randOf(sands) }, { type: randOf(sands) }, { type: 'brickMan' }] };
      case 15: return { dummies: 0, enemies: [{ type: 'sandGiant' }, { type: 'sandJuggernaut' }, { type: 'sandThrower' }, { type: pickRandomSpecialType(), giant: true }] };
      case 16: return { dummies: 0, enemies: [{ type: 'sandGiant' }, { type: 'sandGiant' }, { type: randOf(sands) }, { type: pickRandomSpecialType() }] };
      // ── Magma wasteland: endless ──
      default: {
        const list: { type: EnemyType; giant?: boolean }[] = [];
        const n = Math.min(3 + Math.floor((wave - 17) / 2), 8);
        for (let i = 0; i < n; i++) list.push({ type: randOf(lavas) });
        list.push({ type: 'lavaJuggernaut' });
        if (wave % 2 === 1) list.push({ type: 'charredBrickMan' });
        if (wave % 3 === 1) list.push({ type: 'lavaGiant' });
        if (wave % 3 === 2) list.push({ type: 'magmaMan' });
        if (wave % 2 === 0) list.push({ type: randOf(rares) });
        list.push({ type: pickRandomSpecialType(), giant: wave % 3 === 0 });
        if (wave >= 20 && wave % 4 === 0) list.push({ type: 'lavaGiant', giant: true });
        return { dummies: 0, enemies: list };
      }
    }
  };

  // Random lava-tile positions inside the magma pentagon (center kept clear).
  const makeLavaTiles = (count: number, expiresAtMs?: number): LavaTileDef[] =>
    Array.from({ length: count }, () => {
      const a = Math.random() * Math.PI * 2;
      const r = 6 + Math.random() * (ARENA_MAGMA_RADIUS * 0.72 - 6);
      return {
        id: `lava-${nextLavaTileId.current++}`,
        position: [Math.cos(a) * r, Math.sin(a) * r] as [number, number],
        radius: LAVA_TILE_MIN_RADIUS + Math.random() * (LAVA_TILE_MAX_RADIUS - LAVA_TILE_MIN_RADIUS),
        expiresAtMs
      };
    });

  const startArenaWave = (wave: number) => {
    setArenaWave(wave);
    statsRecordArenaWave(wave);
    onArenaWaveChange?.(wave, arenaPhaseRef.current);
    if (arenaPhaseRef.current === 'box') {
      setArenaBoxHalf(Math.min(ARENA_BOX_START_HALF + (wave - 1) * ARENA_BOX_GROWTH_PER_WAVE, ARENA_BOX_MAX_HALF));
    }
    // Hazard waves: every HAZARD_WAVE_INTERVALth magma wave erupts extra
    // short-lived lava patches mid-fight.
    if (arenaPhaseRef.current === 'magma' && wave % HAZARD_WAVE_INTERVAL === 0) {
      setLavaTiles((prev) => [...prev, ...makeLavaTiles(HAZARD_WAVE_TILE_COUNT, Date.now() + HAZARD_TILE_LIFETIME_MS)]);
    }
    const def = arenaWaveSpawns(wave);
    const waveHealthBonus = Math.max(0, wave - 4);
    if (def.dummies > 0) {
      const newDummies: DummyState[] = Array.from({ length: def.dummies }, () => ({
        id: `dummy-${nextDummyId.current++}`,
        health: DUMMY_MAX_HEALTH,
        position: new THREE.Vector3(...randomArenaPos()),
        velocity: new THREE.Vector3()
      }));
      setDummies((prev) => [...prev, ...newDummies]);
    }
    if (def.enemies.length > 0) {
      const additions = def.enemies.map((spec) => {
        const pos = randomArenaPos();
        const newId = `enemy-${nextEnemyId.current++}`;
        if (SPECIAL_ENEMY_TYPES.includes(spec.type)) {
          return makeSpecialEnemyState(newId, spec.type, pos, waveHealthBonus, effectiveMaxHealth, !!spec.giant, Math.max(1, wave - 6));
        }
        const st = makeEnemyState(newId, spec.type, pos, waveHealthBonus);
        if (spec.giant) {
          st.isGiant = true;
          st.sizeMultiplier = GIANT_INSTANCE_SIZE_MULTIPLIER;
          st.maxHealth = Math.round(st.maxHealth * GIANT_INSTANCE_HEALTH_MULTIPLIER);
          st.health = st.maxHealth;
        }
        return st;
      });
      setEnemies((prev) => [...prev, ...additions]);
    }
    arenaWaveInProgressRef.current = true;
  };

  // Kick off wave 1 shortly after entering the arena.
  useEffect(() => {
    if (!isArena) return;
    arenaTimerRef.current = setTimeout(() => startArenaWave(1), 2000);
    return () => {
      if (arenaTimerRef.current) clearTimeout(arenaTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isArena]);

  // Sweep expired hazard-wave lava patches.
  useEffect(() => {
    if (!isArena) return;
    const intervalId = setInterval(() => {
      setLavaTiles((prev) =>
        prev.some((t) => t.expiresAtMs && Date.now() > t.expiresAtMs)
          ? prev.filter((t) => !t.expiresAtMs || Date.now() <= t.expiresAtMs)
          : prev
      );
    }, 2000);
    return () => clearInterval(intervalId);
  }, [isArena]);

  // Wave-clear detection: when every wave entity is dead, reward, then
  // either drop the floor (after ARENA_FALL_WAVE) or queue the next wave.
  useEffect(() => {
    if (!isArena || !arenaWaveInProgressRef.current) return;
    const anyAlive = enemies.some((e) => e.health > 0) || dummies.some((d) => d.health > 0);
    if (anyAlive) return;
    arenaWaveInProgressRef.current = false;
    const clearedWave = arenaWave;
    setPlayerHealth((prev) => Math.min(effectiveMaxHealth, prev + 2));
    if (clearedWave % 2 === 0) {
      setMedkits((prev) => [...prev, { id: `medkit-arena-${clearedWave}`, position: randomArenaPos() }]);
    }
    // EVERY cleared wave: the player picks an upgrade (bonus-flag path, so
    // the normal level/flag machinery never advances)...
    setPendingBonusUpgrade(true);
    setLevelChoiceOptions(pickRandomOptions(2, helpers.length > 0, statModifiers));
    // ...and later spawns get a little tougher.
    setStatModifiers((prev) => ({
      ...prev,
      enemyHealthBonus: prev.enemyHealthBonus + ARENA_ENEMY_HEALTH_PER_WAVE,
      enemyDamageBonus: prev.enemyDamageBonus + ARENA_ENEMY_DAMAGE_PER_WAVE
    }));
    if (clearedWave === ARENA_CONCRETE_END_WAVE) {
      // Beginner room cleared: the cage opens into the brick/wood box.
      setArenaPhase('box');
      onArenaWaveChange?.(clearedWave, 'box');
    }
    if (clearedWave === ARENA_FALL_WAVE) {
      // THE FLOOR GIVES WAY - free-fall until ArenaFallWatcher teleports the
      // player over the sand pit.
      setArenaPhase('falling');
      baseGroundYRef.current = -40;
      onArenaWaveChange?.(clearedWave, 'falling');
      return;
    }
    if (clearedWave === ARENA_SAND_END_WAVE) {
      // Sand pit conquered: the magma wasteland opens up - with a permanent
      // scatter of burning lava tiles across its floor.
      setArenaPhase('magma');
      setLavaTiles(makeLavaTiles(ARENA_LAVA_TILE_COUNT));
      onArenaWaveChange?.(clearedWave, 'magma');
    }
    arenaTimerRef.current = setTimeout(() => startArenaWave(clearedWave + 1), ARENA_WAVE_BREAK_SECONDS * 1000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enemies, dummies, isArena]);

  const handleArenaFellThrough = () => {
    setArenaPhase('sand');
    baseGroundYRef.current = 0;
    onArenaWaveChange?.(arenaWave, 'sand');
    arenaTimerRef.current = setTimeout(() => startArenaWave(ARENA_FALL_WAVE + 1), 2500);
  };

  const handleCrateHit = (crateId: string, damage: number) => {
    const currentHealth = crateHealth[crateId];
    if (currentHealth === undefined || currentHealth <= 0) return;
    const nextHealth = Math.max(0, currentHealth - damage);

    if (nextHealth === 0) {
      const destroyedCrate = crates.find((c) => c.id === crateId);
      if (destroyedCrate) {
        debrisRef.current?.spawnBurst(
          new THREE.Vector3(destroyedCrate.position[0], destroyedCrate.position[1] + destroyedCrate.size / 2, destroyedCrate.position[2]),
          destroyedCrate.color ?? '#8a6d3b'
        );
      }
      const newId = `crate-${nextCrateId.current++}`;
      const replacement = generateCrateDef(newId);
      setCrates((prev) => prev.map((c) => (c.id === crateId ? replacement : c)));
      setCrateHealth((prev) => {
        const { [crateId]: _removed, ...rest } = prev;
        return { ...rest, [newId]: CRATE_MAX_HEALTH };
      });
      onScoreAdd(SCORE_PER_CRATE);
      if (destroyedCrate && Math.random() < CRATE_MEDKIT_DROP_CHANCE) {
        const mk: MedkitDef = {
          id: `medkit-drop-${nextCrateId.current}`,
          position: [destroyedCrate.position[0], 0, destroyedCrate.position[2]]
        };
        setMedkits((prev) => [...prev, mk]);
      }
    } else {
      setCrateHealth((prev) => ({ ...prev, [crateId]: nextHealth }));
    }
  };

  const handleDummyHit = (dummyId: string, rawDamage: number) => {
    const target = dummies.find((d) => d.id === dummyId);
    if (!target || target.health <= 0) return;
    const damage = modifiers.oneHit && rawDamage > 0 ? target.health : roundDamage(rawDamage);

    const hitPos = new THREE.Vector3(target.position.x, target.position.y + 1.3, target.position.z);
    spawnDamageNumber(hitPos, damage, playerTint);
    if (damage > 0) {
      spawnBlood(hitPos);
      audio.play('punch', { volume: 0.7 });
    }

    const nextHealth = Math.max(0, target.health - damage);
    statsRecordDamageDealt(damage);
    if (nextHealth === 0) {
      audio.play('death', { volume: 0.85 });
      onScoreAdd(SCORE_PER_KILL);
      onKill();
      statsRecordKill('fightingDummy');
      if (!isEmptyMapMode) {
        dummyKillCountRef.current += 1;
        const scaleStep = dummyKillCountRef.current % DUMMY_KILLS_PER_ENEMY_SCALE === 0 ? 1 : 0;
        setStatModifiers((prev) => ({
          ...prev,
          playerHealthBonus: prev.playerHealthBonus + 1,
          enemyHealthBonus: prev.enemyHealthBonus + scaleStep,
          enemyDamageBonus: prev.enemyDamageBonus + scaleStep
        }));
        setPlayerHealth((prev) => prev + 1);
      }
      if (isEmptyMapMode) {
        setDummies((prev) => prev.map((d) => (d.id === dummyId ? { ...d, health: 0, diedAt: Date.now() } : d)));
      } else {
        const [x, y, z] = generateDummySpawnPosition();
        const spawned: DummyState = {
          id: `dummy-${nextDummyId.current++}`,
          health: DUMMY_MAX_HEALTH,
          position: new THREE.Vector3(x, y, z),
          velocity: new THREE.Vector3()
        };
        setDummies((prev) => [...prev.map((d) => (d.id === dummyId ? { ...d, health: 0, diedAt: Date.now() } : d)), spawned]);
      }
    } else {
      setDummies((prev) => prev.map((d) => (d.id === dummyId ? { ...d, health: nextHealth } : d)));
    }
  };

  const handleCorpseSunk = (dummyId: string) => {
    setDummies((prev) => prev.filter((d) => d.id !== dummyId));
  };

  const handleEnemyHit = (enemyId: string, rawDamage: number, attackKind?: 'punch' | 'kick') => {
    const target = enemies.find((e) => e.id === enemyId);
    if (!target || target.health <= 0) return;

    // Phase Man: intangible - every damage path (melee, projectile, drone,
    // turret, slam) is swallowed here while the phase window is active.
    if (target.phasedUntilMs !== undefined && Date.now() < target.phasedUntilMs) return;

    // Resilient family: INVINCIBLE while down in the cheat-death ragdoll -
    // the get-back-up moment can't be interrupted or cheesed.
    if (
      ENEMY_CONFIGS[target.type as EnemyType]?.maxRevives !== undefined &&
      (target.ragdollStunUntilMs ?? 0) > Date.now()
    ) {
      return;
    }

    // Shield bearers block frontal punch attacks - kicks bypass the shield.
    let effectiveDamage = roundDamage(rawDamage);
    if (ENEMY_CONFIGS[target.type as EnemyType]?.hasShield && attackKind === 'punch') {
      effectiveDamage = Math.max(0, Math.round(rawDamage * 0.2));
    }
    // One-Hit modifier: any real hit is lethal, shields included.
    if (modifiers.oneHit && rawDamage > 0) effectiveDamage = target.health;

    const hitPos = new THREE.Vector3(target.position.x, target.position.y + 1.3, target.position.z);
    spawnDamageNumber(hitPos, effectiveDamage, playerTint);
    // Cube enemies bleed their own body color (and squelch instead of thud).
    if (effectiveDamage > 0) {
      spawnBlood(hitPos, undefined, ENEMY_BLOOD_COLORS[target.type as EnemyType]);
      const squishy = CUBE_ENEMY_TYPES.includes(target.type as EnemyType) || SMASH_BALL_TYPES.includes(target.type as EnemyType);
      audio.play(squishy ? 'slimeHit' : 'punch', { volume: 0.7 });
    }

    const nextHealth = Math.max(0, target.health - effectiveDamage);
    statsRecordDamageDealt(effectiveDamage);

    // Resilient Man family: a killing blow instead consumes a cheat-death
    // charge - the body ragdolls briefly, then gets back up at FULL health.
    if (nextHealth === 0 && (target.revivesLeft ?? 0) > 0) {
      for (let i = 0; i < 8; i++) {
        const p = target.position.clone();
        p.x += (Math.random() - 0.5) * 0.7;
        p.y += 0.4 + Math.random() * 1.2;
        p.z += (Math.random() - 0.5) * 0.7;
        projectilesRef.current?.spawnAmbientParticle(p, '#ffd54f');
      }
      setEnemies((prev) =>
        prev.map((e) =>
          e.id === enemyId
            ? { ...e, health: e.maxHealth, revivesLeft: (e.revivesLeft ?? 1) - 1, ragdollStunUntilMs: Date.now() + DEATH_CHEAT_RAGDOLL_MS }
            : e
        )
      );
      return;
    }

    // Cube enemies (and the Split Ball) split into two minis when KILLED.
    // Plain cubes/balls split one implicit generation; the slime dynasty
    // carries splitsLeft (giant 2, colossal 3), decremented onto each mini.
    const isSplitter = CUBE_ENEMY_TYPES.includes(target.type as EnemyType) || target.type === 'splitBall';
    const splitsRemaining = target.splitsLeft ?? (isSplitter && !target.hasSplit ? 1 : 0);
    if (nextHealth === 0 && isSplitter && splitsRemaining > 0) {
      const miniMax = Math.max(1, Math.ceil(target.maxHealth * 0.4));
      const makeMini = (offsetX: number, offsetZ: number): EnemyState => ({
        id: `enemy-${nextEnemyId.current++}`,
        type: target.type,
        health: miniMax,
        maxHealth: miniMax,
        position: new THREE.Vector3(target.position.x + offsetX, 0, target.position.z + offsetZ),
        velocity: new THREE.Vector3(),
        sizeMultiplier: (target.sizeMultiplier ?? 1) * 0.55,
        hasSplit: true,
        splitsLeft: splitsRemaining - 1
      });
      setEnemies((prev) => [...prev, makeMini(0.7, 0.3), makeMini(-0.7, -0.3)]);
    }

    // Split Man: the first time health crosses below half (without dying
    // outright), the original is replaced by two smaller, never-splitting
    // copies that share the surviving health pool.
    if (
      target.type === 'splitMan' &&
      !target.hasSplit &&
      nextHealth > 0 &&
      nextHealth <= target.maxHealth * SPLIT_HEALTH_FRACTION
    ) {
      const copyMaxHealth = Math.max(1, Math.ceil(target.maxHealth * SPLIT_HEALTH_FRACTION));
      const copyHealth = Math.max(1, Math.min(nextHealth, copyMaxHealth));
      const makeCopy = (offsetX: number, offsetZ: number): EnemyState => ({
        id: `enemy-${nextEnemyId.current++}`,
        type: 'splitMan',
        health: copyHealth,
        maxHealth: copyMaxHealth,
        position: new THREE.Vector3(target.position.x + offsetX, target.position.y, target.position.z + offsetZ),
        velocity: new THREE.Vector3(),
        sizeMultiplier: SPLIT_COPY_SIZE_MULTIPLIER,
        hasSplit: true
      });
      for (let i = 0; i < 8; i++) {
        const p = target.position.clone();
        p.x += (Math.random() - 0.5) * 0.8;
        p.y += 0.5 + Math.random() * 1.0;
        p.z += (Math.random() - 0.5) * 0.8;
        projectilesRef.current?.spawnAmbientParticle(p, '#4dd0e1');
      }
      setEnemies((prev) => [...prev.filter((e) => e.id !== enemyId), makeCopy(0.7, 0.2), makeCopy(-0.7, -0.2)]);
      return;
    }
    if (nextHealth === 0) {
      audio.play('death', { volume: 0.85 });
      onScoreAdd(SCORE_PER_KILL);
      onKill();
      statsRecordKill(target.type);
      // Boss Flag fight won: the sealing ring drops.
      if (bossArena && enemyId === bossArena.bossId) {
        setBossArena(null);
        statsRecordBossWin();
      }
      // The player killed this enemy in front of nearby fleeing civilians ->
      // they adopt the player as protection (unless he's hit them before).
      if (attackKind && civilians.length > 0) {
        setCivilians((prev) =>
          prev.map((c) => {
            if (c.health <= 0 || c.fearsPlayer || c.followingPlayer) return c;
            if (c.role && c.role !== 'civilian') return c;
            const d = Math.hypot(c.position.x - target.position.x, c.position.z - target.position.z);
            return d <= CIVILIAN_RESCUE_RADIUS ? { ...c, followingPlayer: true } : c;
          })
        );
      }
      if (!isEmptyMapMode) {
        // (Arena kills never grant permanent stat upgrades - the per-wave
        // upgrade choice is the arena's whole reward loop.)
        // The stationary "attack dummies" hit back, so putting one down
        // sharpens your damage instead - +2 for the dual-attack dummy, +1
        // for the single-attack (punch/kick) variants.
        if (target.type === 'fightingDummy') {
          setStatModifiers((prev) => ({ ...prev, playerDamageBonus: prev.playerDamageBonus + 2 }));
        } else if (target.type === 'punchDummy' || target.type === 'kickDummy') {
          setStatModifiers((prev) => ({ ...prev, playerDamageBonus: prev.playerDamageBonus + 1 }));
        }
        if (SPECIAL_ENEMY_TYPES.includes(target.type as EnemyType)) {
          setSpecialKills((prev) => prev + 1);
          setStatModifiers((prev) => ({
            ...prev,
            playerHealthBonus: prev.playerHealthBonus + 1,
            playerDamageBonus: prev.playerDamageBonus + 1
          }));
          setPlayerHealth((prev) => prev + 1);
        }
      } else if (SPECIAL_ENEMY_TYPES.includes(target.type as EnemyType)) {
        setSpecialKills((prev) => prev + 1);
      }
      if (pendingSpecialIds.has(enemyId)) {
        const nextPending = new Set(pendingSpecialIds);
        nextPending.delete(enemyId);
        setPendingSpecialIds(nextPending);
        if (!isSandbox && flags.length === 0 && nextPending.size === 0 && !levelChoiceOptions) {
          if (challengeRewardPending) {
            setChallengeRewardPending(false);
            setLevelChoiceOptions(pickRandomOptions(3, helpers.length > 0, statModifiers));
          } else {
            setLevelChoiceOptions(pickTwoRandomOptions(helpers.length > 0, statModifiers));
          }
        }
      }
    }
    // A player melee hit also locks the enemy's aggro onto the player for a
    // while - smacking an enemy off a fleeing civilian pulls it onto you.
    const aggroPatch = attackKind && nextHealth > 0 ? { aggroPlayerUntilMs: Date.now() + ENEMY_PLAYER_AGGRO_MS } : {};
    setEnemies((prev) =>
      prev.map((e) => {
        if (e.id === enemyId) return { ...e, health: nextHealth, ...aggroPatch, ...(nextHealth === 0 ? { diedAt: Date.now() } : {}) };
        // Damaging a protectee puts its bodyguard(s) on alert.
        if (e.protecteeId === enemyId && e.health > 0) return { ...e, guardAlertUntilMs: Date.now() + GUARD_ALERT_MS };
        return e;
      })
    );
  };

  const handleEnemySunk = (enemyId: string) => {
    setEnemies((prev) => {
      const dying = prev.find((e) => e.id === enemyId);
      const remaining = prev.filter((e) => e.id !== enemyId);
      if (!isEmptyMapMode && dying && BASIC_ENEMY_TYPES.includes(dying.type as EnemyType)) {
        const rareCountAlive = remaining.filter((e) => e.health > 0 && RARE_ENEMY_TYPES.includes(e.type as EnemyType)).length;
        const spawn = generateBasicEnemySpawn(level, rareCountAlive);
        const newId = `enemy-${nextEnemyId.current++}`;
        const spawnType = maybeStormify(spawn.type);
        const additions = [applyMinionStats(makeEnemyState(newId, spawnType, spawn.position, computeEnemySpawnHealthBonus(spawnType)))];
        // Occasionally the replacement arrives with its own bodyguard.
        if (Math.random() < ENEMY_GUARD_ATTACH_CHANCE) {
          const gid = `enemy-${nextEnemyId.current++}`;
          const guard = makeEnemyState(gid, 'enemyBodyguard', [spawn.position[0] + 1.2, 0, spawn.position[2] + 1.2], computeEnemySpawnHealthBonus('enemyBodyguard'));
          guard.protecteeId = newId;
          additions.push(guard);
        }
        return [...remaining, ...additions];
      }
      return remaining;
    });
  };

  // Brain enemies never attack directly - instead they periodically ask
  // for an ordinary basic enemy to be spawned near them: melee (any common
  // basic except grey man) if their target is close, ranged (grey man,
  // the only ranged common basic) if far. Never spawns a special.
  const handleSpawnAdd = (position: THREE.Vector3, kind: 'melee' | 'ranged') => {
    const meleeTypes = COMMON_BASIC_ENEMY_TYPES.filter((t) => t !== 'greyMan');
    const type: EnemyType = kind === 'ranged' ? 'greyMan' : meleeTypes[Math.floor(Math.random() * meleeTypes.length)];
    const jitter = () => (Math.random() - 0.5) * 4;
    const spawnPos: [number, number, number] = [position.x + jitter(), position.y, position.z + jitter()];
    const newId = `enemy-${nextEnemyId.current++}`;
    setEnemies((prev) => [...prev, makeEnemyState(newId, type, spawnPos, computeEnemySpawnHealthBonus(type))]);
  };

  const healEnemyById = (enemyId: string, amount: number) => {
    setEnemies((prev) =>
      prev.map((e) => (e.id === enemyId && e.health > 0 ? { ...e, health: Math.min(e.maxHealth, e.health + amount) } : e))
    );
  };

  // Slime King: births a tiny never-splitting baby slime near himself.
  const handleSlimeKingSpawn = (position: THREE.Vector3) => {
    setEnemies((prev) => [
      ...prev,
      {
        id: `enemy-${nextEnemyId.current++}`,
        type: 'slimeBlock',
        health: SLIME_KING_BABY_HEALTH,
        maxHealth: SLIME_KING_BABY_HEALTH,
        position: position.clone(),
        velocity: new THREE.Vector3(),
        sizeMultiplier: 0.55,
        hasSplit: true,
        splitsLeft: 0
      }
    ]);
  };

  // Vampire Man: heals for a fraction of the damage he lands; a killing
  // blow restores him fully (the design's "+100 HP", clamped to max).
  const applyVampireLifesteal = (attackerId: string | undefined, damageDealt: number, targetDied: boolean) => {
    if (!attackerId || damageDealt <= 0) return;
    const attacker = enemies.find((e) => e.id === attackerId);
    if (!attacker || !ENEMY_CONFIGS[attacker.type as EnemyType]?.isVampire) return;
    healEnemyById(attackerId, targetDied ? VAMPIRE_KILL_HEAL : Math.ceil(damageDealt * VAMPIRE_LIFESTEAL_FRACTION));
  };

  const makeArmyUnit = (kind: 'melee' | 'ranged', pos: [number, number, number]): CivilianState => ({
    id: `civilian-${nextCivilianId.current++}`,
    role: kind === 'melee' ? 'armyMelee' : 'armyRanged',
    health: ARMY_MAX_HEALTH,
    maxHealth: ARMY_MAX_HEALTH,
    position: new THREE.Vector3(...pos),
    velocity: new THREE.Vector3(),
    statusEffects: createStatusEffects()
  });

  // Any armyman within sight of an attacked civilian/armyman turns hostile
  // toward the attacker - enemy AND player alike. Plain civilians who
  // witness the same attack panic instead: they bolt away from the scene.
  const alertArmyUnits = (aroundPos: THREE.Vector3, attacker: { kind: 'player' } | { kind: 'enemy'; id: string }) => {
    setCivilians((prev) =>
      prev.map((c) => {
        if (c.health <= 0) return c;
        const inSight = Math.hypot(c.position.x - aroundPos.x, c.position.z - aroundPos.z) <= ARMY_SIGHT_RADIUS;
        if (!inSight) return c;
        if (c.role === 'armyMelee' || c.role === 'armyRanged') {
          return {
            ...c,
            aggroPlayer: attacker.kind === 'player',
            aggroEnemyId: attacker.kind === 'enemy' ? attacker.id : undefined,
            aggroUntilMs: Date.now() + ARMY_AGGRO_MS
          };
        }
        if (!c.role || c.role === 'civilian') {
          return { ...c, panicUntilMs: Date.now() + CIVILIAN_PANIC_MS, panicFromX: aroundPos.x, panicFromZ: aroundPos.z };
        }
        return c;
      })
    );
  };

  // Storm Man's forked lightning: after the bolt lands, arc to the nearest
  // OTHER friendly target within range for half damage. The chained zap
  // carries no chainLightning flag, so it can never arc twice.
  const chainLightningZap = (fromPos: THREE.Vector3, exclude: 'player' | string, damage: number, now: number, attackerId?: string) => {
    let best: { kind: 'player' } | { kind: 'helper'; id: string } | { kind: 'civilian'; id: string } | null = null;
    let bestD = STORM_CHAIN_RANGE;
    if (exclude !== 'player' && playerGroupRef.current) {
      const d = Math.hypot(playerGroupRef.current.position.x - fromPos.x, playerGroupRef.current.position.z - fromPos.z);
      if (d < bestD) { bestD = d; best = { kind: 'player' }; }
    }
    helpers.forEach((h) => {
      if (h.health <= 0 || h.id === exclude) return;
      const d = Math.hypot(h.position.x - fromPos.x, h.position.z - fromPos.z);
      if (d < bestD) { bestD = d; best = { kind: 'helper', id: h.id }; }
    });
    civilians.forEach((c) => {
      if (c.health <= 0 || c.id === exclude) return;
      const d = Math.hypot(c.position.x - fromPos.x, c.position.z - fromPos.z);
      if (d < bestD) { bestD = d; best = { kind: 'civilian', id: c.id }; }
    });
    if (!best) return;
    const resolved = best as { kind: 'player' } | { kind: 'helper'; id: string } | { kind: 'civilian'; id: string };
    const targetPos =
      resolved.kind === 'player'
        ? playerGroupRef.current!.position
        : resolved.kind === 'helper'
          ? helpers.find((h) => h.id === resolved.id)!.position
          : civilians.find((c) => c.id === resolved.id)!.position;
    // Crackling arc between the two victims.
    for (let i = 0; i <= 6; i++) {
      const t = i / 6;
      const p = new THREE.Vector3(
        fromPos.x + (targetPos.x - fromPos.x) * t + (Math.random() - 0.5) * 0.3,
        1.1 + (Math.random() - 0.5) * 0.5,
        fromPos.z + (targetPos.z - fromPos.z) * t + (Math.random() - 0.5) * 0.3
      );
      projectilesRef.current?.spawnAmbientParticle(p, '#b3e5fc');
    }
    const zap: AttackPayload = { damage, range: 'ranged', isProjectile: true, auraColor: '#b3e5fc' };
    if (resolved.kind === 'player') handleAttackOnPlayer(zap, fromPos.clone(), now, '#b3e5fc', attackerId ?? '');
    else if (resolved.kind === 'helper') handleHelperHit(resolved.id, zap, now, '#b3e5fc', attackerId);
    else handleAttackCivilian(resolved.id, zap, now, '#b3e5fc', attackerId);
  };

  // Bodyguards near the player retaliate against whatever just hurt him.
  const alertBodyguards = (attackerEnemyId: string) => {
    const p = playerGroupRef.current?.position;
    if (!p) return;
    setCivilians((prev) =>
      prev.map((c) => {
        if (c.health <= 0 || c.role !== 'bodyguard') return c;
        if (Math.hypot(c.position.x - p.x, c.position.z - p.z) > ARMY_SIGHT_RADIUS) return c;
        return { ...c, aggroPlayer: false, aggroEnemyId: attackerEnemyId, aggroUntilMs: Date.now() + ARMY_AGGRO_MS };
      })
    );
  };

  // Player attacked a civilian: damage them AND permanently scare them off
  // the player (they flee from him like an enemy, and stop following).
  const handleCivilianHitByPlayer = (civilianId: string, rawDamage: number) => {
    const target = civilians.find((c) => c.id === civilianId);
    if (!target || target.health <= 0) return;
    const damage = modifiers.oneHit && rawDamage > 0 ? target.health : roundDamage(rawDamage);
    const hitPos = new THREE.Vector3(target.position.x, target.position.y + 1.3, target.position.z);
    spawnDamageNumber(hitPos, damage, playerTint);
    if (damage > 0) {
      spawnBlood(hitPos);
      audio.play('punch', { volume: 0.7 });
    }
    const nextHealth = Math.max(0, target.health - damage);
    if (nextHealth === 0) audio.play('death', { volume: 0.8 });
    // Only plain civilians grow to fear the player; army roles retaliate
    // (via the alert below) and bodyguards just take it.
    const isPlainCivilian = !target.role || target.role === 'civilian';
    setCivilians((prev) =>
      prev.map((c) =>
        c.id === civilianId
          ? {
              ...c,
              health: nextHealth,
              ...(isPlainCivilian ? { fearsPlayer: true, followingPlayer: false } : {}),
              ...(nextHealth === 0 ? { diedAt: Date.now() } : {})
            }
          : c
      )
    );
    // Every armyman who saw the player do that turns on him.
    alertArmyUnits(target.position, { kind: 'player' });
  };

  // An enemy's swing/projectile/pulse (or a bomb blast) landed on a
  // civilian: damage plus the payload's FULL status-effect kit (burn,
  // freeze, stun, pull, knockback, slow) applied to the civilian's own
  // StatusEffects struct, exactly like the player's.
  const handleAttackCivilian = (civilianId: string, payload: AttackPayload, now: number, attackerColor: string, attackerId?: string) => {
    const target = civilians.find((c) => c.id === civilianId);
    if (!target || target.health <= 0) return;
    const damage = modifiers.oneHit && payload.damage > 0 ? target.health : roundDamage(payload.damage);
    const hitPos = new THREE.Vector3(target.position.x, target.position.y + 1.3, target.position.z);
    spawnDamageNumber(hitPos, damage, attackerColor);
    if (damage > 0) spawnBlood(hitPos);
    const nextHealth = Math.max(0, target.health - damage);
    if (nextHealth === 0) audio.play('death', { volume: 0.8 });
    applyVampireLifesteal(attackerId, damage, nextHealth === 0);
    if (nextHealth > 0) {
      const attacker = enemies.find((e) => e.id === attackerId);
      const attackerPos = attacker
        ? attacker.position
        : new THREE.Vector3(target.position.x + (Math.random() - 0.5), 0, target.position.z + (Math.random() - 0.5));
      applyAttackPayload(target.statusEffects, now, payload, attackerPos, target.position);
    }
    setCivilians((prev) =>
      prev.map((c) => (c.id === civilianId ? { ...c, health: nextHealth, ...(nextHealth === 0 ? { diedAt: Date.now() } : {}) } : c))
    );
    // Nearby armymen witness the enemy's attack and turn on it.
    if (attackerId && enemies.some((e) => e.id === attackerId && e.health > 0)) {
      alertArmyUnits(target.position, { kind: 'enemy', id: attackerId });
    }
    // Storm Man: the bolt forks off this civilian to the nearest other target.
    if (payload.chainLightning && damage > 0) {
      chainLightningZap(target.position, civilianId, Math.max(1, Math.ceil(payload.damage / 2)), now, attackerId);
    }
  };

  const handleCivilianSunk = (civilianId: string) => {
    setCivilians((prev) => prev.filter((c) => c.id !== civilianId));
  };

  const handleHealNearbyEnemies = (position: THREE.Vector3, radius: number, amount: number) => {
    setEnemies((prev) =>
      prev.map((e) => {
        if (e.health <= 0 || e.health >= e.maxHealth) return e;
        const dx = e.position.x - position.x;
        const dz = e.position.z - position.z;
        if (Math.hypot(dx, dz) > radius) return e;
        return { ...e, health: Math.min(e.maxHealth, e.health + amount) };
      })
    );
  };

  const handleAttackOnPlayer = (payload: AttackPayload, attackerPosition: THREE.Vector3, now: number, attackerColor: string, attackerId: string) => {
    if (!playerGroupRef.current) return;
    const nowMs = Date.now();

    // Dash invincibility: skip all damage while dashing.
    if (nowMs < dashInvincibleRef.current) return;

    // Parry: block damage (and stun melee attackers). Giant enemies cannot be parried.
    if (attackerId && nowMs < parryWindowRef.current) {
      const attacker = enemies.find((e) => e.id === attackerId);
      const attackerIsGiant = attacker && (attacker.isGiant || attacker.type === 'giantMan');
      if (!attackerIsGiant) {
        parryWindowRef.current = 0;
        // Projectile blocks negate damage only — don't ragdoll the sender.
        if (!payload.isProjectile) {
          setEnemies((prev) =>
            prev.map((e) =>
              e.id === attackerId ? { ...e, ragdollStunUntilMs: Date.now() + 3000 } : e
            )
          );
        }
        return;
      }
    }

    const hitPos = new THREE.Vector3(playerGroupRef.current.position.x, playerGroupRef.current.position.y + 1.3, playerGroupRef.current.position.z);
    const roundedPayloadDamage = modifiers.oneHit && payload.damage > 0 ? Math.max(playerHealth, 1) : roundDamage(payload.damage);
    spawnDamageNumber(hitPos, roundedPayloadDamage, attackerColor);
    if (roundedPayloadDamage > 0) {
      spawnBlood(hitPos);
      audio.play('punch', { volume: 0.75 });
      statsRecordDamageTaken(roundedPayloadDamage);
      setPlayerHealth((prev) => Math.max(0, prev - roundedPayloadDamage));
      // Thorns: reflect a flat 1 damage back to melee attacker.
      if (statModifiers.thornsPicks > 0 && attackerId) {
        handleEnemyHit(attackerId, THORNS_DAMAGE);
      }
      applyVampireLifesteal(attackerId, roundedPayloadDamage, playerHealth - roundedPayloadDamage <= 0);
      // Bodyguards near the player go after whichever enemy just hurt him.
      if (attackerId && enemies.some((e) => e.id === attackerId && e.health > 0)) {
        alertBodyguards(attackerId);
      }
      // Storm Man: the bolt forks off the player to the nearest ally.
      if (payload.chainLightning) {
        chainLightningZap(playerGroupRef.current.position, 'player', Math.max(1, Math.ceil(payload.damage / 2)), now, attackerId);
      }
    }
    applyAttackPayload(playerStatusEffectsRef.current, now, payload, attackerPosition, playerGroupRef.current.position);
  };

  const handleHelperHit = (helperId: string, payload: AttackPayload, _now: number, attackerColor: string, attackerId?: string) => {
    const target = helpers.find((h) => h.id === helperId);
    if (!target || target.health <= 0) return;

    const hitPos = new THREE.Vector3(target.position.x, target.position.y + 1.3, target.position.z);
    const roundedDamage = modifiers.oneHit && payload.damage > 0 ? target.health : roundDamage(payload.damage);
    spawnDamageNumber(hitPos, roundedDamage, attackerColor);
    if (roundedDamage > 0) spawnBlood(hitPos);

    const nextHealth = Math.max(0, target.health - roundedDamage);
    applyVampireLifesteal(attackerId, roundedDamage, nextHealth === 0);
    // Just update health — when health hits 0 the HelperActor ragdolls for 15s
    // then calls onSunk, which is where the replacement is actually spawned.
    setHelpers((prev) => prev.map((h) => (h.id === helperId ? { ...h, health: nextHealth } : h)));
    // Storm Man: the bolt forks off this helper to the nearest other target.
    if (payload.chainLightning && roundedDamage > 0) {
      chainLightningZap(target.position, helperId, Math.max(1, Math.ceil(payload.damage / 2)), _now, attackerId);
    }
  };

  const handlePlayerDamage = (amount: number) => {
    if (amount > 0 && playerGroupRef.current) {
      const p = playerGroupRef.current.position;
      spawnBlood(new THREE.Vector3(p.x, p.y + 1.3, p.z));
    }
    statsRecordDamageTaken(amount);
    setPlayerHealth((prev) => (modifiers.oneHit && amount > 0 ? 0 : Math.max(0, prev - amount)));
  };

  const handlePlayerDeath = (position: THREE.Vector3, rotationY: number) => {
    audio.play('death', { volume: 1 });
    statsRecordDeath((Date.now() - lastDeathTimestampRef.current) / 1000);
    const id = `corpse-${nextCorpseId.current++}`;
    setPlayerCorpses((prev) => [...prev, { id, position: position.clone(), rotationY, diedAt: Date.now() }]);
    setPlayerHealth(effectiveMaxHealth);
    playerStatusEffectsRef.current = createStatusEffects();
    setDeaths((prev) => prev + 1);
    // Reset bounty hunter tracking - the player died, survival streak broken.
    lastDeathTimestampRef.current = Date.now();
    bountyHunterSpawnedRef.current = false;
    // Ironman: one life - the run is over. App shows the overlay and wipes
    // the save; the respawn above is moot behind the run-over screen.
    if (modifiers.ironman) onIronmanDeath?.();
  };

  const handlePlayerCorpseSunk = (corpseId: string) => {
    setPlayerCorpses((prev) => prev.filter((c) => c.id !== corpseId));
  };

  const handleInteract = () => {
    if (!playerGroupRef.current || isPaused) return;
    const playerPos = playerGroupRef.current.position;
    let nearestFlagId: string | null = null;
    let nearestDist = Infinity;
    flags.forEach((f) => {
      const dx = playerPos.x - f.position[0];
      const dz = playerPos.z - f.position[2];
      const dist = Math.hypot(dx, dz);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestFlagId = f.id;
      }
    });
    // Re-look-up by id (rather than narrowing the forEach-mutated reference
    // itself) so TS's flow analysis doesn't collapse this to a `never` read.
    const nearestFlag = flags.find((f) => f.id === nearestFlagId) ?? null;
    if (!nearestFlag || nearestDist > FLAG_INTERACT_RADIUS) return;

    // Boss Flag (sandbox): seal a ring arena around the player and summon a
    // giant Glowing Green Man boss inside. The wall drops when it dies.
    if (nearestFlag.isBossFlag) {
      setFlags((prev) => prev.filter((f) => f.id !== nearestFlag.id));
      const bid = `boss-${nextEnemyId.current++}`;
      const bossAngle = Math.random() * Math.PI * 2;
      const bpos: [number, number, number] = [
        playerPos.x + Math.cos(bossAngle) * BOSS_ARENA_RADIUS * 0.55,
        0,
        playerPos.z + Math.sin(bossAngle) * BOSS_ARENA_RADIUS * 0.55
      ];
      setEnemies((prev) => [
        ...prev,
        makeSpecialEnemyState(bid, 'glowingGreenMan', bpos, computeEnemySpawnHealthBonus('glowingGreenMan'), effectiveMaxHealth, true, Math.max(level, 5))
      ]);
      setBossArena({ centerX: playerPos.x, centerZ: playerPos.z, bossId: bid });
      return;
    }

    // Clear flag (sandbox): always summons a translucent Clear special.
    if (nearestFlag.isClearFlag) {
      setFlags((prev) => prev.filter((f) => f.id !== nearestFlag.id));
      const ctype = pickRandomSpecialType();
      const cid = `special-clear-${nextEnemyId.current++}`;
      setEnemies((prev) => [
        ...prev,
        makeSpecialEnemyState(cid, ctype, nearestFlag.position, computeEnemySpawnHealthBonus(ctype), effectiveMaxHealth, false, level, true)
      ]);
      return;
    }

    // Bonus flag: show 3 upgrade choices without completing the level (skipped in sandbox).
    if (nearestFlag.isBonus) {
      setFlags((prev) => prev.filter((f) => f.id !== nearestFlag.id));
      if (!isSandbox) {
        setPendingBonusUpgrade(true);
        setLevelChoiceOptions(pickRandomOptions(3, helpers.length > 0, statModifiers));
      }
      return;
    }

    // Challenge flag: spawn 3 specials simultaneously; completing all 3 awards 3 upgrades.
    if (nearestFlag.isChallenge) {
      setFlags((prev) => prev.filter((f) => f.id !== nearestFlag.id));
      const newIds: string[] = [];
      for (let i = 0; i < 3; i++) {
        const ctype = pickRandomSpecialType();
        const cid = `special-challenge-${nextEnemyId.current++}`;
        const jitter = () => (Math.random() - 0.5) * 4;
        const cpos: [number, number, number] = [nearestFlag.position[0] + jitter(), nearestFlag.position[1], nearestFlag.position[2] + jitter()];
        setEnemies((prev) => [
          ...prev,
          makeSpecialEnemyState(cid, ctype, cpos, computeEnemySpawnHealthBonus(ctype), effectiveMaxHealth, false, level)
        ]);
        newIds.push(cid);
      }
      setPendingSpecialIds((prev) => {
        const next = new Set(prev);
        newIds.forEach((cid) => next.add(cid));
        return next;
      });
      if (!isSandbox) setChallengeRewardPending(true);
      return;
    }

    const type = pickRandomSpecialType();
    const id = `special-${nextEnemyId.current++}`;
    const isGiant = !!nearestFlag.isGiant;
    setEnemies((prev) => [
      ...prev,
      makeSpecialEnemyState(id, type, nearestFlag.position, computeEnemySpawnHealthBonus(type), effectiveMaxHealth, isGiant, level)
    ]);
    // Using a flag always summons one more enemy you now owe a kill, so the
    // level can never complete on this same action - only once that enemy
    // (and everything else still pending) is actually dead, checked in
    // handleEnemyHit.
    setPendingSpecialIds((prev) => new Set(prev).add(id));

    setFlags((prev) => prev.filter((f) => f.id !== nearestFlag.id));
  };

  // Phase Man mirrors his intangibility window up here so handleEnemyHit
  // and Player's hit-test can both gate off the same EnemyState field.
  const handleEnemyPhaseChange = useCallback((enemyId: string, untilMs: number) => {
    setEnemies((prev) => prev.map((e) => (e.id === enemyId ? { ...e, phasedUntilMs: untilMs } : e)));
  }, []);

  const spawnPlayerTurret = () => {
    setTurrets((prev) => [
      ...prev,
      {
        id: `turret-${nextTurretId.current++}`,
        owner: 'player',
        position: new THREE.Vector3(...generateEnemySpawnPosition()),
        health: 1,
        maxHealth: 1
      }
    ]);
  };

  // Engineer Man deploys - capped so a pack of engineers can't flood the map.
  const handleDeployTurret = (position: THREE.Vector3, _ownerId: string) => {
    setTurrets((prev) => {
      const enemyTurretCount = prev.filter((t) => t.owner === 'enemy' && t.health > 0).length;
      if (enemyTurretCount >= MAX_ENEMY_TURRETS) return prev;
      return [
        ...prev,
        {
          id: `turret-${nextTurretId.current++}`,
          owner: 'enemy',
          position: position.clone(),
          health: ENEMY_TURRET_HEALTH,
          maxHealth: ENEMY_TURRET_HEALTH,
          expiresAtMs: Date.now() + ENEMY_TURRET_LIFETIME_MS
        }
      ];
    });
  };

  const handleTurretHit = (turretId: string, rawDamage: number) => {
    const target = turrets.find((t) => t.id === turretId);
    if (!target || target.owner !== 'enemy' || target.health <= 0) return;
    const damage = roundDamage(rawDamage);
    const hitPos = new THREE.Vector3(target.position.x, target.position.y + 0.45, target.position.z);
    spawnDamageNumber(hitPos, damage, playerTint);
    const nextHealth = Math.max(0, target.health - damage);
    if (nextHealth === 0) {
      debrisRef.current?.spawnBurst(hitPos, '#ff8f00');
      // The turret breaks apart into its charred (blackened) shapes - base,
      // head, and barrel each tumble to the ground burning.
      const spawnWreck = (size: [number, number, number], yOff: number) => {
        chunksRef.current?.spawnChunk({
          position: new THREE.Vector3(target.position.x, target.position.y + yOff, target.position.z),
          size,
          color: '#141414',
          onFire: true,
          lifetime: 5,
          velocity: new THREE.Vector3((Math.random() - 0.5) * 2.6, 2 + Math.random() * 1.4, (Math.random() - 0.5) * 2.6)
        });
      };
      spawnWreck([0.6, 0.3, 0.6], 0.15);
      spawnWreck([0.3, 0.24, 0.3], 0.45);
      spawnWreck([0.09, 0.09, 0.3], 0.5);
      setTurrets((prev) => prev.filter((t) => t.id !== turretId));
    } else {
      setTurrets((prev) => prev.map((t) => (t.id === turretId ? { ...t, health: nextHealth } : t)));
    }
  };

  const handleTurretExpire = useCallback((turretId: string) => {
    setTurrets((prev) => prev.filter((t) => t.id !== turretId));
  }, []);

  // Trapper Man mines.
  const handlePlaceMine = (position: THREE.Vector3, _ownerId: string) => {
    setMines((prev) => {
      if (prev.length >= MAX_ACTIVE_MINES) return prev;
      return [...prev, { id: `mine-${nextMineId.current++}`, position: position.clone() }];
    });
  };

  const handleMineTriggered = (
    mineId: string,
    victim: { kind: 'player' } | { kind: 'helper'; id: string } | { kind: 'civilian'; id: string } | { kind: 'enemy'; id: string },
    now: number
  ) => {
    const mine = mines.find((m) => m.id === mineId);
    if (!mine) return;
    setMines((prev) => prev.filter((m) => m.id !== mineId));
    for (let i = 0; i < 8; i++) {
      const p = mine.position.clone();
      p.x += (Math.random() - 0.5) * 0.6;
      p.y += 0.1 + Math.random() * 0.7;
      p.z += (Math.random() - 0.5) * 0.6;
      projectilesRef.current?.spawnAmbientParticle(p, '#ff1744');
    }
    audio.play('punch', { volume: 0.8 });
    // isProjectile: a lucky parry blocks it without trying to stun a non-enemy.
    const payload: AttackPayload = { damage: 1, range: 'melee', stunDuration: MINE_STUN_DURATION, launch: true, auraColor: '#ff8a80', isProjectile: true };
    if (victim.kind === 'player') {
      handleAttackOnPlayer(payload, mine.position.clone(), now, '#ff1744', mineId);
    } else if (victim.kind === 'helper') {
      handleHelperHit(victim.id, payload, now, '#ff1744', mineId);
    } else if (victim.kind === 'enemy') {
      // Friendly fire: the mine damages and knocks down fellow enemies
      // (stagger-immune types eat the damage but stay standing).
      const config = ENEMY_CONFIGS[enemies.find((e) => e.id === victim.id)?.type as EnemyType];
      handleEnemyHit(victim.id, 1);
      if (config && !config.staggerImmune) {
        setEnemies((prev) =>
          prev.map((e) => (e.id === victim.id && e.health > 0 ? { ...e, ragdollStunUntilMs: Date.now() + MINE_STUN_DURATION * 1000 } : e))
        );
      }
    } else {
      handleAttackCivilian(victim.id, payload, now, '#ff1744', mineId);
    }
  };

  const handleThrowBomb = (position: THREE.Vector3, _ownerId: string) => {
    setBombs((prev) => {
      if (prev.length >= MAX_ACTIVE_BOMBS) return prev;
      return [
        ...prev,
        {
          id: `bomb-${nextBombId.current++}`,
          position: position.clone().setY(0),
          fuseRemaining: BOMB_FUSE_SECONDS,
          fuseTotal: BOMB_FUSE_SECONDS
        }
      ];
    });
  };

  const handleBombExplode = (bombId: string, now: number) => {
    const bomb = bombs.find((b) => b.id === bombId);
    if (!bomb) return;
    setBombs((prev) => prev.filter((b) => b.id !== bombId));
    debrisRef.current?.spawnBurst(new THREE.Vector3(bomb.position.x, 0.35, bomb.position.z), '#ff9800');
    for (let i = 0; i < 10; i++) {
      const p = bomb.position.clone();
      p.x += (Math.random() - 0.5) * 1.6;
      p.y += 0.2 + Math.random() * 1.2;
      p.z += (Math.random() - 0.5) * 1.6;
      projectilesRef.current?.spawnAmbientParticle(p, i % 2 === 0 ? '#ff9800' : '#ff5722');
    }
    // isProjectile keeps a lucky parry from trying to ragdoll-stun the bomb
    // "attacker" (which isn't an enemy) while still letting it block damage.
    const payload: AttackPayload = { damage: BOMB_DAMAGE, range: 'ranged', stunDuration: 1.2, launch: true, auraColor: '#ffb74d', isProjectile: true };
    const p = playerGroupRef.current?.position;
    if (p && Math.hypot(p.x - bomb.position.x, p.z - bomb.position.z) <= BOMB_RADIUS) {
      handleAttackOnPlayer(payload, bomb.position.clone(), now, '#ff9800', bombId);
    }
    helpers.forEach((h) => {
      if (h.health > 0 && Math.hypot(h.position.x - bomb.position.x, h.position.z - bomb.position.z) <= BOMB_RADIUS) {
        handleHelperHit(h.id, payload, now, '#ff9800', bombId);
      }
    });
    civilians.forEach((c) => {
      if (c.health > 0 && Math.hypot(c.position.x - bomb.position.x, c.position.z - bomb.position.z) <= BOMB_RADIUS) {
        handleAttackCivilian(c.id, payload, now, '#ff9800', bombId);
      }
    });
  };

  const handleHelperSunk = (helperId: string) => {
    // 15s ragdoll is done — spawn the replacement with the dead helper's
    // accumulated stats, then remove the corpse entry.
    setHelpers((prev) => {
      const dead = prev.find((h) => h.id === helperId);
      // Bodyguards are mortal: no replacement, ever.
      if (dead?.noRespawn) return prev.filter((h) => h.id !== helperId);
      const replacement: HelperState = dead
        ? {
            ...dead,
            id: `helper-${nextHelperId.current++}`,
            instanceKey: 0,
            health: dead.maxHealth,
            position: spawnHelperNearPlayer(),
            velocity: new THREE.Vector3()
          }
        : {
            id: `helper-${nextHelperId.current++}`,
            instanceKey: 0,
            pickCount: 1,
            maxHealth: HELPER_INITIAL_HEALTH,
            punchDamage: HELPER_INITIAL_PUNCH_DAMAGE,
            kickDamage: HELPER_INITIAL_KICK_DAMAGE,
            health: HELPER_INITIAL_HEALTH,
            moveSpeedMultiplier: 0.7,
            attackSpeedMultiplier: 0.7,
            position: spawnHelperNearPlayer(),
            velocity: new THREE.Vector3()
          };
      return [...prev.filter((h) => h.id !== helperId), replacement];
    });
  };

  const spawnHelperNearPlayer = () => {
    const p = playerGroupRef.current ? playerGroupRef.current.position.clone() : new THREE.Vector3();
    p.x += 1.2;
    return p;
  };

  const createNewHelper = (): HelperState => ({
    id: `helper-${nextHelperId.current++}`,
    instanceKey: 0,
    pickCount: 1,
    maxHealth: HELPER_INITIAL_HEALTH,
    punchDamage: HELPER_INITIAL_PUNCH_DAMAGE,
    kickDamage: HELPER_INITIAL_KICK_DAMAGE,
    health: HELPER_INITIAL_HEALTH,
    moveSpeedMultiplier: HELPER_BASE_SPEED_MULTIPLIER,
    attackSpeedMultiplier: HELPER_BASE_SPEED_MULTIPLIER,
    position: spawnHelperNearPlayer(),
    velocity: new THREE.Vector3()
  });

  // Sandbox-only: apply an upgrade's stat effect with no enemy auto-scaling and no level advance.
  const sandboxApplyUpgrade = useCallback((option: LevelChoiceOption) => {
    if (option === 'playerHealth') { setStatModifiers(p => ({ ...p, playerHealthBonus: p.playerHealthBonus + 1 })); setPlayerHealth(p => p + 1); }
    else if (option === 'playerDamage') setStatModifiers(p => ({ ...p, playerDamageBonus: p.playerDamageBonus + 1 }));
    else if (option === 'playerAttackSpeed') setStatModifiers(p => ({ ...p, playerAttackSpeedBonus: p.playerAttackSpeedBonus + SPEED_BONUS_PER_PICK }));
    else if (option === 'playerMoveSpeed') setStatModifiers(p => ({ ...p, playerMoveSpeedBonus: p.playerMoveSpeedBonus + SPEED_BONUS_PER_PICK }));
    else if (option === 'staminaMax') setStatModifiers(p => ({ ...p, staminaMaxBonus: p.staminaMaxBonus + STAMINA_MAX_BONUS_PER_PICK }));
    else if (option === 'critChance') setStatModifiers(p => ({ ...p, critChancePicks: p.critChancePicks + 1 }));
    else if (option === 'thorns') setStatModifiers(p => ({ ...p, thornsPicks: p.thornsPicks + 1 }));
    else if (option === 'dash') setStatModifiers(p => ({ ...p, dashPicks: p.dashPicks + 1 }));
    else if (option === 'parry') setStatModifiers(p => ({ ...p, parryPicks: p.parryPicks + 1 }));
    else if (option === 'groundSlam') setStatModifiers(p => ({ ...p, groundSlamPicks: p.groundSlamPicks + 1 }));
    else if (option === 'flashlightUpgrade') setFlashlightLevel(p => p + 1);
    else if (option === 'drone') setDroneLevel(p => p + 1);
    else if (option === 'turret') { setTurretLevel(p => p + 1); spawnPlayerTurret(); }
    else if (option === 'helper') setHelpers(prev => [...prev, createNewHelper()]);
    else if (option === 'playerComboSmall') {
      setStatModifiers(p => ({ ...p, playerHealthBonus: p.playerHealthBonus + PLAYER_COMBO_SMALL_AMOUNT, playerDamageBonus: p.playerDamageBonus + PLAYER_COMBO_SMALL_AMOUNT }));
      setPlayerHealth(p => p + PLAYER_COMBO_SMALL_AMOUNT);
    } else if (option === 'playerComboBig') {
      setStatModifiers(p => ({ ...p, playerHealthBonus: p.playerHealthBonus + PLAYER_COMBO_BIG_AMOUNT, playerDamageBonus: p.playerDamageBonus + PLAYER_COMBO_BIG_AMOUNT }));
      setPlayerHealth(p => p + PLAYER_COMBO_BIG_AMOUNT);
     } else if (option === 'enemySpawnRate') {
      setStatModifiers(p => ({ ...p, enemySpawnRateBonus: p.enemySpawnRateBonus + ENEMY_SPAWN_RATE_AMOUNT_PER_PICK }));
    } else if (option === 'enemyCombo') {
      setStatModifiers(p => ({ ...p, enemyHealthBonus: p.enemyHealthBonus + ENEMY_COMBO_AMOUNT, enemyDamageBonus: p.enemyDamageBonus + ENEMY_COMBO_AMOUNT }));
    } else if (option === 'challengeFlag') {
      setStatModifiers(p => ({ ...p, groundSlamPicks: p.groundSlamPicks + 1 }));
    } else if (option === 'lightBlock') {
      setLightBlocks(prev => {
        const spawnCount = prev.length === 0 ? 1 : 2;
        const additions: LightBlockDef[] = [];
        for (let i = 0; i < spawnCount; i++) additions.push(generateLightBlockDef(`lightblock-${nextLightBlockId.current++}`));
        return [...prev, ...additions];
      });
    } else if (option === 'enemyHealth') {
      setStatModifiers(p => ({ ...p, enemyHealthBonus: p.enemyHealthBonus + 1 }));
    } else if (option === 'enemyDamage') {
      setStatModifiers(p => ({ ...p, enemyDamageBonus: p.enemyDamageBonus + 1 }));
    } else if (option === 'enemyAttackSpeed') {
      setStatModifiers(p => ({ ...p, enemyAttackSpeedBonus: p.enemyAttackSpeedBonus + SPEED_BONUS_PER_PICK }));
    } else if (option === 'enemyMoveSpeed') {
      setStatModifiers(p => ({ ...p, enemyMoveSpeedBonus: p.enemyMoveSpeedBonus + SPEED_BONUS_PER_PICK }));
    } else if (option === 'helperMoveSpeed') {
      // Sandbox has no helper-target dropdown: helper upgrades hit ALL helpers.
      setHelpers(prev => prev.map(h => ({ ...h, moveSpeedMultiplier: h.moveSpeedMultiplier + HELPER_SPEED_UPGRADE_AMOUNT })));
    } else if (option === 'helperAttackSpeed') {
      setHelpers(prev => prev.map(h => ({ ...h, attackSpeedMultiplier: h.attackSpeedMultiplier + HELPER_SPEED_UPGRADE_AMOUNT })));
    } else if (option === 'helperLevelUp2') {
      setHelpers(prev => prev.map(h => {
        const nextMaxHealth = h.maxHealth + HELPER_LEVEL_UP_2_AMOUNT;
        return { ...h, maxHealth: nextMaxHealth, punchDamage: h.punchDamage + HELPER_LEVEL_UP_2_AMOUNT, kickDamage: h.kickDamage + HELPER_LEVEL_UP_2_AMOUNT, health: Math.min(h.health + HELPER_LEVEL_UP_2_AMOUNT, nextMaxHealth) };
      }));
    } else if (option === 'helperRanged') {
      setHelpers(prev => prev.map(h => ({ ...h, isRanged: true })));
    }
  }, []);

  const handleChooseUpgrade = (option: LevelChoiceOption, helperTarget?: string) => {
    // Bonus upgrades (isBonus flag) don't advance the level - just apply and close.
    const isBonusMode = pendingBonusUpgrade;

    if (!isBonusMode) {
      // Enemies get tougher every level regardless of what's picked - picking
      // one of the enemy options on top of this stacks an extra bonus, a small
      // intentional risk/reward wrinkle rather than a bug.
      setStatModifiers((prev) => ({
        ...prev,
        enemyHealthBonus: prev.enemyHealthBonus + ENEMY_AUTO_SCALE_PER_LEVEL,
        enemyDamageBonus: prev.enemyDamageBonus + ENEMY_AUTO_SCALE_PER_LEVEL
      }));
    }

    if (option === 'enemyHealth') {
      setStatModifiers((prev) => ({ ...prev, enemyHealthBonus: prev.enemyHealthBonus + 1 }));
    } else if (option === 'enemyDamage') {
      setStatModifiers((prev) => ({ ...prev, enemyDamageBonus: prev.enemyDamageBonus + 1 }));
    } else if (option === 'enemyAttackSpeed') {
      setStatModifiers((prev) => ({ ...prev, enemyAttackSpeedBonus: prev.enemyAttackSpeedBonus + SPEED_BONUS_PER_PICK }));
    } else if (option === 'enemyMoveSpeed') {
      setStatModifiers((prev) => ({ ...prev, enemyMoveSpeedBonus: prev.enemyMoveSpeedBonus + SPEED_BONUS_PER_PICK }));
    } else if (option === 'playerHealth') {
      setStatModifiers((prev) => ({ ...prev, playerHealthBonus: prev.playerHealthBonus + 1 }));
      setPlayerHealth((prev) => prev + 1);
    } else if (option === 'playerDamage') {
      setStatModifiers((prev) => ({ ...prev, playerDamageBonus: prev.playerDamageBonus + 1 }));
    } else if (option === 'playerAttackSpeed') {
      setStatModifiers((prev) => ({ ...prev, playerAttackSpeedBonus: prev.playerAttackSpeedBonus + SPEED_BONUS_PER_PICK }));
    } else if (option === 'playerMoveSpeed') {
      setStatModifiers((prev) => ({ ...prev, playerMoveSpeedBonus: prev.playerMoveSpeedBonus + SPEED_BONUS_PER_PICK }));
    } else if (option === 'staminaMax') {
      setStatModifiers((prev) => ({ ...prev, staminaMaxBonus: prev.staminaMaxBonus + STAMINA_MAX_BONUS_PER_PICK }));
    } else if (option === 'enemySpawnRate') {
      setStatModifiers((prev) => ({ ...prev, enemySpawnRateBonus: prev.enemySpawnRateBonus + ENEMY_SPAWN_RATE_AMOUNT_PER_PICK }));
    } else if (option === 'critChance') {
      setStatModifiers((prev) => ({ ...prev, critChancePicks: prev.critChancePicks + 1 }));
    } else if (option === 'lightBlock') {
      // First pick spawns 1 block; every subsequent pick spawns 2.
      setLightBlocks((prev) => {
        const spawnCount = prev.length === 0 ? 1 : 2;
        const additions: LightBlockDef[] = [];
        for (let i = 0; i < spawnCount; i++) {
          additions.push(generateLightBlockDef(`lightblock-${nextLightBlockId.current++}`));
        }
        return [...prev, ...additions];
      });
    } else if (option === 'playerComboSmall') {
      setStatModifiers((prev) => ({
        ...prev,
        playerHealthBonus: prev.playerHealthBonus + PLAYER_COMBO_SMALL_AMOUNT,
        playerDamageBonus: prev.playerDamageBonus + PLAYER_COMBO_SMALL_AMOUNT
      }));
      setPlayerHealth((prev) => prev + PLAYER_COMBO_SMALL_AMOUNT);
    } else if (option === 'playerComboBig') {
      setStatModifiers((prev) => ({
        ...prev,
        playerHealthBonus: prev.playerHealthBonus + PLAYER_COMBO_BIG_AMOUNT,
        playerDamageBonus: prev.playerDamageBonus + PLAYER_COMBO_BIG_AMOUNT
      }));
      setPlayerHealth((prev) => prev + PLAYER_COMBO_BIG_AMOUNT);
    } else if (option === 'enemyCombo') {
      setStatModifiers((prev) => ({
        ...prev,
        enemyHealthBonus: prev.enemyHealthBonus + ENEMY_COMBO_AMOUNT,
        enemyDamageBonus: prev.enemyDamageBonus + ENEMY_COMBO_AMOUNT
      }));
    } else if (option === 'flashlightUpgrade') {
      setFlashlightLevel((prev) => prev + 1);
    } else if (option === 'drone') {
      setDroneLevel((prev) => prev + 1);
    } else if (option === 'turret') {
      setTurretLevel((prev) => prev + 1);
      spawnPlayerTurret();
    } else if (option === 'helperLevelUp2') {
      setHelpers((prev) =>
        prev.map((h) => {
          if (h.id !== helperTarget) return h;
          const nextMaxHealth = h.maxHealth + HELPER_LEVEL_UP_2_AMOUNT;
          return {
            ...h,
            maxHealth: nextMaxHealth,
            punchDamage: h.punchDamage + HELPER_LEVEL_UP_2_AMOUNT,
            kickDamage: h.kickDamage + HELPER_LEVEL_UP_2_AMOUNT,
            health: Math.min(h.health + HELPER_LEVEL_UP_2_AMOUNT, nextMaxHealth)
          };
        })
      );
    } else if (option === 'helper') {
      // A dead helper is auto-replaced the instant it dies (see
      // handleHelperHit) and never offered as a dropdown target again, so
      // every reachable helperTarget here is guaranteed to be alive.
      if (helperTarget === 'new' || !helperTarget || helpers.length === 0) {
        setHelpers((prev) => [...prev, createNewHelper()]);
      } else {
        setHelpers((prev) =>
          prev.map((h) => {
            if (h.id !== helperTarget) return h;
            const newPickCount = h.pickCount + 1;
            const shouldUpgrade = newPickCount % HELPER_PICKS_PER_UPGRADE === 0;
            const bump = shouldUpgrade ? HELPER_UPGRADE_AMOUNT : 0;
            const nextMaxHealth = h.maxHealth + bump;
            return {
              ...h,
              pickCount: newPickCount,
              maxHealth: nextMaxHealth,
              punchDamage: h.punchDamage + bump,
              kickDamage: h.kickDamage + bump,
              health: Math.min(h.health + bump, nextMaxHealth)
            };
          })
        );
      }
    } else if (option === 'helperMoveSpeed' || option === 'helperAttackSpeed') {
      setHelpers((prev) =>
        prev.map((h) => {
          if (h.id !== helperTarget) return h;
          return {
            ...h,
            moveSpeedMultiplier: option === 'helperMoveSpeed' ? h.moveSpeedMultiplier + HELPER_SPEED_UPGRADE_AMOUNT : h.moveSpeedMultiplier,
            attackSpeedMultiplier: option === 'helperAttackSpeed' ? h.attackSpeedMultiplier + HELPER_SPEED_UPGRADE_AMOUNT : h.attackSpeedMultiplier
          };
        })
      );
    } else if (option === 'helperRanged') {
      // Converts the chosen helper into a kiting ranged fighter.
      setHelpers((prev) => prev.map((h) => (h.id === helperTarget ? { ...h, isRanged: true } : h)));
    } else if (option === 'thorns') {
      setStatModifiers((prev) => ({ ...prev, thornsPicks: prev.thornsPicks + 1 }));
    } else if (option === 'dash') {
      setStatModifiers((prev) => ({ ...prev, dashPicks: prev.dashPicks + 1 }));
    } else if (option === 'parry') {
      setStatModifiers((prev) => ({ ...prev, parryPicks: prev.parryPicks + 1 }));
    } else if (option === 'groundSlam') {
      setStatModifiers((prev) => ({ ...prev, groundSlamPicks: prev.groundSlamPicks + 1 }));
    } else if (option === 'challengeFlag') {
      // Unlocks ground slam and +1 kick damage bonus — treated as a groundSlam pick for simplicity.
      setStatModifiers((prev) => ({ ...prev, groundSlamPicks: prev.groundSlamPicks + 1 }));
    }

    setLevelChoiceOptions(null);
    if (isBonusMode) {
      setPendingBonusUpgrade(false);
      // Bonus upgrades don't advance the level.
      return;
    }
    setPendingSpecialIds(new Set());
    const nextLevel = level + 1;
    setLevel(nextLevel);
    setFlags(regenerateFlagsForLevel(nextLevel, nextFlagId.current));
    nextFlagId.current += flagCountForLevel(nextLevel);
  };

  // An army man reaching a medkit heals and consumes it, on the same terms
  // as the player: the kit relocates rather than disappearing (outside arenas).
  const handleCivilianTakeMedkit = (civilianId: string, medkitId: string) => {
    setCivilians((prev) =>
      prev.map((c) =>
        c.id === civilianId && c.health > 0
          ? { ...c, health: Math.min(c.maxHealth, c.health + ARMY_MEDKIT_HEAL) }
          : c
      )
    );
    setMedkits((prev) =>
      isArena ? prev.filter((m) => m.id !== medkitId) : prev.map((m) => (m.id === medkitId ? generateMedkitDef(m.id) : m))
    );
  };

  const handleFootballKick = (footballId: string, dirX: number, dirZ: number) => {
    const ball = footballsRef.current.find((b) => b.id === footballId);
    if (!ball) return;
    ball.velocity.set(dirX * FOOTBALL_KICK_SPEED, 0, dirZ * FOOTBALL_KICK_SPEED);
    ball.rollTimer = FOOTBALL_MAX_ROLL_SECONDS;
    ball.hitThisKick.clear();
    audio.play('punch');
  };

  // A rolling ball damages AND knocks down, reusing the same
  // ragdollStunUntilMs knockdown a parry or a mine produces.
  const handleFootballStrike = (enemyId: string, damage: number) => {
    handleEnemyHit(enemyId, damage);
    setEnemies((prev) =>
      prev.map((e) => (e.id === enemyId && e.health > 0 ? { ...e, ragdollStunUntilMs: Date.now() + FOOTBALL_STUN_MS } : e))
    );
  };

  return (
    <>
      <Canvas shadows camera={{ fov: cameraFov, near: 0.1, far: 1000 }} style={{ width: '100%', height: '100%' }}>
        <FovUpdater fov={cameraFov} />
        <PhysicsStepper />
        <SkyCycle
          onNightChange={setIsNight}
          isPaused={isPaused}
          forcedTime={isSandbox ? sandboxForcedTime : modifiers.permanentNight ? 'night' : null}
          playerRef={playerGroupRef}
        />
        {isArena && <ArenaFallWatcher active={arenaPhase === 'falling'} playerRef={playerGroupRef} onFellThrough={handleArenaFellThrough} />}
        <MedkitPickupHandler
          playerRef={playerGroupRef}
          medkits={medkits}
          playerHealth={playerHealth}
          maxHealth={effectiveMaxHealth}
          onHeal={() => setPlayerHealth(effectiveMaxHealth)}
          onMedkitConsumed={(id) =>
            setMedkits((prev) => (isArena ? prev.filter((m) => m.id !== id) : prev.map((m) => (m.id === id ? generateMedkitDef(m.id) : m))))
          }
        />
        <FlagGuideHandler playerRef={playerGroupRef} flags={flags} viewMode={viewMode} onChange={onFlagGuideChange} />
        {showMinimap && (
          <MinimapDriver
            canvasRef={minimapCanvasRef}
            playerRef={playerGroupRef}
            enemies={enemies}
            flags={flags}
            medkits={medkits}
            dummies={dummies}
            helpers={helpers}
            lightBlocks={lightBlocks}
            turrets={turrets}
            bombs={bombs}
            civilians={civilians}
            mapShape={mapShape}
          />
        )}
        <DebugHitboxes enabled={showDebugInfo} playerRef={playerGroupRef} enemies={enemies} dummies={dummies} helpers={helpers} />
        <Player
          playerRef={playerGroupRef}
          tint={playerTint}
          viewMode={viewMode}
          chestPositionRef={chestPositionRef}
          headPositionRef={headPositionRef}
          crates={crates}
          dummies={dummies}
          enemies={enemies}
          onCrateHit={handleCrateHit}
          onDummyHit={handleDummyHit}
          onEnemyHit={handleEnemyHit}
          playerHealth={playerHealth}
          maxHealth={effectiveMaxHealth}
          playerStatusEffectsRef={playerStatusEffectsRef}
          onPlayerDamage={handlePlayerDamage}
          onPlayerDeath={handlePlayerDeath}
          onInteract={handleInteract}
          damageBonus={statModifiers.playerDamageBonus}
          moveSpeedBonus={statModifiers.playerMoveSpeedBonus + speedDemonBonus}
          attackSpeedBonus={statModifiers.playerAttackSpeedBonus + speedDemonBonus}
          damageMultiplier={modifiers.glassCannon ? GLASS_CANNON_DAMAGE_MULTIPLIER : 1}
          overrideColliders={isArena ? arenaColliders : undefined}
          baseGroundYRef={baseGroundYRef}
          maxStamina={effectiveMaxStamina}
          critChance={critChance}
          flashlightOn={flashlightOn}
          flashlightLevel={flashlightLevel}
          isPaused={isPaused}
          onStatusEffectChange={onStatusEffectChange}
          onStaminaChange={onStaminaChange}
          dashPicks={statModifiers.dashPicks}
          parryPicks={statModifiers.parryPicks}
          groundSlamPicks={statModifiers.groundSlamPicks}
          parryWindowRef={parryWindowRef}
          dashInvincibleRef={dashInvincibleRef}
          turrets={turrets}
          onTurretHit={handleTurretHit}
          civilians={civilians}
          onCivilianHit={handleCivilianHitByPlayer}
          footballs={footballsRef.current}
          onFootballKick={handleFootballKick}
          lastAttackRef={playerLastAttackRef}
          footstepSound={footstepSound}
        />
        <CameraController
          playerRef={playerGroupRef}
          chestPositionRef={chestPositionRef}
          headPositionRef={headPositionRef}
          distanceFactor={cameraDistance}
          viewMode={viewMode}
        />
        {isArena ? <ArenaEnvironment phase={arenaPhase} boxHalf={arenaBoxHalf} /> : <EnvironmentFloor />}
        <WorldObjects crates={crates} hideStatic={isArena} />
        {dummies.map((d) => (
          <DummyActor
            key={d.id}
            position={d.position}
            velocity={d.velocity}
            health={d.health}
            onSunk={() => handleCorpseSunk(d.id)}
            isPaused={isPaused}
            forceSinkNow={forceSinkIds.has(`dummy-${d.id}`)}
            showHealthBar={showEnemyHealthBars}
          />
        ))}
        {enemies.filter((e) => CUBE_ENEMY_TYPES.includes(e.type as EnemyType)).map((e) => (
          <CubeEnemyActor
            key={e.id}
            id={e.id}
            type={e.type as EnemyType}
            health={e.health}
            maxHealth={e.maxHealth}
            position={e.position}
            velocity={e.velocity}
            playerRef={playerGroupRef}
            helpers={helpers}
            civilians={civilians}
            colliders={colliders}
            projectilesRef={projectilesRef}
            damageBonus={computeEnemyDamageBonus(e.type as EnemyType)}
            moveSpeedBonus={statModifiers.enemyMoveSpeedBonus + speedDemonBonus}
            attackSpeedBonus={statModifiers.enemyAttackSpeedBonus + speedDemonBonus}
            sizeMultiplier={e.sizeMultiplier}
            isPaused={isPaused}
            forceSinkNow={forceSinkIds.has(`enemy-${e.id}`)}
            ignorePlayer={isSandbox && sandboxEnemiesIgnorePlayer}
            showHealthBar={showEnemyHealthBars}
            onAttackPlayer={handleAttackOnPlayer}
            onAttackHelper={handleHelperHit}
            onAttackCivilian={handleAttackCivilian}
            onSpawnMinion={handleSlimeKingSpawn}
            onSunk={handleEnemySunk}
          />
        ))}
        {enemies.filter((e) => SMASH_BALL_TYPES.includes(e.type as EnemyType)).map((e) => (
          <SmashBallActor
            key={e.id}
            id={e.id}
            type={e.type as EnemyType}
            health={e.health}
            maxHealth={e.maxHealth}
            position={e.position}
            velocity={e.velocity}
            playerRef={playerGroupRef}
            helpers={helpers}
            civilians={civilians}
            colliders={colliders}
            projectilesRef={projectilesRef}
            damageBonus={computeEnemyDamageBonus(e.type as EnemyType)}
            moveSpeedBonus={statModifiers.enemyMoveSpeedBonus + speedDemonBonus}
            attackSpeedBonus={statModifiers.enemyAttackSpeedBonus + speedDemonBonus}
            sizeMultiplier={e.sizeMultiplier}
            isPaused={isPaused}
            forceSinkNow={forceSinkIds.has(`enemy-${e.id}`)}
            ignorePlayer={isSandbox && sandboxEnemiesIgnorePlayer}
            showHealthBar={showEnemyHealthBars}
            onAttackPlayer={handleAttackOnPlayer}
            onAttackHelper={handleHelperHit}
            onAttackCivilian={handleAttackCivilian}
            onSunk={handleEnemySunk}
          />
        ))}
        {enemies.filter((e) => !CUBE_ENEMY_TYPES.includes(e.type as EnemyType) && !SMASH_BALL_TYPES.includes(e.type as EnemyType)).map((e) => (
          <EnemyActor
            key={e.id}
            id={e.id}
            type={e.type as EnemyType}
            health={e.health}
            maxHealth={e.maxHealth}
            position={e.position}
            velocity={e.velocity}
            playerRef={playerGroupRef}
            playerStatusEffectsRef={playerStatusEffectsRef}
            helpers={helpers}
            enemies={enemies}
            civilians={civilians}
            colliders={colliders}
            projectilesRef={projectilesRef}
            onAttackPlayer={handleAttackOnPlayer}
            onAttackHelper={handleHelperHit}
            onAttackCivilian={handleAttackCivilian}
            onSunk={handleEnemySunk}
            onSpawnAdd={handleSpawnAdd}
            onHealNearbyEnemies={handleHealNearbyEnemies}
            onDeployTurret={handleDeployTurret}
            onThrowBomb={handleThrowBomb}
            onPlaceMine={handlePlaceMine}
            chunksRef={chunksRef}
            onPhaseChange={handleEnemyPhaseChange}
            playerLastAttackRef={playerLastAttackRef}
            damageBonus={computeEnemyDamageBonus(e.type as EnemyType) + (e.extraDamage ?? 0)}
            moveSpeedBonus={statModifiers.enemyMoveSpeedBonus + speedDemonBonus}
            attackSpeedBonus={statModifiers.enemyAttackSpeedBonus + speedDemonBonus}
            showHealthBar={showEnemyHealthBars}
            hasArmourOverride={!!e.hasArmour}
            isClear={e.isClear}
            isGiant={e.isGiant}
            sizeMultiplier={e.sizeMultiplier}
            colorOverride={e.type === BOUNTY_HUNTER_TYPE ? playerTint : undefined}
            showLastWords={showLastWords}
            isPaused={isPaused}
            ragdollStunUntilMs={e.ragdollStunUntilMs ?? 0}
            aggroPlayerUntilMs={e.aggroPlayerUntilMs ?? 0}
            protecteeId={e.protecteeId}
            guardAlertUntilMs={e.guardAlertUntilMs ?? 0}
            ignorePlayer={isSandbox && sandboxEnemiesIgnorePlayer}
            forceSinkNow={forceSinkIds.has(`enemy-${e.id}`)}
          />
        ))}
        {civilians.map((c) => (
          <CivilianActor
            key={c.id}
            id={c.id}
            role={c.role}
            civilians={civilians}
            protectCivilianId={c.protectCivilianId}
            medkits={medkits}
            onTakeMedkit={handleCivilianTakeMedkit}
            health={c.health}
            maxHealth={c.maxHealth}
            position={c.position}
            velocity={c.velocity}
            fearsPlayer={!!c.fearsPlayer}
            followingPlayer={!!c.followingPlayer}
            aggroPlayer={!!c.aggroPlayer}
            aggroEnemyId={c.aggroEnemyId}
            aggroUntilMs={c.aggroUntilMs ?? 0}
            panicUntilMs={c.panicUntilMs ?? 0}
            panicFromX={c.panicFromX}
            panicFromZ={c.panicFromZ}
            playerRef={playerGroupRef}
            enemies={enemies}
            colliders={colliders}
            isPaused={isPaused}
            forceSinkNow={forceSinkIds.has(`civilian-${c.id}`)}
            projectilesRef={projectilesRef}
            onArmyAttackEnemy={(enemyId, dmg) => handleEnemyHit(enemyId, dmg)}
            onArmyAttackPlayer={(dmg, pos, now, armyId) => handleAttackOnPlayer({ damage: dmg, range: 'melee' }, pos, now, '#4b5320', armyId)}
            statusEffects={c.statusEffects}
            onBurnDamage={(cid, dmg) => handleAttackCivilian(cid, { damage: dmg, range: 'melee' }, 0, '#ff7043')}
            showHealthBar={showEnemyHealthBars}
            onSunk={handleCivilianSunk}
          />
        ))}
        <Mines mines={mines} playerRef={playerGroupRef} helpers={helpers} civilians={civilians} enemies={enemies} isPaused={isPaused} onTriggered={handleMineTriggered} />
        {lavaTiles.length > 0 && (
          <LavaTiles tiles={lavaTiles} playerRef={playerGroupRef} playerStatusEffectsRef={playerStatusEffectsRef} isPaused={isPaused} />
        )}
        {bossArena && (
          <mesh position={[bossArena.centerX, 2.2, bossArena.centerZ]}>
            <cylinderGeometry args={[BOSS_ARENA_RADIUS, BOSS_ARENA_RADIUS, 4.4, 48, 1, true]} />
            <meshStandardMaterial color="#7c4dff" emissive="#7c4dff" emissiveIntensity={0.7} transparent opacity={0.2} side={THREE.DoubleSide} depthWrite={false} />
          </mesh>
        )}
        {portalPairs.length > 0 && <Portals pairs={portalPairs} playerRef={playerGroupRef} isPaused={isPaused} />}
        {/* Stormy Weather modifier: rain cloud + thick scene fog. */}
        {modifiers.weather && (
          <>
            <fog attach="fog" args={['#4a5a63', 6, 42]} />
            <Rain playerRef={playerGroupRef} isPaused={isPaused} />
          </>
        )}
        {helpers.map((h) => (
          <HelperActor
            key={`${h.id}-${h.instanceKey}`}
            id={h.id}
            health={h.health}
            maxHealth={h.maxHealth}
            punchDamage={h.punchDamage}
            kickDamage={h.kickDamage}
            moveSpeedMultiplier={h.moveSpeedMultiplier}
            attackSpeedMultiplier={h.attackSpeedMultiplier}
            tint={playerTint}
            overrideColor={h.overrideColor}
            overrideSizeMultiplier={h.overrideSizeMultiplier}
            overrideType={h.overrideType as EnemyType | undefined}
            isRanged={!!h.isRanged}
            position={h.position}
            velocity={h.velocity}
            playerRef={playerGroupRef}
            enemies={enemies}
            colliders={colliders}
            isPaused={isPaused}
            projectilesRef={projectilesRef}
            showHealthBar={showEnemyHealthBars}
            onAttackEnemy={handleEnemyHit}
            onSunk={handleHelperSunk}
          />
        ))}
        {flags.map((f) => (
          <BattleFlag key={f.id} position={f.position} isGiant={f.isGiant} isClearFlag={f.isClearFlag} />
        ))}
        {medkits.map((m) => (
          <Medkit key={m.id} position={m.position} />
        ))}
        <Footballs
          footballs={footballsRef.current}
          enemies={enemies}
          colliders={isArena ? arenaColliders : colliders}
          onEnemyStruck={handleFootballStrike}
        />
        {playerCorpses.map((c) => (
          <PlayerCorpse
            key={c.id}
            position={c.position}
            rotationY={c.rotationY}
            tint={playerTint}
            onSunk={() => handlePlayerCorpseSunk(c.id)}
            forceSinkNow={forceSinkIds.has(`corpse-${c.id}`)}
          />
        ))}
        {lightBlocks.map((lb) => (
          <group key={lb.id} position={lb.position}>
            <mesh position={[0, 0.4, 0]}>
              <boxGeometry args={[0.4, 0.4, 0.4]} />
              {/* Black cube during day; emissive glow only at night. */}
              <meshStandardMaterial
                color={isNight ? lb.color : '#111111'}
                emissive={isNight ? lb.color : '#000000'}
                emissiveIntensity={isNight ? 2 : 0}
              />
            </mesh>
            {isNight && <pointLight position={[0, 0.7, 0]} color={lb.color} intensity={3} distance={14} />}
          </group>
        ))}
        {droneLevel > 0 && (
          <DroneCompanion
            droneLevel={droneLevel}
            playerGroupRef={playerGroupRef}
            enemies={enemies}
            onAttackEnemy={handleEnemyHit}
            isPaused={isPaused}
          />
        )}
        {turrets.length > 0 && (
          <Turrets
            turrets={turrets}
            playerTurretDamage={Math.max(1, turretLevel)}
            playerRef={playerGroupRef}
            enemies={enemies}
            projectilesRef={projectilesRef}
            isPaused={isPaused}
            showHealthBar={showEnemyHealthBars}
            onExpire={handleTurretExpire}
          />
        )}
        <Bombs bombs={bombs} isPaused={isPaused} onExplode={handleBombExplode} />
        <FallingChunks ref={chunksRef} projectilesRef={projectilesRef} isPaused={isPaused} />
        <Projectiles ref={projectilesRef} playerRef={playerGroupRef} helpers={helpers} enemies={enemies} civilians={civilians} colliders={colliders} onHitPlayer={handleAttackOnPlayer} onHitHelper={handleHelperHit} onHitEnemy={(enemyId, damage) => handleEnemyHit(enemyId, damage)} onHitCivilian={handleAttackCivilian} />
        <BloodParticles ref={bloodRef} />
        <DebrisParticles ref={debrisRef} />
        <DamageNumbers ref={damageNumbersRef} />
        <LoadedNotifier onLoaded={onLoaded} />
      </Canvas>
      {showMinimap && (
        <canvas
          ref={minimapCanvasRef}
          width={MINIMAP_SIZE}
          height={MINIMAP_SIZE}
          style={{
            position: 'absolute',
            bottom: '20px',
            right: '20px',
            borderRadius: mapShape.kind === 'circle' ? '50%' : '14px',
            border: '2px solid rgba(79,195,247,0.45)',
            boxShadow: '0 0 18px rgba(0,0,0,0.55), inset 0 0 24px rgba(0,0,0,0.4)',
            zIndex: 15,
            // Sandbox only: the minimap doubles as a teleport pad. Everywhere
            // else it stays click-through so it can't swallow game input.
            pointerEvents: isSandbox ? 'auto' : 'none',
            cursor: isSandbox ? 'crosshair' : 'default'
          }}
          title={isSandbox ? 'Click to teleport there' : undefined}
          onClick={
            isSandbox
              ? (ev) => {
                  const player = playerGroupRef.current;
                  if (!player) return;
                  // Inverse of MinimapDriver's toMap(): same extent and scale,
                  // measured off the rendered box so CSS sizing can't skew it.
                  const rect = ev.currentTarget.getBoundingClientRect();
                  const mx = ((ev.clientX - rect.left) / rect.width) * MINIMAP_SIZE;
                  const my = ((ev.clientY - rect.top) / rect.height) * MINIMAP_SIZE;
                  const extent = Math.max(mapShape.halfX, mapShape.halfZ) * 1.06;
                  const scale = MINIMAP_SIZE / (extent * 2);
                  player.position.x = (mx - MINIMAP_SIZE / 2) / scale;
                  player.position.z = (my - MINIMAP_SIZE / 2) / scale;
                }
              : undefined
          }
        />
      )}
      {levelChoiceOptions && !isSandbox && (
        <LevelUpChoice
          level={level}
          options={levelChoiceOptions}
          helpers={helpers}
          onChoose={handleChooseUpgrade}
          isBonus={pendingBonusUpgrade}
        />
      )}
      {draftActive && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(3,5,8,0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 55 }}>
          <div className="fade-in" style={{ background: 'linear-gradient(165deg, #171c23, #0e1116)', border: '1px solid rgba(79,195,247,0.4)', borderRadius: '14px', padding: '26px 30px', width: '640px', maxWidth: '92vw', textAlign: 'center', color: '#fff', boxShadow: '0 12px 48px rgba(0,0,0,0.6)' }}>
            <div style={{ fontSize: '13px', color: '#a6e22e', letterSpacing: '2px', marginBottom: '4px' }}>NEW RUN</div>
            <h2 style={{ margin: '0 0 6px 0', fontSize: '24px', color: '#fd971f', letterSpacing: '2px' }}>LOADOUT DRAFT</h2>
            <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.55)', marginBottom: '18px' }}>
              Pick {draftPicksLeft} more starting upgrade{draftPicksLeft > 1 ? 's' : ''} from the pool.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
              {draftPool.map((opt) => (
                <button
                  key={opt}
                  className="upgrade-card"
                  onClick={() => {
                    sandboxApplyUpgrade(opt);
                    setDraftPool((prev) => prev.filter((o) => o !== opt));
                    setDraftPicksLeft((prev) => prev - 1);
                  }}
                  style={{ padding: '12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.22)', background: 'linear-gradient(180deg, #262c34, #1c2128)', color: '#fff', cursor: 'pointer', textAlign: 'left' }}
                >
                  <div style={{ fontWeight: 'bold', fontSize: '13px', color: '#4fc3f7', marginBottom: '4px' }}>{OPTION_INFO[opt].title}</div>
                  <div style={{ fontSize: '11px', opacity: 0.8, lineHeight: 1.4 }}>{OPTION_INFO[opt].description}</div>
                </button>
              ))}
            </div>
            <button
              onClick={() => setDraftPicksLeft(0)}
              style={{ marginTop: '16px', padding: '7px 16px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: '#aaa', cursor: 'pointer', fontSize: '12px' }}
            >
              Skip draft
            </button>
          </div>
        </div>
      )}
      {showDebugInfo && (
        <div
          style={{
            position: 'absolute',
            bottom: '20px',
            left: '20px',
            maxHeight: '55vh',
            width: '280px',
            overflowY: 'auto',
            color: '#ffffff',
            background: 'rgba(0,0,0,0.82)',
            padding: '12px 14px',
            borderRadius: '8px',
            fontSize: '12px',
            border: '1px solid rgba(255,255,255,0.15)',
            zIndex: 15,
            fontFamily: 'monospace'
          }}
        >
          <div style={{ fontWeight: 'bold', color: '#4fc3f7', marginBottom: '6px' }}>DEBUG: Alive Entities</div>
          <div>
            Player - {playerHealth}/{effectiveMaxHealth} HP
          </div>
          <div style={{ marginTop: '6px', color: '#69f0ae', fontWeight: 'bold' }}>
            Helpers ({helpers.filter((h) => h.health > 0).length})
          </div>
          {helpers
            .filter((h) => h.health > 0)
            .map((h) => (
              <div key={h.id} style={{ paddingLeft: '8px' }}>
                {h.id} - {h.health}/{h.maxHealth}
              </div>
            ))}
          <div style={{ marginTop: '6px', color: '#ff5252', fontWeight: 'bold' }}>
            Enemies ({enemies.filter((e) => e.health > 0).length})
          </div>
          {enemies
            .filter((e) => e.health > 0)
            .map((e) => (
              <div key={e.id} style={{ paddingLeft: '8px' }}>
                {e.type} #{e.id} - {e.health}/{e.maxHealth}
                {e.isClear ? ' [Clear]' : ''}
                {e.isGiant ? ' [Giant]' : ''}
              </div>
            ))}
          <div style={{ marginTop: '6px', color: '#ffd54f', fontWeight: 'bold' }}>
            Dummies ({dummies.filter((d) => d.health > 0).length})
          </div>
          {dummies
            .filter((d) => d.health > 0)
            .map((d) => (
              <div key={d.id} style={{ paddingLeft: '8px' }}>
                {d.id} - {d.health}/{DUMMY_MAX_HEALTH}
              </div>
            ))}
        </div>
      )}
    </>
  );
};
