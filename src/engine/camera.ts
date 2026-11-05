import { clamp, type Rect } from './math';
import { H, W } from './renderer';

export class Camera {
  x = 0;
  y = 0;
  /** Area the view must stay inside (the level, or a locked boss arena). */
  bounds: Rect = { x: 0, y: 0, w: W, h: H };
  shakeX = 0;
  shakeY = 0;
  private trauma = 0;

  /** Smoothly move so that (tx, ty) sits at the centre of the screen. */
  follow(tx: number, ty: number, dt: number, rate = 7) {
    const k = 1 - Math.exp(-rate * dt);
    this.x += (tx - W / 2 - this.x) * k;
    this.y += (ty - H / 2 - this.y) * k;
    this.clamp();
  }

  snap(tx: number, ty: number) {
    this.x = tx - W / 2;
    this.y = ty - H / 2;
    this.clamp();
  }

  clamp() {
    const b = this.bounds;
    this.x = b.w <= W ? b.x + (b.w - W) / 2 : clamp(this.x, b.x, b.x + b.w - W);
    this.y = b.h <= H ? b.y + (b.h - H) / 2 : clamp(this.y, b.y, b.y + b.h - H);
  }

  /** Add screen shake; 0.2 is a light tap, 0.6 a heavy hit. */
  shake(amount: number) {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  update(dt: number) {
    this.trauma = Math.max(0, this.trauma - dt * 1.8);
    const s = this.trauma * this.trauma * 7;
    this.shakeX = Math.round((Math.random() * 2 - 1) * s);
    this.shakeY = Math.round((Math.random() * 2 - 1) * s);
  }
}
