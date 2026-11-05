import { PixelBuffer } from '../engine/pixels';
import { defineSheet } from '../engine/sprites';

/**
 * TWIG — a spirit living in a little wooden puppet.
 *
 * Built like a paper doll: a hand-drawn head and body are stamped onto a 16x20 frame,
 * and the thin wooden limbs are lines between a few joint points. Every animation frame
 * is just one line of numbers, so new poses take seconds to make.
 */

/** The 7x6 face (head rows 2-7) for each expression. */
const FACE: Record<string, string[]> = {
  normal: ['.33333.', '3333333', '2330303', '2330303', '2333333', '.22222.'],
  blink: ['.33333.', '3333333', '2333333', '2330303', '2333333', '.22222.'],
  up: ['.33333.', '3330303', '2330303', '2333333', '2333333', '.22222.'],
  hurt: ['.33333.', '3333333', '2303033', '2333333', '2333303', '.22222.'],
};

/**
 * What grows on top of the head. Swapping these few pixels re-skins every animation frame:
 * a tiny taste of avatar customisation for a multi-world game.
 */
export const AVATARS: Record<string, string[]> = {
  sprout: ['....22.', '...2...'],
  horns: ['.2...2.', '.2...2.'],
  cat: ['.2...2.', '.22.22.'],
  bud: ['..323..', '...2...'],
  antenna: ['...3...', '...2...'],
  cap: ['..222..', '.22322.', '2222222'],
};

function head(face: string, avatar: string): string[] {
  const rows = ['.......', '.......', ...FACE[face]];
  (AVATARS[avatar] ?? AVATARS.sprout).forEach((top, y) => {
    rows[y] = [...rows[y]].map((ch, x) => (top[x] !== '.' ? top[x] : ch)).join('');
  });
  return rows;
}

const BODY = ['.222.', '12222', '12222', '11222'];

interface Pose {
  /** Top-left of the 7x8 head (incl. what grows on top) and the 5x4 body. */
  head: [number, number];
  hv?: keyof typeof FACE;
  body: [number, number];
  /** Limbs are polylines [x0,y0, x1,y1, …]: back arm / front arm / back leg / front leg. */
  ba: number[];
  fa: number[];
  bl: number[];
  fl: number[];
  /** The wooden stick Twig swings. */
  stick?: number[];
}

function pose(p: Pose, avatar: string): string[] {
  const b = new PixelBuffer(16, 20);
  b.polyline(p.ba, 2);
  b.polyline(p.bl, 2);
  b.stamp(BODY, p.body[0], p.body[1]);
  b.polyline(p.fl, 3);
  b.stamp(head(p.hv ?? 'normal', avatar), p.head[0], p.head[1]);
  b.polyline(p.fa, 3);
  if (p.stick) b.polyline(p.stick, 2);
  return b.toRows();
}

// Shared limb sets
const STAND_LEGS = { bl: [7, 16, 7, 19, 8, 19], fl: [10, 16, 10, 19, 11, 19] };
const STRIDE_LEGS = { bl: [7, 16, 5, 19, 6, 19], fl: [10, 16, 12, 19, 13, 19] };
const LUNGE_LEGS = { bl: [7, 17, 5, 19, 6, 19], fl: [10, 17, 12, 19, 13, 19] };
const TUCK_LEGS = { bl: [7, 15, 7, 17, 8, 17], fl: [10, 15, 11, 16, 11, 18, 12, 18] };

// prettier-ignore
const POSES: Record<string, Pose> = {
  idle1: { head: [5, 4], body: [6, 12], ba: [5, 13, 5, 15], fa: [11, 13, 11, 15], ...STAND_LEGS },
  idle2: { head: [5, 5], body: [6, 12], ba: [5, 13, 5, 15], fa: [11, 13, 11, 15], ...STAND_LEGS },
  blink: { head: [5, 4], hv: 'blink', body: [6, 12], ba: [5, 13, 5, 15], fa: [11, 13, 11, 15], ...STAND_LEGS },

  run1: { head: [6, 5], body: [6, 13], ba: [5, 14, 6, 16], fa: [11, 14, 10, 16], bl: [7, 17, 5, 19, 6, 19], fl: [10, 17, 12, 19, 13, 19] },
  run2: { head: [6, 4], body: [6, 12], ba: [5, 13, 4, 15], fa: [11, 13, 12, 15], bl: [7, 16, 6, 17, 4, 17], fl: [10, 16, 10, 19, 11, 19] },
  run3: { head: [6, 5], body: [6, 13], ba: [5, 14, 4, 16], fa: [11, 14, 13, 15], bl: [7, 17, 10, 19, 11, 19], fl: [10, 17, 7, 19, 8, 19] },
  run4: { head: [6, 4], body: [6, 12], ba: [5, 13, 6, 15], fa: [11, 13, 10, 15], bl: [7, 16, 7, 19, 8, 19], fl: [10, 16, 9, 17, 7, 17] },

  jump: { head: [5, 3], body: [6, 11], ba: [5, 12, 4, 10], fa: [11, 12, 12, 10], ...TUCK_LEGS },
  apex: { head: [5, 4], body: [6, 12], ba: [5, 13, 3, 13], fa: [11, 13, 13, 13], bl: [7, 16, 6, 18, 7, 18], fl: [10, 16, 11, 18, 12, 18] },
  fall: { head: [5, 4], body: [6, 12], ba: [5, 13, 4, 11], fa: [11, 13, 12, 11], bl: [7, 16, 6, 19, 7, 19], fl: [10, 16, 11, 19, 12, 19] },
  wall: { head: [5, 4], body: [6, 12], ba: [5, 13, 4, 11], fa: [11, 13, 12, 15], bl: [7, 16, 5, 17, 4, 19], fl: [10, 16, 10, 19, 11, 19] },
  dash: { head: [7, 5], body: [6, 12], ba: [6, 13, 3, 14], fa: [10, 13, 7, 15], bl: [7, 16, 4, 16, 3, 17], fl: [9, 16, 6, 17, 5, 18] },

  slashA1: { head: [5, 4], body: [6, 12], ba: [5, 13, 4, 15], fa: [11, 13, 10, 10], stick: [10, 10, 8, 7], bl: [7, 16, 6, 19, 7, 19], fl: [10, 16, 11, 19, 12, 19] },
  slashA2: { head: [6, 4], body: [6, 12], ba: [5, 13, 4, 14], fa: [11, 13, 14, 13], stick: [14, 13, 15, 12], ...STRIDE_LEGS },
  slashA3: { head: [6, 5], body: [6, 13], ba: [5, 14, 4, 15], fa: [11, 14, 13, 16], stick: [13, 16, 15, 18], ...LUNGE_LEGS },
  slashB1: { head: [5, 5], body: [6, 13], ba: [5, 14, 4, 16], fa: [11, 14, 11, 17], stick: [11, 17, 9, 19], ...LUNGE_LEGS },
  slashB3: { head: [6, 4], body: [6, 12], ba: [5, 13, 4, 14], fa: [11, 13, 13, 10], stick: [13, 10, 14, 7], ...STRIDE_LEGS },
  slashUp1: { head: [5, 4], hv: 'up', body: [6, 12], ba: [5, 13, 4, 15], fa: [11, 13, 12, 12], stick: [12, 12, 14, 11], ...STAND_LEGS },
  slashUp2: { head: [5, 4], hv: 'up', body: [6, 12], ba: [5, 13, 4, 15], fa: [11, 13, 12, 11, 12, 7], stick: [12, 7, 12, 3], ...STAND_LEGS },
  slashDown1: { head: [5, 3], body: [6, 11], ba: [5, 12, 4, 10], fa: [11, 12, 12, 13], stick: [12, 13, 13, 15], ...TUCK_LEGS },
  slashDown2: { head: [5, 3], body: [6, 11], ba: [5, 12, 4, 10], fa: [11, 12, 11, 16], stick: [11, 16, 11, 19], ...TUCK_LEGS },

  hurt: { head: [4, 5], hv: 'hurt', body: [5, 12], ba: [4, 13, 2, 11], fa: [10, 13, 12, 11], bl: [6, 16, 4, 19, 5, 19], fl: [9, 16, 11, 18, 12, 18] },
  raise: { head: [5, 4], hv: 'up', body: [6, 12], ba: [5, 13, 4, 10], fa: [11, 13, 12, 9], ...STAND_LEGS },
  swim1: { head: [6, 6], body: [6, 13], ba: [5, 14, 3, 13], fa: [11, 14, 13, 13], bl: [7, 17, 5, 18, 4, 18], fl: [10, 17, 9, 19, 8, 19] },
  swim2: { head: [6, 6], body: [6, 13], ba: [5, 14, 4, 16], fa: [11, 14, 12, 16], bl: [7, 17, 5, 19, 4, 19], fl: [10, 17, 8, 18, 7, 18] },
};

/** Back-of-the-neck point per frame (frame pixels), where the procedural scarf is tied. */
export const PLAYER_NECK: Record<string, [number, number]> = {};
for (const [name, p] of Object.entries(POSES)) PLAYER_NECK[name] = [p.head[0] + 1, p.head[1] + 8];

let current = '';

/** (Re)build the 'player' sheet with the given avatar topper. Cheap: ~25 frames of 16x20. */
export function setAvatar(avatar: string) {
  if (avatar === current) return;
  current = avatar;
  const frames: Record<string, string[]> = {};
  for (const [name, p] of Object.entries(POSES)) frames[name] = pose(p, avatar);
  definePlayer(frames);
}

const definePlayer = (frames: Record<string, string[]>) =>
  defineSheet('player', {
    w: 16,
    h: 20,
    ox: 8,
    oy: 20,
    frames,
    anims: {
      idle: { frames: ['idle1', 'idle1', 'idle2', 'idle2', 'idle1', 'idle1', 'idle2', 'blink'], fps: 4 },
      run: { frames: ['run1', 'run2', 'run3', 'run4'], fps: 12 },
      jump: { frames: ['jump'], fps: 1 },
      apex: { frames: ['apex'], fps: 1 },
      fall: { frames: ['fall'], fps: 1 },
      wall: { frames: ['wall'], fps: 1 },
      dash: { frames: ['dash'], fps: 1 },
      slashA: { frames: ['slashA1', 'slashA2', 'slashA3', 'slashA3'], fps: 16, loop: false },
      slashB: { frames: ['slashB1', 'slashA2', 'slashB3', 'slashB3'], fps: 16, loop: false },
      slashUp: { frames: ['slashUp1', 'slashUp2', 'slashUp2', 'slashUp2'], fps: 16, loop: false },
      slashDown: { frames: ['slashDown1', 'slashDown2', 'slashDown2', 'slashDown2'], fps: 16, loop: false },
      hurt: { frames: ['hurt'], fps: 1 },
      raise: { frames: ['raise'], fps: 1 },
      swim: { frames: ['swim1', 'swim2'], fps: 4 },
    },
  });

setAvatar('sprout');
