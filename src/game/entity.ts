import type { Rect } from '../engine/math';
import type { Renderer } from '../engine/renderer';
import type { Player } from './player';
import type { World } from './world';

export interface Light {
  x: number;
  y: number;
  r: number;
}

/**
 * Base for everything that lives in a world. Positions are whole pixels (top-left of the
 * hitbox) with sub-pixel remainders, and movement steps one pixel at a time against
 * solids, like Celeste's actors.
 */
export abstract class Entity implements Rect {
  x: number;
  y: number;
  w: number;
  h: number;
  vx = 0;
  vy = 0;
  rx = 0;
  ry = 0;
  removed = false;
  /** Draw order: decor −10, pickups 0, enemies 5, player 10, projectiles 15, effects 20. */
  depth = 0;
  /** Blocks movement like a tile (crumbling blocks). */
  solid = false;
  /** Can be stood on from above like a one-way platform (moving platforms). */
  platform = false;
  /** Falls through one-way platforms (while dropping down through them). */
  ignoreOneWay = false;

  constructor(
    public world: World,
    x: number,
    y: number,
    w: number,
    h: number,
  ) {
    this.x = Math.round(x);
    this.y = Math.round(y);
    this.w = w;
    this.h = h;
  }

  update(_dt: number) {}
  draw(_r: Renderer) {}
  /** Drawn before the tile layer (light halos, things behind the terrain). */
  drawBack?(r: Renderer): void;

  /** Called when the player's slash overlaps `hurtbox()`. Return true if it was a solid hit (enables pogo/recoil). */
  onSlash?(player: Player, dx: number, dy: number): boolean;
  /** Called when the player presses ↑ nearby. Defining it makes the entity interactable. */
  interact?(player: Player): void;
  /** In dark worlds, light sources reveal a radius around themselves (one light or several). */
  light?(): Light | Light[] | null;

  hurtbox(): Rect {
    return this;
  }

  get cx() {
    return this.x + this.w / 2;
  }

  get cy() {
    return this.y + this.h / 2;
  }

  get bottom() {
    return this.y + this.h;
  }

  get right() {
    return this.x + this.w;
  }

  collideAt(x: number, y: number) {
    return this.world.solidAt(x, y, this.w, this.h, this);
  }

  onGround() {
    return this.collideAt(this.x, this.y + 1) || (!this.ignoreOneWay && this.world.oneWayAt(this.x, this.y + this.h, this.w, this));
  }

  /** Move horizontally, stopping at solids. Returns true on collision. */
  moveX(amount: number, onCollide?: () => void): boolean {
    this.rx += amount;
    let move = Math.round(this.rx);
    if (move === 0) return false;
    this.rx -= move;
    const s = Math.sign(move);
    while (move !== 0) {
      if (this.collideAt(this.x + s, this.y)) {
        this.rx = 0;
        onCollide?.();
        return true;
      }
      this.x += s;
      move -= s;
    }
    return false;
  }

  /** Move vertically, stopping at solids (and at one-way platforms when falling). */
  moveY(amount: number, onCollide?: () => void): boolean {
    this.ry += amount;
    let move = Math.round(this.ry);
    if (move === 0) return false;
    this.ry -= move;
    const s = Math.sign(move);
    while (move !== 0) {
      const blocked =
        this.collideAt(this.x, this.y + s) ||
        (s > 0 && !this.ignoreOneWay && this.world.oneWayAt(this.x, this.y + this.h, this.w, this));
      if (blocked) {
        this.ry = 0;
        onCollide?.();
        return true;
      }
      this.y += s;
      move -= s;
    }
    return false;
  }

  /** Move ignoring all collision (ghosts, projectiles that check hits themselves). */
  moveFree(dx: number, dy: number) {
    this.rx += dx;
    this.ry += dy;
    const mx = Math.round(this.rx);
    const my = Math.round(this.ry);
    this.x += mx;
    this.y += my;
    this.rx -= mx;
    this.ry -= my;
  }
}
