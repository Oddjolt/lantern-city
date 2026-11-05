import { bayer, hash2 } from '../../../engine/math';
import type { PixelBuffer } from '../../../engine/pixels';
import type { Backdrop } from '../../../game/registry';

/**
 * Far: a vaulted brick cistern — a colonnade of arches, a great round culvert pouring water,
 * service pipes along the vault and still water at the bottom.
 * Near: vertical pipes with valve wheels, gauges and hanging chains.
 * Colour 1 only, mostly outlines: the terrain in front must stay the loudest thing on screen.
 */

const C = 1;
const WRAP = 640;

function setw(b: PixelBuffer, x: number, y: number) {
  b.set(((x % WRAP) + WRAP) % WRAP, y, C);
}

function ring(b: PixelBuffer, cx: number, cy: number, r: number, dotted = false) {
  const steps = Math.ceil(r * 8);
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const x = Math.round(cx + Math.cos(a) * r);
    const y = Math.round(cy + Math.sin(a) * r);
    if (dotted && (x + y) & 1) continue;
    setw(b, x, y);
  }
}

/** One bay of the colonnade: two pillars and a round arch, with a few brick courses hinted in. */
function bay(b: PixelBuffer, x0: number, span: number, top: number, i: number) {
  const pw = 12;
  const springY = top + span / 2;
  for (const px of [x0, x0 + span + pw]) {
    for (let y = springY; y < 168; y++) {
      setw(b, px, y);
      setw(b, px + pw - 1, y);
    }
    // capital and base
    for (let x = px - 2; x < px + pw + 2; x++) {
      setw(b, x, springY);
      setw(b, x, springY + 2);
      setw(b, x, 166);
    }
    // brick courses on the pillar, sparse
    for (let y = springY + 8; y < 164; y += 6) {
      if (hash2(px, y, i) < 0.55) for (let x = px + 2; x < px + pw - 2; x += 2) setw(b, x, y);
    }
  }
  // the arch: two concentric half circles between the pillars' inner edges
  const cx = x0 + pw + span / 2;
  const r = span / 2;
  for (const rr of [r, r + pw - 2]) {
    const steps = Math.ceil(rr * 4);
    for (let k = 0; k <= steps; k++) {
      const a = Math.PI + (k / steps) * Math.PI;
      setw(b, Math.round(cx + Math.cos(a) * rr), Math.round(springY + Math.sin(a) * rr));
    }
  }
  // voussoir lines radiating through the arch ring
  for (let k = 1; k < 9; k++) {
    const a = Math.PI + (k / 9) * Math.PI;
    for (let d = r + 2; d < r + pw - 3; d++) setw(b, Math.round(cx + Math.cos(a) * d), Math.round(springY + Math.sin(a) * d));
  }
}

export const underworksBackdrop: Backdrop = {
  farScroll: 0.14,
  nearScroll: 0.38,
  far(b) {
    // vault ceiling: a heavy beam with rivets, and a service pipe below it
    for (let x = 0; x < WRAP; x++) {
      setw(b, x, 6);
      setw(b, x, 12);
      if (x % 12 === 0) setw(b, x, 9);
      setw(b, x, 18);
      setw(b, x, 24);
      if (x % 80 < 3) for (let y = 16; y < 27; y++) setw(b, x, y);
      else if ((x & 3) === 1) setw(b, x, 20);
    }
    // colonnade of arches: five bays whose pillars land exactly on the 640px wrap
    const spans = [108, 124, 112, 120, 116];
    let x = 0;
    spans.forEach((span, i) => {
      bay(b, x, span, 44 + (i % 2) * 6, i);
      x += span + 12;
    });
    // the great culvert, seen through the fourth arch
    const cx = 12 * 4 + 108 + 124 + 112 + 60 + 6;
    const cy = 108;
    ring(b, cx, cy, 31);
    ring(b, cx, cy, 27);
    ring(b, cx, cy, 20, true);
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2;
      setw(b, Math.round(cx + Math.cos(a) * 29), Math.round(cy + Math.sin(a) * 29));
    }
    // a smaller outlet pipe through the second arch, dribbling
    const ox = 12 * 2 + 108 + 62;
    ring(b, ox, 120, 11);
    ring(b, ox, 120, 8);
    for (let y = 132; y < 166; y++) if (y % 5 < 3) setw(b, ox + ((y >> 3) & 1), y);
    // grate bars across the culvert mouth
    for (let gx = cx - 16; gx <= cx + 16; gx += 6) {
      const h = Math.floor(Math.sqrt(Math.max(0, 20 * 20 - (gx - cx) ** 2)));
      for (let y = cy - h; y <= cy + h; y++) if (bayer(gx, y) < 0.75) setw(b, gx, y);
    }
    // water spilling from the culvert down into the pool
    for (let k = 0; k < 9; k++) {
      const wx = cx - 14 + k * 3 + (k % 2);
      for (let y = cy + 22; y < 166; y++) if ((y + k * 5) % 7 < 4) setw(b, wx, y);
    }
    // still water at the bottom: broken horizontal ripples
    for (let y = 168; y < 180; y += 3) {
      for (let wx = 0; wx < WRAP; wx++) {
        const r = hash2(Math.floor(wx / 9), y, 4);
        if (r < 0.45 && (wx + y) % 2 === 0) setw(b, wx, y);
      }
    }
    // stains and drip trails below the beam
    for (let k = 0; k < 26; k++) {
      const dx = Math.floor(hash2(k, 1, 9) * WRAP);
      const len = 6 + Math.floor(hash2(k, 2, 9) * 22);
      for (let y = 26; y < 26 + len; y += 2) setw(b, dx, y);
    }
  },
  near(b) {
    // two vertical pipe stacks with flanges, a valve wheel and a gauge
    for (const px of [150, 452]) {
      for (let y = 0; y < 180; y++) {
        setw(b, px, y);
        setw(b, px + 7, y);
        if (y % 46 < 2) for (let x = px - 2; x <= px + 9; x++) setw(b, x, y);
        else if (y % 3 === 0) setw(b, px + 2, y);
      }
      // brackets into the wall
      for (const by of [30, 120]) for (let x = px + 8; x < px + 18; x++) setw(b, x, by);
      // valve wheel on a stub
      const vy = 78;
      for (let x = px - 9; x < px; x++) setw(b, x, vy);
      ring(b, px - 13, vy, 5);
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * Math.PI * 2 + 0.4;
        for (let d = 1; d < 5; d++) setw(b, Math.round(px - 13 + Math.cos(a) * d), Math.round(vy + Math.sin(a) * d));
      }
      // gauge
      ring(b, px + 3, 140, 4);
      setw(b, px + 4, 139);
      setw(b, px + 5, 138);
    }
    // hanging chains with hooks
    for (const [hx, len] of [
      [60, 70],
      [92, 38],
      [300, 56],
      [360, 84],
      [560, 46],
    ] as const) {
      for (let y = 0; y < len; y++) if (y % 3 !== 2) setw(b, hx + (Math.floor(y / 3) % 2), y);
      setw(b, hx - 1, len);
      setw(b, hx - 2, len - 1);
      setw(b, hx + 1, len + 1);
      setw(b, hx + 2, len);
      setw(b, hx + 2, len - 1);
    }
    // a sagging cable between the stacks
    for (let x = 158; x <= 452; x++) {
      const t = (x - 158) / (452 - 158);
      setw(b, x, Math.round(14 + 30 * 4 * t * (1 - t)));
    }
  },
};
