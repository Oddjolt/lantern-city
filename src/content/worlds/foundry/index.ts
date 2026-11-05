import type { WorldDef } from '../../../game/registry';
import { foundryBackdrop } from './backdrop';
import './boss';
import './enemies';
import { FOUNDRY_MAP } from './map';
import './mechanics';
import { foundryMusic } from './music';
import { foundryStyle } from './tiles';

/**
 * EMBER FOUNDRY — the Barons' furnace works and the last sector of Lantern City.
 * Slag channels, conveyor halls, a steam stack climb and a crusher gallery lead to the
 * IRON WARDEN; the sector lantern waits beyond its arena.
 */
const world: WorldDef = {
  id: 'foundry',
  name: 'Ember Foundry',
  station: 'FOUNDRY',
  order: 5,
  palette: ['#1a0f0b', '#7a2d1b', '#e2792f', '#ffe9b0'],
  tiles: foundryStyle,
  backdrop: foundryBackdrop,
  music: foundryMusic,
  ambient: 'embers',
  map: FOUNDRY_MAP,
  legend: {
    // enemies & the boss
    i: 'foundry:imp',
    b: 'foundry:bot',
    d: 'foundry:drone',
    B: 'foundry:warden',
    // mechanisms
    r: { kind: 'foundry:belt', dir: 1 },
    l: { kind: 'foundry:belt', dir: -1 },
    f: { kind: 'foundry:jet', phase: 0 },
    F: { kind: 'foundry:jet', phase: 0.5 },
    p: { kind: 'foundry:press', phase: 0 },
    k: { kind: 'foundry:press', phase: 0.3 },
    q: { kind: 'foundry:press', phase: 0.6 },
    m: { kind: 'foundry:crane', axis: 'x' },
    n: { kind: 'foundry:crane', axis: 'y' },
    K: 'foundry:grate',
    '!': 'foundry:ambience',
    // characters
    N: {
      kind: 'npc',
      sheet: 'foundry-stoker',
      name: 'STOKER',
      talk: 'talk',
      lines: [
        'OI! A WOODEN ONE, ALL THE WAY OUT HERE? THIS IS THE EMBER FOUNDRY, WHERE THE BARONS MELT DOWN STOLEN LIGHT.',
        'THE SLAG IN THE CHANNELS WILL BURN YOU TO ASH. HOP THE TRENCHES AND RIDE THE CRANES ACROSS.',
        'IMPS CROUCH BEFORE THEY HOP, AND LEAVE EMBERS WHERE THEY LAND. FURNACE BOTS HIDE BEHIND SHIELDS: HIT THEM FROM ABOVE OR BEHIND!',
      ],
      alt: [
        { flag: 'goal:foundry', lines: ['YOU DID IT! THE FURNACES BURN FOR US NOW, NOT FOR THE BARONS.'] },
        { flag: 'boss:foundry', lines: ['WAS THAT THE WARDEN FALLING? THE WHOLE YARD SHOOK! GO ON, LIGHT THE LANTERN!'] },
      ],
    },
    A: {
      kind: 'npc',
      sheet: 'foundry-smith',
      name: 'SMITH ANVIL',
      talk: 'talk',
      lines: [
        'HALT, LITTLE TWIG. I AM ANVIL. I FORGED IRON FOR THE BARONS UNTIL THEY TOOK THE FIRE FROM MY CHEST.',
        'PAST THAT GATE WAITS THE IRON WARDEN, THEIR ENFORCER. IT GUARDS THE LAST SECTOR LANTERN.',
        'WHEN IT CROUCHES AND LOWERS ITS HEAD, IT CHARGES. LEAP OVER IT, AND STRIKE WHILE IT IS DAZED FROM THE WALL.',
        'WHEN IT CROUCHES AND LOOKS UP, IT LEAPS. WATCH WHERE ITS SHADOW FALLS, AND JUMP THE SHOCKWAVES.',
        'WHEN ITS CANNON GLOWS, STRIKE THE SHOTS RIGHT BACK. THE WARDEN HATES ITS OWN SLAG. REST AT THE LANTERN FIRST.',
      ],
      alt: [
        { flag: 'goal:foundry', lines: ['THE CITY GLOWS AGAIN. EVEN MY OLD STONE CHEST FEELS WARM. THANK YOU, TWIG.'] },
        { flag: 'boss:foundry', lines: ['THE WARDEN IS SCRAP! I WILL FORGE SOMETHING GENTLER FROM ITS BONES. GO, LIGHT THE LANTERN.'] },
      ],
    },
    Z: 'foundry:prisoner',
    // signs
    '1': { kind: 'sign', text: ['EMBER FOUNDRY - PROPERTY OF THE BARONS.', 'TRESPASSERS WILL BE SMELTED.'] },
    '2': { kind: 'sign', text: ['CONVEYORS RUN DAY AND NIGHT.', 'THEY CARRY WHATEVER STANDS ON THEM. JUMP OFF A MOVING BELT TO FLY FARTHER.'] },
    '3': { kind: 'sign', text: ['STEAM STACK. RIDE THE UPDRAFT.', 'SPRINGS, WINGS AND WALLS WILL GET YOU TO THE TOP.'] },
    '4': { kind: 'sign', text: ['CAUTION: PRESSES.', 'THEY SHUDDER BEFORE THEY DROP. WAIT IN THE GAPS.'] },
    '5': { kind: 'sign', text: ["STOKERS' CUBBY. NO BARONS ALLOWED.", 'TAKE A SOUL, LEAVE A SOUL. (NOBODY EVER LEAVES ONE.)'] },
    // decor
    c: { kind: 'decor', sheet: 'foundry-crucible', light: 40, halo: 14 },
    a: { kind: 'decor', sheet: 'foundry-chain', anchor: 'ceiling' },
    g: { kind: 'decor', sheet: 'foundry-gear', back: true, anchor: 'center' },
    u: { kind: 'decor', sheet: 'foundry-furnace', back: true, light: 56, halo: 18 },
    e: { kind: 'decor', sheet: 'foundry-barrels' },
    s: { kind: 'decor', sheet: 'foundry-stack', back: true },
    w: { kind: 'decor', sheet: 'foundry-pipes', back: true },
    z: { kind: 'decor', sheet: 'foundry-anvil' },
    t: { kind: 'decor', sheet: 'foundry-ingots', light: 30, halo: 10 },
    R: { kind: 'decor', sheet: 'foundry-banner', anchor: 'ceiling' },
  },
};

export default world;
