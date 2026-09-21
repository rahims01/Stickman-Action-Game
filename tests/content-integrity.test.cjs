/**
 * The content tables have bitten this project repeatedly: 30 enemy types once
 * existed with no config (hidden by a cast), 11 arena enemies spawned
 * nowhere, and a generator silently deleted 10 encyclopedia entries. None of
 * those are type errors - they are cross-table agreements that nothing
 * enforced. These tests enforce them.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { ENEMY_CONFIGS } = require('../.test-build/world/enemyConfig.js');
const rooms = require('../.test-build/world/arenaRooms.js');
const { ARENA_ROOMS, ROOM_COMMON_POOL, WAVES_PER_TIER, FINAL_TIER,
  poolForRoom, roomsForTier, roomById, tierForRoomsEntered, pickRoom } = rooms;

const ROOT = path.join(__dirname, '..');
const configSrc = fs.readFileSync(path.join(ROOT, 'src/world/enemyConfig.ts'), 'utf8');

/** EnemyType is a string union in source; read it rather than guess. */
const unionTypes = (() => {
  const m = /export type EnemyType =([\s\S]*?);/.exec(configSrc);
  assert.ok(m, 'could not find the EnemyType union');
  return [...m[1].matchAll(/'([\w]+)'/g)].map((x) => x[1]);
})();

test('every EnemyType in the union has a config', () => {
  const missing = unionTypes.filter((t) => !ENEMY_CONFIGS[t]);
  assert.deepStrictEqual(missing, [], 'these would be undefined at spawn time');
});

test('every config key is a declared EnemyType', () => {
  const declared = new Set(unionTypes);
  const orphans = Object.keys(ENEMY_CONFIGS).filter((k) => !declared.has(k));
  assert.deepStrictEqual(orphans, []);
});

test('every config has the fields the actors read', () => {
  for (const [type, cfg] of Object.entries(ENEMY_CONFIGS)) {
    assert.ok(typeof cfg.label === 'string' && cfg.label.length > 0, type + ' has no label');
    assert.ok(Number.isFinite(cfg.maxHealth) && cfg.maxHealth > 0, type + ' maxHealth');
    assert.ok(/^#[0-9a-fA-F]{6}$/.test(cfg.color), type + ' colour ' + cfg.color);
    // Stationary training dummies legitimately sit at 0; everything that is
    // meant to walk must not.
    assert.ok(Number.isFinite(cfg.moveSpeedMultiplier) && cfg.moveSpeedMultiplier >= 0, type + ' speed');
    if (!cfg.isStationary) {
      assert.ok(cfg.moveSpeedMultiplier > 0, type + ' is not stationary but cannot move');
    }
    assert.ok(Number.isFinite(cfg.attackSpeedMultiplier), type + ' attack speed');
  }
});

test('nothing can spawn that cannot act', () => {
  for (const [type, cfg] of Object.entries(ENEMY_CONFIGS)) {
    const canAct = cfg.canPunch || cfg.canKick || (cfg.specials && cfg.specials.length > 0) ||
      cfg.isSpawner || cfg.isMedic || cfg.isEngineer || cfg.isStationary || cfg.isCoward;
    assert.ok(canAct, type + ' has no attack, no special and no role');
  }
});

test('the room table is the shape the director expects', () => {
  assert.strictEqual(ARENA_ROOMS.length, 38);
  for (const tier of [1, 2, 3, 4, 5]) {
    assert.ok(roomsForTier(tier).length > 0, 'tier ' + tier + ' has no rooms');
  }
  const ids = ARENA_ROOMS.map((r) => r.id);
  assert.strictEqual(new Set(ids).size, ids.length, 'duplicate room ids');
  for (const room of ARENA_ROOMS) {
    assert.ok(['rect', 'circle', 'pentagon'].includes(room.shape), room.id + ' shape');
    assert.ok(room.tier >= 1 && room.tier <= 5, room.id + ' tier');
    assert.ok(room.natives.length > 0, room.id + ' has no natives');
    assert.ok(room.special, room.id + ' has no special');
    assert.strictEqual(roomById(room.id), room);
  }
});

test('every enemy a room can spawn actually exists', () => {
  for (const room of ARENA_ROOMS) {
    for (const type of poolForRoom(room)) {
      assert.ok(ENEMY_CONFIGS[type], room.id + ' can spawn "' + type + '" which has no config');
    }
  }
});

test('room exclusions name real common-pool entries', () => {
  const pool = new Set(ROOM_COMMON_POOL);
  for (const room of ARENA_ROOMS) {
    for (const type of room.excludes) {
      assert.ok(pool.has(type), room.id + ' excludes "' + type + '" which is not in the common pool');
    }
  }
});

test('a room special is exclusive to its room', () => {
  const seen = new Map();
  for (const room of ARENA_ROOMS) {
    assert.ok(!seen.has(room.special), room.special + ' is the special of both ' + seen.get(room.special) + ' and ' + room.id);
    seen.set(room.special, room.id);
  }
});

test('every enemy type can be reached somewhere', () => {
  // The 11-orphans bug: types that existed but spawned in no room at all.
  const reachable = new Set();
  for (const room of ARENA_ROOMS) for (const t of poolForRoom(room)) reachable.add(t);
  const unreachable = unionTypes.filter((t) => !reachable.has(t));
  // Some types are deliberately spawned by other systems (bounty hunter,
  // summons, sandbox-only). Assert the list does not GROW rather than that
  // it is empty.
  assert.ok(unreachable.length <= 40,
    unreachable.length + ' types spawn in no arena room:\n  ' + unreachable.join(', '));
});

test('tierForRoomsEntered clamps at both ends', () => {
  assert.strictEqual(tierForRoomsEntered(-5), 1);
  assert.strictEqual(tierForRoomsEntered(0), 1);
  assert.strictEqual(tierForRoomsEntered(1), 2);
  assert.strictEqual(tierForRoomsEntered(FINAL_TIER), FINAL_TIER);
  assert.strictEqual(tierForRoomsEntered(999), FINAL_TIER);
});

test('pickRoom avoids an immediate repeat but always returns a room', () => {
  for (const tier of [1, 2, 3, 4, 5]) {
    const pool = roomsForTier(tier);
    for (let i = 0; i < 200; i++) {
      const avoid = pool[i % pool.length].id;
      const got = pickRoom(tier, avoid);
      assert.strictEqual(got.tier, tier);
      if (pool.length > 1) assert.notStrictEqual(got.id, avoid);
    }
    // Asking to avoid the only room still has to return it.
    if (pool.length === 1) assert.ok(pickRoom(tier, pool[0].id));
  }
});

test('WAVES_PER_TIER is a positive integer', () => {
  assert.ok(Number.isInteger(WAVES_PER_TIER) && WAVES_PER_TIER > 0);
});

// ── encyclopedia parity ──────────────────────────────────────────────────
const encyclopedia = fs.readFileSync(path.join(ROOT, 'public/encyclopedia/index.html'), 'utf8');
const encyclopediaIds = [...encyclopedia.matchAll(/^    id: '(\w+)'/gm)].map((m) => m[1]);

test('the encyclopedia has no duplicate entries', () => {
  const seen = new Set();
  const dupes = [];
  for (const id of encyclopediaIds) {
    if (seen.has(id)) dupes.push(id);
    seen.add(id);
  }
  assert.deepStrictEqual(dupes, [], 'a generator ran twice');
});

test('every arena room enemy is documented', () => {
  const documented = new Set(encyclopediaIds);
  const roomEnemies = new Set();
  for (const room of ARENA_ROOMS) {
    for (const t of [...room.natives, room.special]) roomEnemies.add(t);
  }
  const undocumented = [...roomEnemies].filter((t) => !documented.has(t));
  assert.deepStrictEqual(undocumented, []);
});

test('the encyclopedia does not document enemies that no longer exist', () => {
  // This is the check that would have caught the 10 entries a regex deleted -
  // in reverse, it catches entries left behind after a type is removed.
  const known = new Set([...unionTypes, 'player', 'helper', 'turret', 'dummy', 'civilian',
    'armyMan', 'bodyguard', 'sentryTurret', 'drone']);
  const stale = encyclopediaIds.filter((id) => !known.has(id));
  assert.ok(stale.length <= 12, 'unexpected encyclopedia entries: ' + stale.join(', '));
});

test('encyclopedia entry count has not silently dropped', () => {
  // 245 at the time the 10 deleted entries were restored.
  assert.ok(encyclopediaIds.length >= 245,
    'only ' + encyclopediaIds.length + ' entries; something removed some');
});
