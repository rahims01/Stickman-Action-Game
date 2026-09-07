# New Additions

## Carried over — not yet built

- **Kill feed / streak indicator** — a scrolling right-side log: "You killed Lava Man (+1 HP, +1 DMG)", streaks like "3× KILL STREAK". Pure UI, no gameplay logic change. Hidable.
- **Secret room** — a hidden part of the map (behind a destructible wall) with a guaranteed rare upgrade flag and 3 dummies to farm.

## New ideas

### Enemies
- **Squad packs** — tag 2-3 enemies to spawn together and stay near each other (e.g. two Runners flanking a Shield Bearer), for tactical variety without new enemy types.
- **Shockwave stomp** — a heavy melee enemy with a telegraphed AOE stomp that ragdolls anyone nearby on landing, punishing players who stand still too long.
- **Pack Leader variant** — an aura-buff enemy (speed/damage to nearby allies while alive) that pairs naturally with the squad-pack idea above — kill it first to defang the group.
- **Mimic Medkit** — looks exactly like a medkit until you reach for it, then sprouts limbs and attacks; makes every pickup a small trust exercise. Rare replacement chance on medkit spawns.
- **Necromancer** — hooded rare that re-raises nearby corpses (dead-but-not-sunk bodies) as half-strength "husk" versions, once each; killing the Necromancer stops the recycling. Leans on the existing corpse/sink system.
- **Thief** — sprints for the nearest medkit or dropped pickup, grabs it, and flees with it; kill him to make him drop the goods.
- **Twin Bond** — spawns as a pair sharing ONE health pool; when the pool empties both die at once, and while both live they flank from opposite sides.
- **Burrower** — dives underground (invulnerable, visible dirt trail) and erupts under the player's feet with a launch hit; telegraphed by the approaching mound.
- **Kamikaze mites** — tiny, fast bombers that explode on contact; spawn in clusters and chain-detonate each other. Natural fit for the magma arena.
- **Puppeteer** — a frail hooded rare who "possesses" another enemy: the puppet gets +50% stats and a violet aura while the Puppeteer hides at max range. Kill the puppet and the Puppeteer is stunned and exposed; kill the Puppeteer and the buff dies with him.
- **Mirror Image** — spawns with two identical illusions that mimic his movement; illusions pop in one hit and deal no damage, but you don't know which is real until you commit. Reuses the clear-variant transparency for the pop effect.
- **Alarm Man** — never fights; sprints between enemy groups "sounding the alarm", giving everyone he touches the player-aggro state. A support enemy you drop FIRST, like the Medic but for aggression.
- **Growth Man** — spawns tiny (baby-scale) and grows a step every 10 seconds alive, gaining size/HP/damage until giant-class. A walking timer: kill early for a snack, late for a fight.
- **Leech Ball** — a smash ball that doesn't retreat after connecting: it LATCHES onto you and drains 1 HP/s until you mash any movement keys to shake it off. Terrifying paired with slows.
- **Warden** — carries a cage on his back; his grab attack imprisons a helper or civilian in place (invulnerable but useless) until the cage (a small destructible) is broken or the Warden dies.
- **Chronomancer** — projects a slow-time bubble: inside it EVERYTHING except him (you, helpers, projectiles) moves at 60% speed. The bubble is visible, so the counter is simply not fighting inside it — but he keeps walking it toward you.
- **Splitter Thrower** — his bolt forks into two mid-flight at half range (Storm Man arcs on HIT; this one forks in the AIR), turning every dodge into a two-lane problem.
- **Frost Cube** — the missing elemental cube: a pale-blue block whose bolt FREEZES (the Snow Man status) instead of slowing. Completes the cube set: burn, shock, slow, freeze.
- **Grave Golem** — assembles itself out of nearby dead bodies (the corpse/sink system already tracks them): more corpses within range at spawn = bigger, tougher golem. Fighting him over a battlefield you just filled is your own fault.
- **Sand Wraith** — sand-pit arena rare that collapses into a gust of sand to reposition behind you every few seconds; only solid (hittable) while attacking. The sand pit's Cloaked Assassin.
- **Echo Man** — remembers the last attack that HIT him (punch, kick, even a drone zap) and throws the same payload back at you as his next attack. Fight him with your weakest move.

### The neutral army (the faction that fights the enemies for you)

*Built 2026-09-07 — a squad of six roles, rebalanced from "victims in uniform" into the one faction on the map that is genuinely good at fighting. Per-role loadouts live in `ARMY_LOADOUTS` / `armyLoadoutFor()` in `gameState.ts`; behaviour is all in the army branch of `CivilianActor.tsx`.*

| Role | HP | Damage | Cadence | What makes it worth fielding |
| --- | --- | --- | --- | --- |
| **Trooper** (`armyMelee`) | 30 | 5 | 1.05s | The line. The yardstick everything else is set against. |
| **Rifleman** (`armyRanged`) | 26 | 4 ranged | 1.6s | Fires across the room; kites out when something closes inside 6.5 units. |
| **Sergeant** (`armySergeant`) | 38 | 7 | 0.95s | Aura, 16 units: +40% damage, +25% attack speed, and nobody breaks off to hunt a medkit mid-firefight. |
| **Shield Trooper** (`armyShield`) | 62 | 4 | 1.4s | Taunts — enemies pick him from ~2.2× further than anyone else — and takes 35% damage from projectiles. |
| **Medic** (`armyMedic`) | 12 | — | — | Never attacks. Runs from anything hostile, otherwise heals the worst-hurt soldier he can reach (+4 / 3.5s). |
| **Radioman** (`armyRadio`) | 24 | 3 | 1.4s | While outnumbered within 22 units, calls in 2 more soldiers every 26s. |

Two squad-wide changes matter as much as the roles do:

- **Focus fire.** Soldiers no longer each chip a different enemy. Every man scores targets as `health + distance × 1.5` from the same roster, so they independently converge on the same wounded body and it actually dies. This is the single change that makes them read as a unit.
- **Sight radius 10 → 17.** A soldier who only notices trouble at ten metres walks past most of it.

`🪖 FULL SQUAD` spawns all seven in formation — shield up front, sergeant and two troopers on the line, rifleman off the shoulder, medic and radio behind.

**Still to build for this faction:**
- **Army in normal mode** — the whole neutral faction (civilians, army, VIP, bodyguards) currently only exists via the four sandbox spawn actions; `civilians` starts as `[]` in every mode. Wiring civilians into world generation with a chance of an army escort would put all of this AI in front of players who never open the sandbox. The single highest-value item on this list.
- **Flag Bearer** — plants a destructible standard; soldiers near it heal slowly and never flee. A sergeant you can shoot.
- **Army Sniper** — very long range, slow fire, always kites; targets the *highest-health* enemy rather than the nearest, so the squad's focus fire and his priorities deliberately disagree.
- **Grenadier** — `isBomber` AOE that hurts his own side too, so he refuses to throw into a melee his squad is already in.
- **Army Engineer** — deploys a friendly turret mid-fight on a long cooldown; the turret plumbing already exists on both sides.
- **Deserter** — flees from everything, his own squad included. Save him and he permanently joins you as a helper.
- **Prisoner** — starts held inside an enemy group; free him and a three-man squad spawns loyal to you.
- **Veteran** — one per map, double health, uses the *enemy* special system (a real ability, not a punch). The soldier who is genuinely dangerous to fight.
- **Mutineer** — an army man who turns hostile to everyone, his own side included, below a health threshold.
- **Dog handler** — fast, low-HP animal that closes and staggers; the handler hangs back and never engages.
- **Squad kill order UI** — a small callout naming the highest-value target in a spotted squad ("SERGEANT", "MEDIC"), teaching the player that these roles have a correct order to shoot them in.

### Neutral units & world life
- **Medic civilian** — a white-tinted wanderer who patches up hurt CIVILIANS (and the player, slowly) when things are calm; enemies prioritize him. Distinct from the shipped Medic Soldier, who only treats soldiers.
- **Police response** — hurting too many civilians in one session flags you WANTED: an army squad (2 melee + 1 ranged) spawns hunting specifically you until the heat decays. Builds directly on the witness/aggro system.
- **Merchant wanderer** — a neutral stall/walker who trades score for a medkit or one-shot buff; killing him locks the shop for the rest of the run.
- **Stray dog** — follows whoever feeds it (medkit crumbs?), barks at cloaked/invisible enemies to reveal them — utility pet, no combat.

*(Shipped 2026-07-10/11/12: Sniper, Cloaked Assassin, Engineer, Vampire, Phase, Split, Copycat, Bomb Man, Armour Man, Sentry Turret upgrade, Coward, Slime Block, Arena mode (4 phases + 8 arena enemies), Loadout Draft, enemy health bars, minimap threat colors + shapes, spawn callouts, run modifiers, saved runs; 2026-07-12 later: SFX system, civilians take status effects, Juggernaut, Trapper Man, Resilient/Super Resilient, Shocker/Slow Cubes, Smash Balls, Lava Giant, Army Man, Bodyguard, health bars everywhere; 2026-07-14: neutral army/bodyguard faction, enemy bodyguard, enemy turret button, resilient invincibility, textured material men (concrete/wood/brick/sandy/magma/charred + lava baby + sand thrower), Minion, Ragdoll Thrower, Adaptive Man, Ragdoll/Slow/Split Balls, Giant + Colossal Slimes, civilian bystander panic, minimizable spawn menu, encyclopedia neutral tier + Helper/Turret/Player entries; 2026-07-15: Slime King, Magnet Man, Reflector, Ranged Helpers upgrade, blood-color rule (red for all stickmen), lava tiles + arena hazard waves, mines hurt enemies, destructible cover, sandbox Boss Flag, Stormy Weather modifier, portal pairs, lifetime stats screen, run recap, live entity counter, camera follow-distance slider; 2026-07-17: Achievements (20 medals + reset with baseline), Repulsor, Storm Man (weather-exclusive, chain lightning); 2026-09-07: army faction overhaul — Medic Soldier, Sergeant, Shield Trooper, Radioman, per-role loadouts, squad focus fire, longer sight radius, FULL SQUAD spawn.)*

### Player abilities
- **Magnet Gauntlet** — the player-side mirror of Magnet Man: an upgrade that passively drags nearby LIGHT enemies (babies, minis, mites) toward you, feeding your melee. Reuses the new magnet-drift plumbing in reverse.
- **Decoy** — deploy a stationary dummy clone of yourself (your tint, your silhouette); enemies target it for a few seconds. Reuses DummyActor plus the aggro-target system.
- **Shield bubble** — an upgrade granting a recharging barrier that absorbs the next N RANGED hits (melee passes through) — the anti-thrower answer, as Parry is the anti-melee one.
- **Uppercut** — crouch + punch launches a light enemy into a full ragdoll arc; comedy and crowd control in one pick. The ragdoll impulse plumbing already exists.
- **Adrenaline** — every kill grants +10% move/attack speed for 3s, stacking to 3; turns cleanup phases into a rampage rhythm. Pure statModifiers-style timers, no new systems.
- **Blood pact (lifesteal)** — the Vampire Man's trick as a late upgrade: heal 1 HP per 3 kills, or 10% of melee damage dealt. Balances against Glass Cannon nicely.
- **Trap kit** — the Trapper's mines in player hands: an upgrade granting one placeable mine per 30s. The mine system already handles every victim type (including enemies now).
- **Helper whistle** — a key that toggles helpers between FOLLOW ME (stick close, ignore distant enemies) and HUNT (current free-roam behavior); one keybind, huge tactical difference for escort-style play.
- **Weapon pickups** — a rare world pickup (bat/knife) with limited durability or swing count, dropped by Weapon Man on death. Reuses existing hit-detection and pooling patterns.
- **Grapple / zipline** — traverse to elevated platforms directly instead of only via jump, adding verticality now that platforms already exist.
- **Heavy guard** — hold Q for a guaranteed partial block (trades mobility, no timing skill) as an alternative to the timed Parry.
- **Parry counter-kick** — a successful parry opens a short window where kick deals bonus launch damage instead of just a free hit, giving Parry more payoff at higher levels.
- **Throw debris** — pick up a chunk from `DebrisParticles` (crate destruction) and throw it for a makeshift ranged option without needing a dedicated weapon system.
- **Dash tiers** — a second Dash upgrade rank granting a short cooldown-refresh or double-dash charge, giving the existing Dash pick a reason to be picked twice.
- **Climb / wall-run** — a short automatic climb up ledges under a height threshold, an alternative to Grapple for reaching platforms without a new resource system.
- **Combo string** — a proper light-light-heavy punch/kick chain instead of single repeated hits, deepening the core moment-to-moment combat feel.
- **Slide** — crouch+sprint dodges under high attacks or through narrow gaps, a distinct mobility tech from Dash (no invincibility, just a hitbox/height change).
- **Execute finisher** — walking up to a low-health enemy prompts a one-button instant kill that refunds a little stamina or health, trading a risky approach for a clean finish instead of grinding out the last hit.
- **Grab-and-throw** — a rare grab move that throws the grabbed enemy into a wall, hazard, or another enemy for bonus/splash damage.
- **Taunt** — draws aggro from nearby enemies onto the player, useful for protecting a Helper or (if Escort mode ships) the civilian NPC.
- **Second Wind** — a once-per-run upgrade: dropping to 0 HP instead ragdoll-stuns briefly and restores 1 HP rather than killing you outright, a "cheat death" pick in the same upgrade-gated family as Thorns/Dash/Parry/Ground Slam.
- **Charged punch** — hold F to wind up: release for a heavier punch with knockback that scales with hold time, trading vulnerability during the wind-up for burst damage.

### World / environment
- **Electrified floor patches** — the lava tiles shipped; an electric variant that ragdoll-stuns instead of burning would give the shock vocabulary a floor hazard too (and fits a future Storm arena).
- **Moving platforms** — elevator-style platforms that ride a fixed path, extending the existing static-platform system with timing/positioning challenge.
- **Breakable shortcuts** — destructible wall segments (beyond crates) that open a faster route through the map once destroyed, rewarding aggression.
- **Lure traps** — push/kick a crate or hazard into an enemy's path to use the environment as a weapon, instead of hazards only ever threatening the player.
- **Interior structure** — an indoor building section on the map with real fog-of-war/limited sightlines, forcing flashlight use even in daytime instead of only at night.
- **Collapsing floor** — a heavy hit or Ground Slam landing on a marked floor section opens a pit, adding a positional hazard tied to abilities the player already has.
- **Ambient wildlife** — birds, rats, or similar neutral critters with zero gameplay effect, purely to make the world feel alive between fights — a cheap atmosphere win.
- **Wind gusts** — a Stormy Weather upgrade: periodic gusts that bend projectile paths and gently push everyone sideways, making the weather modifier tactical instead of purely visual.
- **Meteor shower nights** — rare night event: burning debris rains down for 20s, leaving short-lived lava tiles where it lands (the tile system is built). Telegraphed by red target rings.
- **Golden crate** — one rare gilded crate per session; smashing it drops 3 medkits and a bonus upgrade — but the first hit summons an Enemy Bodyguard pair to defend it.
- **Quicksand pools** (sand pit) — soft patches that apply the slow status and slowly drag you toward the center; the sand arena's answer to lava tiles.
- **Volcano vent** (magma pentagon) — a central vent that erupts every ~45s, telegraphed by rumble + glow, briefly turning the middle third of the arena into hazard tiles. Forces rotation around the edge.

### Meta / progression
- **Challenge modifiers** — opt-in session modifiers (e.g. "2× enemy speed, half player health") for a score multiplier, similar in spirit to sandbox toggles but for normal-mode play.
- **Score shop** — spend accumulated score between levels on one-time consumables (extra medkit, temporary shield charge) — gives score an actual sink beyond the scoreboard number.
- **Prestige / New Game+** — reset level and upgrades for a small permanent global bonus plus a cosmetic tint unlock, for players who've maxed out a run.
- **Daily seed run** — force `worldObjects.ts`'s PRNG seed to a date-derived value so everyone gets the same layout that day, for score comparison.
- **Encyclopedia discovery gating** — silhouette/lock entries until the player has actually encountered that enemy type in a run, turning the encyclopedia into a light collection goal instead of a static reference.
- **Save profiles** — multiple named `localStorage` slots instead of the single fixed key, so separate builds/experiments don't overwrite each other.
- **Export/import save code** — a copyable JSON blob (still no backend) to back up or transfer progress between browsers.
- **Accessibility settings** — colorblind-friendly enemy tint palette, a screen-shake on/off toggle (pairs with the hit-stop idea below), and a damage-number size/opacity control.
- **Bestiary completion reward** — a one-time cosmetic tint or small permanent stat bonus for filling out every encyclopedia entry, giving the discovery-gating idea above an actual payoff.
- **Personal best records** — a small panel on the mode-select screen (best score, fastest flag clear, longest kill streak) distinct from the in-run stat tracking screen, visible before you even start a run.
- **Arena best-wave record** — the stats module now tracks best arena wave; surfacing it ON the ARENA menu button ("Best: Wave 23") is the remaining half.
- **Arena boss waves** — every 10th arena wave is a single named boss (a giant special with a fixed modifier combo and its own banner) instead of a crowd, as a rhythm break.
- **Achievement toasts** — achievements shipped; an in-game "🏅 ACHIEVEMENT UNLOCKED" banner the moment you earn one (instead of discovering it later on the menu) is the natural finisher. Reuses the wave-banner plumbing.
- **Bounty board** — a rotating daily task on the main menu ("Pop 30 slimes", "Win 2 boss flags") paying a score bonus; reads directly from the stats/achievements delta machinery that now exists.
- **Medal-gated tints** — new stickman colors unlocked by specific medals (gold tint for One Thousand Fists, storm-blue for beating 5 Storm Men), giving achievements a cosmetic payoff.

### Modes
- **Escort** — protect a slow-moving civilian NPC walking from one end of the map to the other. Enemies ignore you and beeline for the NPC. (Half the plumbing now exists: civilians already flee, follow, take damage, and panic.)
- **Slime Rain** — slimes-only endless mode: every kill splits, spawns come from the sky, the floor slowly fills with minis. Score = total slimes popped.
- **Fortress** — defend a central player turret with its own big health pool; enemies prioritize it over you, upgrades buff the turret instead of the player.
- **War mode (sandbox)** — one button: everything you've spawned picks sides (enemies vs. helpers + army + turrets) and fights WITHOUT you; enemies ignore the player entirely. You built the armies — now watch the battle. Mostly plumbing that exists (`sandboxEnemiesIgnorePlayer` + helper AI).
- **Infection** — killed civilians rise as zombie civilians (green tint, slow shamble, melee) that convert other civilians they down. One Necromancer-style rule turns the neutral faction into a spreading threat.
- **The Stalker** — one immortal, slow bounty hunter walks toward you for the ENTIRE run — killable only for a temporary knockdown. Every death of yours makes him a little faster. Tension engine, not a fight.
- **Pacifist run** — score accrues per second survived and per attack DODGED (proximity miss detection), zeroed if you ever attack. The whole roster already chases you; this just changes the scoring.

- **King of the Hill** — stand inside a glowing circle to earn score; enemies swarm the circle. Upgrades come from time held, not kills.

- **Mirror mode** — a clone of yourself (same health, same upgrades) fights alongside you, controlled by a replay of your LAST run.

- **Zombie horde** — all dead enemies keep respawning with +1 max HP each time. How long can you outlast exponential scaling?

- **Boss Rush** — back-to-back specials only (no basics), short breather between each — reuses the existing special roster and Challenge Flag plumbing without needing new enemy work.

- **Time Attack** — race to clear a fixed number of flags as fast as possible; scored by clock time instead of kills, encouraging route/skip play instead of clearing every enemy.

### UI / feel
- **Photo mode** — freecam + hide HUD while paused, built on the existing `manuallyPaused` state and camera controller.
- **Hit-stop / screen shake** — a brief freeze-frame and camera shake on crits and big hits for extra impact.
- **Off-screen damage indicator** — a directional red flash pointing toward an attacker outside the camera's view, useful in the open arena where hits can come from any side.
- **Combo counter popup** — an on-screen "×5 COMBO!" style callout for consecutive hits landed without taking damage, giving the existing combo stat-bonus system a visible payoff beyond just the numbers.
- **Sandbox spawn search** — a filter box in the (now minimizable) spawn menu; with 80+ types, finding one button is becoming its own minigame.
- **Sandbox favorites row** — pin your most-used spawn buttons to a compact favorites strip so the full menu can stay minimized.
- **Kill-all buttons** — the live entity counter shipped; per-row "clear all enemies / civilians / helpers" buttons next to it are the natural second half.

### Audio
- **Music layer** — ambience shipped; still no MUSIC. A combat-intensity track that layers in as nearby enemy count or low-health state changes.
- **Slime SFX set** — dedicated squish/split/bounce sounds for the whole cube-and-slime family (they currently share slimeHit).

---
Delete finished items from "Carried over" as they ship; fold new ones from "New ideas" up into that section once they're being actively worked on.
