import { useEffect, useRef, useState } from 'react';
import { MovementInputs } from '../types/game.types';

export const useInputs = (): MovementInputs => {
  const [inputs, setInputs] = useState<MovementInputs>({
    forward: false,
    backward: false,
    left: false,
    right: false,
    run: false,
    jump: false,
    crouch: false,
    punch: false,
    kick: false,
    interact: false,
    parry: false
  });

  const crouchKeyHeld = useRef(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          setInputs((prev) => ({ ...prev, forward: true }));
          break;
        case 'KeyS':
        case 'ArrowDown':
          setInputs((prev) => ({ ...prev, backward: true }));
          break;
        case 'KeyA':
        case 'ArrowLeft':
          setInputs((prev) => ({ ...prev, left: true }));
          break;
        case 'KeyD':
        case 'ArrowRight':
          setInputs((prev) => ({ ...prev, right: true }));
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          setInputs((prev) => ({ ...prev, run: true }));
          break;
        case 'Space':
          setInputs((prev) => ({ ...prev, jump: true }));
          break;
        case 'KeyC':
          if (!crouchKeyHeld.current) {
            crouchKeyHeld.current = true;
            setInputs((prev) => ({ ...prev, crouch: !prev.crouch }));
          }
          break;
        case 'KeyF':
          setInputs((prev) => ({ ...prev, punch: true }));
          break;
        case 'KeyG':
          setInputs((prev) => ({ ...prev, kick: true }));
          break;
        case 'KeyE':
          setInputs((prev) => ({ ...prev, interact: true }));
          break;
        case 'KeyQ':
          setInputs((prev) => ({ ...prev, parry: true }));
          break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          setInputs((prev) => ({ ...prev, forward: false }));
          break;
        case 'KeyS':
        case 'ArrowDown':
          setInputs((prev) => ({ ...prev, backward: false }));
          break;
        case 'KeyA':
        case 'ArrowLeft':
          setInputs((prev) => ({ ...prev, left: false }));
          break;
        case 'KeyD':
        case 'ArrowRight':
          setInputs((prev) => ({ ...prev, right: false }));
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          setInputs((prev) => ({ ...prev, run: false }));
          break;
        case 'Space':
          setInputs((prev) => ({ ...prev, jump: false }));
          break;
        case 'KeyC':
          crouchKeyHeld.current = false;
          break;
        case 'KeyF':
          setInputs((prev) => ({ ...prev, punch: false }));
          break;
        case 'KeyG':
          setInputs((prev) => ({ ...prev, kick: false }));
          break;
        case 'KeyE':
          setInputs((prev) => ({ ...prev, interact: false }));
          break;
        case 'KeyQ':
          setInputs((prev) => ({ ...prev, parry: false }));
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  return inputs;
};
