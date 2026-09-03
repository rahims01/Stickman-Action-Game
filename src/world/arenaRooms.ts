import { EnemyType } from './enemyConfig';
import { MaterialKey } from './proceduralTextures';

/**
 * Arena rooms.
 *
 * The arena used to run a fixed four-room sequence — concrete, brick cage,
 * sand, magma — every single run, which is why it went stale so fast. Rooms
 * are now drawn at random from the tier you've reached, so two runs diverge
 * after the tutorial and the later tiers stay unseen for a long time.
 *
 * The two opening rooms are deliberately still fixed: a tutorial that teaches
 * the mode shouldn't be a lottery. Everything after them is drawn.
 */

export type RoomTier = 1 | 2 | 3 | 4 | 5;

export type RoomShape = 'rect' | 'circle' | 'pentagon';

export interface ArenaRoom {
  id: string;
  label: string;
  tier: RoomTier;
  material: MaterialKey;
  shape: RoomShape;
  /** Ground, wall, sky and fog colours. */
  ground: string;
  wall: string;
  sky: string;
  fog: string;
  /** Ambient + directional light tint and strength for the room's mood. */
  lightColor: string;
  lightIntensity: number;
  ambientIntensity: number;
  /** Fog near/far. Tight values are what make the scary rooms scary. */
  fogNear: number;
  fogFar: number;
  /** Native roster — drawn from heavily when this room spawns waves. */
  natives: EnemyType[];
  /** Flavour line shown on the room card. */
  blurb: string;
  /** Rooms where the only meaningful light is what the player brings. */
  darkness?: boolean;
  /** Rooms that spawn illusory duplicates alongside the real thing. */
  mirages?: boolean;
}

// Shared rosters, so a room lists what's DISTINCTIVE about it rather than
// repeating the common pool every time.
const BRAWLERS: EnemyType[] = ['runningMan', 'punchMan', 'kickMan', 'greyMan'];
const HARD: EnemyType[] = ['juggernaut', 'armourMan', 'resilientMan', 'rageMan'];

export const ARENA_ROOMS: ArenaRoom[] = [
  // ── Tier 1: the outdoors ────────────────────────────────────────────────
  { id: 'sand', label: 'The Sand Pit', tier: 1, material: 'sand', shape: 'circle',
    ground: '#d9c08a', wall: '#a8905f', sky: '#e6d3a8', fog: '#e6d3a8',
    lightColor: '#fff0cc', lightIntensity: 1.5, ambientIntensity: 0.75, fogNear: 30, fogFar: 110,
    natives: ['sandyMan', 'sandWarrior', 'sandThrower', 'sandJuggernaut'],
    blurb: 'Open, bright, and full of things made of sand.' },

  { id: 'rock', label: 'The Rock Quarry', tier: 1, material: 'rock', shape: 'rect',
    ground: '#6f7276', wall: '#4c4f52', sky: '#9aa3ab', fog: '#9aa3ab',
    lightColor: '#ffffff', lightIntensity: 1.3, ambientIntensity: 0.65, fogNear: 28, fogFar: 95,
    natives: ['rockMan', 'rockBrute', ...BRAWLERS],
    blurb: 'Grey, hard, and it hits back.' },

  { id: 'grass', label: 'The Meadow', tier: 1, material: 'grass', shape: 'circle',
    ground: '#3f7a35', wall: '#2f5f28', sky: '#b8dcf0', fog: '#c8e4f4',
    lightColor: '#ffffff', lightIntensity: 1.6, ambientIntensity: 0.8, fogNear: 40, fogFar: 130,
    natives: ['grassMan', ...BRAWLERS, 'coward'],
    blurb: 'Pleasant. Briefly.' },

  { id: 'dirt', label: 'The Dust Bowl', tier: 1, material: 'dirt', shape: 'rect',
    ground: '#6b4f34', wall: '#4d3a26', sky: '#c2ac8e', fog: '#c2ac8e',
    lightColor: '#fff0dd', lightIntensity: 1.35, ambientIntensity: 0.7, fogNear: 26, fogFar: 90,
    natives: ['dirtMan', ...BRAWLERS, 'bombMan'],
    blurb: 'Everything here is filthy, including the enemies.' },

  { id: 'water', label: 'The Shallows', tier: 1, material: 'water', shape: 'circle',
    ground: '#2a6f9e', wall: '#1e5c86', sky: '#a8d4ec', fog: '#b6ddf0',
    lightColor: '#ddf2ff', lightIntensity: 1.4, ambientIntensity: 0.8, fogNear: 32, fogFar: 105,
    natives: ['waterMan', 'slowCube', ...BRAWLERS],
    blurb: 'Ankle-deep and slippery underfoot.' },

  { id: 'snow', label: 'The Drift', tier: 1, material: 'snow', shape: 'circle',
    ground: '#eef4f8', wall: '#c9d8e2', sky: '#dbe9f2', fog: '#e8f2f8',
    lightColor: '#eaf4ff', lightIntensity: 1.5, ambientIntensity: 0.85, fogNear: 20, fogFar: 70,
    natives: ['snowMan', 'iceMan', 'slowCube'],
    blurb: 'Cold enough that the fog does half the work.' },

  { id: 'badlands', label: 'The Badlands', tier: 1, material: 'badlands', shape: 'pentagon',
    ground: '#a5603c', wall: '#7d4227', sky: '#d8a678', fog: '#d8a678',
    lightColor: '#ffdcb0', lightIntensity: 1.4, ambientIntensity: 0.7, fogNear: 26, fogFar: 88,
    natives: ['badlandsMan', 'sandThrower', 'sniperMan'],
    blurb: 'Layered rock, long sightlines, and snipers.' },

  { id: 'garden', label: 'The Garden', tier: 1, material: 'garden', shape: 'circle',
    ground: '#4b8a3c', wall: '#37672c', sky: '#cfe9f7', fog: '#d8eef8',
    lightColor: '#fff8e0', lightIntensity: 1.6, ambientIntensity: 0.85, fogNear: 40, fogFar: 130,
    natives: ['gardenMan', 'grassMan', 'medicMan', 'civilianDecoy'],
    blurb: 'Somebody clearly cared about this place once.' },

  // ── Tier 2: underground and burning ─────────────────────────────────────
  { id: 'magma', label: 'The Magma Floor', tier: 2, material: 'magma', shape: 'pentagon',
    ground: '#4a1a10', wall: '#2b120c', sky: '#3a1208', fog: '#5c1d0c',
    lightColor: '#ff7043', lightIntensity: 1.5, ambientIntensity: 0.6, fogNear: 18, fogFar: 70,
    natives: ['lavaMinion', 'lavaThrower', 'lavaJuggernaut', 'magmaMan', 'lavaBaby'],
    blurb: 'The floor is, in several places, actually lava.' },

  { id: 'cave', label: 'The Deep Cave', tier: 2, material: 'cave', shape: 'circle',
    ground: '#3b3a38', wall: '#26251f', sky: '#141414', fog: '#1a1a1a',
    lightColor: '#9fb4c4', lightIntensity: 0.55, ambientIntensity: 0.28, fogNear: 8, fogFar: 34,
    natives: ['caveMan', 'rockMan', 'cloakedAssassin'],
    blurb: 'You can hear more than you can see.' },

  { id: 'darkConcrete', label: 'The Long Corridor', tier: 2, material: 'darkConcrete', shape: 'rect',
    ground: '#38393b', wall: '#232426', sky: '#0e0f10', fog: '#131415',
    lightColor: '#b0c4d8', lightIntensity: 0.5, ambientIntensity: 0.25, fogNear: 10, fogFar: 40,
    natives: ['concreteMan', 'cloakedAssassin', 'phaseMan'],
    blurb: 'The beginner room, grown up and gone wrong.' },

  { id: 'volcano', label: 'The Caldera', tier: 2, material: 'volcano', shape: 'pentagon',
    ground: '#2e1a15', wall: '#1d100c', sky: '#48180c', fog: '#5e2010',
    lightColor: '#ff5722', lightIntensity: 1.3, ambientIntensity: 0.5, fogNear: 14, fogFar: 58,
    natives: ['magmaMan', 'lavaGiant', 'lavaSmashBall', 'charredBrickMan'],
    blurb: 'Uphill, downwind, and on fire.' },

  { id: 'burntHouse', label: 'The Burnt House', tier: 2, material: 'burntHouse', shape: 'rect',
    ground: '#3a2f28', wall: '#241d18', sky: '#2a211c', fog: '#332a24',
    lightColor: '#ffb27a', lightIntensity: 0.7, ambientIntensity: 0.35, fogNear: 10, fogFar: 42,
    natives: ['charredBrickMan', 'burntMan', 'brickMan'],
    blurb: 'Something happened here and the walls remember it.' },

  { id: 'amethyst', label: 'The Amethyst Vault', tier: 2, material: 'amethyst', shape: 'circle',
    ground: '#4a2a6b', wall: '#331d4b', sky: '#241535', fog: '#2e1a44',
    lightColor: '#c79cf0', lightIntensity: 0.95, ambientIntensity: 0.5, fogNear: 16, fogFar: 62,
    natives: ['amethystMan', 'purpleMan', 'phaseMan'],
    blurb: 'Beautiful. Sharp. Not friendly.' },

  { id: 'iron', label: 'The Iron Works', tier: 2, material: 'iron', shape: 'rect',
    ground: '#6a6d71', wall: '#4a4d51', sky: '#7d848a', fog: '#7d848a',
    lightColor: '#e8f0f6', lightIntensity: 1.15, ambientIntensity: 0.55, fogNear: 20, fogFar: 72,
    natives: ['ironMan', 'armourMan', 'reflectorMan', 'magnetMan'],
    blurb: 'Everything is heavy and everything is magnetic.' },

  { id: 'copper', label: 'The Copper Mine', tier: 2, material: 'copper', shape: 'circle',
    ground: '#a9603a', wall: '#7d4429', sky: '#6d4530', fog: '#7d4f37',
    lightColor: '#ffd0a8', lightIntensity: 1.0, ambientIntensity: 0.5, fogNear: 16, fogFar: 60,
    natives: ['copperMan', 'shockerCube', 'engineerMan'],
    blurb: 'Conductive, which the Shocker Cubes appreciate.' },

  // ── Tier 3: precious and strange ────────────────────────────────────────
  { id: 'gold', label: 'The Gold Hall', tier: 3, material: 'gold', shape: 'rect',
    ground: '#c9a227', wall: '#8f6f18', sky: '#e8cf72', fog: '#e8cf72',
    lightColor: '#fff3c4', lightIntensity: 1.6, ambientIntensity: 0.8, fogNear: 26, fogFar: 92,
    natives: ['goldMan', 'yellowMan', 'bountyHunter'],
    blurb: 'Wealth, guarded by things made of it.' },

  { id: 'rainbow', label: 'The Prism', tier: 3, material: 'rainbow', shape: 'circle',
    ground: '#3a2f4a', wall: '#2a2136', sky: '#4d3f66', fog: '#5c4d78',
    lightColor: '#ffffff', lightIntensity: 1.5, ambientIntensity: 0.8, fogNear: 22, fogFar: 84,
    natives: ['rainbowMan', 'pinkMan', 'greenMan', 'yellowMan', 'purpleMan'],
    blurb: 'Every colour of enemy, all at once.' },

  { id: 'blue', label: 'The Cobalt Deep', tier: 3, material: 'blue', shape: 'circle',
    ground: '#1f3f8a', wall: '#16305f', sky: '#2c56b8', fog: '#26478f',
    lightColor: '#a8c8ff', lightIntensity: 1.1, ambientIntensity: 0.6, fogNear: 18, fogFar: 68,
    natives: ['blueMan', 'waterMan', 'slowCube', 'stormMan'],
    blurb: 'Cold light and colder company.' },

  { id: 'blood', label: 'The Blood Room', tier: 3, material: 'blood', shape: 'rect',
    ground: '#5a1216', wall: '#3d0c0f', sky: '#2c0709', fog: '#420d11',
    lightColor: '#ff6b6b', lightIntensity: 0.8, ambientIntensity: 0.38, fogNear: 12, fogFar: 46,
    natives: ['bloodMan', 'vampireMan', 'rageMan'],
    blurb: 'The vampires feel at home. You will not.' },

  { id: 'darkOcean', label: 'The Dark Ocean', tier: 3, material: 'darkOcean', shape: 'circle',
    ground: '#0b2434', wall: '#071823', sky: '#030d13', fog: '#061620',
    lightColor: '#5a9ec4', lightIntensity: 0.45, ambientIntensity: 0.22, fogNear: 6, fogFar: 28,
    natives: ['abyssMan', 'waterMan', 'invisibleMan', 'slowCube'],
    blurb: 'The Shallows, drowned. You cannot see what is coming.' },

  { id: 'night', label: 'The Long Night', tier: 3, material: 'night', shape: 'rect',
    ground: '#141a2e', wall: '#0d1120', sky: '#080b16', fog: '#0d1220',
    lightColor: '#9fb4ff', lightIntensity: 0.5, ambientIntensity: 0.25, fogNear: 10, fogFar: 44,
    natives: ['nightMan', 'cloakedAssassin', 'invisibleMan', 'blackMan'],
    blurb: 'Permanent night, and everything here likes it that way.' },

  { id: 'galaxy', label: 'The Galaxy', tier: 3, material: 'galaxy', shape: 'pentagon',
    ground: '#120d24', wall: '#1e1440', sky: '#07050f', fog: '#0e0a1c',
    lightColor: '#c9a8ff', lightIntensity: 0.85, ambientIntensity: 0.45, fogNear: 16, fogFar: 66,
    natives: ['galaxyMan', 'purpleMan', 'glowingGreenMan', 'stormMan'],
    blurb: 'You are no longer sure this is a room.' },

  // ── Tier 4: hard and rare ───────────────────────────────────────────────
  { id: 'diamond', label: 'The Diamond Core', tier: 4, material: 'diamond', shape: 'pentagon',
    ground: '#cfe9f2', wall: '#a4ccd9', sky: '#e8f8fd', fog: '#dcf1f8',
    lightColor: '#ffffff', lightIntensity: 1.8, ambientIntensity: 0.9, fogNear: 28, fogFar: 100,
    natives: ['diamondMan', 'superResilientMan', 'juggernaut'],
    blurb: 'The hardest room, in every sense.' },

  { id: 'assassin', label: 'Assassin Country', tier: 4, material: 'assassin', shape: 'rect',
    ground: '#1e2427', wall: '#141a1c', sky: '#0c1012', fog: '#111618',
    lightColor: '#8fa8b8', lightIntensity: 0.5, ambientIntensity: 0.24, fogNear: 8, fogFar: 34,
    natives: ['cloakedAssassin', 'shadowAssassin', 'phaseMan', 'invisibleMan'],
    blurb: 'They were already behind you when you read this.' },

  { id: 'pitchBrawl', label: 'The Great Pitch', tier: 4, material: 'pitch', shape: 'rect',
    ground: '#2f6b3a', wall: '#1f4a27', sky: '#bcd9ea', fog: '#c8e2ef',
    lightColor: '#ffffff', lightIntensity: 1.6, ambientIntensity: 0.85, fogNear: 40, fogFar: 130,
    natives: ['strikerMan', 'strikerCaptain', 'smashBall', 'splitBall'],
    blurb: 'The crossover, at scale. Everything here can bend a shot.' },

  { id: 'platinum', label: 'The Platinum Vault', tier: 4, material: 'platinum', shape: 'circle',
    ground: '#c3c9cd', wall: '#9aa1a6', sky: '#dfe6ea', fog: '#dfe6ea',
    lightColor: '#ffffff', lightIntensity: 1.7, ambientIntensity: 0.85, fogNear: 26, fogFar: 94,
    natives: ['platinumMan', 'reflectorMan', 'armourMan', ...HARD],
    blurb: 'Harder than iron and it knows it.' },

  { id: 'glass', label: 'The Glass House', tier: 4, material: 'glass', shape: 'rect',
    ground: '#bcd7de', wall: '#9dc0ca', sky: '#dff0f5', fog: '#e6f4f8',
    lightColor: '#ffffff', lightIntensity: 1.7, ambientIntensity: 0.9, fogNear: 30, fogFar: 105,
    natives: ['glassMan', 'splitMan', 'reflectorMan'],
    blurb: 'Everything shatters. Including, eventually, you.' },

  { id: 'clear', label: 'Clear Country', tier: 4, material: 'clear', shape: 'circle',
    ground: '#d8ecf2', wall: '#b6d8e2', sky: '#eaf7fa', fog: '#eaf7fa',
    lightColor: '#ffffff', lightIntensity: 1.6, ambientIntensity: 0.9, fogNear: 26, fogFar: 96,
    natives: ['invisibleMan', 'clearMan', 'phaseMan'],
    blurb: 'A whole room of the rare translucent variant. Good luck aiming.' },

  { id: 'illusion', label: 'The Illusion', tier: 4, material: 'illusion', shape: 'pentagon',
    ground: '#5a4a7a', wall: '#3f3357', sky: '#2e2542', fog: '#3a2f52',
    lightColor: '#c9b0ff', lightIntensity: 0.9, ambientIntensity: 0.48, fogNear: 14, fogFar: 56,
    natives: ['mirageMan', 'copycatMan', 'phaseMan', 'splitMan'],
    mirages: true,
    blurb: 'Half of what you are fighting is not there.' },

  // ── Tier 5: the end ─────────────────────────────────────────────────────
  { id: 'nightmare', label: 'The Nightmare', tier: 5, material: 'nightmare', shape: 'pentagon',
    ground: '#160f18', wall: '#0d090e', sky: '#050307', fog: '#0b070c',
    lightColor: '#ff2d55', lightIntensity: 0.55, ambientIntensity: 0.2, fogNear: 7, fogFar: 30,
    natives: ['nightmareMan', 'shadowAssassin', 'glowingGreenMan', 'superResilientMan'],
    blurb: 'A room you have already been in, wearing a different face.' },

  { id: 'pitchBlack', label: 'Pitch Black', tier: 5, material: 'pitchBlack', shape: 'circle',
    ground: '#08080a', wall: '#050506', sky: '#000000', fog: '#000000',
    lightColor: '#404040', lightIntensity: 0.08, ambientIntensity: 0.04, fogNear: 3, fogFar: 13,
    natives: ['nightMan', 'shadowAssassin', 'invisibleMan', 'blackMan'],
    darkness: true,
    blurb: 'Your flashlight and your light blocks are the only light there is.' },

  { id: 'bone', label: 'The Ossuary', tier: 5, material: 'bone', shape: 'rect',
    ground: '#ddd4bd', wall: '#b3a98e', sky: '#8f8877', fog: '#9c9581',
    lightColor: '#fff4d8', lightIntensity: 0.75, ambientIntensity: 0.4, fogNear: 12, fogFar: 48,
    natives: ['boneMan', 'nightmareMan', 'vampireMan'],
    blurb: 'Everyone who came before you is still here.' },

  { id: 'rust', label: 'The Rust Belt', tier: 5, material: 'rust', shape: 'rect',
    ground: '#8a4a28', wall: '#5c2f18', sky: '#6b3a20', fog: '#7a4526',
    lightColor: '#ffb27a', lightIntensity: 0.8, ambientIntensity: 0.42, fogNear: 12, fogFar: 50,
    natives: ['rustMan', 'ironMan', 'juggernaut', 'trapperMan'],
    blurb: 'The Iron Works, a few centuries later.' }
];

export const roomsForTier = (tier: RoomTier): ArenaRoom[] => ARENA_ROOMS.filter((r) => r.tier === tier);

export const roomById = (id: string): ArenaRoom | undefined => ARENA_ROOMS.find((r) => r.id === id);

/**
 * How many waves are cleared in each tier before the next unlocks. The
 * tutorial rooms occupy waves 1-4, so tier 1 proper starts at wave 5.
 */
export const TUTORIAL_WAVES = 4;
export const WAVES_PER_ROOM = 3;
export const ROOMS_PER_TIER = 3;

/** Which tier a given wave belongs to, and how far into it. */
export const tierForWave = (wave: number): RoomTier => {
  if (wave <= TUTORIAL_WAVES) return 1;
  const past = wave - TUTORIAL_WAVES - 1;
  const tier = 1 + Math.floor(past / (WAVES_PER_ROOM * ROOMS_PER_TIER));
  return Math.min(5, Math.max(1, tier)) as RoomTier;
};

/** True on the waves where the room should change. */
export const isRoomChangeWave = (wave: number): boolean =>
  wave > TUTORIAL_WAVES && (wave - TUTORIAL_WAVES - 1) % WAVES_PER_ROOM === 0;

/**
 * Picks the next room, avoiding an immediate repeat. The Nightmare is
 * special-cased by the caller: it wears a previous room's material.
 */
export const pickRoom = (tier: RoomTier, avoidId?: string): ArenaRoom => {
  const pool = roomsForTier(tier).filter((r) => r.id !== avoidId);
  const from = pool.length > 0 ? pool : roomsForTier(tier);
  return from[Math.floor(Math.random() * from.length)];
};
