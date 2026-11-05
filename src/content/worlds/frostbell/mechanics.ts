import { bayer, clamp, hash2, overlaps, type Rect } from '../../../engine/math';
import { CLEAR, PixelBuffer } from '../../../engine/pixels';
import type { Renderer } from '../../../engine/renderer';
import { Anim } from '../../../engine/sprites';
import { T, TILE } from '../../../engine/tilemap';
import { OneShot } from '../../../game/common/fx';
import { Enemy } from '../../../game/enemy';
import { Entity } from '../../../game/entity';
import { registerEntity } from '../../../game/registry';
import type { World } from '../../../game/world';
import { FROSTBELL_INTERIOR } from './map';
import './sprites';

/** Per-world registries so neighbouring map cells merge into one zone / one gate. */
const cellIndex = new WeakMap<World, Map<string, Entity>>();
function cells(w: World) {
  let m = cellIndex.get(w);
  if (!m) cellIndex.set(w, (m = new Map()));
  return m;
}

// =============================================================================================
// WIND GUSTS — sideways blasts that shove the player. Calm → warning streaks + whistle → gust.
// =============================================================================================
const CALM = 1.5;
const WARN = 0.8;
const GUST = 1.8;
const PERIOD = CALM + WARN + GUST;
/** Zones that share a phase shouldn't stack their whistles. */
const lastWindSound = new WeakMap<World, number>();

export class GustZone extends Entity {
  private bx0 = Infinity;
  private by0 = Infinity;
  private bx1 = -Infinity;
  private by1 = -Infinity;
  private phase: 'calm' | 'warn' | 'gust' = 'calm';

  constructor(
    world: World,
    readonly dir: 1 | -1,
    readonly offset: number,
    private force: number,
  ) {
    super(world, 0, 0, 1, 1);
    this.depth = 14;
  }

  /** Is the cell inside or touching this zone's bounding box? */
  near(tx: number, ty: number) {
    return tx >= this.bx0 - 1 && tx <= this.bx1 + 1 && ty >= this.by0 - 1 && ty <= this.by1 + 1;
  }

  absorb(o: GustZone) {
    this.add(o.bx0, o.by0);
    this.add(o.bx1, o.by1);
  }

  add(tx: number, ty: number) {
    this.bx0 = Math.min(this.bx0, tx);
    this.by0 = Math.min(this.by0, ty);
    this.bx1 = Math.max(this.bx1, tx);
    this.by1 = Math.max(this.by1, ty);
    this.x = this.bx0 * TILE;
    this.y = this.by0 * TILE;
    this.w = (this.bx1 - this.bx0 + 1) * TILE;
    this.h = (this.by1 - this.by0 + 1) * TILE;
  }

  /** The zone is the bounding box of its cells, so updraft columns inside it are covered too. */
  private inZone(px: number, py: number) {
    return px >= this.x && px < this.x + this.w && py >= this.y && py < this.y + this.h;
  }

  private touches(r: Rect) {
    return overlaps(r, this);
  }

  /** Seconds into the cycle. */
  private get cycle() {
    return (((this.world.time + this.offset) % PERIOD) + PERIOD) % PERIOD;
  }

  update(dt: number) {
    const c = this.cycle;
    const next = c < CALM ? 'calm' : c < CALM + WARN ? 'warn' : 'gust';
    const p = this.world.player;
    const near = Math.abs(p.cx - (this.x + this.w / 2)) < this.w / 2 + 160 && Math.abs(p.cy - (this.y + this.h / 2)) < this.h / 2 + 100;
    if (next !== this.phase) {
      this.phase = next;
      const a = this.world.game.audio;
      const last = lastWindSound.get(this.world) ?? -1;
      const fresh = this.world.time - last > 0.2;
      if (near && fresh && next !== 'calm') lastWindSound.set(this.world, this.world.time);
      if (near && fresh && next === 'warn') {
        a.tone('sine', 520, 980, WARN, 0.03);
        a.tone('sine', 780, 1460, WARN, 0.015);
      }
      if (near && fresh && next === 'gust') a.noise(GUST, 0.13, 'bandpass', 900, 260);
    }
    if (this.phase !== 'gust') return;
    const fade = Math.min(1, (c - CALM - WARN) / 0.25, (PERIOD - c) / 0.3);
    if (p.alive && (p.state === 'normal' || p.state === 'dash' || p.state === 'hurt') && this.touches(p)) {
      p.moveX(this.dir * this.force * fade * dt, () => (p.vx = 0));
      if (Math.random() < dt * 18)
        this.world.particles.burst(p.cx - this.dir * 4, p.cy, 1, { colors: [2, 3], speed: [60, 110], angle: this.dir > 0 ? [-0.2, 0.2] : [Math.PI - 0.2, Math.PI + 0.2], life: [0.2, 0.4] });
    }
  }

  draw(r: Renderer) {
    const c = this.cycle;
    const t = this.world.time;
    const cam = this.world.camera;
    if (this.x > cam.x + 330 || this.x + this.w < cam.x - 10 || this.y > cam.y + 190 || this.y + this.h < cam.y - 10) return;
    const n = Math.ceil((this.w * this.h) / 90);
    const warn = c >= CALM && c < CALM + WARN;
    const gust = c >= CALM + WARN;
    for (let i = 0; i < n; i++) {
      const lane = Math.floor(hash2(i, 1, 301) * this.h);
      const speed = gust ? 210 + hash2(i, 2, 301) * 120 : warn ? 60 + ((c - CALM) / WARN) * 90 : 18;
      const span = this.w + 40;
      let px = (hash2(i, 3, 301) * span + t * speed) % span;
      if (this.dir < 0) px = span - px;
      const hx = this.x - 20 + px;
      const hy = this.y + lane;
      if (!this.inZone(hx, hy) || this.world.map.solidPoint(hx, hy)) continue;
      if (gust) {
        // one streak = a bright 2-3px head plus a dim tail, clipped to the zone
        const len = 6 + Math.floor(hash2(i, 4, 301) * 10);
        const col = hash2(i, 5, 301) < 0.2 ? 3 : 2;
        const tail = Math.min(len, this.dir > 0 ? hx - this.x : this.x + this.w - 1 - hx);
        if (tail > 3) r.rect(this.dir > 0 ? hx - tail : hx + 3, hy, tail - 3, 1, 1);
        r.rect(this.dir > 0 ? hx - 2 : hx, hy, 3, 1, col);
      } else if (warn) {
        // the wind picks up: sparse short dashes that start to flow, brightening as the gust nears
        const k = (c - CALM) / WARN;
        if (i % 3 === 2 || (i % 3 === 1 && k < 0.5)) continue;
        const len = Math.min(2 + Math.floor(k * 4), this.dir > 0 ? hx - this.x + 1 : this.x + this.w - hx);
        r.rect(this.dir > 0 ? hx - len + 1 : hx, hy, len, 1, 1);
        if (k > 0.35) r.rect(hx, hy, 1, 1, 2);
      } else if (i % 5 === 0) r.rect(hx, hy + Math.round(Math.sin(t * 2 + i) * 2), 1, 1, 1);
    }
  }
}

/** Gust cells with the same direction and phase that touch (by bounding box) form one zone. */
const zonesByWorld = new WeakMap<World, GustZone[]>();
registerEntity('frostbell:gust', (w, x, y, o) => {
  const tx = x / TILE;
  const ty = y / TILE;
  const dir = Number(o.dir) < 0 ? -1 : 1;
  const offset = Number(o.offset ?? 0);
  let zones = zonesByWorld.get(w);
  if (!zones) zonesByWorld.set(w, (zones = []));
  const near = zones.filter((z) => !z.removed && z.dir === dir && z.offset === offset && z.near(tx, ty));
  if (near.length === 0) {
    const z = new GustZone(w, dir, offset, Number(o.force ?? 62));
    z.add(tx, ty);
    zones.push(z);
    return z;
  }
  near[0].add(tx, ty);
  for (const other of near.slice(1)) {
    near[0].absorb(other);
    other.removed = true;
  }
  return;
});

// =============================================================================================
// BELLS & ICE GATES — strike a bell: it rings, dazes nearby foes and lifts its gates.
// =============================================================================================
const BELL_PITCH: Record<string, number> = { door: 784, a: 988, b: 1175, c: 1319 };

export class StrikeBell extends Entity {
  private anim = new Anim('frostbell-bell', 'idle');
  private ringT = 0;
  private cool = 0;
  private anchorY: number;

  constructor(
    world: World,
    x: number,
    y: number,
    readonly ch: string,
    private open: number,
  ) {
    super(world, x - 3, y, 14, 15);
    this.depth = -1;
    let ay = y;
    for (let i = 0; i < 14; i++) {
      if (world.map.solidPoint(x + 4, ay - 1)) break;
      ay -= TILE;
    }
    this.anchorY = ay;
  }

  update(dt: number) {
    this.cool -= dt;
    this.ringT -= dt;
    if (this.ringT <= 0 && this.anim.name !== 'idle') this.anim.play('idle');
    this.anim.update(dt);
  }

  hurtbox(): Rect {
    return { x: this.x, y: this.y + 1, w: this.w, h: this.h };
  }

  onSlash(): boolean {
    if (this.cool > 0) return true;
    this.cool = 0.3;
    this.ringT = 1;
    this.anim.play('ring', true);
    const w = this.world;
    const a = w.game.audio;
    const f = BELL_PITCH[this.ch] ?? 1047;
    a.tone('sine', f, f, 1.6, 0.08);
    a.tone('sine', f * 2.01, f * 2.01, 0.9, 0.03);
    a.tone('triangle', f / 2, f / 2, 1.8, 0.04);
    w.hitstop(0.05);
    w.add(new OneShot(w, 'ring', 'pop', this.cx, this.y + 8));
    w.particles.burst(this.cx, this.y + 10, 10, { colors: [3, 2], speed: [40, 110], life: [0.25, 0.5] });
    // the ring dazes anything nearby
    for (const e of w.entities) {
      if (!(e instanceof Enemy) || e.dead) continue;
      if (Math.hypot(e.cx - this.cx, e.cy - this.cy) < 88) {
        e.stun = Math.max(e.stun, 1.6);
        e.flash = 0.12;
      }
    }
    for (const e of w.entities) if (e instanceof IceGate && e.ch === this.ch) e.lift(this.open);
    if (this.open <= 0) w.setFlag(`frostbell:bell:${this.ch}`);
    return true;
  }

  drawBack(r: Renderer) {
    if (this.ringT > 0) r.halo(this.cx, this.y + 8, 12 + Math.round(this.ringT * 4), 1);
  }

  draw(r: Renderer) {
    if (this.anchorY < this.y) {
      r.line(this.cx, this.anchorY, this.cx, this.y, 1);
      r.rect(this.cx - 1, this.anchorY, 3, 1, 2);
    }
    r.sprite('frostbell-bell', this.anim.frame, this.cx, this.y);
  }
}

/** A row of gate cells shares one channel: play its sounds once, not once per cell. */
const gateSounds = new WeakMap<World, Map<string, number>>();
function gateSound(w: World, key: string): boolean {
  let m = gateSounds.get(w);
  if (!m) gateSounds.set(w, (m = new Map()));
  if (w.time - (m.get(key) ?? -1) < 0.05) return false;
  m.set(key, w.time);
  return true;
}

/** Ice portcullis: solid until its bell rings, then lifts for `open` seconds (0 = for good). */
export class IceGate extends Entity {
  private amt = 0;
  private timer = 0;
  private forever = false;
  private tickT = 0;

  constructor(
    world: World,
    x: number,
    y: number,
    readonly ch: string,
  ) {
    super(world, x, y, 8, 8);
    this.solid = true;
    this.depth = -2;
    if (world.hasFlag(`frostbell:bell:${ch}`)) {
      this.forever = true;
      this.amt = 1;
      this.solid = false;
    }
  }

  grow() {
    this.h += TILE;
  }

  lift(seconds: number) {
    if (this.forever) return;
    if (seconds <= 0) this.forever = true;
    this.timer = Math.max(this.timer, seconds);
    if (this.solid) {
      if (gateSound(this.world, `${this.ch}:lift`)) this.world.sfx('gate');
      this.world.particles.burst(this.cx, this.bottom - 2, 8, { colors: [2, 3], speed: [20, 60], angle: [-Math.PI, 0] });
    }
    this.solid = false;
  }

  update(dt: number) {
    if (this.forever || this.timer > 0) {
      this.timer -= dt;
      this.amt = Math.min(1, this.amt + dt * 5);
      if (!this.forever && this.timer < 0.9) {
        this.tickT -= dt;
        if (this.tickT <= 0) {
          this.tickT = 0.22;
          if (gateSound(this.world, `${this.ch}:tick`)) this.world.sfx('blip');
        }
      }
      if (!this.forever && this.timer <= 0) {
        if (overlaps(this, this.world.player)) this.timer = 0.05;
        else {
          this.solid = true;
          if (gateSound(this.world, `${this.ch}:shut`)) {
            this.world.game.audio.noise(0.25, 0.2, 'lowpass', 1400, 200);
            this.world.shake(0.12);
          }
        }
      }
    } else this.amt = Math.max(0, this.amt - dt * 9);
  }

  draw(r: Renderer) {
    const warn = !this.forever && this.timer > 0 && this.timer < 0.9;
    const len = Math.round(this.h * (1 - this.amt)) + (warn ? Math.round((0.9 - this.timer) * 6) : 0);
    // lintel housing
    r.rect(this.x, this.y - 2, 8, 2, 2);
    r.rect(this.x + 1, this.y - 1, 6, 1, 1);
    if (len <= 0) return;
    for (const bx of [1, 4, 7]) {
      r.rect(this.x + bx, this.y, 1, len, 2);
      r.rect(this.x + bx, this.y + len - 2, 1, 2, warn && Math.floor(this.timer * 10) % 2 ? 2 : 3);
    }
    for (let yy = 3; yy < len - 3; yy += 8) r.rect(this.x, this.y + yy, 8, 1, 1);
  }
}

registerEntity('frostbell:bell', (w, x, y, o) => new StrikeBell(w, x, y, String(o.ch ?? 'a'), Number(o.open ?? 3)));
registerEntity('frostbell:gate', (w, x, y, o) => {
  const ch = String(o.ch ?? 'a');
  const m = cells(w);
  const tx = x / TILE;
  const ty = y / TILE;
  const above = m.get(`gate:${ch}:${tx},${ty - 1}`) as IceGate | undefined;
  if (above) {
    above.grow();
    m.set(`gate:${ch}:${tx},${ty}`, above);
    return;
  }
  const g = new IceGate(w, x, y, ch);
  m.set(`gate:${ch}:${tx},${ty}`, g);
  return g;
});

// =============================================================================================
// GEAR PLATFORMS — the tower's clockwork. Like the shared moving platform ('m' / 'n' until a ';'
// marker), but with a phase and a fixed period so neighbouring platforms hand off like gears.
// =============================================================================================
export class GearPlatform extends Entity {
  private from: number;
  private to: number;
  private t: number;
  private period: number;
  private spin = 0;

  constructor(
    world: World,
    x: number,
    y: number,
    private axis: 'x' | 'y',
    phase: number,
    period: number,
  ) {
    super(world, x, y, 24, 4);
    this.platform = true;
    this.depth = -1;
    const map = world.map;
    const tx = x / TILE;
    const ty = y / TILE;
    if (axis === 'x') {
      let t = tx + 3;
      while (t < map.w && !map.solidTile(t, ty) && map.get(t, ty) !== T.Stop) t++;
      const lastLeft = map.get(t, ty) === T.Stop ? t - 2 : t - 3;
      this.from = x;
      this.to = Math.max(x, lastLeft * TILE);
    } else {
      let t = ty - 1;
      while (t > 0 && !map.solidTile(tx, t) && map.get(tx, t) !== T.Stop) t--;
      const top = map.get(tx, t) === T.Stop ? t : t + 1;
      this.from = y;
      this.to = Math.min(y, top * TILE);
    }
    this.period = period > 0 ? period : Math.max(1, (4 * Math.abs(this.to - this.from)) / 38);
    this.t = phase * this.period;
    const p = this.pos();
    this.x = p.x;
    this.y = p.y;
  }

  private pos() {
    const k = 0.5 - 0.5 * Math.cos((this.t / this.period) * Math.PI * 2);
    const v = Math.round(this.from + (this.to - this.from) * k);
    return this.axis === 'x' ? { x: v, y: this.y } : { x: this.x, y: v };
  }

  update(dt: number) {
    if (Math.abs(this.to - this.from) < 1) return;
    this.t += dt;
    const prevX = this.x;
    const prevY = this.y;
    const n = this.pos();
    const p = this.world.player;
    const riding = p.alive && p.bottom === prevY && p.x < prevX + this.w && p.right > prevX && p.vy >= 0;
    this.x = n.x;
    this.y = n.y;
    this.vx = (n.x - prevX) / dt;
    this.vy = (n.y - prevY) / dt;
    this.spin += (Math.abs(this.vx) + Math.abs(this.vy)) * dt * 0.12;
    if (riding) {
      p.moveX(n.x - prevX);
      p.moveY(n.y - prevY);
      p.carry(this.vx, this.vy);
    }
  }

  draw(r: Renderer) {
    r.sprite('frostbell-gearplat', ['a', 'b', 'c'][Math.floor(this.spin) % 3], this.x, this.y);
  }
}

registerEntity('frostbell:gearplat', (w, x, y, o) =>
  new GearPlatform(w, x, y, o.axis === 'y' ? 'y' : 'x', Number(o.phase ?? 0), Number(o.period ?? 0)),
);

// =============================================================================================
// AMBIENCE — the tower's inner back wall (blocking the sky indoors), falling snow outdoors,
// frost motes indoors. Place exactly one '@' in the map's first row.
// =============================================================================================

/** Paint the back wall for every interior cell; interior windows stay CLEAR (the sky shows). */
export function paintBackwall(buf: PixelBuffer, rows: readonly string[]) {
  const h = rows.length;
  const w = rows[0]?.length ?? 0;
  const inside = (tx: number, ty: number) => ty >= 0 && ty < h && tx >= 0 && tx < w && rows[ty][tx] === '1';
  for (let ty = 0; ty < h; ty++)
    for (let tx = 0; tx < w; tx++) {
      if (rows[ty][tx] === '0') continue;
      for (let y = 0; y < TILE; y++)
        for (let x = 0; x < TILE; x++) {
          const px = tx * TILE + x;
          const py = ty * TILE + y;
          // big ashlar blocks with faint, dotted joints
          const course = Math.floor(py / 16);
          const bxx = px + (course & 1) * 12;
          const joint = py % 16 === 15 || bxx % 24 === 23;
          let c = 0;
          if (joint && (px + py) % 3 === 0) c = 1;
          // faint pilasters every 128px
          const pm = ((px % 128) + 128) % 128;
          if ((pm === 60 || pm === 67) && py % 2 === 0) c = 1;
          buf.set(px, py, c);
        }
    }
  // ragged, broken masonry where the back wall meets a hole open to the sky
  const outdoor = (tx: number, ty: number) => ty >= 0 && ty < h && tx >= 0 && tx < w && rows[ty][tx] === '0';
  for (let ty = 0; ty < h; ty++)
    for (let tx = 0; tx < w; tx++) {
      if (rows[ty][tx] !== '1') continue;
      const sides: [number, number][] = [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ];
      for (const [dx, dy] of sides) {
        if (!outdoor(tx + dx, ty + dy)) continue;
        for (let k = 0; k < TILE; k++) {
          const px0 = tx * TILE;
          const py0 = ty * TILE;
          const depth = Math.floor(hash2(tx * 8 + k, ty * 8 + dx + dy * 3, 411) * 3);
          for (let d = 0; d <= depth + 1; d++) {
            const x = dx < 0 ? d : dx > 0 ? TILE - 1 - d : k;
            const y = dy < 0 ? d : dy > 0 ? TILE - 1 - d : k;
            buf.set(px0 + x, py0 + y, d <= depth ? CLEAR : 1);
          }
        }
      }
    }
  // a few tall arched windows on a coarse grid, never overlapping
  const used = new Set<number>();
  for (let ty = 0; ty < h - 7; ty++)
    for (let tx = 0; tx < w - 3; tx++) {
      if (tx % 13 !== 6 || ty % 4 !== 1 || hash2(tx, ty, 401) > 0.5) continue;
      let ok = true;
      for (let j = -2; j < 8 && ok; j++)
        for (let i = -1; i < 4 && ok; i++) if (!inside(tx + i, ty + j) || used.has((ty + j) * 4096 + tx + i)) ok = false;
      if (!ok) continue;
      for (let j = -4; j < 12; j++) for (let i = -3; i < 6; i++) used.add((ty + j) * 4096 + tx + i);
      const x0 = tx * TILE;
      const y0 = ty * TILE;
      const ww = 3 * TILE;
      const wh = 6 * TILE;
      const r = ww / 2;
      for (let y = 0; y < wh; y++)
        for (let x = 0; x < ww; x++) {
          const dy = y - r;
          const insideArch = y >= r || Math.hypot(x + 0.5 - r, dy) <= r;
          if (!insideArch) continue;
          const edge = x === 0 || x === ww - 1 || y === wh - 1 || (y < r && Math.hypot(x + 0.5 - r, dy) > r - 1.2);
          const mullion = x === Math.floor(ww / 2) || y === Math.floor(wh * 0.55);
          const frost = y > wh - 7 && bayer(x, y) < (y - (wh - 7)) / 9;
          buf.set(x0 + x, y0 + y, edge || mullion ? 1 : frost ? 1 : CLEAR);
        }
      buf.rect(x0 - 2, y0 + wh, ww + 4, 1, 1);
      buf.rect(x0 - 1, y0 + wh + 1, ww + 2, 1, 1);
    }
}

class Ambience extends Entity {
  private wall: HTMLCanvasElement | null = null;
  private palette: unknown = null;
  private rows = FROSTBELL_INTERIOR;

  constructor(world: World) {
    super(world, 0, 0, 1, 1);
    this.depth = 18;
  }

  private interior(px: number, py: number) {
    const ty = Math.floor(py / TILE);
    const tx = Math.floor(px / TILE);
    const v = this.rows[ty]?.[tx];
    return v === '1' || v === '2';
  }

  private flakes(r: Renderer, far: boolean) {
    const cam = this.world.camera;
    const t = this.world.time;
    const map = this.world.map;
    const alt = 1 - clamp(cam.y / Math.max(1, map.ph - 180), 0, 1);
    const n = far ? 44 + Math.round(alt * 30) : 22 + Math.round(alt * 26);
    const par = far ? 0.55 : 1;
    const wind = (far ? 8 : 14) + alt * (far ? 40 : 70);
    const PW = 344;
    const PH = 204;
    const ox = r.ox;
    const oy = r.oy;
    const camX = -ox;
    const camY = -oy;
    r.ox = 0;
    r.oy = 0;
    for (let i = 0; i < n; i++) {
      const s = far ? 1 : 2;
      const fall = (far ? 12 : 24) * (0.7 + hash2(i, s, 501) * 0.7);
      const drift = wind * (0.75 + hash2(i, s, 502) * 0.5);
      const sx = ((((hash2(i, s, 503) * PW + t * drift + Math.sin(t * 1.4 + i) * 5 - cam.x * par) % PW) + PW) % PW) - 12;
      const sy = ((((hash2(i, s, 504) * PH + t * fall - cam.y * par) % PH) + PH) % PH) - 12;
      const wx = camX + sx;
      const wy = camY + sy;
      if (map.solidPoint(wx, wy)) continue;
      if (this.interior(wx, wy)) {
        // indoors the blizzard can't reach: only a few slow frost motes hang in the air
        if (!far || i % 3 !== 0) continue;
        const mx = ((((hash2(i, 7, 506) * PW + Math.sin(t * 0.7 + i) * 6 - cam.x * par) % PW) + PW) % PW) - 12;
        const my = ((((hash2(i, 8, 506) * PH + t * 5 - cam.y * par) % PH) + PH) % PH) - 12;
        if (this.interior(camX + mx, camY + my) && !map.solidPoint(camX + mx, camY + my)) r.rect(mx, my, 1, 1, 1);
        continue;
      }
      if (far) r.rect(sx, sy, 1, 1, 1);
      else {
        const big = hash2(i, 9, 505) < 0.2;
        r.rect(sx, sy, big ? 2 : 1, big ? 2 : 1, hash2(i, 8, 505) < 0.15 ? 3 : 2);
      }
    }
    r.ox = ox;
    r.oy = oy;
  }

  update(dt: number) {
    const cam = this.world.camera;
    const map = this.world.map;
    const tx0 = Math.max(0, Math.floor(cam.x / TILE));
    const ty0 = Math.max(0, Math.floor(cam.y / TILE));
    for (let ty = ty0; ty < Math.min(map.h, ty0 + 24); ty++)
      for (let tx = tx0; tx < Math.min(map.w, tx0 + 41); tx++) {
        if (map.get(tx, ty) !== T.Updraft || map.get(tx, ty + 1) === T.Updraft) continue;
        // the foot of each updraft column puffs snow upwards
        if (Math.random() < dt * 5)
          this.world.particles.burst(tx * TILE + 4, ty * TILE + 6, 1, {
            colors: [2, 2, 1],
            speed: [60, 120],
            angle: [-Math.PI / 2 - 0.15, -Math.PI / 2 + 0.15],
            life: [0.6, 1.2],
            drag: 0.4,
            spread: 3,
          });
      }
  }

  drawBack(r: Renderer) {
    if (!this.wall || this.palette !== r.palette) {
      const b = new PixelBuffer(this.world.map.pw, this.world.map.ph);
      paintBackwall(b, this.rows);
      this.wall = b.toCanvas(r.palette, this.wall ?? undefined);
      this.palette = r.palette;
    }
    r.image(this.wall, 0, 0);
    this.flakes(r, true);
  }

  draw(r: Renderer) {
    this.flakes(r, false);
  }
}

registerEntity('frostbell:ambience', (w) => new Ambience(w));
