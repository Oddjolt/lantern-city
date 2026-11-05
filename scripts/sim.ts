/**
 * Headless playtesting with the real engine: World + Player physics (and drawing, into a stub
 * canvas) driven by scripted input — no browser. Adapted from the Catacombs agent's harness.
 *
 *   import { loadWorldDef, canReach } from './sim';
 *   const def = await loadWorldDef('catacombs');
 *   canReach(def, 'first gap', [12, 40], [20, 26, 40], { useDash: true });
 *
 * Coordinates are tiles: `from` = [column, floorRow] (the solid row the player stands on),
 * `to` = [firstColumn, lastColumn, floorRow] of the landing area.
 */
import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

// ---- minimal DOM so the renderer and sprite baking run in Node -------------------------------
const noop = () => {};
const ctxStub: Record<string, unknown> = new Proxy(
  {},
  {
    get: (_t, k) => {
      if (k === 'createImageData' || k === 'getImageData') {
        return (a: number | { width: number }, b?: number, c?: number, d?: number) => {
          const w = typeof a === 'number' ? (c ?? a) : a.width;
          const h = typeof a === 'number' ? (d ?? b ?? 1) : 1;
          return { data: new Uint8ClampedArray(Math.max(1, w * h * 4)), width: w, height: h };
        };
      }
      if (k === 'createPattern') return () => ({ setTransform: noop });
      return noop;
    },
    set: () => true,
  },
);
// A real canvas (@napi-rs/canvas, prebuilt) when installed, so frames can be rendered to PNG.
type Napi = typeof import('@napi-rs/canvas');
let napi: Napi | null = null;
try {
  napi = await import('@napi-rs/canvas');
} catch {
  /* fall back to the no-op canvas: physics and draw-call validation still work */
}
const stubCanvas = () => ({ width: 0, height: 0, style: {}, getContext: () => ctxStub });
const g = globalThis as Record<string, unknown>;
g.window ??= { addEventListener: noop };
g.location ??= { search: '' };
g.document ??= {
  createElement: () => (napi ? napi.createCanvas(1, 1) : stubCanvas()),
  body: { style: {} },
};
g.DOMMatrix ??= napi?.DOMMatrix ?? class {};
export const realCanvas = napi;

const { Enemy } = await import('../src/game/enemy');
const { newProfile } = await import('../src/game/profile');
await import('../src/game/common/index');
const { World } = await import('../src/game/world');
const { Renderer } = await import('../src/engine/renderer');
type WorldDef = import('../src/game/registry').WorldDef;
type SpawnPoint = import('../src/game/profile').SpawnPoint;
type WorldT = InstanceType<typeof World>;

export type Act = 'left' | 'right' | 'up' | 'down' | 'jump' | 'attack' | 'dash' | 'confirm' | 'back' | 'pause';

/** Stands in for engine/input: set `held` / `now` before each tick. */
export class FakeInput {
  held = new Set<Act>();
  now = new Set<Act>();
  down(a: Act) {
    return this.held.has(a) || this.now.has(a);
  }
  pressed(a: Act) {
    return this.now.has(a);
  }
  consume(a: Act) {
    this.now.delete(a);
  }
  get x() {
    return (this.down('right') ? 1 : 0) - (this.down('left') ? 1 : 0);
  }
  get y() {
    return (this.down('down') ? 1 : 0) - (this.down('up') ? 1 : 0);
  }
}

export interface SimOpts {
  flags?: Record<string, true>;
  abilities?: { dash: boolean; doubleJump: boolean };
  /** Keep enemies in the world (default false for reachability checks). */
  enemies?: boolean;
  spawn?: SpawnPoint;
}

/** Loads every world (like the game does, so cross-world entity kinds resolve) and returns one. */
export async function loadWorldDef(id: string): Promise<WorldDef> {
  const root = resolve('src/content/worlds');
  for (const dir of readdirSync(root)) {
    if (dir === id || !existsSync(resolve(root, dir, 'index.ts'))) continue;
    try {
      await import(resolve(root, dir, 'index.ts'));
    } catch (e) {
      console.warn(`(world ${dir} failed to load: ${(e as Error).message})`);
    }
  }
  return ((await import(resolve(root, id, 'index.ts'))) as { default: WorldDef }).default;
}

export function makeRenderer() {
  const canvas = napi ? napi.createCanvas(320, 180) : stubCanvas();
  return new Renderer(canvas as unknown as HTMLCanvasElement);
}

export function makeWorld(def: WorldDef, o: SimOpts = {}) {
  const input = new FakeInput();
  const profile = newProfile();
  profile.abilities = o.abilities ?? { dash: true, doubleJump: true };
  profile.flags = { ...(o.flags ?? {}) };
  const sounds = { play: noop, tone: noop, noise: noop, playSong: noop, ctx: null };
  const game = { input, profile, debug: false, fly: false, audio: sounds } as unknown as WorldT['game'];
  const world = new World(game, def, o.spawn ?? { kind: 'station' });
  world.ui = {
    say: (_s: string, _l: string[], done?: () => void) => done?.(),
    banner: noop,
    title: noop,
    travel: noop,
    died: noop,
    boss: noop,
    ending: noop,
    busy: false,
  };
  if (!o.enemies) world.entities = world.entities.filter((e) => !(e instanceof Enemy));
  return { world, input, profile };
}

export interface Plan {
  dir: -1 | 0 | 1;
  /** Seconds of running before the jump. */
  run: number;
  /** Seconds the jump button is held. */
  hold: number;
  /** Double jump at this many seconds after the jump (null = none). */
  dj: number | null;
  djHold?: number;
  /** Dash at this many seconds after the jump (null = none), in dashDir. */
  dash: number | null;
  dashDir: [number, number];
}

/** Run one input plan from a standing spot; reports where (in tiles) the player ends up. */
export function runPlan(def: WorldDef, from: [number, number], plan: Plan, o: SimOpts & { seconds?: number } = {}) {
  const { world, input } = makeWorld(def, o);
  const p = world.player;
  p.place(from[0] * 8 + 4, from[1] * 8);
  const dt = 1 / 60;
  world.update(dt);
  const hp0 = world.game.profile.hp;
  let t = 0;
  let jumped = false;
  let djDone = false;
  let dashDone = false;
  let airborne = false;
  let landedAt = -1;
  let hurt = false;
  for (let i = 0; i < (o.seconds ?? 2.2) * 60; i++) {
    input.now.clear();
    input.held.clear();
    if (!p.onGround() && p.state !== 'respawn') airborne = true;
    if (airborne && landedAt < 0 && p.onGround() && jumped) landedAt = t;
    if (landedAt >= 0) {
      world.update(dt);
      t += dt;
      if (p.state === 'respawn' || world.game.profile.hp < hp0) {
        hurt = true;
        break;
      }
      if (t - landedAt > 0.4) break;
      continue;
    }
    if (plan.dir !== 0) input.held.add(plan.dir > 0 ? 'right' : 'left');
    if (t >= plan.run && !jumped) {
      input.now.add('jump');
      jumped = true;
    }
    if (jumped && t < plan.run + plan.hold) input.held.add('jump');
    if (plan.dj !== null && !djDone && t >= plan.run + plan.dj) {
      input.now.add('jump');
      djDone = true;
    }
    if (djDone && plan.dj !== null && t < plan.run + plan.dj + (plan.djHold ?? 0.2)) input.held.add('jump');
    if (plan.dash !== null && !dashDone && t >= plan.run + plan.dash) {
      input.now.add('dash');
      dashDone = true;
      input.held.delete('left');
      input.held.delete('right');
      const [dx, dy] = plan.dashDir;
      if (dx > 0) input.held.add('right');
      if (dx < 0) input.held.add('left');
      if (dy < 0) input.held.add('up');
      if (dy > 0) input.held.add('down');
    }
    world.update(dt);
    t += dt;
    if (p.state === 'respawn' || world.game.profile.hp < hp0) {
      hurt = true;
      break;
    }
  }
  return { world, x: p.cx / 8, y: p.bottom / 8, onGround: p.onGround(), hurt };
}

export interface ReachResult {
  ok: boolean;
  /** Simplest move set that works: 'plain jump' | 'double-jump' | 'dash' | 'double-jump+dash'. */
  easiest?: string;
  plans: number;
  tried: number;
}

/** Brute-force simple jump/double-jump/dash plans from `from` and see if any lands in `to`. */
export function canReach(
  def: WorldDef,
  name: string,
  from: [number, number],
  to: [number, number, number],
  o: SimOpts & { dirs?: (-1 | 1)[]; useDJ?: boolean; useDash?: boolean; seconds?: number; quiet?: boolean } = {},
): ReachResult {
  const dirs = o.dirs ?? [1, -1];
  const runs = [0, 0.1, 0.2, 0.35];
  const holds = [0.05, 0.12, 0.2, 0.4];
  const djs: (number | null)[] = o.useDJ === false ? [null] : [null, 0.15, 0.3, 0.45, 0.6];
  const dashes: (number | null)[] = o.useDash ? [null, 0.1, 0.25, 0.4] : [null];
  const dashDirs: [number, number][] = [
    [1, 0],
    [-1, 0],
    [1, -1],
    [-1, -1],
    [0, -1],
  ];
  let tried = 0;
  const wins: string[] = [];
  for (const dir of dirs)
    for (const run of runs)
      for (const hold of holds)
        for (const dj of djs)
          for (const dash of dashes)
            for (const dd of dash === null ? [[0, 0] as [number, number]] : dashDirs) {
              if (dash !== null && dd[0] !== 0 && Math.sign(dd[0]) !== dir) continue;
              tried++;
              const r = runPlan(def, from, { dir, run, hold, dj, dash, dashDir: dd }, o);
              if (!r.hurt && r.onGround && r.x >= to[0] && r.x <= to[1] + 1 && Math.abs(r.y - to[2]) < 0.01)
                wins.push([dj !== null ? 'double-jump' : '', dash !== null ? 'dash' : ''].filter(Boolean).join('+') || 'plain jump');
            }
  const easiest = ['plain jump', 'double-jump', 'dash', 'double-jump+dash'].find((n) => wins.includes(n));
  if (!o.quiet)
    console.log(`${wins.length ? 'OK  ' : 'FAIL'} ${name}: ${wins.length}/${tried} plans land${easiest ? `; easiest: ${easiest}` : ''}`);
  return { ok: wins.length > 0, easiest, plans: wins.length, tried };
}
