import { asset } from '../world/assetPath';
import { normalizeSkinWeights } from '../world/skinWeights';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useFBX } from '@react-three/drei';
import * as THREE from 'three';
import { SkeletonUtils } from 'three-stdlib';
import { useInputs } from '../hooks/useInputs';
import { createRagdoll, RagdollHandle } from '../world/ragdoll';
import { physicsWorld, stepPhysicsWorld } from '../world/physicsWorld';
import { MaterialKey, getMaterialTexture } from '../world/proceduralTextures';
import { ArenaRoom, pickRoom } from '../world/arenaRooms';
import {
  UPGRADE_LABEL,
  VERSUS_ARENA_RADIUS,
  VERSUS_ATTACK_COOLDOWN,
  VERSUS_HIT_WINDUP,
  VERSUS_WAVES_PER_TIER,
  VersusEnemyState,
  VersusShot,
  VersusSideState,
  applyUpgrade,
  createSide,
  randomAiTint,
  rollUpgrade,
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

type VAnim = 'idle' | 'walk' | 'punch' | 'kick';

/**
 * The shared rig. MEMOISED, and that matters: returning a fresh object here
 * made every consumer's animator effect re-run on every render, rebuilding
 * the AnimationMixer constantly — which reset locomotion every frame and
 * cancelled attack one-shots before their hit ever landed. Both "animations
 * broken" and "attacking broken" were this one line.
 */
const useRig = () => {
  const base = useFBX(asset('/anims/stickman_base.fbx'));
  const idle = useFBX(asset('/anims/fighting-idle.fbx'));
  const walk = useFBX(asset('/anims/run.fbx'));
  const punch = useFBX(asset('/anims/punch.fbx'));
  const kick = useFBX(asset('/anims/kick.fbx'));
  normalizeSkinWeights(base);
  return useMemo(() => ({ base, idle, walk, punch, kick }), [base, idle, walk, punch, kick]);
};

const useStickman = (rig: ReturnType<typeof useRig>, tint?: string, material?: MaterialKey | null) => {
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
    if (from && from !== a) from.crossFadeTo(a, 0.07, false);
    current.current = name;
    oneShot.current = a.getClip().duration;
  };

  return { model, mixer, to, shot, oneShot };
};

// ── Enemy ─────────────────────────────────────────────────────────────────
const VersusEnemy: React.FC<{
  rig: ReturnType<typeof useRig>;
  state: VersusEnemyState;
  side: VersusSideState;
  onMelee: (dmg: number) => void;
  onShoot: (from: THREE.Vector3, dmg: number, color: string) => void;
  frozen: boolean;
}> = ({ rig, state, side, onMelee, onShoot, frozen }) => {
  const group = useRef<THREE.Group>(null);
  const { model, mixer, to, shot, oneShot } = useStickman(rig, state.material ? undefined : state.color, state.material);
  const ragdoll = useRef<RagdollHandle | null>(null);
  const pending = useRef<number | null>(null);

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
    if (frozen || side.dead) return;

    if (oneShot.current !== null) {
      oneShot.current -= dt;
      if (pending.current !== null) {
        pending.current -= dt;
        if (pending.current <= 0) {
          pending.current = null;
          if (state.ranged) onShoot(state.position, state.damage, state.color);
          else {
            const d = Math.hypot(side.position.x - state.position.x, side.position.z - state.position.z);
            if (d <= side.reach + state.scale) onMelee(state.damage);
          }
        }
      }
      if (oneShot.current <= 0) {
        oneShot.current = null;
        to('idle');
      }
    }
    state.attackCooldown = Math.max(0, state.attackCooldown - dt);

    const dx = side.position.x - state.position.x;
    const dz = side.position.z - state.position.z;
    const dist = Math.hypot(dx, dz) || 1;

    // Ranged types hold a firing line; melee close all the way in.
    const hold = state.ranged ? 8.5 : side.reach * 0.75 + state.scale * 0.4;
    let move = 0;
    if (dist > hold + 0.4) move = 1;
    else if (dist < hold - 0.8) move = -1;

    if (move !== 0 && oneShot.current === null) {
      state.position.x += (dx / dist) * state.speed * move * dt;
      state.position.z += (dz / dist) * state.speed * move * dt;
      to('walk');
    } else if (oneShot.current === null) {
      to('idle');
      const inRange = state.ranged ? dist < 16 : dist <= side.reach + state.scale;
      if (inRange && state.attackCooldown <= 0) {
        shot(!state.ranged && Math.random() < 0.4 ? 'kick' : 'punch');
        pending.current = VERSUS_HIT_WINDUP;
        state.attackCooldown = state.ranged ? 2.4 : 1.4;
      }
    }

    const r = Math.hypot(state.position.x, state.position.z);
    if (r > VERSUS_ARENA_RADIUS - 1) state.position.multiplyScalar((VERSUS_ARENA_RADIUS - 1) / r);

    g.rotation.y = Math.atan2(dx, dz);
    g.position.set(state.position.x, 0, state.position.z);
  });

  return (
    <group ref={group} position={[state.position.x, 0, state.position.z]} scale={state.scale}>
      <primitive object={model} scale={0.012} />
    </group>
  );
};

// ── Fighter ───────────────────────────────────────────────────────────────
const VersusFighter: React.FC<{
  rig: ReturnType<typeof useRig>;
  side: VersusSideState;
  enemies: VersusEnemyState[];
  onStrike: (e: VersusEnemyState) => void;
  frozen: boolean;
}> = ({ rig, side, enemies, onStrike, frozen }) => {
  const group = useRef<THREE.Group>(null);
  const { model, mixer, to, shot, oneShot } = useStickman(rig, side.tint, null);
  const ragdoll = useRef<RagdollHandle | null>(null);
  const victim = useRef<VersusEnemyState | null>(null);
  const pending = useRef(0);
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
      if (victim.current) {
        pending.current -= dt;
        if (pending.current <= 0) {
          const v = victim.current;
          victim.current = null;
          const d = Math.hypot(v.position.x - side.position.x, v.position.z - side.position.z);
          if (v.health > 0 && d <= side.reach + v.scale + 0.4) onStrike(v);
        }
      }
      if (oneShot.current <= 0) {
        oneShot.current = null;
        to('idle');
      }
    }
    side.attackCooldown = Math.max(0, side.attackCooldown - dt);
    side.hitLock = Math.max(0, side.hitLock - dt);

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
      // The AI now actually fights: it closes decisively, strafes around the
      // target while its swing is on cooldown instead of standing still, and
      // retreats when badly hurt so it is not simply traded down.
      const hurt = side.health < side.maxHealth * 0.3;
      const engage = side.reach * 0.8;
      if (hurt && nearestDist < 5) {
        mx = side.position.x - nearest.position.x;
        mz = side.position.z - nearest.position.z;
      } else if (nearestDist > engage) {
        mx = nearest.position.x - side.position.x;
        mz = nearest.position.z - side.position.z;
      } else if (side.attackCooldown > 0.15) {
        // Strafe: perpendicular to the line between us.
        mx = -(nearest.position.z - side.position.z);
        mz = nearest.position.x - side.position.x;
      }
      wantsAttack = nearestDist <= side.reach + nearest.scale;
    }

    const len = Math.hypot(mx, mz);
    if (len > 0.001 && oneShot.current === null && side.hitLock <= 0) {
      side.position.x += (mx / len) * side.speed * dt;
      side.position.z += (mz / len) * side.speed * dt;
      to('walk');
    } else if (oneShot.current === null) {
      to('idle');
    }

    const r = Math.hypot(side.position.x, side.position.z);
    if (r > VERSUS_ARENA_RADIUS - 1) side.position.multiplyScalar((VERSUS_ARENA_RADIUS - 1) / r);

    if (nearest && nearestDist < 16) {
      g.rotation.y = Math.atan2(nearest.position.x - side.position.x, nearest.position.z - side.position.z);
    } else if (len > 0.001) {
      g.rotation.y = Math.atan2(mx, mz);
    }

    if (
      wantsAttack &&
      nearest &&
      side.attackCooldown <= 0 &&
      side.hitLock <= 0 &&
      oneShot.current === null &&
      nearestDist <= side.reach + nearest.scale + 0.4
    ) {
      shot(side.isHuman && inputs.kick && !inputs.punch ? 'kick' : 'punch');
      victim.current = nearest;
      pending.current = VERSUS_HIT_WINDUP;
      side.attackCooldown = VERSUS_ATTACK_COOLDOWN / side.attackSpeed;
    }

    g.position.set(side.position.x, 0, side.position.z);
  });

  return (
    <group ref={group} position={[side.position.x, 0, side.position.z]}>
      <primitive object={model} scale={0.012} />
    </group>
  );
};

// ── Ranged shots ──────────────────────────────────────────────────────────
const Shots: React.FC<{ shots: VersusShot[]; side: VersusSideState; onHit: (dmg: number) => void; frozen: boolean }> = ({
  shots,
  side,
  onHit,
  frozen
}) => {
  const group = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (frozen) return;
    const dt = Math.min(delta, 0.05);
    for (const s of shots) {
      if (s.life <= 0) continue;
      s.position.addScaledVector(s.velocity, dt);
      s.life -= dt;
      if (Math.hypot(s.position.x - side.position.x, s.position.z - side.position.z) < 0.9) {
        s.life = 0;
        onHit(s.damage);
      }
    }
  });
  return (
    <group ref={group}>
      {shots
        .filter((s) => s.life > 0)
        .map((s) => (
          <mesh key={s.id} position={[s.position.x, 1, s.position.z]}>
            <sphereGeometry args={[0.22, 10, 10]} />
            <meshStandardMaterial color={s.color} emissive={s.color} emissiveIntensity={0.7} />
          </mesh>
        ))}
    </group>
  );
};

const ArenaFloor: React.FC<{ room: ArenaRoom }> = ({ room }) => {
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
        <circleGeometry args={[VERSUS_ARENA_RADIUS, 44]} />
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

/**
 * Renders the one scene twice, into the left and right halves, with a camera
 * per side. One WebGL context instead of two — two canvases was what lost the
 * context under load. Priority 1 takes rendering over from R3F entirely.
 */
const SplitRenderer: React.FC<{ sides: [VersusSideState, VersusSideState] }> = ({ sides }) => {
  const { gl, scene, size } = useThree();
  const cams = useMemo(
    () => sides.map(() => new THREE.PerspectiveCamera(52, size.width / 2 / size.height, 0.1, 800)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  useFrame(() => {
    const halfW = Math.floor(size.width / 2);
    const h = size.height;
    gl.setScissorTest(true);
    sides.forEach((side, i) => {
      const cam = cams[i];
      cam.aspect = halfW / h;
      cam.position.set(side.offsetX + side.position.x * 0.45, 15, side.position.z * 0.45 + 17);
      cam.lookAt(side.offsetX + side.position.x * 0.35, 1, side.position.z * 0.35);
      cam.updateProjectionMatrix();
      const x = i * halfW;
      gl.setViewport(x, 0, halfW, h);
      gl.setScissor(x, 0, halfW, h);
      gl.render(scene, cam);
    });
    gl.setScissorTest(false);
  }, 1);

  return null;
};

const Stepper: React.FC = () => {
  useFrame((_, d) => stepPhysicsWorld(d));
  return null;
};

// ── One side's world, offset in shared space ──────────────────────────────
const SideWorld: React.FC<{
  rig: ReturnType<typeof useRig>;
  side: VersusSideState;
  onDeath: (id: 'player' | 'ai') => void;
  onChange: () => void;
  frozen: boolean;
}> = ({ rig, side, onDeath, onChange, frozen }) => {
  const enemies = useRef<VersusEnemyState[]>([]).current;
  const shots = useRef<VersusShot[]>([]).current;
  const waveTimer = useRef<number | null>(null);

  const spawnWave = () => {
    side.wave += 1;
    if (side.wave > 1 && (side.wave - 1) % VERSUS_WAVES_PER_TIER === 0 && side.roomsEntered < 5) {
      side.roomsEntered += 1;
      side.room = pickRoom(tierFor(side.roomsEntered), side.room.id);
    }
    // Both sides earn one upgrade per wave, from the same pool at the same
    // rate. The AI was previously getting none at all, which made a long
    // match a foregone conclusion.
    if (side.wave > 1) applyUpgrade(side, rollUpgrade());
    enemies.splice(0, enemies.length, ...enemies.filter((e) => e.health > 0), ...versusWaveRoster(side));
    onChange();
  };

  useEffect(() => {
    const t = window.setTimeout(spawnWave, 1200);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const iv = window.setInterval(() => {
      if (frozen || side.dead) return;
      const now = Date.now();
      let changed = false;
      for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i];
        if (e.health <= 0 && e.diedAt !== null && now - e.diedAt > 4000) {
          enemies.splice(i, 1);
          changed = true;
        }
      }
      for (let i = shots.length - 1; i >= 0; i--) if (shots[i].life <= 0) shots.splice(i, 1);
      if (!enemies.some((e) => e.health > 0) && waveTimer.current === null) {
        waveTimer.current = window.setTimeout(() => {
          waveTimer.current = null;
          spawnWave();
        }, 1300);
      }
      if (changed) onChange();
    }, 400);
    return () => window.clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frozen, side.dead]);

  const damage = (dmg: number) => {
    if (side.dead || frozen) return;
    side.health = Math.max(0, side.health - dmg);
    side.hitLock = 0.22;
    if (side.health <= 0) {
      side.dead = true;
      onDeath(side.id);
    }
    onChange();
  };

  const strike = (e: VersusEnemyState) => {
    if (e.health <= 0) return;
    e.health = Math.max(0, e.health - side.damage);
    if (side.lifesteal > 0) side.health = Math.min(side.maxHealth, side.health + side.lifesteal);
    if (e.health === 0) {
      e.diedAt = Date.now();
      side.kills += 1;
    }
    onChange();
  };

  const shoot = (from: THREE.Vector3, dmg: number, color: string) => {
    const dx = side.position.x - from.x;
    const dz = side.position.z - from.z;
    const n = Math.hypot(dx, dz) || 1;
    shots.push({
      id: `s${Math.random().toString(36).slice(2, 9)}`,
      position: new THREE.Vector3(from.x, 0, from.z),
      velocity: new THREE.Vector3((dx / n) * 11, 0, (dz / n) * 11),
      color,
      damage: dmg,
      life: 3
    });
  };

  return (
    <group position={[side.offsetX, 0, 0]}>
      <ambientLight intensity={side.room.ambientIntensity} />
      <directionalLight position={[6, 18, 8]} intensity={side.room.lightIntensity} color={side.room.lightColor} castShadow />
      <ArenaFloor room={side.room} />
      <VersusFighter rig={rig} side={side} enemies={enemies} onStrike={strike} frozen={frozen} />
      {enemies.map((e) => (
        <VersusEnemy key={e.id} rig={rig} state={e} side={side} onMelee={damage} onShoot={shoot} frozen={frozen} />
      ))}
      <Shots shots={shots} side={side} onHit={damage} frozen={frozen} />
    </group>
  );
};

const Scene: React.FC<{
  sides: [VersusSideState, VersusSideState];
  onDeath: (id: 'player' | 'ai') => void;
  onChange: () => void;
  frozen: boolean;
}> = ({ sides, onDeath, onChange, frozen }) => {
  const rig = useRig();
  return (
    <>
      <Stepper />
      <SplitRenderer sides={sides} />
      {sides.map((s) => (
        <SideWorld key={s.id} rig={rig} side={s} onDeath={onDeath} onChange={onChange} frozen={frozen} />
      ))}
    </>
  );
};

// ── HUD ───────────────────────────────────────────────────────────────────
const SideHud: React.FC<{ side: VersusSideState; align: 'left' | 'right' }> = ({ side, align }) => {
  const showUpgrade = side.lastUpgrade && Date.now() - side.lastUpgradeAt < 2600;
  return (
    <div
      style={{
        position: 'absolute',
        top: 12,
        [align]: 12,
        width: 'calc(50% - 24px)',
        fontFamily: 'Rajdhani, sans-serif',
        pointerEvents: 'none'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
        <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: 2, color: side.tint }}>{side.isHuman ? 'YOU' : 'AI'}</span>
        <span style={{ fontSize: 12, letterSpacing: 1.5, color: 'rgba(255,255,255,0.78)' }}>
          WAVE {side.wave} · {side.kills} KILLS · {side.upgrades.length} UPG
        </span>
      </div>
      <div style={{ height: 9, background: 'rgba(0,0,0,0.5)', borderRadius: 5, overflow: 'hidden' }}>
        <div
          style={{
            width: `${(side.health / side.maxHealth) * 100}%`,
            height: '100%',
            background: side.health > side.maxHealth * 0.3 ? side.tint : '#ff3b30',
            transition: 'width 0.12s'
          }}
        />
      </div>
      <div style={{ marginTop: 4, fontSize: 11, letterSpacing: 1.2, color: '#a6e22e' }}>
        TIER {side.room.tier} · {side.room.label.toUpperCase()}
      </div>
      {showUpgrade && (
        <div style={{ marginTop: 5, fontSize: 12, letterSpacing: 1.5, color: '#ffd54f', fontWeight: 700 }}>
          ⬆ {UPGRADE_LABEL[side.lastUpgrade!]}
        </div>
      )}
      {side.dead && (
        <div style={{ marginTop: 8, fontSize: 22, fontWeight: 700, letterSpacing: 4, color: '#ff6b6b' }}>DOWN</div>
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
  const [, tick] = useState(0);
  const bump = () => tick((t) => t + 1);

  const frozen = loser !== null;
  const playerWon = loser === 'ai';

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#07090a', position: 'relative' }}>
      <Canvas shadows dpr={[1, 1.5]} gl={{ powerPreference: 'high-performance' }}>
        <color attach="background" args={['#07090a']} />
        <Scene sides={sides} onDeath={(id) => setLoser((p) => p ?? id)} onChange={bump} frozen={frozen} />
      </Canvas>

      <div
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: '50%',
          width: 2,
          background: 'rgba(255,255,255,0.16)',
          pointerEvents: 'none'
        }}
      />
      <SideHud side={sides[0]} align="left" />
      <SideHud side={sides[1]} align="right" />

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
        ONE LIFE EACH · SEPARATE RUNS · WASD · F PUNCH · G KICK
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
            background: 'rgba(0,0,0,0.55)',
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
            background: 'rgba(5,8,9,0.85)',
            fontFamily: 'Rajdhani, sans-serif'
          }}
        >
          <div style={{ fontSize: 50, fontWeight: 700, letterSpacing: 7, color: playerWon ? '#a6e22e' : '#ff6b6b' }}>
            {playerWon ? 'YOU WIN' : 'YOU LOSE'}
          </div>
          <div style={{ fontSize: 15, letterSpacing: 2.5, color: 'rgba(255,255,255,0.62)' }}>
            YOU: WAVE {sides[0].wave} · {sides[0].kills} KILLS &nbsp;—&nbsp; AI: WAVE {sides[1].wave} · {sides[1].kills} KILLS
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
