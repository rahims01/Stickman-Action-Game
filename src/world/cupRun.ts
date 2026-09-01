// Cup Run — the second half of the Ultimate Soccer crossover.
//
// Pitch Brawl had to delete almost everything Ultimate Soccer is best at:
// brackets, seeding, ceremony. Cup Run reclaims exactly those. Their team
// contributed the tournament structure as technique; the fighting, the arenas
// and the ragdolls are ours. Between them the two modes finally use both
// games fully instead of each using half of one.
//
// Their one steer, respected here: the bracket and seeding port as a CONCEPT.
// Their trophy ceremony is 3D confetti and a camera orbit, so ours is built in
// our own style rather than reproduced.

export const CUP_FIGHTER_COUNT = 8;

export type CupRoundKind = 'quarter' | 'semi' | 'final';

export interface CupFighter {
  id: string;
  name: string;
  color: string;
  // 1 is the top seed. Drives both the bracket layout and how likely an AI
  // fighter is to win a match the player isn't in.
  seed: number;
  isPlayer: boolean;
  maxHealth: number;
  damage: number;
}

// Difficulty lives in BEHAVIOUR, not in the health bar. A 2x-HP version of
// the same fighter doesn't fight harder, it fights longer, which reads as
// tedium. So health barely moves across the draw and everything that makes a
// late-round opponent dangerous is in here — courtesy of Ultimate Soccer,
// whose difficulty settings vary exactly these levers and no stats at all.
export interface CupAiProfile {
  // Seconds in range before it commits to a swing. The window the player has
  // to beat it to the punch; without one a fight is either trivial or a
  // stunlock, with nothing in between.
  reactionDelay: number;
  // Wind-up before the hit actually lands. This is the tell — it turns
  // "I got hit" into "I should have seen that".
  telegraph: number;
  // Error injection: fraction of swings that visibly whiff. Generous early,
  // near-zero for the top seed.
  missChance: number;
  // Holds at the edge of its reach instead of walking into the player's face,
  // so late opponents are harder to corner and trade with.
  spacing: boolean;
  // Multiplies the gap between swings. Lower = more aggressive.
  tempo: number;
}

export const aiProfileForSeed = (seed: number): CupAiProfile => {
  // t: 0 for the weakest fighter in the draw, 1 for the top seed.
  const t = (CUP_FIGHTER_COUNT - seed) / (CUP_FIGHTER_COUNT - 1);
  return {
    // Deliberately NON-linear. Human visual reaction is ~0.20-0.25s, so
    // 0.35 -> 0.30 is imperceptible while 0.20 -> 0.15 is enormous: below
    // ~0.20 the player stops reacting and starts having to predict. That
    // threshold is the real difficulty cliff, and interpolating linearly
    // smears it across eight even steps so no single fight feels like a wall.
    // This curve keeps seeds 8-4 comfortably reactable (0.35 -> 0.27) and
    // drops 2 and 1 through the threshold (0.19, 0.15).
    reactionDelay: 0.35 - 0.2 * Math.pow(t, 1.6),
    // Flat, and it is what keeps even the top seed fair: 0.30s from wind-up
    // to impact stays reactable however fast the opponent commits. The final
    // is hard to catch off guard, but its swings are honest.
    telegraph: 0.15,
    // Capped well below half. Past ~0.4 a whiff stops reading as a bad
    // fighter and starts reading as broken hit detection. Most misses should
    // come from the spacing lever below instead: swinging from the wrong
    // distance whiffs believably, a dice roll does not.
    missChance: 0.35 - t * 0.3,
    spacing: t > 0.55,
    // Capped at 0.90, not 0.80. Reaction and tempo measure different things —
    // defensive skill versus aggression — and maxing both turns the final
    // into a relentless DPS race, which reads as a slider being turned up.
    // The memorable version is precise but PATIENT: threat from accuracy,
    // not frequency.
    tempo: 1.25 - t * 0.35
  };
};

export interface CupMatch {
  id: string;
  round: CupRoundKind;
  a: CupFighter | null;
  b: CupFighter | null;
  winner: CupFighter | null;
}

// Each round moves to a different arena, so a run reads as an escalation
// rather than three fights in the same box.
export interface CupArena {
  label: string;
  ground: string;
  wall: string;
  sky: string;
  fog: string;
  // Ambient hazard tint used for the round's lighting.
  light: string;
}

export const CUP_ARENAS: Record<CupRoundKind, CupArena> = {
  quarter: { label: 'The Concrete Yard', ground: '#5b5f63', wall: '#3b3f43', sky: '#8fa3b0', fog: '#8fa3b0', light: '#ffffff' },
  semi: { label: 'The Sand Pit', ground: '#c2a878', wall: '#8d7a55', sky: '#e0c9a0', fog: '#e0c9a0', light: '#ffe0b2' },
  final: { label: 'The Magma Floor', ground: '#4a1f14', wall: '#2b120c', sky: '#3a1208', fog: '#5c1d0c', light: '#ff7043' }
};

export const ROUND_ORDER: CupRoundKind[] = ['quarter', 'semi', 'final'];

export const ROUND_LABEL: Record<CupRoundKind, string> = {
  quarter: 'Quarter-final',
  semi: 'Semi-final',
  final: 'Final'
};

const FIGHTER_NAMES = [
  'Bruiser',
  'Iron Ted',
  'The Wall',
  'Quickfoot',
  'Old Grudge',
  'Crank',
  'Sledge',
  'Nine Lives',
  'Rattler',
  'Bone Idle',
  'The Mayor',
  'Gravedigger'
];

// Fisher-Yates. A (() => Math.random() - 0.5) comparator is not a uniform
// shuffle and biases toward leaving items near where they started, which
// matters here because it skews who the player is drawn against.
const shuffle = <T,>(arr: T[]): T[] => {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

const FIGHTER_COLORS = ['#c0392b', '#2c6fbb', '#8e44ad', '#16a085', '#d68910', '#7f8c8d', '#2c3e50'];

/** Builds the field: the player as one entrant plus seven AI, seeded 1..8. */
export const createCupField = (playerColor: string): CupFighter[] => {
  const names = shuffle([...FIGHTER_NAMES]);
  const colors = shuffle([...FIGHTER_COLORS]);

  // Placeholders first: seeds decide strength, so stats can't be assigned
  // until after the draw. Getting this backwards meant the top seed could be
  // the weakest fighter in the field and the final was no harder than the
  // first round — the ordering below is the whole point of a bracket.
  const field: CupFighter[] = [
    { id: 'player', name: 'You', color: playerColor, seed: 0, isPlayer: true, maxHealth: 20, damage: 3 }
  ];
  for (let i = 0; i < CUP_FIGHTER_COUNT - 1; i++) {
    field.push({
      id: `cpu-${i}`,
      name: names[i % names.length],
      color: colors[i % colors.length],
      seed: 0,
      isPlayer: false,
      maxHealth: 0,
      damage: 0
    });
  }

  // The player is drawn into a random slot so their path varies per run.
  const drawn = shuffle(field);
  drawn.forEach((f, i) => {
    f.seed = i + 1;
    if (f.isPlayer) return;
    // Seed 1 is the top seed and the toughest fighter; seed 8 the weakest.
    // Combined with 1v8 pairing and the strength-weighted simulation below,
    // stronger fighters tend to survive, so the final really is the hardest
    // fight the player will have.
    const rank = CUP_FIGHTER_COUNT - f.seed; // 7 for seed 1, 0 for seed 8
    // Health spans only 15 -> 22 (+47%). The first pass ran 12 -> 26 (+117%)
    // and that turns the final into a damage sponge: longer, not harder.
    f.maxHealth = 15 + rank;
    f.damage = 2 + Math.floor(rank / 3);
  });
  return drawn;
};

/** Standard single-elimination pairing: 1v8, 2v7, 3v6, 4v5 by seed order. */
export const createBracket = (field: CupFighter[]): CupMatch[] => {
  const bySeed = [...field].sort((a, b) => a.seed - b.seed);
  const quarters: CupMatch[] = [];
  for (let i = 0; i < bySeed.length / 2; i++) {
    quarters.push({
      id: `quarter-${i}`,
      round: 'quarter',
      a: bySeed[i],
      b: bySeed[bySeed.length - 1 - i],
      winner: null
    });
  }
  const semis: CupMatch[] = [
    { id: 'semi-0', round: 'semi', a: null, b: null, winner: null },
    { id: 'semi-1', round: 'semi', a: null, b: null, winner: null }
  ];
  const final: CupMatch = { id: 'final-0', round: 'final', a: null, b: null, winner: null };
  return [...quarters, ...semis, final];
};

/**
 * Resolves a match the player isn't in. Weighted by seed rather than a coin
 * flip, so the bracket behaves like a tournament — favourites usually go
 * through, and an upset means something when it happens.
 */
export const simulateMatch = (a: CupFighter, b: CupFighter): CupFighter => {
  const strength = (f: CupFighter) => f.maxHealth * f.damage;
  const total = strength(a) + strength(b);
  return Math.random() * total < strength(a) ? a : b;
};

/** Feeds winners forward into the next round's empty slots. */
export const advanceBracket = (matches: CupMatch[]): CupMatch[] => {
  const next = matches.map((m) => ({ ...m }));
  const quarters = next.filter((m) => m.round === 'quarter');
  const semis = next.filter((m) => m.round === 'semi');
  const final = next.find((m) => m.round === 'final');

  semis.forEach((s, i) => {
    s.a = quarters[i * 2]?.winner ?? null;
    s.b = quarters[i * 2 + 1]?.winner ?? null;
  });
  if (final) {
    final.a = semis[0]?.winner ?? null;
    final.b = semis[1]?.winner ?? null;
  }
  return next;
};

export const findPlayerMatch = (matches: CupMatch[], round: CupRoundKind): CupMatch | undefined =>
  matches.find((m) => m.round === round && !m.winner && (m.a?.isPlayer || m.b?.isPlayer));

// ── Duel tuning ──────────────────────────────────────────────────────────
export const DUEL_ARENA_RADIUS = 11;
export const DUEL_PLAYER_SPEED = 5.2;
export const DUEL_AI_SPEED = 4.2;
export const DUEL_ATTACK_RANGE = 1.6;
export const DUEL_ATTACK_COOLDOWN = 0.85;
export const DUEL_AI_ATTACK_COOLDOWN = 1.15;
// Locked out of swinging again until the previous swing has fully recovered,
// so a landed hit can never chain into a stunlock.
export const DUEL_RECOVERY = 0.35;
export const DUEL_HIT_LOCK = 0.3;
