import { hash2 } from '../../../engine/math';
import type { PixelBuffer } from '../../../engine/pixels';
import { T, TILE, type TileMap } from '../../../engine/tilemap';
import { makeStyle, tufts } from '../../../game/tilekit';

/**
 * Gloomroot terrain. The wall texture changes with depth into the sector (world x), so each
 * stretch of the catacombs reads differently:
 *   crypt bricks (the station) → ossuary of stacked skulls and bones → root-choked earth → old tomb masonry.
 * Interiors stay in colour 1 on black; colour 2 is kept for the mossy outlines so solid ground pops.
 */

/** Zone boundaries in tiles (kept in sync with the map's sections). */
export const ZONES = { ossuary: 46, roots: 150, tomb: 238 };

const rows = (r: string[]) => r.map((s) => [...s].map((c) => (c === '.' ? 0 : Number(c))));

const SKULL = rows([
  '........',
  '.11111..',
  '1111111.',
  '1..1..1.',
  '1111111.',
  '.11.11..',
  '.1.1.1..',
  '........',
]);
const KNOB = rows(['.11..', '1111.', '.11..', '.....']);
const LONG_BONE = rows(['11............11', '.11111111111111.', '11............11', '................']);

function zoneAt(x: number, y: number): number {
  // a ragged, dithered seam between zones instead of a straight cut
  const jitter = (hash2(x >> 2, y >> 2, 91) - 0.5) * 40;
  const tx = (x + jitter) / TILE;
  if (tx < ZONES.ossuary) return 0;
  if (tx < ZONES.roots) return 1;
  if (tx < ZONES.tomb) return 2;
  return 3;
}

/** Crypt masonry: staggered 16x8 bricks with purple mortar and the odd crumbled brick. */
function brick(x: number, y: number): number {
  const row = Math.floor(y / 8);
  const bx = x + (row & 1) * 8;
  const by = y & 7;
  const lx = bx & 15;
  if (by === 0 || lx === 0) return 1;
  const id = Math.floor(bx / 16);
  if (hash2(id, row, 5) < 0.07) return (x & 1) === 0 && (y & 1) === 0 ? 1 : 0; // crumbled brick: sparse rubble
  if (by === 1 && lx > 1 && lx < 14 && hash2(id, row, 6) < 0.5) return 0;
  return hash2(x, y, 4) < 0.05 ? 1 : 0;
}

/**
 * Ossuary: bands of stacked femur ends (little round knobs) and long bones, with the odd band
 * of skulls — like the bone walls of a real charnel house.
 */
function ossuary(x: number, y: number): number {
  const band = Math.floor(y / 8);
  const kind = hash2(Math.floor((x + band * 13) / 40), band, 14);
  if (kind < 0.2) {
    const lx = (x + (band & 1) * 4) & 7;
    return SKULL[y & 7][lx];
  }
  if (kind < 0.42) {
    const row = Math.floor(y / 4);
    return LONG_BONE[y & 3][(x + (row & 1) * 8) & 15];
  }
  if (kind > 0.9) return hash2(x, y, 15) < 0.08 ? 1 : 0; // packed earth between the bone stacks
  const row = Math.floor(y / 4);
  const lx = (((x + (row % 3) * 2) % 5) + 5) % 5;
  return KNOB[y & 3][lx];
}

/** Root-choked earth: meandering root strands over sparse soil and pebbles. */
function roots(x: number, y: number): number {
  for (let k = 0; k < 3; k++) {
    const band = Math.floor((y + k * 11) / 22);
    const y0 = band * 22 - k * 11 + 11;
    const path = y0 + Math.sin(x * 0.09 + band * 1.7 + k) * 4 + Math.sin(x * 0.23 + k * 3) * 1.5;
    const thick = 0.7 + hash2(Math.floor(x / 24), band, 30 + k) * 0.9;
    if (Math.abs(y - path) < thick && hash2(Math.floor(x / 40), band, 40 + k) < 0.75) return 1;
  }
  const pebble = hash2(x >> 2, y >> 2, 21) < 0.06 && (x & 3) !== 0 && (y & 3) !== 0;
  if (pebble) return (x & 3) === 1 && (y & 3) === 1 ? 0 : 1;
  return hash2(x, y, 22) < 0.07 ? 1 : 0;
}

/** Old tomb masonry: large carved ashlar blocks with an inset line, the occasional skull plaque. */
function tomb(x: number, y: number): number {
  const row = Math.floor(y / 16);
  const bx = x + (row & 1) * 12;
  const lx = bx % 24;
  const ly = y & 15;
  if (ly === 0 || lx === 0) return 1;
  const id = Math.floor(bx / 24);
  const plaque = hash2(id, row, 31) < 0.18;
  if (plaque && lx >= 8 && lx < 16 && ly >= 4 && ly < 12) return SKULL[ly - 4][lx - 8];
  if ((ly === 3 || ly === 13) && lx > 3 && lx < 21) return 1;
  if ((lx === 3 || lx === 21) && ly > 3 && ly < 13) return 1;
  return hash2(x, y, 32) < 0.04 ? 1 : 0;
}

function texture(x: number, y: number): number {
  switch (zoneAt(x, y)) {
    case 0:
      return brick(x, y);
    case 1:
      return ossuary(x, y);
    case 2:
      return roots(x, y);
    default:
      return hash2(x >> 3, y >> 3, 33) < 0.25 ? ossuary(x, y) : tomb(x, y);
  }
}

const open = (map: TileMap, tx: number, ty: number) => map.get(tx, ty) === T.Empty;

/** A hanging root that wanders a little as it grows down, with paler rootlets. */
function hangingRoot(buf: PixelBuffer, map: TileMap, tx: number, ty: number) {
  if (!open(map, tx, ty) || map.get(tx, ty - 1) !== T.Solid) return;
  const h = hash2(tx, ty, 51);
  if (h > 0.34) return;
  const len = 4 + Math.floor(hash2(tx, ty, 52) * 26);
  let x = tx * TILE + 1 + Math.floor(hash2(tx, ty, 53) * 6);
  const phase = hash2(tx, ty, 54) * 6;
  for (let i = 0; i < len; i++) {
    const y = ty * TILE + i;
    const nx = x + Math.round(Math.sin(i * 0.35 + phase) * 0.6);
    if (map.at(nx, y) !== T.Empty) break;
    buf.set(nx, y, 1);
    // short rootlets branching off
    if (i > 3 && i % 7 === 3) {
      const d = hash2(tx, i, 55) < 0.5 ? -1 : 1;
      if (map.at(nx + d, y + 1) === T.Empty) buf.set(nx + d, y + 1, 1);
      if (map.at(nx + d * 2, y + 2) === T.Empty) buf.set(nx + d * 2, y + 2, 1);
    }
    x = nx;
    if (i === len - 1 && hash2(tx, ty, 56) < 0.4) buf.set(nx, y + 1, 2);
  }
}

/** Cobwebs strung across upper corners. */
function cobweb(buf: PixelBuffer, map: TileMap, tx: number, ty: number) {
  if (!open(map, tx, ty) || map.get(tx, ty - 1) !== T.Solid) return;
  const left = map.get(tx - 1, ty) === T.Solid;
  const right = map.get(tx + 1, ty) === T.Solid;
  if ((!left && !right) || hash2(tx, ty, 61) > 0.55) return;
  const x0 = left ? tx * TILE : tx * TILE + 7;
  const s = left ? 1 : -1;
  const y0 = ty * TILE;
  for (let i = 0; i < 7; i++) buf.set(x0 + s * i, y0 + 6 - i, 1); // diagonal strand
  for (let i = 0; i < 4; i++) buf.set(x0 + s * i, y0 + 3, i % 2 ? 1 : 0);
  for (let i = 0; i < 3; i++) buf.set(x0 + s * 3, y0 + i, 1);
  buf.set(x0 + s, y0 + 5, 1);
  buf.set(x0 + s * 5, y0 + 1, 1);
}

/** Bone litter and moss on floors. */
function floorLitter(buf: PixelBuffer, map: TileMap, tx: number, ty: number) {
  if (!open(map, tx, ty) || map.get(tx, ty + 1) !== T.Solid) return;
  const r = hash2(tx, ty, 71);
  const x = tx * TILE + Math.floor(hash2(tx, ty, 72) * 4);
  const y = ty * TILE + 7;
  if (r < 0.07) {
    // a little skull
    buf.rect(x + 1, y - 3, 3, 1, 1);
    buf.rect(x, y - 2, 5, 2, 1);
    buf.set(x + 1, y - 2, 0);
    buf.set(x + 3, y - 2, 0);
  } else if (r < 0.15) {
    // a bone lying on the ground
    buf.rect(x, y, 5, 1, 1);
    buf.set(x - 1, y - 1, 1);
    buf.set(x + 5, y - 1, 1);
  }
}

export const catacombStyle = makeStyle({
  solid: { texture, edge: 2, top: 2, topThickness: 2, gap: true, rounded: true },
  oneway: [
    '22222222',
    '12221222',
    '.11.111.',
    '..1..1..',
    '..1.....',
    '........',
    '........',
    '........',
  ],
  spike: [
    '..3.....',
    '..3...3.',
    '.32...3.',
    '.32..32.',
    '.22..22.',
    '222.222.',
    '22222222',
    '11111111',
  ],
  breakable: [
    '21111112',
    '1.1.2..1',
    '1..2.1.1',
    '1.22...1',
    '1..2.1.1',
    '1.1.22.1',
    '1...2..1',
    '21111112',
  ],
  decorate(buf, map, tx, ty) {
    if (hash2(tx, ty, 81) < 0.6) tufts(buf, map, tx, ty, 2, { density: 0.3, maxH: 2, seed: 7 });
    floorLitter(buf, map, tx, ty);
    hangingRoot(buf, map, tx, ty);
    cobweb(buf, map, tx, ty);
  },
});
