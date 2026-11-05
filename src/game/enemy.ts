import { approach, overlaps, type Rect } from '../engine/math';
import type { Renderer, SpriteOpts } from '../engine/renderer';
import { OneShot } from './common/fx';
import { Entity } from './entity';
import type { Player } from './player';

/**
 * Base for anything the player can fight. Subclasses implement `update` (AI) and `draw`,
 * and get hit flashes, knockback, death bursts, soul drops and contact damage for free.
 */
export abstract class Enemy extends Entity {
  hp = 3;
  /** Damage dealt by touching the player. 0 = harmless to touch. */
  contactDamage = 1;
  /** Knockback multiplier when hit (0 = immovable, e.g. turrets and bosses). */
  knockback = 1;
  /** Souls dropped on death. */
  souls = 2;
  /** Seconds of white hit-flash remaining. */
  flash = 0;
  /** Seconds of hit-stun remaining (AI should idle while > 0). */
  stun = 0;
  dead = false;

  constructor(world: Entity['world'], x: number, y: number, w: number, h: number) {
    super(world, x, y, w, h);
    this.depth = 5;
  }

  onSlash(_player: Player, dx: number, dy: number): boolean {
    return this.hurt(1, dx, dy);
  }

  /** Apply damage. (dx, dy) is the direction of the blow. Returns true if it landed. */
  hurt(dmg: number, dx: number, dy: number): boolean {
    if (this.dead) return false;
    this.hp -= dmg;
    this.flash = 0.12;
    const w = this.world;
    w.particles.burst(this.cx, this.cy, 7, { colors: [3, 2], speed: [50, 140], life: [0.15, 0.35], size: [1, 2] });
    w.sfx('hit');
    w.hitstop(0.05);
    w.shake(0.15);
    if (this.hp <= 0) this.die();
    else this.onHurt(dx, dy);
    return true;
  }

  /** Default reaction to a non-lethal hit: knockback and a short stun. */
  protected onHurt(dx: number, dy: number) {
    if (this.knockback > 0) {
      this.vx = dx * 150 * this.knockback;
      this.vy = (dy !== 0 ? dy * 120 : -60) * this.knockback;
    }
    this.stun = 0.25;
  }

  die() {
    if (this.dead) return;
    this.dead = true;
    this.removed = true;
    const w = this.world;
    w.particles.burst(this.cx, this.cy, 16, {
      colors: [3, 2, 1],
      speed: [40, 150],
      life: [0.4, 0.9],
      size: [1, 3],
      grav: 300,
      bounce: true,
    });
    w.sfx('enemyDie');
    w.shake(0.25);
    w.add(new OneShot(w, 'ring', 'pop', this.cx, this.cy));
    w.spawnSouls(this.cx, this.cy, this.souls);
    this.onDeath();
  }

  /** Hook for drops, bosses, etc. */
  protected onDeath() {}

  /** Hurt the player if they overlap `box` (defaults to the hurtbox). */
  touchPlayer(box: Rect = this.hurtbox()) {
    const p = this.world.player;
    if (this.contactDamage > 0 && p.alive && overlaps(box, p)) p.hurt(this.contactDamage, this.cx);
  }

  /** Count down `flash` and `stun`. Call at the start of update(). */
  tick(dt: number) {
    this.flash = Math.max(0, this.flash - dt);
    this.stun = Math.max(0, this.stun - dt);
  }

  applyGravity(dt: number, gravity = 900, maxFall = 220) {
    this.vy = approach(this.vy, maxFall, gravity * dt);
  }

  /** Standard platformer move with gravity; stops velocity on impact. */
  physics(dt: number, onWall?: () => void) {
    this.moveX(this.vx * dt, () => {
      this.vx = 0;
      onWall?.();
    });
    this.moveY(this.vy * dt, () => (this.vy = 0));
  }

  /** Is there floor just past the front foot? (walkers use this to turn at ledges) */
  groundAhead(dir: number): boolean {
    const fx = dir > 0 ? this.x + this.w : this.x - 1;
    return this.world.solidAt(fx, this.y + this.h, 1, 1) || this.world.oneWayAt(fx, this.y + this.h, 1);
  }

  wallAhead(dir: number): boolean {
    return this.collideAt(this.x + dir, this.y);
  }

  /** Direction to the player on x: -1 or 1. */
  playerDir(): 1 | -1 {
    return this.world.player.cx < this.cx ? -1 : 1;
  }

  playerDist(): number {
    const p = this.world.player;
    return Math.hypot(p.cx - this.cx, p.cy - this.cy);
  }

  /** Player within `range` px and not hidden behind terrain. */
  canSeePlayer(range: number): boolean {
    const p = this.world.player;
    return p.alive && this.playerDist() <= range && this.world.lineOfSight(this.cx, this.cy, p.cx, p.cy);
  }

  /** Draw a frame with the hit flash applied. */
  drawFrame(r: Renderer, sheet: string, frame: string, x: number, y: number, o: SpriteOpts = {}) {
    r.sprite(sheet, frame, x, y, { ...o, tint: this.flash > 0 ? 3 : o.tint });
  }
}
