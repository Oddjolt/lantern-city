import type { WorldDef } from '../../../game/registry';
import { underworksBackdrop } from './backdrop';
import './enemies';
import { UNDERWORKS_MAP } from './map';
import { underworksStyle } from './tiles';

/**
 * The Underworks — sector 2. Flooded sewers, pump works and steam under the city.
 * Gives the Ember Wings (double jump) mid-level; the second half needs them.
 *
 * World-specific map symbols:
 *   r rat · s / S sentry facing left / right · Z gate sentry (opens sluice B when broken)
 *   d drip slime (cell under a ceiling) · e pipe eel (in water)
 *   a valve (opens sluice A) · A / B sluice gates (a rectangle of the symbol)
 *   ) water current pushing east · V steam vent (foot of a W column)
 *   N Rusty · F Old Croaker · w Digby · 1-4 signs
 *   decor: k barrel · g gauge · h rats' nest · q caged lamp · p dripping pipe · M great pump
 *          O outfall · f glow fungus · b workbench · u wall valve · t work lamp · c / i chains
 *   * water shimmer (one per map, anywhere open) · ? hides a sealed secret room until its X wall breaks
 */
const world: WorldDef = {
  id: 'underworks',
  name: 'The Underworks',
  station: 'UNDERWORKS',
  order: 2,
  palette: ['#0d0b2a', '#6b1046', '#4db6a3', '#f2e6c2'],
  tiles: underworksStyle,
  backdrop: underworksBackdrop,
  unlocks: 'frostbell',
  ambient: 'motes',
  // B Phrygian at a brisker clip than the Outskirts: square-wave plinks like dripping pipes
  // over a Phrygian vamp (i - bII), with sparkle notes standing in for echoes.
  music: {
    bpm: 104,
    root: 59,
    scale: [0, 1, 3, 5, 7, 8, 10],
    bars: [0, 0, 1, 0, 5, 6, 1, 0],
    melody: [
      '0...2.0...4.3...',
      '0...2.0...7...5.',
      '0...2.4...2.1...',
      '4.3.2.....0.....',
      '0...2.4.....2...',
      '0...2.4.....5.4.',
      '4.3.2.1.0.......',
      '0.......0.2.0...',
    ],
    lead: 'square',
    bass: 'triangle',
    sparkle: 0.09,
  },
  map: UNDERWORKS_MAP,
  legend: {
    r: 'underworks:rat',
    s: { kind: 'underworks:sentry', face: -1 },
    S: { kind: 'underworks:sentry', face: 1 },
    Z: { kind: 'underworks:sentry', face: -1, ch: 'g1' },
    d: 'underworks:drip',
    e: 'underworks:eel',
    a: { kind: 'underworks:valve', ch: 'g2' },
    A: { kind: 'underworks:sluice', ch: 'g2', sym: 'A' },
    B: { kind: 'underworks:sluice', ch: 'g1', sym: 'B' },
    ')': { kind: 'underworks:current', dx: 1, dy: 0 },
    V: 'underworks:vent',
    '*': 'underworks:waterfx',
    '?': 'underworks:secret',
    N: {
      kind: 'npc',
      sheet: 'underworks-rusty',
      name: 'RUSTY',
      talk: 'talk',
      lines: [
        'WELL OIL MY GEARS, A VISITOR! NAME IS RUSTY. I KEEP THE OLD PUMPS DOWN HERE TICKING.',
        'THE BARONS LEFT SENTRIES ALL OVER THE WORKS. TOUGH ARMOUR, BUT THEIR BOLTS BOUNCE. STRIKE A BOLT JUST AS IT REACHES YOU AND IT FLIES RIGHT BACK!',
        'PAST THE CISTERN SITS THE PUMP STATION, AND IN IT AN OLD SHRINE: EMBER WINGS. WITH THOSE YOU CAN JUMP AGAIN IN MID-AIR.',
        'THE SECTOR LANTERN IS AT THE OUTFLOW, UP HIGH. JUMP, JUMP AGAIN, THEN DASH UP. YOU WILL GET THERE.',
      ],
      alt: [{ flag: 'goal:underworks', lines: ['THE PUMPS ARE SINGING AGAIN! THAT LANTERN LIGHT REACHES ALL THE WAY DOWN HERE.'] }],
    },
    F: {
      kind: 'npc',
      sheet: 'underworks-frog',
      name: 'OLD CROAKER',
      talk: 'talk',
      lines: [
        'BRRRUP. SWIMMING, ARE WE? PRESS JUMP OVER AND OVER TO STROKE UP. HOLD DOWN TO SINK.',
        'THE EAST WALL GOES ALL THE WAY DOWN. DIVE UNDER IT: THE DRAIN WILL PULL YOU THROUGH TO THE PUMPS.',
        'AND MIND THE EELS. WHEN TWO LITTLE EYES START TO GLOW, MOVE.',
        'BRRUP... SOMETHING SHINY SITS BEHIND THE CRACKED BRICKS AT THE BOTTOM OF THE WEST WALL. I CANNOT BREAK BRICKS. YOU CAN.',
      ],
    },
    w: {
      kind: 'npc',
      sheet: 'underworks-mole',
      name: 'DIGBY',
      talk: 'talk',
      lines: [
        'OH! LIGHT! I WAS SENT TO FIX THE OUTFLOW HATCH THREE SHIFTS AGO AND GOT TURNED AROUND.',
        'IF YOU RELIGHT THAT BIG LANTERN, THE CONDUCTOR CAN RUN A TRAIN THROUGH HERE. I COULD FINALLY GO HOME.',
      ],
      alt: [{ flag: 'goal:underworks', lines: ['WHAT A GLOW! I CAN SEE ALL THE WAY TO THE STATION NOW. THANK YOU, LITTLE TWIG.'] }],
    },
    '1': { kind: 'sign', text: ['UNDERWORKS STATION.', 'WET FLOORS. LOOSE BRICKS. MIND THE RATS.'] },
    '2': { kind: 'sign', text: ['SENTRY GALLERY AHEAD.', 'ARMOUR TURNS THE STICK. STRIKE THE BOLTS BACK (X) TO BREAK THEM.'] },
    '3': { kind: 'sign', text: ['OUTFLOW HATCH ABOVE.', 'JUMP, JUMP AGAIN IN MID-AIR, THEN DASH UP.'] },
    '4': { kind: 'sign', text: ['STEAM VENTS: RIDE THE HOT AIR UP.'] },
    k: { kind: 'decor', sheet: 'underworks-barrel', halo: 8 },
    g: { kind: 'decor', sheet: 'underworks-gauge' },
    h: { kind: 'decor', sheet: 'underworks-nest' },
    q: { kind: 'decor', sheet: 'underworks-cagelamp', anchor: 'ceiling', light: 40, halo: 12 },
    p: { kind: 'decor', sheet: 'underworks-drippipe', anchor: 'ceiling' },
    M: { kind: 'decor', sheet: 'underworks-pump', back: true },
    O: { kind: 'decor', sheet: 'underworks-outfall', anchor: 'ceiling', back: true },
    f: { kind: 'decor', sheet: 'underworks-fungus', light: 26, halo: 9 },
    b: { kind: 'decor', sheet: 'underworks-bench' },
    u: { kind: 'decor', sheet: 'underworks-wallvalve', anchor: 'center', back: true },
    t: { kind: 'decor', sheet: 'underworks-worklamp', light: 40, halo: 14 },
    c: { kind: 'decor', sheet: 'underworks-chain', anchor: 'ceiling', back: true },
    i: { kind: 'decor', sheet: 'underworks-chain-short', anchor: 'ceiling', back: true },
  },
};

export default world;
