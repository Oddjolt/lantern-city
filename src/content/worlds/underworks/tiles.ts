import { hash2 } from '../../../engine/math';
import type { PixelBuffer } from '../../../engine/pixels';
import { T, TILE, type TileMap } from '../../../engine/tilemap';
import { hangers, makeStyle, tufts } from '../../../game/tilekit';

/**
 * The Underworks: old sewer brickwork. Magenta bricks in navy mortar with a teal wet edge;
 * thick walls fade into darkness (bricks outlined only) and carry buried service pipes.
 */

/** Running-bond bricks: 4px courses (3 brick + 1 mortar), 8px bricks offset every other course. */
function brickTexture(x: number, y: number): number {
  const course = Math.floor(y / 4);
  const bx = x + (course & 1) * 4;
  const lx = bx & 7;
  const ly = y & 3;
  if (ly === 3 || lx === 7) return 0;
  const id = hash2(Math.floor(bx / 8), course, 11);
  if (id < 0.12) return (lx + ly) & 1 ? 1 : 0; // a crumbly, darker brick
  if (ly === 2 && id > 0.55 && (lx & 1) === 0) return 0; // soot along the lower lip
  return 1;
}

/** Distance (in tiles, Chebyshev, capped at 4) from a solid tile to the nearest open tile. */
function depth(map: TileMap, tx: number, ty: number): number {
  for (let r = 1; r <= 3; r++) {
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const nx = tx + dx;
        const ny = ty + dy;
        if (ny < 0 || ny >= map.h) continue;
        if (!map.solidTile(nx, ny)) return r;
      }
  }
  return 4;
}

/** Deep inside a wall: bricks drawn as faint outlines, then only scattered mortar dots. */
function deepTexture(x: number, y: number, d: number): number {
  const course = Math.floor(y / 4);
  const bx = x + (course & 1) * 4;
  const lx = bx & 7;
  const ly = y & 3;
  if (d >= 4) return ly === 3 && lx === 7 ? 1 : 0;
  if (ly === 3) return (lx & 1) === 0 ? 1 : 0;
  if (lx === 7) return ly === 1 ? 1 : 0;
  return 0;
}

/** A service pipe running through thick masonry: two rails, a highlight and bolted flanges. */
function pipeBand(buf: PixelBuffer, x0: number, y0: number) {
  for (let x = 0; x < TILE; x++) {
    const wx = x0 + x;
    const flange = wx % 32 < 2;
    buf.set(wx, y0 + 1, 1);
    buf.set(wx, y0 + 6, 1);
    for (let y = 2; y < 6; y++) buf.set(wx, y0 + y, flange ? 1 : y === 2 && (wx & 3) !== 0 ? 1 : 0);
    if (flange) {
      buf.set(wx, y0, 1);
      buf.set(wx, y0 + 7, 1);
    }
  }
}

export const underworksStyle = makeStyle({
  solid: { texture: brickTexture, edge: 2, top: 2, topThickness: 1, gap: true, rounded: false },
  oneway: [
    '22222222',
    '20200202',
    '22222222',
    '.1....1.',
    '.1....1.',
    '..1..1..',
    '........',
    '........',
  ],
  spike: [
    '........',
    '..3.....',
    '..3...3.',
    '.22..23.',
    '.22..22.',
    '122.122.',
    '12221222',
    '11111111',
  ],
  breakable: [
    '22222222',
    '21110112',
    '21102102',
    '20021012',
    '21210112',
    '21101002',
    '20112112',
    '22222222',
  ],
  detail(buf, map, tx, ty) {
    const d = depth(map, tx, ty);
    if (d < 2) {
      // rivets on the wet edge stones now and then
      if (!map.solidTile(tx, ty - 1) && hash2(tx, ty, 21) < 0.18) buf.set(tx * TILE + 2 + Math.floor(hash2(tx, ty, 22) * 4), ty * TILE + 3, 2);
      return;
    }
    const x0 = tx * TILE;
    const y0 = ty * TILE;
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) buf.set(x0 + x, y0 + y, deepTexture(x0 + x, y0 + y, d));
    // buried pipes along a few rows of deep masonry
    if (ty % 9 === 4 && hash2(Math.floor(tx / 14), ty, 31) < 0.45 && map.solidTile(tx - 1, ty) && map.solidTile(tx + 1, ty)) pipeBand(buf, x0, y0);
  },
  decorate(buf, map, tx, ty) {
    // grime along the floors
    tufts(buf, map, tx, ty, 1, { density: 0.3, maxH: 2, seed: 5 });
    // slime strands and drips under ceilings: magenta strand, teal drop
    hangers(buf, map, tx, ty, (_x, _y, i, len) => (i === len - 1 ? 2 : i % 4 === 3 ? null : 1), {
      chance: 0.22,
      maxLen: 11,
      seed: 7,
    });
    // moss on the waterline: a teal fringe where water meets a wall
    if (map.get(tx, ty) === T.Water && map.get(tx, ty - 1) !== T.Water) {
      for (const side of [-1, 1]) {
        if (!map.solidTile(tx + side, ty)) continue;
        const x = side < 0 ? tx * TILE : tx * TILE + 7;
        for (let i = 1; i < 4; i++) if (hash2(tx, ty + i, side) < 0.8) buf.set(x, ty * TILE + i, 2);
      }
    }
  },
});
