/**
 * One command to check every world: map validation, crash test and route playtest.
 *   npm run qa            (or: npx tsx scripts/qa.ts [worldId ...])
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve('src/content/worlds');
const only = process.argv.slice(2);
const worlds = readdirSync(root).filter(
  (d) => existsSync(resolve(root, d, 'index.ts')) && d !== 'lab' && (only.length === 0 || only.includes(d)),
);

function run(args: string[]) {
  const r = spawnSync('npx', ['tsx', ...args], { encoding: 'utf8' });
  const out = `${r.stdout}\n${r.stderr}`
    .split('\n')
    .filter((l) => l.trim() && !l.startsWith('(world'));
  return { ok: r.status === 0, out };
}

const rows: string[][] = [];
let failed = false;
for (const id of worlds) {
  const check = run(['scripts/render.ts', 'check', id]);
  const smoke = run(['scripts/smoke.ts', id, '10']);
  const routeFile = `scripts/routes/${id}.ts`;
  const route = existsSync(routeFile) ? run([routeFile]) : null;
  const summary = (r: { ok: boolean; out: string[] } | null, pick: RegExp) =>
    !r ? 'no test' : `${r.ok ? 'ok' : 'FAIL'}${r.out.find((l) => pick.test(l)) ? ' — ' + r.out.find((l) => pick.test(l))!.trim() : ''}`;
  rows.push([id, summary(check, /tiles/), summary(smoke, /ms\/tick/), summary(route, /ROUTE|hops|OK|FAIL/)]);
  for (const [name, r] of [
    ['check', check],
    ['smoke', smoke],
    ['route', route],
  ] as const) {
    if (r && !r.ok) {
      failed = true;
      console.log(`\n--- ${id} ${name} failed ---\n${r.out.slice(-12).join('\n')}`);
    }
  }
}
console.log('\nworld        check / smoke / route');
for (const [id, ...cols] of rows) console.log(`${id.padEnd(12)} ${cols.join('\n             ')}`);
process.exit(failed ? 1 : 0);
