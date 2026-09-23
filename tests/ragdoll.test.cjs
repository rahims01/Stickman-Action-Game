/**
 * Ragdoll and physics-world behaviour, against the real modules.
 *
 * Every assertion here corresponds to a bug that actually shipped:
 * limbs colliding with their own joints, limbs NOT colliding with the torso,
 * elbows and knees bending backwards, corpses simulating forever, and a
 * retirement clock that scaled inversely with framerate.
 */
const test = require('node:test');
const { beforeEach } = require('node:test');
const assert = require('node:assert');
const THREE = require('three');
const CANNON = require('cannon-es');
const { createRagdoll } = require('../.test-build/world/ragdoll.js');
const { physicsWorld, stepPhysicsWorld, PHYSICS_GROUP_WORLD, PHYSICS_GROUP_RAGDOLL } =
  require('../.test-build/world/physicsWorld.js');

const BONE_ORDER = [
  'Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head',
  'LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand',
  'RightShoulder', 'RightArm', 'RightForeArm', 'RightHand',
  'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'RightUpLeg', 'RightLeg', 'RightFoot'
];
const idx = (n) => BONE_ORDER.indexOf(n);

// Leave the shared world exactly as it was found, whatever a test did to it.
const WORLD_BASELINE = physicsWorld.bodies.length;
beforeEach(() => {
  while (physicsWorld.constraints.length) physicsWorld.removeConstraint(physicsWorld.constraints[0]);
  while (physicsWorld.bodies.length > WORLD_BASELINE) {
    physicsWorld.removeBody(physicsWorld.bodies[physicsWorld.bodies.length - 1]);
  }
});

/** A structurally real mixamo rig at the game's 0.012 root scale. */
const buildRig = () => {
  const bone = (name, pos, parent) => {
    const o = new THREE.Bone();
    o.name = name;
    o.position.set(pos[0], pos[1], pos[2]);
    if (parent) parent.add(o);
    return o;
  };
  const model = new THREE.Group();
  model.scale.setScalar(0.012);
  const hips = bone('mixamorigHips', [0, 100, 0], model);
  const spine = bone('mixamorigSpine', [0, 10, 0], hips);
  const spine1 = bone('mixamorigSpine1', [0, 10, 0], spine);
  const spine2 = bone('mixamorigSpine2', [0, 10, 0], spine1);
  const neck = bone('mixamorigNeck', [0, 10, 0], spine2);
  const head = bone('mixamorigHead', [0, 10, 0], neck);
  bone('mixamorigHeadTop_End', [0, 15, 0], head);
  for (const [side, sx] of [['Left', 1], ['Right', -1]]) {
    const sh = bone('mixamorig' + side + 'Shoulder', [8 * sx, 5, 0], spine2);
    const arm = bone('mixamorig' + side + 'Arm', [12 * sx, 0, 0], sh);
    const fore = bone('mixamorig' + side + 'ForeArm', [25 * sx, 0, 0], arm);
    const hand = bone('mixamorig' + side + 'Hand', [25 * sx, 0, 0], fore);
    bone('mixamorig' + side + 'HandMiddle1', [8 * sx, 0, 0], hand);
    const up = bone('mixamorig' + side + 'UpLeg', [8 * sx, -5, 0], hips);
    const leg = bone('mixamorig' + side + 'Leg', [0, -40, 0], up);
    const foot = bone('mixamorig' + side + 'Foot', [0, -38, 0], leg);
    bone('mixamorig' + side + 'ToeBase', [0, -5, 12], foot);   // toes point +Z
  }
  model.updateMatrixWorld(true);
  return model;
};

/** Spawn a ragdoll and hand back its bodies/constraints plus a disposer. */
const spawn = () => {
  const bodiesBefore = physicsWorld.bodies.length;
  const constraintsBefore = physicsWorld.constraints.length;
  const model = buildRig();
  const ragdoll = createRagdoll(model, physicsWorld);
  ragdoll.activate();
  return {
    ragdoll,
    model,
    bodies: physicsWorld.bodies.slice(bodiesBefore),
    constraints: physicsWorld.constraints.slice(constraintsBefore),
    bodiesBefore,
    dispose: () => ragdoll.dispose()
  };
};

test('activate builds the documented rig', () => {
  const r = spawn();
  assert.strictEqual(r.bodies.length, 20, '20 of the 57 bones get bodies');
  // 19 joints, plus one extra one-way cone for each of the 4 hinges.
  assert.strictEqual(r.constraints.length, 23);
  for (const body of r.bodies) {
    assert.ok(body.mass > 0, 'limbs must be dynamic');
    assert.strictEqual(body.shapes.length, 1);
    assert.ok(body.shapes[0] instanceof CANNON.Box, 'cannon-es has no capsule');
    assert.strictEqual(body.linearDamping, 0.4);
    assert.strictEqual(body.angularDamping, 0.6);
    assert.ok(body.allowSleep);
  }
  const total = r.bodies.reduce((sum, b) => sum + b.mass, 0);
  assert.strictEqual(total, 57, 'total mass');
  r.dispose();
});

test('activate is idempotent and dispose is clean', () => {
  const r = spawn();
  r.ragdoll.activate();           // second call must be a no-op
  assert.strictEqual(physicsWorld.bodies.length, r.bodiesBefore + 20);
  assert.ok(r.ragdoll.isActive());
  r.dispose();
  assert.strictEqual(physicsWorld.bodies.length, r.bodiesBefore);
  assert.strictEqual(physicsWorld.constraints.length, 0);
  assert.ok(!r.ragdoll.isActive());
  r.dispose();                    // double dispose must not throw
});

test('neighbouring geometry never collides; distant limbs do', () => {
  const r = spawn();
  const bp = physicsWorld.broadphase;
  const collides = (a, b) => bp.needBroadphaseCollision(r.bodies[idx(a)], r.bodies[idx(b)]);

  // Jointed pairs share a joint and overlap there by construction.
  let jointedColliding = 0;
  for (const c of r.constraints) if (bp.needBroadphaseCollision(c.bodyA, c.bodyB)) jointedColliding++;
  assert.strictEqual(jointedColliding, 0, 'a jointed pair must never generate contacts');

  // Within two joints is neighbouring geometry, not a collision. Every one
  // of these was measured pressing continuously before it was excluded -
  // Spine1/Shoulder alone shoved the shoulders out of the torso every step.
  for (const [a, b] of [
    ['Spine1', 'LeftShoulder'], ['Spine1', 'RightShoulder'],
    ['Spine', 'LeftUpLeg'], ['Spine', 'RightUpLeg'],
    ['LeftShoulder', 'Neck'], ['RightShoulder', 'Neck'],
    ['LeftUpLeg', 'RightUpLeg'], ['Spine', 'Spine2'],
    ['Hips', 'Spine1'], ['LeftArm', 'Spine2']
  ]) {
    assert.ok(!collides(a, b), a + ' and ' + b + ' are neighbours and must not collide');
  }

  // Far enough apart to be a genuine limb landing on the body. This is the
  // whole point of the feature: an arm across the chest has to land on it.
  for (const [a, b] of [
    ['LeftHand', 'Spine2'], ['LeftHand', 'Spine1'], ['LeftHand', 'Hips'],
    ['LeftForeArm', 'Spine1'], ['RightHand', 'RightUpLeg'],
    ['LeftHand', 'RightHand'], ['LeftFoot', 'RightFoot'], ['Head', 'LeftHand']
  ]) {
    assert.ok(collides(a, b), a + ' must be able to land on ' + b);
  }

  // And the exclusions must stay a minority - if most of the body stopped
  // colliding we would be back to limbs sinking through each other.
  let pairs = 0;
  let colliding = 0;
  for (let i = 0; i < r.bodies.length; i++) {
    for (let j = i + 1; j < r.bodies.length; j++) {
      pairs++;
      if (bp.needBroadphaseCollision(r.bodies[i], r.bodies[j])) colliding++;
    }
  }
  assert.ok(colliding / pairs > 0.6,
    'only ' + colliding + ' of ' + pairs + ' limb pairs can collide');
  r.dispose();
});

test('limbs collide with the world, and corpses not with each other', () => {
  const a = spawn();
  const b = spawn();
  const bp = physicsWorld.broadphase;
  const ground = physicsWorld.bodies[0];

  for (const body of a.bodies) {
    assert.strictEqual(body.collisionFilterGroup, PHYSICS_GROUP_RAGDOLL);
    assert.ok(body.collisionFilterMask & PHYSICS_GROUP_WORLD, 'must still hit the ground');
    assert.ok(bp.needBroadphaseCollision(body, ground));
  }
  let cross = 0;
  for (const x of a.bodies) for (const y of b.bodies) if (bp.needBroadphaseCollision(x, y)) cross++;
  assert.strictEqual(cross, 0, 'the accepted trade-off: corpses do not stack');
  a.dispose();
  b.dispose();
});

test('every constraint refuses to collide its own pair', () => {
  const r = spawn();
  for (const c of r.constraints) assert.strictEqual(c.collideConnected, false);
  r.dispose();
});

test('hinges get a second, off-bone cone; ball joints do not', () => {
  const r = spawn();
  const onBone = (c) => Math.abs(c.axisA.x) < 1e-9 && Math.abs(c.axisA.y - 1) < 1e-9 && Math.abs(c.axisA.z) < 1e-9;
  const tilted = r.constraints.filter((c) => !onBone(c));
  assert.strictEqual(tilted.length, 4, 'two elbows and two knees');
  assert.strictEqual(r.constraints.length - tilted.length, 19);

  for (const cone of tilted) {
    const live = cone.equations.filter((e) => e.enabled);
    assert.strictEqual(live.length, 1, 'only the cone equation runs');
    assert.strictEqual(live[0], cone.coneEquation);
    // The cone axis must lean off the bone by its own aperture, which is
    // what puts "straight" on the rim.
    const lean = Math.acos(Math.min(1, Math.abs(cone.axisA.y)));
    assert.ok(Math.abs(lean - cone.angle) < 1e-6, 'lean ' + lean + ' vs aperture ' + cone.angle);
  }
  r.dispose();
});

test('knee cones lean toward flexion, elbow cones toward the front', () => {
  const r = spawn();
  const q = new THREE.Quaternion();
  const onBone = (c) => Math.abs(c.axisA.y - 1) < 1e-9;
  for (const side of ['Left', 'Right']) {
    for (const [parent, child, wantZ] of [
      [side + 'UpLeg', side + 'Leg', -1],   // knees flex backward (-Z here)
      [side + 'Arm', side + 'ForeArm', +1]  // elbows flex forward (+Z)
    ]) {
      const p = r.bodies[idx(parent)];
      const cone = r.constraints.find((c) => c.bodyA === p && c.bodyB === r.bodies[idx(child)] && !onBone(c));
      assert.ok(cone, 'no one-way cone for ' + child);
      q.set(p.quaternion.x, p.quaternion.y, p.quaternion.z, p.quaternion.w);
      const world = new THREE.Vector3(cone.axisA.x, cone.axisA.y, cone.axisA.z).applyQuaternion(q);
      assert.ok(Math.sign(world.z) === wantZ && Math.abs(world.z) > 0.5,
        child + ' cone leans z=' + world.z.toFixed(2) + ', expected sign ' + wantZ);
    }
  }
  r.dispose();
});

test('a dropped ragdoll falls, stays jointed and comes to rest', () => {
  const r = spawn();
  const hips = r.bodies[idx('Hips')];
  const spine = r.bodies[idx('Spine')];
  const startY = hips.position.y;
  const restLength = hips.position.distanceTo(spine.position);
  let worstStretch = 1;

  for (let i = 0; i < 150; i++) {
    stepPhysicsWorld(1 / 60);
    r.ragdoll.update();
    if (r.ragdoll.isActive() && physicsWorld.bodies.includes(hips)) {
      worstStretch = Math.max(worstStretch, hips.position.distanceTo(spine.position) / restLength);
    }
    assert.ok(!Number.isNaN(hips.position.y), 'NaN at step ' + i);
  }
  assert.ok(hips.position.y < startY - 0.2, 'it should fall');
  assert.ok(hips.position.y > -0.5, 'it should not sink through the floor');
  assert.ok(worstStretch < 1.5, 'joint stretched ' + worstStretch.toFixed(2) + 'x');
  r.dispose();
});

test('a settled corpse hands its physics back', () => {
  const r = spawn();
  let steps = 0;
  while (steps < 1000 && physicsWorld.bodies.length > r.bodiesBefore) {
    stepPhysicsWorld(1 / 60);
    r.ragdoll.update();
    steps++;
  }
  assert.strictEqual(physicsWorld.bodies.length, r.bodiesBefore, 'bodies were never released');
  assert.strictEqual(physicsWorld.constraints.length, 0, 'constraints were never released');
  assert.ok(r.ragdoll.isActive(), 'it is retired, not disposed - the pose must persist');

  // The pose must survive, because the animation mixer keeps re-posing the
  // bones underneath and update() is the only thing writing over it.
  const bone = r.model.getObjectByName('mixamorigLeftForeArm');
  const frozen = bone.quaternion.clone();
  bone.quaternion.set(0, 0, 0, 1);          // pretend the mixer ran
  r.ragdoll.update();
  // 1e-5 rad is 0.0006 degrees - far below visible, and well above the
  // 1e-8 round-trip noise of composing and decomposing a quaternion.
  assert.ok(bone.quaternion.angleTo(frozen) < 1e-5, 'retired pose was not re-applied');
  r.dispose();
});

test('retirement is driven by simulated time, not by frames', () => {
  // The bug: counting update() calls made the delay scale inversely with
  // framerate - 3s at 60fps but 30s at 6fps, slowest exactly when the frame
  // rate says it is most urgent.
  const retireAfter = (frameDelta) => {
    const r = spawn();
    const startStep = physicsWorld.stepnumber;
    let frames = 0;
    while (frames < 20000 && physicsWorld.bodies.length > r.bodiesBefore) {
      stepPhysicsWorld(frameDelta);
      r.ragdoll.update();
      frames++;
    }
    const substeps = physicsWorld.stepnumber - startStep;
    r.dispose();
    return { substeps, wall: frames * frameDelta };
  };

  const fast = retireAfter(1 / 240);
  const normal = retireAfter(1 / 60);
  const slow = retireAfter(0.1);

  for (const [label, run] of [['240fps', fast], ['60fps', normal], ['10fps', slow]]) {
    assert.ok(run.wall > 0.5 && run.wall < 8,
      label + ' retired after ' + run.wall.toFixed(1) + 's wall clock');
  }
  // Frames faster than the fixed step run no internal step at all; the clock
  // must not age the corpse on those.
  assert.strictEqual(fast.substeps, normal.substeps,
    'banked frames aged the corpse: ' + fast.substeps + ' vs ' + normal.substeps);
});

test('getHipsWorldPosition keeps working after retirement', () => {
  const r = spawn();
  const target = new THREE.Vector3();
  r.ragdoll.getHipsWorldPosition(target);
  assert.ok(Number.isFinite(target.y) && target.y > 0);
  while (physicsWorld.bodies.length > r.bodiesBefore) {
    stepPhysicsWorld(1 / 60);
    r.ragdoll.update();
  }
  const after = new THREE.Vector3();
  r.ragdoll.getHipsWorldPosition(after);
  assert.ok(Number.isFinite(after.y), 'reads the BONE, so it survives losing the bodies');
  r.dispose();
});

test('the hips impulse is the kinematic handover, and is clamped', () => {
  const r = spawn();
  const hips = r.bodies[idx('Hips')];
  r.ragdoll.applyImpulseToHips(new THREE.Vector3(0, 0, 40));
  assert.ok(hips.velocity.z > 0, 'impulse should move the hips');
  for (let i = 0; i < 5; i++) {
    stepPhysicsWorld(1 / 60);
    r.ragdoll.update();
  }
  for (const b of r.bodies) {
    if (!physicsWorld.bodies.includes(b)) continue;
    assert.ok(b.velocity.length() <= 6.001, 'MAX_BODY_SPEED clamp: ' + b.velocity.length());
  }
  r.dispose();
});

test('bone scale is never written (the 83x blow-up)', () => {
  const r = spawn();
  for (let i = 0; i < 30; i++) {
    stepPhysicsWorld(1 / 60);
    r.ragdoll.update();
  }
  r.model.traverse((o) => {
    if (!o.isBone) return;
    assert.ok(Math.abs(o.scale.x - 1) < 1e-6 && Math.abs(o.scale.y - 1) < 1e-6 && Math.abs(o.scale.z - 1) < 1e-6,
      o.name + ' scale was written: ' + o.scale.toArray().join(','));
  });
  r.dispose();
});

test('the shared world is configured as the ragdolls expect', () => {
  assert.strictEqual(physicsWorld.gravity.y, -9.81);
  assert.ok(physicsWorld.allowSleep, 'per-body sleep needs the world switch too');
  assert.strictEqual(physicsWorld.solver.iterations, 10);
  const statics = physicsWorld.bodies.filter((b) => b.mass === 0);
  assert.ok(statics.length > 0, 'ground and walls');
  for (const b of statics) assert.strictEqual(b.collisionFilterGroup, PHYSICS_GROUP_WORLD);
});

test('elbows and knees hold under a shove straight against the bend', () => {
  // The brutal case: a sustained 0.6 impulse per step on each extremity,
  // aimed the wrong way. The one-way cone alone lost knees to ~100 degrees
  // here, because a cone is soft and its jacobian collapses once the bend
  // passes (180 - aperture). The post-step clamp is the hard backstop.
  const r = spawn();
  const q = new THREE.Quaternion();
  const quatOf = (b) => q.set(b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w);
  const fwd = new THREE.Vector3(0, 0, 1);      // toes point +Z on this rig

  const hinges = [
    { parent: 'LeftArm', child: 'LeftForeArm', tip: 'LeftHand', knee: false },
    { parent: 'RightArm', child: 'RightForeArm', tip: 'RightHand', knee: false },
    { parent: 'LeftUpLeg', child: 'LeftLeg', tip: 'LeftFoot', knee: true },
    { parent: 'RightUpLeg', child: 'RightLeg', tip: 'RightFoot', knee: true }
  ];
  for (const h of hinges) {
    const f = fwd.clone();
    if (h.knee) f.negate();
    // Captured in the PARENT's frame, so a tumbling corpse does not turn
    // natural flexion into apparent hyperextension.
    h.flexLocal = f.applyQuaternion(quatOf(r.bodies[idx(h.parent)]).invert()).normalize();
    h.worst = 0;
    h.maxFlex = 0;
  }

  const u = new THREE.Vector3();
  const v = new THREE.Vector3();
  const perp = new THREE.Vector3();
  const flexNow = new THREE.Vector3();
  for (let step = 0; step < 150; step++) {
    for (const h of hinges) {
      flexNow.copy(h.flexLocal).applyQuaternion(quatOf(r.bodies[idx(h.parent)]));
      r.bodies[idx(h.tip)].applyImpulse(
        new CANNON.Vec3(-flexNow.x * 0.6, -flexNow.y * 0.6, -flexNow.z * 0.6)
      );
    }
    stepPhysicsWorld(1 / 60);
    r.ragdoll.update();
    if (!physicsWorld.bodies.includes(r.bodies[0])) break;   // retired
    for (const h of hinges) {
      const parent = r.bodies[idx(h.parent)];
      u.set(0, 1, 0).applyQuaternion(quatOf(parent));
      v.set(0, 1, 0).applyQuaternion(quatOf(r.bodies[idx(h.child)]));
      const cos = Math.max(-1, Math.min(1, u.dot(v)));
      const bend = Math.acos(cos) * 180 / Math.PI;
      perp.copy(v).addScaledVector(u, -cos);
      flexNow.copy(h.flexLocal).applyQuaternion(quatOf(parent));
      if (perp.dot(flexNow) < 0) h.worst = Math.max(h.worst, bend);
      else h.maxFlex = Math.max(h.maxFlex, bend);
    }
  }

  for (const h of hinges) {
    assert.ok(h.worst < 15,
      h.child + ' bent ' + h.worst.toFixed(1) + ' degrees BACKWARDS');
  }
  // And it must still be a joint, not a weld.
  assert.ok(hinges.some((h) => h.maxFlex > 20),
    'nothing flexed naturally: ' + hinges.map((h) => h.maxFlex.toFixed(0)).join('/'));
  r.dispose();
});
