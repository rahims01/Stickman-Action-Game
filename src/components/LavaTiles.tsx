import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { LAVA_TILE_BURN_DURATION, LavaTileDef } from '../world/gameState';
import { StatusEffects, applyBurn } from '../world/statusEffects';

interface LavaTilesProps {
  tiles: LavaTileDef[];
  playerRef: React.RefObject<THREE.Group>;
  playerStatusEffectsRef: React.RefObject<StatusEffects>;
  isPaused: boolean;
}

// Magma Wasteland lava tiles: glowing molten patches on the arena floor.
// Standing on one sets the player burning; the burn is only re-applied once
// the previous application is nearly spent, because applyBurn resets the
// tick timer - refreshing it every frame would ironically prevent any
// damage tick from ever firing.
export const LavaTiles: React.FC<LavaTilesProps> = ({ tiles, playerRef, playerStatusEffectsRef, isPaused }) => {
  const materialsRef = useRef<Map<string, THREE.MeshStandardMaterial>>(new Map());

  useFrame((frameState) => {
    if (isPaused) return;
    const now = frameState.clock.elapsedTime;

    // Slow molten pulse so the patches read as live hazards.
    const pulse = 0.75 + Math.sin(now * 2.4) * 0.35;
    materialsRef.current.forEach((mat) => {
      mat.emissiveIntensity = pulse;
    });

    const player = playerRef.current;
    const effects = playerStatusEffectsRef.current;
    if (!player || !effects) return;
    const nowMs = Date.now();
    for (const tile of tiles) {
      if (tile.expiresAtMs && nowMs > tile.expiresAtMs) continue;
      const d = Math.hypot(player.position.x - tile.position[0], player.position.z - tile.position[1]);
      if (d < tile.radius && effects.burnUntil < now + 0.5) {
        applyBurn(effects, now, LAVA_TILE_BURN_DURATION, 1, '#ff5722');
        break;
      }
    }
  });

  const nowMs = Date.now();
  return (
    <>
      {tiles.map((tile) => {
        if (tile.expiresAtMs && nowMs > tile.expiresAtMs) return null;
        return (
          <group key={tile.id} position={[tile.position[0], 0, tile.position[1]]}>
            <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <circleGeometry args={[tile.radius, 24]} />
              <meshStandardMaterial
                ref={(mat) => {
                  if (mat) materialsRef.current.set(tile.id, mat as THREE.MeshStandardMaterial);
                  else materialsRef.current.delete(tile.id);
                }}
                color="#ff6d00"
                emissive="#ff3d00"
                emissiveIntensity={0.9}
                roughness={0.6}
                transparent
                opacity={0.9}
              />
            </mesh>
            {/* Hot core */}
            <mesh position={[0, 0.045, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <circleGeometry args={[tile.radius * 0.45, 18]} />
              <meshBasicMaterial color="#ffe082" transparent opacity={0.75} depthWrite={false} />
            </mesh>
          </group>
        );
      })}
    </>
  );
};
