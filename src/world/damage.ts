import { CRIT_DAMAGE_MULTIPLIER } from './gameState';

/**
 * Damage arithmetic, pulled out of GameCanvas and Player.
 *
 * This is the chokepoint every hit in the game passes through, and it has
 * already produced one live bug: a shield bearer punched for the arena's bare
 * PUNCH_DAMAGE of 1 gave round(1 x 0.2) = 0, so hits landed and reported
 * nothing. It was reported as "my damage turns to 0". Arithmetic that can do
 * that deserves to be testable.
 */

/**
 * Round to the nearest integer, but keep exact halves.
 *
 * Several bonuses land on .5 (SPEED_BONUS_PER_PICK-style halves, the arena's
 * per-wave creep), and a player who picked a +0.5 upgrade should see it in the
 * floating damage number rather than watching it round away.
 */
export const roundDamage = (value: number): number => {
  const fraction = value - Math.floor(value);
  return fraction === 0.5 ? value : Math.round(value);
};

/** A shield turns a frontal punch into chip damage. Kicks go round it. */
export const SHIELD_PUNCH_MULTIPLIER = 0.2;

export interface HitResolution {
  rawDamage: number;
  /** The defender's ENEMY_CONFIGS.hasShield. */
  hasShield?: boolean;
  attackKind?: 'punch' | 'kick';
  /** The One-Hit run modifier: any real hit is lethal, shields included. */
  oneHit?: boolean;
  /** Needed only so One-Hit can report exactly lethal damage. */
  targetHealth: number;
}

/**
 * What a landed hit actually takes off, after the shield, the rounding and
 * the One-Hit modifier.
 *
 * The floor is the important part: a hit that CONNECTED never reads as 0.
 * Chip damage is what a shield is for, not immunity, and a 0 in the damage
 * numbers reads to a player as a broken game rather than as a good block.
 */
export const resolveHitDamage = (hit: HitResolution): number => {
  if (hit.rawDamage <= 0) return 0;
  // One-Hit ignores everything else, shields included.
  if (hit.oneHit) return hit.targetHealth;

  const blocked = hit.hasShield && hit.attackKind === 'punch';
  const scaled = blocked ? Math.round(hit.rawDamage * SHIELD_PUNCH_MULTIPLIER) : roundDamage(hit.rawDamage);
  return Math.max(1, scaled);
};

/**
 * The deterministic half of a crit. Rounded to one decimal so the floating
 * damage number never shows an ugly fraction.
 */
export const critDamage = (baseDamage: number, multiplier: number = CRIT_DAMAGE_MULTIPLIER): number =>
  Math.round(baseDamage * multiplier * 10) / 10;

/**
 * Roll a crit. Separated from critDamage so the arithmetic can be tested
 * without the randomness, and the randomness without the arithmetic.
 */
export const rollCritDamage = (
  baseDamage: number,
  critChance: number,
  roll: number = Math.random()
): number => (roll >= critChance ? baseDamage : critDamage(baseDamage));
