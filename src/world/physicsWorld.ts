import * as CANNON from 'cannon-es';
import { CrateDef, WALL_COLLIDERS } from './worldObjects';

export const physicsWorld = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.81, 0) });

(physicsWorld.solver as CANNON.GSSolver).iterations = 10;
physicsWorld.defaultContactMaterial.friction = 0.4;
physicsWorld.defaultContactMaterial.restitution = 0.05;
physicsWorld.allowSleep = true;

const groundBody = new CANNON.Body({ mass: 0, type: CANNON.Body.STATIC, shape: new CANNON.Plane() });
groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
physicsWorld.addBody(groundBody);

WALL_COLLIDERS.forEach((wall) => {
  const halfX = (wall.maxX - wall.minX) / 2;
  const halfZ = (wall.maxZ - wall.minZ) / 2;
  const halfY = wall.topY / 2;
  const body = new CANNON.Body({
    mass: 0,
    type: CANNON.Body.STATIC,
    shape: new CANNON.Box(new CANNON.Vec3(halfX, halfY, halfZ))
  });
  body.position.set((wall.minX + wall.maxX) / 2, halfY, (wall.minZ + wall.maxZ) / 2);
  physicsWorld.addBody(body);
});

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
      shape: new CANNON.Box(new CANNON.Vec3(half, half, half))
    });
    body.position.set(crate.position[0], crate.position[1] + half, crate.position[2]);
    physicsWorld.addBody(body);
    crateBodies.set(crate.id, body);
  });
};
