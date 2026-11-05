import { hash2 } from '../../../engine/math';
import type { PixelBuffer } from '../../../engine/pixels';
import type { Backdrop } from '../../../game/registry';

/**
 * Far: an endless ossuary gallery — round arches over walls of skull niches, with the great
 * Gloomroot's tendrils hanging from the vault. Near: a few heavy pillars, chains and a cage.
 * Colour 1 only: it is line-art seen through the dark, never competing with the level.
 */

function wanderingRoot(b: PixelBuffer, x: number, len: number, seed: number) {
  let px = x;
  for (let y = 0; y < len; y++) {
    px += Math.round((hash2(seed, y >> 2, 7) - 0.5) * 1.2);
    b.set(px, y, 1);
    if (y < len * 0.4) b.set(px + 1, y, 1); // thicker near the vault
    if (y > 6 && y % 9 === 4 && hash2(seed, y, 8) < 0.6) {
      const d = hash2(seed, y, 9) < 0.5 ? -1 : 1;
      for (let i = 1; i < 5; i++) b.set(px + d * i, y + i + (i >> 1), 1);
    }
  }
}

function arch(b: PixelBuffer, cx: number, top: number, halfW: number) {
  // pillars
  for (let y = top; y < 180; y++) {
    b.set(cx - halfW, y, 1);
    b.set(cx + halfW, y, 1);
  }
  // round head
  for (let a = 0; a <= 180; a += 2) {
    const r = (a * Math.PI) / 180;
    b.set(Math.round(cx - Math.cos(r) * halfW), Math.round(top - Math.sin(r) * halfW * 0.8), 1);
  }
  // keystone
  b.rect(cx - 1, top - Math.round(halfW * 0.8) - 2, 3, 3, 1);
  // capitals
  b.rect(cx - halfW - 2, top, 5, 1, 1);
  b.rect(cx + halfW - 2, top, 5, 1, 1);
  // skull niches inside: three rows of small rounded cubbies, sparse
  for (let row = 0; row < 4; row++) {
    const y = top + 16 + row * 24;
    for (let col = -1; col <= 1; col++) {
      const x = cx + col * 14 - 4;
      if (hash2(cx + col, row, 3) < 0.25) continue;
      b.rect(x + 1, y, 7, 1, 1);
      b.set(x, y + 1, 1);
      b.set(x + 8, y + 1, 1);
      for (let k = 2; k < 9; k++) {
        b.set(x, y + k, 1);
        b.set(x + 8, y + k, 1);
      }
      b.rect(x, y + 9, 9, 1, 1);
      // a skull resting in the niche: two eye dots and a jaw line
      if (hash2(cx + col, row, 4) < 0.7) {
        b.rect(x + 3, y + 4, 3, 1, 1);
        b.set(x + 2, y + 5, 1);
        b.set(x + 6, y + 5, 1);
        b.set(x + 4, y + 6, 1);
        b.rect(x + 3, y + 7, 3, 1, 1);
      }
    }
  }
}

export const catacombBackdrop: Backdrop = {
  farScroll: 0.14,
  nearScroll: 0.36,
  far(b) {
    // vault line
    for (let x = 0; x < 640; x++) {
      const y = 6 + Math.round(Math.sin(x * 0.03) * 2);
      b.set(x, y, 1);
      if ((x & 3) === 0) b.set(x, y + 1, 1);
    }
    for (let i = 0; i < 8; i++) arch(b, 40 + i * 80, 58 + Math.round(hash2(i, 1) * 6), 30);
    // the great roots hanging from the vault
    for (let i = 0; i < 26; i++) {
      const x = Math.floor(hash2(i, 20) * 640);
      wanderingRoot(b, x, 18 + Math.floor(hash2(i, 21) * 62), i);
    }
    // floor haze: a band of sparse dither
    for (let y = 150; y < 180; y++)
      for (let x = 0; x < 640; x++) if ((x + y * 3) % 8 === 0 && hash2(x, y, 5) < (y - 150) / 40) b.set(x, y, 1);
  },
  near(b) {
    for (const px of [120, 470]) {
      // a heavy fluted pillar
      for (let y = 0; y < 180; y++) {
        b.set(px, y, 1);
        b.set(px + 13, y, 1);
        if (y % 3 === 0) b.set(px + 5, y, 1);
        if (y % 3 === 1) b.set(px + 9, y, 1);
      }
      b.rect(px - 3, 24, 20, 2, 1);
      b.rect(px - 2, 27, 18, 1, 1);
      b.rect(px - 3, 160, 20, 2, 1);
    }
    // chains with a hanging cage
    for (const [x, len] of [
      [210, 70],
      [300, 34],
      [560, 52],
    ] as const) {
      for (let y = 0; y < len; y++) if (y % 3 !== 2) b.set(x, y, 1);
      if (x === 210) {
        // cage
        const top = len;
        b.rect(x - 7, top, 15, 1, 1);
        b.rect(x - 7, top + 18, 15, 1, 1);
        for (let k = -7; k <= 7; k += 3) for (let y = top; y < top + 19; y++) b.set(x + k, y, 1);
        b.rect(x - 4, top - 2, 9, 1, 1);
      } else {
        b.rect(x - 1, len, 3, 2, 1);
      }
    }
    for (let i = 0; i < 6; i++) wanderingRoot(b, 30 + i * 107, 10 + Math.floor(hash2(i, 31) * 30), 100 + i);
  },
};
