import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { PHYSICS_GROUP_RAGDOLL, PHYSICS_GROUP_WORLD, registerRagdollBody } from './physicsWorld';

const DEG = Math.PI / 180;

interface RagdollBoneSpec {
  name: string;
  parent: string | null;
  // Bone/reference object whose world position defines the direction this
  // body's box is oriented toward. Doesn't need its own physics body (e.g.
  // HeadTop_End, fingertip, toe bones all work as pure direction refs).
  orientRef: string;
  mass: number;
  halfExtents: [number, number, number];
  swingAngle: number;
  twistAngle: number;
  /**
   * Elbows and knees are NOT ball joints - they bend one way and stop, and a
   * ConeTwist cannot say that on its own: its cone is symmetric about its
   * axis, so any angle it permits forwards it permits backwards too.
   *
   * The fix is a SECOND cone for these joints, centred not on the bone but
   * tilted off it toward the flexion side by its own aperture, so that
   * "straight" sits exactly on its rim. The joint can then close away from
   * that rim through twice the angle and cannot open past straight at all.
   * Elbows flex forward, knees flex backward.
   *
   * It has to be a second constraint rather than a tilt on this one, because
   * ConeTwistConstraint derives the TWIST reference from axisA via
   * axisA.tangents(). Tilting axisA silently rotates the twist frame
   * with it, and the twist equation then fights the cone - which showed up as
   * knees (tightest twist, heaviest limb) inverting completely.
   */
  hinge?: 'elbow' | 'knee';
  /** Aperture of that second cone, and therefore half the usable flexion. */
  hingeAngle?: number;
}

// Bone list, masses, and joint limits follow ragdoll.json. cannon-es has no
// capsule shape, so boxes are used as the spec's documented fallback.
const RAGDOLL_BONES: RagdollBoneSpec[] = [
  { name: 'mixamorigHips', parent: null, orientRef: 'mixamorigSpine', mass: 8, halfExtents: [0.14, 0.1, 0.1], swingAngle: 0, twistAngle: 0 },
  { name: 'mixamorigSpine', parent: 'mixamorigHips', orientRef: 'mixamorigSpine1', mass: 5, halfExtents: [0.13, 0.1, 0.09], swingAngle: 15 * DEG, twistAngle: 10 * DEG },
  { name: 'mixamorigSpine1', parent: 'mixamorigSpine', orientRef: 'mixamorigSpine2', mass: 5, halfExtents: [0.13, 0.09, 0.09], swingAngle: 15 * DEG, twistAngle: 10 * DEG },
  { name: 'mixamorigSpine2', parent: 'mixamorigSpine1', orientRef: 'mixamorigNeck', mass: 5, halfExtents: [0.14, 0.09, 0.1], swingAngle: 15 * DEG, twistAngle: 10 * DEG },
  { name: 'mixamorigNeck', parent: 'mixamorigSpine2', orientRef: 'mixamorigHead', mass: 1, halfExtents: [0.05, 0.05, 0.05], swingAngle: 35 * DEG, twistAngle: 25 * DEG },
  { name: 'mixamorigHead', parent: 'mixamorigNeck', orientRef: 'mixamorigHeadTop_End', mass: 3, halfExtents: [0.1, 0.11, 0.1], swingAngle: 35 * DEG, twistAngle: 25 * DEG },
  { name: 'mixamorigLeftShoulder', parent: 'mixamorigSpine2', orientRef: 'mixamorigLeftArm', mass: 1, halfExtents: [0.08, 0.05, 0.05], swingAngle: 20 * DEG, twistAngle: 10 * DEG },
  { name: 'mixamorigLeftArm', parent: 'mixamorigLeftShoulder', orientRef: 'mixamorigLeftForeArm', mass: 2, halfExtents: [0.045, 0.13, 0.045], swingAngle: 90 * DEG, twistAngle: 45 * DEG },
  { name: 'mixamorigLeftForeArm', parent: 'mixamorigLeftArm', orientRef: 'mixamorigLeftHand', mass: 1.5, halfExtents: [0.04, 0.12, 0.04], swingAngle: 80 * DEG, twistAngle: 8 * DEG, hinge: 'elbow', hingeAngle: 72 * DEG },
  { name: 'mixamorigLeftHand', parent: 'mixamorigLeftForeArm', orientRef: 'mixamorigLeftHandMiddle1', mass: 0.5, halfExtents: [0.035, 0.06, 0.04], swingAngle: 45 * DEG, twistAngle: 30 * DEG },
  { name: 'mixamorigRightShoulder', parent: 'mixamorigSpine2', orientRef: 'mixamorigRightArm', mass: 1, halfExtents: [0.08, 0.05, 0.05], swingAngle: 20 * DEG, twistAngle: 10 * DEG },
  { name: 'mixamorigRightArm', parent: 'mixamorigRightShoulder', orientRef: 'mixamorigRightForeArm', mass: 2, halfExtents: [0.045, 0.13, 0.045], swingAngle: 90 * DEG, twistAngle: 45 * DEG },
  { name: 'mixamorigRightForeArm', parent: 'mixamorigRightArm', orientRef: 'mixamorigRightHand', mass: 1.5, halfExtents: [0.04, 0.12, 0.04], swingAngle: 80 * DEG, twistAngle: 8 * DEG, hinge: 'elbow', hingeAngle: 72 * DEG },
  { name: 'mixamorigRightHand', parent: 'mixamorigRightForeArm', orientRef: 'mixamorigRightHandMiddle1', mass: 0.5, halfExtents: [0.035, 0.06, 0.04], swingAngle: 45 * DEG, twistAngle: 30 * DEG },
  { name: 'mixamorigLeftUpLeg', parent: 'mixamorigHips', orientRef: 'mixamorigLeftLeg', mass: 5, halfExtents: [0.07, 0.2, 0.07], swingAngle: 70 * DEG, twistAngle: 35 * DEG },
  { name: 'mixamorigLeftLeg', parent: 'mixamorigLeftUpLeg', orientRef: 'mixamorigLeftFoot', mass: 4, halfExtents: [0.055, 0.19, 0.055], swingAngle: 75 * DEG, twistAngle: 5 * DEG, hinge: 'knee', hingeAngle: 67 * DEG },
  { name: 'mixamorigLeftFoot', parent: 'mixamorigLeftLeg', orientRef: 'mixamorigLeftToeBase', mass: 1, halfExtents: [0.05, 0.04, 0.1], swingAngle: 35 * DEG, twistAngle: 20 * DEG },
  { name: 'mixamorigRightUpLeg', parent: 'mixamorigHips', orientRef: 'mixamorigRightLeg', mass: 5, halfExtents: [0.07, 0.2, 0.07], swingAngle: 70 * DEG, twistAngle: 35 * DEG },
  { name: 'mixamorigRightLeg', parent: 'mixamorigRightUpLeg', orientRef: 'mixamorigRightFoot', mass: 4, halfExtents: [0.055, 0.19, 0.055], swingAngle: 75 * DEG, twistAngle: 5 * DEG, hinge: 'knee', hingeAngle: 67 * DEG },
  { name: 'mixamorigRightFoot', parent: 'mixamorigRightLeg', orientRef: 'mixamorigRightToeBase', mass: 1, halfExtents: [0.05, 0.04, 0.1], swingAngle: 35 * DEG, twistAngle: 20 * DEG }
];

interface BoneRuntime {
  bone: THREE.Object3D;
  body: CANNON.Body;
  // Fixed relationship between the body's (arbitrarily chosen) orientation
  // and the bone's actual bind-relative transform, captured at activation.
  // Re-applying it every frame lets the body drive the bone correctly
  // without the box's axis convention having to match the rig's own.
  offsetPos: THREE.Vector3;
  offsetQuat: THREE.Quaternion;
}

export interface RagdollHandle {
  activate: (impulse?: THREE.Vector3) => void;
  update: () => void;
  dispose: () => void;
  isActive: () => boolean;
  applyImpulseToHips: (impulse: THREE.Vector3) => void;
  getHipsWorldPosition: (target: THREE.Vector3) => void;
}

/**
 * When to call a corpse finished.
 *
 * cannon's own sleep is not usable for this: measured over ten seconds, only
 * nine of a ragdoll's twenty bodies ever reach SLEEPING - the rest keep a
 * small angular jitter (0.5-2 rad/s) below the linear threshold but above the
 * combined one, forever. So quiet is measured directly, and there is a hard
 * cap behind it for anything balanced on an edge.
 */
const SETTLE_LINEAR_SPEED = 0.15;
const SETTLE_ANGULAR_SPEED = 2;
/** A third of a second of quiet, or three seconds regardless. */
const SETTLE_QUIET_FRAMES = 20;
const SETTLE_FRAME_LIMIT = 180;

// Distinguishes one corpse's limbs from another's, so the broadphase hook in
// physicsWorld can let a limb hit its own chest without every corpse in the
// arena also testing against every other corpse's twenty boxes.
let nextRagdollInstanceId = 0;

/**
 * Which way this character is facing, taken from the POSE rather than from
 * any rig convention: toes point forward, so foot->toe flattened onto the
 * horizontal plane is a reliable anterior direction on any humanoid. Both
 * feet are averaged so a mid-stride pose does not skew it.
 */
const deriveForward = (model: THREE.Object3D): THREE.Vector3 => {
  const up = new THREE.Vector3(0, 1, 0);
  const forward = new THREE.Vector3();
  const footPos = new THREE.Vector3();
  const toePos = new THREE.Vector3();
  let found = 0;
  for (const side of ['Left', 'Right']) {
    const foot = model.getObjectByName(`mixamorig${side}Foot`);
    const toe = model.getObjectByName(`mixamorig${side}ToeBase`);
    if (!foot || !toe) continue;
    foot.getWorldPosition(footPos);
    toe.getWorldPosition(toePos);
    forward.add(toePos.sub(footPos));
    found++;
  }
  if (found === 0) return new THREE.Vector3(0, 0, 1);
  forward.addScaledVector(up, -forward.dot(up));
  if (forward.lengthSq() < 1e-8) return new THREE.Vector3(0, 0, 1);
  return forward.normalize();
};

export const createRagdoll = (model: THREE.Object3D, world: CANNON.World): RagdollHandle => {
  let runtimes: BoneRuntime[] = [];
  let constraints: CANNON.Constraint[] = [];
  let active = false;
  // A corpse that has stopped moving still costs a full solve every step -
  // twenty bodies and nineteen constraints each, and the arena keeps up to
  // DEAD_BODY_LIMIT of them lying around for half a minute. Once every body
  // has fallen asleep the pose is never going to change again, so it is
  // cached, the physics is torn down, and update() just re-applies the frozen
  // pose. Behaviour is unchanged: cannon's solver already skips sleeping
  // bodies and applyImpulse does not wake them, so a settled corpse was
  // immovable before this too - it was just immovable AND expensive.
  let settled = false;
  const settledPose: { bone: THREE.Object3D; position: THREE.Vector3; quaternion: THREE.Quaternion }[] = [];
  let hipsBone: THREE.Object3D | null = null;
  let framesSimulated = 0;
  let quietFrames = 0;

  const activate = (impulse?: THREE.Vector3) => {
    if (active) return;
    active = true;
    model.updateMatrixWorld(true);

    const instanceId = nextRagdollInstanceId++;
    hipsBone = model.getObjectByName('mixamorigHips') ?? null;
    framesSimulated = 0;
    quietFrames = 0;
    const forwardWorld = deriveForward(model);
    const bodiesByName = new Map<string, CANNON.Body>();
    const boneWorldPos = new THREE.Vector3();
    const refWorldPos = new THREE.Vector3();
    const boneWorldQuat = new THREE.Quaternion();
    const dir = new THREE.Vector3();
    const upAxis = new THREE.Vector3(0, 1, 0);
    const bodyQuat = new THREE.Quaternion();

    RAGDOLL_BONES.forEach((spec) => {
      const bone = model.getObjectByName(spec.name);
      if (!bone) return;

      bone.getWorldPosition(boneWorldPos);
      bone.getWorldQuaternion(boneWorldQuat);

      const refObject = model.getObjectByName(spec.orientRef);
      const centerPos = boneWorldPos.clone();
      if (refObject) {
        refObject.getWorldPosition(refWorldPos);
        dir.copy(refWorldPos).sub(boneWorldPos);
        if (dir.lengthSq() > 1e-8) {
          dir.normalize();
          bodyQuat.setFromUnitVectors(upAxis, dir);
        } else {
          bodyQuat.identity();
        }
        centerPos.lerp(refWorldPos, 0.5);
      } else {
        bodyQuat.identity();
      }

      const shape = new CANNON.Box(new CANNON.Vec3(spec.halfExtents[0], spec.halfExtents[1], spec.halfExtents[2]));
      const body = new CANNON.Body({
        mass: spec.mass,
        shape,
        position: new CANNON.Vec3(centerPos.x, centerPos.y, centerPos.z),
        quaternion: new CANNON.Quaternion(bodyQuat.x, bodyQuat.y, bodyQuat.z, bodyQuat.w),
        // Open to the world AND to other limbs. Which limb pairs actually
        // collide is a per-PAIR question that a mask cannot express, so it is
        // settled by the broadphase hook in physicsWorld.ts: same corpse yes,
        // jointed pair no, different corpse no.
        collisionFilterGroup: PHYSICS_GROUP_RAGDOLL,
        collisionFilterMask: PHYSICS_GROUP_WORLD | PHYSICS_GROUP_RAGDOLL,
        linearDamping: 0.4,
        angularDamping: 0.6,
        allowSleep: true,
        sleepSpeedLimit: 0.2,
        sleepTimeLimit: 1
      });

      const offsetQuat = bodyQuat.clone().invert().multiply(boneWorldQuat);
      const offsetPos = boneWorldPos.clone().sub(centerPos).applyQuaternion(bodyQuat.clone().invert());

      bodiesByName.set(spec.name, body);
      world.addBody(body);
      runtimes.push({ bone, body, offsetPos, offsetQuat });
    });

    // Jointed pairs overlap by construction and must never generate contacts.
    // Everything else on this body is free to collide with everything else on
    // it, which is what lets an arm come to rest ON the chest.
    const ignores = new Map<CANNON.Body, Set<number>>();
    runtimes.forEach(({ body }) => ignores.set(body, new Set<number>()));
    RAGDOLL_BONES.forEach((spec) => {
      if (!spec.parent) return;
      const childBody = bodiesByName.get(spec.name);
      const parentBody = bodiesByName.get(spec.parent);
      if (!childBody || !parentBody) return;
      ignores.get(childBody)?.add(parentBody.id);
      ignores.get(parentBody)?.add(childBody.id);
    });
    runtimes.forEach(({ body }) => registerRagdollBody(body, instanceId, ignores.get(body) ?? new Set()));

    const upAxisLocal = new THREE.Vector3(0, 1, 0);
    const flexLocal = new THREE.Vector3();
    const parentQuatInv = new THREE.Quaternion();
    const tiltedAxis = new THREE.Vector3();

    RAGDOLL_BONES.forEach((spec) => {
      if (!spec.parent) return;
      const childBody = bodiesByName.get(spec.name);
      const parentBody = bodiesByName.get(spec.parent);
      const bone = model.getObjectByName(spec.name);
      if (!childBody || !parentBody || !bone) return;

      bone.getWorldPosition(boneWorldPos);
      const jointWorld = new CANNON.Vec3(boneWorldPos.x, boneWorldPos.y, boneWorldPos.z);

      const pivotA = parentBody.quaternion.inverse().vmult(jointWorld.vsub(parentBody.position));
      const pivotB = childBody.quaternion.inverse().vmult(jointWorld.vsub(childBody.position));

      const constraint = new CANNON.ConeTwistConstraint(parentBody, childBody, {
        pivotA,
        pivotB,
        axisA: new CANNON.Vec3(0, 1, 0),
        axisB: new CANNON.Vec3(0, 1, 0),
        angle: spec.swingAngle,
        twistAngle: spec.twistAngle,
        // Belt and braces under the group mask above. cannon defaults this to
        // TRUE, which is what has any constrained pair colliding in the first
        // place. The mask should already prevent it, but this independently
        // removes exactly the parent/child pairs that overlap by construction
        // - so if the grouping is ever misconfigured or a body is created
        // outside createRagdoll, the worst offenders still cannot fight.
        collideConnected: false
      });
      world.addConstraint(constraint);
      constraints.push(constraint);

      if (!spec.hinge || spec.hingeAngle === undefined) return;

      // The flexion direction, in the PARENT body's local frame. Taken from
      // the pose rather than from a rig convention, so it is correct whatever
      // arbitrary roll setFromUnitVectors happened to pick for this body.
      flexLocal.copy(forwardWorld);
      if (spec.hinge === 'knee') flexLocal.negate();
      parentQuatInv
        .set(parentBody.quaternion.x, parentBody.quaternion.y, parentBody.quaternion.z, parentBody.quaternion.w)
        .invert();
      flexLocal.applyQuaternion(parentQuatInv);
      // Only the component across the bone can tilt the cone off it.
      flexLocal.addScaledVector(upAxisLocal, -flexLocal.dot(upAxisLocal));
      if (flexLocal.lengthSq() <= 1e-8) return;
      flexLocal.normalize();
      tiltedAxis
        .copy(upAxisLocal)
        .multiplyScalar(Math.cos(spec.hingeAngle))
        .addScaledVector(flexLocal, Math.sin(spec.hingeAngle));

      // A second ConeTwist used purely as a cone: its point-to-point and
      // twist equations are switched off, leaving only the one-sided cone
      // that refuses to let the joint open past straight. The primary
      // constraint above keeps the true bone axis, so its twist frame - which
      // is derived from axisA - stays correct.
      const hyperLimit = new CANNON.ConeTwistConstraint(parentBody, childBody, {
        pivotA,
        pivotB,
        axisA: new CANNON.Vec3(tiltedAxis.x, tiltedAxis.y, tiltedAxis.z),
        axisB: new CANNON.Vec3(0, 1, 0),
        angle: spec.hingeAngle,
        twistAngle: Math.PI,
        collideConnected: false
      });
      hyperLimit.equations.forEach((equation) => {
        if (equation !== hyperLimit.coneEquation) equation.enabled = false;
      });
      world.addConstraint(hyperLimit);
      constraints.push(hyperLimit);
    });

    if (impulse) {
      const hipsBody = bodiesByName.get('mixamorigHips');
      hipsBody?.applyImpulse(new CANNON.Vec3(impulse.x, impulse.y, impulse.z));
    }
  };

  const worldPos = new THREE.Vector3();
  const worldQuat = new THREE.Quaternion();
  const localMatrix = new THREE.Matrix4();
  const unitScale = new THREE.Vector3(1, 1, 1);
  const parentInverse = new THREE.Matrix4();
  const bodyQuatThree = new THREE.Quaternion();
  // Mixamo bones never animate scale - decompose() needs somewhere to put
  // the matrix's scale component, but it must NOT be written onto the bone.
  // The parent's matrixWorld includes the model's root scale (0.012), so
  // composing with a unit world-scale and converting to local space would
  // otherwise bake in ~1/0.012 to "cancel" it, blowing the mesh up hugely.
  const discardedScale = new THREE.Vector3();

  /**
   * Cache the final pose and hand the bodies back. Called once, when the
   * corpse has come to rest.
   */
  const settle = () => {
    settledPose.length = 0;
    runtimes.forEach(({ bone }) => {
      settledPose.push({ bone, position: bone.position.clone(), quaternion: bone.quaternion.clone() });
    });
    constraints.forEach((c) => world.removeConstraint(c));
    runtimes.forEach(({ body }) => world.removeBody(body));
    constraints = [];
    runtimes = [];
    settled = true;
  };

  const update = () => {
    if (!active) return;

    if (settled) {
      // The animation mixer is never stopped, so it re-poses these bones
      // every frame and they have to be written back over it - same as when
      // the physics was live, just from a cache instead of from bodies.
      for (const frozen of settledPose) {
        frozen.bone.position.copy(frozen.position);
        frozen.bone.quaternion.copy(frozen.quaternion);
      }
      return;
    }

    clampVelocities();
    runtimes.forEach(({ bone, body, offsetPos, offsetQuat }) => {
      bodyQuatThree.set(body.quaternion.x, body.quaternion.y, body.quaternion.z, body.quaternion.w);

      worldQuat.copy(bodyQuatThree).multiply(offsetQuat);
      worldPos.copy(offsetPos).applyQuaternion(bodyQuatThree);
      worldPos.x += body.position.x;
      worldPos.y += body.position.y;
      worldPos.z += body.position.z;

      if (!bone.parent) return;
      bone.parent.updateWorldMatrix(true, false);
      localMatrix.compose(worldPos, worldQuat, unitScale);
      parentInverse.copy(bone.parent.matrixWorld).invert();
      localMatrix.premultiply(parentInverse);
      localMatrix.decompose(bone.position, bone.quaternion, discardedScale);
    });

    // Asleep in cannon's own judgement, or simply out of patience: a limb
    // balanced on an edge can jitter below the sleep threshold indefinitely,
    // and an unbounded cost is worse than a corpse that stops twitching.
    framesSimulated++;
    let maxLinear = 0;
    let maxAngular = 0;
    for (const { body } of runtimes) {
      maxLinear = Math.max(maxLinear, body.velocity.lengthSquared());
      maxAngular = Math.max(maxAngular, body.angularVelocity.lengthSquared());
    }
    const quiet =
      maxLinear < SETTLE_LINEAR_SPEED * SETTLE_LINEAR_SPEED &&
      maxAngular < SETTLE_ANGULAR_SPEED * SETTLE_ANGULAR_SPEED;
    quietFrames = quiet ? quietFrames + 1 : 0;
    if (runtimes.length > 0 && (quietFrames >= SETTLE_QUIET_FRAMES || framesSimulated > SETTLE_FRAME_LIMIT)) settle();
  };

  const applyImpulseToHips = (impulse: THREE.Vector3) => {
    const hips = runtimes.find((r) => r.bone.name === 'mixamorigHips');
    hips?.body.applyImpulse(new CANNON.Vec3(impulse.x, impulse.y, impulse.z));
  };

  // Safety net: nothing should ever exceed a sane speed, regardless of how
  // many frames of contact/impulses stack up. Cheap insurance against any
  // runaway velocity turning the ragdoll into a rocket.
  const MAX_BODY_SPEED = 6;
  const clampVelocities = () => {
    runtimes.forEach(({ body }) => {
      const speedSq = body.velocity.lengthSquared();
      if (speedSq > MAX_BODY_SPEED * MAX_BODY_SPEED) {
        body.velocity.scale(MAX_BODY_SPEED / Math.sqrt(speedSq), body.velocity);
      }
    });
  };

  // Reads the BONE, so it keeps working once the bodies have been released.
  const getHipsWorldPosition = (target: THREE.Vector3) => {
    if (hipsBone) hipsBone.getWorldPosition(target);
  };

  const dispose = () => {
    constraints.forEach((c) => world.removeConstraint(c));
    runtimes.forEach(({ body }) => world.removeBody(body));
    constraints = [];
    runtimes = [];
    settledPose.length = 0;
    settled = false;
    hipsBone = null;
    active = false;
  };

  return { activate, update, dispose, isActive: () => active, applyImpulseToHips, getHipsWorldPosition };
};
