import type { Rect } from './math';
import type { Palette } from './palette';
import { PixelBuffer } from './pixels';

export const TILE = 8;

export const T = {
  Empty: 0,
  Solid: 1,
  OneWay: 2,
  SpikeUp: 3,
  SpikeDown: 4,
  SpikeLeft: 5,
  SpikeRight: 6,
  Breakable: 7,
  /** Boss-arena gate: solid while closed. Open gates are stored as GateOpen. */
  Gate: 8,
  GateOpen: 9,
  /** Solid but slippery. */
  Ice: 10,
  /** Liquids and fields: not solid, change how you move. */
  Water: 11,
  Acid: 12,
  Updraft: 13,
  /** Invisible marker where moving platforms turn around. */
  Stop: 14,
  /** Back wall: purely decorative interior wall behind the action (not solid). */
  Back: 15,
} as const;

/** Open air for decoration purposes (grass, vines… may grow here). */
export const isOpenType = (t: number) => t === T.Empty || t === T.Back;

export const isSolidType = (t: number) => t === T.Solid || t === T.Breakable || t === T.Gate || t === T.Ice;
export const isSpikeType = (t: number) => t >= T.SpikeUp && t <= T.SpikeRight;

/** A world's look: paints every tile of the map into an indexed pixel buffer. */
export interface TileStyle {
  paint(buf: PixelBuffer, map: TileMap): void;
}

/** The dangerous part of each spike tile, relative to the tile's top-left. */
const SPIKE_BOX: Record<number, Rect> = {
  [T.SpikeUp]: { x: 1, y: 3, w: 6, h: 5 },
  [T.SpikeDown]: { x: 1, y: 0, w: 6, h: 5 },
  [T.SpikeLeft]: { x: 0, y: 1, w: 5, h: 6 },
  [T.SpikeRight]: { x: 3, y: 1, w: 5, h: 6 },
};

export class TileMap {
  readonly tiles: Uint8Array;
  private canvas: HTMLCanvasElement | null = null;
  private dirty = true;

  constructor(
    readonly w: number,
    readonly h: number,
    readonly style: TileStyle,
  ) {
    this.tiles = new Uint8Array(w * h);
  }

  get pw() {
    return this.w * TILE;
  }

  get ph() {
    return this.h * TILE;
  }

  /** Off the sides counts as wall; above and below are open (falling out of the map is a pit). */
  get(tx: number, ty: number): number {
    if (tx < 0 || tx >= this.w) return T.Solid;
    if (ty < 0 || ty >= this.h) return T.Empty;
    return this.tiles[ty * this.w + tx];
  }

  set(tx: number, ty: number, t: number) {
    if (tx < 0 || ty < 0 || tx >= this.w || ty >= this.h) return;
    this.tiles[ty * this.w + tx] = t;
    this.dirty = true;
  }

  solidTile(tx: number, ty: number) {
    return isSolidType(this.get(tx, ty));
  }

  /** Does the pixel rect overlap any solid tile? */
  solidRect(x: number, y: number, w: number, h: number): boolean {
    const x0 = Math.floor(x / TILE);
    const y0 = Math.floor(y / TILE);
    const x1 = Math.floor((x + w - 1) / TILE);
    const y1 = Math.floor((y + h - 1) / TILE);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (this.solidTile(tx, ty)) return true;
    return false;
  }

  solidPoint(x: number, y: number) {
    return this.solidTile(Math.floor(x / TILE), Math.floor(y / TILE));
  }

  /** Tile type under a pixel. */
  at(x: number, y: number) {
    return this.get(Math.floor(x / TILE), Math.floor(y / TILE));
  }

  /** Does the rect overlap any tile of the given type? */
  touches(r: Rect, type: number): boolean {
    const x0 = Math.floor(r.x / TILE);
    const y0 = Math.floor(r.y / TILE);
    const x1 = Math.floor((r.x + r.w - 1) / TILE);
    const y1 = Math.floor((r.y + r.h - 1) / TILE);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (this.get(tx, ty) === type) return true;
    return false;
  }

  /** Is the top surface of a one-way platform exactly at `bottom`, under the span [x, x + w)? */
  oneWayTop(x: number, bottom: number, w: number): boolean {
    if (bottom % TILE !== 0) return false;
    const ty = bottom / TILE;
    for (let tx = Math.floor(x / TILE); tx <= Math.floor((x + w - 1) / TILE); tx++) {
      if (this.get(tx, ty) === T.OneWay) return true;
    }
    return false;
  }

  spikeHit(r: Rect): boolean {
    const x0 = Math.floor(r.x / TILE);
    const y0 = Math.floor(r.y / TILE);
    const x1 = Math.floor((r.x + r.w - 1) / TILE);
    const y1 = Math.floor((r.y + r.h - 1) / TILE);
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        const box = SPIKE_BOX[this.get(tx, ty)];
        if (!box) continue;
        const bx = tx * TILE + box.x;
        const by = ty * TILE + box.y;
        if (r.x < bx + box.w && r.x + r.w > bx && r.y < by + box.h && r.y + r.h > by) return true;
      }
    }
    return false;
  }

  /** The pre-rendered tile layer, rebuilt only after tiles change or the palette changes. */
  render(palette: Palette): HTMLCanvasElement {
    if (this.dirty || !this.canvas) {
      const buf = new PixelBuffer(this.pw, this.ph);
      this.style.paint(buf, this);
      this.canvas = buf.toCanvas(palette, this.canvas ?? undefined);
      this.dirty = false;
    }
    return this.canvas;
  }

  invalidate() {
    this.dirty = true;
  }
}
