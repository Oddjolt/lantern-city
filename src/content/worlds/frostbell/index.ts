import type { WorldDef } from '../../../game/registry';
import { frostBackdrop } from './backdrop';
import './enemies';
import { FROSTBELL_MAP } from './map';
import './mechanics';
import { frostStyle } from './tiles';

const world: WorldDef = {
  id: 'frostbell',
  name: 'Frostbell Spire',
  station: 'FROSTBELL',
  order: 3,
  palette: ['#0f1626', '#3e5c8a', '#9cc3dc', '#eef8fb'],
  tiles: frostStyle,
  backdrop: frostBackdrop,
  unlocks: 'catacombs',
  // a music box in bright D lydian (I - II - vi - V): airy, cold and glittering
  music: {
    bpm: 108,
    root: 62,
    scale: [0, 2, 4, 6, 7, 9, 11],
    bars: [0, 1, 5, 4, 0, 1, 2, 4],
    melody: [
      '7...4...2.4.7...',
      '6.4...2...4.....',
      '4...5.7.9...7.5.',
      '4.2...0.....2...',
      '7...9.7.4...7...',
      '6...4.6.8...6...',
      '4.5.4.2.0...2.4.',
      '2...........0...',
    ],
    lead: 'sine',
    bass: 'triangle',
    sparkle: 0.16,
  },
  map: FROSTBELL_MAP,
  legend: {
    '@': 'frostbell:ambience',
    // clockwork platforms: 'm'/'M' slide right, 'n'/'N' rise, until a ';' marker; capitals start
    // half a cycle later, so neighbours hand you off like meshing gears
    m: { kind: 'frostbell:gearplat', axis: 'x', period: 5 },
    M: { kind: 'frostbell:gearplat', axis: 'x', period: 5, phase: 0.5 },
    n: { kind: 'frostbell:gearplat', axis: 'y', period: 4 },
    N: { kind: 'frostbell:gearplat', axis: 'y', period: 4, phase: 0.5 },
    O: 'frostbell:owl',
    Y: 'frostbell:yeti',
    B: 'frostbell:bat',
    i: 'frostbell:icicle',
    // wind: '}' blows east, '{' blows west, ')' is a stronger, offset easterly gale
    '}': { kind: 'frostbell:gust', dir: 1 },
    '{': { kind: 'frostbell:gust', dir: -1, offset: 1.3, force: 66 },
    ')': { kind: 'frostbell:gust', dir: 1, offset: 2.2, force: 70 },
    // bells (lowercase/uppercase pairs): ring the bell, its gates lift
    b: { kind: 'frostbell:bell', ch: 'door', open: 0 },
    g: { kind: 'frostbell:gate', ch: 'door' },
    d: { kind: 'frostbell:bell', ch: 'a', open: 3.5 },
    e: { kind: 'frostbell:gate', ch: 'a' },
    Q: { kind: 'frostbell:bell', ch: 'b', open: 3 },
    q: { kind: 'frostbell:gate', ch: 'b' },
    p: { kind: 'frostbell:bell', ch: 'c', open: 4 },
    u: { kind: 'frostbell:gate', ch: 'c' },
    h: {
      kind: 'npc',
      sheet: 'frostbell-hoot',
      name: 'BELLRINGER HOOT',
      talk: 'talk',
      lines: [
        'HOO! A TRAVELLER, AND A WOODEN ONE AT THAT. MIND THE ICE, LITTLE TWIG: IT KEEPS YOUR MOMENTUM.',
        'I RANG THE FROSTBELLS FOR SIXTY WINTERS. THEN THE BARONS FROZE THE GREAT CLOCK AND BOTTLED THE LANTERN UP AT THE CROWN.',
        'THE DOOR BELL STILL REMEMBERS ITS SONG. STRIKE IT, AND THE ICE GATE WILL LIFT FOR YOU.',
        'HIGHER UP THE WIND COMES IN BURSTS. WHEN THE SNOW STARTS TO STREAK, BRACE YOURSELF... OR LET IT CARRY YOU.',
      ],
      alt: [
        {
          flag: 'goal:frostbell',
          lines: ['DO YOU HEAR THAT? THE BELLS ARE SINGING AGAIN! THE CATACOMBS LINE IS RUNNING. BUNDLE UP, LITTLE TWIG.'],
        },
      ],
    },
    f: {
      kind: 'npc',
      sheet: 'frostbell-pip',
      name: 'PIP THE SNOW FOX',
      talk: 'talk',
      lines: [
        'PSST. THE OLD BELLS IN HERE STILL WORK. RING ONE AND ITS GATE LIFTS... BUT ONLY FOR A FEW BREATHS.',
        'A RING ALSO RATTLES ANY BEAST NEARBY. THAT YETI HATES IT.',
        'AND IF YOU STRIKE DOWN ON A BELL IN MID-AIR, YOU BOUNCE RIGHT OFF IT! THAT IS HOW I CROSS THE SPIKES.',
      ],
      alt: [{ flag: 'goal:frostbell', lines: ['THE CROWN LANTERN IS LIT! EVEN MY TAIL FEELS WARMER.'] }],
    },
    // decor
    r: { kind: 'decor', sheet: 'frostbell-brazier', light: 44, halo: 16 },
    c: { kind: 'decor', sheet: 'frostbell-candles', light: 28, halo: 9 },
    s: { kind: 'decor', sheet: 'frostbell-statue', back: true },
    w: { kind: 'decor', sheet: 'frostbell-snowman' },
    k: { kind: 'decor', sheet: 'frostbell-crate' },
    a: { kind: 'decor', sheet: 'frostbell-banner', anchor: 'ceiling' },
    j: { kind: 'decor', sheet: 'frostbell-chimes', anchor: 'ceiling' },
    A: { kind: 'decor', sheet: 'frostbell-greatbell', anchor: 'ceiling', back: true },
    F: { kind: 'decor', sheet: 'frostbell-clock', anchor: 'center', back: true },
    V: { kind: 'decor', sheet: 'frostbell-clock', anchor: 'center' },
    Z: { kind: 'decor', sheet: 'frostbell-gear', anchor: 'center', back: true },
    z: { kind: 'decor', sheet: 'frostbell-cog', anchor: 'center', back: true },
    // signs
    '1': { kind: 'sign', text: ['FROSTBELL SPIRE STATION', 'ICE KEEPS YOUR MOMENTUM: EASY TO RUN, HARD TO STOP.'] },
    '2': { kind: 'sign', text: ['THE DOOR IS SEALED WITH ICE.', 'STRIKE THE DOOR BELL TO LIFT THE GATE.'] },
    '3': { kind: 'sign', text: ['WHEN THE SNOW BEGINS TO STREAK, A GUST IS COMING.', 'LEAN INTO IT, OR WAIT FOR THE CALM.'] },
    '4': { kind: 'sign', text: ['EACH RING LIFTS ITS GATE FOR A FEW BREATHS.', 'IN MID-AIR, DOWN + STRIKE A BELL TO BOUNCE OFF IT.'] },
    '5': { kind: 'sign', text: ['THE VENT GRATE IS FROZEN SHUT.', 'THE LITTLE BELL BESIDE IT STILL RINGS TRUE.'] },
    '6': { kind: 'sign', text: ['THE CROWN LANTERN IS ABOVE.', 'THE GALE NEVER STOPS UP HERE. ONLY PAUSES.'] },
  },
};

export default world;
