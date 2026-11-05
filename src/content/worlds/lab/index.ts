import { hash2 } from '../../../engine/math';
import type { WorldDef } from '../../../game/registry';
import { makeStyle } from '../../../game/tilekit';
import { LAB_MAP } from './map';

/** Dev-only test world (?world=lab): one of every mechanic, in classic Game Boy greens. */
const stone = makeStyle({
  solid: {
    texture: (x, y) => {
      const row = Math.floor(y / 4);
      const bx = x + (row & 1) * 4;
      if (y % 4 === 3 || bx % 8 === 7) return 0;
      return hash2(Math.floor(bx / 8), row, 2) < 0.15 ? 2 : 1;
    },
    edge: 2,
    top: 3,
    gap: true,
  },
});

const world: WorldDef = {
  id: 'lab',
  name: 'Mechanics Lab',
  station: 'LAB',
  order: 99,
  hidden: true,
  palette: ['#0f380f', '#306230', '#8bac0f', '#9bbc0f'],
  tiles: stone,
  backdrop: {
    far(b) {
      for (let x = 0; x < 640; x += 2) b.set(x, 120 + Math.round(Math.sin(x / 40) * 12), 1);
    },
  },
  music: {
    bpm: 110,
    root: 60,
    scale: [0, 2, 4, 5, 7, 9, 11],
    bars: [0, 3, 4, 0],
    melody: ['0.2.4.2.0.2.4...', '4.5.4.2.0.......'],
    lead: 'square',
    bass: 'triangle',
  },
  map: LAB_MAP,
  legend: {
    b: 'outskirts:hound',
    w: 'outskirts:wisp',
    N: { kind: 'npc', sheet: 'conductor', name: 'LAB TECH', talk: 'talk', lines: ['EVERY MECHANIC IN ONE ROOM. GO NUTS.'] },
    M: { kind: 'decor', sheet: 'lantern', anim: 'on', light: 40, halo: 14 },
    '1': { kind: 'sign', text: ['MECHANICS LAB'] },
    '2': { kind: 'sign', text: ['CHIMNEY: WALL-JUMP UP'] },
    '3': { kind: 'sign', text: ['STRIKE THE HOUND'] },
  },
};

export default world;
