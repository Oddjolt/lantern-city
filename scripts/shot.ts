/**
 * In-game screenshots without a browser: the real World + renderer drawn into a Node canvas.
 *
 *   npx tsx scripts/shot.ts <worldId> <tileX> <floorRow> [--wait 1.2] [--scale 3] [--out file.png]
 *       stand the player at that tile (feet on top of row `floorRow`), let the world run, save the frame
 *   npx tsx scripts/shot.ts <worldId> --tour [--scale 2]
 *       contact sheet: every spawn point, checkpoint, the goal and a sample of enemies, one frame each
 *
 * Options: --raw (no abilities), --no-enemies, --no-hud. Output defaults to previews/shot-<world>-….png
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { Enemy } from '../src/game/enemy';
import { drawHud } from '../src/game/ui/hud';
import { loadWorldDef, makeRenderer, makeWorld, realCanvas } from './sim';

const args = process.argv.slice(2);
const flag = (n: string) => {
  const i = args.indexOf(`--${n}`);
  if (i < 0) return false;
  args.splice(i, 1);
  return true;
};
const opt = (n: string, d: string) => {
  const i = args.indexOf(`--${n}`);
  if (i < 0) return d;
  const v = args[i + 1];
  args.splice(i, 2);
  return v;
};
const tour = flag('tour');
const raw = flag('raw');
const noEnemies = flag('no-enemies');
const noHud = flag('no-hud');
const wait = Number(opt('wait', '1.2'));
const scale = Number(opt('scale', tour ? '2' : '3'));
const out = opt('out', '');
const [id, sx, sy] = args;
if (!realCanvas) {
  console.log('needs @napi-rs/canvas (npm i -D @napi-rs/canvas)');
  process.exit(1);
}
if (!id || (!tour && (sx === undefined || sy === undefined))) {
  console.log('usage: npx tsx scripts/shot.ts <worldId> <tileX> <floorRow> | --tour');
  process.exit(1);
}
const def = await loadWorldDef(id);
const r = makeRenderer();
r.setPalette(def.palette);

/** Render one frame with the player standing at a spot (pixel feet position). */
function frameAt(px: number, py: number) {
  const { world, profile } = makeWorld(def, {
    enemies: !noEnemies,
    abilities: raw ? { dash: false, doubleJump: false } : undefined,
  });
  profile.hp = profile.maxHp;
  world.player.place(px, py);
  world.camera.snap(world.player.cx, world.player.cy);
  for (let i = 0; i < wait * 60; i++) world.update(1 / 60);
  world.draw(r);
  if (!noHud) drawHud(r, profile, world.time);
  return { world, canvas: r.canvas as unknown as import('@napi-rs/canvas').Canvas };
}

function save(canvas: import('@napi-rs/canvas').Canvas, name: string) {
  const big = realCanvas!.createCanvas(canvas.width * scale, canvas.height * scale);
  const ctx = big.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(canvas, 0, 0, big.width, big.height);
  const file = out || `previews/shot-${name}.png`;
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, big.toBuffer('image/png'));
  console.log(`wrote ${file} (${big.width}x${big.height})`);
}

if (!tour) {
  const { canvas } = frameAt(Number(sx) * 8 + 4, Number(sy) * 8);
  save(canvas, `${id}-${sx}-${sy}`);
} else {
  const probe = makeWorld(def, { enemies: true }).world;
  const spots: { label: string; x: number; y: number }[] = [...probe.spawns.entries()].map(([k, p]) => ({ label: k, ...p }));
  for (const e of probe.entities) if (e.constructor.name === 'Goal') spots.push({ label: 'goal', x: e.cx - 24, y: e.bottom });
  const enemies = probe.entities.filter((e) => e instanceof Enemy);
  for (let i = 0; i < enemies.length; i += Math.max(1, Math.floor(enemies.length / 6)))
    spots.push({ label: enemies[i].constructor.name, x: enemies[i].cx - 40, y: enemies[i].bottom });
  spots.sort((a, b) => a.x - b.x);
  const cols = 3;
  const rows = Math.ceil(spots.length / cols);
  const sheet = realCanvas.createCanvas(cols * 322, rows * 182);
  const sctx = sheet.getContext('2d');
  sctx.fillStyle = '#888';
  sctx.fillRect(0, 0, sheet.width, sheet.height);
  spots.forEach((s, i) => {
    const { canvas } = frameAt(s.x, s.y);
    sctx.drawImage(canvas, (i % cols) * 322 + 1, Math.floor(i / cols) * 182 + 1);
  });
  console.log(spots.map((s, i) => `${i + 1}:${s.label}@${Math.floor(s.x / 8)},${Math.floor(s.y / 8)}`).join('  '));
  save(sheet, `${id}-tour`);
}
