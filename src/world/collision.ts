import { AABB } from './worldObjects';

export const circleCollidesWithBox = (x: number, z: number, radius: number, box: AABB): boolean => {
  const closestX = Math.max(box.minX, Math.min(x, box.maxX));
  const closestZ = Math.max(box.minZ, Math.min(z, box.maxZ));
  const dx = x - closestX;
  const dz = z - closestZ;
  return dx * dx + dz * dz < radius * radius;
};

export const resolveCircleVsBoxes = (
  prevX: number,
  prevZ: number,
  newX: number,
  newZ: number,
  radius: number,
  boxes: AABB[]
): { x: number; z: number } => {
  const collidesAt = (x: number, z: number) => boxes.some((box) => circleCollidesWithBox(x, z, radius, box));

  if (!collidesAt(newX, newZ)) return { x: newX, z: newZ };
  if (!collidesAt(prevX, newZ)) return { x: prevX, z: newZ };
  if (!collidesAt(newX, prevZ)) return { x: newX, z: prevZ };
  return { x: prevX, z: prevZ };
};

/**
 * Slab-method segment vs AABB, in the XZ plane.
 *
 * Returns the fraction along the segment (0..1) at which it first ENTERS the
 * box, or null if it never does. A segment that starts inside returns 0.
 *
 * This is the primitive that a per-step "is my current position inside a
 * box?" test only approximates. A mover that covers more ground in one step
 * than the box is thick steps clean over it and the point test never fires —
 * with WALL_DEPTH at 0.4 and projectiles reaching speed 18, one frame's step
 * can be 0.9 units, so walls were being passed through routinely rather than
 * only under a frame hitch.
 *
 * Deliberately branch-heavy and allocation-free: this runs per projectile per
 * collider per frame, so it must not allocate or close over anything.
 */
export const segmentHitsBox = (
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  box: AABB
): number | null => {
  const dx = x1 - x0;
  const dz = z1 - z0;
  let tMin = 0;
  let tMax = 1;

  // X slab. A ~zero component means the segment runs parallel to this pair of
  // planes, so it is either between them for its whole length or never.
  if (Math.abs(dx) < 1e-9) {
    if (x0 < box.minX || x0 > box.maxX) return null;
  } else {
    const inv = 1 / dx;
    let tNear = (box.minX - x0) * inv;
    let tFar = (box.maxX - x0) * inv;
    if (tNear > tFar) {
      const swap = tNear;
      tNear = tFar;
      tFar = swap;
    }
    if (tNear > tMin) tMin = tNear;
    if (tFar < tMax) tMax = tFar;
    if (tMin > tMax) return null;
  }

  // Z slab.
  if (Math.abs(dz) < 1e-9) {
    if (z0 < box.minZ || z0 > box.maxZ) return null;
  } else {
    const inv = 1 / dz;
    let tNear = (box.minZ - z0) * inv;
    let tFar = (box.maxZ - z0) * inv;
    if (tNear > tFar) {
      const swap = tNear;
      tNear = tFar;
      tFar = swap;
    }
    if (tNear > tMin) tMin = tNear;
    if (tFar < tMax) tMax = tFar;
    if (tMin > tMax) return null;
  }

  return tMin;
};
