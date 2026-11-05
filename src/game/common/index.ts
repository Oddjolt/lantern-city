import '../../art/common';
import '../../art/fx';
import '../../art/player';
import { registerEntity } from '../registry';
import { Bounce, Crumble, Platform, type PlatformOpts } from './mechanics';
import { HeartVessel, Shrine, SoulOrb, type Ability } from './pickups';
import { Checkpoint, Decor, Goal, HangLamp, Npc, Sign, Station, type DecorOpts, type NpcOpts } from './props';

/** Entity kinds every world can use from its map legend. */
registerEntity('station', (w, x, y) => new Station(w, x, y));
registerEntity('checkpoint', (w, x, y) => new Checkpoint(w, x, y));
registerEntity('goal', (w, x, y) => new Goal(w, x, y));
registerEntity('soul', (w, x, y) => {
  const key = `soul:${w.def.id}:${x / 8},${y / 8}`;
  return w.hasFlag(key) ? undefined : new SoulOrb(w, x + 4, y + 4, false, key);
});
registerEntity('heart', (w, x, y) => {
  const key = `heart:${w.def.id}:${x / 8},${y / 8}`;
  return w.hasFlag(key) ? undefined : new HeartVessel(w, x, y, key);
});
registerEntity('shrine', (w, x, y, o) => new Shrine(w, x, y, o.ability as Ability));
registerEntity('hanglamp', (w, x, y) => new HangLamp(w, x, y));
registerEntity('platform', (w, x, y, o) => new Platform(w, x, y, o.axis === 'y' ? 'y' : 'x', o as PlatformOpts));
registerEntity('crumble', (w, x, y) => new Crumble(w, x, y));
registerEntity('bounce', (w, x, y) => new Bounce(w, x, y));
registerEntity('npc', (w, x, y, o) => new Npc(w, x, y, o as unknown as NpcOpts));
registerEntity('sign', (w, x, y, o) => new Sign(w, x, y, o.text as string[]));
registerEntity('decor', (w, x, y, o) => new Decor(w, x, y, o as unknown as DecorOpts));
