/**
 * Route regression for Gloomroot Catacombs (world "catacombs").
 *
 *   npx tsx scripts/routes/catacombs.ts
 *
 * Proves, with the real engine and headless physics, that a player holding BOTH Spirit Dash and
 * Ember Wings (double jump) can get from the arrival station 'T' to the sector lantern 'E':
 * every hop of the main route in order, every stateful gate (braziers -> tomb doors), every
 * checkpoint (reached, activated, and a sane respawn point), every optional reward (soul cache,
 * skeleton shelf, hidden wooden heart, burial urns), and that every pit is either escapable or a
 * hazard that respawns you on safe ground (no dead end that needs a death).
 *
 * Coordinates are tiles: [col, floorRow] = standing on top of row floorRow; targets are
 * [firstCol, lastCol, floorRow]. Enemies are left out (reachability, not combat).
 *
 * Hops use sim.canReach (brute-forced jump / double-jump / dash plans that keep the direction held).
 * When that model is too narrow (straight-up jumps, walking off a ledge, releasing the stick in
 * mid-air, dropping through a one-way) or finds few plans, an extended search (`deepReach`) is run
 * and its numbers are printed too. A hop is flagged WARN (fragile) when the extended search finds
 * winning plans for under 1% of its plans; it is still OK. Wall-jump climbs, swimming, glowcaps,
 * bone bridges, braziers, tomb doors, cracked walls and the lantern are scripted bots on makeWorld.
 *
 * Ends with "ROUTE: N/M hops OK"; exit code 1 on any FAIL.
 */
import { type Act, canReach, loadWorldDef, makeWorld, runPlan, type SimOpts } from '../sim';
import { T } from '../../src/engine/tilemap';

const ID = 'catacombs';
const def = await loadWorldDef(ID);
/** Spirit Dash (Outskirts) + Ember Wings (Underworks): the player owns both in this world. */
const BOTH = { dash: true, doubleJump: true };
const DT = 1 / 60;
/** Profile flags as the route progresses (braziers lit, doors opened, walls broken…). */
const flags: Record<string, true> = {};

const KEY = {
  brazierCrypt: `brazier:${ID}:88,18`,
  doorCrypt: `door:${ID}:crypt`,
  brazier1: `brazier:${ID}:164,39`,
  brazier2: `brazier:${ID}:182,20`,
  brazier3: `brazier:${ID}:201,24`,
  doorHall: `door:${ID}:hall`,
  wallSouls: `wall:${ID}:62,28`,
  wallHeart: `wall:${ID}:158,13`,
  heart: `heart:${ID}:153,13`,
  goal: `goal:${ID}`,
  c1: `${ID}:96,29`,
  c2: `${ID}:157,28`,
  c3: `${ID}:230,12`,
  c4: `${ID}:275,20`,
};

// ---- bookkeeping -------------------------------------------------------------------------------

interface Result {
  section: string;
  name: string;
  ok: boolean;
  note: string;
  warn?: string;
}
const results: Result[] = [];
let section = '';
const t0 = Date.now();

function begin(s: string) {
  section = s;
  console.log(`\n== ${s}`);
}

function record(name: string, ok: boolean, note: string, warn?: string) {
  results.push({ section, name, ok, note, warn });
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}: ${note}${warn ? `\n     WARN ${warn}` : ''}`);
  return ok;
}

// ---- scripted bot on the real world --------------------------------------------------------------

class Bot {
  readonly world: ReturnType<typeof makeWorld>['world'];
  readonly input: ReturnType<typeof makeWorld>['input'];
  frames = 0;
  private hp0: number;

  constructor(o: SimOpts & { at?: [number, number]; px?: { x: number; y: number } } = {}) {
    const s = makeWorld(def, { abilities: BOTH, ...o, flags: { ...flags, ...(o.flags ?? {}) } });
    this.world = s.world;
    this.input = s.input;
    if (o.at) this.world.player.place(o.at[0] * 8 + 4, o.at[1] * 8);
    if (o.px) this.world.player.place(o.px.x, o.px.y);
    this.hp0 = this.world.game.profile.hp;
    this.tick();
  }

  get p() {
    return this.world.player;
  }
  get col() {
    return this.p.cx / 8;
  }
  get floor() {
    return this.p.bottom / 8;
  }
  get profile() {
    return this.world.game.profile;
  }
  get inWater() {
    return this.world.tileAt(this.p.cx, this.p.cy) === T.Water;
  }
  get headOut() {
    return this.world.tileAt(this.p.cx, this.p.y - 2) !== T.Water;
  }
  get standing() {
    return this.p.onGround() && this.p.state === 'normal';
  }

  tick(held: Act[] = [], pressed: Act[] = []) {
    this.input.held = new Set(held);
    this.input.now = new Set(pressed);
    this.world.update(DT);
    this.frames++;
  }

  hold(n: number, held: Act[] = [], pressed: Act[] = []) {
    for (let i = 0; i < n; i++) this.tick(held, i === 0 ? pressed : []);
  }

  until(cond: () => boolean, max: number, held: Act[] = [], pressed: Act[] = []) {
    for (let i = 0; i < max; i++) {
      if (cond()) return true;
      this.tick(held, i === 0 ? pressed : []);
    }
    return cond();
  }

  /** Walk until the player's centre passes `col` (tile units). */
  walkTo(col: number, max = 900) {
    const right = col > this.col;
    return this.until(() => (right ? this.col >= col : this.col <= col), max, [right ? 'right' : 'left']);
  }

  /** Face a direction and swing the stick once. */
  strike(face: 'left' | 'right') {
    this.hold(1, [face]);
    this.hold(20, [], ['attack']);
  }

  /** Wait (no input) until standing still on the ground. */
  settle(max = 180) {
    return this.until(() => this.standing && Math.abs(this.p.vx) < 1, max);
  }

  get damaged() {
    return this.profile.hp < this.hp0;
  }

  /** Copy route-relevant flags gained by this bot into the route state. */
  keepFlags() {
    const gained: string[] = [];
    for (const k of Object.keys(this.profile.flags))
      if (!flags[k]) {
        flags[k] = true;
        gained.push(k);
      }
    return gained;
  }

  where() {
    return `col ${this.col.toFixed(2)} floor ${this.floor.toFixed(2)}${this.inWater ? ' (in water)' : ''}`;
  }
}

// ---- extended plan search (stick release, straight-up jumps, walk-offs, drop-throughs) -----------

interface XPlan {
  d: -1 | 0 | 1;
  run: number; // frames of running before the jump
  hold: number; // frames the jump is held
  steer: number; // frames after take-off that `d` stays held, then `d2`
  d2: -1 | 0 | 1;
  dj: number | null; // frames after take-off: second jump press (double jump / wall jump)
  dash: number | null; // frames after take-off: dash
  dashDir: [number, number];
  walk?: boolean; // just walk in direction d (off a ledge)
  drop?: boolean; // ↓+jump through a one-way, then hold d2
}

function* xPlans(useDash: boolean, useDJ: boolean): Generator<XPlan> {
  for (const d of [-1, 1] as const) yield { d, run: 0, hold: 0, steer: Infinity, d2: d, dj: null, dash: null, dashDir: [0, 0], walk: true };
  for (const d2 of [0, -1, 1] as const) yield { d: 0, run: 0, hold: 0, steer: 0, d2, dj: null, dash: null, dashDir: [0, 0], drop: true };
  const dashDirs: [number, number][] = [
    [1, 0],
    [-1, 0],
    [1, -1],
    [-1, -1],
    [0, -1],
  ];
  for (const d of [-1, 0, 1] as const)
    for (const run of d === 0 ? [0] : [0, 8, 16, 24])
      for (const hold of [3, 8, 14, 24])
        for (const [steer, d2] of (d === 0
          ? [
              [Infinity, 0],
              [0, 1],
              [0, -1],
              [12, 1],
              [12, -1],
            ]
          : [
              [Infinity, d],
              [10, 0],
              [10, -d],
            ]) as [number, -1 | 0 | 1][])
          for (const dj of useDJ ? [null, 10, 20, 32] : [null])
            for (const dash of useDash ? [null, 8, 20] : [null])
              for (const dd of dash === null ? [[0, 0] as [number, number]] : dashDirs) {
                if (dash !== null && d !== 0 && dd[0] !== 0 && Math.sign(dd[0]) !== d) continue;
                yield { d, run, hold, steer, d2, dj, dash, dashDir: dd };
              }
}

function runX(from: [number, number], plan: XPlan, o: { flags?: Record<string, true>; maxFrames?: number } = {}) {
  const { world, input } = makeWorld(def, { abilities: BOTH, flags: { ...flags, ...(o.flags ?? {}) } });
  const p = world.player;
  p.place(from[0] * 8 + 4, from[1] * 8);
  world.update(DT);
  const hp0 = world.game.profile.hp;
  let jumpF = -1;
  let airborne = false;
  let landed = -1;
  let hurt = false;
  for (let f = 0; f < (o.maxFrames ?? 200); f++) {
    input.now.clear();
    input.held.clear();
    const ground = p.onGround();
    if (!ground && p.state !== 'respawn') airborne = true;
    if (airborne && landed < 0 && ground) landed = f;
    if (landed >= 0) {
      if (f - landed > 24) break;
    } else {
      const t = jumpF >= 0 ? f - jumpF : -1;
      let dir: number = plan.d;
      if (!plan.walk && t >= 0 && t >= plan.steer) dir = plan.d2;
      if (dir > 0) input.held.add('right');
      if (dir < 0) input.held.add('left');
      if (plan.drop) {
        if (f === 0) {
          input.held.add('down');
          input.now.add('jump');
          jumpF = 0;
        }
      } else if (!plan.walk && f >= plan.run && jumpF < 0) {
        input.now.add('jump');
        jumpF = f;
      }
      if (!plan.drop && jumpF >= 0 && f - jumpF < plan.hold) input.held.add('jump');
      if (t >= 0 && plan.dj !== null) {
        if (t === plan.dj) input.now.add('jump');
        if (t >= plan.dj && t < plan.dj + 12) input.held.add('jump');
      }
      if (t >= 0 && plan.dash !== null && t === plan.dash) {
        input.now.add('dash');
        input.held.delete('left');
        input.held.delete('right');
        const [dx, dy] = plan.dashDir;
        if (dx > 0) input.held.add('right');
        if (dx < 0) input.held.add('left');
        if (dy < 0) input.held.add('up');
      }
    }
    world.update(DT);
    if (p.state === 'respawn' || world.game.profile.hp < hp0) {
      hurt = true;
      break;
    }
  }
  return { x: p.cx / 8, y: p.bottom / 8, onGround: p.onGround(), hurt };
}

function deepReach(from: [number, number], to: [number, number, number], o: { useDash?: boolean; useDJ?: boolean; flags?: Record<string, true> } = {}) {
  let tried = 0;
  let wins = 0;
  const kinds = { plain: 0, dj: 0, dash: 0, both: 0, walk: 0 };
  for (const plan of xPlans(o.useDash ?? true, o.useDJ ?? true)) {
    tried++;
    const r = runX(from, plan, o);
    if (r.hurt || !r.onGround || r.x < to[0] || r.x > to[1] + 1 || Math.abs(r.y - to[2]) > 0.01) continue;
    wins++;
    if (plan.walk || plan.drop) kinds.walk++;
    else if (plan.dj !== null && plan.dash !== null) kinds.both++;
    else if (plan.dj !== null) kinds.dj++;
    else if (plan.dash !== null) kinds.dash++;
    else kinds.plain++;
  }
  return { wins, tried, kinds };
}

/** Fewer canReach plans than this triggers the extended search. */
const FEW_CANREACH = 40;
/** Extended-search success below this fraction is reported as fragile. */
const FRAGILE = 0.01;

interface HopOpts {
  /** Always run the extended search (moves canReach's model cannot express). */
  deep?: boolean;
  seconds?: number;
  extraFlags?: Record<string, true>;
  /** Restrict the move set (e.g. to prove a hop needs no dash). */
  useDash?: boolean;
  useDJ?: boolean;
}

/** One hop of the route: canReach first, then the extended search when needed. */
function hop(name: string, from: [number, number], to: [number, number, number], o: HopOpts = {}) {
  const fl = { ...flags, ...(o.extraFlags ?? {}) };
  const r = canReach(def, name, from, to, {
    useDash: o.useDash ?? true,
    useDJ: o.useDJ ?? true,
    abilities: BOTH,
    flags: fl,
    seconds: o.seconds,
    quiet: true,
  });
  let ok = r.ok;
  let note = `canReach ${r.plans}/${r.tried}${r.easiest ? ` (easiest: ${r.easiest})` : ''}`;
  let warn: string | undefined;
  if (o.deep || r.plans < FEW_CANREACH) {
    const d = deepReach(from, to, { useDash: o.useDash, useDJ: o.useDJ, flags: o.extraFlags });
    const k = d.kinds;
    note += `; extended ${d.wins}/${d.tried} (${((100 * d.wins) / d.tried).toFixed(1)}%: walk/drop ${k.walk}, jump ${k.plain}, +DJ ${k.dj}, +dash ${k.dash}, DJ+dash ${k.both})`;
    ok = ok || d.wins > 0;
    if (d.wins > 0 && d.wins / d.tried < FRAGILE) warn = `few winning plans (${d.wins}/${d.tried}) from [${from}] to [${to}]`;
  }
  return record(name, ok, note, warn);
}

/** Walk along a floor; must stay on `floor` and arrive at `col` unhurt. */
function walk(name: string, from: [number, number], col: number, floor = from[1], o: SimOpts = {}) {
  const b = new Bot({ at: from, ...o });
  const ok = b.walkTo(col) && b.settle() && Math.abs(b.floor - floor) < 0.01 && !b.damaged;
  record(name, ok, `${ok ? 'arrived' : 'stopped'} at ${b.where()}`);
  return b;
}

/** Checkpoint lantern: walking over it saves there (and it is a sane respawn point). */
function checkpoint(name: string, from: [number, number], cpCol: number, id: string) {
  const b = new Bot({ at: from });
  b.walkTo(cpCol + 0.5);
  b.hold(10);
  const saved = b.profile.spawn.kind === 'checkpoint' && b.profile.spawn.id === id;
  // a fresh world at that checkpoint (after a death) must put the player on solid ground there
  const r = new Bot({ spawn: { kind: 'checkpoint', id } });
  r.hold(30);
  const respawnOk = r.standing && Math.abs(r.col - (cpCol + 0.5)) < 1 && !r.damaged;
  record(name, saved && respawnOk, `saved=${saved}; respawn at ${r.where()}${respawnOk ? '' : ' (BAD)'}`);
}

/** Strike a brazier (or any slashable thing) from a standing spot. */
function strikeAt(name: string, at: [number, number], face: 'left' | 'right', expect: string[], after = 30) {
  const b = new Bot({ at });
  b.strike(face);
  b.hold(after);
  const gained = b.keepFlags();
  const ok = expect.every((k) => flags[k]);
  record(name, ok, `flags gained: ${gained.join(' ') || 'none'}`);
  return b;
}

/** Fall into a hazard on purpose: there must be a hazard respawn onto safe ground (not a dead end). */
function hazardRespawn(name: string, at: [number, number], act: (b: Bot) => void, safe: (b: Bot) => boolean) {
  const b = new Bot({ at });
  act(b);
  const hit = b.until(() => b.p.state === 'respawn', 240, []);
  b.until(() => b.p.state === 'normal', 120);
  b.settle();
  const ok = hit && b.standing && safe(b);
  record(name, ok, hit ? `hazard -> respawned at ${b.where()}` : `no hazard hit (ended at ${b.where()})`);
}

// =================================================================================================
// MAIN ROUTE
// =================================================================================================

begin('S1 Gloomroot Station');
{
  const b = new Bot();
  b.hold(30);
  record('arrive by train (station spawn)', b.standing && Math.abs(b.floor - 18) < 0.01 && !b.damaged, `standing at ${b.where()}`);
}
walk('walk east through the station hall', [2, 18], 34.5);
strikeAt('strike the first brazier (36,17) (lights the steps down)', [34, 18], 'right', [`brazier:${ID}:36,17`]);
hop('station hall -> ossuary shelf 1 (39..46,21)', [36, 18], [39, 46, 21]);
hop('shelf 1 -> shelf 2 (47..52,24)', [44, 21], [47, 52, 24]);
hop('shelf 2 -> shelf 3 (55..62,27) over the bone shards (53..54,24)', [50, 24], [55, 62, 27]);
hop('shelf 3 -> bone gallery floor (63..91,30)', [60, 27], [63, 91, 30]);

begin('S2 Ossuary Gallery: the crypt brazier and its tomb door');
{
  const b = new Bot({ at: [80, 30] });
  b.walkTo(91.5);
  b.hold(20);
  record('tomb door (92..93,26..29) is shut before its brazier burns', b.col < 92 && !flags[KEY.doorCrypt], `blocked at ${b.where()}`);
}
hop('gallery floor -> bone plank (80..83,27)', [77, 30], [80, 83, 27]);
hop('plank (80..83,27) -> plank (84..87,24)', [81, 27], [84, 87, 24]);
hop('plank (84..87,24) -> plank (80..83,21)', [86, 24], [80, 83, 21]);
hop('plank (80..83,21) -> brazier ledge (86..90,19)', [81, 21], [86, 90, 19]);
strikeAt('strike the crypt brazier (88,18)', [86, 19], 'right', [KEY.brazierCrypt, KEY.doorCrypt]);
{
  // after the strike: drop back down into the gallery and walk east through the risen door to C1
  const b = new Bot({ at: [87, 19] });
  b.until(() => !b.p.onGround(), 120, ['left']);
  b.settle();
  const down = b.where();
  const through = b.walkTo(97);
  b.hold(10);
  const saved = b.profile.spawn.kind === 'checkpoint' && b.profile.spawn.id === KEY.c1;
  record('drop from the ledge, walk through the open tomb door to C1 (96,29)', through && saved && !b.damaged, `landed ${down}; now ${b.where()}; C1 saved=${saved}`);
}
checkpoint('checkpoint C1 (96,29)', [94, 30], 96, KEY.c1);

begin('S3 Bile Cistern');
walk('C1 -> cistern entry ledge (99..103,30)', [96, 30], 101.5);
hop('entry ledge -> island I1 (107..109,34)', [102, 30], [107, 109, 34]);
{
  // what a player actually does here: just run off the ledge
  const b = new Bot({ at: [102, 30] });
  b.until(() => !b.p.onGround(), 60, ['right']);
  b.settle();
  record('entry ledge -> I1 by simply walking off', Math.abs(b.floor - 34) < 0.01 && b.col >= 107 && b.col <= 110 && !b.damaged, `landed ${b.where()}`);
}
hop('I1 -> I2 (114..115,34) over/across the bone bridge (110..113,34)', [108, 34], [114, 115, 34]);
{
  const b = new Bot({ at: [108, 34] });
  const ok = b.until(() => b.col >= 114.5, 120, ['right']) && (b.hold(3), b.standing) && !b.damaged;
  record('I1 -> I2 by running across the bone bridge (it holds while you keep moving)', ok, `now ${b.where()}`);
}
hop('I2 -> I3 (119..121,32)', [114, 34], [119, 121, 32]);
hop('I3 -> I4 (127..128,32) over the bone bridge (122..126,32)', [120, 32], [127, 128, 32]);
hop('I4 -> I5 (132..136,34)', [127, 32], [132, 136, 34]);
hop('I5 -> glowcap (135,33) -> exit ledge (138..155,29)', [134, 34], [138, 155, 29]);
{
  // the glowcap really is what lifts you: hop onto it and do nothing else
  const b = new Bot({ at: [133, 34] });
  b.hold(1, ['right', 'jump'], ['jump']);
  b.hold(6, ['right']);
  const bounced = b.until(() => b.p.vy < -200, 60, ['right']);
  const ok = bounced && b.until(() => b.standing && Math.abs(b.floor - 29) < 0.01, 180, ['right']);
  record('glowcap bounce (135,33) carries you onto the exit ledge without double jump/dash', ok, `${bounced ? 'bounced' : 'no bounce'}; now ${b.where()}`);
}
checkpoint('exit ledge -> checkpoint C2 (157,28)', [150, 29], 157, KEY.c2);

begin('S4 Brazier Hall: three braziers open the great tomb door');
hop('entry ledge L0 -> plank P3 (168..170,31)', [166, 29], [168, 170, 31], { deep: true });
hop('P3 -> hall floor under the entry (160..166,40)', [168, 31], [160, 166, 40], { deep: true });
strikeAt('strike brazier 1 (164,39) on the floor', [162, 40], 'right', [KEY.brazier1]);
hop('hall floor -> plank P1 (167..170,37)', [165, 40], [167, 170, 37]);
hop('P1 -> plank P2 (171..174,34)', [168, 37], [171, 174, 34]);
hop('P2 -> P3 (168..170,31)', [172, 34], [168, 170, 31]);
hop('P3 -> L0 (160..167,29)', [169, 31], [160, 167, 29]);
hop('L0 -> plank P4 (170..173,26)', [166, 29], [170, 173, 26]);
hop('P4 -> plank P5 (175..178,23)', [172, 26], [175, 178, 23]);
hop('P5 -> high platform (180..185,21)', [177, 23], [180, 185, 21]);
strikeAt('strike brazier 2 (182,20) on the high platform', [180, 21], 'right', [KEY.brazier2]);
hop('high platform -> bone bridges (190..193,23)', [184, 21], [190, 193, 23]);
hop('bone bridges -> east ledge (197..203,25)', [192, 23], [197, 203, 25]);
hop('high platform -> east ledge directly', [184, 21], [197, 203, 25]);
strikeAt('strike brazier 3 (201,24) on the east ledge -> the great tomb door wakes', [199, 25], 'right', [KEY.brazier3, KEY.doorHall], 60);
hop('east ledge -> plank (193..195,28)', [197, 25], [193, 195, 28], { deep: true });
hop('plank (193..195,28) -> plank (194..196,34)', [194, 28], [194, 196, 34], { deep: true });
hop('plank (194..196,34) -> hall floor by the door (190..203,40)', [196, 34], [190, 203, 40], { deep: true });
{
  const b = new Bot({ at: [200, 40] });
  const ok = b.walkTo(210) && b.settle() && Math.abs(b.floor - 40) < 0.01;
  record('walk east through the risen great tomb door (204..205,36..39)', ok, `now ${b.where()}`);
}

begin('S5 Root Chasm');
walk('door passage -> chasm floor (214..220,40)', [210, 40], 217.5);
hop('chasm floor -> root plank Q1 (219..223,37)', [217, 40], [219, 223, 37]);
hop('Q1 -> root plank Q2 (214..217,34)', [220, 37], [214, 217, 34]);
hop('Q2 -> root plank Q3 (220..225,31)', [216, 34], [220, 225, 31]);
{
  // Wall-jump climb of the 4-wide chimney (218..221, rows 20..28): jump, hold toward a wall, press
  // jump on contact (+0..4 frames late), switch walls. Plain wall jumps only: no double jump, no dash.
  let wins = 0;
  let tried = 0;
  let land = '';
  for (const start of [220, 221])
    for (const first of [-1, 1] as const)
      for (const late of [0, 1, 2, 3, 4])
        for (const hold of [8, 14, 20]) {
          if (start === 221 && first === 1) continue; // that is jumping out from under the east pillar
          tried++;
          const b = new Bot({ at: [start, 31] });
          let dir = first;
          let wait = -1;
          let jh = hold;
          let ok = false;
          for (let f = 0; f < 420 && !ok; f++) {
            const held: Act[] = [dir > 0 ? 'right' : 'left'];
            const pressed: Act[] = f === 0 ? ['jump'] : [];
            if (!b.p.onGround() && f > 2 && wait < 0 && b.p.collideAt(b.p.x + 3 * dir, b.p.y)) wait = late;
            if (wait === 0) {
              pressed.push('jump');
              jh = hold;
              dir = -dir as -1 | 1;
            }
            if (wait >= 0) wait--;
            if (jh-- > 0) held.push('jump');
            b.tick(held, pressed);
            if (b.standing && f > 10) {
              if (b.floor <= 21) ok = true;
              else if (f > 40) break;
            }
          }
          if (ok) {
            wins++;
            if (!land) land = b.where();
          }
        }
  record('wall-jump climb up the root chimney (218..221,20..28) from Q3', wins > 0, `${wins}/${tried} timings top out (first: ${land || '-'})`, wins > 0 && wins / tried < 0.5 ? `chimney climb works for only ${wins}/${tried} timings` : undefined);
}
hop('west pillar top (214..217,20) -> root plank (214..216,17)', [216, 20], [214, 216, 17]);
hop('root plank (214..216,17) -> root plank (218..221,14)', [215, 17], [218, 221, 14]);
hop('east pillar top (222..225,21) -> big glowcap (224,20) -> root plank (218..221,14)', [223, 21], [218, 221, 14]);
hop('root plank (218..221,14) -> crypt corridor (226..239,13)', [220, 14], [226, 239, 13]);
checkpoint('crypt corridor -> checkpoint C3 (230,12)', [227, 13], 230, KEY.c3);

begin('S6 Flooded Crypt');
walk('C3 -> ledge W1 east end (240..244,13)', [230, 13], 243.5);
hop('W1 -> ledge W2 (246..249,18)', [244, 13], [246, 249, 18]);

/** Swim from a spot to the way-out ledge (266..272,22): dive under both crypt walls, surface in the
 *  2-wide shaft (264..265), climb out. `exit` = how the player leaves the water. */
function swim(at: [number, number], exit: { stroke: number; dj: number | null; delay: number }, dive = true) {
  const b = new Bot({ at });
  if (dive) {
    b.until(() => b.inWater, 240, ['right']);
    b.until(() => b.p.x >= 264 * 8, 1200, ['right', 'down']);
  }
  let jumped = -1;
  let ok = false;
  for (let i = 0; i < 900 && !ok; i++) {
    const held: Act[] = ['right'];
    const pressed: Act[] = [];
    if (jumped < 0) {
      if (b.inWater && b.headOut) {
        if (exit.delay-- <= 0) {
          pressed.push('jump');
          held.push('jump');
          jumped = 0;
        }
      } else if (b.inWater && i % exit.stroke === 0) pressed.push('jump');
    } else {
      jumped++;
      if (jumped < 14) held.push('jump');
      if (exit.dj !== null && jumped === exit.dj) pressed.push('jump');
      if (exit.dj !== null && jumped > exit.dj && jumped < exit.dj + 12) held.push('jump');
      if (b.inWater && jumped > 20) jumped = -1; // fell back in: try again
    }
    b.tick(held, pressed);
    ok = b.standing && b.floor <= 22.01 && b.col >= 266;
  }
  return { ok, b };
}
{
  const r = swim([248, 18], { stroke: 10, dj: 15, delay: 0 });
  record('swim under both crypt walls (252..254 / 261..263) and climb out onto the way-out ledge (266..272,22)', r.ok && !r.b.damaged, `${r.b.frames} frames, now ${r.b.where()}`);
  // robustness of the climb-out: jump the moment the head is out, with Ember Wings at various times
  let w = 0;
  let n = 0;
  for (const stroke of [6, 10, 15]) for (const dj of [8, 12, 16, 20, 24]) (n++, (w += swim([248, 18], { stroke, dj, delay: 0 }).ok ? 1 : 0));
  record('climb out of the water with jump + Ember Wings (stroke rate x double-jump timing)', w > 0, `${w}/${n} succeed`, w < n ? `only ${w}/${n}` : undefined);
  // a single jump (no Ember Wings) pressed the moment the head clears the water
  let s = 0;
  for (const stroke of [6, 10, 15]) s += swim([248, 18], { stroke, dj: null, delay: 0 }).ok ? 1 : 0;
  // …and pressed a few frames later, once the body has risen with the stroke
  let s2 = 0;
  for (const delay of [3, 6, 9, 12]) s2 += swim([248, 18], { stroke: 10, dj: null, delay }).ok ? 1 : 0;
  record(
    'climb out with a single jump (no double jump)',
    true,
    `jump as soon as the head is out: ${s}/3; jump 3-12 frames later: ${s2}/4`,
    s === 0 ? 'a plain jump pressed as the head breaks the surface falls short of the way-out ledge (2 rows above the water); needs a later press, a wall kick or Ember Wings' : undefined,
  );
}
hop('way-out ledge -> C4 floor (273..278,21), one step up', [268, 22], [273, 278, 21]);
checkpoint('checkpoint C4 (275,20)', [273, 21], 275, KEY.c4);

begin('S7 Lantern Gauntlet');
hop('C4 -> bone bridges (279..283,22)', [277, 21], [279, 283, 22]);
hop('bone bridges -> root plank (286..288,20)', [282, 22], [286, 288, 20]);
hop('plank (286..288,20) -> landing (297..300,22) across the 8-tile bile gap', [287, 20], [297, 300, 22]);
hop('the 8-tile gap with Ember Wings only (no dash)', [287, 20], [297, 300, 22], { useDash: false });
hop('the 8-tile gap with Spirit Dash only (no double jump)', [287, 20], [297, 300, 22], { useDJ: false });
{
  const b = new Bot({ at: [298, 22] });
  b.walkTo(307.5);
  b.settle();
  b.hold(2, [], ['up']);
  b.hold(150);
  b.keepFlags();
  const lit = !!flags[KEY.goal];
  record('walk into the lantern chamber and relight the sector lantern E (308,21)', lit && !b.damaged, `goal flag ${lit}; unlocked ${b.profile.unlocked.join(',')}`);
}

// =================================================================================================
// OPTIONAL REWARDS
// =================================================================================================

begin('Optional: soul cache behind the cracked wall (62,28..29)');
{
  const b = new Bot({ at: [63, 30] });
  const s0 = b.profile.souls;
  for (let i = 0; i < 3; i++) b.strike('left');
  const broke = !!b.profile.flags[KEY.wallSouls];
  b.walkTo(57.5);
  b.hold(30);
  const got = b.profile.souls - s0;
  const out = b.walkTo(64) && b.settle();
  b.keepFlags();
  record('break the wall from the gallery, take 3 souls (58..60,29), walk back out', broke && got >= 3 && out, `wall broken=${broke}, souls +${got}, back at ${b.where()}`);
}

begin('Optional: the skeleton shelf souls (124,24) (128,24)');
hop('I3 -> root plank (119..121,28) straight above it', [120, 32], [119, 121, 28], { deep: true });
hop('root plank -> skeleton shelf (123..129,25)', [120, 28], [123, 129, 25]);
{
  const b = new Bot({ at: [123, 25] });
  const s0 = b.profile.souls;
  b.walkTo(129.5);
  b.hold(20);
  record('walk the shelf, take both souls', b.profile.souls - s0 >= 2, `souls +${b.profile.souls - s0}`);
}
hop('skeleton shelf -> back down to the islands (I3..I4, 119..128,32)', [128, 25], [119, 128, 32], { deep: true });

begin('Optional: the hidden wooden heart behind the hall\'s high west wall (158..159,13..14)');
hop('P5 (175..178,23) -> root plank (175..178,18) straight above', [177, 23], [175, 178, 18], { deep: true });
hop('high platform (180..185,21) -> root plank (175..178,18)', [180, 21], [175, 178, 18]);
hop('plank (175..178,18) -> plank (168..171,16)', [176, 18], [168, 171, 16]);
hop('plank (168..171,16) -> plank (161..165,15)', [169, 16], [161, 165, 15]);
{
  const b = new Bot({ at: [161, 15] });
  const hp = b.profile.maxHp;
  for (let i = 0; i < 3; i++) b.strike('left');
  const broke = !!b.profile.flags[KEY.wallHeart];
  b.walkTo(152.5);
  b.hold(30);
  const heart = b.profile.maxHp === hp + 1;
  const souls = b.profile.souls;
  const out = b.walkTo(162) && b.settle() && Math.abs(b.floor - 15) < 0.01;
  b.keepFlags();
  record('break the hollow wall, take the wooden heart (153,13) and souls (155..156,14), walk back out', broke && heart && souls >= 2 && out, `wall=${broke}, maxHp ${hp}->${b.profile.maxHp}, souls ${souls}, back at ${b.where()}`);
}

begin('Optional: burial urns (2 souls each)');
for (const [col, row, face] of [
  [66, 29, 'left'],
  [76, 29, 'left'],
  [161, 39, 'left'],
  [173, 39, 'right'],
  [192, 39, 'left'],
] as [number, number, 'left' | 'right'][]) {
  const b = new Bot({ at: [face === 'left' ? col + 1 : col - 1, row + 1] });
  b.strike(face);
  b.strike(face);
  b.hold(60);
  const ok = !!b.profile.flags[`urn:${ID}:${col},${row}`];
  record(`urn (${col},${row}) breaks from the floor beside it`, ok && !b.damaged, `souls +${b.profile.souls}`);
}

// =================================================================================================
// PITS: every place you can fall is escapable, or a hazard that respawns you on safe ground
// =================================================================================================

begin('Pits and dead ends');
hazardRespawn(
  'bone shards (53..54,24) between shelves 2 and 3',
  [51, 24],
  (b) => b.until(() => b.p.state === 'respawn', 120, ['right']),
  (b) => Math.abs(b.floor - 24) < 0.01 && b.col < 53,
);
hazardRespawn(
  'bile lake: miss the jump from I2',
  [114, 34],
  (b) => b.until(() => b.p.state === 'respawn', 120, ['right']),
  (b) => b.floor <= 34.01 && b.col >= 99 && b.col <= 116,
);
hazardRespawn(
  'bone-shard pit (175..189,39) in the Brazier Hall',
  [172, 34],
  (b) => b.until(() => b.p.state === 'respawn', 160, ['right']),
  (b) => b.col < 175 || b.col > 190,
);
hazardRespawn(
  'bone shards (221..225,39) at the foot of the root chasm',
  [218, 40],
  (b) => b.until(() => b.p.state === 'respawn', 120, ['right']),
  (b) => Math.abs(b.floor - 40) < 0.01 && b.col < 221,
);
hazardRespawn(
  'bile under the lantern gauntlet (279..296,29..31): walk off the bone bridges',
  [277, 21],
  (b) => b.until(() => b.p.state === 'respawn', 240, ['right']),
  (b) => Math.abs(b.floor - 21) < 0.01 && b.col <= 279,
);
// the east half of the hall floor while the great door is still shut: climb back to the east ledge
hop('hall floor east (door shut) -> plank (198..200,37)', [195, 40], [198, 200, 37], { extraFlags: {} });
hop('plank (198..200,37) -> plank (194..196,34)', [199, 37], [194, 196, 34]);
hop('plank (194..196,34) -> plank (198..200,31)', [195, 34], [198, 200, 31]);
hop('plank (198..200,31) -> plank (193..195,28)', [199, 31], [193, 195, 28]);
hop('plank (193..195,28) -> east ledge (197..203,25)', [194, 28], [197, 203, 25]);
hop('east ledge -> bone bridges -> high platform (back west)', [197, 25], [190, 193, 23]);
hop('bone bridges -> high platform (180..185,21)', [191, 23], [180, 185, 21]);
// the hall floor west of the shards (under L0) climbs out via P1 (checked on the route); from the
// root chasm floor out via Q1 (route). Water: from the bottom of each pool, swim to the way out.
for (const [label, at] of [
  ['the bottom of the first pool (240..251,34)', [242, 35]],
  ['the middle pool between the crypt walls (255..260)', [257, 35]],
  ['the shaft before the way out (264..265)', [264, 35]],
] as [string, [number, number]][]) {
  const r = swim(at, { stroke: 10, dj: 15, delay: 0 }, true);
  record(`water: from ${label} to the way-out ledge`, r.ok, `${r.b.frames} frames, now ${r.b.where()}`);
}
// runPlan keeps the direction held through the whole jump: a quick sanity check of the shared API
{
  const r = runPlan(def, [50, 24], { dir: 1, run: 0.1, hold: 0.2, dj: null, dash: null, dashDir: [0, 0] }, { abilities: BOTH });
  record('sim.runPlan sanity: shelf 2 running jump clears the bone shards', !r.hurt && r.onGround && r.x >= 55, `landed col ${r.x.toFixed(2)} floor ${r.y}`);
}

// =================================================================================================

const fails = results.filter((r) => !r.ok);
const warns = results.filter((r) => r.warn);
console.log(`\n${fails.length ? 'FAILURES:' : 'no failures'}`);
for (const f of fails) console.log(`  FAIL [${f.section}] ${f.name}: ${f.note}`);
if (warns.length) console.log('WARNINGS (fragile but possible):');
for (const w of warns) console.log(`  WARN [${w.section}] ${w.name}: ${w.warn}`);
console.log(`(${((Date.now() - t0) / 1000).toFixed(0)}s)`);
console.log(`ROUTE: ${results.length - fails.length}/${results.length} hops OK`);
process.exit(fails.length ? 1 : 0);
