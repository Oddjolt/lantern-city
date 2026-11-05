import { PixelBuffer } from '../../../engine/pixels';
import { defineSheet } from '../../../engine/sprites';

/**
 * Mossgate art. Characters face RIGHT; the game mirrors them.
 * Creatures are drawn with a few shapes on a PixelBuffer (so every pose stays on-model) and get a
 * dark outline so they read against the leafy ground. Small props are hand-drawn ASCII.
 */

/** Draw into a w×h buffer, optionally outline in colour 0, and return the rows. */
function paint(w: number, h: number, f: (b: PixelBuffer) => void, outline = true): string[] {
  const b = new PixelBuffer(w, h);
  f(b);
  if (outline) b.outline(0);
  return b.toRows();
}

/** Upper half of an ellipse (domes, shells). */
function dome(b: PixelBuffer, cx: number, cy: number, rx: number, ry: number, c: number) {
  for (let y = Math.floor(cy - ry); y <= cy; y++)
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const nx = (x - cx) / (rx + 0.5);
      const ny = (y - cy) / (ry + 0.5);
      if (nx * nx + ny * ny <= 1) b.set(x, y, c);
    }
}

// ============================================================================================
// THORN HOUND — a lean bramble wolf. Patrols, rears up (telegraph), charges, pants.
// ============================================================================================
/** Body built from circles along a spine: [x, y, radius] from tail to snout. */
type Spine = [number, number, number][];

function spineBody(b: PixelBuffer, spine: Spine, c: number, grow = 0, dy = 0) {
  for (let i = 0; i + 1 < spine.length; i++) {
    const [x0, y0, r0] = spine[i];
    const [x1, y1, r1] = spine[i + 1];
    const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2) + 1;
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      const r = r0 + (r1 - r0) * t + grow;
      if (r <= 0.2) {
        b.set(Math.round(x0 + (x1 - x0) * t), Math.round(y0 + (y1 - y0) * t + dy), c);
        continue;
      }
      b.ellipse(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t + dy, r, r, c);
    }
  }
}

interface HoundPose {
  spine: Spine;
  /** back-far, front-far, back-near, front-near legs (polylines). */
  legs: number[][];
  mouth?: boolean;
  tongue?: boolean;
  /** Spike length along the back (1-3). */
  spikes?: number;
}

function hound(p: HoundPose): string[] {
  return paint(24, 16, (b) => {
    const s = p.spine;
    b.polyline(p.legs[0], 1);
    b.polyline(p.legs[1], 1);
    spineBody(b, s, 1, 0, 1); // underside shadow
    spineBody(b, s, 2, -0.2);
    b.polyline(p.legs[2], 2);
    b.polyline(p.legs[3], 2);
    // thorny mane along the back: from the hips to the neck
    const spikes = p.spikes ?? 2;
    for (let i = 2; i <= s.length - 3; i++) {
      const [x, y, r] = s[i];
      const top = Math.round(y - r);
      b.set(Math.round(x), top - 1, 2);
      b.set(Math.round(x) - 1, top - 2, spikes > 1 ? 2 : 3);
      if (spikes > 1) b.set(Math.round(x) - 2, top - 2 - (spikes > 2 ? 1 : 0), 3);
    }
    // head details
    const [hx, hy] = s[s.length - 2];
    const [sx, sy] = s[s.length - 1];
    b.set(Math.round(hx) - 1, Math.round(hy) - 3, 2); // ear
    b.set(Math.round(hx) - 2, Math.round(hy) - 4, 2);
    b.set(Math.round(hx) + 1, Math.round(hy) - 1, 3); // eye
    if (p.mouth) {
      b.line(Math.round(hx) + 1, Math.round(hy) + 1, Math.round(sx) + 1, Math.round(sy) + 1, 0);
      b.set(Math.round(sx), Math.round(sy) + 2, 2);
      b.set(Math.round(sx) - 1, Math.round(sy) + 2, 3); // fang
      if (p.tongue) b.set(Math.round(sx) - 1, Math.round(sy) + 3, 3);
    } else b.set(Math.round(sx) + 1, Math.round(sy), 2);
  });
}

const G = 15; // ground row inside the hound frame
const houndSpine = (lift: number, headDrop = 0, front = 0): Spine => [
  [1, 4 - lift, 0],
  [3, 6.5 - lift, 0.7],
  [6, 8 - lift, 1.8],
  [9, 8.6 - lift, 1.2],
  [12.5, 7.8 - lift - front * 0.5, 2.2],
  [15.5, 6.4 - lift - front + headDrop, 1.3],
  [17.8, 6.3 - lift - front + headDrop, 1.9],
  [20.6, 7.2 - lift - front + headDrop, 0.9],
];
defineSheet('hound', {
  w: 24,
  h: 16,
  ox: 11,
  oy: 16,
  frames: {
    walk1: hound({ spine: houndSpine(0), legs: [[7, 11, 8, 13, 9, G], [12, 11, 11, 13, 11, G], [6, 11, 4, 13, 4, G], [13, 11, 15, 13, 16, G]] }),
    walk2: hound({ spine: houndSpine(1), legs: [[7, 10, 6, 13, 6, G], [12, 10, 13, 13, 13, G], [6, 10, 7, 13, 7, G], [13, 10, 12, 13, 12, G]] }),
    walk3: hound({ spine: houndSpine(0), legs: [[7, 11, 5, 13, 4, G], [12, 11, 14, 13, 15, G], [6, 11, 8, 13, 9, G], [13, 11, 12, 13, 11, G]] }),
    rear1: hound({ spine: houndSpine(0, 0, 3), mouth: true, spikes: 3, legs: [[7, 11, 6, 13, 5, G], [12, 8, 15, 9, 16, 11], [6, 11, 7, 13, 7, G], [13, 8, 16, 8, 18, 10]] }),
    rear2: hound({ spine: houndSpine(0, -1, 4), mouth: true, spikes: 3, legs: [[7, 11, 6, 13, 5, G], [12, 7, 15, 8, 17, 10], [6, 11, 7, 13, 7, G], [13, 7, 16, 7, 18, 9]] }),
    run1: hound({ spine: houndSpine(1, 1), spikes: 3, legs: [[7, 10, 4, 12, 2, 13], [12, 10, 15, 12, 18, 13], [6, 10, 3, 11, 1, 12], [13, 10, 17, 11, 20, 12]] }),
    run2: hound({ spine: houndSpine(0, 1), spikes: 3, legs: [[7, 11, 9, 13, 10, G], [12, 11, 11, 13, 9, G], [6, 11, 8, 13, 9, G], [13, 11, 12, 14, 10, G]] }),
    pant1: hound({ spine: houndSpine(-1, 2), mouth: true, tongue: true, spikes: 1, legs: [[7, 12, 7, 14, 7, G], [12, 12, 12, 14, 12, G], [6, 12, 5, 14, 5, G], [13, 12, 14, 14, 14, G]] }),
    pant2: hound({ spine: houndSpine(-1, 3), mouth: true, spikes: 1, legs: [[7, 12, 7, 14, 7, G], [12, 12, 12, 14, 12, G], [6, 12, 5, 14, 5, G], [13, 12, 14, 14, 14, G]] }),
  },
  anims: {
    walk: { frames: ['walk1', 'walk2', 'walk3', 'walk2'], fps: 7 },
    alert: { frames: ['rear1', 'rear2'], fps: 10 },
    charge: { frames: ['run1', 'run2'], fps: 14 },
    recover: { frames: ['pant1', 'pant2'], fps: 5 },
  },
});

// ============================================================================================
// LOST WISP — a drifting spirit flame (lead's design, kept).
// ============================================================================================
const WISP_BODY = [
  '..2333333322..',
  '.23303330332..',
  '.23303330332..',
  '.23333333332..',
  '..233300332...',
  '..223333322...',
  '...2233322....',
  '....22222.....',
];
const WISP_TOP = {
  a: ['......2.......', '.....22..2....', '...2.232.22...', '...22333222...'],
  b: ['.......2......', '...2...22.....', '...22.232.2...', '...22333222...'],
  c: ['.....2........', '.....2..22....', '..2..232.2....', '...22333222...'],
};
const WISP_TAIL = {
  a: ['......21......', '.......1......'],
  b: ['.....12.......', '.....1........'],
  c: ['......2.......', '......1.......'],
};
const WISP_ANGRY = WISP_BODY.map((r, i) => (i === 1 ? '.23033303032..' : i === 4 ? '..230000032...' : r));
defineSheet('wisp', {
  w: 14,
  h: 14,
  ox: 7,
  oy: 7,
  frames: {
    f1: [...WISP_TOP.a, ...WISP_BODY, ...WISP_TAIL.a],
    f2: [...WISP_TOP.b, ...WISP_BODY, ...WISP_TAIL.b],
    f3: [...WISP_TOP.c, ...WISP_BODY, ...WISP_TAIL.c],
    g1: [...WISP_TOP.a, ...WISP_ANGRY, ...WISP_TAIL.a],
    g2: [...WISP_TOP.c, ...WISP_ANGRY, ...WISP_TAIL.b],
  },
  anims: {
    float: { frames: ['f1', 'f2', 'f3', 'f2'], fps: 8 },
    chase: { frames: ['g1', 'g2'], fps: 10 },
  },
});

// ============================================================================================
// OLD WICK, the lamplighter (a living candle) — lead's design, kept.
// ============================================================================================
const WICK_BODY = [
  '......1....1..',
  '...3333333.1..',
  '...3333333.1..',
  '...3303033.1..',
  '...3333333.1..',
  '...333333331..',
  '..23333333.1..',
  '..23333332.1..',
  '...3333332.1..',
  '...3333332.1..',
  '...2333332.1..',
  '...3333332.1..',
  '...3333322.1..',
  '..22222222.1..',
  '...2....2..1..',
  '...2....2..1..',
  '..22...22..1..',
];
const WICK_TALK = WICK_BODY.map((r, i) => (i === 4 ? '...3330333.1..' : r));
const WICK_FLAME = {
  a: ['......3.......', '.....33.......', '.....323..222.', '....23332.232.', '.....232..222.'],
  b: ['.......3......', '......33......', '.....323..222.', '....23332.232.', '.....232..222.'],
  c: ['..............', '.....3........', '.....333..222.', '....23332.232.', '.....232..222.'],
};
defineSheet('wick', {
  w: 14,
  h: 22,
  ox: 7,
  oy: 22,
  frames: {
    a: [...WICK_FLAME.a, ...WICK_BODY],
    b: [...WICK_FLAME.b, ...WICK_BODY],
    c: [...WICK_FLAME.c, ...WICK_BODY],
    ta: [...WICK_FLAME.a, ...WICK_TALK],
    tb: [...WICK_FLAME.b, ...WICK_TALK],
  },
  anims: {
    idle: { frames: ['a', 'b', 'a', 'c'], fps: 6 },
    talk: { frames: ['a', 'tb', 'b', 'ta'], fps: 8 },
  },
});

// ============================================================================================
// BRAMBLE BEETLE — thorny shell on top (can't be struck from above). Telegraphs, curls into a
// rolling thorn ball, then lands on its back dizzy: that's the moment to strike.
// ============================================================================================
interface BeetlePose {
  lift?: number;
  legs: number[][];
  thorns?: number;
  jx?: number;
}

function beetleWalk(p: BeetlePose): string[] {
  return paint(20, 14, (b) => {
    const lift = p.lift ?? 0;
    const jx = p.jx ?? 0;
    const cy = 10 - lift;
    for (const l of p.legs) b.polyline(l, 1);
    // head and mandibles
    b.ellipse(15 + jx, cy - 1, 2, 2, 1);
    b.set(16 + jx, cy - 2, 3);
    b.polyline([17 + jx, cy, 18 + jx, cy, 18 + jx, cy - 1], 2);
    // shell
    dome(b, 9 + jx, cy, 6.5, 6, 2);
    for (let x = 3; x <= 15; x++) b.set(x + jx, cy, 1);
    b.polyline([9 + jx, cy - 6, 9 + jx, cy - 1], 1);
    b.polyline([5 + jx, cy - 4, 7 + jx, cy - 3], 1);
    b.polyline([12 + jx, cy - 3, 13 + jx, cy - 4], 1);
    // thorns
    const t = p.thorns ?? 1;
    for (const [x, y] of [
      [5, cy - 5],
      [8, cy - 7],
      [11, cy - 7],
      [14, cy - 4],
    ]) {
      b.set(x + jx, y, 2);
      b.set(x + jx - 1, y - 1, t > 1 ? 2 : 3);
      if (t > 1) b.set(x + jx - 1, y - 2, 3);
    }
  });
}

function beetleBall(phase: number): string[] {
  return paint(20, 14, (b) => {
    const cx = 9.5;
    const cy = 7.5;
    b.ellipse(cx, cy, 4.6, 4.6, 2);
    // spinning segment lines
    for (let k = 0; k < 2; k++) {
      const a = phase * (Math.PI / 4) + k * (Math.PI / 2);
      b.line(cx + Math.cos(a) * 4, cy + Math.sin(a) * 4, cx - Math.cos(a) * 4, cy - Math.sin(a) * 4, 1);
    }
    // thorns all around
    for (let k = 0; k < 6; k++) {
      const a = phase * (Math.PI / 4) + (k * Math.PI) / 3;
      const x1 = cx + Math.cos(a) * 5.6;
      const y1 = cy + Math.sin(a) * 5.6;
      b.set(Math.round(x1), Math.round(y1), 2);
      b.set(Math.round(cx + Math.cos(a) * 6.8), Math.round(cy + Math.sin(a) * 6.8), 3);
    }
  });
}

function beetleDizzy(wiggle: number, star: number): string[] {
  return paint(20, 14, (b) => {
    // on its back: shell below, belly up, legs paddling the air
    for (let x = 3; x <= 15; x++)
      for (let y = 9; y <= 13; y++) {
        const nx = (x - 9) / 7;
        const ny = (y - 8) / 5.5;
        if (nx * nx + ny * ny <= 1) b.set(x, y, 2);
      }
    for (let x = 4; x <= 14; x++) b.set(x, 9, 1);
    b.rect(5, 8, 9, 1, 1);
    for (let i = 0; i < 3; i++) {
      const x = 6 + i * 3;
      const w = (i + wiggle) % 2 ? 1 : -1;
      b.polyline([x, 8, x + w, 6, x, 4 + (i === 1 ? wiggle : 0)], 1);
    }
    b.ellipse(16, 10, 1.6, 1.6, 1);
    b.set(17, 9, 3);
    // dizzy stars
    const sx = 4 + star * 5;
    b.set(sx, 1, 3);
    b.set(sx - 1, 2, 3);
    b.set(sx + 1, 2, 3);
    b.set(sx, 3, 3);
    b.set(sx, 2, 2);
    b.set(18 - star * 5, 3, 3);
  }, true);
}

const BL = 13; // beetle ground row
defineSheet('outskirts-beetle', {
  w: 20,
  h: 14,
  ox: 10,
  oy: 14,
  frames: {
    walk1: beetleWalk({ legs: [[5, 10, 4, 12, 3, BL], [9, 10, 9, 12, 10, BL], [13, 10, 14, 12, 15, BL]] }),
    walk2: beetleWalk({ lift: 1, legs: [[5, 9, 5, 11, 5, BL], [9, 9, 8, 11, 7, BL], [13, 9, 13, 11, 13, BL]] }),
    walk3: beetleWalk({ legs: [[5, 10, 6, 12, 6, BL], [9, 10, 10, 12, 11, BL], [13, 10, 12, 12, 12, BL]] }),
    alert1: beetleWalk({ lift: 2, thorns: 2, legs: [[5, 8, 3, 11, 2, BL], [9, 8, 9, 11, 9, BL], [13, 8, 15, 11, 16, BL]] }),
    alert2: beetleWalk({ lift: 2, thorns: 2, jx: 1, legs: [[6, 8, 4, 11, 3, BL], [10, 8, 10, 11, 10, BL], [14, 8, 16, 11, 17, BL]] }),
    roll1: beetleBall(0),
    roll2: beetleBall(1),
    roll3: beetleBall(2),
    roll4: beetleBall(3),
    dizzy1: beetleDizzy(0, 0),
    dizzy2: beetleDizzy(1, 1),
  },
  anims: {
    walk: { frames: ['walk1', 'walk2', 'walk3', 'walk2'], fps: 6 },
    alert: { frames: ['alert1', 'alert2'], fps: 14 },
    roll: { frames: ['roll1', 'roll2', 'roll3', 'roll4'], fps: 16 },
    dizzy: { frames: ['dizzy1', 'dizzy2'], fps: 5 },
  },
});

// ============================================================================================
// MOSS CROW — perches, caws (telegraph), swoops at where you stood, flaps back to its perch.
// ============================================================================================
/** Scanline-fill a polygon given as [x0,y0, x1,y1, ...]. */
function poly(b: PixelBuffer, pts: number[], c: number) {
  const n = pts.length / 2;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (let i = 0; i < n; i++) {
    y0 = Math.min(y0, pts[i * 2 + 1]);
    y1 = Math.max(y1, pts[i * 2 + 1]);
  }
  for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
    const xs: number[] = [];
    for (let i = 0; i < n; i++) {
      const ax = pts[i * 2];
      const ay = pts[i * 2 + 1];
      const bx = pts[((i + 1) % n) * 2];
      const by = pts[((i + 1) % n) * 2 + 1];
      if ((ay <= y + 0.5 && by > y + 0.5) || (by <= y + 0.5 && ay > y + 0.5)) xs.push(ax + ((y + 0.5 - ay) / (by - ay)) * (bx - ax));
    }
    xs.sort((a, b2) => a - b2);
    for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.round(xs[k]); x <= Math.round(xs[k + 1]); x++) b.set(x, y, c);
  }
  b.polyline([...pts, pts[0], pts[1]], c);
}

interface CrowPose {
  /** Body centre, head centre, body tilt (radians, positive = nose down). */
  bx: number;
  by: number;
  hx: number;
  hy: number;
  /** Wing as a polygon (absolute frame coordinates), drawn in the dark colour with a pale edge. */
  wing: number[];
  /** Far wing, drawn behind the body. */
  farWing?: number[];
  beakOpen?: boolean;
  legs?: boolean;
  blink?: boolean;
  tail: number[];
}

function crow(p: CrowPose): string[] {
  return paint(22, 18, (b) => {
    if (p.farWing) poly(b, p.farWing, 1);
    poly(b, p.tail, 1);
    if (p.legs) {
      b.polyline([p.bx - 1, p.by + 3, p.bx - 1, 17], 1);
      b.polyline([p.bx + 1, p.by + 3, p.bx + 2, 17], 1);
    }
    b.ellipse(p.bx, p.by, 4.4, 3.2, 2);
    b.ellipse(p.hx, p.hy, 2.5, 2.3, 2);
    if (p.beakOpen) {
      b.polyline([p.hx + 2, p.hy - 1, p.hx + 5, p.hy - 2], 3);
      b.polyline([p.hx + 2, p.hy + 1, p.hx + 4, p.hy + 2], 3);
      b.set(p.hx + 3, p.hy, 0);
    } else b.polyline([p.hx + 2, p.hy, p.hx + 4, p.hy, p.hx + 5, p.hy + 1], 3);
    b.set(p.hx + 1, p.hy - 1, p.blink ? 2 : 0);
    if (!p.blink) b.set(p.hx + 1, p.hy - 2, 3);
    poly(b, p.wing, 1);
  });
}

const FOLDED = (bx: number, by: number) => [bx - 3, by - 2, bx + 2, by - 2, bx + 1, by + 1, bx - 7, by + 3];
const PERCH_TAIL = [6, 13, 1, 15, 2, 16, 7, 14];
defineSheet('outskirts-crow', {
  w: 22,
  h: 18,
  ox: 11,
  oy: 18,
  frames: {
    perch1: crow({ bx: 10, by: 12, hx: 14, hy: 8, wing: FOLDED(10, 12), legs: true, tail: PERCH_TAIL }),
    perch2: crow({ bx: 10, by: 12, hx: 14, hy: 9, wing: FOLDED(10, 12), legs: true, tail: PERCH_TAIL }),
    blink: crow({ bx: 10, by: 12, hx: 14, hy: 8, wing: FOLDED(10, 12), legs: true, blink: true, tail: PERCH_TAIL }),
    caw1: crow({ bx: 10, by: 12, hx: 14, hy: 7, beakOpen: true, legs: true, tail: [6, 13, 1, 11, 1, 13, 6, 14], wing: [8, 10, 3, 2, 6, 3, 9, 1, 12, 10], farWing: [11, 10, 13, 3, 15, 5, 13, 10] }),
    caw2: crow({ bx: 10, by: 11, hx: 15, hy: 6, beakOpen: true, legs: true, tail: [6, 12, 0, 9, 1, 12, 6, 13], wing: [8, 9, 1, 1, 5, 2, 8, 0, 12, 9], farWing: [11, 9, 14, 2, 16, 4, 13, 9] }),
    swoop: crow({ bx: 11, by: 9, hx: 16, hy: 11, tail: [7, 8, 1, 5, 2, 8, 7, 10], wing: [9, 8, 1, 4, 3, 7, 13, 9] }),
    fly1: crow({ bx: 10, by: 10, hx: 15, hy: 8, tail: [6, 10, 1, 9, 1, 12, 6, 11], wing: [8, 9, 4, 1, 7, 2, 10, 0, 13, 9] }),
    fly2: crow({ bx: 10, by: 10, hx: 15, hy: 8, tail: [6, 10, 1, 9, 1, 12, 6, 11], wing: [7, 9, 0, 8, 2, 10, 13, 10] }),
    fly3: crow({ bx: 10, by: 10, hx: 15, hy: 8, tail: [6, 10, 1, 9, 1, 12, 6, 11], wing: [8, 10, 4, 17, 7, 16, 9, 17, 13, 10] }),
  },
  anims: {
    perch: { frames: ['perch1', 'perch1', 'perch2', 'perch1', 'blink', 'perch2'], fps: 4 },
    caw: { frames: ['caw1', 'caw2'], fps: 9 },
    swoop: { frames: ['swoop'], fps: 1 },
    fly: { frames: ['fly1', 'fly2', 'fly3', 'fly2'], fps: 12 },
  },
});

// ============================================================================================
// PIP — a shy mushroom child who keeps the shrine.
// ============================================================================================
const PIP_CAP = [
  '..............',
  '.....2222.....',
  '...22332222...',
  '..2233322222..',
  '.222222223322.',
  '.223322222332.',
  '22222222222222',
  '.1111111111111',
];
const PIP_FACE = {
  open: ['...33333333...', '...30333303...', '...33333333...', '....333333....'],
  blink: ['...33333333...', '...33333333...', '...30333303...', '....333333....'],
  talk: ['...33333333...', '...30333303...', '...33300333...', '....333333....'],
};
const PIP_BODY = {
  a: ['....222222....', '...21222212...', '...2.2222.2...', '....122221....', '....2....2....', '...22....22...'],
  b: ['....222222....', '...21222212...', '..2..2222..2..', '....122221....', '....2....2....', '...22....22...'],
};
const capShift = (rows: string[], dx: number) => rows.map((r) => (dx > 0 ? '.' + r.slice(0, -1) : dx < 0 ? r.slice(1) + '.' : r));
defineSheet('outskirts-pip', {
  w: 14,
  h: 18,
  ox: 7,
  oy: 18,
  frames: {
    i1: [...PIP_CAP, ...PIP_FACE.open, ...PIP_BODY.a],
    i2: [...capShift(PIP_CAP, 1).map((r, i) => (i === 0 ? '..............' : r)), ...PIP_FACE.open, ...PIP_BODY.a],
    i3: [...PIP_CAP, ...PIP_FACE.blink, ...PIP_BODY.a],
    t1: [...PIP_CAP, ...PIP_FACE.talk, ...PIP_BODY.b],
    t2: [...['..............', ...PIP_CAP.slice(0, 7)], ...PIP_FACE.open, ...PIP_BODY.a],
  },
  anims: {
    idle: { frames: ['i1', 'i1', 'i2', 'i2', 'i1', 'i3', 'i1', 'i2'], fps: 4 },
    talk: { frames: ['t1', 't2', 't1', 'i1'], fps: 8 },
  },
});

// ============================================================================================
// Props
// ============================================================================================

/** A crumbling root knot (replaces the generic crumble block). */
defineSheet('outskirts-roots', {
  w: 8,
  h: 8,
  ox: 0,
  oy: 0,
  frames: {
    a: ['22222222', '21111221', '12211112', '21112211', '.211112.', '..2..1..', '..1..2..', '.....1..'],
    b: ['22202222', '2111.221', '1221.112', '21.12211', '.21.112.', '..2..1..', '.....2..', '........'],
    c: ['220.2222', '2.11.2.1', '12.1.11.', '2.1.2.1.', '.2..11..', '.....1..', '........', '........'],
  },
  anims: { idle: { frames: ['a'], fps: 1 }, shake: { frames: ['b', 'c'], fps: 10 } },
});

defineSheet('outskirts-bench', {
  w: 20,
  h: 10,
  ox: 10,
  oy: 10,
  frames: {
    a: [
      '..2................2',
      '.22222222222222222.2',
      '.2111111111111112..2',
      '.22222222222222222.2',
      '.2...............222',
      '22222222222222222222',
      '21111111111111111112',
      '.2..............2...',
      '.2..............2...',
      '22.............22...',
    ],
  },
  anims: { idle: { frames: ['a'], fps: 1 } },
});

/** Street lamp; the glass flickers. Used by the custom lamp-post entity (halo at the head). */
function lampPost(glass: number): string[] {
  return paint(11, 34, (b) => {
    b.rect(5, 8, 1, 23, 2);
    b.rect(4, 12, 1, 1, 1);
    b.rect(6, 18, 1, 1, 1);
    b.rect(3, 30, 5, 2, 2);
    b.rect(2, 32, 7, 2, 2);
    b.rect(3, 33, 5, 1, 1);
    // head
    b.rect(2, 2, 7, 1, 2);
    b.rect(3, 1, 5, 1, 2);
    b.set(5, 0, 2);
    b.rect(2, 3, 1, 4, 2);
    b.rect(8, 3, 1, 4, 2);
    b.rect(3, 3, 5, 4, glass);
    if (glass === 3) {
      b.set(4, 4, 2);
      b.set(6, 5, 2);
    }
    b.rect(2, 7, 7, 1, 2);
    b.rect(4, 8, 3, 1, 2);
    // vine creeping up the pole
    for (let y = 14; y < 31; y++) if ((y * 7) % 5 < 2) b.set(4 + (y % 3 === 0 ? 2 : 0), y, 1);
  }, false);
}
defineSheet('outskirts-lamppost', {
  w: 11,
  h: 34,
  ox: 5,
  oy: 34,
  frames: { a: lampPost(3), b: lampPost(2), off: lampPost(1) },
  anims: { glow: { frames: ['a', 'a', 'a', 'a', 'a', 'b', 'a', 'a'], fps: 8 }, off: { frames: ['off'], fps: 1 } },
});

defineSheet('outskirts-grave', {
  w: 12,
  h: 14,
  ox: 6,
  oy: 14,
  frames: {
    cross: [
      '.....22.....',
      '.....12.....',
      '..22222222..',
      '..11111221..',
      '.....12.....',
      '.....12.....',
      '.....12.....',
      '.....12.....',
      '.....12.....',
      '....2122....',
      '...212121...',
      '....12.1....',
      '..21212121..',
      '.2222222222.',
    ],
    stone: [
      '............',
      '...222222...',
      '..21111112..',
      '.2111111112.',
      '.2122112112.',
      '.2111111112.',
      '.2112211112.',
      '.2111111112.',
      '.2111112112.',
      '.2121111112.',
      '.2111111122.',
      '.2121121212.',
      '.2222222222.',
      '222222222222',
    ],
    tilted: [
      '............',
      '............',
      '......222...',
      '.....21112..',
      '....211111..',
      '...2111211..',
      '...2112112..',
      '..2111111...',
      '..2121112...',
      '.2111112....',
      '.21121122...',
      '.2121121222.',
      '.222222222..',
      '222222222222',
    ],
  },
  anims: { cross: { frames: ['cross'], fps: 1 }, stone: { frames: ['stone'], fps: 1 }, tilted: { frames: ['tilted'], fps: 1 } },
});

/** Fern fronds that sway in the wind. */
function fern(sway: number): string[] {
  return paint(14, 10, (b) => {
    const fronds: [number, number][] = [
      [-5, -4],
      [-2, -7],
      [2, -8],
      [5, -5],
      [6, -2],
    ];
    for (const [dx, dy] of fronds) {
      const ex = 7 + dx + sway;
      const ey = 9 + dy;
      b.line(7, 9, ex, ey, 2);
      // leaflets
      const steps = Math.max(Math.abs(dx), Math.abs(dy));
      for (let i = 1; i < steps; i += 2) {
        const t = i / steps;
        const x = Math.round(7 + (ex - 7) * t);
        const y = Math.round(9 + (ey - 9) * t);
        b.set(x - 1, y, 1);
        b.set(x + 1, y, 1);
      }
    }
  }, false);
}
defineSheet('outskirts-fern', {
  w: 14,
  h: 10,
  ox: 7,
  oy: 10,
  frames: { a: fern(0), b: fern(1), c: fern(0), d: fern(-1) },
  anims: { sway: { frames: ['a', 'b', 'c', 'd'], fps: 3 } },
});

/** A torn cloth banner with the lantern crest, hanging from a ceiling. */
function banner(sway: number): string[] {
  return paint(10, 24, (b) => {
    b.rect(0, 0, 10, 1, 2);
    for (let y = 1; y < 22; y++) {
      const off = Math.round(Math.sin(y / 5) * sway);
      const torn = y > 17 ? (y % 3 === 0 ? 3 : 1) : 0;
      for (let x = 1 + torn; x < 9 - (y > 19 ? 2 : 0); x++) b.set(x + off, y, x === 1 || x === 8 ? 2 : 1);
    }
    // crest: a little lantern
    const o = Math.round(Math.sin(8 / 5) * sway);
    b.rect(4 + o, 6, 2, 1, 2);
    b.rect(3 + o, 7, 4, 4, 2);
    b.rect(4 + o, 8, 2, 2, 3);
    b.rect(4 + o, 11, 2, 1, 2);
  }, false);
}
defineSheet('outskirts-banner', {
  w: 10,
  h: 24,
  ox: 5,
  oy: 0,
  frames: { a: banner(0), b: banner(1), c: banner(0), d: banner(-1) },
  anims: { sway: { frames: ['a', 'b', 'c', 'd'], fps: 2 } },
});

/** Drooping bell flowers that glow softly. */
defineSheet('outskirts-bellflower', {
  w: 12,
  h: 12,
  ox: 6,
  oy: 12,
  frames: {
    a: [
      '...222......',
      '..2...2.....',
      '.2....22....',
      '.3.....2....',
      '333....2..2.',
      '.2.....2.2..',
      '.......22...',
      '..2....2..2.',
      '.333...2.333',
      '..3....2..3.',
      '....1..2....',
      '...1.1121...',
    ],
    b: [
      '...222......',
      '..2...2.....',
      '.2....22....',
      '.2.....2....',
      '323....2..2.',
      '.3.....2.2..',
      '.......22...',
      '..2....2..2.',
      '.323...2.323',
      '..3....2..3.',
      '....1..2....',
      '...1.1121...',
    ],
  },
  anims: { glow: { frames: ['a', 'a', 'a', 'b', 'a', 'b'], fps: 3 } },
});

/** A broken mine cart, propped on a stone where its wheel came off; the wheel lies in the moss. */
defineSheet('outskirts-cart', {
  w: 28,
  h: 16,
  ox: 14,
  oy: 16,
  frames: {
    a: [
      '............................',
      '.....2.2..22.2...2...2......',
      '..2222222222222222222222....',
      '...2111112111112111112......',
      '...2111112111112111112......',
      '...2101112111112111012......',
      '....21111211111211112.......',
      '....21111211111211112.......',
      '....222222222222222222......',
      '.....1.111.......111.1......',
      '.....222........12221.......',
      '....2.1.2.......21112.......',
      '....21012.......21112.......',
      '....2.1.2.......21112..2222.',
      '.....222.......2222222212221',
      '...11111111111111111111.111.',
    ],
  },
  anims: { idle: { frames: ['a'], fps: 1 } },
});

/** The old station clock on a post, stopped at the hour the lights went out. Background prop. */
defineSheet('outskirts-clock', {
  w: 22,
  h: 40,
  ox: 11,
  oy: 40,
  frames: {
    a: paint(22, 40, (b) => {
      b.rect(10, 18, 2, 21, 1);
      b.rect(8, 37, 6, 3, 1);
      b.ellipse(11, 10, 9, 9, 1);
      b.ellipse(11, 10, 7, 7, 0);
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2;
        b.set(Math.round(11 + Math.cos(a) * 6), Math.round(10 + Math.sin(a) * 6), 1);
      }
      b.line(11, 10, 11, 5, 1);
      b.line(11, 10, 14, 12, 1);
      // a crack across the face
      b.polyline([4, 7, 7, 9, 9, 8, 12, 11], 1);
      b.rect(8, 0, 6, 1, 1);
    }, false),
  },
  anims: { idle: { frames: ['a'], fps: 1 } },
});

/** A broken stone arch, behind the terrain (background colour only). */
defineSheet('outskirts-arch', {
  w: 44,
  h: 46,
  ox: 22,
  oy: 46,
  frames: {
    a: paint(44, 46, (b) => {
      const brick = (x: number, y: number, w: number, h: number) => {
        b.rect(x, y, w, h, 1);
        for (let j = y; j < y + h; j += 4) for (let i = x + ((j / 4) % 2 ? 2 : 0); i < x + w; i += 6) b.set(i, j, 0);
        for (let j = y + 3; j < y + h; j += 4) b.rect(x, j, w, 1, 0);
      };
      brick(2, 14, 8, 32);
      brick(32, 22, 8, 24);
      // arch ring (left half intact, right half broken off)
      for (let a = Math.PI; a <= Math.PI * 1.72; a += 0.02) {
        for (let r = 12; r <= 19; r++) b.set(Math.round(21 + Math.cos(a) * r), Math.round(16 + Math.sin(a) * r), r === 12 || r === 19 ? 0 : 1);
      }
      b.rect(0, 44, 12, 2, 1);
      b.rect(30, 44, 12, 2, 1);
      // fallen keystone
      b.rect(23, 41, 5, 5, 1);
      b.rect(24, 42, 3, 1, 0);
      // ivy
      for (let y = 6; y < 40; y++) if ((y * 13) % 7 < 3) b.set(3 + ((y * 5) % 4), y, 2);
    }, false),
  },
  anims: { idle: { frames: ['a'], fps: 1 } },
});

// ---- the lead's original props, kept ---------------------------------------------------------
defineSheet('mushrooms', {
  w: 12,
  h: 8,
  ox: 6,
  oy: 8,
  frames: {
    a: ['............', '..333.......', '.32223..33..', '..2.2..3223.', '...2....22..', '...2..2..2..', '...2.333.2..', '..1112221...'],
    b: ['............', '..333.......', '.33233..33..', '..2.2..3333.', '...2....22..', '...2..2..2..', '...2.333.2..', '..1112221...'],
  },
  anims: { glow: { frames: ['a', 'a', 'a', 'b'], fps: 3 } },
});

defineSheet('statue', {
  w: 14,
  h: 26,
  ox: 7,
  oy: 26,
  frames: {
    a: [
      '.....1111.....',
      '....111111....',
      '....101101....',
      '....111111....',
      '.....1111.....',
      '...11111111...',
      '..1111111111..',
      '..11.1111.11..',
      '..1..1111..1..',
      '..1..1111..1..',
      '.....1111.....',
      '.....1111.....',
      '.....11.1.....',
      '.....11.1.....',
      '.....11.11....',
      '.....1...1....',
      '...........1..',
      '...2222222222.',
      '...2111111112.',
      '...2122221212.',
      '...2111111112.',
      '...2222222222.',
      '....21111112..',
      '....21111112..',
      '...2222222222.',
      '..222222222222',
    ],
  },
  anims: { idle: { frames: ['a'], fps: 1 } },
});

/** A tall stone column holding up the station canopy. Background prop. */
defineSheet('outskirts-pillar', {
  w: 12,
  h: 58,
  ox: 6,
  oy: 58,
  frames: {
    a: paint(12, 58, (b) => {
      b.rect(0, 0, 12, 3, 1);
      b.rect(1, 3, 10, 1, 0);
      b.rect(2, 4, 8, 50, 1);
      for (let y = 8; y < 54; y += 6) b.rect(2, y, 8, 1, 0);
      for (let y = 5; y < 54; y += 2) b.set(4, y, 0);
      b.rect(0, 54, 12, 4, 1);
      b.rect(1, 55, 10, 1, 0);
      // ivy
      for (let y = 6; y < 50; y++) if ((y * 11) % 9 < 3) b.set(2 + ((y * 7) % 3) * 3, y, 2);
    }, false),
  },
  anims: { idle: { frames: ['a'], fps: 1 } },
});

/** Lily pads floating on the mossy pools (placed in the cell just above the water). */
defineSheet('outskirts-lily', {
  w: 12,
  h: 4,
  ox: 6,
  oy: 3,
  frames: {
    a: ['....3.......', '.22232222...', '211121.112..', '.222222222..'],
    b: ['............', '...2222.222.', '..2111.1112.', '...2222222..'],
  },
  anims: { a: { frames: ['a'], fps: 1 }, b: { frames: ['b'], fps: 1 } },
});

/** Cattails at the water's edge, nodding in the wind. */
function reeds(sway: number): string[] {
  return paint(13, 18, (b) => {
    const stems: [number, number, number][] = [
      [3, 4, -1],
      [6, 1, 0],
      [9, 5, 1],
    ];
    for (const [x, top, lean] of stems) {
      const tx = x + lean + sway;
      b.line(x, 17, tx, top + 3, 2);
      b.rect(tx, top, 1, 4, 1);
      b.set(tx, top - 1, 2);
    }
    b.line(1, 17, 0 + sway, 11, 1);
    b.line(11, 17, 12 + sway, 12, 1);
  }, false);
}
defineSheet('outskirts-reeds', {
  w: 13,
  h: 18,
  ox: 6,
  oy: 18,
  frames: { a: reeds(0), b: reeds(1), c: reeds(0), d: reeds(-1) },
  anims: { sway: { frames: ['a', 'b', 'c', 'd'], fps: 2 } },
});

// ============================================================================================
// DUSK — a sleepy moth who dozes by the station lamps. Drawn as a left half, mirrored.
// ============================================================================================
const mirror = (left: string[]) => left.map((r) => r + [...r].reverse().join(''));
const MOTH_TOP = ['.1......', '..1.....', '..11....', '...1..33', '....1333'];
const MOTH_EYES = { open: '.22.3303', shut: '.22.3113', half: '.22.3103' };
const MOTH_WINGS = {
  spread: ['2112.333', '21112333', '21111233', '21121233', '.2111233', '.2112.33', '..21..32', '...2..23', '......2.', '.....2.2'],
  rest: ['.11..333', '.2112333', '.2111233', '.21121233'.slice(1), '..211233', '..2112.3', '...21.32', '....2.23', '......2.', '.....2.2'],
};
const moth = (eyes: keyof typeof MOTH_EYES, wings: keyof typeof MOTH_WINGS, mouth = false) => {
  const rows = mirror([...MOTH_TOP, MOTH_EYES[eyes], ...MOTH_WINGS[wings]]);
  if (mouth) rows[7] = rows[7].slice(0, 7) + '00' + rows[7].slice(9);
  return rows;
};
defineSheet('outskirts-moth', {
  w: 16,
  h: 16,
  ox: 8,
  oy: 16,
  frames: {
    sleep1: moth('shut', 'rest'),
    sleep2: moth('shut', 'spread'),
    peek: moth('half', 'rest'),
    open: moth('open', 'spread'),
    talk: moth('open', 'spread', true),
  },
  anims: {
    idle: { frames: ['sleep1', 'sleep1', 'sleep2', 'sleep2', 'sleep1', 'sleep1', 'peek', 'sleep1'], fps: 2 },
    talk: { frames: ['talk', 'open'], fps: 7 },
  },
});
