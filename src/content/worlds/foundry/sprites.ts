import { bayer, hash2 } from '../../../engine/math';
import { CLEAR, PixelBuffer } from '../../../engine/pixels';
import { defineSheet } from '../../../engine/sprites';

/**
 * Ember Foundry sprites. Characters are hand-drawn ASCII; machines and fire are drawn with
 * code on a PixelBuffer (like the train in art/common.ts). Everything faces RIGHT.
 */

function art(w: number, h: number, draw: (b: PixelBuffer) => void): string[] {
  const b = new PixelBuffer(w, h);
  draw(b);
  return b.toRows();
}

/** A stroke `width` pixels wide. */
function thick(b: PixelBuffer, x0: number, y0: number, x1: number, y1: number, width: number, c: number) {
  const o = Math.floor((width - 1) / 2);
  for (let i = 0; i < width; i++) {
    const d = i - o;
    if (Math.abs(x1 - x0) >= Math.abs(y1 - y0)) b.line(x0, y0 + d, x1, y1 + d, c);
    else b.line(x0 + d, y0, x1 + d, y1, c);
  }
}

/** Flip a frame upside down (for ceiling-mounted variants). */
const vflip = (rows: string[]) => [...rows].reverse();

// ===========================================================================================
// FLAME IMP — a coal-lump imp with a flame for hair. Hops at you and leaves embers.
// ===========================================================================================
const IMP_FLAME = {
  a: ['....3.......', '...323..3...', '...2332.32..', '..233332322.'],
  b: ['.....3......', '....32.3....', '...2332232..', '..233333322.'],
  c: ['...3........', '...32..3....', '..2332.232..', '..23333332..'],
};
const IMP_BODY = [
  '..22222222..',
  '.2111111112.',
  '.2111313112.',
  '.2111313112.',
  '.2111111102.',
  '..21110012..',
];
const IMP_LEGS = { stand: ['..1....1....', '.11...11....'], tuck: ['............', '............'] };
const IMP_CROUCH = [
  '............',
  '............',
  '....3...3...',
  '...323.323..',
  '..23333333..',
  '.2222222222.',
  '211111111112',
  '211113113112',
  '211111111102',
  '.2111100112.',
  '.11......11.',
  '11........11',
];
const IMP_HOP = [
  '.3..........',
  '.23..3......',
  '.233.32.....',
  '..2333322...',
  '..22222222..',
  '.2111111112.',
  '.2111313112.',
  '.2111313112.',
  '.2111111102.',
  '..21110012..',
  '...1111.....',
  '....11......',
];
defineSheet('foundry-imp', {
  w: 12,
  h: 12,
  ox: 6,
  oy: 12,
  frames: {
    i1: [...IMP_FLAME.a, ...IMP_BODY, ...IMP_LEGS.stand],
    i2: [...IMP_FLAME.b, ...IMP_BODY, ...IMP_LEGS.stand],
    i3: [...IMP_FLAME.c, ...IMP_BODY, ...IMP_LEGS.stand],
    crouch: IMP_CROUCH,
    hop: IMP_HOP,
  },
  anims: {
    idle: { frames: ['i1', 'i2', 'i3', 'i2'], fps: 9 },
    crouch: { frames: ['crouch'], fps: 1 },
    hop: { frames: ['hop'], fps: 1 },
  },
});

// the ember an imp leaves behind
defineSheet('foundry-ember', {
  w: 7,
  h: 7,
  ox: 3,
  oy: 7,
  frames: {
    a: ['...3...', '..33...', '..323..', '.2332..', '.23332.', '2333332', '.22222.'],
    b: ['.......', '...3...', '..332..', '.2332..', '.23332.', '2333332', '.22222.'],
    c: ['.......', '.......', '...2...', '..232..', '.2332..', '.23322.', '.12221.'],
    d: ['.......', '.......', '.......', '.......', '...2...', '..121..', '.11211.'],
  },
  anims: {
    burn: { frames: ['a', 'b'], fps: 10 },
    fade: { frames: ['c', 'd'], fps: 4, loop: false },
  },
});

// ===========================================================================================
// FURNACE BOT — an armoured walking furnace. The tower shield in front blocks strikes.
// ===========================================================================================
interface BotPose {
  /** Foot offsets (back, front) in px, and body lift. */
  feet: [number, number];
  lift: number;
  /** Grill glow 0 cold, 1 warm, 2 white-hot. */
  glow: number;
  /** Mouth (grill) thrown open for the flame burst. */
  open?: boolean;
  /** Shield shoved forward (block reaction). */
  shove?: number;
}

function bot(p: BotPose): string[] {
  return art(24, 20, (b) => {
    const y0 = 2 - p.lift;
    // legs
    for (const [hx, off] of [
      [7, p.feet[0]],
      [13, p.feet[1]],
    ] as const) {
      thick(b, hx, y0 + 12, hx + off, 17, 2, 1);
      b.rect(hx + off - 1, 18, 4, 2, 2);
      b.set(hx + off - 1, 19, 1);
    }
    // chimney
    b.rect(4, y0 - 2, 3, 3, 1);
    b.rect(3, y0 - 2, 5, 1, 2);
    // body: a squat riveted furnace
    b.rect(3, y0 + 1, 14, 12, 2);
    b.rect(4, y0, 12, 1, 2);
    b.rect(3, y0 + 12, 14, 1, 1);
    b.rect(3, y0 + 1, 1, 12, 1);
    b.set(3, y0 + 1, CLEAR);
    b.rect(4, y0 + 2, 1, 10, 1);
    for (const ry of [y0 + 3, y0 + 10]) b.set(6, ry, 1);
    // visor slit + eye
    b.rect(10, y0 + 3, 6, 2, 0);
    b.set(14, y0 + 3, 3);
    b.set(15, y0 + 3, 3);
    // grill
    const grillTop = y0 + 7;
    if (p.open) {
      b.rect(9, grillTop - 1, 7, 6, 0);
      b.rect(10, grillTop, 6, 4, 3);
      b.rect(10, grillTop + 3, 6, 1, 2);
    } else {
      for (let x = 9; x <= 15; x++) {
        const slot = (x & 1) === 1;
        const c = slot ? 0 : p.glow === 0 ? 1 : p.glow === 1 ? 2 : 3;
        for (let y = grillTop; y < grillTop + 4; y++) b.set(x, y, slot ? (p.glow === 2 && y > grillTop ? 2 : 0) : c);
      }
    }
    // tower shield
    const sx = 17 + (p.shove ?? 0);
    b.rect(16, y0 + 6, sx - 15, 2, 1); // arm
    b.rect(sx, y0 - 1, 4, 16, 2);
    b.rect(sx + 1, y0, 2, 14, 1);
    b.rect(sx + 1, y0 + 6, 2, 2, 2);
    b.set(sx + 3, y0 + 1, 3);
  });
}

defineSheet('foundry-bot', {
  w: 24,
  h: 20,
  ox: 12,
  oy: 20,
  frames: {
    w1: bot({ feet: [-1, 1], lift: 0, glow: 0 }),
    w2: bot({ feet: [0, 0], lift: 1, glow: 0 }),
    w3: bot({ feet: [1, -1], lift: 0, glow: 0 }),
    w4: bot({ feet: [0, 0], lift: 1, glow: 0 }),
    t1: bot({ feet: [-1, 1], lift: 0, glow: 1 }),
    t2: bot({ feet: [-1, 1], lift: 0, glow: 2 }),
    burst: bot({ feet: [-2, 2], lift: 0, glow: 2, open: true }),
    block: bot({ feet: [-2, 0], lift: 0, glow: 0, shove: 1 }),
  },
  anims: {
    walk: { frames: ['w1', 'w2', 'w3', 'w4'], fps: 6 },
    tell: { frames: ['t1', 't2'], fps: 12 },
    burst: { frames: ['burst'], fps: 1 },
    block: { frames: ['block'], fps: 1 },
    idle: { frames: ['w1'], fps: 1 },
  },
});

/** Cone of fire, pivot at its root (left-centre). */
function flameCone(seed: number, len: number): string[] {
  return art(30, 14, (b) => {
    for (let x = 0; x < len; x++) {
      const t = x / len;
      const half = 2 + t * 4.5 + Math.sin(x * 0.7 + seed) * 0.8;
      for (let y = -7; y < 7; y++) {
        const d = Math.abs(y + 0.5) / half;
        if (d > 1) continue;
        const n = hash2(x, y, seed);
        if (t > 0.75 && n < (t - 0.75) * 3) continue;
        let c = d < 0.45 && t < 0.8 ? 3 : d < 0.8 ? 2 : 1;
        if (c === 2 && n < 0.15) c = 3;
        if (c === 1 && bayer(x, y + 7) < 0.4) continue;
        b.set(x, y + 7, c);
      }
    }
  });
}
defineSheet('foundry-burst', {
  w: 30,
  h: 14,
  ox: 0,
  oy: 7,
  frames: { a: flameCone(1, 26), b: flameCone(2, 28), c: flameCone(3, 27), s: flameCone(4, 10) },
  anims: {
    burn: { frames: ['a', 'b', 'c'], fps: 14 },
    start: { frames: ['s'], fps: 1 },
  },
});

// ===========================================================================================
// SENTRY DRONE — a floating furnace eye on a rotor. Shoots reflectable slag.
// ===========================================================================================
const DRONE_ROTOR = ['.22222222222222.', '....22222222....', '..222222222222..'];
const DRONE_SHELL = [
  '.......11.......',
  '.....222222.....',
  '...2233222222...',
  '..222222222222..',
  '.2222222000022..',
  '.222222000EE02..',
  '22222220EEEE0222',
  '.222222000EE02..',
  '.1222222000022..',
  '.11111111111111.',
  '..111111111111..',
  '....11111111....',
];
const DRONE_FLAME = ['......2332......', '.......32.......', '................'];
function drone(rotor: number, eye: number, flame: number): string[] {
  return [DRONE_ROTOR[rotor], ...DRONE_SHELL.map((r) => r.replace(/E/g, String(eye))), DRONE_FLAME[flame]].map((r, i) =>
    // dark pupil core when the eye is idle
    eye === 1 && i === 7 ? r.replace('0EEEE0', '011110') : r,
  );
}
defineSheet('foundry-drone', {
  w: 16,
  h: 14,
  ox: 8,
  oy: 7,
  frames: {
    f1: drone(0, 1, 0),
    f2: drone(1, 1, 1),
    f3: drone(2, 1, 0),
    a1: drone(0, 3, 1),
    a2: drone(1, 2, 0),
    shoot: drone(2, 3, 1),
  },
  anims: {
    fly: { frames: ['f1', 'f2', 'f3'], fps: 14 },
    aim: { frames: ['a1', 'a2'], fps: 14 },
    shoot: { frames: ['shoot'], fps: 1 },
  },
});

// a slug of molten slag (drone shot)
defineSheet('foundry-shot', {
  w: 7,
  h: 7,
  ox: 3,
  oy: 3,
  frames: {
    a: ['..222..', '.23332.', '2333332', '2333332', '2333332', '.23332.', '..222..'],
    b: ['..222..', '.22332.', '2333322', '2333332', '2233332', '.23322.', '..222..'],
  },
  anims: { fly: { frames: ['a', 'b'], fps: 12 } },
});

// ===========================================================================================
// PROPS & MECHANISMS
// ===========================================================================================

// flame jet nozzle (a grate in the floor) and its fire column
defineSheet('foundry-nozzle', {
  w: 10,
  h: 4,
  ox: 5,
  oy: 4,
  frames: {
    cold: ['.22222222.', '2101010102', '2111111112', '2222222222'],
    hot: ['.22222222.', '2303030302', '2131313112', '2222222222'],
  },
  anims: { cold: { frames: ['cold'], fps: 1 }, hot: { frames: ['hot'], fps: 1 } },
});

function flameColumn(seed: number, height: number): string[] {
  return art(10, 34, (b) => {
    for (let y = 0; y < height; y++) {
      const t = y / height; // 0 at the nozzle
      const wob = Math.sin(y * 0.5 + seed * 1.7) * 1.2;
      const half = (t < 0.15 ? 2.5 + t * 8 : 3.7 - t * 2.2) + Math.sin(y * 0.9 + seed) * 0.4;
      for (let x = 0; x < 10; x++) {
        const d = Math.abs(x - 4.5 - wob * t) / Math.max(0.6, half);
        if (d > 1) continue;
        const n = hash2(x, y, seed);
        if (t > 0.8 && n < (t - 0.8) * 4) continue;
        let c = d < 0.5 && t < 0.85 ? 3 : d < 0.85 ? 2 : 1;
        if (c === 2 && n < 0.12) c = 3;
        b.set(x, 33 - y, c);
      }
    }
  });
}
const FLAME_FRAMES = {
  l1: flameColumn(7, 6),
  l2: flameColumn(8, 8),
  b1: flameColumn(1, 32),
  b2: flameColumn(2, 34),
  b3: flameColumn(3, 31),
  e1: flameColumn(4, 14),
};
defineSheet('foundry-flame', {
  w: 10,
  h: 34,
  ox: 5,
  oy: 34,
  frames: FLAME_FRAMES,
  anims: {
    lick: { frames: ['l1', 'l2'], fps: 12 },
    burn: { frames: ['b1', 'b2', 'b3'], fps: 16 },
    end: { frames: ['e1'], fps: 1 },
  },
});
defineSheet('foundry-flame-down', {
  w: 10,
  h: 34,
  ox: 5,
  oy: 0,
  frames: Object.fromEntries(Object.entries(FLAME_FRAMES).map(([k, v]) => [k, vflip(v)])),
  anims: {
    lick: { frames: ['l1', 'l2'], fps: 12 },
    burn: { frames: ['b1', 'b2', 'b3'], fps: 16 },
    end: { frames: ['e1'], fps: 1 },
  },
});

// crusher press head: a riveted iron block with a striped striking face
function pressHead(hot: boolean): string[] {
  return art(24, 14, (b) => {
    b.rect(0, 0, 24, 11, 2);
    b.rect(1, 1, 22, 9, 1);
    b.rect(2, 2, 20, 1, 2);
    for (const x of [3, 20]) for (const y of [4, 7]) b.set(x, y, 2);
    b.rect(8, 3, 8, 5, 0);
    b.rect(9, 4, 6, 3, hot ? 3 : 1);
    b.rect(11, 4, 2, 3, hot ? 2 : 0);
    // striking face with hazard teeth
    for (let x = 0; x < 24; x++) {
      b.set(x, 11, (x >> 1) % 2 === 0 ? 2 : 0);
      b.set(x, 12, (x >> 1) % 2 === 0 ? (hot ? 3 : 2) : 1);
      if (x % 4 === 1) b.set(x, 13, 1);
    }
  });
}
defineSheet('foundry-press', {
  w: 24,
  h: 14,
  ox: 0,
  oy: 0,
  frames: { cold: pressHead(false), hot: pressHead(true) },
  anims: { cold: { frames: ['cold'], fps: 1 }, hot: { frames: ['hot'], fps: 1 } },
});

// press housing bolted under the ceiling
defineSheet('foundry-housing', {
  w: 16,
  h: 6,
  ox: 8,
  oy: 0,
  frames: {
    a: ['2222222222222222', '2111111111111112', '2121111111111212', '.21111111111112.', '..222222222222..', '....21111112....'],
  },
  anims: { a: { frames: ['a'], fps: 1 } },
});

// crane slab: a heavy plate with lifting eyes
defineSheet('foundry-crane', {
  w: 24,
  h: 7,
  ox: 0,
  oy: 2,
  frames: {
    a: [
      '...2..............2.....',
      '..2.2............2.2....',
      '222222222222222222222222',
      '211211111111111111112112',
      '211111111111111111111112',
      '222222222222222222222222',
      '.20.20.20.20.20.20.20.2.',
    ],
  },
  anims: { a: { frames: ['a'], fps: 1 } },
});

// conveyor belt pieces (8x8, drawn over the floor's top tile); frame index = scroll phase
/**
 * Conveyor pieces moving RIGHT (left-moving belts draw them mirrored): a steel lip, a belt with
 * cleats, and chevrons that travel with the belt so its direction reads even in a still frame.
 */
function beltPiece(kind: 'l' | 'm' | 'r', phase: number): string[] {
  return art(8, 8, (b) => {
    b.rect(0, 0, 8, 8, 0);
    const x0 = (phase * 2) % 8;
    for (let x = 0; x < 8; x++) {
      b.set(x, 0, 2);
      b.set(x, 1, (x - phase * 2 + 8) % 4 === 0 ? 0 : 1);
      b.set(x, 6, 1);
      b.set(x, 7, (x + phase * 2) % 4 === 0 ? 0 : 1);
    }
    b.set(x0, 3, 2);
    b.set((x0 + 1) % 8, 4, 2);
    b.set(x0, 5, 2);
    if (kind !== 'm') {
      // end drum with a turning hub
      const ex = kind === 'l' ? 0 : 6;
      b.rect(ex, 1, 2, 6, 2);
      b.set(kind === 'l' ? 0 : 7, 0, CLEAR);
      b.set(kind === 'l' ? 0 : 7, 7, CLEAR);
      b.set(ex + (phase & 1), 3 + (phase >> 1), 0);
    }
  });
}
const BELT: Record<string, string[]> = {};
for (let i = 0; i < 4; i++) for (const k of ['l', 'm', 'r'] as const) BELT[`${k}${i}`] = beltPiece(k, i);
defineSheet('foundry-belt', {
  w: 8,
  h: 8,
  ox: 0,
  oy: 0,
  frames: BELT,
  anims: { run: { frames: ['m0', 'm1', 'm2', 'm3'], fps: 10 } },
});

// rusted catwalk grate that gives way (replaces K crumble blocks here)
defineSheet('foundry-grate', {
  w: 8,
  h: 8,
  ox: 0,
  oy: 0,
  frames: {
    a: ['22222222', '21012101', '20101012', '21010101', '20101012', '21010101', '22222222', '.1....1.'],
    b: ['22222202', '21012101', '20101002', '21000101', '20101012', '21010001', '22202222', '.1....1.'],
    c: ['22022202', '01002100', '20100002', '01000101', '00101002', '21000001', '20202022', '.1....0.'],
  },
  anims: { idle: { frames: ['a'], fps: 1 }, shake: { frames: ['b', 'c'], fps: 10 } },
});

// ---- decor ----------------------------------------------------------------------------------

// crucible of molten metal on a stand
function crucible(bubble: number): string[] {
  return art(18, 16, (b) => {
    b.rect(2, 3, 14, 2, 2); // rim
    b.rect(3, 5, 12, 7, 1);
    b.rect(3, 5, 1, 7, 2);
    b.rect(14, 5, 1, 7, 2);
    b.rect(4, 12, 10, 1, 2);
    b.rect(3, 8, 12, 1, 2); // band
    b.rect(4, 2, 10, 1, 3); // molten surface
    if (bubble === 1) b.set(7, 1, 3);
    if (bubble === 2) {
      b.set(11, 1, 3);
      b.set(10, 0, 3);
    }
    b.set(1, 3, 2);
    b.set(16, 3, 2); // spout
    b.set(17, 2, 2);
    // stand
    b.line(4, 13, 2, 15, 1);
    b.line(13, 13, 15, 15, 1);
    b.rect(5, 13, 8, 1, 1);
  });
}
defineSheet('foundry-crucible', {
  w: 18,
  h: 16,
  ox: 9,
  oy: 16,
  frames: { a: crucible(0), b: crucible(1), c: crucible(2) },
  anims: { bubble: { frames: ['a', 'b', 'a', 'c'], fps: 4 } },
});

// heavy chain with a hook, hanging from a ceiling; frames sway
function chain(sway: number): string[] {
  return art(9, 48, (b) => {
    for (let y = 0; y < 40; y++) {
      const x = 4 + Math.round(((sway * y) / 40) * 1.5);
      const k = y % 4;
      if (k === 0 || k === 2) b.set(x, y, k === 0 ? 2 : 1);
      else {
        b.set(x - 1, y, 1);
        b.set(x + 1, y, 2);
      }
    }
    const hx = 4 + Math.round(sway * 1.5);
    b.line(hx, 40, hx, 44, 2);
    b.line(hx, 44, hx + 2, 46, 2);
    b.line(hx + 2, 46, hx + 3, 45, 2);
    b.set(hx + 3, 44, 2);
    b.set(hx - 1, 44, 1);
  });
}
defineSheet('foundry-chain', {
  w: 9,
  h: 48,
  ox: 4,
  oy: 0,
  frames: { a: chain(0), b: chain(0.5), c: chain(-0.5) },
  anims: { sway: { frames: ['a', 'b', 'a', 'c'], fps: 2 } },
});

// big background gear (behind terrain)
function gear(rot: number): string[] {
  return art(27, 27, (b) => {
    const c = 13;
    for (let y = 0; y < 27; y++)
      for (let x = 0; x < 27; x++) {
        const dx = x - c;
        const dy = y - c;
        const d = Math.hypot(dx, dy);
        const a = Math.atan2(dy, dx) + rot;
        const tooth = Math.cos(a * 10) > 0.3;
        if ((d < 13 && tooth && d > 10.5) || (d <= 10.5 && d > 9.5)) b.set(x, y, 1);
        else if (d < 4 && d > 2.5) b.set(x, y, 1);
        else if (d <= 9.5 && d > 4 && Math.abs(Math.sin(a * 3)) < 0.12) b.set(x, y, 1);
      }
  });
}
defineSheet('foundry-gear', {
  w: 27,
  h: 27,
  ox: 13,
  oy: 13,
  frames: { a: gear(0), b: gear(0.157), c: gear(0.314), d: gear(0.471) },
  anims: { turn: { frames: ['a', 'b', 'c', 'd'], fps: 6 } },
});

// furnace mouth: a brick arch with fire inside
function furnace(f: number): string[] {
  return art(24, 22, (b) => {
    b.rect(1, 4, 22, 18, 1);
    b.ellipse(11.5, 8, 10.5, 7, 1);
    for (let y = 4; y < 22; y++)
      for (let x = 1; x < 23; x++) if (b.get(x, y) === 1 && ((y % 4 === 3) || ((x + (y >> 2) * 3) % 6 === 0))) b.set(x, y, 0);
    // opening
    b.ellipse(11.5, 12, 6, 6, 0);
    b.rect(6, 12, 12, 10, 0);
    // fire
    for (let x = 6; x < 18; x++) {
      const h = 4 + Math.round(Math.abs(Math.sin(x * 1.3 + f * 2.1)) * 4);
      for (let y = 0; y < h; y++) b.set(x, 21 - y, y < h - 3 ? 3 : 2);
    }
    for (let x = 7; x < 17; x += 3) b.set(x + (f % 2), 12 + ((x + f) % 3), 2);
    // grate bars & sill
    for (let x = 7; x < 18; x += 3) b.rect(x, 17, 1, 5, 1);
    b.rect(4, 21, 16, 1, 2);
    b.rect(3, 20, 18, 1, 1);
  });
}
defineSheet('foundry-furnace', {
  w: 24,
  h: 22,
  ox: 12,
  oy: 22,
  frames: { a: furnace(0), b: furnace(1), c: furnace(2) },
  anims: { burn: { frames: ['a', 'b', 'c'], fps: 7 } },
});

// stacked oil drums
defineSheet('foundry-barrels', {
  w: 20,
  h: 16,
  ox: 10,
  oy: 16,
  frames: {
    a: [
      '.....22222222.......',
      '....2111111112......',
      '....2222222222......',
      '....2111111112......',
      '....2122221112......',
      '....2222222222......',
      '....2111111112......',
      '..222222222.2222222.',
      '.2111111112.2111112.',
      '.2222222222.2222222.',
      '.2111111112.2111112.',
      '.2112221112.2122112.',
      '.2111111112.2111112.',
      '.2222222222.2222222.',
      '.2111111112.2111112.',
      '..22222222...22222..',
    ],
  },
  anims: { a: { frames: ['a'], fps: 1 } },
});

// a smokestack rising behind the scenery, puffing soot
function stackFrame(p: number): string[] {
  return art(16, 60, (b) => {
    for (let y = 14; y < 60; y++) {
      const half = 4 + Math.floor((y - 14) / 16);
      b.set(8 - half, y, 1);
      b.set(7 + half, y, 1);
      if ((y - 14) % 10 === 3) for (let x = 8 - half; x <= 7 + half; x++) b.set(x, y, 1);
    }
    b.rect(2, 13, 12, 2, 1);
    // smoke puffs drifting up (dithered rings)
    for (let i = 0; i < 3; i++) {
      const t = (i + p / 3) / 3;
      const r = 1.5 + t * 3;
      const cy = 11 - t * 11;
      const cx = 8 + t * 3;
      for (let y = -4; y <= 4; y++)
        for (let x = -5; x <= 5; x++) {
          const d = Math.hypot(x, y);
          if (d < r && d > r - 1.2 && bayer(x + 8, y + 8) < 0.7 - t * 0.4) b.set(Math.round(cx + x), Math.round(cy + y), 1);
        }
    }
  });
}
defineSheet('foundry-stack', {
  w: 16,
  h: 60,
  ox: 8,
  oy: 60,
  frames: { a: stackFrame(0), b: stackFrame(1), c: stackFrame(2) },
  anims: { puff: { frames: ['a', 'b', 'c'], fps: 3 } },
});

// pipe cluster with a pressure valve and a steam puff (background)
function pipes(p: number): string[] {
  return art(18, 40, (b) => {
    for (const [x, w] of [
      [2, 4],
      [8, 3],
      [13, 3],
    ] as const) {
      for (let y = 4; y < 40; y++) {
        b.set(x, y, 1);
        b.set(x + w - 1, y, 1);
        if (y % 9 === 0) for (let xx = x - 1; xx <= x + w; xx++) b.set(xx, y, 1);
      }
    }
    // valve wheel
    for (let a = 0; a < Math.PI * 2; a += 0.3) b.set(Math.round(9 + Math.cos(a) * 3), Math.round(18 + Math.sin(a) * 3), 1);
    b.line(6, 18, 12, 18, 1);
    // steam puff from the joint
    if (p > 0) {
      const r = p * 1.5;
      for (let y = -3; y <= 3; y++)
        for (let x = -3; x <= 3; x++) if (Math.hypot(x, y) < r && bayer(x + 4, y + 4) < 0.5) b.set(16 + x, 6 + y - p, 1);
    }
  });
}
defineSheet('foundry-pipes', {
  w: 18,
  h: 40,
  ox: 9,
  oy: 40,
  frames: { a: pipes(0), b: pipes(1), c: pipes(2) },
  anims: { hiss: { frames: ['a', 'a', 'a', 'b', 'c'], fps: 5 } },
});

// anvil with a hammer and tongs leaning on it
defineSheet('foundry-anvil', {
  w: 18,
  h: 11,
  ox: 9,
  oy: 11,
  frames: {
    a: [
      '..............2...',
      '22222222222...2...',
      '.2111111112222....',
      '..222222222.......',
      '....21112....1....',
      '....21112....11...',
      '...2111112...1.1..',
      '..222222222..1..1.',
      '.21111111112.1...1',
      '.22222222222......',
      '..1.......1.......',
    ],
  },
  anims: { a: { frames: ['a'], fps: 1 } },
});

// a stack of freshly cast ingots, still glowing
defineSheet('foundry-ingots', {
  w: 16,
  h: 8,
  ox: 8,
  oy: 8,
  frames: {
    a: ['.....2332.......', '....233332......', '...2222222222...', '..2333322333332.', '..2222222222222.', '.23332223333332.', '.22222222222222.', '.11111111111111.'],
    b: ['.....2332.......', '....233232......', '...2222222222...', '..2332322333332.', '..2222222222222.', '.23332223323332.', '.22222222222222.', '.11111111111111.'],
  },
  anims: { glow: { frames: ['a', 'a', 'b'], fps: 3 } },
});

// the Barons' banner: a top hat over crossed hammers
function banner(sway: number): string[] {
  return art(14, 30, (b) => {
    b.rect(0, 0, 14, 2, 2);
    for (let y = 2; y < 26; y++) {
      const off = Math.round((sway * y) / 26);
      for (let x = 1; x < 13; x++) b.set(x + off, y, x === 1 || x === 12 ? 2 : 1);
    }
    // swallowtail
    for (let y = 26; y < 30; y++) {
      const off = Math.round(sway);
      for (let x = 1; x < 13; x++) if (Math.abs(x - 6.5) > (y - 25) * 1.4) b.set(x + off, y, x === 1 || x === 12 ? 2 : 1);
    }
    const o = Math.round(sway * 0.4);
    // top hat
    b.rect(4 + o, 6, 6, 5, 0);
    b.rect(3 + o, 11, 8, 1, 0);
    b.rect(4 + o, 9, 6, 1, 2);
    // crossed hammers
    b.line(3 + o, 21, 10 + o, 14, 0);
    b.line(10 + o, 21, 3 + o, 14, 0);
    b.rect(2 + o, 13, 3, 2, 2);
    b.rect(9 + o, 13, 3, 2, 2);
  });
}
defineSheet('foundry-banner', {
  w: 14,
  h: 30,
  ox: 7,
  oy: 0,
  frames: { a: banner(0), b: banner(1), c: banner(-1) },
  anims: { sway: { frames: ['a', 'b', 'a', 'c'], fps: 2 } },
});

// ===========================================================================================
// NPCs
// ===========================================================================================

// ---- Smith Anvil: a stone golem blacksmith with a forge hammer ---------------------------
function smith(o: { mouth: boolean; blink: boolean; hammer: 'rest' | 'up'; breathe: number }): string[] {
  return art(26, 30, (b) => {
    const y = o.breathe;
    // legs
    b.rect(7, 24, 5, 6, 1);
    b.rect(14, 24, 5, 6, 1);
    b.rect(6, 28, 7, 2, 2);
    b.rect(13, 28, 7, 2, 2);
    // body: big stone torso with apron
    b.rect(4, 9 + y, 18, 16 - y, 2);
    b.rect(5, 10 + y, 16, 14 - y, 1);
    b.rect(8, 14 + y, 10, 11 - y, 0); // apron
    b.rect(9, 15 + y, 8, 9 - y, 1);
    b.line(8, 14 + y, 4, 10 + y, 0); // apron strap
    b.set(12, 18 + y, 2);
    b.set(13, 18 + y, 2);
    // cracks in the stone shoulders
    b.line(6, 11 + y, 7, 13 + y, 0);
    b.line(19, 11 + y, 20, 14 + y, 0);
    // head: a boulder with a heavy brow
    b.rect(8, 1 + y, 11, 9, 2);
    b.rect(9, 2 + y, 9, 7, 1);
    b.rect(8, 3 + y, 11, 1, 2); // brow
    if (!o.blink) {
      b.set(13, 4 + y, 3);
      b.set(16, 4 + y, 3);
      b.set(14, 4 + y, 3);
      b.set(17, 4 + y, 3);
    } else {
      b.rect(13, 5 + y, 2, 1, 0);
      b.rect(16, 5 + y, 2, 1, 0);
    }
    b.rect(12, 7 + y, 6, 1, 0);
    if (o.mouth) b.rect(13, 7 + y, 4, 2, 0);
    // soot beard
    b.rect(11, 8 + y, 7, 2, 0);
    b.set(12, 10 + y, 0);
    b.set(15, 10 + y, 0);
    // back arm
    b.rect(2, 10 + y, 3, 10, 2);
    b.rect(2, 19 + y, 4, 3, 1);
    // front arm + hammer
    if (o.hammer === 'rest') {
      b.rect(21, 10 + y, 3, 9, 2);
      b.rect(20, 18 + y, 5, 3, 1);
      b.line(22, 21 + y, 22, 27, 1); // handle down
      b.rect(19, 26, 7, 4, 2);
      b.rect(20, 27, 5, 2, 1);
    } else {
      b.rect(21, 7 + y, 3, 6, 2);
      b.rect(20, 3 + y, 5, 4, 1);
      b.line(22, 3 + y, 22, -3, 1); // handle up
      b.rect(19, 0, 7, 3, 2);
      b.rect(20, 0, 5, 2, 1);
      b.set(25, 1, 3);
    }
  });
}
defineSheet('foundry-smith', {
  w: 26,
  h: 30,
  ox: 13,
  oy: 30,
  frames: {
    i1: smith({ mouth: false, blink: false, hammer: 'rest', breathe: 0 }),
    i2: smith({ mouth: false, blink: false, hammer: 'rest', breathe: 1 }),
    blink: smith({ mouth: false, blink: true, hammer: 'rest', breathe: 0 }),
    t1: smith({ mouth: true, blink: false, hammer: 'up', breathe: 0 }),
    t2: smith({ mouth: false, blink: false, hammer: 'up', breathe: 0 }),
    t3: smith({ mouth: true, blink: false, hammer: 'rest', breathe: 1 }),
  },
  anims: {
    idle: { frames: ['i1', 'i1', 'i2', 'i2', 'i1', 'i1', 'i2', 'blink'], fps: 3 },
    talk: { frames: ['t1', 't2', 't1', 't3'], fps: 5 },
  },
});

// ---- the Stoker: a soot sprite in a cap, leaning on a coal shovel ------------------------------
const STOKER_TOP = ['..............', '....22222.....', '...2211122....', '..222222222...', '..2222222222..'];
const STOKER_FACE = {
  open: ['..2111111112..', '.211111111112.', '.211311131112.', '.211311131112.', '.211111111112.', '.211111001112.'],
  blink: ['..2111111112..', '.211111111112.', '.211111111112.', '.211311131112.', '.211111111112.', '.211111001112.'],
  talk: ['..2111111112..', '.211111111112.', '.211311131112.', '.211311131112.', '.211110001112.', '.211110001112.'],
};
const STOKER_BODY = {
  rest: ['..21111111122.', '.21111111112.2', '.2111111111..2', '..22222222..22', '...21..12...22', '..221..122..22', '..............'],
  wave: ['..21111111112.', '.211111111122.', '.2111111111.2.', '..22222222..2.', '...21..12...2.', '..221..122.222', '..............'],
};
defineSheet('foundry-stoker', {
  w: 14,
  h: 18,
  ox: 7,
  oy: 18,
  frames: {
    a: [...STOKER_TOP, ...STOKER_FACE.open, ...STOKER_BODY.rest],
    b: [...STOKER_TOP, ...STOKER_FACE.blink, ...STOKER_BODY.rest],
    c: [...STOKER_TOP, ...STOKER_FACE.talk, ...STOKER_BODY.wave],
    d: [...STOKER_TOP, ...STOKER_FACE.open, ...STOKER_BODY.wave],
  },
  anims: {
    idle: { frames: ['a', 'a', 'a', 'a', 'a', 'b'], fps: 4 },
    talk: { frames: ['c', 'd'], fps: 6 },
  },
});

// ---- Cinder: a little flame spirit in shackles ------------------------------------------------
function cinder(o: { flame: number; bright: boolean; mouth: boolean; lift: number }): string[] {
  return art(14, 18, (b) => {
    const y = -o.lift;
    const body = o.bright ? 3 : 2;
    const rim = o.bright ? 2 : 1;
    // flame hair
    const tips = [
      [6, 1],
      [8, 2],
      [4, 3],
    ];
    tips.forEach(([tx, ty], i) => {
      const h = 3 + ((o.flame + i) % 3);
      b.line(tx, ty + y + (3 - h) + 2, tx, ty + y + 5, i === 0 ? body : rim);
    });
    b.ellipse(7, 9 + y, 4.5, 4.5, rim);
    b.ellipse(7, 9 + y, 3.5, 3.5, body);
    b.set(6, 9 + y, 0);
    b.set(9, 9 + y, 0);
    if (o.mouth) b.set(8, 11 + y, 0);
    // little arms
    b.set(2, 11 + y, rim);
    b.set(12, 11 + y, rim);
    // wisp tail
    b.line(7, 14 + y, 6, 16 + y, rim);
    b.set(6, 17 + y, 1);
  });
}
defineSheet('foundry-cinder', {
  w: 14,
  h: 18,
  ox: 7,
  oy: 18,
  frames: {
    c1: cinder({ flame: 0, bright: false, mouth: false, lift: 0 }),
    c2: cinder({ flame: 1, bright: false, mouth: false, lift: 0 }),
    f1: cinder({ flame: 0, bright: true, mouth: false, lift: 1 }),
    f2: cinder({ flame: 1, bright: true, mouth: false, lift: 2 }),
    f3: cinder({ flame: 2, bright: true, mouth: false, lift: 1 }),
    t1: cinder({ flame: 0, bright: true, mouth: true, lift: 1 }),
    t2: cinder({ flame: 2, bright: true, mouth: false, lift: 1 }),
  },
  anims: {
    chained: { frames: ['c1', 'c2'], fps: 3 },
    free: { frames: ['f1', 'f2', 'f3', 'f2'], fps: 6 },
    talk: { frames: ['t1', 't2'], fps: 7 },
  },
});
