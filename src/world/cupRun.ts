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

const FIGHTER_COLORS = ['#c0392b', '#2c6fbb', '#8e44ad', '#16a085', '#d68910', '#7f8c8d', '#2c3e50'];

/** Builds the field: the player as one entrant plus seven AI, seeded 1..8. */
export const createCupField = (playerColor: string): CupFighter[] => {
  const names = [...FIGHTER_NAMES].sort(() => Math.random() - 0.5);
  const field: CupFighter[] = [
    {
      id: 'player',
      name: 'You',
      color: playerColor,
      seed: 0,
      isPlayer: true,
      maxHealth: 20,
      damage: 3
    }
  ];
  for (let i = 0; i < CUP_FIGHTER_COUNT - 1; i++) {
    field.push({
      id: `cpu-${i}`,
      name: names[i % names.length],
      color: FIGHTER_COLORS[i % FIGHTER_COLORS.length],
      seed: 0,
      isPlayer: false,
      // Later seeds hit harder, so the final is genuinely the hardest fight.
      maxHealth: 14 + i * 2,
      damage: 2 + Math.floor(i / 3)
    });
  }
  // Shuffle, then seed by position so the player's path varies per run.
  const shuffled = field.sort(() => Math.random() - 0.5);
  shuffled.forEach((f, i) => (f.seed = i + 1));
  return shuffled;
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
export const DUEL_HIT_LOCK = 0.3;
