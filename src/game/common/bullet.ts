import { overlaps } from '../../engine/math';
import type { Renderer } from '../../engine/renderer';
import { Anim } from '../../engine/sprites';
import { Enemy } from '../enemy';
import { Entity } from '../entity';
import type { Player } from '../player';
import type { World } from '../world';

export interface BulletOpts {
  sheet?: string;
  anim?: string;
  damage?: number;
  /** Downward acceleration (lobbed projectiles). */
  gravity?: number;
  life?: number;
  /** Can the player slash it back at enemies? (default true) */
  reflectable?: boolean;
  /** Passes through terrain (spirit projectiles). */
  ghost?: boolean;
  /** Hitbox size (square). */
  size?: number;
}

/** Enemy projectile. Slash it to reflect it — reflected shots hurt enemies for 3 damage. */
export class Bullet extends Entity {
  friendly = false;
  private t = 0;
  private anim: Anim;
  private o: Required<BulletOpts>;

  constructor(world: World, x: number, y: number, vx: number, vy: number, o: BulletOpts = {}) {
    const size = o.size ?? 4;
    super(world, x - size / 2, y - size / 2, size, size);
    this.o = {
      sheet: 'bullet',
      anim: 'fly',
      damage: 1,
      gravity: 0,
      life: 5,
      reflectable: true,
      ghost: false,
      size,
      ...o,
    };
    this.vx = vx;
    this.vy = vy;
    this.depth = 15;
    this.anim = new Anim(this.o.sheet, this.o.anim);
  }

  update(dt: number) {
    this.t += dt;
    this.anim.update(dt);
    this.vy += this.o.gravity * dt;
    this.moveFree(this.vx * dt, this.vy * dt);
    if (this.t > this.o.life || (!this.o.ghost && this.world.map.solidPoint(this.cx, this.cy))) return this.pop();
    if (!this.friendly) {
      const p = this.world.player;
      if (p.alive && overlaps(this, p) && p.hurt(this.o.damage, this.cx)) this.pop();
      return;
    }
    for (const e of this.world.entities) {
      if (e instanceof Enemy && !e.dead && overlaps(this, e.hurtbox())) {
        e.hurt(3, Math.sign(this.vx), Math.sign(this.vy));
        return this.pop();
      }
    }
  }

  onSlash(_player: Player, dx: number, dy: number): boolean {
    if (!this.o.reflectable || this.friendly) return false;
    this.friendly = true;
    const speed = Math.max(140, Math.hypot(this.vx, this.vy) * 1.7);
    const ax = dx !== 0 ? dx : 0;
    const ay = dy !== 0 ? dy : 0;
    const len = Math.hypot(ax, ay) || 1;
    this.vx = (ax / len) * speed;
    this.vy = (ay / len) * speed;
    this.o.gravity = 0;
    this.t = 0;
    this.world.sfx('reflect');
    this.world.hitstop(0.06);
    this.world.particles.burst(this.cx, this.cy, 6, { colors: [3], speed: [40, 100] });
    return true;
  }

  private pop() {
    this.removed = true;
    this.world.particles.burst(this.cx, this.cy, 5, { colors: [3, 2], speed: [20, 70], life: [0.15, 0.3] });
  }

  draw(r: Renderer) {
    r.sprite(this.o.sheet, this.anim.frame, this.cx, this.cy, { tint: this.friendly ? 3 : undefined });
  }

  light() {
    return { x: this.cx, y: this.cy, r: 14 };
  }
}
