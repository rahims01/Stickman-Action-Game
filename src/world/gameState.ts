import * as THREE from 'three';
import { StatusEffects } from './statusEffects';

export const PLAYER_MAX_HEALTH = 10;
export const DUMMY_MAX_HEALTH = 10;
export const CRATE_MAX_HEALTH = 10;
export const BASIC_ENEMY_MAX_HEALTH = 10;
export const SPECIAL_ENEMY_MAX_HEALTH = 15;
export const BLACK_MAN_MAX_HEALTH = 20;

export const PUNCH_DAMAGE = 1;
export const KICK_DAMAGE = 2;
export const HUMANOID_RADIUS = 0.4;
export const DUMMY_RADIUS = HUMANOID_RADIUS;
export const FIST_HIT_RADIUS = 0.65;
export const FOOT_HIT_RADIUS = 0.7;

export const SCORE_PER_CRATE = 10;
export const SCORE_PER_KILL = 50;

// Below this health fraction, the player/enemy hit-reaction escalates from
// the normal flinch to a bigger, more dramatic stagger clip - and for the
// player specifically, drives the on-screen "scary" vignette in App.tsx.
export const LOW_HEALTH_FRACTION_THRESHOLD = 0.25;

// Hit/bigHit reactions are capped to a brief FSM-lock regardless of the
// underlying clip's own length - death (checked every frame, unconditionally,
// ahead of everything else) already always wins instantly, but a multi-second
// stagger clip left running gives a follow-up kill a wide window to land
// while it's still visibly playing, which reads as "it played a hit
// animation right before dying" even though the kill itself never shows one.
export const HIT_REACTION_LOCK_DURATION = 0.35;
export const BIG_HIT_REACTION_LOCK_DURATION = 0.55;

export const PUDDLE_LIFETIME = 15;
export const PUDDLE_SHRINK_DURATION = 1.5;
export const CORPSE_SINK_DELAY = 30;
export const CORPSE_SINK_DURATION = 3;
export const PLAYER_CORPSE_SINK_DELAY = 40;

// Hard cap on how many dead-but-not-yet-sunk bodies (dummies, enemies,
// helpers, player corpses, combined) can exist at once - past this, the
// OLDEST excess ones are forced to sink immediately instead of waiting out
// their normal timer, so corpses can never pile up without bound.
export const DEAD_BODY_LIMIT = 25;

// Enemy AI / combat pacing.
export const ENEMY_BASE_MOVE_SPEED = 2.6;
export const ENEMY_ATTACK_RANGE = 1.4;
export const MELEE_ATTACK_COOLDOWN = 3;
export const SPECIAL_ATTACK_COOLDOWN = 10;
export const ENEMY_CHASE_RANGE = 30;
export const ENEMY_RANGED_ATTACK_RANGE = 16;

// Grey man: the one enemy type that deliberately keeps its distance instead
// of closing to melee, and runs when badly hurt.
export const GREY_MAN_MIN_DISTANCE = 6;
export const GREY_MAN_FLEE_HEALTH_THRESHOLD = 0.3;
export const GREY_MAN_SPECIAL_COOLDOWN = 3;
export const GREY_MAN_COLOR = '#9e9e9e';

// Status-effect durations/rates not explicitly specified by name, picked to
// match the other explicitly-given 2s stun/freeze durations for consistency.
export const BURN_TICK_DAMAGE = 1;
export const LAVA_BURN_DURATION = 5;
export const FIRE_BURN_DURATION = 3;
export const DEFAULT_STUN_DURATION = 2;
export const DEFAULT_FREEZE_DURATION = 2;
export const DEFAULT_PULL_DURATION = 1;
export const KNOCKBACK_SPEED = 5;
export const INVISIBILITY_DURATION = 5;

export const MEDKIT_HEAL_AMOUNT = PLAYER_MAX_HEALTH;
export const MEDKIT_PICKUP_RADIUS = 0.9;
export const FLAG_INTERACT_RADIUS = 2.2;

// Stamina gates sprinting only - walking, crouching, jumping, and attacking
// are all unaffected. Regenerates whenever not actively sprinting.
export const PLAYER_MAX_STAMINA = 100;
export const STAMINA_DRAIN_PER_SECOND = 20;
export const STAMINA_REGEN_PER_SECOND = 12;
// Once stamina hits 0, sprinting is locked out until it regenerates back up
// to this floor, so it can't immediately flicker on again mid-regen.
export const STAMINA_RESUME_THRESHOLD = 15;

// Every special enemy's health is clamped to at least this much above the
// player's current effective max health, on top of whatever the strength
// chart says - so specials never trivially fall behind as the player levels.
export const SPECIAL_HEALTH_BUFFER_OVER_PLAYER = 10;

// Specials also get an extra health/damage bonus scaled by the player's
// own current HP/damage and how many levels have passed - growth tapers
// off asymptotically (1 - 1/level -> 1 as level grows) so it converges to
// a FINITE cap (GROWTH_FACTOR times the player's stat) instead of growing
// forever and becoming unkillable. Health is baked in once at spawn time
// (can't easily resize a live, already-damaged HP pool); damage is
// recomputed live every frame, same asymmetry as the night-time bonus.
export const SPECIAL_PLAYER_SCALE_GROWTH_FACTOR = 3;

// Every enemy (basic and special) also gets a flat, ever-ticking +1
// health/damage bonus purely from real time elapsed, independent of level
// or dummy kills.
export const ENEMY_TIME_SCALE_INTERVAL_MS = 150000;
export const ENEMY_TIME_SCALE_AMOUNT = 1;

// A summoned special has a small chance to spawn as a "Clear" variant -
// more translucent and correspondingly weaker.
export const CLEAR_VARIANT_CHANCE = 0.01;
export const CLEAR_VARIANT_OPACITY = 0.75;
export const CLEAR_VARIANT_WEAKNESS = 0.75;

// Per-instance "Giant" flag used by the giant flag mechanic: takes whatever
// special type was randomly picked and makes that one instance giant,
// rather than needing its own dedicated body-shape type/config.
export const GIANT_INSTANCE_SIZE_MULTIPLIER = 1.8;
export const GIANT_INSTANCE_HEALTH_MULTIPLIER = 2;
export const GIANT_INSTANCE_DAMAGE_MULTIPLIER = 2;
export const GIANT_INSTANCE_SPEED_MULTIPLIER = 0.6;

// Shared concurrency cap across every rare naturally-spawning enemy variant
// (giant/baby/tall/fat/skinny/brain + the "normal feature" strong variants).
export const MAX_CONCURRENT_RARE_ENEMIES = 2;

// Brain enemy: never attacks directly, instead periodically spawns an
// ordinary basic enemy near itself - melee if the player/helper it's
// engaging is close, ranged (grey man) if far.
export const BRAIN_SPAWNER_COOLDOWN = 8;
export const BRAIN_SPAWN_CLOSE_DISTANCE = 12;

export const DAY_NIGHT_CYCLE_DURATION = 240;
export const NIGHT_DAY_FACTOR_THRESHOLD = 0.15;

// Level progression.
export const FLAGS_PER_LEVEL_INCREMENT = 2;
export const HELPER_INITIAL_HEALTH = 2;
export const HELPER_INITIAL_PUNCH_DAMAGE = 0;
export const HELPER_INITIAL_KICK_DAMAGE = 0;
export const HELPER_UPGRADE_AMOUNT = 1;
export const HELPER_PICKS_PER_UPGRADE = 2;
export const HELPER_BASE_SPEED_MULTIPLIER = 0.7;
export const HELPER_SPEED_UPGRADE_AMOUNT = 0.15;

// Generic +15%-per-pick bonus applied to every attack-speed/move-speed
// upgrade option (player, enemy).
export const SPEED_BONUS_PER_PICK = 0.15;

// Automatic difficulty scaling, independent of the player's choice.
export const ENEMY_AUTO_SCALE_PER_LEVEL = 3;
export const DUMMY_KILLS_PER_ENEMY_SCALE = 3;

// Crit chance starts at 1% on the first pick, +0.5% every pick after that -
// derived from a plain pick count rather than storing the probability
// directly, since the first pick's jump-to-1% isn't a uniform per-pick step.
export const CRIT_CHANCE_BASE = 0.01;
export const CRIT_CHANCE_PER_EXTRA_PICK = 0.005;
export const CRIT_DAMAGE_MULTIPLIER = 1.25;

export const computeCritChance = (picks: number): number =>
  picks <= 0 ? 0 : CRIT_CHANCE_BASE + (picks - 1) * CRIT_CHANCE_PER_EXTRA_PICK;

// +1 extra basic enemy spawned per pick, on the same periodic timer as the
// time-based difficulty creep above.
export const ENEMY_SPAWN_RATE_INTERVAL_MS = 30000;
export const ENEMY_SPAWN_RATE_AMOUNT_PER_PICK = 1;

export const STAMINA_MAX_BONUS_PER_PICK = 25;

export const FLASHLIGHT_BASE_INTENSITY = 12;
export const FLASHLIGHT_INTENSITY_PER_LEVEL = 8;
export const FLASHLIGHT_BASE_DISTANCE = 25;
export const FLASHLIGHT_DISTANCE_PER_LEVEL = 12;

export const PLAYER_COMBO_SMALL_AMOUNT = 2;
export const PLAYER_COMBO_BIG_AMOUNT = 10;
export const ENEMY_COMBO_AMOUNT = 3;
// "+lvl 2 helper" - a direct, guaranteed bump (skips the normal
// every-2nd-pick gating the plain "helper" option uses).
export const HELPER_LEVEL_UP_2_AMOUNT = 2;

// Rage enemy: below this health fraction, movement and damage both double.
export const RAGE_HEALTH_THRESHOLD = 0.2;
export const RAGE_SPEED_MULTIPLIER = 2;
export const RAGE_DAMAGE_MULTIPLIER = 2;

// Medic enemy: heals nearby living enemies periodically.
export const MEDIC_HEAL_AMOUNT = 1;
export const MEDIC_HEAL_RADIUS = 5;
export const MEDIC_HEAL_INTERVAL = 3;

// Crate medkit drop chance: destroyed crate has this chance to leave a medkit.
export const CRATE_MEDKIT_DROP_CHANCE = 0.15;

// Dash upgrade constants.
export const DASH_DURATION = 0.3;
export const DASH_SPEED = 12;
export const DASH_COOLDOWN = 1.5;

// Parry upgrade: Q pressed within this window before taking a hit negates damage.
export const PARRY_WINDOW_SECONDS = 0.15;

// Ground Slam: kick while airborne deals kick damage + this bonus with AOE ragdoll.
export const GROUND_SLAM_RADIUS = 3.5;
export const GROUND_SLAM_EXTRA_DAMAGE = 1;

// Thorns: each melee hit on the player deals this damage back to the attacker.
export const THORNS_DAMAGE = 1;

// Bounty Hunter: spawns after this many seconds survived without dying.
export const BOUNTY_HUNTER_SPAWN_SECONDS = 180;

// Vampire Man: heals for a fraction of the damage he deals, and fully heals
// (the design doc's "+100 HP", clamped to max) whenever he kills his target.
export const VAMPIRE_LIFESTEAL_FRACTION = 0.5;
export const VAMPIRE_KILL_HEAL = 100;

// Phase Man: on a fixed cycle, briefly becomes intangible (can't be hit,
// walks through obstacles, can't attack) and turns translucent.
export const PHASE_INTERVAL_SECONDS = 7;
export const PHASE_DURATION_SECONDS = 2.5;
export const PHASE_OPACITY = 0.25;

// Split Man: the first time his health crosses below this fraction he is
// replaced by two smaller copies (which never split again).
export const SPLIT_HEALTH_FRACTION = 0.5;
export const SPLIT_COPY_SIZE_MULTIPLIER = 0.8;

// Armour Man: plates strapped to his bones (head, chest, hips, both upper
// arms + forearms, both thighs + shins = 11); one falls off for every
// (maxHealth / ARMOUR_PIECE_COUNT) damage taken.
export const ARMOUR_PIECE_COUNT = 11;

// Bomb Man: lobs a sticky bomb at the target's feet; the accelerating blink
// during the fuse (plus a ground ring showing the blast radius) is the
// telegraph to move away.
export const BOMBER_THROW_COOLDOWN = 6;
export const BOMB_FUSE_SECONDS = 1.6;
export const BOMB_RADIUS = 2.6;
export const BOMB_DAMAGE = 3;
export const MAX_ACTIVE_BOMBS = 6;

// Cloaked Assassin: teleports behind his target on a cooldown, following up
// with a backstab punch at a damage multiplier.
export const ASSASSIN_TELEPORT_COOLDOWN = 7;
export const ASSASSIN_BACKSTAB_MULTIPLIER = 2;

// Sniper Man: shows a laser-sight telegraph line for this long before firing.
export const SNIPER_AIM_DURATION = 1.0;
export const SNIPER_SHOT_COOLDOWN = 5;

// --- Ultimate Soccer crossover ---
// Ball constants and the Magnus coefficient were handed over from Ultimate
// Soccer's own source. The Magnus formula is engine-independent, and the
// deflection it produces happens to be scale-free between their pitch and our
// arena: lateral drift goes as omega * x^2 / v, so our shorter distances and
// slower ball very nearly cancel (~1.1 m of curve either way). Don't "correct"
// the coefficient for our scale — it's already right.
export const CROSSOVER_BALL_MASS = 0.43;
export const CROSSOVER_MAGNUS_K = 0.003;
export const STRIKER_SHOT_SPEED = 14;
export const STRIKER_SHOT_SPIN = 11;
export const STRIKER_SHOT_DAMAGE = 3;
export const STRIKER_SHOT_COOLDOWN = 3.2;

// Football weapon. Kicking one launches it; while it rolls it knocks down
// anything it touches, then it comes to rest and can be kicked again — so a
// well-placed ball is a reusable area-denial tool rather than a consumable.
export const FOOTBALL_RADIUS = 0.2;
export const FOOTBALL_KICK_SPEED = STRIKER_SHOT_SPEED;
// Per-second velocity retention. Low enough that a ball stops in a few
// seconds rather than crossing the whole map.
export const FOOTBALL_DAMPING = 0.55;
// Below this the ball is treated as at rest and becomes kickable again.
export const FOOTBALL_REST_SPEED = 0.6;
export const FOOTBALL_MAX_ROLL_SECONDS = 6;
export const FOOTBALL_KICK_RADIUS = 1.0;
export const FOOTBALL_HIT_DAMAGE = 4;
export const FOOTBALL_STUN_MS = 2200;
export const INITIAL_FOOTBALL_COUNT = 3;

// Position and velocity are deliberately mutable Vector3s rather than React
// state — same rule as enemies and dummies. Only `id` ever reaches setState.
export interface FootballState {
  id: string;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  // Seconds of rolling left. 0 means at rest.
  rollTimer: number;
  // Enemies already struck by the CURRENT kick, so one ball rolling through a
  // line of enemies hits each of them once instead of every frame.
  hitThisKick: Set<string>;
}

// Engineer Man: deploys a killable sentry turret near himself on a cooldown.
export const ENGINEER_DEPLOY_COOLDOWN = 12;
export const MAX_ENEMY_TURRETS = 3;
export const ENEMY_TURRET_HEALTH = 3;
export const ENEMY_TURRET_LIFETIME_MS = 20000;
export const ENEMY_TURRET_DAMAGE = 1;

// Turrets (both the player's upgrade turrets and the Engineer's sentries).
export const TURRET_FIRE_COOLDOWN = 2.2;
export const TURRET_FIRE_RANGE = 14;
export const TURRET_PROJECTILE_SPEED = 14;
export const TURRET_HIT_RADIUS = 0.55;

// Civilians (sandbox-only for now): harmless wanderers that flee from any
// enemy they can see (and from the player, once hit by them), cower when
// badly hurt, and latch onto the player for protection after watching them
// kill a nearby threat.
export const CIVILIAN_MAX_HEALTH = 10;
export const CIVILIAN_WALK_SPEED = 1.6;
export const CIVILIAN_FLEE_SPEED = 4.4;
export const CIVILIAN_SIGHT_RADIUS = 8;
export const CIVILIAN_LOW_HEALTH_FRACTION = 0.35;
export const CIVILIAN_FOLLOW_DISTANCE = 2.4;
// Player kills an enemy within this range of a fleeing civilian -> the
// civilian starts following the player.
export const CIVILIAN_RESCUE_RADIUS = 12;
// How long a player melee hit keeps an enemy locked onto the player (so
// smacking an enemy off a civilian actually pulls it onto you).
export const ENEMY_PLAYER_AGGRO_MS = 8000;

// Resilient Man / Super Resilient Man: the temporary-ragdoll "cheat death"
// knockdown, using the same ragdollStunUntilMs mechanism as a parry stun.
export const DEATH_CHEAT_RAGDOLL_MS = 2600;

// Juggernaut: immune to stagger/hit-reaction flinches and to being
// ragdoll-stunned at all (config.staggerImmune) - must be kited, not traded.
export const JUGGERNAUT_MOVE_SPEED_MULTIPLIER = 0.55;

// Trapper Man (sandbox-exclusive): periodically drops a near-invisible mine
// near its target; anyone who steps on it gets stunned + knocked back.
export const TRAPPER_PLACE_COOLDOWN = 5;
export const MINE_TRIGGER_RADIUS = 0.5;
export const MINE_STUN_DURATION = 1.6;
export const MAX_ACTIVE_MINES = 8;

// Slow Cube: ranged hit applies a temporary movement-speed penalty.
export const SLOW_MOVE_MULTIPLIER = 0.45;
export const SLOW_DURATION_SECONDS = 3;

// Shocker Cube: instead of a ranged bolt, periodically pulses an AOE
// ragdoll-stun around itself once it has closed to short range.
export const PULSE_CUBE_RANGE = 3;
export const PULSE_CUBE_COOLDOWN = 4;
export const PULSE_STUN_DURATION = 1.5;

// Army Men & Bodyguards (civilian-family "neutral" units, NOT helpers):
// armymen wander passively and only turn hostile when they see a civilian
// or fellow armyman attacked (by an enemy OR by the player); bodyguards
// shadow the player and retaliate against whatever hurts him.
export const ARMY_SIGHT_RADIUS = 10;
export const ARMY_AGGRO_MS = 20000;
export const ARMY_MELEE_DAMAGE = 2;
export const ARMY_RANGED_DAMAGE = 1.5;
export const ARMY_MELEE_COOLDOWN = 1.8;
export const ARMY_RANGED_COOLDOWN = 3;
export const ARMY_CHASE_SPEED = 3.4;
export const ARMY_MAX_HEALTH = 16;
export const BODYGUARD_MAX_HEALTH = 15;
export const BODYGUARD_FOLLOW_DISTANCE = 2.0;
// Chance that a freshly spawned civilian brings an armyman escort along.
export const ARMY_SPAWN_WITH_CIVILIAN_CHANCE = 0.35;
// Plain civilians who witness a fellow civilian/armyman being attacked
// nearby panic and bolt away from the scene for this long.
export const CIVILIAN_PANIC_MS = 6000;

// Magnet Man: constant weak drift dragging the player toward him while in
// range - fightable (slower than walk speed), not a hard lock like the pull.
export const MAGNET_RANGE = 7;
export const MAGNET_PULL_SPEED = 1.3;
// Repulsor: the same drift with the sign flipped - shoves the player away.
export const REPULSE_RANGE = 6;
export const REPULSE_PUSH_SPEED = 1.6;

// Storm Man (Stormy Weather exclusive): his bolt arcs to a second target
// within this range for half damage; chance a natural respawn arrives as
// him while the weather modifier is active.
export const STORM_CHAIN_RANGE = 6;
export const STORM_MAN_WEATHER_CHANCE = 0.12;

// Slime King: spawns a baby slime this often while a target is in chase range.
export const SLIME_KING_SPAWN_COOLDOWN = 6;
export const SLIME_KING_BABY_HEALTH = 4;

// Ranged Helpers upgrade: the converted helper kites and fires bolts on
// this cooldown (damage scales with its punch-damage stat).
export const HELPER_RANGED_COOLDOWN = 3;

// Magma-arena lava tiles: glowing floor patches that set the player
// burning while stood on. A permanent scatter covers the wasteland floor;
// hazard waves add extra short-lived patches mid-fight.
export interface LavaTileDef {
  id: string;
  position: [number, number]; // x, z
  radius: number;
  // Hazard-wave patches expire; the permanent magma scatter doesn't.
  expiresAtMs?: number;
}
export const ARENA_LAVA_TILE_COUNT = 10;
export const LAVA_TILE_MIN_RADIUS = 1.3;
export const LAVA_TILE_MAX_RADIUS = 2.2;
export const LAVA_TILE_BURN_DURATION = 2;
export const HAZARD_WAVE_TILE_COUNT = 5;
export const HAZARD_TILE_LIFETIME_MS = 12000;
// Every Nth magma wave is a hazard wave (extra lava patches erupt).
export const HAZARD_WAVE_INTERVAL = 3;

// Sandbox Boss Flag: the sealed ring's radius around the player.
export const BOSS_ARENA_RADIUS = 12;

// Enemy Bodyguard: spawns attached to another enemy and shadows it; only
// starts fighting once its protectee takes damage (alert window) or dies.
export const GUARD_ALERT_MS = 8000;
export const ENEMY_GUARD_FOLLOW_DISTANCE = 2.0;
export const ENEMY_GUARD_ATTACH_CHANCE = 0.08;

// Smash Ball: idles at range watching, then charges in a fast straight-line
// roll that deals contact damage, then retreats back out to idle range.
export const SMASH_BALL_IDLE_RANGE = 9;
export const SMASH_BALL_CHARGE_TRIGGER_RANGE = 7;
export const SMASH_BALL_TELEGRAPH_SECONDS = 0.5;
export const SMASH_BALL_ROLL_SPEED = 11;
export const SMASH_BALL_ROLL_MAX_SECONDS = 1.4;
export const SMASH_BALL_RETREAT_SPEED = 3;
export const SMASH_BALL_COOLDOWN = 3;
export const SMASH_BALL_CONTACT_RADIUS = 0.55;

// Run modifiers - toggled in the stickman menu, persisted, applied globally.
export interface GameModifiers {
  // Everything (player, enemies, dummies, helpers, civilians) dies to one hit.
  oneHit: boolean;
  // One life: dying ends the run and wipes the save.
  ironman: boolean;
  // Player deals 2x damage but has half max health.
  glassCannon: boolean;
  // Player AND enemies move/attack ~30% faster.
  speedDemon: boolean;
  // The sun never rises; enemies keep their night bonus permanently.
  permanentNight: boolean;
  // Stormy weather: rain + thick fog cut visibility drastically.
  weather: boolean;
}

export const createDefaultModifiers = (): GameModifiers => ({
  oneHit: false,
  ironman: false,
  glassCannon: false,
  speedDemon: false,
  permanentNight: false,
  weather: false
});

export const GLASS_CANNON_DAMAGE_MULTIPLIER = 2;
export const SPEED_DEMON_BONUS = 0.3;

// Arena mode: a walled wave-survival box that grows each wave, then drops
// the floor into a larger circular sand pit for the giant-special waves.
export const ARENA_BOX_START_HALF = 14;
export const ARENA_BOX_GROWTH_PER_WAVE = 1.5;
export const ARENA_BOX_MAX_HALF = 24;
export const ARENA_WALL_HEIGHT = 4;
export const ARENA_SAND_RADIUS = 40;
export const ARENA_SAND_WALL_SEGMENTS = 18;
export const ARENA_WAVE_BREAK_SECONDS = 3;
// Phase boundaries (wave numbers): beginner concrete room -> brick/wood box
// -> (floor falls) sand pit -> pentagon magma wasteland, then endless.
export const ARENA_CONCRETE_END_WAVE = 2;
export const ARENA_FALL_WAVE = 10;
export const ARENA_SAND_END_WAVE = 16;
// Beginner room: small RECTANGULAR concrete box.
export const ARENA_CONCRETE_HALF_X = 9;
export const ARENA_CONCRETE_HALF_Z = 7;
// Magma wasteland: pentagon, slightly larger than the sand pit.
export const ARENA_MAGMA_RADIUS = 44;
// Per-wave enemy creep: every cleared wave toughens later spawns a bit.
export const ARENA_ENEMY_HEALTH_PER_WAVE = 1;
export const ARENA_ENEMY_DAMAGE_PER_WAVE = 0.5;

export type LevelChoiceOption =
  | 'enemyHealth'
  | 'enemyDamage'
  | 'enemyAttackSpeed'
  | 'enemyMoveSpeed'
  | 'playerHealth'
  | 'playerDamage'
  | 'playerAttackSpeed'
  | 'playerMoveSpeed'
  | 'helper'
  | 'helperMoveSpeed'
  | 'helperAttackSpeed'
  | 'helperLevelUp2'
  | 'staminaMax'
  | 'enemySpawnRate'
  | 'critChance'
  | 'lightBlock'
  | 'playerComboSmall'
  | 'playerComboBig'
  | 'enemyCombo'
  | 'flashlightUpgrade'
  | 'drone'
  | 'thorns'
  | 'dash'
  | 'parry'
  | 'groundSlam'
  | 'challengeFlag'
  | 'turret'
  | 'helperRanged';

// Pool entries whose effect targets one specific helper (existing, or in
// the case of plain "helper" also possibly a freshly created one) rather
// than applying globally - these drive the LevelUpChoice dropdown step.
export const HELPER_TARGETED_OPTIONS: LevelChoiceOption[] = ['helper', 'helperMoveSpeed', 'helperAttackSpeed', 'helperLevelUp2', 'helperRanged'];

export interface StatModifiers {
  enemyHealthBonus: number;
  enemyDamageBonus: number;
  enemyAttackSpeedBonus: number;
  enemyMoveSpeedBonus: number;
  playerHealthBonus: number;
  playerDamageBonus: number;
  playerAttackSpeedBonus: number;
  playerMoveSpeedBonus: number;
  staminaMaxBonus: number;
  enemySpawnRateBonus: number;
  // Pick COUNT, not a probability - the actual chance is derived via
  // computeCritChance() since the first pick jumps straight to the base
  // chance rather than adding the same per-pick step as every pick after.
  critChancePicks: number;
  // Upgrade-gated abilities - 0 = not unlocked, 1+ = active.
  thornsPicks: number;
  dashPicks: number;
  parryPicks: number;
  groundSlamPicks: number;
}

export const createStatModifiers = (): StatModifiers => ({
  enemyHealthBonus: 0,
  enemyDamageBonus: 0,
  enemyAttackSpeedBonus: 0,
  enemyMoveSpeedBonus: 0,
  playerHealthBonus: 0,
  playerDamageBonus: 0,
  playerAttackSpeedBonus: 0,
  playerMoveSpeedBonus: 0,
  staminaMaxBonus: 0,
  enemySpawnRateBonus: 0,
  critChancePicks: 0,
  thornsPicks: 0,
  dashPicks: 0,
  parryPicks: 0,
  groundSlamPicks: 0
});

export interface DummyState {
  id: string;
  health: number;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  // Set the instant health crosses to 0 - used only to rank dead-but-not-
  // yet-sunk bodies oldest-first against the global DEAD_BODY_LIMIT.
  diedAt?: number;
}

export interface EnemyState {
  id: string;
  type: string;
  health: number;
  maxHealth: number;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  isClear?: boolean;
  // Read by every collision/hit-radius call site (EnemyActor's own
  // movement collision, Player's/HelperActor's incoming hit-test) so a
  // bigger/smaller enemy actually occupies/reaches a different radius,
  // whichever path produced the multiplier (a dedicated giant/baby type's
  // static config, or the giant-flag instance flag below).
  sizeMultiplier?: number;
  isGiant?: boolean;
  // Non-zero while a parry stun is active (ms timestamp, same epoch as Date.now()).
  ragdollStunUntilMs?: number;
  // Phase Man: while Date.now() < this, the enemy is intangible - every
  // damage path (melee, projectile, drone, slam) is gated off centrally in
  // GameCanvas's handleEnemyHit, and Player's hit-test skips it entirely.
  phasedUntilMs?: number;
  // Split Man: set on the two copies so they never split again.
  hasSplit?: boolean;
  // Remaining split GENERATIONS for cube/ball splitters (giant slime 2,
  // colossal slime 3; plain cubes leave it unset = one implicit split).
  // Decremented onto each mini; 0 = the minis are final.
  splitsLeft?: number;
  // While Date.now() < this, the enemy ignores helpers/civilians and hunts
  // the player - set whenever the player lands a melee hit on it.
  aggroPlayerUntilMs?: number;
  // Sandbox "Armoured" spawn option: straps Armour Man's plates onto any type.
  hasArmour?: boolean;
  // Resilient Man / Super Resilient Man: remaining "cheat death" charges.
  // On what would be a killing blow, GameCanvas restores full health and
  // decrements this instead of finalizing the kill, reusing the existing
  // ragdollStunUntilMs knockdown-then-recover flow as the revive's visual.
  revivesLeft?: number;
  // Enemy Bodyguard: the enemy it shadows, and the alert window opened when
  // that protectee takes damage (during which the guard fights normally).
  protecteeId?: string;
  guardAlertUntilMs?: number;
  // Minion: flat damage added on top of the config payload's base damage,
  // baked at spawn time from the player's strongest helper (see
  // GameCanvas's applyMinionStats) - folded into the damageBonus prop.
  extraDamage?: number;
  // Set the instant health crosses to 0 - used only to rank dead-but-not-
  // yet-sunk bodies oldest-first against the global DEAD_BODY_LIMIT.
  diedAt?: number;
}

// The civilian FAMILY: plain civilians plus the armed neutral units that
// share their plumbing (enemy targeting, status effects, hit-tests, bars).
export type CivilianRole = 'civilian' | 'armyMelee' | 'armyRanged' | 'bodyguard' | 'vip';

export const isArmyRole = (role?: CivilianRole): boolean =>
  role === 'armyMelee' || role === 'armyRanged' || role === 'bodyguard';

// Army men proactively engage enemies on sight rather than waiting to be
// provoked, so these two fractions decide when self-preservation wins.
// Below URGENT they break off mid-fight to heal; below SEEK they only go for
// a medkit once nothing is left to fight.
export const ARMY_MEDKIT_URGENT_FRACTION = 0.25;
export const ARMY_MEDKIT_SEEK_FRACTION = 0.55;
export const ARMY_MEDKIT_HEAL = 8;

// A hurt army man draws help. Every army man independently computes the same
// ordering from the same roster, so the nearest N agree on who responds
// without any shared state or messaging between them.
export const ARMY_SUPPORT_LOW_FRACTION = 0.5;
export const ARMY_SUPPORT_RADIUS = 24;
export const ARMY_SUPPORT_RESPONDERS = 2;

// A frightened civilian runs toward protection rather than just away from
// the threat — which conveniently drags the threat into an army man's sight.
export const CIVILIAN_SEEK_ARMY_RADIUS = 26;

// The VIP: a high-value civilian who spawns with a permanent escort.
export const VIP_MAX_HEALTH = 24;
export const VIP_BODYGUARD_COUNT = 3;
export const BODYGUARD_PROTECT_DISTANCE = 2.6;

export interface CivilianState {
  id: string;
  // Defaults to 'civilian'. Army roles fight back when provoked; the
  // bodyguard shadows the player. None of them are helpers.
  role?: CivilianRole;
  // Bodyguards only: whose civilian they're escorting. Unset means they
  // shadow the player, which is the original sandbox bodyguard behaviour.
  protectCivilianId?: string;
  health: number;
  maxHealth: number;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  // Set once the PLAYER hits them - they flee the player too from then on.
  // (Plain civilians only; army roles retaliate instead.)
  fearsPlayer?: boolean;
  // Set when the player kills an enemy near them - they tail the player.
  followingPlayer?: boolean;
  // Army/bodyguard aggro: who they're currently hunting, until when.
  aggroPlayer?: boolean;
  aggroEnemyId?: string;
  aggroUntilMs?: number;
  // Bystander panic: witnessed a civilian/armyman being attacked nearby -
  // flee away from the scene (panicFromX/Z) until panicUntilMs.
  panicUntilMs?: number;
  panicFromX?: number;
  panicFromZ?: number;
  diedAt?: number;
  // Own status-effect struct (mirrors the player's) - lets enemy specials
  // (burn/freeze/stun/pull/knockback/slow) actually affect civilians instead
  // of only their flat damage.
  statusEffects: StatusEffects;
}

// A live Bomb Man bomb waiting out its fuse. fuseRemaining is a plain
// mutable field ticked by Bombs.tsx's useFrame (delta-based so pausing
// actually freezes the fuse), same convention as position/velocity vectors.
export interface BombState {
  id: string;
  position: THREE.Vector3;
  fuseRemaining: number;
  fuseTotal: number;
}

// Trapper Man's placed mines (sandbox-exclusive): near-invisible, sit until
// stepped on (no timer), then stun/knock back whoever triggered it.
export interface MineState {
  id: string;
  position: THREE.Vector3;
}

// One deployed turret - either the player's (from the 'turret' upgrade,
// permanent and indestructible) or an Engineer Man sentry (killable by the
// player's melee, expires after ENEMY_TURRET_LIFETIME_MS).
export interface TurretState {
  id: string;
  owner: 'player' | 'enemy';
  position: THREE.Vector3;
  health: number;
  maxHealth: number;
  // Enemy turrets: wall-clock expiry. Player turrets never expire.
  expiresAtMs?: number;
}

export interface PlayerCorpseState {
  id: string;
  position: THREE.Vector3;
  rotationY: number;
  diedAt: number;
}

export interface HelperState {
  id: string;
  instanceKey: number;
  pickCount: number;
  maxHealth: number;
  punchDamage: number;
  kickDamage: number;
  health: number;
  moveSpeedMultiplier: number;
  attackSpeedMultiplier: number;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  // Set when spawned from an enemy type — renders with the enemy's own color/scale/shape
  overrideColor?: string;
  overrideSizeMultiplier?: number;
  overrideType?: string; // EnemyType stored as string to avoid circular dep with enemyConfig.ts
  // Sandbox-exclusive "Bodyguard" unit: when this helper dies, it is NOT
  // auto-replaced (every other helper is, permanently, via handleHelperSunk).
  noRespawn?: boolean;
  // Ranged Helpers upgrade: kites at range and fires bolts (damage scales
  // with punchDamage) instead of closing to melee.
  isRanged?: boolean;
}

// Serialisable snapshot of a helper — no THREE objects, safe for localStorage.
export interface SavedHelper {
  id: string;
  pickCount: number;
  maxHealth: number;
  health: number;
  punchDamage: number;
  kickDamage: number;
  moveSpeedMultiplier: number;
  attackSpeedMultiplier: number;
  overrideColor?: string;
  overrideSizeMultiplier?: number;
  overrideType?: string;
  noRespawn?: boolean;
  isRanged?: boolean;
}
