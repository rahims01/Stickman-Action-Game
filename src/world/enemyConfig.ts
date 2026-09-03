import { asset } from './assetPath';
import * as THREE from 'three';
import { BodySliders } from './characterMorph';
import { MaterialKey, materialColor } from './proceduralTextures';
import {
  StatusEffects,
  applyAura,
  applyBurn,
  applyFreeze,
  applyPull,
  applySlow,
  applyRagdollStun,
  setKnockback
} from './statusEffects';
import {
  BASIC_ENEMY_MAX_HEALTH,
  BLACK_MAN_MAX_HEALTH,
  BRAIN_SPAWNER_COOLDOWN,
  HELPER_INITIAL_HEALTH,
  HELPER_INITIAL_KICK_DAMAGE,
  HELPER_INITIAL_PUNCH_DAMAGE,
  DEFAULT_FREEZE_DURATION,
  DEFAULT_PULL_DURATION,
  DEFAULT_STUN_DURATION,
  FIRE_BURN_DURATION,
  GREY_MAN_COLOR,
  GREY_MAN_FLEE_HEALTH_THRESHOLD,
  GREY_MAN_SPECIAL_COOLDOWN,
  KICK_DAMAGE,
  KNOCKBACK_SPEED,
  LAVA_BURN_DURATION,
  MEDIC_HEAL_INTERVAL,
  PLAYER_MAX_HEALTH,
  PUNCH_DAMAGE,
  SNIPER_SHOT_COOLDOWN,
  SPECIAL_ENEMY_MAX_HEALTH,
  STRIKER_SHOT_COOLDOWN,
  STRIKER_SHOT_DAMAGE,
  STRIKER_SHOT_SPEED,
  STRIKER_SHOT_SPIN
} from './gameState';

export type EnemyType =
  | 'fightingDummy'
  | 'punchDummy'
  | 'kickDummy'
  | 'runningMan'
  | 'punchMan'
  | 'kickMan'
  | 'greyMan'
  | 'lavaMan'
  | 'waterMan'
  | 'invisibleMan'
  | 'fireMan'
  | 'weaponMan'
  | 'purpleMan'
  | 'pinkMan'
  | 'greenMan'
  | 'yellowMan'
  | 'blackMan'
  | 'tomatoMan'
  | 'snowMan'
  | 'glowingGreenMan'
  | 'giantMan'
  | 'babyMan'
  | 'tallMan'
  | 'fatMan'
  | 'skinnyMan'
  | 'brainMan'
  | 'strongRangedMan'
  | 'strongKickMan'
  | 'strongPunchMan'
  | 'comboMan'
  | 'strongComboMan'
  | 'medicMan'
  | 'rageMan'
  | 'shieldBearer'
  | 'copycatMan'
  | 'splitMan'
  | 'phaseMan'
  | 'vampireMan'
  | 'armourMan'
  | 'cloakedAssassin'
  | 'engineerMan'
  | 'sniperMan'
  | 'bombMan'
  | 'coward'
  | 'slimeBlock'
  | 'weakFighter'
  | 'sandWarrior'
  | 'sandJuggernaut'
  | 'sandGiant'
  | 'lavaMinion'
  | 'lavaJuggernaut'
  | 'lavaThrower'
  | 'lavaSplitCube'
  | 'juggernaut'
  | 'trapperMan'
  | 'resilientMan'
  | 'superResilientMan'
  | 'shockerCube'
  | 'slowCube'
  | 'smashBall'
  | 'lavaSmashBall'
  | 'ragdollSmashBall'
  | 'slowBall'
  | 'splitBall'
  | 'giantSlime'
  | 'colossalSlime'
  | 'slimeKing'
  | 'magnetMan'
  | 'reflectorMan'
  | 'repulsorMan'
  | 'stormMan'
  | 'lavaGiant'
  | 'enemyBodyguard'
  | 'concreteMan'
  | 'woodMan'
  | 'brickMan'
  | 'sandyMan'
  | 'sandThrower'
  | 'lavaBaby'
  | 'magmaMan'
  | 'charredBrickMan'
  | 'minionMan'
  | 'ragdollThrower'
  | 'adaptiveMan'
  | 'strikerMan'
  | 'sandNative'
  | 'sandBulwark'
  | 'sandSlinger'
  | 'sandPrime'
  | 'rockNative'
  | 'rockBulwark'
  | 'rockSlinger'
  | 'rockPrime'
  | 'grassNative'
  | 'grassBulwark'
  | 'grassSlinger'
  | 'grassPrime'
  | 'dirtNative'
  | 'dirtBulwark'
  | 'dirtSlinger'
  | 'dirtPrime'
  | 'waterNative'
  | 'waterBulwark'
  | 'waterSlinger'
  | 'waterPrime'
  | 'snowNative'
  | 'snowBulwark'
  | 'snowSlinger'
  | 'snowPrime'
  | 'badlandsNative'
  | 'badlandsBulwark'
  | 'badlandsSlinger'
  | 'badlandsPrime'
  | 'gardenNative'
  | 'gardenBulwark'
  | 'gardenSlinger'
  | 'gardenPrime'
  | 'magmaNative'
  | 'magmaBulwark'
  | 'magmaSlinger'
  | 'magmaPrime'
  | 'caveNative'
  | 'caveBulwark'
  | 'caveSlinger'
  | 'cavePrime'
  | 'darkConcreteNative'
  | 'darkConcreteBulwark'
  | 'darkConcreteSlinger'
  | 'darkConcretePrime'
  | 'volcanoNative'
  | 'volcanoBulwark'
  | 'volcanoSlinger'
  | 'volcanoPrime'
  | 'burntHouseNative'
  | 'burntHouseBulwark'
  | 'burntHouseSlinger'
  | 'burntHousePrime'
  | 'amethystNative'
  | 'amethystBulwark'
  | 'amethystSlinger'
  | 'amethystPrime'
  | 'ironNative'
  | 'ironBulwark'
  | 'ironSlinger'
  | 'ironPrime'
  | 'copperNative'
  | 'copperBulwark'
  | 'copperSlinger'
  | 'copperPrime'
  | 'goldNative'
  | 'goldBulwark'
  | 'goldSlinger'
  | 'goldPrime'
  | 'rainbowNative'
  | 'rainbowBulwark'
  | 'rainbowSlinger'
  | 'rainbowPrime'
  | 'blueNative'
  | 'blueBulwark'
  | 'blueSlinger'
  | 'bluePrime'
  | 'bloodNative'
  | 'bloodBulwark'
  | 'bloodSlinger'
  | 'bloodPrime'
  | 'darkOceanNative'
  | 'darkOceanBulwark'
  | 'darkOceanSlinger'
  | 'darkOceanPrime'
  | 'nightNative'
  | 'nightBulwark'
  | 'nightSlinger'
  | 'nightPrime'
  | 'galaxyNative'
  | 'galaxyBulwark'
  | 'galaxySlinger'
  | 'galaxyPrime'
  | 'diamondNative'
  | 'diamondBulwark'
  | 'diamondSlinger'
  | 'diamondPrime'
  | 'assassinNative'
  | 'assassinBulwark'
  | 'assassinSlinger'
  | 'assassinPrime'
  | 'pitchBrawlNative'
  | 'pitchBrawlBulwark'
  | 'pitchBrawlSlinger'
  | 'pitchBrawlPrime'
  | 'platinumNative'
  | 'platinumBulwark'
  | 'platinumSlinger'
  | 'platinumPrime'
  | 'glassNative'
  | 'glassBulwark'
  | 'glassSlinger'
  | 'glassPrime'
  | 'clearNative'
  | 'clearBulwark'
  | 'clearSlinger'
  | 'clearPrime'
  | 'illusionNative'
  | 'illusionBulwark'
  | 'illusionSlinger'
  | 'illusionPrime'
  | 'nightmareNative'
  | 'nightmareBulwark'
  | 'nightmareSlinger'
  | 'nightmarePrime'
  | 'pitchBlackNative'
  | 'pitchBlackBulwark'
  | 'pitchBlackSlinger'
  | 'pitchBlackPrime'
  | 'boneNative'
  | 'boneBulwark'
  | 'boneSlinger'
  | 'bonePrime'
  | 'rustNative'
  | 'rustBulwark'
  | 'rustSlinger'
  | 'rustPrime'
  | 'riftNative'
  | 'riftBulwark'
  | 'riftSlinger'
  | 'riftPrime'
  | 'blackIceNative'
  | 'blackIceBulwark'
  | 'blackIceSlinger'
  | 'blackIcePrime'
  | 'furnaceNative'
  | 'furnaceBulwark'
  | 'furnaceSlinger'
  | 'furnacePrime'
  | 'hollowNative'
  | 'hollowBulwark'
  | 'hollowSlinger'
  | 'hollowPrime'
  | 'bountyHunter';

export const COMMON_BASIC_ENEMY_TYPES: EnemyType[] = ['fightingDummy', 'runningMan', 'punchMan', 'kickMan', 'greyMan'];

// The "naturally spawning, super rare" roster - giant/baby/tall/fat/skinny
// body-shape variants, the brain spawner, and the "normal feature" strong
// variants. Share one concurrency cap and a rarity-weighted roll table
// (worldObjects.ts) layered on top of the uniform pick among the common 5.
export const RARE_ENEMY_TYPES: EnemyType[] = [
  'giantMan',
  'babyMan',
  'tallMan',
  'fatMan',
  'skinnyMan',
  'brainMan',
  'strongRangedMan',
  'strongKickMan',
  'strongPunchMan',
  'comboMan',
  'strongComboMan',
  'medicMan',
  'rageMan',
  'shieldBearer',
  'copycatMan',
  'splitMan',
  'phaseMan',
  'vampireMan',
  'armourMan',
  'cloakedAssassin',
  'engineerMan',
  'sniperMan',
  'bombMan',
  'coward',
  'slimeBlock',
  'juggernaut',
  'resilientMan',
  'superResilientMan',
  'shockerCube',
  'slowCube',
  'smashBall',
  'ragdollSmashBall',
  'slowBall',
  'splitBall',
  'minionMan',
  'ragdollThrower',
  'adaptiveMan',
  'strikerMan',
  'giantSlime',
  'colossalSlime',
  'slimeKing',
  'magnetMan',
  'reflectorMan',
  'repulsorMan',
  // Storm Man is rare-CLASS (cap/colors) but never rolls on the natural
  // table - he only spawns while the Stormy Weather modifier is active
  // (GameCanvas swaps him into natural respawns) or from the sandbox.
  'stormMan'
];

// Sandbox-exclusive EnemyType: never rolled naturally (worldObjects.ts's
// table), only reachable via the sandbox spawner. (Army Man / Bodyguard are
// separate sandbox-only units built directly as HelperState, not enemies -
// see GameCanvas's spawnArmyMan/spawnBodyguard sandbox actions.) The magma-
// arena-only lavaSmashBall/lavaGiant are likewise excluded from this table,
// since the arena's own wave tables spawn them directly.
export const SANDBOX_EXCLUSIVE_TYPES: EnemyType[] = ['trapperMan'];

// Rendered as sliding cubes (CubeEnemyActor) instead of the stickman rig;
// they split into minis on death (splitGenerations deep) and most bleed
// their own body color (the giant/colossal slimes bleed normal red).
export const CUBE_ENEMY_TYPES: EnemyType[] = ['lavaSplitCube', 'slimeBlock', 'shockerCube', 'slowCube', 'giantSlime', 'colossalSlime', 'slimeKing'];

// Rendered as a rolling sphere (SmashBallActor) with its own charge-attack FSM.
export const SMASH_BALL_TYPES: EnemyType[] = ['smashBall', 'lavaSmashBall', 'ragdollSmashBall', 'slowBall', 'splitBall'];

// Per-type blood color overrides (default is red). ONLY slimes/cubes and
// balls may bleed their body color - every humanoid stickman, however
// exotic its skin, bleeds normal red (and so do the giant/colossal/king
// slimes, by explicit request).
export const ENEMY_BLOOD_COLORS: Partial<Record<EnemyType, string>> = {
  lavaSplitCube: '#ff8a2a',
  slimeBlock: '#66bb6a',
  shockerCube: '#2979ff',
  slowCube: '#80d8ff',
  smashBall: '#9e9e9e',
  lavaSmashBall: '#ff6d00',
  ragdollSmashBall: '#7e57c2',
  slowBall: '#4dd0e1',
  splitBall: '#00bcd4'
};

// Never naturally spawns - only summoned by the bounty system after 3 minutes.
export const BOUNTY_HUNTER_TYPE: EnemyType = 'bountyHunter';

// Rare variants still respawn-elsewhere and get the night-time bonus like
// any other naturally-spawning enemy - just picked far less often - so
// they're folded into the same roster every other such check reads.
export const BASIC_ENEMY_TYPES: EnemyType[] = [...COMMON_BASIC_ENEMY_TYPES, ...RARE_ENEMY_TYPES];
export const SPECIAL_ENEMY_TYPES: EnemyType[] = [
  'lavaMan',
  'waterMan',
  'invisibleMan',
  'fireMan',
  'weaponMan',
  'purpleMan',
  'pinkMan',
  'greenMan',
  'yellowMan',
  'blackMan',
  'tomatoMan',
  'snowMan',
  'glowingGreenMan'
];

export type SpecialKind =
  | 'lavaPunch'
  | 'invisibility'
  | 'telekinesis'
  | 'pinkArc'
  | 'emeraldPunch'
  | 'shockPunch'
  | 'rockPunch'
  | 'freezePunch'
  | 'greyProjectile'
  | 'jadePunch'
  | 'emeraldStun'
  | 'greenPull'
  | 'sniperShot'
  | 'slowShot'
  | 'shockPulse'
  | 'curveShot';

export interface AttackPayload {
  damage: number;
  kind?: SpecialKind;
  range: 'melee' | 'ranged' | 'self';
  burnDuration?: number;
  burnDps?: number;
  knockback?: boolean;
  launch?: boolean;
  stunDuration?: number;
  freezeDuration?: number;
  pullDuration?: number;
  selfInvisibility?: boolean;
  auraColor?: string;
  auraDuration?: number;
  projectileColor?: string;
  trail?: boolean;
  growing?: boolean;
  // Overrides the projectile pool's default travel speed (see Projectiles.tsx).
  speed?: number;
  // True when this payload travels as a projectile — parry blocks damage but does not ragdoll the sender.
  isProjectile?: boolean;
  // Slow Cube's shot: temporary movement-speed penalty (SLOW_MOVE_MULTIPLIER).
  slowDuration?: number;
  slowMultiplier?: number;
  // Storm Man: the bolt arcs to a second nearby target for half damage
  // (handled in GameCanvas's hit chokepoints; stripped on the chained zap).
  chainLightning?: boolean;
  // Striker (Ultimate Soccer crossover): angular velocity in rad/s about the
  // vertical axis. Projectiles.tsx bends the shot's heading by the resulting
  // Magnus acceleration each frame, so the ball curves in flight. The side it
  // bends toward is randomised per shot.
  curveSpin?: number;
}

export interface EnemyConfig {
  label: string;
  maxHealth: number;
  color: string;
  opacity?: number;
  roughness?: number;
  metalness?: number;
  moveSpeedMultiplier: number;
  attackSpeedMultiplier: number;
  isStationary: boolean;
  isSpecial: boolean;
  canPunch: boolean;
  canKick: boolean;
  punch?: AttackPayload;
  kick?: AttackPayload;
  // Most types carry exactly one; a few (e.g. the Glowing Green Man) have
  // more than one move sharing the same range - EnemyActor filters this
  // list by the range it currently wants and picks randomly among matches.
  specials?: (AttackPayload & { kind: SpecialKind })[];
  // Keeps its distance and kites instead of closing to melee range.
  staysAtRange?: boolean;
  // Below this health fraction, movement flips to fleeing directly away.
  fleeHealthThreshold?: number;
  // Overrides SPECIAL_ATTACK_COOLDOWN for types whose "special" is really
  // their only regular attack and needs to fire at a normal attack pace.
  specialCooldownOverride?: number;
  // A fixed bone-morph preset (src/world/characterMorph.ts) applied once
  // when this type's model mounts - omitted for "normal feature" variants.
  bodySliders?: BodySliders;
  // The "size" slider's value - NOT bone work, multiplies the model's own
  // root scale directly (and the collision/hit radius via EnemyState's
  // matching sizeMultiplier field).
  sizeMultiplier?: number;
  // Never attacks; instead periodically spawns an ordinary basic enemy
  // near itself once `spawnerCooldownOverride ?? BRAIN_SPAWNER_COOLDOWN`
  // elapses (melee if its target is close, ranged if far).
  isSpawner?: boolean;
  spawnerCooldownOverride?: number;
  // Heals nearby living enemies every `MEDIC_HEAL_INTERVAL` seconds.
  isMedic?: boolean;
  // Deploys a killable sentry turret near itself on ENGINEER_DEPLOY_COOLDOWN.
  isEngineer?: boolean;
  // Copies the player's last-used attack type (punch/kick) instead of
  // picking randomly between them.
  isCopycat?: boolean;
  // Heals VAMPIRE_LIFESTEAL_FRACTION of damage dealt; full heal on a kill.
  isVampire?: boolean;
  // Cycles intangible/translucent per PHASE_INTERVAL/PHASE_DURATION.
  isPhaser?: boolean;
  // Teleports behind its target on ASSASSIN_TELEPORT_COOLDOWN for a
  // backstab punch at ASSASSIN_BACKSTAB_MULTIPLIER damage.
  isAssassin?: boolean;
  // Renders ARMOUR_PIECE_COUNT armor cubes on its bones; one falls off per
  // (maxHealth / count) damage taken.
  hasArmourPieces?: boolean;
  // Ranged special is telegraphed with a laser line for SNIPER_AIM_DURATION
  // before actually firing.
  isSniper?: boolean;
  // Lobs sticky fused bombs at the target's position (see BOMB_* constants).
  isBomber?: boolean;
  // Never fights - permanently flees the player using the goofy-run clip.
  isCoward?: boolean;
  // Below RAGE_HEALTH_THRESHOLD, doubles movement speed and damage.
  isRageEnemy?: boolean;
  // Blocks frontal (within 60°) attacks, reducing damage by 80%.
  hasShield?: boolean;
  // Color override used at spawn time — bounty hunter copies the player tint.
  colorOverride?: string;
  // Immune to hit-reaction flinches and to being ragdoll-stunned (Parry,
  // etc.) - must be kited around obstacles rather than traded with.
  staggerImmune?: boolean;
  // Resilient Man family: remaining cheat-death charges, set at spawn time
  // onto EnemyState.revivesLeft (see makeEnemyState).
  maxRevives?: number;
  // Trapper Man (sandbox-exclusive): periodically drops a proximity mine
  // instead of a normal ranged/melee attack.
  isTrapper?: boolean;
  // Shocker Cube: approaches to PULSE_CUBE_RANGE and holds there, pulsing
  // its 'self'-range special as an AOE instead of kiting + firing a bolt.
  isPulseCube?: boolean;
  // Enemy Bodyguard: shadows its protectee (EnemyState.protecteeId) and only
  // fights while the guard-alert window is open or the protectee is dead.
  isGuard?: boolean;
  // Arena material men: URL (under public/) of a texture mapped onto the
  // stickman's skin - the material color is forced white so the map shows
  // untinted (config.color still drives blood/minimap/projectile tints).
  skinTexture?: string;
  // Procedurally generated arena-room material (see proceduralTextures.ts).
  // Preferred over skinTexture for the room natives: no image files to
  // source or licence, and the enemy always matches the floor it spawned on.
  skinMaterial?: MaterialKey;
  // Minion: at spawn, copies the player's strongest helper's maxHealth and
  // punch damage (falls back to this config's level-1-helper stats).
  isMinion?: boolean;
  // Adaptive Man: below this health fraction, flips from melee brawling to
  // kiting at range and firing its ranged special instead.
  rangedBelowHealthFraction?: number;
  // How many GENERATIONS deep this type splits on death (giant slime 2,
  // colossal slime 3). Cube types and the Split Ball default to 1 without
  // setting this; baked onto EnemyState.splitsLeft at spawn.
  splitGenerations?: number;
  // Slime King: wears a crown and SPAWNS baby slimes on a cooldown while a
  // target is in chase range (on top of splitting on death).
  isSlimeKing?: boolean;
  // Magnet Man: constantly drags the player toward himself while within
  // MAGNET_RANGE - a weak drift the player can fight, not a hard pull.
  isMagnet?: boolean;
  // Repulsor: the opposite - constantly pushes the player AWAY, making
  // melee a grind while he pokes from range.
  isRepulsor?: boolean;
  // Which one-shot clip plays when this type fires its RANGED special.
  // Defaults to 'throw'. The Striker uses 'kick', because a footballer
  // miming an overarm throw while a ball leaves his foot reads worse than
  // any wrong-looking kick could. A 'kick' also drops the projectile's
  // spawn height to boot level rather than chest level.
  rangedAnim?: 'throw' | 'kick' | 'shoot';
  // Reflector: helper/turret/drone projectiles that hit him bounce back at
  // full damage on the enemy team instead of damaging him.
  isReflector?: boolean;
}

const basicPunch: AttackPayload = { damage: PUNCH_DAMAGE, range: 'melee' };
const basicKick: AttackPayload = { damage: KICK_DAMAGE, range: 'melee' };

export const BASIC_ENEMY_COLOR_POOL = ['#6d4c41', '#546e7a', '#8d6e63', '#37474f', '#795548', '#90a4ae', '#5d4037', '#455a64'];

// Per-type ambient particle configuration — shared by EnemyActor and HelperActor.
export const AMBIENT_PARTICLE_CONFIG: Partial<Record<EnemyType, { color: string; emitY: number; interval: number }>> = {
  lavaMan:         { color: '#ff5722', emitY: 1.0, interval: 0.20 },
  waterMan:        { color: '#29b6f6', emitY: 1.1, interval: 0.28 },
  invisibleMan:    { color: '#d0eeff', emitY: 1.0, interval: 0.45 },
  fireMan:         { color: '#ff9800', emitY: 0.9, interval: 0.18 },
  weaponMan:       { color: '#9fa8da', emitY: 1.1, interval: 0.38 },
  purpleMan:       { color: '#ce93d8', emitY: 1.0, interval: 0.32 },
  pinkMan:         { color: '#f48fb1', emitY: 1.0, interval: 0.28 },
  greenMan:        { color: '#66bb6a', emitY: 1.0, interval: 0.32 },
  yellowMan:       { color: '#fff176', emitY: 1.1, interval: 0.14 },
  blackMan:        { color: '#78909c', emitY: 1.0, interval: 0.44 },
  tomatoMan:       { color: '#ff7043', emitY: 1.0, interval: 0.18 },
  snowMan:         { color: '#e3f2fd', emitY: 1.2, interval: 0.28 },
  glowingGreenMan: { color: '#69ff47', emitY: 1.0, interval: 0.18 },
  medicMan:        { color: '#4caf50', emitY: 1.2, interval: 0.46 },
  rageMan:         { color: '#ff5722', emitY: 0.8, interval: 0.22 },
  shieldBearer:    { color: '#b0bec5', emitY: 1.0, interval: 0.54 },
  bountyHunter:    { color: '#ce93d8', emitY: 1.1, interval: 0.38 },
  brainMan:        { color: '#f8bbd0', emitY: 1.6, interval: 0.34 },
  babyMan:         { color: '#b3e5fc', emitY: 0.5, interval: 0.22 },
  giantMan:        { color: '#a1887f', emitY: 1.8, interval: 0.60 },
  fatMan:          { color: '#bcaaa4', emitY: 0.9, interval: 0.68 },
  skinnyMan:       { color: '#cfd8dc', emitY: 0.9, interval: 0.50 },
  tallMan:         { color: '#78909c', emitY: 1.5, interval: 0.50 },
  strongRangedMan: { color: '#64b5f6', emitY: 1.1, interval: 0.42 },
  strongKickMan:   { color: '#ff7043', emitY: 0.8, interval: 0.36 },
  strongPunchMan:  { color: '#ef5350', emitY: 1.1, interval: 0.36 },
  comboMan:        { color: '#4db6ac', emitY: 1.0, interval: 0.54 },
  strongComboMan:  { color: '#26a69a', emitY: 0.9, interval: 0.38 },
  copycatMan:      { color: '#ffd54f', emitY: 1.1, interval: 0.40 },
  splitMan:        { color: '#4dd0e1', emitY: 1.0, interval: 0.34 },
  phaseMan:        { color: '#b39ddb', emitY: 1.0, interval: 0.24 },
  vampireMan:      { color: '#d32f2f', emitY: 1.2, interval: 0.30 },
  armourMan:       { color: '#b0bec5', emitY: 1.1, interval: 0.52 },
  cloakedAssassin: { color: '#455a64', emitY: 0.9, interval: 0.30 },
  engineerMan:     { color: '#ffb74d', emitY: 1.1, interval: 0.44 },
  sniperMan:       { color: '#ff5252', emitY: 1.2, interval: 0.48 },
  bombMan:         { color: '#ff9800', emitY: 1.3, interval: 0.36 },
  lavaMinion:      { color: '#ff5722', emitY: 0.9, interval: 0.22 },
  lavaJuggernaut:  { color: '#ff5722', emitY: 1.2, interval: 0.26 },
  lavaThrower:     { color: '#ff8a65', emitY: 1.1, interval: 0.24 },
  lavaSplitCube:   { color: '#ff8a2a', emitY: 0.7, interval: 0.24 },
  slimeBlock:      { color: '#66bb6a', emitY: 0.7, interval: 0.36 },
  sandGiant:       { color: '#d2b48c', emitY: 1.6, interval: 0.5 },
  juggernaut:      { color: '#616161', emitY: 1.1, interval: 0.5 },
  trapperMan:      { color: '#4e342e', emitY: 0.9, interval: 0.42 },
  resilientMan:    { color: '#ffb300', emitY: 1.1, interval: 0.34 },
  superResilientMan: { color: '#ff6f00', emitY: 1.2, interval: 0.26 },
  shockerCube:     { color: '#2979ff', emitY: 0.7, interval: 0.24 },
  slowCube:        { color: '#80d8ff', emitY: 0.7, interval: 0.3 },
  smashBall:       { color: '#9e9e9e', emitY: 0.4, interval: 0.4 },
  lavaSmashBall:   { color: '#ff6d00', emitY: 0.4, interval: 0.22 },
  ragdollSmashBall:{ color: '#b39ddb', emitY: 0.4, interval: 0.32 },
  slowBall:        { color: '#4dd0e1', emitY: 0.4, interval: 0.32 },
  splitBall:       { color: '#00bcd4', emitY: 0.4, interval: 0.36 },
  lavaGiant:       { color: '#ff6d00', emitY: 1.8, interval: 0.24 },
  enemyBodyguard:  { color: '#7986cb', emitY: 1.1, interval: 0.5 },
  lavaBaby:        { color: '#ff8a65', emitY: 0.5, interval: 0.2 },
  magmaMan:        { color: '#ff5722', emitY: 1.0, interval: 0.22 },
  charredBrickMan: { color: '#8d6e63', emitY: 1.1, interval: 0.4 },
  minionMan:       { color: '#7986cb', emitY: 1.0, interval: 0.4 },
  ragdollThrower:  { color: '#b39ddb', emitY: 1.1, interval: 0.36 },
  adaptiveMan:     { color: '#4db6ac', emitY: 1.0, interval: 0.44 },
  giantSlime:      { color: '#66bb6a', emitY: 1.1, interval: 0.3 },
  colossalSlime:   { color: '#66bb6a', emitY: 1.6, interval: 0.24 },
  slimeKing:       { color: '#4db6ac', emitY: 1.8, interval: 0.2 },
  magnetMan:       { color: '#ff8a65', emitY: 1.0, interval: 0.3 },
  reflectorMan:    { color: '#eeeeee', emitY: 1.1, interval: 0.4 },
  repulsorMan:     { color: '#90caf9', emitY: 1.0, interval: 0.3 },
  stormMan:        { color: '#b3e5fc', emitY: 1.2, interval: 0.2 },
  strikerMan:      { color: '#26c6da', emitY: 1.0, interval: 0.34 },
};

// ── Arena room natives ─────────────────────────────────────
// One fighter per room, made of that room's material. Built from a single
// helper because they differ only in palette and a couple of stats — writing
// thirty of these by hand would be thirty chances to fat-finger a field.
const nativeMan = (
  label: string,
  material: MaterialKey,
  o: {
    hp?: number;
    dmg?: number;
    speed?: number;
    ranged?: boolean;
    rangedDamage?: number;
    extra?: Partial<EnemyConfig>;
  } = {}
): EnemyConfig => {
  const base: EnemyConfig = {
    label,
    maxHealth: o.hp ?? BASIC_ENEMY_MAX_HEALTH,
    color: materialColor(material),
    skinMaterial: material,
    moveSpeedMultiplier: o.speed ?? 1,
    attackSpeedMultiplier: 1,
    isStationary: false,
    isSpecial: false,
    canPunch: !o.ranged,
    canKick: !o.ranged
  };
  if (o.ranged) {
    base.staysAtRange = true;
    base.specials = [
      {
        kind: 'greyProjectile',
        damage: o.rangedDamage ?? 2,
        range: 'ranged',
        projectileColor: materialColor(material)
      }
    ];
    base.specialCooldownOverride = 3.2;
  } else {
    base.punch = { damage: o.dmg ?? PUNCH_DAMAGE, range: 'melee' };
    base.kick = { damage: (o.dmg ?? PUNCH_DAMAGE) + 1, range: 'melee' };
  }
  return { ...base, ...o.extra };
};

// Deliberately NOT Partial: a missing room enemy should be a type error, not
// an undefined lookup at spawn time.
const ROOM_NATIVES = {
  // Four per room, all in that room's material, and every one of them
  // carries a twist that belongs to its room rather than a shared stat
  // block with the palette swapped. A Bulwark in the snow splits; a
  // Bulwark in the iron works drags you in; a Bulwark in the glass house
  // shatters into more of itself.
  sandNative: nativeMan('Sand Man', 'sand', { hp: 10, dmg: 2 }),
  sandBulwark: nativeMan('Sand Bulwark', 'sand', { hp: 20, dmg: 3, speed: 0.62, extra: { sizeMultiplier: 1.55, ...({ hasArmourPieces: true }) } }),
  sandSlinger: nativeMan('Sand Slinger', 'sand', { hp: 9, ranged: true, rangedDamage: 2, extra: { specials: [{ kind: 'slowShot', damage: 2, range: 'ranged', slowDuration: 2, slowMultiplier: 0.6, projectileColor: '#d9c08a' }] } }),
  sandPrime: nativeMan('Dune Warden', 'sand', { hp: 26, dmg: 4, extra: { isSpecial: true, ...({ specials: [{ kind: 'greyProjectile', damage: 4, range: 'ranged', projectileColor: '#d9c08a', speed: 15 }], specialCooldownOverride: 2.6 }) } }),
  rockNative: nativeMan('Rock Man', 'rock', { hp: 10, dmg: 2 }),
  rockBulwark: nativeMan('Rock Brute', 'rock', { hp: 20, dmg: 3, speed: 0.62, extra: { sizeMultiplier: 1.55, ...({ staggerImmune: true, hasArmourPieces: true }) } }),
  rockSlinger: nativeMan('Rock Slinger', 'rock', { hp: 9, ranged: true, rangedDamage: 2, extra: { specials: [{ kind: 'rockPunch', damage: 3, range: 'ranged', stunDuration: DEFAULT_STUN_DURATION, projectileColor: '#6f7276' }] } }),
  rockPrime: nativeMan('Rock Colossus', 'rock', { hp: 26, dmg: 4, extra: { isSpecial: true, ...({ sizeMultiplier: 2.1, staggerImmune: true, moveSpeedMultiplier: 0.5, hasArmourPieces: true }) } }),
  grassNative: nativeMan('Grass Man', 'grass', { hp: 10, dmg: 2, extra: { moveSpeedMultiplier: 1.25 } }),
  grassBulwark: nativeMan('Thicket', 'grass', { hp: 20, dmg: 3, speed: 0.62, extra: { sizeMultiplier: 1.55, ...({ specials: [{ kind: 'greenPull', damage: 1, range: 'ranged', pullDuration: DEFAULT_PULL_DURATION, projectileColor: '#569447' }] }) } }),
  grassSlinger: nativeMan('Seed Slinger', 'grass', { hp: 9, ranged: true, rangedDamage: 2, extra: { isSpawner: true, spawnerCooldownOverride: BRAIN_SPAWNER_COOLDOWN } }),
  grassPrime: nativeMan('Bramble King', 'grass', { hp: 26, dmg: 4, extra: { isSpecial: true, ...({ specials: [{ kind: 'greenPull', damage: 3, range: 'ranged', pullDuration: DEFAULT_PULL_DURATION * 2, projectileColor: '#569447', auraColor: '#569447' }] }) } }),
  dirtNative: nativeMan('Dirt Man', 'dirt', { hp: 10, dmg: 2 }),
  dirtBulwark: nativeMan('Mudpacked', 'dirt', { hp: 20, dmg: 3, speed: 0.62, extra: { sizeMultiplier: 1.55, ...({ isMagnet: true }) } }),
  dirtSlinger: nativeMan('Clod Thrower', 'dirt', { hp: 9, ranged: true, rangedDamage: 2, extra: { isBomber: true } }),
  dirtPrime: nativeMan('Burrower', 'dirt', { hp: 26, dmg: 4, extra: { isSpecial: true, ...({ isPhaser: true, moveSpeedMultiplier: 1.3, isAssassin: true }) } }),
  waterNative: nativeMan('Tide Man', 'water', { hp: 10, dmg: 2, extra: { specials: [{ kind: 'slowShot', damage: 1, range: 'melee', slowDuration: 2.5, slowMultiplier: 0.55, auraColor: '#4fa3d1' }] } }),
  waterBulwark: nativeMan('Undertow', 'water', { hp: 20, dmg: 3, speed: 0.62, extra: { sizeMultiplier: 1.55, ...({ isMagnet: true, staggerImmune: true }) } }),
  waterSlinger: nativeMan('Spray', 'water', { hp: 9, ranged: true, rangedDamage: 2, extra: { specials: [{ kind: 'slowShot', damage: 2, range: 'ranged', slowDuration: 3, slowMultiplier: 0.5, projectileColor: '#4fa3d1' }] } }),
  waterPrime: nativeMan('Riptide', 'water', { hp: 26, dmg: 4, extra: { isSpecial: true, ...({ staysAtRange: true, specials: [{ kind: 'slowShot', damage: 3, range: 'ranged', slowDuration: 4, slowMultiplier: 0.4, projectileColor: '#4fa3d1' }] }) } }),
  snowNative: nativeMan('Ice Man', 'snow', { hp: 10, dmg: 2, extra: { specials: [{ kind: 'freezePunch', damage: 1, range: 'melee', freezeDuration: DEFAULT_FREEZE_DURATION, auraColor: '#9fd8ff' }] } }),
  snowBulwark: nativeMan('Snowpack', 'snow', { hp: 20, dmg: 3, speed: 0.62, extra: { sizeMultiplier: 1.55, ...({ staggerImmune: true, splitGenerations: 1 }) } }),
  snowSlinger: nativeMan('Hailer', 'snow', { hp: 9, ranged: true, rangedDamage: 2, extra: { specials: [{ kind: 'freezePunch', damage: 2, range: 'ranged', freezeDuration: DEFAULT_FREEZE_DURATION, projectileColor: '#dbe6ee', auraColor: '#9fd8ff' }] } }),
  snowPrime: nativeMan('Blizzard Warden', 'snow', { hp: 26, dmg: 4, extra: { isSpecial: true, ...({ specials: [{ kind: 'freezePunch', damage: 4, range: 'melee', freezeDuration: DEFAULT_FREEZE_DURATION * 2, auraColor: '#9fd8ff' }] }) } }),
  badlandsNative: nativeMan('Badlands Man', 'badlands', { hp: 10, dmg: 2 }),
  badlandsBulwark: nativeMan('Mesa', 'badlands', { hp: 20, dmg: 3, speed: 0.62, extra: { sizeMultiplier: 1.55, ...({ staggerImmune: true, hasArmourPieces: true }) } }),
  badlandsSlinger: nativeMan('Ridge Shot', 'badlands', { hp: 9, ranged: true, rangedDamage: 2, extra: { isSniper: true } }),
  badlandsPrime: nativeMan('Canyon Sniper', 'badlands', { hp: 26, dmg: 4, extra: { isSpecial: true, ...({ isSniper: true, staysAtRange: true, moveSpeedMultiplier: 1.2 }) } }),
  gardenNative: nativeMan('Garden Man', 'garden', { hp: 10, dmg: 2, extra: { isMedic: true, spawnerCooldownOverride: MEDIC_HEAL_INTERVAL } }),
  gardenBulwark: nativeMan('Hedge', 'garden', { hp: 20, dmg: 3, speed: 0.62, extra: { sizeMultiplier: 1.55, ...({ isMedic: true, staggerImmune: true, spawnerCooldownOverride: MEDIC_HEAL_INTERVAL }) } }),
  gardenSlinger: nativeMan('Pollen', 'garden', { hp: 9, ranged: true, rangedDamage: 2, extra: { specials: [{ kind: 'greenPull', damage: 1, range: 'ranged', pullDuration: DEFAULT_PULL_DURATION, projectileColor: '#6aa855' }] } }),
  gardenPrime: nativeMan('Gardener', 'garden', { hp: 26, dmg: 4, extra: { isSpecial: true, ...({ isSpawner: true, spawnerCooldownOverride: BRAIN_SPAWNER_COOLDOWN, isMedic: true }) } }),
  magmaNative: nativeMan('Magma Man', 'magma', { hp: 15, dmg: 3, extra: { punch: { damage: 3, range: 'melee', burnDuration: LAVA_BURN_DURATION, burnDps: 1, auraColor: '#ff5722' } } }),
  magmaBulwark: nativeMan('Slagheap', 'magma', { hp: 28, dmg: 4, speed: 0.62, extra: { sizeMultiplier: 1.55, ...({ staggerImmune: true, punch: { damage: 4, range: 'melee', burnDuration: LAVA_BURN_DURATION, burnDps: 2, auraColor: '#ff5722' } }) } }),
  magmaSlinger: nativeMan('Ember Thrower', 'magma', { hp: 13, ranged: true, rangedDamage: 3, extra: { specials: [{ kind: 'lavaPunch', damage: 1, range: 'ranged', burnDuration: LAVA_BURN_DURATION, burnDps: 1, projectileColor: '#ff5722', trail: true }] } }),
  magmaPrime: nativeMan('Magma Lord', 'magma', { hp: 38, dmg: 5, extra: { isSpecial: true, ...({ sizeMultiplier: 1.8, specials: [{ kind: 'lavaPunch', damage: 2, range: 'ranged', burnDuration: LAVA_BURN_DURATION, burnDps: 2, projectileColor: '#ff5722', trail: true }] }) } }),
  caveNative: nativeMan('Cave Man', 'cave', { hp: 15, dmg: 3, extra: { moveSpeedMultiplier: 1.1 } }),
  caveBulwark: nativeMan('Stalagmite', 'cave', { hp: 28, dmg: 4, speed: 0.62, extra: { sizeMultiplier: 1.55, ...({ staggerImmune: true, isStationary: false, hasArmourPieces: true }) } }),
  caveSlinger: nativeMan('Rock Lobber', 'cave', { hp: 13, ranged: true, rangedDamage: 3, extra: { specials: [{ kind: 'rockPunch', damage: 3, range: 'ranged', stunDuration: DEFAULT_STUN_DURATION, projectileColor: '#3b3a38' }] } }),
  cavePrime: nativeMan('Cave Stalker', 'cave', { hp: 38, dmg: 5, extra: { isSpecial: true, ...({ isAssassin: true, moveSpeedMultiplier: 1.35, isPhaser: true }) } }),
  darkConcreteNative: nativeMan('Rebar Man', 'darkConcrete', { hp: 15, dmg: 3 }),
  darkConcreteBulwark: nativeMan('Pillar', 'darkConcrete', { hp: 28, dmg: 4, speed: 0.62, extra: { sizeMultiplier: 1.55, ...({ staggerImmune: true, hasArmourPieces: true, isReflector: true }) } }),
  darkConcreteSlinger: nativeMan('Rivet Gun', 'darkConcrete', { hp: 13, ranged: true, rangedDamage: 3, extra: { isSniper: true } }),
  darkConcretePrime: nativeMan('Foreman', 'darkConcrete', { hp: 38, dmg: 5, extra: { isSpecial: true, ...({ isEngineer: true, isTrapper: true }) } }),
  volcanoNative: nativeMan('Cinder Man', 'volcano', { hp: 15, dmg: 3, extra: { punch: { damage: 3, range: 'melee', burnDuration: FIRE_BURN_DURATION, burnDps: 1, auraColor: '#ff9800' } } }),
  volcanoBulwark: nativeMan('Basalt', 'volcano', { hp: 28, dmg: 4, speed: 0.62, extra: { sizeMultiplier: 1.55, ...({ staggerImmune: true, isRageEnemy: true }) } }),
  volcanoSlinger: nativeMan('Firebomb', 'volcano', { hp: 13, ranged: true, rangedDamage: 3, extra: { isBomber: true } }),
  volcanoPrime: nativeMan('Eruption', 'volcano', { hp: 38, dmg: 5, extra: { isSpecial: true, ...({ isBomber: true, sizeMultiplier: 1.4, splitGenerations: 1 }) } }),
  burntHouseNative: nativeMan('Ash Man', 'burntHouse', { hp: 15, dmg: 3, extra: { isPhaser: true } }),
  burntHouseBulwark: nativeMan('Charred Frame', 'burntHouse', { hp: 28, dmg: 4, speed: 0.62, extra: { sizeMultiplier: 1.55, ...({ staggerImmune: true, punch: { damage: 4, range: 'melee', burnDuration: FIRE_BURN_DURATION, burnDps: 1, auraColor: '#ff9800' } }) } }),
  burntHouseSlinger: nativeMan('Ember Spit', 'burntHouse', { hp: 13, ranged: true, rangedDamage: 3, extra: { specials: [{ kind: 'lavaPunch', damage: 2, range: 'ranged', burnDuration: FIRE_BURN_DURATION, burnDps: 1, projectileColor: '#ff9800' }] } }),
  burntHousePrime: nativeMan('Cinder Wraith', 'burntHouse', { hp: 38, dmg: 5, extra: { isSpecial: true, ...({ isPhaser: true, isVampire: true, opacity: 0.6 }) } }),
  amethystNative: nativeMan('Amethyst Man', 'amethyst', { hp: 15, dmg: 3, extra: { metalness: 0.4, roughness: 0.2 } }),
  amethystBulwark: nativeMan('Cluster', 'amethyst', { hp: 28, dmg: 4, speed: 0.62, extra: { sizeMultiplier: 1.55, ...({ staggerImmune: true, splitGenerations: 1, metalness: 0.4 }) } }),
  amethystSlinger: nativeMan('Shard Slinger', 'amethyst', { hp: 13, ranged: true, rangedDamage: 3, extra: { specials: [{ kind: 'emeraldStun', damage: 3, range: 'ranged', stunDuration: DEFAULT_STUN_DURATION, projectileColor: '#a87ae0', auraColor: '#a87ae0' }] } }),
  amethystPrime: nativeMan('Geode', 'amethyst', { hp: 38, dmg: 5, extra: { isSpecial: true, ...({ splitGenerations: 2, metalness: 0.4, specials: [{ kind: 'emeraldStun', damage: 4, range: 'melee', stunDuration: DEFAULT_STUN_DURATION, auraColor: '#a87ae0' }] }) } }),
  ironNative: nativeMan('Iron Man', 'iron', { hp: 15, dmg: 3, extra: { metalness: 0.75, roughness: 0.3, isMagnet: true } }),
  ironBulwark: nativeMan('Anvil', 'iron', { hp: 28, dmg: 4, speed: 0.62, extra: { sizeMultiplier: 1.55, ...({ staggerImmune: true, hasArmourPieces: true, isMagnet: true, metalness: 0.8 }) } }),
  ironSlinger: nativeMan('Bolt Thrower', 'iron', { hp: 13, ranged: true, rangedDamage: 3, extra: { isReflector: true, metalness: 0.7 } }),
  ironPrime: nativeMan('Loadstone', 'iron', { hp: 38, dmg: 5, extra: { isSpecial: true, ...({ isMagnet: true, metalness: 0.9, sizeMultiplier: 1.5, staggerImmune: true }) } }),
  copperNative: nativeMan('Copper Man', 'copper', { hp: 15, dmg: 3, extra: { metalness: 0.6, roughness: 0.35 } }),
  copperBulwark: nativeMan('Ingot', 'copper', { hp: 28, dmg: 4, speed: 0.62, extra: { sizeMultiplier: 1.55, ...({ staggerImmune: true, isReflector: true, metalness: 0.7 }) } }),
  copperSlinger: nativeMan('Arc Thrower', 'copper', { hp: 13, ranged: true, rangedDamage: 3, extra: { specials: [{ kind: 'greyProjectile', damage: 3, range: 'ranged', projectileColor: '#c47a4e', chainLightning: true }] } }),
  copperPrime: nativeMan('Live Wire', 'copper', { hp: 38, dmg: 5, extra: { isSpecial: true, ...({ specials: [{ kind: 'shockPunch', damage: 3, range: 'melee', stunDuration: DEFAULT_STUN_DURATION, launch: true, auraColor: '#ffd54f' }] }) } }),
  goldNative: nativeMan('Gold Man', 'gold', { hp: 20, dmg: 4, extra: { metalness: 0.85, roughness: 0.18 } }),
  goldBulwark: nativeMan('Bullion', 'gold', { hp: 36, dmg: 5, speed: 0.62, extra: { sizeMultiplier: 1.55, ...({ staggerImmune: true, metalness: 0.9, maxRevives: 1 }) } }),
  goldSlinger: nativeMan('Coin Slinger', 'gold', { hp: 18, ranged: true, rangedDamage: 3, extra: { specials: [{ kind: 'greyProjectile', damage: 4, range: 'ranged', projectileColor: '#e8c95a', speed: 16 }] } }),
  goldPrime: nativeMan('Gilded Champion', 'gold', { hp: 50, dmg: 6, extra: { isSpecial: true, ...({ metalness: 0.95, sizeMultiplier: 1.4, maxRevives: 1, staggerImmune: true }) } }),
  rainbowNative: nativeMan('Prism Man', 'rainbow', { hp: 20, dmg: 4, extra: { specials: [{ kind: 'emeraldStun', damage: 3, range: 'melee', stunDuration: DEFAULT_STUN_DURATION, auraColor: '#ff4dc3' }] } }),
  rainbowBulwark: nativeMan('Spectrum Wall', 'rainbow', { hp: 36, dmg: 5, speed: 0.62, extra: { sizeMultiplier: 1.55, ...({ staggerImmune: true, isReflector: true }) } }),
  rainbowSlinger: nativeMan('Refractor', 'rainbow', { hp: 18, ranged: true, rangedDamage: 3, extra: { specials: [{ kind: 'pinkArc', damage: 3, range: 'ranged', knockback: true, projectileColor: '#ff4dc3', growing: true }] } }),
  rainbowPrime: nativeMan('Spectrum', 'rainbow', { hp: 50, dmg: 6, extra: { isSpecial: true, ...({ specials: [{ kind: 'pinkArc', damage: 4, range: 'ranged', knockback: true, projectileColor: '#ff4dc3', growing: true }, { kind: 'emeraldPunch', damage: 5, range: 'melee', auraColor: '#4dff77' }] }) } }),
  blueNative: nativeMan('Cobalt Man', 'blue', { hp: 20, dmg: 4 }),
  blueBulwark: nativeMan('Cobalt Wall', 'blue', { hp: 36, dmg: 5, speed: 0.62, extra: { sizeMultiplier: 1.55, ...({ staggerImmune: true, isReflector: true }) } }),
  blueSlinger: nativeMan('Bolt Caster', 'blue', { hp: 18, ranged: true, rangedDamage: 3, extra: { specials: [{ kind: 'greyProjectile', damage: 3, range: 'ranged', projectileColor: '#3f6fd6', chainLightning: true }] } }),
  bluePrime: nativeMan('Deep Cobalt', 'blue', { hp: 50, dmg: 6, extra: { isSpecial: true, ...({ staysAtRange: true, specials: [{ kind: 'greyProjectile', damage: 5, range: 'ranged', projectileColor: '#3f6fd6', speed: 17, chainLightning: true }] }) } }),
  bloodNative: nativeMan('Blood Man', 'blood', { hp: 20, dmg: 4, extra: { isVampire: true } }),
  bloodBulwark: nativeMan('Clot', 'blood', { hp: 36, dmg: 5, speed: 0.62, extra: { sizeMultiplier: 1.55, ...({ isVampire: true, staggerImmune: true }) } }),
  bloodSlinger: nativeMan('Bleeder', 'blood', { hp: 18, ranged: true, rangedDamage: 3, extra: { isVampire: true, specials: [{ kind: 'greyProjectile', damage: 3, range: 'ranged', projectileColor: '#8f1f24' }] } }),
  bloodPrime: nativeMan('Exsanguinator', 'blood', { hp: 50, dmg: 6, extra: { isSpecial: true, ...({ isVampire: true, isRageEnemy: true, sizeMultiplier: 1.4 }) } }),
  darkOceanNative: nativeMan('Abyss Man', 'darkOcean', { hp: 20, dmg: 4, extra: { opacity: 0.6, isPhaser: true } }),
  darkOceanBulwark: nativeMan('Trench', 'darkOcean', { hp: 36, dmg: 5, speed: 0.62, extra: { sizeMultiplier: 1.55, ...({ staggerImmune: true, opacity: 0.65, isMagnet: true }) } }),
  darkOceanSlinger: nativeMan('Deep Caster', 'darkOcean', { hp: 18, ranged: true, rangedDamage: 3, extra: { opacity: 0.6, specials: [{ kind: 'slowShot', damage: 3, range: 'ranged', slowDuration: 3.5, slowMultiplier: 0.45, projectileColor: '#18506b' }] } }),
  darkOceanPrime: nativeMan('Leviathan', 'darkOcean', { hp: 50, dmg: 6, extra: { isSpecial: true, ...({ sizeMultiplier: 2.2, opacity: 0.7, staggerImmune: true, moveSpeedMultiplier: 0.6, isMagnet: true }) } }),
  nightNative: nativeMan('Night Man', 'night', { hp: 20, dmg: 4, extra: { isAssassin: true } }),
  nightBulwark: nativeMan('Nightwall', 'night', { hp: 36, dmg: 5, speed: 0.62, extra: { sizeMultiplier: 1.55, ...({ staggerImmune: true, isPhaser: true }) } }),
  nightSlinger: nativeMan('Star Caster', 'night', { hp: 18, ranged: true, rangedDamage: 3, extra: { isSniper: true } }),
  nightPrime: nativeMan('Nightfall', 'night', { hp: 50, dmg: 6, extra: { isSpecial: true, ...({ isAssassin: true, specials: [{ kind: 'invisibility', damage: 0, range: 'self', selfInvisibility: true }] }) } }),
  galaxyNative: nativeMan('Galaxy Man', 'galaxy', { hp: 20, dmg: 4, extra: { specials: [{ kind: 'greenPull', damage: 2, range: 'ranged', pullDuration: DEFAULT_PULL_DURATION, projectileColor: '#c9a8ff', auraColor: '#c9a8ff' }] } }),
  galaxyBulwark: nativeMan('Nebula', 'galaxy', { hp: 36, dmg: 5, speed: 0.62, extra: { sizeMultiplier: 1.55, ...({ staggerImmune: true, isMagnet: true, opacity: 0.8 }) } }),
  galaxySlinger: nativeMan('Comet', 'galaxy', { hp: 18, ranged: true, rangedDamage: 3, extra: { specials: [{ kind: 'greyProjectile', damage: 4, range: 'ranged', projectileColor: '#c9a8ff', speed: 18, trail: true }] } }),
  galaxyPrime: nativeMan('Singularity', 'galaxy', { hp: 50, dmg: 6, extra: { isSpecial: true, ...({ isMagnet: true, sizeMultiplier: 1.6, specials: [{ kind: 'telekinesis', damage: 3, range: 'ranged', pullDuration: DEFAULT_PULL_DURATION * 2, projectileColor: '#c9a8ff', auraColor: '#c9a8ff' }] }) } }),
  diamondNative: nativeMan('Diamond Man', 'diamond', { hp: 27, dmg: 5, extra: { metalness: 0.5, roughness: 0.08, staggerImmune: true } }),
  diamondBulwark: nativeMan('Facet', 'diamond', { hp: 46, dmg: 6, speed: 0.62, extra: { sizeMultiplier: 1.55, ...({ staggerImmune: true, maxRevives: 1, metalness: 0.6, roughness: 0.05 }) } }),
  diamondSlinger: nativeMan('Prism Cutter', 'diamond', { hp: 24, ranged: true, rangedDamage: 4, extra: { isReflector: true, metalness: 0.5, roughness: 0.05 } }),
  diamondPrime: nativeMan('Brilliant', 'diamond', { hp: 64, dmg: 7, extra: { isSpecial: true, ...({ metalness: 0.6, roughness: 0.05, staggerImmune: true, maxRevives: 2, sizeMultiplier: 1.4 }) } }),
  assassinNative: nativeMan('Shadow Assassin', 'assassin', { hp: 27, dmg: 5, extra: { isAssassin: true, isPhaser: true, opacity: 0.7 } }),
  assassinBulwark: nativeMan('Bodyblock', 'assassin', { hp: 46, dmg: 6, speed: 0.62, extra: { sizeMultiplier: 1.55, ...({ staggerImmune: true, hasArmourPieces: true, isGuard: false }) } }),
  assassinSlinger: nativeMan('Dartcaster', 'assassin', { hp: 24, ranged: true, rangedDamage: 4, extra: { isSniper: true, opacity: 0.7 } }),
  assassinPrime: nativeMan('Nightblade', 'assassin', { hp: 64, dmg: 7, extra: { isSpecial: true, ...({ isAssassin: true, isPhaser: true, opacity: 0.5, moveSpeedMultiplier: 1.5, attackSpeedMultiplier: 1.4 }) } }),
  pitchBrawlNative: nativeMan('Striker', 'pitch', { hp: 27, dmg: 5, extra: { rangedAnim: 'shoot', staysAtRange: true, specials: [{ kind: 'curveShot', damage: 4, range: 'ranged', projectileColor: '#f5f5f5', speed: STRIKER_SHOT_SPEED, curveSpin: STRIKER_SHOT_SPIN }], specialCooldownOverride: STRIKER_SHOT_COOLDOWN } }),
  pitchBrawlBulwark: nativeMan('Sweeper', 'pitch', { hp: 46, dmg: 6, speed: 0.62, extra: { sizeMultiplier: 1.55, ...({ staggerImmune: true, hasArmourPieces: true }) } }),
  pitchBrawlSlinger: nativeMan('Winger', 'pitch', { hp: 24, ranged: true, rangedDamage: 4, extra: { rangedAnim: 'shoot', specials: [{ kind: 'curveShot', damage: 3, range: 'ranged', projectileColor: '#f5f5f5', speed: STRIKER_SHOT_SPEED, curveSpin: -STRIKER_SHOT_SPIN }], specialCooldownOverride: STRIKER_SHOT_COOLDOWN * 0.9 } }),
  pitchBrawlPrime: nativeMan('Striker Captain', 'pitch', { hp: 64, dmg: 7, extra: { isSpecial: true, ...({ rangedAnim: 'shoot', staysAtRange: true, specials: [{ kind: 'curveShot', damage: 6, range: 'ranged', projectileColor: '#f5f5f5', speed: STRIKER_SHOT_SPEED * 1.2, curveSpin: STRIKER_SHOT_SPIN * 1.7 }], specialCooldownOverride: STRIKER_SHOT_COOLDOWN * 0.6 }) } }),
  platinumNative: nativeMan('Platinum Man', 'platinum', { hp: 27, dmg: 5, extra: { metalness: 0.9, roughness: 0.15, isReflector: true } }),
  platinumBulwark: nativeMan('Bulkhead', 'platinum', { hp: 46, dmg: 6, speed: 0.62, extra: { sizeMultiplier: 1.55, ...({ staggerImmune: true, isReflector: true, hasArmourPieces: true, metalness: 0.95 }) } }),
  platinumSlinger: nativeMan('Deflector', 'platinum', { hp: 24, ranged: true, rangedDamage: 4, extra: { isReflector: true, metalness: 0.9 } }),
  platinumPrime: nativeMan('Mirrorplate', 'platinum', { hp: 64, dmg: 7, extra: { isSpecial: true, ...({ isReflector: true, metalness: 1, roughness: 0.08, staggerImmune: true, sizeMultiplier: 1.3 }) } }),
  glassNative: nativeMan('Glass Man', 'glass', { hp: 27, dmg: 5, extra: { opacity: 0.55, roughness: 0.05, metalness: 0.2 } }),
  glassBulwark: nativeMan('Pane', 'glass', { hp: 46, dmg: 6, speed: 0.62, extra: { sizeMultiplier: 1.55, ...({ staggerImmune: true, splitGenerations: 2, opacity: 0.5 }) } }),
  glassSlinger: nativeMan('Splinter', 'glass', { hp: 24, ranged: true, rangedDamage: 4, extra: { splitGenerations: 1, opacity: 0.5 } }),
  glassPrime: nativeMan('Shatterpane', 'glass', { hp: 64, dmg: 7, extra: { isSpecial: true, ...({ opacity: 0.5, splitGenerations: 3, roughness: 0.05 }) } }),
  clearNative: nativeMan('Clear Man', 'clear', { hp: 27, dmg: 5, extra: { opacity: 0.28, roughness: 0.04 } }),
  clearBulwark: nativeMan('Clear Wall', 'clear', { hp: 46, dmg: 6, speed: 0.62, extra: { sizeMultiplier: 1.55, ...({ staggerImmune: true, opacity: 0.3 }) } }),
  clearSlinger: nativeMan('Faint Shot', 'clear', { hp: 24, ranged: true, rangedDamage: 4, extra: { opacity: 0.25, isSniper: true } }),
  clearPrime: nativeMan('Ghostpane', 'clear', { hp: 64, dmg: 7, extra: { isSpecial: true, ...({ opacity: 0.15, isPhaser: true, moveSpeedMultiplier: 1.25 }) } }),
  illusionNative: nativeMan('Mirage Man', 'illusion', { hp: 27, dmg: 5, extra: { isPhaser: true, opacity: 0.75 } }),
  illusionBulwark: nativeMan('False Wall', 'illusion', { hp: 46, dmg: 6, speed: 0.62, extra: { sizeMultiplier: 1.55, ...({ staggerImmune: true, isPhaser: true, splitGenerations: 1 }) } }),
  illusionSlinger: nativeMan('Echo', 'illusion', { hp: 24, ranged: true, rangedDamage: 4, extra: { isCopycat: true, opacity: 0.7 } }),
  illusionPrime: nativeMan('Illusionist', 'illusion', { hp: 64, dmg: 7, extra: { isSpecial: true, ...({ isCopycat: true, isPhaser: true, splitGenerations: 2, opacity: 0.8 }) } }),
  nightmareNative: nativeMan('Nightmare Man', 'nightmare', { hp: 34, dmg: 6, extra: { staggerImmune: true, isRageEnemy: true } }),
  nightmareBulwark: nativeMan('Dread', 'nightmare', { hp: 58, dmg: 7, speed: 0.62, extra: { sizeMultiplier: 1.55, ...({ staggerImmune: true, isRageEnemy: true, maxRevives: 1 }) } }),
  nightmareSlinger: nativeMan('Whisper', 'nightmare', { hp: 30, ranged: true, rangedDamage: 5, extra: { isSniper: true, isPhaser: true } }),
  nightmarePrime: nativeMan('Night Terror', 'nightmare', { hp: 80, dmg: 9, extra: { isSpecial: true, ...({ staggerImmune: true, isRageEnemy: true, isVampire: true, sizeMultiplier: 1.9, maxRevives: 1 }) } }),
  pitchBlackNative: nativeMan('Void Man', 'pitchBlack', { hp: 34, dmg: 6, extra: { isAssassin: true, isPhaser: true, opacity: 0.55 } }),
  pitchBlackBulwark: nativeMan('Blackout', 'pitchBlack', { hp: 58, dmg: 7, speed: 0.62, extra: { sizeMultiplier: 1.55, ...({ staggerImmune: true, opacity: 0.5, isMagnet: true }) } }),
  pitchBlackSlinger: nativeMan('Nothing', 'pitchBlack', { hp: 30, ranged: true, rangedDamage: 5, extra: { isSniper: true, opacity: 0.4 } }),
  pitchBlackPrime: nativeMan('The Unseen', 'pitchBlack', { hp: 80, dmg: 9, extra: { isSpecial: true, ...({ isAssassin: true, opacity: 0.2, moveSpeedMultiplier: 1.4, specials: [{ kind: 'invisibility', damage: 0, range: 'self', selfInvisibility: true }] }) } }),
  boneNative: nativeMan('Bone Man', 'bone', { hp: 34, dmg: 6, extra: { maxRevives: 1 } }),
  boneBulwark: nativeMan('Ribcage', 'bone', { hp: 58, dmg: 7, speed: 0.62, extra: { sizeMultiplier: 1.55, ...({ staggerImmune: true, maxRevives: 1, hasArmourPieces: true }) } }),
  boneSlinger: nativeMan('Marrow', 'bone', { hp: 30, ranged: true, rangedDamage: 5, extra: { isSpawner: true, spawnerCooldownOverride: BRAIN_SPAWNER_COOLDOWN } }),
  bonePrime: nativeMan('Ossuary King', 'bone', { hp: 80, dmg: 9, extra: { isSpecial: true, ...({ maxRevives: 3, isSpawner: true, spawnerCooldownOverride: BRAIN_SPAWNER_COOLDOWN, sizeMultiplier: 1.6 }) } }),
  rustNative: nativeMan('Rust Man', 'rust', { hp: 34, dmg: 6, extra: { hasArmourPieces: true } }),
  rustBulwark: nativeMan('Scrapheap', 'rust', { hp: 58, dmg: 7, speed: 0.62, extra: { sizeMultiplier: 1.55, ...({ staggerImmune: true, hasArmourPieces: true, isTrapper: true }) } }),
  rustSlinger: nativeMan('Shrapnel', 'rust', { hp: 30, ranged: true, rangedDamage: 5, extra: { isBomber: true, hasArmourPieces: true } }),
  rustPrime: nativeMan('Corroder', 'rust', { hp: 80, dmg: 9, extra: { isSpecial: true, ...({ hasArmourPieces: true, isTrapper: true, sizeMultiplier: 1.5, staggerImmune: true }) } }),
  riftNative: nativeMan('Rift Man', 'rift', { hp: 34, dmg: 6, extra: { isPhaser: true, opacity: 0.7 } }),
  riftBulwark: nativeMan('Tearwall', 'rift', { hp: 58, dmg: 7, speed: 0.62, extra: { sizeMultiplier: 1.55, ...({ staggerImmune: true, isMagnet: true, isPhaser: true }) } }),
  riftSlinger: nativeMan('Riftcaster', 'rift', { hp: 30, ranged: true, rangedDamage: 5, extra: { specials: [{ kind: 'telekinesis', damage: 3, range: 'ranged', pullDuration: DEFAULT_PULL_DURATION, projectileColor: '#a86bff', auraColor: '#a86bff' }] } }),
  riftPrime: nativeMan('The Opening', 'rift', { hp: 80, dmg: 9, extra: { isSpecial: true, ...({ isSpawner: true, spawnerCooldownOverride: BRAIN_SPAWNER_COOLDOWN, isMagnet: true, sizeMultiplier: 1.7, specials: [{ kind: 'telekinesis', damage: 4, range: 'ranged', pullDuration: DEFAULT_PULL_DURATION * 2, projectileColor: '#a86bff', auraColor: '#a86bff' }] }) } }),
  blackIceNative: nativeMan('Black Ice Man', 'blackIce', { hp: 34, dmg: 6, extra: { specials: [{ kind: 'freezePunch', damage: 3, range: 'melee', freezeDuration: DEFAULT_FREEZE_DURATION, auraColor: '#7fd4ff' }] } }),
  blackIceBulwark: nativeMan('Glacier', 'blackIce', { hp: 58, dmg: 7, speed: 0.62, extra: { sizeMultiplier: 1.55, ...({ staggerImmune: true, splitGenerations: 1, isMagnet: true }) } }),
  blackIceSlinger: nativeMan('Sleet', 'blackIce', { hp: 30, ranged: true, rangedDamage: 5, extra: { specials: [{ kind: 'freezePunch', damage: 3, range: 'ranged', freezeDuration: DEFAULT_FREEZE_DURATION, projectileColor: '#7fd4ff', auraColor: '#7fd4ff' }] } }),
  blackIcePrime: nativeMan('The Long Cold', 'blackIce', { hp: 80, dmg: 9, extra: { isSpecial: true, ...({ sizeMultiplier: 1.7, staggerImmune: true, specials: [{ kind: 'freezePunch', damage: 5, range: 'melee', freezeDuration: DEFAULT_FREEZE_DURATION * 2.5, auraColor: '#7fd4ff' }] }) } }),
  furnaceNative: nativeMan('Furnace Man', 'furnace', { hp: 34, dmg: 6, extra: { punch: { damage: 5, range: 'melee', burnDuration: LAVA_BURN_DURATION, burnDps: 2, auraColor: '#ff3d00' } } }),
  furnaceBulwark: nativeMan('Firebox', 'furnace', { hp: 58, dmg: 7, speed: 0.62, extra: { sizeMultiplier: 1.55, ...({ staggerImmune: true, isRageEnemy: true, hasArmourPieces: true }) } }),
  furnaceSlinger: nativeMan('Flue', 'furnace', { hp: 30, ranged: true, rangedDamage: 5, extra: { specials: [{ kind: 'lavaPunch', damage: 3, range: 'ranged', burnDuration: LAVA_BURN_DURATION, burnDps: 2, projectileColor: '#ff3d00', trail: true }] } }),
  furnacePrime: nativeMan('The Bellows', 'furnace', { hp: 80, dmg: 9, extra: { isSpecial: true, ...({ sizeMultiplier: 1.8, isRageEnemy: true, specials: [{ kind: 'lavaPunch', damage: 4, range: 'ranged', burnDuration: LAVA_BURN_DURATION, burnDps: 3, projectileColor: '#ff3d00', trail: true, growing: true }] }) } }),
  hollowNative: nativeMan('Hollow Man', 'hollow', { hp: 34, dmg: 6, extra: { isPhaser: true, opacity: 0.5 } }),
  hollowBulwark: nativeMan('Husk', 'hollow', { hp: 58, dmg: 7, speed: 0.62, extra: { sizeMultiplier: 1.55, ...({ staggerImmune: true, maxRevives: 2 }) } }),
  hollowSlinger: nativeMan('Absence', 'hollow', { hp: 30, ranged: true, rangedDamage: 5, extra: { isSniper: true, isPhaser: true, opacity: 0.45 } }),
  hollowPrime: nativeMan('What Is Left', 'hollow', { hp: 80, dmg: 9, extra: { isSpecial: true, ...({ isPhaser: true, maxRevives: 2, isVampire: true, opacity: 0.4, moveSpeedMultiplier: 1.2, sizeMultiplier: 1.5 }) } })
};

export const ENEMY_CONFIGS: Record<EnemyType, EnemyConfig> = {
  ...ROOM_NATIVES,
  fightingDummy: {
    label: 'Fighting Dummy',
    maxHealth: BASIC_ENEMY_MAX_HEALTH,
    color: '#c2a36b',
    moveSpeedMultiplier: 0,
    attackSpeedMultiplier: 1,
    isStationary: true,
    isSpecial: false,
    canPunch: true,
    canKick: true,
    punch: basicPunch,
    kick: basicKick
  },
  // Single-attack training dummies (sandbox spawns; never natural spawns).
  punchDummy: {
    label: 'Punch Dummy',
    maxHealth: BASIC_ENEMY_MAX_HEALTH,
    color: '#c2a36b',
    moveSpeedMultiplier: 0,
    attackSpeedMultiplier: 1,
    isStationary: true,
    isSpecial: false,
    canPunch: true,
    canKick: false,
    punch: basicPunch
  },
  kickDummy: {
    label: 'Kick Dummy',
    maxHealth: BASIC_ENEMY_MAX_HEALTH,
    color: '#c2a36b',
    moveSpeedMultiplier: 0,
    attackSpeedMultiplier: 1,
    isStationary: true,
    isSpecial: false,
    canPunch: false,
    canKick: true,
    kick: basicKick
  },
  runningMan: {
    label: 'Running Man',
    maxHealth: BASIC_ENEMY_MAX_HEALTH,
    color: '#6d4c41',
    moveSpeedMultiplier: 1,
    attackSpeedMultiplier: 1,
    isStationary: false,
    isSpecial: false,
    canPunch: true,
    canKick: true,
    punch: basicPunch,
    kick: basicKick
  },
  punchMan: {
    label: 'Punch Man',
    maxHealth: BASIC_ENEMY_MAX_HEALTH,
    color: '#546e7a',
    moveSpeedMultiplier: 1,
    attackSpeedMultiplier: 1,
    isStationary: false,
    isSpecial: false,
    canPunch: true,
    canKick: false,
    punch: basicPunch
  },
  kickMan: {
    label: 'Kick Man',
    maxHealth: BASIC_ENEMY_MAX_HEALTH,
    color: '#8d6e63',
    moveSpeedMultiplier: 1,
    attackSpeedMultiplier: 1,
    isStationary: false,
    isSpecial: false,
    canPunch: false,
    canKick: true,
    kick: basicKick
  },
  greyMan: {
    label: 'Grey Man',
    maxHealth: BASIC_ENEMY_MAX_HEALTH,
    color: GREY_MAN_COLOR,
    moveSpeedMultiplier: 1,
    attackSpeedMultiplier: 1,
    isStationary: false,
    isSpecial: false,
    canPunch: false,
    canKick: false,
    staysAtRange: true,
    fleeHealthThreshold: GREY_MAN_FLEE_HEALTH_THRESHOLD,
    specials: [
      {
        kind: 'greyProjectile',
        damage: PUNCH_DAMAGE,
        range: 'ranged',
        projectileColor: GREY_MAN_COLOR
      }
    ],
    specialCooldownOverride: GREY_MAN_SPECIAL_COOLDOWN
  },
  lavaMan: {
    label: 'Lava Man',
    maxHealth: SPECIAL_ENEMY_MAX_HEALTH,
    color: '#b71c1c',
    moveSpeedMultiplier: 1,
    attackSpeedMultiplier: 1,
    isStationary: false,
    isSpecial: true,
    canPunch: true,
    canKick: true,
    punch: basicPunch,
    kick: basicKick,
    specials: [
      {
        kind: 'lavaPunch',
        damage: 0,
        range: 'ranged',
        burnDuration: LAVA_BURN_DURATION,
        burnDps: 1,
        auraColor: '#ff3b3b',
        auraDuration: LAVA_BURN_DURATION,
        projectileColor: '#ff5722',
        trail: true
      }
    ]
  },
  waterMan: {
    label: 'Water Man',
    maxHealth: SPECIAL_ENEMY_MAX_HEALTH,
    color: '#2196f3',
    moveSpeedMultiplier: 1,
    attackSpeedMultiplier: 1,
    isStationary: false,
    isSpecial: true,
    canPunch: true,
    canKick: true,
    punch: { damage: 3, range: 'ranged', knockback: true, projectileColor: '#2196f3' },
    kick: { damage: 2, range: 'melee', stunDuration: DEFAULT_STUN_DURATION }
  },
  invisibleMan: {
    label: 'Invisible Man',
    maxHealth: SPECIAL_ENEMY_MAX_HEALTH,
    color: '#c8e8ff',
    opacity: 0.35,
    roughness: 0.04,
    metalness: 0.15,
    moveSpeedMultiplier: 1,
    attackSpeedMultiplier: 1,
    isStationary: false,
    isSpecial: true,
    canPunch: true,
    canKick: true,
    punch: basicPunch,
    kick: basicKick,
    specials: [{ kind: 'invisibility', damage: 0, range: 'self', selfInvisibility: true }]
  },
  fireMan: {
    label: 'Fire Man',
    maxHealth: SPECIAL_ENEMY_MAX_HEALTH,
    color: '#fd971f',
    moveSpeedMultiplier: 1,
    attackSpeedMultiplier: 1,
    isStationary: false,
    isSpecial: true,
    canPunch: true,
    canKick: true,
    punch: { damage: 0, range: 'melee', burnDuration: FIRE_BURN_DURATION, burnDps: 1, auraColor: '#ffa726', auraDuration: FIRE_BURN_DURATION },
    kick: basicKick
  },
  weaponMan: {
    label: 'Weapon Man',
    maxHealth: SPECIAL_ENEMY_MAX_HEALTH,
    color: '#1a237e',
    moveSpeedMultiplier: 1,
    attackSpeedMultiplier: 1,
    isStationary: false,
    isSpecial: true,
    canPunch: true,
    canKick: true,
    punch: { damage: PUNCH_DAMAGE + 1, range: 'melee' },
    kick: { damage: KICK_DAMAGE + 1, range: 'melee' }
  },
  purpleMan: {
    label: 'Purple Man',
    maxHealth: SPECIAL_ENEMY_MAX_HEALTH,
    color: '#7b1fa2',
    moveSpeedMultiplier: 1,
    attackSpeedMultiplier: 1,
    isStationary: false,
    isSpecial: true,
    canPunch: true,
    canKick: true,
    punch: basicPunch,
    kick: basicKick,
    specials: [
      {
        kind: 'telekinesis',
        damage: 0,
        range: 'ranged',
        pullDuration: DEFAULT_PULL_DURATION,
        auraColor: '#b362e0',
        auraDuration: DEFAULT_PULL_DURATION
      }
    ]
  },
  pinkMan: {
    label: 'Pink Man',
    maxHealth: SPECIAL_ENEMY_MAX_HEALTH,
    color: '#ff4fa3',
    moveSpeedMultiplier: 1,
    attackSpeedMultiplier: 1,
    isStationary: false,
    isSpecial: true,
    canPunch: true,
    canKick: true,
    punch: { damage: PUNCH_DAMAGE + 1, range: 'melee' },
    kick: { damage: KICK_DAMAGE + 1, range: 'melee' },
    specials: [
      {
        kind: 'pinkArc',
        damage: 2,
        range: 'ranged',
        knockback: true,
        auraColor: '#ff4fa3',
        auraDuration: 3,
        projectileColor: '#ff80c8',
        growing: true
      }
    ]
  },
  greenMan: {
    label: 'Green Man',
    maxHealth: SPECIAL_ENEMY_MAX_HEALTH,
    color: '#2e7d32',
    moveSpeedMultiplier: 1,
    attackSpeedMultiplier: 1,
    isStationary: false,
    isSpecial: true,
    canPunch: true,
    canKick: true,
    punch: { damage: PUNCH_DAMAGE + 2, range: 'melee' },
    kick: { damage: KICK_DAMAGE + 2, range: 'melee' },
    specials: [{ kind: 'emeraldPunch', damage: 4, range: 'melee', auraColor: '#43e97b', auraDuration: 3 }]
  },
  yellowMan: {
    label: 'Yellow Man',
    maxHealth: SPECIAL_ENEMY_MAX_HEALTH,
    color: '#fdd835',
    moveSpeedMultiplier: 2,
    attackSpeedMultiplier: 2,
    isStationary: false,
    isSpecial: true,
    canPunch: true,
    canKick: true,
    punch: basicPunch,
    kick: basicKick,
    specials: [
      {
        kind: 'shockPunch',
        damage: 1,
        range: 'melee',
        stunDuration: DEFAULT_STUN_DURATION,
        launch: true,
        auraColor: '#fff176',
        auraDuration: DEFAULT_STUN_DURATION
      }
    ]
  },
  blackMan: {
    label: 'Black Man',
    maxHealth: BLACK_MAN_MAX_HEALTH,
    color: '#111111',
    moveSpeedMultiplier: 1,
    attackSpeedMultiplier: 1,
    isStationary: false,
    isSpecial: true,
    canPunch: true,
    canKick: true,
    punch: { damage: PUNCH_DAMAGE + 1, range: 'melee' },
    kick: { damage: KICK_DAMAGE + 1, range: 'melee' },
    specials: [{ kind: 'rockPunch', damage: 3, range: 'melee', stunDuration: DEFAULT_STUN_DURATION }]
  },
  tomatoMan: {
    label: 'Tomato Man',
    maxHealth: SPECIAL_ENEMY_MAX_HEALTH,
    color: '#ff6347',
    moveSpeedMultiplier: 2,
    attackSpeedMultiplier: 1,
    isStationary: false,
    isSpecial: true,
    canPunch: true,
    canKick: true,
    punch: basicPunch,
    kick: basicKick
  },
  snowMan: {
    label: 'Snow Man',
    maxHealth: SPECIAL_ENEMY_MAX_HEALTH,
    color: '#e0f7ff',
    moveSpeedMultiplier: 1,
    attackSpeedMultiplier: 1,
    isStationary: false,
    isSpecial: true,
    canPunch: true,
    canKick: true,
    punch: basicPunch,
    kick: basicKick,
    specials: [
      {
        kind: 'freezePunch',
        damage: 1,
        range: 'melee',
        freezeDuration: DEFAULT_FREEZE_DURATION,
        auraColor: '#38bdf8',
        auraDuration: DEFAULT_FREEZE_DURATION
      }
    ]
  },
  // Strongest special in the game - sits one tier above Green Man on the
  // strength chart with three signature moves: two melee (Jade Punch,
  // Emerald Stun) chosen between at random, and one ranged pull (Green Pull).
  glowingGreenMan: {
    label: 'Glowing Green Man',
    maxHealth: 35,
    color: '#39ff14',
    moveSpeedMultiplier: 1,
    attackSpeedMultiplier: 1,
    isStationary: false,
    isSpecial: true,
    canPunch: true,
    canKick: true,
    punch: { damage: 5, range: 'melee' },
    kick: { damage: 10, range: 'melee' },
    specials: [
      { kind: 'jadePunch', damage: 20, range: 'melee' },
      {
        kind: 'emeraldStun',
        damage: 10,
        range: 'melee',
        stunDuration: DEFAULT_STUN_DURATION,
        auraColor: '#43e97b',
        auraDuration: DEFAULT_STUN_DURATION
      },
      {
        kind: 'greenPull',
        damage: 2,
        range: 'ranged',
        pullDuration: DEFAULT_PULL_DURATION,
        auraColor: '#43e97b',
        auraDuration: DEFAULT_PULL_DURATION,
        projectileColor: '#39ff14'
      }
    ]
  },

  // --- Rare naturally-spawning variants (see RARE_ENEMY_TYPES) ---
  giantMan: {
    label: 'Giant Man',
    maxHealth: BASIC_ENEMY_MAX_HEALTH * 2,
    color: '#3e2723',
    sizeMultiplier: 1.8,
    moveSpeedMultiplier: 0.6,
    attackSpeedMultiplier: 0.6,
    isStationary: false,
    isSpecial: false,
    canPunch: true,
    canKick: true,
    punch: { damage: PUNCH_DAMAGE * 2, range: 'melee' },
    kick: { damage: KICK_DAMAGE * 2, range: 'melee' }
  },
  babyMan: {
    label: 'Baby Man',
    maxHealth: BASIC_ENEMY_MAX_HEALTH * 0.65,
    color: '#80deea',
    sizeMultiplier: 0.6,
    bodySliders: {
      headSize: 1.5,
      boneOverrides: {
        mixamorigLeftUpLeg:   [1, 0.65, 1], mixamorigRightUpLeg:  [1, 0.65, 1],
        mixamorigLeftLeg:     [1, 0.65, 1], mixamorigRightLeg:    [1, 0.65, 1],
        mixamorigLeftArm:     [1, 0.60, 1], mixamorigRightArm:    [1, 0.60, 1],
        mixamorigLeftForeArm: [1, 0.60, 1], mixamorigRightForeArm:[1, 0.60, 1]
      }
    },
    moveSpeedMultiplier: 1.8,
    attackSpeedMultiplier: 1.8,
    isStationary: false,
    isSpecial: false,
    canPunch: true,
    canKick: true,
    punch: { damage: PUNCH_DAMAGE * 0.65, range: 'melee' },
    kick: { damage: KICK_DAMAGE * 0.65, range: 'melee' }
  },
  tallMan: {
    label: 'Tall Man',
    maxHealth: BASIC_ENEMY_MAX_HEALTH,
    color: '#455a64',
    bodySliders: { height: 1.3, headSize: 0.82 },
    moveSpeedMultiplier: 1,
    attackSpeedMultiplier: 1,
    isStationary: false,
    isSpecial: false,
    canPunch: true,
    canKick: true,
    punch: basicPunch,
    kick: { damage: KICK_DAMAGE * 1.5, range: 'melee' }
  },
  fatMan: {
    label: 'Fat Man',
    maxHealth: BASIC_ENEMY_MAX_HEALTH * 2,
    color: '#a1887f',
    bodySliders: {
      boneOverrides: {
        // Slightly wider hips; legs and spine compensated (1/1.1) so only
        // the belly area actually looks fat. Spine1 = belly = 1.85× wide;
        // Spine2 inverse-compensates so arms and head stay normal.
        mixamorigHips:       [1.1,    1, 1.1   ],
        mixamorigLeftUpLeg:  [1/1.1,  1, 1/1.1 ],
        mixamorigRightUpLeg: [1/1.1,  1, 1/1.1 ],
        mixamorigSpine:      [1/1.1,  1, 1/1.1 ],
        mixamorigSpine1:     [1.85,   1, 1.85  ],
        mixamorigSpine2:     [1/1.85, 1, 1/1.85]
      }
    },
    moveSpeedMultiplier: 0.25,
    attackSpeedMultiplier: 0.4,
    isStationary: false,
    isSpecial: false,
    canPunch: true,
    canKick: true,
    punch: basicPunch,
    kick: basicKick
  },
  skinnyMan: {
    label: 'Skinny Man',
    maxHealth: BASIC_ENEMY_MAX_HEALTH * 0.5,
    color: '#b0bec5',
    bodySliders: {
      boneOverrides: {
        // Hips scaled more aggressively than torso (hip mesh is naturally
        // wider); spine + legs compensated back to 0.65 so hip visually
        // matches chest — "Child_Scale = 1/Hip_Scale" from prompt.json.
        mixamorigHips:       [0.50,       1, 0.50      ],
        mixamorigSpine:      [0.65/0.50,  1, 0.65/0.50 ],
        mixamorigLeftUpLeg:  [0.65/0.50,  1, 0.65/0.50 ],
        mixamorigRightUpLeg: [0.65/0.50,  1, 0.65/0.50 ],
        mixamorigLeftLeg:    [0.85, 1, 0.85],
        mixamorigRightLeg:   [0.85, 1, 0.85]
      }
    },
    moveSpeedMultiplier: 1,
    attackSpeedMultiplier: 1,
    isStationary: false,
    isSpecial: false,
    canPunch: true,
    canKick: true,
    punch: { damage: PUNCH_DAMAGE * 0.5, range: 'melee' },
    kick: { damage: KICK_DAMAGE * 0.5, range: 'melee' }
  },
  brainMan: {
    label: 'Brain Man',
    maxHealth: BASIC_ENEMY_MAX_HEALTH * 0.8,
    color: '#ffab91',
    bodySliders: { headSize: 1.4, height: 1.06 },
    moveSpeedMultiplier: 1,
    attackSpeedMultiplier: 1,
    isStationary: true,
    isSpecial: false,
    canPunch: false,
    canKick: false,
    isSpawner: true,
    spawnerCooldownOverride: BRAIN_SPAWNER_COOLDOWN
  },
  strongRangedMan: {
    label: 'Strong Ranged Man',
    maxHealth: BASIC_ENEMY_MAX_HEALTH,
    color: '#37474f',
    moveSpeedMultiplier: 1,
    attackSpeedMultiplier: 1,
    isStationary: false,
    isSpecial: false,
    canPunch: false,
    canKick: false,
    staysAtRange: true,
    specials: [
      {
        kind: 'greyProjectile',
        damage: PUNCH_DAMAGE * 1.25,
        range: 'ranged',
        projectileColor: '#37474f',
        speed: 13.5
      }
    ],
    specialCooldownOverride: GREY_MAN_SPECIAL_COOLDOWN
  },
  strongKickMan: {
    label: 'Strong Kick Man',
    maxHealth: BASIC_ENEMY_MAX_HEALTH,
    color: '#795548',
    moveSpeedMultiplier: 1,
    attackSpeedMultiplier: 1,
    isStationary: false,
    isSpecial: false,
    canPunch: false,
    canKick: true,
    kick: { damage: KICK_DAMAGE * 1.5, range: 'melee' }
  },
  strongPunchMan: {
    label: 'Strong Punch Man',
    maxHealth: BASIC_ENEMY_MAX_HEALTH,
    color: '#78909c',
    moveSpeedMultiplier: 1,
    attackSpeedMultiplier: 1,
    isStationary: false,
    isSpecial: false,
    canPunch: true,
    canKick: false,
    punch: { damage: PUNCH_DAMAGE * 1.5, range: 'melee' }
  },
  comboMan: {
    label: 'Combo Man',
    maxHealth: BASIC_ENEMY_MAX_HEALTH,
    color: '#bcaaa4',
    moveSpeedMultiplier: 1,
    attackSpeedMultiplier: 1,
    isStationary: false,
    isSpecial: false,
    canPunch: true,
    canKick: true,
    punch: basicPunch,
    kick: basicKick
  },
  strongComboMan: {
    label: 'Strong Combo Man',
    maxHealth: BASIC_ENEMY_MAX_HEALTH,
    color: '#5d4037',
    moveSpeedMultiplier: 1,
    attackSpeedMultiplier: 1,
    isStationary: false,
    isSpecial: false,
    canPunch: true,
    canKick: true,
    punch: { damage: PUNCH_DAMAGE * 1.5, range: 'melee' },
    kick: { damage: KICK_DAMAGE * 1.5, range: 'melee' }
  },

  // --- New basic-tier enemies (rare spawns) ---
  medicMan: {
    label: 'Medic Man',
    maxHealth: Math.round(BASIC_ENEMY_MAX_HEALTH * 0.7),
    color: '#00c853',
    moveSpeedMultiplier: 0.8,
    attackSpeedMultiplier: 1,
    isStationary: false,
    isSpecial: false,
    canPunch: true,
    canKick: false,
    punch: basicPunch,
    isMedic: true,
    spawnerCooldownOverride: MEDIC_HEAL_INTERVAL
  },
  rageMan: {
    label: 'Rage Man',
    maxHealth: BASIC_ENEMY_MAX_HEALTH,
    color: '#e53935',
    moveSpeedMultiplier: 1,
    attackSpeedMultiplier: 1,
    isStationary: false,
    isSpecial: false,
    canPunch: true,
    canKick: true,
    punch: basicPunch,
    kick: basicKick,
    isRageEnemy: true
  },
  shieldBearer: {
    label: 'Shield Bearer',
    maxHealth: Math.round(BASIC_ENEMY_MAX_HEALTH * 1.5),
    color: '#607d8b',
    moveSpeedMultiplier: 0.7,
    attackSpeedMultiplier: 0.8,
    isStationary: false,
    isSpecial: false,
    canPunch: true,
    canKick: false,
    punch: basicPunch,
    hasShield: true
  },

  copycatMan: {
    label: 'Copycat Man',
    maxHealth: BASIC_ENEMY_MAX_HEALTH,
    color: '#d4af37',
    moveSpeedMultiplier: 1,
    attackSpeedMultiplier: 1,
    isStationary: false,
    isSpecial: false,
    canPunch: true,
    canKick: true,
    punch: basicPunch,
    kick: basicKick,
    isCopycat: true
  },
  splitMan: {
    label: 'Split Man',
    maxHealth: BASIC_ENEMY_MAX_HEALTH,
    color: '#00acc1',
    moveSpeedMultiplier: 1,
    attackSpeedMultiplier: 1,
    isStationary: false,
    isSpecial: false,
    canPunch: true,
    canKick: true,
    punch: basicPunch,
    kick: basicKick
  },
  phaseMan: {
    label: 'Phase Man',
    maxHealth: BASIC_ENEMY_MAX_HEALTH,
    color: '#7e57c2',
    moveSpeedMultiplier: 1,
    attackSpeedMultiplier: 1,
    isStationary: false,
    isSpecial: false,
    canPunch: true,
    canKick: true,
    punch: basicPunch,
    kick: basicKick,
    isPhaser: true
  },
  vampireMan: {
    label: 'Vampire Man',
    maxHealth: BASIC_ENEMY_MAX_HEALTH,
    color: '#7f0000',
    moveSpeedMultiplier: 1,
    attackSpeedMultiplier: 1,
    isStationary: false,
    isSpecial: false,
    canPunch: true,
    canKick: true,
    punch: basicPunch,
    kick: basicKick,
    isVampire: true
  },
  armourMan: {
    label: 'Armour Man',
    maxHealth: BASIC_ENEMY_MAX_HEALTH * 2,
    color: '#78909c',
    moveSpeedMultiplier: 0.8,
    attackSpeedMultiplier: 0.9,
    isStationary: false,
    isSpecial: false,
    canPunch: true,
    canKick: true,
    punch: basicPunch,
    kick: basicKick,
    hasArmourPieces: true
  },
  cloakedAssassin: {
    label: 'Cloaked Assassin',
    maxHealth: Math.round(BASIC_ENEMY_MAX_HEALTH * 0.8),
    color: '#263238',
    opacity: 0.85,
    moveSpeedMultiplier: 1.2,
    attackSpeedMultiplier: 1.2,
    isStationary: false,
    isSpecial: false,
    canPunch: true,
    canKick: false,
    punch: basicPunch,
    isAssassin: true
  },
  engineerMan: {
    label: 'Engineer Man',
    maxHealth: BASIC_ENEMY_MAX_HEALTH,
    color: '#ff8f00',
    moveSpeedMultiplier: 0.6,
    attackSpeedMultiplier: 1,
    isStationary: false,
    isSpecial: false,
    canPunch: true,
    canKick: false,
    punch: basicPunch,
    isEngineer: true
  },
  sniperMan: {
    label: 'Sniper Man',
    maxHealth: Math.round(BASIC_ENEMY_MAX_HEALTH * 0.8),
    color: '#4e342e',
    moveSpeedMultiplier: 1,
    attackSpeedMultiplier: 1,
    isStationary: false,
    isSpecial: false,
    canPunch: false,
    canKick: false,
    staysAtRange: true,
    isSniper: true,
    specials: [
      {
        kind: 'sniperShot',
        damage: 3,
        range: 'ranged',
        projectileColor: '#ff5252',
        speed: 20
      }
    ],
    specialCooldownOverride: SNIPER_SHOT_COOLDOWN
  },
  // --- Ultimate Soccer crossover guest ---
  // Kites and volleys a football that BENDS mid-flight (see curveSpin and
  // Projectiles.tsx). Aiming straight at where he's pointing is a mistake —
  // the ball arrives about a metre to one side, and which side is random per
  // shot. Keeps a kick for anyone who closes the distance on him.
  strikerMan: {
    label: 'Striker',
    maxHealth: BASIC_ENEMY_MAX_HEALTH,
    color: '#00838f',
    moveSpeedMultiplier: 1.1,
    attackSpeedMultiplier: 1,
    isStationary: false,
    isSpecial: false,
    canPunch: false,
    canKick: true,
    kick: { damage: KICK_DAMAGE, range: 'melee' },
    staysAtRange: true,
    specials: [
      {
        kind: 'curveShot',
        damage: STRIKER_SHOT_DAMAGE,
        range: 'ranged',
        projectileColor: '#f5f5f5',
        speed: STRIKER_SHOT_SPEED,
        curveSpin: STRIKER_SHOT_SPIN
      }
    ],
    rangedAnim: 'shoot',
    specialCooldownOverride: STRIKER_SHOT_COOLDOWN
  },
  bombMan: {
    label: 'Bomb Man',
    maxHealth: BASIC_ENEMY_MAX_HEALTH,
    color: '#3e3e3e',
    moveSpeedMultiplier: 0.9,
    attackSpeedMultiplier: 1,
    isStationary: false,
    isSpecial: false,
    canPunch: true,
    canKick: false,
    punch: basicPunch,
    isBomber: true
  },

  coward: {
    label: 'Coward',
    maxHealth: Math.round(BASIC_ENEMY_MAX_HEALTH * 0.6),
    color: '#fff59d',
    moveSpeedMultiplier: 1.3,
    attackSpeedMultiplier: 1,
    isStationary: false,
    isSpecial: false,
    canPunch: false,
    canKick: false,
    isCoward: true,
    fleeHealthThreshold: 2
  },
  slimeBlock: {
    label: 'Slime Block',
    maxHealth: BASIC_ENEMY_MAX_HEALTH,
    color: '#66bb6a',
    moveSpeedMultiplier: 0.9,
    attackSpeedMultiplier: 1,
    isStationary: false,
    isSpecial: false,
    canPunch: false,
    canKick: false,
    staysAtRange: true,
    specials: [{ kind: 'greyProjectile', damage: 1, range: 'ranged', projectileColor: '#66bb6a' }],
    specialCooldownOverride: 3.5
  },
  // The slime dynasty: bigger blocks that split MORE generations deep.
  // Unlike the Slime Block they bleed normal red blood.
  giantSlime: {
    label: 'Giant Slime',
    maxHealth: 25,
    color: '#4caf50',
    sizeMultiplier: 1.7,
    moveSpeedMultiplier: 0.7,
    attackSpeedMultiplier: 1,
    isStationary: false,
    isSpecial: false,
    canPunch: false,
    canKick: false,
    staysAtRange: true,
    specials: [{ kind: 'greyProjectile', damage: 2, range: 'ranged', projectileColor: '#4caf50' }],
    specialCooldownOverride: 3.5,
    splitGenerations: 2
  },
  colossalSlime: {
    label: 'Colossal Slime',
    maxHealth: 45,
    color: '#2e7d32',
    sizeMultiplier: 2.4,
    moveSpeedMultiplier: 0.55,
    attackSpeedMultiplier: 1,
    isStationary: false,
    isSpecial: false,
    canPunch: false,
    canKick: false,
    staysAtRange: true,
    specials: [{ kind: 'greyProjectile', damage: 3, range: 'ranged', projectileColor: '#2e7d32' }],
    specialCooldownOverride: 3.8,
    splitGenerations: 3
  },
  // The crowned apex of the slime dynasty: spawns baby slimes while alive
  // AND still splits colossal-deep when finally killed. Red blood.
  slimeKing: {
    label: 'Slime King',
    maxHealth: 60,
    color: '#00695c',
    sizeMultiplier: 2.6,
    moveSpeedMultiplier: 0.5,
    attackSpeedMultiplier: 1,
    isStationary: false,
    isSpecial: false,
    canPunch: false,
    canKick: false,
    staysAtRange: true,
    specials: [{ kind: 'greyProjectile', damage: 3, range: 'ranged', projectileColor: '#00695c' }],
    specialCooldownOverride: 4,
    splitGenerations: 3,
    isSlimeKing: true
  },
  // Drags the player toward himself with a constant weak magnetic drift.
  magnetMan: {
    label: 'Magnet Man',
    maxHealth: BASIC_ENEMY_MAX_HEALTH,
    color: '#d84315',
    metalness: 0.6,
    roughness: 0.35,
    moveSpeedMultiplier: 0.85,
    attackSpeedMultiplier: 1,
    isStationary: false,
    isSpecial: false,
    canPunch: true,
    canKick: true,
    punch: basicPunch,
    kick: basicKick,
    isMagnet: true
  },
  // Magnet Man's opposite: constantly shoves the player away while poking
  // with a weak ranged bolt. Dash punches through the field.
  repulsorMan: {
    label: 'Repulsor',
    maxHealth: Math.round(BASIC_ENEMY_MAX_HEALTH * 1.2),
    color: '#90caf9',
    metalness: 0.5,
    roughness: 0.3,
    moveSpeedMultiplier: 0.8,
    attackSpeedMultiplier: 1,
    isStationary: false,
    isSpecial: false,
    canPunch: false,
    canKick: false,
    staysAtRange: true,
    specials: [{ kind: 'greyProjectile', damage: 1, range: 'ranged', projectileColor: '#90caf9' }],
    specialCooldownOverride: 4,
    isRepulsor: true
  },
  // Stormy Weather exclusive: rides the fog throwing forked lightning that
  // arcs to a second nearby target. Never spawns in clear skies.
  stormMan: {
    label: 'Storm Man',
    maxHealth: Math.round(BASIC_ENEMY_MAX_HEALTH * 1.2),
    color: '#82b1ff',
    moveSpeedMultiplier: 1,
    attackSpeedMultiplier: 1,
    isStationary: false,
    isSpecial: false,
    canPunch: false,
    canKick: false,
    staysAtRange: true,
    specials: [
      {
        kind: 'greyProjectile',
        damage: 2,
        range: 'ranged',
        projectileColor: '#b3e5fc',
        speed: 16,
        chainLightning: true,
        auraColor: '#b3e5fc'
      }
    ],
    specialCooldownOverride: 3.5
  },
  // Mirror-polished: bounces incoming helper/turret projectiles back at
  // their shooter's team. Melee attacks work normally.
  reflectorMan: {
    label: 'Reflector',
    maxHealth: Math.round(BASIC_ENEMY_MAX_HEALTH * 1.2),
    color: '#e0e0e0',
    metalness: 0.9,
    roughness: 0.1,
    moveSpeedMultiplier: 0.9,
    attackSpeedMultiplier: 1,
    isStationary: false,
    isSpecial: false,
    canPunch: true,
    canKick: false,
    punch: basicPunch,
    isReflector: true
  },
  shockerCube: {
    label: 'Shocker Cube',
    maxHealth: BASIC_ENEMY_MAX_HEALTH,
    color: '#2979ff',
    moveSpeedMultiplier: 1,
    attackSpeedMultiplier: 1,
    isStationary: false,
    isSpecial: false,
    canPunch: false,
    canKick: false,
    isPulseCube: true,
    specials: [{ kind: 'shockPulse', damage: 1, range: 'self', stunDuration: 1.5, auraColor: '#2979ff' }],
    specialCooldownOverride: 4
  },
  slowCube: {
    label: 'Slow Cube',
    maxHealth: BASIC_ENEMY_MAX_HEALTH,
    color: '#80d8ff',
    moveSpeedMultiplier: 0.9,
    attackSpeedMultiplier: 1,
    isStationary: false,
    isSpecial: false,
    canPunch: false,
    canKick: false,
    staysAtRange: true,
    specials: [{ kind: 'slowShot', damage: 1, range: 'ranged', projectileColor: '#80d8ff', slowDuration: 3, slowMultiplier: 0.45, auraColor: '#80d8ff' }],
    specialCooldownOverride: 3.5
  },
  juggernaut: {
    label: 'Juggernaut',
    maxHealth: 45,
    color: '#37474f',
    moveSpeedMultiplier: 0.55,
    attackSpeedMultiplier: 0.8,
    isStationary: false,
    isSpecial: false,
    canPunch: true,
    canKick: true,
    punch: { damage: 3, range: 'melee' },
    kick: { damage: 4, range: 'melee' },
    staggerImmune: true
  },
  resilientMan: {
    label: 'Resilient Man',
    maxHealth: BASIC_ENEMY_MAX_HEALTH,
    color: '#ffb300',
    moveSpeedMultiplier: 1,
    attackSpeedMultiplier: 1,
    isStationary: false,
    isSpecial: false,
    canPunch: true,
    canKick: true,
    punch: basicPunch,
    kick: basicKick,
    maxRevives: 1
  },
  superResilientMan: {
    label: 'Super Resilient Man',
    maxHealth: Math.round(BASIC_ENEMY_MAX_HEALTH * 1.4),
    color: '#ff6f00',
    moveSpeedMultiplier: 1,
    attackSpeedMultiplier: 1,
    isStationary: false,
    isSpecial: false,
    canPunch: true,
    canKick: true,
    punch: { damage: PUNCH_DAMAGE + 1, range: 'melee' },
    kick: { damage: KICK_DAMAGE + 1, range: 'melee' },
    maxRevives: 2
  },
  smashBall: {
    label: 'Smash Ball',
    maxHealth: BASIC_ENEMY_MAX_HEALTH,
    color: '#9e9e9e',
    moveSpeedMultiplier: 1,
    attackSpeedMultiplier: 1,
    isStationary: false,
    isSpecial: false,
    canPunch: true,
    canKick: false,
    punch: { damage: 3, range: 'melee', knockback: true }
  },
  // A charge that connects ragdoll-stuns the victim instead of just shoving.
  ragdollSmashBall: {
    label: 'Ragdoll Smash Ball',
    maxHealth: BASIC_ENEMY_MAX_HEALTH,
    color: '#7e57c2',
    moveSpeedMultiplier: 1,
    attackSpeedMultiplier: 1,
    isStationary: false,
    isSpecial: false,
    canPunch: true,
    canKick: false,
    punch: { damage: 2, range: 'melee', stunDuration: 1.4, launch: true, auraColor: '#b39ddb' }
  },
  // A charge that connects coats the victim in chilling slime: slow effect.
  slowBall: {
    label: 'Slow Ball',
    maxHealth: BASIC_ENEMY_MAX_HEALTH,
    color: '#4dd0e1',
    moveSpeedMultiplier: 1,
    attackSpeedMultiplier: 1,
    isStationary: false,
    isSpecial: false,
    canPunch: true,
    canKick: false,
    punch: { damage: 2, range: 'melee', slowDuration: 3, slowMultiplier: 0.45, auraColor: '#4dd0e1' }
  },
  // Splits into two mini smash balls on death (like the cube enemies).
  splitBall: {
    label: 'Split Ball',
    maxHealth: BASIC_ENEMY_MAX_HEALTH,
    color: '#00bcd4',
    moveSpeedMultiplier: 1,
    attackSpeedMultiplier: 1,
    isStationary: false,
    isSpecial: false,
    canPunch: true,
    canKick: false,
    punch: { damage: 2, range: 'melee', knockback: true }
  },
  // Copies the player's strongest helper's stats at spawn (see isMinion);
  // these config numbers ARE the fallback: an untouched level-1 helper.
  minionMan: {
    label: 'Minion',
    maxHealth: HELPER_INITIAL_HEALTH,
    color: '#7986cb',
    moveSpeedMultiplier: 1,
    attackSpeedMultiplier: 1,
    isStationary: false,
    isSpecial: false,
    canPunch: true,
    canKick: true,
    punch: { damage: HELPER_INITIAL_PUNCH_DAMAGE, range: 'melee' },
    kick: { damage: HELPER_INITIAL_KICK_DAMAGE, range: 'melee' },
    isMinion: true
  },
  // Kiting thrower whose bolts knock the target into a brief ragdoll.
  ragdollThrower: {
    label: 'Ragdoll Thrower',
    maxHealth: Math.round(BASIC_ENEMY_MAX_HEALTH * 0.8),
    color: '#9575cd',
    moveSpeedMultiplier: 1,
    attackSpeedMultiplier: 1,
    isStationary: false,
    isSpecial: false,
    canPunch: false,
    canKick: false,
    staysAtRange: true,
    specials: [
      {
        kind: 'greyProjectile',
        damage: 1,
        range: 'ranged',
        stunDuration: 1.3,
        auraColor: '#b39ddb',
        projectileColor: '#9575cd'
      }
    ],
    specialCooldownOverride: 5
  },
  // Brawls at melee until badly hurt, then keeps its distance and throws.
  adaptiveMan: {
    label: 'Adaptive Man',
    maxHealth: BASIC_ENEMY_MAX_HEALTH,
    color: '#00897b',
    moveSpeedMultiplier: 1,
    attackSpeedMultiplier: 1,
    isStationary: false,
    isSpecial: false,
    canPunch: true,
    canKick: true,
    punch: basicPunch,
    kick: basicKick,
    rangedBelowHealthFraction: 0.4,
    specials: [
      {
        kind: 'greyProjectile',
        damage: PUNCH_DAMAGE,
        range: 'ranged',
        projectileColor: '#00897b'
      }
    ],
    specialCooldownOverride: GREY_MAN_SPECIAL_COOLDOWN
  },

  // --- Sandbox-exclusive ---
  trapperMan: {
    label: 'Trapper Man',
    maxHealth: BASIC_ENEMY_MAX_HEALTH,
    color: '#4e342e',
    moveSpeedMultiplier: 0.9,
    attackSpeedMultiplier: 1,
    isStationary: false,
    isSpecial: false,
    canPunch: true,
    canKick: false,
    punch: basicPunch,
    isTrapper: true
  },

  // --- Arena roster (also spawnable in sandbox) ---
  weakFighter: {
    label: 'Weak Fighter',
    maxHealth: 3,
    color: '#bdbdbd',
    moveSpeedMultiplier: 0.9,
    attackSpeedMultiplier: 1,
    isStationary: false,
    isSpecial: false,
    canPunch: true,
    canKick: false,
    punch: { damage: 0, range: 'melee' }
  },
  sandWarrior: {
    label: 'Sand Warrior',
    maxHealth: 14,
    color: '#d2b48c',
    moveSpeedMultiplier: 1.1,
    attackSpeedMultiplier: 1.1,
    isStationary: false,
    isSpecial: false,
    canPunch: true,
    canKick: true,
    punch: { damage: 2, range: 'melee' },
    kick: { damage: 3, range: 'melee' }
  },
  sandJuggernaut: {
    label: 'Sand Juggernaut',
    maxHealth: 30,
    color: '#c19a6b',
    moveSpeedMultiplier: 0.5,
    attackSpeedMultiplier: 0.7,
    isStationary: false,
    isSpecial: false,
    canPunch: true,
    canKick: true,
    punch: { damage: 3, range: 'melee' },
    kick: { damage: 4, range: 'melee' }
  },
  sandGiant: {
    label: 'Sand Giant',
    maxHealth: 40,
    color: '#b8860b',
    sizeMultiplier: 1.6,
    moveSpeedMultiplier: 0.6,
    attackSpeedMultiplier: 0.6,
    isStationary: false,
    isSpecial: false,
    canPunch: true,
    canKick: true,
    punch: { damage: 4, range: 'melee' },
    kick: { damage: 6, range: 'melee' }
  },
  lavaMinion: {
    label: 'Lava Minion',
    maxHealth: 12,
    color: '#ff5722',
    moveSpeedMultiplier: 1.2,
    attackSpeedMultiplier: 1.1,
    isStationary: false,
    isSpecial: false,
    canPunch: true,
    canKick: false,
    punch: { damage: 1, range: 'melee', burnDuration: 3, burnDps: 1, auraColor: '#ff5722', auraDuration: 3 }
  },
  lavaJuggernaut: {
    label: 'Lava Juggernaut',
    maxHealth: 35,
    color: '#bf360c',
    moveSpeedMultiplier: 0.5,
    attackSpeedMultiplier: 0.7,
    isStationary: false,
    isSpecial: false,
    canPunch: true,
    canKick: true,
    punch: { damage: 3, range: 'melee', burnDuration: 3, burnDps: 1, auraColor: '#ff5722', auraDuration: 3 },
    kick: { damage: 4, range: 'melee' }
  },
  lavaThrower: {
    label: 'Lava Thrower',
    maxHealth: 14,
    color: '#ff8a65',
    moveSpeedMultiplier: 1,
    attackSpeedMultiplier: 1,
    isStationary: false,
    isSpecial: false,
    canPunch: false,
    canKick: false,
    staysAtRange: true,
    specials: [
      {
        kind: 'greyProjectile',
        damage: 1,
        range: 'ranged',
        burnDuration: 3,
        burnDps: 1,
        auraColor: '#ff5722',
        auraDuration: 3,
        projectileColor: '#ff5722',
        trail: true
      }
    ],
    specialCooldownOverride: 4
  },
  lavaSplitCube: {
    label: 'Lava Split Cube',
    maxHealth: 10,
    color: '#ff8a2a',
    moveSpeedMultiplier: 0.9,
    attackSpeedMultiplier: 1,
    isStationary: false,
    isSpecial: false,
    canPunch: false,
    canKick: false,
    staysAtRange: true,
    specials: [
      {
        kind: 'greyProjectile',
        damage: 1,
        range: 'ranged',
        burnDuration: 3,
        burnDps: 1,
        auraColor: '#ff5722',
        auraDuration: 3,
        projectileColor: '#ff8a2a',
        trail: true
      }
    ],
    specialCooldownOverride: 3.5
  },
  lavaGiant: {
    label: 'Lava Giant',
    maxHealth: 45,
    color: '#5d1a09',
    sizeMultiplier: 1.7,
    moveSpeedMultiplier: 0.55,
    attackSpeedMultiplier: 0.6,
    isStationary: false,
    isSpecial: false,
    canPunch: true,
    canKick: true,
    punch: { damage: 4, range: 'melee', burnDuration: 3, burnDps: 1, auraColor: '#ff5722', auraDuration: 3 },
    kick: { damage: 6, range: 'melee' }
  },
  lavaSmashBall: {
    label: 'Lava Smash Ball',
    maxHealth: Math.round(BASIC_ENEMY_MAX_HEALTH * 1.2),
    color: '#ff6d00',
    moveSpeedMultiplier: 1,
    attackSpeedMultiplier: 1,
    isStationary: false,
    isSpecial: false,
    canPunch: true,
    canKick: false,
    punch: { damage: 3, range: 'melee', knockback: true, burnDuration: 3, burnDps: 1, auraColor: '#ff5722', auraDuration: 3 }
  },

  // --- Arena "material men": skin mapped from the arena's own textures ---
  concreteMan: {
    label: 'Concrete Man',
    maxHealth: 6,
    color: '#9e9e9e',
    skinTexture: asset('/textures/concrete.jpg'),
    moveSpeedMultiplier: 0.9,
    attackSpeedMultiplier: 1,
    isStationary: false,
    isSpecial: false,
    canPunch: true,
    canKick: false,
    punch: { damage: 1, range: 'melee' }
  },
  woodMan: {
    label: 'Wood Man',
    maxHealth: 10,
    color: '#a1887f',
    skinTexture: asset('/textures/wood.jpg'),
    moveSpeedMultiplier: 1,
    attackSpeedMultiplier: 1,
    isStationary: false,
    isSpecial: false,
    canPunch: true,
    canKick: true,
    punch: { damage: 1, range: 'melee' },
    kick: { damage: 2, range: 'melee' }
  },
  brickMan: {
    label: 'Brick Man',
    maxHealth: 16,
    color: '#b85c44',
    skinTexture: asset('/textures/brick.jpg'),
    moveSpeedMultiplier: 0.85,
    attackSpeedMultiplier: 0.9,
    isStationary: false,
    isSpecial: false,
    canPunch: true,
    canKick: true,
    punch: { damage: 2, range: 'melee' },
    kick: { damage: 3, range: 'melee' }
  },
  sandyMan: {
    label: 'Sandy Man',
    maxHealth: 14,
    color: '#d2b48c',
    skinTexture: asset('/textures/sand.jpg'),
    moveSpeedMultiplier: 1.1,
    attackSpeedMultiplier: 1.1,
    isStationary: false,
    isSpecial: false,
    canPunch: true,
    canKick: true,
    punch: { damage: 2, range: 'melee' },
    kick: { damage: 3, range: 'melee' }
  },
  sandThrower: {
    label: 'Sand Thrower',
    maxHealth: 12,
    color: '#e0c9a6',
    moveSpeedMultiplier: 1,
    attackSpeedMultiplier: 1,
    isStationary: false,
    isSpecial: false,
    canPunch: false,
    canKick: false,
    staysAtRange: true,
    specials: [
      {
        kind: 'greyProjectile',
        damage: 2,
        range: 'ranged',
        projectileColor: '#d2b48c'
      }
    ],
    specialCooldownOverride: 4
  },
  lavaBaby: {
    label: 'Lava Baby',
    maxHealth: 8,
    color: '#ff7043',
    sizeMultiplier: 0.55,
    bodySliders: {
      headSize: 1.5,
      boneOverrides: {
        mixamorigLeftUpLeg:   [1, 0.65, 1], mixamorigRightUpLeg:  [1, 0.65, 1],
        mixamorigLeftLeg:     [1, 0.65, 1], mixamorigRightLeg:    [1, 0.65, 1],
        mixamorigLeftArm:     [1, 0.60, 1], mixamorigRightArm:    [1, 0.60, 1],
        mixamorigLeftForeArm: [1, 0.60, 1], mixamorigRightForeArm:[1, 0.60, 1]
      }
    },
    moveSpeedMultiplier: 1.8,
    attackSpeedMultiplier: 1.8,
    isStationary: false,
    isSpecial: false,
    canPunch: true,
    canKick: false,
    punch: { damage: 1, range: 'melee', burnDuration: 2, burnDps: 1, auraColor: '#ff5722', auraDuration: 2 }
  },
  magmaMan: {
    label: 'Magma Man',
    maxHealth: 20,
    color: '#ff5722',
    skinTexture: asset('/textures/magma.jpg'),
    moveSpeedMultiplier: 0.95,
    attackSpeedMultiplier: 1,
    isStationary: false,
    isSpecial: false,
    canPunch: true,
    canKick: true,
    punch: { damage: 2, range: 'melee', burnDuration: 3, burnDps: 1, auraColor: '#ff5722', auraDuration: 3 },
    kick: { damage: 3, range: 'melee' }
  },
  charredBrickMan: {
    label: 'Charred Brick Man',
    maxHealth: 26,
    color: '#5d4037',
    skinTexture: asset('/textures/charred-bricks.jpg'),
    moveSpeedMultiplier: 0.7,
    attackSpeedMultiplier: 0.8,
    isStationary: false,
    isSpecial: false,
    canPunch: true,
    canKick: true,
    punch: { damage: 3, range: 'melee' },
    kick: { damage: 4, range: 'melee' }
  },

  // Spawns attached to another enemy (never rolls on its own); see isGuard.
  enemyBodyguard: {
    label: 'Enemy Bodyguard',
    maxHealth: Math.round(BASIC_ENEMY_MAX_HEALTH * 1.3),
    color: '#3949ab',
    moveSpeedMultiplier: 1.05,
    attackSpeedMultiplier: 1,
    isStationary: false,
    isSpecial: false,
    canPunch: true,
    canKick: true,
    punch: { damage: PUNCH_DAMAGE + 1, range: 'melee' },
    kick: basicKick,
    isGuard: true
  },

  // --- Bounty Hunter: spawned by the survival timer, never naturally ---
  bountyHunter: {
    label: 'Bounty Hunter',
    maxHealth: PLAYER_MAX_HEALTH,
    color: '#ffffff',
    moveSpeedMultiplier: 1.1,
    attackSpeedMultiplier: 1.1,
    isStationary: false,
    isSpecial: true,
    canPunch: true,
    canKick: true,
    punch: basicPunch,
    kick: basicKick
  }
};

// Relative power order the user specified, weakest to strongest. Each
// type's maxHealth/punch/kick damage is overwritten below via linear
// interpolation between a floor and the Glowing Green Man's explicit
// numbers (the ceiling) - special-move damage/effects are left untouched,
// only base stats move to reflect the chart.
const STRENGTH_TIER_ORDER: EnemyType[] = [
  'invisibleMan',
  'tomatoMan',
  'fireMan',
  'lavaMan',
  'waterMan',
  'weaponMan',
  'yellowMan',
  'blackMan',
  'purpleMan',
  'pinkMan',
  'greenMan',
  'glowingGreenMan'
];
const TIER_HEALTH_FLOOR = 12;
const TIER_HEALTH_CEIL = 35;
const TIER_PUNCH_FLOOR = 1;
const TIER_PUNCH_CEIL = 5;
const TIER_KICK_FLOOR = 2;
const TIER_KICK_CEIL = 10;

STRENGTH_TIER_ORDER.forEach((type, index) => {
  const t = index / (STRENGTH_TIER_ORDER.length - 1);
  const config = ENEMY_CONFIGS[type];
  config.maxHealth = Math.round(TIER_HEALTH_FLOOR + (TIER_HEALTH_CEIL - TIER_HEALTH_FLOOR) * t);
  const punchDamage = Math.round(TIER_PUNCH_FLOOR + (TIER_PUNCH_CEIL - TIER_PUNCH_FLOOR) * t);
  const kickDamage = Math.round(TIER_KICK_FLOOR + (TIER_KICK_CEIL - TIER_KICK_FLOOR) * t);
  if (config.canPunch && config.punch) config.punch = { ...config.punch, damage: punchDamage };
  if (config.canKick && config.kick) config.kick = { ...config.kick, damage: kickDamage };
});



export const pickRandomBasicEnemyColor = (): string => BASIC_ENEMY_COLOR_POOL[Math.floor(Math.random() * BASIC_ENEMY_COLOR_POOL.length)];

export const pickRandomSpecialType = (): EnemyType => SPECIAL_ENEMY_TYPES[Math.floor(Math.random() * SPECIAL_ENEMY_TYPES.length)];

// Central place every attack (basic punch/kick or special, melee or ranged)
// routes through so damage + every status effect it carries gets applied
// consistently, whether the hit lands on the player or an enemy/dummy uses
// the same payload shape. `dealDamage` is left to the caller since damage
// targets differ (player health state vs an EnemyState/DummyState record).
export const applyAttackPayload = (
  effects: StatusEffects,
  now: number,
  payload: AttackPayload,
  attackerPosition: THREE.Vector3,
  targetPosition: THREE.Vector3
) => {
  if (payload.burnDuration) {
    applyBurn(effects, now, payload.burnDuration, payload.burnDps ?? 1, payload.auraColor ?? '#ff3b3b');
  }
  if (payload.freezeDuration) {
    applyFreeze(effects, now, payload.freezeDuration, payload.auraColor ?? '#38bdf8');
  }
  if (payload.stunDuration) {
    const dir = targetPosition.clone().sub(attackerPosition);
    const impulse = dir.lengthSq() > 1e-6 ? dir.normalize().multiplyScalar(payload.launch ? 6 : 2) : null;
    applyRagdollStun(effects, now, payload.stunDuration, impulse ?? undefined, payload.auraColor, payload.kind === 'shockPunch');
  }
  if (payload.pullDuration) {
    applyPull(effects, now, payload.pullDuration, attackerPosition, payload.auraColor ?? '#b362e0');
  }
  if (payload.slowDuration) {
    applySlow(effects, now, payload.slowDuration, payload.slowMultiplier ?? 0.5, payload.auraColor);
  }
  if (payload.knockback && !payload.stunDuration) {
    setKnockback(effects, targetPosition.clone().sub(attackerPosition), KNOCKBACK_SPEED);
  }
  if (
    payload.auraColor &&
    !payload.burnDuration &&
    !payload.freezeDuration &&
    !payload.stunDuration &&
    !payload.pullDuration &&
    !payload.slowDuration
  ) {
    applyAura(effects, now, payload.auraDuration ?? 3, payload.auraColor);
  }
};
