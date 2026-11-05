import { PixelBuffer } from '../../../engine/pixels';
import { defineSheet } from '../../../engine/sprites';

/**
 * Underworks art. Characters are hand-drawn ASCII (face RIGHT; the game mirrors them),
 * machines are drawn with code. Palette roles: 0 navy, 1 magenta (rust, shading),
 * 2 teal (bodies, metal), 3 cream (eyes, lights, danger).
 */

const rows = (b: PixelBuffer) => b.toRows();

// =============================================================================================
// SENTRY — a squat dome turret on a tripod. The visor lights up before it fires.
// =============================================================================================
const SENTRY_DOME = [
  '......1.........',
  '......1.........',
  '....2222222.....',
  '...222222222....',
  '..22111111122...',
];
const SENTRY_EYE = {
  look: ['..21000000012...', '..21000033012222', '..21000000011112'],
  blink: ['..21000000012...', '..21000011012222', '..21000000011112'],
  charge1: ['..21333333312...', '..21333003312222', '..21333333311113'],
  charge2: ['..21000000012...', '..21033333012222', '..21000000011113'],
  fire: ['..21333333312...', '..21333333312222', '..21333333311113'],
};
const SENTRY_BASE = [
  '..21111111112222',
  '..22222222222...',
  '...2121212122...',
  '...22222222.....',
  '....11111.......',
  '...2..2..2......',
  '..2...2...2.....',
  '.22..222..22....',
];
function sentry(eye: keyof typeof SENTRY_EYE, tip: '1' | '3' = '1', recoil = 0): string[] {
  const dome = SENTRY_DOME.map((r, i) => (i === 1 ? r.slice(0, 6) + tip + r.slice(7) : r));
  const head = [...dome, ...SENTRY_EYE[eye], ...SENTRY_BASE.slice(0, 4)];
  const shifted = head.map((r) => (recoil ? r.slice(recoil) + '.'.repeat(recoil) : r));
  return [...shifted, ...SENTRY_BASE.slice(4)];
}
defineSheet('underworks-sentry', {
  w: 16,
  h: 16,
  ox: 7,
  oy: 16,
  frames: {
    idle1: sentry('look', '1'),
    idle2: sentry('look', '3'),
    blink: sentry('blink', '1'),
    charge1: sentry('charge1', '3'),
    charge2: sentry('charge2', '1'),
    fire: sentry('fire', '3', 1),
  },
  anims: {
    idle: { frames: ['idle1', 'idle1', 'idle2', 'idle1', 'idle1', 'blink'], fps: 4 },
    charge: { frames: ['charge1', 'charge2'], fps: 14 },
    fire: { frames: ['fire', 'idle1'], fps: 8, loop: false },
  },
});

// The sentry's bolt: a crackling spark ball.
defineSheet('underworks-bolt', {
  w: 7,
  h: 7,
  ox: 3,
  oy: 3,
  frames: {
    a: ['...2...', '..232..', '.23332.', '2333332', '.23332.', '..232..', '...2...'],
    b: ['.2...2.', '..232..', '.23332.', '.33333.', '.23332.', '..232..', '.2...2.'],
    c: ['...2...', '.2.3.2.', '..333..', '2333332', '..333..', '.2.3.2.', '...2...'],
  },
  anims: { fly: { frames: ['a', 'b', 'c'], fps: 16 } },
});

// =============================================================================================
// SEWER RAT — small, fast, rears up (telegraph) before it lunges.
// =============================================================================================
const RAT_TOP = [
  '................',
  '...........22...',
  '.....22222221...',
  '...222222222232.',
  '..22222222222221',
  '.1122222222222..',
  '1..11222222211..',
];
defineSheet('underworks-rat', {
  w: 16,
  h: 9,
  ox: 8,
  oy: 9,
  frames: {
    run1: [...RAT_TOP, '1....2....2.....', '.1..2......2....'],
    run2: [...RAT_TOP, '1.....2..2......', '.1....2..2......'],
    rear: [
      '.........22.....',
      '........2222....',
      '.......2222322..',
      '......22222221..',
      '.....2222222....',
      '....22222222.2..',
      '.1112222222..2..',
      '1...112222......',
      '1....22..22.....',
    ],
    lunge1: [
      '................',
      '................',
      '............22..',
      '.11222222222213.',
      '1..222222222222.',
      '...11222222222..',
      '.....111111.....',
      '..22........22..',
      '.2............2.',
    ],
    lunge2: [
      '................',
      '................',
      '...........22...',
      '..1222222222213.',
      '.1.222222222222.',
      '1..11222222222..',
      '.....111111.....',
      '.....2....2.....',
      '....2......2....',
    ],
  },
  anims: {
    run: { frames: ['run1', 'run2'], fps: 12 },
    rear: { frames: ['rear'], fps: 1 },
    lunge: { frames: ['lunge1', 'lunge2'], fps: 16 },
  },
});

// =============================================================================================
// DRIP SLIME — hangs from the ceiling, quivers, drops, then oozes after you.
// =============================================================================================
defineSheet('underworks-drip', {
  w: 12,
  h: 12,
  ox: 6,
  oy: 12,
  frames: {
    hang1: [
      '.2222222222.',
      '.2222222222.',
      '.2230223022.',
      '.2222222222.',
      '..22222222..',
      '..21222212..',
      '...222222...',
      '...212222...',
      '....2222....',
      '....2122....',
      '.....22.....',
      '............',
    ],
    hang2: [
      '.2222222222.',
      '..22222222..',
      '..23022302..',
      '..22222222..',
      '..22222222..',
      '...212212...',
      '...222222...',
      '....2222....',
      '....2122....',
      '....2222....',
      '.....22.....',
      '.....2......',
    ],
    quiver: [
      '222222222222',
      '.2222222222.',
      '.2332223322.',
      '.2302220302.',
      '.2222222222.',
      '..22222222..',
      '..21222212..',
      '..22222222..',
      '...212212...',
      '...222222...',
      '....2222....',
      '.....33.....',
    ],
    fall: [
      '.....22.....',
      '.....22.....',
      '....2222....',
      '....2222....',
      '...222222...',
      '...230230...',
      '..22222222..',
      '..22222222..',
      '..21222212..',
      '..22111122..',
      '...222222...',
      '............',
    ],
    ooze1: [
      '............',
      '............',
      '............',
      '............',
      '............',
      '....2222....',
      '..22222222..',
      '.2222302302.',
      '.2222222222.',
      '222222222222',
      '211222222112',
      '.1111111111.',
    ],
    ooze2: [
      '............',
      '............',
      '............',
      '............',
      '.....222....',
      '...2222222..',
      '..222230230.',
      '..222222222.',
      '.2222222222.',
      '.2222222222.',
      '.2112222112.',
      '..11111111..',
    ],
    splat: [
      '............',
      '............',
      '............',
      '............',
      '............',
      '............',
      '............',
      '..2..22..2..',
      '.2222302302.',
      '222222222222',
      '211111111112',
      '.1111111111.',
    ],
  },
  anims: {
    hang: { frames: ['hang1', 'hang2'], fps: 3 },
    quiver: { frames: ['quiver', 'hang1'], fps: 16 },
    fall: { frames: ['fall'], fps: 1 },
    splat: { frames: ['splat'], fps: 1 },
    ooze: { frames: ['ooze1', 'ooze2'], fps: 5 },
  },
});

// =============================================================================================
// PIPE EEL — lurks in the water, eyes glint (telegraph), then it lunges out in an arc.
// The body is a chain of segments drawn in code; this is the head.
// =============================================================================================
defineSheet('underworks-eel', {
  w: 16,
  h: 11,
  ox: 6,
  oy: 6,
  frames: {
    shut: [
      '................',
      '...1111.........',
      '..122221........',
      '.22222222222....',
      '2222222222302...',
      '22222222222222..',
      '222222222222222.',
      '2222221111111...',
      '.222222222222...',
      '..11111111......',
      '................',
    ],
    open: [
      '...1111.........',
      '..122221........',
      '.22222222222....',
      '2222222222302...',
      '22222222222222..',
      '222222222222223.',
      '2222222.........',
      '2222222.3.3.....',
      '.222222222222...',
      '..11111111......',
      '................',
    ],
    eyes: [
      '................',
      '................',
      '................',
      '................',
      '................',
      '...30....30.....',
      '................',
      '................',
      '................',
      '................',
      '................',
    ],
  },
  anims: {
    bite: { frames: ['open', 'shut'], fps: 8 },
    glide: { frames: ['shut'], fps: 1 },
    lurk: { frames: ['eyes'], fps: 1 },
  },
});

// Eel body segments (big → small → tail fin), drawn along the head's recent path.
defineSheet('underworks-eelseg', {
  w: 7,
  h: 7,
  ox: 3,
  oy: 3,
  frames: {
    big: ['..111..', '.22222.', '2222222', '2222222', '2222222', '.21112.', '..111..'],
    mid: ['.......', '..111..', '.22222.', '.22222.', '.21112.', '..111..', '.......'],
    small: ['.......', '.......', '..222..', '.22222.', '..111..', '.......', '.......'],
    tail: ['.......', '.1...1.', '..1.1..', '...2...', '..222..', '.......', '.......'],
  },
  anims: { idle: { frames: ['big'], fps: 1 } },
});

// =============================================================================================
// NPCs
// =============================================================================================

// RUSTY — a robot mechanic: dome head, goggle eyes, moustache grille, apron and a big wrench.
const RUSTY_HEAD = {
  idle: [
    '........3.......',
    '........1.......',
    '.....222222.....',
    '....22222222....',
    '...2222222222...',
    '...2333223332...',
    '...2303223032...',
    '...2333223332...',
    '...2222222222...',
    '...2211111122...',
    '....22222222....',
  ],
  blink: [
    '........1.......',
    '........1.......',
    '.....222222.....',
    '....22222222....',
    '...2222222222...',
    '...2222222222...',
    '...2111221112...',
    '...2222222222...',
    '...2222222222...',
    '...2211111122...',
    '....22222222....',
  ],
  talk: [
    '........3.......',
    '........1.......',
    '.....222222.....',
    '....22222222....',
    '...2222222222...',
    '...2333223332...',
    '...2330223302...',
    '...2333223332...',
    '...2222222222...',
    '...2210000122...',
    '....22111122....',
  ],
};
const RUSTY_BODY = {
  rest: [
    '.....111111.....',
    '..22222222222...',
    '.2222111111222..',
    '.22.21111112.22.',
    '.22.21131112.22.',
    '.2..21111112..2.',
    '....22222222..2.',
    '....222..222.222',
    '....222..222.2.2',
    '...1111..1111...',
  ],
  tap: [
    '.....111111.....',
    '..22222222222...',
    '.2222111111222..',
    '.22.21111112.22.',
    '.22.21131112.2..',
    '.2..21111112.2..',
    '....22222222222.',
    '....222..222.2.2',
    '....222..222....',
    '...1111..1111...',
  ],
  wave: [
    '.....111111..2.2',
    '..22222222222222',
    '.2222111111222.2',
    '.22.21111112.2..',
    '.22.21131112....',
    '.2..21111112....',
    '....22222222....',
    '....222..222....',
    '....222..222....',
    '...1111..1111...',
  ],
};
const RUSTY_PAD = ['................'];
defineSheet('underworks-rusty', {
  w: 16,
  h: 22,
  ox: 8,
  oy: 22,
  frames: {
    a: [...RUSTY_PAD, ...RUSTY_HEAD.idle, ...RUSTY_BODY.rest],
    b: [...RUSTY_PAD, ...RUSTY_HEAD.blink, ...RUSTY_BODY.rest],
    c: [...RUSTY_PAD, ...RUSTY_HEAD.idle, ...RUSTY_BODY.tap],
    t1: [...RUSTY_PAD, ...RUSTY_HEAD.talk, ...RUSTY_BODY.wave],
    t2: [...RUSTY_PAD, ...RUSTY_HEAD.idle, ...RUSTY_BODY.wave],
  },
  anims: {
    idle: { frames: ['a', 'a', 'c', 'a', 'c', 'a', 'a', 'b'], fps: 4 },
    talk: { frames: ['t1', 't2'], fps: 7 },
  },
});

// OLD CROAKER — a fat sewer toad in a little bowler hat; his throat sac swells.
const FROG_HEAD = [
  '.......1111.......',
  '......111111......',
  '.....11111111333..',
  '.......22223003...',
  '.....222222333322.',
  '....2222222222222.',
];
const FROG_MOUTH = {
  shut: ['...222222222222222', '..2222222211111112', '..2222222222222222'],
  open: ['...222222222222222', '..2222222210000002', '..2222222221111112'],
};
const FROG_THROAT = {
  small: ['.22222222222222...', '.2222222223332....'],
  big: ['.222222222233333..', '.222222222333332..'],
};
const FROG_LEGS = ['2211222222222.....', '2211122221.22.....', '.11111111..11.....'];
const frog = (mouth: keyof typeof FROG_MOUTH, throat: keyof typeof FROG_THROAT) => [
  ...FROG_HEAD,
  ...FROG_MOUTH[mouth],
  ...FROG_THROAT[throat],
  ...FROG_LEGS,
];
defineSheet('underworks-frog', {
  w: 18,
  h: 14,
  ox: 9,
  oy: 14,
  frames: {
    a: frog('shut', 'small'),
    b: frog('shut', 'big'),
    t: frog('open', 'small'),
  },
  anims: {
    idle: { frames: ['a', 'a', 'a', 'b', 'b', 'a'], fps: 3 },
    talk: { frames: ['t', 'a'], fps: 6 },
  },
});

// DIGBY — a lost mole worker: dark fur, pointy snout, hard hat with a head lamp, big claws.
const MOLE_HAT = {
  on: ['................', '.....222222.....', '....22222222.33.', '...2222222222333', '...2222222222.3.'],
  dim: ['................', '.....222222.....', '....22222222.22.', '...2222222222222', '...2222222222...'],
};
const MOLE_FACE = {
  open: ['....11111111....', '...11111131111..', '...111111111113.', '....11111111111.', '.....1111111....'],
  talk: ['....11111111....', '...11111131111..', '...111111111113.', '....1111111000..', '.....11111110...'],
};
const MOLE_BODY = {
  rest: [
    '....22222222....',
    '..3122222222133.',
    '..31222222221...',
    '....22222222....',
    '....222..222....',
    '...1111..1111...',
    '................',
  ],
  wave: [
    '....22222222.33.',
    '..312222222213..',
    '..31222222221...',
    '....22222222....',
    '....222..222....',
    '...1111..1111...',
    '................',
  ],
};
defineSheet('underworks-mole', {
  w: 16,
  h: 17,
  ox: 8,
  oy: 16,
  frames: {
    a: [...MOLE_HAT.on, ...MOLE_FACE.open, ...MOLE_BODY.rest],
    b: [...MOLE_HAT.dim, ...MOLE_FACE.open, ...MOLE_BODY.rest],
    t1: [...MOLE_HAT.on, ...MOLE_FACE.talk, ...MOLE_BODY.wave],
    t2: [...MOLE_HAT.on, ...MOLE_FACE.open, ...MOLE_BODY.wave],
  },
  anims: {
    idle: { frames: ['a', 'a', 'a', 'a', 'b', 'a', 'b', 'a'], fps: 6 },
    talk: { frames: ['t1', 't2'], fps: 7 },
  },
});

// =============================================================================================
// MECHANICS
// =============================================================================================

/** A valve wheel: rim, hub and four spokes at angle `a`. */
function wheel(size: number, r: number, a: number, rim: number, spoke: number, hub: number): PixelBuffer {
  const b = new PixelBuffer(size, size);
  const c = (size - 1) / 2;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - c, y - c);
      if (Math.abs(d - r) < 0.75) b.set(x, y, rim);
    }
  for (let k = 0; k < 4; k++) {
    const ang = a + (k * Math.PI) / 2;
    for (let d = 1; d < r; d += 0.5) b.set(Math.round(c + Math.cos(ang) * d), Math.round(c + Math.sin(ang) * d), spoke);
  }
  b.set(Math.round(c), Math.round(c), hub);
  return b;
}

/** The strikeable valve: a big wheel on a pipe flange with a status lamp. */
function valveFrame(a: number, lamp: number): string[] {
  const b = new PixelBuffer(16, 16);
  b.rect(6, 12, 4, 4, 1); // pipe stub going into the floor/wall
  b.rect(5, 11, 6, 1, 2);
  b.rect(5, 15, 6, 1, 2);
  b.blit(wheel(13, 5.5, a, 2, 2, 3), 1, 0);
  b.set(13, 1, lamp);
  b.set(14, 1, lamp);
  b.set(13, 2, lamp);
  b.set(14, 2, lamp);
  return rows(b);
}
defineSheet('underworks-valve', {
  w: 16,
  h: 16,
  ox: 8,
  oy: 16,
  frames: {
    shut: valveFrame(Math.PI / 4, 1),
    shutB: valveFrame(Math.PI / 4, 3),
    t1: valveFrame(Math.PI / 4 + 0.4, 3),
    t2: valveFrame(Math.PI / 4 + 0.8, 3),
    t3: valveFrame(Math.PI / 4 + 1.2, 3),
    open: valveFrame(0, 2),
  },
  anims: {
    shut: { frames: ['shut', 'shut', 'shut', 'shutB'], fps: 3 },
    turn: { frames: ['t1', 't2', 't3', 'open'], fps: 10 },
    open: { frames: ['open'], fps: 1 },
  },
});

// Steam vent grate at the foot of an updraft column.
defineSheet('underworks-vent', {
  w: 16,
  h: 6,
  ox: 8,
  oy: 6,
  frames: {
    a: ['..2..2..2..2..2.', '.22222222222222.', '.21111111111112.', '2222222222222222', '.1..1......1..1.', '................'],
  },
  anims: { idle: { frames: ['a'], fps: 1 } },
});

// =============================================================================================
// DECOR
// =============================================================================================

// Pressure gauge on a pipe stand; the needle trembles.
function gauge(a: number): string[] {
  const b = new PixelBuffer(11, 16);
  b.rect(4, 9, 3, 7, 2);
  b.rect(5, 9, 1, 7, 1);
  b.rect(2, 14, 7, 2, 2);
  b.ellipse(5, 5, 4.5, 4.5, 2);
  b.ellipse(5, 5, 3.5, 3.5, 0);
  for (let d = 0; d < 3.5; d += 0.5) b.set(Math.round(5 + Math.cos(a) * d), Math.round(5 + Math.sin(a) * d), 3);
  b.set(5, 5, 1);
  b.set(2, 3, 1);
  b.set(8, 3, 1);
  return rows(b);
}
defineSheet('underworks-gauge', {
  w: 11,
  h: 16,
  ox: 5,
  oy: 16,
  frames: { a: gauge(-2.2), b: gauge(-1.9), c: gauge(-0.6), d: gauge(-0.3) },
  anims: { idle: { frames: ['a', 'b', 'a', 'b', 'c', 'd', 'c', 'b'], fps: 6 } },
});

// Rusty barrel leaking glowing sludge.
const BARREL = [
  '..22222222..',
  '.2111111112.',
  '.2222222222.',
  '.2112112112.',
  '.2113332112.',
  '.2113032112.',
  '.2113332112.',
  '.2222222222.',
  '.2112112112.',
  '.2112112112.',
  '.2222222222.',
  '..22222222..',
];
defineSheet('underworks-barrel', {
  w: 12,
  h: 14,
  ox: 6,
  oy: 14,
  frames: {
    a: [...BARREL, '....2.......', '...222......'],
    b: [...BARREL.map((r, i) => (i === 11 ? '..22222322..' : r)), '....2.......', '...222......'],
    c: [...BARREL.map((r, i) => (i === 11 ? '..22222222..' : r)), '....2...3...', '...222......'],
  },
  anims: { idle: { frames: ['a', 'a', 'a', 'b', 'c'], fps: 5 } },
});

// A rats' nest of rags and bones; eyes blink in the dark.
const NEST = [
  '......................',
  '......................',
  '......1..........1....',
  '.....111...11...111...',
  '...1111111111111111...',
  '..111111111111111111..',
  '.11111111111111111111.',
  '1111111111111111111111',
  '1212112121121211212121',
  '2222222222222222222222',
];
const nestEyes = (pairs: [number, number][]) =>
  NEST.map((r, y) => {
    const chars = r.split('');
    for (const [ex, ey] of pairs) if (ey === y) chars[ex] = chars[ex + 2] = '3';
    return chars.join('');
  });
defineSheet('underworks-nest', {
  w: 22,
  h: 10,
  ox: 11,
  oy: 10,
  frames: {
    a: nestEyes([[5, 6]]),
    b: nestEyes([[14, 5]]),
    c: nestEyes([
      [5, 6],
      [14, 5],
    ]),
    d: NEST,
  },
  anims: { idle: { frames: ['a', 'a', 'd', 'c', 'c', 'b', 'd', 'd'], fps: 2 } },
});

// Work lamp on a tripod: buzzes and flickers.
const WORKLAMP_STAND = [
  '....22....',
  '....12....',
  '....12....',
  '....12....',
  '....12....',
  '....12....',
  '...2112...',
  '..2.12.2..',
  '.2..12..2.',
  '2...22...2',
];
defineSheet('underworks-worklamp', {
  w: 10,
  h: 16,
  ox: 5,
  oy: 16,
  frames: {
    a: ['..222222..', '.21333312.', '.21333312.', '..213312..', '...2222...', '....22....', ...WORKLAMP_STAND],
    b: ['..222222..', '.21333312.', '.21313312.', '..213312..', '...2222...', '....22....', ...WORKLAMP_STAND],
    c: ['..222222..', '.21111112.', '.21111112.', '..211112..', '...2222...', '....22....', ...WORKLAMP_STAND],
  },
  anims: { idle: { frames: ['a', 'a', 'a', 'a', 'b', 'a', 'a', 'c', 'a', 'a', 'a', 'a'], fps: 10 } },
});

// Ceiling pipe elbow with a drop forming and falling.
function dripPipe(dropY: number | null, swell: number): string[] {
  const b = new PixelBuffer(14, 26);
  b.rect(0, 0, 14, 2, 2); // ceiling flange
  b.rect(1, 2, 12, 1, 1);
  b.rect(4, 3, 6, 6, 2); // vertical pipe
  b.rect(5, 3, 1, 6, 1);
  b.rect(8, 4, 1, 4, 0);
  b.rect(3, 9, 8, 2, 2); // collar
  b.rect(4, 11, 6, 2, 2);
  b.rect(5, 12, 4, 1, 0); // mouth
  if (swell > 0) b.rect(6, 13, 2, swell, 2);
  if (dropY !== null) {
    b.rect(6, dropY, 2, 2, 2);
    b.set(6, dropY, 3);
  }
  return rows(b);
}
defineSheet('underworks-drippipe', {
  w: 14,
  h: 26,
  ox: 7,
  oy: 0,
  frames: {
    a: dripPipe(null, 0),
    b: dripPipe(null, 1),
    c: dripPipe(null, 2),
    d: dripPipe(15, 0),
    e: dripPipe(19, 0),
    f: dripPipe(24, 0),
  },
  anims: { drip: { frames: ['a', 'a', 'b', 'c', 'c', 'd', 'e', 'f', 'a', 'a'], fps: 8 } },
});

// The great pump: a spoked flywheel cranking a piston, steam leaking from the cylinder.
function pump(phase: number): string[] {
  const b = new PixelBuffer(44, 40);
  // plinth
  b.rect(0, 36, 44, 4, 2);
  b.rect(1, 37, 42, 1, 1);
  b.rect(2, 34, 40, 2, 1);
  // cylinder (right)
  b.rect(28, 8, 12, 26, 2);
  b.rect(29, 9, 10, 24, 1);
  b.rect(30, 10, 1, 22, 0);
  for (let y = 12; y < 32; y += 5) b.rect(28, y, 12, 1, 2);
  b.rect(27, 6, 14, 2, 2);
  // piston rod going up and down
  const py = 2 + Math.round((1 - Math.cos(phase)) * 3);
  b.rect(33, py - 2, 2, 8, 2);
  b.rect(31, py - 3, 6, 2, 2);
  // flywheel (left)
  const cx = 13;
  const cy = 20;
  b.blit(wheel(27, 12, phase, 2, 1, 2), cx - 13, cy - 13);
  for (let y = -10; y <= 10; y++)
    for (let x = -10; x <= 10; x++) if (Math.abs(Math.hypot(x, y) - 10.5) < 0.6) b.set(cx + x, cy + y, 1);
  b.ellipse(cx, cy, 2, 2, 2);
  b.set(cx, cy, 3);
  // crank: from the wheel rim to the piston crosshead
  const kx = Math.round(cx + Math.cos(phase) * 8);
  const ky = Math.round(cy + Math.sin(phase) * 8);
  b.line(kx, ky, 33, py + 5, 2);
  b.ellipse(kx, ky, 1, 1, 3);
  // stand under the wheel
  b.rect(cx - 2, cy + 12, 5, 4, 2);
  // pressure lamp
  b.rect(41, 14, 3, 3, 2);
  b.set(42, 15, phase % (Math.PI * 2) < Math.PI ? 3 : 1);
  return rows(b);
}
defineSheet('underworks-pump', {
  w: 44,
  h: 40,
  ox: 22,
  oy: 40,
  frames: { a: pump(0), b: pump(Math.PI / 2), c: pump(Math.PI), d: pump((Math.PI * 3) / 2) },
  anims: { run: { frames: ['a', 'b', 'c', 'd'], fps: 6 } },
});

// A wall valve with its pipe stub (decor, turns slowly).
function wallValve(a: number): string[] {
  const b = new PixelBuffer(14, 14);
  b.rect(5, 6, 9, 2, 2);
  b.rect(12, 4, 2, 6, 2);
  b.blit(wheel(11, 4.5, a, 2, 1, 3), 0, 1);
  return rows(b);
}
defineSheet('underworks-wallvalve', {
  w: 14,
  h: 14,
  ox: 7,
  oy: 7,
  frames: { a: wallValve(0.3), b: wallValve(0.7) },
  anims: { idle: { frames: ['a', 'a', 'a', 'b'], fps: 1 } },
});

// Glowing sewer fungus.
defineSheet('underworks-fungus', {
  w: 13,
  h: 9,
  ox: 6,
  oy: 9,
  frames: {
    a: ['.............', '..333........', '.32223....3..', '..2.2....323.', '...2..33..2..', '...2.3223.2..', '...2..22..2..', '..12..12..21.', '.11111111111.'],
    b: ['.............', '..333........', '.33333....3..', '..2.2....333.', '...2..33..2..', '...2.3333.2..', '...2..22..2..', '..12..12..21.', '.11111111111.'],
  },
  anims: { glow: { frames: ['a', 'a', 'a', 'b', 'a', 'b'], fps: 3 } },
});

// Rusty's workbench: a toolbox on a crate.
defineSheet('underworks-bench', {
  w: 18,
  h: 12,
  ox: 9,
  oy: 12,
  frames: {
    a: [
      '......2222........',
      '.....2....2.......',
      '..22222222222222..',
      '..21111311111112..',
      '..22222222222222..',
      '.2222222222222222.',
      '.2111111111111112.',
      '.2121111111112112.',
      '.2112111111121112.',
      '.2111211111211112.',
      '.2111111111111112.',
      '.2222222222222222.',
    ],
  },
  anims: { idle: { frames: ['a'], fps: 1 } },
});

// A big outfall pipe in the wall, pouring a curtain of water.
function outfall(t: number): string[] {
  const b = new PixelBuffer(20, 30);
  b.ellipse(9.5, 6, 9, 6, 2);
  b.ellipse(9.5, 6, 7, 4.5, 1);
  b.ellipse(9.5, 6.5, 5, 3, 0);
  for (let x = 5; x < 15; x++) {
    for (let y = 9; y < 30; y++) {
      const k = (y + t * 3 + (x % 3) * 2) % 6;
      if (k < 3) b.set(x, y, x === 5 || x === 14 ? 1 : (x + y + t) % 4 === 0 ? 3 : 2);
    }
  }
  return rows(b);
}
defineSheet('underworks-outfall', {
  w: 20,
  h: 30,
  ox: 10,
  oy: 0,
  frames: { a: outfall(0), b: outfall(1), c: outfall(2) },
  anims: { pour: { frames: ['a', 'b', 'c'], fps: 10 } },
});

// Caged bulb hanging from a short bracket (ceiling anchor).
defineSheet('underworks-cagelamp', {
  w: 9,
  h: 12,
  ox: 4,
  oy: 0,
  frames: {
    a: ['...222...', '....2....', '....2....', '..22222..', '.2.232.2.', '.2.333.2.', '.2.333.2.', '.2.232.2.', '..22222..', '...2.2...', '.........', '.........'],
    b: ['...222...', '....2....', '....2....', '..22222..', '.2.222.2.', '.2.232.2.', '.2.222.2.', '.2.212.2.', '..22222..', '...2.2...', '.........', '.........'],
  },
  anims: { idle: { frames: ['a', 'a', 'a', 'a', 'a', 'b', 'a', 'b', 'a', 'a', 'a', 'a', 'a', 'a'], fps: 12 } },
});

// Hanging chain with a hook (drawn behind the terrain, so it only shows in open space).
function chain(len: number): string[] {
  const b = new PixelBuffer(5, len + 4);
  for (let y = 0; y < len; y += 4) {
    b.rect(2, y, 1, 3, 1);
    b.rect(1, y + 3, 3, 1, 1);
  }
  b.set(2, len, 1);
  b.set(3, len + 1, 1);
  b.set(3, len + 2, 1);
  b.set(2, len + 3, 1);
  b.set(1, len + 2, 1);
  return rows(b);
}
defineSheet('underworks-chain', {
  w: 5,
  h: 44,
  ox: 2,
  oy: 0,
  frames: { a: chain(40) },
  anims: { idle: { frames: ['a'], fps: 1 } },
});
defineSheet('underworks-chain-short', {
  w: 5,
  h: 24,
  ox: 2,
  oy: 0,
  frames: { a: chain(20) },
  anims: { idle: { frames: ['a'], fps: 1 } },
});
