import type { Renderer } from '../../engine/renderer';
import type { Profile } from '../profile';

/** Wooden hearts and the soul counter, top-left. */
export function drawHud(r: Renderer, p: Profile, time: number) {
  r.screen();
  for (let i = 0; i < p.maxHp; i++) {
    const full = i < p.hp;
    const beat = full && i === p.hp - 1 && p.hp <= 2 && Math.floor(time * 4) % 2 === 0 ? -1 : 0;
    r.sprite('hud', full ? 'full' : 'empty', 6 + i * 8, 6 + beat);
  }
  r.sprite('hud', 'soul', 6, 16);
  r.textOutlined(String(p.souls), 13, 16, 3);
}
