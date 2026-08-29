import { asset } from '../world/assetPath';
import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html, useFBX } from '@react-three/drei';
import * as THREE from 'three';
import { SkeletonUtils } from 'three-stdlib';
import { createRagdoll, RagdollHandle } from '../world/ragdoll';
import { physicsWorld } from '../world/physicsWorld';
import { CORPSE_SINK_DELAY, CORPSE_SINK_DURATION, DUMMY_MAX_HEALTH } from '../world/gameState';

interface DummyActorProps {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  health: number;
  onSunk: () => void;
  isPaused: boolean;
  forceSinkNow?: boolean;
  showHealthBar?: boolean;
}

type DummyAnimState = 'idle' | 'hit' | 'dead';

const ROOT_BONE_NAME = 'mixamorigHips';

const stripRootMotion = (clip: THREE.AnimationClip) => {
  const track = clip.tracks.find((t) => t.name === `${ROOT_BONE_NAME}.position`) as THREE.VectorKeyframeTrack | undefined;
  if (!track) return;
  const values = track.values;
  const baseX = values[0];
  const baseZ = values[2];
  for (let i = 0; i < values.length; i += 3) {
    values[i] = baseX;
    values[i + 2] = baseZ;
  }
};

const SINK_DEPTH = 2.2;
const SAND_COLOR = '#c2b280';

export const DummyActor: React.FC<DummyActorProps> = ({ position, velocity, health, onSunk, isPaused, forceSinkNow, showHealthBar = true }) => {
  const groupRef = useRef<THREE.Group>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const actionsRef = useRef<{ idle?: THREE.AnimationAction; hit?: THREE.AnimationAction }>({});
  // A small variety pool for the hit flinch - one is picked at random each
  // time instead of always playing the exact same clip.
  const hitActionsRef = useRef<THREE.AnimationAction[]>([]);
  const activeHitActionRef = useRef<THREE.AnimationAction | null>(null);
  const stateRef = useRef<DummyAnimState>('idle');
  const oneShotTimerRef = useRef<number | null>(null);
  const prevHealthRef = useRef(health);
  const frozenRef = useRef(false);
  const deadTimeRef = useRef(0);
  const sunkNotifiedRef = useRef(false);
  const frozenBaseYRef = useRef(0);
  const materialsRef = useRef<THREE.MeshStandardMaterial[]>([]);
  const ragdollRef = useRef<RagdollHandle | null>(null);

  const baseFbx = useFBX(asset('/anims/stickman_base.fbx'));
  const idleAnim = useFBX(asset('/anims/fighting-idle.fbx'));
  const hitAnim = useFBX(asset('/anims/hit-to-body.fbx'));
  const kidneyHitAnim = useFBX(asset('/anims/kidney-hit.fbx'));
  const stomachHitAnim = useFBX(asset('/anims/stomach-hit.fbx'));

  const model = useMemo(() => SkeletonUtils.clone(baseFbx) as THREE.Group, [baseFbx]);

  useEffect(() => {
    ragdollRef.current = createRagdoll(model, physicsWorld);
    return () => {
      ragdollRef.current?.dispose();
      ragdollRef.current = null;
    };
  }, [model]);

  useEffect(() => {
    const materials: THREE.MeshStandardMaterial[] = [];
    model.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const sourceMaterials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        const cloned = sourceMaterials.map((mat) => (mat as THREE.MeshStandardMaterial).clone());
        mesh.material = Array.isArray(mesh.material) ? cloned : cloned[0];
        cloned.forEach((mat) => {
          if (mat && 'color' in mat) {
            mat.color.set(SAND_COLOR);
            materials.push(mat);
          }
        });
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });
    materialsRef.current = materials;
  }, [model]);

  useEffect(() => {
    const mixer = new THREE.AnimationMixer(model);
    mixerRef.current = mixer;

    const idleClip = idleAnim.animations[0];
    const hitClips = [hitAnim, kidneyHitAnim, stomachHitAnim].map((a) => a.animations[0]).filter((c): c is THREE.AnimationClip => !!c);
    [idleClip, ...hitClips].forEach((clip) => clip && stripRootMotion(clip));

    if (idleClip) actionsRef.current.idle = mixer.clipAction(idleClip);
    hitActionsRef.current = hitClips.map((clip) => {
      const action = mixer.clipAction(clip);
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
      return action;
    });

    actionsRef.current.idle?.play();

    return () => {
      mixer.stopAllAction();
    };
  }, [model, idleAnim, hitAnim, kidneyHitAnim, stomachHitAnim]);

  useFrame((_, delta) => {
    if (isPaused) return;
    const actualDelta = Math.min(delta, 0.1);
    if (!groupRef.current) return;

    if (frozenRef.current) {
      // Any push the player has queued against the corpse is applied as a
      // real impulse to the hips body, then consumed.
      if (velocity.lengthSq() > 0.0001) {
        ragdollRef.current?.applyImpulseToHips(velocity);
        velocity.set(0, 0, 0);
      }

      ragdollRef.current?.update();

      deadTimeRef.current += actualDelta;
      if (forceSinkNow) deadTimeRef.current = Math.max(deadTimeRef.current, CORPSE_SINK_DELAY);
      if (deadTimeRef.current > CORPSE_SINK_DELAY) {
        const sinkProgress = Math.min(1, (deadTimeRef.current - CORPSE_SINK_DELAY) / CORPSE_SINK_DURATION);
        groupRef.current.position.y = frozenBaseYRef.current - SINK_DEPTH * sinkProgress;
        if (sinkProgress >= 1) {
          groupRef.current.visible = false;
          if (!sunkNotifiedRef.current) {
            sunkNotifiedRef.current = true;
            ragdollRef.current?.dispose();
            onSunk();
          }
        }
      }

      // Keep the externally-shared position in sync with the ragdoll's
      // actual current location, so the player's "push the corpse" contact
      // check (in Player.tsx) keeps working as it tumbles around.
      ragdollRef.current?.getHipsWorldPosition(position);

      return;
    }

    mixerRef.current?.update(actualDelta);
    groupRef.current.position.copy(position);

    if (oneShotTimerRef.current !== null) {
      oneShotTimerRef.current -= actualDelta;
      if (oneShotTimerRef.current <= 0) {
        oneShotTimerRef.current = null;
        if (stateRef.current === 'hit') {
          stateRef.current = 'idle';
          activeHitActionRef.current?.fadeOut(0.15);
          activeHitActionRef.current = null;
          actionsRef.current.idle?.reset().fadeIn(0.15).play();
        }
      }
      return;
    }

    // Every kill skips hit/death animations entirely and ragdolls the
    // instant health reaches 0 - no clip, no wait.
    if (health <= 0 && stateRef.current !== 'dead') {
      stateRef.current = 'dead';
      materialsRef.current.forEach((mat) => mat.color.set('#0a0a0a'));
      actionsRef.current.idle?.fadeOut(0.1);
      activeHitActionRef.current?.fadeOut(0.1);
      frozenRef.current = true;
      frozenBaseYRef.current = groupRef.current.position.y;
      ragdollRef.current?.activate();
    } else if (health < prevHealthRef.current && stateRef.current === 'idle' && hitActionsRef.current.length > 0) {
      stateRef.current = 'hit';
      actionsRef.current.idle?.fadeOut(0.1);
      const action = hitActionsRef.current[Math.floor(Math.random() * hitActionsRef.current.length)];
      action.reset().fadeIn(0.1).play();
      activeHitActionRef.current = action;
      oneShotTimerRef.current = action.getClip().duration;
    }
    prevHealthRef.current = health;
  });

  const healthFraction = health / DUMMY_MAX_HEALTH;
  return (
    <group ref={groupRef}>
      <primitive object={model} scale={0.012} />
      {showHealthBar && health > 0 && (
        <Html position={[0, 2.05, 0]} center distanceFactor={12} style={{ pointerEvents: 'none' }}>
          <div
            style={{
              width: '52px',
              height: '7px',
              background: 'rgba(0,0,0,0.6)',
              border: '1px solid rgba(255,255,255,0.35)',
              borderRadius: '4px',
              overflow: 'hidden'
            }}
          >
            <div
              style={{
                width: `${Math.max(0, Math.min(100, healthFraction * 100))}%`,
                height: '100%',
                background: healthFraction > 0.5 ? 'linear-gradient(180deg,#9ccc65,#689f38)' : healthFraction > 0.25 ? 'linear-gradient(180deg,#ffd54f,#f9a825)' : 'linear-gradient(180deg,#ef5350,#c62828)',
                borderRadius: '3px'
              }}
            />
          </div>
        </Html>
      )}
    </group>
  );
};
