import React from 'react';
import { CrateDef, INITIAL_PLATFORM_DEFS, INITIAL_WALL_DEFS } from '../world/worldObjects';

interface WorldObjectsProps {
  crates: CrateDef[];
  // Arena mode: skip the procedural map's static walls/platforms entirely.
  hideStatic?: boolean;
}

export const WorldObjects: React.FC<WorldObjectsProps> = ({ crates, hideStatic = false }) => {
  return (
    <group>
      {crates.map((crate) => (
        <mesh
          key={crate.id}
          position={[crate.position[0], crate.position[1] + crate.size / 2, crate.position[2]]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[crate.size, crate.size, crate.size]} />
          <meshStandardMaterial color={crate.color ?? '#8a6d3b'} roughness={0.8} metalness={0.1} />
        </mesh>
      ))}

      {!hideStatic && INITIAL_WALL_DEFS.map((wall) => (
        <mesh
          key={wall.id}
          position={[wall.position[0], wall.position[1] + wall.height / 2, wall.position[2]]}
          rotation={[0, wall.rotationY, 0]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[wall.width, wall.height, 0.4]} />
          <meshStandardMaterial color={wall.color ?? '#5a5f66'} roughness={0.9} metalness={0.05} />
        </mesh>
      ))}

      {!hideStatic && INITIAL_PLATFORM_DEFS.map((p) => (
        <mesh
          key={p.id}
          position={[p.position[0], p.height / 2, p.position[2]]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[p.width, p.height, p.depth]} />
          <meshStandardMaterial color={p.color ?? '#4a4f55'} roughness={0.85} metalness={0.1} />
        </mesh>
      ))}
    </group>
  );
};
