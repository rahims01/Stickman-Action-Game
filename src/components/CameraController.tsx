import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { ViewMode } from '../types/game.types';

interface CameraControllerProps {
  playerRef: React.RefObject<THREE.Group>;
  chestPositionRef: React.RefObject<THREE.Vector3>;
  headPositionRef: React.RefObject<THREE.Vector3>;
  viewMode: ViewMode;
  // Settings slider: scales the third-person offset (1 = the classic view).
  distanceFactor?: number;
}

// Fixed world-space offset: the third-person camera holds this compass
// direction at all times and never swings around to "face" the player.
const THIRD_PERSON_OFFSET = new THREE.Vector3(0, 5.2, 4.4);

export const CameraController: React.FC<CameraControllerProps> = ({ playerRef, chestPositionRef, headPositionRef, viewMode, distanceFactor = 1 }) => {
  const currentPosition = useRef(new THREE.Vector3(0, 5, 5));
  const currentLookAt = useRef(new THREE.Vector3(0, 1.3, 0));

  useFrame((state, delta) => {
    if (!playerRef.current || !chestPositionRef.current) return;

    const chest = chestPositionRef.current;
    const rotationY = playerRef.current.rotation.y;

    if (viewMode === 'third') {
      const targetCameraPos = chest.clone().addScaledVector(THIRD_PERSON_OFFSET, distanceFactor);

      const followAlpha = 1 - Math.exp(-6 * delta);
      currentPosition.current.lerp(targetCameraPos, followAlpha);
      currentLookAt.current.lerp(chest, followAlpha);

      state.camera.position.copy(currentPosition.current);
      state.camera.lookAt(currentLookAt.current);
    } else {
      const head = headPositionRef.current ?? chest;
      const forward = new THREE.Vector3(Math.sin(rotationY), 0, Math.cos(rotationY));
      const eyePosition = head.clone().addScaledVector(forward, 0.18);

      // Rigidly locked to the head bone every frame - no smoothing lag,
      // so the camera moves and bobs exactly with the head animation.
      currentPosition.current.copy(eyePosition);
      const lookTarget = currentPosition.current.clone().add(forward);
      currentLookAt.current.copy(lookTarget);

      state.camera.position.copy(currentPosition.current);
      state.camera.lookAt(lookTarget);
    }
  });

  return null;
};
