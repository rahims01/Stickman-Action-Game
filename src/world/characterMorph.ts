import * as THREE from 'three';

// Generic runtime bone-scaling body-morph engine for Mixamo-rigged models,
// per instructions/bone-scaling.json: cache every relevant bone's original
// TRS once, then applyBodySliders() always restores that original pose
// before layering sliders back on top, so repeated/stacked calls never
// accumulate. Position/rotation/scale are independent TRS components, and
// these bones are never touched by the ragdoll system (ragdoll.ts reads
// only bone world position/quaternion at activate(), never bone.scale), so
// this is safe to apply at any point before or after ragdoll creation.

export interface BodySliders {
  height?: number; // 0.75 - 1.35, default 1.0
  weight?: number; // -1.0 - 1.0, default 0.0 (negative = thinner)
  muscle?: number; // 0.0 - 1.0, default 0.0
  armSize?: number; // 0.0 - 1.0, default 0.0
  legSize?: number; // 0.0 - 1.0, default 0.0
  chestSize?: number; // 0.0 - 1.0, default 0.0
  waistSize?: number; // 0.0 - 1.0, default 0.0
  hipSize?: number; // 0.0 - 1.0, default 0.0
  shoulderWidth?: number; // 0.0 - 1.0, default 0.0
  headSize?: number; // 0.75 - 1.4, default 1.0
  // Per-bone local scale multipliers applied before headSize correction.
  // Each entry [sx, sy, sz] multiplies the bone's cached original scale —
  // useful for targeted changes (e.g. belly-only fat, short baby limbs) that
  // the generic sliders above can't isolate cleanly.
  boneOverrides?: Record<string, [number, number, number]>;
}

interface BoneCacheEntry {
  bone: THREE.Object3D;
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  scale: THREE.Vector3;
}

export type BoneCache = Map<string, BoneCacheEntry>;

const HIPS_BONE = 'mixamorigHips';
const SPINE_BONES = ['mixamorigSpine', 'mixamorigSpine1', 'mixamorigSpine2'];
const NECK_BONE = 'mixamorigNeck';
const HEAD_BONE = 'mixamorigHead';
const SHOULDER_BONES = ['mixamorigLeftShoulder', 'mixamorigRightShoulder'];
const ARM_UPPER_BONES = ['mixamorigLeftArm', 'mixamorigRightArm'];
const ARM_LOWER_BONES = ['mixamorigLeftForeArm', 'mixamorigRightForeArm'];
const LEG_UPPER_BONES = ['mixamorigLeftUpLeg', 'mixamorigRightUpLeg'];
const LEG_LOWER_BONES = ['mixamorigLeftLeg', 'mixamorigRightLeg'];
const MEASURE_FOOT_BONE = 'mixamorigLeftFoot';

const ALL_MORPH_BONES = [
  HIPS_BONE,
  ...SPINE_BONES,
  NECK_BONE,
  HEAD_BONE,
  ...SHOULDER_BONES,
  ...ARM_UPPER_BONES,
  ...ARM_LOWER_BONES,
  ...LEG_UPPER_BONES,
  ...LEG_LOWER_BONES
];

// Step 1 (Cache Skeleton): locate every bone this engine can touch and
// store its original pose in a dictionary keyed by bone name.
export const cacheBoneTransforms = (model: THREE.Object3D): BoneCache => {
  const cache: BoneCache = new Map();
  ALL_MORPH_BONES.forEach((name) => {
    const bone = model.getObjectByName(name);
    if (!bone) return;
    cache.set(name, {
      bone,
      position: bone.position.clone(),
      quaternion: bone.quaternion.clone(),
      scale: bone.scale.clone()
    });
  });
  return cache;
};

// Reversible by design: restores every cached bone to exactly the pose
// captured by cacheBoneTransforms, discarding any slider-driven changes.
export const resetBody = (cache: BoneCache): void => {
  cache.forEach((entry) => {
    entry.bone.position.copy(entry.position);
    entry.bone.quaternion.copy(entry.quaternion);
    entry.bone.scale.copy(entry.scale);
  });
};

const scaleBoneFromOriginal = (cache: BoneCache, name: string, x: number, y: number, z: number) => {
  const entry = cache.get(name);
  if (!entry) return;
  entry.bone.scale.set(entry.scale.x * x, entry.scale.y * y, entry.scale.z * z);
};

const offsetBoneXFromOriginal = (cache: BoneCache, name: string, dx: number) => {
  const entry = cache.get(name);
  if (!entry) return;
  entry.bone.position.x = entry.position.x + dx;
};

// Step 3 (updateBody): always restore-then-reapply so multiple sliders
// stack correctly and nothing accumulates frame after frame. Each slider
// only touches the specific bones instructions.bone-scaling.json names for
// it; "size" (uniform whole-character scale) is deliberately not handled
// here at all - that one scales the model's own root object, never bones.
export const applyBodySliders = (model: THREE.Object3D, cache: BoneCache, sliders: BodySliders): void => {
  resetBody(cache);

  if (sliders.height !== undefined) {
    const s = sliders.height;
    model.updateMatrixWorld(true);
    const footBone = model.getObjectByName(MEASURE_FOOT_BONE);
    const beforeY = footBone?.getWorldPosition(new THREE.Vector3()).y ?? null;

    [...LEG_UPPER_BONES, ...LEG_LOWER_BONES, ...SPINE_BONES].forEach((name) => scaleBoneFromOriginal(cache, name, 1, s, 1));
    scaleBoneFromOriginal(cache, NECK_BONE, 1, 1 + (s - 1) * 0.3, 1);

    // Measure the actual displacement this caused and nudge the hips by
    // the exact opposite amount, rather than guessing a hip-height
    // formula - keeps feet planted regardless of this rig's proportions.
    if (footBone && beforeY !== null) {
      model.updateMatrixWorld(true);
      const afterY = footBone.getWorldPosition(new THREE.Vector3()).y;
      const hipsEntry = cache.get(HIPS_BONE);
      if (hipsEntry) hipsEntry.bone.position.y += beforeY - afterY;
    }
  }

  if (sliders.weight !== undefined) {
    const w = sliders.weight;
    const torsoFactor = 1 + w * 0.35;
    const armFactor = 1 + w * 0.15;
    [HIPS_BONE, ...SPINE_BONES, ...LEG_UPPER_BONES].forEach((name) => scaleBoneFromOriginal(cache, name, torsoFactor, 1, torsoFactor));
    ARM_UPPER_BONES.forEach((name) => scaleBoneFromOriginal(cache, name, armFactor, 1, armFactor));
  }

  if (sliders.muscle !== undefined) {
    const m = sliders.muscle;
    const limbFactor = 1 + m * 0.25;
    [...ARM_UPPER_BONES, ...ARM_LOWER_BONES, ...LEG_UPPER_BONES, ...LEG_LOWER_BONES].forEach((name) =>
      scaleBoneFromOriginal(cache, name, limbFactor, 1, limbFactor)
    );
    SHOULDER_BONES.forEach((name) => scaleBoneFromOriginal(cache, name, 1 + m * 0.1, 1, 1 + m * 0.1));
  }

  if (sliders.armSize !== undefined) {
    const factor = 1 + sliders.armSize * 0.3;
    [...ARM_UPPER_BONES, ...ARM_LOWER_BONES].forEach((name) => scaleBoneFromOriginal(cache, name, factor, 1, factor));
  }

  if (sliders.legSize !== undefined) {
    const factor = 1 + sliders.legSize * 0.3;
    [...LEG_UPPER_BONES, ...LEG_LOWER_BONES].forEach((name) => scaleBoneFromOriginal(cache, name, factor, 1, factor));
  }

  if (sliders.chestSize !== undefined) {
    const factor = 1 + sliders.chestSize * 0.3;
    scaleBoneFromOriginal(cache, 'mixamorigSpine1', factor, 1, factor);
    scaleBoneFromOriginal(cache, 'mixamorigSpine2', factor, 1, factor);
  }

  if (sliders.waistSize !== undefined) {
    const factor = 1 + sliders.waistSize * 0.3;
    scaleBoneFromOriginal(cache, HIPS_BONE, factor, 1, factor);
    scaleBoneFromOriginal(cache, 'mixamorigSpine', factor, 1, factor);
  }

  if (sliders.hipSize !== undefined) {
    const h = sliders.hipSize;
    scaleBoneFromOriginal(cache, HIPS_BONE, 1 + h * 0.3, 1, 1);
    LEG_UPPER_BONES.forEach((name, i) => offsetBoneXFromOriginal(cache, name, (i === 0 ? -1 : 1) * h * 0.05));
  }

  if (sliders.shoulderWidth !== undefined) {
    const s = sliders.shoulderWidth;
    SHOULDER_BONES.forEach((name, i) => {
      offsetBoneXFromOriginal(cache, name, (i === 0 ? -1 : 1) * s * 0.08);
      scaleBoneFromOriginal(cache, name, 1 + s * 0.2, 1, 1);
    });
  }

  // Per-bone overrides — applied after all generic sliders so explicit values
  // take precedence, but still before headSize so the measurement captures
  // the final ancestor scales correctly.
  if (sliders.boneOverrides !== undefined) {
    for (const [boneName, [sx, sy, sz]] of Object.entries(sliders.boneOverrides)) {
      const entry = cache.get(boneName);
      if (entry) {
        entry.bone.scale.set(entry.scale.x * sx, entry.scale.y * sy, entry.scale.z * sz);
      }
    }
  }

  // Head is forced to its requested size LAST, measured off the actual
  // composed transform relative to `model` (NOT the full scene-world
  // transform) - weight/chestSize/waistSize/hipSize above all scale bones
  // in the head's own ancestor chain (hips -> spine -> spine1 -> spine2 ->
  // neck -> head), and a non-uniformly-scaled ancestor visually
  // squishes/widens every descendant regardless of the descendant's own
  // scale. Without this, a skinny/fat body drags the head along with it;
  // this cancels exactly that inherited distortion so only the
  // neck-and-below stays affected. Measuring relative to `model` instead of
  // the scene root matters: callers render this model at a tiny scale
  // (e.g. 0.012), and `getWorldScale()` would fold that intentional shrink
  // into "inherited distortion" too, producing a wildly wrong correction.
  const headEntry = cache.get(HEAD_BONE);
  if (headEntry) {
    model.updateMatrixWorld(true);
    const modelWorldInverse = model.matrixWorld.clone().invert();
    const relativeMatrix = modelWorldInverse.multiply(headEntry.bone.matrixWorld);
    const inheritedScale = new THREE.Vector3();
    const _relativePosition = new THREE.Vector3();
    const _relativeQuaternion = new THREE.Quaternion();
    relativeMatrix.decompose(_relativePosition, _relativeQuaternion, inheritedScale);
    const targetHeadScale = sliders.headSize ?? 1;
    headEntry.bone.scale.set(
      headEntry.scale.x * (targetHeadScale / inheritedScale.x),
      headEntry.scale.y * (targetHeadScale / inheritedScale.y),
      headEntry.scale.z * (targetHeadScale / inheritedScale.z)
    );
  }
};
