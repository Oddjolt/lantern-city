import { bayer, hash2 } from '../../../engine/math';
import type { PixelBuffer } from '../../../engine/pixels';
import { T, TILE, type TileMap } from '../../../engine/tilemap';
import { makeStyle } from '../../../game/tilekit';

/**
 * Frostbell masonry: dark tower bricks with slate mortar, crusted with snow on every ledge.
 * Ice ('I') is glassy and brighter so slippery floors read at a glance.
 */

/** Staggered 12x6 bricks; a few are frosted (dithered) and a rare one glints. */
function brickTexture(x: number, y: number): number {
  const course = Math.floor(y / 6);
  const yy = y - course * 6;
  const sx = x + (course & 1) * 6;
  const bx = Math.floor(sx / 12);
  const xx = sx - bx * 12;
  if (yy === 5 || xx === 11) return 1;
  const h = hash2(bx, course, 11);
  if (h < 0.12) return bayer(x, y) < 0.25 ? 1 : 0;
  if (h > 0.94 && xx === 2 && yy === 1) return 2;
  if (yy === 0 && xx < 3 && h > 0.6) return 1;
  return bayer(x, y) < 0.0625 ? 1 : 0;
}

/** Glassy ice: slate body, thin diagonal sheens and a few hairline cracks. */
function iceTexture(x: number, y: number): number {
  const d = (((x + y * 2) % 19) + 19) % 19;
  if (d === 0 || d === 1) return 2;
  if (d === 3 && bayer(x, y) < 0.5) return 2;
  const c = (((x * 3 - y) % 29) + 29) % 29;
  if (c === 0 && hash2(Math.floor(x / 8), Math.floor(y / 8), 5) < 0.6) return 0;
  return bayer(x, y) < 0.25 ? 0 : 1;
}

const isGround = (t: number) => t === T.Solid || t === T.Ice;

/** Snow caps: a white crust over an ice-blue body of varying depth, spilling over open edges. */
function snowCap(buf: PixelBuffer, map: TileMap, tx: number, ty: number) {
  if (map.solidTile(tx, ty - 1)) return;
  const x0 = tx * TILE;
  const y0 = ty * TILE;
  const openL = !map.solidTile(tx - 1, ty);
  const openR = !map.solidTile(tx + 1, ty);
  for (let x = 0; x < TILE; x++) {
    const wx = x0 + x;
    const depth = 1 + (hash2(wx >> 1, ty, 21) < 0.35 ? 1 : 0) + (hash2(wx >> 2, ty, 22) < 0.15 ? 1 : 0);
    for (let i = 1; i <= depth; i++) buf.set(wx, y0 + i, 2);
    const edgeCol = (x === 0 && openL) || (x === 7 && openR);
    if (!edgeCol) buf.set(wx, y0 + depth + 1, 0);
  }
  // a little snow cornice lipping over exposed corners
  if (openL && map.get(tx - 1, ty) === T.Empty) {
    buf.set(x0 - 1, y0, 3);
    buf.set(x0 - 1, y0 + 1, 2);
  }
  if (openR && map.get(tx + 1, ty) === T.Empty) {
    buf.set(x0 + 8, y0, 3);
    buf.set(x0 + 8, y0 + 1, 2);
  }
}

/** Arrow-slit windows in thick standing walls (open air on both sides), never in floors. */
function slit(buf: PixelBuffer, map: TileMap, tx: number, ty: number) {
  if (map.get(tx, ty) !== T.Solid || hash2(tx, ty, 31) > 0.14) return;
  for (let dy = -2; dy <= 2; dy++) for (let dx = -1; dx <= 1; dx++) if (!map.solidTile(tx + dx, ty + dy)) return;
  let openL = false;
  let openR = false;
  for (let d = 2; d <= 5; d++) {
    if (!map.solidTile(tx - d, ty)) openL = true;
    if (tx + d < map.w && !map.solidTile(tx + d, ty)) openR = true;
  }
  if (!openL || !openR) return;
  const x0 = tx * TILE + 2;
  const y0 = ty * TILE;
  buf.rect(x0, y0 + 1, 4, 7, 1);
  buf.rect(x0 + 1, y0, 2, 1, 1);
  buf.rect(x0 + 1, y0 + 2, 2, 5, 0);
  buf.set(x0 + 1, y0 + 2, 1);
}

function decorate(buf: PixelBuffer, map: TileMap, tx: number, ty: number) {
  if (map.get(tx, ty) !== T.Empty) return;
  const x0 = tx * TILE;
  const y0 = ty * TILE;
  // snow drifts heaped on the ground below
  if (isGround(map.get(tx, ty + 1))) {
    const r = hash2(tx, ty, 41);
    if (r < 0.45) {
      const w = 3 + Math.floor(hash2(tx, ty, 42) * 5);
      const cx = Math.floor(hash2(tx, ty, 43) * (TILE - w + 1));
      const h = r < 0.12 ? 2 : 1;
      for (let i = 0; i < w; i++) {
        const top = i === 0 || i === w - 1 ? 1 : h;
        for (let j = 0; j < top; j++) buf.set(x0 + cx + i, y0 + 7 - j, j === top - 1 && hash2(x0 + i, ty, 44) < 0.3 ? 3 : 2);
      }
    }
  }
  // thin frost icicles under ceilings (dim: the bright ones are hazards)
  if (map.get(tx, ty - 1) === T.Solid && hash2(tx, ty, 51) < 0.5) {
    const n = 1 + Math.floor(hash2(tx, ty, 52) * 2);
    for (let k = 0; k < n; k++) {
      const x = x0 + 1 + Math.floor(hash2(tx, ty, 53 + k) * 6);
      const len = 2 + Math.floor(hash2(tx, ty, 55 + k) * 6);
      for (let i = 0; i < len; i++) {
        if (map.at(x, y0 + i) !== T.Empty) break;
        buf.set(x, y0 + i, i === 0 ? 2 : 1);
        if (i < len / 3) buf.set(x + 1, y0 + i, 1);
      }
    }
  }
}

export const frostStyle = makeStyle({
  solid: { texture: brickTexture, edge: 2, top: 3, topThickness: 1, gap: true, rounded: false },
  ice: { texture: iceTexture, edge: 2, top: 3, topThickness: 1, gap: false, rounded: true },
  // timber belfry beam with a dusting of snow
  oneway: ['23322332', '22222222', '11011101', '.1....1.', '.1....1.', '........', '........', '........'],
  // ice shards (rotated automatically: 'v' becomes a row of hanging icicles)
  spike: ['........', '.3....3.', '.3...33.', '323..32.', '22.3.22.', '22.3222.', '22232222', '11111111'],
  breakable: ['22222222', '21..1..2', '2.2..1.2', '21.22..2', '2..1.2.2', '2.2..1.2', '21..2.12', '22222222'],
  gate: ['22222222', '.3..3..3', '.2..2..2', '.2..2..2', '.2..2..2', '.2..2..2', '.2..2..2', '.1..1..1'],
  detail(buf, map, tx, ty) {
    snowCap(buf, map, tx, ty);
    slit(buf, map, tx, ty);
  },
  decorate,
});
