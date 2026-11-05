import { overlaps } from '../../engine/math';
import type { Renderer } from '../../engine/renderer';
import { T, TILE } from '../../engine/tilemap';
import { Entity } from '../entity';
import type { World } from '../world';

export interface PlatformOpts {
  /** Where in its cycle the platform starts, 0..1 (0.5 = at the far end). */
  phase?: number;
  /** Seconds for a full there-and-back trip; overrides speed. Give neighbours the same period to keep them in step. */
  period?: number;
  /** Average speed in px/s when no period is given (default 38). */
  speed?: number;
}

/**
 * Moving platform (3 tiles wide, stand on it from above). 'm' travels right, 'n' travels up,
 * until it reaches a ';' marker (inclusive) or a wall, then eases back.
 */
export class Platform extends Entity {
  private from: number;
  private to: number;
  private phase: number;
  private fx: number;
  private fy: number;

  constructor(
    world: World,
    x: number,
    y: number,
    private axis: 'x' | 'y',
    private o: PlatformOpts = {},
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
    this.fx = x;
    this.fy = y;
    this.phase = (o.phase ?? 0) * Math.PI * 2;
  }

  update(dt: number) {
    const dist = Math.abs(this.to - this.from);
    if (dist < 1) return;
    const period = this.o.period ?? (4 * dist) / (this.o.speed ?? 38);
    this.phase += (dt * Math.PI * 2) / period;
    const k = 0.5 - 0.5 * Math.cos(this.phase);
    const prevX = this.x;
    const prevY = this.y;
    if (this.axis === 'x') this.fx = this.from + (this.to - this.from) * k;
    else this.fy = this.from + (this.to - this.from) * k;
    const nx = Math.round(this.fx);
    const ny = Math.round(this.fy);
    const p = this.world.player;
    const riding = p.alive && p.bottom === prevY && p.x < prevX + this.w && p.right > prevX && p.vy >= 0;
    this.x = nx;
    this.y = ny;
    this.vx = (nx - prevX) / dt;
    this.vy = (ny - prevY) / dt;
    if (riding) {
      p.moveX(nx - prevX);
      p.moveY(ny - prevY);
      p.carry(this.vx, this.vy);
    }
  }

  draw(r: Renderer) {
    r.sprite('platform', 'a', this.x, this.y);
  }
}

/** A block that crumbles shortly after you stand on it, then reforms. */
export class Crumble extends Entity {
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
    r.sprite('crumble', this.state === 'shake' ? (Math.floor(this.t * 12) % 2 ? 'b' : 'c') : 'a', this.x + jitter, this.y);
  }
}

/** A spring pad that launches the player high into the air. */
export class Bounce extends Entity {
  private sprung = 0;

  constructor(world: World, x: number, y: number) {
    super(world, x - 2, y + 3, 12, 5);
    this.depth = -1;
  }

  update(dt: number) {
    this.sprung -= dt;
    const p = this.world.player;
    if (p.alive && p.vy >= 0 && overlaps(this, p)) {
      p.bounce(-265);
      this.sprung = 0.2;
      this.world.sfx('jump');
      this.world.particles.burst(this.cx, this.y, 6, { colors: [3, 2], speed: [30, 80], angle: [-Math.PI, 0] });
    }
  }

  draw(r: Renderer) {
    r.sprite('bounce', this.sprung > 0 ? 'sprung' : 'idle', this.cx, this.y + 5);
  }
}
