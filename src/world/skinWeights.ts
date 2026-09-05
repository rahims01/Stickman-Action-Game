import * as THREE from 'three';

/**
 * Repairs skin weights after an FBX load.
 *
 * The console warning three emits here is not cosmetic:
 *
 *   THREE.FBXLoader: Vertex has more than 4 skinning weights assigned to
 *   vertex. Deleting additional weights.
 *
 * Mixamo rigs weight some vertices to more than four bones. Three keeps the
 * first four and discards the rest WITHOUT renormalising, so those vertices
 * end up with weights summing to less than 1. A vertex whose weights sum to
 * 0.7 is only 70% skinned — the remaining 30% pins it toward the origin of
 * the bind pose, which shows up as the mesh pinching or collapsing inward
 * around shoulders, hips and hands.
 *
 * This project makes it worse than most: the bone-scaling slider system
 * multiplies bone transforms, so any under-weighted vertex is displaced
 * proportionally further.
 *
 * The fix is to rescale each vertex's four surviving weights so they sum to 1
 * again. Guarded by a WeakSet because every actor clones the same cached base
 * FBX and shares its geometry — doing it once per geometry fixes every clone,
 * and doing it repeatedly would be wasted work on already-normal weights.
 */
const repaired = new WeakSet<THREE.BufferGeometry>();

export const normalizeSkinWeights = (root: THREE.Object3D): void => {
  root.traverse((child) => {
    const mesh = child as THREE.SkinnedMesh;
    if (!mesh.isSkinnedMesh) return;

    const geometry = mesh.geometry as THREE.BufferGeometry;
    if (repaired.has(geometry)) return;

    const attr = geometry.attributes.skinWeight as THREE.BufferAttribute | undefined;
    if (!attr) return;

    for (let i = 0; i < attr.count; i++) {
      const x = attr.getX(i);
      const y = attr.getY(i);
      const z = attr.getZ(i);
      const w = attr.getW(i);
      const sum = x + y + z + w;
      // sum === 0 means the vertex is unskinned; leave it rather than divide
      // by zero. sum === 1 is already correct and costs nothing to rewrite.
      if (sum > 0) attr.setXYZW(i, x / sum, y / sum, z / sum, w / sum);
    }
    attr.needsUpdate = true;
    repaired.add(geometry);
  });
};
