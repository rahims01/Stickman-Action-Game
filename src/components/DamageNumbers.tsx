import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { Html } from '@react-three/drei';
import * as THREE from 'three';

export interface DamageNumbersHandle {
  spawn: (position: THREE.Vector3, value: number, color: string) => void;
}

interface DamageNumberEntry {
  id: number;
  position: [number, number, number];
  value: number;
  color: string;
}

const LIFETIME_MS = 900;

export const DamageNumbers = forwardRef<DamageNumbersHandle>((_props, ref) => {
  const [entries, setEntries] = useState<DamageNumberEntry[]>([]);
  const nextId = useRef(0);

  useImperativeHandle(ref, () => ({
    spawn(position, value, color) {
      const id = nextId.current++;
      const jitterX = (Math.random() - 0.5) * 0.5;
      setEntries((prev) => [...prev, { id, position: [position.x + jitterX, position.y + 1.7, position.z], value, color }]);
      setTimeout(() => {
        setEntries((prev) => prev.filter((entry) => entry.id !== id));
      }, LIFETIME_MS);
    }
  }));

  return (
    <>
      {entries.map((entry) => (
        <Html key={entry.id} position={entry.position} center distanceFactor={10} style={{ pointerEvents: 'none' }}>
          <div
            className="damage-number-pop"
            style={{
              color: entry.color,
              fontSize: '17px',
              fontWeight: 'bold',
              textShadow: '0 1px 3px rgba(0,0,0,0.85)',
              whiteSpace: 'nowrap'
            }}
          >
            {entry.value}
          </div>
        </Html>
      ))}
    </>
  );
});

DamageNumbers.displayName = 'DamageNumbers';
