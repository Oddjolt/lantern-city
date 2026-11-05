import type { Sfx } from '../engine/audio';
import { Camera } from '../engine/camera';
import { bayer, hash2, overlaps, rand, type Rect } from '../engine/math';
import { Particles } from '../engine/particles';
import { PixelBuffer } from '../engine/pixels';
import { H, W, type Renderer } from '../engine/renderer';
import { T, TILE, TileMap } from '../engine/tilemap';
import { SoulOrb } from './common/pickups';
import type { Entity, Light } from './entity';
import type { Game } from './game';
import { Player } from './player';
import type { SpawnPoint } from './profile';
import { BASE_LEGEND, entityFactory, TILE_OF, type SpawnOpts, type WorldDef } from './registry';

/** What the world can ask of the screen it is shown on (dialogs, menus, respawn…). */
export interface WorldUi {
  /** Dialogue box; the player can't move until it closes. */
  say(speaker: string, lines: string[], onDone?: () => void): void;
  /** Big centred announcement (ability found, sector relit…). */
  banner(title: string, sub?: string): void;
  /** Area / boss name card, top-left. */
  title(text: string): void;
  /** Open the train destination menu. */
  travel(): void;
  /** Player died: run the respawn sequence. */
  died(): void;
  /** Show a boss health bar (frac 0..1), or hide it with null. */
  boss(name: string | null, frac?: number): void;
  /** The final lantern is lit: roll the ending after the current banner. */
  ending(): void;
  readonly busy: boolean;
}

const NO_UI: WorldUi = {
  say: (_s, _l, done) => done?.(),
  banner: () => {},
  title: () => {},
  travel: () => {},
  died: () => {},
  boss: () => {},
  ending: () => {},
  busy: false,
};

interface Breakable {
  tiles: [number, number][];
  hp: number;
  key: string;
}

/** One loaded world: its tilemap, entities, camera and effects. */
export class World {
  readonly map: TileMap;
  readonly camera = new Camera();
  readonly particles: Particles;
  entities: Entity[] = [];
  readonly player: Player;
  ui: WorldUi = NO_UI;
  time = 0;
  /** Named spawn points: 'start', 'station' and checkpoint ids. */
  spawns = new Map<string, { x: number; y: number }>();
  /** Camera clamp override (e.g. a locked boss arena). */
  arena: Rect | null = null;
  private freeze = 0;
  private breakables: Breakable[] = [];
  private layers: { far: HTMLCanvasElement | null; near: HTMLCanvasElement | null; palette: unknown } = {
    far: null,
    near: null,
    palette: null,
  };
  private dark: HTMLCanvasElement | null = null;
  private lightDisks = new Map<number, HTMLCanvasElement>();

  constructor(
    readonly game: Game,
    readonly def: WorldDef,
    spawn: SpawnPoint,
  ) {
    const rows = def.map;
    const w = Math.max(...rows.map((r) => r.length));
    this.map = new TileMap(w, rows.length, def.tiles);
    this.particles = new Particles((x, y) => this.map.solidPoint(x, y));
    const legend = { ...BASE_LEGEND, ...def.legend };
    const pending: [SpawnOpts, number, number][] = [];
    rows.forEach((row, ty) => {
      for (let tx = 0; tx < row.length; tx++) {
        const ch = row[tx];
        const tile = TILE_OF[ch];
        if (tile !== undefined) {
          this.map.set(tx, ty, tile);
          continue;
        }
        if (ch === ' ' || ch === '.') continue;
        const entry = legend[ch];
        if (!entry) {
          console.warn(`${def.id}: unknown map symbol '${ch}' at ${tx},${ty}`);
          continue;
        }
        pending.push([typeof entry === 'string' ? { kind: entry } : entry, tx * TILE, ty * TILE]);
      }
    });
    // A symbol's cell would otherwise be air: inherit water / back wall from its neighbours
    // so an eel in a pool or a lamp in an interior doesn't punch a hole in them.
    for (const [opts, x, y] of pending) {
      const tx = x / TILE;
      const ty = y / TILE;
      const explicit = typeof opts.tile === 'string' ? TILE_OF[opts.tile] : undefined;
      if (explicit !== undefined) {
        this.map.set(tx, ty, explicit);
        continue;
      }
      const l = this.map.get(tx - 1, ty);
      const rt = this.map.get(tx + 1, ty);
      const up = this.map.get(tx, ty - 1);
      const dn = this.map.get(tx, ty + 1);
      for (const t of [T.Water, T.Back]) {
        if ((l === t && rt === t) || (up === t && (dn === t || l === t || rt === t))) {
          this.map.set(tx, ty, t);
          break;
        }
      }
    }
    this.findBreakables();

    this.player = new Player(this, 0, 0);
    for (const [opts, x, y] of pending) {
      if (opts.kind === 'start') {
        this.spawns.set('start', { x: x + 4, y: y + 8 });
        continue;
      }
      const make = entityFactory(opts.kind);
      if (!make) {
        console.warn(`${def.id}: no entity kind '${opts.kind}'`);
        continue;
      }
      const made = make(this, x, y, opts);
      if (Array.isArray(made)) made.forEach((e) => this.add(e));
      else if (made) this.add(made);
    }

    const at =
      this.spawns.get(spawn.kind === 'checkpoint' ? spawn.id : spawn.kind) ??
      this.spawns.get('start') ??
      this.spawns.get('station') ??
      { x: 16, y: 16 };
    this.player.place(at.x, at.y);
    this.camera.bounds = { x: 0, y: 0, w: this.map.pw, h: this.map.ph };
    this.camera.snap(this.player.cx, this.player.cy);
  }

  add<E extends Entity>(e: E): E {
    this.entities.push(e);
    if (e.solid) this.solids.push(e);
    if (e.platform) this.platforms.push(e);
    return e;
  }

  /** Entities that block movement / can be stood on; refreshed every tick so flags may change. */
  private solids: Entity[] = [];
  private platforms: Entity[] = [];

  // ---- queries -------------------------------------------------------------------

  solidAt(x: number, y: number, w: number, h: number, self?: Entity): boolean {
    if (this.map.solidRect(x, y, w, h)) return true;
    for (const e of this.solids) {
      if (e.solid && e !== self && !e.removed && x < e.x + e.w && x + w > e.x && y < e.y + e.h && y + h > e.y) return true;
    }
    return false;
  }

  solidPoint(x: number, y: number) {
    return this.solidAt(Math.floor(x), Math.floor(y), 1, 1);
  }

  /** A one-way surface (tile or moving platform) whose top is exactly at `bottom` under [x, x+w). */
  oneWayAt(x: number, bottom: number, w: number, self?: Entity): boolean {
    if (this.map.oneWayTop(x, bottom, w)) return true;
    for (const e of this.platforms) {
      if (e.platform && e !== self && !e.removed && e.y === bottom && x < e.x + e.w && x + w > e.x) return true;
    }
    return false;
  }

  /** Tile type at a pixel (use for liquids and fields: T.Water, T.Acid, T.Updraft). */
  tileAt(x: number, y: number) {
    return this.map.at(x, y);
  }

  lineOfSight(x0: number, y0: number, x1: number, y1: number): boolean {
    const d = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.ceil(d / 4);
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      if (this.map.solidPoint(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)) return false;
    }
    return true;
  }

  // ---- effects & state --------------------------------------------------------------

  /** Freeze the simulation briefly to sell an impact. */
  hitstop(seconds: number) {
    this.freeze = Math.max(this.freeze, seconds);
  }

  shake(amount: number) {
    this.camera.shake(amount);
  }

  sfx(s: Sfx) {
    this.game.audio.play(s);
  }

  hasFlag(key: string) {
    return !!this.game.profile.flags[key];
  }

  setFlag(key: string) {
    this.game.profile.flags[key] = true;
  }

  spawnSouls(x: number, y: number, n: number) {
    for (let i = 0; i < n; i++) this.add(new SoulOrb(this, x, y, true));
  }

  /** Close or open every boss gate ('G' tiles) in the world. */
  setGates(closed: boolean) {
    const from = closed ? T.GateOpen : T.Gate;
    const to = closed ? T.Gate : T.GateOpen;
    let any = false;
    for (let ty = 0; ty < this.map.h; ty++) {
      for (let tx = 0; tx < this.map.w; tx++) {
        if (this.map.get(tx, ty) !== from) continue;
        this.map.set(tx, ty, to);
        any = true;
        this.particles.burst(tx * TILE + 4, ty * TILE + 4, 2, { colors: [2, 1], speed: [10, 40] });
      }
    }
    if (any) {
      this.sfx('gate');
      this.shake(0.3);
    }
  }

  private findBreakables() {
    const { map } = this;
    const seen = new Set<number>();
    for (let ty = 0; ty < map.h; ty++) {
      for (let tx = 0; tx < map.w; tx++) {
        if (map.get(tx, ty) !== T.Breakable || seen.has(ty * map.w + tx)) continue;
        const tiles: [number, number][] = [];
        const stack: [number, number][] = [[tx, ty]];
        seen.add(ty * map.w + tx);
        while (stack.length) {
          const [x, y] = stack.pop()!;
          tiles.push([x, y]);
          for (const [dx, dy] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ]) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= map.w || ny >= map.h) continue;
            if (map.get(nx, ny) === T.Breakable && !seen.has(ny * map.w + nx)) {
              seen.add(ny * map.w + nx);
              stack.push([nx, ny]);
            }
          }
        }
        const key = `wall:${this.def.id}:${tx},${ty}`;
        if (this.hasFlag(key)) tiles.forEach(([x, y]) => map.set(x, y, T.Empty));
        else this.breakables.push({ tiles, hp: 3, key });
      }
    }
  }

  /**
   * The player's slash against cracked walls. Returns true if it hit one. `already` holds the
   * groups this swing has hit, so one swing counts once even though its hitbox lives several frames.
   */
  slashBreakables(box: Rect, already?: Set<unknown>): boolean {
    for (const g of this.breakables) {
      if (g.hp <= 0 || already?.has(g)) continue;
      const hit = g.tiles.find(([tx, ty]) => overlaps(box, { x: tx * TILE, y: ty * TILE, w: TILE, h: TILE }));
      if (!hit) continue;
      already?.add(g);
      g.hp--;
      this.particles.burst(hit[0] * TILE + 4, hit[1] * TILE + 4, 6, { colors: [2, 1], speed: [30, 90], grav: 300 });
      this.sfx('hit');
      this.shake(0.2);
      this.hitstop(0.04);
      if (g.hp <= 0) {
        for (const [tx, ty] of g.tiles) {
          this.map.set(tx, ty, T.Empty);
          this.particles.burst(tx * TILE + 4, ty * TILE + 4, 5, {
            colors: [2, 1, 3],
            speed: [20, 110],
            life: [0.5, 1],
            size: [1, 3],
            grav: 400,
            bounce: true,
          });
        }
        this.sfx('break');
        this.shake(0.45);
        this.setFlag(g.key);
      }
      return true;
    }
    return false;
  }

  // ---- loop ----------------------------------------------------------------------

  update(dt: number) {
    this.time += dt;
    this.camera.update(dt);
    if (this.freeze > 0) {
      this.freeze -= dt;
      return;
    }
    this.solids = this.entities.filter((e) => e.solid);
    this.platforms = this.entities.filter((e) => e.platform);
    this.player.update(dt);
    // while a dialogue or menu is open, only talkable things (NPCs, signs…) keep animating
    const busy = this.ui.busy;
    for (const e of this.entities) if (!e.removed && (!busy || e.interact)) e.update(dt);
    if (this.entities.some((e) => e.removed)) this.entities = this.entities.filter((e) => !e.removed);
    this.particles.update(dt);
    this.updateAmbient(dt);
    this.camera.bounds = this.arena ?? { x: 0, y: 0, w: this.map.pw, h: this.map.ph };
    const look = this.player.lookAhead();
    this.camera.follow(this.player.cx + look.x, this.player.cy + look.y, dt);
  }

  private ambientDebt = 0;

  /** Drifting snow / embers / dust motes / spores, spawned around the current view. */
  private updateAmbient(dt: number) {
    const kind = this.def.ambient;
    if (!kind) return;
    const rate = { snow: 26, embers: 7, motes: 5, spores: 6 }[kind];
    this.ambientDebt += dt * rate;
    const { x: cx, y: cy } = this.camera;
    while (this.ambientDebt >= 1) {
      this.ambientDebt -= 1;
      const x = cx + rand(-30, W + 30);
      if (kind === 'snow')
        this.particles.burst(x, cy - 4, 1, {
          speed: [16, 34],
          angle: [1.35, 1.95],
          life: [6, 9],
          colors: [3, 3, 2],
          size: [1, 1],
          drag: 0,
          shrink: false,
        });
      else if (kind === 'embers')
        this.particles.burst(x, cy + H + 2, 1, {
          speed: [14, 30],
          angle: [-1.9, -1.25],
          life: [3, 6],
          colors: [3, 2],
          size: [1, 1],
          drag: 0.2,
        });
      else
        this.particles.burst(x, cy + rand(0, H), 1, {
          speed: [2, 7],
          angle: kind === 'spores' ? [-2.2, -0.9] : [0, Math.PI * 2],
          life: [3, 6],
          colors: kind === 'spores' ? [2, 3] : [1, 2],
          size: [1, 1],
          drag: 0,
        });
    }
  }

  draw(r: Renderer) {
    const cam = this.camera;
    const cx = Math.round(cam.x) + cam.shakeX;
    const cy = Math.round(cam.y) + cam.shakeY;
    r.screen();
    r.clear(0);
    this.drawBackdrop(r, cx);
    r.camera(cx, cy);
    for (const e of this.entities) e.drawBack?.(r);
    r.image(this.map.render(r.palette), 0, 0);
    this.drawFields(r, cx, cy);
    const list = [...this.entities, this.player].sort((a, b) => a.depth - b.depth);
    for (const e of list) e.draw(r);
    this.particles.draw(r);
    const target = this.player.interactTarget;
    if (target && !this.ui.busy) {
      const bob = Math.round(Math.sin(this.time * 6));
      r.text('↑', target.cx - 1, target.y - 9 + bob, 3);
    }
    if (this.def.dark) this.drawDarkness(r, cx, cy);
    r.screen();
  }

  private drawBackdrop(r: Renderer, cx: number) {
    const bd = this.def.backdrop;
    if (this.layers.palette !== r.palette) {
      const paint = (f?: (b: PixelBuffer) => void) => {
        if (!f) return null;
        const b = new PixelBuffer(640, H);
        f(b);
        return b.toCanvas(r.palette);
      };
      this.layers = { far: paint(bd.far), near: paint(bd.near), palette: r.palette };
    }
    const layer = (img: HTMLCanvasElement | null, scroll: number) => {
      if (!img) return;
      const off = -(((Math.round(cx * scroll) % img.width) + img.width) % img.width);
      r.image(img, off, 0);
      r.image(img, off + img.width, 0);
    };
    layer(this.layers.far, bd.farScroll ?? 0.15);
    layer(this.layers.near, bd.nearScroll ?? 0.4);
  }

  /** Animated liquids and wind fields, drawn over the static tile layer. */
  private drawFields(r: Renderer, cx: number, cy: number) {
    const { map } = this;
    const t = this.time;
    const x0 = Math.max(0, Math.floor(cx / TILE));
    const y0 = Math.max(0, Math.floor(cy / TILE));
    const x1 = Math.min(map.w - 1, Math.floor((cx + W) / TILE));
    const y1 = Math.min(map.h - 1, Math.floor((cy + H) / TILE));
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        const k = map.get(tx, ty);
        if (k !== T.Water && k !== T.Acid && k !== T.Updraft) continue;
        const px = tx * TILE;
        const py = ty * TILE;
        if (k === T.Updraft) {
          // rising wind streaks; brighter wisps near the top of the column
          const top = map.get(tx, ty - 1) !== T.Updraft;
          for (let i = 0; i < 3; i++) {
            const sx = px + Math.floor(hash2(tx, ty, i) * 8);
            const sy = py + 7 - Math.floor((t * 90 + hash2(tx, ty, i + 5) * 64) % 10);
            r.rect(sx, sy, 1, 3, i === 0 && (top || hash2(tx, ty, 9) < 0.25) ? 2 : 1);
          }
          continue;
        }
        const body = k === T.Water ? 1 : 2;
        const surfaceC = k === T.Water ? 2 : 3;
        r.dither(k === T.Water ? 0.5 : 0.62, body, px - cx, py - cy, TILE, TILE, true);
        if (map.get(tx, ty - 1) !== k) {
          for (let x = 0; x < TILE; x++) {
            const wx = px + x;
            const wave = Math.round(Math.sin(wx * 0.55 + t * 3.2) * 0.9);
            r.rect(wx, py + wave, 1, 1, surfaceC);
            if (k === T.Acid && hash2(wx, Math.floor(t * 3), 9) < 0.05) r.rect(wx, py - 2 + wave, 1, 1, 3);
          }
        }
      }
    }
  }

  private drawDarkness(r: Renderer, cx: number, cy: number) {
    if (!this.dark) {
      this.dark = document.createElement('canvas');
      this.dark.width = W;
      this.dark.height = H;
    }
    const ctx = this.dark.getContext('2d')!;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = r.palette[0];
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'destination-out';
    const lights: Light[] = [{ x: this.player.cx, y: this.player.cy, r: this.player.alive ? 46 : 20 }];
    for (const e of this.entities) {
      const l = e.light?.();
      if (Array.isArray(l)) lights.push(...l);
      else if (l) lights.push(l);
    }
    for (const l of lights) {
      const rad = Math.round(l.r);
      if (l.x + rad < cx || l.x - rad > cx + W || l.y + rad < cy || l.y - rad > cy + H) continue;
      ctx.drawImage(this.lightDisk(rad), Math.round(l.x - cx - rad), Math.round(l.y - cy - rad));
    }
    r.ctx.drawImage(this.dark, 0, 0);
  }

  private lightDisk(rad: number) {
    let d = this.lightDisks.get(rad);
    if (d) return d;
    d = document.createElement('canvas');
    d.width = d.height = rad * 2 + 1;
    const ctx = d.getContext('2d')!;
    ctx.fillStyle = '#fff';
    const core = rad * 0.6;
    for (let y = -rad; y <= rad; y++) {
      for (let x = -rad; x <= rad; x++) {
        const dist = Math.hypot(x, y);
        if (dist <= core || (dist <= rad && bayer(x + rad, y + rad) < (rad - dist) / (rad - core))) ctx.fillRect(x + rad, y + rad, 1, 1);
      }
    }
    this.lightDisks.set(rad, d);
    return d;
  }
}
