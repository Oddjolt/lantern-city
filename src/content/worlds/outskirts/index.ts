import type { WorldDef } from '../../../game/registry';
import { outskirtsBackdrop } from './backdrop';
import './enemies';
import { OUTSKIRTS_MAP } from './map';
import { leafyStyle } from './tiles';

const decor = (sheet: string, extra: Record<string, unknown> = {}) => ({ kind: 'decor', sheet, ...extra });

const world: WorldDef = {
  id: 'outskirts',
  name: 'Mossgate Outskirts',
  station: 'MOSSGATE',
  order: 1,
  palette: ['#2b1a17', '#24698a', '#b9b36a', '#f4f1e2'],
  tiles: leafyStyle,
  backdrop: outskirtsBackdrop,
  unlocks: 'underworks',
  ambient: 'spores',
  music: {
    bpm: 84,
    root: 57,
    scale: [0, 2, 3, 5, 7, 8, 10],
    bars: [0, 5, 3, 4],
    melody: ['0..2..4.....3.2.', '4...5.4.2.......', '2..4..5...7.5...', '4.2.1...0.......'],
    lead: 'triangle',
    bass: 'triangle',
    sparkle: 0.06,
    drums: 'soft',
  },
  map: OUTSKIRTS_MAP,
  legend: {
    // ---- creatures -------------------------------------------------------------------------
    b: 'outskirts:hound',
    w: 'outskirts:wisp',
    r: 'outskirts:beetle',
    c: 'outskirts:crow',
    // ---- mechanics with a Mossgate look --------------------------------------------------------
    K: 'outskirts:roots',
    // ---- folk ------------------------------------------------------------------------------
    N: {
      kind: 'npc',
      sheet: 'wick',
      name: 'OLD WICK',
      talk: 'talk',
      lines: [
        'OH! A NEW SPIRIT IN AN OLD WOODEN BODY. WELCOME TO THE WAKING WORLD, LITTLE TWIG.',
        'THE BARONS BOTTLED UP THE CITY LIGHTS, ONE SECTOR AT A TIME. NOW ONLY THE SPIRIT RAIL STILL RUNS.',
        "MOSSGATE'S SECTOR LANTERN WENT DARK TOO. IT STANDS BY THE OLD STATION, FAR TO THE EAST.",
        'RELIGHT IT, AND THE CONDUCTOR CAN OPEN THE NEXT LINE. MIND THE THORNS... AND THE HOUNDS.',
      ],
      alt: [{ flag: 'goal:outskirts', lines: ['YOU DID IT! MOSSGATE GLOWS AGAIN. THE UNDERWORKS LINE IS RUNNING.'] }],
    },
    Q: {
      kind: 'npc',
      sheet: 'outskirts-pip',
      name: 'PIP',
      talk: 'talk',
      lines: [
        'OH! YOU CAN SEE ME? MOST SPIRITS WALK RIGHT PAST. I AM PIP. I KEEP THE SHRINE.',
        'THE SHRINE HOLDS A SPIRIT DASH: A GUST OF WIND YOU CAN STEER IN ANY DIRECTION.',
        "PAST THE TEMPLE THE GROUND FALLS AWAY. NOBODY CROSSES THAT WITHOUT A DASH. GO ON, IT DOESN'T BITE!",
      ],
      alt: [{ flag: 'goal:outskirts', lines: ['THE LANTERN IS LIT! THE CROWS ARE SO CONFUSED. HEHE.'] }],
    },
    Z: {
      kind: 'npc',
      sheet: 'outskirts-moth',
      name: 'DUSK',
      talk: 'talk',
      lines: [
        '...MM? OH. A VISITOR. I WAS DREAMING OF LANTERN LIGHT.',
        'WE MOTHS USED TO DANCE AROUND THE STATION LAMPS ALL NIGHT. NOW IT IS SO DIM I JUST... DOZE.',
        'IF YOU LIGHT THE BIG LANTERN, WAKE ME UP. ...ZZZ...',
      ],
      alt: [{ flag: 'goal:outskirts', lines: ['LIGHT! WARM, LOVELY LIGHT! THANK YOU, LITTLE TWIG. I SHALL NEVER SLEEP AGAIN. ...ZZZ...'] }],
    },
    // ---- decor (animated ones sway / flicker; glowing ones get a halo) ---------------------------
    M: decor('mushrooms', { light: 30, halo: 9 }),
    S: decor('statue', { back: true }),
    a: decor('outskirts-arch', { back: true }),
    O: decor('outskirts-clock', { back: true }),
    Y: decor('outskirts-pillar', { back: true }),
    h: decor('outskirts-bench'),
    g: decor('outskirts-grave', { anim: 'cross' }),
    u: decor('outskirts-grave', { anim: 'stone' }),
    A: decor('outskirts-grave', { anim: 'tilted' }),
    e: decor('outskirts-fern'),
    z: decor('outskirts-banner', { anchor: 'ceiling' }),
    i: decor('outskirts-bellflower', { light: 24, halo: 8 }),
    x: decor('outskirts-cart'),
    q: decor('outskirts-lily', { anim: 'a' }),
    p: decor('outskirts-lily', { anim: 'b' }),
    y: decor('outskirts-reeds'),
    l: 'outskirts:lamppost',
    f: 'outskirts:fireflies',
    // ---- signs -------------------------------------------------------------------------------
    '1': { kind: 'sign', text: ['← →  MOVE.     Z OR SPACE  JUMP.', 'PRESS ↑ TO READ SIGNS AND TO TALK TO FOLK.'] },
    '2': { kind: 'sign', text: ['HOLD JUMP LONGER TO JUMP HIGHER.', 'JUMP UP THROUGH WOODEN PLANKS.  ↓ + JUMP DROPS BACK DOWN.'] },
    '3': { kind: 'sign', text: ['JUMP AGAINST A WALL TO WALL-JUMP.', 'HOLD TOWARDS A WALL TO SLIDE DOWN IT SLOWLY.'] },
    '4': { kind: 'sign', text: ['X  STRIKES.     ↑ + X  STRIKES UPWARDS.', 'CRACKED STONE CRUMBLES AFTER THREE GOOD STRIKES.'] },
    '5': { kind: 'sign', text: ['THE FLOOR AROUND HERE SOUNDS HOLLOW...'] },
    '6': { kind: 'sign', text: ['IN THE AIR,  ↓ + X  STRIKES DOWNWARDS.', 'STRIKE THORNS OR FOES BELOW YOU TO BOUNCE OFF THEM!'] },
    '7': { kind: 'sign', text: ['C  DASHES, IN ANY OF 8 DIRECTIONS.', 'LANDING, A BOUNCE OR A SPRING GIVES YOUR DASH BACK.'] },
    '8': { kind: 'sign', text: ['HOLD ↑ AND DASH TO SOAR STRAIGHT UP.', 'JUMP FIRST FOR EXTRA HEIGHT. MIND THE THORNY WALL!'] },
    '9': { kind: 'sign', text: ['MOSSGATE STATION.', 'TALK TO THE CONDUCTOR TO RIDE THE SPIRIT RAIL.'] },
  },
};

export default world;
