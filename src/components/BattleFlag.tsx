import React from 'react';

interface BattleFlagProps {
  position: [number, number, number];
  isGiant?: boolean;
  // Sandbox clear flag: translucent red, always summons a Clear special.
  isClearFlag?: boolean;
}

export const BattleFlag: React.FC<BattleFlagProps> = ({ position, isGiant = false, isClearFlag = false }) => {
  const scale = isGiant ? 1.6 : 1;
  const clothColor = isGiant ? '#ffca28' : '#d32f2f';
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 1, 0]} castShadow>
        <cylinderGeometry args={[0.04, 0.04, 2, 8]} />
        <meshStandardMaterial
          color={isGiant ? '#7b1fa2' : '#8d8d8d'}
          roughness={0.6}
          metalness={0.3}
          transparent={isClearFlag}
          opacity={isClearFlag ? 0.45 : 1}
        />
      </mesh>
      <mesh position={[0.32, 1.75, 0]} castShadow={!isClearFlag}>
        <boxGeometry args={[0.6, 0.4, 0.04]} />
        <meshStandardMaterial
          color={clothColor}
          roughness={0.7}
          emissive={clothColor}
          emissiveIntensity={isGiant ? 0.5 : isClearFlag ? 0.4 : 0.25}
          transparent={isClearFlag}
          opacity={isClearFlag ? 0.4 : 1}
        />
      </mesh>
    </group>
  );
};
