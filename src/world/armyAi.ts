import {
  ARMY_FOCUS_DISTANCE_WEIGHT,
  ARMY_MEDIC_FLEE_RADIUS,
  ARMY_MEDIC_SEEK_RADIUS,
  ARMY_MEDKIT_SEEK_FRACTION,
  ARMY_MEDKIT_URGENT_FRACTION,
  ARMY_SERGEANT_ATTACK_SPEED_BONUS,
  ARMY_SERGEANT_AURA_RADIUS,
  ARMY_SERGEANT_DAMAGE_BONUS,
  ARMY_SIGHT_RADIUS,
  ARMY_SUPPORT_LOW_FRACTION,
  ARMY_SUPPORT_RADIUS,
  ARMY_SUPPORT_RESPONDERS,
  CivilianRole,
  CivilianState,
  EnemyState,
  isArmyRole,
  isFightingArmyRole
} from './gameState';

/**
 * The army's decisions, lifted out of CivilianActor's frame loop.
 *
 * Everything here is a pure function of (where I am, who else is on the
 * field). That matters for two reasons: these are the rules that make a
 * squad read as a squad rather than as five people standing near each other,
 * and until they were extracted there was no way to test any of them -
 * they lived inside a useFrame closure with a mutable THREE.Object3D.
 */

/** Horizontal distance; every decision here ignores height. */
const flatDistance = (ax: number, az: number, bx: number, bz: number): number =>
  Math.hypot(ax - bx, az - bz);

/**
 * Focus fire.
 *
 * NOT "the nearest one" - the one the squad should be finishing. Every
 * soldier scores identically from the same roster, so they converge on the
 * same wounded body with no coordination between them, and enemies actually
 * die instead of five men each chipping a different full-health target.
 */
export const pickFocusTarget = (
  from: { x: number; z: number },
  enemies: EnemyState[],
  sightRadius: number = ARMY_SIGHT_RADIUS
): EnemyState | undefined => {
  let best: EnemyState | undefined;
  let bestScore = Infinity;
  for (const enemy of enemies) {
    if (enemy.health <= 0) continue;
    const distance = flatDistance(from.x, from.z, enemy.position.x, enemy.position.z);
    if (distance > sightRadius) continue;
    const score = enemy.health + distance * ARMY_FOCUS_DISTANCE_WEIGHT;
    if (score < bestScore) {
      bestScore = score;
      best = enemy;
    }
  }
  return best;
};

/** Closest living enemy, regardless of sight. Used for flee decisions. */
export const nearestEnemy = (
  from: { x: number; z: number },
  enemies: EnemyState[]
): { enemy: EnemyState | undefined; distance: number } => {
  let enemy: EnemyState | undefined;
  let distance = Infinity;
  for (const candidate of enemies) {
    if (candidate.health <= 0) continue;
    const d = flatDistance(from.x, from.z, candidate.position.x, candidate.position.z);
    if (d < distance) {
      distance = d;
      enemy = candidate;
    }
  }
  return { enemy, distance };
};

/**
 * Is there a living sergeant in earshot? Worth more than any single upgrade:
 * the men around him hit harder, swing faster, and stop breaking off to hunt
 * medkits while there is still shooting.
 */
export const hasSergeantNearby = (
  self: { id: string; role?: CivilianRole; x: number; z: number },
  civilians: CivilianState[],
  radius: number = ARMY_SERGEANT_AURA_RADIUS
): boolean => {
  // A sergeant does not buff himself.
  if (self.role === 'armySergeant') return false;
  for (const c of civilians) {
    if (c.health <= 0 || c.role !== 'armySergeant' || c.id === self.id) continue;
    if (flatDistance(self.x, self.z, c.position.x, c.position.z) <= radius) return true;
  }
  return false;
};

export interface SergeantBonus {
  damageMultiplier: number;
  /** Multiplies a cooldown, so under 1 means faster. */
  cooldownScale: number;
}

export const sergeantBonus = (inAura: boolean): SergeantBonus => ({
  damageMultiplier: inAura ? 1 + ARMY_SERGEANT_DAMAGE_BONUS : 1,
  cooldownScale: inAura ? 1 / (1 + ARMY_SERGEANT_ATTACK_SPEED_BONUS) : 1
});

/**
 * Break off to heal?
 *
 * Critically hurt, a soldier goes mid-fight. Merely hurt, he waits for the
 * shooting to stop - and with a sergeant on the field he does not go at all
 * while an enemy is in sight, which is the aura's second and less obvious
 * effect.
 */
export const wantsMedkit = (
  healthFraction: number,
  medkitsAvailable: number,
  enemyInSight: boolean,
  sergeantNear: boolean
): boolean => {
  if (medkitsAvailable <= 0) return false;
  if (healthFraction < ARMY_MEDKIT_URGENT_FRACTION) return true;
  return healthFraction < ARMY_MEDKIT_SEEK_FRACTION && !enemyInSight && !sergeantNear;
};

/**
 * Who answers a call for help.
 *
 * Every soldier derives the same ordering from the same roster, so the two
 * nearest agree on who goes without any message passing. The medic is
 * excluded - he has his own job and will not fight for the casualty.
 */
export const supportResponders = (
  victim: CivilianState,
  civilians: CivilianState[],
  limit: number = ARMY_SUPPORT_RESPONDERS
): CivilianState[] =>
  civilians
    .filter(
      (c) =>
        c.health > 0 &&
        isFightingArmyRole(c.role) &&
        c.id !== victim.id &&
        c.health / c.maxHealth >= ARMY_SUPPORT_LOW_FRACTION
    )
    .sort(
      (a, b) =>
        flatDistance(a.position.x, a.position.z, victim.position.x, victim.position.z) -
        flatDistance(b.position.x, b.position.z, victim.position.x, victim.position.z)
    )
    .slice(0, limit);

/** The nearest comrade hurt badly enough to be worth breaking off for. */
export const findComradeInTrouble = (
  self: { id: string; x: number; z: number },
  civilians: CivilianState[],
  radius: number = ARMY_SUPPORT_RADIUS
): CivilianState | undefined => {
  let found: CivilianState | undefined;
  let bestDistance = Infinity;
  for (const c of civilians) {
    if (c.id === self.id || c.health <= 0 || !isArmyRole(c.role)) continue;
    if (c.health / c.maxHealth >= ARMY_SUPPORT_LOW_FRACTION) continue;
    const d = flatDistance(self.x, self.z, c.position.x, c.position.z);
    if (d <= radius && d < bestDistance) {
      bestDistance = d;
      found = c;
    }
  }
  return found;
};

/**
 * The medic's patient: worst hurt first, with distance only as a tiebreak,
 * so he crosses the field for someone on their last legs rather than topping
 * up whoever happens to be nearest.
 */
export const pickMedicPatient = (
  self: { id: string; x: number; z: number },
  civilians: CivilianState[],
  seekRadius: number = ARMY_MEDIC_SEEK_RADIUS
): CivilianState | undefined => {
  let patient: CivilianState | undefined;
  let bestScore = Infinity;
  for (const c of civilians) {
    if (c.id === self.id || c.health <= 0 || !isArmyRole(c.role)) continue;
    const fraction = c.maxHealth > 0 ? c.health / c.maxHealth : 1;
    if (fraction >= 1) continue;
    const distance = flatDistance(self.x, self.z, c.position.x, c.position.z);
    if (distance > seekRadius) continue;
    const score = fraction + distance / (seekRadius * 8);
    if (score < bestScore) {
      bestScore = score;
      patient = c;
    }
  }
  return patient;
};

export type MedicIntent = 'flee' | 'treat' | 'selfHeal' | 'escort' | 'hold';

/**
 * What the medic does this frame, in priority order. Running outranks
 * everything - he carries no weapon at all, and a medic who stands his
 * ground is a medic who dies.
 */
export const medicIntent = (opts: {
  healthFraction: number;
  nearestEnemyDistance: number;
  playerHostile: boolean;
  playerDistance: number;
  hasPatient: boolean;
  hasMedkit: boolean;
  hasEscort: boolean;
  fleeRadius?: number;
}): MedicIntent => {
  const fleeRadius = opts.fleeRadius ?? ARMY_MEDIC_FLEE_RADIUS;
  const enemyClose = opts.nearestEnemyDistance <= fleeRadius;
  const playerClose = opts.playerHostile && opts.playerDistance <= fleeRadius;
  if (enemyClose || playerClose) return 'flee';
  if (opts.hasPatient) return 'treat';
  if (opts.hasMedkit) return 'selfHeal';
  if (opts.hasEscort) return 'escort';
  return 'hold';
};

/**
 * Where to run when breaking off from several threats at once: away from
 * their average position, not from the nearest one. Backing off from one
 * enemy straight into another is how a medic dies twice.
 */
export const fleeHeadingFrom = (
  self: { x: number; z: number },
  threats: { x: number; z: number }[]
): number | null => {
  if (threats.length === 0) return null;
  let cx = 0;
  let cz = 0;
  for (const t of threats) {
    cx += t.x;
    cz += t.z;
  }
  const dx = self.x - cx / threats.length;
  const dz = self.z - cz / threats.length;
  if (Math.abs(dx) < 1e-6 && Math.abs(dz) < 1e-6) return null;
  return Math.atan2(dx, dz);
};

/**
 * The radioman's call. He asks for more only when his side is actually
 * losing on numbers nearby - which is what stops him summoning a second
 * squad to a fight that is already won.
 */
export const shouldCallReinforcements = (
  self: { x: number; z: number },
  enemies: EnemyState[],
  civilians: CivilianState[],
  scanRadius: number
): boolean => {
  let hostiles = 0;
  for (const e of enemies) {
    if (e.health <= 0) continue;
    if (flatDistance(self.x, self.z, e.position.x, e.position.z) <= scanRadius) hostiles++;
  }
  let friends = 0;
  for (const c of civilians) {
    if (c.health <= 0 || !isFightingArmyRole(c.role)) continue;
    if (flatDistance(self.x, self.z, c.position.x, c.position.z) <= scanRadius) friends++;
  }
  return hostiles > friends;
};

/**
 * Where a frightened civilian runs. Toward a soldier who will actually shoot
 * back, never toward the medic - he runs from the same thing they do.
 * Returns nothing once they are already tucked in behind him.
 */
export const findGuardian = (
  self: { x: number; z: number },
  civilians: CivilianState[],
  seekRadius: number,
  closeEnough: number
): CivilianState | undefined => {
  let guardian: CivilianState | undefined;
  let bestDistance = Infinity;
  for (const c of civilians) {
    if (c.health <= 0 || !isFightingArmyRole(c.role)) continue;
    const d = flatDistance(self.x, self.z, c.position.x, c.position.z);
    if (d <= seekRadius && d < bestDistance) {
      bestDistance = d;
      guardian = c;
    }
  }
  return guardian && bestDistance < closeEnough ? undefined : guardian;
};

/**
 * The soldier a medic tucks in behind when there is nobody to treat. Nearest
 * FIGHTING soldier - standing next to another medic is no safer than
 * standing alone, which is the whole point of the distinction.
 */
export const medicEscort = (
  self: { id: string; x: number; z: number },
  civilians: CivilianState[]
): CivilianState | undefined => {
  let escort: CivilianState | undefined;
  let bestDistance = Infinity;
  for (const c of civilians) {
    if (c.id === self.id || c.health <= 0 || !isFightingArmyRole(c.role)) continue;
    const d = flatDistance(self.x, self.z, c.position.x, c.position.z);
    if (d < bestDistance) {
      bestDistance = d;
      escort = c;
    }
  }
  return escort;
};
