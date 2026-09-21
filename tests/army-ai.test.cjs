/**
 * The army's decision rules. These lived inside CivilianActor's useFrame
 * closure until they were extracted, which meant the behaviour that makes a
 * squad read as a squad - focus fire, the sergeant's aura, the medic's
 * priorities - had never been verified at all.
 */
const test = require('node:test');
const assert = require('node:assert');
const THREE = require('three');
const ai = require('../.test-build/world/armyAi.js');
const gs = require('../.test-build/world/gameState.js');

const at = (x, z) => new THREE.Vector3(x, 0, z);
const enemy = (id, x, z, health = 10) => ({
  id, type: 'runningMan', health, maxHealth: 10, position: at(x, z), velocity: at(0, 0)
});
const soldier = (id, role, x, z, health, maxHealth = 30) => ({
  id, role, health, maxHealth, position: at(x, z), velocity: at(0, 0), statusEffects: {}
});

// ── focus fire ───────────────────────────────────────────────────────────
test('focus fire prefers the wounded one over the merely nearest', () => {
  const near = enemy('healthy-near', 2, 0, 10);
  const hurt = enemy('hurt-far', 6, 0, 1);
  const picked = ai.pickFocusTarget({ x: 0, z: 0 }, [near, hurt]);
  // 10 + 2*1.5 = 13 against 1 + 6*1.5 = 10, so the hurt one wins.
  assert.strictEqual(picked.id, 'hurt-far');
});

test('focus fire still takes the nearest when health is equal', () => {
  const picked = ai.pickFocusTarget({ x: 0, z: 0 }, [enemy('far', 9, 0, 5), enemy('near', 2, 0, 5)]);
  assert.strictEqual(picked.id, 'near');
});

test('focus fire ignores the dead and anything out of sight', () => {
  assert.strictEqual(ai.pickFocusTarget({ x: 0, z: 0 }, [enemy('dead', 1, 0, 0)]), undefined);
  assert.strictEqual(ai.pickFocusTarget({ x: 0, z: 0 }, [enemy('miles', 500, 0, 1)]), undefined);
  assert.strictEqual(ai.pickFocusTarget({ x: 0, z: 0 }, []), undefined);
});

test('every soldier in the squad picks the SAME target', () => {
  // This is the whole point of focus fire: no coordination, same answer.
  const roster = [enemy('a', 3, 3, 9), enemy('b', -4, 1, 2), enemy('c', 1, -5, 7)];
  // Soldiers standing close together must agree.
  const picks = [
    ai.pickFocusTarget({ x: 0, z: 0 }, roster),
    ai.pickFocusTarget({ x: 0.5, z: 0.2 }, roster),
    ai.pickFocusTarget({ x: -0.3, z: 0.4 }, roster)
  ];
  assert.strictEqual(new Set(picks.map((p) => p.id)).size, 1, 'the squad split its fire');
});

test('nearestEnemy is distance only and reports the distance', () => {
  const r = ai.nearestEnemy({ x: 0, z: 0 }, [enemy('far', 10, 0, 1), enemy('near', 3, 0, 10)]);
  assert.strictEqual(r.enemy.id, 'near');
  assert.ok(Math.abs(r.distance - 3) < 1e-9);
  const none = ai.nearestEnemy({ x: 0, z: 0 }, []);
  assert.strictEqual(none.enemy, undefined);
  assert.strictEqual(none.distance, Infinity);
});

// ── sergeant aura ────────────────────────────────────────────────────────
test('the sergeant buffs the squad but not himself', () => {
  const sarge = soldier('sarge', 'armySergeant', 0, 0, 38, 38);
  const trooper = { id: 'trooper', role: 'armyMelee', x: 5, z: 0 };
  assert.ok(ai.hasSergeantNearby(trooper, [sarge]), 'a trooper in range should be buffed');
  assert.ok(!ai.hasSergeantNearby({ id: 'sarge', role: 'armySergeant', x: 0, z: 0 }, [sarge]),
    'a sergeant must not buff himself');
});

test('the aura has a radius and a dead sergeant gives nothing', () => {
  const far = soldier('sarge', 'armySergeant', gs.ARMY_SERGEANT_AURA_RADIUS + 5, 0, 38, 38);
  assert.ok(!ai.hasSergeantNearby({ id: 't', role: 'armyMelee', x: 0, z: 0 }, [far]));
  const dead = soldier('sarge', 'armySergeant', 1, 0, 0, 38);
  assert.ok(!ai.hasSergeantNearby({ id: 't', role: 'armyMelee', x: 0, z: 0 }, [dead]));
});

test('the aura makes them hit harder and swing faster', () => {
  const off = ai.sergeantBonus(false);
  const on = ai.sergeantBonus(true);
  assert.strictEqual(off.damageMultiplier, 1);
  assert.strictEqual(off.cooldownScale, 1);
  assert.ok(on.damageMultiplier > 1, 'damage should go up');
  assert.ok(on.cooldownScale < 1, 'a cooldown SCALE under 1 is faster');
});

// ── breaking off to heal ─────────────────────────────────────────────────
test('critically hurt soldiers break off mid-fight; merely hurt ones wait', () => {
  const urgent = gs.ARMY_MEDKIT_URGENT_FRACTION - 0.05;
  const middling = (gs.ARMY_MEDKIT_URGENT_FRACTION + gs.ARMY_MEDKIT_SEEK_FRACTION) / 2;
  assert.ok(ai.wantsMedkit(urgent, 1, true, false), 'critical should go even under fire');
  assert.ok(!ai.wantsMedkit(middling, 1, true, false), 'merely hurt should wait out the fight');
  assert.ok(ai.wantsMedkit(middling, 1, false, false), 'and go once the shooting stops');
});

test('a sergeant on the field stops them wandering off for medkits', () => {
  const middling = (gs.ARMY_MEDKIT_URGENT_FRACTION + gs.ARMY_MEDKIT_SEEK_FRACTION) / 2;
  assert.ok(!ai.wantsMedkit(middling, 1, false, true), 'the aura should hold them in place');
  assert.ok(ai.wantsMedkit(gs.ARMY_MEDKIT_URGENT_FRACTION - 0.05, 1, false, true),
    'but not when they are about to die');
});

test('no medkits on the field means no urge', () => {
  assert.ok(!ai.wantsMedkit(0.01, 0, false, false));
});

// ── mutual support ───────────────────────────────────────────────────────
test('the two nearest fighters respond, and they agree on who', () => {
  const victim = soldier('victim', 'armyMelee', 0, 0, 3, 30);
  const roster = [
    victim,
    soldier('near1', 'armyMelee', 1, 0, 30),
    soldier('near2', 'armyRanged', 2, 0, 26),
    soldier('far', 'armyMelee', 25, 0, 30)
  ];
  const responders = ai.supportResponders(victim, roster);
  assert.strictEqual(responders.length, gs.ARMY_SUPPORT_RESPONDERS);
  assert.deepStrictEqual(responders.map((r) => r.id), ['near1', 'near2']);
  // Derived from the same roster, so every soldier computes the same list.
  assert.deepStrictEqual(ai.supportResponders(victim, [...roster].reverse()).map((r) => r.id).sort(),
    ['near1', 'near2']);
});

test('the medic is never a responder, and neither is a hurt soldier', () => {
  const victim = soldier('victim', 'armyMelee', 0, 0, 3, 30);
  const roster = [
    victim,
    soldier('medic', 'armyMedic', 1, 0, 12, 12),
    soldier('alsoHurt', 'armyMelee', 2, 0, 3, 30),
    soldier('fit', 'armyMelee', 9, 0, 30)
  ];
  const ids = ai.supportResponders(victim, roster).map((r) => r.id);
  assert.ok(!ids.includes('medic'), 'the medic has his own job');
  assert.ok(!ids.includes('alsoHurt'), 'a soldier who is himself in trouble cannot help');
  assert.ok(ids.includes('fit'));
});

test('a comrade is only "in trouble" below the threshold and in range', () => {
  const self = { id: 'me', x: 0, z: 0 };
  const hurtNear = soldier('hurt', 'armyMelee', 3, 0, 3, 30);
  assert.strictEqual(ai.findComradeInTrouble(self, [hurtNear]).id, 'hurt');
  assert.strictEqual(ai.findComradeInTrouble(self, [soldier('fine', 'armyMelee', 3, 0, 30)]), undefined);
  const hurtFar = soldier('hurt', 'armyMelee', gs.ARMY_SUPPORT_RADIUS + 10, 0, 3, 30);
  assert.strictEqual(ai.findComradeInTrouble(self, [hurtFar]), undefined);
  assert.strictEqual(ai.findComradeInTrouble(self, [soldier('me', 'armyMelee', 0, 0, 1, 30)]), undefined,
    'must not answer its own call');
});

// ── the medic ────────────────────────────────────────────────────────────
test('the medic crosses the field for the worst hurt, not the nearest', () => {
  const self = { id: 'medic', x: 0, z: 0 };
  const roster = [
    soldier('scratched', 'armyMelee', 1, 0, 28, 30),      // 93%, right here
    soldier('dying', 'armyMelee', 20, 0, 2, 30)           // 7%, across the field
  ];
  assert.strictEqual(ai.pickMedicPatient(self, roster).id, 'dying');
});

test('distance only breaks a tie between equally hurt soldiers', () => {
  const self = { id: 'medic', x: 0, z: 0 };
  const roster = [
    soldier('far', 'armyMelee', 20, 0, 15, 30),
    soldier('near', 'armyMelee', 2, 0, 15, 30)
  ];
  assert.strictEqual(ai.pickMedicPatient(self, roster).id, 'near');
});

test('the medic ignores the healthy, the dead, civilians and himself', () => {
  const self = { id: 'medic', x: 0, z: 0 };
  assert.strictEqual(ai.pickMedicPatient(self, [soldier('full', 'armyMelee', 1, 0, 30, 30)]), undefined);
  assert.strictEqual(ai.pickMedicPatient(self, [soldier('dead', 'armyMelee', 1, 0, 0, 30)]), undefined);
  assert.strictEqual(ai.pickMedicPatient(self, [soldier('civ', 'civilian', 1, 0, 1, 10)]), undefined);
  assert.strictEqual(ai.pickMedicPatient(self, [soldier('medic', 'armyMedic', 0, 0, 1, 12)]), undefined);
});

test('the medic treats another medic - he is still a soldier', () => {
  const self = { id: 'medic1', x: 0, z: 0 };
  const other = soldier('medic2', 'armyMedic', 2, 0, 3, 12);
  assert.strictEqual(ai.pickMedicPatient(self, [other]).id, 'medic2');
});

test('running outranks everything the medic could otherwise be doing', () => {
  const base = {
    healthFraction: 1, nearestEnemyDistance: 100, playerHostile: false, playerDistance: 100,
    hasPatient: true, hasMedkit: true, hasEscort: true
  };
  assert.strictEqual(ai.medicIntent({ ...base, nearestEnemyDistance: 1 }), 'flee');
  assert.strictEqual(ai.medicIntent({ ...base, playerHostile: true, playerDistance: 1 }), 'flee');
  // A non-hostile player standing on top of him is not a threat.
  assert.strictEqual(ai.medicIntent({ ...base, playerHostile: false, playerDistance: 0.5 }), 'treat');
});

test('the medic falls through his priorities in order', () => {
  const base = {
    healthFraction: 1, nearestEnemyDistance: 100, playerHostile: false, playerDistance: 100,
    hasPatient: false, hasMedkit: false, hasEscort: false
  };
  assert.strictEqual(ai.medicIntent({ ...base, hasPatient: true, hasMedkit: true, hasEscort: true }), 'treat');
  assert.strictEqual(ai.medicIntent({ ...base, hasMedkit: true, hasEscort: true }), 'selfHeal');
  assert.strictEqual(ai.medicIntent({ ...base, hasEscort: true }), 'escort');
  assert.strictEqual(ai.medicIntent(base), 'hold');
});

test('the medic escorts a fighter, never another medic', () => {
  const self = { id: 'medic', x: 0, z: 0 };
  const roster = [
    soldier('otherMedic', 'armyMedic', 1, 0, 12, 12),
    soldier('trooper', 'armyMelee', 8, 0, 30)
  ];
  assert.strictEqual(ai.medicEscort(self, roster).id, 'trooper',
    'standing next to another medic is no safer than standing alone');
});

test('fleeing heads away from the AVERAGE of the threats', () => {
  // Pincered from both sides on x: the way out is along z, not into either.
  const heading = ai.fleeHeadingFrom({ x: 0, z: 0 }, [{ x: -5, z: -5 }, { x: 5, z: -5 }]);
  assert.ok(heading !== null);
  assert.ok(Math.abs(Math.sin(heading)) < 1e-6, 'should not commit to either side');
  assert.ok(Math.cos(heading) > 0.99, 'should run directly away from both');
});

test('fleeing from a single threat runs directly away from it', () => {
  const heading = ai.fleeHeadingFrom({ x: 0, z: 0 }, [{ x: 0, z: 5 }]);
  assert.ok(Math.cos(heading) < -0.99);
  assert.strictEqual(ai.fleeHeadingFrom({ x: 0, z: 0 }, []), null);
  assert.strictEqual(ai.fleeHeadingFrom({ x: 0, z: 0 }, [{ x: 0, z: 0 }]), null,
    'exactly on top gives no direction');
});

// ── the radioman ─────────────────────────────────────────────────────────
test('the radio only calls when actually outnumbered nearby', () => {
  const self = { x: 0, z: 0 };
  const three = [enemy('a', 1, 0), enemy('b', 2, 0), enemy('c', 3, 0)];
  const two = [soldier('s1', 'armyMelee', 1, 0, 30), soldier('s2', 'armyMelee', 2, 0, 30)];
  assert.ok(ai.shouldCallReinforcements(self, three, two, 20), '3 vs 2 should call');
  assert.ok(!ai.shouldCallReinforcements(self, three.slice(0, 2), two, 20), '2 vs 2 should not');
  assert.ok(!ai.shouldCallReinforcements(self, [], two, 20), 'no enemies, no call');
});

test('the radio counts only what is nearby, and only fighters as friends', () => {
  const self = { x: 0, z: 0 };
  const near = [enemy('a', 1, 0)];
  assert.ok(!ai.shouldCallReinforcements(self, near, [soldier('s', 'armyMelee', 1, 0, 30)], 20));
  assert.ok(ai.shouldCallReinforcements(self, near, [soldier('s', 'armyMelee', 500, 0, 30)], 20),
    'a soldier on the far side of the map is not support');
  assert.ok(ai.shouldCallReinforcements(self, near, [soldier('m', 'armyMedic', 1, 0, 12, 12)], 20),
    'the medic does not count as a gun');
});

// ── frightened civilians ─────────────────────────────────────────────────
test('civilians run to a fighter, never to the medic', () => {
  const self = { x: 0, z: 0 };
  const roster = [
    soldier('medic', 'armyMedic', 2, 0, 12, 12),
    soldier('trooper', 'armyMelee', 9, 0, 30)
  ];
  assert.strictEqual(ai.findGuardian(self, roster, 30, 3).id, 'trooper',
    'the medic runs from the same thing they do');
});

test('once tucked in behind him they stop running', () => {
  const roster = [soldier('trooper', 'armyMelee', 1, 0, 30)];
  assert.strictEqual(ai.findGuardian({ x: 0, z: 0 }, roster, 30, 3), undefined, 'already safe');
  assert.ok(ai.findGuardian({ x: 0, z: 0 }, [soldier('t', 'armyMelee', 10, 0, 30)], 30, 3),
    'still worth running to');
  assert.strictEqual(ai.findGuardian({ x: 0, z: 0 }, [soldier('t', 'armyMelee', 99, 0, 30)], 30, 3),
    undefined, 'out of sight');
});
