import { allWorlds, loadWorlds, worldById } from './content/worlds';
import './game/common';
import { Game } from './game/game';
import { newProfile } from './game/profile';
import { GalleryScene } from './game/scenes/gallery';
import { PlayScene } from './game/scenes/play';
import { TitleScene } from './game/scenes/title';

const game = new Game(document.getElementById('game') as HTMLCanvasElement);

/**
 * Dev shortcuts:
 *   ?world=<id>          jump straight into a world (all lines unlocked, all abilities)
 *   ?world=<id>&raw      …same, but with a fresh profile (no abilities)
 *   ?gallery             open the animation gallery
 *   ?debug               hitbox overlay (also toggled with the ` key)
 */
loadWorlds().then(() => {
  const params = new URLSearchParams(location.search);
  const id = params.get('world');
  const def = id ? worldById(id) : undefined;
  if (def) {
    const p = newProfile();
    if (!params.has('raw')) {
      p.abilities = { dash: true, doubleJump: true };
      p.unlocked = allWorlds().map((w) => w.id);
    }
    game.profile = p;
    game.start(new PlayScene(game, def, { kind: params.get('spawn') === 'station' ? 'station' : 'start' }));
  } else if (params.has('gallery')) {
    game.start(new GalleryScene(game));
  } else {
    game.start(new TitleScene(game));
  }
  // handy for poking at state from the browser console
  (window as unknown as { game: Game }).game = game;
});
