import type { MusicDef } from '../engine/audio';
import type { Palette } from '../engine/palette';
import type { PixelBuffer } from '../engine/pixels';
import { T, type TileStyle } from '../engine/tilemap';
import type { Entity } from './entity';
import type { World } from './world';

/**
 * A legend entry: an entity kind plus any options for its factory. `tile` (a map tile char such as
 * '#', '~' or ':') sets the terrain under the symbol, e.g. a clock face set into a solid wall.
 */
export type SpawnOpts = { kind: string; tile?: string; [key: string]: unknown };

/**
 * Builds the entity for one map symbol. (x, y) is the top-left pixel of the symbol's cell;
 * ground-standing things usually align their feet to y + 8 (the cell's bottom).
 */
export type EntityFactory = (world: World, x: number, y: number, opts: SpawnOpts) => Entity | Entity[] | void;

const factories = new Map<string, EntityFactory>();

/** Register an entity kind so any world's map legend can place it. Kinds are global: prefix them per world. */
export function registerEntity(kind: string, factory: EntityFactory) {
  if (factories.has(kind)) console.warn(`entity kind "${kind}" registered twice`);
  factories.set(kind, factory);
}

export function entityFactory(kind: string): EntityFactory | undefined {
  return factories.get(kind);
}

/** Parallax background. Each layer is painted once into a 640x180 buffer that tiles horizontally. */
export interface Backdrop {
  far?: (buf: PixelBuffer) => void;
  near?: (buf: PixelBuffer) => void;
  /** Scroll factors relative to the camera (0 = fixed to screen, 1 = moves with the world). */
  farScroll?: number;
  nearScroll?: number;
}

export interface WorldDef {
  id: string;
  /** Area title shown on arrival, e.g. "Mossgate Outskirts". */
  name: string;
  /** Short name used on the train map. */
  station: string;
  /** Position in the train menu. */
  order: number;
  palette: Palette;
  tiles: TileStyle;
  backdrop: Backdrop;
  music: MusicDef;
  /** ASCII map, one string per row of 8px tiles. See CONTENT_GUIDE.md for the symbols. */
  map: string[];
  /** World-specific symbols (override nothing in the tile set; may override base entity symbols). */
  legend?: Record<string, string | SpawnOpts>;
  /** Darkness: only light sources (player, lanterns…) reveal the level. */
  dark?: boolean;
  /** World unlocked on the train when this world's sector lantern is relit. */
  unlocks?: string;
  /** Dev-only worlds (not on the train map); reach them with ?world=<id>. */
  hidden?: boolean;
  /** Atmospheric particles drifting through the view. */
  ambient?: 'motes' | 'snow' | 'embers' | 'spores';
}

/** Map characters that become tiles (fixed for every world). */
export const TILE_OF: Record<string, number> = {
  '#': T.Solid,
  '=': T.OneWay,
  '^': T.SpikeUp,
  v: T.SpikeDown,
  '<': T.SpikeLeft,
  '>': T.SpikeRight,
  X: T.Breakable,
  G: T.GateOpen,
  I: T.Ice,
  '~': T.Water,
  '%': T.Acid,
  W: T.Updraft,
  ';': T.Stop,
  ':': T.Back,
};

/** Entity symbols available in every world (a world's legend may add more). */
export const BASE_LEGEND: Record<string, string | SpawnOpts> = {
  P: 'start',
  T: 'station',
  C: 'checkpoint',
  E: 'goal',
  o: 'soul',
  H: 'heart',
  L: 'hanglamp',
  D: { kind: 'shrine', ability: 'dash' },
  U: { kind: 'shrine', ability: 'doubleJump' },
  m: { kind: 'platform', axis: 'x' },
  n: { kind: 'platform', axis: 'y' },
  K: 'crumble',
  J: 'bounce',
};
