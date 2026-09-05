import { asset } from '../world/assetPath';
import { normalizeSkinWeights } from '../world/skinWeights';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useFBX } from '@react-three/drei';
import * as THREE from 'three';
import { SkeletonUtils } from 'three-stdlib';
import { useInputs } from '../hooks/useInputs';
import { createRagdoll, RagdollHandle } from '../world/ragdoll';
import { physicsWorld, stepPhysicsWorld } from '../world/physicsWorld';
import { ENEMY_CONFIGS, EnemyType } from '../world/enemyConfig';
import { MaterialKey, getMaterialTexture } from '../world/proceduralTextures';
import { ArenaRoom, pickRoom } from '../world/arenaRooms';
import {
  VERSUS_ARENA_RADIUS,
  VERSUS_ATTACK_COOLDOWN,
  VERSUS_ATTACK_RANGE,
  VERSUS_HIT_WINDUP,
  VERSUS_MAX_HEALTH,
  VERSUS_PLAYER_DAMAGE,
  VERSUS_PLAYER_SPEED,
  VERSUS_WAVES_PER_TIER,
  VersusEnemyState,
  VersusSideState,
  createSide,
  randomAiTint,
  tierFor,
  versusWaveRoster
} from '../world/arenaVersus';

const ROOT_BONE_NAME = 'mixamorigHips';
const hipsScratch = new THREE.Vector3();

const stripRootMotion = (clip: THREE.AnimationClip) => {
  const track = clip.tracks.find((t) => t.name === `${ROOT_BONE_NAME}.position`) as THREE.VectorKeyframeTrack | undefined;
  if (!track) return;
  const v = track.values;
  const bx = v[0];
  const bz = v[2];
  for (let i = 0; i < v.length; i += 3) {
    v[i] = bx;
    v[i + 2] = bz;
  }
};

type VAnim = 'idle' | 'walk' | 'punch' | 'kick' | 'hit';

const useRig = () => {
  const base = useFBX(asset('/anims/stickman_base.fbx'));
  normalizeSkinWeights(base);
  return {
    base,
    idle: useFBX(asset('/anims/fighting-idle.fbx')),
    walk: useFBX(asset('/anims/run.fbx')),
    punch: useFBX(asset('/anims/punch.fbx')),
    kick: useFBX(asset('/anims/kick.fbx')),
    hit: useFBX(asset('/anims/hit-to-body.fbx'))
  };
};

interface RigProps {
  tint?: string;
  material?: MaterialKey;
  scale?: number;
}

/** Shared stickman: clones the cached rig, applies a tint or room material. */
const useStickman = ({ tint, material }: RigProps) => {
  const rig = useRig();
  const model = useMemo(() => SkeletonUtils.clone(rig.base) as THREE.Group, [rig.base]);

  useEffect(() => {
    const tex = material ? getMaterialTexture(material) : null;
    model.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      const src = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const cloned = src.map((m) => {
        const c = (m as THREE.MeshStandardMaterial).clone();
        if (tex) {
          c.map = tex;
          c.color.set('#ffffff');
        } else if (tint) {
          c.color.set(tint);
        }
        c.needsUpdate = true;
        return c;
      });
      // Preserve single-vs-array: a one-element array on ungrouped geometry
      // renders nothing at all.
      mesh.material = Array.isArray(mesh.material) ? cloned : cloned[0];
      mesh.castShadow = true;
    });
  }, [model, tint, material]);

  return { model, rig };
};

const useAnimator = (model: THREE.Group, rig: ReturnType<typeof useRig>) => {
  const mixer = useRef<THREE.AnimationMixer | null>(null);
  const actions = useRef<{ [k in VAnim]?: THREE.AnimationAction }>({});
  const current = useRef<VAnim>('idle');
  const oneShot = useRef<number | null>(null);

  useEffect(() => {
    const mx = new THREE.AnimationMixer(model);
    mixer.current = mx;
    const bind = (name: VAnim, src: THREE.Group, loop: boolean) => {
      const clip = src.animations[0];
      if (!clip) return;
      const c = clip.clone();
      stripRootMotion(c);
      const a = mx.clipAction(c);
      if (!loop) {
        a.setLoop(THREE.LoopOnce, 1);
        a.clampWhenFinished = true;
      }
      actions.current[name] = a;
    };
    bind('idle', rig.idle, true);
    bind('walk', rig.walk, true);
    bind('punch', rig.punch, false);
    bind('kick', rig.kick, false);
    bind('hit', rig.hit, false);
    actions.current.idle?.play();
    return () => {
      mx.stopAllAction();
    };
  }, [model, rig]);

  const to = (next: VAnim) => {
    if (current.current === next) return;
    const from = actions.current[current.current];
    const nx = actions.current[next];
    if (!nx) return;
    nx.reset().play();
    if (from) from.crossFadeTo(nx, 0.15, false);
    current.current = next;
  };

  const shot = (name: VAnim) => {
    const a = actions.current[name];
    if (!a) return;
    const from = actions.current[current.current];
    a.reset().play();
    if (from && from !== a) from.crossFadeTo(a, 0.08, false);
    current.current = name;
    oneShot.current = a.getClip().duration;
  };

  return { mixer, to, shot, oneShot };
};

// ── One arena enemy ───────────────────────────────────────────────────────
const VersusEnemy: React.FC<{
  state: VersusEnemyState;
  target: VersusSideState;
  onHitPlayer: (dmg: number) => void;
  frozen: boolean;
}> = ({ state, target, onHitPlayer, frozen }) => {
  const group = useRef<THREE.Group>(null);
  const { model, rig } = useStickman({ material: state.material as MaterialKey });
  const { mixer, to, shot, oneShot } = useAnimator(model, rig);
  const ragdoll = useRef<RagdollHandle | null>(null);
  const pendingHit = useRef<number | null>(null);

  useEffect(() => {
    ragdoll.current = createRagdoll(model, physicsWorld);
    return () => {
      ragdoll.current?.dispose();
      ragdoll.current = null;
    };
  }, [model]);

  useFrame((_, delta) => {
    const g = group.current;
    if (!g) return;
    const dt = Math.min(delta, 0.05);
    mixer.current?.update(dt);

    if (state.health <= 0) {
      if (!ragdoll.current?.isActive()) ragdoll.current?.activate();
      ragdoll.current?.update();
      ragdoll.current?.getHipsWorldPosition(hipsScratch);
      g.position.set(hipsScratch.x, 0, hipsScratch.z);
      return;
    }
    if (frozen) return;

    if (oneShot.current !== null) {
      oneShot.current -= dt;
      if (pendingHit.current !== null) {
        pendingHit.current -= dt;
        if (pendingHit.current <= 0) {
          pendingHit.current = null;
          const d = Math.hypot(target.position.x - state.position.x, target.position.z - state.position.z);
          if (d <= VERSUS_ATTACK_RANGE + 0.4) onHitPlayer(state.damage);
        }
      }
      if (oneShot.current <= 0) {
        oneShot.current = null;
        to('idle');
      }
    }
    state.attackCooldown = Math.max(0, state.attackCooldown - dt);

    const dx = target.position.x - state.position.x;
    const dz = target.position.z - state.position.z;
    const dist = Math.hypot(dx, dz);

    if (dist > VERSUS_ATTACK_RANGE * 0.8 && oneShot.current === null) {
      state.position.x += (dx / dist) * state.speed * dt;
      state.position.z += (dz / dist) * state.speed * dt;
      to('walk');
    } else if (oneShot.current === null) {
      to('idle');
      if (state.attackCooldown <= 0) {
        shot(Math.random() < 0.4 ? 'kick' : 'punch');
        pendingHit.current = VERSUS_HIT_WINDUP;
        state.attackCooldown = 1.5;
      }
    }
    if (dist > 0.01) g.rotation.y = Math.atan2(dx, dz);
    g.position.set(state.position.x, 0, state.position.z);
  });

  return (
    <group ref={group} position={[state.position.x, 0, state.position.z]}>
      <primitive object={model} scale={0.012} />
    </group>
  );
};

// ── The fighter on each side ──────────────────────────────────────────────
const VersusFighter: React.FC<{
  side: VersusSideState;
  enemies: VersusEnemyState[];
  onStrike: (enemy: VersusEnemyState) => void;
  frozen: boolean;
}> = ({ side, enemies, onStrike, frozen }) => {
  const group = useRef<THREE.Group>(null);
  const { model, rig } = useStickman({ tint: side.tint });
  const { mixer, to, shot, oneShot } = useAnimator(model, rig);
  const ragdoll = useRef<RagdollHandle | null>(null);
  const pendingHit = useRef<VersusEnemyState | null>(null);
  const pendingIn = useRef(0);
  const inputs = useInputs();

  useEffect(() => {
    ragdoll.current = createRagdoll(model, physicsWorld);
    return () => {
      ragdoll.current?.dispose();
      ragdoll.current = null;
    };
  }, [model]);

  useFrame((_, delta) => {
    const g = group.current;
    if (!g) return;
    const dt = Math.min(delta, 0.05);
    mixer.current?.update(dt);

    // One life. Death is a ragdoll and nothing else — no clip, per the
    // project's standing rule.
    if (side.dead) {
      if (!ragdoll.current?.isActive()) ragdoll.current?.activate();
      ragdoll.current?.update();
      ragdoll.current?.getHipsWorldPosition(hipsScratch);
      g.position.set(hipsScratch.x, 0, hipsScratch.z);
      return;
    }
    if (frozen) return;

    if (oneShot.current !== null) {
      oneShot.current -= dt;
      if (pendingHit.current) {
        pendingIn.current -= dt;
        if (pendingIn.current <= 0) {
          const victim = pendingHit.current;
          pendingHit.current = null;
          const d = Math.hypot(victim.position.x - side.position.x, victim.position.z - side.position.z);
          if (victim.health > 0 && d <= VERSUS_ATTACK_RANGE + 0.5) onStrike(victim);
        }
      }
      if (oneShot.current <= 0) {
        oneShot.current = null;
        to('idle');
      }
    }
    side.attackCooldown = Math.max(0, side.attackCooldown - dt);
    side.hitLock = Math.max(0, side.hitLock - dt);
    if (side.hitLock > 0) return;

    // Nearest living enemy drives both the AI and the human's auto-facing.
    let nearest: VersusEnemyState | null = null;
    let nearestDist = Infinity;
    for (const e of enemies) {
      if (e.health <= 0) continue;
      const d = Math.hypot(e.position.x - side.position.x, e.position.z - side.position.z);
      if (d < nearestDist) {
        nearestDist = d;
        nearest = e;
      }
    }

    let mx = 0;
    let mz = 0;
    let wantsAttack = false;

    if (side.isHuman) {
      if (inputs.forward) mz -= 1;
      if (inputs.backward) mz += 1;
      if (inputs.left) mx -= 1;
      if (inputs.right) mx += 1;
      wantsAttack = inputs.punch || inputs.kick;
    } else if (nearest) {
      // Closes to reach, then swings. Backs off a touch while on cooldown so
      // it is not permanently glued to whatever it is hitting.
      if (nearestDist > VERSUS_ATTACK_RANGE * 0.85) {
        mx = nearest.position.x - side.position.x;
        mz = nearest.position.z - side.position.z;
      } else if (side.attackCooldown > 0.3) {
        mx = side.position.x - nearest.position.x;
        mz = side.position.z - nearest.position.z;
      }
      wantsAttack = nearestDist <= VERSUS_ATTACK_RANGE;
    }

    const len = Math.hypot(mx, mz);
    if (len > 0.001 && oneShot.current === null) {
      side.position.x += (mx / len) * VERSUS_PLAYER_SPEED * dt;
      side.position.z += (mz / len) * VERSUS_PLAYER_SPEED * dt;
      to('walk');
    } else if (oneShot.current === null) {
      to('idle');
    }

    const r = Math.hypot(side.position.x, side.position.z);
    if (r > VERSUS_ARENA_RADIUS - 1) side.position.multiplyScalar((VERSUS_ARENA_RADIUS - 1) / r);

    if (nearest && nearestDist < 14) {
      side.facing = Math.atan2(nearest.position.x - side.position.x, nearest.position.z - side.position.z);
      g.rotation.y = side.facing;
    } else if (len > 0.001) {
      g.rotation.y = Math.atan2(mx, mz);
    }

    if (wantsAttack && nearest && side.attackCooldown <= 0 && oneShot.current === null && nearestDist <= VERSUS_ATTACK_RANGE + 0.5) {
      shot(side.isHuman && inputs.kick && !inputs.punch ? 'kick' : 'punch');
      pendingHit.current = nearest;
      pendingIn.current = VERSUS_HIT_WINDUP;
      side.attackCooldown = VERSUS_ATTACK_COOLDOWN;
    }

    g.position.set(side.position.x, 0, side.position.z);
  });

  return (
    <group ref={group} position={[side.position.x, 0, side.position.z]}>
      <primitive object={model} scale={0.012} />
    </group>
  );
};

const Stepper: React.FC = () => {
  useFrame((_, d) => stepPhysicsWorld(d));
  return null;
};

const VersusArenaFloor: React.FC<{ room: ArenaRoom }> = ({ room }) => {
  const tex = getMaterialTexture(room.material);
  const segs = useMemo(
    () =>
      Array.from({ length: 22 }, (_, i) => {
        const a = (i / 22) * Math.PI * 2;
        return { x: Math.sin(a) * VERSUS_ARENA_RADIUS, z: Math.cos(a) * VERSUS_ARENA_RADIUS, r: a };
      }),
    []
  );
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[VERSUS_ARENA_RADIUS, 48]} />
        <meshStandardMaterial map={tex} map-repeat={[8, 8]} color={room.ground} roughness={0.95} />
      </mesh>
      {segs.map((s, i) => (
        <mesh key={i} position={[s.x, 1.1, s.z]} rotation={[0, s.r, 0]} castShadow>
          <boxGeometry args={[4, 2.2, 0.7]} />
          <meshStandardMaterial map={tex} map-repeat={[2, 1]} color={room.wall} roughness={0.95} />
        </mesh>
      ))}
    </group>
  );
};

const ChaseCam: React.FC<{ side: VersusSideState }> = ({ side }) => {
  useFrame((s) => {
    s.camera.position.set(side.position.x * 0.5, 15, side.position.z * 0.5 + 17);
    s.camera.lookAt(side.position.x * 0.4, 1, side.position.z * 0.4);
  });
  return null;
};

// ── One half of the screen ────────────────────────────────────────────────
const VersusSide: React.FC<{
  side: VersusSideState;
  onDeath: (id: 'player' | 'ai') => void;
  frozen: boolean;
}> = ({ side, onDeath, frozen }) => {
  const enemiesRef = useRef<VersusEnemyState[]>([]);
  const nextId = useRef(0);
  const [, tick] = useState(0);
  const waveTimer = useRef<number | null>(null);

  const spawnWave = () => {
    side.wave += 1;
    // Independent room progression: this side advances on its own schedule
    // and draws its own room, so the two screens diverge immediately.
    if (side.wave > 1 && (side.wave - 1) % VERSUS_WAVES_PER_TIER === 0 && side.roomsEntered < 5) {
      side.roomsEntered += 1;
      side.room = pickRoom(tierFor(side.roomsEntered - 1), side.room.id);
    }
    const roster = versusWaveRoster(side);
    const spawned = roster.map(({ type, elite }) => {
      const cfg = ENEMY_CONFIGS[type as EnemyType];
      const a = Math.random() * Math.PI * 2;
      const r = VERSUS_ARENA_RADIUS * 0.55 + Math.random() * (VERSUS_ARENA_RADIUS * 0.3);
      const hp = Math.round((cfg?.maxHealth ?? 10) * (elite ? 1.6 : 1) + side.wave);
      return {
        id: `${side.id}-e${nextId.current++}`,
        type: type as EnemyType,
        material: (cfg?.skinMaterial ?? side.room.material) as string,
        position: new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r),
        health: hp,
        maxHealth: hp,
        damage: Math.max(1, cfg?.punch?.damage ?? 2),
        speed: 2.4 + Math.min(1.6, side.wave * 0.08),
        attackCooldown: 0.5 + Math.random(),
        diedAt: null
      } as VersusEnemyState;
    });
    enemiesRef.current = [...enemiesRef.current.filter((e) => e.health > 0), ...spawned];
    tick((t) => t + 1);
  };

  useEffect(() => {
    const t = window.setTimeout(spawnWave, 1200);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Wave clear / cull, on a light interval rather than per frame.
  useEffect(() => {
    const iv = window.setInterval(() => {
      if (frozen || side.dead) return;
      const now = Date.now();
      const before = enemiesRef.current.length;
      enemiesRef.current = enemiesRef.current.filter((e) => e.diedAt === null || now - e.diedAt < 4000);
      const alive = enemiesRef.current.filter((e) => e.health > 0);
      if (alive.length === 0 && waveTimer.current === null) {
        waveTimer.current = window.setTimeout(() => {
          waveTimer.current = null;
          spawnWave();
        }, 1400);
      }
      if (enemiesRef.current.length !== before) tick((t) => t + 1);
    }, 400);
    return () => window.clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frozen, side.dead]);

  const takeDamage = (dmg: number) => {
    if (side.dead || frozen) return;
    side.health = Math.max(0, side.health - dmg);
    side.hitLock = 0.25;
    if (side.health <= 0 && !side.dead) {
      side.dead = true;
      onDeath(side.id);
    }
    tick((t) => t + 1);
  };

  const strike = (enemy: VersusEnemyState) => {
    if (enemy.health <= 0) return;
    enemy.health = Math.max(0, enemy.health - VERSUS_PLAYER_DAMAGE);
    if (enemy.health === 0) {
      enemy.diedAt = Date.now();
      side.kills += 1;
    }
    tick((t) => t + 1);
  };

  const room = side.room;

  return (
    <div style={{ position: 'relative', flex: 1, minWidth: 0, height: '100%', borderLeft: side.id === 'ai' ? '2px solid rgba(255,255,255,0.15)' : undefined }}>
      <Canvas shadows camera={{ position: [0, 15, 17], fov: 52 }}>
        <color attach="background" args={[room.sky]} />
        <fog attach="fog" args={[room.fog, room.fogNear, room.fogFar]} />
        <ambientLight intensity={room.ambientIntensity} />
        <directionalLight position={[6, 18, 8]} intensity={room.lightIntensity} color={room.lightColor} castShadow />
        <Stepper />
        <ChaseCam side={side} />
        <VersusArenaFloor room={room} />
        <VersusFighter side={side} enemies={enemiesRef.current} onStrike={strike} frozen={frozen} />
        {enemiesRef.current.map((e) => (
          <VersusEnemy key={e.id} state={e} target={side} onHitPlayer={takeDamage} frozen={frozen} />
        ))}
      </Canvas>

      <div
        style={{
          position: 'absolute',
          top: 12,
          left: 12,
          right: 12,
          fontFamily: 'Rajdhani, sans-serif',
          pointerEvents: 'none'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
          <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: 2, color: side.tint }}>
            {side.isHuman ? 'YOU' : 'AI'}
          </span>
          <span style={{ fontSize: 12, letterSpacing: 1.5, color: 'rgba(255,255,255,0.75)' }}>
            WAVE {side.wave} · {side.kills} KILLS
          </span>
        </div>
        <div style={{ height: 9, background: 'rgba(0,0,0,0.45)', borderRadius: 5, overflow: 'hidden' }}>
          <div
            style={{
              width: `${(side.health / VERSUS_MAX_HEALTH) * 100}%`,
              height: '100%',
              background: side.health > VERSUS_MAX_HEALTH * 0.3 ? side.tint : '#ff3b30',
              transition: 'width 0.15s'
            }}
          />
        </div>
        <div style={{ marginTop: 4, fontSize: 11, letterSpacing: 1.2, color: '#a6e22e' }}>
          TIER {room.tier} · {room.label.toUpperCase()}
        </div>
      </div>

      {side.dead && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            placeItems: 'center',
            background: 'rgba(60,0,0,0.35)',
            fontFamily: 'Rajdhani, sans-serif',
            fontSize: 30,
            fontWeight: 700,
            letterSpacing: 5,
            color: '#ff6b6b',
            pointerEvents: 'none'
          }}
        >
          DOWN
        </div>
      )}
    </div>
  );
};

interface ArenaVersusProps {
  playerTint: string;
  onExit: () => void;
}

export const ArenaVersus: React.FC<ArenaVersusProps> = ({ playerTint, onExit }) => {
  const sides = useRef<[VersusSideState, VersusSideState]>([
    createSide('player', true, playerTint),
    createSide('ai', false, randomAiTint(playerTint))
  ]).current;

  const [loser, setLoser] = useState<'player' | 'ai' | null>(null);

  const handleDeath = (id: 'player' | 'ai') => setLoser((prev) => prev ?? id);

  const frozen = loser !== null;
  const playerWon = loser === 'ai';

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#07090a', display: 'flex', position: 'relative' }}>
      <VersusSide side={sides[0]} onDeath={handleDeath} frozen={frozen} />
      <VersusSide side={sides[1]} onDeath={handleDeath} frozen={frozen} />

      <div
        style={{
          position: 'absolute',
          bottom: 14,
          left: '50%',
          transform: 'translateX(-50%)',
          fontFamily: 'Rajdhani, sans-serif',
          fontSize: 12,
          letterSpacing: 1.5,
          color: 'rgba(255,255,255,0.5)',
          pointerEvents: 'none'
        }}
      >
        ONE LIFE EACH · SEPARATE RUNS · LAST ONE STANDING WINS · WASD · F PUNCH · G KICK
      </div>

      {!frozen && (
        <button
          onClick={onExit}
          style={{
            position: 'absolute',
            top: 12,
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '6px 16px',
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: 1.5,
            borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.25)',
            background: 'rgba(0,0,0,0.5)',
            color: 'rgba(255,255,255,0.8)',
            cursor: 'pointer',
            fontFamily: 'Rajdhani, sans-serif',
            zIndex: 5
          }}
        >
          ← MENU
        </button>
      )}

      {frozen && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 18,
            background: 'rgba(5,8,9,0.82)',
            fontFamily: 'Rajdhani, sans-serif'
          }}
        >
          <div style={{ fontSize: 50, fontWeight: 700, letterSpacing: 7, color: playerWon ? '#a6e22e' : '#ff6b6b' }}>
            {playerWon ? 'YOU WIN' : 'YOU LOSE'}
          </div>
          <div style={{ fontSize: 15, letterSpacing: 2.5, color: 'rgba(255,255,255,0.6)' }}>
            YOU REACHED WAVE {sides[0].wave} · AI REACHED WAVE {sides[1].wave}
          </div>
          <button
            onClick={onExit}
            style={{
              marginTop: 10,
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
      )}
    </div>
  );
};
