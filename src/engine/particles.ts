import { pick, rand } from './math';
import type { Renderer } from './renderer';

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  c: number;
  size: number;
  grav: number;
  drag: number;
  bounce: boolean;
  shrink: boolean;
}

export interface BurstOpts {
  speed?: [number, number];
  /** Emission angle range in radians (0 = right, -PI/2 = up). */
  angle?: [number, number];
  life?: [number, number];
  colors?: number[];
  size?: [number, number];
  grav?: number;
  drag?: number;
  bounce?: boolean;
  shrink?: boolean;
  /** Spawn area half-size around the origin. */
  spread?: number;
}

export class Particles {
  list: Particle[] = [];

  constructor(private solidAt: (x: number, y: number) => boolean = () => false) {}

  burst(x: number, y: number, n: number, o: BurstOpts = {}) {
    for (let i = 0; i < n; i++) {
      const a = rand(...(o.angle ?? [0, Math.PI * 2]));
      const s = rand(...(o.speed ?? [20, 60]));
      const life = rand(...(o.life ?? [0.3, 0.6]));
      const spread = o.spread ?? 0;
      this.list.push({
        x: x + rand(-spread, spread),
        y: y + rand(-spread, spread),
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life,
        max: life,
        c: pick(o.colors ?? [3]),
        size: Math.round(rand(...(o.size ?? [1, 2]))),
        grav: o.grav ?? 0,
        drag: o.drag ?? 2,
        bounce: o.bounce ?? false,
        shrink: o.shrink ?? true,
      });
    }
  }

  update(dt: number) {
    for (const p of this.list) {
      p.life -= dt;
      p.vy += p.grav * dt;
      const k = Math.max(0, 1 - p.drag * dt);
      p.vx *= k;
      p.vy *= k;
      const nx = p.x + p.vx * dt;
      const ny = p.y + p.vy * dt;
      if (p.bounce && this.solidAt(nx, ny)) {
        if (this.solidAt(p.x, ny)) p.vy *= -0.35;
        if (this.solidAt(nx, p.y)) p.vx *= -0.5;
        p.vx *= 0.7;
      } else {
        p.x = nx;
        p.y = ny;
      }
    }
    this.list = this.list.filter((p) => p.life > 0);
  }

  draw(r: Renderer) {
    for (const p of this.list) {
      const s = p.shrink ? Math.max(1, Math.ceil(p.size * (p.life / p.max))) : p.size;
      r.rect(p.x - (s >> 1), p.y - (s >> 1), s, s, p.c);
    }
  }
}
