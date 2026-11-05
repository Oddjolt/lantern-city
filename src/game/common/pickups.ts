import { approach, overlaps, rand } from '../../engine/math';
import type { Renderer } from '../../engine/renderer';
import { Anim } from '../../engine/sprites';
import { saveProfile } from '../profile';
import { Entity } from '../entity';
import type { World } from '../world';
import { OneShot } from './fx';

/** Currency. Placed souls are remembered once taken; souls dropped by enemies are not. */
export class SoulOrb extends Entity {
  private t = Math.random() * 10;
  private delay: number;
  private anim = new Anim('soul', 'spin');

  constructor(
    world: World,
    x: number,
    y: number,
    private dropped = false,
    private key: string | null = null,
  ) {
    super(world, x - 3, y - 3, 7, 7);
    this.depth = 1;
    this.delay = dropped ? 0.4 : 0;
    if (dropped) {
      const a = -Math.PI / 2 + rand(-1.1, 1.1);
      const s = rand(70, 140);
      this.vx = Math.cos(a) * s;
      this.vy = Math.sin(a) * s;
    }
  }

  update(dt: number) {
    this.t += dt;
    this.delay -= dt;
    this.anim.update(dt);
    const p = this.world.player;
    if (this.dropped && this.delay > 0) {
      this.vy = approach(this.vy, 160, 400 * dt);
      this.vx *= 0.98;
      this.moveX(this.vx * dt, () => (this.vx *= -0.5));
      this.moveY(this.vy * dt, () => (this.vy *= -0.4));
      return;
    }
    const dx = p.cx - this.cx;
    const dy = p.cy - this.cy;
    const d = Math.hypot(dx, dy) || 1;
    if (p.alive && d < 40 && this.world.lineOfSight(this.cx, this.cy, p.cx, p.cy)) {
      this.vx = approach(this.vx, (dx / d) * 230, 1000 * dt);
      this.vy = approach(this.vy, (dy / d) * 230, 1000 * dt);
      this.moveFree(this.vx * dt, this.vy * dt);
    } else if (this.dropped) {
      this.vx = approach(this.vx, 0, 200 * dt);
      this.vy = approach(this.vy, Math.sin(this.t * 3) * 6, 200 * dt);
      this.moveFree(this.vx * dt, this.vy * dt);
    }
    if (p.alive && overlaps(this, p)) {
      this.removed = true;
      this.world.game.profile.souls++;
      if (this.key) this.world.setFlag(this.key);
      this.world.sfx('soul');
      this.world.particles.burst(this.cx, this.cy, 5, { colors: [3, 2], speed: [20, 60], life: [0.2, 0.4] });
    }
  }

  draw(r: Renderer) {
    const bob = this.dropped ? 0 : Math.round(Math.sin(this.t * 3) * 1.5);
    r.sprite('soul', this.anim.frame, this.cx, this.cy + bob);
  }

  light() {
    return { x: this.cx, y: this.cy, r: 10 };
  }
}

/** Raises max health by one. */
export class HeartVessel extends Entity {
  private t = 0;
  private anim = new Anim('heart', 'beat');

  constructor(
    world: World,
    x: number,
    y: number,
    private key: string,
  ) {
    super(world, x, y, 9, 8);
    this.depth = 1;
  }

  update(dt: number) {
    this.t += dt;
    this.anim.update(dt);
    const p = this.world.player;
    if (!p.alive || !overlaps(this, p)) return;
    this.removed = true;
    const prof = this.world.game.profile;
    prof.maxHp++;
    prof.hp = prof.maxHp;
    this.world.setFlag(this.key);
    saveProfile(prof);
    this.world.sfx('powerup');
    this.world.hitstop(0.15);
    this.world.particles.burst(this.cx, this.cy, 20, { colors: [3, 2], speed: [30, 110], life: [0.4, 0.8] });
    this.world.ui.banner('WOODEN HEART', 'MAX HEALTH +1');
  }

  draw(r: Renderer) {
    r.sprite('heart', this.anim.frame, this.cx, this.cy + Math.round(Math.sin(this.t * 2.5) * 2));
  }

  drawBack(r: Renderer) {
    r.halo(this.cx, this.cy, 12, 1);
  }

  light() {
    return { x: this.cx, y: this.cy, r: 28 };
  }
}

export type Ability = 'dash' | 'doubleJump';

const ABILITY_TEXT: Record<Ability, [string, string]> = {
  dash: ['SPIRIT DASH', 'PRESS C TO DASH IN ANY OF 8 DIRECTIONS'],
  doubleJump: ['EMBER WINGS', 'PRESS JUMP AGAIN IN MID-AIR'],
};

/** A pedestal holding an ability orb. */
export class Shrine extends Entity {
  private t = 0;
  private orb = new Anim('orb', 'pulse');

  constructor(
    world: World,
    x: number,
    y: number,
    private ability: Ability,
  ) {
    super(world, x - 4, y - 18, 16, 26);
    this.depth = -1;
  }

  private get taken() {
    return this.world.game.profile.abilities[this.ability];
  }

  update(dt: number) {
    this.t += dt;
    this.orb.update(dt);
    const p = this.world.player;
    if (this.taken || !p.alive || p.state !== 'normal' || !overlaps(this, p)) return;
    const prof = this.world.game.profile;
    prof.abilities[this.ability] = true;
    saveProfile(prof);
    this.world.sfx('powerup');
    this.world.hitstop(0.2);
    this.world.shake(0.4);
    this.world.add(new OneShot(this.world, 'ring', 'pop', this.cx, this.y + 4));
    this.world.particles.burst(this.cx, this.y + 4, 30, { colors: [3, 2], speed: [40, 140], life: [0.5, 1] });
    p.startCutscene('raise', 1.4, () => this.world.ui.banner(...ABILITY_TEXT[this.ability]));
  }

  drawBack(r: Renderer) {
    if (!this.taken) r.halo(this.cx, this.y + 4, 16 + Math.round(Math.sin(this.t * 4)), 1);
  }

  draw(r: Renderer) {
    r.sprite('shrine', 'a', this.cx, this.bottom);
    if (!this.taken) r.sprite('orb', this.orb.frame, this.cx, this.y + 4 + Math.round(Math.sin(this.t * 2) * 2));
  }

  light() {
    return { x: this.cx, y: this.y + 4, r: this.taken ? 16 : 40 };
  }
}
