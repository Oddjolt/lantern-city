import { bayer, hash2 } from '../../../engine/math';
import { PixelBuffer } from '../../../engine/pixels';
import { defineSheet } from '../../../engine/sprites';

/**
 * Frostbell Spire sprites. Characters are hand-drawn ASCII or paper dolls (stamped parts plus
 * line limbs); bells, gears and the clock are generated from geometry so their swing / turn
 * frames come for free. Everything faces RIGHT.
 */

/** Overlay stamp rows onto a copy of `base` at (x, y). */
function over(base: string[], x: number, y: number, rows: string[]): string[] {
  const b = PixelBuffer.fromRows(base);
  b.stamp(rows, x, y);
  return b.toRows();
}

// =============================================================================================
// FROST OWL — perches, glares, then swoops in an arc
// =============================================================================================
const OWL_BODY = [
  '.2......2.',
  '.22....22.',
  '.22222222.',
  '2222222222',
  '2EEE22EEE2',
  '2EEE22EEE2',
  '2EEE11EEE2',
  '1222112221',
  '1122222211',
  '1121221211',
  '1122222211',
  '.11212211.',
  '..111111..',
];
const OWL_EYES: Record<string, string[]> = {
  open: ['333', '303', '333'],
  look: ['333', '330', '333'],
  glare: ['333', '333', '333'],
  blink: ['222', '111', '222'],
};

type WingPose = 'fold' | 'raised' | 'up' | 'down' | 'swept';
/** LEFT wing outline (mirrored for the right wing) and the feather lines drawn over it. */
const OWL_WINGS: Record<WingPose, { poly: number[]; feathers: number[][] }> = {
  fold: { poly: [], feathers: [] },
  raised: {
    poly: [6, 7, 2, 1, 0, 2, 0, 5, 1, 8, 3, 11, 6, 12],
    feathers: [
      [5, 9, 1, 4],
      [5, 10, 1, 7],
      [5, 11, 3, 10],
    ],
  },
  up: {
    poly: [6, 8, 4, 0, 2, 0, 0, 3, 1, 6, 3, 9, 6, 11],
    feathers: [
      [5, 9, 2, 2],
      [5, 10, 1, 5],
    ],
  },
  down: {
    poly: [6, 8, 2, 9, 0, 12, 1, 14, 3, 15, 6, 12],
    feathers: [
      [5, 10, 1, 12],
      [5, 11, 2, 14],
    ],
  },
  swept: {
    poly: [6, 6, 4, 0, 3, 1, 3, 6, 4, 10, 6, 12],
    feathers: [[5, 9, 4, 3]],
  },
};

/** Even-odd scanline fill of a polygon given as [x0, y0, x1, y1, ...]. */
function fillPoly(b: PixelBuffer, pts: number[], c: number, mirror = -1) {
  const n = pts.length / 2;
  for (let y = 0; y < b.h; y++) {
    const xs: number[] = [];
    for (let i = 0; i < n; i++) {
      const x0 = pts[i * 2];
      const y0 = pts[i * 2 + 1];
      const x1 = pts[((i + 1) % n) * 2];
      const y1 = pts[((i + 1) % n) * 2 + 1];
      const yc = y + 0.5;
      if ((y0 <= yc && y1 > yc) || (y1 <= yc && y0 > yc)) xs.push(x0 + ((yc - y0) / (y1 - y0)) * (x1 - x0));
    }
    xs.sort((a, b2) => a - b2);
    for (let k = 0; k + 1 < xs.length; k += 2)
      for (let x = Math.round(xs[k]); x < Math.round(xs[k + 1]); x++) {
        b.set(x, y, c);
        if (mirror >= 0) b.set(mirror - x, y, c);
      }
  }
}

function owlFrame(wings: WingPose, eyes: keyof typeof OWL_EYES, feet: 'perch' | 'talons' | 'tuck'): string[] {
  const b = new PixelBuffer(20, 16);
  const w = OWL_WINGS[wings];
  if (w.poly.length) {
    fillPoly(b, w.poly, 2, 19);
    for (const f of w.feathers) {
      b.line(f[0], f[1], f[2], f[3], 1);
      b.line(19 - f[0], f[1], 19 - f[2], f[3], 1);
    }
  }
  const body = OWL_BODY.map((r) => r.replace(/E/g, '.'));
  b.stamp(body, 5, 1);
  const e = OWL_EYES[eyes];
  b.stamp(e, 6, 5);
  b.stamp(e, 11, 5);
  if (feet === 'perch') b.stamp(['..2....2..', '.22....22.'], 5, 14);
  else if (feet === 'talons') b.stamp(['..2....2..', '.3.3..3.3.'], 5, 14);
  else b.stamp(['...2..2...'], 5, 14);
  return b.toRows();
}

defineSheet('frostbell-owl', {
  w: 20,
  h: 16,
  ox: 10,
  oy: 16,
  frames: {
    perch: owlFrame('fold', 'open', 'perch'),
    look: owlFrame('fold', 'look', 'perch'),
    blink: owlFrame('fold', 'blink', 'perch'),
    alert1: owlFrame('raised', 'glare', 'perch'),
    alert2: owlFrame('raised', 'open', 'perch'),
    swoop: owlFrame('swept', 'glare', 'talons'),
    flyUp: owlFrame('up', 'open', 'tuck'),
    flyDown: owlFrame('down', 'open', 'tuck'),
  },
  anims: {
    perch: { frames: ['perch', 'perch', 'perch', 'look', 'look', 'perch', 'perch', 'blink'], fps: 4 },
    alert: { frames: ['alert1', 'alert2'], fps: 10 },
    swoop: { frames: ['swoop'], fps: 1 },
    fly: { frames: ['flyUp', 'flyDown'], fps: 9 },
  },
});

// =============================================================================================
// YETI CUB — a fluffy snow-beast that lobs snowballs
// =============================================================================================
const YETI_HEAD = [
  '......2.2.......',
  '....22222222....',
  '...2222222222...',
  '..222222111111..',
  '..222221311312..',
  '..222221111112..',
  '..122221100012..',
  '..112222111122..',
];
const YETI_TORSO = [
  '..1122222222221.',
  '..1112222222211.',
  '...11222222211..',
  '....11122221....',
];
const YETI_LEGS = {
  stand: ['....111..111....', '...1111.1111....'],
  stepA: ['....111...111...', '..1111....1111..'],
  stepB: ['.....111.111....', '....1111111.....'],
};
type YetiArms = 'hang' | 'swingA' | 'swingB' | 'raise' | 'throw';

function yetiFrame(arms: YetiArms, legs: keyof typeof YETI_LEGS, ball: boolean, bob = 0): string[] {
  const b = new PixelBuffer(18, 18);
  // back arm first (behind the body)
  const back: Record<YetiArms, number[]> = {
    hang: [4, 10, 2, 13],
    swingA: [4, 10, 3, 14],
    swingB: [4, 10, 1, 12],
    raise: [4, 10, 1, 4],
    throw: [4, 10, 2, 9],
  };
  const front: Record<YetiArms, number[]> = {
    hang: [13, 10, 15, 13],
    swingA: [13, 10, 16, 12],
    swingB: [13, 10, 14, 14],
    raise: [13, 10, 15, 12],
    throw: [13, 9, 17, 8],
  };
  const arm = (pts: number[], c: number) => {
    b.line(pts[0], pts[1] + bob, pts[2], pts[3] + bob, c);
    b.line(pts[0] + 1, pts[1] + bob, pts[2] + 1, pts[3] + bob, c);
  };
  arm(back[arms], 1);
  b.stamp(YETI_HEAD, 1, 2 + bob);
  b.stamp(YETI_TORSO, 1, 10 + bob);
  b.stamp(YETI_LEGS[legs], 1, 14 + (bob > 0 ? 1 : 0));
  b.rect(1, 16, 16, 2, 255);
  b.stamp(YETI_LEGS[legs], 1, 16);
  arm(front[arms], 2);
  if (ball) b.stamp(['.333.', '33332', '33322', '.222.'], 0, 0 + bob);
  return b.toRows();
}

defineSheet('frostbell-yeti', {
  w: 18,
  h: 18,
  ox: 9,
  oy: 18,
  frames: {
    idle1: yetiFrame('hang', 'stand', false),
    idle2: yetiFrame('hang', 'stand', false, 1),
    walk1: yetiFrame('swingA', 'stepA', false),
    walk2: yetiFrame('hang', 'stand', false, 1),
    walk3: yetiFrame('swingB', 'stepB', false),
    windup1: yetiFrame('raise', 'stand', true),
    windup2: yetiFrame('raise', 'stand', true, 1),
    throw: yetiFrame('throw', 'stepA', false),
  },
  anims: {
    idle: { frames: ['idle1', 'idle1', 'idle2', 'idle2'], fps: 4 },
    walk: { frames: ['walk1', 'walk2', 'walk3', 'walk2'], fps: 7 },
    windup: { frames: ['windup1', 'windup2'], fps: 8 },
    throw: { frames: ['throw'], fps: 1 },
  },
});

defineSheet('frostbell-snowball', {
  w: 7,
  h: 7,
  ox: 3,
  oy: 3,
  frames: {
    a: ['..222..', '.23332.', '2333332', '2333322', '2333222', '.22221.', '..111..'],
    b: ['..222..', '.23322.', '2333222', '2332222', '2322221', '.22211.', '..111..'],
  },
  anims: { spin: { frames: ['a', 'b'], fps: 10 } },
});

// =============================================================================================
// FALLING ICICLE — hangs from a ceiling, shivers, drops
// =============================================================================================
const ICICLE = [
  '2222222',
  '1233221',
  '.12322.',
  '.12322.',
  '.1232..',
  '..232..',
  '..232..',
  '..23...',
  '..23...',
  '..33...',
  '...3...',
  '...3...',
  '.......',
];
defineSheet('frostbell-icicle', {
  w: 7,
  h: 13,
  ox: 3,
  oy: 0,
  frames: {
    hang: ICICLE,
    crack: over(ICICLE, 0, 0, ['.......', '.......', '...0...', '....0..', '...0...']),
    grow1: ['2222222', '.12321.', '..232..', '...3...', ...Array(9).fill('.......')],
    grow2: ['2222222', '1233221', '.12322.', '..232..', '..232..', '..23...', '...3...', ...Array(6).fill('.......')],
    shard: ['.......', '.......', '...3...', '..232..', '...2...', ...Array(8).fill('.......')],
  },
  anims: {
    hang: { frames: ['hang'], fps: 1 },
    shake: { frames: ['hang', 'crack'], fps: 14 },
    grow: { frames: ['grow1', 'grow2', 'hang'], fps: 3, loop: false },
  },
});

// =============================================================================================
// ICE BAT — roosts upside-down, wakes, flutters after you
// =============================================================================================
const BAT_HANG = [
  '......11......',
  '.....2112.....',
  '....222222....',
  '...12222221...',
  '...12222221...',
  '...11222211...',
  '....1EE1E1....',
  '....122221....',
  '.....1221.....',
  '.....1..1.....',
];
const batEyes = (eye: string) => BAT_HANG.map((r) => r.replace('E', eye).replace('E', '2').replace('E', eye));
defineSheet('frostbell-bat', {
  w: 14,
  h: 10,
  ox: 7,
  oy: 5,
  frames: {
    hang1: batEyes('1'),
    hang2: over(batEyes('1'), 0, 2, ['....2222222...']),
    wake: batEyes('3'),
    fly1: [
      '2............2',
      '12..........21',
      '122.1....1.221',
      '.1221.22.1221.',
      '..122222222...',
      '...12322321...',
      '....122221....',
      '.....1221.....',
      '..............',
      '..............',
    ],
    fly2: [
      '..............',
      '..............',
      '.....1..1.....',
      '.2..122221..2.',
      '12222232232221',
      '.11122222111..',
      '....122221....',
      '.....1221.....',
      '..............',
      '..............',
    ],
    fly3: [
      '..............',
      '..............',
      '.....1..1.....',
      '....122221....',
      '...12322321...',
      '..1222222221..',
      '.122.1221.221.',
      '12...1..1...21',
      '2............2',
      '..............',
    ],
  },
  anims: {
    hang: { frames: ['hang1', 'hang1', 'hang1', 'hang2'], fps: 3 },
    wake: { frames: ['wake', 'hang1'], fps: 12 },
    fly: { frames: ['fly1', 'fly2', 'fly3', 'fly2'], fps: 14 },
  },
});

// =============================================================================================
// BELLRINGER HOOT — an old owl in a drooping nightcap, spectacles and a long scarf,
// handbell in his wing. Built as a paper doll so the talk / ring poses share one body.
// =============================================================================================
function fillPolyRows(b: PixelBuffer, pts: number[], c: number) {
  const n = pts.length / 2;
  for (let y = 0; y < b.h; y++) {
    const xs: number[] = [];
    for (let i = 0; i < n; i++) {
      const x0 = pts[i * 2];
      const y0 = pts[i * 2 + 1];
      const x1 = pts[((i + 1) % n) * 2];
      const y1 = pts[((i + 1) % n) * 2 + 1];
      const yc = y + 0.5;
      if ((y0 <= yc && y1 > yc) || (y1 <= yc && y0 > yc)) xs.push(x0 + ((yc - y0) / (y1 - y0)) * (x1 - x0));
    }
    xs.sort((p, q) => p - q);
    for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.round(xs[k]); x < Math.round(xs[k + 1]); x++) b.set(x, y, c);
  }
}

interface HootPose {
  eyes: 'open' | 'blink' | 'look';
  beak: 'shut' | 'open';
  bell: 'low' | 'up' | 'ring';
  bob: number;
}

function hootFrame(o: HootPose): string[] {
  const b = new PixelBuffer(20, 28);
  const y0 = o.bob;
  // body and folded wings
  b.ellipse(9, 20 + y0, 7, 6, 2);
  b.ellipse(3, 20 + y0, 2, 4, 1);
  b.ellipse(15, 20 + y0, 2, 4, 1);
  for (const [cx, cy] of [
    [7, 19],
    [11, 19],
    [9, 22],
    [6, 23],
    [12, 23],
  ])
    b.polyline([cx - 1, cy + y0, cx, cy + 1 + y0, cx + 1, cy + y0], 1);
  // feet
  b.rect(6, 26, 2, 2, 2);
  b.rect(11, 26, 2, 2, 2);
  b.set(5, 27, 2);
  b.set(13, 27, 2);
  // head
  b.ellipse(9, 11 + y0, 7, 5, 2);
  // scarf: a dark knitted band and a tail hanging down the front
  b.rect(3, 15 + y0, 13, 2, 1);
  for (let x = 4; x < 15; x += 2) b.set(x, 15 + y0, 2);
  b.rect(4, 17 + y0, 2, 5, 1);
  b.set(4, 19 + y0, 2);
  b.set(5, 21 + y0, 2);
  b.rect(4, 22 + y0, 2, 1, 2);
  // spectacles (dark rims and bridge) around big white eyes
  for (const ex of [6, 12]) {
    b.rect(ex - 2, 9 + y0, 5, 5, 1);
    const eye = o.eyes === 'blink' ? ['222', '111', '222'] : o.eyes === 'look' ? ['333', '330', '333'] : ['333', '303', '333'];
    b.stamp(eye, ex - 1, 10 + y0);
  }
  b.rect(8, 11 + y0, 2, 1, 1);
  // beak
  if (o.beak === 'shut') {
    b.rect(8, 13 + y0, 2, 2, 1);
    b.set(9, 15 + y0, 1);
  } else {
    b.rect(8, 13 + y0, 2, 1, 1);
    b.rect(8, 14 + y0, 2, 1, 0);
    b.rect(8, 15 + y0, 2, 1, 1);
  }
  // nightcap: a striped cone drooping over to the right, pompom at the tip
  fillPolyRows(b, [3, 8 + y0, 15, 8 + y0, 13, 4 + y0, 16, 2 + y0, 18, 4 + y0, 11, 1 + y0, 6, 3 + y0], 1);
  for (let x = 4; x < 16; x += 3) b.line(x, 7 + y0, x + 2, 4 + y0, 2);
  b.rect(3, 8 + y0, 13, 1, 2);
  b.rect(17, 4 + y0, 2, 2, 3);
  b.set(18, 6 + y0, 3);
  // bushy white eyebrows poking out under the cap, over the spectacles
  b.polyline([3, 10 + y0, 4, 9 + y0, 7, 9 + y0], 3);
  b.polyline([11, 9 + y0, 14, 9 + y0, 15, 10 + y0], 3);
  // the handbell, held out in the front wing
  if (o.bell === 'low') {
    b.line(15, 19 + y0, 16, 21 + y0, 1);
    b.stamp(['.2.', '222', '232', '333', '.1.'], 15, 21 + y0);
  } else {
    b.line(15, 19 + y0, 17, 16 + y0, 1);
    const tilt = o.bell === 'ring' ? ['..2', '.22', '232', '33.', '1..'] : ['.2.', '222', '232', '333', '.1.'];
    b.stamp(tilt, 16, 12 + y0);
    if (o.bell === 'ring') {
      b.set(19, 11 + y0, 3);
      b.set(19, 15 + y0, 3);
      b.set(15, 11 + y0, 3);
    }
  }
  return b.toRows();
}
defineSheet('frostbell-hoot', {
  w: 20,
  h: 28,
  ox: 10,
  oy: 28,
  frames: {
    idle: hootFrame({ eyes: 'open', beak: 'shut', bell: 'low', bob: 0 }),
    idle2: hootFrame({ eyes: 'open', beak: 'shut', bell: 'low', bob: 1 }),
    blink: hootFrame({ eyes: 'blink', beak: 'shut', bell: 'low', bob: 0 }),
    look: hootFrame({ eyes: 'look', beak: 'shut', bell: 'low', bob: 0 }),
    talk1: hootFrame({ eyes: 'open', beak: 'open', bell: 'up', bob: 0 }),
    talk2: hootFrame({ eyes: 'open', beak: 'shut', bell: 'ring', bob: 0 }),
    talk3: hootFrame({ eyes: 'look', beak: 'open', bell: 'ring', bob: 1 }),
  },
  anims: {
    idle: { frames: ['idle', 'idle', 'idle2', 'idle2', 'look', 'look', 'idle', 'blink'], fps: 3 },
    talk: { frames: ['talk1', 'talk2', 'talk3', 'talk2'], fps: 7 },
  },
});

// =============================================================================================
// PIP THE SNOW FOX — sits by the bells, tail swishing
// =============================================================================================
const PIP_BODY = [
  '..........2...2...',
  '..........22.22...',
  '..........222222..',
  '.........22202022.',
  '.........222222223',
  '.........22222211.',
  '..........222222..',
  '.........2333222..',
  '........23332222..',
  '.......223322222..',
  '.......222222222..',
  '.......22..22.22..',
  '......11..11..11..',
];
const PIP_TAILS = {
  a: ['...........', '...........', '...........', '...........', '...........', '...........', '.33........', '3332.......', '33222......', '.32222.....', '..122222...', '...111222..', '...........'],
  b: ['...........', '...........', '...........', '...........', '...........', '...........', '...........', '...........', '33.........', '3332.......', '33222222...', '.1112222...', '...........'],
  c: ['...........', '...........', '...........', '...........', '.33........', '3332.......', '3322.......', '.3222......', '..2222.....', '..122222...', '...111222..', '...........', '...........'],
};
function pipFrame(tail: keyof typeof PIP_TAILS, mouth: boolean, blink: boolean): string[] {
  const b = new PixelBuffer(18, 13);
  b.stamp(PIP_TAILS[tail], 0, 0);
  let body = PIP_BODY;
  if (blink) body = body.map((r, i) => (i === 3 ? '.........22212122.' : r));
  if (mouth) body = body.map((r, i) => (i === 5 ? '.........222222101' : r));
  b.stamp(body, 0, 0);
  return b.toRows();
}
defineSheet('frostbell-pip', {
  w: 18,
  h: 13,
  ox: 10,
  oy: 13,
  frames: {
    a: pipFrame('a', false, false),
    b: pipFrame('b', false, false),
    c: pipFrame('c', false, false),
    blink: pipFrame('a', false, true),
    talk: pipFrame('b', true, false),
  },
  anims: {
    idle: { frames: ['a', 'b', 'c', 'b', 'a', 'blink'], fps: 4 },
    talk: { frames: ['talk', 'b', 'talk', 'a'], fps: 7 },
  },
});

// =============================================================================================
// BELLS — procedural profile, swung by shifting rows around the hanger
// =============================================================================================
interface BellSpec {
  w: number;
  h: number;
  /** body rows (inclusive) and half-widths at the top and at the lip */
  top: number;
  lip: number;
  topHw: number;
  lipHw: number;
  bands: number[];
  rim: number;
}

function bellFrame(s: BellSpec, swing: number, lit: boolean): string[] {
  const b = new PixelBuffer(s.w, s.h);
  const cx = (s.w - 1) / 2;
  const shift = (y: number) => Math.round((swing * y) / s.h);
  // hanger loop
  const hx = Math.round(cx);
  b.rect(hx - 1, 0, 3, 1, 2);
  b.set(hx - 1, 1, 2);
  b.set(hx + 1, 1, 2);
  for (let y = s.top; y <= s.lip; y++) {
    const t = (y - s.top) / (s.lip - s.top);
    let hw = s.topHw + (s.lipHw - s.topHw) * Math.pow(t, 2.4);
    const dome = y - s.top;
    if (dome < 2) hw -= (2 - dome) * 0.9;
    if (y >= s.lip - 1) hw += 1;
    const dx = shift(y);
    const l = Math.round(cx - hw) + dx;
    const r = Math.round(cx + hw) + dx;
    for (let x = l; x <= r; x++) {
      let c = 1;
      const edge = x === l || x === r || y === s.top;
      if (edge) c = lit ? 3 : 2;
      else if (y === s.lip) c = s.rim;
      else if (y === s.lip - 1 || s.bands.includes(y)) c = 2;
      else if (x === l + 2 || (x === l + 3 && hw > 6)) c = 2;
      b.set(x, y, c);
    }
  }
  // clapper swinging the other way
  const kx = Math.round(cx) + shift(s.lip) - Math.sign(swing);
  b.rect(kx - 1, s.lip + 1, 3, 2, lit ? 3 : 2);
  b.set(kx, s.lip + 3, 1);
  return b.toRows();
}

const SMALL_BELL: BellSpec = { w: 14, h: 15, top: 2, lip: 11, topHw: 2.5, lipHw: 5.5, bands: [4], rim: 3 };
defineSheet('frostbell-bell', {
  w: 14,
  h: 15,
  ox: 7,
  oy: 0,
  frames: {
    rest: bellFrame(SMALL_BELL, 0, false),
    l1: bellFrame(SMALL_BELL, -2, false),
    l2: bellFrame(SMALL_BELL, -4, true),
    r1: bellFrame(SMALL_BELL, 2, false),
    r2: bellFrame(SMALL_BELL, 4, true),
    lit: bellFrame(SMALL_BELL, 0, true),
  },
  anims: {
    idle: { frames: ['rest'], fps: 1 },
    ring: { frames: ['r2', 'r1', 'rest', 'l1', 'l2', 'l1', 'rest', 'r1'], fps: 16 },
  },
});

const GREAT_BELL: BellSpec = { w: 28, h: 32, top: 2, lip: 26, topHw: 5, lipHw: 12.5, bands: [6, 21], rim: 2 };
defineSheet('frostbell-greatbell', {
  w: 28,
  h: 32,
  ox: 14,
  oy: 0,
  frames: {
    a: bellFrame(GREAT_BELL, 0, false),
    b: bellFrame(GREAT_BELL, 1, false),
    c: bellFrame(GREAT_BELL, -1, false),
  },
  anims: { sway: { frames: ['a', 'b', 'b', 'a', 'c', 'c'], fps: 2 } },
});

// =============================================================================================
// GEAR — a frozen cog, turning slowly (procedural)
// =============================================================================================
function gearFrame(size: number, teeth: number, angle: number, frozen: boolean): string[] {
  const b = new PixelBuffer(size, size);
  const c = (size - 1) / 2;
  const R = c - 2;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const dx = x - c;
      const dy = y - c;
      const d = Math.hypot(dx, dy);
      const a = Math.atan2(dy, dx) - angle;
      const tooth = Math.cos(a * teeth) > 0.25;
      const outer = tooth ? R + 2 : R;
      if (d > outer + 0.5) continue;
      if (d > outer - 0.5) b.set(x, y, 2);
      else if (d < R * 0.3) b.set(x, y, d > R * 0.3 - 1.2 ? 2 : 0);
      else if (d > R - 1.6) b.set(x, y, 1);
      else {
        // spokes
        const spoke = Math.abs(Math.sin((a + angle * 0) * 3)) < 0.18 + 0.6 / Math.max(d, 1);
        b.set(x, y, spoke ? 1 : d < R * 0.45 ? 1 : 0);
      }
    }
  if (frozen) {
    for (const [ix, len] of [
      [c - 4, 4],
      [c + 1, 6],
      [c + 5, 3],
    ] as const) {
      const x = Math.round(ix);
      let y = size - 1;
      while (y > 0 && b.get(x, y) === 255) y--;
      for (let i = 1; i <= len; i++) if (y + i < size) b.set(x, y + i, i === len ? 3 : 2);
    }
    // frost crust on the upper teeth
    for (let x = 0; x < size; x++) {
      let y = 0;
      while (y < size && b.get(x, y) === 255) y++;
      if (y < size && y < c && hash2(x, 1, 91) < 0.6) b.set(x, y, 3);
    }
  }
  return b.toRows();
}
defineSheet('frostbell-gear', {
  w: 25,
  h: 27,
  ox: 12,
  oy: 12,
  frames: {
    a: [...gearFrame(25, 8, 0, true), '.'.repeat(25), '.'.repeat(25)],
    b: [...gearFrame(25, 8, Math.PI / 24, true), '.'.repeat(25), '.'.repeat(25)],
    c: [...gearFrame(25, 8, Math.PI / 12, true), '.'.repeat(25), '.'.repeat(25)],
  },
  anims: { turn: { frames: ['a', 'b', 'c'], fps: 3 } },
});
defineSheet('frostbell-cog', {
  w: 15,
  h: 15,
  ox: 7,
  oy: 7,
  frames: {
    a: gearFrame(15, 6, 0, false),
    b: gearFrame(15, 6, -Math.PI / 18, false),
    c: gearFrame(15, 6, -Math.PI / 9, false),
  },
  anims: { turn: { frames: ['a', 'b', 'c'], fps: 6 } },
});

// =============================================================================================
// CLOCK FACE — the frozen tower clock, its minute hand twitching against the ice
// =============================================================================================
function clockFrame(minute: number): string[] {
  const S = 33;
  const b = new PixelBuffer(S, S);
  const c = 16;
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const d = Math.hypot(x - c, y - c);
      if (d > 16.4) continue;
      if (d > 15.4) b.set(x, y, 2);
      else if (d > 14.2) b.set(x, y, 1);
      else if (d > 13.4) b.set(x, y, 2);
      else b.set(x, y, bayer(x, y) < 0.12 ? 1 : 0);
    }
  // hour marks (long at 12/3/6/9)
  for (let h = 0; h < 12; h++) {
    const a = (h / 12) * Math.PI * 2 - Math.PI / 2;
    const long = h % 3 === 0;
    for (let r = long ? 9 : 11; r <= 12; r++) b.set(Math.round(c + Math.cos(a) * r), Math.round(c + Math.sin(a) * r), long ? 2 : 1);
  }
  // hands: hour hand stuck near ten, minute hand twitching around twelve
  const hand = (a: number, len: number, col: number) => b.line(c, c, Math.round(c + Math.cos(a) * len), Math.round(c + Math.sin(a) * len), col);
  hand(-Math.PI / 2 - Math.PI / 3, 6, 2);
  hand(-Math.PI / 2 + minute, 10, 3);
  b.rect(c - 1, c - 1, 3, 3, 2);
  b.set(c, c, 3);
  // a crack across the frosted glass
  b.polyline([5, 9, 9, 12, 8, 15, 12, 19, 11, 23], 1);
  // icicles from the lower rim
  for (const [x, len] of [
    [10, 3],
    [14, 5],
    [19, 4],
    [23, 2],
  ]) {
    let y = S - 1;
    while (y > 0 && b.get(x, y) === 255) y--;
    for (let i = 1; i <= len; i++) if (y + i < S) b.set(x, y + i, i === len ? 3 : 2);
  }
  return b.toRows();
}
defineSheet('frostbell-clock', {
  w: 33,
  h: 33,
  ox: 16,
  oy: 16,
  frames: { a: clockFrame(0.05), b: clockFrame(0.16) },
  anims: { tick: { frames: ['a', 'a', 'a', 'a', 'b', 'a', 'b'], fps: 4 } },
});

// =============================================================================================
// DECOR
// =============================================================================================
const BANNER_CLOTH = [
  '.21111112.',
  '.21122112.',
  '.21222212.',
  '.21222212.',
  '.22222222.',
  '.21121112.',
  '.21111112.',
  '.22222222.',
  '.21111112.',
  '.21211212.',
  '.21111112.',
  '.21211212.',
  '.21111112.',
  '.2111111..',
  '.21.1111..',
  '.2..1.11..',
  '.2....1...',
  '......1...',
]
function bannerFrame(phase: number): string[] {
  const b = new PixelBuffer(10, 22);
  b.rect(0, 0, 10, 1, 2);
  b.set(0, 1, 2);
  b.set(9, 1, 2);
  b.line(2, 1, 7, 1, 1);
  BANNER_CLOTH.forEach((row, i) => {
    const sway = Math.round(Math.sin(phase + i * 0.35) * (i / BANNER_CLOTH.length) * 1.6);
    b.stamp([row], sway, 2 + i);
  });
  // the bell emblem in colour 2 is drawn into the cloth rows 2-5
  return b.toRows();
}
defineSheet('frostbell-banner', {
  w: 10,
  h: 22,
  ox: 5,
  oy: 0,
  frames: { a: bannerFrame(0), b: bannerFrame(2.1), c: bannerFrame(4.2) },
  anims: { wave: { frames: ['a', 'b', 'c'], fps: 4 } },
});

defineSheet('frostbell-crate', {
  w: 13,
  h: 12,
  ox: 6,
  oy: 12,
  frames: {
    a: [
      '..33.333.....',
      '.3222322233..',
      '2222222222222',
      '2111111111112',
      '2121121211212',
      '2112111112112',
      '2111211121112',
      '2111121211112',
      '2112111112112',
      '2121111111212',
      '2111111111112',
      '2222222222222',
    ],
  },
  anims: { idle: { frames: ['a'], fps: 1 } },
});

const CANDLE_BASE = [
  '..2.......',
  '..2...2...',
  '.222..2...',
  '.212.222..',
  '.212.212.2',
  '.212.212.2',
  '1111111111',
];
function candles(f: string[]): string[] {
  const b = new PixelBuffer(10, 10);
  b.stamp(f, 0, 0);
  b.stamp(CANDLE_BASE, 0, 3);
  return b.toRows();
}
defineSheet('frostbell-candles', {
  w: 10,
  h: 10,
  ox: 5,
  oy: 10,
  frames: {
    a: candles(['..3.......', '..3...3...', '......3..3', '........3.']),
    b: candles(['...3......', '..3...3...', '.......3.3', '..........']),
    c: candles(['..........', '..3....3..', '......3..3', '.........3']),
  },
  anims: { flicker: { frames: ['a', 'b', 'a', 'c'], fps: 7 } },
});

function brazier(fl: string[]): string[] {
  const b = new PixelBuffer(13, 16);
  b.stamp(fl, 0, 0);
  b.stamp(
    [
      '2222222222222',
      '.21111111112.',
      '..222222222..',
      '....2...2....',
      '....1...1....',
      '.....1.1.....',
      '......1......',
      '.....1.1.....',
      '....1...1....',
      '...222.222...',
    ],
    0,
    6,
  );
  return b.toRows();
}
defineSheet('frostbell-brazier', {
  w: 13,
  h: 16,
  ox: 6,
  oy: 16,
  frames: {
    a: brazier(['......3......', '.....33..3...', '..3..333.33..', '..33.3333332.', '.2333333333..', '.2233333332..']),
    b: brazier(['....3........', '....33...3...', '...333..33...', '..23333333...', '..3333333332.', '.2233333332..']),
    c: brazier(['.......3.....', '..3...33.....', '..33..333.3..', '.23333333332.', '..333333333..', '.2233333332..']),
  },
  anims: { burn: { frames: ['a', 'b', 'c'], fps: 8 } },
});

defineSheet('frostbell-statue', {
  w: 16,
  h: 30,
  ox: 8,
  oy: 30,
  frames: {
    a: [
      '................',
      '..222222222222..',
      '.23..........12.',
      '.2...1....1...2.',
      '.2...11..11...2.',
      '.2...111111...2.',
      '.2..11011011..2.',
      '.2..11111111..2.',
      '.2..11111111..2.',
      '.2.1111111111.2.',
      '.2.1111111111.2.',
      '.211.111111.112.',
      '.21..111111..12.',
      '.2...111111...2.',
      '.2...111111..32.',
      '.2....1111...32.',
      '.2....1..1....2.',
      '.2...11..11...2.',
      '.23...........2.',
      '.2............2.',
      '..222222222222..',
      '..211111111112..',
      '..212222222212..',
      '..211111111112..',
      '...2111111112...',
      '...2111111112...',
      '...2111111112...',
      '..222222222222..',
      '.22222222222222.',
      '2222222222222222',
    ],
  },
  anims: { idle: { frames: ['a'], fps: 1 } },
});

const SNOWMAN = [
  '....00000...',
  '....00000...',
  '...0000000..',
  '....22232...',
  '...2202032..',
  '...2222211..',
  '...1222222..',
  '....11111...',
  '...1121112..',
  '1.222222232.',
  '.1222202232.',
  '..22222223.1',
  '..12222022..',
  '..12222222..',
  '...112221...',
  '..11111111..',
]
defineSheet('frostbell-snowman', {
  w: 12,
  h: 16,
  ox: 6,
  oy: 16,
  frames: {
    a: SNOWMAN,
    b: over(SNOWMAN, 0, 7, ['.....11111..', '...1121.12..']),
  },
  anims: { idle: { frames: ['a', 'a', 'a', 'b', 'a', 'b'], fps: 3 } },
});

function chimes(phase: number): string[] {
  const b = new PixelBuffer(11, 18);
  b.line(5, 0, 5, 3, 1);
  b.rect(1, 3, 9, 1, 2);
  const lens = [6, 9, 7, 11];
  lens.forEach((len, i) => {
    const x0 = 2 + i * 2;
    const sw = Math.round(Math.sin(phase + i * 1.3) * 1.2);
    for (let y = 0; y < len + 2; y++) {
      const x = x0 + Math.round((sw * y) / (len + 2));
      b.set(x, 4 + y, y < 2 ? 1 : y === len + 1 ? 3 : 2);
    }
  });
  return b.toRows();
}
defineSheet('frostbell-chimes', {
  w: 11,
  h: 18,
  ox: 5,
  oy: 0,
  frames: { a: chimes(0), b: chimes(2), c: chimes(4) },
  anims: { sway: { frames: ['a', 'b', 'c', 'b'], fps: 4 } },
});

// =============================================================================================
// BELL GATE — ice bars that retract into the lintel (pieces drawn by the gate entity)
// =============================================================================================
defineSheet('frostbell-gate', {
  w: 8,
  h: 8,
  ox: 0,
  oy: 0,
  frames: {
    cap: ['22222222', '21111112', '22222222', '.2..2..2', '.2..2..2', '.2..2..2', '.2..2..2', '.2..2..2'],
    bars: ['.2..2..2', '.2..2..2', '.3..3..3', '.2..2..2', '.2..2..2', '.2..2..2', '.2..2..2', '.2..2..2'],
    tips: ['.2..2..2', '.2..2..2', '.2..2..2', '.2..2..2', '.2..2..2', '.3..3..3', '.3..3..3', '........'],
  },
  anims: { idle: { frames: ['bars'], fps: 1 } },
});

// =============================================================================================
// GEAR PLATFORM — a riveted beam riding on two little cogs (3 spin frames)
// =============================================================================================
function gearPlat(phase: number): string[] {
  const b = new PixelBuffer(24, 8);
  b.rect(1, 0, 22, 1, 2);
  b.rect(0, 1, 24, 2, 1);
  b.set(0, 1, 2);
  b.set(23, 1, 2);
  for (let x = 3; x < 22; x += 6) b.set(x, 1, 2);
  for (let x = 2; x < 23; x += 3) if (bayer(x, 0) < 0.3) b.set(x, 0, 3);
  b.rect(1, 3, 22, 1, 2);
  // cogs under each end
  for (const cx of [5, 18]) {
    b.rect(cx - 2, 4, 5, 3, 1);
    b.rect(cx - 1, 7, 3, 1, 1);
    b.set(cx, 5, 2);
    const teeth = [
      [cx - 3, 5],
      [cx + 3, 5],
      [cx - 2, 7],
      [cx + 2, 7],
      [cx, 4],
    ];
    teeth.forEach(([tx, ty], i) => {
      if ((i + phase) % 3 !== 0) b.set(tx, ty, 2);
    });
  }
  return b.toRows();
}
defineSheet('frostbell-gearplat', {
  w: 24,
  h: 8,
  ox: 0,
  oy: 0,
  frames: { a: gearPlat(0), b: gearPlat(1), c: gearPlat(2) },
  anims: { turn: { frames: ['a', 'b', 'c'], fps: 8 } },
});
