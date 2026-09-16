import * as CANNON from 'cannon-es';
import { CrateDef, WALL_COLLIDERS } from './worldObjects';

/**
 * Collision groups.
 *
 * A limb must collide with the rest of its OWN body - an arm coming to rest
 * across the chest has to land on it, not sink through it - while the pairs
 * that overlap BY CONSTRUCTION must not. Each box spans from its own bone to
 * the next, so the upper-arm box and the forearm box both occupy the elbow;
 * cannon reads that as two solids interpenetrating, shoves them apart hard,
 * and the ConeTwist holding them together hauls them straight back. Every
 * joint fighting itself, every frame.
 *
 * Masks alone cannot express that, because it is a per-PAIR rule rather than
 * a per-body one. So the mask opens ragdoll-to-ragdoll traffic and the
 * broadphase hook below decides each pair:
 *
 *   different corpses          -> never collide (keeps the cost down; this is
 *                                 the "corpses do not stack" trade-off)
 *   same corpse, jointed pair  -> never collide (the overlap-by-construction
 *                                 case that was making joints fight)
 *   same corpse, anything else -> collide normally (hand on chest, knee on
 *                                 the opposite shin, and so on)
 */
export const PHYSICS_GROUP_WORLD = 1;
export const PHYSICS_GROUP_RAGDOLL = 2;

// Which ragdoll a body belongs to, and which of its siblings it must ignore.
// WeakMaps rather than fields on the body so cannon's types stay untouched
// and a disposed ragdoll's entries go away on their own.
const ragdollInstance = new WeakMap<CANNON.Body, number>();
const ragdollIgnores = new WeakMap<CANNON.Body, Set<number>>();

export const registerRagdollBody = (body: CANNON.Body, instanceId: number, ignores: Set<number>): void => {
  ragdollInstance.set(body, instanceId);
  ragdollIgnores.set(body, ignores);
};

export const physicsWorld = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.81, 0) });

(physicsWorld.solver as CANNON.GSSolver).iterations = 10;
physicsWorld.defaultContactMaterial.friction = 0.4;
physicsWorld.defaultContactMaterial.restitution = 0.05;
physicsWorld.allowSleep = true;

const groundBody = new CANNON.Body({
  mass: 0,
  type: CANNON.Body.STATIC,
  shape: new CANNON.Plane(),
  collisionFilterGroup: PHYSICS_GROUP_WORLD
});
groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
physicsWorld.addBody(groundBody);

WALL_COLLIDERS.forEach((wall) => {
  const halfX = (wall.maxX - wall.minX) / 2;
  const halfZ = (wall.maxZ - wall.minZ) / 2;
  const halfY = wall.topY / 2;
  const body = new CANNON.Body({
    mass: 0,
    type: CANNON.Body.STATIC,
    shape: new CANNON.Box(new CANNON.Vec3(halfX, halfY, halfZ)),
    collisionFilterGroup: PHYSICS_GROUP_WORLD
  });
  body.position.set((wall.minX + wall.maxX) / 2, halfY, (wall.minZ + wall.maxZ) / 2);
  physicsWorld.addBody(body);
});

// Per-pair ragdoll rules, layered on top of cannon's own group/mask check.
// Wrapped once at module load; every ragdoll in the game shares this world.
const baseNeedBroadphaseCollision = physicsWorld.broadphase.needBroadphaseCollision.bind(
  physicsWorld.broadphase
);
physicsWorld.broadphase.needBroadphaseCollision = (bodyA: CANNON.Body, bodyB: CANNON.Body): boolean => {
  if (!baseNeedBroadphaseCollision(bodyA, bodyB)) return false;
  const instanceA = ragdollInstance.get(bodyA);
  if (instanceA === undefined) return true;
  const instanceB = ragdollInstance.get(bodyB);
  if (instanceB === undefined) return true;
  // Two limbs. Same corpse only, and only if they are not a jointed pair.
  if (instanceA !== instanceB) return false;
  return !ragdollIgnores.get(bodyA)?.has(bodyB.id);
};

const FIXED_TIME_STEP = 1 / 60;
const MAX_SUB_STEPS = 5;

export const stepPhysicsWorld = (delta: number) => {
  physicsWorld.step(FIXED_TIME_STEP, Math.min(delta, 0.1), MAX_SUB_STEPS);
};

// Crates are destructible/respawning, so unlike the permanent ground/walls
// their static bodies have to be kept in sync with React state: removed
// when a crate is destroyed, (re)added at the new spot when it respawns.
const crateBodies = new Map<string, CANNON.Body>();

export const syncCratePhysicsBodies = (crates: CrateDef[]) => {
  const currentIds = new Set(crates.map((c) => c.id));

  crateBodies.forEach((body, id) => {
    if (!currentIds.has(id)) {
      physicsWorld.removeBody(body);
      crateBodies.delete(id);
    }
  });

  crates.forEach((crate) => {
    if (crateBodies.has(crate.id)) return;
    const half = crate.size / 2;
    const body = new CANNON.Body({
      mass: 0,
      type: CANNON.Body.STATIC,
      shape: new CANNON.Box(new CANNON.Vec3(half, half, half)),
      collisionFilterGroup: PHYSICS_GROUP_WORLD
    });
    body.position.set(crate.position[0], crate.position[1] + half, crate.position[2]);
    physicsWorld.addBody(body);
    crateBodies.set(crate.id, body);
  });
};
