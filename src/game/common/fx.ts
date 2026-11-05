import type { Renderer } from '../../engine/renderer';
import { Anim } from '../../engine/sprites';
import { Entity } from '../entity';
import type { AttackDir, Player } from '../player';
import type { World } from '../world';

/** The crescent swoosh of the player's stick; follows the player while it plays. */
export class SlashFx extends Entity {
  private anim: Anim;
  private sheet: string;

  constructor(
    world: World,
    private player: Player,
    dir: AttackDir,
    alt: boolean,
  ) {
    super(world, player.x, player.y, 1, 1);
    this.depth = 12;
    this.sheet = dir === 'fwd' ? 'slash' : dir === 'up' ? 'slash-up' : 'slash-down';
    this.anim = new Anim(this.sheet, dir === 'fwd' && alt ? 'b' : 'a');
  }

  update(dt: number) {
    this.anim.update(dt);
    if (this.anim.done || !this.player.alive) this.removed = true;
  }

  draw(r: Renderer) {
    const p = this.player;
    r.sprite(this.sheet, this.anim.frame, p.cx, p.cy, { flip: p.facing < 0 });
  }
}

/** A fading single-colour copy of a sprite frame (dash trails). */
export class Afterimage extends Entity {
  private t = 0;

  constructor(
    world: World,
    private sheet: string,
    private frame: string,
    private px: number,
    private py: number,
    private flip: boolean,
    private color = 1,
    private life = 0.2,
  ) {
    super(world, px, py, 1, 1);
    this.depth = 9;
  }

  update(dt: number) {
    this.t += dt;
    if (this.t >= this.life) this.removed = true;
  }

  draw(r: Renderer) {
    if (this.t > this.life * 0.5 && Math.floor(this.t * 40) % 2) return;
    r.sprite(this.sheet, this.frame, this.px, this.py, { flip: this.flip, tint: this.color });
  }
}

/** A little word that floats up and blinks out ("SAVED"). */
export class FloatText extends Entity {
  private t = 0;

  constructor(
    world: World,
    x: number,
    y: number,
    private text: string,
    private life = 1.3,
  ) {
    super(world, x, y, 1, 1);
    this.depth = 25;
  }

  update(dt: number) {
    this.t += dt;
    if (this.t >= this.life) this.removed = true;
  }

  draw(r: Renderer) {
    if (this.t > this.life * 0.7 && Math.floor(this.t * 20) % 2) return;
    r.textCenter(this.text, this.x, this.y - Math.min(10, this.t * 24), 3, 1, true);
  }
}

/** Plays a one-shot animation at a point, then disappears. */
export class OneShot extends Entity {
  private anim: Anim;

  constructor(
    world: World,
    private sheet: string,
    anim: string,
    px: number,
    py: number,
  ) {
    super(world, px, py, 1, 1);
    this.depth = 20;
    this.anim = new Anim(sheet, anim);
  }

  update(dt: number) {
    this.anim.update(dt);
    if (this.anim.done) this.removed = true;
  }

  draw(r: Renderer) {
    r.sprite(this.sheet, this.anim.frame, this.x, this.y);
  }
}
