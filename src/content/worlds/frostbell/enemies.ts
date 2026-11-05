import { approach, clamp, overlaps, type Rect } from '../../../engine/math';
import type { Renderer } from '../../../engine/renderer';
import { Anim } from '../../../engine/sprites';
import { T } from '../../../engine/tilemap';
import { Bullet } from '../../../game/common/bullet';
import { Enemy } from '../../../game/enemy';
import { Entity } from '../../../game/entity';
import type { Player } from '../../../game/player';
import { registerEntity } from '../../../game/registry';
import type { World } from '../../../game/world';
import './sprites';

/**
 * Frost owl — perches on a ledge, mantles its wings and screeches (telegraph), then swoops
 * down through your position in a U-shaped arc and flaps back to its perch.
 */
export class FrostOwl extends Enemy {
  private ai: 'perch' | 'alert' | 'swoop' | 'hover' | 'return' = 'perch';
  private t = 0;
  private cool = 0.6;
  private anim = new Anim('frostbell-owl', 'perch');
  private home: { x: number; y: number };
  private pos: { x: number; y: number };
  private arc = { sx: 0, sy: 0, cx: 0, cy: 0, ex: 0, ey: 0, dur: 1 };
  private u = 0;
  private face: 1 | -1 = 1;

  constructor(world: World, x: number, y: number) {
    super(world, x - 1, y - 4, 10, 12);
    this.hp = 2;
    this.souls = 2;
    this.knockback = 0.9;
    this.home = { x: this.cx, y: this.cy };
    this.pos = { ...this.home };
  }

  private place() {
    this.x = Math.round(this.pos.x - this.w / 2);
    this.y = Math.round(this.pos.y - this.h / 2);
  }

  private bez(u: number) {
    const a = this.arc;
    const k = 1 - u;
    return {
      x: k * k * a.sx + 2 * u * k * a.cx + u * u * a.ex,
      y: k * k * a.sy + 2 * u * k * a.cy + u * u * a.ey,
    };
  }

  /** Spot the player from its head, or leaning out past the perch edge on the player's side. */
  private sees(dx: number) {
    const p = this.world.player;
    const lean = dx < 0 ? -16 : 16;
    return this.clearPath(this.cx, this.y - 2, p.cx, p.cy) || this.clearPath(this.cx + lean, this.y + 2, p.cx, p.cy);
  }

  /** Line of sight that ignores the first few pixels (the perch under the owl's feet). */
  private clearPath(x0: number, y0: number, x1: number, y1: number) {
    const d = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.ceil(d / 4);
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      if (t * d < 10) continue;
      if (this.world.map.solidPoint(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)) return false;
    }
    return true;
  }

  /** Plan an arc through the player; falls back to a V-dive, or gives up if terrain is in the way. */
  private planSwoop(): boolean {
    const p = this.world.player;
    const tx = p.cx + p.vx * 0.12;
    const ty = p.cy;
    const s = { x: this.pos.x, y: this.pos.y };
    const ends = [
      { x: 2 * tx - s.x, y: s.y },
      { x: tx + (tx - s.x) * 0.5, y: (s.y + ty) / 2 },
      { x: s.x, y: s.y },
    ];
    for (const e of ends) {
      const cx = 2 * tx - (s.x + e.x) / 2;
      const cy = 2 * ty - (s.y + e.y) / 2;
      this.arc = { sx: s.x, sy: s.y, cx, cy, ex: e.x, ey: e.y, dur: 1 };
      let clear = true;
      for (let i = 1; i <= 20 && clear; i++) {
        const q = this.bez(i / 20);
        // ignore the owl's own perch right under its feet
        if (Math.hypot(q.x - s.x, q.y - s.y) < 14) continue;
        if (this.world.solidAt(Math.round(q.x - 3), Math.round(q.y - 3), 6, 6)) clear = false;
      }
      if (!clear) continue;
      const len = Math.hypot(tx - s.x, ty - s.y) + Math.hypot(e.x - tx, e.y - ty);
      this.arc.dur = clamp(len / 170 + 0.2, 0.6, 1.3);
      return true;
    }
    return false;
  }

  update(dt: number) {
    this.tick(dt);
    this.t -= dt;
    this.cool -= dt;
    const p = this.world.player;
    if (this.stun > 0) {
      // knocked about (or dazed by a bell): drift, then head home
      this.vx = approach(this.vx, 0, 400 * dt);
      this.vy = approach(this.vy, 0, 400 * dt);
      this.pos.x += this.vx * dt;
      this.pos.y += this.vy * dt + Math.sin(this.world.time * 20) * 0.3;
      if (this.ai !== 'perch') this.ai = 'return';
      else if (Math.hypot(this.pos.x - this.home.x, this.pos.y - this.home.y) > 2) this.ai = 'return';
    } else {
      switch (this.ai) {
        case 'perch': {
          this.pos = { ...this.home };
          const dx = p.cx - this.cx;
          const dy = p.cy - this.cy;
          if (this.cool <= 0 && p.alive && Math.abs(dx) < 120 && dy > -20 && dy < 130 && this.sees(dx)) {
            this.ai = 'alert';
            this.t = 0.55;
            this.face = dx < 0 ? -1 : 1;
            const a = this.world.game.audio;
            a.tone('square', 760, 1250, 0.16, 0.035);
            a.tone('sawtooth', 1300, 700, 0.3, 0.025);
          }
          break;
        }
        case 'alert':
          this.face = p.cx < this.cx ? -1 : 1;
          if (this.t <= 0) {
            if (p.alive && this.planSwoop()) {
              this.ai = 'swoop';
              this.u = 0;
              this.world.game.audio.noise(0.35, 0.12, 'bandpass', 1800, 500);
            } else {
              this.ai = 'perch';
              this.cool = 1;
            }
          }
          break;
        case 'swoop': {
          this.u = Math.min(1, this.u + dt / this.arc.dur);
          const q = this.bez(this.u);
          this.face = q.x < this.pos.x ? -1 : q.x > this.pos.x ? 1 : this.face;
          this.pos = q;
          if (Math.random() < dt * 25)
            this.world.particles.burst(this.pos.x, this.pos.y, 1, { colors: [1, 2], speed: [5, 20], life: [0.2, 0.5] });
          if (this.u >= 1) {
            this.ai = 'hover';
            this.t = 0.45;
          }
          break;
        }
        case 'hover':
          this.pos.y += Math.sin(this.world.time * 9) * 0.4;
          if (this.t <= 0) this.ai = 'return';
          break;
        case 'return': {
          const dx = this.home.x - this.pos.x;
          const dy = this.home.y - this.pos.y;
          const d = Math.hypot(dx, dy);
          if (d < 2) {
            this.pos = { ...this.home };
            this.ai = 'perch';
            this.cool = 1.3;
          } else {
            const sp = Math.min(d / dt, 72);
            this.pos.x += (dx / d) * sp * dt;
            this.pos.y += (dy / d) * sp * dt + Math.sin(this.world.time * 9) * 0.25;
            if (Math.abs(dx) > 1) this.face = dx < 0 ? -1 : 1;
          }
          break;
        }
      }
    }
    this.place();
    this.touchPlayer({ x: this.x + 1, y: this.y + 2, w: this.w - 2, h: this.h - 3 });
    const anim =
      this.ai === 'alert' ? 'alert' : this.ai === 'swoop' ? 'swoop' : this.ai === 'perch' && this.stun <= 0 ? 'perch' : 'fly';
    this.anim.play(anim);
    this.anim.update(dt);
  }

  draw(r: Renderer) {
    const lift = this.ai === 'alert' ? -1 : 0;
    this.drawFrame(r, 'frostbell-owl', this.anim.frame, this.cx, this.bottom + lift, { flip: this.face < 0 });
  }
}

/**
 * Yeti cub — pads back and forth on its ledge. When it spots you it hoists a snowball over
 * its head (telegraph) and lobs it in an arc. Slash the snowball to send it back.
 */
export class Yeti extends Enemy {
  private ai: 'walk' | 'windup' | 'throw' | 'cool' = 'walk';
  private dir: 1 | -1 = -1;
  private t = 0.8;
  private homeX: number;
  private anim = new Anim('frostbell-yeti', 'walk');

  constructor(world: World, x: number, y: number) {
    super(world, x - 2, y - 5, 12, 13);
    this.hp = 4;
    this.souls = 3;
    this.knockback = 0.6;
    this.homeX = this.cx;
  }

  private sees() {
    const p = this.world.player;
    return (
      p.alive &&
      Math.abs(p.cx - this.cx) < 150 &&
      p.cy - this.cy < 90 &&
      p.cy - this.cy > -110 &&
      this.world.lineOfSight(this.cx, this.y, p.cx, p.cy)
    );
  }

  update(dt: number) {
    this.tick(dt);
    this.applyGravity(dt);
    this.t -= dt;
    if (this.stun > 0) {
      this.vx = approach(this.vx, 0, 400 * dt);
      if (this.ai === 'windup') this.ai = 'cool';
    } else {
      switch (this.ai) {
        case 'walk': {
          this.vx = this.dir * 20;
          const far = (this.cx - this.homeX) * this.dir > 44;
          if (this.onGround() && (this.wallAhead(this.dir) || !this.groundAhead(this.dir) || far)) this.dir = -this.dir as 1 | -1;
          if (this.t <= 0 && this.sees()) {
            this.ai = 'windup';
            this.t = 0.6;
            this.vx = 0;
            this.dir = this.playerDir();
            this.world.sfx('growl');
          }
          break;
        }
        case 'windup':
          this.vx = 0;
          this.dir = this.playerDir();
          if (this.t <= 0) {
            this.throwBall();
            this.ai = 'throw';
            this.t = 0.3;
          }
          break;
        case 'throw':
          this.vx = 0;
          if (this.t <= 0) {
            this.ai = 'cool';
            this.t = 1.1;
          }
          break;
        case 'cool':
          this.vx = 0;
          if (this.t <= 0) {
            this.ai = 'walk';
            this.t = 0.5;
          }
          break;
      }
    }
    this.physics(dt);
    this.touchPlayer();
    this.anim.play(this.ai === 'walk' ? 'walk' : this.ai === 'windup' ? 'windup' : this.ai === 'throw' ? 'throw' : 'idle');
    this.anim.update(dt);
  }

  private throwBall() {
    const p = this.world.player;
    const g = 360;
    const sx = this.cx + this.dir * 5;
    const sy = this.y - 2;
    const dx = p.cx + p.vx * 0.2 - sx;
    const dy = p.cy - sy;
    const T = clamp(Math.abs(dx) / 115, 0.5, 1.15);
    const vx = dx / T;
    const vy = clamp((dy - 0.5 * g * T * T) / T, -290, 40);
    this.world.add(
      new Bullet(this.world, sx, sy, vx, vy, { sheet: 'frostbell-snowball', anim: 'spin', gravity: g, life: 3, size: 5 }),
    );
    this.world.game.audio.noise(0.1, 0.14, 'lowpass', 900, 200);
    this.world.game.audio.tone('square', 300, 520, 0.08, 0.03);
  }

  draw(r: Renderer) {
    this.drawFrame(r, 'frostbell-yeti', this.anim.frame, this.cx, this.bottom, { flip: this.dir < 0 });
  }
}

/** Ice bat — hangs from a ceiling until you come close, shivers awake, then flutters after you. */
export class IceBat extends Enemy {
  private ai: 'roost' | 'wake' | 'fly' | 'return' = 'roost';
  private t = 0;
  private chase = 0;
  private retreat = 0;
  private home: { x: number; y: number };
  private anim = new Anim('frostbell-bat', 'hang');
  private seed = Math.random() * 10;

  constructor(world: World, x: number, y: number) {
    super(world, x, y, 8, 7);
    this.hp = 1;
    this.souls = 1;
    this.knockback = 1.3;
    this.home = { x: this.x, y: this.y };
  }

  update(dt: number) {
    this.tick(dt);
    this.t -= dt;
    const p = this.world.player;
    const dx = p.cx - this.cx;
    const dy = p.cy - this.cy;
    const d = Math.hypot(dx, dy) || 1;
    if (this.stun > 0) {
      this.vx = approach(this.vx, 0, 300 * dt);
      this.vy = approach(this.vy, 30, 300 * dt);
      if (this.ai === 'roost' || this.ai === 'wake') this.ai = 'fly';
    } else {
      switch (this.ai) {
        case 'roost':
          this.vx = this.vy = 0;
          if (p.alive && d < 80 && this.world.lineOfSight(this.cx, this.cy + 4, p.cx, p.cy)) {
            this.ai = 'wake';
            this.t = 0.45;
            this.world.game.audio.tone('square', 1800, 2400, 0.06, 0.03);
          }
          break;
        case 'wake':
          if (this.t <= 0) {
            this.ai = 'fly';
            this.chase = 7;
            this.vy = 40;
          }
          break;
        case 'fly': {
          this.chase -= dt;
          this.retreat -= dt;
          const tw = this.world.time * 6 + this.seed;
          if (this.retreat > 0) {
            // after a bite, flutter up and away before diving again
            this.vx = approach(this.vx, (-dx / d) * 70, 300 * dt);
            this.vy = approach(this.vy, -40, 300 * dt);
          } else {
            this.vx = approach(this.vx, (dx / d) * 58, 160 * dt);
            this.vy = approach(this.vy, (dy / d) * 50 + Math.sin(tw) * 45, 220 * dt);
          }
          if (this.retreat <= 0 && p.alive && overlaps(this, p)) this.retreat = 0.9;
          if (!p.alive || this.chase <= 0 || d > 230) this.ai = 'return';
          break;
        }
        case 'return': {
          const hx = this.home.x - this.x;
          const hy = this.home.y - this.y;
          const hd = Math.hypot(hx, hy);
          if (hd < 2) {
            this.x = this.home.x;
            this.y = this.home.y;
            this.ai = 'roost';
            this.t = 1;
          } else {
            this.vx = (hx / hd) * 50;
            this.vy = (hy / hd) * 50;
          }
          if (p.alive && d < 70 && this.t <= 0) {
            this.ai = 'fly';
            this.chase = 5;
          }
          break;
        }
      }
    }
    if (this.ai === 'return') this.moveFree(this.vx * dt, this.vy * dt);
    else if (this.ai !== 'roost' && this.ai !== 'wake') {
      this.moveX(this.vx * dt, () => (this.vx *= -0.5));
      this.moveY(this.vy * dt, () => (this.vy *= -0.5));
    }
    if (this.ai === 'fly' || this.ai === 'return') this.touchPlayer();
    this.anim.play(this.ai === 'roost' ? 'hang' : this.ai === 'wake' ? 'wake' : 'fly');
    this.anim.update(dt);
  }

  draw(r: Renderer) {
    const hanging = this.ai === 'roost' || this.ai === 'wake';
    const jit = this.ai === 'wake' ? Math.round(Math.sin(this.world.time * 60)) : 0;
    this.drawFrame(r, 'frostbell-bat', this.anim.frame, this.cx + jit, hanging ? this.y + 5 : this.cy, { flip: this.vx < 0 });
  }
}

/**
 * Falling icicle — a big icicle under a ceiling. Walk beneath it and it cracks (telegraph),
 * then drops. Strike it while it falls to shatter it (and pogo off it). It grows back.
 */
export class FallingIcicle extends Entity {
  private state: 'hang' | 'shake' | 'fall' | 'gone' | 'grow' = 'hang';
  private t = 0;
  private anchorY: number;
  private anim = new Anim('frostbell-icicle', 'hang');

  constructor(world: World, x: number, y: number) {
    super(world, x + 2, y, 4, 11);
    this.depth = 4;
    this.anchorY = y;
  }

  private triggered(p: Player) {
    return (
      p.alive &&
      Math.abs(p.cx - this.cx) < 22 &&
      p.y > this.bottom - 2 &&
      p.y - this.y < 160 &&
      this.world.lineOfSight(this.cx, this.bottom + 1, p.cx, p.y + 2)
    );
  }

  update(dt: number) {
    const p = this.world.player;
    this.t -= dt;
    this.anim.update(dt);
    switch (this.state) {
      case 'hang':
        if (this.triggered(p)) {
          this.state = 'shake';
          this.t = 0.42;
          this.anim.play('shake');
          this.world.game.audio.tone('triangle', 2600, 1900, 0.09, 0.03);
          this.world.game.audio.noise(0.12, 0.05, 'highpass', 5000, 3000);
        }
        break;
      case 'shake':
        if (Math.random() < dt * 20) this.world.particles.burst(this.cx, this.y + 1, 1, { colors: [2, 1], speed: [5, 15], angle: [1.2, 1.9], grav: 200 });
        if (this.t <= 0) this.drop();
        break;
      case 'fall': {
        this.vy = approach(this.vy, 340, 950 * dt);
        this.moveFree(0, this.vy * dt);
        const tipY = this.bottom;
        const hitGround =
          this.world.solidAt(this.x, tipY - 2, this.w, 2) || this.world.map.at(this.cx, tipY - 1) === T.OneWay || this.y > this.world.map.ph;
        if (p.alive && overlaps(this, p) && p.hurt(1, this.cx)) this.shatter();
        else if (hitGround) this.shatter();
        break;
      }
      case 'gone':
        if (this.t <= 0) {
          this.state = 'grow';
          this.t = 1;
          this.anim.play('grow', true);
        }
        break;
      case 'grow':
        if (this.t <= 0) {
          this.state = 'hang';
          this.anim.play('hang');
        }
        break;
    }
  }

  private drop() {
    this.state = 'fall';
    this.vy = 20;
    this.anim.play('hang');
  }

  private shatter() {
    this.world.particles.burst(this.cx, this.bottom - 3, 10, {
      colors: [3, 2, 2],
      speed: [30, 110],
      angle: [-Math.PI, 0],
      life: [0.3, 0.7],
      grav: 500,
      bounce: true,
    });
    this.world.game.audio.noise(0.18, 0.18, 'highpass', 4000, 1200);
    this.world.game.audio.tone('triangle', 1700, 900, 0.12, 0.04);
    this.state = 'gone';
    this.t = 2.4;
    this.y = this.anchorY;
    this.vy = 0;
    this.ry = 0;
  }

  hurtbox(): Rect {
    if (this.state === 'gone' || this.state === 'grow') return { x: -9999, y: -9999, w: 0, h: 0 };
    return { x: this.x - 2, y: this.y, w: this.w + 4, h: this.h };
  }

  onSlash(): boolean {
    if (this.state === 'fall') {
      this.shatter();
      return true;
    }
    if (this.state === 'hang' || this.state === 'shake') {
      this.drop();
      return true;
    }
    return false;
  }

  draw(r: Renderer) {
    if (this.state === 'gone') return;
    const jit = this.state === 'shake' ? Math.round(Math.sin(this.world.time * 70)) : 0;
    r.sprite('frostbell-icicle', this.anim.frame, this.cx + jit, this.y);
  }
}

registerEntity('frostbell:owl', (w, x, y) => new FrostOwl(w, x, y));
registerEntity('frostbell:yeti', (w, x, y) => new Yeti(w, x, y));
registerEntity('frostbell:bat', (w, x, y) => new IceBat(w, x, y));
registerEntity('frostbell:icicle', (w, x, y) => new FallingIcicle(w, x, y));
