import { approach, clamp, hash2 } from '../../../engine/math';
import type { Renderer } from '../../../engine/renderer';
import { CLEAR, PixelBuffer } from '../../../engine/pixels';
import { Anim, defineSheet } from '../../../engine/sprites';
import { T, TILE, TileMap } from '../../../engine/tilemap';
import { Bullet } from '../../../game/common/bullet';
import { Enemy } from '../../../game/enemy';
import { Entity } from '../../../game/entity';
import type { Player } from '../../../game/player';
import { registerEntity, type SpawnOpts } from '../../../game/registry';
import type { World } from '../../../game/world';
import './sprites';

/**
 * Underworks enemies and machinery.
 *
 *   underworks:sentry   armoured turret; only its own reflected bolts (or blows from behind) hurt it
 *   underworks:rat      fast little scurrier that rears up, then lunges
 *   underworks:drip     ceiling slime: quivers, drops when you pass under, then oozes after you
 *   underworks:eel      lurks in water, eyes glint, then it lunges out in an arc
 *   underworks:valve    strike it to open every sluice gate on its channel
 *   underworks:sluice   heavy gate (a rectangle of one map symbol) that rises when its channel opens
 *   underworks:current  water that pushes the swimmer (one cell per symbol)
 *   underworks:vent     steam grate at the foot of an updraft column
 *   underworks:secret   hides a sealed room (drawn as solid masonry) until its cracked wall breaks
 *   underworks:waterfx  sewer ambience: water glints, bubbles, ceiling drips (one per map)
 *
 * All critters freeze while a dialogue is open, so nobody bites you mid-sentence.
 */

const OPEN = (ch: string) => `underworks:open:${ch}`;

/** Open every sluice on a channel (and remember it). */
function openChannel(world: World, ch: string) {
  if (!world.hasFlag(OPEN(ch))) world.setFlag(OPEN(ch));
  for (const e of world.entities) if (e instanceof Sluice && e.ch === ch) e.open();
}

/** A critter that slipped into acid or deep water fizzles away (no souls). */
function fizzle(e: Enemy) {
  e.souls = 0;
  e.world.particles.burst(e.cx, e.bottom, 10, { colors: [3, 2], speed: [20, 60], angle: [-2.6, -0.5], life: [0.3, 0.6] });
  e.world.game.audio.noise(0.3, 0.15, 'highpass', 3000, 800);
  e.removed = true;
  e.dead = true;
}

/** Metallic "tink" for blows that armour turns aside. */
function clank(world: World, x: number, y: number) {
  world.game.audio.tone('square', 1500, 700, 0.07, 0.06);
  world.game.audio.noise(0.05, 0.12, 'highpass', 5000, 2500);
  world.particles.burst(x, y, 6, { colors: [3, 2], speed: [40, 110], life: [0.1, 0.25], size: [1, 1] });
  world.hitstop(0.04);
}

// =============================================================================================

/**
 * Sentry — a riveted dome turret. Sees you in front of it, lights its visor (telegraph),
 * then fires a crackling bolt at you. Its armour turns the stick aside from the front and
 * from above (you can still pogo off it); strike its bolts back, or get behind it.
 */
export class Sentry extends Enemy {
  private anim = new Anim('underworks-sentry', 'idle');
  private ai: 'idle' | 'charge' | 'cool' = 'idle';
  private t = 0;
  private face: 1 | -1;
  private ch: string | null;

  constructor(world: World, x: number, y: number, o: SpawnOpts) {
    super(world, x - 2, y - 6, 12, 14);
    this.hp = 3;
    this.souls = 4;
    this.knockback = 0;
    this.face = o.face === 1 ? 1 : -1;
    this.ch = typeof o.ch === 'string' ? o.ch : null;
    this.anim.t = hash2(x, y, 3) * 2;
  }

  private muzzle() {
    return { x: this.cx + this.face * 9, y: this.bottom - 9 };
  }

  private sees(): boolean {
    const p = this.world.player;
    if (!p.alive) return false;
    const dx = p.cx - this.cx;
    const dy = p.cy - this.cy;
    if (Math.sign(dx) !== this.face && Math.abs(dx) > 6) return false;
    if (Math.abs(dx) > 150 || Math.abs(dy) > 80) return false;
    const m = this.muzzle();
    return this.world.lineOfSight(m.x, m.y, p.cx, p.cy);
  }

  update(dt: number) {
    if (this.world.ui.busy) return; // nobody shoots while you read
    this.tick(dt);
    this.t -= dt;
    this.anim.update(dt);
    switch (this.ai) {
      case 'idle':
        this.anim.play('idle');
        if (this.t <= 0 && this.sees()) {
          this.ai = 'charge';
          this.t = 0.6;
          this.anim.play('charge', true);
          this.world.sfx('charge');
        }
        break;
      case 'charge':
        if (this.t <= 0) this.fire();
        break;
      case 'cool':
        if (this.anim.done) this.anim.play('idle');
        if (this.t <= 0) this.ai = 'idle';
        break;
    }
    this.touchPlayer();
  }

  private fire() {
    const p = this.world.player;
    const m = this.muzzle();
    // aim at the player, but only within a cone in front of the barrel
    let ang = Math.atan2(p.cy - m.y, (p.cx - m.x) * this.face);
    ang = clamp(ang, -0.85, 0.85);
    const speed = 96;
    this.world.add(
      new Bullet(this.world, m.x, m.y, Math.cos(ang) * speed * this.face, Math.sin(ang) * speed, {
        sheet: 'underworks-bolt',
        anim: 'fly',
        size: 5,
        life: 3.2,
      }),
    );
    this.world.sfx('shoot');
    this.world.particles.burst(m.x, m.y, 5, { colors: [3, 2], speed: [20, 70], life: [0.1, 0.25] });
    this.anim.play('fire', true);
    this.ai = 'cool';
    this.t = 1.25;
  }

  onSlash(_player: Player, dx: number, dy: number): boolean {
    if (dx === this.face && dy === 0) return this.hurt(1, dx, dy); // from behind: the soft back panel
    clank(this.world, this.cx - this.face * 3, this.y + 4);
    return true;
  }

  protected onDeath() {
    this.world.particles.burst(this.cx, this.cy, 10, { colors: [2, 1], speed: [30, 120], grav: 400, bounce: true, life: [0.6, 1.2] });
    if (this.ch) openChannel(this.world, this.ch);
  }

  drawBack(r: Renderer) {
    if (this.ai === 'charge') r.halo(this.cx, this.y + 2, 10, 1);
  }

  draw(r: Renderer) {
    this.drawFrame(r, 'underworks-sentry', this.anim.frame, this.cx, this.bottom, { flip: this.face < 0 });
  }

  light() {
    return { x: this.cx, y: this.y + 2, r: this.ai === 'charge' ? 30 : 14 };
  }
}

// =============================================================================================

/** Sewer rat — scurries along its ledge; spots you, rears up with a squeak, then lunges. */
export class Rat extends Enemy {
  private ai: 'run' | 'rear' | 'lunge' | 'rest' = 'run';
  private dir: 1 | -1;
  private t = 0;
  private cool = 0;
  private anim = new Anim('underworks-rat', 'run');

  constructor(world: World, x: number, y: number) {
    super(world, x - 1, y + 2, 10, 6);
    this.hp = 2;
    this.souls = 1;
    this.knockback = 1.3;
    this.dir = hash2(x, y, 1) < 0.5 ? -1 : 1;
    this.anim.t = hash2(x, y, 2);
  }

  private seesPlayer() {
    const p = this.world.player;
    return (
      p.alive &&
      Math.abs(p.bottom - this.bottom) < 18 &&
      Math.abs(p.cx - this.cx) < 92 &&
      this.world.lineOfSight(this.cx, this.cy - 2, p.cx, p.cy)
    );
  }

  update(dt: number) {
    if (this.world.ui.busy) return;
    if (this.world.map.touches(this, T.Acid) || this.world.tileAt(this.cx, this.cy) === T.Water) return this.dissolve();
    this.tick(dt);
    this.applyGravity(dt);
    this.t -= dt;
    this.cool -= dt;
    if (this.stun > 0) {
      this.vx = approach(this.vx, 0, 500 * dt);
    } else {
      switch (this.ai) {
        case 'run':
          this.vx = this.dir * 46;
          if (this.onGround() && (this.wallAhead(this.dir) || !this.groundAhead(this.dir))) this.dir = -this.dir as 1 | -1;
          if (this.cool <= 0 && this.seesPlayer()) {
            this.ai = 'rear';
            this.t = 0.4;
            this.dir = this.playerDir();
            this.vx = 0;
            this.world.game.audio.tone('square', 1900, 2600, 0.05, 0.035);
            this.world.game.audio.tone('square', 2100, 2900, 0.05, 0.03, (this.world.game.audio.ctx?.currentTime ?? 0) + 0.08);
          }
          break;
        case 'rear':
          this.vx = 0;
          if (this.t <= 0) {
            this.ai = 'lunge';
            this.t = 0.5;
            this.vy = -70;
          }
          break;
        case 'lunge':
          this.vx = this.dir * 150;
          if (Math.random() < dt * 25)
            this.world.particles.burst(this.cx - this.dir * 5, this.bottom - 1, 1, { colors: [1, 2], speed: [10, 30], angle: [-2.6, -0.5] });
          if (this.t <= 0 || (this.onGround() && !this.groundAhead(this.dir))) {
            this.ai = 'rest';
            this.t = 0.45;
          }
          break;
        case 'rest':
          this.vx = approach(this.vx, 0, 500 * dt);
          if (this.t <= 0) {
            this.ai = 'run';
            this.cool = 0.9;
          }
          break;
      }
    }
    this.physics(dt, () => {
      if (this.ai === 'lunge') {
        this.ai = 'rest';
        this.t = 0.5;
      }
      this.dir = -this.dir as 1 | -1;
    });
    this.touchPlayer();
    this.anim.play(this.ai === 'rear' ? 'rear' : this.ai === 'lunge' ? 'lunge' : 'run');
    this.anim.update(this.ai === 'rest' ? 0 : dt);
  }

  private dissolve() {
    fizzle(this);
  }

  draw(r: Renderer) {
    this.drawFrame(r, 'underworks-rat', this.anim.frame, this.cx, this.bottom, { flip: this.dir < 0 });
  }
}

// =============================================================================================

/**
 * Drip slime — clings to a ceiling (place it in the cell just under one). When you pass
 * beneath it quivers (telegraph), lets go, splats, and then oozes after you.
 */
export class Drip extends Enemy {
  private ai: 'hang' | 'quiver' | 'fall' | 'splat' | 'ooze' = 'hang';
  private t = 0;
  private dir: 1 | -1 = 1;
  private hopT = 0;
  private anim = new Anim('underworks-drip', 'hang');

  constructor(world: World, x: number, y: number) {
    super(world, x - 1, y, 10, 9);
    this.hp = 2;
    this.souls = 2;
    this.anim.t = hash2(x, y, 5) * 2;
  }

  protected onHurt(dx: number, dy: number) {
    super.onHurt(dx, dy);
    if (this.ai === 'hang' || this.ai === 'quiver') this.ai = 'fall';
  }

  update(dt: number) {
    if (this.world.ui.busy) return;
    if (this.world.map.touches(this, T.Acid) || this.world.tileAt(this.cx, this.cy) === T.Water) return this.dissolve();
    this.tick(dt);
    this.t -= dt;
    const p = this.world.player;
    switch (this.ai) {
      case 'hang':
        this.vx = this.vy = 0;
        if (p.alive && Math.abs(p.cx - this.cx) < 30 && p.y > this.bottom && p.y - this.bottom < 120 && this.world.lineOfSight(this.cx, this.bottom + 2, p.cx, p.y)) {
          this.ai = 'quiver';
          this.t = 0.38;
          this.world.game.audio.tone('sine', 300, 520, 0.18, 0.06);
        }
        break;
      case 'quiver':
        if (this.t <= 0) {
          this.ai = 'fall';
          this.vy = 20;
        }
        break;
      case 'fall':
        this.applyGravity(dt, 760, 280);
        this.vx = approach(this.vx, 0, 200 * dt);
        if (this.onGround()) {
          this.ai = 'splat';
          this.t = 0.4;
          this.dir = this.playerDir();
          this.world.particles.burst(this.cx, this.bottom, 8, { colors: [2, 3], speed: [30, 80], angle: [-3, -0.15], grav: 300, life: [0.3, 0.5] });
          this.world.game.audio.noise(0.12, 0.2, 'lowpass', 900, 200);
        }
        break;
      case 'splat':
        this.vx = 0;
        this.applyGravity(dt);
        if (this.t <= 0) this.ai = 'ooze';
        break;
      case 'ooze':
        this.applyGravity(dt);
        this.hopT -= dt;
        if (this.stun > 0) this.vx = approach(this.vx, 0, 400 * dt);
        else {
          if (Math.abs(p.cx - this.cx) < 120 && Math.abs(p.bottom - this.bottom) < 24) this.dir = this.playerDir();
          this.vx = this.dir * 20;
          if (this.onGround() && (this.wallAhead(this.dir) || !this.groundAhead(this.dir))) this.dir = -this.dir as 1 | -1;
          if (this.hopT <= 0 && this.onGround()) {
            this.hopT = 1.1 + hash2(Math.floor(this.world.time), this.x, 1) * 0.8;
            this.vy = -130;
            this.vx = this.dir * 60;
          }
        }
        break;
    }
    if (this.ai !== 'hang' && this.ai !== 'quiver') this.physics(dt, () => (this.dir = -this.dir as 1 | -1));
    this.touchPlayer();
    this.anim.play(this.ai === 'ooze' ? 'ooze' : this.ai);
    this.anim.update(dt);
  }

  private dissolve() {
    fizzle(this);
  }

  draw(r: Renderer) {
    const hanging = this.ai === 'hang' || this.ai === 'quiver';
    const jitter = this.ai === 'quiver' ? Math.round(Math.sin(this.world.time * 70)) : 0;
    const y = hanging ? this.y + 12 : this.bottom + (this.ai === 'fall' ? 1 : 0);
    this.drawFrame(r, 'underworks-drip', this.anim.frame, this.cx + jitter, y, { flip: this.dir < 0 });
  }
}

// =============================================================================================

/**
 * Pipe eel — waits under the surface (only its eyes show). When you come near, the eyes flare
 * and bubbles rise (telegraph), then it bursts out in an arc at you and dives back.
 */
export class Eel extends Enemy {
  private ai: 'lurk' | 'warn' | 'lunge' | 'return' = 'lurk';
  private t = 0;
  private home: { x: number; y: number };
  private surface: number;
  private trail: { x: number; y: number }[] = [];
  private anim = new Anim('underworks-eel', 'lurk');
  private facing: 1 | -1 = 1;

  constructor(world: World, x: number, y: number) {
    super(world, x - 2, y - 1, 12, 9);
    this.hp = 3;
    this.souls = 3;
    this.knockback = 0.4;
    this.home = { x: this.x, y: this.y };
    // the eel's own map cell would otherwise be an air bubble in the water
    const map = world.map;
    if (map.get(x / TILE, y / TILE - 1) === T.Water || map.get(x / TILE, y / TILE + 1) === T.Water) map.set(x / TILE, y / TILE, T.Water);
    let ty = Math.floor(y / TILE);
    while (ty > 0 && world.map.get(Math.floor(x / TILE), ty - 1) === T.Water) ty--;
    this.surface = ty * TILE;
    for (let i = 0; i < 14; i++) this.trail.push({ x: this.cx, y: this.cy });
  }

  get hidden() {
    return this.ai === 'lurk' || this.ai === 'warn';
  }

  hurtbox() {
    return this.hidden ? { x: -9999, y: -9999, w: 0, h: 0 } : this;
  }

  update(dt: number) {
    if (this.world.ui.busy) return;
    this.tick(dt);
    this.t -= dt;
    const p = this.world.player;
    const dx = p.cx - this.cx;
    switch (this.ai) {
      case 'lurk':
        this.x = this.home.x;
        this.y = this.home.y + Math.round(Math.sin(this.world.time * 2 + this.home.x) * 1.5);
        if (this.t <= 0 && p.alive && Math.abs(dx) < 64 && p.bottom > this.surface - 64 && p.cy < this.cy + 24) {
          this.ai = 'warn';
          this.t = 0.55;
          this.facing = dx < 0 ? -1 : 1;
          this.world.game.audio.tone('sine', 140, 90, 0.4, 0.08);
        }
        break;
      case 'warn':
        if (Math.random() < dt * 30)
          this.world.particles.burst(this.cx + (Math.random() - 0.5) * 10, this.surface, 1, { colors: [2, 3], speed: [20, 50], angle: [-2.2, -0.9], life: [0.2, 0.4], grav: 200 });
        if (this.t <= 0) {
          this.ai = 'lunge';
          const target = p.alive ? p.cx + p.vx * 0.3 : this.cx;
          this.vx = clamp((target - this.cx) * 1.7, -120, 120);
          this.vy = -Math.sqrt(2 * 520 * Math.max(24, this.cy - Math.min(p.cy, this.surface) + 18));
          this.vy = Math.max(this.vy, -290);
          this.facing = this.vx < 0 ? -1 : 1;
          this.world.particles.burst(this.cx, this.surface, 10, { colors: [3, 2], speed: [40, 110], angle: [-2.8, -0.3], grav: 400, life: [0.3, 0.6] });
          this.world.game.audio.noise(0.2, 0.25, 'bandpass', 1800, 500);
          this.world.sfx('growl');
        }
        break;
      case 'lunge': {
        const inWater = this.world.tileAt(this.cx, this.cy) === T.Water;
        this.vy = approach(this.vy, 260, (inWater ? 300 : 520) * dt);
        this.moveFree(this.vx * dt, this.vy * dt);
        if (this.vy > 0 && inWater && this.cy > this.surface + 10) {
          this.ai = 'return';
          this.world.particles.burst(this.cx, this.surface, 6, { colors: [3, 2], speed: [30, 80], angle: [-2.6, -0.5], grav: 400 });
        }
        break;
      }
      case 'return':
        this.vx = (this.home.x - this.x) * 3;
        this.vy = (this.home.y - this.y) * 3;
        this.moveFree(this.vx * dt, this.vy * dt);
        if (Math.abs(this.home.x - this.x) < 2 && Math.abs(this.home.y - this.y) < 2) {
          this.ai = 'lurk';
          this.t = 1.4;
        }
        break;
    }
    // body: follow the head's recent path
    this.trail.unshift({ x: this.cx, y: this.cy });
    this.trail.length = 14;
    if (!this.hidden) this.touchPlayer();
    this.anim.play(this.hidden ? 'lurk' : this.ai === 'lunge' && this.vy < 60 ? 'bite' : 'glide');
    this.anim.update(dt);
  }

  draw(r: Renderer) {
    if (this.hidden) {
      const flare = this.ai === 'warn' && Math.floor(this.world.time * 16) % 2 === 0;
      r.rect(this.cx - 4, this.cy, 2, 1, flare ? 3 : 2);
      r.rect(this.cx + 2, this.cy, 2, 1, flare ? 3 : 2);
      if (flare) r.rect(this.cx - 3, this.cy, 1, 1, 0);
      return;
    }
    // body: segments along the head's recent path, thinning toward a little tail fin
    const tint = this.flash > 0 ? 3 : undefined;
    for (let i = 13; i >= 2; i -= 2) {
      const s = this.trail[i];
      const frame = i >= 13 ? 'tail' : i >= 10 ? 'small' : i >= 6 ? 'mid' : 'big';
      r.sprite('underworks-eelseg', frame, s.x, s.y, { tint });
    }
    this.drawFrame(r, 'underworks-eel', this.anim.frame, this.cx, this.cy, { flip: this.facing < 0 });
  }
}

// =============================================================================================

/** A strikeable valve wheel. Opens every sluice on its channel (persistently). */
export class Valve extends Entity {
  private anim: Anim;
  readonly ch: string;

  constructor(world: World, x: number, y: number, o: SpawnOpts) {
    super(world, x - 2, y - 6, 12, 14);
    this.depth = -2;
    this.ch = String(o.ch ?? 'a');
    this.anim = new Anim('underworks-valve', world.hasFlag(OPEN(this.ch)) ? 'open' : 'shut');
  }

  get isOpen() {
    return this.world.hasFlag(OPEN(this.ch));
  }

  update(dt: number) {
    this.anim.update(dt);
    if (this.anim.name === 'turn' && this.anim.done) this.anim.play('open');
  }

  onSlash(): boolean {
    if (this.isOpen) {
      clank(this.world, this.cx, this.y + 5);
      return true;
    }
    this.anim.play('turn', true);
    this.world.sfx('hit');
    this.world.game.audio.tone('sawtooth', 160, 90, 0.35, 0.06);
    this.world.particles.burst(this.cx, this.y + 5, 10, { colors: [3, 2], speed: [30, 90], life: [0.2, 0.5] });
    this.world.hitstop(0.08);
    openChannel(this.world, this.ch);
    return true;
  }

  drawBack(r: Renderer) {
    if (!this.isOpen) r.halo(this.cx + 5, this.y + 1, 7 + (Math.sin(this.world.time * 6) > 0 ? 1 : 0), 1);
  }

  draw(r: Renderer) {
    r.sprite('underworks-valve', this.anim.frame, this.cx, this.bottom + 2);
  }
}

/** A heavy riveted gate spanning one rectangle of its map symbol; rises into the masonry when opened. */
export class Sluice extends Entity {
  readonly ch: string;
  private h0: number;
  private openT = 0;
  private opening = false;

  constructor(world: World, x: number, y: number, w: number, h: number, ch: string) {
    super(world, x, y, w, h);
    this.ch = ch;
    this.h0 = h;
    this.depth = -1;
    this.solid = true;
    if (world.hasFlag(OPEN(ch))) {
      this.openT = 1;
      this.h = 0;
      this.solid = false;
    }
  }

  open() {
    if (this.opening || this.openT >= 1) return;
    this.opening = true;
    this.world.sfx('gate');
    this.world.shake(0.35);
  }

  update(dt: number) {
    if (!this.opening) return;
    this.openT = Math.min(1, this.openT + dt / 1.1);
    const k = this.openT * this.openT;
    this.h = Math.max(0, Math.round(this.h0 * (1 - k)));
    if (Math.random() < dt * 20)
      this.world.particles.burst(this.x + Math.random() * this.w, this.y + this.h, 1, { colors: [2, 1], speed: [10, 40], grav: 300, life: [0.3, 0.6] });
    if (this.h <= 2) {
      this.solid = false;
      this.opening = false;
      this.openT = 1;
      this.h = 0;
    }
  }

  draw(r: Renderer) {
    if (this.h <= 0) return;
    const { x, y, w, h } = this;
    r.rect(x, y, w, h, 2);
    r.rect(x + 1, y, w - 2, h - 1, 1);
    for (let bx = x + 2; bx < x + w - 1; bx += 3) r.rect(bx, y, 1, h - 1, 0);
    for (let by = y + 3; by < y + h - 2; by += 8) {
      r.rect(x, by, w, 1, 2);
      r.rect(x + 1, by + 1, 1, 1, 3);
      r.rect(x + w - 2, by + 1, 1, 1, 3);
    }
    // hazard stripe on the foot of the gate
    for (let i = 0; i < w; i++) r.rect(x + i, y + h - 3, 1, 2, i % 4 < 2 ? 3 : 0);
    r.rect(x, y + h - 1, w, 1, 2);
  }
}

// =============================================================================================

/** Water that pushes: the swimmer drifts with it (you can still fight a sideways current). */
export class Current extends Entity {
  constructor(
    world: World,
    x: number,
    y: number,
    private dx: number,
    private dy: number,
  ) {
    super(world, x, y, TILE, TILE);
    this.depth = -3;
    world.map.set(x / TILE, y / TILE, T.Water);
  }

  update(dt: number) {
    const p = this.world.player;
    if (p.alive && p.cx >= this.x && p.cx < this.x + TILE && p.cy >= this.y && p.cy < this.y + TILE) {
      p.moveX(this.dx * 52 * dt);
      p.moveY(this.dy * 52 * dt);
      if (this.dy < 0) p.vy = Math.min(p.vy, 10);
    }
    if (Math.random() < dt * 3)
      this.world.particles.burst(this.x + 4, this.y + 4, 1, { colors: [2], speed: [40, 60], angle: this.dir(), life: [0.3, 0.5], drag: 0, size: [1, 1] });
  }

  private dir(): [number, number] {
    const a = Math.atan2(this.dy, this.dx);
    return [a - 0.1, a + 0.1];
  }

  draw(r: Renderer) {
    const t = this.world.time;
    for (let i = 0; i < 2; i++) {
      const phase = (t * 46 + hash2(this.x, this.y, i) * 8) % 8;
      const along = Math.floor(phase);
      const across = 1 + Math.floor(hash2(this.x, this.y, i + 4) * 6);
      if (this.dx !== 0) {
        const sx = this.dx > 0 ? this.x + along : this.x + 7 - along;
        r.rect(sx - (this.dx > 0 ? 2 : 0), this.y + across, 3, 1, 2);
      } else {
        const sy = this.dy > 0 ? this.y + along : this.y + 7 - along;
        r.rect(this.x + across, sy - (this.dy > 0 ? 2 : 0), 1, 3, 2);
      }
    }
  }
}

/** Steam grate at the foot of an updraft column ('W' tiles above it); puffs, hisses and shimmers. */
export class Vent extends Entity {
  private top: number;
  private x0: number;
  private x1: number;

  constructor(world: World, x: number, y: number) {
    super(world, x, y + 2, TILE, 6);
    this.depth = -2;
    const map = world.map;
    const tx = x / TILE;
    const ty = y / TILE;
    map.set(tx, ty, T.Updraft);
    let top = ty;
    while (top > 0 && map.get(tx, top - 1) === T.Updraft) top--;
    this.top = top * TILE;
    let l = tx;
    while (map.get(l - 1, ty) === T.Updraft) l--;
    let r = tx;
    while (map.get(r + 1, ty) === T.Updraft) r++;
    this.x0 = l * TILE;
    this.x1 = (r + 1) * TILE;
  }

  update(dt: number) {
    if (Math.random() < dt * 26)
      this.world.particles.burst(this.x0 + 1 + Math.random() * (this.x1 - this.x0 - 2), this.y + 2, 1, {
        colors: [2, 2, 1],
        speed: [70, 120],
        angle: [-1.72, -1.42],
        life: [(this.y - this.top) / 140, (this.y - this.top) / 100],
        size: [1, 2],
        drag: 0.3,
      });
  }

  drawBack(r: Renderer) {
    r.halo(this.cx, this.y + 2, 9, 1);
  }

  draw(r: Renderer) {
    // heat shimmer: short teal streaks racing up the column
    const t = this.world.time;
    const h = this.y - this.top;
    const n = Math.ceil((this.x1 - this.x0) / 3);
    for (let i = 0; i < n; i++) {
      const sx = this.x0 + 1 + Math.floor(hash2(i, this.x0, 4) * (this.x1 - this.x0 - 2));
      const sy = this.y - ((t * 120 + hash2(i, this.x0, 5) * h) % h);
      r.rect(sx, sy, 1, 3, 2);
    }
    r.sprite('underworks-vent', 'a', this.cx, this.y + 6);
  }
}

/**
 * A sealed secret room: until the cracked wall ('X') next to it breaks, the room (and its rim)
 * is drawn as if it were solid masonry — painted with the world's own terrain style on a copy of
 * the map where the room is filled in. Then it crumbles away.
 */
export class Secret extends Entity {
  private sheet: string;
  private walls: [number, number][] = [];
  private fade = -1;
  private ox: number;
  private oy: number;

  constructor(world: World, x: number, y: number) {
    super(world, x, y, 1, 1);
    this.depth = 3;
    const map = world.map;
    const room = new Set<number>();
    const seen = new Set<number>();
    const stack: [number, number][] = [[x / TILE, y / TILE]];
    while (stack.length && room.size < 300) {
      const [cx, cy] = stack.pop()!;
      const k = cy * map.w + cx;
      if (seen.has(k) || cx < 0 || cy < 0 || cx >= map.w || cy >= map.h) continue;
      seen.add(k);
      if (map.get(cx, cy) === T.Breakable) {
        this.walls.push([cx, cy]);
        continue;
      }
      if (map.solidTile(cx, cy)) continue;
      room.add(k);
      stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
    }
    // paint a copy of the map with the room filled in
    const filled = new TileMap(map.w, map.h, map.style);
    filled.tiles.set(map.tiles);
    for (const k of room) filled.tiles[k] = T.Solid;
    const painted = new PixelBuffer(map.pw, map.ph);
    map.style.paint(painted, filled);
    // cover = room cells + their solid rim (but never the cracked wall itself)
    const cover = new Set<number>();
    for (const k of room) {
      const cx = k % map.w;
      const cy = Math.floor(k / map.w);
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const nx = cx + dx;
          const ny = cy + dy;
          const t = map.get(nx, ny);
          if (room.has(ny * map.w + nx) || (map.solidTile(nx, ny) && t !== T.Breakable)) cover.add(ny * map.w + nx);
        }
    }
    const xs = [...cover].map((k) => k % map.w);
    const ys = [...cover].map((k) => Math.floor(k / map.w));
    this.ox = Math.min(...xs);
    this.oy = Math.min(...ys);
    const w = (Math.max(...xs) - this.ox + 1) * TILE;
    const h = (Math.max(...ys) - this.oy + 1) * TILE;
    const b = new PixelBuffer(w, h);
    for (const k of cover) {
      const cx = k % map.w;
      const cy = Math.floor(k / map.w);
      for (let py = 0; py < TILE; py++)
        for (let px = 0; px < TILE; px++) {
          const c = painted.get(cx * TILE + px, cy * TILE + py);
          b.set((cx - this.ox) * TILE + px, (cy - this.oy) * TILE + py, c === CLEAR ? 0 : c);
        }
    }
    const full = b.toRows();
    const half = full.map((row, j) => [...row].map((c, i) => ((i + j) & 1 ? '.' : c)).join(''));
    this.sheet = `underworks-secret-${x / TILE},${y / TILE}`;
    defineSheet(this.sheet, { w, h, ox: 0, oy: 0, frames: { a: full, b: half }, anims: { idle: { frames: ['a'], fps: 1 } } });
    if (this.opened) this.removed = true;
  }

  private get opened() {
    return this.walls.length > 0 && this.walls.every(([tx, ty]) => this.world.map.get(tx, ty) !== T.Breakable);
  }

  update(dt: number) {
    if (this.fade < 0 && this.opened) this.fade = 0.35;
    if (this.fade >= 0) {
      this.fade -= dt;
      if (this.fade <= 0) this.removed = true;
    }
  }

  draw(r: Renderer) {
    r.sprite(this.sheet, this.fade >= 0 && this.fade < 0.2 ? 'b' : 'a', this.ox * TILE, this.oy * TILE);
  }
}

/**
 * Sewer ambience: drifting teal glints inside water tiles and the odd rising bubble, so the
 * (magenta) water reads as water in this palette, plus drops falling from the ceilings.
 * One per world, placed anywhere open.
 */
export class WaterFx extends Entity {
  constructor(world: World) {
    super(world, 0, 0, 1, 1);
    this.depth = -4;
  }

  private visible(f: (tx: number, ty: number) => void) {
    const cam = this.world.camera;
    const x0 = Math.max(0, Math.floor(cam.x / TILE));
    const y0 = Math.max(0, Math.floor(cam.y / TILE));
    for (let ty = y0; ty <= y0 + 23; ty++) for (let tx = x0; tx <= x0 + 41; tx++) f(tx, ty);
  }

  update(dt: number) {
    const map = this.world.map;
    const cam = this.world.camera;
    // drops falling from the ceilings now and then
    if (Math.random() < dt * 4) {
      const tx = Math.floor((cam.x + Math.random() * 320) / TILE);
      const ty = Math.floor((cam.y + Math.random() * 180) / TILE);
      if (map.get(tx, ty) === T.Empty && map.solidTile(tx, ty - 1) && !map.solidTile(tx, ty + 1))
        this.world.particles.burst(tx * TILE + 1 + Math.random() * 6, ty * TILE + 1, 1, { colors: [2], speed: [0, 4], angle: [1.5, 1.6], grav: 420, life: [0.6, 1.1], drag: 0, size: [1, 1], shrink: false });
    }
    if (Math.random() > dt * 6) return;
    const tx = Math.floor((cam.x + Math.random() * 320) / TILE);
    const ty = Math.floor((cam.y + Math.random() * 180) / TILE);
    if (map.get(tx, ty) !== T.Water || map.get(tx, ty - 1) !== T.Water || map.get(tx, ty - 3) !== T.Water) return;
    this.world.particles.burst(tx * TILE + 4, ty * TILE + 6, 1, { colors: [2, 3], speed: [8, 14], angle: [-1.7, -1.45], life: [1, 1.6], drag: 0, size: [1, 1], shrink: false });
  }

  draw(r: Renderer) {
    const map = this.world.map;
    const t = this.world.time;
    this.visible((tx, ty) => {
      if (map.get(tx, ty) !== T.Water || map.get(tx, ty - 1) !== T.Water) return;
      const h = hash2(tx, ty, 77);
      if (h < 0.45) return;
      const phase = (t * (5 + h * 5) + h * 40) % 14;
      if (phase > 7) return;
      r.rect(tx * TILE + Math.floor(phase), ty * TILE + 1 + Math.floor(hash2(tx, ty, 78) * 6), h > 0.8 ? 3 : 2, 1, 2);
    });
  }
}

// =============================================================================================

registerEntity('underworks:waterfx', (w) => new WaterFx(w));
registerEntity('underworks:secret', (w, x, y) => new Secret(w, x, y));
registerEntity('underworks:sentry', (w, x, y, o) => new Sentry(w, x, y, o));
registerEntity('underworks:rat', (w, x, y) => new Rat(w, x, y));
registerEntity('underworks:drip', (w, x, y) => new Drip(w, x, y));
registerEntity('underworks:eel', (w, x, y) => new Eel(w, x, y));
registerEntity('underworks:valve', (w, x, y, o) => new Valve(w, x, y, o));
registerEntity('underworks:vent', (w, x, y) => new Vent(w, x, y));
registerEntity('underworks:current', (w, x, y, o) => new Current(w, x, y, Number(o.dx ?? 0), Number(o.dy ?? 0)));
registerEntity('underworks:sluice', (w, x, y, o) => {
  // the top-left cell of a rectangle of this symbol builds the whole gate
  const sym = String(o.sym);
  const rows = w.def.map;
  const tx = x / TILE;
  const ty = y / TILE;
  if (rows[ty]?.[tx - 1] === sym || rows[ty - 1]?.[tx] === sym) return;
  let cw = 1;
  while (rows[ty]?.[tx + cw] === sym) cw++;
  let ch = 1;
  while (rows[ty + ch]?.[tx] === sym) ch++;
  return new Sluice(w, x, y, cw * TILE, ch * TILE, String(o.ch ?? 'a'));
});
