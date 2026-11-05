import { hash2 } from '../../../engine/math';
import type { PixelBuffer } from '../../../engine/pixels';
import { T, TILE, type TileMap } from '../../../engine/tilemap';
import { hangers, makeStyle } from '../../../game/tilekit';

/**
 * Foundry masonry: staggered refractory bricks blackened by soot, with riveted iron
 * decking on every floor and iron bands on walls. Chains and soot drip from ceilings.
 */
function brick(x: number, y: number): number {
  const row = Math.floor(y / 4);
  const bx = x + (row & 1) * 4;
  const cx = bx & 7;
  const cy = y & 3;
  if (cy === 3 || cx === 7) return 0;
  const id = hash2(bx >> 3, row, 21);
  if (id < 0.2) return (x + y) & 1 ? 1 : 0; // soot-stained brick
  if (id > 0.9 && cy === 0 && cx < 3) return 2; // a glint of heat
  return 1;
}

const solidAt = (map: TileMap, tx: number, ty: number) => map.solidTile(tx, ty);

/** Riveted iron decking over the top tile of every floor, iron straps down long walls. */
function detail(buf: PixelBuffer, map: TileMap, tx: number, ty: number) {
  if (map.get(tx, ty) !== T.Solid) return;
  const x0 = tx * TILE;
  const y0 = ty * TILE;
  const openUp = !solidAt(map, tx, ty - 1);
  if (openUp) {
    // deck plate: rows 2-5 under the bright lip, rivets every 4px
    for (let x = 0; x < TILE; x++) {
      const edgeL = x === 0 && !solidAt(map, tx - 1, ty);
      const edgeR = x === TILE - 1 && !solidAt(map, tx + 1, ty);
      if (edgeL || edgeR) continue;
      buf.set(x0 + x, y0 + 2, 0);
      buf.set(x0 + x, y0 + 3, (x0 + x) % 4 === 1 ? 2 : 1);
      buf.set(x0 + x, y0 + 4, 1);
      buf.set(x0 + x, y0 + 5, 0);
    }
  }
  // hazard-striped lip on one-tile-thick platforms' undersides
  const openDown = !solidAt(map, tx, ty + 1);
  if (openDown && !openUp && ty > 0) {
    for (let x = 1; x < TILE - 1; x++) if ((x0 + x) % 6 < 2) buf.set(x0 + x, y0 + 5, 1);
  }
  // iron straps: every 6th column of a wall face
  const openL = !solidAt(map, tx - 1, ty);
  const openR = !solidAt(map, tx + 1, ty);
  if ((openL || openR) && !openUp && tx % 2 === 0 && hash2(tx, ty >> 2, 5) < 0.5) {
    const sx = openL ? x0 + 2 : x0 + 5;
    for (let y = 0; y < TILE; y++) buf.set(sx, y0 + y, y === 3 ? 2 : 1);
  }
}

export const foundryStyle = makeStyle({
  solid: { texture: brick, edge: 2, top: 2, topThickness: 2, gap: true, rounded: false },
  // catwalk grating with a little truss underneath
  oneway: ['22222222', '21212121', '.1....1.', '..1..1..', '...11...', '........', '........', '........'],
  // iron caltrops with white-hot tips
  spike: ['........', '...3....', '...2..3.', '..121.2.', '..121121', '.1222121', '12222222', '11111111'],
  breakable: ['22222222', '2.1.1012', '21.10.12', '2.10.1.2', '201.1.02', '21.01.12', '2.1.10.2', '22222222'],
  gate: ['22222222', '21.21.21', '21.21.21', '22222222', '21.21.21', '21.21.21', '21.21.21', '21.21.21'],
  detail,
  decorate(buf, map, tx, ty) {
    // soot and rubble on floors
    if (map.get(tx, ty) === T.Empty && map.get(tx, ty + 1) === T.Solid) {
      for (let x = 0; x < TILE; x++) {
        const wx = tx * TILE + x;
        if (hash2(wx, ty, 3) < 0.12) buf.set(wx, ty * TILE + 7, 1);
      }
    }
    // chains and soot drips from ceilings
    hangers(
      buf,
      map,
      tx,
      ty,
      (x, y, i, len) => {
        if (len > 10) {
          // chain: links alternate, with a hook at the end
          if (i === len - 1) {
            buf.set(x + 1, y, 2);
            buf.set(x + 1, y - 1, 2);
            return 2;
          }
          return i % 3 === 2 ? null : i % 3 === 0 ? 2 : 1;
        }
        return i === len - 1 ? 2 : 1;
      },
      { chance: 0.22, maxLen: 30, seed: 9 },
    );
  },
});
