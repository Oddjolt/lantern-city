import { allWorlds } from '../../content/worlds';
import { H, W, type Renderer } from '../../engine/renderer';
import { allSheets, Anim } from '../../engine/sprites';
import type { Game, Scene } from '../game';
import { TitleScene } from './title';

interface Cell {
  anim: Anim;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  scale: number;
}

/**
 * Every sprite sheet and animation in the game, playing live. ↑↓ swaps the palette to show
 * how the same indexed art recolours itself in each world.
 */
export class GalleryScene implements Scene {
  private pages: Cell[][] = [];
  private page = 0;
  private pal = 0;

  constructor(private game: Game) {
    this.layout();
    this.applyPalette();
  }

  private layout() {
    let page: Cell[] = [];
    let x = 4;
    let y = 16;
    let rowH = 0;
    for (const [id, sheet] of allSheets()) {
      for (const name of Object.keys(sheet.anims)) {
        const scale = sheet.w <= 40 && sheet.h <= 34 ? 2 : 1;
        const w = Math.max(74, sheet.w * scale + 6);
        const h = sheet.h * scale + 14;
        if (x + w > W - 2) {
          x = 4;
          y += rowH + 2;
          rowH = 0;
        }
        if (y + h > H - 10) {
          this.pages.push(page);
          page = [];
          x = 4;
          y = 16;
          rowH = 0;
        }
        page.push({ anim: new Anim(id, name), label: `${id} ${name}`, x, y, w, h, scale });
        x += w + 2;
        rowH = Math.max(rowH, h);
      }
    }
    if (page.length) this.pages.push(page);
  }

  private applyPalette() {
    const worlds = allWorlds();
    if (worlds.length) this.game.r.setPalette(worlds[this.pal % worlds.length].palette);
  }

  update(dt: number) {
    const { input, audio } = this.game;
    for (const c of this.pages[this.page] ?? []) c.anim.update(dt);
    if (input.pressed('right')) this.page = (this.page + 1) % this.pages.length;
    if (input.pressed('left')) this.page = (this.page + this.pages.length - 1) % this.pages.length;
    if (input.pressed('up') || input.pressed('down')) {
      const n = Math.max(1, allWorlds().length);
      this.pal = (this.pal + (input.pressed('up') ? n - 1 : 1)) % n;
      this.applyPalette();
      audio.play('blip');
    }
    if ((input.pressed('back') || input.pressed('pause')) && !this.game.transitioning)
      this.game.transition(() => (this.game.scene = new TitleScene(this.game)));
  }

  draw(r: Renderer) {
    r.screen();
    r.clear(0);
    const worlds = allWorlds();
    const world = worlds[this.pal % Math.max(1, worlds.length)];
    r.text(`ANIMATION GALLERY  ${this.page + 1}/${this.pages.length}`, 4, 4, 3);
    r.text(`PALETTE: ${world?.station ?? '-'}`, W - 4 - (`PALETTE: ${world?.station ?? '-'}`.length * 4 - 1), 4, 2);
    for (const c of this.pages[this.page] ?? []) {
      r.frame(c.x, c.y, c.w, c.h, 1);
      r.text(c.label.slice(0, Math.floor((c.w - 4) / 4)), c.x + 2, c.y + 2, 2);
      const sheet = c.anim.sheet;
      const def = allSheets().find(([id]) => id === sheet)![1];
      const left = c.x + Math.floor((c.w - def.w * c.scale) / 2);
      const top = c.y + 10;
      r.sprite(sheet, c.anim.frame, left + def.ox * c.scale, top + def.oy * c.scale, { sx: c.scale, sy: c.scale });
    }
    r.text('← → PAGE   ↑ ↓ PALETTE   X BACK', 4, H - 8, 1);
  }
}
