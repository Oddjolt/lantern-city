import { hash2, overlaps } from '../../engine/math';
import type { Renderer } from '../../engine/renderer';
import { Anim, getSheet } from '../../engine/sprites';
import { saveProfile } from '../profile';
import { Entity } from '../entity';
import { FloatText } from './fx';
import type { Player } from '../player';
import type { World } from '../world';

/** Lantern checkpoint: touching it saves, heals and becomes your respawn point. */
export class Checkpoint extends Entity {
  readonly id: string;
  private anim = new Anim('lantern', 'off');
  private healCooldown = 0;

  constructor(world: World, x: number, y: number) {
    super(world, x - 2, y - 18, 12, 26);
    this.depth = -2;
    this.id = `${world.def.id}:${x / 8},${y / 8}`;
    world.spawns.set(this.id, { x: x + 4, y: y + 8 });
  }

  get active() {
    const s = this.world.game.profile.spawn;
    return s.kind === 'checkpoint' && s.id === this.id;
  }

  update(dt: number) {
    this.anim.play(this.active ? 'on' : 'off');
    this.anim.update(dt);
    this.healCooldown -= dt;
    const p = this.world.player;
    if (!p.alive || !overlaps(this, p)) return;
    const prof = this.world.game.profile;
    if (!this.active) {
      prof.spawn = { kind: 'checkpoint', id: this.id };
      prof.worldId = this.world.def.id;
      prof.hp = prof.maxHp;
      saveProfile(prof);
      this.world.sfx('checkpoint');
      this.world.particles.burst(this.cx, this.y + 6, 18, { colors: [3, 2], speed: [20, 80], life: [0.4, 0.9], grav: -40 });
      this.world.add(new FloatText(this.world, this.cx, this.y - 6, 'SAVED'));
    } else if (prof.hp < prof.maxHp && this.healCooldown <= 0) {
      prof.hp = prof.maxHp;
      this.healCooldown = 1;
      this.world.sfx('refill');
    }
  }

  drawBack(r: Renderer) {
    if (this.active) r.halo(this.cx, this.y + 6, 20 + (Math.sin(this.world.time * 9) > 0.7 ? 1 : 0), 1);
  }

  draw(r: Renderer) {
    r.sprite('lantern', this.anim.frame, this.cx, this.bottom);
  }

  light() {
    return { x: this.cx, y: this.y + 6, r: this.active ? 70 : 22 };
  }
}

/** The sector lantern at the end of each world: relight it to open the next train line. */
export class Goal extends Entity {
  private anim: Anim;
  private key: string;

  constructor(world: World, x: number, y: number) {
    super(world, x - 8, y - 32, 24, 40);
    this.depth = -2;
    this.key = `goal:${world.def.id}`;
    this.anim = new Anim('goal', world.hasFlag(this.key) ? 'on' : 'off');
  }

  get lit() {
    return this.world.hasFlag(this.key);
  }

  update(dt: number) {
    this.anim.play(this.lit ? 'on' : 'off');
    this.anim.update(dt);
  }

  interact(player: Player) {
    const w = this.world;
    if (this.lit) {
      w.ui.travel();
      return;
    }
    w.setFlag(this.key);
    const prof = w.game.profile;
    const next = w.def.unlocks;
    if (next && !prof.unlocked.includes(next)) prof.unlocked.push(next);
    prof.hp = prof.maxHp;
    saveProfile(prof);
    w.sfx('powerup');
    w.shake(0.6);
    w.hitstop(0.25);
    w.particles.burst(this.cx, this.y + 14, 40, { colors: [3, 2], speed: [40, 160], life: [0.6, 1.2], grav: -30 });
    player.startCutscene('raise', 1.6, () => {
      w.ui.banner('SECTOR LANTERN RELIT', next ? 'A NEW TRAIN LINE HAS OPENED' : 'THE CITY GLOWS AGAIN');
      if (!next) w.ui.ending();
    });
  }

  drawBack(r: Renderer) {
    if (this.lit) r.halo(this.cx, this.y + 14, 34 + (Math.sin(this.world.time * 7) > 0.6 ? 1 : 0), 1);
  }

  draw(r: Renderer) {
    r.sprite('goal', this.anim.frame, this.cx, this.bottom);
  }

  light() {
    return { x: this.cx, y: this.y + 14, r: this.lit ? 110 : 30 };
  }
}

export interface NpcOpts {
  sheet: string;
  name: string;
  lines: string[];
  /** Alternative dialogue used once a profile flag is set; first match wins. */
  alt?: { flag: string; lines: string[] }[];
  idle?: string;
  talk?: string;
}

/** A friendly character you can talk to with ↑. */
export class Npc extends Entity {
  private anim: Anim;
  private talking = false;
  private facingLeft = false;

  constructor(
    world: World,
    x: number,
    y: number,
    private o: NpcOpts,
  ) {
    // size the body (and so the ↑ prompt above it) from the sprite: tall NPCs get tall hitboxes
    const sheet = getSheet(o.sheet);
    const w = Math.min(24, Math.max(12, sheet.w - 2));
    const h = Math.min(40, Math.max(14, sheet.oy - 2));
    super(world, x + 4 - Math.round(w / 2), y + 8 - h, w, h);
    this.depth = -1;
    this.anim = new Anim(o.sheet, o.idle ?? 'idle');
  }

  update(dt: number) {
    const p = this.world.player;
    if (Math.abs(p.cx - this.cx) < 60) this.facingLeft = p.cx < this.cx;
    this.anim.play(this.talking ? (this.o.talk ?? this.o.idle ?? 'idle') : (this.o.idle ?? 'idle'));
    this.anim.update(dt);
  }

  interact() {
    const lines = this.o.alt?.find((a) => this.world.hasFlag(a.flag))?.lines ?? this.o.lines;
    this.talking = true;
    this.world.ui.say(this.o.name, lines, () => (this.talking = false));
  }

  draw(r: Renderer) {
    r.sprite(this.o.sheet, this.anim.frame, this.cx, this.bottom, { flip: this.facingLeft });
  }
}

/** A readable signpost. */
export class Sign extends Entity {
  constructor(
    world: World,
    x: number,
    y: number,
    private text: string[],
  ) {
    super(world, x - 2, y - 4, 12, 12);
    this.depth = -3;
  }

  interact() {
    this.world.ui.say('', this.text);
  }

  draw(r: Renderer) {
    r.sprite('sign', 'a', this.cx, this.bottom);
  }
}

/**
 * Train station: the conductor stands at the 'T' cell with the parked train to the right.
 * Talk to the conductor to travel between worlds.
 */
export class Station extends Entity {
  private anim = new Anim('conductor', 'idle');
  private talking = false;

  constructor(world: World, x: number, y: number) {
    super(world, x - 3, y - 12, 14, 20);
    this.depth = -1;
    world.spawns.set('station', { x: x - 16, y: y + 8 });
  }

  update(dt: number) {
    this.anim.play(this.talking ? 'talk' : 'idle');
    this.anim.update(dt);
  }

  interact() {
    this.talking = true;
    this.world.ui.say('CONDUCTOR MOSS', ['ALL ABOARD THE SPIRIT RAIL! WHERE TO, LITTLE TWIG?'], () => {
      this.talking = false;
      this.world.ui.travel();
    });
  }

  drawBack(r: Renderer) {
    r.sprite('train', 'w0', this.cx + 82, this.bottom);
    r.halo(this.cx + 12, this.y - 10, 14, 1);
  }

  draw(r: Renderer) {
    r.sprite('conductor', this.anim.frame, this.cx, this.bottom, { flip: this.world.player.cx < this.cx });
  }

  light() {
    return [
      { x: this.cx + 40, y: this.y, r: 72 },
      { x: this.cx + 112, y: this.y, r: 60 },
    ];
  }
}

/** A lamp hanging from the ceiling on a swaying chain. */
export class HangLamp extends Entity {
  private len: number;
  private phase: number;
  private anim = new Anim('hanglamp', 'glow');

  constructor(world: World, x: number, y: number) {
    super(world, x + 4, y, 1, 1);
    this.depth = -4;
    this.len = 6 + Math.floor(hash2(x, y, 4) * 10);
    this.phase = hash2(x, y, 5) * 6;
  }

  private lampPos() {
    const swing = Math.sin(this.world.time * 1.3 + this.phase) * 0.18;
    return { x: this.x + Math.sin(swing) * this.len, y: this.y + Math.cos(swing) * this.len };
  }

  update(dt: number) {
    this.anim.update(dt);
  }

  drawBack(r: Renderer) {
    const p = this.lampPos();
    r.halo(p.x, p.y + 5, 15 + (Math.sin(this.world.time * 11 + this.phase) > 0.8 ? 1 : 0), 1);
  }

  draw(r: Renderer) {
    const p = this.lampPos();
    r.line(this.x, this.y, p.x, p.y, 2);
    r.sprite('hanglamp', this.anim.frame, p.x, p.y);
  }

  light() {
    const p = this.lampPos();
    return { x: p.x, y: p.y + 5, r: 48 };
  }
}

export interface DecorOpts {
  sheet: string;
  anim?: string;
  /** Draw behind terrain (default false = in front of terrain, behind characters). */
  back?: boolean;
  flip?: boolean;
  /** Dark-world light radius / glow halo radius. */
  light?: number;
  halo?: number;
  /** Anchor: 'floor' (feet on the cell's bottom, default), 'ceiling' (hangs from the cell's top), 'center'. */
  anchor?: 'floor' | 'ceiling' | 'center';
  /** Distance in px from the anchor to the light/halo centre (default 6; e.g. 22 for a tall lamp post). */
  glow?: number;
}

/** Any animated prop with no gameplay (statues, crates, crystals, banners…). */
export class Decor extends Entity {
  private anim: Anim;

  constructor(
    world: World,
    x: number,
    y: number,
    private o: DecorOpts,
  ) {
    const anchor = o.anchor ?? 'floor';
    super(world, x + 4, anchor === 'floor' ? y + 8 : anchor === 'ceiling' ? y : y + 4, 1, 1);
    this.depth = o.back ? -20 : -5;
    this.anim = new Anim(o.sheet, o.anim ?? Object.keys(getSheet(o.sheet).anims)[0]);
    this.anim.t = hash2(x, y, 2) * 3;
  }

  update(dt: number) {
    this.anim.update(dt);
  }

  /** Where the glow sits: just above floor decor, just below ceiling decor, on centred decor. */
  private glowY() {
    const a = this.o.anchor ?? 'floor';
    const d = this.o.glow ?? (a === 'center' ? 0 : 6);
    return a === 'ceiling' ? this.y + d : this.y - d;
  }

  drawBack(r: Renderer) {
    if (this.o.halo) r.halo(this.x, this.glowY(), this.o.halo, 1);
    if (this.o.back) r.sprite(this.o.sheet, this.anim.frame, this.x, this.y, { flip: this.o.flip });
  }

  draw(r: Renderer) {
    if (!this.o.back) r.sprite(this.o.sheet, this.anim.frame, this.x, this.y, { flip: this.o.flip });
  }

  light() {
    return this.o.light ? { x: this.x, y: this.glowY(), r: this.o.light } : null;
  }
}
