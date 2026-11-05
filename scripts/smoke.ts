/**
 * Crash test for a world: from every spawn point (station, start, each checkpoint) run the real
 * game — update AND draw — for a while with random button mashing, and report:
 *   exceptions (with stack), NaN positions, missing sprite frames/anims, entities that fell out of
 *   the map, runaway entity counts, and the average cost of a simulation tick.
 *
 *   npx tsx scripts/smoke.ts <worldId> [secondsPerSpawn=30]
 */
import { getSheet } from '../src/engine/sprites';
import { type Act, loadWorldDef, makeRenderer, makeWorld } from './sim';

const [id, secs = '30'] = process.argv.slice(2);
if (!id) {
  console.log('usage: npx tsx scripts/smoke.ts <worldId> [secondsPerSpawn]');
  process.exit(1);
}
const def = await loadWorldDef(id);
const r = makeRenderer();
r.setPalette(def.palette);

const problems = new Map<string, number>();
const note = (msg: string) => problems.set(msg, (problems.get(msg) ?? 0) + 1);

// validate every sprite call against the sheet definitions
const sprite = r.sprite.bind(r);
r.sprite = (sheet, frame, x, y, o) => {
  try {
    if (!getSheet(sheet).frames[frame]) note(`missing frame '${frame}' in sheet '${sheet}'`);
  } catch {
    note(`unknown sprite sheet '${sheet}'`);
    return;
  }
  sprite(sheet, frame, x, y, o);
};

let seed = 12345;
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const KEYS: Act[] = ['left', 'right', 'up', 'down', 'jump', 'attack', 'dash'];

const probe = makeWorld(def);
const spots = [...probe.world.spawns.keys()];
let ticks = 0;
let ms = 0;
for (const key of spots) {
  const spawn = key === 'start' || key === 'station' ? { kind: key } : { kind: 'checkpoint' as const, id: key };
  const { world, input, profile } = makeWorld(def, { enemies: true, spawn: spawn as never });
  profile.hp = profile.maxHp = 99;
  let held = new Set<Act>();
  for (let i = 0; i < Number(secs) * 60; i++) {
    if (i % 12 === 0) held = new Set(KEYS.filter((k) => rnd() < (k === 'left' || k === 'right' ? 0.45 : 0.25)));
    input.held = held;
    input.now = new Set(KEYS.filter((k) => held.has(k) && rnd() < 0.3));
    const t0 = performance.now();
    try {
      world.update(1 / 60);
      if (i % 6 === 0) world.draw(r);
    } catch (e) {
      note(`exception from '${key}': ${(e as Error).stack?.split('\n').slice(0, 4).join(' | ')}`);
      break;
    }
    ms += performance.now() - t0;
    ticks++;
    if (profile.hp < 10) profile.hp = 99;
    if (i % 60 === 0) {
      for (const e of [...world.entities, world.player]) {
        const kind = e.constructor.name;
        if (!Number.isFinite(e.x) || !Number.isFinite(e.y) || !Number.isFinite(e.vx) || !Number.isFinite(e.vy))
          note(`non-finite position/velocity on ${kind}`);
        if (e !== world.player && e.y > world.map.ph + 64) note(`${kind} fell out of the map (not removed)`);
      }
      if (world.entities.length > 1500) note(`entity count ran away (${world.entities.length})`);
    }
  }
}
console.log(`${id}: ${spots.length} spawn points × ${secs}s, avg ${(ms / Math.max(1, ticks)).toFixed(3)} ms/tick (update + 1/6 draw)`);
if (!problems.size) console.log('OK — no problems found');
else for (const [msg, n] of problems) console.log(`PROBLEM (${n}x): ${msg}`);
process.exit(problems.size ? 1 : 0);
