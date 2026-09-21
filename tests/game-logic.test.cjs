/**
 * Pure game logic: arena-versus geometry and progression, the army loadout
 * table, the pitch goal line, the cup bracket, and status effects.
 */
const test = require('node:test');
const assert = require('node:assert');
const THREE = require('three');

const versus = require('../.test-build/world/arenaVersus.js');
const gameState = require('../.test-build/world/gameState.js');
const pitch = require('../.test-build/world/pitchBrawl.js');
const cup = require('../.test-build/world/cupRun.js');
const fx = require('../.test-build/world/statusEffects.js');
const { ARENA_ROOMS } = require('../.test-build/world/arenaRooms.js');

// ── arena versus geometry ────────────────────────────────────────────────
test('every room produces sane bounds', () => {
  for (const room of ARENA_ROOMS) {
    const b = versus.boundsForRoom(room);
    const phase = versus.phaseForRoom(room);
    assert.ok(['concrete', 'sand', 'magma'].includes(phase), room.id);
    if (phase === 'concrete') {
      assert.strictEqual(b.kind, 'rect');
      assert.ok(b.halfX > 0 && b.halfZ > 0, room.id);
    } else {
      assert.strictEqual(b.kind, 'circle');
      // Circular rooms are really N-gons; the usable radius must be the
      // apothem, not the circumradius, or you can stand inside a wall.
      assert.ok(b.radius > 0, room.id);
      const circum = phase === 'magma' ? 44 : 40;
      assert.ok(b.radius < circum, room.id + ' radius ' + b.radius + ' is outside the wall ring');
    }
  }
});

test('clampToBounds never leaves the room, and is a no-op inside it', () => {
  for (const room of ARENA_ROOMS) {
    const b = versus.boundsForRoom(room);
    for (let i = 0; i < 200; i++) {
      const p = new THREE.Vector3((Math.random() - 0.5) * 200, 0, (Math.random() - 0.5) * 200);
      versus.clampToBounds(p, b);
      assert.ok(versus.boundsFraction(p.x, p.z, b) <= 1 + 1e-9,
        room.id + ' left a point at fraction ' + versus.boundsFraction(p.x, p.z, b));
    }
    const inside = versus.randomRoomPos(b, 0.5);
    const before = inside.clone();
    versus.clampToBounds(inside, b);
    assert.ok(inside.distanceTo(before) < 1e-9, room.id + ' clamped a point that was already inside');
  }
});

test('randomRoomPos stays inside and centreBias actually pulls inward', () => {
  const b = versus.boundsForRoom(ARENA_ROOMS.find((r) => r.shape === 'circle'));
  const mean = (bias) => {
    let total = 0;
    for (let i = 0; i < 4000; i++) total += versus.boundsFraction(...(() => {
      const p = versus.randomRoomPos(b, bias);
      assert.ok(versus.boundsFraction(p.x, p.z, b) <= 1 + 1e-9);
      return [p.x, p.z, b];
    })());
    return total / 4000;
  };
  assert.ok(mean(2) < mean(0), 'a higher centre bias should sit closer to the middle');
});

test('versus upgrades apply, and heal cannot exceed max', () => {
  const side = versus.createSide('player', true, '#ffffff');
  const baseDamage = side.damage;
  versus.applyUpgrade(side, 'damage');
  assert.ok(side.damage > baseDamage);

  const maxBefore = side.maxHealth;
  versus.applyUpgrade(side, 'health');
  assert.ok(side.maxHealth > maxBefore);
  assert.ok(side.health <= side.maxHealth);

  side.health = 1;
  versus.applyUpgrade(side, 'heal');
  assert.ok(side.health > 1 && side.health <= side.maxHealth, 'heal overshot the cap');
  assert.strictEqual(side.upgrades.length, 3);
});

test('rollUpgradeChoices returns distinct options', () => {
  for (let i = 0; i < 200; i++) {
    const options = versus.rollUpgradeChoices(3);
    assert.strictEqual(options.length, 3);
    assert.strictEqual(new Set(options).size, 3, 'duplicate option offered');
    for (const o of options) assert.ok(versus.UPGRADE_LABEL[o], 'unlabelled upgrade ' + o);
  }
});

test('the AI heals when it is nearly dead and does not when it is not', () => {
  const hurt = versus.createSide('ai', false, '#ff0000');
  hurt.health = hurt.maxHealth * 0.15;
  assert.strictEqual(versus.aiPickUpgrade(hurt, ['heal', 'speed', 'reach']), 'heal');

  const healthy = versus.createSide('ai', false, '#ff0000');
  assert.notStrictEqual(versus.aiPickUpgrade(healthy, ['heal', 'damage']), 'heal',
    'healing at full health wastes the pick');
});

test('rooms advance one tier at a time and stop at the last', () => {
  const side = versus.createSide('player', true, '#fff');
  assert.strictEqual(side.roomsEntered, 1);
  for (let i = 0; i < 12; i++) versus.enterNextRoom(side);
  assert.strictEqual(side.room.tier, 5, 'should be parked in the final tier');
  assert.strictEqual(versus.wavesUntilNextRoom(side), null, 'the last room is permanent');
  // Position must be brought inside whatever the new room is.
  assert.ok(versus.boundsFraction(side.position.x, side.position.z, side.bounds) <= 1 + 1e-9);
});

test('a versus wave is spawnable and inside the room', () => {
  const side = versus.createSide('player', true, '#fff');
  for (let wave = 1; wave <= 12; wave++) {
    side.wave = wave;
    const roster = versus.versusWaveRoster(side);
    assert.ok(roster.length > 0, 'wave ' + wave + ' was empty');
    assert.ok(roster.length <= versus.VERSUS_MAX_ALIVE + 4, 'wave ' + wave + ' spawned ' + roster.length);
    for (const e of roster) {
      assert.ok(e.health > 0 && e.maxHealth > 0, e.type + ' has no health');
      assert.ok(e.damage >= 0, e.type + ' negative damage');
      assert.ok(e.speed > 0, e.type + ' cannot move');
      assert.ok(versus.boundsFraction(e.position.x, e.position.z, side.bounds) <= 1 + 1e-9,
        e.type + ' spawned outside the room');
      if (e.mirage) assert.strictEqual(e.damage, 0, 'mirages must not deal damage');
    }
  }
});

// ── army loadouts ────────────────────────────────────────────────────────
test('every army kind maps to a role with a loadout', () => {
  for (const [kind, role] of Object.entries(gameState.ARMY_KIND_ROLE)) {
    const l = gameState.armyLoadoutFor(role);
    assert.ok(l, kind + ' has no loadout');
    assert.ok(l.maxHealth > 0, kind + ' maxHealth');
    assert.ok(l.chaseSpeed > 0, kind + ' chaseSpeed');
    assert.ok(gameState.isArmyRole(role), role + ' is not an army role');
  }
});

test('the medic is an army role but not a fighting one', () => {
  assert.ok(gameState.isArmyRole('armyMedic'));
  assert.ok(!gameState.isFightingArmyRole('armyMedic'), 'the medic must never be a responder or a guardian');
  for (const role of ['armyMelee', 'armyRanged', 'armySergeant', 'armyShield', 'armyRadio', 'bodyguard']) {
    assert.ok(gameState.isFightingArmyRole(role), role + ' should fight');
  }
  for (const role of ['civilian', 'vip', undefined]) {
    assert.ok(!gameState.isArmyRole(role), String(role) + ' is not army');
  }
});

test('army roles are balanced the way the design says', () => {
  const l = (r) => gameState.armyLoadoutFor(r);
  assert.ok(l('armyShield').maxHealth > l('armyMelee').maxHealth, 'the shield is the wall');
  assert.ok(l('armyShield').meleeDamage < l('armyMelee').meleeDamage, 'and deliberately hits softly');
  assert.ok(l('armyShield').chaseSpeed < l('armyMelee').chaseSpeed, 'and is slow');
  assert.ok(l('armySergeant').meleeDamage > l('armyMelee').meleeDamage, 'the sergeant is the best fighter');
  assert.strictEqual(l('armyMedic').meleeDamage, 0, 'the medic never attacks');
  assert.ok(l('armyRanged').rangedDamage > 0, 'the rifleman must have a ranged attack');
  assert.ok(gameState.ARMY_SERGEANT_DAMAGE_BONUS > 0 && gameState.ARMY_SERGEANT_AURA_RADIUS > 0);
  assert.ok(gameState.ARMY_SHIELD_TAUNT_WEIGHT < 1, 'the taunt must SHORTEN effective distance');
  assert.ok(gameState.ARMY_SHIELD_RANGED_RESIST < 1, 'the shield must reduce projectile damage');
});

test('stat modifiers and run modifiers start neutral', () => {
  const s = gameState.createStatModifiers();
  for (const [k, v] of Object.entries(s)) assert.strictEqual(v, 0, k + ' should start at 0');
  const m = gameState.createDefaultModifiers();
  for (const [k, v] of Object.entries(m)) assert.strictEqual(v, false, k + ' should start off');
});

// ── pitch brawl goal line ────────────────────────────────────────────────
test('the swept goal test catches a shot that steps past the line', () => {
  const line = pitch.goalLineX('home');
  // A fast shot crossing the line between two samples: a position test misses it.
  assert.strictEqual(pitch.sweptGoalCheck(line + 0.5, 0, line - 0.5, 0), 'home');
  assert.strictEqual(pitch.sweptGoalCheck(line - 0.5, 0, line - 1.5, 0), null, 'already behind the line');
  assert.strictEqual(pitch.sweptGoalCheck(line + 2, 0, line + 1, 0), null, 'never reached it');
});

test('a shot outside the posts is not a goal', () => {
  const line = pitch.goalLineX('home');
  const wide = pitch.GOAL_HALF_WIDTH + 0.5;
  assert.strictEqual(pitch.sweptGoalCheck(line + 0.5, wide, line - 0.5, wide), null);
  assert.ok(pitch.inGoalMouth(0), 'dead centre is in the mouth');
  assert.ok(!pitch.inGoalMouth(wide), 'wide of the post is not');
});

test('both goals are scorable and face opposite ways', () => {
  assert.ok(pitch.goalLineX('home') < 0 && pitch.goalLineX('away') > 0);
  assert.strictEqual(pitch.sweptGoalCheck(pitch.goalLineX('away') - 0.5, 0, pitch.goalLineX('away') + 0.5, 0), 'away');
});

// ── cup run bracket ──────────────────────────────────────────────────────
test('AI difficulty rises monotonically with seed strength', () => {
  // The seeding bug: stats were assigned by creation index, then shuffled,
  // so the final was no harder than round one.
  let prev = null;
  for (let seed = 8; seed >= 1; seed--) {
    const p = cup.aiProfileForSeed(seed);
    assert.ok(p.reactionDelay > 0 && p.reactionDelay < 1, 'seed ' + seed + ' reaction ' + p.reactionDelay);
    if (prev) {
      assert.ok(p.reactionDelay <= prev.reactionDelay + 1e-9,
        'seed ' + seed + ' reacts slower than a weaker seed');
      assert.ok(p.missChance <= prev.missChance + 1e-9,
        'seed ' + seed + ' misses more than a weaker seed');
    }
    prev = p;
  }
  assert.ok(cup.aiProfileForSeed(1).reactionDelay < cup.aiProfileForSeed(8).reactionDelay,
    'the top seed must be sharper than the bottom seed');
});

test('the bracket is a complete, well-formed draw', () => {
  const field = cup.createCupField('#4fc3f7');
  assert.strictEqual(field.length, cup.CUP_FIGHTER_COUNT);
  const seeds = field.map((f) => f.seed).sort((a, b) => a - b);
  assert.deepStrictEqual(seeds, [1, 2, 3, 4, 5, 6, 7, 8], 'seeds must be 1..8 exactly once');
  assert.strictEqual(field.filter((f) => f.isPlayer).length, 1, 'exactly one player');

  const bracket = cup.createBracket(field);
  const quarters = bracket.filter((m) => m.round === 'quarter');
  assert.strictEqual(quarters.length, 4);
  const entered = quarters.flatMap((m) => [m.a.seed, m.b.seed]).sort((a, b) => a - b);
  assert.deepStrictEqual(entered, seeds, 'every fighter must appear exactly once');
  // Classic seeding: the strongest and weakest meet first.
  assert.ok(quarters.some((m) => (m.a.seed === 1 && m.b.seed === 8) || (m.a.seed === 8 && m.b.seed === 1)));
});

test('stronger fighters win more often than they lose', () => {
  const strong = { name: 'S', seed: 1, maxHealth: 40, damage: 8 };
  const weak = { name: 'W', seed: 8, maxHealth: 10, damage: 2 };
  let wins = 0;
  for (let i = 0; i < 2000; i++) if (cup.simulateMatch(strong, weak) === strong) wins++;
  assert.ok(wins > 1400, 'the stronger fighter only won ' + wins + '/2000');
  assert.ok(wins < 2000, 'upsets should still be possible');
});

// ── status effects ───────────────────────────────────────────────────────
test('burn ticks damage and then expires', () => {
  const e = fx.createStatusEffects();
  assert.ok(!fx.isBurning(e, 0));
  fx.applyBurn(e, 0, 2, 3, '#ff5722');
  assert.ok(fx.isBurning(e, 0.5));
  let total = 0;
  for (let t = 0; t <= 3; t += 1 / 60) total += fx.tickBurn(e, t);
  assert.ok(total > 0, 'burn did no damage at all');
  assert.ok(!fx.isBurning(e, 3.5), 'burn outlived its duration');
  assert.strictEqual(fx.tickBurn(e, 4), 0, 'expired burn still ticking');
});

test('freeze, stun, pull and slow all expire', () => {
  const e = fx.createStatusEffects();
  fx.applyFreeze(e, 0, 1);
  assert.ok(fx.isFrozen(e, 0.5));
  assert.ok(!fx.isFrozen(e, 1.5));

  // Same seconds clock as everything else here, not a ms timestamp.
  fx.applyRagdollStun(e, 0, 0.5);
  assert.ok(fx.isRagdollStunned(e, 0.25));
  assert.ok(!fx.isRagdollStunned(e, 1));

  fx.applyPull(e, 0, 1, new THREE.Vector3(5, 0, 5), '#b362e0');
  assert.ok(fx.isPulled(e, 0.5));
  assert.ok(!fx.isPulled(e, 2));
  assert.ok(e.pullTarget && e.pullTarget.x === 5, 'pull target should be copied, not shared');
  // applyPull also raises the aura, and it must expire with the pull.
  assert.ok(fx.hasAura(e, 0.5));
  assert.ok(!fx.hasAura(e, 2));
});

test('slow reduces the factor and recovers to 1', () => {
  const e = fx.createStatusEffects();
  assert.strictEqual(fx.getSlowFactor(e, 0), 1, 'unslowed should be full speed');
  fx.applySlow(e, 0, 2, 0.5);
  const slowed = fx.getSlowFactor(e, 0.5);
  assert.ok(slowed > 0 && slowed < 1, 'slow factor ' + slowed);
  assert.ok(fx.isSlowed(e, 0.5));
  assert.strictEqual(fx.getSlowFactor(e, 3), 1, 'slow never wore off');
});

test('a fresh effects struct is entirely inert', () => {
  const e = fx.createStatusEffects();
  const now = 10;
  assert.ok(!fx.isBurning(e, now));
  assert.ok(!fx.isFrozen(e, now));
  assert.ok(!fx.isSlowed(e, now));
  assert.ok(!fx.isPulled(e, now));
  assert.ok(!fx.hasAura(e, now));
  assert.ok(!fx.isMagnetized(e, now));
  assert.strictEqual(fx.getSlowFactor(e, now), 1);
});
