import { bayer, hash2 } from '../engine/math';
import { CLEAR, PixelBuffer } from '../engine/pixels';
import { isOpenType, T, TILE, type TileMap, type TileStyle } from '../engine/tilemap';

/**
 * Helpers for building a world's terrain look. A style is mostly data:
 *   - a SolidLook (interior texture function + edge colours) that is auto-tiled,
 *   - optional 8x8 ASCII stamps for platforms / spikes / breakables / gates,
 *   - optional decoration passes (grass, vines, icicles, rivets…).
 */
export interface SolidLook {
  /** Interior colour for a world-space pixel. Return 0 for "dark", CLEAR to see the backdrop through. */
  texture: (x: number, y: number) => number;
  /** Outline colour on exposed edges. */
  edge: number;
  /** Colour of the top surface rows when the tile above is open (grass, snow, metal lip…). Defaults to `edge`. */
  top?: number;
  /** Thickness of that top surface in pixels (default 1). */
  topThickness?: number;
  /** Leave a 1px dark gap inside the outline so edges read clearly. */
  gap?: boolean;
  /** Cut outer corners for a rounded, organic look. */
  rounded?: boolean;
}

export interface StyleSpec {
  solid: SolidLook;
  ice?: SolidLook;
  /** 8 rows of 8 chars ('.' + '0'-'3'). */
  oneway?: string[];
  /** Upward-pointing spike, 8x8; rotated automatically for the other directions. */
  spike?: string[];
  breakable?: string[];
  gate?: string[];
  /** Back-wall ':' texture for a world pixel (0-3, or CLEAR); defaults to dim dithered bricks in colour 1. */
  back?: (x: number, y: number) => number;
  /** Extra detail on each solid tile after it is painted. */
  detail?: (buf: PixelBuffer, map: TileMap, tx: number, ty: number) => void;
  /** Decoration for each non-solid tile, run after all terrain (grass, vines, icicles, drips…). */
  decorate?: (buf: PixelBuffer, map: TileMap, tx: number, ty: number) => void;
}

export const DEFAULT_ONEWAY = [
  '22222222',
  '11111111',
  '.1....1.',
  '........',
  '........',
  '........',
  '........',
  '........',
];

export const DEFAULT_SPIKE = [
  '........',
  '.3...3..',
  '.3...3..',
  '.2...2..',
  '222.222.',
  '222.222.',
  '22222222',
  '11111111',
];

export const DEFAULT_BREAKABLE = [
  '22222222',
  '2..1...2',
  '2.1..1.2',
  '21...1.2',
  '2.11..12',
  '2...1..2',
  '2.1...12',
  '22222222',
];

export const DEFAULT_GATE = [
  '22222222',
  '.2..2..2',
  '.2..2..2',
  '.3..3..3',
  '.2..2..2',
  '.2..2..2',
  '.2..2..2',
  '.2..2..2',
];

const DEFAULT_ICE: SolidLook = {
  texture: (x, y) => ((x + y) % 7 === 0 ? 3 : (x - y + 64) % 11 === 0 ? 2 : 1),
  edge: 3,
  top: 3,
  rounded: true,
};

/** Dim interior bricks: colour-1 mortar lines and a sparse dither on the faces. */
export function defaultBack(x: number, y: number): number {
  const row = Math.floor(y / 4);
  const bx = x + (row & 1) * 4;
  if (y % 4 === 3 || bx % 8 === 7) return 1;
  return bayer(x, y) < 0.12 ? 1 : 0;
}

export function makeStyle(spec: StyleSpec): TileStyle {
  const spikes = rotations(spec.spike ?? DEFAULT_SPIKE);
  return {
    paint(buf, map) {
      for (let ty = 0; ty < map.h; ty++) {
        for (let tx = 0; tx < map.w; tx++) {
          const t = map.get(tx, ty);
          const x = tx * TILE;
          const y = ty * TILE;
          switch (t) {
            case T.Solid:
              paintSolid(buf, map, tx, ty, spec.solid);
              spec.detail?.(buf, map, tx, ty);
              break;
            case T.Ice:
              paintSolid(buf, map, tx, ty, spec.ice ?? DEFAULT_ICE);
              break;
            case T.OneWay:
              buf.stamp(spec.oneway ?? DEFAULT_ONEWAY, x, y);
              break;
            case T.SpikeUp:
            case T.SpikeDown:
            case T.SpikeLeft:
            case T.SpikeRight:
              buf.stamp(spikes[t], x, y);
              break;
            case T.Breakable:
              buf.stamp(spec.breakable ?? DEFAULT_BREAKABLE, x, y);
              break;
            case T.Gate:
              buf.stamp(spec.gate ?? DEFAULT_GATE, x, y);
              break;
            case T.Back: {
              const tex = spec.back ?? defaultBack;
              for (let j = 0; j < TILE; j++)
                for (let i = 0; i < TILE; i++) {
                  const c = tex(x + i, y + j);
                  if (c !== CLEAR) buf.set(x + i, y + j, c);
                }
              break;
            }
          }
        }
      }
      if (spec.decorate) {
        for (let ty = 0; ty < map.h; ty++)
          for (let tx = 0; tx < map.w; tx++) if (!map.solidTile(tx, ty)) spec.decorate(buf, map, tx, ty);
      }
    },
  };
}

/** Auto-tiled solid block: outlines exposed edges, fills the inside with the look's texture. */
export function paintSolid(buf: PixelBuffer, map: TileMap, tx: number, ty: number, look: SolidLook) {
  const open = (dx: number, dy: number) => !map.solidTile(tx + dx, ty + dy);
  const up = open(0, -1);
  const down = open(0, 1);
  const left = open(-1, 0);
  const right = open(1, 0);
  const x0 = tx * TILE;
  const y0 = ty * TILE;
  const topT = look.topThickness ?? 1;
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      const dT = up ? y : 99;
      const dB = down ? TILE - 1 - y : 99;
      const dL = left ? x : 99;
      const dR = right ? TILE - 1 - x : 99;
      const side = Math.min(dB, dL, dR);
      let c: number;
      if (up && y < topT) c = look.top ?? look.edge;
      else if (side === 0) c = look.edge;
      else if (look.gap && (side === 1 || dT === topT)) c = 0;
      else c = look.texture(x0 + x, y0 + y);
      if (look.rounded) {
        const corner = (dT === 0 || dB === 0) && (dL === 0 || dR === 0);
        if (corner) c = CLEAR;
      }
      buf.set(x0 + x, y0 + y, c);
    }
  }
  // inner corners: diagonal neighbour open while both sides are solid
  const e = look.edge;
  if (!up && !left && open(-1, -1)) buf.set(x0, y0, e);
  if (!up && !right && open(1, -1)) buf.set(x0 + 7, y0, e);
  if (!down && !left && open(-1, 1)) buf.set(x0, y0 + 7, e);
  if (!down && !right && open(1, 1)) buf.set(x0 + 7, y0 + 7, e);
}

/** Up/down/left/right versions of an upward-pointing 8x8 stamp. */
function rotations(up: string[]): Record<number, string[]> {
  const at = (r: number, c: number) => up[r]?.[c] ?? '.';
  const grid = (f: (r: number, c: number) => string) =>
    Array.from({ length: 8 }, (_, r) => Array.from({ length: 8 }, (_, c) => f(r, c)).join(''));
  return {
    [T.SpikeUp]: up,
    [T.SpikeDown]: grid((r, c) => at(7 - r, c)),
    [T.SpikeLeft]: grid((r, c) => at(c, 7 - r)),
    [T.SpikeRight]: grid((r, c) => at(7 - c, r)),
  };
}

// ---- decoration helpers (call these from a style's `decorate`) ---------------------

/** Blades/tufts growing up from the ground beneath an open tile (grass, snow, crystals). */
export function tufts(
  buf: PixelBuffer,
  map: TileMap,
  tx: number,
  ty: number,
  color: number,
  { density = 0.35, maxH = 3, seed = 1 } = {},
) {
  if (!isOpenType(map.get(tx, ty)) || map.get(tx, ty + 1) !== T.Solid) return;
  for (let x = 0; x < TILE; x++) {
    const wx = tx * TILE + x;
    const r = hash2(wx, ty, seed);
    if (r > density) continue;
    const h = 1 + Math.floor(hash2(wx, ty, seed + 1) * maxH);
    for (let i = 0; i < h; i++) buf.set(wx, ty * TILE + 7 - i, color);
  }
}

/**
 * Things hanging down from a ceiling (vines, roots, icicles, chains, drips). Starts at open tiles
 * that have solid ground directly above them and grows down through open space.
 */
export function hangers(
  buf: PixelBuffer,
  map: TileMap,
  tx: number,
  ty: number,
  draw: (x: number, y: number, i: number, len: number) => number | null,
  { chance = 0.25, maxLen = 24, seed = 3 } = {},
) {
  if (!isOpenType(map.get(tx, ty)) || map.get(tx, ty - 1) !== T.Solid) return;
  if (hash2(tx, ty, seed) > chance) return;
  const x = tx * TILE + 1 + Math.floor(hash2(tx, ty, seed + 1) * 6);
  const len = 3 + Math.floor(hash2(tx, ty, seed + 2) * (maxLen - 3));
  const y0 = ty * TILE;
  for (let i = 0; i < len; i++) {
    const y = y0 + i;
    if (!isOpenType(map.at(x, y))) break;
    const c = draw(x, y, i, len);
    if (c !== null && c !== undefined) buf.set(x, y, c);
  }
}
