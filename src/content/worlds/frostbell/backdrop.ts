import { bayer, hash2 } from '../../../engine/math';
import type { PixelBuffer } from '../../../engine/pixels';
import type { Backdrop } from '../../../game/registry';

/**
 * Far: an aurora over a crescent moon, a jagged range of snowy peaks with distant bell towers,
 * and a sky full of still snow. Near: long blizzard streaks and a few big drifting flakes.
 * Colour 1 only — line-art and dithering.
 */

const W = 640;

/** Alpine peaks: [centre x, summit y, half-width]. */
const PEAKS: [number, number, number][] = [
  [40, 96, 70],
  [130, 118, 50],
  [205, 84, 80],
  [300, 112, 55],
  [372, 92, 75],
  [455, 120, 45],
  [530, 88, 85],
  [610, 108, 60],
];

/** Tileable ridge height: the highest peak profile over x (wrapping around the 640px layer). */
function ridge(x: number): number {
  let best = 150 + Math.round(Math.sin((x / W) * Math.PI * 6) * 3);
  for (const [px, py, hw] of PEAKS) {
    for (const off of [-W, 0, W]) {
      const d = Math.abs(x - px - off);
      if (d > hw) continue;
      const jag = Math.round(hash2(x >> 2, px, 61) * 3);
      best = Math.min(best, py + Math.round(((150 - py) * d) / hw) + jag);
    }
  }
  return best;
}

/** Is x on a summit slope near the top (where the snow cap line goes)? Returns the cap depth. */
function capDepth(x: number, y: number): number {
  for (const [px, py, hw] of PEAKS) {
    for (const off of [-W, 0, W]) {
      const d = Math.abs(x - px - off);
      if (d < hw * 0.45 && Math.abs(y - (py + Math.round(((150 - py) * d) / hw))) < 4) return 8 + Math.round(Math.sin(x * 0.7) * 2 + hash2(x, 3, 62) * 3);
    }
  }
  return 0;
}

function snowflake(b: PixelBuffer, cx: number, cy: number) {
  for (let i = -3; i <= 3; i++) {
    b.set(cx + i, cy, 1);
    b.set(cx, cy + i, 1);
  }
  for (let i = -2; i <= 2; i++) {
    if (i === 0) continue;
    b.set(cx + i, cy + i, 1);
    b.set(cx + i, cy - i, 1);
  }
  b.set(cx, cy, 0);
}

export const frostBackdrop: Backdrop = {
  farScroll: 0.1,
  nearScroll: 0.3,
  far(b) {
    // aurora: a rippling curtain of vertical strokes, dithered towards its fringe
    for (let x = 0; x < W; x += 2) {
      const t = (x / W) * Math.PI * 2;
      const top = 18 + Math.sin(t * 3) * 9 + Math.sin(t * 7 + 1) * 4;
      const len = 10 + Math.sin(t * 5 + 2) * 6 + Math.sin(t * 2) * 5;
      for (let i = 0; i < len; i++) {
        const fade = i / len;
        if (bayer(x >> 1, i) < 0.9 - fade) b.set(x, Math.round(top + i), 1);
      }
    }
    // crescent moon
    const mx = 168;
    const my = 52;
    for (let y = -20; y <= 20; y++)
      for (let x = -20; x <= 20; x++) {
        const d = Math.hypot(x, y);
        const inner = Math.hypot(x - 8, y - 5);
        if (d > 18.5 || inner < 15) continue;
        if (d > 17.5 || inner < 16) b.set(mx + x, my + y, 1);
        else if ((x + y) % 3 === 0 && (y & 1) === 0) b.set(mx + x, my + y, 1);
      }
    // still snow in the sky
    for (let y = 0; y < 120; y++)
      for (let x = 0; x < W; x++) {
        const r = hash2(x, y, 71);
        if (r < 0.0035) b.set(x, y, 1);
        else if (r < 0.0045) {
          b.set(x, y, 1);
          b.set(x - 1, y + 1, 1);
        }
      }
    // mountain range: ridge outline, a ragged snow line under each summit, sparse shading
    let prev = ridge(W - 1);
    for (let x = 0; x < W; x++) {
      const y = ridge(x);
      const a = Math.min(prev, y);
      const c = Math.max(prev, y);
      for (let yy = a; yy <= c; yy++) b.set(x, yy, 1);
      prev = y;
      for (let yy = y + 1; yy < 180; yy++) b.set(x, yy, 0);
      const cap = capDepth(x, y);
      if (cap) b.set(x, y + cap, 1);
      // rock shading: short diagonal hatches on the lower slopes
      for (let yy = y + 12; yy < 180; yy++) if ((x + yy * 2) % 13 === 0 && hash2(x, yy, 63) < 0.22) b.set(x, yy, 1);
    }
    // distant bell towers standing on the ridge
    for (const tx of [52, 236, 318, 470, 590]) {
      const base = ridge(tx);
      const h = 26 + Math.floor(hash2(tx, 3) * 22);
      const top = base - h;
      for (let y = top; y < base + 6; y++) {
        b.set(tx - 4, y, 1);
        b.set(tx + 4, y, 1);
        for (let x = tx - 3; x <= tx + 3; x++) b.set(x, y, 0);
      }
      // belfry opening with a bell, then a spire
      b.line(tx - 4, top, tx + 4, top, 1);
      b.rect(tx - 2, top + 4, 5, 6, 1);
      b.rect(tx - 1, top + 5, 3, 4, 0);
      b.set(tx, top + 7, 1);
      b.line(tx - 1, top + 8, tx + 1, top + 8, 1);
      b.line(tx - 4, top, tx, top - 12, 1);
      b.line(tx + 4, top, tx, top - 12, 1);
      b.line(tx, top - 12, tx, top - 16, 1);
      for (let y = top + 14; y < base; y += 6) b.set(tx, y, 1);
    }
  },
  near(b) {
    // long blizzard streaks, dashed, slanting down-right
    for (let i = 0; i < 26; i++) {
      const x0 = Math.floor(hash2(i, 1, 81) * W);
      const y0 = Math.floor(hash2(i, 2, 81) * 170);
      const len = 14 + Math.floor(hash2(i, 3, 81) * 30);
      for (let k = 0; k < len; k++) {
        if (k % 7 > 4) continue;
        b.set((x0 + k + W) % W, y0 + Math.floor(k / 4), 1);
      }
    }
    // a few big flakes tumbling close to the camera
    for (let i = 0; i < 9; i++) {
      const x = 20 + Math.floor(hash2(i, 5, 82) * (W - 40));
      const y = 12 + Math.floor(hash2(i, 6, 82) * 150);
      snowflake(b, x, y);
    }
  },
};
