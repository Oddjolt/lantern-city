# Frostbell Spire intern handoff

Improve **Frostbell Spire**, the third map in Lantern City, while keeping the complete game runnable. The map is a frozen clocktower with ice, gusts, moving gears, bell gates, enemies, and a summit lantern. This branch contains the full Lantern City project because the map depends on its shared engine, player, and art.

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

This assignment authorizes you to run the game locally and test in your browser; the no-browser instruction in CONTENT_GUIDE.md was for the original parallel agent workflow. Its world ownership and art conventions still apply.

## Files to work on

Keep gameplay and art changes inside `src/content/worlds/frostbell/`. All art is drawn from TypeScript and palette indices; no external art editor is required.

| File | Responsibility |
| --- | --- |
| `map.ts` | Builds the 124 by 132 tile map using `room`, `sky`, `fill`, and `put`; section comments explain the route. Coordinates are tiles of 8 pixels. |
| `index.ts` | World ID, four-colour palette, symbol legend, NPC dialogue, music, and progression to Catacombs. |
| `mechanics.ts` | Gust zones, strike bells, ice gates, moving gear platforms, and ambience. |
| `enemies.ts` | Owl, yeti, bat, and falling icicle behaviour. |
| `sprites.ts` | Enemy, NPC, prop, and mechanic sprite frames and animations. |
| `tiles.ts` | Terrain appearance and decoration. |
| `backdrop.ts` | Parallax background. |

For reference, read `src/game/registry.ts`, `src/game/world.ts`, and `src/game/player.ts` to understand the interfaces and movement. Propose shared engine changes separately instead of modifying them in this assignment. Prefix new entity kinds with `frostbell:` and sprite sheet names with `frostbell-`. Preserve world ID `frostbell`, order 3, the train station, checkpoints, and the goal unlocking `catacombs`.

## Explore the six sections

| Section | Existing content |
| --- | --- |
| Courtyard | Train arrival, Bellringer Hoot, frozen pond, yeti, permanent door bell. |
| Base Hall | Falling icicles, spikes, owl, ice shaft, crumbling bridge. |
| Gearworks | Moving gear platforms, lifts, and a hidden heart. |
| Windward Gallery | Gusts, an updraft, and a crumbling bridge. |
| Bell Chamber | Timed gates, bell pogo challenges, and a sealed vent. |
| Blizzard Crown | Roof traversal, alternating gusts, tunnel, and the summit lantern. |

## First assignment

1. Play from the station to the summit. Record confusing jumps, unclear hazards, unfair deaths, gate timing issues, and places where the route is hard to read. Include a screenshot or tile coordinates for each finding.
2. Pick one section and make a small first pull request: improve its readability or timing, or fix a reproducible bug. Explain the player experience before and after the change.
3. Expand improvements after review. Useful directions include clearer gust warnings, bell and gate feedback, fair platform timing, enemy attack telegraphs, checkpoint pacing, and stronger visual landmarks. Preserve the frozen clocktower theme and four-colour art style.

Introduce a mechanic safely before combining it with hazards. Ensure each required jump works with normal controls, enemies have readable warnings, and respawns do not put the player into immediate damage. Avoid changing other worlds, player physics, dependencies, or save data formats.

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

The QA command validates the map and simulates random input from its spawn points. Generated PNGs go to ignored `previews/`; inspect them and attach useful images to the pull request. There is currently **no Frostbell route regression test**: QA reports `no test` for the route. Map validation and random input cannot prove that the level is completable. Manually play from the station through every required gate to the summit with flight disabled, then confirm the lantern opens the Catacombs line. An optional future improvement is `scripts/routes/frostbell.ts`, using `scripts/routes/catacombs.ts` and `scripts/sim.ts` as references; keep that test focused on actual route reachability.

## Submit work from a fork

The repository is public. You can fork it and submit pull requests without write access to Oddjolt's repository. On GitHub, fork `Oddjolt/lantern-city`; if offered “Copy the main branch only”, turn it off to include the handoff branch. You can also fetch the handoff branch explicitly as shown below.

Replace `YOUR_GITHUB_USERNAME` with your actual GitHub login:

```bash
git clone https://github.com/YOUR_GITHUB_USERNAME/lantern-city.git
cd lantern-city
git remote add upstream https://github.com/Oddjolt/lantern-city.git
git fetch upstream codex/frostbell-prakhardhakd1
git switch -c frostbell-improvements upstream/codex/frostbell-prakhardhakd1
npm ci
```

After editing and testing:

```bash
git add src/content/worlds/frostbell/
git commit -m "Improve Frostbell Spire traversal"
git push -u origin frostbell-improvements
```

Open a pull request with **base repository** `Oddjolt/lantern-city`, **base branch** `codex/frostbell-prakhardhakd1`, and **compare branch** your fork's `frostbell-improvements`. Do not target `main` for the first review. Include what changed, why it helps, checks and manual playthrough results, before/after images, and any remaining issues. Keep each pull request small enough to review independently.

If you already cloned Oddjolt's repository using the quick-start instructions, either use a separate directory for your fork or rename the existing `origin` remote to `upstream` and add your fork as `origin` before pushing.
