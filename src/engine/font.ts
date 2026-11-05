import { hexToRgb, type Palette } from './palette';

/** A 3x5 bitmap font (PICO-8 style), written as five `|`-separated rows. Lower case renders as upper case. */
const GLYPHS: Record<string, string> = {
  A: '.#.|#.#|###|#.#|#.#',
  B: '##.|#.#|##.|#.#|##.',
  C: '.##|#..|#..|#..|.##',
  D: '##.|#.#|#.#|#.#|##.',
  E: '###|#..|##.|#..|###',
  F: '###|#..|##.|#..|#..',
  G: '.##|#..|#.#|#.#|.##',
  H: '#.#|#.#|###|#.#|#.#',
  I: '###|.#.|.#.|.#.|###',
  J: '..#|..#|..#|#.#|.#.',
  K: '#.#|#.#|##.|#.#|#.#',
  L: '#..|#..|#..|#..|###',
  M: '#.#|###|###|#.#|#.#',
  N: '##.|#.#|#.#|#.#|#.#',
  O: '.#.|#.#|#.#|#.#|.#.',
  P: '##.|#.#|##.|#..|#..',
  Q: '.#.|#.#|#.#|##.|.##',
  R: '##.|#.#|##.|#.#|#.#',
  S: '.##|#..|.#.|..#|##.',
  T: '###|.#.|.#.|.#.|.#.',
  U: '#.#|#.#|#.#|#.#|.##',
  V: '#.#|#.#|#.#|.#.|.#.',
  W: '#.#|#.#|###|###|#.#',
  X: '#.#|#.#|.#.|#.#|#.#',
  Y: '#.#|#.#|.#.|.#.|.#.',
  Z: '###|..#|.#.|#..|###',
  '0': '###|#.#|#.#|#.#|###',
  '1': '.#.|##.|.#.|.#.|###',
  '2': '##.|..#|.#.|#..|###',
  '3': '##.|..#|.#.|..#|##.',
  '4': '#.#|#.#|###|..#|..#',
  '5': '###|#..|##.|..#|##.',
  '6': '.##|#..|###|#.#|###',
  '7': '###|..#|.#.|.#.|.#.',
  '8': '###|#.#|###|#.#|###',
  '9': '###|#.#|###|..#|##.',
  '.': '...|...|...|...|.#.',
  ',': '...|...|...|.#.|#..',
  '!': '.#.|.#.|.#.|...|.#.',
  '?': '##.|..#|.#.|...|.#.',
  "'": '.#.|.#.|...|...|...',
  '"': '#.#|#.#|...|...|...',
  '-': '...|...|###|...|...',
  '+': '...|.#.|###|.#.|...',
  ':': '...|.#.|...|.#.|...',
  '/': '..#|..#|.#.|#..|#..',
  '(': '.#.|#..|#..|#..|.#.',
  ')': '.#.|..#|..#|..#|.#.',
  '<': '..#|.#.|#..|.#.|..#',
  '>': '#..|.#.|..#|.#.|#..',
  '=': '...|###|...|###|...',
  '*': '...|#.#|.#.|#.#|...',
  '#': '#.#|###|#.#|###|#.#',
  '%': '#.#|..#|.#.|#..|#.#',
  _: '...|...|...|...|###',
  '@': '###|#.#|###|#..|.##',
  '$': '.##|##.|.#.|.##|##.',
  '&': '.#.|#.#|.#.|#.#|.##',
  '|': '.#.|.#.|.#.|.#.|.#.',
  '[': '##.|#..|#..|#..|##.',
  ']': '.##|..#|..#|..#|.##',
  '←': '..#|.##|###|.##|..#',
  '→': '#..|##.|###|##.|#..',
  '↑': '.#.|###|.#.|.#.|.#.',
  '↓': '.#.|.#.|.#.|###|.#.',
};

const CHARS = Object.keys(GLYPHS);
const BITS = CHARS.map((c) => {
  const rows = GLYPHS[c].split('|');
  if (rows.length !== 5 || rows.some((r) => r.length !== 3)) console.warn(`font glyph ${c} is not 3x5`);
  return rows.join('');
});
const INDEX = new Map(CHARS.map((c, i) => [c, i]));
const atlases = new Map<string, HTMLCanvasElement>();

export const GLYPH_W = 4;
export const LINE_H = 7;

function atlas(color: string): HTMLCanvasElement {
  let c = atlases.get(color);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = CHARS.length * 3;
  c.height = 5;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(c.width, 5);
  const [r, g, b] = hexToRgb(color);
  BITS.forEach((bits, i) => {
    for (let p = 0; p < 15; p++) {
      if (bits[p] !== '#') continue;
      const o = (Math.floor(p / 3) * img.width + i * 3 + (p % 3)) * 4;
      img.data[o] = r;
      img.data[o + 1] = g;
      img.data[o + 2] = b;
      img.data[o + 3] = 255;
    }
  });
  ctx.putImageData(img, 0, 0);
  atlases.set(color, c);
  return c;
}

/** 15 chars ('#' = on) for a 3x5 glyph, row-major — used by the offline preview tool. */
export function glyphBits(ch: string): string | undefined {
  const i = INDEX.get(ch.toUpperCase());
  return i === undefined ? undefined : BITS[i];
}

export function textWidth(text: string, scale = 1): number {
  const longest = Math.max(...text.split('\n').map((l) => l.length));
  return Math.max(0, longest * GLYPH_W - 1) * scale;
}

/** Draws text in screen space. `\n` starts a new line. */
export function drawText(
  ctx: CanvasRenderingContext2D,
  palette: Palette,
  text: string,
  x: number,
  y: number,
  color: number,
  scale = 1,
) {
  const img = atlas(palette[color]);
  const lines = text.split('\n');
  for (let l = 0; l < lines.length; l++) {
    const line = lines[l].toUpperCase();
    for (let i = 0; i < line.length; i++) {
      const g = INDEX.get(line[i]);
      if (g === undefined) continue;
      ctx.drawImage(img, g * 3, 0, 3, 5, x + i * GLYPH_W * scale, y + l * LINE_H * scale, 3 * scale, 5 * scale);
    }
  }
}

/** Word-wrap to a maximum number of characters per line. */
export function wrap(text: string, maxChars: number): string[] {
  const out: string[] = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const word of para.split(' ')) {
      if (line && (line + ' ' + word).length > maxChars) {
        out.push(line);
        line = word;
      } else line = line ? line + ' ' + word : word;
    }
    out.push(line);
  }
  return out;
}
