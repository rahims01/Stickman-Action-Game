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
  /** This room's own invented family — a Man, a Bulwark and a Slinger, all
   *  wearing the room's material. ADDED to the common pool, never a
   *  replacement for it. */
  natives: EnemyType[];
  /** The one special that fields only here. Every room has exactly one. */
  special: EnemyType;
  /** The handful of common-pool enemies that would look absurd in this room —
   *  fire things in the snow, water things in the magma. About five per room;
   *  everything else in the pool still turns up. */
  excludes: EnemyType[];
  /** Arena enemies that existed before the room system and belong to this
   *  room specifically. They are kept off the common pool — a Lava Minion has
   *  no business in the snow — so without this list they would exist as types
   *  and spawn nowhere. */
  legacy?: EnemyType[];
  /** Flavour line shown on the room card. */
  blurb: string;
  /** Rooms where the only meaningful light is what the player brings. */
  darkness?: boolean;
  /** Rooms that spawn illusory duplicates alongside the real thing. */
  mirages?: boolean;
}

// The common pool spawns in EVERY room. A room subtracts about five that
// would look absurd there and adds its own natives and special on top, so
// the roster stays broad while still reading as native to the place.
export const ROOM_COMMON_POOL: EnemyType[] = [
  'runningMan', 'punchMan', 'kickMan', 'greyMan', 'weakFighter',
  'concreteMan', 'woodMan', 'brickMan', 'sandyMan', 'charredBrickMan',
  'babyMan', 'tallMan', 'fatMan', 'skinnyMan', 'giantMan',
  'medicMan', 'rageMan', 'shieldBearer', 'copycatMan', 'vampireMan',
  'phaseMan', 'splitMan', 'armourMan', 'cloakedAssassin', 'engineerMan',
  'sniperMan', 'bombMan', 'coward', 'slimeBlock', 'juggernaut',
  'resilientMan', 'shockerCube', 'slowCube', 'smashBall', 'adaptiveMan',
  'magnetMan', 'reflectorMan', 'repulsorMan', 'minionMan', 'ragdollThrower',
  'strongPunchMan', 'strongKickMan', 'strongRangedMan', 'comboMan', 'strongComboMan',
  'brainMan', 'superResilientMan', 'ragdollSmashBall', 'slowBall', 'splitBall',
  'giantSlime', 'colossalSlime', 'slimeKing',
  'lavaMan', 'waterMan', 'invisibleMan', 'fireMan', 'weaponMan',
  'purpleMan', 'pinkMan', 'greenMan', 'yellowMan', 'blackMan',
  'tomatoMan', 'snowMan', 'glowingGreenMan', 'magmaMan', 'stormMan'
];

export const ARENA_ROOMS: ArenaRoom[] = [
  // ── Tier 1: the outdoors ────────────────────────────────────────────────
  { id: 'sand', label: 'The Sand Pit', tier: 1, material: 'sand', shape: 'circle',
    ground: '#d9c08a', wall: '#a8905f', sky: '#e6d3a8', fog: '#e6d3a8',
    lightColor: '#fff0cc', lightIntensity: 1.5, ambientIntensity: 0.75, fogNear: 30, fogFar: 110,
    natives: ['sandNative', 'sandBulwark', 'sandSlinger'], special: 'sandPrime', excludes: ['snowMan', 'lavaMan', 'waterMan', 'slowCube', 'stormMan'], legacy: ['sandWarrior', 'sandJuggernaut', 'sandGiant', 'sandThrower'],
    blurb: 'Open, bright, and full of things made of sand.' },

  { id: 'rock', label: 'The Rock Quarry', tier: 1, material: 'rock', shape: 'rect',
    ground: '#6f7276', wall: '#4c4f52', sky: '#9aa3ab', fog: '#9aa3ab',
    lightColor: '#ffffff', lightIntensity: 1.3, ambientIntensity: 0.65, fogNear: 28, fogFar: 95,
    natives: ['rockNative', 'rockBulwark', 'rockSlinger'], special: 'rockPrime', excludes: ['waterMan', 'snowMan', 'invisibleMan', 'glowingGreenMan', 'stormMan'],
    blurb: 'Grey, hard, and it hits back.' },

  { id: 'grass', label: 'The Meadow', tier: 1, material: 'grass', shape: 'circle',
    ground: '#3f7a35', wall: '#2f5f28', sky: '#b8dcf0', fog: '#c8e4f4',
    lightColor: '#ffffff', lightIntensity: 1.6, ambientIntensity: 0.8, fogNear: 40, fogFar: 130,
    natives: ['grassNative', 'grassBulwark', 'grassSlinger'], special: 'grassPrime', excludes: ['lavaMan', 'magmaMan', 'charredBrickMan', 'blackMan', 'snowMan'],
    blurb: 'Pleasant. Briefly.' },

  { id: 'dirt', label: 'The Dust Bowl', tier: 1, material: 'dirt', shape: 'rect',
    ground: '#6b4f34', wall: '#4d3a26', sky: '#c2ac8e', fog: '#c2ac8e',
    lightColor: '#fff0dd', lightIntensity: 1.35, ambientIntensity: 0.7, fogNear: 26, fogFar: 90,
    natives: ['dirtNative', 'dirtBulwark', 'dirtSlinger'], special: 'dirtPrime', excludes: ['snowMan', 'waterMan', 'glowingGreenMan', 'invisibleMan', 'lavaMan'],
    blurb: 'Everything here is filthy, including the enemies.' },

  { id: 'water', label: 'The Shallows', tier: 1, material: 'water', shape: 'circle',
    ground: '#2a6f9e', wall: '#1e5c86', sky: '#a8d4ec', fog: '#b6ddf0',
    lightColor: '#ddf2ff', lightIntensity: 1.4, ambientIntensity: 0.8, fogNear: 32, fogFar: 105,
    natives: ['waterNative', 'waterBulwark', 'waterSlinger'], special: 'waterPrime', excludes: ['lavaMan', 'fireMan', 'magmaMan', 'charredBrickMan', 'sandyMan'],
    blurb: 'Ankle-deep and slippery underfoot.' },

  { id: 'snow', label: 'The Drift', tier: 1, material: 'snow', shape: 'circle',
    ground: '#eef4f8', wall: '#c9d8e2', sky: '#dbe9f2', fog: '#e8f2f8',
    lightColor: '#eaf4ff', lightIntensity: 1.5, ambientIntensity: 0.85, fogNear: 20, fogFar: 70,
    natives: ['snowNative', 'snowBulwark', 'snowSlinger'], special: 'snowPrime', excludes: ['lavaMan', 'fireMan', 'magmaMan', 'charredBrickMan', 'tomatoMan'],
    blurb: 'Cold enough that the fog does half the work.' },

  { id: 'badlands', label: 'The Badlands', tier: 1, material: 'badlands', shape: 'pentagon',
    ground: '#a5603c', wall: '#7d4227', sky: '#d8a678', fog: '#d8a678',
    lightColor: '#ffdcb0', lightIntensity: 1.4, ambientIntensity: 0.7, fogNear: 26, fogFar: 88,
    natives: ['badlandsNative', 'badlandsBulwark', 'badlandsSlinger'], special: 'badlandsPrime', excludes: ['waterMan', 'snowMan', 'slowCube', 'invisibleMan', 'glowingGreenMan'],
    blurb: 'Layered rock, long sightlines, and snipers.' },

  { id: 'garden', label: 'The Garden', tier: 1, material: 'garden', shape: 'circle',
    ground: '#4b8a3c', wall: '#37672c', sky: '#cfe9f7', fog: '#d8eef8',
    lightColor: '#fff8e0', lightIntensity: 1.6, ambientIntensity: 0.85, fogNear: 40, fogFar: 130,
    natives: ['gardenNative', 'gardenBulwark', 'gardenSlinger'], special: 'gardenPrime', excludes: ['lavaMan', 'magmaMan', 'charredBrickMan', 'blackMan', 'juggernaut'],
    blurb: 'Somebody clearly cared about this place once.' },

  // ── Tier 2: underground and burning ─────────────────────────────────────
  { id: 'magma', label: 'The Magma Floor', tier: 2, material: 'magma', shape: 'pentagon',
    ground: '#4a1a10', wall: '#2b120c', sky: '#3a1208', fog: '#5c1d0c',
    lightColor: '#ff7043', lightIntensity: 1.5, ambientIntensity: 0.6, fogNear: 18, fogFar: 70,
    natives: ['magmaNative', 'magmaBulwark', 'magmaSlinger'], special: 'magmaPrime', excludes: ['snowMan', 'waterMan', 'slowCube', 'sandyMan', 'medicMan'], legacy: ['lavaMinion', 'lavaThrower', 'lavaJuggernaut', 'lavaBaby', 'lavaSplitCube'],
    blurb: 'The floor is, in several places, actually lava.' },

  { id: 'cave', label: 'The Deep Cave', tier: 2, material: 'cave', shape: 'circle',
    ground: '#3b3a38', wall: '#26251f', sky: '#141414', fog: '#1a1a1a',
    lightColor: '#9fb4c4', lightIntensity: 0.55, ambientIntensity: 0.28, fogNear: 8, fogFar: 34,
    natives: ['caveNative', 'caveBulwark', 'caveSlinger'], special: 'cavePrime', excludes: ['yellowMan', 'pinkMan', 'tomatoMan', 'snowMan', 'sandyMan'],
    blurb: 'You can hear more than you can see.' },

  { id: 'darkConcrete', label: 'The Long Corridor', tier: 2, material: 'darkConcrete', shape: 'rect',
    ground: '#38393b', wall: '#232426', sky: '#0e0f10', fog: '#131415',
    lightColor: '#b0c4d8', lightIntensity: 0.5, ambientIntensity: 0.25, fogNear: 10, fogFar: 40,
    natives: ['darkConcreteNative', 'darkConcreteBulwark', 'darkConcreteSlinger'], special: 'darkConcretePrime', excludes: ['sandyMan', 'snowMan', 'waterMan', 'lavaMan', 'tomatoMan'],
    blurb: 'The beginner room, grown up and gone wrong.' },

  { id: 'volcano', label: 'The Caldera', tier: 2, material: 'volcano', shape: 'pentagon',
    ground: '#2e1a15', wall: '#1d100c', sky: '#48180c', fog: '#5e2010',
    lightColor: '#ff5722', lightIntensity: 1.3, ambientIntensity: 0.5, fogNear: 14, fogFar: 58,
    natives: ['volcanoNative', 'volcanoBulwark', 'volcanoSlinger'], special: 'volcanoPrime', excludes: ['snowMan', 'waterMan', 'slowCube', 'medicMan', 'coward'], legacy: ['lavaGiant', 'lavaSmashBall', 'lavaBaby'],
    blurb: 'Uphill, downwind, and on fire.' },

  { id: 'burntHouse', label: 'The Burnt House', tier: 2, material: 'burntHouse', shape: 'rect',
    ground: '#3a2f28', wall: '#241d18', sky: '#2a211c', fog: '#332a24',
    lightColor: '#ffb27a', lightIntensity: 0.7, ambientIntensity: 0.35, fogNear: 10, fogFar: 42,
    natives: ['burntHouseNative', 'burntHouseBulwark', 'burntHouseSlinger'], special: 'burntHousePrime', excludes: ['waterMan', 'snowMan', 'slowCube', 'sandyMan', 'medicMan'],
    blurb: 'Something happened here and the walls remember it.' },

  { id: 'amethyst', label: 'The Amethyst Vault', tier: 2, material: 'amethyst', shape: 'circle',
    ground: '#4a2a6b', wall: '#331d4b', sky: '#241535', fog: '#2e1a44',
    lightColor: '#c79cf0', lightIntensity: 0.95, ambientIntensity: 0.5, fogNear: 16, fogFar: 62,
    natives: ['amethystNative', 'amethystBulwark', 'amethystSlinger'], special: 'amethystPrime', excludes: ['sandyMan', 'woodMan', 'lavaMan', 'tomatoMan', 'coward'],
    blurb: 'Beautiful. Sharp. Not friendly.' },

  { id: 'iron', label: 'The Iron Works', tier: 2, material: 'iron', shape: 'rect',
    ground: '#6a6d71', wall: '#4a4d51', sky: '#7d848a', fog: '#7d848a',
    lightColor: '#e8f0f6', lightIntensity: 1.15, ambientIntensity: 0.55, fogNear: 20, fogFar: 72,
    natives: ['ironNative', 'ironBulwark', 'ironSlinger'], special: 'ironPrime', excludes: ['sandyMan', 'woodMan', 'snowMan', 'tomatoMan', 'coward'],
    blurb: 'Everything is heavy and everything is magnetic.' },

  { id: 'copper', label: 'The Copper Mine', tier: 2, material: 'copper', shape: 'circle',
    ground: '#a9603a', wall: '#7d4429', sky: '#6d4530', fog: '#7d4f37',
    lightColor: '#ffd0a8', lightIntensity: 1.0, ambientIntensity: 0.5, fogNear: 16, fogFar: 60,
    natives: ['copperNative', 'copperBulwark', 'copperSlinger'], special: 'copperPrime', excludes: ['sandyMan', 'woodMan', 'snowMan', 'waterMan', 'coward'],
    blurb: 'Conductive, which the Shocker Cubes appreciate.' },

  // ── Tier 3: precious and strange ────────────────────────────────────────
  { id: 'gold', label: 'The Gold Hall', tier: 3, material: 'gold', shape: 'rect',
    ground: '#c9a227', wall: '#8f6f18', sky: '#e8cf72', fog: '#e8cf72',
    lightColor: '#fff3c4', lightIntensity: 1.6, ambientIntensity: 0.8, fogNear: 26, fogFar: 92,
    natives: ['goldNative', 'goldBulwark', 'goldSlinger'], special: 'goldPrime', excludes: ['sandyMan', 'woodMan', 'snowMan', 'slimeBlock', 'coward'],
    blurb: 'Wealth, guarded by things made of it.' },

  { id: 'rainbow', label: 'The Prism', tier: 3, material: 'rainbow', shape: 'circle',
    ground: '#3a2f4a', wall: '#2a2136', sky: '#4d3f66', fog: '#5c4d78',
    lightColor: '#ffffff', lightIntensity: 1.5, ambientIntensity: 0.8, fogNear: 22, fogFar: 84,
    natives: ['rainbowNative', 'rainbowBulwark', 'rainbowSlinger'], special: 'rainbowPrime', excludes: ['blackMan', 'concreteMan', 'woodMan', 'sandyMan', 'brickMan'],
    blurb: 'Every colour of enemy, all at once.' },

  { id: 'blue', label: 'The Cobalt Deep', tier: 3, material: 'blue', shape: 'circle',
    ground: '#1f3f8a', wall: '#16305f', sky: '#2c56b8', fog: '#26478f',
    lightColor: '#a8c8ff', lightIntensity: 1.1, ambientIntensity: 0.6, fogNear: 18, fogFar: 68,
    natives: ['blueNative', 'blueBulwark', 'blueSlinger'], special: 'bluePrime', excludes: ['lavaMan', 'fireMan', 'magmaMan', 'sandyMan', 'charredBrickMan'],
    blurb: 'Cold light and colder company.' },

  { id: 'blood', label: 'The Blood Room', tier: 3, material: 'blood', shape: 'rect',
    ground: '#5a1216', wall: '#3d0c0f', sky: '#2c0709', fog: '#420d11',
    lightColor: '#ff6b6b', lightIntensity: 0.8, ambientIntensity: 0.38, fogNear: 12, fogFar: 46,
    natives: ['bloodNative', 'bloodBulwark', 'bloodSlinger'], special: 'bloodPrime', excludes: ['snowMan', 'waterMan', 'medicMan', 'coward', 'slowCube'],
    blurb: 'The vampires feel at home. You will not.' },

  { id: 'darkOcean', label: 'The Dark Ocean', tier: 3, material: 'darkOcean', shape: 'circle',
    ground: '#0b2434', wall: '#071823', sky: '#030d13', fog: '#061620',
    lightColor: '#5a9ec4', lightIntensity: 0.45, ambientIntensity: 0.22, fogNear: 6, fogFar: 28,
    natives: ['darkOceanNative', 'darkOceanBulwark', 'darkOceanSlinger'], special: 'darkOceanPrime', excludes: ['lavaMan', 'fireMan', 'magmaMan', 'sandyMan', 'yellowMan'],
    blurb: 'The Shallows, drowned. You cannot see what is coming.' },

  { id: 'night', label: 'The Long Night', tier: 3, material: 'night', shape: 'rect',
    ground: '#141a2e', wall: '#0d1120', sky: '#080b16', fog: '#0d1220',
    lightColor: '#9fb4ff', lightIntensity: 0.5, ambientIntensity: 0.25, fogNear: 10, fogFar: 44,
    natives: ['nightNative', 'nightBulwark', 'nightSlinger'], special: 'nightPrime', excludes: ['yellowMan', 'pinkMan', 'tomatoMan', 'sandyMan', 'medicMan'],
    blurb: 'Permanent night, and everything here likes it that way.' },

  { id: 'galaxy', label: 'The Galaxy', tier: 3, material: 'galaxy', shape: 'pentagon',
    ground: '#120d24', wall: '#1e1440', sky: '#07050f', fog: '#0e0a1c',
    lightColor: '#c9a8ff', lightIntensity: 0.85, ambientIntensity: 0.45, fogNear: 16, fogFar: 66,
    natives: ['galaxyNative', 'galaxyBulwark', 'galaxySlinger'], special: 'galaxyPrime', excludes: ['sandyMan', 'woodMan', 'brickMan', 'concreteMan', 'coward'],
    blurb: 'You are no longer sure this is a room.' },

  // ── Tier 4: hard and rare ───────────────────────────────────────────────
  { id: 'diamond', label: 'The Diamond Core', tier: 4, material: 'diamond', shape: 'pentagon',
    ground: '#cfe9f2', wall: '#a4ccd9', sky: '#e8f8fd', fog: '#dcf1f8',
    lightColor: '#ffffff', lightIntensity: 1.8, ambientIntensity: 0.9, fogNear: 28, fogFar: 100,
    natives: ['diamondNative', 'diamondBulwark', 'diamondSlinger'], special: 'diamondPrime', excludes: ['woodMan', 'sandyMan', 'slimeBlock', 'coward', 'weakFighter'],
    blurb: 'The hardest room, in every sense.' },

  { id: 'assassin', label: 'Assassin Country', tier: 4, material: 'assassin', shape: 'rect',
    ground: '#1e2427', wall: '#141a1c', sky: '#0c1012', fog: '#111618',
    lightColor: '#8fa8b8', lightIntensity: 0.5, ambientIntensity: 0.24, fogNear: 8, fogFar: 34,
    natives: ['assassinNative', 'assassinBulwark', 'assassinSlinger'], special: 'assassinPrime', excludes: ['yellowMan', 'pinkMan', 'tomatoMan', 'medicMan', 'coward'],
    blurb: 'They were already behind you when you read this.' },

  { id: 'pitchBrawl', label: 'The Great Pitch', tier: 4, material: 'pitch', shape: 'rect',
    ground: '#2f6b3a', wall: '#1f4a27', sky: '#bcd9ea', fog: '#c8e2ef',
    lightColor: '#ffffff', lightIntensity: 1.6, ambientIntensity: 0.85, fogNear: 40, fogFar: 130,
    natives: ['pitchBrawlNative', 'pitchBrawlBulwark', 'pitchBrawlSlinger'], special: 'pitchBrawlPrime', excludes: ['lavaMan', 'magmaMan', 'charredBrickMan', 'blackMan', 'juggernaut'], legacy: ['strikerMan'],
    blurb: 'The crossover, at scale. Everything here can bend a shot.' },

  { id: 'platinum', label: 'The Platinum Vault', tier: 4, material: 'platinum', shape: 'circle',
    ground: '#c3c9cd', wall: '#9aa1a6', sky: '#dfe6ea', fog: '#dfe6ea',
    lightColor: '#ffffff', lightIntensity: 1.7, ambientIntensity: 0.85, fogNear: 26, fogFar: 94,
    natives: ['platinumNative', 'platinumBulwark', 'platinumSlinger'], special: 'platinumPrime', excludes: ['woodMan', 'sandyMan', 'slimeBlock', 'coward', 'weakFighter'],
    blurb: 'Harder than iron and it knows it.' },

  { id: 'glass', label: 'The Glass House', tier: 4, material: 'glass', shape: 'rect',
    ground: '#bcd7de', wall: '#9dc0ca', sky: '#dff0f5', fog: '#e6f4f8',
    lightColor: '#ffffff', lightIntensity: 1.7, ambientIntensity: 0.9, fogNear: 30, fogFar: 105,
    natives: ['glassNative', 'glassBulwark', 'glassSlinger'], special: 'glassPrime', excludes: ['juggernaut', 'concreteMan', 'brickMan', 'sandyMan', 'coward'],
    blurb: 'Everything shatters. Including, eventually, you.' },

  { id: 'clear', label: 'Clear Country', tier: 4, material: 'clear', shape: 'circle',
    ground: '#d8ecf2', wall: '#b6d8e2', sky: '#eaf7fa', fog: '#eaf7fa',
    lightColor: '#ffffff', lightIntensity: 1.6, ambientIntensity: 0.9, fogNear: 26, fogFar: 96,
    natives: ['clearNative', 'clearBulwark', 'clearSlinger'], special: 'clearPrime', excludes: ['blackMan', 'concreteMan', 'brickMan', 'sandyMan', 'woodMan'],
    blurb: 'A whole room of the rare translucent variant. Good luck aiming.' },

  { id: 'illusion', label: 'The Illusion', tier: 4, material: 'illusion', shape: 'pentagon',
    ground: '#5a4a7a', wall: '#3f3357', sky: '#2e2542', fog: '#3a2f52',
    lightColor: '#c9b0ff', lightIntensity: 0.9, ambientIntensity: 0.48, fogNear: 14, fogFar: 56,
    natives: ['illusionNative', 'illusionBulwark', 'illusionSlinger'], special: 'illusionPrime', excludes: ['concreteMan', 'brickMan', 'woodMan', 'sandyMan', 'weakFighter'],
    mirages: true,
    blurb: 'Half of what you are fighting is not there.' },

  // ── Tier 5: the end ─────────────────────────────────────────────────────
  { id: 'nightmare', label: 'The Nightmare', tier: 5, material: 'nightmare', shape: 'pentagon',
    ground: '#160f18', wall: '#0d090e', sky: '#050307', fog: '#0b070c',
    lightColor: '#ff2d55', lightIntensity: 0.55, ambientIntensity: 0.2, fogNear: 7, fogFar: 30,
    natives: ['nightmareNative', 'nightmareBulwark', 'nightmareSlinger'], special: 'nightmarePrime', excludes: ['coward', 'weakFighter', 'medicMan', 'tomatoMan', 'yellowMan'],
    blurb: 'A room you have already been in, wearing a different face.' },

  { id: 'pitchBlack', label: 'Pitch Black', tier: 5, material: 'pitchBlack', shape: 'circle',
    ground: '#08080a', wall: '#050506', sky: '#000000', fog: '#000000',
    lightColor: '#404040', lightIntensity: 0.08, ambientIntensity: 0.04, fogNear: 3, fogFar: 13,
    natives: ['pitchBlackNative', 'pitchBlackBulwark', 'pitchBlackSlinger'], special: 'pitchBlackPrime', excludes: ['yellowMan', 'pinkMan', 'tomatoMan', 'glowingGreenMan', 'medicMan'],
    darkness: true,
    blurb: 'Your flashlight and your light blocks are the only light there is.' },

  { id: 'bone', label: 'The Ossuary', tier: 5, material: 'bone', shape: 'rect',
    ground: '#ddd4bd', wall: '#b3a98e', sky: '#8f8877', fog: '#9c9581',
    lightColor: '#fff4d8', lightIntensity: 0.75, ambientIntensity: 0.4, fogNear: 12, fogFar: 48,
    natives: ['boneNative', 'boneBulwark', 'boneSlinger'], special: 'bonePrime', excludes: ['waterMan', 'snowMan', 'slimeBlock', 'medicMan', 'coward'],
    blurb: 'Everyone who came before you is still here.' },

  { id: 'rust', label: 'The Rust Belt', tier: 5, material: 'rust', shape: 'rect',
    ground: '#8a4a28', wall: '#5c2f18', sky: '#6b3a20', fog: '#7a4526',
    lightColor: '#ffb27a', lightIntensity: 0.8, ambientIntensity: 0.42, fogNear: 12, fogFar: 50,
    natives: ['rustNative', 'rustBulwark', 'rustSlinger'], special: 'rustPrime', excludes: ['waterMan', 'snowMan', 'slimeBlock', 'medicMan', 'glowingGreenMan'],
    blurb: 'The Iron Works, a few centuries later.' }
];

// Tier 5 was four rooms against seven or eight elsewhere, so the final tier
// repeated itself fastest — the opposite of what an endgame should do.
ARENA_ROOMS.push(
  { id: 'rift', label: 'The Rift', tier: 5, material: 'rift', shape: 'pentagon',
    ground: '#0a0616', wall: '#150c2b', sky: '#030109', fog: '#080414',
    lightColor: '#a86bff', lightIntensity: 0.5, ambientIntensity: 0.22, fogNear: 8, fogFar: 34,
    natives: ['riftNative', 'riftBulwark', 'riftSlinger'], special: 'riftPrime',
    excludes: ['sandyMan', 'woodMan', 'brickMan', 'concreteMan', 'coward'],
    blurb: 'The Galaxy, torn open. Things come through it.' },

  { id: 'blackIce', label: 'Black Ice', tier: 5, material: 'blackIce', shape: 'circle',
    ground: '#0e1a20', wall: '#081116', sky: '#050d11', fog: '#0a1419',
    lightColor: '#7fd4ff', lightIntensity: 0.42, ambientIntensity: 0.2, fogNear: 7, fogFar: 30,
    natives: ['blackIceNative', 'blackIceBulwark', 'blackIceSlinger'], special: 'blackIcePrime',
    excludes: ['lavaMan', 'fireMan', 'magmaMan', 'charredBrickMan', 'tomatoMan'],
    blurb: 'The Drift after the sun went out. Everything here freezes.' },

  { id: 'furnace', label: 'The Furnace', tier: 5, material: 'furnace', shape: 'rect',
    ground: '#1c0d08', wall: '#0f0705', sky: '#2a0d05', fog: '#3d1207',
    lightColor: '#ff5722', lightIntensity: 1.1, ambientIntensity: 0.4, fogNear: 10, fogFar: 40,
    natives: ['furnaceNative', 'furnaceBulwark', 'furnaceSlinger'], special: 'furnacePrime',
    excludes: ['snowMan', 'waterMan', 'slowCube', 'medicMan', 'coward'],
    blurb: 'Where the Magma Floor is heated. Nothing here is not burning.' },

  { id: 'hollow', label: 'The Hollow', tier: 5, material: 'hollow', shape: 'circle',
    ground: '#2a2622', wall: '#141210', sky: '#0c0a09', fog: '#12100e',
    lightColor: '#8a8478', lightIntensity: 0.38, ambientIntensity: 0.18, fogNear: 6, fogFar: 26,
    natives: ['hollowNative', 'hollowBulwark', 'hollowSlinger'], special: 'hollowPrime',
    excludes: ['yellowMan', 'pinkMan', 'tomatoMan', 'glowingGreenMan', 'medicMan'],
    blurb: 'A room with nothing in it, until there is.' }
);

export const roomsForTier = (tier: RoomTier): ArenaRoom[] => ARENA_ROOMS.filter((r) => r.tier === tier);

export const roomById = (id: string): ArenaRoom | undefined => ARENA_ROOMS.find((r) => r.id === id);

/**
 * How many waves are cleared in each tier before the next unlocks. The
 * tutorial rooms occupy waves 1-4, so tier 1 proper starts at wave 5.
 */
// A run visits exactly FIVE rooms — one per tier — and stays in each for a
// long stretch of waves. Cycling several rooms per tier turned the arena into
// a slideshow: a room needs long enough for its own family and its special to
// become familiar before it is taken away.
//
// The tier-5 room is the last one you ever see. Waves keep escalating there
// indefinitely, so a run ends where it ends rather than looping.
export const WAVES_PER_TIER = 8;
export const FINAL_TIER: RoomTier = 5;

/**
 * How many rooms deep a run is by a given wave, counting from the end of the
 * scripted tutorial. Caps at FINAL_TIER, because the last room is permanent.
 */
export const tierForRoomsEntered = (roomsEntered: number): RoomTier =>
  Math.min(FINAL_TIER, Math.max(1, roomsEntered + 1)) as RoomTier;

/**
 * Picks the next room, avoiding an immediate repeat. The Nightmare is
 * special-cased by the caller: it wears a previous room's material.
 */
export const pickRoom = (tier: RoomTier, avoidId?: string): ArenaRoom => {
  const pool = roomsForTier(tier).filter((r) => r.id !== avoidId);
  const from = pool.length > 0 ? pool : roomsForTier(tier);
  return from[Math.floor(Math.random() * from.length)];
};

/**
 * Everything that can spawn in a room: the common pool minus this room's
 * exclusions, plus its own natives and its special.
 */
export const poolForRoom = (room: ArenaRoom): EnemyType[] => [
  ...ROOM_COMMON_POOL.filter((t) => !room.excludes.includes(t)),
  ...room.natives,
  ...(room.legacy ?? []),
  room.special
];
