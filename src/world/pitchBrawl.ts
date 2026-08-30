import * as THREE from 'three';
import { AABB } from './worldObjects';

// Pitch Brawl — the Ultimate Soccer crossover mode.
//
// 3v3, one free ball, first to three goals. Every value here traces back to
// the joint spec: Ultimate Soccer supplied the ball and AI numbers from their
// own source, and the arena/goal dimensions came out of scaling those down
// together. See the Pitch Brawl design doc for the derivations.

// ── Arena ────────────────────────────────────────────────────────────────
// Walled, so the ball never leaves play: no throw-ins, corners or restarts.
export const PITCH_HALF_X = 15;
export const PITCH_HALF_Z = 10;
export const PITCH_WALL_THICKNESS = 0.8;
export const PITCH_WALL_HEIGHT = 1.6;

// ── Goals ────────────────────────────────────────────────────────────────
// Width and height are deliberately set on DIFFERENT axes rather than by
// football proportion. Proportion assumes a keeper exists; with no keeper a
// 7.32 m mouth means every shot on target scores. So height is human-relative
// (a stickman can't hop it) and width is set by defendability — one body in
// the mouth covers a real fraction of it without covering all of it.
export const GOAL_HALF_WIDTH = 1.5;
export const GOAL_HEIGHT = 2.0;
export const GOAL_POST_RADIUS = 0.12;
export const GOALS_TO_WIN = 3;

// ── Ball ─────────────────────────────────────────────────────────────────
// Ultimate Soccer's constants. The ball is NOT a cannon-es rigid body: it's a
// sphere on a flat plane, so integrating position and velocity directly is
// both sufficient and immune to the two problems a rigid body would have hit
// here — cannon-es has no CCD (a 14 m/s shot tunnels thin geometry at 1/60),
// and the world's ragdoll-tuned contact material would have killed the bounce.
export const BALL_RADIUS = 0.2;
export const BALL_MASS = 0.43;
export const BALL_RESTITUTION = 0.7;
export const BALL_LINEAR_DAMPING = 0.22;
export const BALL_MAGNUS_K = 0.003;
export const BALL_REST_SPEED = 0.35;
// Sub-steps per frame. Cheap here, and it keeps a shot from stepping through
// a wall or past the goal line between samples.
export const BALL_SUBSTEPS = 4;

export const SHOT_SPEED = 14;
export const THROUGH_SPEED = 12;
export const PASS_SPEED = 10;
export const STRUCK_SPIN = 11;

// ── Players ──────────────────────────────────────────────────────────────
export const PITCH_PLAYER_RADIUS = 0.42;
export const RUN_SPEED = 7.2;
export const SPRINT_SPEED = 9.2;
export const SPRINT_BEYOND = 8;
export const TACKLE_COMMIT_RANGE = 1.7;
export const TACKLE_COOLDOWN = 1.6;
export const KICK_REACH = 1.1;

// A landed tackle puts BOTH players down for the same time. Equal costs take
// the attacker's advantage to zero — otherwise flattening the last defender
// buys an open goal, and the mode collapses into "charge, flatten, tap in".
export const TACKLE_DOWN_MS = 3000;
// A miss is only a stumble, not a flop. Symmetric ragdoll already fixes
// dominance on its own, so the whiff's only job is risk — and over-pricing it
// means nobody tackles, which removes the thing the mode exists to show off.
export const WHIFF_STUMBLE_MS = 900;

export const KICKOFF_SETTLE_MS = 700;

export const PITCH_WALL_COLLIDERS: AABB[] = [
  // +X and -X end walls
  { id: 'pitch-wall-px', minX: PITCH_HALF_X, maxX: PITCH_HALF_X + PITCH_WALL_THICKNESS, minZ: -PITCH_HALF_Z - PITCH_WALL_THICKNESS, maxZ: PITCH_HALF_Z + PITCH_WALL_THICKNESS, topY: PITCH_WALL_HEIGHT },
  { id: 'pitch-wall-nx', minX: -PITCH_HALF_X - PITCH_WALL_THICKNESS, maxX: -PITCH_HALF_X, minZ: -PITCH_HALF_Z - PITCH_WALL_THICKNESS, maxZ: PITCH_HALF_Z + PITCH_WALL_THICKNESS, topY: PITCH_WALL_HEIGHT },
  // +Z and -Z side walls
  { id: 'pitch-wall-pz', minX: -PITCH_HALF_X, maxX: PITCH_HALF_X, minZ: PITCH_HALF_Z, maxZ: PITCH_HALF_Z + PITCH_WALL_THICKNESS, topY: PITCH_WALL_HEIGHT },
  { id: 'pitch-wall-nz', minX: -PITCH_HALF_X, maxX: PITCH_HALF_X, minZ: -PITCH_HALF_Z - PITCH_WALL_THICKNESS, maxZ: -PITCH_HALF_Z, topY: PITCH_WALL_HEIGHT }
];

export type PitchSide = 'home' | 'away';

// Home defends -X, away defends +X.
export const goalLineX = (side: PitchSide): number => (side === 'home' ? -PITCH_HALF_X : PITCH_HALF_X);

/**
 * Swept goal-line test: clips the segment the ball travelled this step
 * against the goal plane and checks the crossing point, rather than sampling
 * the ball's position after the step. A position test is exactly what a fast
 * shot steps straight past.
 *
 * Returns the side whose goal was scored in, or null.
 */
export const sweptGoalCheck = (
  prevX: number,
  prevZ: number,
  nextX: number,
  nextZ: number
): PitchSide | null => {
  for (const side of ['home', 'away'] as PitchSide[]) {
    const line = goalLineX(side);
    const crossed = side === 'home' ? prevX > line && nextX <= line : prevX < line && nextX >= line;
    if (!crossed) continue;
    const t = (line - prevX) / (nextX - prevX || 1e-6);
    const z = prevZ + (nextZ - prevZ) * t;
    // Strict, no radius padding — a ball level with a post is out.
    if (Math.abs(z) < GOAL_HALF_WIDTH - 0.02) return side;
  }
  return null;
};

// Per-player runtime state. Position/velocity are mutable Vector3s mutated in
// place by the actor's own useFrame, matching how every other entity in this
// project works — only the scoreline ever goes through React state.
export interface PitchPlayerState {
  id: string;
  side: PitchSide;
  isHuman: boolean;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  // Date.now() timestamp; while in the future this player is on the floor.
  downUntilMs: number;
  // Set alongside downUntilMs: a landed tackle ragdolls, a whiff only stumbles.
  downIsRagdoll: boolean;
  tackleCooldown: number;
}

export interface BallState {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  // Signed spin about the vertical axis; drives the Magnus bend in flight.
  spin: number;
  // Who last touched it, for the own-goal rule.
  lastTouchSide: PitchSide | null;
}

export const kickoffSpots = (side: PitchSide, index: number): [number, number] => {
  const dir = side === 'home' ? -1 : 1;
  const spots: [number, number][] = [
    [dir * 3, 0],
    [dir * 7, -4.5],
    [dir * 7, 4.5]
  ];
  const s = spots[index % spots.length];
  return [s[0], s[1]];
};
