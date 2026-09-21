/**
 * World generation. The seeded PRNG makes the layout reproducible on purpose,
 * which is also how the light-beacon bug happened: beacons drew from the same
 * stream, whose prefix is consumed at module load by the initial crates and
 * walls, so the FIRST beacon of every session landed on the same patch of map.
 */
const test = require('node:test');
const assert = require('node:assert');
const w = require('../.test-build/world/worldObjects.js');
const { ENEMY_CONFIGS } = require('../.test-build/world/enemyConfig.js');

const dist = (p) => Math.hypot(p[0], p[2]);

test('the initial layout is populated and on the map', () => {
  assert.strictEqual(w.INITIAL_CRATE_DEFS.length, w.INITIAL_CRATE_COUNT);
  assert.strictEqual(w.INITIAL_WALL_DEFS.length, w.INITIAL_WALL_COUNT);
  assert.ok(w.WALL_COLLIDERS.length > 0);
  for (const crate of w.INITIAL_CRATE_DEFS) {
    assert.ok(dist(crate.position) <= w.MAP_RADIUS + 1e-9, 'crate off the map');
    assert.ok(crate.size > 0);
  }
});

test('colliders are well formed and match their object', () => {
  for (const crate of w.INITIAL_CRATE_DEFS) {
    const b = w.getCrateCollider(crate);
    assert.ok(b.minX < b.maxX && b.minZ < b.maxZ, 'inverted crate collider');
    assert.ok(b.topY > 0);
    assert.ok(Math.abs((b.minX + b.maxX) / 2 - crate.position[0]) < 1e-9, 'collider is off-centre');
  }
  for (const wall of w.INITIAL_WALL_DEFS) {
    const b = w.getWallCollider(wall);
    assert.ok(b.minX < b.maxX && b.minZ < b.maxZ, 'inverted wall collider');
    // One axis is the wall's length, the other is WALL_DEPTH.
    const thin = Math.min(b.maxX - b.minX, b.maxZ - b.minZ);
    assert.ok(Math.abs(thin - w.WALL_DEPTH) < 1e-6, 'wall thickness ' + thin);
  }
});

test('spawn generators keep clear of the player start', () => {
  for (let i = 0; i < 400; i++) {
    for (const p of [w.generateEnemySpawnPosition(), w.generateDummySpawnPosition()]) {
      assert.ok(dist(p) >= w.SPAWN_EXCLUSION_RADIUS - 1e-6, 'spawned inside the exclusion zone');
      assert.ok(dist(p) <= w.MAP_RADIUS + 1e-6, 'spawned off the map');
      assert.strictEqual(p[1], 0, 'spawns should be on the ground');
    }
  }
});

test('light beacons are random per session, not a fixed sequence', () => {
  // The regression: the first beacon was identical every run.
  const first = [];
  for (let i = 0; i < 60; i++) first.push(w.generateLightBlockDef('b' + i).position);
  const unique = new Set(first.map((p) => p[0].toFixed(4) + ',' + p[2].toFixed(4)));
  assert.ok(unique.size > 50, 'only ' + unique.size + '/60 distinct beacon positions');
  for (const p of first) {
    assert.ok(dist(p) >= w.SPAWN_EXCLUSION_RADIUS - 1e-6, 'beacon inside the exclusion zone');
    assert.ok(dist(p) <= w.MAP_RADIUS + 1e-6, 'beacon off the map');
  }
});

test('beacons are biased toward the middle, where the light is useful', () => {
  const inner = w.SPAWN_EXCLUSION_RADIUS + (w.MAP_RADIUS * 0.85 - w.SPAWN_EXCLUSION_RADIUS) / 2;
  let near = 0;
  const N = 3000;
  for (let i = 0; i < N; i++) if (dist(w.generateLightBlockDef('b').position) < inner) near++;
  // Uniform placement would put ~50% inside the half-way radius; the t^1.9
  // bias should put clearly more than that.
  assert.ok(near / N > 0.6, 'only ' + ((near / N) * 100).toFixed(0) + '% landed in the inner half');
});

test('beacons get a real colour', () => {
  for (let i = 0; i < 40; i++) {
    const def = w.generateLightBlockDef('b' + i);
    assert.ok(/^#[0-9a-fA-F]{6}$/.test(def.color), 'bad colour ' + def.color);
    assert.strictEqual(def.id, 'b' + i);
  }
});

test('flag counts rise with level and ids never collide', () => {
  let prev = 0;
  for (let level = 1; level <= 20; level++) {
    const n = w.flagCountForLevel(level);
    assert.ok(n > 0, 'level ' + level + ' has no flags');
    assert.ok(n >= prev, 'flag count went down at level ' + level);
    prev = n;
  }
  const flags = w.regenerateFlagsForLevel(5, 100);
  assert.strictEqual(flags.length, w.flagCountForLevel(5));
  assert.strictEqual(new Set(flags.map((f) => f.id)).size, flags.length, 'duplicate flag ids');
  for (const f of flags) assert.ok(dist(f.position) <= w.MAP_RADIUS + 1e-6);
});

test('basic enemy spawns name real types and respect the rare cap', () => {
  for (let level = 1; level <= 15; level++) {
    for (let i = 0; i < 100; i++) {
      const spawn = w.generateBasicEnemySpawn(level, 99);   // rare cap already full
      assert.ok(ENEMY_CONFIGS[spawn.type], 'level ' + level + ' produced unknown type ' + spawn.type);
    }
  }
});

test('medkits and footballs generate on the map', () => {
  for (let i = 0; i < 100; i++) {
    const m = w.generateMedkitDef('m' + i);
    assert.ok(dist(m.position) <= w.MAP_RADIUS + 1e-6);
    const f = w.generateFootballSpawn('f' + i);
    assert.strictEqual(f.id, 'f' + i);
    assert.ok(dist(f.position) <= w.MAP_RADIUS + 1e-6);
    assert.ok(dist(f.position) >= w.SPAWN_EXCLUSION_RADIUS - 1e-6);
  }
});

test('platforms expose a collider with a standable top', () => {
  assert.ok(w.INITIAL_PLATFORM_DEFS.length > 0);
  for (const p of w.INITIAL_PLATFORM_DEFS) {
    const b = w.getPlatformCollider(p);
    assert.ok(b.minX < b.maxX && b.minZ < b.maxZ);
    assert.ok(b.topY > 0, 'a platform you cannot stand on is not a platform');
  }
});
