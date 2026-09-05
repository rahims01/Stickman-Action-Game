import * as THREE from 'three';
import { ENEMY_CONFIGS, EnemyType } from './enemyConfig';
import { ArenaRoom, FINAL_TIER, RoomTier, pickRoom, poolForRoom } from './arenaRooms';
import { MaterialKey } from './proceduralTextures';

/**
 * Arena vs AI.
 *
 * Two arena runs side by side, one life each, first to fall loses. The two
 * runs are genuinely INDEPENDENT — separate room draws, separate wave
 * counters, separate spawns — so you are not racing someone through an
 * identical course, you are racing them through your own.
 *
 * Both halves render from ONE WebGL context via a scissor split. Two canvases
 * meant two contexts plus two physics steppers on one shared world, which
 * both halved the frame rate and ran physics at double speed.
 */

export const VERSUS_MAX_HEALTH = 24;
export const VERSUS_BASE_DAMAGE = 4;
export const VERSUS_ATTACK_RANGE = 1.8;
export const VERSUS_ATTACK_COOLDOWN = 0.55;
export const VERSUS_HIT_WINDUP = 0.2;

export const VERSUS_ARENA_RADIUS = 13;
export const VERSUS_BASE_SPEED = 6.2;

/** How far apart the two arenas sit in world space. One scene, two places. */
export const SIDE_OFFSET = 400;

export const VERSUS_WAVES_PER_TIER = 4;
export const VERSUS_MAX_ALIVE = 6;

// ── Upgrades ──────────────────────────────────────────────────────────────
// Both sides earn one per wave from the same pool at the same rate. The AI
// picks automatically; so does the player, deliberately — a chooser would
// pause one side while the other kept fighting, and in a race that is not a
// choice, it is a head start.
export type VersusUpgrade = 'damage' | 'health' | 'speed' | 'lifesteal' | 'reach' | 'attackSpeed';

export const UPGRADE_LABEL: Record<VersusUpgrade, string> = {
  damage: '+2 DAMAGE',
  health: '+6 MAX HEALTH',
  speed: '+12% SPEED',
  lifesteal: '+1 LIFESTEAL',
  reach: '+15% REACH',
  attackSpeed: '+15% ATTACK SPEED'
};

const UPGRADE_POOL: VersusUpgrade[] = ['damage', 'health', 'speed', 'lifesteal', 'reach', 'attackSpeed'];

export const rollUpgrade = (): VersusUpgrade => UPGRADE_POOL[Math.floor(Math.random() * UPGRADE_POOL.length)];

export interface VersusEnemyState {
  id: string;
  type: EnemyType;
  label: string;
  material: MaterialKey | null;
  color: string;
  position: THREE.Vector3;
  health: number;
  maxHealth: number;
  damage: number;
  speed: number;
  scale: number;
  /** Ranged types hold their distance and throw instead of closing. */
  ranged: boolean;
  attackCooldown: number;
  diedAt: number | null;
}

export interface VersusShot {
  id: string;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  color: string;
  damage: number;
  life: number;
}

export interface VersusSideState {
  id: 'player' | 'ai';
  isHuman: boolean;
  tint: string;
  offsetX: number;
  health: number;
  maxHealth: number;
  damage: number;
  speed: number;
  reach: number;
  attackSpeed: number;
  lifesteal: number;
  upgrades: VersusUpgrade[];
  lastUpgrade: VersusUpgrade | null;
  lastUpgradeAt: number;
  wave: number;
  roomsEntered: number;
  room: ArenaRoom;
  kills: number;
  position: THREE.Vector3;
  attackCooldown: number;
  hitLock: number;
  dead: boolean;
}

export const AI_TINTS = ['#e74c3c', '#8e44ad', '#16a085', '#d68910', '#2c6fbb', '#27ae60', '#e67e22'];

export const randomAiTint = (avoid?: string): string => {
  const pool = AI_TINTS.filter((c) => c.toLowerCase() !== (avoid ?? '').toLowerCase());
  return pool[Math.floor(Math.random() * pool.length)];
};

export const tierFor = (roomsEntered: number): RoomTier =>
  Math.min(FINAL_TIER, Math.max(1, roomsEntered)) as RoomTier;

export const createSide = (id: 'player' | 'ai', isHuman: boolean, tint: string): VersusSideState => ({
  id,
  isHuman,
  tint,
  offsetX: id === 'ai' ? SIDE_OFFSET : 0,
  health: VERSUS_MAX_HEALTH,
  maxHealth: VERSUS_MAX_HEALTH,
  damage: VERSUS_BASE_DAMAGE,
  speed: VERSUS_BASE_SPEED,
  reach: VERSUS_ATTACK_RANGE,
  attackSpeed: 1,
  lifesteal: 0,
  upgrades: [],
  lastUpgrade: null,
  lastUpgradeAt: 0,
  wave: 0,
  roomsEntered: 1,
  // Drawn independently — the two runs do not share a seed.
  room: pickRoom(1),
  kills: 0,
  position: new THREE.Vector3(),
  attackCooldown: 0,
  hitLock: 0,
  dead: false
});

export const applyUpgrade = (side: VersusSideState, up: VersusUpgrade): void => {
  side.upgrades.push(up);
  side.lastUpgrade = up;
  side.lastUpgradeAt = Date.now();
  switch (up) {
    case 'damage':
      side.damage += 2;
      break;
    case 'health':
      side.maxHealth += 6;
      side.health = Math.min(side.maxHealth, side.health + 6);
      break;
    case 'speed':
      side.speed *= 1.12;
      break;
    case 'lifesteal':
      side.lifesteal += 1;
      break;
    case 'reach':
      side.reach *= 1.15;
      break;
    case 'attackSpeed':
      side.attackSpeed *= 1.15;
      break;
  }
};

/**
 * One wave for one side, built from that side's CURRENT room so the two
 * screens rarely show the same fight. Every enemy takes its size, speed,
 * health, damage, colour and material from its own config rather than a
 * shared template — a Bulwark really is a slow 1.55x wall and a Slinger
 * really does hang back.
 */
export const versusWaveRoster = (side: VersusSideState): VersusEnemyState[] => {
  const pool = poolForRoom(side.room);
  const count = Math.min(2 + Math.floor(side.wave / 2), VERSUS_MAX_ALIVE);
  const picks: { type: EnemyType; elite: boolean }[] = [];
  for (let i = 0; i < count; i++) picks.push({ type: pool[Math.floor(Math.random() * pool.length)], elite: false });
  if (side.wave % 3 === 0) picks.push({ type: side.room.special, elite: true });

  return picks.map(({ type, elite }, i) => {
    const cfg = ENEMY_CONFIGS[type];
    const a = (i / picks.length) * Math.PI * 2 + Math.random();
    const r = VERSUS_ARENA_RADIUS * 0.5 + Math.random() * (VERSUS_ARENA_RADIUS * 0.35);
    const scale = (cfg?.sizeMultiplier ?? 1) * (elite ? 1.25 : 1);
    const hp = Math.round((cfg?.maxHealth ?? 10) * (elite ? 1.7 : 1) + side.wave * 1.5);
    const melee = Math.max(cfg?.punch?.damage ?? 0, cfg?.kick?.damage ?? 0);
    const ranged = !!cfg?.staysAtRange;
    return {
      id: `${side.id}-e${Math.random().toString(36).slice(2, 9)}`,
      type,
      label: cfg?.label ?? type,
      material: cfg?.skinMaterial ?? null,
      color: cfg?.color ?? '#888888',
      position: new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r),
      health: hp,
      maxHealth: hp,
      damage: Math.max(1, (ranged ? (cfg?.specials?.[0]?.damage ?? 2) : melee) + Math.floor(side.wave / 6)),
      speed: (2.2 + Math.min(1.8, side.wave * 0.07)) * (cfg?.moveSpeedMultiplier ?? 1),
      scale,
      ranged,
      attackCooldown: 0.4 + Math.random(),
      diedAt: null
    };
  });
};
