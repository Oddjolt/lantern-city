import { approach, overlaps, type Rect } from '../../../engine/math';
import type { Renderer } from '../../../engine/renderer';
import { Anim } from '../../../engine/sprites';
import { T } from '../../../engine/tilemap';
import { Bullet } from '../../../game/common/bullet';
import { Enemy } from '../../../game/enemy';
import { Entity } from '../../../game/entity';
import type { Player } from '../../../game/player';
import { registerEntity } from '../../../game/registry';
import type { World } from '../../../game/world';
import { audible } from './mechanics';
import './sprites';

/** A small fire left on the floor (by imps, and by the Warden's falling cinders). */
export class Ember extends Entity {
  private t = 0;
  private anim = new Anim('foundry-ember', 'burn');

  constructor(
    world: World,
    x: number,
    floor: number,
    private life = 1.6,
  ) {
    super(world, x - 3, floor - 6, 6, 6);
    this.depth = 4;
  }

  get burning() {
    return this.t < this.life - 0.4;
  }

  update(dt: number) {
    this.t += dt;
    if (!this.burning && this.anim.name !== 'fade') this.anim.play('fade');
    this.anim.update(dt);
    if (this.t >= this.life) this.removed = true;
    if (this.burning) {
      const p = this.world.player;
      if (p.alive && overlaps(this, p)) p.hurt(1, this.cx);
      if (Math.random() < dt * 8) this.world.particles.burst(this.cx, this.y, 1, { colors: [3, 2], speed: [5, 20], angle: [-2, -1.1], life: [0.2, 0.5] });
    }
  }

  draw(r: Renderer) {
    r.sprite('foundry-ember', this.anim.frame, this.cx, this.bottom);
  }

  light() {
    return { x: this.cx, y: this.cy, r: this.burning ? 16 : 6 };
  }
}

// ===========================================================================================
// FLAME IMP — crouches (telegraph), then hops at you; every landing leaves an ember.
// ===========================================================================================
export class Imp extends Enemy {
  private ai: 'idle' | 'crouch' | 'hop' = 'idle';
  private dir: 1 | -1 = -1;
  private t = 0.4 + Math.random() * 0.6;
  private anim = new Anim('foundry-imp', 'idle');

  constructor(world: World, x: number, y: number) {
    super(world, x - 1, y - 2, 10, 10);
    this.hp = 2;
    this.souls = 2;
    this.knockback = 1.1;
  }

  /** Would a hop in `dir` land on solid, slag-free floor? */
  private safeHop(dir: number) {
    const w = this.world;
    const lx = this.cx + dir * 34;
    for (const x of [lx - 6, lx, lx + 6]) {
      if (w.solidAt(Math.floor(x) - 4, this.y - 12, 8, 12)) return false;
    }
    for (let dy = 0; dy < 24; dy += 8) {
      const t = w.tileAt(lx, this.bottom + dy);
      if (t === T.Acid || t === T.SpikeUp) return false;
      if (w.solidAt(Math.floor(lx), this.bottom + dy, 1, 1)) return true;
    }
    return false;
  }

  update(dt: number) {
    this.tick(dt);
    this.applyGravity(dt, 900, 240);
    this.t -= dt;
    const ground = this.onGround();
    const p = this.world.player;
    if (this.stun > 0) {
      this.vx = approach(this.vx, 0, 300 * dt);
    } else {
      switch (this.ai) {
        case 'idle':
          if (ground) this.vx = approach(this.vx, 0, 400 * dt);
          if (this.t <= 0 && ground) {
            const near = p.alive && Math.abs(p.cx - this.cx) < 120 && Math.abs(p.bottom - this.bottom) < 48;
            if (near && this.world.lineOfSight(this.cx, this.cy, p.cx, p.cy)) this.dir = this.playerDir();
            else if (Math.random() < 0.5) this.dir = -this.dir as 1 | -1;
            if (this.safeHop(this.dir)) {
              this.ai = 'crouch';
              this.t = near ? 0.42 : 0.6;
            } else this.t = 0.5;
          }
          break;
        case 'crouch':
          this.vx = 0;
          if (Math.random() < dt * 20) this.world.particles.burst(this.cx, this.y, 1, { colors: [3, 2], speed: [10, 30], angle: [-2.2, -0.9], life: [0.2, 0.4] });
          if (this.t <= 0) {
            this.ai = 'hop';
            this.vy = -215;
            this.vx = this.dir * 74;
            if (audible(this.world, this.cx, this.cy)) this.world.game.audio.tone('square', 300, 600, 0.08, 0.04);
          }
          break;
        case 'hop':
          if (ground && this.vy >= 0) {
            this.ai = 'idle';
            this.vx = 0;
            this.t = 0.55;
            this.world.add(new Ember(this.world, this.cx, this.bottom));
            this.world.particles.burst(this.cx, this.bottom, 4, { colors: [2, 1], speed: [10, 40], angle: [-Math.PI, 0], life: [0.2, 0.4] });
          }
          break;
      }
    }
    this.physics(dt, () => (this.vx = 0));
    this.touchPlayer();
    this.anim.play(this.ai === 'crouch' ? 'crouch' : this.ai === 'hop' && !ground ? 'hop' : 'idle');
    this.anim.update(dt);
    if (Math.random() < dt * 6) this.world.particles.burst(this.cx, this.y, 1, { colors: [2, 3], speed: [5, 15], angle: [-2, -1.1], life: [0.2, 0.5] });
  }

  draw(r: Renderer) {
    this.drawFrame(r, 'foundry-imp', this.anim.frame, this.cx, this.bottom, { flip: this.dir < 0 });
  }

  light() {
    return { x: this.cx, y: this.cy, r: 22 };
  }
}

// ===========================================================================================
// FURNACE BOT — walks behind a tower shield. Strikes on the shield clink off: drop on it from
// above, get behind it, or send a drone's shot back at it. Telegraphs a flame burst.
// ===========================================================================================
export class FurnaceBot extends Enemy {
  private ai: 'walk' | 'turn' | 'tell' | 'burst' | 'cool' = 'walk';
  private dir: 1 | -1 = -1;
  private t = 0;
  private block = 0;
  private anim = new Anim('foundry-bot', 'walk');
  private flame = new Anim('foundry-burst', 'burn');

  constructor(world: World, x: number, y: number) {
    super(world, x - 4, y - 9, 16, 17);
    this.hp = 5;
    this.souls = 5;
    this.knockback = 0.35;
  }

  private flameBox(): Rect {
    return { x: this.dir > 0 ? this.right : this.x - 26, y: this.y + 3, w: 26, h: 9 };
  }

  private sees(range: number) {
    const p = this.world.player;
    return p.alive && Math.abs(p.cx - this.cx) < range && Math.abs(p.bottom - this.bottom) < 22 && this.world.lineOfSight(this.cx, this.y + 4, p.cx, p.cy);
  }

  update(dt: number) {
    this.tick(dt);
    this.applyGravity(dt);
    this.t -= dt;
    this.block -= dt;
    const w = this.world;
    const p = w.player;
    const ahead = Math.sign(p.cx - this.cx) === this.dir;
    if (this.stun > 0) {
      this.vx = approach(this.vx, 0, 300 * dt);
    } else {
      switch (this.ai) {
        case 'walk':
          this.vx = this.dir * 22;
          if (this.onGround() && (this.wallAhead(this.dir) || !this.groundAhead(this.dir))) this.dir = -this.dir as 1 | -1;
          if (this.sees(76) && ahead) {
            this.ai = 'tell';
            this.t = 0.7;
            this.vx = 0;
            if (audible(w, this.cx, this.cy)) w.sfx('charge');
          } else if (this.sees(60) && !ahead) {
            this.ai = 'turn';
            this.t = 0.75;
            this.vx = 0;
          }
          break;
        case 'turn':
          this.vx = 0;
          if (this.t <= 0) {
            this.dir = this.playerDir();
            this.ai = 'walk';
          }
          break;
        case 'tell':
          this.vx = 0;
          if (Math.random() < dt * 16) w.particles.burst(this.x + (this.dir > 0 ? 5 : this.w - 5), this.y - 2, 1, { colors: [1, 2], speed: [10, 30], angle: [-2, -1.2], life: [0.4, 0.8] });
          if (this.t <= 0) {
            this.ai = 'burst';
            this.t = 0.8;
            this.flame.play('burn', true);
            if (audible(w, this.cx, this.cy)) {
              w.game.audio.noise(0.8, 0.18, 'bandpass', 1200, 300);
              w.game.audio.tone('sawtooth', 110, 70, 0.5, 0.05);
            }
          }
          break;
        case 'burst': {
          this.vx = 0;
          const fb = this.flameBox();
          if (p.alive && overlaps(fb, p)) p.hurt(1, this.cx);
          if (Math.random() < dt * 30)
            w.particles.burst(fb.x + (this.dir > 0 ? fb.w : 0), fb.y + 4, 1, { colors: [3, 2, 1], speed: [20, 50], angle: this.dir > 0 ? [-1, 0.2] : [2.9, 4.1], life: [0.2, 0.5] });
          if (this.t <= 0) {
            this.ai = 'cool';
            this.t = 1;
          }
          break;
        }
        case 'cool':
          this.vx = 0;
          if (Math.random() < dt * 10) w.particles.burst(this.x + (this.dir > 0 ? 5 : this.w - 5), this.y - 2, 1, { colors: [1], speed: [8, 20], angle: [-2, -1.2], life: [0.6, 1] });
          if (this.t <= 0) this.ai = 'walk';
          break;
      }
    }
    this.physics(dt, () => {
      if (this.ai === 'walk') this.dir = -this.dir as 1 | -1;
    });
    this.touchPlayer();
    this.flame.update(dt);
    const anim = this.block > 0 ? 'block' : this.ai === 'tell' ? 'tell' : this.ai === 'burst' ? 'burst' : this.ai === 'walk' ? 'walk' : 'idle';
    this.anim.play(anim);
    this.anim.update(dt);
  }

  onSlash(player: Player, dx: number, dy: number): boolean {
    const front = Math.sign(player.cx - this.cx) === this.dir;
    if (dy === 0 && front) {
      // CLINK: the shield takes it
      this.block = 0.18;
      const sx = this.dir > 0 ? this.right + 3 : this.x - 3;
      this.world.particles.burst(sx, this.cy - 2, 8, { colors: [3, 2], speed: [50, 130], angle: this.dir > 0 ? [-1.2, 1.2] : [1.9, 4.3], life: [0.1, 0.3] });
      this.world.game.audio.tone('square', 1600, 1100, 0.07, 0.06);
      this.world.game.audio.tone('triangle', 2400, 2300, 0.12, 0.04);
      this.world.hitstop(0.03);
      return true;
    }
    const landed = this.hurt(1, dx, dy);
    // hit from behind: it wheels around after a moment
    if (landed && !this.dead && !front && this.ai === 'walk') {
      this.ai = 'turn';
      this.t = 0.45;
    }
    return landed;
  }

  draw(r: Renderer) {
    const shake = this.ai === 'tell' ? Math.round(Math.sin(this.world.time * 60)) : 0;
    this.drawFrame(r, 'foundry-bot', this.anim.frame, this.cx + shake, this.bottom, { flip: this.dir < 0 });
    if (this.ai === 'burst') {
      const fx = this.dir > 0 ? this.right + 1 : this.x - 1;
      r.sprite('foundry-burst', this.t > 0.7 ? 's' : this.flame.frame, fx, this.y + 8, { flip: this.dir < 0 });
    }
  }

  drawBack(r: Renderer) {
    if (this.ai === 'burst') r.halo(this.dir > 0 ? this.right + 12 : this.x - 12, this.y + 8, 18, 1);
  }

  light() {
    return { x: this.cx, y: this.cy, r: this.ai === 'burst' ? 50 : 24 };
  }
}

// ===========================================================================================
// SENTRY DRONE — patrols the air; its eye flares (telegraph), then it spits a slag slug.
// Strike the slug back: reflected shots deal 3 damage.
// ===========================================================================================
export class Drone extends Enemy {
  private home: { x: number; y: number };
  private t = Math.random() * 10;
  private ai: 'patrol' | 'aim' | 'cool' = 'patrol';
  private timer = 1;
  private facing: 1 | -1 = -1;
  private anim = new Anim('foundry-drone', 'fly');

  constructor(world: World, x: number, y: number) {
    super(world, x - 2, y - 1, 12, 11);
    this.hp = 2;
    this.souls = 3;
    this.knockback = 1.2;
    this.home = { x: this.x, y: this.y };
  }

  update(dt: number) {
    this.tick(dt);
    this.t += dt;
    this.timer -= dt;
    const w = this.world;
    const p = w.player;
    let tx = this.home.x + Math.sin(this.t * 0.7) * 22;
    let ty = this.home.y + Math.sin(this.t * 1.9) * 4;
    if (this.stun > 0) {
      this.vx = approach(this.vx, 0, 300 * dt);
      this.vy = approach(this.vy, 0, 300 * dt);
    } else {
      if (this.ai === 'patrol') {
        if (p.alive) this.facing = this.playerDir();
        if (this.timer <= 0 && this.canSeePlayer(150)) {
          this.ai = 'aim';
          this.timer = 0.6;
          if (audible(w, this.cx, this.cy)) w.game.audio.tone('sine', 500, 1200, 0.5, 0.04);
        }
      } else if (this.ai === 'aim') {
        tx = this.x;
        ty = this.y;
        this.facing = this.playerDir();
        if (this.timer <= 0) {
          const dx = p.cx - this.cx;
          const dy = p.cy - this.cy;
          const d = Math.hypot(dx, dy) || 1;
          w.add(new Bullet(w, this.cx + this.facing * 5, this.cy, (dx / d) * 85, (dy / d) * 85, { sheet: 'foundry-shot', anim: 'fly', size: 5, life: 4 }));
          w.sfx('shoot');
          this.vx = -this.facing * 40;
          this.ai = 'cool';
          this.timer = 1.9;
        }
      } else if (this.timer <= 0) this.ai = 'patrol';
      this.vx = approach(this.vx, (tx - this.x) * 2.2, 160 * dt);
      this.vy = approach(this.vy, (ty - this.y) * 2.2, 160 * dt);
    }
    this.moveX(this.vx * dt, () => (this.vx = 0));
    this.moveY(this.vy * dt, () => (this.vy = 0));
    this.touchPlayer({ x: this.x + 1, y: this.y + 1, w: this.w - 2, h: this.h - 2 });
    this.anim.play(this.ai === 'aim' ? (this.timer < 0.15 ? 'shoot' : 'aim') : 'fly');
    this.anim.update(dt);
    if (Math.random() < dt * 8) w.particles.burst(this.cx, this.bottom + 2, 1, { colors: [2, 3], speed: [10, 25], angle: [1.2, 1.9], life: [0.15, 0.3] });
  }

  draw(r: Renderer) {
    this.drawFrame(r, 'foundry-drone', this.anim.frame, this.cx, this.cy, { flip: this.facing < 0 });
  }

  light() {
    return { x: this.cx, y: this.cy, r: this.ai === 'aim' ? 34 : 22 };
  }
}

registerEntity('foundry:imp', (w, x, y) => new Imp(w, x, y));
registerEntity('foundry:bot', (w, x, y) => new FurnaceBot(w, x, y));
registerEntity('foundry:drone', (w, x, y) => new Drone(w, x, y));
