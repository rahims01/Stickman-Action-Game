# Stickman Action

A browser-based 3D stickman action/combat game — punch, kick, and ragdoll your way through a procedurally generated arena full of enemies, built with React Three Fiber and cannon-es physics. No backend, no build server beyond Vite, everything runs client-side.

## Features

- **30+ enemy types** — five common basics plus body-shape rarities (Giant, Baby, Tall, Fat, Skinny), elemental/ability specials (Lava, Fire, Water, Invisible, Snow, Weapon, Purple, Pink, Green, Yellow, Black, Tomato, Glowing Green), and role variants (Medic, Rage, Shield Bearer, Brain spawner, strong Punch/Kick/Ranged/Combo), each sharing one rigged model reshaped via a bone-scaling body-slider system.
- **Ragdoll physics** — every kill (player or enemy) skips death animations entirely and ragdolls instantly via per-bone cannon-es bodies; the same ragdoll rig doubles as a temporary knockdown (parries, stuns) and a permanent corpse.
- **Leveling & upgrades** — clear battle flags to level up and pick from a growing pool of upgrades: stat boosts, Dash, Parry, Ground Slam, Thorns, crit chance, combo bonuses, a companion Drone, and recruitable/upgradable Helper allies. Giant, Bonus, and Challenge flag variants change the risk/reward of a level-up.
- **Procedurally generated world** — one seeded PRNG drives crate/wall/dummy/enemy/medkit/platform placement, so a session's layout and every runtime respawn form one reproducible sequence.
- **Day/night cycle** — orbiting sun/moon with lerped lighting; night buffs basic enemies. A flashlight upgrade helps you see (and lets you toggle it manually with `L`).
- **Status effects** — burn, freeze, ragdoll-stun, telekinesis pull, knockback, and color auras, all layered on a single reusable "apply attack payload" chokepoint so melee and ranged attacks share the same effect logic.
- **Sandbox mode** — an empty map with a full dev console: spawn any enemy (optionally as a friendly helper), spawn any flag variant, hand yourself any upgrade, freely edit player/enemy stat bonuses, and force day or night.
- **In-game Enemy Encyclopedia** — a standalone page (`/encyclopedia`) with a rotating 3D viewer and stat card for every enemy type.
- **Persistent progress** — level, stat picks, helpers, drone level, and score are saved to `localStorage` and resumed on reload.

## Tech stack

Vite + React 18 + TypeScript, `@react-three/fiber` / `@react-three/drei` (Three.js) for rendering, `cannon-es` for ragdoll physics. Character animation is Mixamo FBX clips driven by a hand-rolled per-actor animation state machine (no animation library).

## Getting started

```bash
npm install
npm run dev      # http://localhost:3000 (fixed port, see vite.config.ts)
```

```bash
npm run build     # tsc --noEmit type-check, then vite build
npx tsc --noEmit  # type-check only — the real correctness gate for any change
```

> `npm run lint` is defined but ESLint isn't installed/configured yet — it will fail until added as a dependency. There is no automated test suite.

## Controls

| Key | Action |
| --- | --- |
| `W A S D` / arrows | Move |
| `Shift` | Sprint (stamina-gated) |
| `Space` | Jump |
| `C` | Crouch / sneak |
| `F` | Punch |
| `G` | Kick (kick while airborne = Ground Slam, if unlocked) |
| Double-tap a direction | Dash (if unlocked) |
| `Q` | Parry (if unlocked) |
| `E` | Interact (battle flags, medkits) |
| `V` | Toggle first/third-person camera |
| `L` | Toggle flashlight |
| `P` | Pause |

## Project structure

See [`.claude/CLAUDE.md`](.claude/CLAUDE.md) for the full architecture write-up — entity ownership boundaries, the animation FSM pattern, combat hit-detection, the ragdoll system, collision, and the procedural world generator. In short:

- `src/components/` — React Three Fiber components: the player, enemy/dummy/helper actors, world objects, particles/projectiles, camera, sky.
- `src/world/` — game logic and tunables that aren't React state: enemy configs, status effects, ragdoll construction, collision, procedural world generation, character morphing, and every game constant (`gameState.ts`).
- `src/hooks/useInputs.ts` — keyboard input polling.
- `src/types/game.types.ts` — shared animation/input types.
- `public/anims/` — the Mixamo FBX animation library. `public/encyclopedia/` — the standalone encyclopedia page.
- `todo.md` / `_new-addition.md` — informal feature backlogs (future game modes, and a near-term feature list respectively).

## Known environment notes

- On Windows, copying new files into a Vite-watched directory while `npm run dev` is running can trigger a transient `EBUSY` crash — just restart the dev server.
- Headless/sandboxed browser testing (e.g. Playwright) renders at very low FPS once the world fills up with enemies/ragdolls — use generous key-hold durations when scripting interactions.
