import { AVATARS, setAvatar } from '../../art/player';
import { allWorlds, worldById } from '../../content/worlds';
import { PixelBuffer } from '../../engine/pixels';
import { H, W, type Renderer } from '../../engine/renderer';
import { Anim } from '../../engine/sprites';
import { T, TileMap } from '../../engine/tilemap';
import type { Game, Scene } from '../game';
import { clearProfile, loadProfile, newProfile, saveProfile, type Profile } from '../profile';
import type { WorldDef } from '../registry';
import { GalleryScene } from './gallery';
import { PlayScene } from './play';

export class TitleScene implements Scene {
  private t = 0;
  private index = 0;
  private items: string[];
  private save: Profile | null = loadProfile();
  /** The world a new game starts in. */
  private def: WorldDef;
  /** The title backdrop slowly cycles through every world: a window onto the whole city. */
  private shown: WorldDef;
  private showT = 0;
  private art: { far: HTMLCanvasElement | null; near: HTMLCanvasElement | null; ground: HTMLCanvasElement } | null = null;
  private twig = new Anim('player', 'idle');
  private flame = new Anim('lantern', 'on');
  private avatars = Object.keys(AVATARS);
  private avatar: number;

  constructor(private game: Game) {
    this.def = worldById('outskirts') ?? allWorlds()[0];
    this.shown = this.def;
    game.r.setPalette(this.def.palette);
    game.audio.playSong(this.def.music);
    this.items = [...(this.save ? ['CONTINUE'] : []), 'NEW GAME', 'AVATAR', 'ANIMATION GALLERY'];
    this.avatar = Math.max(0, this.avatars.indexOf(this.save?.avatar ?? 'sprout'));
    setAvatar(this.avatars[this.avatar]);
  }

  /** Cycle the avatar topper; the twig on screen (and the save, if any) updates at once. */
  private cycleAvatar(step: number) {
    this.avatar = (this.avatar + step + this.avatars.length) % this.avatars.length;
    const name = this.avatars[this.avatar];
    setAvatar(name);
    if (this.save) {
      this.save.avatar = name;
      saveProfile(this.save);
    }
    this.game.audio.play('blip');
  }

  update(dt: number) {
    this.t += dt;
    this.showT += dt;
    this.twig.update(dt);
    this.flame.update(dt);
    const worlds = allWorlds();
    if (this.showT >= SHOW_SECONDS && worlds.length > 1) {
      this.showT = 0;
      this.shown = worlds[(worlds.indexOf(this.shown) + 1) % worlds.length];
      this.game.r.setPalette(this.shown.palette);
      this.art = null;
    }
    const { input, audio } = this.game;
    if (this.game.transitioning) return;
    if (input.pressed('up')) {
      this.index = (this.index + this.items.length - 1) % this.items.length;
      audio.play('blip');
    }
    if (input.pressed('down')) {
      this.index = (this.index + 1) % this.items.length;
      audio.play('blip');
    }
    if (this.items[this.index] === 'AVATAR') {
      if (input.pressed('left')) this.cycleAvatar(-1);
      if (input.pressed('right') || input.pressed('confirm')) this.cycleAvatar(1);
      return;
    }
    if (!input.pressed('confirm')) return;
    audio.play('select');
    const g = this.game;
    switch (this.items[this.index]) {
      case 'CONTINUE': {
        const p = this.save!;
        const def = worldById(p.worldId) ?? this.def;
        g.transition(() => {
          g.profile = p;
          g.scene = new PlayScene(g, def, p.spawn);
        });
        break;
      }
      case 'NEW GAME':
        g.transition(() => {
          clearProfile();
          g.profile = newProfile();
          g.profile.avatar = this.avatars[this.avatar];
          g.scene = new PlayScene(g, this.def, { kind: 'start' });
        });
        break;
      case 'ANIMATION GALLERY':
        g.transition(() => (g.scene = new GalleryScene(g)));
        break;
    }
  }

  private build(r: Renderer) {
    const paint = (f?: (b: PixelBuffer) => void) => {
      if (!f) return null;
      const b = new PixelBuffer(640, H);
      f(b);
      return b.toCanvas(r.palette);
    };
    // the ground strip is drawn with the world's real tile style
    const map = new TileMap(W / 8, 4, this.shown.tiles);
    for (let x = 0; x < W / 8; x++) for (let y = 1; y < 4; y++) map.set(x, y, T.Solid);
    this.art = { far: paint(this.shown.backdrop.far), near: paint(this.shown.backdrop.near), ground: map.render(r.palette) };
  }

  draw(r: Renderer) {
    if (!this.art) this.build(r);
    const art = this.art!;
    r.screen();
    r.clear(0);
    for (const [img, speed] of [
      [art.far, 5],
      [art.near, 12],
    ] as const) {
      if (!img) continue;
      const off = -Math.floor((this.t * speed) % img.width);
      r.image(img, off, 0);
      r.image(img, off + img.width, 0);
    }
    r.image(art.ground, 0, H - 32);
    r.halo(256, H - 38, 22 + (Math.sin(this.t * 9) > 0.7 ? 1 : 0), 1);
    r.sprite('lantern', this.flame.frame, 256, H - 24);
    r.sprite('player', this.twig.frame, 70, H - 24);
    r.text(this.shown.station, W - 4 - this.shown.station.length * 4, H - 9, 1);
    // dithered cross-fade between worlds (behind the menu, so it stays readable)
    const edge = Math.min(this.showT, SHOW_SECONDS - this.showT);
    if (edge < 0.35) r.dither(1 - edge / 0.35, 0);

    const bob = Math.round(Math.sin(this.t * 1.5) * 2);
    r.textCenter('LANTERN CITY', W / 2, 26 + bob, 3, 3, true);
    r.textCenter('A PIXEL WORLDS PROTOTYPE', W / 2, 52, 2, 1, true);
    this.items.forEach((item, i) => {
      const y = 72 + i * 11;
      const sel = i === this.index;
      const label = item === 'AVATAR' ? `AVATAR: ${this.avatars[this.avatar].toUpperCase()}` : item;
      r.textCenter(sel ? (item === 'AVATAR' ? `← ${label} →` : `→ ${label} ←`) : label, W / 2, y, sel ? 3 : 2, 1, true);
    });
    r.textCenter('↑↓ CHOOSE   Z / ENTER SELECT   M MUSIC', W / 2, 120, 1, 1, true);
  }
}

const SHOW_SECONDS = 7;
