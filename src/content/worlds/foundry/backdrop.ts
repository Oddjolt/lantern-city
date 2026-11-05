import { bayer, hash2 } from '../../../engine/math';
import type { PixelBuffer } from '../../../engine/pixels';
import type { Backdrop } from '../../../game/registry';

/**
 * Far: the Barons' works on the horizon — sawtooth sheds, a blast furnace, smokestacks
 * trailing dithered smoke. Near: an overhead gantry with hanging chains and a pipe run.
 * Colour 1 only.
 */
function smoke(b: PixelBuffer, x: number, y: number, len: number, seed: number) {
  // a plume drifting up and to the right, thinning out
  for (let i = 0; i < len; i++) {
    const t = i / len;
    const cx = x + i * 0.9 + Math.sin(i * 0.15 + seed) * 4;
    const cy = y - i * 0.55;
    const r = 3 + t * 9;
    const density = 0.55 * (1 - t);
    for (let yy = -r; yy <= r; yy++)
      for (let xx = -r; xx <= r; xx++) {
        if (xx * xx + yy * yy > r * r) continue;
        const px = Math.round(cx + xx);
        const py = Math.round(cy + yy);
        if (bayer(px, py) < density * 0.5 && hash2(px, py, seed) < 0.8) b.set(((px % 640) + 640) % 640, py, 1);
      }
  }
}

function stack(b: PixelBuffer, x: number, w: number, top: number, seed: number) {
  for (let y = top; y < 180; y++) {
    b.set(x, y, 1);
    b.set(x + w - 1, y, 1);
    if ((y - top) % 12 === 4) for (let xx = x; xx < x + w; xx++) b.set(xx, y, 1);
  }
  for (let xx = x - 1; xx <= x + w; xx++) b.set(xx, top, 1);
  smoke(b, x + (w >> 1), top - 4, 60, seed);
}

export const foundryBackdrop: Backdrop = {
  farScroll: 0.12,
  nearScroll: 0.3,
  far(b) {
    // sawtooth factory sheds along the horizon
    const base = 150;
    for (let x = 0; x < 640; x++) {
      const k = x % 24;
      const roof = base - (k < 18 ? Math.floor(k * 0.6) : Math.floor((24 - k) * 1.8));
      b.set(x, roof, 1);
      if (k === 0 || k === 18) for (let y = roof; y < 180; y++) if (y % 2 === 0) b.set(x, y, 1);
      // skylight windows
      if (k > 3 && k < 15 && (k & 1) === 0 && hash2(x >> 3, 1, 4) < 0.7) {
        for (let y = roof + 4; y < roof + 7; y++) b.set(x, y, 1);
      }
    }
    for (let x = 0; x < 640; x += 2) b.set(x, 172, 1);

    // the blast furnace: a tapered tower with a domed top and a downcomer pipe
    const fx = 420;
    for (let y = 40; y < 150; y++) {
      const half = 14 + Math.floor((y - 40) * 0.12);
      b.set(fx - half, y, 1);
      b.set(fx + half, y, 1);
      if ((y - 40) % 16 === 0) for (let x = fx - half; x <= fx + half; x++) b.set(x, y, 1);
      if (y > 100 && (y & 1) === 0 && Math.abs((y % 6) - 3) < 2) {
        for (let x = fx - 4; x <= fx + 4; x++) if (bayer(x, y) < 0.5) b.set(x, y, 1);
      }
    }
    for (let a = 0; a <= Math.PI; a += 0.02) b.set(Math.round(fx + Math.cos(a) * 14), Math.round(40 - Math.sin(a) * 10), 1);
    b.line(fx + 6, 31, fx + 6, 18, 1);
    b.line(fx + 9, 31, fx + 9, 18, 1);
    b.line(fx + 6, 18, fx + 40, 18, 1);
    b.line(fx + 9, 21, fx + 37, 21, 1);
    b.line(fx + 40, 18, fx + 40, 150, 1);
    b.line(fx + 37, 21, fx + 37, 150, 1);
    smoke(b, fx, 26, 70, 2);

    // smokestacks
    stack(b, 60, 7, 40, 1);
    stack(b, 84, 5, 62, 3);
    stack(b, 250, 8, 28, 4);
    stack(b, 300, 6, 70, 5);
    stack(b, 540, 7, 46, 6);
    stack(b, 600, 5, 80, 7);

    // a gantry crane on stilts
    const gx = 150;
    for (let y = 70; y < 150; y++) {
      b.set(gx, y, 1);
      b.set(gx + 70, y, 1);
      if (y % 10 === 0) {
        b.line(gx, y, gx + 6, y + 10, 1);
        b.line(gx + 70, y, gx + 64, y + 10, 1);
      }
    }
    b.line(gx - 6, 70, gx + 76, 70, 1);
    b.line(gx - 6, 74, gx + 76, 74, 1);
    for (let x = gx - 6; x < gx + 76; x += 6) b.line(x, 70, x + 3, 74, 1);
    b.line(gx + 40, 74, gx + 40, 98, 1);
    b.rect(gx + 37, 98, 7, 3, 1);
    b.set(gx + 40, 102, 1);
    b.set(gx + 41, 103, 1);

    // ash in the sky
    for (let i = 0; i < 90; i++) b.set(Math.floor(hash2(i, 7) * 640), Math.floor(hash2(i, 8) * 120), 1);
  },
  near(b) {
    // overhead gantry truss across the top
    for (let x = 0; x < 640; x++) {
      b.set(x, 6, 1);
      b.set(x, 14, 1);
    }
    for (let x = 0; x < 640; x += 16) {
      b.line(x, 6, x + 8, 14, 1);
      b.line(x + 8, 14, x + 16, 6, 1);
    }
    // hanging chains with hooks
    for (const [cx, len] of [
      [40, 56],
      [210, 84],
      [330, 40],
      [500, 70],
    ] as const) {
      for (let y = 15; y < 15 + len; y++) {
        const k = (y - 15) % 4;
        if (k === 0 || k === 2) b.set(cx, y, 1);
        else if (k === 1) {
          b.set(cx - 1, y, 1);
          b.set(cx + 1, y, 1);
        }
      }
      const hy = 15 + len;
      b.line(cx, hy, cx, hy + 4, 1);
      b.line(cx, hy + 4, cx + 3, hy + 7, 1);
      b.line(cx + 3, hy + 7, cx + 5, hy + 5, 1);
    }
    // a pipe run with valve wheels near the floor line
    for (let x = 0; x < 640; x++) {
      b.set(x, 120, 1);
      b.set(x, 125, 1);
      if (x % 80 === 70) for (let y = 120; y <= 125; y++) b.set(x, y, 1);
    }
    for (const vx of [110, 430]) {
      for (let a = 0; a < Math.PI * 2; a += 0.15) b.set(Math.round(vx + Math.cos(a) * 5), Math.round(112 + Math.sin(a) * 5), 1);
      b.line(vx - 5, 112, vx + 5, 112, 1);
      b.line(vx, 107, vx, 120, 1);
    }
  },
};
