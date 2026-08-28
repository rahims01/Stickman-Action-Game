// Lifetime + per-run stat tracking. Same pattern as audio.ts: a module
// singleton mutated from gameplay chokepoints (no React state - these tick
// every kill), persisted to localStorage on a debounce.

export interface LifetimeStats {
  totalKills: number;
  killsByType: Record<string, number>;
  deaths: number;
  bestLevel: number;
  bestArenaWave: number;
  longestSurvivalSec: number;
  // Boss Flag fights won (the sealed-ring giant went down).
  bossFlagWins: number;
}

export interface RunRecap {
  kills: number;
  killsByType: Record<string, number>;
  deaths: number;
  damageDealt: number;
  damageTaken: number;
  startedAtMs: number;
  // Highest level / arena wave reached THIS run.
  level: number;
  arenaWave: number;
}

const STATS_KEY = 'actionGameStats';

const emptyStats = (): LifetimeStats => ({
  totalKills: 0,
  killsByType: {},
  deaths: 0,
  bestLevel: 1,
  bestArenaWave: 0,
  longestSurvivalSec: 0,
  bossFlagWins: 0
});

const loadStats = (): LifetimeStats => {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (raw) return { ...emptyStats(), ...JSON.parse(raw) };
  } catch {
    // Corrupted blob: start fresh rather than crash the menu.
  }
  return emptyStats();
};

let lifetime = loadStats();
let saveTimer: ReturnType<typeof setTimeout> | null = null;
const queueSave = () => {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      localStorage.setItem(STATS_KEY, JSON.stringify(lifetime));
    } catch {
      // Storage full/blocked - stats are best-effort.
    }
  }, 1000);
};

const emptyRecap = (): RunRecap => ({
  kills: 0,
  killsByType: {},
  deaths: 0,
  damageDealt: 0,
  damageTaken: 0,
  startedAtMs: Date.now(),
  level: 1,
  arenaWave: 0
});

let run = emptyRecap();

export const statsResetRun = () => {
  run = emptyRecap();
};

export const statsRecordKill = (type: string) => {
  lifetime.totalKills += 1;
  lifetime.killsByType[type] = (lifetime.killsByType[type] ?? 0) + 1;
  run.kills += 1;
  run.killsByType[type] = (run.killsByType[type] ?? 0) + 1;
  queueSave();
};

export const statsRecordDeath = (survivalSec: number) => {
  lifetime.deaths += 1;
  if (survivalSec > lifetime.longestSurvivalSec) lifetime.longestSurvivalSec = Math.round(survivalSec);
  run.deaths += 1;
  queueSave();
};

export const statsRecordLevel = (level: number) => {
  if (level > run.level) run.level = level;
  if (level > lifetime.bestLevel) {
    lifetime.bestLevel = level;
    queueSave();
  }
};

export const statsRecordArenaWave = (wave: number) => {
  if (wave > run.arenaWave) run.arenaWave = wave;
  if (wave > lifetime.bestArenaWave) {
    lifetime.bestArenaWave = wave;
    queueSave();
  }
};

export const statsRecordBossWin = () => {
  lifetime.bossFlagWins += 1;
  queueSave();
};

export const statsRecordDamageDealt = (amount: number) => {
  if (amount > 0) run.damageDealt += amount;
};

export const statsRecordDamageTaken = (amount: number) => {
  if (amount > 0) run.damageTaken += amount;
};

export const getLifetimeStats = (): LifetimeStats => ({ ...lifetime, killsByType: { ...lifetime.killsByType } });
export const getRunRecap = (): RunRecap => ({ ...run, killsByType: { ...run.killsByType } });
