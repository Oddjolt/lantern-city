import { PLAYER_NECK } from '../art/player';
import { approach, overlaps, type Rect } from '../engine/math';
import type { Renderer } from '../engine/renderer';
import { Anim } from '../engine/sprites';
import { T } from '../engine/tilemap';
import { Afterimage, OneShot, SlashFx } from './common/fx';
import { Entity } from './entity';
import type { World } from './world';

// Movement tuning in pixels and seconds, modelled on Celeste.
const MAX_RUN = 90;
const RUN_ACCEL = 1000;
const RUN_REDUCE = 400;
const AIR_MULT = 0.65;
const GRAVITY = 900;
const MAX_FALL = 160;
const FAST_FALL = 240;
const HALF_GRAV_THRESHOLD = 40;
const JUMP_SPEED = -105;
const JUMP_H_BOOST = 40;
const VAR_JUMP_TIME = 0.2;
const DOUBLE_JUMP_SPEED = -100;
const WALL_JUMP_H = MAX_RUN + JUMP_H_BOOST;
const WALL_JUMP_FORCE = 0.16;
const WALL_SLIDE_MAX = 45;
const COYOTE = 0.1;
const JUMP_BUFFER = 0.12;
const DASH_SPEED = 240;
const DASH_END_SPEED = 160;
const DASH_TIME = 0.15;
const DASH_COOLDOWN = 0.2;
const ATTACK_TIME = 0.26;
const ATTACK_ACTIVE = 0.11;
const ATTACK_COOLDOWN = 0.28;
const POGO_SPEED = -200;
const HURT_TIME = 0.3;
const INVULN_TIME = 1.1;
const WATER_GRAVITY = 260;
const WATER_MAX_FALL = 45;
const WATER_MAX_RUN = 62;
const SWIM_STROKE = -100;
const UPDRAFT_SPEED = -125;
const UPDRAFT_ACCEL = 750;

type State = 'normal' | 'dash' | 'hurt' | 'respawn' | 'dead' | 'cutscene';
export type AttackDir = 'fwd' | 'up' | 'down';

interface Attack {
  dir: AttackDir;
  t: number;
  alt: boolean;
  /** Entities and cracked-wall groups this swing already hit. */
  hits: Set<unknown>;
  pogoed: boolean;
  recoiled: boolean;
}

export class Player extends Entity {
  state: State = 'normal';
  facing: 1 | -1 = 1;
  dashes = 1;
  /** The thing you can talk to / use right now (shown with a ↑ prompt). */
  interactTarget: Entity | null = null;

  private anim = new Anim('player', 'idle');
  private stateTime = 0;
  private sx = 1;
  private sy = 1;
  private wasOnGround = true;
  private landSpeed = 0;
  private coyote = 0;
  private jumpBuffer = 0;
  private varJump = 0;
  private varJumpSpeed = 0;
  private forceMoveX = 0;
  private forceMoveTime = 0;
  private airJumps = 0;
  private dashTime = 0;
  private dashCooldown = 0;
  private dashDir = { x: 1, y: 0 };
  private trailTime = 0;
  private attack: Attack | null = null;
  private attackStarted = false;
  private attackCooldown = 0;
  private attackAlt = false;
  private invuln = 0;
  private wallSliding = false;
  private dropTime = 0;
  private refillFlash = 0;
  private stepDust = 0;
  private lookTime = 0;
  private lookDir = 0;
  private inWater = false;
  private lastSafe = { x: 0, y: 0 };
  private respawned = false;
  private reportedDeath = false;
  private carried = { vx: 0, vy: 0, t: 0 };
  private cutscene = { pose: null as string | null, time: 0, then: null as (() => void) | null };
  private scarf: { x: number; y: number }[] = [];

  constructor(world: World, x: number, y: number) {
    super(world, x - 4, y - 14, 8, 14);
    this.depth = 10;
    for (let i = 0; i < 6; i++) this.scarf.push({ x, y });
  }

  get profile() {
    return this.world.game.profile;
  }

  get alive() {
    return this.state !== 'dead';
  }

  /** Put the player's feet at (x, y). */
  place(x: number, y: number) {
    this.x = Math.round(x - this.w / 2);
    this.y = Math.round(y - this.h);
    this.rx = this.ry = this.vx = this.vy = 0;
    this.lastSafe = { x: this.x, y: this.y };
    for (const n of this.scarf) {
      n.x = this.cx;
      n.y = this.y + 4;
    }
  }

  /** Camera offset: look ahead in the facing direction; hold ↑/↓ while standing still to peek. */
  lookAhead() {
    return { x: this.facing * 20, y: -10 + (this.lookTime > 0.35 ? this.lookDir * 56 : 0) };
  }

  /** Screen fade amount while respawning after a hazard (0..1). */
  get fade(): number {
    if (this.state !== 'respawn') return 0;
    const t = this.stateTime;
    return t < 0.3 ? t / 0.3 : t < 0.45 ? 1 : Math.max(0, 1 - (t - 0.45) / 0.2);
  }

  // ---- update ----------------------------------------------------------------------

  update(dt: number) {
    const input = this.world.game.input;
    const busy = this.world.ui.busy || this.state === 'cutscene';
    const ix = busy ? 0 : input.x;
    const iy = busy ? 0 : input.y;
    const jumpHeld = !busy && input.down('jump');
    if (!busy && input.pressed('jump')) this.jumpBuffer = JUMP_BUFFER;

    this.stateTime += dt;
    this.coyote -= dt;
    this.jumpBuffer -= dt;
    this.varJump -= dt;
    this.forceMoveTime -= dt;
    this.dashCooldown -= dt;
    this.attackCooldown -= dt;
    this.invuln -= dt;
    this.dropTime -= dt;
    this.refillFlash -= dt;
    this.carried.t -= dt;
    this.ignoreOneWay = this.dropTime > 0;

    if (this.state === 'dead') {
      if (this.stateTime > 1.3 && !this.reportedDeath) {
        this.reportedDeath = true;
        this.world.ui.died();
      }
      return;
    }
    if (this.state === 'respawn') return this.respawnUpdate();
    if (this.world.game.debug && this.world.game.fly) {
      // debug noclip: fly anywhere, ignore hazards
      this.vx = ix * 220;
      this.vy = iy * 220;
      this.moveFree(this.vx * dt, this.vy * dt);
      this.updateScarf(dt);
      return;
    }

    const onGround = this.onGround();
    const wasInWater = this.inWater;
    this.inWater = this.world.tileAt(this.cx, this.cy) === T.Water;
    if (this.inWater !== wasInWater) this.splash();
    if (onGround || this.inWater) {
      this.coyote = onGround ? COYOTE : 0;
      this.airJumps = this.profile.abilities.doubleJump ? 1 : 0;
      if (this.dashes < 1 && this.dashCooldown <= 0 && this.state !== 'dash') this.refillDash(false);
    }
    if (onGround && !this.wasOnGround && this.state !== 'dash') this.land();
    this.wasOnGround = onGround;

    const map = this.world.map;
    if (
      this.state !== 'cutscene' &&
      (map.spikeHit(this) || map.touches({ x: this.x + 1, y: this.y + 4, w: this.w - 2, h: this.h - 4 }, T.Acid) || this.y > map.ph + 24)
    ) {
      this.hazard();
      return;
    }

    switch (this.state) {
      case 'normal':
        this.normal(dt, ix, iy, jumpHeld, onGround, busy);
        break;
      case 'dash':
        this.dashing(dt, onGround, ix);
        break;
      case 'hurt':
        this.vy = approach(this.vy, MAX_FALL, GRAVITY * dt);
        this.vx = approach(this.vx, 0, 300 * dt);
        if (this.stateTime >= HURT_TIME) this.setState('normal');
        break;
      case 'cutscene':
        this.vx = approach(this.vx, 0, 600 * dt);
        this.vy = approach(this.vy, MAX_FALL, GRAVITY * dt);
        this.cutscene.time -= dt;
        if (this.cutscene.time <= 0) {
          this.setState('normal');
          const then = this.cutscene.then;
          this.cutscene = { pose: null, time: 0, then: null };
          then?.();
        }
        break;
    }

    this.updateAttack(dt, onGround);

    const vyBefore = this.vy;
    this.moveX(this.vx * dt, () => (this.vx = 0));
    this.moveY(this.vy * dt, () => this.hitY(vyBefore));

    if (this.state === 'normal' && this.onGround() && this.isSafeGround()) this.lastSafe = { x: this.x, y: this.y };
    const peeking = this.state === 'normal' && onGround && ix === 0 && iy !== 0 && !this.attack && Math.abs(this.vx) < 5;
    this.lookTime = peeking && (iy === this.lookDir || this.lookTime === 0) ? this.lookTime + dt : 0;
    this.lookDir = iy;
    this.findInteractable(busy);
    this.sx = approach(this.sx, 1, 3 * dt);
    this.sy = approach(this.sy, 1, 3 * dt);
    this.pickAnim(dt, ix, this.onGround());
    this.updateScarf(dt);
  }

  private setState(s: State) {
    this.state = s;
    this.stateTime = 0;
  }

  private normal(dt: number, ix: number, iy: number, jumpHeld: boolean, onGround: boolean, busy: boolean) {
    const input = this.world.game.input;
    let mx = ix;
    if (this.forceMoveTime > 0) mx = this.forceMoveX;
    if (mx !== 0 && !this.attack) this.facing = mx > 0 ? 1 : -1;

    // horizontal
    const onIce = onGround && this.world.tileAt(this.cx, this.bottom) === T.Ice;
    const max = this.inWater ? WATER_MAX_RUN : MAX_RUN;
    const mult = onGround ? 1 : AIR_MULT;
    let accel = RUN_ACCEL;
    let reduce = RUN_REDUCE;
    if (onIce) {
      accel *= mx !== 0 && Math.sign(this.vx) === mx ? 0.35 : 0.1;
      reduce *= 0.2;
    }
    if (Math.abs(this.vx) > max && Math.sign(this.vx) === mx) this.vx = approach(this.vx, max * mx, reduce * mult * dt);
    else this.vx = approach(this.vx, max * mx, accel * mult * dt);
    if (onGround && !this.inWater) {
      // footstep puffs, and a skid when turning hard
      this.stepDust -= dt;
      if (Math.abs(this.vx) > 70 && this.stepDust <= 0) {
        this.stepDust = 0.18;
        this.dust(this.cx - this.facing * 3, this.bottom, 1);
      }
      if (mx !== 0 && Math.sign(this.vx) === -mx && Math.abs(this.vx) > 45 && Math.random() < 0.5)
        this.dust(this.cx + Math.sign(this.vx) * 3, this.bottom, 1);
    }

    // vertical
    this.wallSliding = false;
    const updraft = this.world.map.touches(this, T.Updraft);
    if (this.inWater) {
      this.vy = approach(this.vy, iy > 0 ? WATER_MAX_FALL * 1.8 : WATER_MAX_FALL, WATER_GRAVITY * dt);
    } else if (updraft) {
      this.vy = approach(this.vy, iy > 0 ? 40 : UPDRAFT_SPEED, UPDRAFT_ACCEL * dt);
    } else if (!onGround) {
      let maxFall = iy > 0 ? FAST_FALL : MAX_FALL;
      if (mx !== 0 && this.vy >= 0 && this.collideAt(this.x + mx, this.y)) {
        this.wallSliding = true;
        maxFall = WALL_SLIDE_MAX;
        this.facing = mx > 0 ? -1 : 1;
        if (Math.random() < dt * 14) this.dust(mx > 0 ? this.right : this.x, this.y + 4, 1);
      }
      const half = Math.abs(this.vy) < HALF_GRAV_THRESHOLD && jumpHeld;
      this.vy = approach(this.vy, maxFall, GRAVITY * (half ? 0.5 : 1) * dt);
    }
    if (this.varJump > 0) {
      if (jumpHeld) this.vy = Math.min(this.vy, this.varJumpSpeed);
      else this.varJump = 0;
    }

    // jumping
    if (this.jumpBuffer > 0) {
      if (this.inWater) {
        const headOut = this.world.tileAt(this.cx, this.y - 2) !== T.Water;
        this.jumpBuffer = 0;
        if (headOut) this.jump(ix);
        else {
          this.vy = SWIM_STROKE;
          this.world.particles.burst(this.cx, this.bottom, 3, { colors: [3, 2], speed: [10, 30], angle: [0.5, 2.6] });
        }
      } else if (iy > 0 && onGround && this.standingOnOneWayOnly()) {
        this.jumpBuffer = 0;
        this.dropTime = 0.2;
        this.ignoreOneWay = true;
      } else if (this.coyote > 0) this.jump(ix);
      else {
        const wall = this.collideAt(this.x + 3, this.y) ? 1 : this.collideAt(this.x - 3, this.y) ? -1 : 0;
        if (wall !== 0) this.wallJump(wall > 0 ? -1 : 1);
        else if (this.airJumps > 0) this.doubleJump();
      }
    }

    if (busy) return;
    if (input.pressed('dash') && this.profile.abilities.dash && this.dashes > 0 && this.dashCooldown <= 0) {
      this.startDash(ix, iy);
    } else if (input.pressed('attack') && this.attackCooldown <= 0) {
      this.startAttack(iy, onGround);
    } else if (input.pressed('up') && onGround && this.interactTarget?.interact) {
      this.interactTarget.interact(this);
    }
  }

  private jump(ix: number) {
    this.jumpBuffer = 0;
    this.coyote = 0;
    this.varJump = VAR_JUMP_TIME;
    this.vy = JUMP_SPEED;
    this.vx += ix * JUMP_H_BOOST;
    if (this.carried.t > 0) {
      this.vx += this.carried.vx;
      this.vy += Math.min(0, this.carried.vy);
    }
    this.varJumpSpeed = this.vy;
    this.sx = 0.65;
    this.sy = 1.35;
    this.dust(this.cx, this.bottom, 4);
    this.world.sfx('jump');
  }

  private wallJump(dir: 1 | -1) {
    this.jumpBuffer = 0;
    this.varJump = VAR_JUMP_TIME;
    this.vy = JUMP_SPEED;
    this.varJumpSpeed = this.vy;
    this.vx = dir * WALL_JUMP_H;
    this.forceMoveX = dir;
    this.forceMoveTime = WALL_JUMP_FORCE;
    this.facing = dir;
    this.sx = 0.7;
    this.sy = 1.3;
    this.dust(dir > 0 ? this.x : this.right, this.cy + 3, 4);
    this.world.sfx('walljump');
  }

  private doubleJump() {
    this.airJumps--;
    this.jumpBuffer = 0;
    this.varJump = VAR_JUMP_TIME;
    this.vy = DOUBLE_JUMP_SPEED;
    this.varJumpSpeed = this.vy;
    this.sx = 0.7;
    this.sy = 1.3;
    this.world.add(new OneShot(this.world, 'ring', 'pop', this.cx, this.bottom));
    this.world.particles.burst(this.cx, this.bottom, 8, { colors: [3, 2], speed: [30, 70], angle: [0.2, Math.PI - 0.2] });
    this.world.sfx('walljump');
  }

  private land() {
    const k = Math.min(1, this.landSpeed / MAX_FALL);
    this.sx = 1 + 0.4 * k;
    this.sy = 1 - 0.35 * k;
    if (this.landSpeed > 60) {
      this.dust(this.cx, this.bottom, 3 + Math.round(k * 4));
      this.world.sfx('land');
    }
  }

  private hitY(vyBefore: number) {
    if (vyBefore > 0) {
      this.landSpeed = vyBefore;
      this.vy = 0;
      return;
    }
    // corner correction: slide around ceiling corners instead of bonking
    if (vyBefore < 0 && this.state !== 'dash') {
      for (const d of [1, -1, 2, -2, 3, -3, 4, -4]) {
        if (!this.collideAt(this.x + d, this.y - 1)) {
          this.x += d;
          return;
        }
      }
    }
    this.vy = 0;
    this.varJump = 0;
  }

  // ---- dash ---------------------------------------------------------------------------

  private startDash(ix: number, iy: number) {
    let dx = ix;
    const dy = iy;
    if (dx === 0 && dy === 0) dx = this.facing;
    const len = Math.hypot(dx, dy);
    this.dashDir = { x: dx / len, y: dy / len };
    this.dashes--;
    this.setState('dash');
    this.dashTime = DASH_TIME;
    this.dashCooldown = DASH_COOLDOWN;
    this.vx = this.dashDir.x * DASH_SPEED;
    this.vy = this.dashDir.y * DASH_SPEED;
    if (dx !== 0) this.facing = dx > 0 ? 1 : -1;
    this.varJump = 0;
    this.attack = null;
    this.trailTime = 0;
    this.world.hitstop(0.04);
    this.world.shake(0.12);
    this.world.sfx('dash');
    this.world.particles.burst(this.cx, this.cy, 8, { colors: [3, 2], speed: [30, 90], life: [0.2, 0.4] });
  }

  private dashing(dt: number, onGround: boolean, ix: number) {
    this.dashTime -= dt;
    this.trailTime -= dt;
    if (this.trailTime <= 0) {
      this.trailTime = 0.03;
      this.world.add(new Afterimage(this.world, 'player', this.anim.frame, this.x + 4, this.bottom, this.facing < 0));
    }
    if (Math.random() < 0.7)
      this.world.particles.burst(this.cx, this.cy + 2, 1, { colors: [2, 3], speed: [5, 20], life: [0.2, 0.4], spread: 3 });
    // jumping out of a grounded dash keeps the speed: a long "dash-jump"
    if (this.jumpBuffer > 0 && onGround && this.dashDir.y >= 0) {
      this.setState('normal');
      this.jump(ix);
      this.vx = Math.sign(this.dashDir.x || this.facing) * 200;
      return;
    }
    if (this.dashTime <= 0) {
      this.setState('normal');
      if (this.dashDir.y <= 0) {
        this.vx = this.dashDir.x * DASH_END_SPEED;
        this.vy = this.dashDir.y * DASH_END_SPEED * 0.75;
      }
    }
  }

  private refillDash(sound: boolean) {
    if (this.dashes >= 1) return;
    this.dashes = 1;
    if (!this.profile.abilities.dash) return;
    this.refillFlash = 0.12;
    if (sound) this.world.sfx('refill');
  }

  /** Launch upward (spring pads, steam vents…). */
  bounce(speed: number) {
    if (this.state === 'dash') this.setState('normal');
    this.vy = speed;
    this.varJump = 0;
    this.airJumps = this.profile.abilities.doubleJump ? 1 : 0;
    this.refillDash(true);
    this.sx = 0.7;
    this.sy = 1.3;
  }

  /** Called by a moving platform every frame you stand on it (so jumps inherit its motion). */
  carry(vx: number, vy: number) {
    this.carried = { vx, vy, t: 0.12 };
  }

  // ---- combat ---------------------------------------------------------------------------

  private startAttack(iy: number, onGround: boolean) {
    const dir: AttackDir = iy < 0 ? 'up' : iy > 0 && !onGround ? 'down' : 'fwd';
    this.attackAlt = !this.attackAlt;
    this.attack = { dir, t: 0, alt: this.attackAlt, hits: new Set(), pogoed: false, recoiled: false };
    this.attackStarted = true;
    this.attackCooldown = ATTACK_COOLDOWN;
    this.world.sfx('slash');
    this.world.add(new SlashFx(this.world, this, dir, this.attackAlt));
  }

  attackBox(dir: AttackDir): Rect {
    switch (dir) {
      case 'fwd':
        return { x: this.facing > 0 ? this.right - 1 : this.x - 21, y: this.y - 4, w: 22, h: 20 };
      case 'up':
        return { x: this.x - 7, y: this.y - 21, w: 22, h: 23 };
      case 'down':
        return { x: this.x - 7, y: this.bottom - 2, w: 22, h: 21 };
    }
  }

  private updateAttack(dt: number, onGround: boolean) {
    const a = this.attack;
    if (!a) return;
    a.t += dt;
    if (a.t <= ATTACK_ACTIVE && (this.state === 'normal' || this.state === 'cutscene')) {
      const box = this.attackBox(a.dir);
      const dx = a.dir === 'fwd' ? this.facing : 0;
      const dy = a.dir === 'up' ? -1 : a.dir === 'down' ? 1 : 0;
      let landed = false;
      for (const e of this.world.entities) {
        if (!e.onSlash || e.removed || a.hits.has(e) || !overlaps(box, e.hurtbox())) continue;
        a.hits.add(e);
        if (e.onSlash(this, dx, dy)) landed = true;
      }
      if (this.world.slashBreakables(box, a.hits)) landed = true;
      if (a.dir === 'down' && !a.pogoed && (landed || this.world.map.spikeHit(box))) {
        a.pogoed = true;
        this.vy = POGO_SPEED;
        this.varJump = 0;
        this.airJumps = this.profile.abilities.doubleJump ? 1 : 0;
        this.refillDash(true);
        this.sx = 0.75;
        this.sy = 1.25;
      } else if (landed && a.dir === 'fwd' && !a.recoiled) {
        a.recoiled = true;
        this.vx = -this.facing * (onGround ? 95 : 70);
      }
    }
    if (a.t >= ATTACK_TIME) this.attack = null;
  }

  /** Take damage from an enemy at x = fromX. Returns false if it didn't land (invulnerable, dashing…). */
  hurt(dmg: number, fromX: number): boolean {
    if (!this.alive || this.invuln > 0 || this.state === 'dash' || this.state === 'respawn' || this.state === 'cutscene') return false;
    this.profile.hp = Math.max(0, this.profile.hp - dmg);
    this.invuln = INVULN_TIME;
    this.world.sfx('hurt');
    this.world.hitstop(0.12);
    this.world.shake(0.5);
    this.chips(8);
    if (this.profile.hp <= 0) {
      this.die();
      return true;
    }
    const dir = Math.sign(this.cx - fromX) || -this.facing;
    this.setState('hurt');
    this.vx = dir * 140;
    this.vy = -120;
    this.facing = dir > 0 ? -1 : 1;
    this.attack = null;
    return true;
  }

  /** Spikes, acid and pits: lose one health and reappear at the last safe spot. */
  private hazard() {
    if (this.invuln <= 0) this.profile.hp = Math.max(0, this.profile.hp - 1);
    this.world.sfx('hurt');
    this.world.hitstop(0.1);
    this.world.shake(0.5);
    this.chips(10);
    if (this.profile.hp <= 0) return this.die();
    this.setState('respawn');
    this.respawned = false;
    this.vx = this.vy = 0;
    this.attack = null;
  }

  private respawnUpdate() {
    if (this.stateTime > 0.45 && !this.respawned) {
      this.respawned = true;
      this.x = this.lastSafe.x;
      this.y = this.lastSafe.y;
      this.rx = this.ry = 0;
      this.invuln = 1;
      for (const n of this.scarf) {
        n.x = this.cx;
        n.y = this.y + 4;
      }
      this.world.particles.burst(this.cx, this.cy, 10, { colors: [3, 2], speed: [20, 60], life: [0.3, 0.5] });
    }
    if (this.stateTime > 0.62) this.setState('normal');
  }

  private die() {
    this.setState('dead');
    this.reportedDeath = false;
    this.profile.deaths++;
    this.world.sfx('die');
    this.world.hitstop(0.25);
    this.world.shake(0.7);
    this.chips(26);
    this.world.particles.burst(this.cx, this.y, 10, { colors: [3], speed: [10, 40], angle: [-2.4, -0.7], life: [0.8, 1.4], drag: 1 });
  }

  /** Splinters of wood. */
  private chips(n: number) {
    this.world.particles.burst(this.cx, this.cy, n, {
      colors: [3, 2, 2],
      speed: [40, 150],
      life: [0.5, 1.1],
      size: [1, 2],
      grav: 420,
      bounce: true,
      shrink: false,
    });
  }

  /** Freeze controls and hold a pose for `seconds`, then call `then`. */
  startCutscene(pose: string | null, seconds: number, then?: () => void) {
    this.setState('cutscene');
    this.attack = null;
    this.cutscene = { pose, time: seconds, then: then ?? null };
  }

  // ---- helpers --------------------------------------------------------------------------

  private standingOnOneWayOnly() {
    return !this.collideAt(this.x, this.y + 1) && this.world.map.oneWayTop(this.x, this.bottom, this.w);
  }

  private isSafeGround() {
    const m = this.world.map;
    if (!m.solidRect(this.x, this.bottom, this.w, 1)) return false;
    const probe = { x: this.x - 12, y: this.y - 4, w: this.w + 24, h: this.h + 12 };
    return !m.spikeHit(probe) && !m.touches(probe, T.Acid) && !this.inWater;
  }

  private findInteractable(busy: boolean) {
    this.interactTarget = null;
    if (busy || this.state !== 'normal') return;
    let best = Infinity;
    for (const e of this.world.entities) {
      if (!e.interact || e.removed) continue;
      const d = Math.abs(e.cx - this.cx);
      if (d < e.w / 2 + 8 && Math.abs(e.bottom - this.bottom) < 24 && d < best) {
        best = d;
        this.interactTarget = e;
      }
    }
  }

  private dust(x: number, y: number, n: number) {
    this.world.particles.burst(x, y - 1, n, { colors: [2, 1], speed: [10, 40], angle: [-Math.PI, 0], life: [0.2, 0.45], size: [1, 2] });
  }

  private splash() {
    this.world.particles.burst(this.cx, this.cy, 8, { colors: [3, 2], speed: [30, 90], angle: [-2.8, -0.3], grav: 300, life: [0.3, 0.6] });
    this.world.sfx('land');
  }

  // ---- animation & drawing ----------------------------------------------------------------

  private pickAnim(dt: number, ix: number, onGround: boolean) {
    let name: string;
    let speed = 1;
    if (this.state === 'cutscene' && this.cutscene.pose) name = this.cutscene.pose;
    else if (this.state === 'hurt') name = 'hurt';
    else if (this.state === 'dash') name = 'dash';
    else if (this.attack)
      name = this.attack.dir === 'fwd' ? (this.attack.alt ? 'slashB' : 'slashA') : this.attack.dir === 'up' ? 'slashUp' : 'slashDown';
    else if (this.inWater) name = 'swim';
    else if (!onGround) name = this.wallSliding ? 'wall' : this.vy < -25 ? 'jump' : this.vy > 35 ? 'fall' : 'apex';
    else if (ix !== 0 || Math.abs(this.vx) > 25) {
      name = 'run';
      speed = 0.5 + (Math.abs(this.vx) / MAX_RUN) * 0.7;
    } else name = 'idle';
    this.anim.play(name, this.attackStarted);
    this.attackStarted = false;
    this.anim.update(dt * speed);
  }

  private neck() {
    const [ax, ay] = PLAYER_NECK[this.anim.frame] ?? [6, 12];
    const px = this.x + 4;
    return { x: this.facing > 0 ? px - 8 + ax : px + 7 - ax, y: this.bottom - 20 + ay };
  }

  private updateScarf(dt: number) {
    const s = this.scarf;
    const n0 = this.neck();
    s[0].x = n0.x;
    s[0].y = n0.y;
    const back = -this.facing;
    const k = Math.min(1, dt * 24);
    for (let i = 1; i < s.length; i++) {
      const p = s[i - 1];
      const n = s[i];
      const wave = Math.sin(this.world.time * 8 + i * 0.9) * 0.6;
      n.x += (p.x + back * 1.6 - this.vx * 0.006 - n.x) * k;
      n.y += (p.y + 0.5 + wave - this.vy * 0.004 - n.y) * k;
      const dx = n.x - p.x;
      const dy = n.y - p.y;
      const d = Math.hypot(dx, dy);
      if (d > 2) {
        n.x = p.x + (dx / d) * 2;
        n.y = p.y + (dy / d) * 2;
      }
    }
  }

  private scarfColor() {
    if (!this.profile.abilities.dash) return 2;
    if (this.refillFlash > 0) return 3;
    return this.dashes > 0 ? 2 : 1;
  }

  draw(r: Renderer) {
    if (this.state === 'dead') return;
    if (this.state === 'respawn' && !this.respawned) return;
    if (this.invuln > 0 && this.state !== 'hurt' && Math.floor(this.invuln * 16) % 2 === 0) return;
    const c = this.scarfColor();
    const s = this.scarf;
    for (let i = s.length - 1; i > 0; i--) r.line(s[i].x, s[i].y, s[i - 1].x, s[i - 1].y, c);
    for (let i = 0; i < 3; i++) r.rect(Math.round(s[i].x) - 1, Math.round(s[i].y), 2, 2, c);
    const flash = this.state === 'hurt' && this.stateTime < 0.08 ? 3 : undefined;
    r.sprite('player', this.anim.frame, this.x + 4, this.bottom, { flip: this.facing < 0, sx: this.sx, sy: this.sy, tint: flash });
  }

  light() {
    return { x: this.cx, y: this.cy, r: 46 };
  }
}
