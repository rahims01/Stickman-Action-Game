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
