import { asset } from '../world/assetPath';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useFBX } from '@react-three/drei';
import * as THREE from 'three';
import { SkeletonUtils } from 'three-stdlib';
import { useInputs } from '../hooks/useInputs';
import { createRagdoll, RagdollHandle } from '../world/ragdoll';
import { physicsWorld, stepPhysicsWorld } from '../world/physicsWorld';
import {
  CUP_ARENAS,
  CupFighter,
  CupMatch,
  CupRoundKind,
  DUEL_AI_ATTACK_COOLDOWN,
  DUEL_AI_SPEED,
  DUEL_ARENA_RADIUS,
  DUEL_ATTACK_COOLDOWN,
  DUEL_ATTACK_RANGE,
  DUEL_HIT_LOCK,
  DUEL_RECOVERY,
  DUEL_PLAYER_SPEED,
  ROUND_LABEL,
  ROUND_ORDER,
  advanceBracket,
  aiProfileForSeed,
  createBracket,
  createCupField,
  findPlayerMatch,
  simulateMatch
} from '../world/cupRun';

const ROOT_BONE_NAME = 'mixamorigHips';

const stripRootMotion = (clip: THREE.AnimationClip) => {
  const track = clip.tracks.find((t) => t.name === `${ROOT_BONE_NAME}.position`) as THREE.VectorKeyframeTrack | undefined;
  if (!track) return;
  const values = track.values;
  const baseX = values[0];
  const baseZ = values[2];
  for (let i = 0; i < values.length; i += 3) {
    values[i] = baseX;
    values[i + 2] = baseZ;
  }
};

type DuelAnim = 'idle' | 'walk' | 'punch' | 'kick' | 'hit';

interface DuelState {
  position: THREE.Vector3;
  health: number;
  maxHealth: number;
  attackCooldown: number;
  hitLock: number;
  facing: number;
}

interface DuelActorProps {
  fighter: CupFighter;
  self: DuelState;
  foe: DuelState;
  isPlayer: boolean;
  live: boolean;
  onLand: (damage: number) => void;
}

const DuelActor: React.FC<DuelActorProps> = ({ fighter, self, foe, isPlayer, live, onLand }) => {
  const groupRef = useRef<THREE.Group>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const actionsRef = useRef<{ [k in DuelAnim]?: THREE.AnimationAction }>({});
  const currentRef = useRef<DuelAnim>('idle');
  const oneShotRef = useRef<number | null>(null);
  const pendingHitRef = useRef<number | null>(null);
  // Cleared when the swing is a deliberate whiff (error injection).
  const swingWillLandRef = useRef(true);
  const reactionRef = useRef(0);
  const recoveryRef = useRef(0);
  const profile = useMemo(() => aiProfileForSeed(fighter.seed), [fighter.seed]);
  const ragdollRef = useRef<RagdollHandle | null>(null);
  const inputs = useInputs();

  const baseFbx = useFBX(asset('/anims/stickman_base.fbx'));
  const idleFbx = useFBX(asset('/anims/fighting-idle.fbx'));
  const walkFbx = useFBX(asset('/anims/walk.fbx'));
  const punchFbx = useFBX(asset('/anims/punch.fbx'));
  const kickFbx = useFBX(asset('/anims/kick.fbx'));
  const hitFbx = useFBX(asset('/anims/hit-to-body.fbx'));

  const model = useMemo(() => SkeletonUtils.clone(baseFbx) as THREE.Group, [baseFbx]);

  useEffect(() => {
    model.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      const sources = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const cloned = sources.map((m) => {
        const c = (m as THREE.MeshStandardMaterial).clone();
        c.color.set(fighter.color);
        return c;
      });
      // Preserve the single-vs-array shape: a one-element array on geometry
      // with no groups renders nothing.
      mesh.material = Array.isArray(mesh.material) ? cloned : cloned[0];
      mesh.castShadow = true;
    });
  }, [model, fighter.color]);

  useEffect(() => {
    const mixer = new THREE.AnimationMixer(model);
    mixerRef.current = mixer;
    const bind = (name: DuelAnim, fbx: THREE.Group, loop: boolean) => {
      const clip = fbx.animations[0];
      if (!clip) return;
      const cloned = clip.clone();
      stripRootMotion(cloned);
      const action = mixer.clipAction(cloned);
      if (!loop) {
        action.setLoop(THREE.LoopOnce, 1);
        action.clampWhenFinished = true;
      }
      actionsRef.current[name] = action;
    };
    bind('idle', idleFbx, true);
    bind('walk', walkFbx, true);
    bind('punch', punchFbx, false);
    bind('kick', kickFbx, false);
    bind('hit', hitFbx, false);
    actionsRef.current.idle?.play();
    ragdollRef.current = createRagdoll(model, physicsWorld);
    return () => {
      ragdollRef.current?.dispose();
      ragdollRef.current = null;
      mixer.stopAllAction();
    };
  }, [model, idleFbx, walkFbx, punchFbx, kickFbx, hitFbx]);

  const transitionTo = (next: DuelAnim) => {
    if (currentRef.current === next) return;
    const from = actionsRef.current[currentRef.current];
    const to = actionsRef.current[next];
    if (!to) return;
    to.reset().play();
    if (from) from.crossFadeTo(to, 0.16, false);
    currentRef.current = next;
  };

  const playOneShot = (name: DuelAnim) => {
    const action = actionsRef.current[name];
    if (!action) return;
    const from = actionsRef.current[currentRef.current];
    action.reset().play();
    if (from && from !== action) from.crossFadeTo(action, 0.08, false);
    currentRef.current = name;
    oneShotRef.current = action.getClip().duration;
  };

  useFrame((_, delta) => {
    const group = groupRef.current;
    if (!group) return;
    const dt = Math.min(delta, 0.05);
    mixerRef.current?.update(dt);

    // Dead: hand the body to physics. Per this project's rule there is no
    // death animation anywhere — a loser ragdolls, full stop.
    if (self.health <= 0) {
      if (!ragdollRef.current?.isActive()) ragdollRef.current?.activate();
      ragdollRef.current?.update();
      return;
    }

    if (oneShotRef.current !== null) {
      oneShotRef.current -= dt;
      if (pendingHitRef.current !== null) {
        pendingHitRef.current -= dt;
        if (pendingHitRef.current <= 0) {
          const dmg = fighter.damage;
          const lands = swingWillLandRef.current;
          pendingHitRef.current = null;
          const d = Math.hypot(foe.position.x - self.position.x, foe.position.z - self.position.z);
          if (lands && d <= DUEL_ATTACK_RANGE + 0.4) onLand(dmg);
        }
      }
      if (oneShotRef.current <= 0) {
        oneShotRef.current = null;
        transitionTo('idle');
      }
    }
    self.attackCooldown = Math.max(0, self.attackCooldown - dt);
    self.hitLock = Math.max(0, self.hitLock - dt);
    if (!live || self.hitLock > 0) {
      group.position.set(self.position.x, 0, self.position.z);
      return;
    }

    const dx = foe.position.x - self.position.x;
    const dz = foe.position.z - self.position.z;
    const dist = Math.hypot(dx, dz);

    let mx = 0;
    let mz = 0;
    let attack = false;

    if (isPlayer) {
      if (inputs.forward) mz -= 1;
      if (inputs.backward) mz += 1;
      if (inputs.left) mx -= 1;
      if (inputs.right) mx += 1;
      attack = inputs.punch || inputs.kick;
    } else {
      // Close to range, then swing. Backs off slightly after landing one so
      // the duel has a rhythm rather than two bodies grinding together.
      // Better fighters hold the edge of their reach rather than walking
      // into the player's face, which makes them harder to corner and trade
      // with. Weaker ones just close and flail.
      const hold = profile.spacing ? DUEL_ATTACK_RANGE * 0.92 : DUEL_ATTACK_RANGE * 0.7;
      if (dist > hold + 0.15) {
        mx = dx;
        mz = dz;
      } else if (dist < hold - 0.15) {
        mx = -dx;
        mz = -dz;
      }
      // Reaction delay: it must be in range for a beat before committing.
      // This is the window the player has to beat it to the punch, and its
      // absence is what made every fight either trivial or a stunlock.
      if (dist <= DUEL_ATTACK_RANGE) reactionRef.current += dt;
      else reactionRef.current = 0;
      attack = reactionRef.current >= profile.reactionDelay;
    }

    const len = Math.hypot(mx, mz);
    if (len > 0.001 && oneShotRef.current === null) {
      const speed = isPlayer ? DUEL_PLAYER_SPEED : DUEL_AI_SPEED;
      self.position.x += (mx / len) * speed * dt;
      self.position.z += (mz / len) * speed * dt;
      transitionTo('walk');
    } else if (oneShotRef.current === null) {
      transitionTo('idle');
    }

    // Ring-out isn't a thing here: the arena is a bowl you can't leave.
    const r = Math.hypot(self.position.x, self.position.z);
    if (r > DUEL_ARENA_RADIUS - 0.6) {
      self.position.multiplyScalar((DUEL_ARENA_RADIUS - 0.6) / r);
    }

    // Always face the opponent — a duel reads badly if either fighter turns
    // their back while circling.
    if (dist > 0.001) {
      self.facing = Math.atan2(dx, dz);
      group.rotation.y = self.facing;
    }

    recoveryRef.current = Math.max(0, recoveryRef.current - dt);
    const cooldown = isPlayer ? DUEL_ATTACK_COOLDOWN : DUEL_AI_ATTACK_COOLDOWN * profile.tempo;
    if (
      attack &&
      self.attackCooldown <= 0 &&
      recoveryRef.current <= 0 &&
      oneShotRef.current === null &&
      dist <= DUEL_ATTACK_RANGE + 0.5
    ) {
      const useKick = isPlayer ? inputs.kick && !inputs.punch : Math.random() < 0.4;
      playOneShot(useKick ? 'kick' : 'punch');
      // Telegraph: the hit lands part-way through the swing, not on the frame
      // the decision was made. That gap is the tell the player reads.
      pendingHitRef.current = isPlayer ? 0.3 : profile.telegraph + 0.15;
      // Error injection. A weak fighter visibly mistimes half its swings;
      // the top seed almost never does. Same animation either way, so a miss
      // reads as a miss rather than as the game not registering a hit.
      swingWillLandRef.current = isPlayer || Math.random() >= profile.missChance;
      self.attackCooldown = cooldown;
      // Nothing may swing again until the previous swing has recovered, so a
      // landed hit can never chain into a stunlock.
      recoveryRef.current = DUEL_RECOVERY;
      reactionRef.current = 0;
    }

    group.position.set(self.position.x, 0, self.position.z);
  });

  // Taking a hit interrupts whatever was happening.
  useEffect(() => {
    if (self.hitLock > 0 && self.health > 0) playOneShot('hit');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [self.hitLock > 0]);

  return (
    <group ref={groupRef} position={[self.position.x, 0, self.position.z]}>
      <primitive object={model} scale={0.012} />
    </group>
  );
};

const PhysicsStepper: React.FC = () => {
  useFrame((_, delta) => stepPhysicsWorld(delta));
  return null;
};

const DuelArena: React.FC<{ round: CupRoundKind }> = ({ round }) => {
  const arena = CUP_ARENAS[round];
  const wallSegments = useMemo(
    () =>
      Array.from({ length: 28 }, (_, i) => {
        const a = (i / 28) * Math.PI * 2;
        return { x: Math.sin(a) * DUEL_ARENA_RADIUS, z: Math.cos(a) * DUEL_ARENA_RADIUS, r: a };
      }),
    []
  );

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[DUEL_ARENA_RADIUS, 48]} />
        <meshStandardMaterial color={arena.ground} roughness={0.95} />
      </mesh>
      {wallSegments.map((s, i) => (
        <mesh key={i} position={[s.x, 0.9, s.z]} rotation={[0, s.r, 0]} castShadow>
          <boxGeometry args={[2.6, 1.8, 0.5]} />
          <meshStandardMaterial color={arena.wall} roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
};

const DuelCamera: React.FC<{ a: DuelState; b: DuelState }> = ({ a, b }) => {
  useFrame((state) => {
    const midX = (a.position.x + b.position.x) / 2;
    const midZ = (a.position.z + b.position.z) / 2;
    state.camera.position.set(midX * 0.4, 9, midZ * 0.4 + 15);
    state.camera.lookAt(midX * 0.3, 1, midZ * 0.3);
  });
  return null;
};

// Our own ceremony rather than a port of theirs: a rain of falling confetti
// slabs over the champion. Their version is a 3D orbit; this one suits a game
// whose whole visual language is boxes and ragdolls.
const Confetti: React.FC = () => {
  const COUNT = 160;
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const bits = useMemo(
    () =>
      Array.from({ length: COUNT }, () => ({
        x: (Math.random() - 0.5) * 20,
        y: 6 + Math.random() * 14,
        z: (Math.random() - 0.5) * 14,
        vy: 1.2 + Math.random() * 2.2,
        spin: (Math.random() - 0.5) * 6,
        rot: Math.random() * Math.PI,
        color: new THREE.Color(['#ffd54f', '#4fc3f7', '#ff7043', '#a6e22e', '#ff4fa3'][Math.floor(Math.random() * 5)])
      })),
    []
  );
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    bits.forEach((b, i) => mesh.setColorAt(i, b.color));
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [bits]);

  useFrame((_, delta) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const dt = Math.min(delta, 0.05);
    bits.forEach((b, i) => {
      b.y -= b.vy * dt;
      b.rot += b.spin * dt;
      if (b.y < 0) b.y = 14 + Math.random() * 6;
      dummy.position.set(b.x, b.y, b.z);
      dummy.rotation.set(b.rot, b.rot * 0.7, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, COUNT]}>
      <boxGeometry args={[0.18, 0.28, 0.02]} />
      <meshStandardMaterial vertexColors toneMapped={false} />
    </instancedMesh>
  );
};

// ── Bracket UI ────────────────────────────────────────────────────────────
const BracketView: React.FC<{ matches: CupMatch[]; highlight: string | null }> = ({ matches, highlight }) => {
  const column = (round: CupRoundKind) => matches.filter((m) => m.round === round);
  const slot = (f: CupFighter | null, m: CupMatch) => {
    const won = m.winner && f && m.winner.id === f.id;
    const lost = m.winner && f && m.winner.id !== f.id;
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 10px',
          borderRadius: 5,
          background: won ? 'rgba(166,226,46,0.14)' : 'rgba(255,255,255,0.04)',
          border: `1px solid ${won ? 'rgba(166,226,46,0.5)' : 'rgba(255,255,255,0.1)'}`,
          opacity: lost ? 0.35 : 1,
          minWidth: 150
        }}
      >
        <span style={{ width: 9, height: 9, borderRadius: 2, background: f?.color ?? '#333' }} />
        <span
          style={{
            fontSize: 13,
            letterSpacing: 1,
            color: f?.isPlayer ? '#4fc3f7' : 'rgba(255,255,255,0.82)',
            fontWeight: f?.isPlayer ? 700 : 500
          }}
        >
          {f ? f.name : '—'}
        </span>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', gap: 34, alignItems: 'center', fontFamily: 'Rajdhani, sans-serif' }}>
      {ROUND_ORDER.map((round) => (
        <div key={round} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div
            style={{
              fontSize: 11,
              letterSpacing: 2.5,
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.4)',
              textAlign: 'center'
            }}
          >
            {ROUND_LABEL[round]}
          </div>
          {column(round).map((m) => (
            <div
              key={m.id}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                padding: 6,
                borderRadius: 7,
                border: highlight === m.id ? '1px solid rgba(79,195,247,0.7)' : '1px solid transparent',
                background: highlight === m.id ? 'rgba(79,195,247,0.07)' : 'transparent'
              }}
            >
              {slot(m.a, m)}
              {slot(m.b, m)}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};

interface CupRunProps {
  playerTint: string;
  onExit: () => void;
}

type Screen = 'bracket' | 'duel' | 'champion' | 'eliminated';

export const CupRun: React.FC<CupRunProps> = ({ playerTint, onExit }) => {
  const [matches, setMatches] = useState<CupMatch[]>(() => createBracket(createCupField(playerTint)));
  const [roundIndex, setRoundIndex] = useState(0);
  const [screen, setScreen] = useState<Screen>('bracket');
  const round = ROUND_ORDER[roundIndex];

  const playerMatch = findPlayerMatch(matches, round);
  const opponent = playerMatch
    ? playerMatch.a?.isPlayer
      ? playerMatch.b
      : playerMatch.a
    : null;
  const playerFighter = playerMatch ? (playerMatch.a?.isPlayer ? playerMatch.a : playerMatch.b) : null;

  const duel = useRef<{ me: DuelState; foe: DuelState } | null>(null);
  const [, forceTick] = useState(0);

  const startDuel = () => {
    if (!playerFighter || !opponent) return;
    duel.current = {
      me: {
        position: new THREE.Vector3(-3, 0, 0),
        health: playerFighter.maxHealth,
        maxHealth: playerFighter.maxHealth,
        attackCooldown: 0,
        hitLock: 0,
        facing: 0
      },
      foe: {
        position: new THREE.Vector3(3, 0, 0),
        health: opponent.maxHealth,
        maxHealth: opponent.maxHealth,
        attackCooldown: 0,
        hitLock: 0,
        facing: 0
      }
    };
    setScreen('duel');
  };

  const finishRound = (playerWon: boolean) => {
    if (!playerMatch) return;
    const winner = playerWon ? playerFighter! : opponent!;
    // Resolve the rest of the round, then feed everyone forward.
    const resolved = matches.map((m) => {
      if (m.id === playerMatch.id) return { ...m, winner };
      if (m.round === round && !m.winner && m.a && m.b) return { ...m, winner: simulateMatch(m.a, m.b) };
      return m;
    });
    setMatches(advanceBracket(resolved));
    if (!playerWon) {
      setScreen('eliminated');
    } else if (roundIndex === ROUND_ORDER.length - 1) {
      setScreen('champion');
    } else {
      setRoundIndex((i) => i + 1);
      setScreen('bracket');
    }
  };

  // Watch the duel for a knockout.
  useEffect(() => {
    if (screen !== 'duel') return;
    const timer = setInterval(() => {
      const d = duel.current;
      if (!d) return;
      forceTick((t) => t + 1);
      if (d.me.health <= 0 || d.foe.health <= 0) {
        clearInterval(timer);
        // Let the ragdoll land before cutting away.
        setTimeout(() => finishRound(d.foe.health <= 0), 1800);
      }
    }, 120);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen]);

  const arena = CUP_ARENAS[round];

  if (screen === 'duel' && duel.current && playerFighter && opponent) {
    const d = duel.current;
    const live = d.me.health > 0 && d.foe.health > 0;
    const bar = (state: DuelState, f: CupFighter, align: 'left' | 'right') => (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5, alignItems: align === 'left' ? 'flex-start' : 'flex-end' }}>
        <span style={{ fontSize: 14, letterSpacing: 2, color: f.isPlayer ? '#4fc3f7' : '#fff' }}>{f.name}</span>
        <div style={{ width: '100%', height: 9, background: 'rgba(255,255,255,0.12)', borderRadius: 5, overflow: 'hidden' }}>
          <div
            style={{
              width: `${Math.max(0, (state.health / state.maxHealth) * 100)}%`,
              height: '100%',
              background: f.color,
              marginLeft: align === 'right' ? 'auto' : 0,
              transition: 'width 0.15s'
            }}
          />
        </div>
      </div>
    );

    return (
      <div style={{ position: 'relative', width: '100vw', height: '100vh', background: arena.sky }}>
        <Canvas shadows camera={{ position: [0, 9, 15], fov: 50 }}>
          <color attach="background" args={[arena.sky]} />
          <fog attach="fog" args={[arena.fog, 16, 48]} />
          <ambientLight intensity={0.7} />
          <directionalLight position={[6, 16, 8]} intensity={1.4} color={arena.light} castShadow />
          <PhysicsStepper />
          <DuelCamera a={d.me} b={d.foe} />
          <DuelArena round={round} />
          <DuelActor
            fighter={playerFighter}
            self={d.me}
            foe={d.foe}
            isPlayer
            live={live}
            onLand={(dmg) => {
              d.foe.health = Math.max(0, d.foe.health - dmg);
              d.foe.hitLock = DUEL_HIT_LOCK;
            }}
          />
          <DuelActor
            fighter={opponent}
            self={d.foe}
            foe={d.me}
            isPlayer={false}
            live={live}
            onLand={(dmg) => {
              d.me.health = Math.max(0, d.me.health - dmg);
              d.me.hitLock = DUEL_HIT_LOCK;
            }}
          />
        </Canvas>

        <div
          style={{
            position: 'absolute',
            top: 20,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 'min(760px, 88vw)',
            display: 'flex',
            gap: 26,
            alignItems: 'center',
            fontFamily: 'Rajdhani, sans-serif'
          }}
        >
          {bar(d.me, playerFighter, 'left')}
          <span style={{ fontSize: 11, letterSpacing: 3, color: 'rgba(255,255,255,0.55)', whiteSpace: 'nowrap' }}>
            {ROUND_LABEL[round].toUpperCase()}
          </span>
          {bar(d.foe, opponent, 'right')}
        </div>

        <div
          style={{
            position: 'absolute',
            bottom: 18,
            left: 18,
            fontFamily: 'Rajdhani, sans-serif',
            fontSize: 13,
            letterSpacing: 1.5,
            color: 'rgba(255,255,255,0.6)'
          }}
        >
          WASD MOVE · F PUNCH · G KICK
        </div>
      </div>
    );
  }

  if (screen === 'champion') {
    return (
      <div style={{ position: 'relative', width: '100vw', height: '100vh', background: '#0d1310' }}>
        <Canvas camera={{ position: [0, 4, 12], fov: 50 }}>
          <color attach="background" args={['#0d1310']} />
          <ambientLight intensity={0.9} />
          <directionalLight position={[4, 12, 8]} intensity={1.2} />
          <Confetti />
        </Canvas>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 22,
            fontFamily: 'Rajdhani, sans-serif',
            pointerEvents: 'none'
          }}
        >
          <div style={{ fontSize: 22, letterSpacing: 6, color: '#ffd54f' }}>🏆</div>
          <div style={{ fontSize: 54, fontWeight: 700, letterSpacing: 8, color: '#ffd54f' }}>CUP WON</div>
          <div style={{ fontSize: 16, letterSpacing: 3, color: 'rgba(255,255,255,0.6)' }}>
            THREE FIGHTS. NO DEATH ANIMATIONS.
          </div>
          <button
            onClick={onExit}
            style={{
              pointerEvents: 'auto',
              marginTop: 14,
              padding: '14px 40px',
              fontSize: 15,
              fontWeight: 700,
              letterSpacing: 2,
              borderRadius: 10,
              border: '2px solid #4fc3f7',
              background: 'rgba(79,195,247,0.12)',
              color: '#4fc3f7',
              cursor: 'pointer',
              fontFamily: 'Rajdhani, sans-serif'
            }}
          >
            ← BACK TO MENU
          </button>
        </div>
      </div>
    );
  }

  // Bracket + eliminated share a layout.
  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        background: 'radial-gradient(circle at 50% 30%, #16201b, #0a0e0c)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 30,
        fontFamily: 'Rajdhani, sans-serif'
      }}
    >
      <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: 12, letterSpacing: 5, color: 'rgba(255,255,255,0.4)' }}>CUP RUN</div>
        <div style={{ fontSize: 38, fontWeight: 700, letterSpacing: 5, color: '#fff' }}>
          {screen === 'eliminated' ? 'ELIMINATED' : ROUND_LABEL[round].toUpperCase()}
        </div>
        {screen === 'bracket' && (
          <div style={{ fontSize: 14, letterSpacing: 3, color: '#a6e22e' }}>{arena.label.toUpperCase()}</div>
        )}
      </div>

      <BracketView matches={matches} highlight={playerMatch?.id ?? null} />

      <div style={{ display: 'flex', gap: 14 }}>
        {screen === 'bracket' && opponent && (
          <button
            onClick={startDuel}
            style={{
              padding: '16px 44px',
              fontSize: 17,
              fontWeight: 700,
              letterSpacing: 2,
              borderRadius: 11,
              border: '2px solid #a6e22e',
              background: 'rgba(166,226,46,0.14)',
              color: '#a6e22e',
              cursor: 'pointer',
              fontFamily: 'Rajdhani, sans-serif'
            }}
          >
            ⚔ FIGHT {opponent.name.toUpperCase()}
          </button>
        )}
        <button
          onClick={onExit}
          style={{
            padding: '16px 32px',
            fontSize: 15,
            fontWeight: 600,
            letterSpacing: 2,
            borderRadius: 11,
            border: '1px solid rgba(255,255,255,0.25)',
            background: 'rgba(255,255,255,0.05)',
            color: 'rgba(255,255,255,0.75)',
            cursor: 'pointer',
            fontFamily: 'Rajdhani, sans-serif'
          }}
        >
          ← MENU
        </button>
      </div>
    </div>
  );
};
