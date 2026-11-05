import { approach, clamp, overlaps, rand, type Rect } from '../../../engine/math';
import type { Renderer } from '../../../engine/renderer';
import { Anim } from '../../../engine/sprites';
import { T, TILE } from '../../../engine/tilemap';
import { Bullet } from '../../../game/common/bullet';
import { Decor, type DecorOpts } from '../../../game/common/props';
import { Enemy } from '../../../game/enemy';
import { Entity } from '../../../game/entity';
import type { Player } from '../../../game/player';
import { registerEntity, type SpawnOpts } from '../../../game/registry';
import type { World } from '../../../game/world';
import './sprites';

/**
 * Gloomroot Catacombs: creatures of the dark and the light mechanics that push it back.
 *
 *   enemies   bat (sleeps hanging, wakes, flaps at you) · skull crawler (candle-crowned, lunges)
 *             shade (blinks in, fires ghost orbs through walls) · skeleton (lobs bones)
 *   light     brazier (strike to light for good) → tomb door (opens when its braziers burn)
 *             lumen pod (bursts into drifting glow spores) · firefly (follows you, widens your light)
 *             hazard glow (bile and bone shards glimmer so no jump is ever blind)
 *   props     glowcap mushroom (bounce) · bone bridge (crumbles) · burial urn (souls) · NPCs
 */

const ID = 'catacombs';
const cellKey = (kind: string, x: number, y: number) => `${kind}:${ID}:${x / TILE},${y / TILE}`;

function squeak(w: World) {
  w.game.audio.tone('square', 1500, 2300, 0.07, 0.03);
  w.game.audio.tone('square', 1900, 2600, 0.06, 0.025);
}

function eerie(w: World) {
  w.game.audio.tone('sine', 330, 660, 0.45, 0.05);
  w.game.audio.tone('triangle', 336, 690, 0.45, 0.03);
}

// ================================================================================================
// Enemies
// ================================================================================================

/** Bat — sleeps hanging under the ceiling; wakes with a squeak when you come close and flaps after you in a wavy line. */
export class Bat extends Enemy {
  private ai: 'sleep' | 'wake' | 'fly' | 'home' = 'sleep';
  private t = 0;
  private wob = Math.random() * 6;
  private anim = new Anim('catacombs-bat', 'sleep');
  private roost: { x: number; y: number };

  constructor(world: World, x: number, y: number) {
    super(world, x - 1, y, 10, 8);
    this.hp = 2;
    this.souls = 2;
    this.knockback = 1.3;
    this.roost = { x: this.x, y: this.y };
    this.anim.t = Math.random() * 3;
  }

  protected onHurt(dx: number, dy: number) {
    super.onHurt(dx, dy);
    if (this.ai === 'sleep' || this.ai === 'wake') {
      this.ai = 'fly';
      this.anim.play('fly');
    }
  }

  update(dt: number) {
    this.tick(dt);
    this.t -= dt;
    this.wob += dt;
    this.anim.update(dt);
    const p = this.world.player;
    const dx = p.cx - this.cx;
    const dy = p.cy - this.cy;
    const d = Math.hypot(dx, dy) || 1;
    switch (this.ai) {
      case 'sleep':
        this.vx = this.vy = 0;
        if (p.alive && d < 76 && this.world.lineOfSight(this.cx, this.y + 6, p.cx, p.cy)) {
          this.ai = 'wake';
          this.t = 0.5;
          this.anim.play('wake');
          squeak(this.world);
        }
        return;
      case 'wake':
        // telegraph: shiver on the roost, then drop into flight
        if (this.t <= 0) {
          this.ai = 'fly';
          this.vy = 50;
          this.anim.play('fly');
        }
        return;
      case 'fly':
        if (this.stun > 0) {
          this.vx = approach(this.vx, 0, 300 * dt);
          this.vy = approach(this.vy, 0, 300 * dt);
        } else {
          const along = 52;
          const wave = Math.sin(this.wob * 5.5) * 48;
          // the wave is perpendicular to the line toward the player
          this.vx = approach(this.vx, (dx / d) * along - (dy / d) * wave, 170 * dt);
          this.vy = approach(this.vy, (dy / d) * along + (dx / d) * wave, 170 * dt);
        }
        if (!p.alive || d > 230) this.ai = 'home';
        break;
      case 'home': {
        const hx = this.roost.x - this.x;
        const hy = this.roost.y - this.y;
        const hd = Math.hypot(hx, hy);
        this.vx = approach(this.vx, (hx / (hd || 1)) * 60, 200 * dt);
        this.vy = approach(this.vy, (hy / (hd || 1)) * 60, 200 * dt);
        if (hd < 3) {
          this.x = this.roost.x;
          this.y = this.roost.y;
          this.ai = 'sleep';
          this.anim.play('sleep');
        } else if (p.alive && d < 70) this.ai = 'fly';
        break;
      }
    }
    if (this.ai === 'home') {
      // nobody watches a bat go home in the dark: it slips back through the rock
      this.moveFree(this.vx * dt, this.vy * dt);
    } else {
      this.moveX(this.vx * dt, () => (this.vx = -this.vx * 0.5));
      this.moveY(this.vy * dt, () => (this.vy = -this.vy * 0.5));
    }
    this.touchPlayer({ x: this.x + 1, y: this.y + 1, w: this.w - 2, h: this.h - 2 });
  }

  draw(r: Renderer) {
    const hanging = this.ai === 'sleep' || this.ai === 'wake';
    const jitter = this.ai === 'wake' ? Math.round(Math.sin(this.t * 80)) : 0;
    this.drawFrame(r, 'catacombs-bat', this.anim.frame, this.cx + jitter, hanging ? this.y : this.cy - 5, { flip: this.vx < 0 });
  }

  light() {
    if (this.ai === 'sleep') return { x: this.cx, y: this.y + 4, r: 7 };
    return { x: this.cx, y: this.cy, r: this.ai === 'wake' ? 22 : 16 };
  }
}

/** Skull crawler — a candle-crowned skull on bone legs. Creeps along floors, rattles (telegraph), then hop-lunges. */
export class Crawler extends Enemy {
  private ai: 'walk' | 'alert' | 'lunge' | 'recover' = 'walk';
  private dir: 1 | -1 = -1;
  private t = 0;
  private flick = Math.random() * 10;
  private anim = new Anim('catacombs-crawler', 'walk');

  constructor(world: World, x: number, y: number) {
    super(world, x - 2, y - 1, 12, 9);
    this.hp = 3;
    this.souls = 3;
  }

  update(dt: number) {
    this.tick(dt);
    this.applyGravity(dt);
    this.t -= dt;
    this.flick += dt;
    if (this.stun > 0) {
      this.vx = approach(this.vx, 0, 500 * dt);
    } else {
      switch (this.ai) {
        case 'walk':
          this.vx = this.dir * 22;
          if (this.onGround() && (this.wallAhead(this.dir) || !this.groundAhead(this.dir))) this.dir = -this.dir as 1 | -1;
          if (this.seesPlayer()) {
            this.ai = 'alert';
            this.t = 0.55;
            this.dir = this.playerDir();
            this.vx = 0;
            this.world.game.audio.noise(0.3, 0.12, 'bandpass', 2400, 900);
            this.world.sfx('growl');
          }
          break;
        case 'alert':
          this.vx = 0;
          if (this.t <= 0) {
            this.ai = 'lunge';
            this.t = 0.6;
            this.vx = this.dir * 130;
            this.vy = -150;
          }
          break;
        case 'lunge':
          if (this.t < 0.45 && this.onGround()) {
            this.ai = 'recover';
            this.t = 0.7;
          }
          break;
        case 'recover':
          this.vx = approach(this.vx, 0, 500 * dt);
          if (this.t <= 0) this.ai = 'walk';
          break;
      }
    }
    this.physics(dt, () => {
      if (this.ai !== 'lunge') this.dir = -this.dir as 1 | -1;
    });
    this.touchPlayer();
    this.anim.play(this.ai === 'alert' ? 'alert' : this.ai === 'lunge' ? 'lunge' : 'walk');
    this.anim.update(this.ai === 'recover' ? dt * 0.3 : dt);
  }

  private seesPlayer() {
    const p = this.world.player;
    return (
      p.alive &&
      Math.abs(p.bottom - this.bottom) < 18 &&
      Math.abs(p.cx - this.cx) < 76 &&
      this.world.lineOfSight(this.cx, this.cy - 2, p.cx, p.cy)
    );
  }

  draw(r: Renderer) {
    this.drawFrame(r, 'catacombs-crawler', this.anim.frame, this.cx, this.bottom, { flip: this.dir < 0 });
  }

  light() {
    const flicker = Math.sin(this.flick * 13) > 0.6 ? 1 : 0;
    return { x: this.cx + this.dir * -1, y: this.y - 3, r: (this.ai === 'alert' ? 36 : 26) + flicker };
  }
}

/** The shade's ghost orb: drifts through walls; slashed back, it homes in on the shade that threw it. */
class GhostOrb extends Bullet {
  constructor(
    world: World,
    x: number,
    y: number,
    vx: number,
    vy: number,
    private owner: Shade,
  ) {
    super(world, x, y, vx, vy, { sheet: 'catacombs-orb', anim: 'fly', ghost: true, reflectable: true, life: 6, size: 6 });
  }

  update(dt: number) {
    if (this.friendly && !this.owner.dead && this.owner.targetable) {
      const dx = this.owner.cx - this.cx;
      const dy = this.owner.cy - this.cy;
      const d = Math.hypot(dx, dy) || 1;
      const speed = Math.max(150, Math.hypot(this.vx, this.vy));
      this.vx = approach(this.vx, (dx / d) * speed, 900 * dt);
      this.vy = approach(this.vy, (dy / d) * speed, 900 * dt);
    }
    super.update(dt);
  }
}

/**
 * Shade — a hooded spirit haunting one hall. It blinks in near you, charges (eyes flare, orb
 * forming), fires a slow ghost orb that drifts through walls, then fades away. Struck, it flees
 * to another spot; reflecting its own orb back hits hardest.
 */
export class Shade extends Enemy {
  private ai: 'hidden' | 'appear' | 'hover' | 'charge' | 'fire' | 'vanish' = 'hidden';
  private t = 1.2;
  private bob = Math.random() * 6;
  private anim = new Anim('catacombs-shade', 'float');
  private home: { x: number; y: number };
  private shots = 0;

  constructor(
    world: World,
    x: number,
    y: number,
    /** How far from its spawn the shade haunts (px). */
    private range = 190,
  ) {
    super(world, x - 2, y - 8, 12, 16);
    this.hp = 4;
    this.souls = 5;
    this.knockback = 0;
    this.home = { x: this.x, y: this.y };
  }

  private get visible() {
    return this.ai !== 'hidden';
  }

  /** Can be hit right now (reflected orbs steer toward it). */
  get targetable() {
    return this.ai !== 'hidden' && this.ai !== 'appear';
  }

  hurtbox(): Rect {
    if (this.ai === 'hidden' || this.ai === 'appear') return { x: -9999, y: -9999, w: 0, h: 0 };
    return this;
  }

  protected onHurt() {
    // struck: flee in a puff instead of being knocked back
    this.stun = 0.15;
    this.ai = 'vanish';
    this.anim.play('vanish', true);
    this.t = 0.25;
    this.world.particles.burst(this.cx, this.cy, 10, { colors: [2, 1], speed: [20, 70], life: [0.3, 0.6] });
  }

  update(dt: number) {
    this.tick(dt);
    this.t -= dt;
    this.bob += dt;
    this.anim.update(dt);
    const p = this.world.player;
    switch (this.ai) {
      case 'hidden':
        if (this.t <= 0) {
          const near = p.alive && Math.hypot(p.cx - this.home.x, p.cy - this.home.y) < this.range;
          if (near && this.pickSpot()) {
            this.ai = 'appear';
            this.t = 0.34;
            this.anim.play('appear', true);
            this.world.game.audio.tone('sine', 900, 300, 0.35, 0.04);
          } else this.t = 0.5;
        }
        break;
      case 'appear':
        if (this.t <= 0) {
          this.ai = 'hover';
          this.t = 0.45;
          this.anim.play('float');
        }
        break;
      case 'hover':
        if (this.t <= 0) {
          if (this.shots >= 2) {
            this.ai = 'vanish';
            this.t = 0.25;
            this.anim.play('vanish', true);
          } else {
            this.ai = 'charge';
            this.t = 0.7;
            this.anim.play('charge');
            this.world.sfx('charge');
          }
        }
        break;
      case 'charge':
        if (Math.random() < dt * 20) {
          const a = rand(0, Math.PI * 2);
          this.world.particles.burst(this.orbX() + Math.cos(a) * 9, this.orbY() + Math.sin(a) * 9, 1, {
            colors: [3, 2],
            speed: [20, 30],
            angle: [a + Math.PI - 0.2, a + Math.PI + 0.2],
            life: [0.2, 0.35],
          });
        }
        if (this.t <= 0) {
          this.fire();
          this.ai = 'fire';
          this.t = 0.35;
          this.anim.play('fire');
        }
        break;
      case 'fire':
        if (this.t <= 0) {
          this.ai = 'hover';
          this.t = 0.9;
          this.anim.play('float');
        }
        break;
      case 'vanish':
        if (this.t <= 0) {
          this.ai = 'hidden';
          this.t = rand(0.9, 1.5);
          this.shots = 0;
          this.x = -9999;
        }
        break;
    }
    if (this.visible) {
      this.moveFree(0, Math.sin(this.bob * 2.4) * 6 * dt);
      if (this.ai !== 'vanish' && this.ai !== 'appear') this.touchPlayer({ x: this.x + 2, y: this.y + 2, w: this.w - 4, h: this.h - 4 });
    }
  }

  private facing(): 1 | -1 {
    return this.world.player.cx < this.cx ? -1 : 1;
  }

  private orbX() {
    return this.cx + this.facing() * 7;
  }

  private orbY() {
    return this.y + 1;
  }

  /** Choose an open spot around the player, inside this shade's haunt. */
  private pickSpot(): boolean {
    const p = this.world.player;
    for (let i = 0; i < 14; i++) {
      const a = rand(-Math.PI, 0) + (i % 2 ? Math.PI * 0.15 : -Math.PI * 0.15);
      const dist = rand(54, 84);
      const x = Math.round(p.cx + Math.cos(a) * dist - this.w / 2);
      const y = Math.round(p.cy + Math.sin(a) * dist * 0.7 - this.h / 2);
      if (Math.hypot(x - this.home.x, y - this.home.y) > this.range - 20) continue;
      if (this.world.solidAt(x - 4, y - 4, this.w + 8, this.h + 8)) continue;
      if (!this.world.lineOfSight(x + this.w / 2, y + this.h / 2, p.cx, p.cy)) continue;
      this.x = x;
      this.y = y;
      return true;
    }
    return false;
  }

  private fire() {
    const p = this.world.player;
    const ox = this.orbX();
    const oy = this.orbY();
    const dx = p.cx - ox;
    const dy = p.cy - oy;
    const d = Math.hypot(dx, dy) || 1;
    const speed = 50;
    this.world.add(new GhostOrb(this.world, ox, oy, (dx / d) * speed, (dy / d) * speed, this));
    this.shots++;
    eerie(this.world);
  }

  draw(r: Renderer) {
    if (!this.visible) return;
    const f = this.facing();
    this.drawFrame(r, 'catacombs-shade', this.anim.frame, this.cx, this.cy, { flip: f < 0 });
    if (this.ai === 'charge') {
      const k = 1 - Math.max(0, this.t) / 0.7;
      const s = k > 0.66 ? 'a' : k > 0.33 ? 'c' : null;
      if (s) r.sprite('catacombs-orb', s, this.orbX(), this.orbY());
      else r.rect(this.orbX() - 1, this.orbY() - 1, 2, 2, 3);
    }
  }

  light() {
    if (!this.visible) return null;
    if (this.ai === 'charge') return { x: this.orbX(), y: this.orbY(), r: 24 + Math.round((1 - Math.max(0, this.t) / 0.7) * 12) };
    return { x: this.cx, y: this.cy - 4, r: this.ai === 'appear' || this.ai === 'vanish' ? 14 : 22 };
  }
}

const BONE_G = 320;

/** Skeleton — keeps to its ledge and lobs spinning bones at you. Raises the bone and glares first. */
export class Skeleton extends Enemy {
  private ai: 'idle' | 'windup' | 'throw' = 'idle';
  private t = 1;
  private face: 1 | -1 = -1;
  private anim = new Anim('catacombs-skeleton', 'idle');

  constructor(world: World, x: number, y: number) {
    super(world, x - 1, y - 12, 10, 20);
    this.hp = 4;
    this.souls = 4;
    this.knockback = 0.2;
  }

  update(dt: number) {
    this.tick(dt);
    this.applyGravity(dt);
    this.t -= dt;
    this.anim.update(dt);
    const p = this.world.player;
    if (this.stun > 0) this.vx = approach(this.vx, 0, 600 * dt);
    else this.vx = 0;
    const near = p.alive && Math.abs(p.cx - this.cx) < 150 && Math.abs(p.cy - this.cy) < 100;
    const sees = near && this.aim() !== null;
    switch (this.ai) {
      case 'idle':
        if (sees) this.face = this.playerDir();
        if (sees && this.t <= 0 && this.stun <= 0) {
          this.ai = 'windup';
          this.t = 0.6;
          this.anim.play('windup');
          this.world.game.audio.noise(0.25, 0.1, 'bandpass', 3000, 1200);
        }
        break;
      case 'windup':
        if (this.t <= 0) {
          this.throwBone();
          this.ai = 'throw';
          this.t = 0.3;
          this.anim.play('throw');
        }
        break;
      case 'throw':
        if (this.t <= 0) {
          this.ai = 'idle';
          this.t = 1.5;
          this.anim.play('idle');
        }
        break;
    }
    this.physics(dt);
    this.touchPlayer();
  }

  /**
   * A lob that reaches the player without clipping terrain (it may arc up and over the edge
   * of the skeleton's own ledge). Tries flatter throws first. null = no clear throw.
   */
  private aim(): { vx: number; vy: number } | null {
    const p = this.world.player;
    const sx = this.cx + this.playerDir() * 4;
    const sy = this.y + 2;
    const dx = p.cx - sx;
    const dy = p.cy - sy;
    const base = clamp(Math.abs(dx) / 105, 0.55, 1.15);
    for (const time of [base, base * 1.3, base * 1.65]) {
      const vx = dx / time;
      const vy = (dy - 0.5 * BONE_G * time * time) / time;
      let clear = true;
      for (let k = 1; k < 24 && clear; k++) {
        const tt = (time * k) / 24;
        if (this.world.map.solidPoint(sx + vx * tt, sy + vy * tt + 0.5 * BONE_G * tt * tt)) clear = false;
      }
      if (clear) return { vx, vy };
    }
    return null;
  }

  private throwBone() {
    const v = this.aim();
    if (!v) return;
    this.world.add(new Bullet(this.world, this.cx + this.face * 4, this.y + 2, v.vx, v.vy, { sheet: 'catacombs-bone', anim: 'spin', gravity: BONE_G, size: 5, life: 3 }));
    this.world.sfx('shoot');
  }

  draw(r: Renderer) {
    this.drawFrame(r, 'catacombs-skeleton', this.anim.frame, this.cx, this.bottom, { flip: this.face < 0 });
  }

  light() {
    return { x: this.cx, y: this.y + 3, r: this.ai === 'windup' ? 26 : 12 };
  }
}

// ================================================================================================
// Light mechanics
// ================================================================================================

/** A bone brazier. Strike it to light it — it stays lit for good and floods its hall with light. */
export class Brazier extends Entity {
  readonly key: string;
  readonly group: string;
  private anim: Anim;
  private flare = 0;
  private flick = Math.random() * 10;

  constructor(world: World, x: number, y: number, o: SpawnOpts) {
    super(world, x - 2, y - 12, 12, 20);
    this.depth = -3;
    this.key = cellKey('brazier', x, y);
    this.group = String(o.group ?? '');
    this.anim = new Anim('catacombs-brazier', this.lit ? 'lit' : 'off');
    this.anim.t = Math.random();
  }

  get lit() {
    return this.world.hasFlag(this.key);
  }

  onSlash(_p: Player): boolean {
    if (!this.lit) this.ignite();
    else this.world.particles.burst(this.cx, this.y - 2, 5, { colors: [3, 2], speed: [20, 60], angle: [-2.6, -0.5] });
    return true;
  }

  private ignite() {
    const w = this.world;
    w.setFlag(this.key);
    this.anim.play('lit');
    this.flare = 0.6;
    w.shake(0.3);
    w.hitstop(0.08);
    w.game.audio.noise(0.6, 0.3, 'lowpass', 600, 3000);
    [392, 494, 587].forEach((f, i) => w.game.audio.tone('triangle', f, f, 0.5, 0.06, (w.game.audio.ctx?.currentTime ?? 0) + i * 0.08));
    w.particles.burst(this.cx, this.y - 2, 24, { colors: [3, 2], speed: [30, 120], angle: [-2.8, -0.3], life: [0.4, 0.9], grav: -60 });
  }

  update(dt: number) {
    this.anim.update(dt);
    this.flare = Math.max(0, this.flare - dt);
    this.flick += dt;
    if (this.lit && Math.random() < dt * 6)
      this.world.particles.burst(this.cx + rand(-3, 3), this.y - 4, 1, { colors: [3, 2], speed: [10, 25], angle: [-1.9, -1.2], life: [0.4, 0.8], grav: -20 });
  }

  drawBack(r: Renderer) {
    if (this.lit) r.halo(this.cx, this.y - 2, 24 + (Math.sin(this.flick * 9) > 0.7 ? 1 : 0), 1);
  }

  draw(r: Renderer) {
    r.sprite('catacombs-brazier', this.anim.frame, this.cx, this.bottom);
  }

  light() {
    if (!this.lit) return { x: this.cx, y: this.y + 2, r: 13 };
    const base = 86 + Math.round(this.flare * 40);
    return { x: this.cx, y: this.y - 2, r: base + (Math.sin(this.flick * 11) > 0.5 ? 2 : 0) };
  }
}

/**
 * A sealed tomb door (2 tiles wide, 4 tall; the map symbol is its bottom-left cell). One rune
 * lights for every burning brazier of its group; when all burn it grinds up into the ceiling.
 */
export class TombDoor extends Entity {
  private group: string;
  private key: string;
  private rise = 0;
  private opening = -1;
  private shownLit = 0;
  private primed = false;
  private baseY: number;

  constructor(world: World, x: number, y: number, o: SpawnOpts) {
    super(world, x, y - 24, 16, 32);
    this.baseY = this.y;
    this.depth = -6;
    this.group = String(o.group ?? '');
    this.key = `door:${ID}:${this.group}`;
    this.solid = true;
    if (world.hasFlag(this.key)) {
      this.rise = 32;
      this.solid = false;
    }
  }

  private braziers(): Brazier[] {
    return this.world.entities.filter((e): e is Brazier => e instanceof Brazier && e.group === this.group);
  }

  update(dt: number) {
    const list = this.braziers();
    const lit = list.filter((b) => b.lit).length;
    if (!this.primed) {
      this.primed = true;
      this.shownLit = lit;
    }
    if (lit > this.shownLit && this.rise === 0) {
      this.shownLit = lit;
      this.world.sfx('gate');
      this.world.particles.burst(this.x + 8, this.y + 16, 8, { colors: [3, 2], speed: [10, 40], life: [0.3, 0.6] });
    }
    if (this.rise === 0 && this.opening < 0 && list.length > 0 && lit === list.length) {
      this.opening = 0.8;
      this.world.setFlag(this.key);
    }
    if (this.opening >= 0 && this.rise < 32) {
      if (this.opening > 0) {
        this.opening = Math.max(0, this.opening - dt);
        return;
      }
      if (this.rise === 0) {
        this.world.sfx('slam');
        this.world.ui.title('THE TOMB OPENS');
      }
      this.rise = Math.min(32, this.rise + dt * 22);
      this.y = Math.round(this.baseY - this.rise);
      this.world.shake(0.12);
      if (Math.random() < dt * 30)
        this.world.particles.burst(this.x + rand(0, 16), this.baseY + 31, 1, { colors: [2, 1], speed: [10, 40], angle: [-2.8, -0.3], grav: 200 });
      if (this.rise > 18) this.solid = false;
    }
  }

  interact() {
    const n = this.braziers().length;
    if (this.rise === 0)
      this.world.ui.say('', [
        `${n === 1 ? 'ONE COLD BRAZIER HOLDS' : `${['NO', 'ONE', 'TWO', 'THREE'][n] ?? n} COLD BRAZIERS HOLD`} THIS TOMB SHUT.`,
        'STRIKE THEM TO LIGHT THEM. EACH FLAME WAKES A RUNE.',
      ]);
  }

  drawBack(r: Renderer) {
    if (this.rise >= 32) return;
    const n = Math.min(3, Math.max(1, this.braziers().length));
    const lit = Math.min(n, this.braziers().filter((b) => b.lit).length);
    r.sprite('catacombs-door', `s${n}l${lit}`, this.x, this.y + 32);
  }

  light() {
    if (this.rise >= 32) return null;
    return { x: this.x + 8, y: this.y + 20, r: 16 + this.shownLit * 6 };
  }
}

/** A drifting glow spore: lights the dark for a few seconds, settles where it touches stone. */
export class Spore extends Entity {
  private t = 0;
  private life: number;
  private phase = Math.random() * 6;
  private anim = new Anim('catacombs-spore', 'glow');

  constructor(
    world: World,
    x: number,
    y: number,
    vx: number,
    vy: number,
    private cruise: { x: number; y: number },
  ) {
    super(world, x - 1, y - 1, 2, 2);
    this.vx = vx;
    this.vy = vy;
    this.depth = 14;
    this.life = rand(9, 11.5);
    this.anim.t = Math.random();
  }

  update(dt: number) {
    this.t += dt;
    this.anim.update(dt);
    if (this.t > this.life) {
      this.removed = true;
      return;
    }
    const wob = Math.sin(this.t * 2.2 + this.phase) * 6;
    this.vx = approach(this.vx, this.cruise.x, 5 * dt);
    this.vy = approach(this.vy, this.cruise.y, 5 * dt);
    this.moveX(this.vx * dt, () => (this.vx = 0));
    this.moveY((this.vy + wob) * dt, () => (this.vy = 0));
  }

  private fade() {
    return Math.min(1, (this.life - this.t) / 1.5, this.t / 0.3);
  }

  draw(r: Renderer) {
    if (this.fade() < 1 && Math.floor(this.t * 20) % 3 === 0) return;
    r.sprite('catacombs-spore', this.anim.frame, this.cx, this.cy);
  }

  light() {
    return { x: this.cx, y: this.cy, r: Math.max(4, Math.round(26 * this.fade())) };
  }
}

/** Lumen pod: strike it and it bursts into a stream of glowing spores. Regrows after a while. */
export class LumenPod extends Entity {
  private regrow = 0;
  private dir: { x: number; y: number };
  private anim = new Anim('catacombs-pod', 'idle');
  private t = Math.random() * 6;

  constructor(world: World, x: number, y: number, o: SpawnOpts) {
    super(world, x - 1, y - 2, 10, 10);
    this.depth = -3;
    const d = String(o.dir ?? 'r');
    this.dir = d === 'l' ? { x: -1, y: 0 } : d === 'u' ? { x: 0, y: -1 } : { x: 1, y: 0 };
  }

  onSlash(): boolean {
    if (this.regrow > 0) return false;
    this.burst();
    return true;
  }

  private burst() {
    const w = this.world;
    this.regrow = 12;
    this.anim.play('spent');
    for (let i = 0; i < 9; i++) {
      const sp = rand(14, 34);
      const up = this.dir.y !== 0;
      const vx = up ? rand(-14, 14) : this.dir.x * sp;
      const vy = up ? -sp : rand(-16, -2);
      // spores fan out, then cruise steadily along the pod's direction for ~10 s
      const cruise = up ? { x: rand(-3, 3), y: -rand(9, 17) } : { x: this.dir.x * rand(8, 17), y: -rand(0, 2) };
      w.add(new Spore(w, this.cx + rand(-3, 3), this.y + 3 + rand(-2, 2), vx, vy, cruise));
    }
    w.particles.burst(this.cx, this.y + 3, 14, { colors: [3, 2], speed: [20, 80], life: [0.3, 0.7] });
    w.game.audio.noise(0.4, 0.15, 'highpass', 1500, 6000);
    [784, 988, 1175].forEach((f, i) => w.game.audio.tone('sine', f, f, 0.6, 0.04, (w.game.audio.ctx?.currentTime ?? 0) + i * 0.06));
  }

  update(dt: number) {
    this.t += dt;
    this.anim.update(dt);
    if (this.regrow > 0) {
      this.regrow -= dt;
      if (this.regrow <= 0) {
        this.anim.play('idle');
        this.world.particles.burst(this.cx, this.y + 3, 6, { colors: [2, 3], speed: [5, 20] });
      }
    }
  }

  draw(r: Renderer) {
    r.sprite('catacombs-pod', this.anim.frame, this.cx, this.bottom);
  }

  light() {
    if (this.regrow > 0) return null;
    return { x: this.cx, y: this.y + 3, r: 17 + Math.round(Math.sin(this.t * 3) * 2) };
  }
}

/** A firefly: idles where it was found, then follows you around and widens your light. */
export class Firefly extends Entity {
  private following = false;
  private t = Math.random() * 10;
  private home: { x: number; y: number };
  private slot: number;
  private anim = new Anim('catacombs-firefly', 'buzz');
  private fx: number;
  private fy: number;

  constructor(world: World, x: number, y: number) {
    super(world, x + 3, y + 3, 2, 2);
    this.depth = 12;
    this.home = { x: this.x, y: this.y };
    this.fx = this.x;
    this.fy = this.y;
    this.slot = world.entities.filter((e) => e instanceof Firefly).length;
  }

  update(dt: number) {
    this.t += dt;
    this.anim.update(dt);
    const p = this.world.player;
    let tx: number;
    let ty: number;
    if (!this.following) {
      tx = this.home.x + Math.sin(this.t * 1.3) * 6;
      ty = this.home.y + Math.sin(this.t * 2.1) * 4;
      if (p.alive && Math.hypot(p.cx - this.fx, p.cy - this.fy) < 30) {
        this.following = true;
        this.world.sfx('refill');
        this.world.particles.burst(this.fx, this.fy, 8, { colors: [3, 2], speed: [10, 40] });
      }
    } else {
      const a = this.t * 1.7 + this.slot * 2.1;
      tx = p.cx - p.facing * 9 + Math.cos(a) * 7;
      ty = p.y - 9 + Math.sin(a * 1.3) * 4;
    }
    const k = Math.min(1, dt * (this.following ? 4 : 3));
    this.fx += (tx - this.fx) * k;
    this.fy += (ty - this.fy) * k;
    this.x = Math.round(this.fx);
    this.y = Math.round(this.fy);
  }

  draw(r: Renderer) {
    r.sprite('catacombs-firefly', this.anim.frame, this.x, this.y, { flip: this.world.player.cx < this.x });
  }

  light() {
    const pulse = Math.sin(this.t * 5) > 0.85 ? 2 : 0;
    return { x: this.x, y: this.y, r: (this.following ? 58 : 22) + pulse };
  }
}

/** Invisible light that makes a hazard glimmer (spawned for every stretch of bile and bone shards). */
class Glimmer extends Entity {
  private phase: number;

  constructor(
    world: World,
    x: number,
    y: number,
    private r: number,
  ) {
    super(world, x, y, 1, 1);
    this.phase = Math.random() * 6;
  }

  light() {
    return { x: this.x, y: this.y, r: this.r + Math.round(Math.sin(this.world.time * 2 + this.phase) * 2) };
  }
}

/** Scans the map once and lights every run of bile and bone shards, so no hazard is ever hidden. */
function hazardGlimmers(world: World): Entity[] {
  const out: Entity[] = [];
  const { map } = world;
  const runs = (isHazard: (tx: number, ty: number) => boolean, every: number, r: number, dy: number) => {
    for (let ty = 0; ty < map.h; ty++) {
      let start = -1;
      for (let tx = 0; tx <= map.w; tx++) {
        const on = tx < map.w && isHazard(tx, ty);
        if (on && start < 0) start = tx;
        if (!on && start >= 0) {
          const len = tx - start;
          const n = Math.max(1, Math.round(len / every));
          for (let i = 0; i < n; i++) {
            const cx = (start + ((i + 0.5) * len) / n) * TILE;
            out.push(new Glimmer(world, cx, ty * TILE + dy, r));
          }
          start = -1;
        }
      }
    }
  };
  // bile: only its surface row
  runs((tx, ty) => map.get(tx, ty) === T.Acid && map.get(tx, ty - 1) !== T.Acid, 4, 20, 1);
  runs((tx, ty) => map.get(tx, ty) === T.SpikeUp, 3, 13, 5);
  runs((tx, ty) => map.get(tx, ty) === T.SpikeDown, 3, 13, 3);
  // wall spikes: scan columns instead of rows
  for (const kind of [T.SpikeLeft, T.SpikeRight]) {
    for (let tx = 0; tx < map.w; tx++) {
      let start = -1;
      for (let ty = 0; ty <= map.h; ty++) {
        const on = ty < map.h && map.get(tx, ty) === kind;
        if (on && start < 0) start = ty;
        if (!on && start >= 0) {
          const len = ty - start;
          const n = Math.max(1, Math.round(len / 3));
          for (let i = 0; i < n; i++) out.push(new Glimmer(world, tx * TILE + 4, (start + ((i + 0.5) * len) / n) * TILE, 13));
          start = -1;
        }
      }
    }
  }
  return out;
}

// ================================================================================================
// Props
// ================================================================================================

/** Glowcap: a springy luminous mushroom that bounces you high. */
export class Glowcap extends Entity {
  private squash = 0;
  private t = Math.random() * 6;
  private anim = new Anim('catacombs-shroom', 'idle');
  private power: number;

  constructor(world: World, x: number, y: number, o: SpawnOpts) {
    super(world, x - 3, y - 3, 14, 6);
    this.depth = -1;
    this.power = Number(o.power ?? 270);
  }

  update(dt: number) {
    this.t += dt;
    this.squash -= dt;
    this.anim.update(dt);
    const p = this.world.player;
    if (p.alive && p.vy >= 0 && p.bottom <= this.y + 5 && overlaps(this, p)) {
      p.bounce(-this.power);
      this.squash = 0.22;
      this.world.game.audio.tone('sine', 180, 560, 0.2, 0.12);
      this.world.game.audio.tone('triangle', 260, 760, 0.16, 0.05);
      this.world.particles.burst(this.cx, this.y, 10, { colors: [3, 2], speed: [20, 70], angle: [-Math.PI, 0], life: [0.3, 0.7], grav: -30 });
    }
  }

  draw(r: Renderer) {
    const f = this.squash > 0.1 ? 'squash' : this.squash > 0 ? 'stretch' : this.anim.frame;
    r.sprite('catacombs-shroom', f, this.cx, this.y + 11);
  }

  light() {
    return { x: this.cx, y: this.y + 2, r: 24 + Math.round(Math.sin(this.t * 2.5) * 2) + (this.squash > 0 ? 10 : 0) };
  }
}

/** Bone bridge: lashed bones that shake, then drop 0.45 s after you touch them, and re-knit later. */
export class BoneBridge extends Entity {
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
        this.world.game.audio.noise(0.12, 0.1, 'bandpass', 1800, 700);
      }
    } else if (this.state === 'shake' && this.t <= 0) {
      this.state = 'gone';
      this.solid = false;
      this.t = 2.4;
      this.world.particles.burst(this.cx, this.cy, 8, { colors: [2, 1, 3], speed: [10, 50], grav: 400, life: [0.4, 0.8], size: [1, 2] });
    } else if (this.state === 'gone' && this.t <= 0 && !overlaps(this, p)) {
      this.state = 'idle';
      this.solid = true;
      this.world.particles.burst(this.cx, this.cy, 4, { colors: [2], speed: [5, 20] });
    }
  }

  draw(r: Renderer) {
    if (this.state === 'gone') return;
    const jitter = this.state === 'shake' ? Math.round(Math.sin(this.t * 90)) : 0;
    r.sprite('catacombs-bonebridge', this.state === 'shake' ? (Math.floor(this.t * 12) % 2 ? 'b' : 'c') : 'a', this.x + jitter, this.y);
  }
}

/** Burial urn: shatter it for souls. Stays broken. */
export class Urn extends Entity {
  private key: string;
  private hits = 0;
  private wobble = 0;

  constructor(world: World, x: number, y: number) {
    super(world, x, y - 3, 8, 11);
    this.depth = -2;
    this.key = cellKey('urn', x, y);
  }

  onSlash(_p: Player, dx: number): boolean {
    this.hits++;
    this.wobble = 0.2 * (dx || 1);
    this.world.sfx('hit');
    if (this.hits >= 2) {
      this.removed = true;
      this.world.setFlag(this.key);
      this.world.sfx('break');
      this.world.particles.burst(this.cx, this.cy, 14, { colors: [2, 1], speed: [40, 120], grav: 400, bounce: true, life: [0.5, 1], size: [1, 2] });
      this.world.spawnSouls(this.cx, this.cy, 2);
    }
    return true;
  }

  update(dt: number) {
    this.wobble = approach(this.wobble, 0, dt);
  }

  draw(r: Renderer) {
    const j = this.wobble !== 0 ? Math.round(Math.sin(this.wobble * 80)) : 0;
    r.sprite('catacombs-urn', this.hits > 0 ? 'b' : 'a', this.cx + j, this.bottom);
  }
}

/** Gloomroot NPC: like the shared NPC, plus a light of its own and flag-gated appearances. */
export class CatNpc extends Entity {
  private anim: Anim;
  private talking = false;
  private faceLeft = false;
  private t = Math.random() * 6;
  private homeX: number;
  private homeY: number;

  constructor(
    world: World,
    x: number,
    y: number,
    private o: {
      sheet: string;
      name: string;
      lines: string[];
      alt?: { flag: string; lines: string[] }[];
      light?: number;
      bob?: boolean;
      /** Only present once this flag is set / until this flag is set. */
      showFlag?: string;
      hideFlag?: string;
    },
  ) {
    super(world, x - 4, y - 12, 16, 20);
    this.depth = -1;
    this.homeX = this.x;
    this.homeY = this.y;
    this.anim = new Anim(o.sheet, 'idle');
  }

  private get present() {
    const w = this.world;
    if (this.o.showFlag && !w.hasFlag(this.o.showFlag)) return false;
    if (this.o.hideFlag && w.hasFlag(this.o.hideFlag)) return false;
    return true;
  }

  update(dt: number) {
    this.t += dt;
    const was = this.x === this.homeX;
    // off-stage when absent, so it can't be talked to
    this.x = this.present ? this.homeX : -9999;
    this.y = this.homeY;
    if (!was && this.x === this.homeX) this.world.particles.burst(this.cx, this.cy, 16, { colors: [3, 2], speed: [20, 60], life: [0.4, 0.8] });
    const p = this.world.player;
    if (Math.abs(p.cx - this.cx) < 60) this.faceLeft = p.cx < this.cx;
    this.anim.play(this.talking ? 'talk' : 'idle');
    this.anim.update(dt);
  }

  interact() {
    const lines = this.o.alt?.find((a) => this.world.hasFlag(a.flag))?.lines ?? this.o.lines;
    this.talking = true;
    this.world.ui.say(this.o.name, lines, () => (this.talking = false));
  }

  draw(r: Renderer) {
    if (!this.present) return;
    const bob = this.o.bob ? Math.round(Math.sin(this.t * 2.2) * 1.5) - 1 : 0;
    r.sprite(this.o.sheet, this.anim.frame, this.cx, this.bottom + bob, { flip: this.faceLeft });
  }

  light() {
    if (!this.present || !this.o.light) return null;
    return { x: this.cx, y: this.y + 6, r: this.o.light };
  }
}

/** Ceiling decor (roots, glow-worms) whose light sits below the ceiling instead of inside it. */
export class HangingDecor extends Decor {
  private glow: number;

  constructor(world: World, x: number, y: number, o: DecorOpts) {
    super(world, x, y, { ...o, anchor: 'ceiling', light: undefined });
    this.glow = o.light ?? 0;
  }

  light() {
    return this.glow ? { x: this.x, y: this.y + 14, r: this.glow + (Math.sin(this.world.time * 1.7 + this.x) > 0.8 ? 1 : 0) } : null;
  }
}

// ================================================================================================

registerEntity(`${ID}:bat`, (w, x, y) => new Bat(w, x, y));
registerEntity(`${ID}:crawler`, (w, x, y) => new Crawler(w, x, y));
registerEntity(`${ID}:shade`, (w, x, y, o) => new Shade(w, x, y, o.range === undefined ? undefined : Number(o.range)));
registerEntity(`${ID}:skeleton`, (w, x, y) => new Skeleton(w, x, y));
registerEntity(`${ID}:brazier`, (w, x, y, o) => new Brazier(w, x, y, o));
registerEntity(`${ID}:door`, (w, x, y, o) => new TombDoor(w, x, y, o));
registerEntity(`${ID}:pod`, (w, x, y, o) => new LumenPod(w, x, y, o));
registerEntity(`${ID}:firefly`, (w, x, y) => new Firefly(w, x, y));
registerEntity(`${ID}:glimmers`, (w) => hazardGlimmers(w));
registerEntity(`${ID}:glowcap`, (w, x, y, o) => new Glowcap(w, x, y, o));
registerEntity(`${ID}:bonebridge`, (w, x, y) => new BoneBridge(w, x, y));
registerEntity(`${ID}:urn`, (w, x, y) => (w.hasFlag(cellKey('urn', x, y)) ? undefined : new Urn(w, x, y)));
registerEntity(`${ID}:hang`, (w, x, y, o) => new HangingDecor(w, x, y, o as unknown as DecorOpts));
registerEntity(`${ID}:npc`, (w, x, y, o) => new CatNpc(w, x, y, o as unknown as ConstructorParameters<typeof CatNpc>[3]));
