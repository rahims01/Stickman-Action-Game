import React, { useState } from 'react';
import { HELPER_TARGETED_OPTIONS, HelperState, LevelChoiceOption } from '../world/gameState';

interface LevelUpChoiceProps {
  level: number;
  options: LevelChoiceOption[];
  helpers: HelperState[];
  onChoose: (option: LevelChoiceOption, helperTarget?: string) => void;
  isBonus?: boolean;
}

export const OPTION_INFO: Record<LevelChoiceOption, { title: string; description: string }> = {
  enemyHealth: { title: 'Tougher Enemies', description: 'Every enemy spawned from now on gets +1 max HP (on top of automatic per-level scaling).' },
  enemyDamage: { title: 'Stronger Enemies', description: 'Every enemy spawned from now on deals +1 damage (on top of automatic per-level scaling).' },
  enemyAttackSpeed: { title: 'Faster Enemies (Attack)', description: 'Every enemy attacks +15% faster from now on.' },
  enemyMoveSpeed: { title: 'Faster Enemies (Move)', description: 'Every enemy moves +15% faster from now on.' },
  playerHealth: { title: 'Your Vitality', description: 'Your max health increases by +1.' },
  playerDamage: { title: 'Your Power', description: 'Your punch and kick both deal +1 damage.' },
  playerAttackSpeed: { title: 'Your Speed (Attack)', description: 'You punch and kick +15% faster.' },
  playerMoveSpeed: { title: 'Your Speed (Move)', description: 'You walk, run, and crouch +15% faster.' },
  helper: { title: 'Helper', description: 'Summon a new companion, or upgrade an existing one (HP/damage).' },
  helperMoveSpeed: { title: 'Helper Speed (Move)', description: 'Pick a companion to move +15% faster.' },
  helperAttackSpeed: { title: 'Helper Speed (Attack)', description: 'Pick a companion to attack +15% faster.' },
  helperLevelUp2: { title: 'Helper Level Up', description: 'Pick a companion to instantly gain +2 max HP, punch, and kick damage.' },
  staminaMax: { title: 'Endurance', description: 'Your max stamina increases by +25, so you can sprint for longer.' },
  enemySpawnRate: { title: 'Swarm', description: 'Extra basic enemies start spawning in periodically on top of the normal respawns. Risky.' },
  critChance: {
    title: 'Critical Strikes',
    description: 'Your punches and kicks gain a chance to deal +25% damage - 1% on the first pick, +0.5% every pick after.'
  },
  lightBlock: { title: 'Beacon', description: 'Drops a glowing light block that illuminates at night and goes dark during the day. First pick: 1 block; every pick after: 2 blocks.' },
  playerComboSmall: { title: 'Minor Boost', description: 'Your max health and damage both increase by +2.' },
  playerComboBig: { title: 'Major Boost', description: 'Your max health and damage both increase by +10.' },
  enemyCombo: { title: 'Enemy Surge', description: 'Every enemy spawned from now on gets +3 max HP and +3 damage. Risky.' },
  flashlightUpgrade: { title: 'Flashlight Upgrade', description: 'Increases the flashlight\'s intensity and reach by +8 intensity and +12 distance per pick.' },
  drone: { title: 'Drone Companion', description: 'Deploys a drone that orbits your head and zaps the nearest enemy. Each pick adds a new drone and boosts all drone damage by +1.' },
  turret: { title: 'Sentry Turret', description: 'Builds a permanent turret at a random spot on the map that shoots nearby enemies. Each pick adds a new turret and boosts all turret damage by +1.' },
  thorns: { title: 'Thorns', description: 'Every melee hit you receive deals 1 damage back to the attacker.' },
  dash: { title: 'Dash', description: 'Double-tap any direction key to burst-dash in that direction with brief invincibility.' },
  parry: { title: 'Perfect Parry', description: 'Press Q within 150ms of an incoming attack to block it and instantly ragdoll the attacker.' },
  groundSlam: { title: 'Ground Slam', description: 'Kick while airborne to smash the ground on landing, dealing AOE damage to all nearby enemies.' },
  challengeFlag: { title: 'Challenge Flag', description: 'Unlocks the challenge flag ability: kick deals +1 AOE damage and you gain Ground Slam.' },
  helperRanged: { title: 'Ranged Helper', description: 'Pick a companion to fight at RANGE: it kites enemies and throws bolts whose damage scales with its punch damage.' }
};

export const LevelUpChoice: React.FC<LevelUpChoiceProps> = ({ level, options, helpers, onChoose, isBonus = false }) => {
  const [pendingOption, setPendingOption] = useState<LevelChoiceOption | null>(null);

  const handlePick = (option: LevelChoiceOption) => {
    if (HELPER_TARGETED_OPTIONS.includes(option)) {
      setPendingOption(option);
      return;
    }
    onChoose(option);
  };

  const handlePickTarget = (target: string) => {
    if (!pendingOption) return;
    onChoose(pendingOption, target);
    setPendingOption(null);
  };

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(3, 5, 8, 0.72)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50
      }}
    >
      <div
        className="fade-in"
        style={{
          background: 'linear-gradient(165deg, #171c23, #0e1116)',
          border: `1px solid ${isBonus ? 'rgba(249,202,36,0.45)' : 'rgba(79,195,247,0.35)'}`,
          boxShadow: `0 12px 48px rgba(0,0,0,0.6), 0 0 40px ${isBonus ? 'rgba(249,202,36,0.12)' : 'rgba(79,195,247,0.1)'}`,
          borderRadius: '14px',
          padding: '28px 32px',
          minWidth: '440px',
          maxWidth: '560px',
          textAlign: 'center',
          color: '#ffffff'
        }}
      >
        <div style={{ fontSize: '13px', color: isBonus ? '#f9ca24' : '#a6e22e', marginBottom: '4px', letterSpacing: '1px' }}>
          {isBonus ? 'BONUS UPGRADE' : `LEVEL ${level} CLEARED`}
        </div>
        {!pendingOption ? (
          <>
            <h2 style={{ margin: '0 0 20px 0', fontSize: '24px', color: '#fd971f', letterSpacing: '2px' }}>CHOOSE AN UPGRADE</h2>
            <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
              {options.map((opt) => (
                <button
                  key={opt}
                  className="upgrade-card"
                  onClick={() => handlePick(opt)}
                  style={{
                    flex: 1,
                    padding: '16px',
                    borderRadius: '10px',
                    border: '1px solid rgba(255,255,255,0.22)',
                    background: 'linear-gradient(180deg, #262c34, #1c2128)',
                    color: '#ffffff',
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                >
                  <div style={{ fontWeight: 'bold', fontSize: '15px', color: '#4fc3f7', marginBottom: '6px', letterSpacing: '0.5px' }}>{OPTION_INFO[opt].title}</div>
                  <div style={{ fontSize: '12px', opacity: 0.85, lineHeight: 1.45 }}>{OPTION_INFO[opt].description}</div>
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <h2 style={{ margin: '0 0 20px 0', fontSize: '22px', color: '#fd971f' }}>Select a Companion</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {pendingOption === 'helper' && (
                <button
                  onClick={() => handlePickTarget('new')}
                  style={{
                    padding: '14px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255,255,255,0.3)',
                    background: '#2a2a2a',
                    color: '#ffffff',
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                >
                  <div style={{ fontWeight: 'bold', fontSize: '14px', color: '#a6e22e' }}>+ New Helper</div>
                  <div style={{ fontSize: '12px', opacity: 0.85 }}>Summon a fresh companion.</div>
                </button>
              )}
              {helpers.map((h, i) => (
                <button
                  key={h.id}
                  onClick={() => handlePickTarget(h.id)}
                  style={{
                    padding: '14px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255,255,255,0.3)',
                    background: '#2a2a2a',
                    color: '#ffffff',
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                >
                  <div style={{ fontWeight: 'bold', fontSize: '14px', color: '#4fc3f7' }}>Helper {i + 1}</div>
                  <div style={{ fontSize: '12px', opacity: 0.85 }}>
                    {h.health > 0 ? `${h.health}/${h.maxHealth} HP, ${h.punchDamage} punch / ${h.kickDamage} kick dmg` : 'Fallen - will be revived'}
                  </div>
                </button>
              ))}
              {helpers.length === 0 && pendingOption !== 'helper' && (
                <div style={{ fontSize: '13px', opacity: 0.7, padding: '8px' }}>No companions yet - pick Helper first to summon one.</div>
              )}
            </div>
            <button
              onClick={() => setPendingOption(null)}
              style={{
                marginTop: '18px',
                padding: '8px 14px',
                borderRadius: '6px',
                border: '1px solid rgba(255,255,255,0.2)',
                background: 'transparent',
                color: '#aaaaaa',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              Back
            </button>
          </>
        )}
      </div>
    </div>
  );
};
