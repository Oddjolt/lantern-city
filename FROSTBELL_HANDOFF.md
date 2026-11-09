# Frostbell Spire intern handoff

For **@prakhardhakad1**: make **Frostbell Spire**, the third map in Lantern City, more beautiful, lively, and polished. This is a visual and animation assignment. Preserve how the game plays: the same route, steps, hurdles, mechanics, difficulty, and progression. The map is a frozen clocktower with ice, gusts, moving gears, bell gates, enemies, and a summit lantern. This branch contains the full Lantern City project because the map depends on its shared engine, player, and art.

- Repository: https://github.com/Oddjolt/lantern-city
- Handoff and pull request base branch: `codex/frostbell-prakhardhakd1`
- World ID: `frostbell` (`order: 3` in the world definition).
- Start by reading this guide, [README.md](README.md), and [CONTENT_GUIDE.md](CONTENT_GUIDE.md).

## Get the game running

Use Git and Node.js 24 LTS with npm. Install from the committed lockfile:

```bash
git clone --branch codex/frostbell-prakhardhakd1 https://github.com/Oddjolt/lantern-city.git
cd lantern-city
npm ci
npm run dev
```

Open the URL printed by Vite (normally http://localhost:5173), then append `?world=frostbell&spawn=station` to start directly at Frostbell with dash and double jump. The complete URL is normally:

http://localhost:5173/?world=frostbell&spawn=station

Frostbell follows Outskirts (dash) and Underworks (double jump), so both abilities are expected. `&raw` removes these abilities; use it only to diagnose ability assumptions. `?gallery` opens the animation gallery. Add `&debug` to the world URL for hitboxes; with debug enabled, F toggles flight and N cycles through spawn/checkpoint/goal locations. Debug shortcuts are useful for inspecting sections, but complete the final playthrough with flight disabled.

Move with arrows or A/D; jump with Space/Z/K; strike with X/J; dash with C/Shift/L; interact with Up; pause with Enter/Esc; toggle music with M. Hold Down and strike while airborne to pogo.

This assignment authorizes you to run the game locally and test in your browser; the no-browser instruction in CONTENT_GUIDE.md was for the original parallel agent workflow. Follow its art conventions, with the explicit player-art exception below.

## Preserve the game

Keep the existing level geometry, platforms, steps, jumps, collisions, hazard locations, enemy placements, station, checkpoints, pickups, and goal unchanged. Preserve movement physics, combat, enemy behaviour, damage, attack and hazard timing, moving-platform paths and speed, gust force and timing, bell and gate timing, abilities, controls, dialogue, story, and unlocks. Do not add new quests, puzzles, enemies, collectible requirements, or interactions.

New trees, buildings, animals, and humans are scenery or ambient life: they must not block movement, damage the player, trigger combat, carry the player, or change progression. Place them in decorative layers or empty space without replacing gameplay tiles or existing entities. Cosmetic animation must follow the existing gameplay state and timing; do not delay a warning, move a hazard's apparent active area away from its collision box, or change an attack window to suit the animation.

## Files to work on

Keep world scenery and animation changes inside `src/content/worlds/frostbell/`. All art is drawn from TypeScript and palette indices; no external art editor is required. In files that contain behaviour and rendering together, edit only presentation and decorative animation.

| File | Responsibility |
| --- | --- |
| `map.ts` | Existing 124 by 132 tile layout, built with `room`, `sky`, `fill`, and `put`. Preserve gameplay cells and positions; only add noninteractive decoration in empty cells, or draw it in decorative layers instead. Coordinates are tiles of 8 pixels. |
| `index.ts` | Four-colour palette and decorative symbol definitions. Preserve gameplay legend entries, music, dialogue, identity, and progression. |
| `mechanics.ts` | Cosmetic drawing and ambience for gusts, bells, gates, gears, and the tower. Preserve their behaviour, collisions, and timings. |
| `enemies.ts` | Cosmetic rendering for owls, yetis, bats, and icicles. Preserve behaviour, spawn positions, damage, and attack timing. |
| `sprites.ts` | Enemy, NPC, prop, and mechanic sprite frames and animations. |
| `tiles.ts` | Terrain appearance and decoration. |
| `backdrop.ts` | Parallax background. |

Player polish is also in scope: `src/art/player.ts` defines Twig's appearance, poses, and animation frames. This is an explicit exception to CONTENT_GUIDE.md's world-folder-only rule. Improve the character's silhouette, expressions, and idle/run/jump/dash/strike/hurt poses while preserving sprite dimensions, anchor alignment, existing animation and frame identifiers, animation timing, and gameplay state transitions. Keep this work in a separate commit because the shared player art appears in every world; check it in every world's palette and the animation gallery. Do not change physics or combat in `src/game/player.ts`.

For reference, read `src/game/registry.ts`, `src/game/world.ts`, and `src/game/player.ts` to understand the interfaces and movement. Propose any other shared rendering changes separately instead of modifying shared engine code in this assignment. Prefix new decorative entity kinds with `frostbell:` and sprite sheet names with `frostbell-`. Preserve world ID `frostbell`, order 3, and the goal unlocking `catacombs`.

## Explore the six sections

| Section | Existing content |
| --- | --- |
| Courtyard | Train arrival, Bellringer Hoot, frozen pond, yeti, permanent door bell. |
| Base Hall | Falling icicles, spikes, owl, ice shaft, crumbling bridge. |
| Gearworks | Moving gear platforms, lifts, and a hidden heart. |
| Windward Gallery | Gusts, an updraft, and a crumbling bridge. |
| Bell Chamber | Timed gates, bell pogo challenges, and a sealed vent. |
| Blizzard Crown | Roof traversal, alternating gusts, tunnel, and the summit lantern. |

## Visual polish assignment

Make the frozen city feel inhabited while keeping its clocktower identity, four-colour pixel art, and readable platforms and hazards. Suggested improvements:

- **Trees and vegetation:** snow-covered trees, bare branches, shrubs, and small plants in suitable courtyard and exterior spaces.
- **City detail:** layered rooftops, distant buildings, lit windows, balconies, railings, street lamps, signs, and architectural detail around the existing route.
- **Animals:** decorative birds, cats, or other creatures that perch, blink, idle, or wander safely in the background. They are not new enemies or obstacles.
- **Humans and city life:** background residents walking, talking through gestures, warming themselves, or watching the train. Keep them noninteractive and outside the playable route.
- **Environmental animation:** swaying branches, flags, chiming bells, turning gears, flickering lanterns, smoke, drifting snow, and subtle background activity. Avoid visual clutter over jumps and hazards.
- **Character polish:** clearer poses, livelier expressions, and smoother-looking motion for Twig and existing characters within the current animation timings.
- **Hurdle animation:** improve how existing spikes, icicles, gusts, bells, gates, and moving platforms look and communicate their current state. Preserve their locations, paths, collision areas, and active timings exactly.

Start by playing the existing map and capturing reference screenshots or a short video. Pick the courtyard for a small first visual pass, show before/after images and an animation clip, then expand the approved visual direction through the tower's six sections. Submit player art separately from environment polish so its effect across worlds is easy to review.

Gameplay bugs or design ideas discovered during the work should be reported separately. Do not fix or redesign them as part of this visual assignment. Avoid dependency and save format changes.

## Check each change

Run from the project root:

```bash
npm run build
npm run qa -- frostbell
npx tsx scripts/smoke.ts frostbell 30
npx tsx scripts/render.ts map frostbell
npx tsx scripts/render.ts sprites frostbell
npx tsx scripts/shot.ts frostbell --tour
```

The QA command validates the map and simulates random input from its spawn points. Generated PNGs go to ignored `previews/`; inspect them and attach useful images to the pull request. There is currently **no Frostbell route regression test**: QA reports `no test` for the route. Map validation and random input cannot prove that gameplay is unchanged. Manually play from the station through every required gate to the summit with flight disabled, then confirm the lantern opens the Catacombs line.

Compare before/after screenshots from the same positions, and include short clips for animation changes. Use the debug overlay to check that art still lines up with collision boxes and that decoration never hides hazards or safe landing surfaces. Confirm existing bell, gust, enemy, and platform timings are unchanged. Record a performance comparison using the same device and scene; ambient life should not introduce noticeable stutter. If player art changes, inspect idle, run, jump, double jump, wall slide, dash, strike, and hurt animations in the gallery and play in each world's palette.

## Submit work from a fork

The repository is public. You can fork it and submit pull requests without write access to Oddjolt's repository. On GitHub, fork `Oddjolt/lantern-city`; if offered “Copy the main branch only”, turn it off to include the handoff branch. You can also fetch the handoff branch explicitly as shown below.

For @prakhardhakad1, after creating the fork:

```bash
git clone https://github.com/prakhardhakad1/lantern-city.git
cd lantern-city
git remote add upstream https://github.com/Oddjolt/lantern-city.git
git fetch upstream codex/frostbell-prakhardhakd1
git switch -c frostbell-improvements upstream/codex/frostbell-prakhardhakd1
npm ci
```

After editing and testing:

```bash
git add src/content/worlds/frostbell/
git commit -m "Polish Frostbell Spire scenery and animation"
git push -u origin frostbell-improvements
```

For a separate player-art commit, stage `src/art/player.ts` explicitly. Review the staged diff to ensure no gameplay code or unrelated files are included.

Open a pull request with **base repository** `Oddjolt/lantern-city`, **base branch** `codex/frostbell-prakhardhakd1`, and **compare branch** your fork's `frostbell-improvements`. Do not target `main` for the first review. Include what looks better, before/after images, animation clips, checks and manual playthrough results, confirmation that gameplay and timings are unchanged, and any remaining issues. Keep each pull request small enough to review independently.

If you already cloned Oddjolt's repository using the quick-start instructions, either use a separate directory for your fork or rename the existing `origin` remote to `upstream` and add your fork as `origin` before pushing.
