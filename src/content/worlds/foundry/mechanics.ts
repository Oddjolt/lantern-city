import { overlaps, type Rect } from '../../../engine/math';
import type { Renderer } from '../../../engine/renderer';
import { Anim } from '../../../engine/sprites';
import { T, TILE } from '../../../engine/tilemap';
import { Platform } from '../../../game/common/mechanics';
import { Enemy } from '../../../game/enemy';
import { Entity } from '../../../game/entity';
import type { Player } from '../../../game/player';
import { registerEntity } from '../../../game/registry';
import type { World } from '../../../game/world';
import './sprites';

/** Is the player near enough to hear a machine? Keeps distant presses and jets quiet. */
export function audible(world: World, x: number, y: number, rx = 200, ry = 130) {
  const p = world.player;
  return Math.abs(p.cx - x) < rx && Math.abs(p.cy - y) < ry;
}

// ===========================================================================================
// CONVEYOR BELT — a run of floor tiles that carries whatever stands on it.
// ===========================================================================================
export class Belt extends Entity {
  private t = 0;

  constructor(
    world: World,
    x: number,
    y: number,
    cells: number,
    private dir: 1 | -1,
    private speed = 40,
  ) {
    super(world, x, y, cells * TILE, TILE);
    this.depth = -1;
  }

  update(dt: number) {
    this.t += dt;
    const push = this.dir * this.speed * dt;
    const p = this.world.player;
    if (p.alive && p.state === 'normal' && p.bottom === this.y && p.right > this.x && p.x < this.right && p.vy >= 0) {
      p.moveX(push);
      p.carry(this.dir * this.speed, 0);
    }
    // enemies ride it too, but never get carried off its ends
    for (const e of this.world.entities) {
      if (!(e instanceof Enemy) || e.dead || e.bottom !== this.y || e.right <= this.x || e.x >= this.right) continue;
      const nx = e.x + push;
      if (nx >= this.x && nx + e.w <= this.right) e.moveX(push);
    }
  }

  draw(r: Renderer) {
    const phase = Math.floor(this.t * this.speed * 0.5) % 4;
    const n = this.w / TILE;
    const flip = this.dir < 0;
    for (let i = 0; i < n; i++) {
      const end = i === 0 ? 'l' : i === n - 1 ? 'r' : 'm';
      // mirrored pieces swap their end caps
      const kind = flip ? (end === 'l' ? 'r' : end === 'r' ? 'l' : 'm') : end;
      r.sprite('foundry-belt', `${kind}${phase}`, this.x + i * TILE + (flip ? TILE : 0), this.y, { flip });
    }
  }
}

registerEntity('foundry:belt', (w, x, y, o) => {
  const tx = x / TILE;
  const ty = y / TILE;
  const row = w.def.map[ty];
  w.map.set(tx, ty, T.Solid); // the belt is floor: solid under the moving surface
  if (row[tx - 1] === row[tx]) return; // part of a run that starts further left
  let n = 1;
  while (row[tx + n] === row[tx]) n++;
  return new Belt(w, x, y, n, o.dir === -1 ? -1 : 1);
});

// ===========================================================================================
// FLAME JET — a nozzle that sputters (telegraph), then roars out a column of fire.
// ===========================================================================================
const JET_PERIOD = 3;
const JET_WARN = 1.25;
const JET_BURN = 1.9;

export class FlameJet extends Entity {
  private t: number;
  private lick = new Anim('foundry-flame', 'lick');
  private stage: 'idle' | 'warn' | 'burn' = 'idle';

  constructor(
    world: World,
    x: number,
    y: number,
    phase: number,
    private down: boolean,
  ) {
    super(world, x + 1, down ? y : y + 4, 6, 4);
    this.depth = -2;
    this.t = phase * JET_PERIOD;
  }

  /** The burning column. */
  flameBox(): Rect {
    return this.down ? { x: this.x, y: this.y + 4, w: 6, h: 30 } : { x: this.x, y: this.y - 30, w: 6, h: 30 };
  }

  private get mouthY() {
    return this.down ? this.y + 4 : this.y;
  }

  update(dt: number) {
    this.t += dt;
    this.lick.update(dt);
    const k = this.t % JET_PERIOD;
    const stage = k < JET_WARN ? 'idle' : k < JET_BURN ? 'warn' : 'burn';
    const w = this.world;
    const loud = audible(w, this.cx, this.cy);
    if (stage !== this.stage) {
      if (stage === 'warn' && loud) w.game.audio.noise(0.5, 0.05, 'highpass', 3000, 6000);
      if (stage === 'burn' && loud) {
        w.game.audio.noise(0.8, 0.16, 'bandpass', 900, 300);
        w.game.audio.tone('sawtooth', 90, 60, 0.4, 0.04);
      }
      this.stage = stage;
    }
    const up = this.down ? 1 : -1;
    if (stage === 'warn' && Math.random() < dt * 25)
      w.particles.burst(this.cx, this.mouthY, 1, { colors: [3, 2], speed: [20, 50], angle: up < 0 ? [-2.2, -0.9] : [0.9, 2.2], life: [0.15, 0.3] });
    if (stage === 'burn') {
      if (Math.random() < dt * 30) {
        const b = this.flameBox();
        w.particles.burst(this.cx, this.down ? b.y + b.h : b.y, 1, { colors: [3, 2, 1], speed: [10, 40], angle: up < 0 ? [-2, -1.1] : [1.1, 2], life: [0.3, 0.6], grav: up * 30 });
      }
      const p = w.player;
      if (p.alive && overlaps(this.flameBox(), p)) p.hurt(1, this.cx);
    }
  }

  drawBack(r: Renderer) {
    if (this.stage === 'burn') {
      const b = this.flameBox();
      r.halo(this.cx, b.y + b.h / 2, 18 + (Math.sin(this.world.time * 20) > 0 ? 1 : 0), 1);
    }
  }

  draw(r: Renderer) {
    const sheet = this.down ? 'foundry-flame-down' : 'foundry-flame';
    if (this.stage === 'warn') r.sprite(sheet, this.lick.frame, this.cx, this.mouthY);
    if (this.stage === 'burn') {
      const k = (this.t % JET_PERIOD) - JET_BURN;
      const frame = k < 0.06 || k > JET_PERIOD - JET_BURN - 0.08 ? 'e1' : `b${1 + (Math.floor(this.world.time * 16) % 3)}`;
      r.sprite(sheet, frame, this.cx, this.mouthY);
    }
    r.sprite('foundry-nozzle', this.stage === 'idle' ? 'cold' : 'hot', this.cx, this.y + 4);
  }

  light() {
    return this.stage === 'burn' ? { x: this.cx, y: this.flameBox().y + 15, r: 40 } : null;
  }
}

registerEntity('foundry:jet', (w, x, y, o) => new FlameJet(w, x, y, Number(o.phase ?? 0), o.down === true));

// ===========================================================================================
// CRUSHER PRESS — rests, shudders, slams to the floor, holds, and grinds back up.
// ===========================================================================================
const PRESS_PERIOD = 3;
const P_REST = 1.15;
const P_WARN = 1.7;
const P_SLAM = 1.8;
const P_HOLD = 2.25;

export class Press extends Entity {
  private t: number;
  private top: number;
  private low: number;
  private ceil: number;
  private stage = 'rest';

  constructor(world: World, x: number, y: number, phase: number) {
    super(world, x - 8, y + 5, 24, 14);
    this.depth = -1;
    this.ceil = y;
    this.top = y + 5;
    // find the floor under the middle of the press
    let ty = y / TILE + 1;
    while (ty < world.map.h && !world.map.solidTile(x / TILE, ty)) ty++;
    this.low = ty * TILE - 14;
    this.t = phase * PRESS_PERIOD;
  }

  private headY(k: number) {
    if (k < P_REST) return this.top;
    if (k < P_WARN) return this.top + 2;
    if (k < P_SLAM) {
      const s = (k - P_WARN) / (P_SLAM - P_WARN);
      return this.top + 2 + (this.low - this.top - 2) * s * s;
    }
    if (k < P_HOLD) return this.low;
    const s = (k - P_HOLD) / (PRESS_PERIOD - P_HOLD);
    return this.low + (this.top - this.low) * (0.5 - 0.5 * Math.cos(s * Math.PI));
  }

  get dangerous() {
    return this.stage === 'slam' || this.stage === 'hold';
  }

  update(dt: number) {
    this.t += dt;
    const k = this.t % PRESS_PERIOD;
    const stage = k < P_REST ? 'rest' : k < P_WARN ? 'warn' : k < P_SLAM ? 'slam' : k < P_HOLD ? 'hold' : 'rise';
    const w = this.world;
    const loud = audible(w, this.cx, this.cy, 180, 100);
    if (stage !== this.stage) {
      if (stage === 'warn' && loud) {
        w.game.audio.tone('square', 70, 110, 0.35, 0.05);
        w.game.audio.noise(0.4, 0.06, 'highpass', 2500, 5000);
      }
      if (stage === 'hold') {
        if (loud) w.sfx('slam');
        if (audible(w, this.cx, this.cy, 72, 60)) w.shake(0.15);
        for (const side of [-1, 1])
          w.particles.burst(this.cx + side * 12, this.low + 13, 6, { colors: [2, 1], speed: [20, 70], angle: side < 0 ? [-3, -2.2] : [-0.9, -0.1], life: [0.3, 0.6], grav: 200 });
      }
      this.stage = stage;
    }
    if (stage === 'warn' && Math.random() < dt * 14)
      w.particles.burst(this.cx + (Math.random() < 0.5 ? -9 : 9), this.ceil + 6, 1, { colors: [1], speed: [8, 20], angle: [1.2, 1.9], life: [0.3, 0.7] });
    this.y = Math.round(this.headY(k));
    const p = w.player;
    if (this.dangerous && p.alive && overlaps(this, p)) p.hurt(1, this.cx);
  }

  onSlash(_player: Player, _dx: number, dy: number): boolean {
    // iron on iron: a clank you can pogo off when it is down
    this.world.particles.burst(this.cx, dy > 0 ? this.y : this.cy, 5, { colors: [3, 2], speed: [40, 100], life: [0.1, 0.25] });
    this.world.game.audio.tone('square', 1400, 900, 0.06, 0.05);
    return true;
  }

  draw(r: Renderer) {
    const jitter = this.stage === 'warn' ? Math.round(Math.sin(this.world.time * 70)) : 0;
    // piston rod
    const rodTop = this.ceil + 5;
    const rodH = this.y - rodTop;
    if (rodH > 0) {
      r.rect(this.cx - 3 + jitter, rodTop, 6, rodH, 2);
      r.rect(this.cx - 3 + jitter, rodTop, 1, rodH, 1);
      r.rect(this.cx + 1 + jitter, rodTop, 1, rodH, 1);
      r.rect(this.cx - 4 + jitter, rodTop, 1, rodH, 0);
      r.rect(this.cx + 3 + jitter, rodTop, 1, rodH, 0);
    }
    r.sprite('foundry-housing', 'a', this.cx, this.ceil);
    r.sprite('foundry-press', this.stage === 'warn' || this.dangerous ? 'hot' : 'cold', this.x + jitter, this.y);
  }
}

registerEntity('foundry:press', (w, x, y, o) => new Press(w, x, y, Number(o.phase ?? 0)));

// ===========================================================================================
// CRANE — the moving platform ('m' / 'n'), hung from the ceiling on a chain.
// ===========================================================================================
export class Crane extends Platform {
  draw(r: Renderer) {
    const map = this.world.map;
    const cx = this.x + 12;
    let ty = Math.floor((this.y - 9) / TILE);
    while (ty > 0 && !map.solidTile(Math.floor(cx / TILE), ty)) ty--;
    const top = (ty + 1) * TILE;
    const ring = this.y - 9;
    // trolley riding the ceiling
    r.rect(cx - 5, top, 11, 3, 2);
    r.rect(cx - 4, top + 3, 9, 1, 1);
    r.rect(cx - 4, top + 1, 1, 1, 0);
    r.rect(cx + 4, top + 1, 1, 1, 0);
    // chain
    for (let y = top + 4; y < ring; y++) {
      const k = (y - top) % 4;
      if (k === 0) r.rect(cx, y, 1, 1, 2);
      else if (k === 2) r.rect(cx, y, 1, 1, 1);
      else {
        r.rect(cx - 1, y, 1, 1, 1);
        r.rect(cx + 1, y, 1, 1, 2);
      }
    }
    // hook ring and slings to the lifting eyes
    r.rect(cx - 1, ring, 3, 1, 2);
    r.rect(cx - 1, ring + 2, 3, 1, 2);
    r.rect(cx - 1, ring + 1, 1, 1, 2);
    r.rect(cx + 1, ring + 1, 1, 1, 2);
    r.line(cx - 1, ring + 2, this.x + 3, this.y - 2, 1);
    r.line(cx + 1, ring + 2, this.x + 18, this.y - 2, 1);
    r.sprite('foundry-crane', 'a', this.x, this.y);
  }
}

registerEntity('foundry:crane', (w, x, y, o) => new Crane(w, x, y, o.axis === 'y' ? 'y' : 'x'));

// ===========================================================================================
// RUSTED GRATE — a catwalk section that gives way under you (the foundry's K blocks).
// ===========================================================================================
export class Grate extends Entity {
  private state: 'idle' | 'shake' | 'gone' = 'idle';
  private t = 0;

  constructor(world: World, x: number, y: number) {
    super(world, x, y, 8, 8);
    this.solid = true;
    this.depth = -1;
  }

  update(dt: number) {
    const p = this.world.player;
    this.t -= dt;
    if (this.state === 'idle') {
      const standing = p.bottom === this.y && p.x < this.right && p.right > this.x;
      const clinging = Math.abs(p.cy - this.cy) < 10 && (p.right === this.x || p.x === this.right);
      if (p.alive && (standing || clinging)) {
        this.state = 'shake';
        this.t = 0.45;
        this.world.game.audio.tone('square', 220, 160, 0.08, 0.04);
        this.world.sfx('chug');
      }
    } else if (this.state === 'shake' && this.t <= 0) {
      this.state = 'gone';
      this.solid = false;
      this.t = 2.4;
      this.world.particles.burst(this.cx, this.cy, 8, { colors: [2, 1], speed: [10, 50], grav: 400, life: [0.4, 0.8], size: [1, 2] });
    } else if (this.state === 'gone' && this.t <= 0 && !overlaps(this, p)) {
      this.state = 'idle';
      this.solid = true;
      this.world.particles.burst(this.cx, this.cy, 4, { colors: [2], speed: [5, 20] });
    }
  }

  draw(r: Renderer) {
    if (this.state === 'gone') return;
    const jitter = this.state === 'shake' ? Math.round(Math.sin(this.t * 90)) : 0;
    r.sprite('foundry-grate', this.state === 'shake' ? (Math.floor(this.t * 12) % 2 ? 'b' : 'c') : 'a', this.x + jitter, this.y);
  }
}

registerEntity('foundry:grate', (w, x, y) => new Grate(w, x, y));

// ===========================================================================================
// AMBIENCE — embers rising off slag, soot falling, and the glow of molten channels.
// ===========================================================================================
export class Ambience extends Entity {
  constructor(world: World) {
    super(world, 0, 0, 1, 1);
    this.depth = -30;
  }

  update(dt: number) {
    const w = this.world;
    const cam = w.camera;
    // drifting soot (the engine's ambient embers rise past it)
    if (Math.random() < dt * 4)
      w.particles.burst(cam.x + Math.random() * 340 - 10, cam.y - 2, 1, { colors: [1], speed: [4, 12], angle: [1.3, 2.2], life: [3, 5], grav: 6, drag: 0.2, shrink: false, size: [1, 1] });
    // steam billowing up the updraft columns in view
    for (let i = 0; i < 4; i++) {
      if (Math.random() > dt * 30) continue;
      const tx = Math.floor((cam.x + Math.random() * 320) / TILE);
      const ty = Math.floor((cam.y + Math.random() * 180) / TILE);
      if (w.map.get(tx, ty) === T.Updraft)
        w.particles.burst(tx * TILE + Math.random() * 8, ty * TILE + Math.random() * 8, 1, { colors: [1, 1, 2], speed: [50, 90], angle: [-1.75, -1.4], life: [0.3, 0.6], drag: 0.5, size: [1, 2] });
    }
    // sparks off the slag surfaces in view
    for (let i = 0; i < 3; i++) {
      if (Math.random() > dt * 14) continue;
      const tx = Math.floor((cam.x + Math.random() * 320) / TILE);
      const ty0 = Math.floor(cam.y / TILE);
      for (let ty = ty0; ty < ty0 + 24; ty++) {
        if (w.map.get(tx, ty) === T.Acid && w.map.get(tx, ty - 1) !== T.Acid) {
          w.particles.burst(tx * TILE + Math.random() * 8, ty * TILE, 1, { colors: [3, 2, 2], speed: [15, 45], angle: [-2, -1.15], life: [0.5, 1.1], grav: -10, drag: 0.6 });
          break;
        }
      }
    }
  }

  drawBack(r: Renderer) {
    const w = this.world;
    const cam = w.camera;
    const x0 = Math.floor(cam.x / TILE) - 1;
    const y0 = Math.floor(cam.y / TILE) - 1;
    const flick = Math.sin(w.time * 5) > 0.6 ? 1 : 0;
    for (let ty = y0; ty < y0 + 26; ty++)
      for (let tx = x0; tx < x0 + 43; tx += 2) {
        if (w.map.get(tx, ty) === T.Acid && w.map.get(tx, ty - 1) !== T.Acid) r.halo(tx * TILE + 4, ty * TILE - 2, 13 + flick, 1);
      }
  }

  draw(r: Renderer) {
    // vent grates under the steam columns
    const w = this.world;
    const cam = w.camera;
    const x0 = Math.floor(cam.x / TILE) - 1;
    const y0 = Math.floor(cam.y / TILE) - 1;
    for (let ty = y0; ty < y0 + 26; ty++)
      for (let tx = x0; tx < x0 + 43; tx++) {
        if (w.map.get(tx, ty) !== T.Updraft || !w.map.solidTile(tx, ty + 1)) continue;
        const x = tx * TILE;
        const y = ty * TILE + 5;
        r.rect(x, y, TILE, 3, 2);
        for (let i = 1; i < TILE; i += 2) r.rect(x + i, y + 1, 1, 2, (Math.floor(w.time * 10) + i) % 4 === 0 ? 1 : 0);
      }
  }
}

registerEntity('foundry:ambience', (w) => new Ambience(w));

// ===========================================================================================
// CINDER — a flame spirit chained in the lantern chamber. Free it after the Warden falls.
// ===========================================================================================
export class Prisoner extends Entity {
  private anim = new Anim('foundry-cinder', 'chained');
  private talking = false;
  private t = 0;

  constructor(world: World, x: number, y: number) {
    super(world, x - 3, y - 10, 14, 18);
    this.depth = -1;
  }

  private get freed() {
    return this.world.hasFlag('foundry:cinder');
  }

  update(dt: number) {
    this.t += dt;
    this.anim.play(this.talking ? 'talk' : this.freed ? 'free' : 'chained');
    this.anim.update(dt);
    if (this.freed && Math.random() < dt * 4)
      this.world.particles.burst(this.cx, this.y + 4, 1, { colors: [3, 2], speed: [5, 15], angle: [-2, -1.1], life: [0.4, 0.8] });
  }

  interact() {
    const w = this.world;
    const done = () => (this.talking = false);
    this.talking = true;
    if (this.freed) {
      const lines = w.hasFlag('goal:foundry')
        ? ['LANTERN CITY IS SHINING! RIDE THE SPIRIT RAIL AND SEE IT ALL. I WILL KEEP THE FOUNDRY WARM.']
        : ['THE SECTOR LANTERN IS RIGHT THERE. LIGHT IT, AND THE WHOLE CITY WILL REMEMBER HOW TO GLOW.'];
      w.ui.say('CINDER', lines, done);
      return;
    }
    if (!w.hasFlag('boss:foundry')) {
      w.ui.say('CINDER', ['THE WARDEN HOLDS THE KEY TO THESE CHAINS... PLEASE, BE CAREFUL.'], done);
      return;
    }
    w.setFlag('foundry:cinder');
    w.sfx('break');
    w.shake(0.4);
    for (const [ax, ay] of this.anchors()) w.particles.burst(ax, ay, 10, { colors: [2, 1, 3], speed: [30, 90], grav: 300, life: [0.4, 0.8], bounce: true });
    w.particles.burst(this.cx, this.cy, 20, { colors: [3, 2], speed: [30, 100], life: [0.4, 0.9] });
    w.ui.say(
      'CINDER',
      [
        'YOU... YOU BEAT THE WARDEN? THEN THESE CHAINS ARE JUST IRON NOW!',
        'I AM CINDER. THE BARONS KEPT ME HERE TO STOKE THEIR FURNACES WITH STOLEN LIGHT. NO MORE!',
        'TAKE THESE SOULS, I HID THEM FROM THE BARONS. NOW GO: THE SECTOR LANTERN IS RIGHT THERE.',
      ],
      () => {
        done();
        w.spawnSouls(this.cx, this.cy, 12);
        w.sfx('powerup');
      },
    );
  }

  /** Where the chains are bolted: the floor on either side. */
  private anchors(): [number, number][] {
    return [
      [this.cx - 14, this.bottom],
      [this.cx + 14, this.bottom],
    ];
  }

  drawBack(r: Renderer) {
    if (this.freed) r.halo(this.cx, this.cy, 16, 1);
  }

  draw(r: Renderer) {
    const bob = this.freed && !this.talking ? Math.round(Math.sin(this.t * 2.5) * 2) - 2 : 0;
    if (!this.freed) {
      // chains from the floor rings to the shackles
      for (const [ax, ay] of this.anchors()) {
        const hx = this.cx + (ax < this.cx ? -4 : 4);
        const hy = this.cy + 2;
        const n = Math.ceil(Math.hypot(ax - hx, ay - hy));
        for (let i = 0; i <= n; i++) {
          const x = ax + ((hx - ax) * i) / n;
          const y = ay + ((hy - ay) * i) / n + Math.sin((i / n) * Math.PI) * 2;
          if (i % 3 !== 2) r.rect(x, y, 1, 1, i % 3 === 0 ? 2 : 1);
        }
        r.rect(ax - 2, ay - 2, 5, 2, 2);
        r.rect(hx - 1, hy - 1, 3, 3, 1);
      }
    }
    r.sprite('foundry-cinder', this.anim.frame, this.cx, this.bottom + bob, { flip: this.world.player.cx < this.cx });
  }

  light() {
    return { x: this.cx, y: this.cy, r: this.freed ? 40 : 18 };
  }
}

registerEntity('foundry:prisoner', (w, x, y) => new Prisoner(w, x, y));
