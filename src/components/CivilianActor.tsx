import { asset } from '../world/assetPath';
import { normalizeSkinWeights } from '../world/skinWeights';
import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html, useFBX } from '@react-three/drei';
import * as THREE from 'three';
import { SkeletonUtils } from 'three-stdlib';
import { createRagdoll, RagdollHandle } from '../world/ragdoll';
import { physicsWorld } from '../world/physicsWorld';
import { circleCollidesWithBox, resolveCircleVsBoxes } from '../world/collision';
import { AABB, MAP_RADIUS, MedkitDef } from '../world/worldObjects';
import {
  ARMY_CHASE_SPEED,
  ARMY_FOCUS_DISTANCE_WEIGHT,
  ARMY_RADIO_COOLDOWN,
  ARMY_RADIO_SCAN_RADIUS,
  ARMY_SERGEANT_ATTACK_SPEED_BONUS,
  ARMY_SERGEANT_AURA_RADIUS,
  ARMY_SERGEANT_DAMAGE_BONUS,
  ARMY_KITE_SPEED,
  ARMY_MEDIC_ESCORT_DISTANCE,
  ARMY_MEDIC_FLEE_RADIUS,
  ARMY_MEDIC_HEAL_AMOUNT,
  ARMY_MEDIC_HEAL_COOLDOWN,
  ARMY_MEDIC_HEAL_RADIUS,
  ARMY_MEDIC_SEEK_RADIUS,
  ARMY_RANGED_MIN_RANGE,
  ARMY_SIGHT_RADIUS,
  BODYGUARD_FOLLOW_DISTANCE,
  CIVILIAN_FLEE_SPEED,
  CIVILIAN_FOLLOW_DISTANCE,
  CIVILIAN_LOW_HEALTH_FRACTION,
  CIVILIAN_SIGHT_RADIUS,
  CIVILIAN_WALK_SPEED,
  CORPSE_SINK_DELAY,
  CORPSE_SINK_DURATION,
  CivilianRole,
  ENEMY_ATTACK_RANGE,
  ENEMY_RANGED_ATTACK_RANGE,
  EnemyState,
  HUMANOID_RADIUS,
  ARMY_MEDKIT_SEEK_FRACTION,
  ARMY_MEDKIT_URGENT_FRACTION,
  ARMY_SUPPORT_LOW_FRACTION,
  ARMY_SUPPORT_RADIUS,
  ARMY_SUPPORT_RESPONDERS,
  BODYGUARD_PROTECT_DISTANCE,
  CIVILIAN_SEEK_ARMY_RADIUS,
  CivilianState,
  MEDKIT_PICKUP_RADIUS,
  armyLoadoutFor,
  isArmyRole,
  isFightingArmyRole
} from '../world/gameState';
import { ProjectilesHandle } from './Projectiles';
import {
  StatusEffects,
  getSlowFactor,
  hasAura,
  isFrozen,
  isPulled,
  isRagdollStunned,
  tickBurn
} from '../world/statusEffects';

interface CivilianActorProps {
  id: string;
  // 'civilian' wanders and flees; army roles fight when provoked; the
  // bodyguard shadows the player. See CivilianRole in gameState.ts.
  role?: CivilianRole;
  health: number;
  maxHealth: number;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  fearsPlayer: boolean;
  followingPlayer: boolean;
  // Army/bodyguard aggro (set by GameCanvas when they witness an attack).
  aggroPlayer?: boolean;
  aggroEnemyId?: string;
  aggroUntilMs?: number;
  // Bodyguards: whose civilian to escort. Unset means the player.
  protectCivilianId?: string;
  // Bystander panic (plain civilians): saw a fellow civilian/armyman get
  // attacked nearby - flee away from the scene until this expires.
  panicUntilMs?: number;
  panicFromX?: number;
  panicFromZ?: number;
  playerRef: React.RefObject<THREE.Group>;
  enemies: EnemyState[];
  colliders: AABB[];
  isPaused: boolean;
  forceSinkNow?: boolean;
  projectilesRef?: React.RefObject<ProjectilesHandle>;
  onArmyAttackEnemy?: (enemyId: string, damage: number) => void;
  onArmyAttackPlayer?: (damage: number, attackerPosition: THREE.Vector3, now: number, attackerId: string) => void;
  // Own status-effect struct (see CivilianState) - enemy specials (burn,
  // freeze, stun, pull, knockback, slow) apply here exactly like they do
  // to the player, via GameCanvas's handleAttackCivilian.
  statusEffects: StatusEffects;
  onBurnDamage: (civilianId: string, amount: number) => void;
  showHealthBar?: boolean;
  // The full roster, so an army man can spot a comrade in trouble and a
  // frightened civilian can run toward the nearest soldier.
  civilians: CivilianState[];
  // Army men break off to heal when hurt; picking one up consumes it.
  medkits: MedkitDef[];
  onTakeMedkit?: (civilianId: string, medkitId: string) => void;
  // Medic Soldier patching up a comrade.
  onMedicHeal?: (targetCivilianId: string, amount: number) => void;
  // Radioman calling in more soldiers.
  onCallReinforcements?: (near: THREE.Vector3) => void;
  onSunk: (id: string) => void;
}

type CivilianAnimState = 'idle' | 'terrified' | 'walk' | 'flee' | 'punch' | 'throw';

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

const SINK_DEPTH = 2.2;
const CIVILIAN_COLORS = ['#e8d8c3', '#d7e3f4', '#e4d9ee', '#dcecd5', '#f4e3d7'];
const ROLE_COLORS: Record<Exclude<CivilianRole, 'civilian'>, string> = {
  armyMelee: '#4b5320',
  armyRanged: '#33691e',
  // Field white rather than fatigue green - you are meant to be able to pick
  // him out of a squad at a glance, because he is the one worth killing first.
  armyMedic: '#e8f1e4',
  // Officer khaki: lighter and warmer than the line, so he reads as the one
  // giving orders.
  armySergeant: '#8d7b3f',
  // Heavy plate grey-green.
  armyShield: '#5d6b52',
  // Signals blue-green, with the pack on his back doing the rest.
  armyRadio: '#3f6b5c',
  bodyguard: '#263238',
  // The VIP reads as somebody important: pale suit, stands out in a crowd.
  vip: '#ffd54f'
};

// A harmless sandbox wanderer. Strolls around aimlessly; the moment any
// living enemy (or the player, once they've hit him) comes into sight he
// bolts with the goofy-run clip while the enemy gives chase. Badly hurt,
// his idle becomes a terrified cower; rescued (player kills the chaser
// nearby), he tails the player for protection. Dies like everything else in
// this game: no death clip, instant ragdoll.
export const CivilianActor: React.FC<CivilianActorProps> = ({
  id,
  role = 'civilian',
  health,
  maxHealth,
  position,
  velocity,
  fearsPlayer,
  followingPlayer,
  aggroPlayer = false,
  aggroEnemyId,
  aggroUntilMs = 0,
  protectCivilianId,
  panicUntilMs = 0,
  panicFromX,
  panicFromZ,
  playerRef,
  enemies,
  colliders,
  isPaused,
  forceSinkNow,
  projectilesRef,
  onArmyAttackEnemy,
  onArmyAttackPlayer,
  statusEffects,
  onBurnDamage,
  showHealthBar = true,
  civilians,
  medkits,
  onTakeMedkit,
  onMedicHeal,
  onCallReinforcements,
  onSunk
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const actionsRef = useRef<{ [key in CivilianAnimState]?: THREE.AnimationAction }>({});
  const currentActionRef = useRef<CivilianAnimState>('idle');
  const ragdollRef = useRef<RagdollHandle | null>(null);
  const materialsRef = useRef<THREE.MeshStandardMaterial[]>([]);
  const frozenRef = useRef(false);
  const frozenBaseYRef = useRef(0);
  const deadTimeRef = useRef(0);
  const sunkNotifiedRef = useRef(false);
  const hasSpawnedRef = useRef(false);
  // Wander cycle: walk a random heading for a bit, stand for a bit, repeat.
  const wanderTimerRef = useRef(1 + Math.random() * 2);
  const wanderMovingRef = useRef(false);
  const wanderHeadingRef = useRef(Math.random() * Math.PI * 2);
  // Status-effect plumbing (mirrors Player.tsx's handling).
  const isStunRagdollingRef = useRef(false);
  const knockbackVelocityRef = useRef(new THREE.Vector3());
  // Army combat: one-shot attack anim timer + pending hit application.
  const oneShotTimerRef = useRef<number | null>(null);
  const attackCooldownRef = useRef(0.5 + Math.random());
  const healCooldownRef = useRef(Math.random());
  const radioCooldownRef = useRef(4 + Math.random() * 4);
  // Damage of the swing currently in the air (see the melee branch below).
  const meleeDamageRef = useRef(0);
  const pendingMeleeRef = useRef<{ impactIn: number; target: { kind: 'player' } | { kind: 'enemy'; id: string } } | null>(null);

  const baseFbx = useFBX(asset('/anims/stickman_base.fbx'));
  // Repair the >4-influence weights three silently truncates on load;
  // shared geometry means this runs once no matter how many actors mount.
  normalizeSkinWeights(baseFbx);
  const idleAnim = useFBX(asset('/anims/idle.fbx'));
  const terrifiedAnim = useFBX(asset('/anims/terrified.fbx'));
  const walkAnim = useFBX(asset('/anims/walk.fbx'));
  const goofyRunAnim = useFBX(asset('/anims/goofy-running.fbx'));
  const punchAnim = useFBX(asset('/anims/punch.fbx'));
  const throwAnim = useFBX(asset('/anims/throw.fbx'));

  const model = useMemo(() => SkeletonUtils.clone(baseFbx) as THREE.Group, [baseFbx]);
  const tint = useMemo(
    () => (role === 'civilian' ? CIVILIAN_COLORS[Math.floor(Math.random() * CIVILIAN_COLORS.length)] : ROLE_COLORS[role]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  useEffect(() => {
    ragdollRef.current = createRagdoll(model, physicsWorld);
    return () => {
      ragdollRef.current?.dispose();
      ragdollRef.current = null;
    };
  }, [model]);

  useEffect(() => {
    const materials: THREE.MeshStandardMaterial[] = [];
    model.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const sourceMaterials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        const cloned = sourceMaterials.map((mat) => (mat as THREE.MeshStandardMaterial).clone());
        mesh.material = Array.isArray(mesh.material) ? cloned : cloned[0];
        cloned.forEach((mat) => {
          if (mat && 'color' in mat) {
            mat.color.set(tint);
            materials.push(mat);
          }
        });
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });
    materialsRef.current = materials;
  }, [model, tint]);

  useEffect(() => {
    const mixer = new THREE.AnimationMixer(model);
    mixerRef.current = mixer;
    const clips: [CivilianAnimState, THREE.AnimationClip | undefined][] = [
      ['idle', idleAnim.animations[0]],
      ['terrified', terrifiedAnim.animations[0]],
      ['walk', walkAnim.animations[0]],
      ['flee', goofyRunAnim.animations[0]]
    ];
    clips.forEach(([key, clip]) => {
      if (!clip) return;
      stripRootMotion(clip);
      actionsRef.current[key] = mixer.clipAction(clip);
    });
    // Army roles get combat one-shots.
    ([['punch', punchAnim.animations[0]], ['throw', throwAnim.animations[0]]] as [CivilianAnimState, THREE.AnimationClip | undefined][]).forEach(([key, clip]) => {
      if (!clip) return;
      stripRootMotion(clip);
      const action = mixer.clipAction(clip);
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
      actionsRef.current[key] = action;
    });
    actionsRef.current.idle?.play();
    return () => {
      mixer.stopAllAction();
    };
  }, [model, idleAnim, terrifiedAnim, walkAnim, goofyRunAnim, punchAnim, throwAnim]);

  const transitionTo = (next: CivilianAnimState, fade = 0.2) => {
    if (currentActionRef.current === next) return;
    const prevAction = actionsRef.current[currentActionRef.current];
    const nextAction = actionsRef.current[next];
    if (!nextAction) return;
    prevAction?.fadeOut(fade);
    nextAction.reset().fadeIn(fade).play();
    currentActionRef.current = next;
  };

  const playOneShot = (next: 'punch' | 'throw', fade = 0.12) => {
    const action = actionsRef.current[next];
    const prevAction = actionsRef.current[currentActionRef.current];
    if (!action) {
      currentActionRef.current = next;
      oneShotTimerRef.current = 0.6;
      return;
    }
    prevAction?.fadeOut(fade);
    action.reset().fadeIn(fade).play();
    currentActionRef.current = next;
    oneShotTimerRef.current = action.getClip().duration;
  };

  useFrame((frameState, delta) => {
    if (isPaused) return;
    const actualDelta = Math.min(delta, 0.1);
    const now = frameState.clock.elapsedTime;
    if (mixerRef.current) mixerRef.current.update(actualDelta);
    if (!groupRef.current || !playerRef.current) return;

    if (frozenRef.current) {
      if (velocity.lengthSq() > 0.0001) {
        ragdollRef.current?.applyImpulseToHips(velocity);
        velocity.set(0, 0, 0);
      }
      ragdollRef.current?.update();
      deadTimeRef.current += actualDelta;
      if (forceSinkNow) deadTimeRef.current = Math.max(deadTimeRef.current, CORPSE_SINK_DELAY);
      if (deadTimeRef.current > CORPSE_SINK_DELAY) {
        const sinkProgress = Math.min(1, (deadTimeRef.current - CORPSE_SINK_DELAY) / CORPSE_SINK_DURATION);
        groupRef.current.position.y = frozenBaseYRef.current - SINK_DEPTH * sinkProgress;
        if (sinkProgress >= 1) {
          groupRef.current.visible = false;
          if (!sunkNotifiedRef.current) {
            sunkNotifiedRef.current = true;
            ragdollRef.current?.dispose();
            onSunk(id);
          }
        }
      }
      ragdollRef.current?.getHipsWorldPosition(position);
      return;
    }

    if (health <= 0) {
      frozenRef.current = true;
      frozenBaseYRef.current = groupRef.current.position.y;
      materialsRef.current.forEach((mat) => mat.color.set('#0a0a0a'));
      ragdollRef.current?.activate();
      return;
    }

    if (!hasSpawnedRef.current) {
      hasSpawnedRef.current = true;
      groupRef.current.position.copy(position);
    }

    // ── Status effects (same vocabulary the player has) ──────────────────
    const effects = statusEffects;

    // Ragdoll stun: temporary physics takeover until the window expires.
    if (isRagdollStunned(effects, now)) {
      if (!isStunRagdollingRef.current) {
        isStunRagdollingRef.current = true;
        ragdollRef.current?.activate(effects.ragdollStunImpulse ?? undefined);
        effects.ragdollStunImpulse = null;
      }
      ragdollRef.current?.update();
      ragdollRef.current?.getHipsWorldPosition(position);
      return;
    }
    if (isStunRagdollingRef.current) {
      isStunRagdollingRef.current = false;
      ragdollRef.current?.dispose();
      transitionTo('idle', 0.05);
    }

    // Burn: 1s-tick damage-over-time, reported up to GameCanvas.
    const burnDamage = tickBurn(effects, now);
    if (burnDamage > 0) onBurnDamage(id, burnDamage);

    // Aura tint (burn/freeze/slow/etc. color) overrides the base tint.
    const activeColor = hasAura(effects, now) && effects.auraColor ? effects.auraColor : tint;
    materialsRef.current.forEach((mat) => mat.color.set(activeColor));

    // Freeze: locked standing in place.
    if (isFrozen(effects, now)) {
      transitionTo('terrified', 0.1);
      return;
    }

    // Telekinesis pull: dragged helplessly toward the attacker.
    if (isPulled(effects, now) && effects.pullTarget) {
      transitionTo('flee', 0.1);
      const alpha = 1 - Math.exp(-6 * actualDelta);
      groupRef.current.position.lerp(effects.pullTarget, alpha);
      position.copy(groupRef.current.position);
      return;
    }

    // Knockback: one-shot impulse decaying over time.
    if (effects.pendingKnockback) {
      knockbackVelocityRef.current.copy(effects.pendingKnockback);
      effects.pendingKnockback = null;
    }
    if (knockbackVelocityRef.current.lengthSq() > 0.0004) {
      groupRef.current.position.addScaledVector(knockbackVelocityRef.current, actualDelta);
      knockbackVelocityRef.current.multiplyScalar(Math.exp(-6 * actualDelta));
    } else {
      knockbackVelocityRef.current.set(0, 0, 0);
    }

    const slowFactor = getSlowFactor(effects, now);

    const pos = groupRef.current.position;
    const playerPos = playerRef.current.position;
    const isTerrifiedIdle = maxHealth > 0 && health / maxHealth < CIVILIAN_LOW_HEALTH_FRACTION;

    // ── Army & bodyguard behavior: they never flee. Armymen wander until
    // provoked (aggro set by GameCanvas when they witness an attack), then
    // hunt the attacker - player included. Bodyguards shadow the player and
    // hunt whatever hurt him. ────────────────────────────────────────────
    if (role !== 'civilian' && role !== 'vip') {
      const prevXa = pos.x;
      const prevZa = pos.z;

      // Tick a running attack one-shot (and land its delayed melee impact).
      if (oneShotTimerRef.current !== null) {
        oneShotTimerRef.current -= actualDelta;
        if (pendingMeleeRef.current) {
          pendingMeleeRef.current.impactIn -= actualDelta;
          if (pendingMeleeRef.current.impactIn <= 0) {
            const t = pendingMeleeRef.current.target;
            pendingMeleeRef.current = null;
            if (t.kind === 'player') {
              const d = Math.hypot(playerPos.x - pos.x, playerPos.z - pos.z);
              if (d <= ENEMY_ATTACK_RANGE + 0.3) onArmyAttackPlayer?.(meleeDamageRef.current, pos.clone(), now, id);
            } else {
              const enemy = enemies.find((e) => e.id === t.id && e.health > 0);
              if (enemy && Math.hypot(enemy.position.x - pos.x, enemy.position.z - pos.z) <= ENEMY_ATTACK_RANGE + 0.3) {
                onArmyAttackEnemy?.(t.id, meleeDamageRef.current);
              }
            }
          }
        }
        if (oneShotTimerRef.current <= 0) {
          oneShotTimerRef.current = null;
          transitionTo('idle', 0.15);
        }
      }
      attackCooldownRef.current = Math.max(0, attackCooldownRef.current - actualDelta);

      // Resolve who this soldier is dealing with this frame.
      //
      // Enemies are engaged ON SIGHT — no provocation needed, because an
      // armed soldier standing idle beside a hostile reads as broken. The
      // PLAYER is the opposite: only ever a target if he started it, which
      // is what aggroPlayer records.
      const aggroValid = Date.now() < aggroUntilMs;
      const healthFrac = maxHealth > 0 ? health / maxHealth : 1;
      const loadout = armyLoadoutFor(role);

      // A sergeant in earshot is worth more than any single upgrade: the men
      // around him hit harder, swing faster, and stop breaking off to look
      // for a medkit while there is still shooting.
      let sergeantNear = false;
      if (role !== 'armySergeant') {
        for (const c of civilians) {
          if (c.health <= 0 || c.role !== 'armySergeant') continue;
          if (Math.hypot(c.position.x - pos.x, c.position.z - pos.z) <= ARMY_SERGEANT_AURA_RADIUS) {
            sergeantNear = true;
            break;
          }
        }
      }
      const meleeDamage = loadout.meleeDamage * (sergeantNear ? 1 + ARMY_SERGEANT_DAMAGE_BONUS : 1);
      const rangedDamage = loadout.rangedDamage * (sergeantNear ? 1 + ARMY_SERGEANT_DAMAGE_BONUS : 1);
      const cooldownScale = sergeantNear ? 1 / (1 + ARMY_SERGEANT_ATTACK_SPEED_BONUS) : 1;

      let nearestEnemy: EnemyState | undefined;
      let nearestEnemyDist = Infinity;
      for (const e of enemies) {
        if (e.health <= 0) continue;
        const d = Math.hypot(e.position.x - pos.x, e.position.z - pos.z);
        if (d < nearestEnemyDist) {
          nearestEnemyDist = d;
          nearestEnemy = e;
        }
      }
      // Focus fire. Not "the nearest one" - the one the squad should be
      // finishing. Every soldier scores the same way from the same roster, so
      // they converge on the same target without any coordination between
      // them, and wounded enemies actually die instead of five men each
      // chipping a different full-health body.
      let sightedEnemy: EnemyState | undefined;
      {
        let bestScore = Infinity;
        for (const e of enemies) {
          if (e.health <= 0) continue;
          const d = Math.hypot(e.position.x - pos.x, e.position.z - pos.z);
          if (d > ARMY_SIGHT_RADIUS) continue;
          const score = e.health + d * ARMY_FOCUS_DISTANCE_WEIGHT;
          if (score < bestScore) {
            bestScore = score;
            sightedEnemy = e;
          }
        }
      }

      // Self-preservation. Critically hurt, he breaks off mid-fight to heal;
      // merely hurt, he waits until the shooting stops.
      const wantsMedkit =
        medkits.length > 0 &&
        (healthFrac < ARMY_MEDKIT_URGENT_FRACTION ||
          // With a sergeant on the field nobody wanders off mid-firefight to
          // look for a medkit; you go when the shooting stops.
          (healthFrac < ARMY_MEDKIT_SEEK_FRACTION && !sightedEnemy && !sergeantNear));

      let medkitGoal: { id: string; x: number; z: number } | undefined;
      if (wantsMedkit) {
        let best = Infinity;
        for (const m of medkits) {
          const d = Math.hypot(m.position[0] - pos.x, m.position[2] - pos.z);
          if (d < best) {
            best = d;
            medkitGoal = { id: m.id, x: m.position[0], z: m.position[2] };
          }
        }
      }

      // ── Radioman ───────────────────────────────────────────────────────
      // He fights like anyone else; what makes him worth killing is that when
      // his side is losing on numbers he simply asks for more. Runs before
      // the rest of his behaviour so a call goes out even while he is
      // swinging.
      if (role === 'armyRadio') {
        radioCooldownRef.current = Math.max(0, radioCooldownRef.current - actualDelta);
        if (radioCooldownRef.current <= 0 && sightedEnemy) {
          let hostiles = 0;
          for (const e of enemies) {
            if (e.health <= 0) continue;
            if (Math.hypot(e.position.x - pos.x, e.position.z - pos.z) <= ARMY_RADIO_SCAN_RADIUS) hostiles++;
          }
          let friends = 0;
          for (const c of civilians) {
            if (c.health <= 0 || !isFightingArmyRole(c.role)) continue;
            if (Math.hypot(c.position.x - pos.x, c.position.z - pos.z) <= ARMY_RADIO_SCAN_RADIUS) friends++;
          }
          if (hostiles > friends) {
            radioCooldownRef.current = ARMY_RADIO_COOLDOWN;
            onCallReinforcements?.(pos.clone());
            for (let i = 0; i < 10; i++) {
              const q = pos.clone();
              q.x += (Math.random() - 0.5) * 0.9;
              q.y += 1.4 + Math.random() * 1.4;
              q.z += (Math.random() - 0.5) * 0.9;
              projectilesRef?.current?.spawnAmbientParticle(q, '#4dd0e1');
            }
          }
        }
      }

      // ── Medic Soldier ──────────────────────────────────────────────────
      // Entirely passive: no punch, no throw, no aggro of his own. Running
      // outranks everything, then treating the worst-hurt soldier he can
      // reach, then his own medkit, then staying with the squad. He is the
      // reason a wounded squad stops being a wounded squad, so he is also
      // the reason to open on the back rank instead of the front one.
      if (role === 'armyMedic') {
        healCooldownRef.current = Math.max(0, healCooldownRef.current - actualDelta);

        // The player only counts as a threat once he has actually hit
        // somebody; before that the medic has no reason to run from him.
        const playerDist = Math.hypot(playerPos.x - pos.x, playerPos.z - pos.z);
        const playerHostile = aggroValid && !!aggroPlayer && playerDist <= ARMY_MEDIC_FLEE_RADIUS;
        const enemyClose = !!nearestEnemy && nearestEnemyDist <= ARMY_MEDIC_FLEE_RADIUS;

        let goal: { x: number; z: number } | null = null;
        let speed = CIVILIAN_WALK_SPEED;
        let anim: CivilianAnimState = 'walk';

        if (enemyClose || playerHostile) {
          // Straight away from the average of whatever is too close, so
          // breaking off from one man does not run him into another.
          let ax = 0;
          let az = 0;
          let n = 0;
          if (enemyClose && nearestEnemy) {
            ax += nearestEnemy.position.x;
            az += nearestEnemy.position.z;
            n++;
          }
          if (playerHostile) {
            ax += playerPos.x;
            az += playerPos.z;
            n++;
          }
          goal = { x: pos.x + (pos.x - ax / n), z: pos.z + (pos.z - az / n) };
          speed = CIVILIAN_FLEE_SPEED;
          anim = 'flee';
        } else {
          // Worst hurt first, with distance only as a tiebreak - he crosses
          // the field for someone on their last legs rather than topping up
          // whoever happens to be nearest.
          let patient: CivilianState | undefined;
          let bestScore = Infinity;
          for (const c of civilians) {
            if (c.id === id || c.health <= 0 || !isArmyRole(c.role)) continue;
            const frac = c.maxHealth > 0 ? c.health / c.maxHealth : 1;
            if (frac >= 1) continue;
            const d = Math.hypot(c.position.x - pos.x, c.position.z - pos.z);
            if (d > ARMY_MEDIC_SEEK_RADIUS) continue;
            const score = frac + d / (ARMY_MEDIC_SEEK_RADIUS * 8);
            if (score < bestScore) {
              bestScore = score;
              patient = c;
            }
          }

          if (patient) {
            const d = Math.hypot(patient.position.x - pos.x, patient.position.z - pos.z);
            if (d <= ARMY_MEDIC_HEAL_RADIUS) {
              anim = 'idle';
              if (healCooldownRef.current <= 0) {
                healCooldownRef.current = ARMY_MEDIC_HEAL_COOLDOWN;
                onMedicHeal?.(patient.id, ARMY_MEDIC_HEAL_AMOUNT);
                for (let i = 0; i < 6; i++) {
                  const q = patient.position.clone();
                  q.x += (Math.random() - 0.5) * 0.8;
                  q.y += 0.5 + Math.random() * 1.3;
                  q.z += (Math.random() - 0.5) * 0.8;
                  projectilesRef?.current?.spawnAmbientParticle(q, '#8bc34a');
                }
              }
            } else {
              goal = { x: patient.position.x, z: patient.position.z };
              speed = ARMY_CHASE_SPEED;
            }
          } else if (medkitGoal) {
            // Nobody to treat and hurt himself: he uses a medkit like anyone.
            const d = Math.hypot(medkitGoal.x - pos.x, medkitGoal.z - pos.z);
            if (d < MEDKIT_PICKUP_RADIUS) onTakeMedkit?.(id, medkitGoal.id);
            else {
              goal = { x: medkitGoal.x, z: medkitGoal.z };
              speed = CIVILIAN_FLEE_SPEED;
              anim = 'flee';
            }
          } else {
            // Idle: stay behind the nearest fighting soldier. A medic alone
            // in the open is just a civilian in a white coat.
            let escort: CivilianState | undefined;
            let escortDist = Infinity;
            for (const c of civilians) {
              if (c.id === id || c.health <= 0 || !isFightingArmyRole(c.role)) continue;
              const d = Math.hypot(c.position.x - pos.x, c.position.z - pos.z);
              if (d < escortDist) {
                escortDist = d;
                escort = c;
              }
            }
            if (escort && escortDist > ARMY_MEDIC_ESCORT_DISTANCE) {
              goal = { x: escort.position.x, z: escort.position.z };
              speed = CIVILIAN_WALK_SPEED * 1.6;
            } else {
              anim = 'idle';
            }
          }
        }

        if (goal && oneShotTimerRef.current === null) {
          const heading = pickOpenHeading(pos, Math.atan2(goal.x - pos.x, goal.z - pos.z), colliders, HUMANOID_RADIUS);
          rotateTowardAngle(groupRef.current, heading, 10, actualDelta);
          transitionTo(anim, 0.2);
          groupRef.current.translateZ(speed * slowFactor * actualDelta);
        } else {
          transitionTo(anim === 'flee' ? 'flee' : 'idle', 0.2);
        }

        const resolvedMedic = resolveCircleVsBoxes(prevXa, prevZa, pos.x, pos.z, HUMANOID_RADIUS, colliders);
        pos.x = resolvedMedic.x;
        pos.z = resolvedMedic.z;
        position.copy(pos);
        return;
      }

      // Answering a call for help. Every soldier derives the same responder
      // ordering from the same roster, so the two nearest agree on who goes
      // without any coordination between them.
      let supportGoal: THREE.Vector3 | undefined;
      if (!sightedEnemy && !medkitGoal) {
        let inTrouble: CivilianState | undefined;
        let troubleDist = Infinity;
        for (const c of civilians) {
          if (c.id === id || c.health <= 0 || !isArmyRole(c.role)) continue;
          if (c.health / c.maxHealth >= ARMY_SUPPORT_LOW_FRACTION) continue;
          const d = Math.hypot(c.position.x - pos.x, c.position.z - pos.z);
          if (d <= ARMY_SUPPORT_RADIUS && d < troubleDist) {
            troubleDist = d;
            inTrouble = c;
          }
        }
        if (inTrouble) {
          const victim = inTrouble;
          const responders = civilians
            .filter(
              (c) =>
                c.health > 0 &&
                isFightingArmyRole(c.role) &&
                c.id !== victim.id &&
                c.health / c.maxHealth >= ARMY_SUPPORT_LOW_FRACTION
            )
            .sort(
              (a, b) =>
                Math.hypot(a.position.x - victim.position.x, a.position.z - victim.position.z) -
                Math.hypot(b.position.x - victim.position.x, b.position.z - victim.position.z)
            )
            .slice(0, ARMY_SUPPORT_RESPONDERS);
          if (responders.some((r) => r.id === id)) supportGoal = victim.position;
        }
      }

      let targetPos: THREE.Vector3 | null = null;
      let targetKind: { kind: 'player' } | { kind: 'enemy'; id: string } | null = null;
      if (aggroValid && aggroPlayer) {
        targetPos = playerPos;
        targetKind = { kind: 'player' };
      } else if (!medkitGoal && sightedEnemy) {
        targetPos = sightedEnemy.position;
        targetKind = { kind: 'enemy', id: sightedEnemy.id };
      } else if (!medkitGoal && aggroValid && aggroEnemyId) {
        const enemy = enemies.find((e) => e.id === aggroEnemyId && e.health > 0);
        if (enemy) {
          targetPos = enemy.position;
          targetKind = { kind: 'enemy', id: enemy.id };
        }
      }

      // Heading for a medkit or a comrade overrides fighting for movement
      // purposes; both are handled as pure movement with no attack.
      if (medkitGoal || supportGoal) {
        const goal: { x: number; z: number } = medkitGoal ?? { x: supportGoal!.x, z: supportGoal!.z };
        const gdx = goal.x - pos.x;
        const gdz = goal.z - pos.z;
        const gdist = Math.hypot(gdx, gdz);
        if (medkitGoal && gdist < MEDKIT_PICKUP_RADIUS) {
          onTakeMedkit?.(id, medkitGoal.id);
          transitionTo('idle', 0.2);
        } else if (gdist > 0.4 && oneShotTimerRef.current === null) {
          const heading = pickOpenHeading(pos, Math.atan2(gdx, gdz), colliders, HUMANOID_RADIUS);
          rotateTowardAngle(groupRef.current, heading, 9, actualDelta);
          transitionTo(medkitGoal ? 'flee' : 'walk', 0.2);
          groupRef.current.translateZ(
            (medkitGoal ? CIVILIAN_FLEE_SPEED : loadout.chaseSpeed) * slowFactor * actualDelta
          );
        }
        const resolvedGoal = resolveCircleVsBoxes(prevXa, prevZa, pos.x, pos.z, HUMANOID_RADIUS, colliders);
        pos.x = resolvedGoal.x;
        pos.z = resolvedGoal.z;
        position.copy(pos);
        return;
      }

      if (targetPos && targetKind && oneShotTimerRef.current === null) {
        const dx = targetPos.x - pos.x;
        const dz = targetPos.z - pos.z;
        const dist = Math.hypot(dx, dz) || 0.001;
        const heading = Math.atan2(dx, dz);
        const isRanged = role === 'armyRanged';
        const attackRange = isRanged ? ENEMY_RANGED_ATTACK_RANGE * 0.8 : ENEMY_ATTACK_RANGE;
        // Too close to throw safely: break away and keep throwing on the run.
        // The projectile is aimed from a from/to pair rather than from the
        // body's facing, so backing off costs him nothing but the distance.
        const tooClose = isRanged && dist < ARMY_RANGED_MIN_RANGE;
        if (dist > attackRange) {
          const safe = pickOpenHeading(pos, heading, colliders, HUMANOID_RADIUS);
          rotateTowardAngle(groupRef.current, safe, 10, actualDelta);
          transitionTo('walk', 0.15);
          groupRef.current.translateZ(loadout.chaseSpeed * slowFactor * actualDelta);
        } else if (tooClose) {
          const away = pickOpenHeading(pos, heading + Math.PI, colliders, HUMANOID_RADIUS);
          rotateTowardAngle(groupRef.current, away, 11, actualDelta);
          transitionTo('flee', 0.15);
          groupRef.current.translateZ(ARMY_KITE_SPEED * slowFactor * actualDelta);
        }
        if (dist <= attackRange && !tooClose) {
          rotateTowardAngle(groupRef.current, heading, 10, actualDelta);
          transitionTo('idle', 0.2);
        }
        if (dist <= attackRange) {
          if (attackCooldownRef.current <= 0) {
            if (isRanged) {
              attackCooldownRef.current = loadout.rangedCooldown * cooldownScale;
              playOneShot('throw');
              const from = pos.clone().add(new THREE.Vector3(0, 1.2, 0));
              const to = targetPos.clone().add(new THREE.Vector3(0, 1.0, 0));
              projectilesRef?.current?.spawn({
                from,
                to,
                color: '#8bc34a',
                payload: { damage: rangedDamage, range: 'ranged', isProjectile: true },
                attackerId: id,
                // Army bullets aimed at an enemy fly on the helper team;
                // aimed at the player, on the enemy team.
                shooterTeam: targetKind.kind === 'enemy' ? 'helper' : 'enemy'
              });
            } else {
              attackCooldownRef.current = loadout.meleeCooldown * cooldownScale;
              playOneShot('punch');
              // The damage is locked in at the swing, not at the impact: the
              // sergeant could die in the 0.35s the fist is in the air, and
              // the punch that was already thrown should still land as thrown.
              meleeDamageRef.current = meleeDamage;
              pendingMeleeRef.current = { impactIn: 0.35, target: targetKind };
            }
          }
        }
      } else if (oneShotTimerRef.current === null) {
        if (role === 'bodyguard') {
          // Off duty: shadow whoever we're assigned to. A VIP's escort sticks
          // tighter than the player's, so the three of them read as a unit
          // rather than a loose crowd.
          const ward = protectCivilianId ? civilians.find((c) => c.id === protectCivilianId && c.health > 0) : undefined;
          const anchor = ward ? ward.position : playerPos;
          const followAt = ward ? BODYGUARD_PROTECT_DISTANCE : BODYGUARD_FOLLOW_DISTANCE;
          const dx = anchor.x - pos.x;
          const dz = anchor.z - pos.z;
          const d = Math.hypot(dx, dz);
          if (d > followAt) {
            const heading = pickOpenHeading(pos, Math.atan2(dx, dz), colliders, HUMANOID_RADIUS);
            rotateTowardAngle(groupRef.current, heading, 9, actualDelta);
            transitionTo(d > 7 ? 'flee' : 'walk', 0.2);
            groupRef.current.translateZ((d > 7 ? CIVILIAN_FLEE_SPEED : CIVILIAN_WALK_SPEED * 1.5) * slowFactor * actualDelta);
          } else {
            transitionTo('idle', 0.25);
          }
        } else {
          // Off-duty armymen patrol like civilians (but never cower).
          wanderTimerRef.current -= actualDelta;
          if (wanderTimerRef.current <= 0) {
            wanderMovingRef.current = !wanderMovingRef.current && Math.random() < 0.6;
            wanderTimerRef.current = 2 + Math.random() * 3;
            wanderHeadingRef.current = Math.random() * Math.PI * 2;
          }
          if (wanderMovingRef.current) {
            let heading = wanderHeadingRef.current;
            if (Math.hypot(pos.x, pos.z) > MAP_RADIUS - 3) {
              heading = Math.atan2(-pos.x, -pos.z);
              wanderHeadingRef.current = heading;
            }
            heading = pickOpenHeading(pos, heading, colliders, HUMANOID_RADIUS);
            rotateTowardAngle(groupRef.current, heading, 9, actualDelta);
            transitionTo('walk', 0.25);
            groupRef.current.translateZ(CIVILIAN_WALK_SPEED * slowFactor * actualDelta);
          } else {
            transitionTo('idle', 0.25);
          }
        }
      }

      const resolvedArmy = resolveCircleVsBoxes(prevXa, prevZa, pos.x, pos.z, HUMANOID_RADIUS, colliders);
      pos.x = resolvedArmy.x;
      pos.z = resolvedArmy.z;
      position.copy(pos);
      return;
    }

    // Everything scary in sight: living enemies, plus the player once he's
    // been attacked by them.
    const fleeAway = new THREE.Vector3();
    let threatened = false;
    enemies.forEach((e) => {
      if (e.health <= 0) return;
      const dx = pos.x - e.position.x;
      const dz = pos.z - e.position.z;
      const d = Math.hypot(dx, dz);
      if (d < CIVILIAN_SIGHT_RADIUS && d > 0.001) {
        threatened = true;
        fleeAway.x += dx / d;
        fleeAway.z += dz / d;
      }
    });
    if (fearsPlayer) {
      const dx = pos.x - playerPos.x;
      const dz = pos.z - playerPos.z;
      const d = Math.hypot(dx, dz);
      if (d < CIVILIAN_SIGHT_RADIUS && d > 0.001) {
        threatened = true;
        fleeAway.x += dx / d;
        fleeAway.z += dz / d;
      }
    }
    // Bystander panic: witnessed an attack on a fellow civilian/armyman
    // nearby - run screaming away from where it happened.
    if (Date.now() < panicUntilMs && panicFromX !== undefined && panicFromZ !== undefined) {
      const dx = pos.x - panicFromX;
      const dz = pos.z - panicFromZ;
      const d = Math.hypot(dx, dz);
      threatened = true;
      if (d > 0.001) {
        fleeAway.x += (dx / d) * 1.5;
        fleeAway.z += (dz / d) * 1.5;
      } else {
        // Standing exactly on the scene: pick the current facing to bolt.
        fleeAway.x += Math.sin(groupRef.current.rotation.y);
        fleeAway.z += Math.cos(groupRef.current.rotation.y);
      }
    }

    // Frightened people run TOWARD protection, not just away from danger.
    // If there's a soldier within sight, head for him instead of blindly
    // fleeing — which also drags the pursuer into the soldier's line of fire,
    // and army men engage on sight, so the rescue happens on its own.
    let guardian: CivilianState | undefined;
    if (threatened) {
      let guardDist = Infinity;
      for (const c of civilians) {
        // A medic is no protection - he runs from the same thing you do.
        if (c.health <= 0 || !isFightingArmyRole(c.role)) continue;
        const d = Math.hypot(c.position.x - pos.x, c.position.z - pos.z);
        if (d <= CIVILIAN_SEEK_ARMY_RADIUS && d < guardDist) {
          guardDist = d;
          guardian = c;
        }
      }
      // Already tucked in behind him — stop running and stand your ground.
      if (guardian && guardDist < CIVILIAN_FOLLOW_DISTANCE) guardian = undefined;
    }

    const prevX = pos.x;
    const prevZ = pos.z;
    let moveHeading: number | null = null;
    let moveSpeed = 0;

    if (threatened && guardian) {
      moveHeading = Math.atan2(guardian.position.x - pos.x, guardian.position.z - pos.z);
      moveSpeed = CIVILIAN_FLEE_SPEED;
    } else if (threatened && fleeAway.lengthSq() > 0.0001) {
      moveHeading = Math.atan2(fleeAway.x, fleeAway.z);
      moveSpeed = CIVILIAN_FLEE_SPEED;
      transitionTo('flee', 0.15);
    } else if (followingPlayer && !fearsPlayer) {
      const dx = playerPos.x - pos.x;
      const dz = playerPos.z - pos.z;
      const d = Math.hypot(dx, dz);
      if (d > CIVILIAN_FOLLOW_DISTANCE) {
        moveHeading = Math.atan2(dx, dz);
        // Sprints (goofily) to catch up when left far behind.
        const sprint = d > 7;
        moveSpeed = sprint ? CIVILIAN_FLEE_SPEED : CIVILIAN_WALK_SPEED * 1.4;
        transitionTo(sprint ? 'flee' : 'walk', 0.2);
      } else {
        transitionTo(isTerrifiedIdle ? 'terrified' : 'idle', 0.25);
      }
    } else {
      wanderTimerRef.current -= actualDelta;
      if (wanderTimerRef.current <= 0) {
        wanderMovingRef.current = !wanderMovingRef.current && Math.random() < 0.75;
        wanderTimerRef.current = 2 + Math.random() * 3;
        wanderHeadingRef.current = Math.random() * Math.PI * 2;
      }
      if (wanderMovingRef.current) {
        moveHeading = wanderHeadingRef.current;
        moveSpeed = CIVILIAN_WALK_SPEED;
        transitionTo('walk', 0.25);
      } else {
        transitionTo(isTerrifiedIdle ? 'terrified' : 'idle', 0.25);
      }
    }

    if (moveHeading !== null && moveSpeed > 0) {
      // Steer back toward the middle instead of wandering/fleeing off the map.
      const distFromCenter = Math.hypot(pos.x, pos.z);
      if (distFromCenter > MAP_RADIUS - 3) {
        const toCenter = Math.atan2(-pos.x, -pos.z);
        moveHeading = toCenter;
        wanderHeadingRef.current = toCenter;
      }
      moveHeading = pickOpenHeading(pos, moveHeading, colliders, HUMANOID_RADIUS);
      rotateTowardAngle(groupRef.current, moveHeading, 9, actualDelta);
      groupRef.current.translateZ(moveSpeed * slowFactor * actualDelta);
    }

    const resolved = resolveCircleVsBoxes(prevX, prevZ, pos.x, pos.z, HUMANOID_RADIUS, colliders);
    pos.x = resolved.x;
    pos.z = resolved.z;
    position.copy(pos);
  });

  const healthFraction = health / Math.max(maxHealth, 1);
  return (
    <group ref={groupRef}>
      <primitive object={model} scale={0.012} />
      {showHealthBar && health > 0 && (
        <Html position={[0, 2.05, 0]} center distanceFactor={12} style={{ pointerEvents: 'none' }}>
          <div
            style={{
              width: '52px',
              height: '7px',
              background: 'rgba(0,0,0,0.6)',
              border: '1px solid rgba(245,240,230,0.55)',
              borderRadius: '4px',
              overflow: 'hidden'
            }}
          >
            <div
              style={{
                width: `${Math.max(0, Math.min(100, healthFraction * 100))}%`,
                height: '100%',
                background: healthFraction > 0.5 ? 'linear-gradient(180deg,#e8e0d0,#c9bfa8)' : healthFraction > 0.25 ? 'linear-gradient(180deg,#ffd54f,#f9a825)' : 'linear-gradient(180deg,#ef5350,#c62828)',
                borderRadius: '3px'
              }}
            />
          </div>
        </Html>
      )}
    </group>
  );
};

const rotateTowardAngle = (group: THREE.Group, angle: number, turnRateExp: number, actualDelta: number) => {
  const current = group.rotation.y;
  let diff = angle - current;
  diff = Math.atan2(Math.sin(diff), Math.cos(diff));
  const alpha = 1 - Math.exp(-turnRateExp * actualDelta);
  group.rotation.y += diff * alpha;
};

const WALL_AVOID_LOOKAHEAD = 0.9;
const WALL_AVOID_OFFSETS = [0, Math.PI / 4, -Math.PI / 4, Math.PI / 2, -Math.PI / 2, (Math.PI * 3) / 4, -(Math.PI * 3) / 4];

const pickOpenHeading = (pos: THREE.Vector3, desiredAngle: number, colliders: AABB[], radius: number): number => {
  for (const offset of WALL_AVOID_OFFSETS) {
    const angle = desiredAngle + offset;
    const testX = pos.x + Math.sin(angle) * WALL_AVOID_LOOKAHEAD;
    const testZ = pos.z + Math.cos(angle) * WALL_AVOID_LOOKAHEAD;
    if (!colliders.some((box) => circleCollidesWithBox(testX, testZ, radius, box))) return angle;
  }
  return desiredAngle;
};
