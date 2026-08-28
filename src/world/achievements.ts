import { SPECIAL_ENEMY_TYPES } from './enemyConfig';
import { LifetimeStats, getLifetimeStats } from './stats';

// Achievements: medals derived from the lifetime stats module. Earned ids
// are persisted with timestamps; "Reset achievements" wipes the earned set
// and snapshots the current counters as a baseline, so counter-based medals
// (kills etc.) genuinely restart from zero. Record-based medals (best
// level/wave/survival) are facts about your history and re-earn instantly -
// the reset confirm text says so.

export interface AchievementView {
  id: string;
  icon: string;
  title: string;
  desc: string;
  value: number;
  goal: number;
  earnedAt?: number;
}

interface AchievementDef {
  id: string;
  icon: string;
  title: string;
  desc: string;
  goal: number;
  // `eff` has the reset-baseline subtracted from every counter; `raw` is
  // untouched lifetime data (used by the record-based medals).
  value: (eff: LifetimeStats, raw: LifetimeStats) => number;
}

const killsOf = (s: LifetimeStats, types: string[]) => types.reduce((sum, t) => sum + (s.killsByType[t] ?? 0), 0);

const SLIME_FAMILY = ['slimeBlock', 'giantSlime', 'colossalSlime', 'slimeKing'];
const BALL_FAMILY = ['smashBall', 'lavaSmashBall', 'ragdollSmashBall', 'slowBall', 'splitBall'];
const GIANT_FAMILY = ['giantMan', 'sandGiant', 'lavaGiant'];

const DEFS: AchievementDef[] = [
  { id: 'firstBlood', icon: '🩸', title: 'First Blood', desc: 'Land your first kill.', goal: 1, value: (e) => e.totalKills },
  { id: 'century', icon: '💯', title: 'Century', desc: 'Rack up 100 total kills.', goal: 100, value: (e) => e.totalKills },
  { id: 'slayer', icon: '⚔️', title: 'Slayer', desc: 'Rack up 500 total kills.', goal: 500, value: (e) => e.totalKills },
  { id: 'legend', icon: '🏆', title: 'One Thousand Fists', desc: 'Rack up 1,000 total kills.', goal: 1000, value: (e) => e.totalKills },
  { id: 'slimeBane', icon: '🟩', title: 'Slime Bane', desc: 'Pop 50 slimes (any of the slime dynasty).', goal: 50, value: (e) => killsOf(e, SLIME_FAMILY) },
  { id: 'regicide', icon: '👑', title: 'Regicide', desc: 'Kill a Slime King.', goal: 1, value: (e) => killsOf(e, ['slimeKing']) },
  { id: 'ballistic', icon: '⚫', title: 'Ballistic', desc: 'Destroy 25 smash balls (any variant).', goal: 25, value: (e) => killsOf(e, BALL_FAMILY) },
  { id: 'specialForces', icon: '🌟', title: 'Special Forces', desc: 'Kill 25 summoned specials.', goal: 25, value: (e) => killsOf(e, SPECIAL_ENEMY_TYPES) },
  { id: 'giantSlayer', icon: '🗿', title: 'Giant Slayer', desc: 'Fell 10 giant-class enemies.', goal: 10, value: (e) => killsOf(e, GIANT_FAMILY) },
  { id: 'bossSlayer', icon: '👹', title: 'Ring Champion', desc: 'Win a Boss Flag fight.', goal: 1, value: (e) => e.bossFlagWins },
  { id: 'bossVeteran', icon: '🥋', title: 'Ring Veteran', desc: 'Win 5 Boss Flag fights.', goal: 5, value: (e) => e.bossFlagWins },
  { id: 'veteran', icon: '💀', title: 'Dying Is Learning', desc: 'Die 10 times. It builds character.', goal: 10, value: (e) => e.deaths },
  { id: 'collector', icon: '📖', title: 'Collector', desc: 'Slay 25 different enemy types.', goal: 25, value: (e) => Object.keys(e.killsByType).filter((k) => (e.killsByType[k] ?? 0) > 0).length },
  { id: 'completionist', icon: '📚', title: 'Completionist', desc: 'Slay 50 different enemy types.', goal: 50, value: (e) => Object.keys(e.killsByType).filter((k) => (e.killsByType[k] ?? 0) > 0).length },
  // Record-based medals: read raw lifetime records, unaffected by reset.
  { id: 'survivor', icon: '⏱️', title: 'Survivor', desc: 'Survive 5 minutes without dying.', goal: 300, value: (_e, r) => r.longestSurvivalSec },
  { id: 'marathon', icon: '🏃', title: 'Marathon', desc: 'Survive 15 minutes without dying.', goal: 900, value: (_e, r) => r.longestSurvivalSec },
  { id: 'level10', icon: '⭐', title: 'Double Digits', desc: 'Reach level 10.', goal: 10, value: (_e, r) => r.bestLevel },
  { id: 'level25', icon: '✨', title: 'Ascendant', desc: 'Reach level 25.', goal: 25, value: (_e, r) => r.bestLevel },
  { id: 'wave10', icon: '🏟️', title: 'Cage Fighter', desc: 'Reach arena wave 10.', goal: 10, value: (_e, r) => r.bestArenaWave },
  { id: 'wave20', icon: '🌋', title: 'Wasteland Walker', desc: 'Reach arena wave 20.', goal: 20, value: (_e, r) => r.bestArenaWave }
];

const EARNED_KEY = 'actionGameAchievements';
const BASELINE_KEY = 'actionGameAchievementsBaseline';

const loadJson = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as T;
  } catch {
    // Corrupted blob - fall through.
  }
  return fallback;
};

const effectiveStats = (raw: LifetimeStats, baseline: LifetimeStats | null): LifetimeStats => {
  if (!baseline) return raw;
  const killsByType: Record<string, number> = {};
  Object.keys(raw.killsByType).forEach((k) => {
    const v = (raw.killsByType[k] ?? 0) - (baseline.killsByType?.[k] ?? 0);
    if (v > 0) killsByType[k] = v;
  });
  return {
    ...raw,
    totalKills: Math.max(0, raw.totalKills - baseline.totalKills),
    deaths: Math.max(0, raw.deaths - baseline.deaths),
    bossFlagWins: Math.max(0, raw.bossFlagWins - (baseline.bossFlagWins ?? 0)),
    killsByType
  };
};

// Evaluates every medal against current stats, records newly-earned ones
// (with timestamps), and returns the full display list.
export const evaluateAchievements = (): AchievementView[] => {
  const raw = getLifetimeStats();
  const baseline = loadJson<LifetimeStats | null>(BASELINE_KEY, null);
  const earned = loadJson<Record<string, number>>(EARNED_KEY, {});
  const eff = effectiveStats(raw, baseline);
  let dirty = false;
  const views = DEFS.map((def) => {
    const value = def.value(eff, raw);
    if (value >= def.goal && !earned[def.id]) {
      earned[def.id] = Date.now();
      dirty = true;
    }
    return { id: def.id, icon: def.icon, title: def.title, desc: def.desc, value: Math.min(value, def.goal), goal: def.goal, earnedAt: earned[def.id] };
  });
  if (dirty) {
    try {
      localStorage.setItem(EARNED_KEY, JSON.stringify(earned));
    } catch {
      // Best-effort.
    }
  }
  return views;
};

// Wipes earned medals and snapshots current counters as the new baseline.
export const resetAchievements = () => {
  try {
    localStorage.setItem(BASELINE_KEY, JSON.stringify(getLifetimeStats()));
    localStorage.removeItem(EARNED_KEY);
  } catch {
    // Best-effort.
  }
};
