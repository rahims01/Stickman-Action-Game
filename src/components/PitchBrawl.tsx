import { asset } from '../world/assetPath';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useFBX } from '@react-three/drei';
import * as THREE from 'three';
import { SkeletonUtils } from 'three-stdlib';
import { useInputs } from '../hooks/useInputs';
import { FootballMesh } from './FootballMesh';
import { resolveCircleVsBoxes } from '../world/collision';
import { createRagdoll, RagdollHandle } from '../world/ragdoll';
import { physicsWorld, stepPhysicsWorld } from '../world/physicsWorld';
import {
  BALL_LINEAR_DAMPING,
  BALL_MAGNUS_K,
  BALL_MASS,
  BALL_RADIUS,
  BALL_RESTITUTION,
  BALL_REST_SPEED,
  BALL_SUBSTEPS,
  BallState,
  GOALS_TO_WIN,
  GOAL_HALF_WIDTH,
  GOAL_HEIGHT,
  GOAL_POST_RADIUS,
  KICKOFF_SETTLE_MS,
  KICK_REACH,
  PASS_SPEED,
  PITCH_HALF_X,
  PITCH_HALF_Z,
  PITCH_PLAYER_RADIUS,
  PITCH_WALL_COLLIDERS,
  PITCH_WALL_HEIGHT,
  PitchPlayerState,
  PitchSide,
  RUN_SPEED,
  SHOT_SPEED,
  SPRINT_BEYOND,
  SPRINT_SPEED,
  STRUCK_SPIN,
  TACKLE_COMMIT_RANGE,
  TACKLE_COOLDOWN,
  TACKLE_DOWN_MS,
  WHIFF_STUMBLE_MS,
  goalLineX,
  kickoffSpots,
  sweptGoalCheck
} from '../world/pitchBrawl';

const SIDE_COLORS: Record<PitchSide, string> = { home: '#c0392b', away: '#2c6fbb' };
const ROOT_BONE_NAME = 'mixamorigHips';
// Scratch vector for reading the ragdoll's hips back out each frame.
const hipsScratch = new THREE.Vector3();

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

interface MatchControl {
  // Mutable and read per frame — a render-time flag would latch on forever,
  // since nothing re-renders when the settle window simply elapses.
  frozenUntil: number;
  winner: PitchSide | null;
}

type PitchAnim = 'idle' | 'walk' | 'run' | 'kick';

// ── The pitch itself ──────────────────────────────────────────────────────
const PitchEnvironment: React.FC = () => {
  const goalPosts = (side: PitchSide) => {
    const x = goalLineX(side);
    return (
      <group key={side}>
        {[-GOAL_HALF_WIDTH, GOAL_HALF_WIDTH].map((z) => (
          <mesh key={z} position={[x, GOAL_HEIGHT / 2, z]} castShadow>
            <cylinderGeometry args={[GOAL_POST_RADIUS, GOAL_POST_RADIUS, GOAL_HEIGHT, 10]} />
            <meshStandardMaterial color="#f2f2f2" roughness={0.5} />
          </mesh>
        ))}
        <mesh position={[x, GOAL_HEIGHT, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[GOAL_POST_RADIUS, GOAL_POST_RADIUS, GOAL_HALF_WIDTH * 2, 10]} />
          <meshStandardMaterial color="#f2f2f2" roughness={0.5} />
        </mesh>
        {/* A shallow tinted slab in the mouth so the goal reads from across
            the pitch without needing a net mesh. */}
        <mesh position={[x + (side === 'home' ? 0.35 : -0.35), 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[GOAL_HALF_WIDTH * 2, 0.7]} />
          <meshStandardMaterial color={SIDE_COLORS[side]} transparent opacity={0.35} />
        </mesh>
      </group>
    );
  };

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[PITCH_HALF_X * 2, PITCH_HALF_Z * 2]} />
        <meshStandardMaterial color="#2f6b3a" roughness={0.95} />
      </mesh>
      {/* Halfway line and centre circle. */}
      <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.12, PITCH_HALF_Z * 2]} />
        <meshStandardMaterial color="#e8f0e8" transparent opacity={0.55} />
      </mesh>
      <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[2.4, 2.52, 40]} />
        <meshStandardMaterial color="#e8f0e8" transparent opacity={0.55} />
      </mesh>
      {PITCH_WALL_COLLIDERS.map((w) => (
        <mesh
          key={w.id}
          position={[(w.minX + w.maxX) / 2, PITCH_WALL_HEIGHT / 2, (w.minZ + w.maxZ) / 2]}
          castShadow
        >
          <boxGeometry args={[w.maxX - w.minX, PITCH_WALL_HEIGHT, w.maxZ - w.minZ]} />
          <meshStandardMaterial color="#243027" roughness={0.9} />
        </mesh>
      ))}
      {(['home', 'away'] as PitchSide[]).map(goalPosts)}
    </group>
  );
};

// ── One footballer ────────────────────────────────────────────────────────
interface ActorProps {
  state: PitchPlayerState;
  all: PitchPlayerState[];
  ball: BallState;
  onKick: (from: PitchPlayerState, dirX: number, dirZ: number, speed: number) => void;
  onTackle: (tackler: PitchPlayerState, victim: PitchPlayerState | null) => void;
  control: MatchControl;
}

const PitchActor: React.FC<ActorProps> = ({ state, all, ball, onKick, onTackle, control }) => {
  const groupRef = useRef<THREE.Group>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const actionsRef = useRef<{ [k in PitchAnim]?: THREE.AnimationAction }>({});
  const currentRef = useRef<PitchAnim>('idle');
  const oneShotRef = useRef<number | null>(null);
  const ragdollRef = useRef<RagdollHandle | null>(null);
  const aiKickCooldown = useRef(Math.random());
  const inputs = useInputs();

  const baseFbx = useFBX(asset('/anims/stickman_base.fbx'));
  const idleFbx = useFBX(asset('/anims/idle.fbx'));
  const walkFbx = useFBX(asset('/anims/walk.fbx'));
  const runFbx = useFBX(asset('/anims/run.fbx'));
  const kickFbx = useFBX(asset('/anims/kick.fbx'));

  const model = useMemo(() => SkeletonUtils.clone(baseFbx) as THREE.Group, [baseFbx]);

  useEffect(() => {
    model.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      const sources = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const cloned = sources.map((m) => {
        const c = (m as THREE.MeshStandardMaterial).clone();
        c.color.set(SIDE_COLORS[state.side]);
        return c;
      });
      // Preserve the single-vs-array shape. Assigning a one-element array to
      // a mesh whose geometry has no groups renders nothing at all.
      mesh.material = Array.isArray(mesh.material) ? cloned : cloned[0];
      mesh.castShadow = true;
    });
  }, [model, state.side]);

  useEffect(() => {
    const mixer = new THREE.AnimationMixer(model);
    mixerRef.current = mixer;
    const bind = (name: PitchAnim, fbx: THREE.Group, loop: boolean) => {
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
    bind('run', runFbx, true);
    bind('kick', kickFbx, false);
    actionsRef.current.idle?.play();
    ragdollRef.current = createRagdoll(model, physicsWorld);
    return () => {
      ragdollRef.current?.dispose();
      ragdollRef.current = null;
      mixer.stopAllAction();
    };
  }, [model, idleFbx, walkFbx, runFbx, kickFbx]);

  const transitionTo = (next: PitchAnim) => {
    if (currentRef.current === next) return;
    const from = actionsRef.current[currentRef.current];
    const to = actionsRef.current[next];
    if (!to) return;
    to.reset().play();
    if (from) from.crossFadeTo(to, 0.18, false);
    currentRef.current = next;
  };

  const playKick = () => {
    const action = actionsRef.current.kick;
    if (!action) return;
    const from = actionsRef.current[currentRef.current];
    action.reset().play();
    if (from && from !== action) from.crossFadeTo(action, 0.1, false);
    currentRef.current = 'kick';
    oneShotRef.current = action.getClip().duration;
  };

  useFrame((_, delta) => {
    const group = groupRef.current;
    if (!group) return;
    const dt = Math.min(delta, 0.05);
    mixerRef.current?.update(dt);
    const now = Date.now();
    const pos = state.position;

    // Down: hand the body to physics for a real ragdoll, or just lock input
    // for the lighter whiff stumble.
    const isDown = now < state.downUntilMs;
    if (isDown) {
      if (state.downIsRagdoll && !ragdollRef.current?.isActive()) ragdollRef.current?.activate();
      if (ragdollRef.current?.isActive()) {
        ragdollRef.current.update();
        ragdollRef.current.getHipsWorldPosition(hipsScratch);
        pos.x = hipsScratch.x;
        pos.z = hipsScratch.z;
      }
      group.position.set(pos.x, 0, pos.z);
      return;
    }
    if (ragdollRef.current?.isActive()) {
      // dispose() re-arms the rig and leaves the mixer untouched, so normal
      // animation resumes the instant the next state plays.
      ragdollRef.current.dispose();
      transitionTo('idle');
    }

    if (oneShotRef.current !== null) {
      oneShotRef.current -= dt;
      if (oneShotRef.current <= 0) {
        oneShotRef.current = null;
        transitionTo('idle');
      }
    }
    state.tackleCooldown = Math.max(0, state.tackleCooldown - dt);
    if (control.winner !== null || now < control.frozenUntil) {
      group.position.set(pos.x, 0, pos.z);
      return;
    }

    const prevX = pos.x;
    const prevZ = pos.z;
    let moveX = 0;
    let moveZ = 0;
    let speed = 0;
    let wantsAction = false;

    const bdx = ball.position.x - pos.x;
    const bdz = ball.position.z - pos.z;
    const ballDist = Math.hypot(bdx, bdz);

    if (state.isHuman) {
      if (inputs.forward) moveZ -= 1;
      if (inputs.backward) moveZ += 1;
      if (inputs.left) moveX -= 1;
      if (inputs.right) moveX += 1;
      speed = inputs.run ? SPRINT_SPEED : RUN_SPEED;
      wantsAction = inputs.kick;
    } else {
      // Two roles, straight from Ultimate Soccer's spec. Whoever on this side
      // is nearest the ball presses it; the other holds a covering position
      // between the ball and their own goal, offset to one side.
      const mates = all.filter((p) => p.side === state.side && p.id !== state.id && Date.now() >= p.downUntilMs);
      const iAmNearest = mates.every(
        (m) => Math.hypot(ball.position.x - m.position.x, ball.position.z - m.position.z) >= ballDist
      );
      if (iAmNearest) {
        moveX = bdx;
        moveZ = bdz;
        speed = ballDist > SPRINT_BEYOND ? SPRINT_SPEED : RUN_SPEED;
        wantsAction = true;
      } else {
        const ownGoal = goalLineX(state.side);
        const tx = (ball.position.x + ownGoal) / 2;
        const tz = ball.position.z * 0.5 + (state.id.charCodeAt(state.id.length - 1) % 2 ? 3.5 : -3.5);
        moveX = tx - pos.x;
        moveZ = tz - pos.z;
        speed = RUN_SPEED * 0.85;
        if (Math.hypot(moveX, moveZ) < 0.6) speed = 0;
      }
    }

    const moveLen = Math.hypot(moveX, moveZ);
    if (moveLen > 0.001 && speed > 0 && oneShotRef.current === null) {
      const step = (speed * dt) / moveLen;
      pos.x += moveX * step;
      pos.z += moveZ * step;
      group.rotation.y = Math.atan2(moveX, moveZ);
      transitionTo(speed >= SPRINT_SPEED ? 'run' : 'walk');
    } else if (oneShotRef.current === null) {
      transitionTo('idle');
    }

    // Players collide with the walls but pass through each other — bodies
    // jamming in the goal mouth was worse than the occasional overlap.
    const resolved = resolveCircleVsBoxes(prevX, prevZ, pos.x, pos.z, PITCH_PLAYER_RADIUS, PITCH_WALL_COLLIDERS);
    pos.x = resolved.x;
    pos.z = resolved.z;

    // One button. Near the ball it shoots; near an opponent it tackles.
    if (wantsAction && oneShotRef.current === null && state.tackleCooldown <= 0) {
      let victim: PitchPlayerState | null = null;
      let victimDist = Infinity;
      for (const other of all) {
        if (other.side === state.side || Date.now() < other.downUntilMs) continue;
        const d = Math.hypot(other.position.x - pos.x, other.position.z - pos.z);
        if (d < victimDist) {
          victimDist = d;
          victim = other;
        }
      }
      const canShoot = ballDist < KICK_REACH + BALL_RADIUS;
      const canTackle = victim !== null && victimDist < TACKLE_COMMIT_RANGE;

      if (canShoot && (!canTackle || ballDist <= victimDist)) {
        playKick();
        const goalX = goalLineX(state.side === 'home' ? 'away' : 'home');
        // The human shoots where they're facing; the AI aims at the mouth.
        let dx: number;
        let dz: number;
        if (state.isHuman) {
          dx = Math.sin(group.rotation.y);
          dz = Math.cos(group.rotation.y);
        } else {
          dx = goalX - pos.x;
          dz = -pos.z + (Math.random() - 0.5) * GOAL_HALF_WIDTH;
        }
        const n = Math.hypot(dx, dz) || 1;
        const towardGoal = Math.sign(goalX) === Math.sign(dx);
        onKick(state, dx / n, dz / n, towardGoal ? SHOT_SPEED : PASS_SPEED);
        state.tackleCooldown = TACKLE_COOLDOWN;
      } else if (canTackle) {
        playKick();
        onTackle(state, victim);
        state.tackleCooldown = TACKLE_COOLDOWN;
      } else if (state.isHuman) {
        // Committed to nothing: a whiff still costs you.
        playKick();
        onTackle(state, null);
        state.tackleCooldown = TACKLE_COOLDOWN;
      }
    }
    if (!state.isHuman) aiKickCooldown.current = Math.max(0, aiKickCooldown.current - dt);

    group.position.set(pos.x, 0, pos.z);
  });

  return (
    <group ref={groupRef} position={[state.position.x, 0, state.position.z]}>
      <primitive object={model} scale={0.012} />
    </group>
  );
};

// ── The ball ──────────────────────────────────────────────────────────────
interface BallProps {
  ball: BallState;
  onGoal: (concededBy: PitchSide) => void;
  control: MatchControl;
}

const Ball: React.FC<BallProps> = ({ ball, onGoal, control }) => {
  const ref = useRef<THREE.Group>(null);
  const rollAxis = useRef(new THREE.Vector3());

  useFrame((_, delta) => {
    const group = ref.current;
    if (!group) return;
    const dt = Math.min(delta, 0.05);
    if (control.winner === null && Date.now() >= control.frozenUntil) {
      const sub = dt / BALL_SUBSTEPS;
      for (let i = 0; i < BALL_SUBSTEPS; i++) {
        const px = ball.position.x;
        const pz = ball.position.z;

        // Magnus, as a constant turn rate on the heading. Perpendicular
        // acceleration is (k/m)*omega*v, and converting to angular rate
        // divides by v — so the bend rate is speed-independent.
        const sp = Math.hypot(ball.velocity.x, ball.velocity.z);
        if (ball.spin !== 0 && sp >= 3) {
          const ang = (BALL_MAGNUS_K / BALL_MASS) * ball.spin * sub;
          const cos = Math.cos(ang);
          const sin = Math.sin(ang);
          const vx = ball.velocity.x * cos - ball.velocity.z * sin;
          const vz = ball.velocity.x * sin + ball.velocity.z * cos;
          ball.velocity.x = vx;
          ball.velocity.z = vz;
        }

        const nx = px + ball.velocity.x * sub;
        const nz = pz + ball.velocity.z * sub;

        const scored = sweptGoalCheck(px, pz, nx, nz);
        if (scored) {
          onGoal(scored);
          return;
        }

        // Walls bounce rather than stop — a ball dying against the boards
        // would kill the flow of a match, unlike the weapon ball in the
        // main game where stopping keeps it findable.
        let bx = nx;
        let bz = nz;
        if (Math.abs(bx) > PITCH_HALF_X - BALL_RADIUS) {
          bx = Math.sign(bx) * (PITCH_HALF_X - BALL_RADIUS);
          ball.velocity.x *= -BALL_RESTITUTION;
        }
        if (Math.abs(bz) > PITCH_HALF_Z - BALL_RADIUS) {
          bz = Math.sign(bz) * (PITCH_HALF_Z - BALL_RADIUS);
          ball.velocity.z *= -BALL_RESTITUTION;
        }
        ball.position.x = bx;
        ball.position.z = bz;
      }

      const decay = Math.pow(1 - BALL_LINEAR_DAMPING, dt);
      ball.velocity.multiplyScalar(decay);
      ball.spin *= decay;
      if (ball.velocity.length() < BALL_REST_SPEED) {
        ball.velocity.set(0, 0, 0);
        ball.spin = 0;
      }
    }

    group.position.set(ball.position.x, BALL_RADIUS, ball.position.z);
    const sp = Math.hypot(ball.velocity.x, ball.velocity.z);
    if (sp > 1e-4) {
      rollAxis.current.set(0, 1, 0).cross(ball.velocity).normalize();
      group.rotateOnWorldAxis(rollAxis.current, (sp * dt) / BALL_RADIUS);
    }
  });

  return (
    <group ref={ref} position={[0, BALL_RADIUS, 0]}>
      <FootballMesh radius={BALL_RADIUS} />
    </group>
  );
};

const PhysicsStepper: React.FC = () => {
  useFrame((_, delta) => stepPhysicsWorld(delta));
  return null;
};

// Fixed broadcast-style camera. The mode is small enough to see whole, and a
// static view keeps the ball readable in a way a chase camera does not.
const PitchCamera: React.FC<{ ball: BallState }> = ({ ball }) => {
  useFrame((state) => {
    const cam = state.camera;
    cam.position.set(ball.position.x * 0.25, 20, PITCH_HALF_Z + 17);
    cam.lookAt(ball.position.x * 0.2, 0, 0);
  });
  return null;
};

interface PitchBrawlProps {
  onExit: () => void;
}

export const PitchBrawl: React.FC<PitchBrawlProps> = ({ onExit }) => {
  const [score, setScore] = useState<Record<PitchSide, number>>({ home: 0, away: 0 });
  const [winner, setWinner] = useState<PitchSide | null>(null);
  // Read every frame by the ball and the players. Kept out of React state
  // because the settle window ending is not a render-triggering event.
  const control = useRef<MatchControl>({ frozenUntil: Date.now() + KICKOFF_SETTLE_MS, winner: null }).current;

  const ball = useRef<BallState>({
    position: new THREE.Vector3(),
    velocity: new THREE.Vector3(),
    spin: 0,
    lastTouchSide: null
  }).current;

  const players = useRef<PitchPlayerState[]>(
    (['home', 'away'] as PitchSide[]).flatMap((side) =>
      Array.from({ length: 3 }, (_, i) => {
        const [x, z] = kickoffSpots(side, i);
        return {
          id: `${side}-${i}`,
          side,
          isHuman: side === 'home' && i === 0,
          position: new THREE.Vector3(x, 0, z),
          velocity: new THREE.Vector3(),
          downUntilMs: 0,
          downIsRagdoll: false,
          tackleCooldown: 0
        };
      })
    )
  ).current;

  const resetPositions = () => {
    ball.position.set(0, 0, 0);
    ball.velocity.set(0, 0, 0);
    ball.spin = 0;
    ball.lastTouchSide = null;
    players.forEach((p) => {
      const i = Number(p.id.split('-')[1]);
      const [x, z] = kickoffSpots(p.side, i);
      p.position.set(x, 0, z);
      p.velocity.set(0, 0, 0);
      p.downUntilMs = 0;
      p.tackleCooldown = 0;
    });
    control.frozenUntil = Date.now() + KICKOFF_SETTLE_MS;
  };

  const handleKick = (from: PitchPlayerState, dirX: number, dirZ: number, speed: number) => {
    ball.velocity.set(dirX * speed, 0, dirZ * speed);
    // Every struck ball carries spin, and which way it bends is random per
    // strike so a shooter can't be read after the first one.
    ball.spin = STRUCK_SPIN * (Math.random() < 0.5 ? -1 : 1);
    ball.lastTouchSide = from.side;
  };

  const handleTackle = (tackler: PitchPlayerState, victim: PitchPlayerState | null) => {
    const now = Date.now();
    if (victim) {
      // BOTH go down, for the same time. Equal costs take the attacker's
      // advantage to zero — otherwise flattening the last defender is a free
      // goal and the mode collapses into charge-flatten-tap-in.
      victim.downUntilMs = now + TACKLE_DOWN_MS;
      victim.downIsRagdoll = true;
      tackler.downUntilMs = now + TACKLE_DOWN_MS;
      tackler.downIsRagdoll = true;
    } else {
      tackler.downUntilMs = now + WHIFF_STUMBLE_MS;
      tackler.downIsRagdoll = false;
    }
  };

  const handleGoal = (concededBy: PitchSide) => {
    if (winner) return;
    const scorer: PitchSide = concededBy === 'home' ? 'away' : 'home';
    setScore((prev) => {
      const next = { ...prev, [scorer]: prev[scorer] + 1 };
      if (next[scorer] >= GOALS_TO_WIN) {
        control.winner = scorer;
        setWinner(scorer);
      }
      return next;
    });
    resetPositions();
  };

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', background: '#0d1310' }}>
      <Canvas shadows camera={{ position: [0, 20, PITCH_HALF_Z + 17], fov: 50 }}>
        <ambientLight intensity={0.65} />
        <directionalLight position={[8, 18, 6]} intensity={1.5} castShadow />
        <PhysicsStepper />
        <PitchCamera ball={ball} />
        <PitchEnvironment />
        <Ball ball={ball} onGoal={handleGoal} control={control} />
        {players.map((p) => (
          <PitchActor
            key={p.id}
            state={p}
            all={players}
            ball={ball}
            onKick={handleKick}
            onTackle={handleTackle}
            control={control}
          />
        ))}
      </Canvas>

      <div
        style={{
          position: 'absolute',
          top: 18,
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          alignItems: 'center',
          gap: 18,
          padding: '10px 22px',
          borderRadius: 12,
          background: 'rgba(8,12,10,0.72)',
          border: '1px solid rgba(255,255,255,0.14)',
          fontFamily: 'Rajdhani, sans-serif',
          letterSpacing: 2
        }}
      >
        <span style={{ color: SIDE_COLORS.home, fontSize: 26, fontWeight: 700 }}>{score.home}</span>
        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>FIRST TO {GOALS_TO_WIN}</span>
        <span style={{ color: SIDE_COLORS.away, fontSize: 26, fontWeight: 700 }}>{score.away}</span>
      </div>

      <div
        style={{
          position: 'absolute',
          bottom: 18,
          left: 18,
          color: 'rgba(255,255,255,0.55)',
          fontFamily: 'Rajdhani, sans-serif',
          fontSize: 13,
          letterSpacing: 1.5
        }}
      >
        WASD MOVE · SHIFT SPRINT · G SHOOT / TACKLE
      </div>

      {winner && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 20,
            background: 'rgba(6,10,8,0.82)',
            fontFamily: 'Rajdhani, sans-serif'
          }}
        >
          <div style={{ fontSize: 46, fontWeight: 700, letterSpacing: 6, color: SIDE_COLORS[winner] }}>
            {winner === 'home' ? 'YOU WIN' : 'YOU LOSE'}
          </div>
          <div style={{ fontSize: 20, color: 'rgba(255,255,255,0.6)', letterSpacing: 3 }}>
            {score.home} — {score.away}
          </div>
          <button
            onClick={onExit}
            style={{
              padding: '14px 40px',
              fontSize: 16,
              fontWeight: 700,
              letterSpacing: 2,
              borderRadius: 10,
              border: '2px solid #4fc3f7',
              background: 'rgba(79,195,247,0.12)',
              color: '#4fc3f7',
              cursor: 'pointer'
            }}
          >
            ← BACK TO MENU
          </button>
        </div>
      )}

      {!winner && (
        <button
          onClick={onExit}
          style={{
            position: 'absolute',
            top: 18,
            left: 18,
            padding: '8px 18px',
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: 1.5,
            borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.25)',
            background: 'rgba(255,255,255,0.06)',
            color: 'rgba(255,255,255,0.75)',
            cursor: 'pointer',
            fontFamily: 'Rajdhani, sans-serif'
          }}
        >
          ← MENU
        </button>
      )}
    </div>
  );
};
