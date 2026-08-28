import * as THREE from 'three';

// Plain mutable struct + pure helpers, no React state - ticked every frame
// from a useFrame loop (mirrors every other per-frame value in this
// codebase, e.g. Player.tsx's oneShotTimerRef). Shared shape for both the
// player and every EnemyActor instance.
export interface StatusEffects {
  burnUntil: number;
  burnDamagePerSecond: number;
  lastBurnTick: number;
  freezeUntil: number;
  ragdollStunUntil: number;
  ragdollStunImpulse: THREE.Vector3 | null;
  // True while the ragdoll stun is an electric shock (yellow-man shockPunch)
  // - drives a body-shaking + color-flash visual in Player.tsx.
  isElectricStun: boolean;
  pullTarget: THREE.Vector3 | null;
  pullUntil: number;
  auraColor: string | null;
  auraUntil: number;
  pendingKnockback: THREE.Vector3 | null;
  slowUntil: number;
  slowMultiplier: number;
  // Magnet Man's constant weak drag: refreshed every frame while in range,
  // so it dies out the instant he stops projecting it. Unlike the pull
  // (hard lerp lock), this is a gentle drift the victim can walk against.
  // Negative strength = the Repulsor's push AWAY from the target.
  magnetUntil: number;
  magnetTarget: THREE.Vector3;
  magnetStrength: number;
}

export const createStatusEffects = (): StatusEffects => ({
  burnUntil: 0,
  burnDamagePerSecond: 0,
  lastBurnTick: 0,
  freezeUntil: 0,
  ragdollStunUntil: 0,
  ragdollStunImpulse: null,
  isElectricStun: false,
  pullTarget: null,
  pullUntil: 0,
  auraColor: null,
  auraUntil: 0,
  pendingKnockback: null,
  slowUntil: 0,
  slowMultiplier: 1,
  magnetUntil: 0,
  magnetTarget: new THREE.Vector3(),
  magnetStrength: 0
});

// Magnet Man / Repulsor refresh this every frame the target is in range.
// Positive strength drifts the victim TOWARD `from`; negative pushes away.
export const applyMagnetDrift = (effects: StatusEffects, now: number, from: THREE.Vector3, strength: number) => {
  effects.magnetUntil = now + 0.25;
  effects.magnetTarget.copy(from);
  effects.magnetStrength = strength;
};

export const isMagnetized = (effects: StatusEffects, now: number) => now < effects.magnetUntil;

export const applyBurn = (effects: StatusEffects, now: number, durationSec: number, dps: number, auraColor: string) => {
  effects.burnUntil = now + durationSec;
  effects.burnDamagePerSecond = dps;
  effects.lastBurnTick = now;
  applyAura(effects, now, durationSec, auraColor);
};

export const applyFreeze = (effects: StatusEffects, now: number, durationSec: number, auraColor: string) => {
  effects.freezeUntil = now + durationSec;
  applyAura(effects, now, durationSec, auraColor);
};

export const applyRagdollStun = (
  effects: StatusEffects,
  now: number,
  durationSec: number,
  impulse?: THREE.Vector3,
  auraColor?: string,
  isElectric = false
) => {
  effects.ragdollStunUntil = now + durationSec;
  effects.ragdollStunImpulse = impulse ?? null;
  effects.isElectricStun = isElectric;
  if (auraColor) applyAura(effects, now, durationSec, auraColor);
};

export const applyPull = (effects: StatusEffects, now: number, durationSec: number, target: THREE.Vector3, auraColor: string) => {
  effects.pullUntil = now + durationSec;
  effects.pullTarget = target.clone();
  applyAura(effects, now, durationSec, auraColor);
};

export const applyAura = (effects: StatusEffects, now: number, durationSec: number, color: string) => {
  effects.auraColor = color;
  effects.auraUntil = now + durationSec;
};

export const applySlow = (effects: StatusEffects, now: number, durationSec: number, multiplier: number, auraColor?: string) => {
  effects.slowUntil = now + durationSec;
  effects.slowMultiplier = multiplier;
  if (auraColor) applyAura(effects, now, durationSec, auraColor);
};

export const setKnockback = (effects: StatusEffects, direction: THREE.Vector3, speed: number) => {
  const flat = direction.clone();
  flat.y = 0;
  if (flat.lengthSq() < 1e-6) return;
  flat.normalize().multiplyScalar(speed);
  effects.pendingKnockback = flat;
};

export const isFrozen = (effects: StatusEffects, now: number) => now < effects.freezeUntil;
export const isRagdollStunned = (effects: StatusEffects, now: number) => now < effects.ragdollStunUntil;
export const isPulled = (effects: StatusEffects, now: number) => now < effects.pullUntil;
export const isBurning = (effects: StatusEffects, now: number) => now < effects.burnUntil;
export const hasAura = (effects: StatusEffects, now: number) => now < effects.auraUntil;
export const isSlowed = (effects: StatusEffects, now: number) => now < effects.slowUntil;
// 1 = normal speed, always safe to multiply into a movement speed unconditionally.
export const getSlowFactor = (effects: StatusEffects, now: number): number => (now < effects.slowUntil ? effects.slowMultiplier : 1);

// Returns the burn damage due this tick (0 if none owed yet), advancing the
// internal 1-second ticker as a side effect.
export const tickBurn = (effects: StatusEffects, now: number): number => {
  if (now >= effects.burnUntil) return 0;
  if (now - effects.lastBurnTick < 1) return 0;
  effects.lastBurnTick = now;
  return effects.burnDamagePerSecond;
};
