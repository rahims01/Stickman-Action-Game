import * as THREE from 'three';
import * as CANNON from 'cannon-es';

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
  { name: 'mixamorigLeftForeArm', parent: 'mixamorigLeftArm', orientRef: 'mixamorigLeftHand', mass: 1.5, halfExtents: [0.04, 0.12, 0.04], swingAngle: 72 * DEG, twistAngle: 20 * DEG },
  { name: 'mixamorigLeftHand', parent: 'mixamorigLeftForeArm', orientRef: 'mixamorigLeftHandMiddle1', mass: 0.5, halfExtents: [0.035, 0.06, 0.04], swingAngle: 45 * DEG, twistAngle: 30 * DEG },
  { name: 'mixamorigRightShoulder', parent: 'mixamorigSpine2', orientRef: 'mixamorigRightArm', mass: 1, halfExtents: [0.08, 0.05, 0.05], swingAngle: 20 * DEG, twistAngle: 10 * DEG },
  { name: 'mixamorigRightArm', parent: 'mixamorigRightShoulder', orientRef: 'mixamorigRightForeArm', mass: 2, halfExtents: [0.045, 0.13, 0.045], swingAngle: 90 * DEG, twistAngle: 45 * DEG },
  { name: 'mixamorigRightForeArm', parent: 'mixamorigRightArm', orientRef: 'mixamorigRightHand', mass: 1.5, halfExtents: [0.04, 0.12, 0.04], swingAngle: 72 * DEG, twistAngle: 20 * DEG },
  { name: 'mixamorigRightHand', parent: 'mixamorigRightForeArm', orientRef: 'mixamorigRightHandMiddle1', mass: 0.5, halfExtents: [0.035, 0.06, 0.04], swingAngle: 45 * DEG, twistAngle: 30 * DEG },
  { name: 'mixamorigLeftUpLeg', parent: 'mixamorigHips', orientRef: 'mixamorigLeftLeg', mass: 5, halfExtents: [0.07, 0.2, 0.07], swingAngle: 70 * DEG, twistAngle: 35 * DEG },
  { name: 'mixamorigLeftLeg', parent: 'mixamorigLeftUpLeg', orientRef: 'mixamorigLeftFoot', mass: 4, halfExtents: [0.055, 0.19, 0.055], swingAngle: 75 * DEG, twistAngle: 10 * DEG },
  { name: 'mixamorigLeftFoot', parent: 'mixamorigLeftLeg', orientRef: 'mixamorigLeftToeBase', mass: 1, halfExtents: [0.05, 0.04, 0.1], swingAngle: 35 * DEG, twistAngle: 20 * DEG },
  { name: 'mixamorigRightUpLeg', parent: 'mixamorigHips', orientRef: 'mixamorigRightLeg', mass: 5, halfExtents: [0.07, 0.2, 0.07], swingAngle: 70 * DEG, twistAngle: 35 * DEG },
  { name: 'mixamorigRightLeg', parent: 'mixamorigRightUpLeg', orientRef: 'mixamorigRightFoot', mass: 4, halfExtents: [0.055, 0.19, 0.055], swingAngle: 75 * DEG, twistAngle: 10 * DEG },
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

export const createRagdoll = (model: THREE.Object3D, world: CANNON.World): RagdollHandle => {
  let runtimes: BoneRuntime[] = [];
  let constraints: CANNON.Constraint[] = [];
  let active = false;

  const activate = (impulse?: THREE.Vector3) => {
    if (active) return;
    active = true;
    model.updateMatrixWorld(true);

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
        twistAngle: spec.twistAngle
      });
      world.addConstraint(constraint);
      constraints.push(constraint);
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

  const update = () => {
    if (!active) return;
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

  const getHipsWorldPosition = (target: THREE.Vector3) => {
    const hips = runtimes.find((r) => r.bone.name === 'mixamorigHips');
    if (hips) hips.bone.getWorldPosition(target);
  };

  const dispose = () => {
    constraints.forEach((c) => world.removeConstraint(c));
    runtimes.forEach(({ body }) => world.removeBody(body));
    constraints = [];
    runtimes = [];
    active = false;
  };

  return { activate, update, dispose, isActive: () => active, applyImpulseToHips, getHipsWorldPosition };
};
