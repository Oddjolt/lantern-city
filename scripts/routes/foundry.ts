/**
 * Route regression test for EMBER FOUNDRY (final world: Spirit Dash + Ember Wings from the start).
 *
 *   npx tsx scripts/routes/foundry.ts
 *
 * Real engine, headless (scripts/sim.ts). Walks the main route T → E hop by hop in order, checks that
 * every checkpoint activates and can be continued from, that every optional reward can be collected
 * (and its nook left again), that every slag pit gives a stable hazard respawn, and that the player
 * can't leave the map. Timed mechanisms (cranes, flame jets, presses) are played by small bots that
 * wait for their moment the way a player would, swept over many arrival phases; stateful gates (the
 * IRON WARDEN's arena) are played for real: walk in, get sealed in, kill it, walk out.
 *
 * Coordinates are tiles: [column, floorRow] where floorRow is the solid row the player stands on.
 * Prints one line per check, WARN lines for hops that only work with few winning plans, and ends with
 * "ROUTE: N/M hops OK"; exit code 1 on any failure.
 */
import { T } from '../../src/engine/tilemap';
import { canReach, loadWorldDef, makeWorld, runPlan, type Act, type SimOpts } from '../sim';

// deterministic AI / particles, so the test is a stable regression
let seed = 0x5eed;
Math.random = () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const def = await loadWorldDef('foundry');
const DT = 1 / 60;
const BOTH = { dash: true, doubleJump: true };
type Spot = [number, number];
/** Entities are reached through `any` where the test needs their private timers/state. */
type Any = any; // eslint-disable-line @typescript-eslint/no-explicit-any

// ---- a scripted player ------------------------------------------------------------------------
class Bot {
  readonly world: ReturnType<typeof makeWorld>['world'];
  readonly input: ReturnType<typeof makeWorld>['input'];
  readonly profile: ReturnType<typeof makeWorld>['profile'];
  t = 0;
  hurts = 0;
  respawns = 0;
  private wasRespawn = false;

  constructor(o: SimOpts & { at?: Spot } = {}) {
    const s = makeWorld(def, { abilities: { ...BOTH }, ...o });
    this.world = s.world;
    this.input = s.input;
    this.profile = s.profile;
    if (o.at) this.p.place(o.at[0] * 8 + 4, o.at[1] * 8);
    this.frame();
  }
  get p() {
    return this.world.player;
  }
  private queued: Act[] = [];
  /** Press `a` on the next frame (for reactive bots that decide inside an `until` callback). */
  queue(a: Act) {
    this.queued.push(a);
  }
  frame(held: Act[] = [], pressed: Act[] = []) {
    this.input.held = new Set(held);
    this.input.now = new Set([...pressed, ...this.queued]);
    this.queued = [];
    const hp = this.profile.hp;
    this.world.update(DT);
    this.t += DT;
    if (this.profile.hp < hp) this.hurts++;
    const r = this.p.state === 'respawn';
    if (r && !this.wasRespawn) this.respawns++;
    this.wasRespawn = r;
  }
  run(secs: number, held: Act[] = [], pressed: Act[] = []) {
    const n = Math.round(secs / DT);
    for (let i = 0; i < n; i++) this.frame(held, i === 0 ? pressed : []);
  }
  /** Hold `held` until `cond` (checked before every frame); false on timeout. */
  until(cond: () => boolean, held: Act[] | (() => Act[]), maxSecs = 10, pressed: Act[] = []) {
    const n = Math.round(maxSecs / DT);
    for (let i = 0; i < n; i++) {
      if (cond()) return true;
      this.frame(typeof held === 'function' ? held() : held, i === 0 ? pressed : []);
    }
    return cond();
  }
  get col() {
    return this.p.cx / 8;
  }
  get row() {
    return this.p.bottom / 8;
  }
  get ground() {
    return this.p.onGround();
  }
  /** Standing on solid/one-way floor whose top is `row`, overlapping columns c0..c1. */
  stands(c0: number, c1: number, row: number) {
    return this.ground && this.p.bottom === row * 8 && this.p.right > c0 * 8 && this.p.x < (c1 + 1) * 8;
  }
  rides(e: Any) {
    return !!e && this.ground && this.p.bottom === e.y && this.p.x < e.right && this.p.right > e.x;
  }
  landed() {
    return (this.ground && this.p.vy >= 0) || this.p.state === 'respawn';
  }
  ents(name: string): Any[] {
    return this.world.entities.filter((e) => e.constructor.name === name);
  }
  where() {
    return `(${this.col.toFixed(1)}, ${this.row.toFixed(2)})${this.ground ? '' : ' airborne'} hurts=${this.hurts} respawns=${this.respawns}`;
  }
}

const cranes = (b: Bot) => b.ents('Crane').sort((a, z) => a.x - z.x || a.y - z.y) as Any[];
/** The two horizontal cranes over the slag river and the two vertical ones in the crucible pit. */
const riverCranes = (b: Bot) => cranes(b).filter((c) => c.x < 100 * 8);
const pitCranes = (b: Bot) => cranes(b).filter((c) => c.x > 200 * 8);
const warden = (b: Bot) => b.world.entities.find((e) => e.constructor.name === 'Warden') as Any;
const cpId = (c: number, r: number) => `foundry:${c},${r}`;
const atCheckpoint = (b: Bot, c: number, r: number) => b.profile.spawn.kind === 'checkpoint' && b.profile.spawn.id === cpId(c, r);

// ---- brute-forced hops with air control (canReach always holds the direction; we also release) ---
interface HopPlan {
  dir: -1 | 0 | 1;
  run: number;
  hold: number;
  /** Seconds after the jump that the direction stays held (air control release). */
  steer: number;
  dj: number | null;
  dash: number | null;
  dashDir: [number, number];
}
function execPlan(b: Bot, pl: HopPlan, maxSecs = 3) {
  const key: Act | null = pl.dir > 0 ? 'right' : pl.dir < 0 ? 'left' : null;
  const hp0 = b.profile.hp;
  const r0 = b.respawns;
  let t = 0;
  let tJ = -1;
  let djDone = false;
  let dashDone = false;
  let airborne = false;
  for (let i = 0; i < maxSecs * 60; i++) {
    if (!b.ground) airborne = true;
    if (airborne && tJ >= 0 && b.ground && b.p.vy >= 0) {
      b.run(0.3);
      return b.profile.hp >= hp0 && b.respawns === r0;
    }
    const held: Act[] = [];
    const press: Act[] = [];
    if (tJ < 0) {
      if (key) held.push(key);
      if (t >= pl.run) {
        press.push('jump');
        held.push('jump');
        tJ = t;
      }
    } else {
      const s = t - tJ;
      if (key && s < pl.steer) held.push(key);
      if (s < pl.hold) held.push('jump');
      if (pl.dj !== null && !djDone && s >= pl.dj) {
        press.push('jump');
        djDone = true;
      }
      if (djDone && pl.dj !== null && s < pl.dj + 0.2) held.push('jump');
      if (pl.dash !== null && !dashDone && s >= pl.dash) {
        press.push('dash');
        dashDone = true;
        if (key) held.splice(held.indexOf(key), 1);
        const [dx, dy] = pl.dashDir;
        if (dx) held.push(dx > 0 ? 'right' : 'left');
        if (dy) held.push(dy < 0 ? 'up' : 'down');
      }
    }
    b.frame(held, press);
    t += DT;
    if (b.profile.hp < hp0 || b.respawns > r0) return false;
  }
  return false;
}
function* plans(o: {
  dirs?: (-1 | 0 | 1)[];
  runs?: number[];
  holds?: number[];
  steers?: number[];
  djs?: (number | null)[];
  dashes?: (number | null)[];
  dashDirs?: [number, number][];
}): Generator<HopPlan> {
  for (const dir of o.dirs ?? [1])
    for (const run of o.runs ?? [0, 0.15, 0.3])
      for (const hold of o.holds ?? [0.05, 0.2, 0.4])
        for (const steer of o.steers ?? [0.2, 0.4, 9])
          for (const dj of o.djs ?? [null, 0.2, 0.4])
            for (const dash of o.dashes ?? [null])
              for (const dashDir of dash === null ? [[0, 0] as [number, number]] : (o.dashDirs ?? [[1, 0], [1, -1], [0, -1]]) as [number, number][]) {
                if (dash !== null && dashDir[0] !== 0 && dir !== 0 && Math.sign(dashDir[0]) !== dir) continue;
                yield { dir, run, hold, steer, dj, dash, dashDir };
              }
}
function brute(setup: () => Bot, space: Iterable<HopPlan>, goal: (b: Bot) => boolean) {
  let wins = 0;
  let tried = 0;
  for (const pl of space) {
    const b = setup();
    tried++;
    if (execPlan(b, pl) && goal(b)) wins++;
  }
  return { wins, tried };
}

// ---- reporting -----------------------------------------------------------------------------------
interface Result {
  ok: boolean;
  detail: string;
  /** Set when the hop works but only with few winning plans / phases. */
  tight?: string;
}
const results: { id: string; name: string; r: Result }[] = [];
let section = '';
function head(s: string) {
  section = s;
  console.log(`\n== ${s} ==`);
}
let n = 0;
function check(name: string, fn: () => Result) {
  const id = `${++n}`.padStart(2);
  let r: Result;
  try {
    r = fn();
  } catch (e) {
    r = { ok: false, detail: `threw ${(e as Error).stack?.split('\n').slice(0, 3).join(' | ')}` };
  }
  results.push({ id, name: `${section}: ${name}`, r });
  console.log(`${r.ok ? 'OK  ' : 'FAIL'} ${id} ${name} — ${r.detail}`);
  if (r.tight) console.log(`WARN ${id} ${name} — tight: ${r.tight}`);
}
/** canReach wrapper: OK if any plan lands; flags hops with < 3% winning plans as tight. */
function reach(from: Spot, to: [number, number, number], o: Parameters<typeof canReach>[4] = {}): Result {
  const r = canReach(def, '', from, to, { abilities: { ...BOTH }, quiet: true, ...o });
  const frac = r.plans / Math.max(1, r.tried);
  return {
    ok: r.ok,
    detail: `${r.plans}/${r.tried} plans land${r.easiest ? `, easiest: ${r.easiest}` : ''}`,
    tight: r.ok && (frac < 0.03 || r.plans < 5) ? `${r.plans}/${r.tried} plans` : undefined,
  };
}
const ratio = (ok: number, of: number) => `${ok}/${of}`;

// =====================================================================================================
head('MAIN ROUTE (Spirit Dash + Ember Wings)');

check('A  station arrival -> through the yard and the hall doorway to the first trench (41,40)', () => {
  const b = new Bot({ spawn: { kind: 'station' } });
  const start = b.where();
  const ok = b.until(() => b.col >= 41.3, ['right'], 8) && b.stands(40, 41, 40) && !b.hurts;
  return { ok, detail: `spawned at ${start}, now ${b.where()} after ${b.t.toFixed(1)}s` };
});

check('B  slag trench 42-44: (41,40) -> (45..53,40)', () => reach([41, 40], [45, 53, 40], { useDash: false }));

check('B  slag trench 54-57: (53,40) -> (58..63,40)', () => {
  const b = new Bot({ at: [45, 40] });
  const walked = b.until(() => b.col >= 53.3, ['right'], 3) && !b.hurts;
  const r = reach([53, 40], [58, 63, 40], { useDash: false });
  return { ...r, ok: walked && r.ok };
});

check('B  slag river: wait for crane 1 -> ride -> island (72-74,38) -> crane 2 -> floor (84+,40), 12 arrival phases', () => {
  let good = 0;
  let last = '';
  for (let k = 0; k < 12; k++) {
    const b = new Bot({ at: [60, 40] });
    b.run(k * 0.35);
    b.until(() => b.col >= 63.3, ['right'], 2);
    const [c1, c2] = riverCranes(b);
    const steps = [
      b.until(() => c1.x <= 64 * 8 + 1 && c1.vx >= 0, [], 6),
      (b.run(0.25, ['right', 'jump'], ['jump']), b.until(() => b.landed(), ['jump'], 1.5) && b.rides(c1)),
      b.until(() => c1.x >= 69 * 8 - 1, [], 6) && b.rides(c1),
      b.until(() => b.col >= 73 && b.stands(72, 74, 38), ['right'], 1.5),
      (b.run(0.1), b.until(() => c2.x <= 75 * 8 + 1 && c2.vx >= 0, [], 7)),
      (b.run(0.15, ['right', 'jump'], ['jump']), b.until(() => b.landed(), [], 1.5) && b.rides(c2)),
      b.until(() => c2.x >= 81 * 8 - 1, [], 7) && b.rides(c2),
      b.until(() => b.col >= 85.5 && b.stands(84, 89, 40), ['right'], 2),
    ];
    const failAt = steps.indexOf(false);
    if (failAt < 0 && !b.hurts) good++;
    else last = `phase ${k}: failed at step ${failAt < 0 ? 'hurt' : failAt + 1}, ${b.where()}`;
  }
  return { ok: good === 12, detail: `${ratio(good, 12)} arrival phases cross without damage${last ? `; ${last}` : ''}` };
});

check('B  checkpoint 1 (86,39) activates', () => {
  const b = new Bot({ at: [84, 40] });
  const ok = b.until(() => atCheckpoint(b, 86, 39), ['right'], 2);
  return { ok, detail: ok ? `saved at ${b.where()}` : `not activated, ${b.where()}` };
});

check('C  belt 1 (pushes right) -> slag trench 102-105: (100,40) -> (106..112,40)', () => {
  const b = new Bot({ at: [87, 40] });
  const walked = b.until(() => b.col >= 100, ['right'], 3) && !b.hurts;
  const r = reach([100, 40], [106, 112, 40], { useDash: false });
  return { ...r, ok: walked && r.ok };
});

check('C  flame jets 113 & 116: wait for each to finish, cross, wait between them (15 phases)', () => {
  let good = 0;
  let naiveHit = 0;
  for (let k = 0; k < 15; k++) {
    const b = new Bot({ at: [107, 40] });
    b.run(k * 0.2);
    const [f, F] = b.ents('FlameJet').sort((a, z) => a.x - z.x);
    const fresh = (j: Any) => j.t % 3 < 0.3; // just went cold: 1.9 s before it burns again
    const ok =
      b.until(() => b.col >= 111.5, ['right'], 2) &&
      b.until(() => fresh(f), [], 4) &&
      b.until(() => b.col >= 115, ['right'], 1) &&
      b.until(() => fresh(F), [], 4) &&
      b.until(() => b.col >= 117.4, ['right'], 1);
    if (ok && !b.hurts) good++;
    const n2 = new Bot({ at: [107, 40] });
    n2.run(k * 0.2);
    n2.until(() => n2.col >= 117.4, ['right'], 3);
    if (n2.hurts) naiveHit++;
  }
  return { ok: good === 15, detail: `${ratio(good, 15)} phases safe when waiting; a blind run-through gets burned in ${ratio(naiveHit, 15)}` };
});

check('C  hop the bumper (118,39) onto belt 2', () => {
  const b = new Bot({ at: [115, 40] });
  b.until(() => b.col >= 116.6, ['right'], 1);
  b.frame(['right', 'jump'], ['jump']);
  const ok = b.until(() => b.landed(), ['right', 'jump'], 1.5) && b.stands(119, 128, 40) && !b.hurts;
  const r = reach([117, 40], [119, 134, 40], { useDash: false });
  return { ok: ok && r.ok, detail: `scripted hop lands at ${b.where()}; brute force ${r.detail}` };
});

check('C  run against belt 2 and over the rusted grates (129-134) -> floor (135+,40)', () => {
  const b = new Bot({ at: [120, 40] });
  const walk = b.until(() => b.col >= 135.5 && b.stands(135, 139, 40), ['right'], 4) && !b.hurts && !b.respawns;
  const c = new Bot({ at: [120, 40] });
  c.until(() => c.col >= 127.5, ['right'], 4);
  c.frame(['right', 'jump'], ['jump']);
  const jump = c.until(() => c.landed(), ['right', 'jump'], 2) && c.stands(135, 139, 40) && !c.respawns;
  return { ok: walk && jump, detail: `walking across: ${b.where()} in ${b.t.toFixed(1)}s; jumping the grates: ${c.where()}` };
});

check('C  checkpoint 2 (137,39) activates', () => {
  const b = new Bot({ at: [135, 40] });
  const ok = b.until(() => atCheckpoint(b, 137, 39), ['right'], 2);
  return { ok, detail: ok ? `saved at ${b.where()}` : `not activated, ${b.where()}` };
});

check('D  stop in the steam column (144-146) -> rise -> drift onto ledge 1 (147-153,28)', () => {
  const b = new Bot({ at: [138, 40] });
  b.until(() => b.col >= 145, ['right'], 2);
  const rose = b.until(() => b.row <= 26, [], 4);
  const ok = rose && b.until(() => b.landed(), ['right'], 2) && b.stands(147, 153, 28) && !b.hurts;
  // running straight through the 3-tile column does not lift you: you have to stop in it
  const c = new Bot({ at: [138, 40] });
  c.until(() => c.col >= 155, ['right'], 3);
  return { ok, detail: `${b.where()}; (running through without stopping lands back on the floor at ${c.where()})` };
});

check('D  spring (152,27) + Ember Wings -> catwalk 2 (150-167,22)', () => {
  let good = 0;
  const tries: string[] = [];
  for (const dj of [0.1, 0.2, 0.3, 0.4, 0.5, 0.6])
    for (const steer of [0, 0.3]) {
      const b = new Bot({ at: [149, 28] });
      b.until(() => b.p.vy < -150, ['right'], 2); // launched by the spring
      const t0 = b.t;
      b.until(() => b.t - t0 >= dj, [], 1);
      b.run(0.25, steer ? ['jump', 'right'] : ['jump'], ['jump']);
      b.run(steer, ['right']);
      const ok = b.until(() => b.landed(), [], 2) && b.stands(150, 167, 22) && !b.hurts;
      if (ok) good++;
      tries.push(ok ? '+' : '-');
    }
  const spring = new Bot({ at: [149, 28] });
  spring.until(() => spring.p.vy < -150, ['right'], 2);
  let top = 999;
  spring.until(() => (top = Math.min(top, spring.p.bottom)) > 0 && spring.p.vy > 0, [], 2);
  return {
    ok: good > 0,
    detail: `${ratio(good, 12)} wing timings land (${tries.join('')}); the spring alone peaks at row ${(top / 8).toFixed(2)}, catwalk top is row 22`,
    tight: good < 4 ? `${good}/12 timings` : undefined,
  };
});

check('D  catwalk 2 -> crusher gallery floor (168+,15): jump + wings + dash', () =>
  reach([166, 22], [168, 180, 15], { useDash: true, dirs: [1] }),
);

check('D  catwalk 2 -> crusher gallery: wall-jump the chimney (pillar 163 / wall 168), no dash', () => {
  const b = new Bot({ at: [160, 22] });
  b.until(() => b.col >= 165, ['right'], 2);
  let dir: 1 | -1 = 1;
  let last = -1;
  const ok = b.until(
    () => b.stands(168, 195, 15),
    () => {
      const p = b.p;
      const onR = p.collideAt(p.x + 3, p.y);
      const onL = p.collideAt(p.x - 3, p.y);
      if (p.bottom <= 15 * 8) dir = 1;
      else if (p.onGround() && b.t - last > 0.2) {
        last = b.t;
        b.queue('jump');
      } else if ((onR || onL) && p.vy > -30 && b.t - last > 0.12) {
        last = b.t;
        dir = onR ? -1 : 1;
        b.queue('jump');
      }
      return [dir > 0 ? 'right' : 'left', 'jump'];
    },
    8,
  );
  return { ok: ok && !b.hurts, detail: `${b.where()} after ${b.t.toFixed(1)}s` };
});

check('E  checkpoint 3 (170,14) activates on arrival in the gallery', () => {
  const b = new Bot({ at: [168, 15] });
  const ok = b.until(() => atCheckpoint(b, 170, 14), ['right'], 2);
  return { ok, detail: ok ? `saved at ${b.where()}` : `not activated, ${b.where()}` };
});

check('E  three presses (174-176, 180-182, 186-188): wait in the gaps for each to rise (20 phases)', () => {
  let good = 0;
  let naiveHit = 0;
  for (let k = 0; k < 20; k++) {
    const b = new Bot({ at: [171, 15] });
    b.run(k * 0.15);
    let ok = true;
    for (const pr of b.ents('Press').sort((a, z) => a.x - z.x)) {
      ok &&= b.until(() => b.col >= pr.x / 8 - 1.2, ['right'], 3);
      ok &&= b.until(() => pr.t % 3 >= 2.25 && pr.t % 3 < 2.4, [], 4); // just started to grind back up
      ok &&= b.until(() => b.col >= pr.right / 8 + 0.8, ['right'], 2);
    }
    ok &&= b.until(() => b.col >= 193, ['right'], 2);
    if (ok && !b.hurts) good++;
    const n2 = new Bot({ at: [171, 15] });
    n2.run(k * 0.15);
    n2.until(() => n2.col >= 193, ['right'], 4);
    if (n2.hurts) naiveHit++;
  }
  return { ok: good === 20, detail: `${ratio(good, 20)} phases safe when waiting; a blind run-through gets crushed in ${ratio(naiveHit, 20)}` };
});

check('E2 walk off the gallery edge (195,15) -> catwalk (197-204,23)', () => {
  const b = new Bot({ at: [192, 15] });
  const ok = b.until(() => b.landed() && b.row > 15.5, ['right'], 3) && b.stands(197, 204, 23) && !b.hurts;
  // a running jump off the edge overshoots the catwalk, but lands on crane 2 / the smithy floor
  let safe = 0;
  for (let k = 0; k < 10; k++) {
    const c = new Bot({ at: [190, 15] });
    c.run(k * 0.5);
    c.until(() => c.col >= 195.3, ['right'], 2);
    c.frame(['right', 'jump'], ['jump']);
    c.until(() => c.landed(), ['right', 'jump'], 3);
    if (!c.respawns && !c.hurts) safe++;
  }
  return { ok, detail: `${b.where()}; a held running jump off the edge lands safely (crane 2 / smithy) in ${ratio(safe, 10)} phases` };
});

check('E2 catwalk -> crane 1 (205-207) -> crane 2 (210-212) -> smithy floor (215+,40), 20 phases', () => {
  let good = 0;
  let last = '';
  for (let k = 0; k < 20; k++) {
    const b = new Bot({ at: [203, 23] });
    b.run(k * 0.25);
    const [k1, k2] = pitCranes(b);
    const step = (hold: number) => {
      b.until(() => !b.ground, ['right'], 2);
      b.run(hold, ['right']);
      return b.until(() => b.landed(), [], 3);
    };
    const s1 = step(8 / 60) && b.rides(k1);
    const s2 = s1 && step(8 / 60) && b.rides(k2);
    const s3 = s2 && b.until(() => b.landed() && b.col > 214.5, ['right'], 3) && b.stands(215, 235, 40);
    if (s3 && !b.hurts && !b.respawns) good++;
    else last = `phase ${k}: ${!s1 ? 'missed crane 1' : !s2 ? 'missed crane 2' : 'missed the smithy'} ${b.where()}`;
  }
  const direct = reach([204, 23], [215, 230, 40], { useDash: true, dirs: [1] });
  return { ok: good === 20, detail: `${ratio(good, 20)} phases by stepping off each crane; direct leap catwalk->smithy: ${direct.detail}${last ? `; ${last}` : ''}` };
});

check('F  checkpoint 4 (231,39) activates', () => {
  const b = new Bot({ at: [216, 40] });
  const ok = b.until(() => atCheckpoint(b, 231, 39), ['right'], 3);
  return { ok, detail: ok ? `saved at ${b.where()}` : `not activated, ${b.where()}` };
});

let fight: Bot | null = null;
check("G  enter the Warden's arena: it wakes, both gates (236/275, rows 37-39) close, no way out", () => {
  const b = new Bot({ spawn: { kind: 'checkpoint', id: cpId(231, 39) }, enemies: true });
  const w = warden(b);
  if (!w) return { ok: false, detail: 'no Warden entity in the arena' };
  const woke = b.until(() => w.st !== 'dormant', ['right'], 6);
  const gates = [236, 275].every((x) => [37, 38, 39].every((y) => b.world.map.get(x, y) === T.Gate));
  b.until(() => false, () => ((b.profile.hp = b.profile.maxHp), ['left']), 2.5);
  const sealed = b.p.x >= 237 * 8;
  fight = b;
  return { ok: woke && gates && sealed && !!b.world.arena, detail: `woke=${woke} at ${b.where()}, gates closed=${gates}, camera locked=${!!b.world.arena}, still inside after running left=${sealed}` };
});

check('G  fight it (slash bot, health pinned): Warden falls -> boss flag, gates open, camera unlocked', () => {
  const b = fight;
  if (!b) return { ok: false, detail: 'arena check failed' };
  const w = warden(b);
  let swings = 0;
  for (let i = 0; i < 60 * 150 && w.st !== 'dying' && !w.removed; i++) {
    b.profile.hp = b.profile.maxHp;
    const dx = w.cx - b.p.cx;
    const held: Act[] = Math.abs(dx) > 26 ? [dx > 0 ? 'right' : 'left'] : Math.abs(dx) < 14 ? [dx > 0 ? 'left' : 'right'] : [];
    let press: Act[] = [];
    if (Math.abs(dx) <= 34 && i % 18 === 0) {
      held.length = 0;
      held.push(dx > 0 ? 'right' : 'left');
      press = ['attack'];
      swings++;
    }
    b.frame(held, press);
  }
  const t0 = b.t;
  const done = b.until(() => b.world.hasFlag('boss:foundry'), [], 6);
  const open = [236, 275].every((x) => [37, 38, 39].every((y) => b.world.map.get(x, y) === T.GateOpen));
  return {
    ok: done && open && !b.world.arena,
    detail: `${swings} swings, Warden hp ${w.hp}, flag after ${(b.t - t0).toFixed(1)}s=${done}, gates open=${open}, camera unlocked=${!b.world.arena}`,
  };
});

check('H  walk on to the sector lantern (290,39) and relight it', () => {
  const b = fight;
  if (!b || !b.world.hasFlag('boss:foundry')) return { ok: false, detail: 'boss not beaten' };
  const there = b.until(() => b.col >= 290 && b.ground, ['right'], 10);
  b.frame([], ['up']);
  b.run(2.5);
  const lit = b.world.hasFlag('goal:foundry');
  return { ok: there && lit, detail: `${b.where()}, goal:foundry=${lit}` };
});

check('H  later visit (boss flag set): smithy -> arena (wreck, open gates) -> lantern', () => {
  const b = new Bot({ spawn: { kind: 'checkpoint', id: cpId(231, 39) }, enemies: true, flags: { 'boss:foundry': true } });
  const there = b.until(() => b.col >= 290 && b.ground, ['right'], 10);
  b.frame([], ['up']);
  b.run(2.5);
  return { ok: there && b.world.hasFlag('goal:foundry') && !b.hurts, detail: `${b.where()}, goal:foundry=${b.world.hasFlag('goal:foundry')}` };
});

// =====================================================================================================
head('CHECKPOINT RESPAWNS (continue from each lantern)');

check('C1 respawn (86,39) -> across belt 1 and its trench to (106+,40)', () => {
  const b = new Bot({ spawn: { kind: 'checkpoint', id: cpId(86, 39) } });
  b.until(() => b.col >= 100.5, ['right'], 3);
  b.frame(['right', 'jump'], ['jump']);
  const ok = b.until(() => b.landed(), ['right', 'jump'], 2) && b.stands(106, 112, 40) && !b.respawns;
  return { ok, detail: b.where() };
});

check('C2 respawn (137,39) -> steam column -> ledge 1', () => {
  const b = new Bot({ spawn: { kind: 'checkpoint', id: cpId(137, 39) } });
  b.until(() => b.col >= 145, ['right'], 2);
  b.until(() => b.row <= 26, [], 4);
  const ok = b.until(() => b.landed(), ['right'], 2) && b.stands(147, 153, 28);
  return { ok, detail: b.where() };
});

check('C3 respawn (170,14) -> safely past the first press', () => {
  const b = new Bot({ spawn: { kind: 'checkpoint', id: cpId(170, 14) } });
  const pr = b.ents('Press').sort((a, z) => a.x - z.x)[0];
  b.until(() => b.col >= pr.x / 8 - 1.2, ['right'], 3);
  b.until(() => pr.t % 3 >= 2.25 && pr.t % 3 < 2.4, [], 4);
  const ok = b.until(() => b.col >= 178, ['right'], 2) && b.stands(177, 179, 15) && !b.hurts;
  return { ok, detail: b.where() };
});

check('C4 respawn (231,39) -> into the arena (the Warden wakes)', () => {
  const b = new Bot({ spawn: { kind: 'checkpoint', id: cpId(231, 39) }, enemies: true });
  const ok = b.until(() => warden(b)?.st !== 'dormant', ['right'], 6);
  return { ok, detail: b.where() };
});

// =====================================================================================================
head('OPTIONAL REWARDS');

check('souls (67,34) and (79,34) are picked up while riding the river cranes', () => {
  const b = new Bot({ at: [63, 40] });
  const [c1, c2] = riverCranes(b);
  b.until(() => c1.x <= 64 * 8 + 1 && c1.vx >= 0, [], 6);
  b.run(0.25, ['right', 'jump'], ['jump']);
  b.until(() => b.landed(), ['jump'], 1.5);
  b.until(() => c1.x >= 69 * 8 - 1, [], 6);
  b.until(() => b.stands(72, 74, 38), ['right'], 1.5);
  b.run(0.1);
  b.until(() => c2.x <= 75 * 8 + 1 && c2.vx >= 0, [], 7);
  b.run(0.15, ['right', 'jump'], ['jump']);
  b.until(() => b.landed(), [], 1.5);
  b.until(() => c2.x >= 81 * 8 - 1, [], 7);
  const got = ['67,34', '79,34'].filter((k) => b.world.hasFlag(`soul:foundry:${k}`));
  return { ok: got.length === 2, detail: `collected ${got.join(' ') || 'none'}` };
});

check('high catwalk (70-76,33) from the island: 3 souls (71/73/75,32)', () => {
  const r = brute(() => new Bot({ at: [73, 38] }), plans({ dirs: [-1, 0, 1], steers: [0, 0.1, 0.2, 9] }), (b) => b.stands(70, 76, 33));
  const b = new Bot({ at: [73, 38] });
  execPlan(b, { dir: 0, run: 0, hold: 0.2, steer: 0, dj: 0.2, dash: null, dashDir: [0, 0] });
  b.run(0.5);
  const got = ['71,32', '73,32', '75,32'].filter((k) => b.world.hasFlag(`soul:foundry:${k}`));
  return {
    ok: r.wins > 0 && got.length === 3,
    detail: `${r.wins}/${r.tried} plans land on it; standing jump + wings collects ${got.length}/3`,
    tight: r.wins / r.tried < 0.03 ? `${r.wins}/${r.tried}` : undefined,
  };
});

check('secret 1: ledge (140-143,27) -> break the cracked wall (139,24-26) -> wooden heart + 2 souls -> back out', () => {
  const b = new Bot({ at: [145, 40] });
  b.until(() => b.row <= 25.5, [], 4);
  const onLedge = b.until(() => b.landed(), ['left'], 2) && b.stands(140, 143, 27);
  b.until(() => b.p.x <= 140 * 8, ['left'], 2);
  for (let i = 0; i < 3; i++) b.run(0.35, ['left'], ['attack']);
  const broken = [24, 25, 26].every((y) => b.world.map.get(139, y) === T.Empty);
  b.until(() => b.col <= 136.6, ['left'], 2);
  b.run(0.6);
  const heart = b.profile.maxHp === 6;
  const souls = ['136,26', '138,26'].filter((k) => b.world.hasFlag(`soul:foundry:${k}`)).length;
  const out = b.until(() => b.stands(140, 167, 40), ['right'], 5);
  return { ok: onLedge && broken && heart && souls === 2 && out, detail: `ledge=${onLedge} wall broken=${broken} heart=${heart} souls=${souls}/2, back on the stack floor=${out} ${b.where()}` };
});

check('soul (158,21) on catwalk 2', () => {
  const b = new Bot({ at: [152, 22] });
  b.until(() => b.col >= 160, ['right'], 2);
  return { ok: b.world.hasFlag('soul:foundry:158,21'), detail: b.where() };
});

check("secret 2: catwalk -> ledge (196-199,33) -> break the cracked wall (195,30-32) -> stokers' cubby, 3 souls", () => {
  const b = new Bot({ at: [199, 23] });
  const ledge = b.until(() => b.landed() && b.row > 23.5, ['left'], 3) && b.stands(196, 199, 33);
  b.until(() => b.p.x <= 196 * 8, ['left'], 2);
  for (let i = 0; i < 3; i++) b.run(0.35, ['left'], ['attack']);
  const broken = [30, 31, 32].every((y) => b.world.map.get(195, y) === T.Empty);
  b.until(() => b.col <= 186.6, ['left'], 3);
  b.run(0.5);
  const souls = ['187,31', '192,31', '194,31'].filter((k) => b.world.hasFlag(`soul:foundry:${k}`)).length;
  const back = b.until(() => b.stands(196, 199, 33) && b.col >= 198.5, ['right'], 3);
  return { ok: ledge && broken && souls === 3 && back, detail: `ledge=${ledge} wall broken=${broken} souls=${souls}/3, back on the ledge=${back}` };
});

check('secret 2 exit: from the ledge (198,33) back onto a crane / the catwalk / the smithy at every crane phase', () => {
  const goal = (b: Bot) => pitCranes(b).some((c) => b.rides(c)) || b.stands(197, 204, 23) || b.stands(215, 235, 40);
  const per: string[] = [];
  let worst = Infinity;
  let tried = 0;
  for (let k = 0; k < 10; k++) {
    const r = brute(
      () => {
        const b = new Bot({ at: [198, 33] });
        b.run(k * 0.5);
        return b;
      },
      plans({ dirs: [1], runs: [0, 0.15], holds: [0.1, 0.4], steers: [0.2, 0.4, 9], djs: [null, 0.2, 0.4], dashes: [null, 0.25], dashDirs: [[1, 0], [1, -1], [0, -1]] }),
      goal,
    );
    per.push(`${r.wins}`);
    worst = Math.min(worst, r.wins);
    tried = r.tried;
  }
  return { ok: worst > 0, detail: `winning plans per crane phase (of ${tried}): ${per.join(' ')}`, tight: worst < 5 ? `worst phase ${worst}/${tried}` : undefined };
});

check('souls (206,22) at the catwalk end and (212,18) high over crane 2', () => {
  const b = new Bot({ at: [200, 23] });
  b.until(() => b.col >= 204.3, ['right'], 1);
  b.run(0.3);
  const near = b.world.hasFlag('soul:foundry:206,22');
  const r = brute(
    () => new Bot({ at: [203, 23] }),
    plans({ dirs: [1], runs: [0, 0.1], steers: [0.2, 0.4, 9], djs: [null, 0.2, 0.35], dashes: [null, 0.3], dashDirs: [[1, -1], [0, -1]] }),
    (c) => c.world.hasFlag('soul:foundry:212,18'),
  );
  return { ok: near && r.wins > 0, detail: `(206,22) by walking to the catwalk end=${near}; (212,18) and a safe landing: ${r.wins}/${r.tried} plans` };
});

check('Cinder (280,39): after the Warden, talk to free it -> 12 souls', () => {
  const b = new Bot({ spawn: { kind: 'checkpoint', id: cpId(231, 39) }, flags: { 'boss:foundry': true } });
  b.until(() => b.col >= 279.6, ['right'], 8);
  const s0 = b.profile.souls;
  b.run(0.1);
  b.frame([], ['up']);
  b.run(3);
  return { ok: b.world.hasFlag('foundry:cinder') && b.profile.souls - s0 >= 12, detail: `freed=${b.world.hasFlag('foundry:cinder')}, souls +${b.profile.souls - s0}` };
});

// =====================================================================================================
head('PITS & ESCAPES (fall in -> hazard respawn -> respawn spot must be stable: idle 4 s)');

function pit(name: string, at: Spot, fall: (b: Bot) => void) {
  check(name, () => {
    const b = new Bot({ at });
    fall(b);
    if (!b.respawns) return { ok: false, detail: `never fell in: ${b.where()}` };
    b.until(() => b.p.state === 'normal', [], 2);
    const spot = b.where();
    const r0 = b.respawns;
    b.run(4);
    const extra = b.respawns - r0;
    return { ok: extra === 0 && b.ground, detail: `respawned at ${spot}; ${extra} more respawn(s) while idle${extra ? ' — RESPAWN LOOP' : ''}` };
  });
}
const walkIn = (dir: Act) => (b: Bot) => void b.until(() => b.respawns > 0, [dir], 4);
pit('slag trench 42-44 (walk in)', [40, 40], walkIn('right'));
pit('slag trench 54-57 (walk in)', [52, 40], walkIn('right'));
pit('slag river (walk in from the bank)', [62, 40], walkIn('right'));
pit('slag river (walk off the island)', [73, 38], walkIn('right'));
pit('slag trench 102-105 (stand still on belt 1)', [97, 40], (b) => void b.until(() => b.respawns > 0, [], 4));
pit('slag trench 102-105 (short hop from the end of belt 1)', [99, 40], (b) => {
  b.until(() => b.p.right >= 815, ['right'], 2);
  b.frame(['right', 'jump'], ['jump']);
  b.until(() => b.respawns > 0, ['right'], 3);
});
pit('slag under the rusted grates (stop on them)', [126, 40], (b) => {
  b.until(() => b.col >= 131, ['right'], 3);
  b.until(() => b.respawns > 0, [], 3);
});
pit('crucible slag (walk off the cubby ledge)', [198, 33], walkIn('right'));
pit('crucible slag (walk back off the smithy edge)', [217, 40], walkIn('left'));

check('steam stack floor (no hazard below the ledges): from every floor column back up to ledge 1', () => {
  const bad: number[] = [];
  for (const c of [140, 143, 147, 151, 155, 159, 163, 167]) {
    const b = new Bot({ at: [c, 40] });
    const dir: Act = c < 145 ? 'right' : 'left';
    b.until(() => b.col >= 144.6 && b.col <= 146, [dir], 3);
    b.until(() => b.row <= 26, [], 4);
    if (!(b.until(() => b.landed(), ['right'], 2) && b.stands(147, 153, 28))) bad.push(c);
  }
  return { ok: !bad.length, detail: bad.length ? `stuck from columns ${bad.join(' ')}` : 'all 8 columns get back up' };
});

check('containment: no wall-climbing out of the open yard onto the roof of the map (y < 0)', () => {
  const out: string[] = [];
  for (const [label, x, side] of [
    ['west face of the hall block (col 36)', 36 * 8 - 8, 1],
    ['left map wall (col 1)', 16, -1],
  ] as const) {
    const b = new Bot({ at: [label.includes('36') ? 35 : 2, 32] }); // already sliding on the wall above the doorway
    b.p.x = x;
    const toward: Act = side > 0 ? 'right' : 'left';
    let last = -1;
    const up = b.until(
      () => b.ground && b.p.bottom <= 0,
      () => {
        const p = b.p;
        if ((p.onGround() && b.t - last > 0.25) || (p.collideAt(p.x + side * 3, p.y) && p.vy > -40 && b.t - last > 0.1)) {
          last = b.t;
          b.queue('jump');
        }
        return [toward, 'jump'];
      },
      45,
    );
    if (up) {
      const far = label.includes('36') && b.until(() => b.col >= 290, ['right'], 40);
      out.push(`${label}: stands on the roof at ${b.where()}${far ? ', walks along it to col 290 off-screen' : ''}`);
    }
  }
  return { ok: !out.length, detail: out.length ? out.join('; ') : 'both walls are capped' };
});

// =====================================================================================================
// a sanity anchor for runPlan itself (the sim's single-plan runner): a plain running jump over trench 42-44
check('sim sanity: runPlan running jump over trench 42-44 lands on (45..53,40)', () => {
  const r = runPlan(def, [41, 40], { dir: 1, run: 0.2, hold: 0.2, dj: null, dash: null, dashDir: [0, 0] }, { abilities: { ...BOTH } });
  return { ok: r.onGround && !r.hurt && r.x >= 45 && r.x <= 54 && r.y === 40, detail: `landed (${r.x.toFixed(1)}, ${r.y})` };
});

const bad = results.filter((r) => !r.r.ok);
const tight = results.filter((r) => r.r.ok && r.r.tight);
console.log('');
for (const r of bad) console.log(`FAILED ${r.id} ${r.name}: ${r.r.detail}`);
for (const r of tight) console.log(`TIGHT  ${r.id} ${r.name}: ${r.r.tight}`);
console.log(`ROUTE: ${results.length - bad.length}/${results.length} hops OK`);
process.exit(bad.length ? 1 : 0);
