import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { CivilianState, EnemyState, HelperState, MINE_TRIGGER_RADIUS, MineState } from '../world/gameState';

interface MinesProps {
  mines: MineState[];
  playerRef: React.RefObject<THREE.Group>;
  helpers: HelperState[];
  civilians: CivilianState[];
  enemies: EnemyState[];
  isPaused: boolean;
  // victim: 'player' | helper id | civilian id | enemy id (kind-discriminated).
  // `now` is clock.elapsedTime (seconds) - the status-effect timebase.
  onTriggered: (
    mineId: string,
    victim: { kind: 'player' } | { kind: 'helper'; id: string } | { kind: 'civilian'; id: string } | { kind: 'enemy'; id: string },
    now: number
  ) => void;
}

// Trapper Man's mines: a barely-visible dark disc with a faint red pip.
// No fuse - they sit until someone (player, helper, civilian, or even a
// fellow ENEMY) steps on one, then GameCanvas applies the stun/knockback
// and removes it. Trappers themselves are immune to their own trade.
export const Mines: React.FC<MinesProps> = ({ mines, playerRef, helpers, civilians, enemies, isPaused, onTriggered }) => {
  const firedRef = useRef<Set<string>>(new Set());

  useFrame((frameState) => {
    if (isPaused) return;
    const now = frameState.clock.elapsedTime;
    if (firedRef.current.size > 0) {
      const live = new Set(mines.map((m) => m.id));
      firedRef.current.forEach((id) => {
        if (!live.has(id)) firedRef.current.delete(id);
      });
    }
    mines.forEach((mine) => {
      if (firedRef.current.has(mine.id)) return;
      const near = (x: number, z: number) => Math.hypot(x - mine.position.x, z - mine.position.z) < MINE_TRIGGER_RADIUS;
      if (playerRef.current && near(playerRef.current.position.x, playerRef.current.position.z)) {
        firedRef.current.add(mine.id);
        onTriggered(mine.id, { kind: 'player' }, now);
        return;
      }
      const helper = helpers.find((h) => h.health > 0 && near(h.position.x, h.position.z));
      if (helper) {
        firedRef.current.add(mine.id);
        onTriggered(mine.id, { kind: 'helper', id: helper.id }, now);
        return;
      }
      const civilian = civilians.find((c) => c.health > 0 && near(c.position.x, c.position.z));
      if (civilian) {
        firedRef.current.add(mine.id);
        onTriggered(mine.id, { kind: 'civilian', id: civilian.id }, now);
        return;
      }
      // Enemies trip mines too - except trappers, who know where they buried them.
      const enemy = enemies.find((e) => e.health > 0 && e.type !== 'trapperMan' && near(e.position.x, e.position.z));
      if (enemy) {
        firedRef.current.add(mine.id);
        onTriggered(mine.id, { kind: 'enemy', id: enemy.id }, now);
      }
    });
  });

  return (
    <>
      {mines.map((mine) => (
        <group key={mine.id} position={mine.position}>
          {/* Near-invisible: a dark low disc + tiny dim red pip. */}
          <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.22, 16]} />
            <meshStandardMaterial color="#1a1a1a" transparent opacity={0.35} roughness={1} />
          </mesh>
          <mesh position={[0, 0.05, 0]}>
            <sphereGeometry args={[0.035, 8, 6]} />
            <meshStandardMaterial color="#ff1744" emissive="#ff1744" emissiveIntensity={0.5} transparent opacity={0.55} />
          </mesh>
        </group>
      ))}
    </>
  );
};
