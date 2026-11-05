import { hexToRgb, type Palette } from './palette';

export const CLEAR = 255;

/**
 * An indexed-colour pixel canvas: each pixel holds a palette index (0-3) or CLEAR.
 * Tiles, backdrops and procedural sprites are drawn into one of these, then coloured
 * with the current world's palette.
 */
export class PixelBuffer {
  readonly data: Uint8Array;

  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.data = new Uint8Array(w * h).fill(CLEAR);
  }

  static fromRows(rows: readonly string[]): PixelBuffer {
    const b = new PixelBuffer(Math.max(...rows.map((r) => r.length)), rows.length);
    b.stamp(rows, 0, 0);
    return b;
  }

  get(x: number, y: number): number {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return CLEAR;
    return this.data[y * this.w + x];
  }

  set(x: number, y: number, c: number) {
    x = Math.floor(x);
    y = Math.floor(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.data[y * this.w + x] = c;
  }

  rect(x: number, y: number, w: number, h: number, c: number) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c);
  }

  /** Bresenham line. */
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
    for (;;) {
      this.set(x0, y0, c);
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

  /** Connected line segments through [x0,y0, x1,y1, ...]. A single point draws one pixel. */
  polyline(pts: readonly number[], c: number) {
    if (pts.length === 2) this.set(pts[0], pts[1], c);
    for (let i = 0; i + 3 < pts.length; i += 2) this.line(pts[i], pts[i + 1], pts[i + 2], pts[i + 3], c);
  }

  /** Filled ellipse centred on (cx, cy). */
  ellipse(cx: number, cy: number, rx: number, ry: number, c: number) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const nx = (x - cx) / (rx + 0.5);
        const ny = (y - cy) / (ry + 0.5);
        if (nx * nx + ny * ny <= 1) this.set(x, y, c);
      }
    }
  }

  /** Copy ASCII pixel rows on top: '.' and ' ' are transparent, '0'-'3' are palette indices. */
  stamp(rows: readonly string[], ox: number, oy: number, flipX = false) {
    for (let y = 0; y < rows.length; y++) {
      const row = rows[y];
      for (let x = 0; x < row.length; x++) {
        const ch = row[flipX ? row.length - 1 - x : x];
        if (ch >= '0' && ch <= '3') this.set(ox + x, oy + y, ch.charCodeAt(0) - 48);
      }
    }
  }

  /** Draw another buffer on top (transparent pixels skipped). */
  blit(src: PixelBuffer, ox: number, oy: number) {
    for (let y = 0; y < src.h; y++) {
      for (let x = 0; x < src.w; x++) {
        const c = src.data[y * src.w + x];
        if (c !== CLEAR) this.set(ox + x, oy + y, c);
      }
    }
  }

  /** Put colour `c` on every transparent pixel that touches an opaque one (4-neighbourhood). */
  outline(c: number) {
    const add: number[] = [];
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (this.get(x, y) !== CLEAR) continue;
        if (
          this.get(x - 1, y) !== CLEAR ||
          this.get(x + 1, y) !== CLEAR ||
          this.get(x, y - 1) !== CLEAR ||
          this.get(x, y + 1) !== CLEAR
        )
          add.push(x, y);
      }
    }
    for (let i = 0; i < add.length; i += 2) this.set(add[i], add[i + 1], c);
  }

  toRows(): string[] {
    const rows: string[] = [];
    for (let y = 0; y < this.h; y++) {
      let row = '';
      for (let x = 0; x < this.w; x++) {
        const c = this.data[y * this.w + x];
        row += c === CLEAR ? '.' : String(c);
      }
      rows.push(row);
    }
    return rows;
  }

  toCanvas(palette: Palette, canvas = document.createElement('canvas')): HTMLCanvasElement {
    canvas.width = this.w;
    canvas.height = this.h;
    const ctx = canvas.getContext('2d')!;
    const img = ctx.createImageData(this.w, this.h);
    const rgb = palette.map(hexToRgb);
    for (let i = 0; i < this.data.length; i++) {
      const c = this.data[i];
      if (c === CLEAR) continue;
      const [r, g, b] = rgb[c];
      img.data[i * 4] = r;
      img.data[i * 4 + 1] = g;
      img.data[i * 4 + 2] = b;
      img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return canvas;
  }
}
