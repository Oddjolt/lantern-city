import { Audio } from '../engine/audio';
import { Input } from '../engine/input';
import { H, Renderer, W } from '../engine/renderer';
import { newProfile, type Profile } from './profile';

export interface Scene {
  update(dt: number): void;
  draw(r: Renderer): void;
}

const STEP = 1 / 60;

/** Owns the loop, the current scene, input/audio and the persistent profile. */
export class Game {
  readonly r: Renderer;
  readonly input = new Input();
  readonly audio = new Audio();
  profile: Profile = newProfile();
  scene: Scene | null = null;
  debug = new URLSearchParams(location.search).has('debug');
  /** Debug noclip (F while debug is on). */
  fly = false;
  private fade = { t: 0, dir: 0, then: null as (() => void) | null };
  private last = 0;
  private acc = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.r = new Renderer(canvas);
    this.input.onGesture = () => this.audio.unlock();
    const fit = () => {
      const s = Math.max(1, Math.floor(Math.min(innerWidth / W, innerHeight / H)));
      canvas.style.width = `${W * s}px`;
      canvas.style.height = `${H * s}px`;
    };
    fit();
    addEventListener('resize', fit);
  }

  start(scene: Scene) {
    this.scene = scene;
    requestAnimationFrame((t) => {
      this.last = t;
      requestAnimationFrame(this.frame);
    });
  }

  /** Dithered fade out, swap whatever `then` changes, fade back in. */
  transition(then: () => void) {
    if (this.fade.dir !== 0) return;
    this.fade = { t: 0, dir: 1, then };
  }

  get transitioning() {
    return this.fade.dir !== 0;
  }

  /** Run the simulation for `seconds` right now and redraw (tests/tools; works in background tabs). */
  advance(seconds: number) {
    for (let i = 0; i < Math.round(seconds / STEP); i++) {
      this.input.poll();
      this.tick(STEP);
    }
    this.scene?.draw(this.r);
  }

  private frame = (now: number) => {
    this.acc += Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    while (this.acc >= STEP) {
      this.input.poll();
      this.tick(STEP);
      this.acc -= STEP;
    }
    if (this.scene) this.scene.draw(this.r);
    if (this.fade.t > 0) {
      this.r.screen();
      this.r.dither(this.fade.t, 0);
    }
    requestAnimationFrame(this.frame);
  };

  private tick(dt: number) {
    if (this.input.pressed('mute')) this.audio.toggleMusic();
    if (this.input.pressed('debug')) this.debug = !this.debug;
    if (this.debug && this.input.pressed('fly')) this.fly = !this.fly;
    if (this.fade.dir === 1) {
      this.fade.t = Math.min(1, this.fade.t + dt / 0.3);
      if (this.fade.t >= 1) {
        const then = this.fade.then;
        this.fade = { t: 1, dir: -1, then: null };
        then?.();
      }
      return;
    }
    if (this.fade.dir === -1) {
      this.fade.t = Math.max(0, this.fade.t - dt / 0.3);
      if (this.fade.t <= 0) this.fade.dir = 0;
    }
    this.scene?.update(dt);
  }
}
