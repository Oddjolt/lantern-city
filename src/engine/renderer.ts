import { drawText, textWidth } from './font';
import { bayer } from './math';
import type { Palette } from './palette';
import { frameCanvas, getSheet, setSpritePalette } from './sprites';

/** Internal resolution — same as Celeste / City of None (scaled up by whole multiples). */
export const W = 320;
export const H = 180;

export interface SpriteOpts {
  flip?: boolean;
  /** Paint the whole sprite with one palette index (hit flash, afterimage). */
  tint?: number;
  /** Squash & stretch around the pivot. */
  sx?: number;
  sy?: number;
}

export class Renderer {
  readonly ctx: CanvasRenderingContext2D;
  palette: Palette = ['#000000', '#555555', '#aaaaaa', '#ffffff'];
  /** World-to-screen offset: minus the camera position (plus shake). Zero for HUD drawing. */
  ox = 0;
  oy = 0;
  private dithers: CanvasPattern[][] = [];
  private halos = new Map<string, HTMLCanvasElement>();

  constructor(readonly canvas: HTMLCanvasElement) {
    canvas.width = W;
    canvas.height = H;
    this.ctx = canvas.getContext('2d')!;
    this.ctx.imageSmoothingEnabled = false;
  }

  setPalette(p: Palette) {
    this.palette = p;
    setSpritePalette(p);
    this.dithers = [];
    this.halos.clear();
    document.body.style.background = p[0];
  }

  camera(x: number, y: number) {
    this.ox = -Math.round(x);
    this.oy = -Math.round(y);
  }

  screen() {
    this.ox = 0;
    this.oy = 0;
  }

  clear(c = 0) {
    this.ctx.fillStyle = this.palette[c];
    this.ctx.fillRect(0, 0, W, H);
  }

  rect(x: number, y: number, w: number, h: number, c: number) {
    this.ctx.fillStyle = this.palette[c];
    this.ctx.fillRect(Math.round(x) + this.ox, Math.round(y) + this.oy, w, h);
  }

  /** Rectangle outline, 1px. */
  frame(x: number, y: number, w: number, h: number, c: number) {
    this.rect(x, y, w, 1, c);
    this.rect(x, y + h - 1, w, 1, c);
    this.rect(x, y, 1, h, c);
    this.rect(x + w - 1, y, 1, h, c);
  }

  line(x0: number, y0: number, x1: number, y1: number, c: number) {
    x0 = Math.round(x0);
    y0 = Math.round(y0);
    x1 = Math.round(x1);
    y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    this.ctx.fillStyle = this.palette[c];
    for (;;) {
      this.ctx.fillRect(x0 + this.ox, y0 + this.oy, 1, 1);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
  }

  /** Draw a sprite frame with its pivot at (x, y). */
  sprite(sheetId: string, frame: string, x: number, y: number, o: SpriteOpts = {}) {
    const sheet = getSheet(sheetId);
    const img = frameCanvas(sheetId, frame, o.flip, o.tint ?? -1);
    const px = o.flip ? sheet.w - sheet.ox : sheet.ox;
    const sx = o.sx ?? 1;
    const sy = o.sy ?? 1;
    if (sx === 1 && sy === 1) {
      this.ctx.drawImage(img, Math.round(x) - px + this.ox, Math.round(y) - sheet.oy + this.oy);
    } else {
      const w = Math.round(sheet.w * sx);
      const h = Math.round(sheet.h * sy);
      this.ctx.drawImage(
        img,
        Math.round(x - px * sx) + this.ox,
        Math.round(y - sheet.oy * sy) + this.oy,
        w,
        h,
      );
    }
  }

  image(img: CanvasImageSource, x: number, y: number) {
    this.ctx.drawImage(img, Math.round(x) + this.ox, Math.round(y) + this.oy);
  }

  text(str: string, x: number, y: number, c: number, scale = 1) {
    drawText(this.ctx, this.palette, str, Math.round(x) + this.ox, Math.round(y) + this.oy, c, scale);
  }

  /** Text with a 1px dark outline so it reads on top of busy art. */
  textOutlined(str: string, x: number, y: number, c: number, scale = 1, outline = 0) {
    for (const [dx, dy] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
      [1, 1],
    ])
      this.text(str, x + dx * scale, y + dy * scale, outline, scale);
    this.text(str, x, y, c, scale);
  }

  textCenter(str: string, cx: number, y: number, c: number, scale = 1, outlined = false) {
    const x = Math.round(cx - textWidth(str, scale) / 2);
    if (outlined) this.textOutlined(str, x, y, c, scale);
    else this.text(str, x, y, c, scale);
  }

  /**
   * Ordered-dither cover of colour `c` over a screen-space rect; t = 0 (none) … 1 (solid).
   * `worldAnchored` locks the dot pattern to the world so it doesn't swim as the camera moves.
   */
  dither(t: number, c = 0, x = 0, y = 0, w = W, h = H, worldAnchored = false) {
    const level = Math.max(0, Math.min(16, Math.round(t * 16)));
    if (level === 0) return;
    if (level === 16) {
      this.ctx.fillStyle = this.palette[c];
      this.ctx.fillRect(x, y, w, h);
      return;
    }
    this.dithers[c] ??= [];
    let pat = this.dithers[c][level];
    if (!pat) {
      const cv = document.createElement('canvas');
      cv.width = cv.height = 4;
      const cx = cv.getContext('2d')!;
      cx.fillStyle = this.palette[c];
      for (let py = 0; py < 4; py++) for (let px = 0; px < 4; px++) if (bayer(px, py) < level / 16) cx.fillRect(px, py, 1, 1);
      pat = this.dithers[c][level] = this.ctx.createPattern(cv, 'repeat')!;
    }
    pat.setTransform(worldAnchored ? new DOMMatrix([1, 0, 0, 1, this.ox & 3, this.oy & 3]) : new DOMMatrix());
    this.ctx.fillStyle = pat;
    this.ctx.fillRect(x, y, w, h);
  }

  /** A dithered disc of light (solid core, ordered-dither falloff) centred on a world point. */
  halo(x: number, y: number, r: number, c = 1) {
    const key = `${r}|${c}`;
    let img = this.halos.get(key);
    if (!img) {
      img = document.createElement('canvas');
      img.width = img.height = r * 2 + 1;
      const cx = img.getContext('2d')!;
      cx.fillStyle = this.palette[c];
      const core = r * 0.55;
      for (let py = -r; py <= r; py++) {
        for (let px = -r; px <= r; px++) {
          const d = Math.hypot(px, py);
          if (d <= core || (d <= r && bayer(px + r, py + r) < (r - d) / (r - core))) cx.fillRect(px + r, py + r, 1, 1);
        }
      }
      this.halos.set(key, img);
    }
    this.image(img, Math.round(x) - r, Math.round(y) - r);
  }
}
