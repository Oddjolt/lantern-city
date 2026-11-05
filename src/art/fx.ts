import { bayer } from '../engine/math';
import { PixelBuffer } from '../engine/pixels';
import { defineSheet } from '../engine/sprites';

/**
 * Procedural sprites: slash arcs are generated from geometry instead of drawn by hand,
 * so the up/down/forward variants and their sweep frames come for free.
 */
interface Arc {
  w: number;
  h: number;
  /** Arc centre in frame pixels (may lie outside the frame). */
  cx: number;
  cy: number;
  rIn: number;
  rOut: number;
  from: number;
  to: number;
  dither?: boolean;
}

function arc(a: Arc): string[] {
  const b = new PixelBuffer(a.w, a.h);
  for (let y = 0; y < a.h; y++) {
    for (let x = 0; x < a.w; x++) {
      const dx = x + 0.5 - a.cx;
      const dy = y + 0.5 - a.cy;
      const d = Math.hypot(dx, dy);
      if (d < a.rIn || d > a.rOut) continue;
      const ang = Math.atan2(dy, dx);
      if (ang < a.from || ang > a.to) continue;
      // taper the ends of the crescent
      const along = (ang - a.from) / (a.to - a.from);
      const taper = Math.sin(along * Math.PI);
      if (d < a.rOut - (a.rOut - a.rIn) * taper) continue;
      if (a.dither && bayer(x, y) < 0.5) continue;
      b.set(x, y, d > a.rOut - 2 ? 3 : 2);
    }
  }
  return b.toRows();
}

/** Three frames of a sweep: first half, full, fading tail. `reverse` sweeps the other way. */
function sweep(base: Omit<Arc, 'from' | 'to'>, from: number, to: number, reverse: boolean): string[][] {
  const span = to - from;
  const f1 = reverse ? { from: to - span * 0.55, to } : { from, to: from + span * 0.55 };
  const f3 = reverse ? { from, to: to - span * 0.45 } : { from: from + span * 0.45, to };
  return [arc({ ...base, ...f1 }), arc({ ...base, from, to }), arc({ ...base, ...f3, rIn: base.rOut - 3, dither: true })];
}

const FWD = { w: 28, h: 42, cx: -3, cy: 21, rIn: 13, rOut: 22 };
const [fa1, fa2, fa3] = sweep(FWD, -1.15, 1.15, false);
const [fb1, fb2, fb3] = sweep(FWD, -1.15, 1.15, true);

defineSheet('slash', {
  w: 28,
  h: 42,
  ox: -3,
  oy: 21,
  frames: { fa1, fa2, fa3, fb1, fb2, fb3 },
  anims: {
    a: { frames: ['fa1', 'fa2', 'fa3'], fps: 20, loop: false },
    b: { frames: ['fb1', 'fb2', 'fb3'], fps: 20, loop: false },
  },
});

const UP = { w: 44, h: 28, cx: 22, cy: 31, rIn: 13, rOut: 22 };
const [u1, u2, u3] = sweep(UP, -Math.PI + 0.4, -0.4, false);
defineSheet('slash-up', {
  w: 44,
  h: 28,
  ox: 22,
  oy: 31,
  frames: { u1, u2, u3 },
  anims: { a: { frames: ['u1', 'u2', 'u3'], fps: 20, loop: false } },
});

const DOWN = { w: 44, h: 28, cx: 22, cy: -3, rIn: 13, rOut: 22 };
const [d1, d2, d3] = sweep(DOWN, 0.4, Math.PI - 0.4, true);
defineSheet('slash-down', {
  w: 44,
  h: 28,
  ox: 22,
  oy: -3,
  frames: { d1, d2, d3 },
  anims: { a: { frames: ['d1', 'd2', 'd3'], fps: 20, loop: false } },
});

// A soft ring used for double-jump / pickups.
function ring(r: number, size: number): string[] {
  const b = new PixelBuffer(size, size);
  const c = (size - 1) / 2;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - c, y - c);
      if (Math.abs(d - r) < 0.6) b.set(x, y, 3);
    }
  return b.toRows();
}

defineSheet('ring', {
  w: 21,
  h: 21,
  ox: 10,
  oy: 10,
  frames: { r1: ring(3, 21), r2: ring(6, 21), r3: ring(9, 21) },
  anims: { pop: { frames: ['r1', 'r2', 'r3'], fps: 18, loop: false } },
});
