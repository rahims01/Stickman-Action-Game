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
import { ArenaEnvironment } from './ArenaEnvironment';
import { Medkit } from './Medkit';
import { WAVES_PER_TIER } from '../world/arenaRooms';
import {
  UPGRADE_BLURB,
  UPGRADE_LABEL,
  VERSUS_ATTACK_COOLDOWN,
  VERSUS_HIT_WINDUP,
  VERSUS_INVULN,
  VERSUS_MEDKIT_HEAL,
  VERSUS_MEDKIT_RADIUS,
  VersusEnemyState,
  VersusMedkit,
  VersusShot,
  VersusSideState,
  VersusUpgrade,
  aiPickUpgrade,
  aiProfileFor,
  applyUpgrade,
  boundsFraction,
  clampToBounds,
  createSide,
  enterNextRoom,
  phaseForRoom,
  randomAiTint,
  randomRoomPos,
  rollUpgradeChoices,
  versusWaveRoster,
  wavesUntilNextRoom
} from '../world/arenaVersus';

const ROOT_BONE_NAME = 'mixamorigHips';
const hipsScratch = new THREE.Vector3();

// One render layer per side. Both arenas live in the same scene 400 units
// apart, so without this the AI's room lights the player's room and both
// rooms' fog fights over one scene. Each camera renders only its own layer.
const LAYER = { player: 1, ai: 2 } as const;

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

const useStickman = (
  rig: ReturnType<typeof useRig>,
  tint?: string,
  material?: MaterialKey | null,
  opacity = 1
) => {
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
        if (opacity < 1) {
          c.transparent = true;
          c.opacity = opacity;
          c.depthWrite = false;
        }
        c.needsUpdate = true;
        return c;
      });
      // Preserve single-vs-array: a one-element array on ungrouped geometry
      // renders nothing at all.
      mesh.material = Array.isArray(mesh.material) ? cloned : cloned[0];
      mesh.castShadow = opacity >= 1;
    });
  }, [model, tint, material, opacity]);

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
  siblings: VersusEnemyState[];
  onMelee: (dmg: number) => void;
  onShoot: (from: THREE.Vector3, dmg: number, color: string) => void;
  frozen: boolean;
}> = ({ rig, state, side, siblings, onMelee, onShoot, frozen }) => {
  const group = useRef<THREE.Group>(null);
  const { model, mixer, to, shot, oneShot } = useStickman(
    rig,
    state.material ? undefined : state.color,
    state.material,
    state.mirage ? 0.35 : 1
  );
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
    const hold = state.ranged ? 9 : side.reach * 0.75 + state.scale * 0.4;
    let move = 0;
    if (dist > hold + 0.4) move = 1;
    else if (dist < hold - 0.8) move = -1;

    if (move !== 0 && oneShot.current === null) {
      state.position.x += (dx / dist) * state.speed * move * dt;
      state.position.z += (dz / dist) * state.speed * move * dt;
      to('walk');
    } else if (oneShot.current === null) {
      to('idle');
      const inRange = state.ranged ? dist < 17 : dist <= side.reach + state.scale;
      if (inRange && state.attackCooldown <= 0) {
        shot(!state.ranged && Math.random() < 0.4 ? 'kick' : 'punch');
        pending.current = VERSUS_HIT_WINDUP;
        // Slower than the campaign's cycle: in here you are one fighter with
        // no upgrades against a whole wave, and the old rate emptied a health
        // bar in about four seconds.
        state.attackCooldown = state.ranged ? 2.8 : 1.7;
      }
    }

    // Mild separation so a wave does not collapse into one stack of bodies
    // occupying the same square metre.
    for (const other of siblings) {
      if (other === state || other.health <= 0) continue;
      const ox = state.position.x - other.position.x;
      const oz = state.position.z - other.position.z;
      const od = Math.hypot(ox, oz);
      const want = (state.scale + other.scale) * 0.7;
      if (od > 0.001 && od < want) {
        const push = ((want - od) / want) * 2.4 * dt;
        state.position.x += (ox / od) * push;
        state.position.z += (oz / od) * push;
      }
    }

    clampToBounds(state.position, side.bounds);

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
interface AiBrain {
  think: number;
  targetId: string | null;
  mode: 'engage' | 'retreat' | 'medkit';
  strafe: number;
  commit: boolean;
}

const VersusFighter: React.FC<{
  rig: ReturnType<typeof useRig>;
  side: VersusSideState;
  enemies: VersusEnemyState[];
  shots: VersusShot[];
  medkits: VersusMedkit[];
  onStrike: (e: VersusEnemyState) => void;
  onMedkit: (m: VersusMedkit) => void;
  frozen: boolean;
}> = ({ rig, side, enemies, shots, medkits, onStrike, onMedkit, frozen }) => {
  const group = useRef<THREE.Group>(null);
  const { model, mixer, to, shot, oneShot } = useStickman(rig, side.tint, null);
  const ragdoll = useRef<RagdollHandle | null>(null);
  const victim = useRef<VersusEnemyState | null>(null);
  const pending = useRef(0);
  const inputs = useInputs();
  const brain = useRef<AiBrain>({ think: 0, targetId: null, mode: 'engage', strafe: 1, commit: false });
  const steer = useRef(new THREE.Vector3()).current;

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
    side.invuln = Math.max(0, side.invuln - dt);

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
    let swingTarget: VersusEnemyState | null = nearest;

    if (side.isHuman) {
      if (inputs.forward) mz -= 1;
      if (inputs.backward) mz += 1;
      if (inputs.left) mx -= 1;
      if (inputs.right) mx += 1;
      wantsAttack = inputs.punch || inputs.kick;
    } else {
      // ── The AI ───────────────────────────────────────────────────────────
      // It used to walk at the nearest body and stand in it, which in a wave
      // of five meant being surrounded inside a couple of seconds. It now
      // picks a target on threat rather than proximity, refuses to be
      // enveloped, dodges shots, avoids lava, heals when there is a medkit,
      // and disengages outright when it is losing — on a reaction delay that
      // tightens as the run goes, so it reads as a player and not a script.
      const prof = aiProfileFor(side.wave);
      const b = brain.current;
      const frac = side.health / side.maxHealth;

      let crowd = 0;
      for (const e of enemies) {
        if (e.health <= 0 || e.mirage) continue;
        if (Math.hypot(e.position.x - side.position.x, e.position.z - side.position.z) < prof.crowdRadius) crowd++;
      }

      b.think -= dt;
      if (b.think <= 0) {
        b.think = prof.reaction;
        b.strafe = Math.random() < 0.5 ? -1 : 1;
        b.commit = Math.random() < prof.overcommit;

        const medkit = medkits.find((m) => !m.taken);
        if (frac < prof.retreatAt && !b.commit) b.mode = 'retreat';
        else if (frac < prof.medkitAt && medkit) b.mode = 'medkit';
        else if (crowd >= 3 && !b.commit) b.mode = 'retreat';
        else b.mode = 'engage';

        // Target by threat, not distance: something nearly dead is worth
        // finishing, and a Slinger that never closes has to be gone to.
        let best: VersusEnemyState | null = null;
        let bestScore = -Infinity;
        for (const e of enemies) {
          if (e.health <= 0) continue;
          const d = Math.hypot(e.position.x - side.position.x, e.position.z - side.position.z);
          let sc = -d;
          // A body it can finish this swing is worth crossing the room for.
          if (e.health <= side.damage) sc += 14;
          else if (e.health <= side.damage * 2) sc += 6;
          // Mirages are free kills and clear the screen.
          if (e.mirage) sc += 4;
          // Ranged enemies punish standing off, so they get priority once
          // they are reachable at all.
          if (e.ranged && d < 16) sc += 7;
          // Bulwarks are a wall — leave them for last unless nothing else.
          if (e.scale > 1.4) sc -= 8;
          if (sc > bestScore) {
            bestScore = sc;
            best = e;
          }
        }
        b.targetId = best ? best.id : null;
      }

      const target = b.targetId ? enemies.find((e) => e.id === b.targetId && e.health > 0) ?? nearest : nearest;
      swingTarget = target;
      const targetDist = target
        ? Math.hypot(target.position.x - side.position.x, target.position.z - side.position.z)
        : Infinity;

      steer.set(0, 0, 0);
      // Everything below pushes into steer as raw components; a Vector3 per
      // enemy per shot per tile per frame is a lot of garbage for no gain.
      const push = (x: number, z: number, w: number) => {
        const l = Math.hypot(x, z);
        if (l < 0.0001) return;
        steer.x += (x / l) * w;
        steer.z += (z / l) * w;
      };

      if (b.mode === 'medkit') {
        const kit = medkits.find((m) => !m.taken);
        if (kit) push(kit.position.x - side.position.x, kit.position.z - side.position.z, 1);
        else b.mode = 'engage';
      }

      if (b.mode === 'retreat') {
        // Away from the pack's centre of mass, not just the nearest body —
        // backing off from one enemy straight into two is how it died.
        let cx = 0;
        let cz = 0;
        let n = 0;
        for (const e of enemies) {
          if (e.health <= 0 || e.mirage) continue;
          const d = Math.hypot(e.position.x - side.position.x, e.position.z - side.position.z);
          if (d < prof.crowdRadius * 2.5) {
            cx += e.position.x;
            cz += e.position.z;
            n++;
          }
        }
        if (n > 0) push(side.position.x - cx / n, side.position.z - cz / n, 1.4);
      }

      if (b.mode === 'engage' && target) {
        const want = side.reach * 0.8 + target.scale * 0.4;
        const dirX = (target.position.x - side.position.x) / (targetDist || 1);
        const dirZ = (target.position.z - side.position.z) / (targetDist || 1);
        if (targetDist > want) {
          push(dirX, dirZ, 1.2);
        } else if (side.attackCooldown > 0.12) {
          // Circle while the swing is recharging rather than standing in
          // reach waiting to be hit.
          push(-dirZ * b.strafe, dirX * b.strafe, 1);
          push(-dirX, -dirZ, 0.35);
        }
      }

      // Personal space: every nearby enemy pushes, hardest when closest.
      for (const e of enemies) {
        if (e.health <= 0 || e.mirage) continue;
        const ox = side.position.x - e.position.x;
        const oz = side.position.z - e.position.z;
        const d = Math.hypot(ox, oz);
        if (d > 0.001 && d < prof.crowdRadius) push(ox, oz, (1 - d / prof.crowdRadius) * 1.1);
      }

      // Sidestep incoming shots rather than eating them.
      for (const s of shots) {
        if (s.life <= 0) continue;
        const rx = side.position.x - s.position.x;
        const rz = side.position.z - s.position.z;
        const d = Math.hypot(rx, rz);
        if (d > 6 || d < 0.001) continue;
        const vlen = Math.hypot(s.velocity.x, s.velocity.z) || 1;
        // Only dodge shots actually coming at it.
        if ((s.velocity.x / vlen) * (rx / d) + (s.velocity.z / vlen) * (rz / d) < 0.6) continue;
        push(-s.velocity.z * b.strafe, s.velocity.x * b.strafe, 1.6);
      }

      // Lava is not scenery.
      for (const tile of side.lava) {
        const lx = side.position.x - tile.position[0];
        const lz = side.position.z - tile.position[1];
        const d = Math.hypot(lx, lz);
        if (d < tile.radius + 1.4 && d > 0.001) push(lx, lz, 2);
      }

      // Do not get pinned against a wall.
      const edge = boundsFraction(side.position.x, side.position.z, side.bounds);
      if (edge > 0.82) push(-side.position.x, -side.position.z, (edge - 0.82) * 9);

      mx = steer.x;
      mz = steer.z;
      wantsAttack =
        b.mode !== 'retreat' &&
        !!target &&
        targetDist <= side.reach + target.scale + (b.commit ? 0.9 : 0.2);
    }

    const len = Math.hypot(mx, mz);
    if (len > 0.001 && oneShot.current === null && side.hitLock <= 0) {
      side.position.x += (mx / len) * side.speed * dt;
      side.position.z += (mz / len) * side.speed * dt;
      to('walk');
    } else if (oneShot.current === null) {
      to('idle');
    }

    clampToBounds(side.position, side.bounds);

    // Medkits: walking over one takes it.
    for (const m of medkits) {
      if (m.taken) continue;
      if (Math.hypot(m.position.x - side.position.x, m.position.z - side.position.z) < VERSUS_MEDKIT_RADIUS) onMedkit(m);
    }

    if (swingTarget && nearestDist < 18) {
      g.rotation.y = Math.atan2(swingTarget.position.x - side.position.x, swingTarget.position.z - side.position.z);
    } else if (len > 0.001) {
      g.rotation.y = Math.atan2(mx, mz);
    }

    if (
      wantsAttack &&
      swingTarget &&
      side.attackCooldown <= 0 &&
      side.hitLock <= 0 &&
      oneShot.current === null &&
      Math.hypot(swingTarget.position.x - side.position.x, swingTarget.position.z - side.position.z) <=
        side.reach + swingTarget.scale + 0.4
    ) {
      shot(side.isHuman && inputs.kick && !inputs.punch ? 'kick' : 'punch');
      victim.current = swingTarget;
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
    <group>
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

// Pitch-black rooms: the light the fighter carries. Follows in the frame
// loop, because the room is only dark if the light is where the body is.
const CarriedLight: React.FC<{ side: VersusSideState }> = ({ side }) => {
  const ref = useRef<THREE.PointLight>(null);
  useFrame(() => {
    if (ref.current) ref.current.position.set(side.position.x, 4, side.position.z);
  });
  return <pointLight ref={ref} color="#ffe9b0" intensity={2.4} distance={24} />;
};

// Molten rooms bring the solo arena's lava with them.
const VersusLava: React.FC<{ side: VersusSideState }> = ({ side }) => {
  const mats = useRef<THREE.MeshStandardMaterial[]>([]);
  useFrame((s) => {
    const pulse = 0.75 + Math.sin(s.clock.elapsedTime * 2.4) * 0.35;
    for (const m of mats.current) m.emissiveIntensity = pulse;
  });
  mats.current = [];
  return (
    <group>
      {side.lava.map((t) => (
        <mesh key={t.id} rotation={[-Math.PI / 2, 0, 0]} position={[t.position[0], 0.03, t.position[1]]}>
          <circleGeometry args={[t.radius, 24]} />
          <meshStandardMaterial
            ref={(m) => { if (m) mats.current.push(m); }}
            color="#ff5722"
            emissive="#ff3d00"
            emissiveIntensity={1}
            roughness={0.7}
          />
        </mesh>
      ))}
    </group>
  );
};

/**
 * Renders the one scene twice, into the left and right halves, with a camera
 * per side. One WebGL context instead of two — two canvases was what lost the
 * context under load. Priority 1 takes rendering over from R3F entirely.
 *
 * Fog is swapped per side on the way in, because each room brings its own and
 * a scene only has one.
 */
const SplitRenderer: React.FC<{ sides: [VersusSideState, VersusSideState] }> = ({ sides }) => {
  const { gl, scene, size } = useThree();
  const cams = useMemo(
    () =>
      sides.map((side) => {
        const c = new THREE.PerspectiveCamera(54, size.width / 2 / size.height, 0.1, 900);
        c.layers.set(LAYER[side.id]);
        return c;
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
  const fogs = useMemo(() => sides.map(() => new THREE.Fog('#000000', 20, 120)), []);
  const skies = useMemo(() => sides.map(() => new THREE.Color('#000000')), []);

  useFrame(() => {
    const halfW = Math.floor(size.width / 2);
    const h = size.height;
    gl.setScissorTest(true);
    sides.forEach((side, i) => {
      const cam = cams[i];
      const fog = fogs[i];
      fog.color.set(side.room.fog);
      fog.near = side.room.fogNear;
      fog.far = side.room.fogFar;
      scene.fog = fog;
      const sky = skies[i];
      sky.set(side.room.sky);
      scene.background = sky;

      // Pull the camera back for the big circular rooms so a 40-unit arena
      // is not shot from inside somebody's shoulder.
      const spread = side.bounds.kind === 'rect' ? 1 : Math.min(1.9, side.bounds.radius / 16);
      cam.aspect = halfW / h;
      cam.position.set(
        side.offsetX + side.position.x * 0.5,
        13 * spread,
        side.position.z * 0.5 + 15 * spread
      );
      cam.lookAt(side.offsetX + side.position.x * 0.7, 1, side.position.z * 0.7);
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
  onWaveCleared: (side: VersusSideState) => void;
  onChange: () => void;
  frozen: boolean;
}> = ({ rig, side, onDeath, onWaveCleared, onChange, frozen }) => {
  const root = useRef<THREE.Group>(null);
  const enemies = useRef<VersusEnemyState[]>([]).current;
  const shots = useRef<VersusShot[]>([]).current;
  const medkits = useRef<VersusMedkit[]>([]).current;
  const waveTimer = useRef<number | null>(null);
  const layerTimer = useRef(0);

  // Built by hand rather than as <directionalLight>, so its target can sit at
  // this side's own origin: a JSX light targets the scene origin, which for
  // the arena parked at x=400 means lit from the wrong direction with a
  // shadow camera pointed at nothing.
  const sun = useMemo(() => {
    const l = new THREE.DirectionalLight('#ffffff', 1);
    l.position.set(12, 30, 14);
    l.castShadow = true;
    l.shadow.mapSize.set(1024, 1024);
    const cam = l.shadow.camera as THREE.OrthographicCamera;
    cam.left = -46;
    cam.right = 46;
    cam.top = 46;
    cam.bottom = -46;
    cam.near = 1;
    cam.far = 110;
    cam.updateProjectionMatrix();
    return l;
  }, []);
  sun.color.set(side.room.lightColor);
  sun.intensity = side.room.lightIntensity;

  const spawnWave = () => {
    side.wave += 1;
    // One room per tier, eight waves each, tier 5 forever — the same cadence
    // the solo arena runs on, from the same table.
    if (side.wave > 1 && (side.wave - 1) % WAVES_PER_TIER === 0) enterNextRoom(side);
    // The arena drops a medkit every other wave; so does this.
    if (side.wave % 2 === 0) {
      medkits.push({ id: `${side.id}-kit-${side.wave}`, position: randomRoomPos(side.bounds, 0.6), taken: false });
    }
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
      for (let i = medkits.length - 1; i >= 0; i--) if (medkits[i].taken) { medkits.splice(i, 1); changed = true; }
      if (!enemies.some((e) => e.health > 0) && waveTimer.current === null) {
        waveTimer.current = window.setTimeout(() => {
          waveTimer.current = null;
          if (side.wave > 0) onWaveCleared(side);
          spawnWave();
        }, 1300);
      }
      if (changed) onChange();
    }, 400);
    return () => {
      window.clearInterval(iv);
      if (waveTimer.current !== null) window.clearTimeout(waveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frozen, side.dead]);

  // Everything under this group belongs to this side's render layer. Done on
  // a throttle rather than every frame because a wave of skinned rigs is a
  // few thousand nodes and nothing here changes that often.
  useFrame((_, delta) => {
    layerTimer.current -= delta;
    if (layerTimer.current > 0 || !root.current) return;
    layerTimer.current = 0.4;
    const layer = LAYER[side.id];
    root.current.traverse((o) => o.layers.set(layer));
  });

  const damage = (dmg: number) => {
    if (side.dead || frozen || side.invuln > 0 || dmg <= 0) return;
    side.health = Math.max(0, side.health - dmg);
    side.hitLock = 0.2;
    side.invuln = VERSUS_INVULN;
    if (side.health <= 0) {
      side.dead = true;
      onDeath(side.id);
    }
    onChange();
  };

  const strike = (e: VersusEnemyState) => {
    if (e.health <= 0) return;
    // A mirage pops on any contact at all.
    e.health = e.mirage ? 0 : Math.max(0, e.health - side.damage);
    if (side.lifesteal > 0 && !e.mirage) side.health = Math.min(side.maxHealth, side.health + side.lifesteal);
    if (e.health === 0) {
      e.diedAt = Date.now();
      if (!e.mirage) side.kills += 1;
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

  const takeMedkit = (m: VersusMedkit) => {
    if (m.taken || side.health >= side.maxHealth) return;
    m.taken = true;
    side.health = Math.min(side.maxHealth, side.health + VERSUS_MEDKIT_HEAL);
    onChange();
  };

  const phase = phaseForRoom(side.room);

  return (
    <group ref={root} position={[side.offsetX, 0, 0]}>
      <ambientLight intensity={side.room.darkness ? side.room.ambientIntensity * 0.5 : side.room.ambientIntensity} />
      <primitive object={sun} />
      <primitive object={sun.target} />
      {/* Dark rooms: the fighter carries the only useful light, same as the
          flashlight does in the solo arena. */}
      {side.room.darkness && <CarriedLight side={side} />}
      <ArenaEnvironment phase={phase} boxHalf={14} room={side.room} />
      <VersusLava side={side} />
      {medkits.filter((m) => !m.taken).map((m) => (
        <Medkit key={m.id} position={[m.position.x, 0, m.position.z]} />
      ))}
      <VersusFighter
        rig={rig}
        side={side}
        enemies={enemies}
        shots={shots}
        medkits={medkits}
        onStrike={strike}
        onMedkit={takeMedkit}
        frozen={frozen}
      />
      {enemies.map((e) => (
        <VersusEnemy
          key={e.id}
          rig={rig}
          state={e}
          side={side}
          siblings={enemies}
          onMelee={damage}
          onShoot={shoot}
          frozen={frozen}
        />
      ))}
      <Shots shots={shots} side={side} onHit={damage} frozen={frozen} />
    </group>
  );
};

const Scene: React.FC<{
  sides: [VersusSideState, VersusSideState];
  onDeath: (id: 'player' | 'ai') => void;
  onWaveCleared: (side: VersusSideState) => void;
  onChange: () => void;
  frozen: boolean;
}> = ({ sides, onDeath, onWaveCleared, onChange, frozen }) => {
  const rig = useRig();
  return (
    <>
      <Stepper />
      <SplitRenderer sides={sides} />
      {sides.map((s) => (
        <SideWorld
          key={s.id}
          rig={rig}
          side={s}
          onDeath={onDeath}
          onWaveCleared={onWaveCleared}
          onChange={onChange}
          frozen={frozen}
        />
      ))}
    </>
  );
};

// ── HUD ───────────────────────────────────────────────────────────────────
const SideHud: React.FC<{ side: VersusSideState; align: 'left' | 'right' }> = ({ side, align }) => {
  const showUpgrade = side.lastUpgrade && Date.now() - side.lastUpgradeAt < 2600;
  const left = wavesUntilNextRoom(side);
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
        <span style={{ color: 'rgba(255,255,255,0.5)' }}>
          {left === null ? ' · FINAL ROOM' : ` · ${left} WAVE${left === 1 ? '' : 'S'} TO NEXT ROOM`}
        </span>
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
  const [choices, setChoices] = useState<VersusUpgrade[] | null>(null);
  const [, tick] = useState(0);
  const bump = () => tick((t) => t + 1);

  // The picker freezes BOTH runs. In a race, one side deliberating while the
  // other keeps fighting is not a choice, it is a head start.
  const frozen = loser !== null || choices !== null;
  const playerWon = loser === 'ai';

  const handleWaveCleared = (side: VersusSideState) => {
    if (side.isHuman) {
      setChoices(rollUpgradeChoices(3));
    } else {
      const opts = rollUpgradeChoices(3);
      applyUpgrade(side, aiPickUpgrade(side, opts));
      bump();
    }
  };

  const pick = (up: VersusUpgrade) => {
    applyUpgrade(sides[0], up);
    setChoices(null);
    bump();
  };

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#07090a', position: 'relative' }}>
      <Canvas shadows dpr={[1, 1.5]} gl={{ powerPreference: 'high-performance' }}>
        <Scene
          sides={sides}
          onDeath={(id) => setLoser((p) => p ?? id)}
          onWaveCleared={handleWaveCleared}
          onChange={bump}
          frozen={frozen}
        />
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

      {choices && loser === null && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
            background: 'rgba(5,8,9,0.78)',
            fontFamily: 'Rajdhani, sans-serif',
            zIndex: 6
          }}
        >
          <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: 5, color: '#a6e22e' }}>WAVE {sides[0].wave} CLEAR</div>
          <div style={{ fontSize: 13, letterSpacing: 2, color: 'rgba(255,255,255,0.55)' }}>
            BOTH RUNS ARE PAUSED WHILE YOU CHOOSE
          </div>
          <div style={{ display: 'flex', gap: 14, marginTop: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
            {choices.map((c) => (
              <button
                key={c}
                onClick={() => pick(c)}
                style={{
                  width: 220,
                  padding: '18px 16px',
                  borderRadius: 12,
                  border: '2px solid rgba(79,195,247,0.6)',
                  background: 'rgba(79,195,247,0.09)',
                  color: '#fff',
                  cursor: 'pointer',
                  fontFamily: 'Rajdhani, sans-serif',
                  textAlign: 'left'
                }}
              >
                <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: 1.5, color: '#4fc3f7', marginBottom: 6 }}>
                  {UPGRADE_LABEL[c]}
                </div>
                <div style={{ fontSize: 12, lineHeight: 1.35, color: 'rgba(255,255,255,0.66)' }}>{UPGRADE_BLURB[c]}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {loser !== null && (
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
