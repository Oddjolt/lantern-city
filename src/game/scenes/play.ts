import { setAvatar } from '../../art/player';
import { allWorlds, worldById } from '../../content/worlds';
import { textWidth } from '../../engine/font';
import { H, W, type Renderer } from '../../engine/renderer';
import { Goal } from '../common/props';
import type { Game, Scene } from '../game';
import { saveProfile, type SpawnPoint } from '../profile';
import type { WorldDef } from '../registry';
import { Dialog } from '../ui/dialog';
import { drawHud } from '../ui/hud';
import { World, type WorldUi } from '../world';
import { EndingScene } from './ending';
import { TitleScene } from './title';
import { TrainScene } from './train';

interface Card {
  text: string;
  sub?: string;
  t: number;
  dur: number;
}

/** Playing inside one world: the world plus dialogs, menus, HUD and title cards. */
export class PlayScene implements Scene, WorldUi {
  readonly world: World;
  private dialog: Dialog | null = null;
  private menu: { items: WorldDef[]; index: number } | null = null;
  private paused = false;
  private areaCard: Card | null = null;
  private bannerCard: Card | null = null;
  private bossBar: { name: string; frac: number; shown: number } | null = null;
  private endingIn = 0;

  constructor(
    private game: Game,
    def: WorldDef,
    spawn: SpawnPoint,
  ) {
    game.profile.worldId = def.id;
    setAvatar(game.profile.avatar);
    this.world = new World(game, def, spawn);
    this.world.ui = this;
    game.r.setPalette(def.palette);
    game.audio.playSong(def.music);
    this.title(def.name);
  }

  get busy() {
    return !!this.dialog || !!this.menu || this.paused;
  }

  // ---- WorldUi -----------------------------------------------------------------------

  say(speaker: string, lines: string[], onDone?: () => void) {
    this.dialog = new Dialog(speaker, lines, onDone);
  }

  banner(text: string, sub?: string) {
    this.bannerCard = { text, sub, t: 0, dur: 3.6 };
  }

  title(text: string) {
    this.areaCard = { text, t: 0, dur: 3.2 };
  }

  ending() {
    this.endingIn = 4;
  }

  boss(name: string | null, frac = 1) {
    if (!name) this.bossBar = null;
    else this.bossBar = { name, frac: Math.max(0, Math.min(1, frac)), shown: this.bossBar?.shown ?? frac };
  }

  travel() {
    const items = allWorlds();
    this.menu = { items, index: Math.max(0, items.findIndex((w) => w.id === this.world.def.id)) };
    this.game.audio.play('select');
  }

  died() {
    const g = this.game;
    g.transition(() => {
      const p = g.profile;
      p.hp = p.maxHp;
      saveProfile(p);
      const def = worldById(p.worldId) ?? this.world.def;
      g.scene = new PlayScene(g, def, p.spawn);
    });
  }

  // ---- loop ---------------------------------------------------------------------------

  update(dt: number) {
    const { input, audio, profile } = this.game;
    profile.playTime += dt;
    if (this.paused) {
      if (input.pressed('pause')) this.paused = false;
      else if (input.pressed('attack')) {
        saveProfile(profile);
        this.game.transition(() => (this.game.scene = new TitleScene(this.game)));
      } else if (input.pressed('dash')) {
        // unstick: back to the last lantern (or the station) without a death
        this.paused = false;
        this.died();
      }
      return;
    }
    if (input.pressed('pause') && !this.dialog && !this.menu) {
      this.paused = true;
      audio.play('select');
      return;
    }
    if (this.game.debug && input.pressed('warp')) this.warpNext();
    if (this.dialog) {
      this.dialog.update(dt, input, audio);
      if (this.dialog.done) {
        const then = this.dialog.onDone;
        this.dialog = null;
        input.consume('jump');
        input.consume('confirm');
        input.consume('up');
        then?.();
      }
    } else if (this.menu) {
      this.updateMenu();
    }
    if (this.endingIn > 0) {
      this.endingIn -= dt;
      if (this.endingIn <= 0) this.game.transition(() => (this.game.scene = new EndingScene(this.game)));
    }
    for (const c of [this.areaCard, this.bannerCard]) if (c) c.t += dt;
    if (this.areaCard && this.areaCard.t > this.areaCard.dur) this.areaCard = null;
    if (this.bannerCard && this.bannerCard.t > this.bannerCard.dur) this.bannerCard = null;
    this.world.update(dt);
  }

  /** Debug: hop between spawn points, checkpoints and the goal (N). */
  private warpNext() {
    const w = this.world;
    const spots = [...w.spawns.values()];
    for (const e of w.entities) if (e instanceof Goal) spots.push({ x: e.cx - 20, y: e.bottom });
    spots.sort((a, b) => a.x - b.x || b.y - a.y);
    if (!spots.length) return;
    this.warpIndex = (this.warpIndex + 1) % spots.length;
    w.player.place(spots[this.warpIndex].x, spots[this.warpIndex].y);
  }

  private warpIndex = -1;

  private updateMenu() {
    const m = this.menu!;
    const { input, audio, profile } = this.game;
    if (input.pressed('up')) {
      m.index = (m.index + m.items.length - 1) % m.items.length;
      audio.play('blip');
    }
    if (input.pressed('down')) {
      m.index = (m.index + 1) % m.items.length;
      audio.play('blip');
    }
    if (input.pressed('back') || input.pressed('pause')) {
      this.menu = null;
      return;
    }
    if (!input.pressed('confirm')) return;
    input.consume('jump');
    const dest = m.items[m.index];
    if (!profile.unlocked.includes(dest.id)) {
      audio.play('hurt');
      return;
    }
    this.menu = null;
    if (dest.id === this.world.def.id) return;
    audio.play('whistle');
    const from = this.world.def;
    this.game.transition(() => (this.game.scene = new TrainScene(this.game, from, dest)));
  }

  draw(r: Renderer) {
    this.world.draw(r);
    r.screen();
    if (this.world.player.fade > 0) r.dither(this.world.player.fade, 0);
    if (!this.dialog) drawHud(r, this.game.profile, this.world.time);
    if (this.bossBar) this.drawBossBar(r);
    if (this.game.debug) this.drawDebug(r);
    this.drawCards(r);
    this.dialog?.draw(r);
    if (this.menu) this.drawMenu(r);
    if (this.paused) this.drawPause(r);
  }

  private fadeOf(c: Card) {
    const inT = Math.min(1, c.t / 0.4);
    const outT = Math.min(1, (c.dur - c.t) / 0.5);
    return Math.max(0, Math.min(inT, outT));
  }

  private drawCards(r: Renderer) {
    if (this.areaCard) {
      const a = this.fadeOf(this.areaCard);
      if (a > 0.15) {
        const shown = Math.ceil(this.areaCard.text.length * Math.min(1, this.areaCard.t / 0.6));
        r.textOutlined(this.areaCard.text.slice(0, shown), 10, 30, 3, 2);
        r.dither(1 - a, 0, 6, 26, textWidth(this.areaCard.text, 2) + 10, 18);
      }
    }
    if (this.bannerCard) {
      const b = this.bannerCard;
      const a = this.fadeOf(b);
      if (a <= 0) return;
      const h = b.sub ? 34 : 24;
      const y = 58;
      r.dither(0.75 * a, 0, 0, y, W, h);
      if (a > 0.5) {
        r.rect(0, y, W, 1, 2);
        r.rect(0, y + h - 1, W, 1, 2);
        r.textCenter(b.text, W / 2, y + 6, 3, 2, true);
        if (b.sub) r.textCenter(b.sub, W / 2, y + 22, 2, 1, true);
      }
    }
  }

  private drawBossBar(r: Renderer) {
    const b = this.bossBar!;
    b.shown += (b.frac - b.shown) * 0.08;
    const w = 180;
    const x = (W - w) >> 1;
    const y = H - 14;
    r.textCenter(b.name, W / 2, y - 8, 3, 1, true);
    r.rect(x - 1, y - 1, w + 2, 6, 0);
    r.frame(x - 1, y - 1, w + 2, 6, 2);
    r.rect(x + 1, y + 1, Math.round((w - 2) * b.shown), 2, 1);
    r.rect(x + 1, y + 1, Math.round((w - 2) * b.frac), 2, 3);
  }

  private drawMenu(r: Renderer) {
    const m = this.menu!;
    const prof = this.game.profile;
    const w = 176;
    const h = 30 + m.items.length * 12;
    const x = (W - w) >> 1;
    const y = (H - h) >> 1;
    r.dither(0.6, 0);
    r.rect(x, y, w, h, 0);
    r.frame(x, y, w, h, 3);
    r.frame(x + 2, y + 2, w - 4, h - 4, 1);
    r.textCenter('SPIRIT RAIL', W / 2, y + 7, 3);
    m.items.forEach((def, i) => {
      const open = prof.unlocked.includes(def.id);
      const here = def.id === this.world.def.id;
      const lit = prof.flags[`goal:${def.id}`];
      const label = open ? def.station + (here ? ' (HERE)' : '') : '? ? ?';
      const ty = y + 19 + i * 12;
      if (i === m.index) r.text('→', x + 8, ty, 3);
      r.text(label, x + 16, ty, i === m.index ? 3 : open ? 2 : 1);
      if (lit) r.sprite('hud', 'soul', x + w - 52, ty);
      // each world's own four colours: a peek at where the line goes
      if (open) {
        def.palette.forEach((c, k) => {
          r.ctx.fillStyle = c;
          r.ctx.fillRect(x + w - 40 + k * 8, ty - 1, 7, 7);
        });
        r.frame(x + w - 41, ty - 2, 33, 9, 1);
      }
    });
    r.textCenter('Z BOARD   X CANCEL', W / 2, y + h - 9, 1);
  }

  private drawPause(r: Renderer) {
    r.dither(0.7, 0);
    r.textCenter('PAUSED', W / 2, 18, 3, 2, true);
    const p = this.game.profile;
    const worlds = allWorlds();
    const lit = worlds.filter((w) => p.flags[`goal:${w.id}`]).length;
    r.textCenter(`${this.world.def.name.toUpperCase()}   LANTERNS ${lit}/${worlds.length}   SOULS ${p.souls}`, W / 2, 36, 2, 1, true);
    const lines = [
      '← →  MOVE          Z / SPACE  JUMP',
      '↑    TALK / USE    X          STRIKE',
      '↓+Z  DROP THROUGH  C / SHIFT  DASH',
      '',
      'STRIKE DOWN IN MID-AIR TO POGO OFF FOES',
      'STRIKE PROJECTILES TO SEND THEM BACK',
      '',
      `M  MUSIC ${this.game.audio.musicOn ? 'ON' : 'OFF'}      C  RETURN TO LAST LANTERN`,
      'ENTER / ESC  RESUME      X  QUIT TO TITLE',
    ];
    lines.forEach((l, i) => r.textCenter(l, W / 2, 56 + i * 9, i < 3 ? 3 : 2));
  }

  private drawDebug(r: Renderer) {
    const w = this.world;
    r.camera(Math.round(w.camera.x), Math.round(w.camera.y));
    for (const e of [...w.entities, w.player]) {
      const b = e.hurtbox();
      r.frame(b.x, b.y, Math.max(1, b.w), Math.max(1, b.h), 3);
    }
    r.screen();
    const p = w.player;
    r.textOutlined(
      `${p.state} ${p.x},${p.y} T${Math.floor(p.cx / 8)},${Math.floor(p.bottom / 8)} V${Math.round(p.vx)},${Math.round(p.vy)} E${w.entities.length}${this.game.fly ? ' FLY' : ''}  F FLY  N WARP`,
      6,
      H - 8,
      3,
    );
  }
}
