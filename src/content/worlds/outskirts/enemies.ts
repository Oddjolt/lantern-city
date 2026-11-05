import { approach, hash2, overlaps } from '../../../engine/math';
import type { Renderer } from '../../../engine/renderer';
import { Anim } from '../../../engine/sprites';
import { Enemy } from '../../../game/enemy';
import { Entity } from '../../../game/entity';
import type { Player } from '../../../game/player';
import { registerEntity } from '../../../game/registry';
import type { World } from '../../../game/world';
import './sprites';

/** Walkers only trust real ground: crumbling roots and moving platforms don't count as a path. */
function tileGroundAhead(e: Enemy, dir: number) {
  const fx = dir > 0 ? e.x + e.w : e.x - 1;
  const m = e.world.map;
  return m.solidRect(fx, e.y + e.h, 1, 1) || m.oneWayTop(fx, e.y + e.h, 1);
}

/** Should a patrolling walker turn back? (wall, ledge, or too far from home) */
function shouldTurn(e: Enemy, dir: number, homeX: number, leash: number) {
  if (!e.onGround()) return false;
  if (e.wallAhead(dir) || !tileGroundAhead(e, dir)) return true;
  return (e.cx - homeX) * dir > leash;
}

// =============================================================================================
// Thorn hound — patrols its ledge and turns at edges. When it spots you on its level it rears
// up and snarls (telegraph, 0.5 s), then charges until it hits a wall, a ledge or runs out of
// steam, and stands there panting: the opening to strike back.
// =============================================================================================
export class Hound extends Enemy {
  private ai: 'patrol' | 'alert' | 'charge' | 'recover' = 'patrol';
  private dir: 1 | -1 = -1;
  private t = 0;
  private anim = new Anim('hound', 'walk');
  private homeX: number;

  constructor(world: World, x: number, y: number) {
    // 14x10 hitbox with the feet on the bottom of the map cell
    super(world, x - 3, y - 2, 14, 10);
    this.hp = 3;
    this.souls = 3;
    this.homeX = this.cx;
  }

  groundAhead(dir: number) {
    return tileGroundAhead(this, dir);
  }

  update(dt: number) {
    this.tick(dt);
    this.applyGravity(dt);
    this.t -= dt;
    if (this.stun > 0) {
      this.vx = approach(this.vx, 0, 500 * dt);
    } else {
      switch (this.ai) {
        case 'patrol':
          this.vx = this.dir * 26;
          if (shouldTurn(this, this.dir, this.homeX, 80)) this.dir = -this.dir as 1 | -1;
          if (this.seesPlayer()) {
            this.ai = 'alert';
            this.t = 0.5;
            this.dir = this.playerDir();
            this.vx = 0;
            this.vy = -70;
            this.world.sfx('growl');
          }
          break;
        case 'alert':
          this.vx = 0;
          if (this.t <= 0) {
            this.ai = 'charge';
            this.t = 1.3;
          }
          break;
        case 'charge':
          this.vx = this.dir * 135;
          if (Math.random() < dt * 30)
            this.world.particles.burst(this.cx - this.dir * 6, this.bottom - 1, 1, { colors: [1, 2], speed: [10, 30], angle: [-2.5, -0.6] });
          if (this.t <= 0 || (this.onGround() && !this.groundAhead(this.dir))) {
            this.ai = 'recover';
            this.t = 0.8;
          }
          break;
        case 'recover':
          this.vx = approach(this.vx, 0, 400 * dt);
          if (this.t <= 0) this.ai = 'patrol';
          break;
      }
    }
    this.physics(dt, () => {
      if (this.ai === 'charge') {
        this.ai = 'recover';
        this.t = 0.9;
        this.stun = 0.4;
        this.world.shake(0.2);
      } else this.dir = -this.dir as 1 | -1;
    });
    this.touchPlayer();
    this.anim.play(this.ai === 'charge' ? 'charge' : this.ai === 'alert' ? 'alert' : this.ai === 'recover' ? 'recover' : 'walk');
    this.anim.update(dt);
  }

  private seesPlayer() {
    const p = this.world.player;
    return (
      p.alive &&
      Math.abs(p.bottom - this.bottom) < 20 &&
      Math.abs(p.cx - this.cx) < 96 &&
      this.world.lineOfSight(this.cx, this.cy - 2, p.cx, p.cy)
    );
  }

  draw(r: Renderer) {
    this.drawFrame(r, 'hound', this.anim.frame, this.cx, this.bottom, { flip: this.dir < 0 });
  }
}

// =============================================================================================
// Lost wisp — bobs in place until you come close, then drifts after you through walls.
// =============================================================================================
export class Wisp extends Enemy {
  private home: { x: number; y: number };
  private t = Math.random() * 10;
  private aggro = false;
  private anim = new Anim('wisp', 'float');

  constructor(world: World, x: number, y: number) {
    super(world, x - 1, y - 1, 10, 10);
    this.hp = 2;
    this.souls = 2;
    this.knockback = 1.4;
    this.home = { x: this.x, y: this.y };
  }

  update(dt: number) {
    this.tick(dt);
    this.t += dt;
    const p = this.world.player;
    const dx = p.cx - this.cx;
    const dy = p.cy - this.cy;
    const d = Math.hypot(dx, dy) || 1;
    if (!this.aggro && p.alive && d < 88) this.aggro = true;
    if (this.aggro && (!p.alive || d > 220)) this.aggro = false;
    if (this.stun > 0) {
      this.vx = approach(this.vx, 0, 300 * dt);
      this.vy = approach(this.vy, 0, 300 * dt);
    } else if (this.aggro) {
      this.vx = approach(this.vx, (dx / d) * 46, 110 * dt);
      this.vy = approach(this.vy, (dy / d) * 46 + Math.sin(this.t * 5) * 22, 110 * dt);
    } else {
      this.vx = (this.home.x + Math.sin(this.t * 0.9) * 10 - this.x) * 2;
      this.vy = (this.home.y + Math.sin(this.t * 1.7) * 5 - this.y) * 2;
    }
    this.moveFree(this.vx * dt, this.vy * dt);
    this.touchPlayer({ x: this.x + 1, y: this.y + 1, w: this.w - 2, h: this.h - 2 });
    if (Math.random() < dt * 10) this.world.particles.burst(this.cx, this.bottom, 1, { colors: [1, 2], speed: [4, 12], angle: [1, 2.1], life: [0.3, 0.6] });
    this.anim.play(this.aggro ? 'chase' : 'float');
    this.anim.update(dt);
  }

  draw(r: Renderer) {
    this.drawFrame(r, 'wisp', this.anim.frame, this.cx, this.cy, { flip: this.vx < 0 });
  }

  light() {
    return { x: this.cx, y: this.cy, r: 26 };
  }
}

// =============================================================================================
// Bramble beetle — trundles along with a thorny shell: strikes from ABOVE glance off (you
// still bounce). When you come close it bristles (telegraph), curls into a thorn ball and
// rolls at you. At the end of the roll it flops onto its back, dizzy: hit it then.
// =============================================================================================
export class Beetle extends Enemy {
  private state: 'walk' | 'alert' | 'roll' | 'dizzy' = 'walk';
  private dir: 1 | -1 = -1;
  private t = 0;
  private cool = 0;
  private anim = new Anim('outskirts-beetle', 'walk');
  private homeX: number;

  constructor(world: World, x: number, y: number) {
    super(world, x - 3, y - 1, 14, 9);
    this.hp = 3;
    this.souls = 4;
    this.knockback = 0.6;
    this.homeX = this.cx;
  }

  groundAhead(dir: number) {
    return tileGroundAhead(this, dir);
  }

  update(dt: number) {
    this.tick(dt);
    this.applyGravity(dt);
    this.t -= dt;
    this.cool -= dt;
    this.contactDamage = this.state === 'dizzy' ? 0 : 1;
    if (this.stun > 0) this.vx = approach(this.vx, 0, 400 * dt);
    else {
      switch (this.state) {
        case 'walk':
          this.vx = this.dir * 16;
          if (shouldTurn(this, this.dir, this.homeX, 56)) this.dir = -this.dir as 1 | -1;
          if (this.cool <= 0 && this.noticesPlayer()) this.bristle();
          break;
        case 'alert':
          this.vx = 0;
          if (this.t <= 0) {
            this.state = 'roll';
            this.t = 1.5;
            this.world.sfx('dash');
          }
          break;
        case 'roll':
          this.vx = approach(this.vx, this.dir * 125, 600 * dt);
          if (Math.random() < dt * 24)
            this.world.particles.burst(this.cx - this.dir * 5, this.bottom - 1, 1, { colors: [2, 1], speed: [10, 40], angle: [-2.6, -0.5], grav: 200 });
          if (this.t <= 0 || (this.onGround() && !this.groundAhead(this.dir))) this.flop(false);
          break;
        case 'dizzy':
          this.vx = approach(this.vx, 0, 300 * dt);
          if (this.t <= 0) {
            this.state = 'walk';
            this.cool = 0.8;
            this.vy = -80;
          }
          break;
      }
    }
    this.physics(dt, () => {
      if (this.state === 'roll') this.flop(true);
      else this.dir = -this.dir as 1 | -1;
    });
    this.touchPlayer({ x: this.x + 1, y: this.y + 1, w: this.w - 2, h: this.h - 1 });
    this.anim.play(this.state);
    this.anim.update(dt);
  }

  private noticesPlayer() {
    const p = this.world.player;
    return p.alive && Math.abs(p.cx - this.cx) < 70 && Math.abs(p.bottom - this.bottom) < 28 && this.world.lineOfSight(this.cx, this.cy - 2, p.cx, p.cy);
  }

  private bristle() {
    this.state = 'alert';
    this.t = 0.5;
    this.dir = this.playerDir();
    this.vx = 0;
    this.vy = -40;
    this.world.game.audio.noise(0.3, 0.12, 'bandpass', 2600, 5200);
  }

  /** End of a roll: bump, flip onto its back, dizzy. */
  private flop(hitWall: boolean) {
    this.state = 'dizzy';
    this.t = 1.3;
    this.vx = hitWall ? -this.dir * 40 : 0;
    this.vy = -110;
    this.world.sfx('slam');
    this.world.shake(hitWall ? 0.3 : 0.15);
    this.world.particles.burst(this.cx, this.bottom - 2, 8, { colors: [2, 1], speed: [20, 70], angle: [-3, -0.1], grav: 300 });
  }

  onSlash(_player: Player, dx: number, dy: number): boolean {
    if (this.dead) return false;
    const curled = this.state === 'alert' || this.state === 'roll';
    if (this.state !== 'dizzy' && (dy > 0 || curled)) {
      // thorns glance the blow off: no damage, but the player still bounces / recoils
      this.world.sfx('reflect');
      this.world.hitstop(0.04);
      this.world.particles.burst(this.cx, this.y, 6, { colors: [3, 2], speed: [40, 110], angle: [-2.8, -0.3], life: [0.15, 0.3] });
      return true;
    }
    return this.hurt(1, dx, dy);
  }

  protected onHurt(dx: number, dy: number) {
    super.onHurt(dx, dy);
    if (this.state === 'walk') this.bristle();
    else if (this.state === 'dizzy') this.t = Math.max(this.t, 0.5);
  }

  draw(r: Renderer) {
    const jitter = this.state === 'alert' ? Math.round(Math.sin(this.world.time * 60)) : 0;
    this.drawFrame(r, 'outskirts-beetle', this.anim.frame, this.cx + jitter, this.bottom, { flip: this.dir < 0 });
  }
}

// =============================================================================================
// Moss crow — perches on a ledge. When you come within reach below it, it caws with its wings
// up (telegraph), dives at where you were standing, then flaps back to its perch.
// =============================================================================================
export class Crow extends Enemy {
  private state: 'perch' | 'caw' | 'swoop' | 'return' = 'perch';
  private home: { x: number; y: number };
  private t = 0;
  private cool = 0.5;
  private face: 1 | -1 = -1;
  private anim = new Anim('outskirts-crow', 'perch');

  constructor(world: World, x: number, y: number) {
    super(world, x - 1, y, 10, 8);
    this.home = { x: this.x, y: this.y };
    this.hp = 2;
    this.souls = 3;
    this.knockback = 0.8;
  }

  update(dt: number) {
    this.tick(dt);
    this.t -= dt;
    this.cool -= dt;
    const p = this.world.player;
    if (this.stun > 0) {
      this.vx = approach(this.vx, 0, 400 * dt);
      this.vy = approach(this.vy, 0, 400 * dt);
      if (this.state === 'perch' || this.state === 'caw') this.state = 'return';
    } else {
      switch (this.state) {
        case 'perch': {
          this.vx = this.vy = 0;
          const dx = p.cx - this.cx;
          if (Math.abs(dx) < 90) this.face = dx < 0 ? -1 : 1;
          if (this.cool <= 0 && p.alive && Math.abs(dx) < 100 && p.cy > this.cy - 12 && p.cy - this.cy < 110 && this.world.lineOfSight(this.cx, this.cy, p.cx, p.cy)) {
            this.state = 'caw';
            this.t = 0.6;
            this.world.game.audio.tone('sawtooth', 820, 520, 0.18, 0.07);
            this.world.game.audio.tone('square', 760, 480, 0.2, 0.03, (this.world.game.audio.ctx?.currentTime ?? 0) + 0.22);
          }
          break;
        }
        case 'caw':
          this.face = p.cx < this.cx ? -1 : 1;
          if (this.t <= 0) {
            // dive at where the player is now, a little past them
            const tx = p.cx - this.cx;
            const ty = p.cy + 2 - this.cy;
            const d = Math.hypot(tx, ty) || 1;
            this.vx = (tx / d) * 165;
            this.vy = (ty / d) * 165;
            this.face = this.vx < 0 ? -1 : 1;
            this.state = 'swoop';
            this.t = Math.min(1.1, d / 165 + 0.35);
            this.world.sfx('dash');
          }
          break;
        case 'swoop':
          // pull up gradually so the dive curves back into the sky
          if (this.t < 0.35) this.vy = approach(this.vy, -60, 500 * dt);
          if (Math.random() < dt * 20) this.world.particles.burst(this.cx, this.cy, 1, { colors: [1, 2], speed: [5, 15], life: [0.2, 0.4] });
          if (this.t <= 0 || this.world.solidPoint(this.cx + Math.sign(this.vx) * 4, this.cy + 3)) {
            this.state = 'return';
          }
          break;
        case 'return': {
          const hx = this.home.x - this.x;
          const hy = this.home.y - this.y;
          const d = Math.hypot(hx, hy);
          // rise first, then glide home
          const wantY = this.y > this.home.y - 6 && Math.abs(hx) > 6 ? -60 : (hy / (d || 1)) * 70;
          this.vx = approach(this.vx, (hx / (d || 1)) * 80, 300 * dt);
          this.vy = approach(this.vy, wantY, 300 * dt);
          this.face = this.vx < 0 ? -1 : 1;
          if (d < 3) {
            this.x = this.home.x;
            this.y = this.home.y;
            this.state = 'perch';
            this.cool = 1.4;
          }
          break;
        }
      }
    }
    this.moveFree(this.vx * dt, this.vy * dt);
    this.touchPlayer({ x: this.x + 1, y: this.y + 1, w: this.w - 2, h: this.h - 2 });
    this.anim.play(this.state === 'return' ? 'fly' : this.state);
    this.anim.update(dt);
  }

  draw(r: Renderer) {
    const perched = this.state === 'perch' || this.state === 'caw';
    const flip = this.face < 0;
    this.drawFrame(r, 'outskirts-crow', this.anim.frame, this.cx + (flip ? 0 : 1), this.cy + (perched ? 6 : 8), { flip });
  }
}

// =============================================================================================
// Props with behaviour
// =============================================================================================

/** A little swarm of fireflies drifting around a point, blinking on and off. */
class Fireflies extends Entity {
  private flies: { ox: number; oy: number; ph: number; sp: number }[] = [];

  constructor(world: World, x: number, y: number) {
    super(world, x + 4, y + 4, 1, 1);
    this.depth = 8;
    for (let i = 0; i < 6; i++) this.flies.push({ ox: hash2(x, i, 1) * 6.28, oy: hash2(y, i, 2) * 6.28, ph: hash2(x + y, i, 3) * 6.28, sp: 0.5 + hash2(x, y + i, 4) });
  }

  private pos(i: number) {
    const f = this.flies[i];
    const t = this.world.time * f.sp;
    return { x: this.x + Math.sin(t + f.ox) * 14 + Math.sin(t * 2.3 + f.oy) * 4, y: this.y + Math.cos(t * 0.8 + f.oy) * 8 + Math.sin(t * 3.1 + f.ox) * 2 };
  }

  private glow(i: number) {
    return Math.sin(this.world.time * 2.2 + this.flies[i].ph);
  }

  drawBack(r: Renderer) {
    for (let i = 0; i < this.flies.length; i++) {
      if (this.glow(i) < 0.55) continue;
      const p = this.pos(i);
      r.halo(p.x, p.y, 3, 1);
    }
  }

  draw(r: Renderer) {
    for (let i = 0; i < this.flies.length; i++) {
      const g = this.glow(i);
      if (g < -0.3) continue;
      const p = this.pos(i);
      r.rect(p.x, p.y, 1, 1, g > 0.2 ? 3 : 2);
    }
  }

  light() {
    return { x: this.x, y: this.y, r: 22 };
  }
}

/** A street lamp that still burns, with its glow around the head (not the base). */
class LampPost extends Entity {
  private anim = new Anim('outskirts-lamppost', 'glow');

  constructor(world: World, x: number, y: number) {
    super(world, x + 4, y + 8, 1, 1);
    this.depth = -6;
    this.anim.t = hash2(x, y, 3) * 4;
  }

  update(dt: number) {
    this.anim.update(dt);
  }

  drawBack(r: Renderer) {
    r.halo(this.x, this.y - 29, 17 + (Math.sin(this.world.time * 9 + this.x) > 0.8 ? 1 : 0), 1);
  }

  draw(r: Renderer) {
    r.sprite('outskirts-lamppost', this.anim.frame, this.x, this.y);
  }

  light() {
    return { x: this.x, y: this.y - 29, r: 56 };
  }
}

/** Crumbling roots: shake 0.45 s after you touch them, drop away, and grow back. */
class Roots extends Entity {
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
        this.world.game.audio.noise(0.2, 0.08, 'lowpass', 900, 300);
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
    r.sprite('outskirts-roots', this.state === 'shake' ? (Math.floor(this.t * 12) % 2 ? 'b' : 'c') : 'a', this.x + jitter, this.y);
  }
}

registerEntity('outskirts:hound', (w, x, y) => new Hound(w, x, y));
registerEntity('outskirts:wisp', (w, x, y) => new Wisp(w, x, y));
registerEntity('outskirts:beetle', (w, x, y) => new Beetle(w, x, y));
registerEntity('outskirts:crow', (w, x, y) => new Crow(w, x, y));
registerEntity('outskirts:fireflies', (w, x, y) => new Fireflies(w, x, y));
registerEntity('outskirts:lamppost', (w, x, y) => new LampPost(w, x, y));
registerEntity('outskirts:roots', (w, x, y) => new Roots(w, x, y));
