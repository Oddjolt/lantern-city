import type { Audio } from '../../engine/audio';
import { wrap } from '../../engine/font';
import type { Input } from '../../engine/input';
import type { Renderer } from '../../engine/renderer';

const MAX_CHARS = 72;

/** Typewriter dialogue box. Confirm skips the typing, then advances; closes after the last line. */
export class Dialog {
  done = false;
  private line = 0;
  private shown = 0;
  private t = 0;
  private pages: string[][];

  constructor(
    readonly speaker: string,
    lines: string[],
    readonly onDone?: () => void,
  ) {
    this.pages = lines.map((l) => wrap(l, MAX_CHARS));
  }

  update(dt: number, input: Input, audio: Audio) {
    this.t += dt;
    const total = this.pages[this.line].join('').length;
    const advance = input.pressed('confirm') || input.pressed('attack') || input.pressed('up');
    if (this.shown < total) {
      const before = Math.floor(this.shown);
      this.shown = Math.min(total, this.shown + dt * 48);
      if (Math.floor(this.shown) !== before && before % 3 === 0) audio.play('blip');
      if (advance && this.t > 0.1) this.shown = total;
    } else if (advance) {
      audio.play('select');
      this.line++;
      this.shown = 0;
      if (this.line >= this.pages.length) this.done = true;
    }
  }

  draw(r: Renderer) {
    r.screen();
    const x = 14;
    const y = 14;
    const w = 292;
    const h = 46;
    r.rect(x, y, w, h, 0);
    r.frame(x, y, w, h, 3);
    r.frame(x + 2, y + 2, w - 4, h - 4, 1);
    if (this.speaker) {
      const tw = this.speaker.length * 4 + 7;
      r.rect(x + 8, y - 5, tw, 9, 3);
      r.text(this.speaker, x + 12, y - 3, 0);
    }
    let left = Math.floor(this.shown);
    const page = this.pages[Math.min(this.line, this.pages.length - 1)];
    page.forEach((ln, i) => {
      if (left <= 0) return;
      r.text(ln.slice(0, left), x + 10, y + 10 + i * 8, 3);
      left -= ln.length;
    });
    if (this.shown >= page.join('').length && Math.floor(this.t * 3) % 2 === 0) {
      r.rect(x + w - 14, y + h - 9, 5, 1, 2);
      r.rect(x + w - 13, y + h - 8, 3, 1, 2);
      r.rect(x + w - 12, y + h - 7, 1, 1, 2);
    }
  }
}
