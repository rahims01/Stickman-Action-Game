import { asset } from './world/assetPath';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { PitchBrawl } from './components/PitchBrawl';
import { GameCanvas, FlagGuideInfo, SandboxActions } from './components/GameCanvas';
import { ViewMode } from './types/game.types';
import { GameModifiers, LOW_HEALTH_FRACTION_THRESHOLD, PLAYER_MAX_HEALTH, PLAYER_MAX_STAMINA, SavedHelper, StatModifiers, createDefaultModifiers, createStatModifiers } from './world/gameState';
import { audio } from './world/audio';
import { SPECIAL_ENEMY_TYPES, BOUNTY_HUNTER_TYPE, EnemyType } from './world/enemyConfig';
import { LevelChoiceOption } from './world/gameState';
import { RunRecap, getLifetimeStats, getRunRecap } from './world/stats';
import { evaluateAchievements, resetAchievements } from './world/achievements';

const STORAGE_KEY = 'actionGameProgress';
const SETTINGS_KEY = 'actionGameSettings';

// Player-facing options from the main menu's settings panel - persisted
// separately from run progress so "Reset Progress" never touches them.
interface GameSettings {
  fov: number;
  // Third-person camera follow distance, percent (100 = classic).
  cameraDistance: number;
  soundVolume: number;
  showBlood: boolean;
  showDamageNumbers: boolean;
  showMinimap: boolean;
  showLastWords: boolean;
  showEnemyHealthBars: boolean;
  showSpawnCallouts: boolean;
}

const DEFAULT_SETTINGS: GameSettings = {
  fov: 60,
  cameraDistance: 100,
  soundVolume: 70,
  showBlood: true,
  showDamageNumbers: true,
  showMinimap: true,
  showLastWords: false,
  showEnemyHealthBars: true,
  showSpawnCallouts: true
};

// Run modifiers persist across sessions the moment they're toggled.
const MODIFIERS_KEY = 'actionGameModifiers';

function loadModifiers(): GameModifiers {
  try {
    const raw = localStorage.getItem(MODIFIERS_KEY);
    if (!raw) return createDefaultModifiers();
    return { ...createDefaultModifiers(), ...(JSON.parse(raw) as Partial<GameModifiers>) };
  } catch {
    return createDefaultModifiers();
  }
}

// Saved run slots: snapshots of the whole progress blob + modifiers, listed
// under the modifiers section for loading/deleting.
const RUN_SLOTS_KEY = 'actionGameRunSlots';

interface RunSlot {
  id: string;
  name: string;
  savedAt: number;
  progress: SavedProgress;
  modifiers: GameModifiers;
}

function loadRunSlots(): RunSlot[] {
  try {
    const raw = localStorage.getItem(RUN_SLOTS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as RunSlot[];
  } catch {
    return [];
  }
}

function saveRunSlots(slots: RunSlot[]) {
  try {
    localStorage.setItem(RUN_SLOTS_KEY, JSON.stringify(slots));
  } catch {
    // ignore storage errors
  }
}

function loadSettings(): GameSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<GameSettings>) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

interface SavedProgress {
  level: number;
  statModifiers: StatModifiers;
  deaths: number;
  specialKills: number;
  score: number;
  kills: number;
  color: string;
  helpers: SavedHelper[];
  droneLevel: number;
  turretLevel?: number;
}

function loadProgress(): SavedProgress | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SavedProgress;
  } catch {
    return null;
  }
}

function saveProgress(data: SavedProgress) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // ignore storage errors
  }
}

type GameMode = 'normal' | 'sandbox' | 'arena' | 'pitchbrawl';

// Randomized once at module load - the rising ember particles on the menu.
const MENU_PARTICLES = Array.from({ length: 18 }, (_, i) => ({
  id: i,
  left: `${Math.random() * 100}%`,
  size: 2.5 + Math.random() * 4.5,
  duration: 9 + Math.random() * 12,
  delay: Math.random() * 12,
  color: ['rgba(79,195,247,0.55)', 'rgba(166,226,46,0.4)', 'rgba(255,255,255,0.35)', 'rgba(253,151,31,0.4)'][i % 4]
}));

export const App: React.FC = () => {
  const saved = useRef(loadProgress());
  const savedHelpersRef = useRef<SavedHelper[]>(saved.current?.helpers ?? []);
  const savedDroneLevelRef = useRef<number>(saved.current?.droneLevel ?? 0);
  const savedTurretLevelRef = useRef<number>(saved.current?.turretLevel ?? 0);
  // Whether a meaningful run already existed when the app booted - fresh
  // runs (no save) get the Loadout Draft; continues don't.
  const hasExistingProgressRef = useRef(
    !!saved.current && ((saved.current.level ?? 1) > 1 || (saved.current.score ?? 0) > 0 || (saved.current.kills ?? 0) > 0)
  );
  const sandboxActionsRef = useRef<SandboxActions | null>(null);

  const [gameMode, setGameMode] = useState<GameMode | null>(null);
  const [settingsPage, setSettingsPage] = useState(1);

  const [stickmanColor, setStickmanColor] = useState<string>(saved.current?.color ?? '#4fc3f7');
  const [viewMode, setViewMode] = useState<ViewMode>('third');
  const [score, setScore] = useState(saved.current?.score ?? 0);
  const [kills, setKills] = useState(saved.current?.kills ?? 0);
  const [playerHealth, setPlayerHealth] = useState(PLAYER_MAX_HEALTH);
  const [maxHealth, setMaxHealth] = useState(PLAYER_MAX_HEALTH);
  const [stamina, setStamina] = useState(PLAYER_MAX_STAMINA);
  const [maxStamina, setMaxStamina] = useState(PLAYER_MAX_STAMINA);
  const [settingsMinimized, setSettingsMinimized] = useState(true);
  const [level, setLevel] = useState(saved.current?.level ?? 1);
  const [flagsRemaining, setFlagsRemaining] = useState(0);
  const [flagsTotal, setFlagsTotal] = useState(0);
  const [deaths, setDeaths] = useState(saved.current?.deaths ?? 0);
  const [specialKills, setSpecialKills] = useState(saved.current?.specialKills ?? 0);
  const [levelTime, setLevelTime] = useState(0);
  const [statusEffect, setStatusEffect] = useState<string | null>(null);
  const [manuallyPaused, setManuallyPaused] = useState(false);
  const [pendingSpecials, setPendingSpecials] = useState(0);
  const [flagGuide, setFlagGuide] = useState<FlagGuideInfo | null>(null);
  const [showDebugInfo, setShowDebugInfo] = useState(false);
  const [flashlightOn, setFlashlightOn] = useState(false);
  const [gameLoaded, setGameLoaded] = useState(false);
  const [settings, setSettings] = useState<GameSettings>(loadSettings);
  const [showMenuSettings, setShowMenuSettings] = useState(false);
  const [modifiers, setModifiers] = useState<GameModifiers>(loadModifiers);
  const [runSlots, setRunSlots] = useState<RunSlot[]>(loadRunSlots);
  const [arenaWave, setArenaWave] = useState(0);
  const [arenaPhase, setArenaPhase] = useState<'concrete' | 'box' | 'falling' | 'sand' | 'magma'>('concrete');
  const [waveBanner, setWaveBanner] = useState<string | null>(null);
  const waveBannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [spawnCallout, setSpawnCallout] = useState<string | null>(null);
  const spawnCalloutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [runOver, setRunOver] = useState(false);
  const [latestStatModifiers, setLatestStatModifiers] = useState<StatModifiers>(
    saved.current?.statModifiers ?? createStatModifiers()
  );
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  // Lifetime stats screen (main menu) + last-run recap card.
  const [showStats, setShowStats] = useState(false);
  // Achievements overlay + two-step reset confirm.
  const [showAchievements, setShowAchievements] = useState(false);
  const [confirmResetAch, setConfirmResetAch] = useState(false);
  // Bumped after a reset so the overlay re-evaluates.
  const [achVersion, setAchVersion] = useState(0);
  const [lastRunRecap, setLastRunRecap] = useState<RunRecap | null>(null);
  // Sandbox live entity counts readout.
  const [entityCounts, setEntityCounts] = useState<{ enemies: number; dummies: number; civilians: number; helpers: number; turrets: number } | null>(null);

  // Track whether we paused the game because the settings panel was opened,
  // so we can restore the previous pause state when it closes.
  const pausedBeforeSettingsRef = useRef(false);

  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      // ignore storage errors
    }
  }, [settings]);

  const patchSettings = (patch: Partial<GameSettings>) => setSettings((prev) => ({ ...prev, ...patch }));

  // Master volume follows the setting (0 = muted).
  useEffect(() => {
    audio.setMasterVolume(settings.soundVolume / 100);
  }, [settings.soundVolume]);

  // Modifiers save the instant they're toggled.
  useEffect(() => {
    try {
      localStorage.setItem(MODIFIERS_KEY, JSON.stringify(modifiers));
    } catch {
      // ignore storage errors
    }
  }, [modifiers]);

  const patchModifiers = (patch: Partial<GameModifiers>) => setModifiers((prev) => ({ ...prev, ...patch }));

  const handleArenaWaveChange = useCallback((wave: number, phase: 'concrete' | 'box' | 'falling' | 'sand' | 'magma') => {
    setArenaWave(wave);
    setArenaPhase((prevPhase) => {
      let label = `WAVE ${wave}`;
      if (phase === 'falling') label = 'THE FLOOR GIVES WAY…';
      else if (phase !== prevPhase && phase === 'box') label = 'THE CAGE OPENS';
      else if (phase !== prevPhase && phase === 'sand') label = 'THE SAND PIT';
      else if (phase !== prevPhase && phase === 'magma') label = 'THE MAGMA WASTELAND';
      setWaveBanner(label);
      return phase;
    });
    if (waveBannerTimerRef.current) clearTimeout(waveBannerTimerRef.current);
    waveBannerTimerRef.current = setTimeout(() => setWaveBanner(null), 2400);
  }, []);

  const handleSpawnCallout = useCallback((label: string) => {
    setSpawnCallout(label);
    if (spawnCalloutTimerRef.current) clearTimeout(spawnCalloutTimerRef.current);
    spawnCalloutTimerRef.current = setTimeout(() => setSpawnCallout(null), 2600);
  }, []);

  // Ironman death: the run is over - wipe the save so there is no continue.
  const handleIronmanDeath = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setLastRunRecap(getRunRecap());
    setRunOver(true);
    setManuallyPaused(true);
  }, []);

  const handleSaveCurrentRun = () => {
    const progress = loadProgress();
    if (!progress) return;
    const slot: RunSlot = {
      id: `run-${Date.now()}`,
      name: `Run ${runSlots.length + 1}`,
      savedAt: Date.now(),
      progress,
      modifiers
    };
    const next = [...runSlots, slot].slice(-6);
    setRunSlots(next);
    saveRunSlots(next);
  };

  const handleLoadRun = (slot: RunSlot) => {
    saveProgress(slot.progress);
    try {
      localStorage.setItem(MODIFIERS_KEY, JSON.stringify(slot.modifiers));
    } catch { /* ignore */ }
    // Full reload so every initial-state path picks up the restored run.
    window.location.reload();
  };

  const handleDeleteRun = (id: string) => {
    const next = runSlots.filter((s) => s.id !== id);
    setRunSlots(next);
    saveRunSlots(next);
  };

  const handleScoreAdd = (amount: number) => setScore((prev) => prev + amount);
  const handleKill = useCallback(() => setKills((prev) => prev + 1), []);
  const handlePlayerHealthChange = useCallback((health: number) => setPlayerHealth(health), []);
  const handleMaxHealthChange = useCallback((max: number) => setMaxHealth(max), []);
  const handleLevelChange = useCallback((lvl: number) => setLevel(lvl), []);
  const handleFlagsProgressChange = useCallback((remaining: number, total: number) => {
    setFlagsRemaining(remaining);
    setFlagsTotal(total);
  }, []);
  const handleDeathsChange = useCallback((count: number) => setDeaths(count), []);
  const handleSpecialKillsChange = useCallback((count: number) => setSpecialKills(count), []);
  const handleLevelTimeChange = useCallback((seconds: number) => setLevelTime(seconds), []);
  const handleStatusEffectChange = useCallback((label: string | null) => setStatusEffect(label), []);
  const handlePendingSpecialsChange = useCallback((count: number) => setPendingSpecials(count), []);
  const handleFlagGuideChange = useCallback((data: FlagGuideInfo | null) => setFlagGuide(data), []);
  const handleStaminaChange = useCallback((value: number, max: number) => {
    setStamina(value);
    setMaxStamina(max);
  }, []);
  const handleStatModifiersChange = useCallback((mods: StatModifiers) => {
    setLatestStatModifiers(mods);
  }, []);

  const [latestHelpers, setLatestHelpers] = useState<SavedHelper[]>(saved.current?.helpers ?? []);
  const [latestDroneLevel, setLatestDroneLevel] = useState<number>(saved.current?.droneLevel ?? 0);
  const [latestTurretLevel, setLatestTurretLevel] = useState<number>(saved.current?.turretLevel ?? 0);
  const [sbTimeOfDay, setSbTimeOfDay] = useState<'day' | 'night' | null>(null);
  const [sbEnemiesIgnore, setSbEnemiesIgnore] = useState(false);
  const [spawnAsHelperMode, setSpawnAsHelperMode] = useState(false);
  // Bottom quick-spawn bar can be tucked away to reclaim the screen.
  const [spawnBarMinimized, setSpawnBarMinimized] = useState(false);
  // Sandbox spawn options applied to every enemy spawned from the pickers.
  const [spawnClear, setSpawnClear] = useState(false);
  const [spawnGiant, setSpawnGiant] = useState(false);
  const [spawnArmoured, setSpawnArmoured] = useState(false);
  const spawnOpts = { clear: spawnClear, giant: spawnGiant, armoured: spawnArmoured };

  const handleHelpersChange = useCallback((helpers: SavedHelper[]) => {
    savedHelpersRef.current = helpers;
    setLatestHelpers(helpers);
  }, []);

  const handleDroneLevelChange = useCallback((level: number) => {
    savedDroneLevelRef.current = level;
    setLatestDroneLevel(level);
  }, []);

  const handleTurretLevelChange = useCallback((level: number) => {
    savedTurretLevelRef.current = level;
    setLatestTurretLevel(level);
  }, []);

  const handleSandboxReady = useCallback((actions: SandboxActions) => {
    sandboxActionsRef.current = actions;
  }, []);

  // Persist all progress whenever key fields change.
  useEffect(() => {
    saveProgress({
      level, statModifiers: latestStatModifiers, deaths, specialKills,
      score, kills, color: stickmanColor,
      helpers: savedHelpersRef.current,
      droneLevel: savedDroneLevelRef.current,
      turretLevel: savedTurretLevelRef.current
    });
  }, [level, latestStatModifiers, deaths, specialKills, score, kills, stickmanColor]);

  const handleSettingsToggle = () => {
    const nowMinimized = !settingsMinimized;
    setSettingsMinimized(nowMinimized);
    if (!nowMinimized) {
      // Opening settings → pause game
      pausedBeforeSettingsRef.current = manuallyPaused;
      setManuallyPaused(true);
      setShowResetConfirm(false);
    } else {
      // Closing settings → restore prior pause state
      setManuallyPaused(pausedBeforeSettingsRef.current);
    }
  };

  const handleResetProgress = () => {
    if (!showResetConfirm) {
      setShowResetConfirm(true);
      return;
    }
    localStorage.removeItem(STORAGE_KEY);
    window.location.reload();
  };

  // Back to mode select. Progress is already persisted continuously, so this
  // just unmounts the game; re-reading storage keeps the menu chips (and the
  // CONTINUE state a future session resumes from) fresh.
  const handleGoToMainMenu = () => {
    saved.current = loadProgress();
    // Snapshot the run's recap before the GameCanvas unmounts.
    setLastRunRecap(getRunRecap());
    setGameMode(null);
    setGameLoaded(false);
    setSettingsMinimized(true);
    setSettingsPage(1);
    setManuallyPaused(false);
    setShowResetConfirm(false);
    setArenaWave(0);
    setArenaPhase('box');
    setWaveBanner(null);
    setRunOver(false);
  };

  const STATUS_EFFECT_COLORS: Record<string, string> = {
    Burning: '#ff5722',
    Frozen: '#4fc3f7',
    Stunned: '#fdd835',
    Pulled: '#b362e0',
    Slowed: '#80d8ff',
    Magnetized: '#ff8a65',
    Repulsed: '#90caf9'
  };
  const levelTimeLabel = `${Math.floor(levelTime / 60)}:${(levelTime % 60).toString().padStart(2, '0')}`;
  const isLowHealth = maxHealth > 0 && playerHealth > 0 && playerHealth / maxHealth < LOW_HEALTH_FRACTION_THRESHOLD;

  const toggleViewMode = () => setViewMode((prev) => (prev === 'third' ? 'first' : 'third'));

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'KeyV') toggleViewMode();
      if (e.code === 'KeyP') setManuallyPaused((prev) => !prev);
      if (e.code === 'KeyL') setFlashlightOn((prev) => !prev);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // ── Sandbox data ────────────────────────────────────────────────────────────
  const SANDBOX_ENEMY_GROUPS: { label: string; types: EnemyType[] }[] = [
    { label: 'Basic', types: ['fightingDummy', 'punchDummy', 'kickDummy', 'runningMan', 'punchMan', 'kickMan', 'greyMan'] },
    { label: 'Specials', types: SPECIAL_ENEMY_TYPES },
    { label: 'Rare / Variants', types: ['giantMan', 'babyMan', 'tallMan', 'fatMan', 'skinnyMan', 'brainMan', 'medicMan', 'rageMan', 'shieldBearer'] },
    { label: 'New Rares', types: ['sniperMan', 'copycatMan', 'vampireMan', 'phaseMan', 'splitMan', 'armourMan', 'cloakedAssassin', 'engineerMan', 'bombMan', 'coward', 'slimeBlock', 'giantSlime', 'colossalSlime', 'slimeKing', 'shockerCube', 'slowCube', 'smashBall', 'ragdollSmashBall', 'slowBall', 'splitBall', 'juggernaut', 'resilientMan', 'superResilientMan', 'minionMan', 'ragdollThrower', 'adaptiveMan', 'magnetMan', 'repulsorMan', 'reflectorMan', 'stormMan', 'enemyBodyguard', 'strikerMan'] },
    { label: 'Sandbox Only', types: ['trapperMan'] },
    { label: 'Arena', types: ['weakFighter', 'concreteMan', 'woodMan', 'brickMan', 'sandyMan', 'sandThrower', 'sandWarrior', 'sandJuggernaut', 'sandGiant', 'lavaBaby', 'magmaMan', 'charredBrickMan', 'lavaMinion', 'lavaJuggernaut', 'lavaThrower', 'lavaSplitCube', 'lavaSmashBall', 'lavaGiant'] },
    { label: 'Strong Variants', types: ['strongRangedMan', 'strongKickMan', 'strongPunchMan', 'comboMan', 'strongComboMan'] },
    { label: 'Special Summons', types: [BOUNTY_HUNTER_TYPE] },
  ];

  const UPGRADE_OPTIONS: { label: string; option: LevelChoiceOption }[] = [
    { label: '+1 Player HP', option: 'playerHealth' },
    { label: '+1 Player Dmg', option: 'playerDamage' },
    { label: '+Atk Speed', option: 'playerAttackSpeed' },
    { label: '+Move Speed', option: 'playerMoveSpeed' },
    { label: '+Stamina', option: 'staminaMax' },
    { label: '+Crit Chance', option: 'critChance' },
    { label: 'Thorns', option: 'thorns' },
    { label: 'Dash', option: 'dash' },
    { label: 'Parry', option: 'parry' },
    { label: 'Ground Slam', option: 'groundSlam' },
    { label: 'Flashlight+', option: 'flashlightUpgrade' },
    { label: 'Drone', option: 'drone' },
    { label: 'Turret', option: 'turret' },
    { label: 'Add Helper', option: 'helper' },
    { label: 'Combo (sm)', option: 'playerComboSmall' },
    { label: 'Combo (big)', option: 'playerComboBig' },
    { label: 'Enemy Combo', option: 'enemyCombo' },
    { label: '+Spawn Rate', option: 'enemySpawnRate' },
    { label: 'Light Block', option: 'lightBlock' },
    { label: 'Challenge Flag', option: 'challengeFlag' },
    { label: '+1 Enemy HP', option: 'enemyHealth' },
    { label: '+1 Enemy Dmg', option: 'enemyDamage' },
    { label: '+Enemy Atk Spd', option: 'enemyAttackSpeed' },
    { label: '+Enemy Move Spd', option: 'enemyMoveSpeed' },
    { label: '+Helper Mv Spd', option: 'helperMoveSpeed' },
    { label: '+Helper Atk Spd', option: 'helperAttackSpeed' },
    { label: 'Helper Lvl+2', option: 'helperLevelUp2' },
    { label: 'Ranged Helpers', option: 'helperRanged' },
  ];

  const sb = (fn: (a: SandboxActions) => void) => { if (sandboxActionsRef.current) fn(sandboxActionsRef.current); };

  // Stickman menu paging: sandbox has its tool pages; every mode ends with
  // the accessibility & modifiers page.
  const maxSettingsPage = gameMode === 'sandbox' ? 7 : 2;
  const accessibilityPage = gameMode === 'sandbox' ? 7 : 2;

  const MODIFIER_INFO: { key: keyof GameModifiers; label: string; desc: string }[] = [
    { key: 'oneHit', label: '💥 One-Hit Mode', desc: 'Everything — you included — dies to a single hit.' },
    { key: 'ironman', label: '☠ Ironman', desc: 'One life. Dying ends the run and wipes the save.' },
    { key: 'glassCannon', label: '🔮 Glass Cannon', desc: 'You deal 2× damage but have half max health.' },
    { key: 'speedDemon', label: '⚡ Speed Demon', desc: 'You and all enemies move & attack ~30% faster.' },
    { key: 'permanentNight', label: '🌙 Permanent Night', desc: 'The sun never rises; enemies keep their night bonus.' },
    { key: 'weather', label: '🌧 Stormy Weather', desc: 'Rain and thick fog cut visibility drastically.' },
    { key: 'footballs', label: '⚽ Footballs', desc: 'Ultimate Soccer crossover: kickable footballs litter the map. Boot one into a crowd to knock them all down.' }
  ];

  const setTimeOfDay = (t: 'day' | 'night' | null) => {
    setSbTimeOfDay(t);
    sb(a => a.setTimeOfDay(t));
  };

  const setEnemiesIgnore = (ignore: boolean) => {
    setSbEnemiesIgnore(ignore);
    sb(a => a.setEnemiesIgnorePlayer(ignore));
  };

  // All three attack-dummy variants are barred from helper mode.
  const DUMMY_TYPES: EnemyType[] = ['fightingDummy', 'punchDummy', 'kickDummy'];

  const ENEMY_LABELS: Partial<Record<EnemyType, string>> = {
    fightingDummy: 'Dummy', punchDummy: '🥊 P.Dummy', kickDummy: '🦵 K.Dummy',
    runningMan: 'Runner', punchMan: 'Puncher', kickMan: 'Kicker', greyMan: 'Grey',
    lavaMan: '🌋 Lava', waterMan: '💧 Water', invisibleMan: '🫥 Invisible', fireMan: '🔥 Fire',
    weaponMan: '⚔️ Weapon', purpleMan: '🪄 Purple', pinkMan: '🩷 Pink', greenMan: '🌿 Green',
    yellowMan: '⚡ Yellow', blackMan: '🪨 Black', tomatoMan: '💨 Tomato', snowMan: '❄️ Snow',
    glowingGreenMan: '🟢 G.Green', giantMan: 'Giant', babyMan: '👶 Baby', tallMan: 'Tall',
    fatMan: 'Fat', skinnyMan: 'Skinny', brainMan: '🧠 Brain', medicMan: '⛑️ Medic',
    rageMan: '😡 Rage', shieldBearer: '🛡️ Shield', strongRangedMan: '💪 S.Range',
    strongKickMan: '💪 S.Kick', strongPunchMan: '💪 S.Punch', comboMan: 'Combo',
    strongComboMan: '💪 Combo', bountyHunter: '🏹 Bounty',
    sniperMan: '🎯 Sniper', copycatMan: '🪞 Copycat', vampireMan: '🧛 Vampire',
    phaseMan: '👻 Phase', splitMan: '🧬 Split', armourMan: '🦾 Armour',
    cloakedAssassin: '🗡️ Assassin', engineerMan: '🔧 Engineer', bombMan: '💣 Bomb',
    strikerMan: '⚽ Striker', coward: '🏃 Coward', slimeBlock: '🟩 Slime', weakFighter: '🤕 Weakling',
    sandWarrior: '🏜️ S.Warrior', sandJuggernaut: '🏜️ S.Jugg', sandGiant: '🏜️ S.Giant',
    lavaMinion: '🌋 L.Minion', lavaJuggernaut: '🌋 L.Jugg', lavaThrower: '🌋 L.Thrower', lavaSplitCube: '🟧 L.Cube',
    shockerCube: '🟦 Shocker', slowCube: '🧊 Slow Cube', smashBall: '⚫ Smash Ball',
    juggernaut: '🗿 Juggernaut', resilientMan: '💫 Resilient', superResilientMan: '✨ S.Resilient',
    trapperMan: '🪤 Trapper', lavaSmashBall: '🔴 L.Ball', lavaGiant: '🌋 L.Giant',
    concreteMan: '🧱 Concrete', woodMan: '🪵 Wood', brickMan: '🧱 Brick', sandyMan: '🏜️ Sandy',
    sandThrower: '🏜️ S.Thrower', lavaBaby: '🌋 L.Baby', magmaMan: '🌋 Magma', charredBrickMan: '🔥 C.Brick',
    minionMan: '🤖 Minion', ragdollThrower: '🎳 R.Thrower', adaptiveMan: '🔄 Adaptive',
    ragdollSmashBall: '🟣 R.Ball', slowBall: '🧊 Slow Ball', splitBall: '🔵 Split Ball',
    giantSlime: '🟢 G.Slime', colossalSlime: '🟢 C.Slime', enemyBodyguard: '🛡 E.Bodyguard',
    slimeKing: '👑 S.King', magnetMan: '🧲 Magnet', reflectorMan: '🪞 Reflector',
    repulsorMan: '🧿 Repulsor', stormMan: '⛈ Storm',
  };

  // Mode selection overlay (shown after game finishes loading)
  if (gameMode === null) {
    const savedInfo = saved.current;
    const hasProgress = !!savedInfo && (savedInfo.level > 1 || savedInfo.score > 0 || savedInfo.kills > 0);
    return (
      <div
        className="fade-in"
        style={{
          width: '100vw',
          height: '100vh',
          position: 'relative',
          overflow: 'hidden',
          background: 'radial-gradient(ellipse at 50% 35%, #16222e 0%, #0b1016 55%, #06090c 100%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '26px'
        }}
      >
        <div className="menu-glow" />
        {MENU_PARTICLES.map((p) => (
          <div
            key={p.id}
            className="menu-particle"
            style={{
              left: p.left,
              width: `${p.size}px`,
              height: `${p.size}px`,
              background: p.color,
              boxShadow: `0 0 ${p.size * 2}px ${p.color}`,
              animationDuration: `${p.duration}s`,
              animationDelay: `${p.delay}s`
            }}
          />
        ))}
        <img src={asset('/logo.jpg')} alt="" style={{ width: '88px', height: '88px', borderRadius: '20px', opacity: 0.95, boxShadow: '0 0 40px rgba(79,195,247,0.25)', zIndex: 1 }} />
        <div style={{ textAlign: 'center', zIndex: 1 }}>
          <div className="game-title" style={{ fontSize: '46px', fontWeight: 700, letterSpacing: '9px' }}>STICKMAN ACTION</div>
          <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: '14px', letterSpacing: '3px', marginTop: '6px' }}>
            PUNCH · KICK · RAGDOLL · SURVIVE
          </div>
        </div>
        {hasProgress && (
          <div style={{ display: 'flex', gap: '10px', zIndex: 1 }}>
            <div className="menu-stat-chip">⭐ LEVEL {savedInfo!.level}</div>
            <div className="menu-stat-chip">🏆 {savedInfo!.score.toLocaleString()}</div>
            <div className="menu-stat-chip">☠ {savedInfo!.kills} KILLS</div>
            <div className="menu-stat-chip">💀 {savedInfo!.deaths} DEATHS</div>
          </div>
        )}
        <div style={{ display: 'flex', gap: '22px', marginTop: '6px', zIndex: 1 }}>
          <button
            className="menu-btn"
            onClick={() => setGameMode('normal')}
            style={{ padding: '18px 48px', fontSize: '19px', fontWeight: 700, borderRadius: '12px', border: '2px solid #4fc3f7', background: 'linear-gradient(180deg, rgba(79,195,247,0.18), rgba(79,195,247,0.06))', color: '#4fc3f7', cursor: 'pointer', letterSpacing: '2px' }}
          >
            {hasProgress ? '▶ CONTINUE' : '▶ PLAY'}
          </button>
          <button
            className="menu-btn"
            onClick={() => setGameMode('arena')}
            style={{ padding: '18px 42px', fontSize: '19px', fontWeight: 700, borderRadius: '12px', border: '2px solid #ff7043', background: 'linear-gradient(180deg, rgba(255,112,67,0.16), rgba(255,112,67,0.05))', color: '#ff7043', cursor: 'pointer', letterSpacing: '2px' }}
          >
            ⚔ ARENA
          </button>
          <button
            className="menu-btn"
            onClick={() => setGameMode('sandbox')}
            style={{ padding: '18px 42px', fontSize: '19px', fontWeight: 700, borderRadius: '12px', border: '2px solid #a6e22e', background: 'linear-gradient(180deg, rgba(166,226,46,0.16), rgba(166,226,46,0.05))', color: '#a6e22e', cursor: 'pointer', letterSpacing: '2px' }}
          >
            🧪 SANDBOX
          </button>
          <button
            className="menu-btn"
            onClick={() => setGameMode('pitchbrawl')}
            title="Ultimate Soccer crossover: 3v3, one free ball, first to three. A landed tackle puts BOTH players on the floor."
            style={{ padding: '18px 42px', fontSize: '19px', fontWeight: 700, borderRadius: '12px', border: '2px solid #5ce6a8', background: 'linear-gradient(180deg, rgba(92,230,168,0.16), rgba(92,230,168,0.05))', color: '#5ce6a8', cursor: 'pointer', letterSpacing: '2px' }}
          >
            ⚽ PITCH BRAWL
          </button>
        </div>
        <div style={{ display: 'flex', gap: '14px', zIndex: 1 }}>
          <button
            className="menu-btn"
            onClick={() => setShowMenuSettings(true)}
            style={{ padding: '10px 26px', fontSize: '14px', fontWeight: 600, borderRadius: '10px', border: '1px solid rgba(255,255,255,0.28)', background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.75)', cursor: 'pointer', letterSpacing: '2px' }}
          >
            ⚙ SETTINGS
          </button>
          <button
            className="menu-btn"
            onClick={() => window.open(asset('/encyclopedia/index.html'), '_blank')}
            style={{ padding: '10px 26px', fontSize: '14px', fontWeight: 600, borderRadius: '10px', border: '1px solid rgba(255,167,38,0.4)', background: 'rgba(255,167,38,0.07)', color: '#ffcc80', cursor: 'pointer', letterSpacing: '2px' }}
          >
            📖 ENCYCLOPEDIA
          </button>
          <button
            className="menu-btn"
            onClick={() => setShowStats(true)}
            style={{ padding: '10px 26px', fontSize: '14px', fontWeight: 600, borderRadius: '10px', border: '1px solid rgba(129,199,132,0.4)', background: 'rgba(129,199,132,0.07)', color: '#a5d6a7', cursor: 'pointer', letterSpacing: '2px' }}
          >
            📊 STATS
          </button>
          {/* Crossover: the Striker and the footballs come from Ultimate
              Soccer, and their game carries the reciprocal link back here. */}
          <button
            className="menu-btn"
            onClick={() => window.open('https://rahims01.github.io/Ultimate-Soccer/', '_blank', 'noopener')}
            title="Our crossover partner — the Striker and the footballs in this game come from theirs"
            style={{ padding: '10px 26px', fontSize: '14px', fontWeight: 600, borderRadius: '10px', border: '1px solid rgba(0,200,120,0.45)', background: 'rgba(0,200,120,0.08)', color: '#5ce6a8', cursor: 'pointer', letterSpacing: '2px' }}
          >
            ⚽ ULTIMATE SOCCER
          </button>
          <button
            className="menu-btn"
            onClick={() => { setConfirmResetAch(false); setShowAchievements(true); }}
            style={{ padding: '10px 26px', fontSize: '14px', fontWeight: 600, borderRadius: '10px', border: '1px solid rgba(255,213,79,0.4)', background: 'rgba(255,213,79,0.07)', color: '#ffd54f', cursor: 'pointer', letterSpacing: '2px' }}
          >
            🏅 ACHIEVEMENTS
          </button>
        </div>
        {lastRunRecap && (lastRunRecap.kills > 0 || lastRunRecap.deaths > 0 || Date.now() - lastRunRecap.startedAtMs > 30000) && (
          <div style={{ zIndex: 1, background: 'rgba(0,0,0,0.45)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: '10px', padding: '10px 18px', display: 'flex', gap: '16px', alignItems: 'center', fontSize: '12px', color: 'rgba(255,255,255,0.75)' }}>
            <span style={{ color: '#4fc3f7', fontWeight: 700, letterSpacing: '1px' }}>LAST RUN</span>
            <span>☠ {lastRunRecap.kills} kills</span>
            <span>⚔ {Math.round(lastRunRecap.damageDealt)} dealt</span>
            <span>🩸 {Math.round(lastRunRecap.damageTaken)} taken</span>
            <span>💀 {lastRunRecap.deaths} deaths</span>
            <span>⏱ {Math.max(1, Math.round((Date.now() - lastRunRecap.startedAtMs) / 60000))} min</span>
            {lastRunRecap.arenaWave > 0 && <span>⚔ wave {lastRunRecap.arenaWave}</span>}
          </div>
        )}
        <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: '13px', letterSpacing: '1px', zIndex: 1 }}>
          Arena: wave survival in a brick cage · Sandbox: empty map, spawn anything
        </div>

        {showAchievements && (() => {
          void achVersion; // re-evaluate after a reset
          const medals = evaluateAchievements();
          const earnedCount = medals.filter((m) => m.earnedAt).length;
          return (
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(3,5,8,0.66)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 5 }}>
              <div className="fade-in" style={{ background: 'linear-gradient(165deg, #171c23, #0e1116)', border: '1px solid rgba(255,213,79,0.4)', boxShadow: '0 12px 48px rgba(0,0,0,0.6)', borderRadius: '14px', padding: '26px 30px', width: '480px', maxHeight: '78vh', overflowY: 'auto', color: '#ffffff' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <h2 style={{ margin: 0, fontSize: '20px', color: '#ffd54f', letterSpacing: '2px' }}>🏅 ACHIEVEMENTS</h2>
                  <button onClick={() => setShowAchievements(false)}
                    style={{ width: '28px', height: '28px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.25)', background: '#2a2a2a', color: '#fff', cursor: 'pointer', fontSize: '14px', padding: 0 }}>
                    ✕
                  </button>
                </div>
                <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '16px' }}>{earnedCount} / {medals.length} unlocked</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '18px' }}>
                  {medals.map((m) => {
                    const earned = !!m.earnedAt;
                    const pct = Math.round((m.value / m.goal) * 100);
                    return (
                      <div key={m.id} style={{ background: earned ? 'rgba(255,213,79,0.08)' : 'rgba(255,255,255,0.03)', border: earned ? '1px solid rgba(255,213,79,0.45)' : '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '10px 12px', opacity: earned ? 1 : 0.75 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                          <span style={{ fontSize: '18px', filter: earned ? 'none' : 'grayscale(1)' }}>{m.icon}</span>
                          <span style={{ fontSize: '12px', fontWeight: 700, color: earned ? '#ffd54f' : '#ccc' }}>{m.title}</span>
                        </div>
                        <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.55)', marginBottom: '6px', minHeight: '24px' }}>{m.desc}</div>
                        {earned ? (
                          <div style={{ fontSize: '10px', color: '#a5d6a7' }}>✓ {new Date(m.earnedAt!).toLocaleDateString()}</div>
                        ) : (
                          <>
                            <div style={{ height: '5px', borderRadius: '3px', background: 'rgba(0,0,0,0.5)', overflow: 'hidden', marginBottom: '3px' }}>
                              <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg,#ffd54f,#ffb300)', borderRadius: '3px' }} />
                            </div>
                            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.45)' }}>{m.value} / {m.goal}</div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
                {!confirmResetAch ? (
                  <button onClick={() => setConfirmResetAch(true)}
                    style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid rgba(231,76,60,0.4)', background: 'rgba(231,76,60,0.07)', color: '#e57373', cursor: 'pointer', fontSize: '12px' }}>
                    ↺ Reset achievements
                  </button>
                ) : (
                  <div style={{ border: '1px solid rgba(231,76,60,0.4)', borderRadius: '8px', padding: '10px 12px', background: 'rgba(231,76,60,0.06)' }}>
                    <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', marginBottom: '8px' }}>
                      Wipe all medals and restart every kill counter from zero? Record medals (best level / wave / survival) keep your records and will re-earn.
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => { resetAchievements(); setConfirmResetAch(false); setAchVersion((v) => v + 1); }}
                        style={{ flex: 1, padding: '7px', borderRadius: '6px', border: '1px solid rgba(231,76,60,0.6)', background: 'rgba(231,76,60,0.18)', color: '#ef9a9a', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>
                        Yes, reset
                      </button>
                      <button onClick={() => setConfirmResetAch(false)}
                        style={{ flex: 1, padding: '7px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.25)', background: '#2a2a2a', color: '#ddd', cursor: 'pointer', fontSize: '12px' }}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {showStats && (() => {
          const ls = getLifetimeStats();
          const sortedKills = Object.entries(ls.killsByType).sort((a, b) => b[1] - a[1]);
          const fmtTime = (sec: number) => (sec >= 3600 ? `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m` : sec >= 60 ? `${Math.floor(sec / 60)}m ${sec % 60}s` : `${sec}s`);
          return (
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(3,5,8,0.66)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 5 }}>
              <div className="fade-in" style={{ background: 'linear-gradient(165deg, #171c23, #0e1116)', border: '1px solid rgba(129,199,132,0.4)', boxShadow: '0 12px 48px rgba(0,0,0,0.6)', borderRadius: '14px', padding: '26px 30px', width: '430px', maxHeight: '78vh', overflowY: 'auto', color: '#ffffff' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h2 style={{ margin: 0, fontSize: '20px', color: '#a5d6a7', letterSpacing: '2px' }}>📊 LIFETIME STATS</h2>
                  <button onClick={() => setShowStats(false)}
                    style={{ width: '28px', height: '28px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.25)', background: '#2a2a2a', color: '#fff', cursor: 'pointer', fontSize: '14px', padding: 0 }}>
                    ✕
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '18px' }}>
                  {([
                    ['Total kills', ls.totalKills.toLocaleString(), '#ef9a9a'],
                    ['Deaths', ls.deaths.toLocaleString(), '#b0bec5'],
                    ['Best level', `${ls.bestLevel}`, '#4fc3f7'],
                    ['Best arena wave', ls.bestArenaWave > 0 ? `${ls.bestArenaWave}` : '—', '#ff7043'],
                    ['Longest survival', ls.longestSurvivalSec > 0 ? fmtTime(ls.longestSurvivalSec) : '—', '#a5d6a7'],
                    ['Types slain', `${sortedKills.length}`, '#ffcc80']
                  ] as const).map(([label, value, color]) => (
                    <div key={label} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '10px 12px' }}>
                      <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '1px' }}>{label}</div>
                      <div style={{ fontSize: '20px', fontWeight: 700, color }}>{value}</div>
                    </div>
                  ))}
                </div>
                <div style={{ fontWeight: 'bold', fontSize: '12px', color: '#a5d6a7', marginBottom: '8px', letterSpacing: '1px' }}>KILLS BY ENEMY</div>
                {sortedKills.length === 0 && (
                  <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>No kills recorded yet — go punch something.</div>
                )}
                {sortedKills.map(([type, count]) => (
                  <div key={type} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', padding: '4px 2px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <span>{ENEMY_LABELS[type as EnemyType] ?? type}</span>
                    <span style={{ color: '#ef9a9a', fontWeight: 700 }}>{count}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {showMenuSettings && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(3,5,8,0.66)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 5 }}>
            <div className="fade-in" style={{ background: 'linear-gradient(165deg, #171c23, #0e1116)', border: '1px solid rgba(79,195,247,0.35)', boxShadow: '0 12px 48px rgba(0,0,0,0.6)', borderRadius: '14px', padding: '26px 30px', width: '380px', color: '#ffffff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ margin: 0, fontSize: '20px', color: '#4fc3f7', letterSpacing: '2px' }}>⚙ SETTINGS</h2>
                <button onClick={() => setShowMenuSettings(false)}
                  style={{ width: '28px', height: '28px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.25)', background: '#2a2a2a', color: '#fff', cursor: 'pointer', fontSize: '14px', padding: 0 }}>
                  ✕
                </button>
              </div>
              <div style={{ marginBottom: '18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '6px' }}>
                  <span>Camera Field of View</span>
                  <span style={{ color: '#4fc3f7', fontWeight: 700 }}>{settings.fov}°</span>
                </div>
                <input
                  type="range"
                  min={50}
                  max={90}
                  step={1}
                  value={settings.fov}
                  onChange={(e) => patchSettings({ fov: Number(e.target.value) })}
                  style={{ width: '100%', cursor: 'pointer' }}
                />
              </div>
              <div style={{ marginBottom: '18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '6px' }}>
                  <span>Camera Follow Distance</span>
                  <span style={{ color: '#4fc3f7', fontWeight: 700 }}>{settings.cameraDistance}%</span>
                </div>
                <input
                  type="range"
                  min={70}
                  max={180}
                  step={5}
                  value={settings.cameraDistance}
                  onChange={(e) => patchSettings({ cameraDistance: Number(e.target.value) })}
                  style={{ width: '100%', cursor: 'pointer' }}
                />
              </div>
              <div style={{ marginBottom: '18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '6px' }}>
                  <span>Sound Volume</span>
                  <span style={{ color: '#4fc3f7', fontWeight: 700 }}>{settings.soundVolume === 0 ? 'Muted' : `${settings.soundVolume}%`}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={settings.soundVolume}
                  onChange={(e) => patchSettings({ soundVolume: Number(e.target.value) })}
                  style={{ width: '100%', cursor: 'pointer' }}
                />
              </div>
              {([
                ['Blood effects', 'showBlood'],
                ['Damage numbers', 'showDamageNumbers'],
                ['Enemy health bars', 'showEnemyHealthBars'],
                ['Minimap', 'showMinimap'],
                ['Enemy last words', 'showLastWords'],
                ['Spawn callouts', 'showSpawnCallouts']
              ] as [string, keyof GameSettings][]).map(([label, key]) => (
                <label key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '13px', cursor: 'pointer', fontSize: '14px' }}>
                  {label}
                  <input
                    type="checkbox"
                    checked={settings[key] as boolean}
                    onChange={(e) => patchSettings({ [key]: e.target.checked })}
                    style={{ cursor: 'pointer', width: '17px', height: '17px' }}
                  />
                </label>
              ))}
              <div style={{ marginTop: '16px', fontSize: '12px', color: 'rgba(255,255,255,0.4)', textAlign: 'center' }}>
                Saved automatically · applies in-game immediately
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Pitch Brawl is a self-contained mode with its own Canvas, arena and
  // rules — none of GameCanvas's world, progression or entity systems apply.
  if (gameMode === 'pitchbrawl') return <PitchBrawl onExit={() => setGameMode(null)} />;

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      <GameCanvas
        playerTint={stickmanColor}
        viewMode={viewMode}
        onScoreAdd={handleScoreAdd}
        onPlayerHealthChange={handlePlayerHealthChange}
        onMaxHealthChange={handleMaxHealthChange}
        onKill={handleKill}
        onLevelChange={handleLevelChange}
        onFlagsProgressChange={handleFlagsProgressChange}
        onDeathsChange={handleDeathsChange}
        onSpecialKillsChange={handleSpecialKillsChange}
        onLevelTimeChange={handleLevelTimeChange}
        onStatusEffectChange={handleStatusEffectChange}
        onPendingSpecialsChange={handlePendingSpecialsChange}
        onFlagGuideChange={handleFlagGuideChange}
        onStaminaChange={handleStaminaChange}
        onStatModifiersChange={handleStatModifiersChange}
        onLoaded={() => setGameLoaded(true)}
        manuallyPaused={manuallyPaused}
        showDebugInfo={showDebugInfo}
        flashlightOn={flashlightOn}
        showLastWords={settings.showLastWords}
        cameraFov={settings.fov}
        cameraDistance={settings.cameraDistance / 100}
        showBlood={settings.showBlood}
        showDamageNumbers={settings.showDamageNumbers}
        showMinimap={settings.showMinimap}
        initialLevel={gameMode === 'arena' ? undefined : saved.current?.level}
        initialStatModifiers={gameMode === 'arena' ? undefined : saved.current?.statModifiers}
        initialHelpers={gameMode === 'arena' ? undefined : saved.current?.helpers}
        onHelpersChange={handleHelpersChange}
        initialDroneLevel={gameMode === 'arena' ? undefined : saved.current?.droneLevel}
        onDroneLevelChange={handleDroneLevelChange}
        initialTurretLevel={gameMode === 'arena' ? undefined : saved.current?.turretLevel}
        onTurretLevelChange={handleTurretLevelChange}
        isSandbox={gameMode === 'sandbox'}
        onSandboxReady={handleSandboxReady}
        showEnemyHealthBars={settings.showEnemyHealthBars}
        modifiers={modifiers}
        onIronmanDeath={handleIronmanDeath}
        isArena={gameMode === 'arena'}
        onArenaWaveChange={handleArenaWaveChange}
        onEntityCountsChange={gameMode === 'sandbox' ? setEntityCounts : undefined}
        onSpawnCallout={settings.showSpawnCallouts ? handleSpawnCallout : undefined}
        offerLoadoutDraft={gameMode === 'normal' && !hasExistingProgressRef.current}
      />

      {/* Loading screen — covers everything until the Canvas fires first frame */}
      {!gameLoaded && (
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse at 50% 40%, #14202b 0%, #0b1016 60%, #06090c 100%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100
        }}>
          <img src={asset('/logo.jpg')} alt="" style={{ width: '76px', height: '76px', borderRadius: '16px', marginBottom: '22px', opacity: 0.95, boxShadow: '0 0 32px rgba(79,195,247,0.25)' }} />
          <div className="game-title" style={{ fontSize: '26px', fontWeight: 700, letterSpacing: '5px' }}>STICKMAN ACTION</div>
          <div className="loading-spinner" style={{ marginTop: '26px' }} />
          <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: '14px', marginTop: '16px', letterSpacing: '2px' }}>LOADING WORLD…</div>
        </div>
      )}

      {gameLoaded && (
        <>
          {flagGuide && (
            <div style={{
              position: 'absolute',
              top: '20px',
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              zIndex: 12,
              pointerEvents: 'none'
            }}>
              <div style={{
                width: '46px',
                height: '46px',
                borderRadius: '50%',
                background: 'rgba(0,0,0,0.6)',
                border: '1px solid rgba(255,255,255,0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <div style={{
                  width: 0,
                  height: 0,
                  borderLeft: '7px solid transparent',
                  borderRight: '7px solid transparent',
                  borderBottom: '16px solid #ffca28',
                  transform: `rotate(${flagGuide.angleRad}rad)`,
                  transformOrigin: 'center'
                }} />
              </div>
              <div style={{
                marginTop: '4px',
                color: '#ffffff',
                fontSize: '12px',
                background: 'rgba(0,0,0,0.6)',
                padding: '2px 8px',
                borderRadius: '4px',
                whiteSpace: 'nowrap'
              }}>
                {Math.round(flagGuide.distanceMeters)}m to flag
              </div>
              {flagGuide.near && (
                <div style={{
                  marginTop: '6px',
                  color: '#fff176',
                  fontWeight: 'bold',
                  fontSize: '14px',
                  background: 'rgba(0,0,0,0.7)',
                  padding: '4px 10px',
                  borderRadius: '4px',
                  whiteSpace: 'nowrap'
                }}>
                  Press E to use flag
                </div>
              )}
            </div>
          )}
          {isLowHealth && (
            <div
              className="low-health-vignette"
              style={{
                position: 'absolute',
                inset: 0,
                zIndex: 35,
                pointerEvents: 'none',
                background: 'radial-gradient(ellipse at center, transparent 35%, rgba(139,0,0,0.75) 100%)',
                boxShadow: 'inset 0 0 160px rgba(139,0,0,0.6)'
              }}
            />
          )}
          {spawnCallout && (
            <div style={{
              position: 'absolute',
              top: '27%',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 29,
              pointerEvents: 'none'
            }}>
              <div className="fade-in" style={{ fontSize: '18px', fontWeight: 700, letterSpacing: '3px', color: '#e040fb', textShadow: '0 0 16px rgba(224,64,251,0.6)', background: 'rgba(0,0,0,0.5)', padding: '6px 18px', borderRadius: '8px' }}>
                ⚠ {spawnCallout}
              </div>
            </div>
          )}
          {waveBanner && (
            <div style={{
              position: 'absolute',
              top: '18%',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 30,
              pointerEvents: 'none'
            }}>
              <div className="game-title fade-in" style={{ fontSize: '40px', fontWeight: 700, letterSpacing: '8px', color: '#ff7043', textShadow: '0 0 24px rgba(255,112,67,0.6)' }}>
                {waveBanner}
              </div>
            </div>
          )}
          {runOver && (
            <div style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(3,4,6,0.82)',
              backdropFilter: 'blur(5px)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 60
            }}>
              <div className="game-title" style={{ fontSize: '46px', fontWeight: 700, letterSpacing: '8px', color: '#ef5350', textShadow: '0 0 28px rgba(239,83,80,0.6)' }}>
                ☠ RUN OVER
              </div>
              <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '15px', letterSpacing: '2px', marginTop: '12px' }}>
                IRONMAN — one life, no second chances. Progress wiped.
              </div>
              {lastRunRecap && (
                <div style={{ marginTop: '22px', display: 'flex', gap: '18px', fontSize: '14px', color: 'rgba(255,255,255,0.75)', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '10px', padding: '12px 22px' }}>
                  <span>☠ {lastRunRecap.kills} kills</span>
                  <span>⚔ {Math.round(lastRunRecap.damageDealt)} dmg dealt</span>
                  <span>🩸 {Math.round(lastRunRecap.damageTaken)} dmg taken</span>
                  <span>⭐ level {lastRunRecap.level}</span>
                  <span>⏱ {Math.max(1, Math.round((Date.now() - lastRunRecap.startedAtMs) / 60000))} min</span>
                </div>
              )}
              <button
                className="menu-btn"
                onClick={() => window.location.reload()}
                style={{ marginTop: '28px', padding: '14px 38px', fontSize: '16px', fontWeight: 700, borderRadius: '10px', border: '2px solid #ef5350', background: 'rgba(239,83,80,0.12)', color: '#ef9a9a', cursor: 'pointer', letterSpacing: '2px' }}
              >
                RETURN TO MENU
              </button>
            </div>
          )}
          {/* The full PAUSED overlay (dim + blur) only appears for a manual P
              pause - opening the settings panel also pauses the game, but
              showing the overlay + blur underneath the panel just gets in
              the way, so it's suppressed while the panel is open. */}
          {manuallyPaused && settingsMinimized && !runOver && (
            <div style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(5, 8, 12, 0.45)',
              backdropFilter: 'blur(3px)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 40,
              pointerEvents: 'none'
            }}>
              <div className="game-title" style={{ fontSize: '46px', fontWeight: 700, letterSpacing: '10px' }}>PAUSED</div>
              <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: '14px', letterSpacing: '3px', marginTop: '10px' }}>PRESS P TO RESUME</div>
            </div>
          )}
          <div className="hud-panel" style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            color: '#ffffff',
            padding: '16px 20px',
            borderRadius: '12px',
            fontSize: '14px',
            zIndex: 10,
            textAlign: 'right',
            minWidth: '190px'
          }}>
            <div style={{ fontSize: '22px', fontWeight: 700, color: '#fd971f', letterSpacing: '1px' }}>🏆 {score.toLocaleString()}</div>
            <div style={{ marginTop: '2px', color: '#a6e22e', fontWeight: 700, letterSpacing: '1px' }}>☠ Kills: {kills}</div>
            <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'space-between', fontSize: '12px', letterSpacing: '1px', color: 'rgba(255,255,255,0.8)' }}>
              <span>❤ HEALTH</span>
              <span style={{ fontWeight: 700 }}>{playerHealth} / {maxHealth}</span>
            </div>
            <div className="bar-track" style={{ marginTop: '4px' }}>
              <div
                className={`bar-fill health${playerHealth / maxHealth < 0.25 ? ' low' : ''}`}
                style={{ width: `${Math.max(0, Math.min(100, (playerHealth / maxHealth) * 100))}%` }}
              />
            </div>
            <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'space-between', fontSize: '12px', letterSpacing: '1px', color: 'rgba(255,255,255,0.8)' }}>
              <span>⚡ STAMINA</span>
              <span style={{ fontWeight: 700 }}>{stamina} / {maxStamina}</span>
            </div>
            <div className="bar-track" style={{ marginTop: '4px', height: '9px' }}>
              <div
                className="bar-fill stamina"
                style={{ width: `${Math.max(0, Math.min(100, (stamina / maxStamina) * 100))}%` }}
              />
            </div>
            {statusEffect && (
              <div style={{
                marginTop: '6px',
                display: 'inline-block',
                padding: '2px 8px',
                borderRadius: '4px',
                fontSize: '12px',
                fontWeight: 'bold',
                color: '#000000',
                background: STATUS_EFFECT_COLORS[statusEffect] ?? '#ffffff'
              }}>
                {statusEffect.toUpperCase()}
              </div>
            )}
            <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.15)', margin: '10px 0' }} />
            {gameMode === 'normal' && (
              <>
                <div>Level: {level}</div>
                <div>Flags Left: {flagsRemaining} / {flagsTotal}</div>
                <div>Special Bosses Left: {pendingSpecials}</div>
                <div>Time: {levelTimeLabel}</div>
              </>
            )}
            {gameMode === 'sandbox' && entityCounts && (
              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.75)', display: 'flex', gap: '10px', flexWrap: 'wrap' }} title="Alive right now: enemies · dummies · civilians · helpers · turrets">
                <span>👾 {entityCounts.enemies}</span>
                <span>🎯 {entityCounts.dummies}</span>
                <span>🚶 {entityCounts.civilians}</span>
                <span>🤝 {entityCounts.helpers}</span>
                <span>🗼 {entityCounts.turrets}</span>
              </div>
            )}
            {gameMode === 'arena' && (
              <>
                <div style={{ color: '#ff7043', fontWeight: 'bold' }}>⚔ Wave: {arenaWave}</div>
                <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>
                  {arenaPhase === 'magma' ? 'Magma Wasteland' : arenaPhase === 'sand' ? 'Sand Pit' : arenaPhase === 'falling' ? 'Falling…' : arenaPhase === 'concrete' ? 'Concrete Room' : 'Brick Cage'}
                </div>
                <div>Time: {levelTimeLabel}</div>
              </>
            )}
            <div>Deaths: {deaths}</div>
            <div>Special Boss Kills: {specialKills}</div>
          </div>
          <div className="hud-panel" style={{
            position: 'absolute',
            top: '20px',
            left: '20px',
            color: '#ffffff',
            padding: settingsMinimized ? '10px 14px' : '16px',
            borderRadius: '12px',
            fontSize: '14px',
            border: gameMode === 'sandbox' ? '1px solid rgba(166,226,46,0.4)' : undefined,
            zIndex: 10,
            width: settingsMinimized ? undefined : '270px'
          }}>
            {/* ── Header ── */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: settingsMinimized ? 0 : '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <img src={asset('/logo.jpg')} alt="" style={{ width: '24px', height: '24px', borderRadius: '5px' }} />
                <h3 style={{ margin: 0, fontSize: '14px', color: gameMode === 'sandbox' ? '#a6e22e' : '#4fc3f7' }}>
                  {gameMode === 'sandbox' ? '🧪 Sandbox' : 'Stickman Settings'}
                </h3>
              </div>
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                {!settingsMinimized && (
                  <>
                    <button onClick={() => setSettingsPage(p => Math.max(1, p - 1))} disabled={settingsPage === 1}
                      style={{ width: '22px', height: '22px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.25)', background: '#2a2a2a', color: settingsPage === 1 ? '#555' : '#fff', cursor: settingsPage === 1 ? 'default' : 'pointer', fontSize: '12px', padding: 0 }}>◄</button>
                    <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', minWidth: '30px', textAlign: 'center' }}>{settingsPage}/{maxSettingsPage}</span>
                    <button onClick={() => setSettingsPage(p => Math.min(maxSettingsPage, p + 1))} disabled={settingsPage === maxSettingsPage}
                      style={{ width: '22px', height: '22px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.25)', background: '#2a2a2a', color: settingsPage === maxSettingsPage ? '#555' : '#fff', cursor: settingsPage === maxSettingsPage ? 'default' : 'pointer', fontSize: '12px', padding: 0 }}>►</button>
                  </>
                )}
                <button onClick={handleSettingsToggle} title={settingsMinimized ? 'Expand' : 'Minimize'}
                  style={{ width: '22px', height: '22px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.3)', background: '#2a2a2a', color: '#ffffff', cursor: 'pointer', fontSize: '14px', lineHeight: 1, padding: 0 }}>
                  {settingsMinimized ? '+' : '−'}
                </button>
              </div>
            </div>

            {!settingsMinimized && (
              <div className="hud-scroll" style={{ maxHeight: 'calc(100vh - 130px)', overflowY: 'auto', paddingRight: '4px' }}>

                {/* ── Page 1: Normal settings ── */}
                {settingsPage === 1 && (
                  <>
                    <div style={{ marginBottom: '14px' }}>
                      <div style={{ marginBottom: '6px', fontWeight: 'bold', fontSize: '12px' }}>Change Tint:</div>
                      <input type="color" value={stickmanColor} onChange={e => setStickmanColor(e.target.value)}
                        style={{ width: '100%', height: '32px', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '6px', background: 'none', padding: '2px' }} />
                    </div>
                    {gameMode === 'sandbox' && (
                      <>
                        <div style={{ marginBottom: '10px' }}>
                          <div style={{ marginBottom: '6px', fontWeight: 'bold', fontSize: '12px', color: '#a6e22e' }}>Time of Day:</div>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            {(['day', null, 'night'] as const).map(t => (
                              <button key={String(t)} onClick={() => setTimeOfDay(t)}
                                style={{ flex: 1, padding: '6px', borderRadius: '5px', fontSize: '11px', cursor: 'pointer', border: `1px solid ${sbTimeOfDay === t ? '#a6e22e' : 'rgba(255,255,255,0.2)'}`, background: sbTimeOfDay === t ? 'rgba(166,226,46,0.15)' : '#2a2a2a', color: sbTimeOfDay === t ? '#a6e22e' : '#ccc' }}>
                                {t === 'day' ? '☀️ Day' : t === 'night' ? '🌙 Night' : '🔄 Auto'}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div style={{ marginBottom: '10px' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px' }}>
                            <input type="checkbox" checked={sbEnemiesIgnore} onChange={e => setEnemiesIgnore(e.target.checked)} style={{ cursor: 'pointer' }} />
                            Enemies ignore you
                          </label>
                        </div>
                      </>
                    )}
                    <div style={{ marginBottom: '10px' }}>
                      <button onClick={toggleViewMode} style={{ width: '100%', padding: '7px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.3)', background: '#2a2a2a', color: '#fff', cursor: 'pointer', fontSize: '12px' }}>
                        Camera: {viewMode === 'third' ? 'Third Person' : 'First Person'} (V)
                      </button>
                    </div>
                    <div style={{ marginBottom: '10px' }}>
                      <button onClick={() => setFlashlightOn(p => !p)} style={{ width: '100%', padding: '7px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.3)', background: flashlightOn ? '#3a3a1a' : '#2a2a2a', color: flashlightOn ? '#ffd54f' : '#fff', cursor: 'pointer', fontSize: '12px' }}>
                        Flashlight: {flashlightOn ? 'On' : 'Off'} (L)
                      </button>
                    </div>
                    <div style={{ marginBottom: '10px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px' }}>
                        <input type="checkbox" checked={showDebugInfo} onChange={e => setShowDebugInfo(e.target.checked)} style={{ cursor: 'pointer' }} />
                        Debug: alive entities + hitboxes
                      </label>
                    </div>
                    <div style={{ marginBottom: '10px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px' }}>
                        <input type="checkbox" checked={settings.showLastWords} onChange={e => patchSettings({ showLastWords: e.target.checked })} style={{ cursor: 'pointer' }} />
                        Show enemy last words
                      </label>
                    </div>
                    <div style={{ marginBottom: '10px' }}>
                      <button onClick={() => window.open(asset('/encyclopedia/index.html'), '_blank')}
                        style={{ width: '100%', padding: '7px', borderRadius: '6px', border: '1px solid rgba(255,167,38,0.5)', background: 'rgba(255,167,38,0.08)', color: '#ffcc80', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>
                        Enemy Encyclopedia ↗
                      </button>
                    </div>
                    <div style={{ marginBottom: '10px' }}>
                      <button onClick={handleGoToMainMenu}
                        style={{ width: '100%', padding: '7px', borderRadius: '6px', border: '1px solid rgba(79,195,247,0.5)', background: 'rgba(79,195,247,0.08)', color: '#4fc3f7', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>
                        ⌂ Main Menu
                      </button>
                    </div>
                    {gameMode === 'normal' && (
                      <div style={{ marginBottom: '10px' }}>
                        {!showResetConfirm ? (
                          <button onClick={handleResetProgress} style={{ width: '100%', padding: '7px', borderRadius: '6px', border: '1px solid rgba(231,76,60,0.5)', background: 'rgba(231,76,60,0.08)', color: '#e74c3c', cursor: 'pointer', fontSize: '12px' }}>Reset Progress</button>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <div style={{ fontSize: '11px', color: '#e74c3c', textAlign: 'center' }}>Are you sure?</div>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <button onClick={handleResetProgress} style={{ flex: 1, padding: '6px', borderRadius: '6px', border: '1px solid rgba(231,76,60,0.7)', background: 'rgba(231,76,60,0.2)', color: '#e74c3c', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>Yes</button>
                              <button onClick={() => setShowResetConfirm(false)} style={{ flex: 1, padding: '6px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.2)', background: '#2a2a2a', color: '#aaa', cursor: 'pointer', fontSize: '12px' }}>Cancel</button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.1)', margin: '10px 0' }} />
                    <div style={{ fontSize: '12px', lineHeight: 1.7 }}>
                      <div><strong>WASD / Arrows</strong> : Move</div>
                      <div><strong>Shift</strong> : Sprint</div>
                      <div><strong>Space</strong> : Jump</div>
                      <div><strong>C</strong> : Crouch</div>
                      <div><strong>F</strong> : Punch &nbsp; <strong>G</strong> : Kick</div>
                      <div><strong>Q</strong> : Parry &nbsp; <strong>E</strong> : Flag</div>
                      <div><strong>V</strong> : Camera &nbsp; <strong>P</strong> : Pause</div>
                      <div><strong>L</strong> : Flashlight</div>
                    </div>
                  </>
                )}

                {/* ── Page 2: Upgrades (sandbox) ── */}
                {gameMode === 'sandbox' && settingsPage === 2 && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <div style={{ fontWeight: 'bold', fontSize: '12px', color: '#a6e22e' }}>Give yourself any upgrade:</div>
                      <button onClick={() => sb(a => a.resetStats())}
                        style={{ padding: '4px 8px', borderRadius: '5px', border: '1px solid rgba(231,76,60,0.5)', background: 'rgba(231,76,60,0.1)', color: '#e74c3c', cursor: 'pointer', fontSize: '10px' }}>
                        Reset All Stats
                      </button>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '14px' }}>
                      {UPGRADE_OPTIONS.map(({ label, option }) => (
                        <button key={option} onClick={() => sb(a => a.giveUpgrade(option))}
                          style={{ padding: '5px 10px', borderRadius: '5px', border: '1px solid rgba(166,226,46,0.4)', background: 'rgba(166,226,46,0.08)', color: '#a6e22e', cursor: 'pointer', fontSize: '11px' }}>
                          {label}
                        </button>
                      ))}
                    </div>
                    <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.1)', margin: '10px 0' }} />
                    <div style={{ fontWeight: 'bold', fontSize: '12px', color: '#4fc3f7', marginBottom: '8px' }}>
                      Helpers ({latestHelpers.length}):
                    </div>
                    {latestHelpers.length === 0 && (
                      <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginBottom: '8px' }}>No helpers yet — add one above.</div>
                    )}
                    {latestHelpers.map(h => (
                      <div key={h.id} style={{ marginBottom: '8px', padding: '6px 8px', borderRadius: '5px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                          <span style={{ fontSize: '11px', color: h.health > 0 ? '#4fc3f7' : '#777' }}>
                            {h.id} — HP {h.health}/{h.maxHealth} {h.health <= 0 ? '(dead)' : ''}
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                          <button onClick={() => sb(a => a.upgradeHelper(h.id, 'helperLevelUp2'))}
                            style={{ padding: '3px 7px', borderRadius: '4px', border: '1px solid rgba(166,226,46,0.4)', background: 'rgba(166,226,46,0.08)', color: '#a6e22e', cursor: 'pointer', fontSize: '10px' }}>+Lvl</button>
                          <button onClick={() => sb(a => a.upgradeHelper(h.id, 'helperMoveSpeed'))}
                            style={{ padding: '3px 7px', borderRadius: '4px', border: '1px solid rgba(166,226,46,0.4)', background: 'rgba(166,226,46,0.08)', color: '#a6e22e', cursor: 'pointer', fontSize: '10px' }}>+Spd</button>
                          <button onClick={() => sb(a => a.upgradeHelper(h.id, 'helperAttackSpeed'))}
                            style={{ padding: '3px 7px', borderRadius: '4px', border: '1px solid rgba(166,226,46,0.4)', background: 'rgba(166,226,46,0.08)', color: '#a6e22e', cursor: 'pointer', fontSize: '10px' }}>+Atk</button>
                        </div>
                      </div>
                    ))}
                    <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.1)', margin: '10px 0' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontWeight: 'bold', fontSize: '12px', color: '#4fc3f7' }}>
                        Drone: Lvl {latestDroneLevel}
                      </div>
                      <button onClick={() => sb(a => a.giveUpgrade('drone'))}
                        style={{ padding: '4px 8px', borderRadius: '5px', border: '1px solid rgba(79,195,247,0.4)', background: 'rgba(79,195,247,0.08)', color: '#4fc3f7', cursor: 'pointer', fontSize: '10px' }}>
                        + Drone
                      </button>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                      <div style={{ fontWeight: 'bold', fontSize: '12px', color: '#4fc3f7' }}>
                        Turrets: Lvl {latestTurretLevel}
                      </div>
                      <button onClick={() => sb(a => a.giveUpgrade('turret'))}
                        style={{ padding: '4px 8px', borderRadius: '5px', border: '1px solid rgba(79,195,247,0.4)', background: 'rgba(79,195,247,0.08)', color: '#4fc3f7', cursor: 'pointer', fontSize: '10px' }}>
                        + Turret
                      </button>
                    </div>
                  </>
                )}

                {/* ── Page 3: Spawn Enemy (sandbox) ── */}
                {gameMode === 'sandbox' && settingsPage === 3 && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <div style={{ fontWeight: 'bold', fontSize: '12px', color: '#a6e22e' }}>Spawn any enemy:</div>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '11px', color: spawnAsHelperMode ? '#4fc3f7' : '#aaa' }}>
                        <input type="checkbox" checked={spawnAsHelperMode} onChange={e => setSpawnAsHelperMode(e.target.checked)} style={{ cursor: 'pointer' }} />
                        Spawn as helper
                      </label>
                    </div>
                    <div style={{ display: 'flex', gap: '10px', marginBottom: '10px', flexWrap: 'wrap' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontSize: '11px', color: spawnClear ? '#d0eeff' : '#aaa' }} title="Translucent Clear variant: 75% health">
                        <input type="checkbox" checked={spawnClear} onChange={e => setSpawnClear(e.target.checked)} style={{ cursor: 'pointer' }} />
                        🫧 Clear
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontSize: '11px', color: spawnGiant ? '#ffcc80' : '#aaa' }} title="Giant: 1.8× size, 2× health/damage, slower">
                        <input type="checkbox" checked={spawnGiant} onChange={e => setSpawnGiant(e.target.checked)} style={{ cursor: 'pointer' }} />
                        🗿 Giant
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontSize: '11px', color: spawnArmoured ? '#cfd8dc' : '#aaa' }} title="Straps Armour Man's plates onto whatever you spawn">
                        <input type="checkbox" checked={spawnArmoured} onChange={e => setSpawnArmoured(e.target.checked)} style={{ cursor: 'pointer' }} />
                        🦾 Armoured
                      </label>
                    </div>
                    {SANDBOX_ENEMY_GROUPS.map(group => (
                      <div key={group.label} style={{ marginBottom: '12px' }}>
                        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginBottom: '5px' }}>{group.label}</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                          {group.types.map(type => {
                            const dummyAsHelper = spawnAsHelperMode && DUMMY_TYPES.includes(type);
                            return (
                              <button key={type} disabled={dummyAsHelper}
                                title={dummyAsHelper ? "Dummies can't be helpers" : undefined}
                                onClick={() => spawnAsHelperMode ? sb(a => a.spawnAsHelper(type)) : sb(a => a.spawnEnemy(type, spawnOpts))}
                                style={{ padding: '4px 8px', borderRadius: '4px', border: spawnAsHelperMode ? '1px solid rgba(79,195,247,0.5)' : '1px solid rgba(255,255,255,0.2)', background: spawnAsHelperMode ? 'rgba(79,195,247,0.08)' : '#1e1e1e', color: spawnAsHelperMode ? '#4fc3f7' : '#ddd', cursor: dummyAsHelper ? 'not-allowed' : 'pointer', opacity: dummyAsHelper ? 0.35 : 1, fontSize: '11px' }}>
                                {ENEMY_LABELS[type] ?? type}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                    <div style={{ marginBottom: '12px' }}>
                      <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginBottom: '5px' }}>Units</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                        <button onClick={() => spawnAsHelperMode ? sb(a => a.spawnCivilianHelper()) : sb(a => a.spawnCivilian())}
                          title={spawnAsHelperMode ? 'Recruits a civilian helper: 10 HP, deals no damage' : 'A harmless wanderer that flees from enemies'}
                          style={{ padding: '4px 10px', borderRadius: '4px', border: '1px solid rgba(232,216,195,0.5)', background: 'rgba(232,216,195,0.08)', color: '#e8d8c3', cursor: 'pointer', fontSize: '11px' }}>
                          🚶 Civilian
                        </button>
                        <button disabled={spawnAsHelperMode} onClick={() => sb(a => a.spawnDummy())}
                          title={spawnAsHelperMode ? "Dummies can't be helpers" : 'Passive practice target: +1 max HP on kill'}
                          style={{ padding: '4px 10px', borderRadius: '4px', border: '1px solid rgba(194,178,128,0.5)', background: 'rgba(194,178,128,0.08)', color: '#c2b280', cursor: spawnAsHelperMode ? 'not-allowed' : 'pointer', opacity: spawnAsHelperMode ? 0.35 : 1, fontSize: '11px' }}>
                          🎯 N.Dummy
                        </button>
                        <button onClick={() => sb(a => a.spawnArmyMan('melee'))}
                          title="Neutral soldier: passive until he sees a civilian or armyman attacked — then hunts the attacker (you included)"
                          style={{ padding: '4px 10px', borderRadius: '4px', border: '1px solid rgba(75,83,32,0.7)', background: 'rgba(75,83,32,0.15)', color: '#a5b36a', cursor: 'pointer', fontSize: '11px' }}>
                          🪖 Army (Melee)
                        </button>
                        <button onClick={() => sb(a => a.spawnArmyMan('ranged'))}
                          title="Neutral rifleman: passive until provoked, then fires from range"
                          style={{ padding: '4px 10px', borderRadius: '4px', border: '1px solid rgba(51,105,30,0.7)', background: 'rgba(51,105,30,0.15)', color: '#9ccc65', cursor: 'pointer', fontSize: '11px' }}>
                          🎯 Army (Ranged)
                        </button>
                        <button onClick={() => sb(a => a.spawnBodyguard())}
                          title="Not a helper: just follows you and retaliates against whatever hurts you. Dies for good."
                          style={{ padding: '4px 10px', borderRadius: '4px', border: '1px solid rgba(96,125,139,0.6)', background: 'rgba(96,125,139,0.12)', color: '#b0bec5', cursor: 'pointer', fontSize: '11px' }}>
                          🕴 Bodyguard
                        </button>
                        <button onClick={() => sb(a => a.spawnVip())}
                          title="A high-value civilian escorted by three bodyguards assigned to him, not to you. Flees like a civilian; the escort fights."
                          style={{ padding: '4px 10px', borderRadius: '4px', border: '1px solid rgba(255,213,79,0.6)', background: 'rgba(255,213,79,0.12)', color: '#ffd54f', cursor: 'pointer', fontSize: '11px' }}>
                          ⭐ VIP + Escort
                        </button>
                        <button onClick={() => sb(a => a.spawnEnemyBodyguard())}
                          title="Attaches to a random living enemy and guards it — only fights once its protectee is hurt"
                          style={{ padding: '4px 10px', borderRadius: '4px', border: '1px solid rgba(57,73,171,0.7)', background: 'rgba(57,73,171,0.15)', color: '#7986cb', cursor: 'pointer', fontSize: '11px' }}>
                          🛡 E.Bodyguard
                        </button>
                        <button onClick={() => sb(a => a.spawnEnemyTurret())}
                          title="A killable enemy sentry (3 HP) that stays until destroyed"
                          style={{ padding: '4px 10px', borderRadius: '4px', border: '1px solid rgba(255,143,0,0.6)', background: 'rgba(255,143,0,0.12)', color: '#ffb74d', cursor: 'pointer', fontSize: '11px' }}>
                          🗼 E.Turret
                        </button>
                      </div>
                    </div>
                  </>
                )}

                {/* ── Page 4: Spawn Flag (sandbox) ── */}
                {gameMode === 'sandbox' && settingsPage === 4 && (
                  <>
                    <div style={{ fontWeight: 'bold', fontSize: '12px', color: '#a6e22e', marginBottom: '10px' }}>Spawn a flag:</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {([['normal', '🚩 Normal Flag', '#ef5350'], ['giant', '🏴 Giant Flag', '#ab47bc'], ['bonus', '⭐ Bonus Flag', '#fdd835'], ['challenge', '💀 Challenge Flag', '#ff7043'], ['clear', '🫧 Clear Flag (Clear specials only)', '#ef9a9a'], ['boss', '👹 Boss Flag (sealed arena fight)', '#7c4dff']] as const).map(([variant, label, color]) => (
                        <button key={variant} onClick={() => sb(a => a.spawnFlag(variant))}
                          style={{ padding: '8px', borderRadius: '6px', border: `1px solid ${color}55`, background: `${color}11`, color, cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </>
                )}

                {/* ── Page 5: Edit Enemy Stats (sandbox) ── */}
                {gameMode === 'sandbox' && settingsPage === 5 && (
                  <>
                    <div style={{ fontWeight: 'bold', fontSize: '12px', color: '#a6e22e', marginBottom: '10px' }}>Enemy stat bonuses (current session):</div>
                    {([
                      ['Health Bonus', 'enemyHealthBonus', 1],
                      ['Damage Bonus', 'enemyDamageBonus', 1],
                      ['Atk Speed Bonus', 'enemyAttackSpeedBonus', 0.15],
                      ['Move Speed Bonus', 'enemyMoveSpeedBonus', 0.15],
                    ] as [string, keyof StatModifiers, number][]).map(([label, key, step]) => (
                      <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ fontSize: '12px', color: '#ccc' }}>{label}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <button onClick={() => sb(a => a.patchStatMods({ [key]: Math.max(0, (latestStatModifiers[key] as number) - step) }))}
                            style={{ width: '22px', height: '22px', borderRadius: '3px', border: '1px solid rgba(255,255,255,0.2)', background: '#2a2a2a', color: '#ef5350', cursor: 'pointer', fontSize: '14px', padding: 0, lineHeight: 1 }}>−</button>
                          <span style={{ fontSize: '12px', minWidth: '36px', textAlign: 'center', color: '#fff' }}>{+(latestStatModifiers[key] as number).toFixed(2)}</span>
                          <button onClick={() => sb(a => a.patchStatMods({ [key]: (latestStatModifiers[key] as number) + step }))}
                            style={{ width: '22px', height: '22px', borderRadius: '3px', border: '1px solid rgba(255,255,255,0.2)', background: '#2a2a2a', color: '#a6e22e', cursor: 'pointer', fontSize: '14px', padding: 0, lineHeight: 1 }}>+</button>
                        </div>
                      </div>
                    ))}
                  </>
                )}

                {/* ── Page 6: Edit Player Stats (sandbox) ── */}
                {gameMode === 'sandbox' && settingsPage === 6 && (
                  <>
                    <div style={{ fontWeight: 'bold', fontSize: '12px', color: '#a6e22e', marginBottom: '10px' }}>Your stat bonuses:</div>
                    {([
                      ['Health Bonus', 'playerHealthBonus', 1],
                      ['Damage Bonus', 'playerDamageBonus', 1],
                      ['Atk Speed Bonus', 'playerAttackSpeedBonus', 0.15],
                      ['Move Speed Bonus', 'playerMoveSpeedBonus', 0.15],
                      ['Stamina Bonus', 'staminaMaxBonus', 25],
                    ] as [string, keyof StatModifiers, number][]).map(([label, key, step]) => (
                      <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ fontSize: '12px', color: '#ccc' }}>{label}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <button onClick={() => sb(a => a.patchStatMods({ [key]: Math.max(0, (latestStatModifiers[key] as number) - step) }))}
                            style={{ width: '22px', height: '22px', borderRadius: '3px', border: '1px solid rgba(255,255,255,0.2)', background: '#2a2a2a', color: '#ef5350', cursor: 'pointer', fontSize: '14px', padding: 0, lineHeight: 1 }}>−</button>
                          <span style={{ fontSize: '12px', minWidth: '36px', textAlign: 'center', color: '#fff' }}>{+(latestStatModifiers[key] as number).toFixed(2)}</span>
                          <button onClick={() => sb(a => a.patchStatMods({ [key]: (latestStatModifiers[key] as number) + step }))}
                            style={{ width: '22px', height: '22px', borderRadius: '3px', border: '1px solid rgba(255,255,255,0.2)', background: '#2a2a2a', color: '#a6e22e', cursor: 'pointer', fontSize: '14px', padding: 0, lineHeight: 1 }}>+</button>
                        </div>
                      </div>
                    ))}
                  </>
                )}

                {/* ── Accessibility, Modifiers & Saved Runs (last page, all modes) ── */}
                {settingsPage === accessibilityPage && (
                  <>
                    <div style={{ fontWeight: 'bold', fontSize: '12px', color: '#4fc3f7', marginBottom: '10px' }}>♿ ACCESSIBILITY</div>
                    <div style={{ marginBottom: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                        <span>Camera FOV</span>
                        <span style={{ color: '#4fc3f7', fontWeight: 'bold' }}>{settings.fov}°</span>
                      </div>
                      <input type="range" min={50} max={90} step={1} value={settings.fov}
                        onChange={(e) => patchSettings({ fov: Number(e.target.value) })}
                        style={{ width: '100%', cursor: 'pointer' }} />
                    </div>
                    <div style={{ marginBottom: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                        <span>Camera Distance</span>
                        <span style={{ color: '#4fc3f7', fontWeight: 'bold' }}>{settings.cameraDistance}%</span>
                      </div>
                      <input type="range" min={70} max={180} step={5} value={settings.cameraDistance}
                        onChange={(e) => patchSettings({ cameraDistance: Number(e.target.value) })}
                        style={{ width: '100%', cursor: 'pointer' }} />
                    </div>
                    <div style={{ marginBottom: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                        <span>Sound Volume</span>
                        <span style={{ color: '#4fc3f7', fontWeight: 'bold' }}>{settings.soundVolume === 0 ? 'Muted' : `${settings.soundVolume}%`}</span>
                      </div>
                      <input type="range" min={0} max={100} step={5} value={settings.soundVolume}
                        onChange={(e) => patchSettings({ soundVolume: Number(e.target.value) })}
                        style={{ width: '100%', cursor: 'pointer' }} />
                    </div>
                    {([
                      ['Blood effects', 'showBlood'],
                      ['Damage numbers', 'showDamageNumbers'],
                      ['Enemy health bars', 'showEnemyHealthBars'],
                      ['Minimap', 'showMinimap'],
                      ['Enemy last words', 'showLastWords'],
                      ['Spawn callouts', 'showSpawnCallouts']
                    ] as [string, keyof GameSettings][]).map(([label, key]) => (
                      <label key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', cursor: 'pointer', fontSize: '12px' }}>
                        {label}
                        <input type="checkbox" checked={settings[key] as boolean}
                          onChange={(e) => patchSettings({ [key]: e.target.checked })}
                          style={{ cursor: 'pointer' }} />
                      </label>
                    ))}

                    <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.1)', margin: '12px 0' }} />
                    <div style={{ fontWeight: 'bold', fontSize: '12px', color: '#ff7043', marginBottom: '4px' }}>⚠ MODIFIERS</div>
                    <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.45)', marginBottom: '10px' }}>Saved instantly · take effect on new spawns/hits</div>
                    {MODIFIER_INFO.map(({ key, label, desc }) => (
                      <label key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '10px', cursor: 'pointer' }}>
                        <span>
                          <span style={{ fontSize: '12px', fontWeight: 'bold', color: modifiers[key] ? '#ff7043' : '#ddd' }}>{label}</span>
                          <span style={{ display: 'block', fontSize: '10px', color: 'rgba(255,255,255,0.45)', marginTop: '1px' }}>{desc}</span>
                        </span>
                        <input type="checkbox" checked={modifiers[key]}
                          onChange={(e) => patchModifiers({ [key]: e.target.checked })}
                          style={{ cursor: 'pointer', marginTop: '2px' }} />
                      </label>
                    ))}

                    <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.1)', margin: '12px 0' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <div style={{ fontWeight: 'bold', fontSize: '12px', color: '#ffcc80' }}>💾 SAVED RUNS</div>
                      <button onClick={handleSaveCurrentRun}
                        style={{ padding: '4px 8px', borderRadius: '5px', border: '1px solid rgba(255,204,128,0.5)', background: 'rgba(255,204,128,0.08)', color: '#ffcc80', cursor: 'pointer', fontSize: '10px' }}>
                        + Save current run
                      </button>
                    </div>
                    {runSlots.length === 0 && (
                      <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>No saved runs yet — snapshot your progress above.</div>
                    )}
                    {runSlots.map((s) => (
                      <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px', marginBottom: '6px', padding: '6px 8px', borderRadius: '5px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)' }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#ffcc80' }}>{s.name} — Lvl {s.progress.level}</div>
                          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.45)' }}>
                            🏆 {s.progress.score} · {new Date(s.savedAt).toLocaleDateString()} {new Date(s.savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                          <button onClick={() => handleLoadRun(s)}
                            style={{ padding: '3px 8px', borderRadius: '4px', border: '1px solid rgba(166,226,46,0.4)', background: 'rgba(166,226,46,0.08)', color: '#a6e22e', cursor: 'pointer', fontSize: '10px' }}>Load</button>
                          <button onClick={() => handleDeleteRun(s.id)} title="Delete this saved run"
                            style={{ padding: '3px 7px', borderRadius: '4px', border: '1px solid rgba(231,76,60,0.4)', background: 'rgba(231,76,60,0.08)', color: '#e74c3c', cursor: 'pointer', fontSize: '10px' }}>✕</button>
                        </div>
                      </div>
                    ))}
                  </>
                )}

              </div>
            )}
          </div>

          {/* ── Sandbox bottom quick-spawn bar (minimizable) ── */}
          {gameMode === 'sandbox' && spawnBarMinimized && (
            <button onClick={() => setSpawnBarMinimized(false)}
              title="Show the spawn menu"
              style={{ position: 'absolute', bottom: '16px', left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.82)', border: '1px solid rgba(166,226,46,0.35)', borderRadius: '10px', padding: '7px 16px', zIndex: 10, color: '#a6e22e', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px', whiteSpace: 'nowrap' }}>
              🧪 SPAWN MENU ▲
            </button>
          )}
          {gameMode === 'sandbox' && !spawnBarMinimized && (
            <div style={{ position: 'absolute', bottom: '16px', left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.82)', border: '1px solid rgba(166,226,46,0.35)', borderRadius: '10px', padding: '10px 14px', zIndex: 10, maxWidth: 'calc(100vw - 40px)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px', flexWrap: 'wrap' }}>
                <button onClick={() => setSpawnBarMinimized(true)}
                  title="Minimize the spawn menu"
                  style={{ padding: '2px 9px', borderRadius: '5px', border: '1px solid rgba(166,226,46,0.4)', background: 'rgba(166,226,46,0.08)', color: '#a6e22e', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', lineHeight: 1.4 }}>
                  ▼
                </button>
                <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', fontSize: '10px', color: spawnAsHelperMode ? '#4fc3f7' : 'rgba(255,255,255,0.5)' }}>
                  <input type="checkbox" checked={spawnAsHelperMode} onChange={e => setSpawnAsHelperMode(e.target.checked)} style={{ cursor: 'pointer' }} />
                  Spawn as helper
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', fontSize: '10px', color: spawnClear ? '#d0eeff' : 'rgba(255,255,255,0.5)' }}>
                  <input type="checkbox" checked={spawnClear} onChange={e => setSpawnClear(e.target.checked)} style={{ cursor: 'pointer' }} />
                  🫧 Clear
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', fontSize: '10px', color: spawnGiant ? '#ffcc80' : 'rgba(255,255,255,0.5)' }}>
                  <input type="checkbox" checked={spawnGiant} onChange={e => setSpawnGiant(e.target.checked)} style={{ cursor: 'pointer' }} />
                  🗿 Giant
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', fontSize: '10px', color: spawnArmoured ? '#cfd8dc' : 'rgba(255,255,255,0.5)' }}>
                  <input type="checkbox" checked={spawnArmoured} onChange={e => setSpawnArmoured(e.target.checked)} style={{ cursor: 'pointer' }} />
                  🦾 Armoured
                </label>
              </div>
              {/* Wraps instead of scrolling sideways so NO group ever hides
                  off-screen; tall overflow scrolls vertically instead. */}
              <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', flexWrap: 'wrap', justifyContent: 'center', maxHeight: '36vh', overflowY: 'auto' }}>
                {SANDBOX_ENEMY_GROUPS.map(group => (
                  <div key={group.label} style={{ flexShrink: 0 }}>
                    <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.45)', marginBottom: '4px', whiteSpace: 'nowrap' }}>{group.label}</div>
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', maxWidth: '220px' }}>
                      {group.types.map(type => {
                        const dummyAsHelper = spawnAsHelperMode && DUMMY_TYPES.includes(type);
                        return (
                          <button key={type} disabled={dummyAsHelper}
                            title={dummyAsHelper ? "Dummies can't be helpers" : undefined}
                            onClick={() => spawnAsHelperMode ? sb(a => a.spawnAsHelper(type)) : sb(a => a.spawnEnemy(type, spawnOpts))}
                            style={{ padding: '3px 7px', borderRadius: '4px', border: spawnAsHelperMode ? '1px solid rgba(79,195,247,0.4)' : '1px solid rgba(255,255,255,0.15)', background: spawnAsHelperMode ? 'rgba(79,195,247,0.1)' : '#1a1a1a', color: spawnAsHelperMode ? '#4fc3f7' : '#ddd', cursor: dummyAsHelper ? 'not-allowed' : 'pointer', opacity: dummyAsHelper ? 0.35 : 1, fontSize: '10px', whiteSpace: 'nowrap' }}>
                            {ENEMY_LABELS[type] ?? type}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
                <div style={{ flexShrink: 0 }}>
                  <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.45)', marginBottom: '4px' }}>Units</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <button onClick={() => spawnAsHelperMode ? sb(a => a.spawnCivilianHelper()) : sb(a => a.spawnCivilian())}
                      title={spawnAsHelperMode ? 'Recruits a civilian helper: 10 HP, deals no damage' : 'A harmless wanderer that flees from enemies'}
                      style={{ padding: '3px 8px', borderRadius: '4px', border: '1px solid rgba(232,216,195,0.45)', background: 'rgba(232,216,195,0.1)', color: '#e8d8c3', cursor: 'pointer', fontSize: '10px', whiteSpace: 'nowrap' }}>
                      🚶 Civilian
                    </button>
                    <button disabled={spawnAsHelperMode} onClick={() => sb(a => a.spawnDummy())}
                      title={spawnAsHelperMode ? "Dummies can't be helpers" : 'Passive practice target: +1 max HP on kill'}
                      style={{ padding: '3px 8px', borderRadius: '4px', border: '1px solid rgba(194,178,128,0.45)', background: 'rgba(194,178,128,0.1)', color: '#c2b280', cursor: spawnAsHelperMode ? 'not-allowed' : 'pointer', opacity: spawnAsHelperMode ? 0.35 : 1, fontSize: '10px', whiteSpace: 'nowrap' }}>
                      🎯 N.Dummy
                    </button>
                    <button onClick={() => sb(a => a.spawnArmyMan('melee'))}
                      title="Neutral soldier: passive until he sees a civilian or armyman attacked"
                      style={{ padding: '3px 8px', borderRadius: '4px', border: '1px solid rgba(75,83,32,0.7)', background: 'rgba(75,83,32,0.18)', color: '#a5b36a', cursor: 'pointer', fontSize: '10px', whiteSpace: 'nowrap' }}>
                      🪖 Army (M)
                    </button>
                    <button onClick={() => sb(a => a.spawnArmyMan('ranged'))}
                      title="Neutral rifleman: passive until provoked, then fires from range"
                      style={{ padding: '3px 8px', borderRadius: '4px', border: '1px solid rgba(51,105,30,0.7)', background: 'rgba(51,105,30,0.18)', color: '#9ccc65', cursor: 'pointer', fontSize: '10px', whiteSpace: 'nowrap' }}>
                      🎯 Army (R)
                    </button>
                    <button onClick={() => sb(a => a.spawnBodyguard())}
                      title="Not a helper: follows you and retaliates against whatever hurts you"
                      style={{ padding: '3px 8px', borderRadius: '4px', border: '1px solid rgba(96,125,139,0.55)', background: 'rgba(96,125,139,0.14)', color: '#b0bec5', cursor: 'pointer', fontSize: '10px', whiteSpace: 'nowrap' }}>
                      🕴 Bodyguard
                    </button>
                    <button onClick={() => sb(a => a.spawnEnemyBodyguard())}
                      title="Attaches to a random living enemy and guards it"
                      style={{ padding: '3px 8px', borderRadius: '4px', border: '1px solid rgba(57,73,171,0.7)', background: 'rgba(57,73,171,0.16)', color: '#7986cb', cursor: 'pointer', fontSize: '10px', whiteSpace: 'nowrap' }}>
                      🛡 E.Bodyguard
                    </button>
                    <button onClick={() => sb(a => a.spawnEnemyTurret())}
                      title="A killable enemy sentry (3 HP) that stays until destroyed"
                      style={{ padding: '3px 8px', borderRadius: '4px', border: '1px solid rgba(255,143,0,0.6)', background: 'rgba(255,143,0,0.14)', color: '#ffb74d', cursor: 'pointer', fontSize: '10px', whiteSpace: 'nowrap' }}>
                      🗼 E.Turret
                    </button>
                    <button onClick={() => sb(a => a.spawnPortalPair())}
                      title="Two linked portals: step into one, come out of the other"
                      style={{ padding: '3px 8px', borderRadius: '4px', border: '1px solid rgba(38,198,218,0.6)', background: 'rgba(38,198,218,0.12)', color: '#26c6da', cursor: 'pointer', fontSize: '10px', whiteSpace: 'nowrap' }}>
                      🌀 Portals
                    </button>
                  </div>
                </div>
                <div style={{ flexShrink: 0 }}>
                  <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.45)', marginBottom: '4px' }}>Flags</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {([['normal', '🚩', '#ef5350'], ['giant', '🏴', '#ab47bc'], ['bonus', '⭐', '#fdd835'], ['challenge', '💀', '#ff7043'], ['clear', '🫧', '#ef9a9a'], ['boss', '👹', '#7c4dff']] as const).map(([variant, icon, color]) => (
                      <button key={variant} onClick={() => sb(a => a.spawnFlag(variant))}
                        style={{ padding: '3px 8px', borderRadius: '4px', border: `1px solid ${color}44`, background: `${color}15`, color, cursor: 'pointer', fontSize: '10px', whiteSpace: 'nowrap' }}>
                        {icon} {variant}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
