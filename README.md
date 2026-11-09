# Lantern City — a Pixel Worlds prototype

**Frostbell Spire visual polish assignment:** start with [the intern handoff guide](FROSTBELL_HANDOFF.md) for setup, scenery, ambient city life, character and hurdle animation, and the pull request workflow. Preserve the existing gameplay, route, hurdles, and progression.

A 2D pixel-art action platformer inspired by **City of None** (Extremely OK Games): a little
wooden spirit rides a train between the sectors of a ruined city, relighting each sector's lantern.
It's also a **prototype for a pixel metaverse**: every world is a plug-in module with its own
palette, terrain, enemies, music and rules, while one persistent avatar travels between them.

```bash
npm install
npm run dev        # → http://localhost:5173
```

## Controls

| | keyboard | gamepad |
|---|---|---|
| move | ← → (or A D) | stick / d-pad |
| jump (hold for height) | Z / Space / K | A |
| strike (↑ / ↓ to aim, ↓ in mid-air = pogo) | X / J | X / Y |
| dash, 8 directions (after you find it) | C / Shift / L | B / RB / RT |
| talk / use / board train | ↑ | ↑ |
| drop through a platform | ↓ + jump | |
| pause · music | Enter / Esc · M | Start |

## What's in it

- **Celeste-style movement**: coyote time, jump buffering, variable jump height, half-gravity apex,
  wall slide and wall jump, 8-way dash with afterimages, dash-jumps, corner correction, squash & stretch.
- **Hollow Knight-style combat**: 3-direction stick strikes, pogo off enemies and spikes, recoil,
  hit-stop, screen shake, knock-back, parrying projectiles back at enemies.
- **Terrain "fields"**: solid ground, one-way platforms, spikes, cracked walls, ice, water (swimming),
  acid / molten slag, updrafts, moving platforms, crumbling blocks, springs, boss gates, darkness.
- **Worlds** reached by the Spirit Rail train, each with its own 4-colour palette, tile style, backdrop,
  enemies, NPCs, props and generative chiptune music. Lanterns are checkpoints; relighting a sector's
  lantern opens the next train line. Abilities (dash, double jump) carry across worlds.
- Title screen, dialogue, banners, pause menu, boss health bar, an ending with your stats,
  save/continue (localStorage), and an **Animation Gallery** that plays every sprite and lets you
  swap palettes live.

## How it's built

```
src/
  engine/        renderer (320×180, palette-indexed), sprites, font, tilemap, input, audio, particles, camera
  game/          world runtime, player, enemy base, shared entities, scenes, UI, profile (the avatar)
  art/           shared sprites: the player rig, props, procedural effects
  content/worlds/<id>/   one folder per world — map, tiles, backdrop, sprites, enemies, music
scripts/render.ts        offline PNG previews + map checks (no browser needed)
```

**Metaverse shape.** `src/content/worlds/index.ts` discovers every `content/worlds/*/index.ts`
automatically, so adding a world never touches shared code. The `Profile` (health, souls, abilities,
flags, unlocked lines) is the avatar that persists between worlds. In a networked version that
profile lives on a server and the train menu becomes a world browser. The guide for building a
world is [CONTENT_GUIDE.md](CONTENT_GUIDE.md).

**Pixel art without image files.** All art is text in code, stored as palette indices (`0`–`3`), so
every sprite recolours itself in each world's palette. There are three ways to make it, all in use:
1. **Hand-drawn ASCII frames**: enemies, NPCs, props (for example `content/worlds/outskirts/sprites.ts`).
2. **Paper-doll rig**: the player is a head and body plus line-drawn limbs, so each animation frame is
   one line of joint coordinates (`src/art/player.ts`).
3. **Procedural**: slash arcs, rings, the train and some bosses are drawn by code (`src/art/fx.ts`, `src/art/common.ts`).

A real production would export sprite sheets from Aseprite instead. The engine only needs
frames + palette, so a PNG importer could slot into `engine/sprites.ts`.

## Dev tools

| | |
|---|---|
| `?world=<id>` | jump straight into a world with all abilities (`&raw` for a fresh profile, `&spawn=station`) |
| `?world=lab` | mechanics test room (one of everything) |
| `?gallery` | the Animation Gallery |
| `?debug` or <kbd>`</kbd> | hitbox overlay |
| with debug on: <kbd>F</kbd> / <kbd>N</kbd> | fly (noclip) / warp between spawn points, checkpoints and the goal |
| `npx tsx scripts/render.ts sprites <world>` | PNG of all sprite sheets in that world's palette |
| `npx tsx scripts/render.ts map <world>` | PNG of the map with entity symbols and a 10-tile grid |
| `npx tsx scripts/render.ts check <world>` | validate a map |
| `npx tsx scripts/shot.ts <world> --tour` | **real in-game screenshots without a browser** (contact sheet of the level) |
| `npx tsx scripts/smoke.ts <world>` | crash test: random input from every spawn point, update + draw |
| `npx tsx scripts/routes/<world>.ts` | headless route playtest: every jump on the critical path re-simulated |
| `npx tsx scripts/stats.ts` | how many sheets / animations / frames / lines each world took |
| `npm run typecheck` / `npm run build` | |

`scripts/sim.ts` runs the real engine headlessly (fake input, Node canvas). It's what the route tests,
crash tests and screenshots are built on, and what the AI agents used to verify their levels.

City of None is © Extremely OK Games. This is an unofficial fan prototype for learning;
it uses none of their art, audio or code.
