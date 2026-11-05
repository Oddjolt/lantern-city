/**
 * Offline art previews and map checks — no browser needed.
 *
 *   npx tsx scripts/render.ts sprites <worldId> [sheetId ...]  sprite sheets (all frames) in a world's palette
 *   npx tsx scripts/render.ts map <worldId> [fromCol toCol]    the tile map + entity symbols, 10-tile grid ticks
 *   npx tsx scripts/render.ts backdrop <worldId>               the far/near parallax layers
 *   npx tsx scripts/render.ts check <worldId>                  validate the map (sizes, symbols, spawns, kinds)
 *
 * Options: --scale N (default 4 for sprites, 2 for map/backdrop), --out path.png
 * Images are written to ./previews/ by default.
 */
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { glyphBits } from '../src/engine/font';
import { hexToRgb, type Palette } from '../src/engine/palette';
import { CLEAR, PixelBuffer } from '../src/engine/pixels';
import { allSheets } from '../src/engine/sprites';
import { T, TILE, TileMap } from '../src/engine/tilemap';
import '../src/game/common/index';
import { BASE_LEGEND, entityFactory, TILE_OF, type SpawnOpts, type WorldDef } from '../src/game/registry';
import { encodePng } from './png';

const args = process.argv.slice(2);
const opt = (name: string) => {
  const i = args.indexOf(`--${name}`);
  if (i < 0) return undefined;
  const v = args[i + 1];
  args.splice(i, 2);
  return v;
};
const scaleArg = opt('scale');
const outArg = opt('out');
const [cmd, worldId, ...rest] = args;

async function loadWorld(id: string): Promise<WorldDef> {
  // load every world (as the game does) so cross-world entity kinds resolve
  for (const dir of readdirSync(resolve('src/content/worlds'))) {
    if (dir === id || !existsSync(resolve(`src/content/worlds/${dir}/index.ts`))) continue;
    try {
      await import(resolve(`src/content/worlds/${dir}/index.ts`));
    } catch {
      /* a broken neighbour doesn't stop this world's checks */
    }
  }
  const mod = (await import(resolve(`src/content/worlds/${id}/index.ts`))) as { default: WorldDef };
  return mod.default;
}

function text(b: PixelBuffer, s: string, x: number, y: number, c: number) {
  for (let i = 0; i < s.length; i++) {
    const bits = glyphBits(s[i]);
    if (!bits) continue;
    for (let p = 0; p < 15; p++) if (bits[p] === '#') b.set(x + i * 4 + (p % 3), y + Math.floor(p / 3), c);
  }
}

function save(b: PixelBuffer, palette: Palette, scale: number, name: string) {
  const w = b.w * scale;
  const h = b.h * scale;
  const rgba = new Uint8Array(w * h * 4);
  const rgb = palette.map(hexToRgb);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = b.data[Math.floor(y / scale) * b.w + Math.floor(x / scale)];
      const [r, g, bl] = rgb[c === CLEAR ? 0 : c];
      const o = (y * w + x) * 4;
      rgba[o] = r;
      rgba[o + 1] = g;
      rgba[o + 2] = bl;
      rgba[o + 3] = 255;
    }
  }
  const out = outArg ?? `previews/${name}.png`;
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, encodePng(w, h, rgba));
  console.log(`wrote ${out} (${w}x${h})`);
}

function buildMap(def: WorldDef) {
  const w = Math.max(...def.map.map((r) => r.length));
  const map = new TileMap(w, def.map.length, def.tiles);
  const legend = { ...BASE_LEGEND, ...def.legend };
  const symbols: { ch: string; tx: number; ty: number; opts: SpawnOpts }[] = [];
  const unknown: string[] = [];
  def.map.forEach((row, ty) => {
    for (let tx = 0; tx < row.length; tx++) {
      const ch = row[tx];
      if (TILE_OF[ch] !== undefined) map.set(tx, ty, TILE_OF[ch]);
      else if (ch !== ' ' && ch !== '.') {
        const e = legend[ch];
        if (!e) unknown.push(`'${ch}' at ${tx},${ty}`);
        else symbols.push({ ch, tx, ty, opts: typeof e === 'string' ? { kind: e } : e });
      }
    }
  });
  return { map, symbols, unknown };
}

async function main() {
  if (!cmd || !worldId) {
    console.log('usage: npx tsx scripts/render.ts <sprites|map|backdrop|check> <worldId> …');
    process.exit(1);
  }
  const def = await loadWorld(worldId);

  if (cmd === 'sprites') {
    const scale = Number(scaleArg ?? 4);
    const sheets = allSheets().filter(([id]) => rest.length === 0 || rest.includes(id));
    const rows = sheets.map(([id, s]) => {
      const names = Object.keys(s.frames);
      return { id, s, names, w: names.length * (s.w + 3) + 2, h: s.h + 10 };
    });
    const W = Math.max(120, ...rows.map((r) => r.w));
    const H = rows.reduce((a, r) => a + r.h + 2, 2);
    const b = new PixelBuffer(W, H);
    let y = 2;
    for (const r of rows) {
      text(b, `${r.id} (${r.s.w}x${r.s.h})`, 2, y, 2);
      r.names.forEach((n, i) => {
        const x = 2 + i * (r.s.w + 3);
        for (let k = -1; k <= r.s.w; k++) {
          b.set(x + k, y + 7, 1);
          b.set(x + k, y + 8 + r.s.h, 1);
        }
        b.stamp(r.s.frames[n], x, y + 8);
      });
      y += r.h + 2;
    }
    save(b, def.palette, scale, `${worldId}-sprites${rest.length ? '-' + rest.join('-') : ''}`);
    return;
  }

  if (cmd === 'backdrop') {
    const b = new PixelBuffer(640, 362);
    const far = new PixelBuffer(640, 180);
    const near = new PixelBuffer(640, 180);
    def.backdrop.far?.(far);
    def.backdrop.near?.(near);
    b.blit(far, 0, 0);
    b.blit(far, 0, 182);
    b.blit(near, 0, 182);
    for (let x = 0; x < 640; x++) b.set(x, 181, 2);
    save(b, def.palette, Number(scaleArg ?? 2), `${worldId}-backdrop`);
    return;
  }

  const { map, symbols, unknown } = buildMap(def);

  if (cmd === 'check') {
    const widths = new Set(def.map.map((r) => r.length));
    const problems: string[] = [];
    if (widths.size > 1) problems.push(`rows have different lengths: ${[...widths].join(', ')}`);
    if (unknown.length) problems.push(`unknown symbols: ${unknown.slice(0, 20).join('; ')}`);
    const kinds = new Set(symbols.map((s) => s.opts.kind));
    for (const k of kinds) if (k !== 'start' && !entityFactory(k)) problems.push(`no entity registered for kind '${k}'`);
    if (!symbols.some((s) => s.opts.kind === 'station')) problems.push(`no 'T' station (arrivals by train need one)`);
    if (!symbols.some((s) => s.opts.kind === 'goal')) problems.push(`no 'E' sector lantern goal`);
    const count = (k: string) => symbols.filter((s) => s.opts.kind === k).length;
    console.log(`${def.id}: ${map.w}x${map.h} tiles (${map.pw}x${map.ph}px), ${symbols.length} entities`);
    console.log(
      `  checkpoints ${count('checkpoint')}, souls ${count('soul')}, world-specific entities ${symbols.filter((s) => s.opts.kind.includes(':')).length}, kinds: ${[...kinds].join(', ')}`,
    );
    if (problems.length) {
      console.log('PROBLEMS:\n  ' + problems.join('\n  '));
      process.exit(1);
    }
    console.log('OK');
    return;
  }

  if (cmd === 'map') {
    const from = Number(rest[0] ?? 0);
    const to = Math.min(map.w, Number(rest[1] ?? map.w));
    const full = new PixelBuffer(map.pw, map.ph);
    def.tiles.paint(full, map);
    for (let ty = 0; ty < map.h; ty++) {
      for (let tx = 0; tx < map.w; tx++) {
        const t = map.get(tx, ty);
        if (t !== T.Water && t !== T.Acid && t !== T.Updraft && t !== T.Stop) continue; // (':' back walls are painted by the style)
        for (let y = 0; y < TILE; y++)
          for (let x = 0; x < TILE; x++) {
            const px = tx * TILE + x;
            const py = ty * TILE + y;
            if (t === T.Stop) {
              if (x === y || x === 7 - y) full.set(px, py, 1);
            } else if (t === T.Updraft) {
              if ((x + y * 3) % 7 === 0) full.set(px, py, 1);
            } else if ((x + y) % 2 === 0) full.set(px, py, t === T.Water ? 1 : 2);
          }
      }
    }
    for (const s of symbols) {
      full.rect(s.tx * TILE, s.ty * TILE, 7, 8, 0);
      text(full, s.ch, s.tx * TILE + 2, s.ty * TILE + 1, 3);
    }
    for (let tx = 0; tx < map.w; tx += 10) {
      for (let y = 0; y < 4; y++) full.set(tx * TILE, y, 3);
      text(full, String(tx), tx * TILE + 2, 1, 3);
    }
    const crop = new PixelBuffer((to - from) * TILE, map.ph);
    for (let y = 0; y < crop.h; y++)
      for (let x = 0; x < crop.w; x++) crop.data[y * crop.w + x] = full.get(from * TILE + x, y);
    save(crop, def.palette, Number(scaleArg ?? 2), `${worldId}-map${rest.length ? `-${from}-${to}` : ''}`);
    return;
  }
  console.log(`unknown command ${cmd}`);
}

void main();
