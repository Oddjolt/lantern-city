import { approach, clamp, overlaps, rand, type Rect } from '../../../engine/math';
import { H, type Renderer } from '../../../engine/renderer';
import { Anim } from '../../../engine/sprites';
import { T, TILE } from '../../../engine/tilemap';
import { Bullet } from '../../../game/common/bullet';
import { OneShot } from '../../../game/common/fx';
import { Enemy } from '../../../game/enemy';
import { Entity } from '../../../game/entity';
import type { Player } from '../../../game/player';
import { registerEntity } from '../../../game/registry';
import type { World } from '../../../game/world';
import './boss-art';
import { Ember } from './enemies';
import { wardenMusic } from './music';

const NAME = 'IRON WARDEN';
const MAX_HP = 30;
const FLAG = 'boss:foundry';

/** A wall of molten sparks racing along the floor from a slam. Jump it. */
export class Shockwave extends Entity {
  private t = 0;
  private anim = new Anim('foundry-wave', 'roll');

  constructor(
    world: World,
    x: number,
    floor: number,
    private dir: 1 | -1,
    private speed: number,
  ) {
    super(world, x - 5, floor - 11, 10, 11);
    this.depth = 14;
  }

  update(dt: number) {
    this.t += dt;
    this.anim.update(dt);
    const hit = this.moveX(this.dir * this.speed * dt);
    const w = this.world;
    if (hit || this.t > 4) {
      this.removed = true;
      w.particles.burst(this.cx, this.bottom - 4, 8, { colors: [3, 2], speed: [30, 90], angle: [-2.8, -0.3], life: [0.2, 0.5], grav: 300 });
      return;
    }
    if (Math.random() < dt * 40) w.particles.burst(this.cx - this.dir * 4, this.bottom - 2, 1, { colors: [3, 2, 1], speed: [20, 60], angle: [-2.6, -0.5], life: [0.2, 0.5], grav: 260 });
    const p = w.player;
    if (p.alive && overlaps(this, p)) p.hurt(1, this.cx - this.dir * 8);
  }

  draw(r: Renderer) {
    r.sprite('foundry-wave', this.anim.frame, this.cx, this.bottom, { flip: this.dir < 0 });
  }

  light() {
    return { x: this.cx, y: this.cy, r: 24 };
  }
}

/** Phase 2: a cinder shaken loose from the ceiling. Glints and marks the floor, then drops. */
export class FallingCinder extends Entity {
  private t = 0;
  private falling = false;
  private anim = new Anim('foundry-cinder-drop', 'fall');

  constructor(
    world: World,
    x: number,
    private ceiling: number,
    private floor: number,
    private warn: number,
  ) {
    super(world, x - 3, ceiling, 6, 8);
    this.depth = 14;
  }

  update(dt: number) {
    this.t += dt;
    this.anim.update(dt);
    const w = this.world;
    if (!this.falling) {
      if (Math.random() < dt * 12) w.particles.burst(this.cx, this.ceiling + 2, 1, { colors: [1, 2], speed: [5, 20], angle: [1.3, 1.85], life: [0.4, 0.8], grav: 120 });
      if (this.t >= this.warn) {
        this.falling = true;
        this.vy = 40;
      }
      return;
    }
    this.vy = approach(this.vy, 320, 700 * dt);
    this.moveFree(0, this.vy * dt);
    const p = w.player;
    if (p.alive && overlaps(this, p)) p.hurt(1, this.cx);
    if (this.bottom >= this.floor) {
      this.removed = true;
      w.add(new Ember(w, this.cx, this.floor, 1.2));
      w.particles.burst(this.cx, this.floor - 2, 8, { colors: [3, 2, 1], speed: [30, 90], angle: [-2.8, -0.3], life: [0.2, 0.5], grav: 300 });
      w.sfx('land');
    }
  }

  drawBack(r: Renderer) {
    // the warning: a glowing scorch mark where it will land, growing as it comes loose
    if (this.falling) return;
    landingMark(r, this.cx, this.floor, 5 + Math.min(4, Math.floor(this.t * 6)), this.t);
  }

  draw(r: Renderer) {
    if (!this.falling) {
      if (Math.floor(this.t * 12) % 2) r.rect(this.cx - 1, this.ceiling, 2, 2, 3);
      return;
    }
    r.sprite('foundry-cinder-drop', this.anim.frame, this.cx, this.bottom);
  }

  light() {
    return { x: this.cx, y: this.cy, r: 18 };
  }
}

/** A pulsing scorch mark on the floor: where something heavy is about to land. */
function landingMark(r: Renderer, x: number, floor: number, half: number, t: number) {
  const pulse = Math.floor(t * 12) % 2;
  for (let dx = -half; dx <= half; dx++) {
    const edge = Math.abs(dx) > half - 2;
    r.rect(x + dx, floor - 1, 1, 1, edge ? 2 : 1);
    if (Math.abs(dx) < half - 1 && (dx + pulse) % 2 === 0) r.rect(x + dx, floor - 2, 1, 1, 1);
  }
  if (pulse) {
    r.rect(x - half - 1, floor - 3, 1, 2, 3);
    r.rect(x + half + 1, floor - 3, 1, 2, 3);
  }
}

/** What's left of the Warden once it's beaten (also placed on later visits). */
export class WardenWreck extends Entity {
  constructor(
    world: World,
    x: number,
    floor: number,
    private flip: boolean,
  ) {
    super(world, x - 20, floor - 16, 40, 16);
    this.depth = -6;
  }

  update(dt: number) {
    if (Math.random() < dt * 3)
      this.world.particles.burst(this.cx + rand(-12, 8), this.y + 4, 1, { colors: [1], speed: [5, 15], angle: [-1.9, -1.2], life: [1, 2], drag: 0.5 });
  }

  draw(r: Renderer) {
    r.sprite('foundry-warden', 'wreck', this.cx, this.bottom, { flip: this.flip });
  }
}

type State =
  | 'dormant'
  | 'wake'
  | 'pause'
  | 'backoff'
  | 'chargeTell'
  | 'charge'
  | 'stunned'
  | 'recover'
  | 'leapTell'
  | 'leap'
  | 'slam'
  | 'aimTell'
  | 'fire'
  | 'rainTell'
  | 'rain'
  | 'roar'
  | 'dying';

/**
 * IRON WARDEN — the Barons' enforcer.
 *   CHARGE:  crouches and lowers its head (telegraph), then rams across the arena. It stuns
 *            itself on the wall: the punish window.
 *   LEAP:    crouches, jumps to where you stand (its shadow marks the spot) and slams down,
 *            sending a shockwave each way along the floor. Jump them.
 *   VOLLEY:  raises its cannon, the muzzle glows, then fires slag balls you can strike back
 *            (3 damage each).
 *   Phase 2 (below half health): faster, five-shot volleys, double leaps, and CINDER RAIN —
 *            it roars and shakes burning cinders loose from the ceiling (each glints first).
 */
export class Warden extends Enemy {
  private st: State = 'dormant';
  private t = 0;
  private dir: 1 | -1 = -1;
  private phase2 = false;
  private pendingPhase2 = false;
  private anim = new Anim('foundry-warden', 'dormant');
  private arena: Rect;
  private floor: number;
  private ceiling: number;
  private last = '';
  private shots = 0;
  private leaps = 0;
  private landX = 0;
  private gravity = 1200;
  private boom = 0;
  private finished = false;

  constructor(world: World, x: number, y: number) {
    super(world, x + 4 - 14, y + 8 - 40, 28, 40);
    this.hp = MAX_HP;
    this.knockback = 0;
    this.souls = 0;
    this.contactDamage = 0;
    this.floor = y + 8;
    // the arena runs between the gate columns on either side of the Warden
    const map = world.map;
    const ty = y / TILE;
    let l = x / TILE;
    let r = x / TILE;
    while (l > 0 && map.get(l, ty) !== T.GateOpen) l--;
    while (r < map.w - 1 && map.get(r, ty) !== T.GateOpen) r++;
    let cy = ty;
    while (cy > 0 && !map.solidTile(x / TILE, cy)) cy--;
    this.ceiling = (cy + 1) * TILE;
    this.arena = { x: l * TILE, y: this.floor + 30 - H, w: (r - l + 1) * TILE, h: H };
  }

  private get audio() {
    return this.world.game.audio;
  }

  private set(st: State, t: number) {
    this.st = st;
    this.t = t;
  }

  // ---- the fight ----------------------------------------------------------------------------

  private start() {
    const w = this.world;
    this.set('wake', 2.2);
    w.setGates(true);
    w.arena = this.arena;
    w.ui.title(NAME);
    this.audio.playSong(wardenMusic);
    this.dir = this.playerDir();
  }

  private decide() {
    const p = this.world.player;
    this.dir = this.playerDir();
    const dist = Math.abs(p.cx - this.cx);
    const opts: [string, number][] = [
      ['charge', dist > 90 ? 2.2 : 1.2],
      ['leap', dist < 130 ? 2 : 1.2],
      ['volley', 1.6],
    ];
    if (this.phase2) opts.push(['rain', 1.4]);
    const pool = opts.filter(([k]) => k !== this.last);
    let roll = Math.random() * pool.reduce((a, [, wgt]) => a + wgt, 0);
    let pick = pool[0][0];
    for (const [k, wgt] of pool) {
      roll -= wgt;
      if (roll <= 0) {
        pick = k;
        break;
      }
    }
    this.last = pick;
    const fast = this.phase2;
    if (pick === 'charge') {
      // a charge needs a run-up: back away from you first if the wall is too close
      if (this.roomAhead(this.dir) < 96) this.set('backoff', 0.9);
      else this.chargeTell();
    } else if (pick === 'leap') {
      this.leaps = fast ? 2 : 1;
      this.set('leapTell', fast ? 0.45 : 0.6);
      this.world.sfx('charge');
    } else if (pick === 'volley') {
      this.shots = fast ? 5 : 3;
      this.set('aimTell', fast ? 0.55 : 0.75);
      this.world.sfx('charge');
    } else {
      this.set('rainTell', 0.7);
      this.world.sfx('roar');
      this.world.shake(0.3);
    }
  }

  private chargeTell() {
    this.set('chargeTell', this.phase2 ? 0.55 : 0.75);
    this.world.sfx('growl');
  }

  /** Pixels of open floor in front of the Warden. */
  private roomAhead(dir: number) {
    const y = this.y + 20;
    let d = 0;
    while (d < 400 && !this.world.map.solidPoint(dir > 0 ? this.right + d : this.x - 1 - d, y)) d += 4;
    return d;
  }

  private leap() {
    const p = this.world.player;
    const a = this.arena;
    const target = clamp(p.cx, a.x + 32, a.x + a.w - 32);
    const airtime = this.phase2 ? 0.66 : 0.78;
    this.landX = target;
    this.vx = (target - this.cx) / airtime;
    this.vy = (-this.gravity * airtime) / 2;
    this.dir = target < this.cx ? -1 : 1;
    this.set('leap', 3);
    this.world.particles.burst(this.cx, this.bottom, 10, { colors: [2, 1], speed: [20, 80], angle: [-3, -0.2], life: [0.3, 0.6], grav: 200 });
    this.audio.noise(0.3, 0.2, 'lowpass', 900, 200);
  }

  private slam() {
    const w = this.world;
    this.vx = 0;
    this.vy = 0;
    w.sfx('slam');
    w.shake(0.75);
    w.hitstop(0.08);
    w.particles.burst(this.cx, this.bottom - 2, 24, { colors: [3, 2, 1], speed: [40, 160], angle: [-3.0, -0.15], life: [0.3, 0.8], grav: 400, bounce: true });
    const speed = this.phase2 ? 150 : 120;
    w.add(new Shockwave(w, this.cx - 18, this.floor, -1, speed));
    w.add(new Shockwave(w, this.cx + 18, this.floor, 1, speed));
    this.leaps--;
    this.set('slam', this.leaps > 0 ? 0.35 : this.phase2 ? 0.55 : 0.75);
  }

  /** Where the cannon's muzzle is in the aim pose. */
  private muzzle() {
    return { x: this.cx + this.dir * 27, y: this.bottom - 29 };
  }

  private fire() {
    const w = this.world;
    const p = w.player;
    const m = this.muzzle();
    // aim at the player, measured from the facing direction (positive = downward), clamped
    const raw = Math.atan2(p.cy - m.y, p.cx - m.x);
    let rel = this.dir > 0 ? raw : Math.PI - raw;
    rel = ((((rel + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI;
    rel = clamp(rel + (Math.random() - 0.5) * 0.22, -1.1, 0.9);
    const a = this.dir > 0 ? rel : Math.PI - rel;
    const speed = this.phase2 ? 118 : 104;
    w.add(new Bullet(w, m.x, m.y, Math.cos(a) * speed, Math.sin(a) * speed, { sheet: 'foundry-ball', anim: 'fly', size: 8, life: 4 }));
    w.sfx('shoot');
    this.audio.noise(0.25, 0.18, 'lowpass', 1400, 200);
    w.shake(0.15);
    w.particles.burst(m.x, m.y, 8, { colors: [3, 2], speed: [30, 90], angle: this.dir > 0 ? [-0.8, 0.8] : [2.3, 3.9], life: [0.1, 0.3] });
    this.shots--;
  }

  private rain() {
    const w = this.world;
    const p = w.player;
    const a = this.arena;
    const xs = [clamp(p.cx, a.x + 20, a.x + a.w - 20)];
    const n = 6;
    for (let i = 0; i < n; i++) xs.push(a.x + 24 + ((i + 0.5 + rand(-0.3, 0.3)) / n) * (a.w - 48));
    xs.forEach((x, i) => w.add(new FallingCinder(w, Math.round(x), this.ceiling, this.floor, 0.75 + i * 0.12)));
  }

  private enterPhase2() {
    this.pendingPhase2 = false;
    this.phase2 = true;
    const w = this.world;
    this.set('roar', 1.4);
    w.sfx('roar');
    w.shake(0.7);
    w.hitstop(0.15);
    w.particles.burst(this.cx, this.cy - 6, 30, { colors: [2, 1, 3], speed: [50, 170], life: [0.5, 1.1], size: [1, 3], grav: 320, bounce: true });
  }

  update(dt: number) {
    this.tick(dt);
    const w = this.world;
    const p = w.player;
    this.t -= dt;
    this.smoke(dt);

    if (this.st === 'dormant') {
      this.applyGravity(dt);
      this.physics(dt);
      this.anim.play('dormant');
      if (p.alive && p.x > this.arena.x + 24 && p.right < this.arena.x + this.arena.w - 24 && p.bottom > this.arena.y + 40) this.start();
      return;
    }
    if (this.st === 'dying') return this.dying(dt);

    w.ui.boss(NAME, this.hp / MAX_HP);
    this.contactDamage = this.st === 'stunned' || this.st === 'wake' ? 0 : 1;
    const fast = this.phase2 ? 1.3 : 1;
    const grounded = this.onGround();

    switch (this.st) {
      case 'wake':
        this.vx = 0;
        if (this.t < 1.4 && this.anim.name === 'dormant') {
          this.anim.play('idle');
          this.audio.tone('square', 60, 120, 0.6, 0.06);
        }
        if (this.t < 0.9 && this.anim.name !== 'roar') {
          this.anim.play('roar');
          w.sfx('roar');
          w.shake(0.6);
        }
        if (this.t <= 0) this.set('pause', 0.4);
        break;
      case 'pause': {
        // a few steps towards you between attacks
        const dist = Math.abs(p.cx - this.cx);
        this.dir = this.playerDir();
        this.vx = dist > 50 ? this.dir * 28 * fast : 0;
        if (this.pendingPhase2 && grounded) this.enterPhase2();
        else if (this.t <= 0) this.decide();
        break;
      }
      case 'backoff':
        this.dir = this.playerDir();
        this.vx = -this.dir * 70 * fast;
        if (this.t <= 0 || this.roomAhead(-this.dir) < 6 || this.roomAhead(this.dir) > 140) {
          this.vx = 0;
          this.chargeTell();
        }
        break;
      case 'chargeTell':
        this.vx = 0;
        if (Math.random() < dt * 20) this.vent();
        if (this.t <= 0) {
          this.set('charge', 3);
          this.audio.noise(0.4, 0.2, 'lowpass', 600, 150);
        }
        break;
      case 'charge':
        this.vx = this.dir * 185 * (this.phase2 ? 1.15 : 1);
        if (Math.random() < dt * 40)
          w.particles.burst(this.cx - this.dir * 10, this.bottom - 1, 1, { colors: [2, 1], speed: [20, 60], angle: this.dir > 0 ? [-2.9, -2.2] : [-0.9, -0.2], life: [0.2, 0.5] });
        if (Math.random() < dt * 8) w.sfx('chug');
        if (this.t <= 0) this.set('recover', 0.5);
        break;
      case 'stunned':
        this.vx = approach(this.vx, 0, 200 * dt);
        if (Math.random() < dt * 10)
          w.particles.burst(this.cx + rand(-10, 10), this.y + rand(4, 20), 1, { colors: [3, 2], speed: [30, 80], life: [0.1, 0.3] });
        if (this.t <= 0) {
          this.set('recover', 0.35);
          this.audio.tone('square', 80, 160, 0.3, 0.05);
        }
        break;
      case 'recover':
        this.vx = approach(this.vx, 0, 400 * dt);
        if (this.t <= 0) this.set('pause', this.phase2 ? rand(0.3, 0.55) : rand(0.6, 0.9));
        break;
      case 'leapTell':
        this.vx = 0;
        if (Math.random() < dt * 12) this.vent();
        if (this.t <= 0) this.leap();
        break;
      case 'leap':
        // ballistic: custom gravity, collide with walls and ceiling
        this.vy += this.gravity * dt;
        this.moveX(this.vx * dt, () => (this.vx = 0));
        this.moveY(this.vy * dt, () => {
          if (this.vy > 0) this.slam();
          this.vy = 0;
        });
        break;
      case 'slam':
        this.vx = 0;
        if (this.t <= 0) {
          if (this.leaps > 0) {
            this.set('leapTell', 0.3);
            this.world.sfx('charge');
          } else this.set('recover', 0.2);
        }
        break;
      case 'aimTell':
        this.vx = 0;
        if (Math.random() < dt * 20)
          w.particles.burst(this.muzzle().x, this.muzzle().y, 1, { colors: [3, 2], speed: [10, 30], life: [0.1, 0.3] });
        if (this.t <= 0) {
          this.set('fire', 0);
          this.fire();
          this.t = this.phase2 ? 0.24 : 0.36;
        }
        break;
      case 'fire':
        this.vx = 0;
        if (this.t <= 0) {
          if (this.shots > 0) {
            this.dir = this.playerDir();
            this.fire();
            this.t = this.phase2 ? 0.24 : 0.36;
          } else this.set('recover', 0.6);
        }
        break;
      case 'rainTell':
        this.vx = 0;
        if (Math.random() < dt * 25) this.vent();
        if (this.t <= 0) {
          this.rain();
          w.shake(0.5);
          w.sfx('slam');
          this.set('rain', 1.1);
        }
        break;
      case 'rain':
        this.vx = 0;
        if (this.t <= 0) this.set('recover', 0.4);
        break;
      case 'roar':
        this.vx = 0;
        if (Math.random() < dt * 30) this.vent();
        if (this.t <= 0) this.set('pause', 0.3);
        break;
    }

    if (this.st !== 'leap') {
      this.applyGravity(dt, 900, 300);
      this.physics(dt, () => {
        if (this.st === 'charge') this.crash();
      });
    }
    this.touchPlayer({ x: this.x + 2, y: this.y + 4, w: this.w - 4, h: this.h - 4 });
    this.pickAnim();
    this.anim.update(dt);
  }

  /** The charge ends in the arena wall: the Warden stuns itself. */
  private crash() {
    const w = this.world;
    this.vx = -this.dir * 70;
    this.vy = -90;
    this.set('stunned', this.phase2 ? 1.7 : 2.3);
    w.sfx('slam');
    w.sfx('explode');
    w.shake(0.9);
    w.hitstop(0.12);
    const wx = this.dir > 0 ? this.right + 2 : this.x - 2;
    w.particles.burst(wx, this.cy, 26, { colors: [2, 1, 3], speed: [40, 160], angle: this.dir > 0 ? [2.0, 4.3] : [-1.2, 1.2], life: [0.4, 0.9], grav: 400, bounce: true, size: [1, 3] });
    // dust shaken from the ceiling
    for (let i = 0; i < 12; i++)
      w.particles.burst(this.arena.x + Math.random() * this.arena.w, this.ceiling + 1, 1, { colors: [1, 2], speed: [5, 20], angle: [1.3, 1.85], life: [0.6, 1.2], grav: 200 });
  }

  /** Steam from the shoulder stacks (and a hiss). */
  private vent() {
    for (const off of [-11, -6]) {
      this.world.particles.burst(this.cx + this.dir * off, this.bottom - 47, 1, { colors: [1, 2], speed: [15, 40], angle: [-2.2, -0.9], life: [0.4, 0.8] });
    }
  }

  private smoke(dt: number) {
    if (this.st === 'dormant' || this.dead) return;
    // phase 2: cracked plating spits sparks
    if (this.phase2 && Math.random() < dt * 9)
      this.world.particles.burst(this.cx + rand(-12, 12), this.y + rand(8, 30), 1, { colors: [3, 2], speed: [20, 70], angle: [-2.6, -0.5], life: [0.2, 0.5], grav: 300 });
    if (Math.random() < dt * (this.phase2 ? 8 : 3)) {
      const off = Math.random() < 0.5 ? -11 : -6;
      this.world.particles.burst(this.cx + this.dir * off, this.bottom - 47, 1, { colors: [1], speed: [6, 16], angle: [-1.9, -1.2], life: [0.8, 1.4], drag: 0.6 });
    }
  }

  private pickAnim() {
    const a = this.anim;
    switch (this.st) {
      case 'wake':
        if (a.name === 'dormant') a.play('dormant');
        break;
      case 'pause':
      case 'backoff':
        a.play(Math.abs(this.vx) > 1 ? 'walk' : 'idle');
        break;
      case 'chargeTell':
        a.play(this.t > 0.25 ? 'crouch' : 'bash');
        break;
      case 'charge':
        a.play('bash');
        break;
      case 'stunned':
        a.play('stun');
        break;
      case 'recover':
        a.play('crouch');
        break;
      case 'leapTell':
        a.play('crouch');
        break;
      case 'leap':
        a.play('leap');
        break;
      case 'slam':
        a.play('slam');
        break;
      case 'aimTell':
        a.play('aim');
        break;
      case 'fire':
        a.play(this.t > (this.phase2 ? 0.14 : 0.24) ? 'fire' : 'aim');
        break;
      case 'rainTell':
      case 'rain':
      case 'roar':
        a.play('roar');
        break;
    }
  }

  // ---- taking hits ----------------------------------------------------------------------

  onSlash(player: Player, dx: number, dy: number): boolean {
    if (this.st === 'dormant' || this.st === 'wake') {
      this.world.particles.burst(this.cx, this.cy, 5, { colors: [3, 2], speed: [40, 100], life: [0.1, 0.25] });
      this.audio.tone('square', 1400, 900, 0.06, 0.05);
      return true;
    }
    return super.onSlash(player, dx, dy);
  }

  hurt(dmg: number, dx: number, dy: number): boolean {
    if (this.st === 'dormant' || this.st === 'wake' || this.dead) return false;
    const landed = super.hurt(dmg, dx, dy);
    if (landed && !this.dead && !this.phase2 && !this.pendingPhase2 && this.hp <= MAX_HP / 2) {
      this.pendingPhase2 = true;
      // a stagger into phase 2 cuts short whatever it was recovering from
      if (this.st === 'recover' || this.st === 'stunned') this.set('pause', 0);
    }
    if (landed && dmg >= 3) this.world.shake(0.4);
    return landed;
  }

  protected onHurt() {
    // no knockback or stagger: it's a walking furnace
  }

  // ---- death -----------------------------------------------------------------------------

  die() {
    if (this.dead) return;
    this.dead = true;
    this.set('dying', 2.8);
    this.contactDamage = 0;
    this.vx = 0;
    const w = this.world;
    w.ui.boss(NAME, 0);
    this.audio.playSong(null);
    w.sfx('roar');
    w.hitstop(0.3);
    w.shake(1);
    this.anim.play('stun');
    for (const e of w.entities) {
      if (e instanceof Shockwave || e instanceof FallingCinder || (e instanceof Bullet && !e.friendly)) e.removed = true;
    }
  }

  private dying(dt: number) {
    const w = this.world;
    this.boom -= dt;
    this.applyGravity(dt);
    this.physics(dt);
    this.anim.update(dt);
    this.flash = Math.floor(this.t * 14) % 2 ? 0.05 : 0;
    if (this.boom <= 0 && this.t > 0) {
      this.boom = 0.16;
      const x = this.cx + rand(-14, 14);
      const y = this.y + rand(0, 34);
      w.particles.burst(x, y, 10, { colors: [3, 2, 1], speed: [30, 120], life: [0.2, 0.6], size: [1, 3] });
      w.shake(0.3);
      if (Math.random() < 0.6) this.audio.noise(0.35, 0.25, 'lowpass', 2200, 80);
    }
    if (this.t <= 0 && !this.finished) this.finish();
  }

  private finish() {
    this.finished = true;
    const w = this.world;
    w.sfx('explode');
    w.shake(1);
    w.hitstop(0.25);
    w.add(new OneShot(w, 'ring', 'pop', this.cx, this.cy));
    w.particles.burst(this.cx, this.cy, 60, { colors: [3, 2, 1], speed: [60, 230], life: [0.5, 1.3], size: [1, 3], grav: 260, bounce: true });
    w.add(new WardenWreck(w, this.cx, this.floor, this.dir < 0));
    w.spawnSouls(this.cx, this.cy, 30);
    w.setFlag(FLAG);
    w.setGates(false);
    w.arena = null;
    w.ui.boss(null);
    this.audio.playSong(w.def.music);
    w.ui.banner('WARDEN DEFEATED', 'THE FURNACES FALL QUIET');
    this.removed = true;
  }

  // ---- drawing ------------------------------------------------------------------------------

  drawBack(r: Renderer) {
    if (this.st === 'dormant' || this.st === 'dying') return;
    const core = this.st === 'stunned' ? 0 : this.anim.name === 'roar' || this.st === 'charge' ? 20 : 14;
    if (core) r.halo(this.cx + this.dir * 5, this.bottom - 25, core + (Math.sin(this.world.time * 9) > 0.5 ? 1 : 0), 1);
  }

  draw(r: Renderer) {
    const jitter = this.st === 'chargeTell' || this.st === 'rainTell' || this.st === 'dying' ? Math.round(Math.sin(this.world.time * 70)) : 0;
    // the leap's landing mark
    if (this.st === 'leap') landingMark(r, this.landX, this.floor, 15, this.world.time);
    this.drawFrame(r, 'foundry-warden', this.anim.frame, this.cx + jitter, this.bottom, { flip: this.dir < 0 });
  }

  light() {
    return { x: this.cx, y: this.cy, r: 64 };
  }
}

registerEntity('foundry:warden', (w, x, y) => {
  if (w.hasFlag(FLAG)) return new WardenWreck(w, x + 4, y + 8, true);
  return new Warden(w, x, y);
});
