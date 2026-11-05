import { bayer } from '../../../engine/math';
import { PixelBuffer } from '../../../engine/pixels';
import { defineSheet } from '../../../engine/sprites';

/**
 * Gloomroot sprites. Hand-drawn ASCII for the small critters, paper-doll / procedural
 * PixelBuffer drawing for the bigger or smoothly animated ones (shade robe, braziers, door).
 * Characters face RIGHT. Colour 3 is kept for eyes, flames, glow and danger.
 */

/** Remove pixels with an ordered dither: keep = 1 leaves the frame intact, 0 erases it. */
function dissolve(rows: string[], keep: number): string[] {
  return rows.map((r, y) => [...r].map((c, x) => (c !== '.' && bayer(x, y) < keep ? c : '.')).join(''));
}

/** Shift a frame by (dx, dy) inside its own bounds. */
function shift(rows: string[], dx: number, dy = 0): string[] {
  const h = rows.length;
  const w = rows[0].length;
  const out: string[] = [];
  for (let y = 0; y < h; y++) {
    let row = '';
    for (let x = 0; x < w; x++) row += rows[y - dy]?.[x - dx] ?? '.';
    out.push(row);
  }
  return out;
}

/** Replace characters on one row (handy for blinks and mouths). */
function patch(rows: string[], y: number, row: string): string[] {
  return rows.map((r, i) => (i === y ? row : r));
}

// ---- Bat: sleeps hanging from the ceiling, wakes, flaps toward you ------------------------------
// pivot = top centre: hanging frames grip the ceiling with row 0; flying frames are drawn lower.
const BAT_HANG = [
  '......2.2......',
  '......222......',
  '.....12221.....',
  '....1222221....',
  '....1221221....',
  '....1221221....',
  '....1222221....',
  '.....12221.....',
  '.....21212.....',
  '......222......',
  '.....2...2.....',
];
const BAT_HANG2 = patch(patch(BAT_HANG, 4, '...112212211...'), 5, '...112212211...');
const BAT_WAKE = [
  '......2.2......',
  '......222......',
  '....1122211....',
  '...112222211...',
  '..11.22222.11..',
  '.1...22222...1.',
  '......222......',
  '.....22222.....',
  '.....23232.....',
  '......222......',
  '.....2...2.....',
];
const BAT_WAKE2 = patch(patch(patch(BAT_WAKE, 4, '.111.22222.111.'), 5, '1....22222....1'), 3, '..11222222211..');
const BAT_FLY1 = [
  '2.............2',
  '22...........22',
  '122.........221',
  '.122..2.2..221.',
  '..12222222221..',
  '...122323221...',
  '.....12221.....',
  '......222......',
  '......2.2......',
  '...............',
  '...............',
];
const BAT_FLY2 = [
  '...............',
  '...............',
  '...............',
  '......2.2......',
  '.1122222222211.',
  '122222323222221',
  '1.1.1222221.1.1',
  '......222......',
  '......2.2......',
  '...............',
  '...............',
];
const BAT_FLY3 = [
  '...............',
  '...............',
  '...............',
  '......2.2......',
  '.....22222.....',
  '....1232321....',
  '...122222221...',
  '..12.12221.21..',
  '.12...2.2...21.',
  '.2...........2.',
  '...............',
];
defineSheet('catacombs-bat', {
  w: 15,
  h: 11,
  ox: 7,
  oy: 0,
  frames: { hang1: BAT_HANG, hang2: BAT_HANG2, wake1: BAT_WAKE, wake2: BAT_WAKE2, fly1: BAT_FLY1, fly2: BAT_FLY2, fly3: BAT_FLY3 },
  anims: {
    sleep: { frames: ['hang1', 'hang1', 'hang2'], fps: 2 },
    wake: { frames: ['wake1', 'wake2'], fps: 14 },
    fly: { frames: ['fly1', 'fly2', 'fly3', 'fly2'], fps: 12 },
  },
});

// ---- Skull crawler: a candle-crowned skull on spindly bone legs --------------------------------
const CRAWLER_TOP = {
  a: ['.......3........', '......33........', '......323.......', '.......2........'],
  b: ['........3.......', '.......33.......', '......323.......', '.......2........'],
  c: ['................', '......3.........', '......33........', '.......2........'],
  flare: ['......3.3.......', '.....3333.......', '.....33233......', '......323.......'],
};
const CRAWLER_SKULL = [
  '......222.......',
  '....22222222....',
  '...2222222222...',
  '..22222222002...',
  '..22222222002...',
  '..122222222222..',
  '...1122220222...',
  '....111313131...',
];
const CRAWLER_JAW = [
  '......222.......',
  '....22222222....',
  '...2222222222...',
  '..22222222002...',
  '..22222222002...',
  '..12222222222...',
  '...112222200....',
  '....111..3.3....',
];
const CRAWLER_LEGS = {
  a: ['...2..2...2..2..', '..2...2...2...2.'],
  b: ['....2..2.2..2...', '....2..2.2..2...'],
  c: ['..2..2.....2..2.', '.2...2.....2...2'],
  crouch: ['..22.2...2.22...', '.2...........2..'],
};
defineSheet('catacombs-crawler', {
  w: 16,
  h: 14,
  ox: 8,
  oy: 14,
  frames: {
    walk1: [...CRAWLER_TOP.a, ...CRAWLER_SKULL, ...CRAWLER_LEGS.a],
    walk2: [...CRAWLER_TOP.b, ...CRAWLER_SKULL, ...CRAWLER_LEGS.b],
    walk3: [...CRAWLER_TOP.c, ...CRAWLER_SKULL, ...CRAWLER_LEGS.a],
    alert1: [...CRAWLER_TOP.flare, ...CRAWLER_JAW, ...CRAWLER_LEGS.crouch],
    alert2: [...CRAWLER_TOP.b, ...CRAWLER_SKULL, ...CRAWLER_LEGS.crouch],
    lunge: [...CRAWLER_TOP.c, ...CRAWLER_JAW, ...CRAWLER_LEGS.c],
  },
  anims: {
    walk: { frames: ['walk1', 'walk2', 'walk3', 'walk2'], fps: 7 },
    alert: { frames: ['alert1', 'alert2'], fps: 14 },
    lunge: { frames: ['lunge'], fps: 1 },
  },
});

// ---- Shade: a hooded wraith that blinks between spots and throws ghost orbs -------------------
const SHADE_HOOD = [
  '......1222......',
  '.....122222.....',
  '....12222222....',
  '....122000022...',
  '....1220303022..',
  '....122000002...',
  '....1222000222..',
];
function shadeFrame(phase: number, pose: 'float' | 'charge' | 'fire', eyes = '3'): string[] {
  const b = new PixelBuffer(16, 24);
  // the robe: widens and sways more toward the tattered hem
  for (let y = 6; y < 21; y++) {
    const t = (y - 6) / 14;
    const sway = Math.sin(phase + y * 0.45) * t * 1.6;
    const half = 3 + t * 3 + Math.sin(phase * 2 + y) * 0.4;
    const x0 = Math.round(7.5 + sway - half);
    const x1 = Math.round(7.5 + sway + half);
    for (let x = x0; x <= x1; x++) {
      const tatter = y > 16 && (x + Math.round(phase * 2)) % 3 === 0 && y > 17 + ((x * 7) % 3);
      if (!tatter) b.set(x, y, x === x0 ? 1 : 2);
    }
  }
  // wispy tail
  for (let i = 0; i < 4; i++) b.set(Math.round(7 + Math.sin(phase + i) * 2 - i * 0.5), 21 + Math.min(2, i), 1);
  // fold lines
  for (let y = 9; y < 18; y += 1) if (y % 3 === 0) b.set(8 + Math.round(Math.sin(phase + y * 0.45) * ((y - 6) / 14) * 1.6), y, 1);
  b.stamp(SHADE_HOOD.map((r) => r.replace(/3/g, eyes)), 0, 0);
  // arms
  if (pose === 'float') {
    b.line(10, 9, 12, 12, 1);
    b.line(5, 9, 4, 12, 1);
  } else if (pose === 'charge') {
    b.line(10, 9, 13, 7, 1);
    b.line(13, 7, 14, 6, 2);
    b.line(5, 9, 3, 7, 1);
    b.line(3, 7, 2, 6, 2);
  } else {
    b.line(10, 9, 14, 9, 1);
    b.set(15, 9, 2);
    b.line(5, 9, 3, 11, 1);
  }
  return b.toRows();
}
const SHADE_F1 = shadeFrame(0, 'float');
defineSheet('catacombs-shade', {
  w: 16,
  h: 24,
  ox: 8,
  oy: 12,
  frames: {
    float1: SHADE_F1,
    float2: shadeFrame(1.6, 'float'),
    float3: shadeFrame(3.2, 'float'),
    float4: shadeFrame(4.8, 'float'),
    charge1: shadeFrame(0.5, 'charge'),
    charge2: shadeFrame(2.1, 'charge', '2'),
    fire: shadeFrame(1.2, 'fire'),
    fade1: dissolve(SHADE_F1, 0.7),
    fade2: dissolve(SHADE_F1, 0.4),
    fade3: dissolve(SHADE_F1, 0.15),
  },
  anims: {
    float: { frames: ['float1', 'float2', 'float3', 'float4'], fps: 7 },
    charge: { frames: ['charge1', 'charge2'], fps: 10 },
    fire: { frames: ['fire'], fps: 1 },
    vanish: { frames: ['fade1', 'fade2', 'fade3'], fps: 12, loop: false },
    appear: { frames: ['fade3', 'fade2', 'fade1', 'float1'], fps: 12, loop: false },
  },
});

defineSheet('catacombs-orb', {
  w: 9,
  h: 9,
  ox: 4,
  oy: 4,
  frames: {
    a: ['...222...', '..23332..', '.2333332.', '.2330332.', '.2333332.', '..23332..', '...222...', '....2....', '...2.....'],
    b: ['...222...', '..23332..', '.2333332.', '.2303332.', '.2333332.', '..23332..', '...222...', '...2.....', '....2....'],
    c: ['....2....', '..2232...', '.2333332.', '.2333332.', '.2333332.', '..23322..', '...222...', '....2....', '.....2...'],
  },
  anims: { fly: { frames: ['a', 'b', 'c'], fps: 10 } },
});

// ---- Skeleton: lobs spinning bones from its ledge -------------------------------------------------
const SKEL_HEAD: Record<string, string[]> = {
  normal: ['.2222.', '222222', '200200', '232232', '222222', '.2121.'],
  glare: ['.2222.', '222222', '200200', '233233', '222222', '.2121.'],
};
interface SkelPose {
  head: [number, number];
  hv?: keyof typeof SKEL_HEAD;
  /** back arm, front (throwing) arm, legs: polylines */
  ba: number[];
  fa: number[];
  bone?: [number, number];
}
function skeleton(p: SkelPose): string[] {
  const b = new PixelBuffer(16, 22);
  // legs and pelvis
  b.polyline([6, 15, 5, 18, 5, 21, 4, 21], 2);
  b.polyline([9, 15, 10, 18, 10, 21, 11, 21], 2);
  b.rect(6, 14, 4, 2, 2);
  b.set(7, 15, 1);
  // spine and ribs
  b.line(7, 8, 7, 14, 1);
  for (const y of [8, 10, 12]) {
    b.rect(5, y, 6, 1, 2);
    b.set(5, y + 1, 1);
    b.set(10, y + 1, 1);
  }
  b.polyline(p.ba, 1);
  b.stamp(SKEL_HEAD[p.hv ?? 'normal'], p.head[0], p.head[1]);
  b.polyline(p.fa, 2);
  if (p.bone) {
    const [x, y] = p.bone;
    b.line(x - 1, y - 2, x + 1, y + 2, 3);
    b.set(x - 2, y - 2, 3);
    b.set(x + 2, y + 2, 3);
  }
  return b.toRows();
}
defineSheet('catacombs-skeleton', {
  w: 16,
  h: 22,
  ox: 8,
  oy: 22,
  frames: {
    idle1: skeleton({ head: [5, 1], ba: [5, 8, 4, 11, 4, 13], fa: [10, 8, 11, 11, 11, 13] }),
    idle2: skeleton({ head: [5, 2], ba: [5, 8, 4, 11, 5, 13], fa: [10, 8, 11, 11, 10, 13] }),
    wind1: skeleton({ head: [4, 1], hv: 'glare', ba: [5, 8, 7, 10, 9, 10], fa: [10, 8, 8, 5, 6, 3], bone: [5, 2] }),
    wind2: skeleton({ head: [4, 2], hv: 'glare', ba: [5, 8, 7, 10, 9, 10], fa: [10, 8, 7, 6, 5, 4], bone: [4, 3] }),
    throw: skeleton({ head: [6, 1], ba: [5, 8, 3, 10, 2, 12], fa: [10, 8, 13, 7, 15, 7] }),
  },
  anims: {
    idle: { frames: ['idle1', 'idle1', 'idle2', 'idle2'], fps: 3 },
    windup: { frames: ['wind1', 'wind2'], fps: 9 },
    throw: { frames: ['throw'], fps: 1 },
  },
});

/** A spinning thrown bone, four rotations. */
function boneFrame(a: number): string[] {
  const b = new PixelBuffer(9, 9);
  const dx = Math.cos(a) * 3;
  const dy = Math.sin(a) * 3;
  b.line(4 - dx, 4 - dy, 4 + dx, 4 + dy, 3);
  for (const s of [-1, 1]) {
    const ex = 4 + s * dx;
    const ey = 4 + s * dy;
    b.set(ex + Math.sin(a) * 1.2, ey - Math.cos(a) * 1.2, 2);
    b.set(ex - Math.sin(a) * 1.2, ey + Math.cos(a) * 1.2, 2);
  }
  return b.toRows();
}
defineSheet('catacombs-bone', {
  w: 9,
  h: 9,
  ox: 4,
  oy: 4,
  frames: { r0: boneFrame(0), r1: boneFrame(Math.PI / 4), r2: boneFrame(Math.PI / 2), r3: boneFrame((Math.PI * 3) / 4) },
  anims: { spin: { frames: ['r0', 'r1', 'r2', 'r3'], fps: 16 } },
});

// ---- Pip: a little candle-child whose flame went out (and, once the lantern burns, relit) ----------
const PIP_BODY = [
  '...3333333..',
  '..333333333.',
  '..333303033.',
  '..333303033.',
  '..333333333.',
  '.23333333332',
  '.2333333333.',
  '..323333333.',
  '..323333333.',
  '..22222222..',
  '...2....2...',
];
const PIP_TALK_BODY = patch(PIP_BODY, 4, '..333330333.');
const PIP_BLINK_BODY = patch(PIP_BODY, 2, '..333333333.');
const SMOKE = {
  a: ['......1.....', '.....1......', '......2.....', '......2.....', '............'],
  b: ['.....1......', '......1.....', '.....1......', '......2.....', '............'],
  c: ['............', '......1.....', '.....1......', '......2.....', '............'],
};
const FLAME = {
  a: ['......3.....', '.....33.....', '.....323....', '....23332...', '.....222....'],
  b: ['.......3....', '......33....', '.....323....', '....23332...', '.....222....'],
  c: ['............', '......3.....', '.....333....', '....23332...', '.....222....'],
};
const pip = (top: string[], body: string[]) => [...top, ...body];
defineSheet('catacombs-pip', {
  w: 12,
  h: 16,
  ox: 6,
  oy: 16,
  frames: {
    a: pip(SMOKE.a, PIP_BODY),
    b: pip(SMOKE.b, PIP_BODY),
    c: pip(SMOKE.c, PIP_BODY),
    shiver: shift(pip(SMOKE.b, PIP_BODY), 1),
    blink: pip(SMOKE.c, PIP_BLINK_BODY),
    t1: pip(SMOKE.a, PIP_TALK_BODY),
    t2: pip(SMOKE.b, PIP_BODY),
  },
  anims: {
    idle: { frames: ['a', 'b', 'shiver', 'c', 'a', 'shiver', 'b', 'blink'], fps: 6 },
    talk: { frames: ['t1', 't2'], fps: 7 },
  },
});
defineSheet('catacombs-piplit', {
  w: 12,
  h: 16,
  ox: 6,
  oy: 16,
  frames: {
    a: pip(FLAME.a, PIP_BODY),
    b: pip(FLAME.b, PIP_BODY),
    c: pip(FLAME.c, PIP_BODY),
    blink: pip(FLAME.a, PIP_BLINK_BODY),
    t1: pip(FLAME.b, PIP_TALK_BODY),
    t2: pip(FLAME.c, PIP_BODY),
  },
  anims: {
    idle: { frames: ['a', 'b', 'a', 'c', 'a', 'b', 'blink', 'c'], fps: 8 },
    talk: { frames: ['t1', 't2'], fps: 8 },
  },
});

// ---- Digby the gravedigger mole: helmet lamp, shovel, dirt on his apron ---------------------------
function mole(nose: number, mouth: boolean, shovelUp: number, lamp: number): string[] {
  const b = new PixelBuffer(20, 20);
  // shovel (behind the paws): handle + blade
  const hx = 16;
  b.line(hx, 5 - shovelUp, hx, 16 - shovelUp, 2);
  b.rect(hx - 1, 4 - shovelUp, 3, 1, 2);
  b.rect(hx - 2, 17 - shovelUp, 5, 2, 2);
  b.rect(hx - 1, 19 - shovelUp, 3, 1, 2);
  // round furry body
  b.ellipse(8, 13, 6, 6, 1);
  // apron with a pocket
  b.rect(5, 12, 7, 6, 2);
  b.rect(6, 11, 5, 1, 2);
  b.rect(7, 14, 3, 2, 1);
  // head
  b.ellipse(9, 6, 5, 4, 1);
  // pale muzzle and nose
  b.rect(12, 6, 3, 3, 2);
  b.rect(15, 7, 1, 1, 2);
  b.set(16 + nose, 6, 3);
  b.set(16 + nose, 7, 3);
  // squinting eye under the brim
  b.set(11, 5, 0);
  b.set(12, 5, 0);
  b.set(12, 4, 1);
  if (mouth) b.rect(13, 9, 2, 1, 0);
  // helmet + lamp
  b.rect(5, 1, 8, 3, 2);
  b.rect(4, 3, 10, 1, 2);
  b.rect(6, 0, 6, 1, 2);
  b.rect(12, 1, 2, 2, lamp);
  b.set(14, 1, lamp);
  // big pale digging claws gripping the handle, feet
  b.rect(14, 10, 2, 3, 3);
  b.set(13, 11, 2);
  b.rect(4, 18, 4, 2, 2);
  b.rect(9, 18, 4, 2, 2);
  b.set(3, 19, 3);
  b.set(13, 19, 3);
  return b.toRows();
}
defineSheet('catacombs-mole', {
  w: 20,
  h: 20,
  ox: 9,
  oy: 20,
  frames: {
    a: mole(0, false, 0, 3),
    b: mole(1, false, 0, 3),
    c: mole(0, false, 0, 2),
    t1: mole(0, true, 1, 3),
    t2: mole(1, false, 0, 3),
  },
  anims: {
    idle: { frames: ['a', 'a', 'b', 'a', 'a', 'a', 'c', 'a'], fps: 5 },
    talk: { frames: ['t1', 't2'], fps: 6 },
  },
});

// ---- Bone brazier: strike it to light it for good --------------------------------------------------
const BRAZIER_BASE = [
  '..222222222222..',
  '..211211211212..',
  '...2222222222...',
  '....22022022....',
  '.....222222.....',
  '......2112......',
  '......2112......',
  '......2112......',
  '......2112......',
  '......2112......',
  '.....222222.....',
  '....22111122....',
  '...2222222222...',
];
const FLAMES = {
  a: ['.......3........', '......33........', '......33...3....', '.....3333..3....', '..3..33233.33...', '..33.322233333..', '..3332222223333.', '...33222222233..', '....322222223...', '................'],
  b: ['........3.......', '........33......', '...3...333......', '...3..33333.....', '..33.332233..3..', '..333322223..33.', '.33322222233333.', '..3322222222333.', '...32222222223..', '................'],
  c: ['......3.........', '......3...3.....', '.....33...33....', '.....333.333....', '.3..3322333.3...', '.33.332223333...', '.3333222222333..', '..33222222223...', '...3222222223...', '................'],
};
const EMBERS = {
  a: [...Array(8).fill('................'), '.....1..3..1....', '....1.1111.3....'],
  b: [...Array(8).fill('................'), '.....3..1..1....', '....1.1111.1....'],
};
defineSheet('catacombs-brazier', {
  w: 16,
  h: 23,
  ox: 8,
  oy: 23,
  frames: {
    off1: [...EMBERS.a, ...BRAZIER_BASE],
    off2: [...EMBERS.b, ...BRAZIER_BASE],
    lit1: [...FLAMES.a, ...BRAZIER_BASE],
    lit2: [...FLAMES.b, ...BRAZIER_BASE],
    lit3: [...FLAMES.c, ...BRAZIER_BASE],
  },
  anims: {
    off: { frames: ['off1', 'off2'], fps: 2 },
    lit: { frames: ['lit1', 'lit2', 'lit3'], fps: 9 },
  },
});

// ---- Sealed tomb door: one rune socket per brazier that holds it shut --------------------------------
function tombDoor(lit: number, slots: number): string[] {
  const b = new PixelBuffer(16, 32);
  b.rect(0, 4, 16, 28, 2);
  b.rect(1, 5, 14, 26, 1);
  // arched lintel
  b.rect(2, 2, 12, 2, 2);
  b.rect(4, 1, 8, 1, 2);
  b.rect(6, 0, 4, 1, 2);
  // central seam and stone courses
  b.line(7, 6, 7, 30, 0);
  for (const y of [11, 19, 27]) {
    b.line(1, y, 6, y, 0);
    b.line(8, y, 14, y, 0);
  }
  // carved skull
  b.stamp(['.2222.', '222222', '200200', '222222', '.2..2.'], 5, 5);
  // rune sockets
  for (let i = 0; i < slots; i++) {
    const y = 14 + i * 6;
    b.rect(5, y, 6, 4, 0);
    const c = i < lit ? 3 : 1;
    b.rect(6, y + 1, 4, 2, c);
    if (i < lit) {
      b.set(7, y, 3);
      b.set(8, y + 3, 3);
    }
  }
  // roots creeping over the stone
  b.polyline([0, 8, 2, 10, 2, 14, 1, 17], 2);
  b.polyline([15, 21, 13, 23, 14, 26, 13, 29], 2);
  return b.toRows();
}
const doorFrames: Record<string, string[]> = {};
for (let slots = 1; slots <= 3; slots++) for (let lit = 0; lit <= slots; lit++) doorFrames[`s${slots}l${lit}`] = tombDoor(lit, slots);
defineSheet('catacombs-door', {
  w: 16,
  h: 32,
  ox: 0,
  oy: 32,
  frames: doorFrames,
  anims: Object.fromEntries(Object.keys(doorFrames).map((k) => [k, { frames: [k], fps: 1 }])),
});

// ---- Lumen pod: strike it and it bursts into drifting, glowing spores ----------------------------
const POD = [
  '....2222....',
  '..22322322..',
  '.2232222322.',
  '.2222232222.',
  '.2322222232.',
  '..22232222..',
  '...222222...',
  '.....11.....',
  '.....11.....',
  '....1..1....',
  '...1....1...',
  '..11....11..',
];
const POD_PULSE = POD.map((r) => r.replace(/3/g, '2')).map((r, y) => (y === 3 ? '.2232333222.' : y === 2 ? '.2233333322.' : r));
const POD_SPENT = [
  ...Array(5).fill('............'),
  '....1..1....',
  '...1.11.1...',
  '.....11.....',
  '.....11.....',
  '....1..1....',
  '...1....1...',
  '..11....11..',
];
defineSheet('catacombs-pod', {
  w: 12,
  h: 12,
  ox: 6,
  oy: 12,
  frames: { a: POD, b: POD_PULSE, spent: POD_SPENT },
  anims: {
    idle: { frames: ['a', 'a', 'b'], fps: 3 },
    spent: { frames: ['spent'], fps: 1 },
  },
});

defineSheet('catacombs-spore', {
  w: 3,
  h: 3,
  ox: 1,
  oy: 1,
  frames: { a: ['.3.', '323', '.3.'], b: ['.2.', '232', '.2.'], c: ['...', '.3.', '...'] },
  anims: { glow: { frames: ['a', 'b', 'a', 'c'], fps: 6 } },
});

defineSheet('catacombs-firefly', {
  w: 7,
  h: 5,
  ox: 3,
  oy: 2,
  frames: {
    a: ['.2...2.', '..2.2..', '..131..', '...3...', '.......'],
    b: ['.......', '.22.22.', '..131..', '...3...', '.......'],
    dim: ['.......', '.22.22.', '..121..', '...2...', '.......'],
  },
  anims: { buzz: { frames: ['a', 'b', 'a', 'b', 'a', 'b', 'dim', 'b'], fps: 14 } },
});

// ---- Glowcap: a springy mushroom that bounces you high --------------------------------------------
const SHROOM_CAP = [
  '.....222222.....',
  '...2223223222...',
  '..222222222232..',
  '.23222232222222.',
  '2222222222232222',
  '1111111111111111',
];
const SHROOM_STEM = ['.....1.1.1.1....', '......2222......', '......2112......', '......2112......', '.....221122.....', '....11111111....'];
defineSheet('catacombs-shroom', {
  w: 16,
  h: 12,
  ox: 8,
  oy: 12,
  frames: {
    a: [...SHROOM_CAP, ...SHROOM_STEM],
    b: [...SHROOM_CAP.map((r) => r.replace(/3/g, '2')).map((r, y) => (y === 1 ? '...2232232322...' : r)), ...SHROOM_STEM],
    squash: [
      '................',
      '................',
      '................',
      '....22222222....',
      '.22232222232222.',
      '2222222322222222',
      '1111111111111111',
      '.....1.1.1.1....',
      '......2222......',
      '......2112......',
      '.....221122.....',
      '....11111111....',
    ],
    stretch: [
      '....22222222....',
      '..222322232222..',
      '.22222222222322.',
      '2222322222222222',
      '1111111111111111',
      '.....1.1.1.1....',
      '......2222......',
      '......2112......',
      '......2112......',
      '......2112......',
      '.....221122.....',
      '....11111111....',
    ],
  },
  anims: {
    idle: { frames: ['a', 'a', 'a', 'b'], fps: 3 },
    squash: { frames: ['squash'], fps: 1 },
    stretch: { frames: ['stretch'], fps: 1 },
  },
});

// ---- Bone bridge: lashed bones that give way a moment after you land -----------------------------------
defineSheet('catacombs-bonebridge', {
  w: 8,
  h: 8,
  ox: 0,
  oy: 0,
  frames: {
    a: ['22222222', '21212121', '.2.11.2.', '..2..2..', '.2.12.2.', '2..1...2', '........', '........'],
    b: ['22222222', '21202121', '.2.11.2.', '..2..0..', '.2.10.2.', '2..1...2', '........', '........'],
    c: ['22202022', '20212101', '.2.01.2.', '..0..2..', '.2.10...', '2......2', '........', '........'],
  },
  anims: {
    idle: { frames: ['a'], fps: 1 },
    shake: { frames: ['b', 'c'], fps: 12 },
  },
});

// ---- Burial urn: break it for a soul or two -------------------------------------------------------------
defineSheet('catacombs-urn', {
  w: 9,
  h: 11,
  ox: 4,
  oy: 11,
  frames: {
    a: ['..22222..', '...212...', '..22222..', '.2211122.', '221222122', '212121212', '221222122', '.2211122.', '..22222..', '...222...', '..22222..'],
    b: ['..22222..', '...212...', '..22222..', '.2211122.', '221222122', '212121212', '221222122', '.2211122.', '..22222..', '...222...', '..22222..'].map((r, y) =>
      y === 5 ? '212020212' : r,
    ),
  },
  anims: { idle: { frames: ['a'], fps: 1 }, hit: { frames: ['b'], fps: 1 } },
});

// ================================= decor =================================

defineSheet('catacombs-candles', {
  w: 13,
  h: 12,
  ox: 6,
  oy: 12,
  frames: {
    a: ['...3.........', '..33.....3...', '..32....33...', '...2....32...', '..222....2...', '..232...222.3', '..222...232.2', '.3222...222.2', '..222...222222', '..2221..2222.2', '.12222111222.1', '1111111111111'].map((r) => r.slice(0, 13).padEnd(13, '.')),
    b: ['..3..........', '..33......3..', '..32.....33..', '...2....32...', '..222....2...', '..232...222.3', '..222...232.2', '.3222...222.2', '..222...222222', '..2221..2222.2', '.12222111222.1', '1111111111111'].map((r) => r.slice(0, 13).padEnd(13, '.')),
    c: ['...3.........', '...3.....3...', '..33.....3...', '...2....32...', '..222....2...', '..232...222..', '..222...232.3', '.3222...222.2', '..222...222222', '..2221..2222.2', '.12222111222.1', '1111111111111'].map((r) => r.slice(0, 13).padEnd(13, '.')),
  },
  anims: { flicker: { frames: ['a', 'b', 'a', 'c'], fps: 7 } },
});

const SKULL_CANDLE_BASE = ['..2222..', '.222222.', '.200202.', '.222222.', '..2121..', '..1111..'];
defineSheet('catacombs-skullcandle', {
  w: 8,
  h: 12,
  ox: 4,
  oy: 12,
  frames: {
    a: ['...3....', '...33...', '...32...', '....2...', '...22...', '...22...', ...SKULL_CANDLE_BASE],
    b: ['....3...', '...33...', '...32...', '....2...', '...22...', '...22...', ...SKULL_CANDLE_BASE],
    c: ['........', '...3....', '...33...', '....2...', '...22...', '...22...', ...SKULL_CANDLE_BASE],
  },
  anims: { flicker: { frames: ['a', 'b', 'a', 'c'], fps: 6 } },
});

function coffin(open: boolean): string[] {
  const b = new PixelBuffer(13, 26);
  const outline = [3, 0, 9, 0, 12, 6, 10, 25, 2, 25, 0, 6, 3, 0];
  // fill the hexagonal coffin shape row by row
  for (let y = 0; y < 26; y++) {
    const half = y < 6 ? 3 + (y / 6) * 3 : 6 - ((y - 6) / 19) * 2;
    for (let x = Math.round(6 - half); x <= Math.round(6 + half); x++) b.set(x, y, 1);
  }
  b.polyline(outline, 2);
  if (open) {
    // lid ajar: a dark gap down one side and a bony hand
    b.line(9, 2, 10, 23, 0);
    b.set(10, 12, 3);
    b.set(11, 13, 2);
    b.set(11, 11, 2);
  }
  // crossed bones carved into the lid
  b.line(4, 7, 8, 13, 2);
  b.line(8, 7, 4, 13, 2);
  for (const [x, y] of [
    [3, 6],
    [9, 6],
    [3, 14],
    [9, 14],
  ])
    b.set(x, y, 2);
  return b.toRows();
}
defineSheet('catacombs-coffin', {
  w: 13,
  h: 26,
  ox: 6,
  oy: 26,
  frames: { shut: coffin(false), ajar: coffin(true) },
  anims: { shut: { frames: ['shut'], fps: 1 }, ajar: { frames: ['ajar'], fps: 1 } },
});

function niche(flame: number): string[] {
  const b = new PixelBuffer(18, 20);
  // arched recess
  for (let y = 0; y < 20; y++) {
    const half = y < 6 ? Math.sqrt(Math.max(0, 36 - (6 - y) * (6 - y))) + 2 : 8;
    for (let x = Math.round(8.5 - half); x <= Math.round(8.5 + half); x++) b.set(x, y, 0);
  }
  for (let y = 0; y < 20; y++) {
    const half = y < 6 ? Math.sqrt(Math.max(0, 36 - (6 - y) * (6 - y))) + 2 : 8;
    b.set(Math.round(8.5 - half), y, 1);
    b.set(Math.round(8.5 + half), y, 1);
  }
  b.rect(1, 19, 16, 1, 1);
  // stacked skulls
  const skull = ['.111.', '11111', '10101', '.111.'];
  for (const [x, y] of [
    [2, 15],
    [7, 15],
    [12, 15],
    [4, 11],
    [10, 11],
  ])
    b.stamp(skull, x, y);
  // a candle on the top skull row
  b.rect(8, 8, 2, 3, 2);
  b.set(8 + flame, 6, 3);
  b.set(8, 7, 3);
  b.set(9, 7, 3);
  return b.toRows();
}
defineSheet('catacombs-niche', {
  w: 18,
  h: 20,
  ox: 9,
  oy: 20,
  frames: { a: niche(0), b: niche(1) },
  anims: { flicker: { frames: ['a', 'b'], fps: 4 } },
});

function rootCurtain(phase: number): string[] {
  const b = new PixelBuffer(13, 30);
  const strands = [
    [2, 18],
    [5, 29],
    [7, 22],
    [10, 26],
    [12, 12],
  ];
  for (const [sx, len] of strands) {
    let x = sx;
    for (let y = 0; y < len; y++) {
      const off = Math.round(Math.sin(y * 0.25 + sx + phase) * (y / len) * 1.5);
      b.set(x + off, y, y < 4 ? 2 : 1);
      if (y === len - 1) b.set(x + off, y, 2);
      if (y % 8 === 5 && y < len - 3) b.set(x + off + (sx & 1 ? 1 : -1), y + 1, 1);
      x = sx;
    }
  }
  b.rect(0, 0, 13, 1, 2);
  return b.toRows();
}
defineSheet('catacombs-roots', {
  w: 13,
  h: 30,
  ox: 6,
  oy: 0,
  frames: { a: rootCurtain(0), b: rootCurtain(1.2), c: rootCurtain(2.4) },
  anims: { sway: { frames: ['a', 'b', 'c', 'b'], fps: 2 } },
});

defineSheet('catacombs-fungus', {
  w: 14,
  h: 10,
  ox: 7,
  oy: 10,
  frames: {
    a: ['....222.......', '...23332......', '..2333332..22.', '..2223222.2332', '....1.1...2222', '.22..1....1.1.', '2332.1.....1..', '2222.1..22.1..', '.11..1.2332.1.', '.1...1.1..1.1.'].map((r) =>
      r.slice(0, 14).padEnd(14, '.'),
    ),
    b: ['....222.......', '...22322......', '..2233322..22.', '..2223222.2232', '....1.1...2222', '.22..1....1.1.', '2232.1.....1..', '2222.1..22.1..', '.11..1.2232.1.', '.1...1.1..1.1.'].map((r) =>
      r.slice(0, 14).padEnd(14, '.'),
    ),
  },
  anims: { glow: { frames: ['a', 'a', 'b', 'b'], fps: 2 } },
});

function glowworms(phase: number): string[] {
  const b = new PixelBuffer(11, 26);
  const threads = [
    [1, 14],
    [4, 23],
    [6, 9],
    [9, 18],
  ];
  for (const [x, len] of threads) {
    for (let y = 0; y < len; y++) if (y % 2 === 0 || y < 3) b.set(x, y, 1);
    const lit = Math.sin(phase + x) > -0.3;
    b.set(x, len, lit ? 3 : 2);
    b.set(x, len - 3, 2);
    if (len > 12) b.set(x, Math.floor(len / 2), lit ? 2 : 1);
  }
  return b.toRows();
}
defineSheet('catacombs-glowworms', {
  w: 11,
  h: 26,
  ox: 5,
  oy: 0,
  frames: { a: glowworms(0), b: glowworms(2), c: glowworms(4) },
  anims: { glow: { frames: ['a', 'b', 'c'], fps: 3 } },
});

defineSheet('catacombs-tombstone', {
  w: 12,
  h: 14,
  ox: 6,
  oy: 14,
  frames: {
    a: [
      '...222222...',
      '..21111112..',
      '.2111221112.',
      '.2112222112.',
      '.2112112112.',
      '.2112222112.',
      '.2111111112.',
      '.2121121212.',
      '.2111111112.',
      '.2112111212.',
      '.2111111112.',
      '22222222222.',
      '2.2.22.2.22.',
      '22222222222.',
    ],
  },
  anims: { idle: { frames: ['a'], fps: 1 } },
});

defineSheet('catacombs-bones', {
  w: 16,
  h: 6,
  ox: 8,
  oy: 6,
  frames: {
    a: ['......222.......', '2....22002...2..', '.2..222222..2...', '..22.2121.22..2.', '.2..2222222..22.', '2222221112222222'],
  },
  anims: { idle: { frames: ['a'], fps: 1 } },
});

/** The grand sealed tomb behind the sector lantern (background). */
function tombGate(): string[] {
  const b = new PixelBuffer(40, 44);
  // steps
  b.rect(0, 40, 40, 4, 1);
  b.rect(3, 37, 34, 3, 1);
  // columns
  for (const x of [4, 32]) {
    b.rect(x, 10, 4, 27, 1);
    b.rect(x - 1, 9, 6, 1, 1);
    b.rect(x - 1, 36, 6, 1, 1);
    for (let y = 12; y < 35; y += 3) b.set(x + 1, y, 0);
  }
  // pediment
  for (let y = 0; y < 9; y++) {
    const half = 4 + y * 2;
    b.rect(20 - half, y, half * 2, 1, 1);
  }
  b.rect(1, 8, 38, 1, 0);
  b.stamp(['.1111.', '111111', '100100', '111111', '.1..1.'].map((r) => r.replace(/1/g, '0').replace(/\./g, '1')), 17, 2);
  // door opening
  b.rect(12, 14, 16, 23, 0);
  b.rect(13, 15, 14, 22, 1);
  b.line(20, 15, 20, 36, 0);
  for (let y = 18; y < 36; y += 5) {
    b.rect(14, y, 5, 1, 0);
    b.rect(22, y, 5, 1, 0);
  }
  return b.toRows();
}
defineSheet('catacombs-tombgate', {
  w: 40,
  h: 44,
  ox: 20,
  oy: 44,
  frames: { a: tombGate() },
  anims: { idle: { frames: ['a'], fps: 1 } },
});
