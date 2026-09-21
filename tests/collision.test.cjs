const test = require('node:test');
const assert = require('node:assert');
const { circleCollidesWithBox, resolveCircleVsBoxes, segmentHitsBox } =
  require('../.test-build/world/collision.js');

const box = (minX, maxX, minZ, maxZ, topY = 1) => ({ id: 'b', minX, maxX, minZ, maxZ, topY });
const wall = box(-0.2, 0.2, -1.5, 1.5, 1.1);   // WALL_DEPTH is 0.4

test('circleCollidesWithBox', async (t) => {
  await t.test('centre inside', () => assert.ok(circleCollidesWithBox(0, 0, 0.1, wall)));
  await t.test('clear of the face', () => assert.ok(!circleCollidesWithBox(-1, 0, 0.1, wall)));
  await t.test('radius reaches the face', () => assert.ok(circleCollidesWithBox(-0.25, 0, 0.1, wall)));
  // Exact tangency is not worth asserting: -0.3 + 0.1 lands at 0.09999999999999998,
  // so the strict < comparison can fall either way. Test clear of the edge.
  await t.test('clearly outside the radius', () => assert.ok(!circleCollidesWithBox(-0.35, 0, 0.1, wall)));
  await t.test('clearly inside the radius', () => assert.ok(circleCollidesWithBox(-0.28, 0, 0.1, wall)));
  await t.test('nearest point is a corner', () => {
    assert.ok(circleCollidesWithBox(-0.25, 1.55, 0.1, wall));
    assert.ok(!circleCollidesWithBox(-0.4, 1.7, 0.1, wall));
  });
  await t.test('zero radius never collides', () => assert.ok(!circleCollidesWithBox(0, 0, 0, wall)));
});

test('resolveCircleVsBoxes slides along the blocked axis', async (t) => {
  await t.test('free movement is returned unchanged', () => {
    assert.deepStrictEqual(resolveCircleVsBoxes(-2, 0, -1.5, 0.5, 0.1, [wall]), { x: -1.5, z: 0.5 });
  });
  await t.test('head-on gives up x but keeps z', () => {
    const r = resolveCircleVsBoxes(-0.5, 0, 0, 0.5, 0.2, [wall]);
    assert.strictEqual(r.x, -0.5, 'x should be refused');
    assert.strictEqual(r.z, 0.5, 'z should slide');
  });
  await t.test('fully cornered returns the previous position', () => {
    const boxes = [box(-0.2, 5, -0.2, 5), box(-5, 0.2, -5, 0.2)];
    assert.deepStrictEqual(resolveCircleVsBoxes(0, 0, 0.1, 0.1, 0.3, boxes), { x: 0, z: 0 });
  });
  await t.test('no boxes is a no-op', () => {
    assert.deepStrictEqual(resolveCircleVsBoxes(1, 2, 3, 4, 0.5, []), { x: 3, z: 4 });
  });
});

test('segmentHitsBox (the projectile tunnelling fix)', async (t) => {
  await t.test('a 0.9 step through a 0.4 wall is caught', () => {
    // At speed 18 with dt clamped to 0.05 this is one frame's travel, and
    // the old point-in-box test saw nothing because the bolt LANDED past it.
    const hit = segmentHitsBox(-0.6, 0, 0.3, 0, wall);
    assert.ok(hit !== null);
    assert.ok(Math.abs(hit - 0.4 / 0.9) < 1e-9, 'entry fraction ' + hit);
    assert.ok(!circleCollidesWithBox(0.3, 0, 1e-9, wall), 'landing point really is past the wall');
  });
  await t.test('stopping short does not hit', () =>
    assert.strictEqual(segmentHitsBox(-0.6, 0, -0.4, 0, wall), null));
  await t.test('ending exactly on the face hits at t=1', () => {
    const t1 = segmentHitsBox(-0.6, 0, -0.2, 0, wall);
    assert.ok(t1 !== null && Math.abs(t1 - 1) < 1e-9);
  });
  await t.test('starting inside returns 0', () =>
    assert.strictEqual(segmentHitsBox(0, 0, 0.9, 0, wall), 0));
  await t.test('parallel and outside never enters', () =>
    assert.strictEqual(segmentHitsBox(-0.6, -2, -0.6, 2, wall), null));
  await t.test('parallel but inside the x slab enters via z', () => {
    const t1 = segmentHitsBox(0, -2, 0, 2, wall);
    assert.ok(Math.abs(t1 - 0.125) < 1e-9, 'got ' + t1);
  });
  await t.test('entry is the LATER of the two slab crossings', () => {
    // Starts outside the z slab: x reaches the face at 0.444 but z only at
    // 0.667, and the box is not entered until both are satisfied.
    const t1 = segmentHitsBox(-0.6, -1.9, 0.3, -1.3, wall);
    assert.ok(Math.abs(t1 - 0.4 / 0.6) < 1e-9, 'got ' + t1);
  });
  await t.test('passing beyond the end of the wall misses', () =>
    assert.strictEqual(segmentHitsBox(-0.6, 3, 0.3, 3, wall), null));
  await t.test('degenerate zero-length segments', () => {
    assert.strictEqual(segmentHitsBox(-0.6, 0, -0.6, 0, wall), null);
    assert.strictEqual(segmentHitsBox(0, 0, 0, 0, wall), 0);
  });
  await t.test('nearest of two walls has the smaller fraction', () => {
    const far = box(1.0, 1.4, -1.5, 1.5, 1.1);
    assert.ok(segmentHitsBox(-0.6, 0, 2, 0, wall) < segmentHitsBox(-0.6, 0, 2, 0, far));
  });
  await t.test('never returns a fraction outside 0..1', () => {
    for (let i = 0; i < 500; i++) {
      const p = () => (Math.random() - 0.5) * 6;
      const t1 = segmentHitsBox(p(), p(), p(), p(), wall);
      if (t1 !== null) assert.ok(t1 >= 0 && t1 <= 1, 'fraction ' + t1);
    }
  });
});
