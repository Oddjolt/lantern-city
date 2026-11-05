import { hexToRgb, type Palette } from './palette';

/**
 * Sprite sheets are plain data: every frame is a list of ASCII rows where
 *   '.'  = transparent
 *   '0'-'3' = palette index (0 darkest … 3 lightest)
 * Frames are baked to canvases lazily for the active world palette.
 */
export interface AnimDef {
  frames: string[];
  fps: number;
  loop?: boolean;
}

export interface SheetDef {
  /** Frame size in pixels. */
  w: number;
  h: number;
  /** Pivot (from the frame's top-left) that the sprite is positioned by — usually the feet. */
  ox: number;
  oy: number;
  frames: Record<string, string[]>;
  anims: Record<string, AnimDef>;
}

const sheets = new Map<string, SheetDef>();
const cache = new Map<string, HTMLCanvasElement>();
let palette: Palette = ['#000000', '#555555', '#aaaaaa', '#ffffff'];

export function defineSheet(id: string, def: SheetDef) {
  for (const [name, rows] of Object.entries(def.frames)) {
    if (rows.length !== def.h || rows.some((r) => r.length !== def.w)) {
      console.warn(`sprite ${id}/${name}: expected ${def.w}x${def.h}`, rows.map((r) => r.length));
    }
  }
  for (const [name, anim] of Object.entries(def.anims)) {
    for (const f of anim.frames) if (!def.frames[f]) console.warn(`sprite ${id}: anim ${name} uses missing frame ${f}`);
  }
  sheets.set(id, def);
  // redefining a sheet (e.g. a new avatar) drops its stale baked frames
  for (const key of [...cache.keys()]) if (key.startsWith(`${id}|`)) cache.delete(key);
}

export function getSheet(id: string): SheetDef {
  const s = sheets.get(id);
  if (!s) throw new Error(`unknown sprite sheet ${id}`);
  return s;
}

export function allSheets(): [string, SheetDef][] {
  return [...sheets.entries()];
}

export function setSpritePalette(p: Palette) {
  palette = p;
  cache.clear();
}

/**
 * Baked canvas for a frame. `tint` paints every opaque pixel with one palette index
 * (hit flashes, dash afterimages); `flip` mirrors horizontally.
 */
export function frameCanvas(sheetId: string, frame: string, flip = false, tint = -1): HTMLCanvasElement {
  const key = `${sheetId}|${frame}|${flip ? 1 : 0}|${tint}`;
  let c = cache.get(key);
  if (c) return c;
  const sheet = getSheet(sheetId);
  const rows = sheet.frames[frame] ?? [];
  c = document.createElement('canvas');
  c.width = sheet.w;
  c.height = sheet.h;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(sheet.w, sheet.h);
  const rgb = palette.map(hexToRgb);
  for (let y = 0; y < sheet.h; y++) {
    const row = rows[y] ?? '';
    for (let x = 0; x < sheet.w; x++) {
      const ch = row[flip ? sheet.w - 1 - x : x];
      if (!ch || ch < '0' || ch > '3') continue;
      const [r, g, b] = rgb[tint >= 0 ? tint : ch.charCodeAt(0) - 48];
      const o = (y * sheet.w + x) * 4;
      img.data[o] = r;
      img.data[o + 1] = g;
      img.data[o + 2] = b;
      img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  cache.set(key, c);
  return c;
}

/** Plays one named animation of a sheet at a time. */
export class Anim {
  name = '';
  t = 0;
  private def!: AnimDef;

  constructor(
    readonly sheet: string,
    initial: string,
  ) {
    this.play(initial);
  }

  play(name: string, restart = false) {
    if (name === this.name && !restart) return;
    const def = getSheet(this.sheet).anims[name];
    if (!def) throw new Error(`unknown anim ${this.sheet}/${name}`);
    this.name = name;
    this.def = def;
    this.t = 0;
  }

  update(dt: number) {
    this.t += dt;
  }

  get index(): number {
    const n = this.def.frames.length;
    const i = Math.floor(this.t * this.def.fps);
    return this.def.loop === false ? Math.min(i, n - 1) : i % n;
  }

  get frame(): string {
    return this.def.frames[this.index];
  }

  get done(): boolean {
    return this.def.loop === false && this.t * this.def.fps >= this.def.frames.length;
  }
}
