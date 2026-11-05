/**
 * Content statistics: how much art/animation/code each world needed.
 *   npx tsx scripts/stats.ts
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { allSheets } from '../src/engine/sprites';
import '../src/game/common/index';
import { BASE_LEGEND, TILE_OF, type WorldDef } from '../src/game/registry';

const lines = (dir: string): number =>
  readdirSync(dir).reduce((n, f) => {
    const p = join(dir, f);
    return n + (statSync(p).isDirectory() ? lines(p) : f.endsWith('.ts') ? readFileSync(p, 'utf8').split('\n').length : 0);
  }, 0);

function count(before: Set<string>) {
  const sheets = allSheets().filter(([id]) => !before.has(id));
  return {
    sheets: sheets.length,
    anims: sheets.reduce((n, [, s]) => n + Object.keys(s.anims).length, 0),
    frames: sheets.reduce((n, [, s]) => n + Object.keys(s.frames).length, 0),
  };
}

async function main() {
  const shared = count(new Set());
  console.log(`shared art: ${shared.sheets} sheets, ${shared.anims} animations, ${shared.frames} frames`);
  console.log(`engine: ${lines('src/engine')} lines · game: ${lines('src/game')} lines · shared art: ${lines('src/art')} lines\n`);
  const root = 'src/content/worlds';
  let total = { sheets: 0, anims: 0, frames: 0 };
  for (const id of readdirSync(root).filter((f) => statSync(join(root, f)).isDirectory())) {
    const before = new Set(allSheets().map(([s]) => s));
    let def: WorldDef;
    try {
      def = ((await import(resolve(root, id, 'index.ts'))) as { default: WorldDef }).default;
    } catch (e) {
      console.log(`${id}: failed to load (${(e as Error).message})`);
      continue;
    }
    const c = count(before);
    const legend = { ...BASE_LEGEND, ...def.legend };
    const ents = def.map.join('').split('').filter((ch) => TILE_OF[ch] === undefined && legend[ch]).length;
    const w = Math.max(...def.map.map((r) => r.length));
    console.log(
      `${id.padEnd(10)} ${String(w).padStart(3)}x${String(def.map.length).padEnd(3)} tiles · ${String(ents).padStart(3)} entities · ` +
        `${c.sheets} sheets / ${c.anims} anims / ${c.frames} frames · ${lines(join(root, id))} lines${def.hidden ? ' (dev)' : ''}`,
    );
    if (!def.hidden) {
      total = { sheets: total.sheets + c.sheets, anims: total.anims + c.anims, frames: total.frames + c.frames };
    }
  }
  console.log(`\nworld art total: ${total.sheets} sheets, ${total.anims} animations, ${total.frames} frames`);
}

void main();
