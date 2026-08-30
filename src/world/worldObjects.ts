import { COMMON_BASIC_ENEMY_TYPES, EnemyType } from './enemyConfig';
import { FLAGS_PER_LEVEL_INCREMENT, INITIAL_FOOTBALL_COUNT, MAX_CONCURRENT_RARE_ENEMIES } from './gameState';

export interface CrateDef {
  id: string;
  type: 'crate';
  position: [number, number, number];
  size: number;
  color?: string;
}

export interface WallDef {
  id: string;
  type: 'wall';
  position: [number, number, number];
  rotationY: number;
  width: number;
  height: number;
  color?: string;
}

export type WorldObjectDef = CrateDef | WallDef;

export const WALL_DEPTH = 0.4;
export const MAP_RADIUS = 50;
export const SPAWN_EXCLUSION_RADIUS = 6;

export const INITIAL_CRATE_COUNT = 40;
export const INITIAL_WALL_COUNT = 16;
export const INITIAL_DUMMY_COUNT = 12;
export const INITIAL_BASIC_ENEMY_COUNT = 16;
export const INITIAL_FLAG_COUNT = 1;
export const INITIAL_MEDKIT_COUNT = 10;

// Deterministic PRNG (mulberry32) so the generated layout is stable across
// reloads within a session instead of reshuffling on every refresh. The same
// stream is also used for runtime respawns, so a full session (initial
// layout + every respawn) is a single reproducible sequence.
const mulberry32 = (seed: number) => {
  let state = seed;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const rng = mulberry32(20260627);

const randomPointInRing = (innerRadius: number, outerRadius: number): [number, number] => {
  const angle = rng() * Math.PI * 2;
  const distance = innerRadius + rng() * (outerRadius - innerRadius);
  return [Math.cos(angle) * distance, Math.sin(angle) * distance];
};

const CRATE_COLORS = ['#8a6d3b', '#a0823f', '#7a5c33', '#937241', '#9c7a44'];
const WALL_COLORS = ['#5a5f66', '#4f5359', '#646a72'];

export const generateCrateDef = (id: string): CrateDef => {
  const [x, z] = randomPointInRing(SPAWN_EXCLUSION_RADIUS, MAP_RADIUS);
  const size = 0.9 + rng() * 0.9;
  return {
    id,
    type: 'crate',
    position: [x, 0, z],
    size,
    color: CRATE_COLORS[Math.floor(rng() * CRATE_COLORS.length)]
  };
};

export const generateWallDef = (id: string): WallDef => {
  const [x, z] = randomPointInRing(SPAWN_EXCLUSION_RADIUS, MAP_RADIUS);
  const rotationY = rng() < 0.5 ? 0 : Math.PI / 2;
  const width = 2.2 + rng() * 1.4;
  return {
    id,
    type: 'wall',
    position: [x, 0, z],
    rotationY,
    width,
    height: 1.1,
    color: WALL_COLORS[Math.floor(rng() * WALL_COLORS.length)]
  };
};

export const generateDummySpawnPosition = (): [number, number, number] => {
  let x: number, z: number, tries = 0;
  do { [x, z] = randomPointInRing(SPAWN_EXCLUSION_RADIUS, MAP_RADIUS * 0.8); tries++; }
  while (tries < 20 && isInsideObstacle(x!, z!));
  return [x!, 0, z!];
};

export const generateEnemySpawnPosition = (): [number, number, number] => {
  let x: number, z: number, tries = 0;
  do { [x, z] = randomPointInRing(SPAWN_EXCLUSION_RADIUS, MAP_RADIUS * 0.8); tries++; }
  while (tries < 20 && isInsideObstacle(x!, z!));
  return [x!, 0, z!];
};

// Independent per-roll chances, rarest-checked-first - the first match
// wins. Order barely matters in practice (only one type can be returned
// per call regardless), but checking the rarest/most level-gated entries
// first keeps the intent readable. All gated collectively by
// MAX_CONCURRENT_RARE_ENEMIES via the caller-supplied `rareCountAlive`.
interface RareEnemyRollEntry {
  type: EnemyType;
  chance: number;
  minLevel?: number;
}

const RARE_ENEMY_ROLL_TABLE: RareEnemyRollEntry[] = [
  { type: 'brainMan', chance: 1 / 600 },
  { type: 'giantMan', chance: 1 / 300, minLevel: 6 },
  { type: 'babyMan', chance: 1 / 300, minLevel: 2 },
  { type: 'skinnyMan', chance: 1 / 30 },
  { type: 'tallMan', chance: 1 / 120, minLevel: 6 },
  { type: 'fatMan', chance: 1 / 120, minLevel: 7 },
  { type: 'strongRangedMan', chance: 1 / 120 },
  { type: 'strongKickMan', chance: 1 / 120 },
  { type: 'strongPunchMan', chance: 1 / 120 },
  { type: 'comboMan', chance: 1 / 120 },
  { type: 'strongComboMan', chance: 1 / 120 },
  { type: 'medicMan', chance: 1 / 80 },
  { type: 'rageMan', chance: 1 / 100 },
  { type: 'shieldBearer', chance: 1 / 150, minLevel: 3 },
  // Newer rare roster - each gated behind a level so early runs stay
  // beginner-friendly, roughly ordered by how disruptive the gimmick is.
  { type: 'sniperMan', chance: 1 / 110, minLevel: 3 },
  { type: 'strikerMan', chance: 1 / 120, minLevel: 4 },
  { type: 'copycatMan', chance: 1 / 110, minLevel: 4 },
  { type: 'vampireMan', chance: 1 / 120, minLevel: 4 },
  { type: 'phaseMan', chance: 1 / 130, minLevel: 5 },
  { type: 'bombMan', chance: 1 / 120, minLevel: 5 },
  { type: 'splitMan', chance: 1 / 130, minLevel: 6 },
  { type: 'armourMan', chance: 1 / 140, minLevel: 6 },
  { type: 'cloakedAssassin', chance: 1 / 150, minLevel: 7 },
  { type: 'engineerMan', chance: 1 / 160, minLevel: 8 },
  { type: 'coward', chance: 1 / 150, minLevel: 2 },
  { type: 'slimeBlock', chance: 1 / 140, minLevel: 4 },
  { type: 'shockerCube', chance: 1 / 140, minLevel: 5 },
  { type: 'slowCube', chance: 1 / 140, minLevel: 5 },
  { type: 'smashBall', chance: 1 / 130, minLevel: 5 },
  { type: 'juggernaut', chance: 1 / 160, minLevel: 6 },
  { type: 'resilientMan', chance: 1 / 150, minLevel: 5 },
  { type: 'superResilientMan', chance: 1 / 180, minLevel: 9 },
  { type: 'ragdollSmashBall', chance: 1 / 160, minLevel: 6 },
  { type: 'slowBall', chance: 1 / 150, minLevel: 5 },
  { type: 'splitBall', chance: 1 / 150, minLevel: 6 },
  { type: 'minionMan', chance: 1 / 130, minLevel: 4 },
  { type: 'ragdollThrower', chance: 1 / 150, minLevel: 6 },
  { type: 'adaptiveMan', chance: 1 / 120, minLevel: 4 },
  { type: 'giantSlime', chance: 1 / 200, minLevel: 7 },
  { type: 'colossalSlime', chance: 1 / 300, minLevel: 10 },
  { type: 'slimeKing', chance: 1 / 400, minLevel: 12 },
  { type: 'magnetMan', chance: 1 / 130, minLevel: 5 },
  { type: 'reflectorMan', chance: 1 / 140, minLevel: 6 },
  { type: 'repulsorMan', chance: 1 / 130, minLevel: 5 }
  // stormMan deliberately absent: he only spawns during Stormy Weather
  // (GameCanvas's maybeStormify) or from the sandbox.
];

export const generateBasicEnemySpawn = (
  level: number,
  rareCountAlive: number
): { type: EnemyType; position: [number, number, number] } => {
  const position = generateEnemySpawnPosition();
  if (rareCountAlive < MAX_CONCURRENT_RARE_ENEMIES) {
    for (const entry of RARE_ENEMY_ROLL_TABLE) {
      if (entry.minLevel !== undefined && level < entry.minLevel) continue;
      if (rng() < entry.chance) return { type: entry.type, position };
    }
  }
  return { type: COMMON_BASIC_ENEMY_TYPES[Math.floor(rng() * COMMON_BASIC_ENEMY_TYPES.length)], position };
};

export interface BattleFlagDef {
  id: string;
  position: [number, number, number];
  isGiant?: boolean;
  // Mid-level bonus: shows 3 upgrade choices without completing the level.
  isBonus?: boolean;
  // Challenge flag: spawns 3 enemies, surviving earns 3 upgrades instead of 2.
  isChallenge?: boolean;
  // Sandbox-only translucent red flag: always summons a Clear special.
  isClearFlag?: boolean;
  // Sandbox-only Boss Flag: seals a ring arena around the player and
  // summons a giant Glowing Green Man; the wall drops when the boss dies.
  isBossFlag?: boolean;
}

// --- Platforms ---

export interface PlatformDef {
  id: string;
  position: [number, number, number];
  width: number;
  depth: number;
  height: number;
  color?: string;
}

const PLATFORM_COLORS = ['#4a4f55', '#3d424a', '#55595f'];
const PLATFORM_COUNT = 8;

export const generatePlatformDef = (id: string): PlatformDef => {
  const [x, z] = randomPointInRing(SPAWN_EXCLUSION_RADIUS, MAP_RADIUS * 0.75);
  const width = 2.5 + rng() * 3;
  const depth = 2.5 + rng() * 3;
  const height = 0.8 + rng() * 1.2;
  return {
    id,
    position: [x, 0, z],
    width,
    depth,
    height,
    color: PLATFORM_COLORS[Math.floor(rng() * PLATFORM_COLORS.length)]
  };
};

export const INITIAL_PLATFORM_DEFS: PlatformDef[] = Array.from({ length: PLATFORM_COUNT }, (_, i) =>
  generatePlatformDef(`platform-${i}`)
);

export const getPlatformCollider = (p: PlatformDef): AABB => ({
  id: p.id,
  minX: p.position[0] - p.width / 2,
  maxX: p.position[0] + p.width / 2,
  minZ: p.position[2] - p.depth / 2,
  maxZ: p.position[2] + p.depth / 2,
  topY: p.height
});

export const generateFlagDef = (id: string): BattleFlagDef => {
  let x: number, z: number, tries = 0;
  do { [x, z] = randomPointInRing(SPAWN_EXCLUSION_RADIUS, MAP_RADIUS * 0.85); tries++; }
  while (tries < 20 && isInsideObstacle(x!, z!));
  return { id, position: [x!, 0, z!] };
};

export const flagCountForLevel = (level: number): number => INITIAL_FLAG_COUNT + (level - 1) * FLAGS_PER_LEVEL_INCREMENT;

// Levels with 16+ flags get exactly one giant flag among them, which
// summons a tougher/bigger/slower "giant" version of whatever special
// would otherwise have been picked (see GameCanvas's handleInteract).
const GIANT_FLAG_MIN_COUNT = 16;

// Each level gets a fresh, larger batch of flags (ids keep counting up via
// startId so React keys never collide with a previous level's flags).
export const regenerateFlagsForLevel = (level: number, startId: number): BattleFlagDef[] => {
  const flags = Array.from({ length: flagCountForLevel(level) }, (_, i) => generateFlagDef(`flag-${startId + i}`));
  if (flags.length >= GIANT_FLAG_MIN_COUNT) {
    const giantIndex = Math.floor(rng() * flags.length);
    flags[giantIndex] = { ...flags[giantIndex], isGiant: true };
  }
  // Every 3 levels, one flag is a bonus upgrade flag (3 choices, no level advance).
  if (level % 3 === 0 && flags.length > 0) {
    const bonusIndex = Math.floor(rng() * flags.length);
    // Don't stack with giant flag.
    if (!flags[bonusIndex].isGiant) {
      flags[bonusIndex] = { ...flags[bonusIndex], isBonus: true };
    } else if (flags.length > 1) {
      const alt = (bonusIndex + 1) % flags.length;
      flags[alt] = { ...flags[alt], isBonus: true };
    }
  }
  // Challenge flag: rare (roughly every 5 levels starting at 5), one per level.
  if (level >= 5 && level % 5 === 0 && flags.length > 1) {
    const challengeIndex = Math.floor(rng() * flags.length);
    if (!flags[challengeIndex].isGiant && !flags[challengeIndex].isBonus) {
      flags[challengeIndex] = { ...flags[challengeIndex], isChallenge: true };
    }
  }
  return flags;
};

export interface MedkitDef {
  id: string;
  position: [number, number, number];
}

export const generateMedkitDef = (id: string): MedkitDef => {
  const [x, z] = randomPointInRing(SPAWN_EXCLUSION_RADIUS, MAP_RADIUS * 0.85);
  return { id, position: [x, 0, z] };
};

// Ultimate Soccer crossover: a football lying in the arena. Unlike crates and
// medkits these are never consumed — a kicked ball rolls, knocks people down,
// comes to rest and is kickable again — so there's no respawn counterpart.
export interface FootballSpawn {
  id: string;
  position: [number, number, number];
}

export const generateFootballSpawn = (id: string): FootballSpawn => {
  const [x, z] = randomPointInRing(SPAWN_EXCLUSION_RADIUS, MAP_RADIUS * 0.7);
  return { id, position: [x, 0, z] };
};

// Purely decorative - spawned one at a time by the "add a light block"
// level-up option, each at a random spot with a random glow color.
export interface LightBlockDef {
  id: string;
  position: [number, number, number];
  color: string;
}

const LIGHT_BLOCK_COLORS = ['#4fc3f7', '#a6e22e', '#f92672', '#fd971f', '#ffffff', '#b362e0'];

export const generateLightBlockDef = (id: string): LightBlockDef => {
  const [x, z] = randomPointInRing(SPAWN_EXCLUSION_RADIUS, MAP_RADIUS * 0.85);
  return { id, position: [x, 0, z], color: LIGHT_BLOCK_COLORS[Math.floor(rng() * LIGHT_BLOCK_COLORS.length)] };
};

export const INITIAL_CRATE_DEFS: CrateDef[] = Array.from({ length: INITIAL_CRATE_COUNT }, (_, i) => generateCrateDef(`crate-${i}`));
export const INITIAL_WALL_DEFS: WallDef[] = Array.from({ length: INITIAL_WALL_COUNT }, (_, i) => generateWallDef(`wall-${i}`));

export interface AABB {
  id: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  topY: number;
}

const colliderFor = (obj: WorldObjectDef): AABB => {
  if (obj.type === 'crate') {
    const half = obj.size / 2;
    return {
      id: obj.id,
      minX: obj.position[0] - half,
      maxX: obj.position[0] + half,
      minZ: obj.position[2] - half,
      maxZ: obj.position[2] + half,
      topY: obj.size
    };
  }
  const isRotated90 = Math.abs(Math.sin(obj.rotationY)) > 0.5;
  const halfWidth = obj.width / 2;
  const halfDepth = WALL_DEPTH / 2;
  const halfX = isRotated90 ? halfDepth : halfWidth;
  const halfZ = isRotated90 ? halfWidth : halfDepth;
  return {
    id: obj.id,
    minX: obj.position[0] - halfX,
    maxX: obj.position[0] + halfX,
    minZ: obj.position[2] - halfZ,
    maxZ: obj.position[2] + halfZ,
    topY: obj.height
  };
};

export const getCrateCollider = (crate: CrateDef): AABB => colliderFor(crate);
export const getWallCollider = (wall: WallDef): AABB => colliderFor(wall);

// Static obstacle AABBs: walls + platforms. Built once so spawn functions can
// avoid placing flags/enemies inside them via isInsideObstacle below.
const STATIC_OBSTACLE_AABBS: AABB[] = [
  ...INITIAL_PLATFORM_DEFS.map(getPlatformCollider),
  ...INITIAL_WALL_DEFS.map(getWallCollider)
];
const isInsideObstacle = (x: number, z: number, r = 0.8): boolean =>
  STATIC_OBSTACLE_AABBS.some((box) => {
    const cx = Math.max(box.minX, Math.min(x, box.maxX));
    const cz = Math.max(box.minZ, Math.min(z, box.maxZ));
    return Math.hypot(x - cx, z - cz) < r;
  });

export const INITIAL_DUMMY_SPAWNS: [number, number, number][] = Array.from({ length: INITIAL_DUMMY_COUNT }, () =>
  generateDummySpawnPosition()
);
export const INITIAL_FLAG_DEFS: BattleFlagDef[] = Array.from({ length: INITIAL_FLAG_COUNT }, (_, i) => generateFlagDef(`flag-${i}`));
export const INITIAL_MEDKIT_DEFS: MedkitDef[] = Array.from({ length: INITIAL_MEDKIT_COUNT }, (_, i) => generateMedkitDef(`medkit-${i}`));
export const INITIAL_FOOTBALL_SPAWNS: FootballSpawn[] = Array.from({ length: INITIAL_FOOTBALL_COUNT }, (_, i) => generateFootballSpawn(`football-${i}`));
export const INITIAL_BASIC_ENEMY_SPAWNS: { type: EnemyType; position: [number, number, number] }[] = (() => {
  let rareCount = 0;
  return Array.from({ length: INITIAL_BASIC_ENEMY_COUNT }, () => {
    const spawn = generateBasicEnemySpawn(1, rareCount);
    if (!COMMON_BASIC_ENEMY_TYPES.includes(spawn.type)) rareCount += 1;
    return spawn;
  });
})();

// Walls are permanent (never destroyed/respawned), so their colliders are
// computed once and reused everywhere.
export const WALL_COLLIDERS: AABB[] = INITIAL_WALL_DEFS.map(getWallCollider);
