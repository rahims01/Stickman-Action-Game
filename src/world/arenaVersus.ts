import * as THREE from 'three';
import { EnemyType } from './enemyConfig';
import { ArenaRoom, FINAL_TIER, RoomTier, pickRoom, poolForRoom } from './arenaRooms';

/**
 * Arena vs AI.
 *
 * Two arena runs side by side, one life each, first to fall loses. The two
 * runs are genuinely INDEPENDENT — separate room draws, separate wave
 * counters, separate spawns — so you are not racing someone through an
 * identical course, you are racing them through your own. That is the whole
 * point of the mode: the pressure comes from a number on the other side of
 * the screen going up faster than yours, not from watching them solve the
 * same puzzle.
 */

export const VERSUS_MAX_HEALTH = 24;
export const VERSUS_PLAYER_DAMAGE = 4;
export const VERSUS_ATTACK_RANGE = 1.7;
export const VERSUS_ATTACK_COOLDOWN = 0.6;
export const VERSUS_HIT_WINDUP = 0.22;

export const VERSUS_ARENA_RADIUS = 13;
export const VERSUS_PLAYER_SPEED = 6.2;

/** Waves in one room before the run moves up a tier. Shorter than the solo
 *  arena, because a versus match should not take twenty minutes. */
export const VERSUS_WAVES_PER_TIER = 4;

/** Concurrent enemies are capped hard: two live scenes render at once, and a
 *  screen full of skinned meshes on each side is where the frame rate goes. */
export const VERSUS_MAX_ALIVE = 5;

export interface VersusEnemyState {
  id: string;
  type: EnemyType;
  material: string;
  position: THREE.Vector3;
  health: number;
  maxHealth: number;
  damage: number;
  speed: number;
  attackCooldown: number;
  /** Set when killed; the body ragdolls, then is culled. */
  diedAt: number | null;
}

export interface VersusSideState {
  id: 'player' | 'ai';
  isHuman: boolean;
  tint: string;
  health: number;
  wave: number;
  roomsEntered: number;
  room: ArenaRoom;
  kills: number;
  position: THREE.Vector3;
  facing: number;
  attackCooldown: number;
  hitLock: number;
  dead: boolean;
}

/** A colour the AI wears, picked per match so the two sides never match. */
export const AI_TINTS = ['#e74c3c', '#8e44ad', '#16a085', '#d68910', '#2c6fbb', '#c0392b', '#27ae60'];

export const randomAiTint = (avoid?: string): string => {
  const pool = AI_TINTS.filter((c) => c.toLowerCase() !== (avoid ?? '').toLowerCase());
  return pool[Math.floor(Math.random() * pool.length)];
};

export const tierFor = (roomsEntered: number): RoomTier =>
  Math.min(FINAL_TIER, Math.max(1, roomsEntered + 1)) as RoomTier;

export const createSide = (
  id: 'player' | 'ai',
  isHuman: boolean,
  tint: string
): VersusSideState => ({
  id,
  isHuman,
  tint,
  health: VERSUS_MAX_HEALTH,
  wave: 0,
  roomsEntered: 1,
  // Drawn independently per side — the two runs do not share a seed.
  room: pickRoom(1),
  kills: 0,
  position: new THREE.Vector3(),
  facing: 0,
  attackCooldown: 0,
  hitLock: 0,
  dead: false
});

/**
 * The roster for one wave of one side. Scales with the wave number and draws
 * from that side's own current room, so the two screens rarely show the same
 * enemies even at the same wave.
 */
export const versusWaveRoster = (side: VersusSideState): { type: EnemyType; elite: boolean }[] => {
  const pool = poolForRoom(side.room);
  const count = Math.min(2 + Math.floor(side.wave / 2), VERSUS_MAX_ALIVE);
  const out: { type: EnemyType; elite: boolean }[] = [];
  for (let i = 0; i < count; i++) {
    out.push({ type: pool[Math.floor(Math.random() * pool.length)], elite: false });
  }
  // The room's own special headlines every third wave.
  if (side.wave % 3 === 0) out.push({ type: side.room.special, elite: true });
  return out;
};
