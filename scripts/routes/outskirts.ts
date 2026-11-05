/**
 * Route regression test for Mossgate Outskirts (the first world).
 *
 *   npx tsx scripts/routes/outskirts.ts            all sections
 *   npx tsx scripts/routes/outskirts.ts basin       only checks whose section/name contains "basin"
 *
 * Ability rules: a new game starts at P with NEITHER Spirit Dash NOR Ember Wings. Everything before
 * the Spirit Dash shrine 'D' (208,23) must work with run / jump / wall-jump / pogo only; after it the
 * dash is available. Double jump never exists in this world.
 *
 * Coordinates are tiles: [col, floorRow] = standing on top of row floorRow.
 * Every check runs the real engine (scripts/sim.ts). Bots drive FakeInput tick by tick; sweeps try
 * many input timings and count the winners, so a hop that only works with a handful of plans is
 * reported as TIGHT (still OK, but a first-time player will struggle there).
 */
import { canReach, loadWorldDef, makeWorld, runPlan, type Act, type Plan, type SimOpts } from '../sim';
import { T } from '../../src/engine/tilemap';

const def = await loadWorldDef('outskirts');
const DT = 1 / 60;
const NO = { dash: false, doubleJump: false };
const DASH = { dash: true, doubleJump: false };
type Abil = typeof NO;
const filter = process.argv[2]?.toLowerCase() ?? '';

// ---- results ------------------------------------------------------------------------------------
type Kind = 'main' | 'optional' | 'pit';
interface Res {
  kind: Kind;
  section: string;
  name: string;
  ok: boolean;
  tight: boolean;
  info: string;
}
const results: Res[] = [];
let section = '';
function report(kind: Kind, name: string, ok: boolean, info: string, tight = false) {
  results.push({ kind, section, name, ok, tight, info });
  const tag = !ok ? 'FAIL ' : tight ? 'TIGHT' : 'OK   ';
  console.log(`  ${tag} [${kind}] ${name}: ${info}`);
}
const want = (name: string) => !filter || `${section} ${name}`.toLowerCase().includes(filter);

/** A sweep counts winning plans; fewer than `minWins` (or < `tightFrac` of all) is TIGHT. */
function sweep<P>(kind: Kind, name: string, combos: P[], attempt: (p: P) => boolean, o: { minWins?: number; tightFrac?: number } = {}) {
  if (!want(name)) return 0;
  let wins = 0;
  for (const c of combos) if (attempt(c)) wins++;
  const tight = wins > 0 && (wins < (o.minWins ?? 4) || wins / combos.length < (o.tightFrac ?? 0.08));
  report(kind, name, wins > 0, `${wins}/${combos.length} plans work`, tight);
  return wins;
}

/** canReach wrapper: no double jump ever; dash only when the ability set has it. */
function hop(kind: Kind, name: string, from: [number, number], to: [number, number, number], ab: Abil, extra: Parameters<typeof canReach>[4] = {}) {
  if (!want(name)) return;
  const r = canReach(def, name, from, to, { abilities: ab, useDJ: false, useDash: ab.dash, quiet: true, ...extra });
  const tight = r.ok && (r.plans < 3 || r.plans / r.tried < 0.03);
  report(kind, name, r.ok, `${r.plans}/${r.tried} plans land${r.easiest ? ` (easiest: ${r.easiest})` : ''}`, tight);
}

const cartesian = <T extends Record<string, readonly unknown[]>>(o: T): { [K in keyof T]: T[K][number] }[] =>
  Object.entries(o).reduce<Record<string, unknown>[]>((acc, [k, vs]) => acc.flatMap((a) => vs.map((v) => ({ ...a, [k]: v }))), [{}]) as {
    [K in keyof T]: T[K][number];
  }[];

// ---- the bot --------------------------------------------------------------------------------------
type Out = { held?: Act[]; press?: Act[] } | 'done' | 'fail';
type Ctl = (b: Bot) => Out;

class Bot {
  readonly world: ReturnType<typeof makeWorld>['world'];
  readonly input: ReturnType<typeof makeWorld>['input'];
  readonly profile: ReturnType<typeof makeWorld>['profile'];
  /** Took a hit or a hazard since creation (or since `clearHurt`). */
  hurt = false;
  hits = 0;
  t = 0;
  log: string[] = [];

  constructor(o: SimOpts & { at?: [number, number] } = {}) {
    const m = makeWorld(def, o);
    this.world = m.world;
    this.input = m.input;
    this.profile = m.profile;
    if (o.at) this.place(o.at);
    this.tick();
  }

  get p() {
    return this.world.player;
  }
  place([c, f]: [number, number]) {
    this.p.place(c * 8 + 4, f * 8);
  }
  /** Player centre column (tile units, e.g. 51.5 = middle of column 51). */
  get col() {
    return this.p.cx / 8;
  }
  get floor() {
    return this.p.bottom / 8;
  }
  get ground() {
    return this.p.onGround();
  }
  get inWater() {
    return this.world.tileAt(this.p.cx, this.p.cy) === T.Water;
  }
  /** Standing on the given floor row with the centre inside columns [c0, c1]. */
  standing(c0: number, c1: number, floor: number) {
    return this.ground && this.p.state === 'normal' && Math.abs(this.floor - floor) < 0.01 && this.col >= c0 && this.col < c1 + 1;
  }
  wall(dir: number, px = 1) {
    return this.p.collideAt(this.p.x + dir * px, this.p.y);
  }

  tick(held: Act[] = [], press: Act[] = []) {
    const hp = this.profile.hp;
    this.input.held = new Set(held);
    this.input.now = new Set(press);
    this.world.update(DT);
    this.t += DT;
    if (this.profile.hp < hp || this.p.state === 'respawn') {
      if (!this.hurt) this.log.push(`hurt at ${this.col.toFixed(1)},${this.floor.toFixed(2)} t=${this.t.toFixed(2)}`);
      this.hurt = true;
      this.hits++;
    }
  }

  /** Run a controller until it says done/fail, the player gets hurt (unless allowed), or time runs out. */
  run(ctl: Ctl, maxSec: number, o: { allowHurt?: boolean } = {}): boolean {
    const end = this.t + maxSec;
    while (this.t < end) {
      const out = ctl(this);
      if (out === 'done') return true;
      if (out === 'fail') return false;
      this.tick(out.held, out.press);
      if (this.hurt && !o.allowHurt) return false;
    }
    return false;
  }

  /** Let the world run with no input. */
  idle(sec: number) {
    for (let i = 0; i < Math.round(sec * 60); i++) this.tick();
  }

  /** Walk (no jumping) to the centre of column `col`; fails if blocked for 0.3 s. */
  walkTo(col: number, maxSec = 8): boolean {
    let stuck = 0;
    let lastX = this.p.x;
    return this.run((b) => {
      const d = col + 0.5 - b.col;
      if (Math.abs(d) < 0.3 && b.ground && Math.abs(b.p.vx) < 1) return 'done';
      if (b.p.x === lastX && b.p.state === 'normal') stuck++;
      else stuck = 0;
      lastX = b.p.x;
      if (stuck > 18) return 'fail';
      if (Math.abs(d) < 0.3) return {};
      // brake early: ground deceleration needs ~4 px from full speed
      if (Math.abs(d * 8) < 4 && b.ground && Math.abs(b.p.vx) > 40) return {};
      return { held: [d > 0 ? 'right' : 'left'] };
    }, maxSec);
  }

  /** Hold a direction until standing on `floor` inside [c0, c1] (handles drops; no jumps). */
  walkUntil(dir: 1 | -1, c0: number, c1: number, floor: number, maxSec = 8): boolean {
    return this.run((b) => (b.standing(c0, c1, floor) ? 'done' : { held: [dir > 0 ? 'right' : 'left'] }), maxSec);
  }

  /** Wait until standing still on the ground (state normal). */
  settle(maxSec = 3): boolean {
    return this.run((b) => (b.ground && b.p.state === 'normal' && Math.abs(b.p.vx) < 1 ? 'done' : {}), maxSec);
  }

  /**
   * A simple jump: hold `dir` (0 = none) for `dirTime` s (default: until landing), press jump and
   * hold it `hold` s. Returns once the player lands again.
   */
  jump(dir: -1 | 0 | 1, hold: number, dirTime = 99, maxSec = 3): boolean {
    let k = 0;
    let left = false;
    const d: Act[] = dir > 0 ? ['right'] : dir < 0 ? ['left'] : [];
    return this.run((b) => {
      k++;
      if (!b.ground) left = true;
      if (left && b.ground) return 'done';
      const dd = k * DT < dirTime ? d : [];
      if (k === 1) return { held: [...dd], press: ['jump'] };
      return { held: [...dd, ...(k * DT < hold ? (['jump'] as Act[]) : [])] };
    }, maxSec);
  }

  /** Strike `n` times in a direction ('fwd' facing dir, 'up', 'down'), waiting out the cooldown. */
  strike(n: number, dir: -1 | 1, kind: 'fwd' | 'up' = 'fwd'): void {
    // face the right way first
    this.tick([dir > 0 ? 'right' : 'left']);
    for (let i = 0; i < n; i++) {
      this.tick(kind === 'up' ? ['up'] : [], ['attack']);
      this.idle(0.32);
    }
  }

  /** Execute one canReach-style plan in this world (same input logic as sim.runPlan). */
  plan(pl: Plan, maxSec = 2.2): boolean {
    let t = 0;
    let jumped = false;
    let dashDone = false;
    let airborne = false;
    let landedAt = -1;
    const p = this.p;
    for (let i = 0; i < maxSec * 60; i++) {
      if (!p.onGround() && p.state !== 'respawn') airborne = true;
      if (airborne && landedAt < 0 && p.onGround() && jumped) landedAt = t;
      if (landedAt >= 0) {
        if (t - landedAt > 0.4) break;
        this.tick();
        t += DT;
        if (this.hurt) return false;
        continue;
      }
      const held = new Set<Act>();
      const press = new Set<Act>();
      if (pl.dir !== 0) held.add(pl.dir > 0 ? 'right' : 'left');
      if (t >= pl.run && !jumped) {
        press.add('jump');
        jumped = true;
      }
      if (jumped && t < pl.run + pl.hold) held.add('jump');
      if (pl.dash !== null && !dashDone && t >= pl.run + pl.dash) {
        press.add('dash');
        dashDone = true;
        held.delete('left');
        held.delete('right');
        const [dx, dy] = pl.dashDir;
        if (dx > 0) held.add('right');
        if (dx < 0) held.add('left');
        if (dy < 0) held.add('up');
        if (dy > 0) held.add('down');
      }
      this.tick([...held], [...press]);
      t += DT;
      if (this.hurt) return false;
    }
    return true;
  }

  /** Snap to the exact centre of [col, floor] — only allowed when already standing right there. */
  snap(at: [number, number]): boolean {
    if (!this.settle() || this.floor !== at[1] || Math.abs(this.col - (at[0] + 0.5)) > 0.5) return false;
    this.place(at);
    this.tick();
    return true;
  }

  soulsLeftAt(cells: [number, number][]) {
    const left = new Set(
      this.world.entities.filter((e) => e.constructor.name === 'SoulOrb').map((e) => `${Math.floor((e.x + 3) / 8)},${Math.floor((e.y + 3) / 8)}`),
    );
    return cells.filter(([c, r]) => !this.world.hasFlag(`soul:outskirts:${c},${r}`) && left.has(`${c},${r}`));
  }
  soulsTaken(cells: [number, number][]) {
    return cells.filter(([c, r]) => this.world.hasFlag(`soul:outskirts:${c},${r}`));
  }
}

const tileAt = (b: Bot, c: number, r: number) => b.world.map.get(c, r);

// ===================================================================================================
// Landmarks (tile coordinates, from map.ts)
// ===================================================================================================
const P = [3, 33] as [number, number];
const CP = { c1: 'outskirts:57,16', c2: 'outskirts:104,16', c3: 'outskirts:199,24', c4: 'outskirts:244,25' };
const SOULS = {
  puddle: [
    [20, 29],
    [21, 28],
    [22, 29],
  ] as [number, number][],
  plank1: [[31, 25]] as [number, number][],
  plank2: [
    [36, 22],
    [37, 22],
  ] as [number, number][],
  chimney: [
    [51, 17],
    [52, 20],
    [51, 23],
  ] as [number, number][],
  cellar: [
    [87, 18],
    [91, 18],
    [86, 19],
    [92, 19],
  ] as [number, number][],
  thornbed: [
    [115, 19],
    [118, 18],
    [121, 19],
  ] as [number, number][],
  basin: [
    [153, 31],
    [155, 33],
    [159, 33],
  ] as [number, number][],
  yard: [
    [231, 23],
    [239, 22],
  ] as [number, number][],
  plank3: [
    [235, 18],
    [236, 18],
  ] as [number, number][],
  gap: [
    [252, 24],
    [255, 24],
  ] as [number, number][],
};


const dirAct = (d: number): Act[] => (d > 0 ? ['right'] : d < 0 ? ['left'] : []);

/** Free pixels between the player and the nearest solid in direction `dir` (capped at `max`). */
function gapTo(b: Bot, dir: number, max = 16) {
  for (let i = 1; i <= max; i++) if (b.p.collideAt(b.p.x + dir * i, b.p.y)) return i - 1;
  return max;
}

/**
 * Swim bot: hold `dir`; hold ↓ while `sinkUntil(b)` is true; once `strokeWhen(b)` is true, press jump
 * every `cadence` frames (a stroke underwater, a real jump once the head is out).
 */
function swim(b: Bot, o: { dir: 1 | -1; sinkUntil: (b: Bot) => boolean; strokeWhen: (b: Bot) => boolean; cadence: number; done: (b: Bot) => boolean; maxSec?: number }) {
  let k = 0;
  return b.run((b) => {
    k++;
    if (o.done(b)) return 'done';
    const held: Act[] = [...dirAct(o.dir)];
    if (o.sinkUntil(b)) held.push('down');
    const press: Act[] = o.strokeWhen(b) && k % o.cadence === 0 ? ['jump'] : [];
    if (press.length) held.push('jump');
    return { held, press };
  }, o.maxSec ?? 8);
}

// ===================================================================================================
// 1. WAKEFIELD — run, a 1-tile step, the mossy puddle, a 3-tile step (hold jump), wooden planks
// ===================================================================================================
section = 'wakefield';
console.log('\n== 1. WAKEFIELD (no abilities) ==');
if (want('walk from P')) {
  const b = new Bot({ abilities: NO, at: P });
  report('main', 'walk from P (3,33) to the first step (12,33)', b.walkTo(12) && b.floor === 33, `at ${b.col.toFixed(1)},${b.floor}`);
}
hop('main', 'tap-jump onto the step (14-19, floor 32)', [12, 33], [14, 19, 32], NO);
hop('main', 'jump the mossy puddle (20-22) to (23-27, 32)', [18, 32], [23, 27, 32], NO);
hop('main', '3-tile step up to the plateau (28+, 29)', [26, 32], [28, 47, 29], NO);
sweep(
  'optional',
  'souls over the puddle (20,29)(21,28)(22,29)',
  cartesian({ start: [16, 17, 18], hold: [0.1, 0.2, 0.35] }),
  ({ start, hold }) => {
    const b = new Bot({ abilities: NO, at: [start, 32] });
    if (!b.walkTo(19)) return false;
    b.jump(1, hold);
    b.walkTo(25);
    return b.soulsTaken(SOULS.puddle).length === 3 && b.standing(23, 27, 32);
  },
);
sweep(
  'optional',
  'plank souls (31,25) then (36,22)(37,22), and back down',
  cartesian({ x0: [30, 31, 32, 33], hold1: [0.2, 0.3, 0.4], hold2: [0.2, 0.3, 0.4], dirTime: [0.15, 0.25, 0.35] }),
  ({ x0, hold1, hold2, dirTime }) => {
    const b = new Bot({ abilities: NO, at: [x0, 29] });
    b.jump(0, hold1);
    if (!b.standing(30, 33, 26)) return false;
    b.walkTo(33);
    b.jump(1, hold2, dirTime);
    if (!b.standing(35, 38, 23)) return false;
    if (b.soulsTaken([...SOULS.plank1, ...SOULS.plank2]).length !== 3) return false;
    return b.walkUntil(1, 40, 47, 29);
  },
);
sweep(
  'pit',
  'climb out of the puddle (20-22, floor 34) without help',
  cartesian({ dir: [1, -1] as const, cadence: [6, 10, 15, 20, 30] }),
  ({ dir, cadence }) => {
    const b = new Bot({ abilities: NO, at: [21, 34] });
    return swim(b, {
      dir,
      sinkUntil: () => false,
      strokeWhen: () => true,
      cadence,
      done: (b) => b.standing(14, 19, 32) || b.standing(23, 27, 32),
      maxSec: 5,
    });
  },
);

// ===================================================================================================
// 2. THE OLD TOWER — walk under the pillar, wall-jump up the 4-wide chimney, checkpoint 1
// ===================================================================================================
section = 'chimney';
console.log('\n== 2. THE OLD TOWER (no abilities) ==');
if (want('walk under the pillar')) {
  const b = new Bot({ abilities: NO, at: [40, 29] });
  report('main', 'walk under the pillar into the chimney (51,29)', b.walkTo(51) && b.floor === 29, `at ${b.col.toFixed(1)},${b.floor}`);
}

/**
 * Chimney climber: jump, then wall-jump between the pillar (x=400) and the cliff (x=432).
 * pressGap: press jump when this close to the wall we're heading for (the 0.12 s jump buffer makes
 * early presses work); delay: extra frames before pressing; hold: seconds jump is held after each jump.
 */
function climbChimney(b: Bot, o: { pressGap: number; delay: number; hold: number; first: 1 | -1 }) {
  let heading: 1 | -1 = o.first;
  let k = 0;
  let near = -1;
  let holdUntil = 0;
  return b.run((b) => {
    k++;
    if (b.standing(54, 63, 17)) return 'done';
    if (b.ground && k > 30 && b.floor !== 29) return 'fail';
    if (k === 1) {
      holdUntil = k + o.hold * 60;
      return { held: [...dirAct(heading), 'jump'], press: ['jump'] };
    }
    // above the cliff top: just head for it
    if (b.p.bottom < 136 && heading < 0 && gapTo(b, -1) > 8) heading = 1;
    const held: Act[] = [...dirAct(heading)];
    if (k < holdUntil) held.push('jump');
    if (!b.ground && gapTo(b, heading) <= o.pressGap) {
      if (near < 0) near = k;
      if (k - near >= o.delay) {
        near = -1;
        heading = -heading as 1 | -1;
        holdUntil = k + o.hold * 60;
        return { held: [...held, 'jump'], press: ['jump'] };
      }
    }
    return { held };
  }, 8);
}
let chimneySouls = 0;
sweep(
  'main',
  'wall-jump up the chimney (50-53) to the cliff top (54+, 17)',
  cartesian({ first: [1, -1] as const, pressGap: [0, 2, 5, 8, 11], delay: [0, 3, 6], hold: [0.1, 0.2, 0.3] }),
  (o) => {
    const b = new Bot({ abilities: NO, at: [51, 29] });
    const ok = climbChimney(b, o);
    if (ok) chimneySouls = Math.max(chimneySouls, b.soulsTaken(SOULS.chimney).length);
    return ok;
  },
);
if (want('chimney souls')) report('optional', 'chimney souls (51,17)(52,20)(51,23) on the way up', chimneySouls === 3, `${chimneySouls}/3 collected by the best climb`);
if (want('checkpoint 1')) {
  const b = new Bot({ abilities: NO, at: [55, 17] });
  const ok = b.walkTo(58) && b.profile.spawn.kind === 'checkpoint' && b.profile.spawn.id === CP.c1;
  report('main', 'checkpoint 1 at (57,16)', ok, JSON.stringify(b.profile.spawn));
}

// ===================================================================================================
// 3. LAMPLIGHTER'S HALL — strike through the cracked wall, the hollow floor and its cellar
// ===================================================================================================
section = 'hall';
console.log("\n== 3. LAMPLIGHTER'S HALL (no abilities) ==");
if (want('walk to the cracked wall')) {
  const b = new Bot({ abilities: NO, at: [58, 17] });
  report('main', 'walk from checkpoint 1 under the hall wall to the cracked wall (75,17)', b.walkTo(75) && b.floor === 17, `at ${b.col.toFixed(1)},${b.floor}`);
}
const xWallGone = (b: Bot) => [8, 9, 10, 11, 12, 13, 14, 15, 16].every((r) => tileAt(b, 76, r) === T.Empty && tileAt(b, 77, r) === T.Empty);
/** Walk at a wall and strike it whenever within `reach` px, every `pace` s, until `broken`. */
function strikeThrough(b: Bot, dir: 1 | -1, reach: number, pace: number, broken: (b: Bot) => boolean, maxSec = 6) {
  let next = 0;
  return b.run((b) => {
    if (broken(b)) return 'done';
    if (gapTo(b, dir) <= reach && b.t >= next && b.p.state === 'normal') {
      next = b.t + pace;
      return { held: dirAct(dir), press: ['attack'] };
    }
    return { held: gapTo(b, dir) > 0 ? dirAct(dir) : [] };
  }, maxSec);
}
sweep(
  'main',
  'break the cracked wall (76-77, rows 8-16) by striking it and walk through',
  cartesian({ at: [70, 72, 74, 75], reach: [0, 4, 8, 12], pace: [0.3, 0.45, 0.7] }),
  ({ at, reach, pace }) => {
    const b = new Bot({ abilities: NO, at: [at, 17] });
    return strikeThrough(b, 1, reach, pace, xWallGone) && b.walkTo(82);
  },
);
if (want('blocked without breaking')) {
  // the wall really is the gate: walking into it does not get past
  const b = new Bot({ abilities: NO, at: [74, 17] });
  b.run(() => ({ held: ['right'] }), 1.5);
  report('main', 'the cracked wall blocks the hall until broken', b.col < 76, `walking right stops at ${b.col.toFixed(1)}`);
}
if (want('checkpoint 2')) {
  const b = new Bot({ abilities: NO, at: [78, 17] });
  const ok = b.walkTo(105) && b.profile.spawn.kind === 'checkpoint' && b.profile.spawn.id === CP.c2;
  report('main', 'walk through the hall (hollow floor holds) to checkpoint 2 at (104,16)', ok, JSON.stringify(b.profile.spawn));
}
const hollowGone = (b: Bot) => [88, 89, 90].every((c) => tileAt(b, c, 17) === T.Empty);
sweep(
  'optional',
  'hollow floor (88-90,17): strike it open (fwd or ↓ from a hop), drop into the cellar, take 4 souls',
  cartesian({ at: [85, 86, 87, 88, 89, 90], how: ['fwd', 'pogo'] as const, hold: [0.1, 0.2] }),
  ({ at, how, hold }) => {
    const b = new Bot({ abilities: NO, at: [at, 17] });
    if (how === 'fwd') b.strike(3, 1);
    else
      for (let i = 0; i < 3 && !hollowGone(b); i++) {
        // hop and strike down at the floor
        let k = 0;
        b.run((b) => {
          k++;
          if (k > 3 && b.ground) return 'done';
          if (k === 1) return { held: ['jump'], press: ['jump'] };
          if (k * DT > hold + 0.05 && b.p.vy > 0 && k < 200) {
            k = 200;
            return { held: ['down'], press: ['attack'] };
          }
          return { held: k * DT < hold ? ['jump'] : [] };
        }, 2);
        b.idle(0.1);
      }
    if (!hollowGone(b)) return false;
    b.walkUntil(1, 86, 92, 20, 2) || b.walkUntil(-1, 86, 92, 20, 2);
    b.settle();
    return b.standing(86, 92, 20) && b.soulsTaken(SOULS.cellar).length === 4;
  },
);
sweep(
  'pit',
  'climb out of the cellar (86-92, floor 20) through the 3-wide hole',
  cartesian({ at: [88, 89, 90], hold: [0.15, 0.2, 0.3, 0.4], dir: [1, -1] as const, steer: [0, 0.1, 0.2, 0.3] }),
  ({ at, hold, dir, steer }) => {
    const b = new Bot({ abilities: NO, at: [86, 17] });
    b.strike(3, 1);
    b.place([at, 20]);
    b.settle();
    let k = 0;
    return b.run((b) => {
      k++;
      if (b.ground && b.floor === 17) return 'done';
      if (k > 10 && b.ground && b.floor === 20) return 'fail';
      const held: Act[] = k * DT >= steer ? dirAct(dir) : [];
      if (k * DT < hold) held.push('jump');
      return { held, press: k === 1 ? ['jump'] : [] };
    }, 3);
  },
);
if (want('cellar souls leak')) {
  // design check: souls fly to the player within 40 px, even through terrain
  const b = new Bot({ abilities: NO, at: [80, 17] });
  b.walkTo(98);
  const leaked = b.soulsTaken(SOULS.cellar);
  report(
    'optional',
    'cellar souls stay hidden until the hollow floor is opened',
    leaked.length === 0,
    leaked.length ? `walking over the intact floor already collects ${leaked.map((c) => c.join(',')).join(' ')} (soul magnet reaches 40 px through the floor)` : 'none collected from above',
  );
}

// ===================================================================================================
// 4. THORNBED — checkpoint 2, then pogo across the 12-wide thorn pit (landing 2 lower)
// ===================================================================================================
section = 'thornbed';
console.log('\n== 4. THORNBED (no abilities) ==');

/**
 * Run right off a ledge and pogo off whatever is below (thorns, or a foe) until landing.
 * jumpAt: press jump when the player's front is this many px before the ledge end (<0 = after it,
 * coyote time); thr: strike ↓ once falling with the feet at/below this y; holdAfter: hold jump
 * through each bounce (floatier apex). dash: optional dash plan (for the station field).
 */
function pogoRun(
  b: Bot,
  o: {
    edgeX: number;
    jumpAt: number;
    hold: number;
    thr: number;
    holdAfter: boolean;
    done: (b: Bot) => boolean;
    dashAt?: ((b: Bot, n: number) => [number, number] | null) | null;
    maxSec?: number;
  },
) {
  let jumped = false;
  let k = 0;
  let jumpK = 0;
  let lastAtk = -9;
  let dashes = 0;
  let pogos = 0;
  let prevVy = 0;
  const ok = b.run((b) => {
    k++;
    if (o.done(b)) return 'done';
    if (jumped && b.ground && k - jumpK > 6) return 'fail';
    const p = b.p;
    if (prevVy > 0 && p.vy <= -150) pogos++;
    prevVy = p.vy;
    const held: Act[] = ['right'];
    if (!jumped) {
      if (p.right >= o.edgeX - o.jumpAt || (!b.ground && o.jumpAt < 0 && p.right >= o.edgeX - o.jumpAt)) {
        jumped = true;
        jumpK = k;
        return { held: ['right', 'jump'], press: ['jump'] };
      }
      return { held };
    }
    if ((k - jumpK) * DT < o.hold) held.push('jump');
    if (o.holdAfter && pogos > 0 && p.vy < 0) held.push('jump');
    const d = o.dashAt?.(b, dashes);
    if (d && p.state === 'normal') {
      dashes++;
      const dh: Act[] = [];
      if (d[0] > 0) dh.push('right');
      if (d[0] < 0) dh.push('left');
      if (d[1] < 0) dh.push('up');
      if (d[1] > 0) dh.push('down');
      return { held: dh, press: ['dash'] };
    }
    if (p.vy > 0 && p.bottom >= o.thr && b.t - lastAtk > 0.3 && p.state === 'normal') {
      lastAtk = b.t;
      return { held: ['right', 'down'], press: ['attack'] };
    }
    return { held };
  }, o.maxSec ?? 5);
  return { ok, pogos, dashes };
}
const thornbedSouls = new Set<string>();
let thornbedPogos = 9;
sweep(
  'main',
  'pogo across the thorn pit (112-123) to the landing (124+, 19)',
  cartesian({ start: [105, 107], jumpAt: [-6, 0, 8, 16, 24], hold: [0.1, 0.2, 0.3], thr: [136, 142, 148, 154, 160, 166], holdAfter: [true, false] }),
  ({ start, jumpAt, hold, thr, holdAfter }) => {
    const b = new Bot({ abilities: NO, at: [start, 17] });
    const r = pogoRun(b, { edgeX: 112 * 8, jumpAt, hold, thr, holdAfter, done: (b) => b.standing(124, 141, 19) });
    if (r.ok) {
      b.soulsTaken(SOULS.thornbed).forEach((c) => thornbedSouls.add(c.join(',')));
      thornbedPogos = Math.min(thornbedPogos, r.pogos);
    }
    return r.ok;
  },
);
if (want('thornbed souls'))
  report('optional', 'souls over the thorn pit (115,19)(118,18)(121,19)', thornbedSouls.size === 3, `${thornbedSouls.size}/3 collected across the winning pogo runs (min ${thornbedPogos} pogo(s) needed)`);
if (want('no pogo')) {
  const r = canReach(def, 'x', [111, 17], [124, 141, 19], { abilities: NO, useDJ: false, quiet: true });
  report('main', 'the pit really needs a pogo (plain jumps fail)', !r.ok, `${r.plans}/${r.tried} plain jumps land`);
}

// ===================================================================================================
// 5. MOSSY BASIN — drop to the thorny walkway, swim under the bramble pillar, spring up
// ===================================================================================================
section = 'basin';
console.log('\n== 5. MOSSY BASIN (no abilities) ==');
if (want('drop to the walkway')) {
  const b = new Bot({ abilities: NO, at: [126, 19] });
  const ok = b.walkUntil(1, 142, 153, 23) && b.walkTo(150);
  report('main', 'walk off the landing ledge (141) down to the thorny walkway (142-153, 23)', ok && !b.hurt, `at ${b.col.toFixed(1)},${b.floor}`);
}
// out of the right pool: on the bank (170-175, 29), or already sprung up onto the plateau
const rightPoolExit = (b: Bot) => b.standing(170, 175, 29) || b.standing(176, 185, 25);
/**
 * Leave the walkway's end, drop into the 3-wide gap before the thorny pillar, swim under it, climb out.
 * extra: px past the walkway end before letting go of →; after: let go, or steer back ←;
 * cadence: frames between strokes; down: hold ↓ to sink under the pillar; exitHold: frames jump is
 * held on each press (a tap is 1).
 */
function walkwayToRightPool(b: Bot, o: { extra: number; after: 'release' | 'steer'; cadence: number; down: boolean; exitHold: number }) {
  const edge = 154 * 8; // the walkway ends at x = 1232
  let phase: 'walk' | 'drop' | 'swim' = 'walk';
  let k = 0;
  let last = -99;
  return b.run((b) => {
    k++;
    if (rightPoolExit(b)) return 'done';
    const p = b.p;
    if (phase === 'walk') {
      if (p.x >= edge + o.extra) phase = 'drop';
      else return { held: ['right'] };
    }
    if (phase === 'drop') {
      if (b.inWater) phase = 'swim';
      else return { held: o.after === 'steer' && p.vx > 0 ? ['left'] : [] };
    }
    // swimming: sink (optionally holding ↓) and go right under the pillar (x 1264-1280), then stroke up
    const past = p.x >= 160 * 8;
    const held: Act[] = ['right'];
    if (!past && o.down) held.push('down');
    // a stroke underwater; a real jump once the head is out (only pressed while in the water)
    const press: Act[] = past && b.inWater && k - last >= o.cadence ? ['jump'] : [];
    if (press.length) last = k;
    if (k - last < o.exitHold) held.push('jump');
    return { held, press };
  }, 10);
}
let basinSouls = new Set<string>();
sweep(
  'main',
  'drop off the walkway end (154-156 gap, thorny pillar at 157) and swim under the pillar to (170-175, 29)',
  cartesian({ extra: [0, 4, 8, 12, 16], after: ['release', 'steer'] as const, cadence: [8, 14, 20, 28], down: [true, false], exitHold: [3, 8, 14] }),
  (o) => {
    const b = new Bot({ abilities: NO, at: [149, 23] });
    const ok = walkwayToRightPool(b, o);
    if (ok) b.soulsTaken(SOULS.basin).forEach((c) => basinSouls.add(c.join(',')));
    return ok;
  },
);
if (want('basin souls')) report('optional', 'underwater souls (153,31)(155,33)(159,33) on the swim', basinSouls.size === 3, `${basinSouls.size}/3 collected across the winning swims`);
// how forgiving is the drop itself? (hold → for `extra` px past the walkway end, then let go)
if (want('walkway drop window')) {
  const safe: number[] = [];
  for (let extra = 0; extra <= 24; extra++) {
    const b = new Bot({ abilities: NO, at: [149, 23] });
    b.run((b) => (b.inWater ? 'done' : { held: b.p.x < 154 * 8 + extra ? ['right'] : [] }), 3);
    if (!b.hurt && b.inWater) safe.push(extra);
  }
  const win = safe.length ? `${safe[0]}..${safe[safe.length - 1]} px` : 'none';
  report('main', 'walkway end: letting go of → in time drops safely between walkway and thorns', safe.length > 0, `safe if → is released within ${win} past the edge (${(safe.length / 90).toFixed(2)} s at run speed)`, safe.length < 10);
}
sweep(
  'main',
  'spring J (173,28) up onto the plateau (176-185, 25)',
  cartesian({ start: [170, 171, 172], steer: [0, 0.1, 0.2, 0.3], hold: ['right', 'none-then-right'] as const }),
  ({ start, steer, hold }) => {
    const b = new Bot({ abilities: NO, at: [start, 29] });
    let launched = false;
    let k = 0;
    return b.run((b) => {
      k++;
      if (b.standing(176, 185, 25)) return 'done';
      if (launched && b.ground && b.floor === 29 && b.p.vy >= 0 && k > 90) return 'fail';
      if (b.p.vy < -200) launched = true;
      if (!launched) return { held: ['right'] };
      if (hold === 'right') return { held: ['right'] };
      return { held: b.t >= steer + 0.2 ? ['right'] : [] };
    }, 4);
  },
);
const heartTaken = (b: Bot) => b.world.hasFlag('heart:outskirts:141,32');
const heartXGone = (b: Bot) => tileAt(b, 147, 32) === T.Empty && tileAt(b, 147, 33) === T.Empty;
sweep(
  'optional',
  'wooden heart (141,32): break the sunken cracked stone (147, 32-33), swim in, back out to (170-175, 29)',
  cartesian({ start: [149, 150, 152], cadence: [10, 16, 24], pace: [0.35, 0.6] }),
  ({ start, cadence, pace }) => {
    const b = new Bot({ abilities: NO, at: [start, 35] });
    // swim left along the bottom and strike the stone
    if (!strikeThrough(b, -1, 6, pace, heartXGone, 6)) return false;
    // into the 2-tall tunnel: stroke up a little and sink into it while holding ←
    let k = 0;
    const inside = b.run((b) => {
      k++;
      if (heartTaken(b)) return 'done';
      const blocked = b.p.x > 140 * 8 && gapTo(b, -1) === 0;
      return { held: ['left'], press: blocked && k % cadence === 0 ? ['jump'] : [] };
    }, 8);
    if (!inside || b.profile.maxHp !== 6) return false;
    k = 0;
    return b.run((b) => {
      k++;
      if (rightPoolExit(b)) return 'done';
      const p = b.p;
      const underPillar = p.x < 160 * 8;
      const blocked = gapTo(b, 1) === 0;
      const held: Act[] = ['right'];
      // stay low until past the pillar, stroke when a ledge blocks the way, then stroke up and out
      if (underPillar && !blocked && p.x > 148 * 8) held.push('down');
      const press: Act[] = b.inWater && (!underPillar || (blocked && p.x < 148 * 8)) && k % cadence === 0 ? ['jump'] : [];
      return { held, press };
    }, 12);
  },
);

// ===================================================================================================
// 6. SPIRIT SHRINE — crumbling roots over thorns, checkpoint 3, the Spirit Dash shrine D (208,23)
// ===================================================================================================
section = 'shrine';
console.log('\n== 6. SPIRIT SHRINE (no abilities until D) ==');
sweep(
  'main',
  'cross the crumbling roots (186-192, row 25) over thorns to solid ground (193+, 25)',
  cartesian({ start: [180, 182, 184, 185], how: ['run', 'jump-at-edge', 'jump-mid'] as const, hold: [0.1, 0.25] }),
  ({ start, how, hold }) => {
    const b = new Bot({ abilities: NO, at: [start, 25] });
    let k = 0;
    let jk = -1;
    return b.run((b) => {
      k++;
      if (b.standing(193, 225, 25)) return 'done';
      const held: Act[] = ['right'];
      const press: Act[] = [];
      const at = how === 'jump-at-edge' ? 185 * 8 + 4 : 189 * 8;
      if (how !== 'run' && jk < 0 && b.p.cx >= at && b.ground) {
        jk = k;
        press.push('jump');
      }
      if (jk > 0 && (k - jk) * DT < hold) held.push('jump');
      return { held, press };
    }, 4);
  },
);
if (want('checkpoint 3')) {
  const b = new Bot({ abilities: NO, at: [194, 25] });
  const ok = b.walkTo(199) && b.profile.spawn.kind === 'checkpoint' && b.profile.spawn.id === CP.c3;
  report('main', 'checkpoint 3 at (199,24)', ok, JSON.stringify(b.profile.spawn));
}
sweep(
  'main',
  'hop onto the shrine dais (206-210, 24) and take the Spirit Dash',
  cartesian({ start: [200, 202, 204], hold: [0.05, 0.1, 0.2, 0.3] }),
  ({ start, hold }) => {
    const b = new Bot({ abilities: NO, at: [start, 25] });
    let k = 0;
    let jk = -1;
    b.run((b) => {
      k++;
      if (b.profile.abilities.dash) return 'done';
      if (jk < 0 && gapTo(b, 1) <= 2 && b.ground) {
        jk = k;
        return { held: ['right', 'jump'], press: ['jump'] };
      }
      return { held: jk > 0 && (k - jk) * DT < hold ? ['right', 'jump'] : ['right'] };
    }, 4);
    b.idle(1.8); // the pickup cutscene
    return b.profile.abilities.dash && b.p.state === 'normal' && b.ground;
  },
);
if (want('shrine cannot be skipped')) {
  // walking or jumping along the floor past the dais always touches the shrine
  let skipped = 0;
  let tried = 0;
  for (const hold of [0.05, 0.1, 0.15, 0.2, 0.3, 0.4])
    for (const at of [203, 204, 205]) {
      tried++;
      const r = runPlan(def, [at, 25], { dir: 1, run: 0, hold, dj: null, dash: null, dashDir: [0, 0] }, { abilities: NO, seconds: 3 });
      if (!r.world.game.profile.abilities.dash && r.x > 211) skipped++;
    }
  report('main', 'the shrine cannot be jumped over by accident (D gate is unmissable)', skipped === 0, `${skipped}/${tried} jumps over the dais miss the shrine`);
}

// ===================================================================================================
// 7. SPIRIT STEPS — dash practice yard, checkpoint 4, an 11-wide dash gap, an up-dash past a thorny cliff
// ===================================================================================================
section = 'steps';
console.log('\n== 7. SPIRIT STEPS (dash, no double jump) ==');
if (want('walk to the yard')) {
  const b = new Bot({ abilities: DASH, at: [208, 24] });
  const ok = b.walkUntil(1, 226, 228, 26) && b.settle() && b.standing(226, 228, 26);
  report('main', 'walk from the shrine down the steps to the yard (226-228, 26)', ok, `at ${b.col.toFixed(1)},${b.floor}`);
}
hop('main', 'yard: over pit 1 (229-234) to the 2-wide pillar (235-236, 26)', [227, 26], [235, 236, 26], DASH);
hop('main', 'yard: pillar over pit 2 (237-241) to the checkpoint ledge (242-247, 26)', [236, 26], [242, 247, 26], DASH);
hop('main', 'yard alternative: one dash-jump from (228,26) straight to (242-247, 26)', [228, 26], [242, 247, 26], DASH);
hop('pit', 'yard pit 1 (229-234, floor 29): climb out forward to the pillar', [231, 29], [235, 236, 26], DASH);
hop('pit', 'yard pit 1 (229-234, floor 29): climb out back to (226-228, 26)', [231, 29], [226, 228, 26], DASH);
hop('pit', 'yard pit 2 (237-241, floor 29): climb out forward (242-247, 26)', [239, 29], [242, 247, 26], DASH);
hop('pit', 'yard pit 1 without dash (if D was skipped): out to the pillar', [231, 29], [235, 236, 26], NO);
hop('pit', 'yard pit 2 without dash (if D was skipped): out to (242-247, 26)', [239, 29], [242, 247, 26], NO);
hop('pit', 'yard pit 2 without dash: back out to the pillar (235-236, 26)', [239, 29], [235, 236, 26], NO);
if (want('checkpoint 4')) {
  const b = new Bot({ abilities: DASH, at: [242, 26] });
  const ok = b.walkTo(244) && b.profile.spawn.kind === 'checkpoint' && b.profile.spawn.id === CP.c4;
  report('main', 'checkpoint 4 at (244,25)', ok, JSON.stringify(b.profile.spawn));
}
hop('main', 'dash across the 11-wide thorn gap (248-258) to (259-265, 26)', [246, 26], [259, 265, 26], DASH);
hop('main', 'dash gap from the very edge (247,26)', [247, 26], [259, 265, 26], DASH);
if (want('gap needs dash')) {
  const r = canReach(def, 'x', [247, 26], [259, 265, 26], { abilities: NO, useDJ: false, quiet: true });
  report('main', 'the 11-wide gap really needs the dash', !r.ok, `${r.plans}/${r.tried} dash-less plans land`);
}
/**
 * The sign's technique: stand near the cliff, jump (hold `hold` s), up-dash (↑ or ↗) `td` s after
 * the jump, and only steer → once the feet are `steerAbove` px above the floor or `steerT` s after the dash.
 */
function cliffClimb(b: Bot, o: { hold: number; td: number; dir: 'up' | 'upright'; steerT: number }) {
  let k = 0;
  let dk = -1;
  return b.run((b) => {
    k++;
    if (b.standing(266, 275, 19)) return 'done';
    if (k > 10 && b.ground && b.floor === 26) return 'fail';
    const held: Act[] = [];
    if (k * DT < o.hold) held.push('jump');
    if (k === 1) return { held: ['jump'], press: ['jump'] };
    if (dk < 0 && k * DT >= o.td) {
      dk = k;
      return { held: o.dir === 'up' ? ['up'] : ['up', 'right'], press: ['dash'] };
    }
    if (dk > 0 && (k - dk) * DT >= 0.15 + o.steerT) held.push('right');
    return { held };
  }, 3);
}
for (const c of [260, 261, 262, 263, 264])
  sweep(
    'main',
    `up-dash past the thorny cliff from (${c},26): jump, ↑ dash, then → (sign technique)`,
    cartesian({ hold: [0.1, 0.2, 0.3], td: [0.1, 0.2, 0.3, 0.4], dir: ['up', 'upright'] as const, steerT: [0, 0.05, 0.1, 0.2] }),
    (o) => cliffClimb(new Bot({ abilities: DASH, at: [c, 26] }), o),
  );
hop('main', 'up-dash past the thorny cliff, canReach plans from (261,26) (→ held throughout)', [261, 26], [266, 275, 19], DASH);
if (want('cliff needs dash')) {
  const r = canReach(def, 'x', [263, 26], [266, 275, 19], { abilities: NO, useDJ: true, quiet: true });
  report('main', 'the thorny cliff really needs the dash', !r.ok, `${r.plans}/${r.tried} dash-less plans land`);
}

// ===================================================================================================
// 8. MOSSGATE STATION — the last thorn field (18 wide), the sector lantern E, the station T
// ===================================================================================================
section = 'station';
console.log('\n== 8. MOSSGATE STATION (dash, no double jump) ==');
if (want('walk to the field')) {
  const b = new Bot({ abilities: DASH, at: [267, 19] });
  report('main', 'walk from the cliff top to the thorn field ledge (272-275, 19)', b.walkTo(275) && b.floor === 19, `at ${b.col.toFixed(1)},${b.floor}`);
}
type FieldPlan = { mode: 'jump-dash' | 'dash-jump'; jumpAt: number; hold: number; td: number; d1: 'r' | 'ur'; thr: number; d2: 'r' | 'ur'; v2: number };
/** Cross the 18-wide thorn field: (jump + air dash | dash-jump), pogo off a thorn (refills the dash), dash again. */
function stationField(b: Bot, o: FieldPlan, done: (b: Bot) => boolean = (b) => b.standing(294, 328, 19)) {
  const edge = 276 * 8;
  let phase: 'run' | 'dj' | 'air' = 'run';
  let k = 0;
  let jk = 0;
  let dashes = 0;
  let pogos = 0;
  let prevVy = 0;
  let lastAtk = -9;
  const dashKeys = (d: 'r' | 'ur'): Act[] => (d === 'r' ? ['right'] : ['up', 'right']);
  return b.run((b) => {
    k++;
    const p = b.p;
    if (done(b)) return 'done';
    if (phase !== 'run' && b.ground && k - jk > 8 && p.state === 'normal') return 'fail';
    if (prevVy > 0 && p.vy <= -150) pogos++;
    prevVy = p.vy;
    if (phase === 'run') {
      if (p.right < edge - o.jumpAt) return { held: ['right'] };
      jk = k;
      if (o.mode === 'jump-dash') {
        phase = 'air';
        return { held: ['right', 'jump'], press: ['jump'] };
      }
      phase = 'dj';
      dashes++;
      return { held: ['right'], press: ['dash'] };
    }
    if (phase === 'dj') {
      if (p.state === 'dash' && b.ground) {
        phase = 'air';
        jk = k;
        return { held: ['right', 'jump'], press: ['jump'] };
      }
      if (!b.ground) phase = 'air';
      return { held: ['right'] };
    }
    const held: Act[] = ['right'];
    if ((k - jk) * DT < o.hold) held.push('jump');
    if (p.state !== 'normal') return { held };
    if (o.mode === 'jump-dash' && dashes === 0 && (k - jk) * DT >= o.td) {
      dashes++;
      return { held: dashKeys(o.d1), press: ['dash'] };
    }
    if (pogos > 0 && dashes < 2 && p.dashes > 0 && p.vy >= o.v2) {
      dashes = 2;
      return { held: dashKeys(o.d2), press: ['dash'] };
    }
    if (p.vy > 0 && p.bottom >= o.thr && b.t - lastAtk > 0.3) {
      lastAtk = b.t;
      return { held: ['right', 'down'], press: ['attack'] };
    }
    return { held };
  }, 5);
}
const fieldPlans: FieldPlan[] = [
  ...cartesian({
    mode: ['jump-dash'] as const,
    jumpAt: [0, 8, 16],
    hold: [0.15, 0.3],
    td: [0.1, 0.2, 0.3],
    d1: ['r', 'ur'] as const,
    thr: [160, 166, 172],
    d2: ['r', 'ur'] as const,
    v2: [-60, -20, 20],
  }),
  ...cartesian({ mode: ['dash-jump'] as const, jumpAt: [8, 16, 24], hold: [0.15, 0.3], td: [0], d1: ['r'] as const, thr: [160, 166, 172], d2: ['r', 'ur'] as const, v2: [-60, -20, 20] }),
];
let fieldWinner: FieldPlan | null = null;
sweep('main', 'cross the 18-wide thorn field (276-293): dash, pogo off a thorn, dash -> (294+, 19)', fieldPlans, (o) => {
  const ok = stationField(new Bot({ abilities: DASH, at: [273, 19] }), o);
  if (ok && !fieldWinner && o.mode === 'jump-dash' && o.thr === 166) fieldWinner = o;
  return ok;
});
if (want('field needs')) {
  const r = canReach(def, 'x', [275, 19], [294, 328, 19], { abilities: DASH, useDJ: false, useDash: true, quiet: true });
  report('main', 'the thorn field cannot be crossed with one jump + dash (pogo needed)', !r.ok, `${r.plans}/${r.tried} single jump/dash plans land`);
}
if (want('relight the sector lantern')) {
  const b = new Bot({ abilities: DASH, at: [295, 19] });
  b.walkTo(299);
  b.tick([], ['up']);
  b.idle(2.2);
  const ok = b.world.hasFlag('goal:outskirts') && b.profile.unlocked.includes('underworks');
  report('main', 'walk to the sector lantern E (299,18) and relight it (↑)', ok, `goal flag ${b.world.hasFlag('goal:outskirts')}, unlocked ${b.profile.unlocked.join(',')}`);
}
if (want('arrival station')) {
  const b = new Bot({ abilities: NO });
  const start = `${b.col.toFixed(1)},${b.floor}`;
  b.walkTo(299);
  b.tick([], ['up']);
  b.idle(2.2);
  report('main', 'arrival at station T (spawn 2 tiles left of T) -> walk to E and relight it', b.world.hasFlag('goal:outskirts'), `spawned at ${start}`);
}

// ===================================================================================================
// PITS & HAZARDS — every place you can fall must have a way out or a hazard respawn onto ground that
// continues the route (no dead end that needs a death or the pause-menu escape)
// ===================================================================================================
section = 'hazards';
console.log('\n== HAZARD PITS: falling in respawns you on safe ground that continues the route ==');
/** Fall into a hazard with `ctl`, then check the respawn spot is standing ground inside `safe`. */
function hazardRespawn(name: string, ab: typeof NO, at: [number, number], ctl: Ctl, safe: [number, number, number][]) {
  if (!want(name)) return;
  const b = new Bot({ abilities: ab, at });
  b.settle();
  b.run(ctl, 4, { allowHurt: false });
  const hit = b.hurt;
  b.idle(1.5);
  const where = `${b.col.toFixed(1)},${b.floor.toFixed(2)}`;
  // respawn spots are the last frame on safe ground, which may overhang an edge by up to 7 px
  const onIt = ([c0, c1, f]: [number, number, number]) =>
    b.ground && Math.abs(b.floor - f) < 0.01 && b.p.right > c0 * 8 && b.p.x < (c1 + 1) * 8;
  const ok = hit && b.p.state === 'normal' && safe.some(onIt);
  report('pit', name, ok, hit ? `respawned at ${where} (hp ${b.profile.hp}/${b.profile.maxHp})` : `no hazard hit (ended at ${where})`);
}
hazardRespawn('thorn pit (112-123, thorns row 21): walk off the ledge', NO, [109, 17], () => ({ held: ['right'] }), [[102, 111, 17]]);
hazardRespawn('thorn pit: fall short from a jump', NO, [109, 17], (b) => ({ held: ['right'], press: b.ground ? ['jump'] : [] }), [
  [102, 111, 17],
  [124, 141, 19],
]);
hazardRespawn('bramble pillar thorns (157): run off the walkway end holding →', NO, [150, 23], () => ({ held: ['right'] }), [[142, 153, 23]]);
hazardRespawn('crumbling roots (186-192): stop on them until they drop', NO, [183, 25], (b) => (b.col < 188.5 ? { held: ['right'] } : {}), [
  [176, 185, 25],
  [193, 225, 25],
]);
hazardRespawn('11-wide dash gap (248-258, thorns row 30): walk off the edge', DASH, [245, 26], () => ({ held: ['right'] }), [[242, 247, 26]]);
hazardRespawn('thorny cliff (265, rows 20-25): jump into it', DASH, [262, 26], (b) => ({ held: ['right'], press: b.ground ? ['jump'] : [] }), [[259, 265, 26]]);
hazardRespawn('station thorn field (276-293, thorns row 22): walk off the ledge', DASH, [273, 19], () => ({ held: ['right'] }), [[266, 275, 19]]);
hazardRespawn('station thorn field: jump + dash, no pogo', DASH, [274, 19], (b) => ({ held: ['right'], press: b.ground ? ['jump'] : b.p.vy > -20 && b.p.dashes > 0 ? ['dash'] : [] }), [
  [266, 275, 19],
  [294, 328, 19],
]);

// ===================================================================================================
// FULL RUN — one world, real state, from the new-game start P to the lit sector lantern E.
// Abilities come only from the shrine; checkpoints must switch on in order; the X wall stays broken.
// ===================================================================================================
section = 'full';
/** First canReach plan (no-dash plans first) from `from` that lands in `to`. */
function findPlan(from: [number, number], to: [number, number, number], ab: typeof NO, dirs: (1 | -1)[] = [1, -1]): Plan | null {
  const dashDirs: [number, number][] = [
    [0, 0],
    [1, 0],
    [-1, 0],
    [1, -1],
    [-1, -1],
    [0, -1],
  ];
  for (const useDash of ab.dash ? [false, true] : [false])
    for (const dir of dirs)
      for (const run of [0, 0.1, 0.2, 0.35])
        for (const hold of [0.2, 0.4, 0.12, 0.05])
          for (const dash of useDash ? [0.1, 0.25, 0.4] : [null])
            for (const dd of dash === null ? [dashDirs[0]] : dashDirs.slice(1)) {
              if (dash !== null && dd[0] !== 0 && Math.sign(dd[0]) !== dir) continue;
              const pl: Plan = { dir, run, hold, dj: null, dash, dashDir: dd };
              const r = runPlan(def, from, pl, { abilities: ab });
              if (!r.hurt && r.onGround && r.x >= to[0] && r.x <= to[1] + 1 && Math.abs(r.y - to[2]) < 0.01) return pl;
            }
  return null;
}
if (want('P to E')) {
  console.log('\n== FULL RUN: new game at P -> sector lantern E (one world, real state) ==');
  const b = new Bot({ abilities: { ...NO }, spawn: { kind: 'start' } });
  const steps: [string, () => boolean][] = [
    ['spawn at P', () => b.standing(3, 3, 33)],
    ['walk to the step', () => b.walkTo(12)],
    ['hop the step', () => b.snap([12, 33]) && b.plan(findPlan([12, 33], [14, 19, 32], NO)!) && b.standing(14, 19, 32)],
    ['jump the puddle', () => b.walkTo(18) && b.snap([18, 32]) && b.plan(findPlan([18, 32], [23, 27, 32], NO)!) && b.standing(23, 27, 32)],
    ['3-tile step', () => b.walkTo(26) && b.snap([26, 32]) && b.plan(findPlan([26, 32], [28, 47, 29], NO)!) && b.standing(28, 47, 29)],
    ['into the chimney', () => b.walkTo(51)],
    ['climb the chimney', () => b.snap([51, 29]) && climbChimney(b, { first: 1, pressGap: 2, delay: 0, hold: 0.2 })],
    ['checkpoint 1', () => b.walkTo(58) && b.profile.spawn.kind === 'checkpoint' && b.profile.spawn.id === CP.c1],
    ['break the cracked wall', () => b.walkTo(74) && strikeThrough(b, 1, 4, 0.4, xWallGone)],
    ['through the hall to checkpoint 2', () => b.walkTo(105) && b.profile.spawn.kind === 'checkpoint' && b.profile.spawn.id === CP.c2],
    [
      'pogo the thorn pit',
      () =>
        b.walkTo(106) && pogoRun(b, { edgeX: 112 * 8, jumpAt: 0, hold: 0.2, thr: 154, holdAfter: true, done: (b) => b.standing(124, 141, 19) }).ok,
    ],
    ['down to the walkway', () => b.walkUntil(1, 142, 153, 23) && b.walkTo(149)],
    ['drop and swim under the pillar', () => walkwayToRightPool(b, { extra: 4, after: 'release', cadence: 14, down: true, exitHold: 8 })],
    ['spring to the plateau', () => b.run((b) => (b.standing(176, 185, 25) ? 'done' : { held: ['right'] }), 5)],
    ['run the crumbling roots', () => b.walkTo(184) && b.run((b) => (b.standing(193, 225, 25) ? 'done' : { held: ['right'] }), 3)],
    ['checkpoint 3', () => b.walkTo(199) && b.profile.spawn.kind === 'checkpoint' && b.profile.spawn.id === CP.c3],
    [
      'take the Spirit Dash',
      () => {
        b.walkTo(204);
        b.snap([204, 25]);
        b.plan(findPlan([204, 25], [206, 210, 24], NO, [1])!);
        b.idle(1.8);
        return b.profile.abilities.dash && !b.profile.abilities.doubleJump;
      },
    ],
    ['down to the yard', () => b.walkUntil(1, 226, 228, 26) && b.walkTo(227)],
    ['yard: pit 1 to the pillar', () => b.snap([227, 26]) && b.plan(findPlan([227, 26], [235, 236, 26], DASH)!) && b.standing(235, 236, 26)],
    ['yard: pit 2 to the ledge', () => b.walkTo(236) && b.snap([236, 26]) && b.plan(findPlan([236, 26], [242, 247, 26], DASH)!) && b.standing(242, 247, 26)],
    ['checkpoint 4', () => b.walkTo(244) && b.profile.spawn.kind === 'checkpoint' && b.profile.spawn.id === CP.c4],
    ['dash the 11-wide gap', () => b.walkTo(246) && b.snap([246, 26]) && b.plan(findPlan([246, 26], [259, 265, 26], DASH)!) && b.standing(259, 265, 26)],
    ['up-dash the thorny cliff', () => b.walkTo(264) && b.snap([264, 26]) && cliffClimb(b, { hold: 0.2, td: 0.3, dir: 'up', steerT: 0.05 })],
    ['to the thorn field', () => b.walkTo(273)],
    ['cross the thorn field', () => b.snap([273, 19]) && stationField(b, fieldWinner ?? fieldPlans[0])],
    [
      'relight the sector lantern',
      () => {
        b.walkTo(299);
        b.tick([], ['up']);
        b.idle(2.2);
        return b.world.hasFlag('goal:outskirts');
      },
    ],
  ];
  let ok = true;
  for (const [name, f] of steps) {
    const t0 = b.t;
    const r = f() && !b.hurt;
    console.log(`    ${r ? 'ok  ' : 'FAIL'} ${name.padEnd(34)} t=${b.t.toFixed(1)}s (+${(b.t - t0).toFixed(1)}) at ${b.col.toFixed(1)},${b.floor.toFixed(2)}${b.hurt ? ' ' + b.log.join('; ') : ''}`);
    if (!r) {
      ok = false;
      break;
    }
  }
  report(
    'main',
    'full run P -> E in one world (abilities only from D, checkpoints 1-4 in order)',
    ok,
    `${ok ? 'lantern relit' : 'stopped'} after ${b.t.toFixed(1)} s of bot play, ${b.profile.souls} souls, ${b.hits} hits`,
  );
}

// ===================================================================================================
// SUMMARY
// ===================================================================================================
const counted = results;
const okN = counted.filter((r) => r.ok).length;
const tight = counted.filter((r) => r.ok && r.tight);
const fails = counted.filter((r) => !r.ok);
console.log('');
for (const k of ['main', 'optional', 'pit'] as Kind[]) {
  const rs = counted.filter((r) => r.kind === k);
  console.log(`${k.padEnd(8)} ${rs.filter((r) => r.ok).length}/${rs.length} OK`);
}
if (tight.length) console.log(`TIGHT (works, but few winning plans):\n${tight.map((r) => `  - [${r.section}] ${r.name}: ${r.info}`).join('\n')}`);
if (fails.length) console.log(`FAILED:\n${fails.map((r) => `  - [${r.section}] ${r.name}: ${r.info}`).join('\n')}`);
console.log(`ROUTE: ${okN}/${counted.length} hops OK`);
process.exit(fails.length ? 1 : 0);
