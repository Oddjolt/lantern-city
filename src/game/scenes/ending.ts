import { allWorlds } from '../../content/worlds';
import { PixelBuffer } from '../../engine/pixels';
import { H, W, type Renderer } from '../../engine/renderer';
import { Anim } from '../../engine/sprites';
import type { Game, Scene } from '../game';
import { saveProfile } from '../profile';
import type { WorldDef } from '../registry';
import { TitleScene } from './title';

/** Credits: the train rolls through every relit sector while your run stats scroll by. */
export class EndingScene implements Scene {
  private t = 0;
  private wheels = new Anim('train', 'roll');
  private twig = new Anim('player', 'idle');
  private worlds: WorldDef[];
  private layers = new Map<string, HTMLCanvasElement | null>();
  private current = -1;

  constructor(private game: Game) {
    this.worlds = allWorlds();
    saveProfile(game.profile);
  }

  private get lines(): string[] {
    const p = this.game.profile;
    const mins = Math.floor(p.playTime / 60);
    const secs = String(Math.floor(p.playTime % 60)).padStart(2, '0');
    const lit = this.worlds.filter((w) => p.flags[`goal:${w.id}`]).length;
    return [
      'THE CITY GLOWS AGAIN',
      '',
      `SECTORS RELIT   ${lit} / ${this.worlds.length}`,
      `TIME            ${mins}:${secs}`,
      `SOULS           ${p.souls}`,
      `WOODEN HEARTS   ${p.maxHp - 5}`,
      `SPLINTERED      ${p.deaths} TIMES`,
      '',
      'THANK YOU FOR PLAYING',
      'LANTERN CITY - A PIXEL WORLDS PROTOTYPE',
      'INSPIRED BY CITY OF NONE',
    ];
  }

  update(dt: number) {
    this.t += dt;
    this.wheels.update(dt);
    this.twig.update(dt);
    const idx = Math.floor(this.t / 4) % Math.max(1, this.worlds.length);
    if (idx !== this.current && this.worlds[idx]) {
      this.current = idx;
      this.game.r.setPalette(this.worlds[idx].palette);
      this.layers.clear();
    }
    if (this.t > 3 && this.game.input.pressed('confirm') && !this.game.transitioning)
      this.game.transition(() => (this.game.scene = new TitleScene(this.game)));
  }

  draw(r: Renderer) {
    const def = this.worlds[Math.max(0, this.current)];
    r.screen();
    r.clear(0);
    if (def) {
      if (!this.layers.has(def.id)) {
        const b = new PixelBuffer(640, H);
        def.backdrop.far?.(b);
        this.layers.set(def.id, b.toCanvas(r.palette));
      }
      const img = this.layers.get(def.id)!;
      const off = -Math.floor((this.t * 40) % 640);
      r.image(img, off, 0);
      r.image(img, off + 640, 0);
    }
    r.rect(0, 151, W, H - 151, 0);
    r.rect(0, 151, W, 1, 2);
    const off = Math.floor((this.t * 200) % 10);
    for (let x = -off; x < W; x += 10) r.rect(x, 153, 6, 2, 1);
    r.sprite('train', this.wheels.frame, 160, 151 - (Math.floor(this.t / 0.24) % 2));
    const ctx = r.ctx;
    ctx.save();
    ctx.beginPath();
    ctx.rect(160 - 64 + 31, 151 - 44 + 11, 12, 9);
    ctx.clip();
    r.sprite('player', this.twig.frame, 160 - 64 + 37, 151 - 44 + 26);
    ctx.restore();
    r.dither(0.55, 0, 0, 8, W, 92);
    this.lines.forEach((l, i) => {
      const reveal = Math.min(l.length, Math.floor((this.t - i * 0.35) * 30));
      if (reveal > 0) r.textCenter(l.slice(0, reveal), W / 2, 14 + i * 8, i === 0 ? 3 : 2, 1, true);
    });
    if (this.t > 3) r.textCenter('Z  RETURN TO TITLE', W / 2, H - 10, 1, 1);
  }
}
