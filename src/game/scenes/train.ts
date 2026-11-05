import { allWorlds } from '../../content/worlds';
import { Particles } from '../../engine/particles';
import { PixelBuffer } from '../../engine/pixels';
import { H, W, type Renderer } from '../../engine/renderer';
import { Anim } from '../../engine/sprites';
import type { Game, Scene } from '../game';
import { saveProfile } from '../profile';
import type { WorldDef } from '../registry';
import { PlayScene } from './play';

/** The ride between worlds: the destination's palette and skyline stream past the window. */
export class TrainScene implements Scene {
  private t = 0;
  private chug = 0;
  private wheels = new Anim('train', 'roll');
  private twig = new Anim('player', 'idle');
  private moss = new Anim('conductor', 'idle');
  private far: HTMLCanvasElement | null = null;
  private near: HTMLCanvasElement | null = null;
  private sparks = new Particles();

  constructor(
    private game: Game,
    private from: WorldDef,
    private to: WorldDef,
  ) {
    game.r.setPalette(to.palette);
    game.audio.playSong(to.music);
  }

  update(dt: number) {
    this.t += dt;
    this.wheels.update(dt);
    this.twig.update(dt);
    this.moss.update(dt);
    this.sparks.update(dt);
    this.chug -= dt;
    if (this.chug <= 0) {
      this.chug = 0.24;
      this.game.audio.play('chug');
      this.sparks.burst(100 + Math.random() * 120, 150, 2, { colors: [2, 3], speed: [20, 60], angle: [Math.PI, Math.PI * 1.2], life: [0.2, 0.5] });
    }
    const skip = this.t > 1 && this.game.input.pressed('confirm');
    if ((this.t > 4.4 || skip) && !this.game.transitioning) {
      const g = this.game;
      g.transition(() => {
        g.profile.worldId = this.to.id;
        g.profile.spawn = { kind: 'station' };
        saveProfile(g.profile);
        g.scene = new PlayScene(g, this.to, { kind: 'station' });
      });
    }
  }

  draw(r: Renderer) {
    if (!this.far) {
      const paint = (f?: (b: PixelBuffer) => void) => {
        if (!f) return null;
        const b = new PixelBuffer(640, H);
        f(b);
        return b.toCanvas(r.palette);
      };
      this.far = paint(this.to.backdrop.far);
      this.near = paint(this.to.backdrop.near);
    }
    r.screen();
    r.clear(0);
    const scroll = (img: HTMLCanvasElement | null, speed: number) => {
      if (!img) return;
      const off = -Math.floor((this.t * speed) % img.width);
      r.image(img, off, 0);
      r.image(img, off + img.width, 0);
    };
    scroll(this.far, 50);
    scroll(this.near, 160);
    // embankment, rails and sleepers rushing past
    r.rect(0, 151, W, H - 151, 0);
    r.rect(0, 151, W, 1, 2);
    const off = Math.floor((this.t * 300) % 10);
    for (let x = -off; x < W; x += 10) r.rect(x, 153, 6, 2, 1);
    for (let i = 0; i < 48; i++) {
      const gx = (((i * 53 - this.t * 300) % W) + W) % W;
      r.rect(gx, 159 + ((i * 7) % 19), i % 3 ? 1 : 2, 1, 1);
    }
    const bob = Math.floor(this.t / 0.24) % 2;
    const tx = 160;
    const ty = 151 - bob;
    r.sprite('train', this.wheels.frame, tx, ty);
    // passengers seen through the windows
    const ctx = r.ctx;
    const window = (wx: number, draw: () => void) => {
      ctx.save();
      ctx.beginPath();
      ctx.rect(tx - 64 + wx + 1, ty - 44 + 11, 12, 9);
      ctx.clip();
      draw();
      ctx.restore();
    };
    window(30, () => r.sprite('player', this.twig.frame, tx - 64 + 37, ty - 44 + 26));
    window(70, () => r.sprite('conductor', this.moss.frame, tx - 64 + 77, ty - 44 + 26, { flip: true }));
    this.sparks.draw(r);
    const a = Math.min(1, this.t / 0.8);
    r.textCenter(`${this.from.station} → NEXT STOP`, W / 2, 30, 2, 1, true);
    r.textCenter(this.to.station, W / 2, 42, 3, 2, true);
    if (a < 1) r.dither(1 - a, 0, 0, 26, W, 34);
    this.drawRoute(r);
    if (this.t > 1.2) r.text('Z SKIP', W - 30, H - 9, 1);
  }

  /** The spirit-rail line: one dot per world, the train sliding from origin to destination. */
  private drawRoute(r: Renderer) {
    const stops = allWorlds();
    if (stops.length < 2) return;
    const x0 = 70;
    const x1 = W - 70;
    const y = H - 10;
    const at = (i: number) => x0 + ((x1 - x0) * i) / (stops.length - 1);
    r.rect(x0, y, x1 - x0, 1, 1);
    stops.forEach((s, i) => {
      const lit = this.game.profile.flags[`goal:${s.id}`];
      r.rect(at(i) - 1, y - 1, 3, 3, s.id === this.to.id ? 3 : lit ? 2 : 1);
    });
    const a = stops.findIndex((s) => s.id === this.from.id);
    const b = stops.findIndex((s) => s.id === this.to.id);
    if (a < 0 || b < 0) return;
    const k = Math.min(1, this.t / 4.2);
    const tx = at(a) + (at(b) - at(a)) * (k * k * (3 - 2 * k));
    r.rect(tx - 3, y - 4, 7, 3, 3);
    r.rect(tx - 2, y - 1, 1, 1, 2);
    r.rect(tx + 2, y - 1, 1, 1, 2);
  }
}
