import { bayer, hash2 } from '../../../engine/math';
import type { PixelBuffer } from '../../../engine/pixels';
import { T, type TileMap } from '../../../engine/tilemap';
import { hangers, makeStyle, paintSolid, tufts, type SolidLook } from '../../../game/tilekit';

/**
 * Mossgate terrain. Three looks are picked automatically from the map's shape:
 *   - leafy earth (interlocking leaf chevrons) for ordinary ground,
 *   - old masonry for thin structures (walls, pillars, roofs ≤ 3 tiles thick) — the ruins,
 *   - a darker, sparser fill deep inside big masses so the edges read first.
 */
const LEAF = ['2.....2.', '22...22.', '.22.22..', '..222...', '...2....', '........'];

function leafTexture(x: number, y: number): number {
  const row = Math.floor(y / 6);
  const ox = (row & 1) * 4;
  const ch = LEAF[y - row * 6][(x + ox) & 7];
  if (ch === '.') return 0;
  return hash2(Math.floor((x + ox) / 8), row, 7) < 0.35 ? 1 : 2;
}

/** Deeper ground: the same leaves, only in the dark colour. */
function deepLeaf(x: number, y: number): number {
  const c = leafTexture(x, y);
  return c === 0 ? 0 : 1;
}

/** Deepest ground: sparse dithered roots and pebbles. */
function deepest(x: number, y: number): number {
  const c = leafTexture(x, y);
  if (c !== 0 && bayer(x, y) < 0.45) return 1;
  return hash2(x, y, 31) < 0.012 ? 1 : 0;
}

/** Stone bricks 8x4 with dark mortar; some bricks are overgrown with leaves. */
function brickTexture(x: number, y: number): number {
  const row = Math.floor(y / 4);
  const bx = x + (row & 1) * 4;
  const col = Math.floor(bx / 8);
  if (y % 4 === 3 || bx % 8 === 7) return 0;
  const mossy = hash2(col, row, 11) < 0.22;
  if (mossy) return leafTexture(x, y) === 0 ? 1 : 2;
  if (y % 4 === 0 && bx % 8 === 0) return 2;
  return hash2(col, row, 12) < 0.12 ? 0 : 1;
}

const LEAFY: SolidLook = { texture: leafTexture, edge: 2, top: 2, topThickness: 2, gap: true, rounded: true };
const DEEP: SolidLook = { ...LEAFY, texture: deepLeaf };
const DEEPEST: SolidLook = { ...LEAFY, texture: deepest };
const MASONRY: SolidLook = { texture: brickTexture, edge: 2, top: 2, topThickness: 1, gap: true, rounded: false };

const solidAt = (map: TileMap, tx: number, ty: number) => (ty >= map.h ? true : map.solidTile(tx, ty));

/** Is there open space within `n` tiles of (tx, ty) in direction (dx, dy)? Map sides and bottom count as solid. */
function openWithin(map: TileMap, tx: number, ty: number, dx: number, dy: number, n: number) {
  for (let i = 1; i <= n; i++) {
    const x = tx + dx * i;
    const y = ty + dy * i;
    if (x < 0 || x >= map.w || y >= map.h) return false;
    if (y < 0 || !map.solidTile(x, y)) return true;
  }
  return false;
}

const thinH = (map: TileMap, tx: number, ty: number) => openWithin(map, tx, ty, 1, 0, 3) && openWithin(map, tx, ty, -1, 0, 3);
const thinV = (map: TileMap, tx: number, ty: number) => openWithin(map, tx, ty, 0, 1, 3) && openWithin(map, tx, ty, 0, -1, 3);
const thin = (map: TileMap, tx: number, ty: number) => map.solidTile(tx, ty) && (thinH(map, tx, ty) || thinV(map, tx, ty));

/**
 * Thin structures (open space on both sides within 3 tiles) are built from stone: walls, pillars,
 * roofs, bridges. Corners where a thin wall meets a thin roof count too.
 */
export function isMasonry(map: TileMap, tx: number, ty: number): boolean {
  if (thin(map, tx, ty)) return true;
  let side = false;
  let vert = false;
  for (let i = 1; i <= 3; i++) {
    side ||= thin(map, tx - i, ty) || thin(map, tx + i, ty);
    vert ||= thin(map, tx, ty - i) || thin(map, tx, ty + i);
  }
  return side && vert;
}

/** Distance (in tiles, Chebyshev, capped at 4) from this solid tile to the nearest open tile. */
function depth(map: TileMap, tx: number, ty: number) {
  for (let d = 1; d <= 3; d++) {
    for (let j = -d; j <= d; j++)
      for (let i = -d; i <= d; i++) {
        if (Math.max(Math.abs(i), Math.abs(j)) !== d) continue;
        if (!solidAt(map, tx + i, ty + j)) return d;
      }
  }
  return 4;
}

// Bramble thorns: two hooked spikes on a woody stem, pale tips (8x8, pointing up; rotated automatically).
const THORN = [
  '..3.....',
  '..3...3.',
  '.323..3.',
  '.22..323',
  '.212.22.',
  '2212.212',
  '21122112',
  '11211121',
];

// A mossy wooden plank on two little brackets.
const PLANK = ['22222222', '21121112', '.111111.', '..1..1..', '..1..1..', '...11...', '........', '........'];

// Cracked stone: bricks split by a bright jagged crack, so it reads as "breakable".
const CRACKED = ['22222222', '21110112', '21102112', '2.02.0.2', '21201112', '2102.112', '21021102', '22222222'];

export const leafyStyle = makeStyle({
  solid: LEAFY,
  oneway: PLANK,
  spike: THORN,
  breakable: CRACKED,
  detail(buf: PixelBuffer, map: TileMap, tx: number, ty: number) {
    if (isMasonry(map, tx, ty)) {
      paintSolid(buf, map, tx, ty, MASONRY);
      return;
    }
    const d = depth(map, tx, ty);
    if (d === 3) paintSolid(buf, map, tx, ty, DEEP);
    else if (d === 4) paintSolid(buf, map, tx, ty, DEEPEST);
  },
  decorate(buf, map, tx, ty) {
    tufts(buf, map, tx, ty, 2, { density: 0.45, maxH: 3 });
    // a few pale buds in the grass
    if (map.get(tx, ty) === T.Empty && map.get(tx, ty + 1) === T.Solid && hash2(tx, ty, 41) < 0.12) {
      const x = tx * 8 + 1 + Math.floor(hash2(tx, ty, 42) * 6);
      buf.set(x, ty * 8 + 4, 2);
      buf.set(x, ty * 8 + 5, 2);
      buf.set(x, ty * 8 + 3, 3);
    }
    hangers(buf, map, tx, ty, (_x, _y, i, len) => (i === len - 1 || i % 5 === 3 ? 2 : 1), { chance: 0.3, maxLen: 26 });
  },
});
