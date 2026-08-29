import { asset } from '../world/assetPath';
import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useFBX, Html } from '@react-three/drei';
import * as THREE from 'three';
import { SkeletonUtils } from 'three-stdlib';
import { createRagdoll, RagdollHandle } from '../world/ragdoll';
import { physicsWorld } from '../world/physicsWorld';
import { CORPSE_SINK_DURATION, PLAYER_CORPSE_SINK_DELAY } from '../world/gameState';

interface PlayerCorpseProps {
  position: THREE.Vector3;
  rotationY: number;
  tint: string;
  forceSinkNow?: boolean;
  onSunk: () => void;
}

const SINK_DEPTH = 2.2;

// A marker left behind on player death. The old approach activated the
// ragdoll inside useFrame on the first rendered tick, but useFrame is
// registered immediately on mount while the ragdoll-creation useEffect
// runs AFTER the first commit — so activate() silently no-oped (null ref)
// nearly every time, leaving a static frozen corpse. The fix: group
// positioning, ragdoll creation, and activate() all happen in one
// synchronous useEffect body so there is no possible race.
export const PlayerCorpse: React.FC<PlayerCorpseProps> = ({ position, rotationY, tint, forceSinkNow, onSunk }) => {
  const groupRef = useRef<THREE.Group>(null);
  const ragdollRef = useRef<RagdollHandle | null>(null);
  const deadTimeRef = useRef(0);
  const baseYRef = useRef(0);
  const sunkNotifiedRef = useRef(false);

  const baseFbx = useFBX(asset('/anims/stickman_base.fbx'));
  const model = useMemo(() => SkeletonUtils.clone(baseFbx) as THREE.Group, [baseFbx]);

  useEffect(() => {
    model.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        const cloned = materials.map((mat) => (mat as THREE.MeshStandardMaterial).clone());
        mesh.material = Array.isArray(mesh.material) ? cloned : cloned[0];
        cloned.forEach((mat) => {
          if (mat && 'color' in mat) mat.color.set(tint);
        });
        mesh.castShadow = true;
      }
    });
  }, [model, tint]);

  // The ragdoll creation and immediate activation happen in a single
  // synchronous effect body. By the time any useEffect runs, the React
  // commit is complete and groupRef.current is already set, so we can
  // position the group, sync the matrix world, then activate — the ragdoll
  // will read the exact death-pose bone positions on the first frame.
  useEffect(() => {
    if (!groupRef.current) return;
    groupRef.current.position.copy(position);
    groupRef.current.rotation.y = rotationY;
    groupRef.current.updateMatrixWorld(true);
    baseYRef.current = groupRef.current.position.y;

    const ragdoll = createRagdoll(model, physicsWorld);
    ragdoll.activate();
    ragdollRef.current = ragdoll;

    return () => {
      ragdollRef.current?.dispose();
      ragdollRef.current = null;
    };
  }, [model]);

  useFrame((_, delta) => {
    if (!groupRef.current || !ragdollRef.current) return;

    ragdollRef.current.update();

    const actualDelta = Math.min(delta, 0.1);
    deadTimeRef.current += actualDelta;
    if (forceSinkNow) deadTimeRef.current = Math.max(deadTimeRef.current, PLAYER_CORPSE_SINK_DELAY);

    if (deadTimeRef.current > PLAYER_CORPSE_SINK_DELAY) {
      const sinkProgress = Math.min(1, (deadTimeRef.current - PLAYER_CORPSE_SINK_DELAY) / CORPSE_SINK_DURATION);
      groupRef.current.position.y = baseYRef.current - SINK_DEPTH * sinkProgress;
      if (sinkProgress >= 1 && !sunkNotifiedRef.current) {
        sunkNotifiedRef.current = true;
        groupRef.current.visible = false;
        ragdollRef.current.dispose();
        onSunk();
      }
    }
  });

  return (
    <group ref={groupRef}>
      <primitive object={model} scale={0.012} />
      <Html position={[0, 1.7, 0]} center distanceFactor={10} style={{ pointerEvents: 'none' }}>
        <div
          style={{
            color: '#ffffff',
            background: 'rgba(0,0,0,0.6)',
            padding: '2px 8px',
            borderRadius: '4px',
            fontSize: '12px',
            fontWeight: 'bold',
            whiteSpace: 'nowrap'
          }}
        >
          YOU
        </div>
      </Html>
    </group>
  );
};
