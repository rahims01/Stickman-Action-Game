import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { DAY_NIGHT_CYCLE_DURATION, NIGHT_DAY_FACTOR_THRESHOLD } from '../world/gameState';

const ORBIT_RADIUS = 60;
const DAY_LIGHT_COLOR = new THREE.Color('#fff4d6');
const NIGHT_LIGHT_COLOR = new THREE.Color('#7fa8ff');
const DAY_SKY_COLOR = new THREE.Color('#8ec9f0');
const NIGHT_SKY_COLOR = new THREE.Color('#050816');
const DAY_AMBIENT = 1.1;
const NIGHT_AMBIENT = 0.18;
const DAY_SUN_INTENSITY = 2.2;
const NIGHT_SUN_INTENSITY = 0.35;

// The shadow camera is a box this many units around the PLAYER, not the
// world origin - the sun light (and its target) are re-anchored to the
// player every frame so shadows stay sharp and present across the whole
// 50-unit-radius map instead of only existing in a small box at spawn.
const SHADOW_HALF_EXTENT = 32;
const SUN_LIGHT_DISTANCE = 55;

// Depth fog matched to the sky color each frame, purely a look-polish cue -
// far enough out that it never hides actual gameplay around the player.
const FOG_NEAR = 55;
const FOG_FAR = 160;

interface SkyCycleProps {
  onNightChange?: (isNight: boolean) => void;
  isPaused: boolean;
  forcedTime?: 'day' | 'night' | null;
  playerRef?: React.RefObject<THREE.Group>;
}

export const SkyCycle: React.FC<SkyCycleProps> = ({ onNightChange, isPaused, forcedTime, playerRef }) => {
  const sunRef = useRef<THREE.Mesh>(null);
  const moonRef = useRef<THREE.Mesh>(null);
  const dirLightRef = useRef<THREE.DirectionalLight>(null);
  const ambientRef = useRef<THREE.AmbientLight>(null);
  const hemiRef = useRef<THREE.HemisphereLight>(null);
  const skyColor = useRef(new THREE.Color()).current;
  const isNightRef = useRef(false);
  // Accumulated via delta, not state.clock.elapsedTime - that clock keeps
  // ticking through a pause regardless, which would make the sun jump
  // forward to "catch up" the instant the game unpauses.
  const elapsedRef = useRef(0);
  const { scene } = useThree();

  // The directional light needs an explicit target object in the scene to
  // aim at the player - the default target is a detached Object3D at origin.
  const lightTarget = useMemo(() => new THREE.Object3D(), []);
  const fog = useMemo(() => new THREE.Fog('#8ec9f0', FOG_NEAR, FOG_FAR), []);

  useEffect(() => {
    scene.fog = fog;
    return () => {
      scene.fog = null;
    };
  }, [scene, fog]);

  useFrame((_, delta) => {
    if (isPaused) return;
    if (!forcedTime) elapsedRef.current += Math.min(delta, 0.1);
    const t = forcedTime === 'day' ? 0.25 : forcedTime === 'night' ? 0.75 : (elapsedRef.current % DAY_NIGHT_CYCLE_DURATION) / DAY_NIGHT_CYCLE_DURATION;
    const angle = t * Math.PI * 2;
    const sunHeight = Math.sin(angle);
    const sunX = Math.cos(angle) * ORBIT_RADIUS;
    const sunY = sunHeight * ORBIT_RADIUS;
    const sunZ = 20;

    if (sunRef.current) sunRef.current.position.set(sunX, sunY, sunZ);
    if (moonRef.current) moonRef.current.position.set(-sunX, -sunY, sunZ - 40);

    const dayFactor = THREE.MathUtils.clamp((sunHeight + 0.2) / 1.2, 0, 1);

    const isNight = dayFactor < NIGHT_DAY_FACTOR_THRESHOLD;
    if (isNight !== isNightRef.current) {
      isNightRef.current = isNight;
      onNightChange?.(isNight);
    }

    if (dirLightRef.current) {
      // Anchor the sun light (and its shadow camera) to the player so the
      // shadow box travels with them instead of staying parked at spawn.
      const anchor = playerRef?.current?.position;
      const ax = anchor?.x ?? 0;
      const az = anchor?.z ?? 0;
      const sunDir = new THREE.Vector3(sunX, Math.max(sunY, 8), sunZ).normalize();
      dirLightRef.current.position.set(ax + sunDir.x * SUN_LIGHT_DISTANCE, sunDir.y * SUN_LIGHT_DISTANCE, az + sunDir.z * SUN_LIGHT_DISTANCE);
      lightTarget.position.set(ax, 0, az);
      lightTarget.updateMatrixWorld();
      dirLightRef.current.intensity = THREE.MathUtils.lerp(NIGHT_SUN_INTENSITY, DAY_SUN_INTENSITY, dayFactor);
      dirLightRef.current.color.copy(NIGHT_LIGHT_COLOR).lerp(DAY_LIGHT_COLOR, dayFactor);
    }
    if (ambientRef.current) {
      ambientRef.current.intensity = THREE.MathUtils.lerp(NIGHT_AMBIENT, DAY_AMBIENT, dayFactor);
    }
    if (hemiRef.current) {
      hemiRef.current.intensity = THREE.MathUtils.lerp(0.15, 0.8, dayFactor);
    }

    skyColor.copy(NIGHT_SKY_COLOR).lerp(DAY_SKY_COLOR, dayFactor);
    scene.background = skyColor;
    fog.color.copy(skyColor);
  });

  return (
    <group>
      <ambientLight ref={ambientRef} intensity={DAY_AMBIENT} />
      <hemisphereLight ref={hemiRef} color="#bcd9ff" groundColor="#2e3a22" intensity={0.8} />
      <primitive object={lightTarget} />
      <directionalLight
        ref={dirLightRef}
        castShadow
        target={lightTarget}
        position={[10, 20, 10]}
        intensity={DAY_SUN_INTENSITY}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-SHADOW_HALF_EXTENT}
        shadow-camera-right={SHADOW_HALF_EXTENT}
        shadow-camera-top={SHADOW_HALF_EXTENT}
        shadow-camera-bottom={-SHADOW_HALF_EXTENT}
        shadow-camera-near={1}
        shadow-camera-far={140}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
      />
      <mesh ref={sunRef}>
        <sphereGeometry args={[3, 16, 16]} />
        <meshBasicMaterial color="#fff4c2" fog={false} />
      </mesh>
      <mesh ref={moonRef}>
        <sphereGeometry args={[2.2, 16, 16]} />
        <meshBasicMaterial color="#d7e6ff" fog={false} />
      </mesh>
    </group>
  );
};
