import { bayer, hash2 } from '../../../engine/math';
import type { PixelBuffer } from '../../../engine/pixels';
import type { Backdrop } from '../../../game/registry';

/**
 * Mossgate backdrop, colour 1 only (line art + dithering):
 *   far  — a huge pale moon, the distant towers of Lantern City with its great dark lantern,
 *          and a wooded ridge at the horizon.
 *   near — a ruined aqueduct striding across the outskirts, ivy hanging from its arches,
 *          and a couple of bare old trees.
 * Both layers are 640 px wide and tile horizontally.
 */
const WRAP = 640;
const set = (b: PixelBuffer, x: number, y: number) => b.set(((Math.round(x) % WRAP) + WRAP) % WRAP, y, 1);
const line = (b: PixelBuffer, x0: number, y0: number, x1: number, y1: number) => {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  for (let i = 0; i <= n; i++) set(b, x0 + ((x1 - x0) * i) / n, Math.round(y0 + ((y1 - y0) * i) / n));
};

/** Horizon ridge height at x (smooth, periodic over 640 px). */
const ridge = (x: number) =>
  140 + Math.round(Math.sin((x / WRAP) * Math.PI * 2 * 2) * 5 + Math.sin((x / WRAP) * Math.PI * 2 * 5 + 1) * 3 + Math.sin((x / WRAP) * Math.PI * 2 * 11) * 1.5);

function moon(b: PixelBuffer, mx: number, my: number, r: number) {
  for (let y = -r - 1; y <= r + 1; y++)
    for (let x = -r - 1; x <= r + 1; x++) {
      const d = Math.hypot(x, y);
      if (d > r - 0.5 && d < r + 0.5) set(b, mx + x, my + y);
      else if (d < r - 1) {
        // dithered body, darker towards the lower-left (a soft terminator), plus a few craters
        const shade = 0.18 + 0.22 * ((x - y) / r);
        const crater = Math.hypot(x + 8, y - 6) < 5 || Math.hypot(x - 9, y + 10) < 3 || Math.hypot(x - 4, y - 12) < 2.5;
        if (bayer(mx + x, my + y) < (crater ? 0.06 : shade)) set(b, mx + x, my + y);
      }
    }
}

function tower(b: PixelBuffer, x: number, w: number, top: number, base: number, seed: number) {
  for (let y = top; y < base; y++) {
    set(b, x, y);
    set(b, x + w - 1, y);
  }
  for (let i = 0; i < w; i++) set(b, x + i, top);
  // a few lit windows (still dark: drawn as tiny dashes)
  for (let y = top + 4; y < base - 3; y += 5)
    for (let i = 2; i < w - 2; i += 3) if (hash2(x + i, y, seed) < 0.22) set(b, x + i, y);
  // spire or broken top
  if (hash2(x, seed, 1) < 0.5) line(b, x + w / 2, top, x + w / 2, top - 6 - Math.floor(hash2(x, seed, 2) * 10));
  else for (let i = 0; i < w; i += 2) if (hash2(i, x, seed) < 0.5) set(b, x + i, top - 1);
}

/** The great city lantern: a tapering stone spire with a caged lantern at the top (unlit). */
function cityLantern(b: PixelBuffer, cx: number, top: number, base: number) {
  const h = base - (top + 24);
  for (let y = top + 24; y < base; y++) {
    const t = (y - top - 24) / h;
    const half = Math.round(3 + t * 6);
    set(b, cx - half, y);
    set(b, cx + half, y);
    if ((y - top) % 14 === 0) line(b, cx - half, y, cx + half, y);
    if ((y - top) % 14 === 6 && hash2(cx, y, 9) < 0.7) set(b, cx, y);
  }
  // balcony under the cage
  line(b, cx - 7, top + 24, cx + 7, top + 24);
  line(b, cx - 6, top + 25, cx + 6, top + 25);
  // cage
  line(b, cx - 6, top + 9, cx + 6, top + 9);
  for (const dx of [-6, -2, 2, 6]) line(b, cx + dx, top + 9, cx + dx, top + 23);
  line(b, cx - 7, top + 9, cx, top + 2);
  line(b, cx + 7, top + 9, cx, top + 2);
  line(b, cx, top + 2, cx, top - 4);
  set(b, cx - 1, top - 3);
  set(b, cx + 1, top - 3);
  // a cold ember inside
  for (let y = top + 13; y < top + 21; y++) for (let x = cx - 1; x <= cx + 1; x++) if (bayer(x, y) < 0.35) set(b, x, y);
}

export const outskirtsBackdrop: Backdrop = {
  farScroll: 0.1,
  nearScroll: 0.3,
  far(b) {
    // stars
    for (let i = 0; i < 45; i++) {
      const x = Math.floor(hash2(i, 1, 90) * WRAP);
      const y = Math.floor(hash2(i, 2, 90) * 90);
      set(b, x, y);
      if (hash2(i, 3, 90) < 0.12) {
        set(b, x - 1, y);
        set(b, x + 1, y);
        b.set(x, y - 1, 1);
        b.set(x, y + 1, 1);
      }
    }
    moon(b, 470, 44, 27);
    // distant city: a band of towers rising out of the ridge, with the great lantern
    let x = 140;
    let i = 0;
    while (x < 360) {
      const w = 7 + Math.floor(hash2(i, 1, 5) * 10);
      const h = 18 + Math.floor(hash2(i, 2, 5) * 34) + (Math.abs(x - 250) < 60 ? 14 : 0);
      tower(b, x, w, 138 - h, 146, i);
      x += w + 2 + Math.floor(hash2(i, 3, 5) * 6);
      i++;
    }
    cityLantern(b, 252, 58, 146);
    // a few lonely far-off towers elsewhere on the horizon
    for (const [tx, w, h] of [
      [30, 6, 16],
      [44, 9, 24],
      [560, 8, 20],
      [600, 6, 12],
    ])
      tower(b, tx, w, 140 - h, 146, tx);
    // wooded ridge: outline, tree tufts and a dithered fill
    for (let px = 0; px < WRAP; px++) {
      const y0 = ridge(px);
      const tuft = hash2(Math.floor(px / 3), 7, 3) < 0.35 ? 1 + Math.floor(hash2(px, 8, 3) * 3) : 0;
      set(b, px, y0 - tuft);
      for (let y = y0 + 2; y < y0 + 5; y++) if (bayer(px, y) < 0.25 - (y - y0) * 0.05) set(b, px, y);
    }
  },
  near(b) {
    // a few lonely ruins: broken arches and columns, ivy, and two bare old trees
    const column = (x: number, top: number, broken: boolean) => {
      line(b, x - 2, top, x + 8, top);
      for (let y = top + 1; y < 180; y++) {
        set(b, x, y);
        set(b, x + 6, y);
        if (hash2(x, y, 21) < 0.05) line(b, x, y, x + 6, y);
      }
      if (broken) {
        line(b, x - 2, top, x + 1, top - 3);
        line(b, x + 1, top - 3, x + 4, top - 1);
        line(b, x + 4, top - 1, x + 8, top - 4);
      }
      for (let y = top + 2; y < top + 40; y++) if (hash2(x, y, 4) < 0.35 && bayer(x, y) < 0.6) set(b, x + 1 + (y % 3), y);
    };
    const arch = (x0: number, w: number, top: number, brokenRight: boolean) => {
      column(x0, top, false);
      if (!brokenRight) column(x0 + w - 6, top, false);
      const cx = x0 + w / 2;
      const r = w / 2 - 3;
      const end = brokenRight ? Math.PI * 1.62 : Math.PI * 2;
      for (let a = Math.PI; a <= end; a += 0.008) {
        set(b, cx + Math.cos(a) * r, Math.round(top + 4 + Math.sin(a) * r * 0.85));
        set(b, cx + Math.cos(a) * (r - 4), Math.round(top + 4 + Math.sin(a) * (r - 4) * 0.85));
      }
      line(b, x0 - 2, top - r * 0.85 + 2, x0 + (brokenRight ? w * 0.7 : w + 2), top - r * 0.85 + 2);
      // ivy curtain under the arch
      for (let v = 0; v < 7; v++) {
        const vx = x0 + 8 + Math.floor(hash2(x0, v, 4) * ((brokenRight ? w * 0.6 : w) - 16));
        const len = 6 + Math.floor(hash2(x0, v, 5) * 26);
        const y0 = Math.round(top + 4 - Math.sqrt(Math.max(0, r * r - (vx - cx) * (vx - cx))) * 0.85) + 1;
        for (let y = y0; y < y0 + len; y++) if (bayer(vx, y) < 0.7) set(b, vx + (y % 7 === 0 ? 1 : 0), y);
      }
    };
    arch(40, 70, 104, false);
    column(160, 96, true);
    arch(300, 84, 96, true);
    column(440, 120, true);
    arch(470, 64, 112, false);
    // bare old trees
    const tree = (x: number, y: number, a: number, len: number, depth: number) => {
      const x1 = x + Math.cos(a) * len;
      const y1 = y + Math.sin(a) * len;
      line(b, x, y, x1, y1);
      if (depth <= 0) return;
      tree(x1, y1, a - 0.45 - hash2(depth, Math.round(x), 2) * 0.2, len * 0.72, depth - 1);
      tree(x1, y1, a + 0.4 + hash2(depth, Math.round(y), 3) * 0.2, len * 0.68, depth - 1);
    };
    for (const tx of [230, 600]) {
      for (let dx = -1; dx <= 1; dx++) line(b, tx + dx, 180, tx + dx * 0.5, 132);
      tree(tx, 132, -Math.PI / 2 - 0.15, 20, 5);
    }
  },
};
