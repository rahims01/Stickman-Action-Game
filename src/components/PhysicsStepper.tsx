import React from 'react';
import { useFrame } from '@react-three/fiber';
import { stepPhysicsWorld } from '../world/physicsWorld';

// Steps the shared cannon-es world exactly once per frame. Must be mounted
// before any ragdoll-driven components so they read this frame's updated
// body transforms, not last frame's (relies on React mount/subscription
// order - render this first under <Canvas>).
export const PhysicsStepper: React.FC = () => {
  useFrame((_, delta) => {
    stepPhysicsWorld(delta);
  });
  return null;
};
