import { asset } from '../world/assetPath';
import React, { useMemo } from 'react';
import * as THREE from 'three';
import { MaterialKey, getMaterialTexture } from '../world/proceduralTextures';
import { useTexture } from '@react-three/drei';
import {
  ARENA_CONCRETE_HALF_X,
  ARENA_CONCRETE_HALF_Z,
  ARENA_MAGMA_RADIUS,
  ARENA_SAND_RADIUS,
  ARENA_SAND_WALL_SEGMENTS,
  ARENA_WALL_HEIGHT
} from '../world/gameState';

export type ArenaPhase = 'concrete' | 'box' | 'falling' | 'sand' | 'magma';

interface ArenaEnvironmentProps {
  phase: ArenaPhase;
  boxHalf: number;
  // Set once the arena starts drawing rooms. Overrides the floor and wall
  // colours and swaps in that room material, so a circle-shaped room is
  // not always the sand pit.
  room?: { ground: string; wall: string; material: MaterialKey } | null;
}

// Procedural magma floor: dark rock crazed with glowing orange cracks.
const createMagmaTexture = (): THREE.CanvasTexture => {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#1c1210';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 26; i++) {
    ctx.strokeStyle = ['#ff6d00', '#ff9100', '#dd2c00'][i % 3];
    ctx.lineWidth = 1.5 + Math.random() * 2.5;
    ctx.globalAlpha = 0.5 + Math.random() * 0.5;
    ctx.beginPath();
    let x = Math.random() * size;
    let y = Math.random() * size;
    ctx.moveTo(x, y);
    for (let s = 0; s < 5; s++) {
      x += (Math.random() - 0.5) * 90;
      y += (Math.random() - 0.5) * 90;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(10, 10);
  texture.anisotropy = 8;
  return texture;
};

// Concrete for the beginner room: flat grey with light speckle.
const createConcreteTexture = (): THREE.CanvasTexture => {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#9a9a98';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 500; i++) {
    ctx.fillStyle = Math.random() < 0.5 ? 'rgba(70,70,68,0.25)' : 'rgba(210,210,205,0.25)';
    ctx.fillRect(Math.random() * size, Math.random() * size, 1.6, 1.6);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(6, 6);
  return texture;
};

// Ring wall segments for a regular N-gon with CORNERS at the given
// circumradius: each wall runs between adjacent corners, so its center sits
// at the apothem (radius x cos) and its width is the true edge length. This
// keeps the visual walls exactly on the collider line for any segment count
// (pentagon included).
const buildRingSegments = (segments: number, radius: number) => {
  const segAngle = (Math.PI * 2) / segments;
  const segWidth = 2 * radius * Math.sin(segAngle / 2) + 0.6;
  const apothem = radius * Math.cos(segAngle / 2);
  return Array.from({ length: segments }, (_, i) => {
    const angle = i * segAngle + segAngle / 2;
    return {
      x: Math.cos(angle) * apothem,
      z: Math.sin(angle) * apothem,
      rotY: -angle + Math.PI / 2,
      width: segWidth
    };
  });
};

// Arena mode's stage across its four phases: a small concrete starter room,
// the growing brick/wood box, the circular sand pit after the floor drops,
// and finally the pentagon magma wasteland.
export const ArenaEnvironment: React.FC<ArenaEnvironmentProps> = ({ phase, boxHalf, room }) => {
  const [brickTex, woodTex, sandTex] = useTexture([asset('/textures/brick.jpg'), asset('/textures/wood.jpg'), asset('/textures/sand.jpg')]);
  const magmaTex = useMemo(createMagmaTexture, []);
  const concreteTex = useMemo(createConcreteTexture, []);

  const textures = useMemo(() => {
    [brickTex, woodTex, sandTex].forEach((t) => {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.anisotropy = 8;
    });
    return { brickTex, woodTex, sandTex };
  }, [brickTex, woodTex, sandTex]);

  const sandWallSegments = useMemo(() => buildRingSegments(ARENA_SAND_WALL_SEGMENTS, ARENA_SAND_RADIUS), []);
  const magmaWallSegments = useMemo(() => buildRingSegments(5, ARENA_MAGMA_RADIUS), []);

  // Drawn rooms take over the visuals entirely: the phase now only decides the
  // SHAPE (rect / circle / pentagon), while the material and colours come from
  // the room. Without this a circular room would always look like the sand pit.
  if (room) {
    const tex = getMaterialTexture(room.material);
    const segments = phase === 'magma' ? magmaWallSegments : sandWallSegments;
    const floorRadius = phase === 'magma' ? ARENA_MAGMA_RADIUS + 4 : ARENA_SAND_RADIUS + 1;
    const floorSides = phase === 'magma' ? 5 : 64;

    if (phase === 'concrete') {
      return (
        <group>
          <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <planeGeometry args={[ARENA_CONCRETE_HALF_X * 2, ARENA_CONCRETE_HALF_Z * 2]} />
            <meshStandardMaterial map={tex} map-repeat={[10, 10]} color={room.ground} roughness={0.95} />
          </mesh>
          {([
            [0, -ARENA_CONCRETE_HALF_Z, ARENA_CONCRETE_HALF_X * 2, 0],
            [0, ARENA_CONCRETE_HALF_Z, ARENA_CONCRETE_HALF_X * 2, 0],
            [-ARENA_CONCRETE_HALF_X, 0, ARENA_CONCRETE_HALF_Z * 2, Math.PI / 2],
            [ARENA_CONCRETE_HALF_X, 0, ARENA_CONCRETE_HALF_Z * 2, Math.PI / 2]
          ] as [number, number, number, number][]).map(([x, z, w, r], i) => (
            <mesh key={i} position={[x, ARENA_WALL_HEIGHT / 2, z]} rotation={[0, r, 0]} castShadow receiveShadow>
              <boxGeometry args={[w, ARENA_WALL_HEIGHT, 1]} />
              <meshStandardMaterial map={tex} map-repeat={[Math.round(w / 3), 2]} color={room.wall} roughness={0.95} />
            </mesh>
          ))}
        </group>
      );
    }

    return (
      <group>
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <circleGeometry args={[floorRadius, floorSides]} />
          <meshStandardMaterial map={tex} map-repeat={[12, 12]} color={room.ground} roughness={0.95} />
        </mesh>
        {segments.map((s, i) => (
          <mesh key={i} position={[s.x, ARENA_WALL_HEIGHT / 2 + 0.4, s.z]} rotation={[0, s.rotY, 0]} castShadow receiveShadow>
            <boxGeometry args={[s.width, ARENA_WALL_HEIGHT + 0.8, 1]} />
            <meshStandardMaterial map={tex} map-repeat={[Math.max(1, Math.round(s.width / 3)), 2]} color={room.wall} roughness={0.95} />
          </mesh>
        ))}
      </group>
    );
  }

  if (phase === 'magma') {
    return (
      <group>
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <circleGeometry args={[ARENA_MAGMA_RADIUS + 4, 5]} />
          <meshStandardMaterial map={magmaTex} emissive="#ff3d00" emissiveIntensity={0.22} emissiveMap={magmaTex} roughness={0.9} />
        </mesh>
        {magmaWallSegments.map((s, i) => (
          <mesh key={i} position={[s.x, ARENA_WALL_HEIGHT / 2 + 0.6, s.z]} rotation={[0, s.rotY, 0]} castShadow receiveShadow>
            <boxGeometry args={[s.width, ARENA_WALL_HEIGHT + 1.2, 1.2]} />
            {/* Charred brick: the brick texture crushed toward black. */}
            <meshStandardMaterial map={textures.brickTex} map-repeat={[Math.max(2, Math.round(s.width / 3)), 2]} color="#3a2a24" roughness={0.95} />
          </mesh>
        ))}
        <pointLight position={[0, 6, 0]} color="#ff6d00" intensity={1.2} distance={60} />
      </group>
    );
  }

  if (phase === 'sand') {
    return (
      <group>
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <circleGeometry args={[ARENA_SAND_RADIUS + 1, 64]} />
          <meshStandardMaterial map={textures.sandTex} map-repeat={[14, 14]} color="#e8d3a4" roughness={1} metalness={0} />
        </mesh>
        {sandWallSegments.map((s, i) => (
          <mesh key={i} position={[s.x, ARENA_WALL_HEIGHT / 2 + 0.4, s.z]} rotation={[0, s.rotY, 0]} castShadow receiveShadow>
            <boxGeometry args={[s.width, ARENA_WALL_HEIGHT + 0.8, 1]} />
            <meshStandardMaterial map={textures.brickTex} map-repeat={[Math.max(1, Math.round(s.width / 3)), 2]} color="#d8b98e" roughness={0.9} />
          </mesh>
        ))}
      </group>
    );
  }

  if (phase === 'concrete') {
    const wallLenX = ARENA_CONCRETE_HALF_X * 2 + 1;
    const wallLenZ = ARENA_CONCRETE_HALF_Z * 2 + 1;
    return (
      <group>
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[ARENA_CONCRETE_HALF_X * 2, ARENA_CONCRETE_HALF_Z * 2]} />
          <meshStandardMaterial map={concreteTex} roughness={0.95} />
        </mesh>
        {([
          [0, -ARENA_CONCRETE_HALF_Z, 0, wallLenX],
          [0, ARENA_CONCRETE_HALF_Z, 0, wallLenX],
          [-ARENA_CONCRETE_HALF_X, 0, Math.PI / 2, wallLenZ],
          [ARENA_CONCRETE_HALF_X, 0, Math.PI / 2, wallLenZ]
        ] as [number, number, number, number][]).map(([x, z, rotY, len], i) => (
          <mesh key={i} position={[x, ARENA_WALL_HEIGHT / 2, z]} rotation={[0, rotY, 0]} castShadow receiveShadow>
            <boxGeometry args={[len, ARENA_WALL_HEIGHT, 0.5]} />
            <meshStandardMaterial color="#e8e6e1" roughness={0.9} />
          </mesh>
        ))}
      </group>
    );
  }

  const wallLen = boxHalf * 2 + 1;
  const wallRepeatX = Math.max(2, Math.round(wallLen / 3));
  return (
    <group>
      {/* Wooden floor - hidden during the fall ("the ground gives way"). */}
      {phase === 'box' && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[boxHalf * 2, boxHalf * 2]} />
          <meshStandardMaterial map={textures.woodTex} map-repeat={[Math.max(2, Math.round(boxHalf / 2)), Math.max(2, Math.round(boxHalf / 2))]} roughness={0.85} metalness={0} />
        </mesh>
      )}
      {/* Four brick walls */}
      {([
        [0, -boxHalf, 0],
        [0, boxHalf, 0],
        [-boxHalf, 0, Math.PI / 2],
        [boxHalf, 0, Math.PI / 2]
      ] as [number, number, number][]).map(([x, z, rotY], i) => (
        <mesh key={i} position={[x, ARENA_WALL_HEIGHT / 2, z]} rotation={[0, rotY, 0]} castShadow receiveShadow>
          <boxGeometry args={[wallLen, ARENA_WALL_HEIGHT, 0.6]} />
          <meshStandardMaterial map={textures.brickTex} map-repeat={[wallRepeatX, 2]} roughness={0.92} />
        </mesh>
      ))}
    </group>
  );
};
