# Lantern City — content guide

How to build a **world** (a sector of the city): its terrain look, backdrop, map, enemies,
NPCs, props and music. Every world is a self-contained folder; the engine finds it automatically.

```
src/content/worlds/<id>/
  index.ts      default-exports the WorldDef (palette, map, legend, music…)  ← required
  map.ts        the ASCII map
  tiles.ts      terrain look (TileStyle built with makeStyle)
  backdrop.ts   parallax background painters
  sprites.ts    sprite sheets (defineSheet)
  enemies.ts    enemy/prop classes + registerEntity(...) calls
```

Reference implementation: `src/content/worlds/outskirts/`. Read it first.

**Ground rules for parallel work**
- Only edit files inside your own world folder. Never edit `src/engine`, `src/game`, `src/art`,
  other worlds, `package.json`, or this guide. If you need an engine change, implement it locally
  (your own Entity subclass can do almost anything) or describe the need in your final report.
- Prefix everything global with your world id: entity kinds `'<id>:name'`, sprite sheet ids `'<id>-name'`.
- Don't start dev servers or use the browser — the lead playtests in the browser. Verify with the
  commands at the bottom of this file.

---

## 1. Look: four colours

Every world has exactly 4 colours, darkest → lightest. All art stores **palette indices**, so the
same sprite recolours itself per world (see the Animation Gallery: ↑↓ swaps palettes).

| index | role |
|---|---|
| `0` | background / darkness / outlines / eye holes |
| `1` | backdrop line-art, terrain texture shading, dark details of characters |
| `2` | terrain surfaces & edges, enemy bodies, props |
| `3` | the player's face/body, eyes, highlights, hazard tips, pickups, light |

Readability rules (this is what makes it look like City of None):
- Backdrops use **only colour 1**, sparse line-art and dithering. Never 2/3 in the backdrop.
- Solid terrain = dense texture with a clear colour-2 edge; the player must instantly see what is solid.
- Keep big areas of colour 3 rare: it is reserved for things that matter (player, light, danger, loot).
- Dithering (checkerboards, `bayer()` in `engine/math`) is the only way to get "in-between" shades.
- Internal resolution is 320×180 (40×22.5 tiles of 8px). The player is 16×20 px.

## 2. Sprites

```ts
import { defineSheet } from '../../../engine/sprites';
defineSheet('underworks-rat', {
  w: 12, h: 8,          // frame size
  ox: 6, oy: 8,         // pivot: usually bottom-centre (feet). Floating things: centre.
  frames: {
    run1: ['....22......', /* … exactly h rows of exactly w chars … */],
    run2: [/* … */],
  },
  anims: {
    run: { frames: ['run1', 'run2'], fps: 10 },
    die: { frames: ['run1'], fps: 1, loop: false },
  },
});
```
- `.` transparent, `0`–`3` palette index. **Draw characters facing RIGHT** — the game mirrors them.
- Row/size mistakes are logged as warnings; check them with the sprites preview command.
- Three ways to make frames (use whichever fits):
  1. **Hand-drawn ASCII** (`outskirts/sprites.ts` — hound, wisp, Old Wick). Share rows between frames
     by building them from parts (`[...BODY, ...LEGS.a]`).
  2. **Paper doll** (`src/art/player.ts`): stamp parts and draw limbs as lines on a `PixelBuffer`,
     then `buf.toRows()`. Great for many poses of one character.
  3. **Procedural** (`src/art/fx.ts`, `src/art/common.ts` train): draw with `PixelBuffer`
     (`rect`, `line`, `ellipse`, `polyline`, `stamp`, `outline`) in a loop. Great for big/mechanical things.
- Animation craft: 2–6 frames per loop at 6–12 fps; give every attack a readable **telegraph**
  (a wind-up pose and/or flash, ≥0.35 s) before it hurts; idle loops should breathe/blink.

## 3. Terrain (tiles.ts)

```ts
import { makeStyle, tufts, hangers } from '../../../game/tilekit';
export const style = makeStyle({
  solid: { texture: (x, y) => /* 0-3 for world pixel x,y */, edge: 2, top: 2, topThickness: 2, gap: true, rounded: false },
  ice: { /* optional SolidLook for I tiles */ },
  oneway: [/* 8 rows × 8 */], spike: [/* 8×8, pointing UP; auto-rotated */], breakable: […], gate: […],
  detail: (buf, map, tx, ty) => { /* extra marks on solid tiles: rivets, cracks… */ },
  decorate: (buf, map, tx, ty) => { tufts(…); hangers(…); /* for open tiles: grass, icicles, chains */ },
});
```
`paintSolid` auto-tiles: it outlines exposed edges and fills the inside with your texture.
`texture(x, y)` gets **world pixel** coordinates — make it a repeating pattern (bricks, leaves, ice cracks).
Use `hash2(x, y, seed)` from `engine/math` for stable pseudo-random detail.

## 4. Backdrop (backdrop.ts)

```ts
export const backdrop: Backdrop = {
  far(buf)  { /* paint into a 640×180 PixelBuffer that tiles horizontally; colour 1 only */ },
  near(buf) { /* optional closer layer, very sparse */ },
  farScroll: 0.12, nearScroll: 0.35,
};
```

## 5. The map (map.ts)

One string per row of 8 px tiles. Rows should all be the same length. Spaces are empty air.

**Tiles (fixed in every world)**

| char | tile |
|---|---|
| `#` | solid ground (auto-tiled with your style) |
| `=` | one-way platform (jump up through, stand on; ↓+jump drops through) |
| `^ v < >` | spikes pointing up / down / left / right (−1 health, respawn at last safe ground) |
| `X` | cracked wall — 3 strikes break a connected group (great for secrets) |
| `I` | ice — solid and slippery |
| `~` | water — swim: jump repeatedly to stroke upward, slow fall |
| `%` | acid / molten slag / bile — hazard liquid (like spikes) |
| `W` | updraft — lifts the player at 125 px/s (wind columns, steam vents) |
| `G` | boss gate — open (passable) until your code calls `world.setGates(true)` |
| `;` | invisible turnaround marker for moving platforms |
| `:` | back wall — decorative interior wall behind the action (not solid); style option `back(x, y)` |

**Entities available in every world**

| char | thing | placement notes |
|---|---|---|
| `P` | player start (only the first world really needs it; `?world=id` falls back to `T`) | |
| `T` | train station (conductor + parked train) — where you **arrive** | arrival spot is 2 tiles left of `T`; keep **18 tiles of flat floor to the right of `T` and 6 tiles of headroom** (the train is drawn there) |
| `E` | sector lantern = the world's goal; relighting it unlocks the next world, then it works as a station | needs 3×5 tiles of space, on the floor |
| `C` | checkpoint lantern (save + heal + respawn point) | on the floor, 4 tiles headroom |
| `o` | soul (currency) | floats in its cell |
| `H` | wooden heart (+1 max health) — hide these | |
| `L` | hanging lamp (light + glow) | put it in the cell directly **under a ceiling** |
| `D` / `U` | ability shrine: Spirit Dash / Ember Wings (double jump) | on the floor |
| `m` / `n` | moving platform, 3 tiles wide, travelling right / up until a `;` or a wall, then back | legend options `phase` (0..1), `period` (s), `speed` (px/s) keep neighbours in step |
| `K` | crumbling block (falls 0.45 s after you touch it, reforms) | |
| `J` | spring pad (launches ~5 tiles up) | on the floor |

Any legend entry can set the terrain under its symbol with `tile: '#'` (or `'~'`, `':'`…), e.g. a clock
face set into a wall. Otherwise an entity symbol's cell takes on the water / back wall around it (an eel placed in a pool stays
underwater). Cracked walls need **3 separate strikes**. Souls are attracted to the player only through
open air. While a dialogue or the train menu is open the world pauses, except talkable entities.

Your own symbols go in the WorldDef `legend` (any unused character, e.g. letters and digits):
```ts
legend: {
  r: 'underworks:rat',                                         // your registered enemy kind
  '1': { kind: 'sign', text: ['LINE ONE', 'LINE TWO'] },       // readable sign
  N: { kind: 'npc', sheet: 'underworks-rusty', name: 'RUSTY', talk: 'talk',
       lines: ['…', '…'], alt: [{ flag: 'goal:underworks', lines: ['…after you relit the lantern'] }] },
  k: { kind: 'decor', sheet: 'underworks-pipe', anim: 'drip', back: false, light: 30, halo: 12, anchor: 'floor' },
}
```
NPC sprite sheets need `idle` and (optionally) `talk` anims; they're positioned by bottom-centre on the cell floor.
Decor: `anchor` is `'floor'` (default), `'ceiling'` or `'center'`; `back: true` draws it behind the terrain;
`glow: px` moves the light/halo centre that far from the anchor (e.g. the lamp at the top of a tall post).

### Movement numbers for level design (8 px tiles)

| move | reach |
|---|---|
| run | 90 px/s (11 tiles/s) |
| jump (hold) | ~3.5 tiles high; design step-ups of **≤ 3 tiles**; a tap jump is ~1 tile |
| running jump gap | **≤ 5 tiles** safely (6 is a stretch) |
| wall jump | climb chimneys 2–6 tiles wide; wall slide slows falls. **A single wall can also be climbed** with repeated wall-jumps (~0.7 tiles each) — line walls with spikes where that would skip a challenge |
| dash (8 directions, 1 per airtime, refills on ground / pogo / spring) | ~6 tiles; dash-jumps clear gaps ~10 tiles; up-dash adds ~5 tiles height |
| double jump (after the `U` shrine) | ~3 more tiles of height |
| pogo (↓+strike on an enemy or spikes in mid-air) | bounces ~2.5 tiles up and refills dash |
| spring `J` | ~5 tiles up |
| player hitbox | 8 × 14 px → passages must be **2 tiles tall** |

Abilities by world: **Outskirts** gives Dash (`D`). **Underworks** gives Ember Wings (`U`).
Frostbell, Catacombs and Foundry may require both.

Design guidance:
- Target **2.5–3 minutes** for a first-time player: ~5–7 distinct sections ("rooms") flowing
  left→right with some vertical climbs/descents, **3–4 checkpoints**, one or two optional
  side-areas with souls / a wooden heart behind a cracked wall. Typical map: 220–320 tiles wide,
  30–60 tiles tall. Enclose the map with solid walls on the left/right; falling out of the bottom
  is a pit (−1 health). Open sky at the top is fine but avoid letting the player leave the map.
- Introduce each mechanic safely first, then combine. Put a checkpoint before every hard part.
- Mix terrain types ("fields") within the map so sections feel different.
- Place enemies on flat ground long enough to patrol (≥ 6 tiles). Don't stack many at spawn points.
- `T` near the start (left), `E` at the end (right). Players ride the train back from the lit `E`.

## 6. Enemies & custom entities (enemies.ts)

```ts
import { Enemy } from '../../../game/enemy';
import { registerEntity } from '../../../game/registry';
import { Anim } from '../../../engine/sprites';

class Rat extends Enemy {
  private anim = new Anim('underworks-rat', 'run');
  private dir: 1 | -1 = -1;
  constructor(world: World, x: number, y: number) {
    super(world, x - 2, y + 2, 12, 6);   // (x, y) = top-left of the map cell; put the feet at y + 8
    this.hp = 2; this.souls = 1;
  }
  update(dt: number) {
    this.tick(dt);                       // flash + stun timers
    this.applyGravity(dt);
    if (this.stun <= 0) {
      this.vx = this.dir * 60;
      if (this.wallAhead(this.dir) || !this.groundAhead(this.dir)) this.dir = -this.dir as 1 | -1;
    }
    this.physics(dt);                    // moveX/moveY against terrain
    this.touchPlayer();                  // contact damage
    this.anim.update(dt);
  }
  draw(r: Renderer) {
    this.drawFrame(r, 'underworks-rat', this.anim.frame, this.cx, this.bottom, { flip: this.dir < 0 });
  }
}
registerEntity('underworks:rat', (w, x, y) => new Rat(w, x, y));
```
Enemy base gives you: `hp`, `contactDamage`, `knockback` (0 = immovable), `souls`, `flash`, `stun`,
`hurt()`, `die()`, `onHurt()` / `onDeath()` hooks, `touchPlayer(box?)`, `applyGravity()`, `physics()`,
`groundAhead()`, `wallAhead()`, `playerDir()`, `playerDist()`, `canSeePlayer(range)`, `drawFrame()` (hit flash).
Override `hurtbox()` to change what can be hit, or `onSlash()` to block/deflect hits (shields, armour).

Entity base: integer `x, y, w, h` (top-left hitbox), `vx, vy`, `cx, cy, bottom, right`, `moveX/moveY`
(stop at solids, return true on hit), `moveFree` (no collision), `onGround()`, `depth`, `removed`.
Optional hooks: `drawBack(r)` (behind terrain — glows), `light()` (dark worlds), `interact(player)`
(makes it usable with ↑), `onSlash(player, dx, dy)`.

World API (`this.world`): `player` (`cx, cy, bottom, alive, hurt(dmg, fromX), bounce(vy), facing, vx, vy`),
`particles.burst(x, y, n, {colors, speed, angle, life, size, grav, bounce, spread})`,
`sfx(name)`, `shake(0..1)`, `hitstop(seconds)`, `add(entity)`, `entities`, `map` (`at(x,y)`, `get(tx,ty)`,
`solidTile`, `set`), `tileAt(x, y)`, `solidAt(x, y, w, h)`, `lineOfSight(x0, y0, x1, y1)`,
`spawnSouls(x, y, n)`, `hasFlag(k)` / `setFlag(k)`, `setGates(closed)`, `arena` (camera lock rect),
`time`, `game.audio` (`play`, `tone`, `noise`, `playSong`), `ui` (`say`, `banner`, `title`, `boss(name, frac)` / `boss(null)`).

Sound names: `jump walljump land dash refill slash hit hurt die enemyDie soul checkpoint powerup shoot
reflect charge growl blip select break gate slam roar explode chug whistle`. For anything else use
`world.game.audio.tone(type, fromHz, toHz, seconds, volume)` / `noise(seconds, volume, filter, fromHz, toHz)`.

Projectiles: `new Bullet(world, x, y, vx, vy, { sheet, anim, damage, gravity, life, reflectable, ghost, size })`
from `game/common/bullet`. The player can slash reflectable bullets back for 3 damage to enemies.

Bosses: trigger when the player enters the arena: `world.setGates(true)`, `world.arena = {x, y, w, h}`
(camera lock), `world.ui.title('BOSS NAME')`, `world.ui.boss('NAME', hp / maxHp)` every frame,
`world.game.audio.playSong(bossMusic)`. On death: `world.setFlag('boss:<id>')`, `setGates(false)`,
`world.arena = null`, `world.ui.boss(null)`, restore the world music. Check the flag on spawn so a
beaten boss stays beaten. Give the boss 3+ readable attack patterns with telegraphs, ~20–40 hp.

## 7. Music & atmosphere

```ts
music: { bpm: 84, root: 57 /* MIDI */, scale: [0, 2, 3, 5, 7, 8, 10], bars: [0, 5, 3, 4],
         melody: ['0..2..4.....3.2.', /* one 16-step string per bar; digits = scale degree */],
         lead: 'triangle', bass: 'triangle', sparkle: 0.06, drums: 'soft' /* or 'driving', or omit */ }
ambient: 'snow',   // optional WorldDef field: 'motes' | 'snow' | 'embers' | 'spores'
```

## 8. Verify (run from the project root)

```bash
npx tsc --noEmit -p .                                 # whole project must typecheck
npx tsx scripts/render.ts check <id>                  # map sanity: sizes, symbols, kinds, T and E
npx tsx scripts/render.ts map <id> [fromCol toCol]    # PNG of the map → previews/<id>-map*.png
npx tsx scripts/render.ts sprites <id> [sheet …]      # PNG of sprite sheets in your palette
npx tsx scripts/render.ts backdrop <id>               # PNG of the parallax layers
```
Open the PNGs with your image viewer / Read tool and actually look at them: fix anything that's
noisy, unreadable or misaligned.

Headless playtesting (real engine, no browser):
```bash
npx tsx scripts/shot.ts <id> --tour                    # in-game frames across the level (darkness, entities, HUD)
npx tsx scripts/shot.ts <id> <col> <floorRow>          # one in-game frame with Twig standing there
npx tsx scripts/smoke.ts <id> 30                       # crash test from every spawn point
npx tsx scripts/routes/<id>.ts                         # the world's route regression test (uses scripts/sim.ts canReach)
``` In the browser the lead uses `?world=<id>` (all abilities) or
`?world=<id>&raw` (fresh profile), `?debug` for hitboxes, and the Animation Gallery.
