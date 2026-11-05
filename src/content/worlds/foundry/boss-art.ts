import { PixelBuffer } from '../../../engine/pixels';
import { defineSheet } from '../../../engine/sprites';

/**
 * IRON WARDEN — the Barons' enforcer: a hulking walking furnace with a cannon arm.
 * Drawn like a paper doll: limbs are thick strokes between joints, the barrel torso and
 * helmet are shapes, and every pose is one line of numbers. Faces RIGHT. 64x52 frames,
 * pivot at the feet.
 */
type P = [number, number];

interface Pose {
  /** Torso offset: lean (x) and crouch (y). */
  body?: P;
  /** Ankle positions. */
  back: P;
  front: P;
  /** Back fist position. */
  hand: P;
  cannon: 'down' | 'aim' | 'recoil' | 'up' | 'ground';
  /** Head drop (stun / bash) and eye brightness 0-3. */
  head?: number;
  eye: number;
  /** Chest furnace: 1 banked, 2 burning, 3 blazing. */
  core: number;
  muzzle?: boolean;
}

const W = 64;
const H = 52;
const GROUND = 51;

function stroke(b: PixelBuffer, a: P, c: P, width: number, col: number) {
  const o = (width - 1) / 2;
  for (let i = 0; i < width; i++)
    for (let j = 0; j < width; j++) {
      const dx = i - o;
      const dy = j - o;
      if (dx * dx + dy * dy > o * o + 0.6) continue;
      b.line(a[0] + dx, a[1] + dy, c[0] + dx, c[1] + dy, col);
    }
}

function joint(b: PixelBuffer, p: P, r: number, col: number, hub = 1) {
  b.ellipse(p[0], p[1], r, r, col);
  b.set(p[0], p[1], hub);
}

/** Hip → knee → ankle, with the knee pushed forward; big flat iron feet. */
function leg(b: PixelBuffer, hip: P, ankle: P, near: boolean) {
  const len = Math.hypot(ankle[0] - hip[0], ankle[1] - hip[1]);
  const bend = Math.max(0, 14 - len) * 0.7 + 1.5;
  const knee: P = [Math.round((hip[0] + ankle[0]) / 2 + bend), Math.round((hip[1] + ankle[1]) / 2)];
  const shade = near ? 2 : 1;
  stroke(b, hip, knee, 7, 1);
  stroke(b, knee, ankle, 6, shade);
  // piston rod highlight down the shin
  b.line(knee[0] + 2, knee[1] + 2, ankle[0] + 2, ankle[1] - 1, near ? 1 : 0);
  joint(b, knee, 3, 2, 0);
  b.set(knee[0] - 1, knee[1] - 1, near ? 2 : 1);
  // foot
  const fy = Math.min(GROUND - 3, ankle[1]);
  b.rect(ankle[0] - 4, fy, 10, 3, near ? 2 : 1);
  b.rect(ankle[0] - 4, fy + 3, 10, 1, 1);
  b.rect(ankle[0] - 3, fy, 8, 1, near ? 2 : 1);
}

function drawWarden(p: Pose): string[] {
  const b = new PixelBuffer(W, H);
  const [bx, by] = p.body ?? [0, 0];
  const cx = 31 + bx;
  const cy = 27 + by;
  const hipB: P = [cx - 5, cy + 9];
  const hipF: P = [cx + 4, cy + 9];
  const shB: P = [cx - 9, cy - 7];
  const shF: P = [cx + 9, cy - 6];

  // back fist + arm
  stroke(b, shB, [Math.round((shB[0] + p.hand[0]) / 2) - 2, Math.round((shB[1] + p.hand[1]) / 2)], 5, 1);
  stroke(b, [Math.round((shB[0] + p.hand[0]) / 2) - 2, Math.round((shB[1] + p.hand[1]) / 2)], p.hand, 4, 1);
  b.rect(p.hand[0] - 3, p.hand[1] - 3, 7, 6, 2);
  b.rect(p.hand[0] - 2, p.hand[1] - 2, 5, 4, 1);
  b.rect(p.hand[0] - 3, p.hand[1] - 1, 7, 1, 0);

  // back leg
  leg(b, hipB, p.back, false);

  // smokestacks on the back
  for (const sx of [cx - 11, cx - 6]) {
    b.rect(sx, cy - 20, 3, 10, 1);
    b.rect(sx - 1, cy - 21, 5, 2, 2);
  }

  // torso: an iron barrel furnace
  b.ellipse(cx, cy, 12, 11, 2);
  for (let y = cy - 11; y <= cy + 11; y++)
    for (let x = cx - 12; x <= cx + 12; x++) {
      if (b.get(x, y) !== 2) continue;
      const nx = (x - cx) / 12;
      const ny = (y - cy) / 11;
      if (nx < -0.55 || ny > 0.62 || (nx < -0.25 && (x + y) % 2 === 0)) b.set(x, y, 1);
    }
  // plate seams and rivets
  for (let x = cx - 11; x <= cx + 11; x++) {
    if (b.get(x, cy - 4) !== 255) b.set(x, cy - 4, 0);
    if (b.get(x, cy + 6) !== 255) b.set(x, cy + 6, 0);
  }
  for (let x = cx - 9; x <= cx + 9; x += 4) {
    if (b.get(x, cy - 3) !== 255) b.set(x, cy - 3, 2);
    if (b.get(x, cy + 7) !== 255) b.set(x, cy + 7, 3 - (x < cx ? 2 : 1));
  }
  // chest furnace grill (the core)
  const gx = cx + 1;
  const gy = cy - 2;
  b.rect(gx, gy, 10, 8, 0);
  for (let x = gx + 1; x < gx + 9; x++)
    for (let y = gy + 1; y < gy + 7; y++) {
      const slot = x % 2 === 0;
      let c: number;
      if (p.core === 1) c = slot ? 0 : 1;
      else if (p.core === 2) c = slot ? (y > gy + 3 ? 2 : 1) : y > gy + 4 ? 3 : 2;
      else c = slot ? 2 : 3;
      b.set(x, y, c);
    }
  b.rect(gx - 1, gy - 1, 12, 1, 2);
  b.rect(gx - 1, gy + 8, 12, 1, 1);

  // front leg
  leg(b, hipF, p.front, true);

  // pauldrons
  b.ellipse(shB[0], shB[1], 5, 4, 1);
  b.ellipse(shB[0], shB[1] - 1, 4, 2, 2);
  // head: a riveted helmet sunk between the shoulders
  const hx = cx + 3;
  const hy = cy - 19 + (p.head ?? 0);
  b.rect(hx, hy + 2, 11, 9, 2);
  b.rect(hx + 1, hy + 1, 9, 1, 2);
  b.rect(hx + 3, hy, 5, 1, 2);
  b.rect(hx, hy + 2, 2, 9, 1);
  b.rect(hx + 2, hy + 9, 9, 2, 1);
  b.rect(hx + 4, hy + 5, 8, 2, 0); // visor slit
  if (p.eye > 0) {
    b.set(hx + 8, hy + 5, p.eye);
    b.set(hx + 9, hy + 5, p.eye);
    b.set(hx + 10, hy + 5, p.eye >= 3 ? 3 : 0);
    if (p.eye >= 3) b.set(hx + 9, hy + 6, 2);
  }
  b.set(hx + 2, hy + 3, 0);
  b.set(hx + 2, hy + 8, 0);
  b.rect(hx + 4, hy - 2, 2, 2, 1); // crest
  b.ellipse(shF[0], shF[1], 5, 4, 2);
  b.rect(shF[0] - 4, shF[1] + 2, 9, 1, 1);
  b.set(shF[0] + 2, shF[1] - 2, 1);

  // cannon arm
  const elbow: P = [shF[0] + 3, shF[1] + 6];
  let muzzle: P;
  let dir: P;
  switch (p.cannon) {
    case 'aim':
      muzzle = [shF[0] + 20, shF[1] + 1];
      dir = [1, 0];
      break;
    case 'recoil':
      muzzle = [shF[0] + 16, shF[1] - 3];
      dir = [1, -0.25];
      break;
    case 'up':
      muzzle = [shF[0] + 6, shF[1] - 16];
      dir = [0.3, -1];
      break;
    case 'ground':
      muzzle = [shF[0] + 11, GROUND - 3];
      dir = [0.35, 1];
      break;
    default:
      muzzle = [shF[0] + 9, shF[1] + 17];
      dir = [0.3, 1];
  }
  stroke(b, shF, elbow, 5, 1);
  const len = Math.hypot(dir[0], dir[1]);
  const ux = dir[0] / len;
  const uy = dir[1] / len;
  const base: P = [Math.round(muzzle[0] - ux * 12), Math.round(muzzle[1] - uy * 12)];
  stroke(b, elbow, base, 5, 2);
  stroke(b, base, muzzle, 7, 2);
  stroke(b, [Math.round(base[0] + uy * 2), Math.round(base[1] - ux * 2)], [Math.round(muzzle[0] + uy * 2), Math.round(muzzle[1] - ux * 2)], 2, 1);
  // bands around the barrel
  for (const k of [3, 8]) {
    const px = Math.round(base[0] + ux * k);
    const py = Math.round(base[1] + uy * k);
    b.line(px - Math.round(uy * 3), py + Math.round(ux * 3), px + Math.round(uy * 3), py - Math.round(ux * 3), 1);
  }
  // muzzle ring
  joint(b, muzzle, 3, 1, 0);
  b.ellipse(muzzle[0], muzzle[1], 1.5, 1.5, p.muzzle ? 3 : 0);

  b.outline(0);
  return b.toRows();
}

/** The defeated Warden: a toppled furnace husk with its helmet rolled away. */
function wreck(): string[] {
  const b = new PixelBuffer(W, H);
  // torso lying on its back
  b.ellipse(28, 41, 13, 9, 1);
  b.ellipse(28, 39, 11, 6, 2);
  for (let x = 16; x < 41; x++) if (b.get(x, 41) !== 255) b.set(x, 41, 0);
  b.rect(24, 34, 9, 5, 0);
  for (let x = 25; x < 32; x += 2) b.rect(x, 35, 1, 3, 1);
  // legs sticking out
  stroke(b, [17, 44], [8, 47], 4, 1);
  b.rect(3, 45, 8, 5, 1);
  stroke(b, [38, 44], [45, 48], 4, 1);
  // broken cannon
  stroke(b, [40, 38], [52, 44], 6, 2);
  b.ellipse(53, 45, 3, 3, 1);
  b.set(53, 45, 0);
  // helmet rolled off
  b.rect(54, 41, 9, 8, 2);
  b.rect(55, 44, 7, 2, 0);
  b.rect(54, 47, 9, 2, 1);
  // stacks snapped
  b.rect(19, 30, 3, 5, 1);
  b.rect(23, 31, 3, 4, 1);
  b.outline(0);
  return b.toRows();
}

const POSES: Record<string, Pose> = {
  idle1: { back: [24, 48], front: [38, 48], hand: [19, 37], cannon: 'down', eye: 3, core: 2 },
  idle2: { body: [0, 1], back: [24, 48], front: [38, 48], hand: [19, 38], cannon: 'down', eye: 3, core: 2 },
  walk1: { back: [21, 48], front: [40, 48], hand: [20, 36], cannon: 'down', eye: 3, core: 2 },
  walk2: { body: [0, -1], back: [25, 48], front: [37, 45], hand: [18, 36], cannon: 'down', eye: 3, core: 2 },
  walk3: { back: [27, 48], front: [35, 48], hand: [17, 37], cannon: 'down', eye: 3, core: 2 },
  walk4: { body: [0, -1], back: [24, 45], front: [38, 48], hand: [19, 36], cannon: 'down', eye: 3, core: 2 },
  crouch: { body: [-1, 5], back: [21, 48], front: [40, 48], hand: [17, 42], cannon: 'down', eye: 3, core: 3 },
  leap: { body: [0, -3], back: [26, 43], front: [36, 42], hand: [21, 8], cannon: 'up', eye: 3, core: 3 },
  slam: { body: [1, 7], back: [19, 48], front: [42, 48], hand: [46, 47], cannon: 'ground', eye: 3, core: 3 },
  bash1: { body: [4, 3], back: [19, 48], front: [41, 48], hand: [14, 31], cannon: 'down', head: 3, eye: 3, core: 3 },
  bash2: { body: [4, 2], back: [24, 46], front: [37, 48], hand: [15, 30], cannon: 'down', head: 3, eye: 3, core: 3 },
  aim: { body: [-1, 1], back: [22, 48], front: [39, 48], hand: [18, 37], cannon: 'aim', eye: 3, core: 2 },
  aimHot: { body: [-1, 1], back: [22, 48], front: [39, 48], hand: [18, 37], cannon: 'aim', eye: 3, core: 3, muzzle: true },
  fire: { body: [-3, 1], back: [21, 48], front: [38, 48], hand: [17, 37], cannon: 'recoil', eye: 3, core: 3, muzzle: true },
  stun1: { body: [-2, 7], back: [21, 48], front: [40, 48], hand: [18, 47], cannon: 'ground', head: 5, eye: 1, core: 1 },
  stun2: { body: [-2, 8], back: [21, 48], front: [40, 48], hand: [18, 47], cannon: 'ground', head: 6, eye: 0, core: 1 },
  roar: { body: [-1, -1], back: [22, 48], front: [40, 48], hand: [16, 10], cannon: 'up', head: -2, eye: 3, core: 3 },
  dormant: { body: [-1, 8], back: [21, 48], front: [40, 48], hand: [18, 47], cannon: 'ground', head: 6, eye: 1, core: 1 },
};

const frames: Record<string, string[]> = { wreck: wreck() };
for (const [name, pose] of Object.entries(POSES)) frames[name] = drawWarden(pose);

defineSheet('foundry-warden', {
  w: W,
  h: H,
  ox: 32,
  oy: H,
  frames,
  anims: {
    idle: { frames: ['idle1', 'idle2'], fps: 3 },
    walk: { frames: ['walk1', 'walk2', 'walk3', 'walk4'], fps: 7 },
    crouch: { frames: ['crouch'], fps: 1 },
    leap: { frames: ['leap'], fps: 1 },
    slam: { frames: ['slam'], fps: 1 },
    bash: { frames: ['bash1', 'bash2'], fps: 10 },
    aim: { frames: ['aim', 'aimHot'], fps: 8 },
    fire: { frames: ['fire'], fps: 1 },
    stun: { frames: ['stun1', 'stun2'], fps: 4 },
    roar: { frames: ['roar'], fps: 1 },
    dormant: { frames: ['dormant'], fps: 1 },
    wreck: { frames: ['wreck'], fps: 1 },
  },
});

// ---- the Warden's projectiles and shockwaves ---------------------------------------------------
defineSheet('foundry-ball', {
  w: 10,
  h: 10,
  ox: 5,
  oy: 5,
  frames: {
    a: ['...2222...', '..233332..', '.23333332.', '2333333332', '2333113332', '2333113332', '2333333332', '.23333332.', '..233332..', '...2222...'],
    b: ['...2222...', '..223332..', '.23333322.', '2333333332', '2331133332', '2331133332', '2333333332', '.22333332.', '..233322..', '...2222...'],
  },
  anims: { fly: { frames: ['a', 'b'], fps: 10 } },
});

function wave(seed: number): string[] {
  const b = new PixelBuffer(16, 14);
  for (let x = 0; x < 16; x++) {
    const h = Math.round(12 - Math.abs(x - 7.5) * 1.2 + Math.sin(x * 1.7 + seed * 2) * 1.5);
    for (let y = 0; y < h; y++) {
      const py = 13 - y;
      const top = y >= h - 2;
      const c = top ? 3 : y < 2 ? 1 : (x + y + seed) % 3 === 0 ? 3 : 2;
      b.set(x, py, c);
    }
  }
  for (let i = 0; i < 4; i++) b.set((seed * 5 + i * 4) % 16, (seed + i) % 3, 3);
  return b.toRows();
}
defineSheet('foundry-wave', {
  w: 16,
  h: 14,
  ox: 8,
  oy: 14,
  frames: { a: wave(0), b: wave(1), c: wave(2) },
  anims: { roll: { frames: ['a', 'b', 'c'], fps: 14 } },
});

// a falling cinder from the ceiling (phase 2 rain), and the warning glint where it starts
defineSheet('foundry-cinder-drop', {
  w: 8,
  h: 12,
  ox: 4,
  oy: 11,
  frames: {
    a: ['...1....', '...2....', '..121...', '..232...', '..232...', '.23332..', '.23332..', '2333332.', '2333332.', '.23332..', '..222...', '........'],
    b: ['...2....', '..121...', '..232...', '..232...', '.22332..', '.23332..', '2333332.', '2333332.', '.23332..', '.23332..', '..222...', '........'],
  },
  anims: { fall: { frames: ['a', 'b'], fps: 12 } },
});
