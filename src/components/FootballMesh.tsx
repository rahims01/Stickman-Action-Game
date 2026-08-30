import React, { useMemo } from 'react';
import * as THREE from 'three';

interface FootballMeshProps {
  radius: number;
}

/**
 * A procedural size-5 football, built to Ultimate Soccer's spec rather than
 * from their model — theirs reads as a marketplace asset, so the same rule
 * that kept our stickman from moving applies to it in reverse.
 *
 * The classic 32-panel ball is a truncated icosahedron: 12 black pentagons
 * and 20 white hexagons. The pentagons sit exactly at the 12 vertices of an
 * icosahedron, which is what makes this cheap — place a pentagon facing
 * outward at each vertex direction and the pattern is correct by
 * construction, no texture or custom geometry needed.
 *
 * Their spec also gives radius 0.11 m (true size-5), roughness ~0.45,
 * metalness ~0.05. We keep the material values and deliberately render at a
 * larger radius: a true-scale ball on a 30 m pitch seen from the broadcast
 * camera is a handful of pixels, and readability beats realism here.
 */
export const FootballMesh: React.FC<FootballMeshProps> = ({ radius }) => {
  const pentagons = useMemo(() => {
    // Icosahedron vertices: (0, ±1, ±φ) and its two cyclic permutations.
    const phi = (1 + Math.sqrt(5)) / 2;
    const raw: [number, number, number][] = [];
    for (const s1 of [1, -1]) {
      for (const s2 of [1, -1]) {
        raw.push([0, s1, s2 * phi]);
        raw.push([s1, s2 * phi, 0]);
        raw.push([s2 * phi, 0, s1]);
      }
    }

    const up = new THREE.Vector3(0, 0, 1);
    return raw.map((v) => {
      const dir = new THREE.Vector3(...v).normalize();
      // A CircleGeometry faces +Z, so rotate that onto the outward normal.
      const quat = new THREE.Quaternion().setFromUnitVectors(up, dir);
      const euler = new THREE.Euler().setFromQuaternion(quat);
      return {
        position: dir.clone().multiplyScalar(radius * 0.995).toArray() as [number, number, number],
        rotation: [euler.x, euler.y, euler.z] as [number, number, number]
      };
    });
  }, [radius]);

  return (
    <group>
      <mesh castShadow>
        <sphereGeometry args={[radius, 24, 24]} />
        <meshStandardMaterial color="#f4f4f2" roughness={0.45} metalness={0.05} />
      </mesh>
      {pentagons.map((p, i) => (
        <mesh key={i} position={p.position} rotation={p.rotation}>
          {/* 5 segments = a pentagon; rotated a half-step so a flat edge sits
              level rather than a vertex pointing at the pole. */}
          <circleGeometry args={[radius * 0.36, 5]} />
          <meshStandardMaterial color="#17181a" roughness={0.5} metalness={0.05} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  );
};
