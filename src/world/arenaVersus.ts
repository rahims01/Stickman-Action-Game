import * as THREE from 'three';
import { ENEMY_CONFIGS, EnemyType } from './enemyConfig';
import {
  ARENA_CONCRETE_HALF_X,
  ARENA_CONCRETE_HALF_Z,
  ARENA_LAVA_TILE_COUNT,
  ARENA_MAGMA_RADIUS,
  ARENA_SAND_RADIUS,
  ARENA_SAND_WALL_SEGMENTS,
  LAVA_TILE_MAX_RADIUS,
  LAVA_TILE_MIN_RADIUS,
  LavaTileDef
} from './gameState';
import { ArenaRoom, FINAL_TIER, RoomTier, WAVES_PER_TIER, pickRoom, poolForRoom } from './arenaRooms';
import { MaterialKey } from './proceduralTextures';

/**
 * Arena vs AI.
 *
 * Two runs of the REAL arena side by side, one life each, first to fall
 * loses. Same rooms, same room geometry, same one-room-per-tier cadence,
 * same eight-wave stretches, same hazards and the same enemy pools the solo
 * arena draws from — the only things that differ are the one life and the
 * fact that there are two of them.
 *
 * The two runs are genuinely INDEPENDENT: separate room draws, separate wave
 * counters, separate spawns. You are not racing someone through an identical
 * course, you are racing them through your own.
 *
 * Both halves render from ONE WebGL context via a scissor split. Two canvases
 * meant two contexts plus two physics steppers on one shared world, which
 * both halved the frame rate and ran physics at double speed.
 */

// ── Player numbers ────────────────────────────────────────────────────────
// A versus fighter has ONE life, so it carries a real health pool rather than
// the campaign's 10. At 24 (the old value) three tier-1 enemies swinging
// 4-damage kicks on a 1.4s cycle emptied it in about four seconds, which is
// exactly the "the AI keeps dying in five seconds" report — and it was
// killing the human just as fast.
export const VERSUS_MAX_HEALTH = 60;
export const VERSUS_BASE_DAMAGE = 6;
export const VERSUS_ATTACK_RANGE = 2;
export const VERSUS_ATTACK_COOLDOWN = 0.5;
export const VERSUS_HIT_WINDUP = 0.18;
/** Brief mercy window after any hit, so three enemies cannot land as one. */
export const VERSUS_INVULN = 0.45;
export const VERSUS_BASE_SPEED = 7;

/** How far apart the two arenas sit in world space. One scene, two places. */
export const SIDE_OFFSET = 400;

export const VERSUS_MAX_ALIVE = 7;
export const VERSUS_MEDKIT_HEAL = 14;
export const VERSUS_MEDKIT_RADIUS = 1.6;

// ── Room geometry, straight from the solo arena ───────────────────────────
export type VersusPhase = 'concrete' | 'sand' | 'magma';

export const phaseForRoom = (room: ArenaRoom): VersusPhase =>
  room.shape === 'rect' ? 'concrete' : room.shape === 'circle' ? 'sand' : 'magma';

export interface VersusBounds {
  kind: 'rect' | 'circle';
  halfX: number;
  halfZ: number;
  radius: number;
}

/**
 * The playable area of a room. Circular rooms are really N-gons, and their
 * wall segments sit on the APOTHEM rather than the circumradius — clamping to
 * the circumradius would let you stand inside a wall.
 */
export const boundsForRoom = (room: ArenaRoom): VersusBounds => {
  const phase = phaseForRoom(room);
  if (phase === 'concrete') {
    return { kind: 'rect', halfX: ARENA_CONCRETE_HALF_X - 1, halfZ: ARENA_CONCRETE_HALF_Z - 1, radius: 0 };
  }
  const segments = phase === 'magma' ? 5 : ARENA_SAND_WALL_SEGMENTS;
  const circum = phase === 'magma' ? ARENA_MAGMA_RADIUS : ARENA_SAND_RADIUS;
  return { kind: 'circle', halfX: 0, halfZ: 0, radius: circum * Math.cos(Math.PI / segments) - 1.2 };
};

/** Keeps a point inside the room, whatever shape it is. */
export const clampToBounds = (pos: THREE.Vector3, b: VersusBounds): void => {
  if (b.kind === 'rect') {
    pos.x = Math.max(-b.halfX, Math.min(b.halfX, pos.x));
    pos.z = Math.max(-b.halfZ, Math.min(b.halfZ, pos.z));
    return;
  }
  const r = Math.hypot(pos.x, pos.z);
  if (r > b.radius) {
    pos.x = (pos.x / r) * b.radius;
    pos.z = (pos.z / r) * b.radius;
  }
};

/** How far out a point at (x, z) is, as a 0..1 fraction of the room. */
export const boundsFraction = (x: number, z: number, b: VersusBounds): number =>
  b.kind === 'rect'
    ? Math.max(Math.abs(x) / b.halfX, Math.abs(z) / b.halfZ)
    : Math.hypot(x, z) / b.radius;

/** A random spot in the room. centreBias > 0 pulls the draw inward. */
export const randomRoomPos = (b: VersusBounds, centreBias = 0): THREE.Vector3 => {
  const pull = (t: number) => Math.pow(t, 1 + centreBias);
  if (b.kind === 'rect') {
    return new THREE.Vector3(
      (pull(Math.random()) * 2 - 1) * b.halfX * 0.9,
      0,
      (pull(Math.random()) * 2 - 1) * b.halfZ * 0.9
    );
  }
  const a = Math.random() * Math.PI * 2;
  const r = pull(Math.random()) * b.radius * 0.9;
  return new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r);
};

/** Molten rooms get the solo arena's lava scatter. */
export const isMoltenRoom = (room: ArenaRoom): boolean =>
  room.material === 'magma' || room.material === 'volcano' || room.material === 'furnace';

export const makeVersusLavaTiles = (b: VersusBounds): LavaTileDef[] =>
  Array.from({ length: ARENA_LAVA_TILE_COUNT }, (_, i) => {
    const p = randomRoomPos(b, 0.3);
    return {
      id: `versus-lava-${i}-${Math.random().toString(36).slice(2, 7)}`,
      position: [p.x, p.z] as [number, number],
      radius: LAVA_TILE_MIN_RADIUS + Math.random() * (LAVA_TILE_MAX_RADIUS - LAVA_TILE_MIN_RADIUS)
    };
  });

// ── Upgrades ──────────────────────────────────────────────────────────────
// Both sides earn one per cleared wave from the same pool at the same rate.
// The human picks from three; the AI picks at the same moment by its own
// reading of the run, and both worlds are frozen while the choice is open so
// nobody gains ground by deliberating.
export type VersusUpgrade = 'damage' | 'health' | 'speed' | 'lifesteal' | 'reach' | 'attackSpeed' | 'heal';

export const UPGRADE_LABEL: Record<VersusUpgrade, string> = {
  damage: '+3 DAMAGE',
  health: '+12 MAX HEALTH',
  speed: '+12% SPEED',
  lifesteal: '+2 LIFESTEAL',
  reach: '+15% REACH',
  attackSpeed: '+18% ATTACK SPEED',
  heal: 'HEAL 40%'
};

export const UPGRADE_BLURB: Record<VersusUpgrade, string> = {
  damage: 'Every swing hits harder. The only stat that shortens a fight.',
  health: 'A bigger pool, topped up by the same amount right now.',
  speed: 'Move faster: reach the Slingers, leave the Bulwarks behind.',
  lifesteal: 'Every landed hit gives health back. Wins long waves.',
  reach: 'Swing from further out, so you trade without stepping in.',
  attackSpeed: 'Shorter cooldown between swings.',
  heal: 'No permanent gain — just health, right now, when you need it.'
};

const UPGRADE_POOL: VersusUpgrade[] = ['damage', 'health', 'speed', 'lifesteal', 'reach', 'attackSpeed', 'heal'];

export const rollUpgrade = (): VersusUpgrade => UPGRADE_POOL[Math.floor(Math.random() * UPGRADE_POOL.length)];

/** Three distinct options for the picker. */
export const rollUpgradeChoices = (count = 3): VersusUpgrade[] => {
  const pool = [...UPGRADE_POOL];
  const out: VersusUpgrade[] = [];
  while (out.length < count && pool.length > 0) {
    out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  }
  return out;
};

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
  /** Illusion rooms: a duplicate that pops on one hit and hits for nothing. */
  mirage: boolean;
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

export interface VersusMedkit {
  id: string;
  position: THREE.Vector3;
  taken: boolean;
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
  bounds: VersusBounds;
  lava: LavaTileDef[];
  kills: number;
  position: THREE.Vector3;
  attackCooldown: number;
  hitLock: number;
  invuln: number;
  burnUntil: number;
  burnTick: number;
  dead: boolean;
}

export const AI_TINTS = ['#e74c3c', '#8e44ad', '#16a085', '#d68910', '#2c6fbb', '#27ae60', '#e67e22'];

export const randomAiTint = (avoid?: string): string => {
  const pool = AI_TINTS.filter((c) => c.toLowerCase() !== (avoid ?? '').toLowerCase());
  return pool[Math.floor(Math.random() * pool.length)];
};

export const tierFor = (roomsEntered: number): RoomTier =>
  Math.min(FINAL_TIER, Math.max(1, roomsEntered)) as RoomTier;

/** Waves left in this room, or null once the run is in its permanent one. */
export const wavesUntilNextRoom = (side: VersusSideState): number | null => {
  if (side.roomsEntered >= FINAL_TIER) return null;
  return WAVES_PER_TIER - (side.wave % WAVES_PER_TIER || WAVES_PER_TIER) + 1;
};

export const createSide = (id: 'player' | 'ai', isHuman: boolean, tint: string): VersusSideState => {
  // Drawn independently — the two runs do not share a seed.
  const room = pickRoom(1);
  const bounds = boundsForRoom(room);
  return {
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
    room,
    bounds,
    lava: isMoltenRoom(room) ? makeVersusLavaTiles(bounds) : [],
    kills: 0,
    position: new THREE.Vector3(),
    attackCooldown: 0,
    hitLock: 0,
    invuln: 0,
    burnUntil: 0,
    burnTick: 0,
    dead: false
  };
};

export const applyUpgrade = (side: VersusSideState, up: VersusUpgrade): void => {
  side.upgrades.push(up);
  side.lastUpgrade = up;
  side.lastUpgradeAt = Date.now();
  switch (up) {
    case 'damage':
      side.damage += 3;
      break;
    case 'health':
      side.maxHealth += 12;
      side.health = Math.min(side.maxHealth, side.health + 12);
      break;
    case 'speed':
      side.speed *= 1.12;
      break;
    case 'lifesteal':
      side.lifesteal += 2;
      break;
    case 'reach':
      side.reach *= 1.15;
      break;
    case 'attackSpeed':
      side.attackSpeed *= 1.18;
      break;
    case 'heal':
      side.health = Math.min(side.maxHealth, side.health + side.maxHealth * 0.4);
      break;
  }
};

/**
 * What the AI takes, given the shape of its own run. It is not picking at
 * random any more: badly hurt it heals, thin on damage it takes damage, and
 * once it is winning comfortably it compounds with lifesteal.
 */
export const aiPickUpgrade = (side: VersusSideState, options: VersusUpgrade[]): VersusUpgrade => {
  const frac = side.health / side.maxHealth;
  const count = (u: VersusUpgrade) => side.upgrades.filter((x) => x === u).length;
  const score = (u: VersusUpgrade): number => {
    switch (u) {
      // Healing is worth taking only when it is actually needed, but when it
      // is needed it beats everything — a dead fighter has no build.
      case 'heal':
        return frac < 0.4 ? 120 - frac * 100 : 10;
      case 'health':
        return frac < 0.6 ? 70 : 45 - count('health') * 4;
      case 'damage':
        return 60 - count('damage') * 5;
      case 'lifesteal':
        return 40 + (side.wave > 6 ? 20 : 0) - count('lifesteal') * 6;
      case 'attackSpeed':
        return 38 - count('attackSpeed') * 5;
      case 'reach':
        return 34 - count('reach') * 8;
      case 'speed':
        return 30 - count('speed') * 8;
    }
  };
  return [...options].sort((a, b) => score(b) - score(a))[0];
};

/**
 * How sharp the AI is on a given wave. It starts deliberately human — a
 * beat of reaction time, an imperfect sense of when to swing — and tightens
 * as the run goes, so an early lead is winnable and a late one is not.
 */
export interface VersusAiProfile {
  /** Seconds before it responds to a change in the fight. */
  reaction: number;
  /** How far out it starts worrying about a crowd. */
  crowdRadius: number;
  /** Health fraction below which it disengages entirely. */
  retreatAt: number;
  /** Health fraction below which it goes looking for a medkit. */
  medkitAt: number;
  /** 0..1 chance per decision that it commits to a swing it should not. */
  overcommit: number;
}

export const aiProfileFor = (wave: number): VersusAiProfile => {
  // Non-linear, like the Cup Run ladder: 0.30s down to ~0.13s, with most of
  // the improvement early, because reaction time past ~0.15s stops reading
  // as skill and starts reading as cheating.
  const t = Math.min(1, wave / 14);
  return {
    reaction: 0.3 - 0.17 * Math.pow(t, 1.5),
    crowdRadius: 4.5 + t * 2,
    retreatAt: 0.3 + t * 0.1,
    medkitAt: 0.55 + t * 0.1,
    overcommit: 0.3 - t * 0.25
  };
};

/**
 * One wave for one side, built from that side's CURRENT room so the two
 * screens rarely show the same fight. Every enemy takes its size, speed,
 * health, damage, colour and material from its own config rather than a
 * shared template — a Bulwark really is a slow 1.55x wall and a Slinger
 * really does hang back.
 *
 * Health and damage are scaled DOWN from the campaign values: a versus
 * fighter starts with no upgrades at all and has one life, where an arena
 * player arrives with a whole run's worth of stats behind them.
 */
export const versusWaveRoster = (side: VersusSideState): VersusEnemyState[] => {
  const pool = poolForRoom(side.room);
  const count = Math.min(2 + Math.floor(side.wave / 2), VERSUS_MAX_ALIVE);
  const picks: { type: EnemyType; elite: boolean; mirage: boolean }[] = [];
  for (let i = 0; i < count; i++) {
    picks.push({ type: pool[Math.floor(Math.random() * pool.length)], elite: false, mirage: false });
  }
  if (side.wave % 3 === 0) picks.push({ type: side.room.special, elite: true, mirage: false });
  // Illusion rooms: roughly half the wave again, as duplicates that are not
  // really there. One hit pops them and their swings do nothing.
  if (side.room.mirages) {
    // Capped: a full wave plus a full wave of duplicates is two dozen skinned
    // rigs across the two split-screen halves, and the frame rate is a shared
    // resource here in a way it is not in the solo arena.
    let ghosts = 0;
    for (const p of [...picks]) {
      if (ghosts >= 3) break;
      if (Math.random() < 0.6) {
        picks.push({ ...p, elite: false, mirage: true });
        ghosts++;
      }
    }
  }

  return picks.map(({ type, elite, mirage }, i) => {
    const cfg = ENEMY_CONFIGS[type];
    const a = (i / picks.length) * Math.PI * 2 + Math.random();
    const spawn = randomRoomPos(side.bounds, 0.15);
    // Ring the spawn out from the middle so nothing lands on top of you.
    const ringR = Math.max(7, Math.min(side.bounds.kind === 'rect' ? side.bounds.halfX : side.bounds.radius, 14));
    spawn.set(Math.cos(a) * ringR, 0, Math.sin(a) * ringR);
    clampToBounds(spawn, side.bounds);

    const scale = (cfg?.sizeMultiplier ?? 1) * (elite ? 1.25 : 1);
    const hp = mirage ? 1 : Math.round((cfg?.maxHealth ?? 10) * 0.75 * (elite ? 1.6 : 1) + side.wave);
    const melee = Math.max(cfg?.punch?.damage ?? 0, cfg?.kick?.damage ?? 0);
    const ranged = !!cfg?.staysAtRange;
    const raw = ranged ? cfg?.specials?.[0]?.damage ?? 2 : melee;
    return {
      id: `${side.id}-e${Math.random().toString(36).slice(2, 9)}`,
      type,
      label: cfg?.label ?? type,
      material: cfg?.skinMaterial ?? null,
      color: cfg?.color ?? '#888888',
      position: spawn,
      health: hp,
      maxHealth: hp,
      damage: mirage ? 0 : Math.max(1, Math.round(raw * 0.6) + Math.floor(side.wave / 5)),
      speed: (2.2 + Math.min(1.8, side.wave * 0.07)) * (cfg?.moveSpeedMultiplier ?? 1),
      scale,
      ranged,
      mirage,
      attackCooldown: 0.6 + Math.random() * 1.2,
      diedAt: null
    };
  });
};

/** Advance a side into its next room. One room per tier, tier 5 is forever. */
export const enterNextRoom = (side: VersusSideState): void => {
  side.roomsEntered += 1;
  side.room = pickRoom(tierFor(side.roomsEntered), side.room.id);
  side.bounds = boundsForRoom(side.room);
  side.lava = isMoltenRoom(side.room) ? makeVersusLavaTiles(side.bounds) : [];
  clampToBounds(side.position, side.bounds);
};
